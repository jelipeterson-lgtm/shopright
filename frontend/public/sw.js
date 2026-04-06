// Service worker for ShopRight PWA
// Basic cache-first strategy for static assets

const CACHE_NAME = 'shopright-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener('fetch', (event) => {
  // Let all requests pass through to network
  // This gives us PWA installability without complex caching
  event.respondWith(fetch(event.request))
})
