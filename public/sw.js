const CACHE_NAME = 'Strings-cache-v1';

// Install event
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Fetch event (Network first strategy for media playback & real-time DB queries)
self.addEventListener('fetch', (event) => {
  // Let the browser handle standard requests directly
});
