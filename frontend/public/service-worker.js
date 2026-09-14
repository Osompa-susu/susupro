// Phase 16: this service worker exists ONLY to satisfy PWA
// installability requirements (a registered service worker is part of
// the install criteria on Android/Chrome). It deliberately does NOT
// cache API responses or enable any offline financial transaction
// capability — that is explicitly out of scope until/unless Phase 18
// is approved, per the master prompt's "do not implement offline
// financial transactions casually."
const CACHE_NAME = 'susupro-shell-v1';
const SHELL_ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Never intercept API calls — those must always hit the real
  // network so financial data is never served stale or offline.
  if (event.request.url.includes('/api/')) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
