/**
 * Phantoms Music — Service Worker
 * Caches static assets for offline support.
 * Simplified to avoid clone() errors during development.
 */

const CACHE_NAME = 'phantom-beats-v2';


// Static assets to pre-cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon.svg',
];

// ─── Install: Pre-cache static assets ────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// ─── Activate: Clean up old caches ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// ─── Fetch: Network-first with cache fallback ───────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Only handle GET requests
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Skip API, stream, and auth endpoints entirely — don't cache these
    if (url.pathname.startsWith('/api/')) return;

    // For navigation and static assets: network-first, cache fallback
    event.respondWith(
        fetch(request)
            .then((response) => {
                // Only cache successful responses for our own origin
                if (response.ok && url.origin === self.location.origin) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Offline: serve from cache
                return caches.match(request).then((cached) => {
                    if (cached) return cached;
                    // For navigation, return cached index.html
                    if (request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});
