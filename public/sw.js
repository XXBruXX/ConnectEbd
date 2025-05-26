
// Service Worker Básico - Pode ser aprimorado no futuro para caching, etc.
self.addEventListener('install', (event) => {
  console.log('Service Worker: Instalado');
  // event.waitUntil(
  //   caches.open('controle-ebd-cache-v1').then((cache) => {
  //     return cache.addAll([
  //       '/',
  //       // adicione outros assets importantes para cache aqui
  //     ]);
  //   })
  // );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Ativado');
  // event.waitUntil(
  //   caches.keys().then((cacheNames) => {
  //     return Promise.all(
  //       cacheNames.map((cacheName) => {
  //         if (cacheName !== 'controle-ebd-cache-v1') {
  //           return caches.delete(cacheName);
  //         }
  //       })
  //     );
  //   })
  // );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // console.log('Service Worker: Buscando', event.request.url);
  // event.respondWith(
  //   caches.match(event.request).then((response) => {
  //     return response || fetch(event.request);
  //   })
  // );
});
