const CACHE_NAME = 'questionario-bizu-v4.29-otimizado';
const APP_SHELL = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png',
    '/assets/slogan-conhecimento-missao.svg',
    '/app/main.js',
    '/styles/01-foundation.css',
    '/styles/02-base.css',
    '/styles/03-layout.css',
    '/styles/04-components.css',
    '/styles/05-screens.css',
    '/styles/06-responsive.css',
    '/styles/07-pmpa-moderno-minimalista.css',
    '/styles/08-community-compact.css',
    '/styles/09-trial-access.css',
    '/styles/10-pwa-brand.css',
    '/views/auth.html',
    '/views/topbar.html',
    '/views/dashboard.html',
    '/views/quiz.html',
    '/views/result.html',
    '/views/history.html',
    '/views/ranking.html',
    '/views/payment.html',
    '/views/admin.html'
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
                    return response;
                })
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    const networkFirst = ['/app/', '/styles/', '/views/'].some((prefix) => url.pathname.startsWith(prefix));
    if (networkFirst) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => {
            const network = fetch(request).then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                }
                return response;
            });
            return cached || network;
        })
    );
});
