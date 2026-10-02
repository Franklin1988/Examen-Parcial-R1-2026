// Service Worker de Cierre - Limpia toda caché y se desactiva
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Siempre responde con la red para forzar la pantalla de cierre
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
