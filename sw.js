/* eslint-disable no-restricted-globals */
/**
 * Service worker for Raiden Storm.
 *
 * Strategy:
 *   - /js/* and /css/* URLs already carry a content-hash query string
 *     (e.g. /js/main.js?v=ab12cd34). The hash IS the version - so we can
 *     safely cache them forever using "cache-first".
 *   - index.html, /, manifest.json, favicon.svg use "network-first":
 *     try the network with a tight timeout, fall back to cache if
 *     offline. This is what gives the player instant offline play on
 *     repeat visits while still picking up new builds quickly.
 *   - The Vercel analytics endpoint is bypassed entirely.
 *
 * The cache name is bumped whenever the SW source changes, so an old
 * SW can be evicted by simply re-deploying the file.
 */

const CACHE = 'raiden-v1';
const HASHED_PREFIX = ['/js/', '/css/'];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(caches.open(CACHE));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

function isHashed(url) {
    return HASHED_PREFIX.some((p) => url.pathname.startsWith(p));
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Same origin only - never proxy analytics or third parties.
    if (url.origin !== self.location.origin) return;

    // Bypass Vercel analytics so privacy/diagnostic traffic always
    // reaches the network in real time.
    if (url.pathname.startsWith('/_vercel/')) return;

    if (isHashed(url)) {
        // Cache-first for content-hashed assets.
        event.respondWith(
            caches.open(CACHE).then(async (cache) => {
                const cached = await cache.match(req);
                if (cached) return cached;
                const resp = await fetch(req);
                if (resp.ok) cache.put(req, resp.clone());
                return resp;
            })
        );
        return;
    }

    // Network-first for HTML / manifest / favicon. Time out at 2s and
    // fall back to cache (e.g. on a flaky mobile network).
    event.respondWith(
        caches.open(CACHE).then(async (cache) => {
            try {
                const networkPromise = fetch(req);
                const timed = await Promise.race([
                    networkPromise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
                ]);
                if (timed && timed.ok) cache.put(req, timed.clone());
                return timed;
            } catch {
                const cached = await cache.match(req);
                if (cached) return cached;
                return new Response('offline', { status: 503 });
            }
        })
    );
});
