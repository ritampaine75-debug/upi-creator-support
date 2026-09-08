const CACHE_NAME = 'supportly-static-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './components/shell.html',
  './js/bootstrap.js',
  './js/app.js',
  './js/config.js',
  './js/firebase.js',
  './js/auth.js',
  './js/database.js',
  './js/router.js',
  './js/security.js',
  './js/utils.js',
  './js/analytics.js',
  './js/notifications.js',
  './js/qr.js',
  './manifest.webmanifest',
  './icon-192.svg',
  './icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => {
    if (cached) return cached;
    return fetch(event.request).then((response) => {
      if (response.ok && requestUrl.pathname.startsWith(new URL('./', self.registration.scope).pathname)) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    });
  }));
});
