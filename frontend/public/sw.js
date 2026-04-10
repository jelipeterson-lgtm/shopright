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
  // Pass through to network; if it fails, return a basic error response
  // instead of throwing inside respondWith
  event.respondWith(
    fetch(event.request).catch(() => new Response('Network error', { status: 503 }))
  )
})
