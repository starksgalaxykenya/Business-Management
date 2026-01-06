// sw.js
const CACHE_NAME = 'sbm-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/js/modules/offline.js',
    '/assets/icons/logo.svg'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    // Network-first strategy for API calls
    if (event.request.url.includes('/api/') || 
        event.request.url.includes('firestore.googleapis.com')) {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    // Return cached data if available
                    return caches.match(event.request);
                })
        );
    } else {
        // Cache-first strategy for static assets
        event.respondWith(
            caches.match(event.request)
                .then(response => response || fetch(event.request))
        );
    }
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
