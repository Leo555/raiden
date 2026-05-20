#!/usr/bin/env node
/**
 * Build script: copy site to dist/ and append content-hash version query parameters
 * to all JS imports and HTML/CSS asset references. Source files are NOT modified.
 *
 * This enables long-term immutable caching while automatically invalidating when
 * content changes:
 * - Hash unchanged → URL unchanged → cache hit (great performance).
 * - Hash changed   → URL changed   → fresh download (instant update).
 *
 * Strategy:
 * 1. Compute SHA256 hash (first 8 chars) of every JS/CSS file (original content).
 * 2. Copy entire site to dist/, transforming JS/CSS/HTML on the fly to add ?v=HASH.
 * 3. Vercel serves dist/ directly with immutable cache headers on /js/* /css/*.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Files / directories to copy from project root → dist/. Add as needed.
const COPY_ENTRIES = [
    'js',
    'css',
    'index.html',
    'favicon.svg',
    'manifest.json',
];

function hashContent(content) {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
}

function rmDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
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

// Pass 1: compute hashes from ORIGINAL source files
const jsFiles = listFiles(path.join(ROOT, 'js'), '.js');
const cssFiles = listFiles(path.join(ROOT, 'css'), '.css');

const hashMap = new Map(); // basename → 8-char hash
for (const file of [...jsFiles, ...cssFiles]) {
    const content = fs.readFileSync(file, 'utf8');
    hashMap.set(path.basename(file), hashContent(content));
}
console.log(`[build] hashed ${hashMap.size} assets`);

// Transform helpers
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
    return html;
}

function copyFileWithTransform(srcFile, destFile) {
    const ext = path.extname(srcFile).toLowerCase();
    if (ext === '.js') {
        const content = fs.readFileSync(srcFile, 'utf8');
        fs.writeFileSync(destFile, rewriteJsImports(content), 'utf8');
    } else if (ext === '.html') {
        const content = fs.readFileSync(srcFile, 'utf8');
        fs.writeFileSync(destFile, rewriteHtmlAssets(content), 'utf8');
    } else {
        // CSS / images / json / etc: byte copy
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

// Pass 2: clean dist/ and copy everything in
rmDir(DIST);
ensureDir(DIST);

for (const entry of COPY_ENTRIES) {
    const src = path.join(ROOT, entry);
    const dest = path.join(DIST, entry);
    if (!fs.existsSync(src)) continue;
    copyRecursive(src, dest);
}

console.log(`[build] dist/ ready at ${DIST}`);
