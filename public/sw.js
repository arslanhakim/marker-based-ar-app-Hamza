// Simple, robust service worker for the Marker AR Robot PWA.
//
// Strategy:
//  - Precache the stable app shell + large same-origin assets (model, target,
//    manifest, icons) so the app works offline after the first load.
//  - Vite emits hashed JS/CSS under /assets/ whose names aren't known here, so
//    those are cached at runtime on first fetch (cache-first).
//  - Navigations are network-first with an offline fallback to the cached shell.
//
// It only ever touches same-origin GET requests. getUserMedia / the camera is a
// MediaStream (not a network fetch), so the service worker never intercepts it.

const CACHE = 'ar-robot-pwa-v1';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/RobotExpressive.glb',
  '/targets.mind',
  '/marker.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-maskable.png',
  '/icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Tolerate any single missing asset so install never fails outright.
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((u) => cache.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GET; everything else passes straight through.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to the cached app shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    );
    return;
  }

  // Static assets: cache-first, populate the cache on first fetch.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Only cache valid, basic (same-origin) responses.
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
