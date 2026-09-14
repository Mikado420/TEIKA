const CACHE_NAME = 'teika-cache-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './src/css/base.css',
  './src/css/editor.css',
  './src/css/preview.css',
  './src/css/statistics.css',
  './src/js/app.js',
  './src/js/state.js',
  './src/js/editor.js',
  './src/js/preview.js',
  './src/js/statistics.js',
  './src/js/tja-parser.js',
  './src/js/utils.js',
  './src/icons/icon-192.png',
  './src/icons/icon-512.png',
  './src/icons/apple-touch-icon.png',
  './src/icons/favicon.png',
  './src/icons/icon.svg',
  './Sounds/dong.wav',
  './Sounds/ka.wav',
  './Sounds/balloon.wav'
];

const CDN_ORIGINS = [
  'https://unpkg.com',
  'https://d3js.org',
  'https://cdnjs.cloudflare.com'
];

// Install Event: Precaches core static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use individual caching so a single missing optional resource doesn't fail installation
      return Promise.allSettled(
        CORE_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn('[ServiceWorker] Failed to cache:', asset, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Cache strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle HTTP/HTTPS GET requests
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http://') && !request.url.startsWith('https://')) return;

  const url = new URL(request.url);

  // Do not cache large user media, audio streams, or blob/data
  if (url.pathname.endsWith('.mp3') || url.pathname.endsWith('.ogg') || url.pathname.endsWith('.m4a')) {
    // Only fetch from network
    return;
  }

  // Handle navigation (HTML) requests: Network-first with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          const fallback = await caches.match('./index.html') || await caches.match('index.html');
          return fallback;
        })
    );
    return;
  }

  // Handle CDN dependencies (Umbrella, D3, JSZip, Encoding): Stale-While-Revalidate
  const isCDN = CDN_ORIGINS.some((origin) => request.url.startsWith(origin));
  if (isCDN) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => null);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Handle local static assets (CSS, JS, images, sound effects): Cache-first with network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || !networkResponse.ok) {
          return networkResponse;
        }
        // Cache same-origin assets
        if (url.origin === self.location.origin) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        }
        return networkResponse;
      }).catch((err) => {
        console.warn('[ServiceWorker] Fetch failed for:', request.url, err);
      });
    })
  );
});
