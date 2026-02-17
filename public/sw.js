// Veritas Service Worker — App Shell Cache
const CACHE_NAME = 'veritas-v1';
const SHELL_ASSETS = [
    '/dashboard',
    '/manifest.json',
    '/veritas-heart.svg',
    '/heart_logo.png',
];

// Install — cache the app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch — network first, fall back to cache for navigation
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    // For navigation requests (HTML pages) — network first
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match('/dashboard'))
        );
        return;
    }

    // For static assets — cache first
    if (
        event.request.url.includes('/icons/') ||
        event.request.url.includes('.svg') ||
        event.request.url.includes('.png')
    ) {
        event.respondWith(
            caches.match(event.request).then((cached) => cached || fetch(event.request))
        );
        return;
    }
});
