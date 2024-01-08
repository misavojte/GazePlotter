/*
 Solely for unregistering the old service worker used in the legacy version of the app.
 This is necessary because the user may have the old service worker cached, and if so,
 it would prevent the new service worker from registering.
*/

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
  self.registration.unregister().then(() => {
    console.log('Service Worker unregistered.');
  });
});