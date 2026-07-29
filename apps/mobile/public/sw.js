// Minimal offline cache for the web build. Poke-lid data is small (a few
// hundred KB for all 481 entries) and rarely changes, so caching it keeps the
// list/map usable out of cell signal range — a common situation for this app
// since poke-lids are often in rural areas.
const CACHE_NAME = 'pokelids-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function putInCache(request, response) {
  if (response.ok) {
    caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
  }
}

function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      putInCache(request, response.clone());
      return response;
    })
    .catch(() => caches.match(request));
}

function cacheFirst(request) {
  return caches.match(request).then(
    (cached) =>
      cached ??
      fetch(request).then((response) => {
        putInCache(request, response.clone());
        return response;
      }),
  );
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Poke-lid data: prefer fresh, fall back to the last cached copy offline.
  if (url.pathname.startsWith('/api/poke-lids')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Hashed JS/asset bundles never change content for a given URL, so serving
  // straight from cache is safe and fast.
  if (url.pathname.startsWith('/_expo/static/')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Everything else (HTML shell, other API calls): always prefer the
  // network so app updates and account-specific data show up immediately;
  // only fall back to the cache when genuinely offline.
  if (!url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request));
  }
});
