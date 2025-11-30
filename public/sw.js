const CACHE_NAME = 'shopping-list-v3';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// Install Event: Cache core assets
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Force activation
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching all: app shell and content');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing old cache');
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Take control immediately
    );
});

// Fetch Event: Network First for API, Stale While Revalidate for Assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // API Requests: Network Only (or Network First if we wanted to show stale data)
    // For this app, we want real-time data, so we try network.
    // If offline, the fetch will fail, and the app.js logic should handle the error.
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // Static Assets: Stale While Revalidate
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Update cache with new version
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            });

            // Return cached response immediately if available, otherwise wait for network
            return cachedResponse || fetchPromise;
        })
    );
});
