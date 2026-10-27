#!/usr/bin/env node
/**
 * Build script: copy site to dist/ and append content-hash version query parameters
 * to all JS imports and HTML/CSS asset references. Source files are NOT modified.
 *
 * The build also runs a conservative *whitespace-only* minifier on JS/CSS/HTML
 * (no identifier renaming, no AST transforms) so we keep zero npm dependencies
 * while still cutting the wire size by ~40%.
 *
 * Strategy:
 *   1. Minify each JS / CSS / HTML file with a hand-rolled, conservative pass.
 *   2. Compute SHA256 hash (first 8 chars) of each minified JS / CSS file.
 *   3. Rewrite import / <script src> / <link href> URLs to include `?v=HASH`.
 *   4. Write the result into dist/. Vercel serves dist/ with immutable cache
 *      headers on /js/* and /css/*.
 *
 * Cache behaviour:
 *   - Hash unchanged → URL unchanged → cache hit (great performance).
 *   - Hash changed   → URL changed   → fresh download (instant update).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Files / directories to copy from project root → dist/. Add as needed.
// Note: css/ is NOT copied because the entire stylesheet is inlined
// into index.html during rewriteHtmlAssets(). Keeping the source file
// at css/style.css lets us still hash it for completeness, but no
// /css/* URL is ever served to the browser.
const COPY_ENTRIES = [
    'js',
    'index.html',
    'favicon.svg',
    'manifest.json',
    'sw.js',
    'robots.txt',
    'sitemap.xml',
];

// ------------------------------------------------------------------
// Conservative minifiers (no rename, no AST)
// ------------------------------------------------------------------

/**
 * Minify JS source, preserving all identifiers and string contents.
 * - Strips // line comments and /* block *\/ comments outside strings/regex.
 * - Collapses runs of whitespace, but keeps a single space where the next
 *   character is alphanumeric or `_/$` to avoid token-merging bugs.
 * - Strips redundant whitespace around punctuation.
 * - Drops the trailing newline.
 */
function minifyJs(src) {
    // Strip non-essential console calls in production builds while keeping
    // console.error and console.warn (they are valuable for triaging
    // crashes from real users). The match is intentionally simple:
    //   console.log(...);    console.info(...);    console.debug(...);
    // It bails out for any console.* call whose body spans nested template
    // literals or arrow functions - those are extremely rare in this code
    // base and not worth the AST cost.
    src = src.replace(/\bconsole\.(log|info|debug)\s*\([^()]*\)\s*;?/g, '');

    let out = '';
    const len = src.length;
    let i = 0;
    let prev = ''; // last emitted non-space character

    const isIdent = (c) => /[A-Za-z0-9_$]/.test(c);

    // Track whether a `/` should be parsed as a regex literal (true after
    // operators / keywords / punctuation that can precede a regex).
    let regexAllowed = true;

    while (i < len) {
        const c = src[i];
        const c2 = src[i + 1];

        // Line comment
        if (c === '/' && c2 === '/') {
            while (i < len && src[i] !== '\n') i++;
            continue;
        }
        // Block comment
        if (c === '/' && c2 === '*') {
            i += 2;
            while (i < len && !(src[i] === '*' && src[i + 1] === '/')) i++;
            i += 2;
            continue;
        }
        // String literal (', ", `)
        if (c === '"' || c === '\'' || c === '`') {
            const quote = c;
            out += c;
            i++;
            while (i < len) {
                const ch = src[i];
                out += ch;
                if (ch === '\\' && i + 1 < len) {
                    out += src[i + 1];
                    i += 2;
                    continue;
                }
                i++;
                if (ch === quote) break;
                // Handle `${...}` template substitutions: keep contents verbatim
                if (quote === '`' && ch === '$' && src[i] === '{') {
                    let depth = 1;
                    out += src[i];
                    i++;
                    while (i < len && depth > 0) {
                        const tc = src[i];
                        out += tc;
                        if (tc === '{') depth++;
                        else if (tc === '}') depth--;
                        i++;
                    }
                }
            }
            prev = quote;
            regexAllowed = false;
            continue;
        }
        // Regex literal
        if (c === '/' && regexAllowed) {
            out += c;
            i++;
            while (i < len) {
                const ch = src[i];
                out += ch;
                if (ch === '\\' && i + 1 < len) {
                    out += src[i + 1];
                    i += 2;
                    continue;
                }
                i++;
                if (ch === '/') break;
                if (ch === '[') {
                    while (i < len && src[i] !== ']') {
                        out += src[i];
                        if (src[i] === '\\' && i + 1 < len) {
                            out += src[i + 1];
                            i += 2;
                            continue;
                        }
                        i++;
                    }
                }
            }
            // Regex flags
            while (i < len && /[a-z]/.test(src[i])) {
                out += src[i];
                i++;
            }
            prev = '/';
            regexAllowed = false;
            continue;
        }
        // Whitespace (incl. newlines)
        if (/\s/.test(c)) {
            // Look ahead to next non-space character
            let j = i;
            while (j < len && /\s/.test(src[j])) j++;
            const next = src[j] || '';
            // Need a separating space iff prev and next are both ident-chars
            // (e.g. `return foo`, `var x`, `1 in arr`). A leading `+`/`-`
            // also needs space to avoid `a++ +b` collapsing to `a+++b`.
            const needSpace =
                (isIdent(prev) && isIdent(next)) ||
                ((prev === '+' || prev === '-') && prev === next);
            if (needSpace) out += ' ';
            i = j;
            continue;
        }

        out += c;
        prev = c;
        // Update regexAllowed: a regex can follow operators / `(` / `,` / `;`
        // / `=` / `!` / `&` / `|` / `?` / `:` / `{` / `}` / `[` / `return`,
        // but cannot follow an identifier or closing paren/bracket.
        if (isIdent(c) || c === ')' || c === ']') regexAllowed = false;
        else regexAllowed = true;
        i++;
    }
    return out.trim();
}

