/*
  Sales Appointment Capture - Offline Service Worker
  Bump CACHE_VERSION whenever you want to force devices to download a fresh copy.
*/
const CACHE_VERSION = 'v2.7.0-alpha.24';
const CACHE_NAME = `sales-capture-${CACHE_VERSION}`;

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/css/app.css',
  '/js/app.js',
  '/lavida-template-page-1.jpg',
  '/lavida-template-page-2.jpg',
  '/templates/ia-perth-clean.jpg',
  '/templates/ia-brisbane-clean.jpg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/asg_logo.png',
  '/icons/landing.png',
  '/templates/rendered/first-consult-brisbane-page-1.jpg',
  '/templates/rendered/first-consult-brisbane-page-2.jpg',
  '/templates/rendered/first-consult-brisbane-page-3.jpg',
  '/templates/rendered/first-consult-brisbane-page-4.jpg',
  '/templates/rendered/first-consult-brisbane-page-5.jpg',
  '/templates/rendered/first-consult-brisbane-page-6.jpg',
  '/templates/rendered/first-consult-perth-page-1.jpg',
  '/templates/rendered/first-consult-perth-page-2.jpg',
  '/templates/rendered/first-consult-perth-page-3.jpg',
  '/templates/rendered/first-consult-perth-page-4.jpg',
  '/templates/rendered/first-consult-perth-page-5.jpg',
  '/templates/rendered/first-consult-perth-page-6.jpg',
  '/templates/rendered/client-review-page-1.jpg',
  '/templates/rendered/client-review-page-2.jpg',
  '/templates/rendered/client-review-page-3.jpg',
  '/templates/rendered/client-review-page-4.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith('sales-capture-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  // Only handle GET requests.
  if (request.method !== 'GET') return;

  // For page navigations, try network first so updates appear when online.
  // If offline, fall back to the cached app.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For app assets, cache-first with network fallback.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'GET_OFFLINE_READINESS') {
    caches.open(CACHE_NAME).then(cache => {
      return Promise.all(APP_SHELL.map(url => cache.match(url).then(r => ({ url, cached: !!r }))));
    }).then(results => {
      const missing = results.filter(r => !r.cached).map(r => r.url);
      event.ports[0].postMessage({
        type: 'OFFLINE_READINESS',
        cacheVersion: CACHE_VERSION,
        ready: missing.length === 0,
        missingAssets: missing
      });
    }).catch(() => {
      event.ports[0].postMessage({
        type: 'OFFLINE_READINESS',
        cacheVersion: CACHE_VERSION,
        ready: false,
        missingAssets: [],
        error: 'Could not check cache'
      });
    });
  }
});

