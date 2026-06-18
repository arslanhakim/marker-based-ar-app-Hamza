// Service worker for the Marker AR Robot PWA.
//
// Strategy (important — see the targets.mind bug this fixes):
//  - /assets/* are content-hashed and immutable -> CACHE-FIRST (fast, safe).
//  - EVERYTHING ELSE (navigations, /targets.mind, the model, icons, manifest)
//    -> NETWORK-FIRST with a cache fallback for offline. These have STABLE URLs
//    but their CONTENTS change between deploys (e.g. recompiling targets.mind),
//    so cache-first would pin the device to a stale file forever. Network-first
//    means an online device always gets the latest, and offline still works.
//
// It only ever touches same-origin GET requests. getUserMedia / the camera is a
// MediaStream (not a network fetch), so the service worker never intercepts it.

const CACHE = 'ar-robot-pwa-v2';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/RobotExpressive.glb',
  '/targets.mind',
  '/marker.png',
  '/trigger.png',
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

function cachePut(request, response) {
  if (response && response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GET; everything else passes straight through.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Immutable, content-hashed build assets -> cache-first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((r) => cachePut(request, r))),
    );
    return;
  }

  // Everything else -> network-first, cache fallback (ignoreSearch so a
  // versioned URL like /targets.mind?v=2 still falls back to the precached file).
  event.respondWith(
    fetch(request)
      .then((r) => cachePut(request, r))
      .catch(() =>
        caches.match(request, { ignoreSearch: true }).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') return caches.match('/index.html');
          return Response.error();
        }),
      ),
  );
});