/** Minify CSS: strip comments and collapse whitespace. */
function minifyCss(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')        // comments
        .replace(/\s+/g, ' ')                    // collapse whitespace
        .replace(/\s*([{};:,>+~])\s*/g, '$1')    // around punctuation
        .replace(/;}/g, '}')                     // last semicolon
        .trim();
}

/** Minify HTML: strip comments + collapse whitespace between tags. */
function minifyHtml(src) {
    return src
        // Drop HTML comments but keep IE conditional comments.
        .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
        // Collapse whitespace between tags.
        .replace(/>\s+</g, '><')
        // Collapse runs of spaces / tabs.
        .replace(/[ \t]+/g, ' ')
        // Drop blank lines.
        .replace(/\n\s*\n/g, '\n')
        .trim();
}

// ------------------------------------------------------------------
// Hashing & rewriting
// ------------------------------------------------------------------

function hashContent(content) {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
}

function rmDir(dir) {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function listFiles(dir, ext) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith(ext))
        .map(f => path.join(dir, f));
}

// Pre-minify all JS / CSS so hashes reflect the *delivered* bytes.
const jsFiles = listFiles(path.join(ROOT, 'js'), '.js');
const cssFiles = listFiles(path.join(ROOT, 'css'), '.css');

const minifiedContent = new Map(); // absolute path → minified text
const hashMap = new Map();         // basename       → 8-char hash

for (const file of jsFiles) {
    minifiedContent.set(file, minifyJs(fs.readFileSync(file, 'utf8')));
}
for (const file of cssFiles) {
    const min = minifyCss(fs.readFileSync(file, 'utf8'));
    minifiedContent.set(file, min);
    hashMap.set(path.basename(file), hashContent(min));
}

