// public/sw.js
const STATIC_CACHE = 'vynx-static-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith('vynx-static-') && key !== STATIC_CACHE)
            .map(key => caches.delete(key))
        )
      ),
    ])
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request));
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:css|js|woff2?|ttf|otf|svg|png|jpe?g|gif|webp|ico)$/.test(url.pathname);

  if (!isStaticAsset) return;

  event.respondWith(
    caches.open(STATIC_CACHE).then(cache =>
      cache.match(event.request).then(response =>
        response || fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
      )
    )
  );
});
