// Caches the app shell so the UI loads instantly and works offline.
// Data itself comes live from Firestore (which has its own offline queueing
// enabled via enablePersistence() in index.html) — this worker doesn't touch that.

const CACHE_NAME = 'ftr-manager-shell-v1';
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  // Never intercept Firestore / Firebase / Google font network calls — let those
  // go straight to the network so live sync and auth behave normally.
  if (url.includes('firestore.googleapis.com') || url.includes('firebaseio.com') ||
      url.includes('googleapis.com') || url.includes('gstatic.com') || url.includes('fonts.googleapis.com')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response && response.status === 200 && event.request.method === 'GET') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
