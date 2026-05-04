const CACHE_NAME = 'vokabeltrainer-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