// A JS file's delivered bytes include the ?v=HASH of every module it imports
// (see rewriteJsImports). So its own URL hash MUST also change whenever any
// (transitive) dependency changes - otherwise the importer keeps the same URL
// while its content differs, and because /js/* is served `immutable` for a
// year, CDN / browser / service-worker keep serving the stale importer that
// still points at the OLD dependency. That is how a fix to levels.js once
// never reached players: main.js was unchanged, kept its hash, and kept
// importing the old levels.js. Hash = own content + deps' hashes (Merkle).
const IMPORT_RE = /(?:from\s*['"]|import\s*\(\s*['"])(\.\.?\/[^'"?]+\.js)['"]/g;
const jsDeps = new Map();
for (const file of jsFiles) {
    const deps = new Set();
    for (const m of minifiedContent.get(file).matchAll(IMPORT_RE)) {
        const dep = path.resolve(path.dirname(file), m[1]);
        if (dep !== file && minifiedContent.has(dep)) deps.add(dep);
    }
    jsDeps.set(file, [...deps].sort());
}
const deepHashMemo = new Map();
function deepHash(file, stack = new Set()) {
    if (deepHashMemo.has(file)) return deepHashMemo.get(file);
    stack.add(file);
    let acc = minifiedContent.get(file);
    for (const dep of jsDeps.get(file)) {
        if (stack.has(dep)) continue; // import cycle: stop, own content already counted
        acc += '\n' + path.basename(dep) + ':' + deepHash(dep, stack);
    }
    stack.delete(file);
    const h = hashContent(acc);
    deepHashMemo.set(file, h);
    return h;
}
for (const file of jsFiles) {
    hashMap.set(path.basename(file), deepHash(file));
}

let totalRaw = 0, totalMin = 0;
for (const [file, min] of minifiedContent) {
    totalRaw += fs.statSync(file).size;
    totalMin += Buffer.byteLength(min, 'utf8');
}
console.log(`[build] minified ${minifiedContent.size} assets: ${totalRaw} → ${totalMin} bytes (${((1 - totalMin / totalRaw) * 100).toFixed(1)}% saved)`);

function rewriteJsImports(content) {
    return content.replace(
        /(from\s*['"]|import\s*\(\s*['"])(\.\.?\/[^'"?]+\.js)(['"])/g,
        (match, prefix, importPath, suffix) => {
            const basename = path.basename(importPath);
            const hash = hashMap.get(basename);
            if (!hash) return match;
            return `${prefix}${importPath}?v=${hash}${suffix}`;
        }
    );
}

function rewriteHtmlAssets(html) {
    html = html.replace(
        /(<script[^>]*\bsrc=['"])\/js\/([^'"?]+\.js)(['"])/g,
        (m, p, f, s) => {
            const h = hashMap.get(f);
            return h ? `${p}/js/${f}?v=${h}${s}` : m;
        }
    );
    // <link rel="modulepreload" href="/js/foo.js"> and similar.
    html = html.replace(
        /(<link[^>]*\bhref=['"])\/js\/([^'"?]+\.js)(['"])/g,
        (m, p, f, s) => {
            const h = hashMap.get(f);
            return h ? `${p}/js/${f}?v=${h}${s}` : m;
        }
    );
    html = html.replace(
        /(<link[^>]*\bhref=['"])\/css\/([^'"?]+\.css)(['"])/g,
        (m, p, f, s) => {
            const h = hashMap.get(f);
            return h ? `${p}/css/${f}?v=${h}${s}` : m;
        }
    );

    // Inline the entire CSS into the <style>/*__INLINE_CSS__*/</style>
    // placeholder so the first paint doesn't have to wait for an
    // additional /css/style.css round-trip. The placeholder is the
    // canonical site-wide CSS source; we stitch every minified .css
    // file together (currently just one).
    let inlineCss = '';
    for (const file of cssFiles) {
        inlineCss += minifiedContent.get(file) || '';
    }
    if (inlineCss) {
        html = html.replace('/*__INLINE_CSS__*/', inlineCss);
    }

    return html;
}

function copyFileWithTransform(srcFile, destFile) {
    const ext = path.extname(srcFile).toLowerCase();
    const basename = path.basename(srcFile);
    if (ext === '.js') {
        const min = minifiedContent.get(srcFile) ?? minifyJs(fs.readFileSync(srcFile, 'utf8'));
        fs.writeFileSync(destFile, rewriteJsImports(min), 'utf8');
    } else if (ext === '.css') {
        const min = minifiedContent.get(srcFile) ?? minifyCss(fs.readFileSync(srcFile, 'utf8'));
        fs.writeFileSync(destFile, min, 'utf8');
    } else if (ext === '.html') {
        const html = fs.readFileSync(srcFile, 'utf8');
        fs.writeFileSync(destFile, minifyHtml(rewriteHtmlAssets(html)), 'utf8');
    } else if (ext === '.json') {
        // Re-emit JSON without indentation.
        try {
            const obj = JSON.parse(fs.readFileSync(srcFile, 'utf8'));
            fs.writeFileSync(destFile, JSON.stringify(obj), 'utf8');
        } catch {
            fs.copyFileSync(srcFile, destFile);
        }
    } else if (basename === 'sitemap.xml') {
        // Stamp <lastmod> with the build date so search engines know
        // the URL was just refreshed. Source XML uses a literal
        // %BUILD_DATE% placeholder which is replaced here.
        const today = new Date().toISOString().slice(0, 10);
        const xml = fs.readFileSync(srcFile, 'utf8').replace(/%BUILD_DATE%/g, today);
        fs.writeFileSync(destFile, xml, 'utf8');
    } else {
        fs.copyFileSync(srcFile, destFile);
    }
}

function copyRecursive(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        ensureDir(dest);
        for (const entry of fs.readdirSync(src)) {
            copyRecursive(path.join(src, entry), path.join(dest, entry));
        }
    } else {
        copyFileWithTransform(src, dest);
    }
}

rmDir(DIST);
ensureDir(DIST);

for (const entry of COPY_ENTRIES) {
    const src = path.join(ROOT, entry);
    const dest = path.join(DIST, entry);
    if (!fs.existsSync(src)) continue;
    copyRecursive(src, dest);
}

console.log(`[build] dist/ ready at ${DIST}`);
