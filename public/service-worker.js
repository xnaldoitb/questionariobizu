const CACHE_NAME = 'questionario-bizu-v4.32-seletores-ajustados';
const OPENMOJI_CODES = ['1F600','1F603','1F604','1F601','1F606','1F605','1F602','1F923','1F60A','1F607','1F642','1F643','1F609','1F60D','1F970','1F618','1F60E','1F914','1F62E','1F622','1F62D','1F621','1F44D','1F44E','1F44F','1F64C','1F44B','1F91D','1F64F','1F4AA','1F91E','270C','1F44C','1FAF6','2764','1F49B','1F49A','1F499','1F49C','1F5A4','1F494','1F525','2B50','2728','1F4AF','2705','274C','26A0','1F3AF','1F4DA','1F4D6','1F4DD','270F','1F4A1','1F393','1F3C6','1F947','1F680','1F389','1F38A','1F46E','1F694','1F6A8','1F1E7-1F1F7','2696','1F6A6','26D1','1F4BB','1F6E1','1F3C3','1F9E0','1F50D'];
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
    '/views/admin.html',
    ...OPENMOJI_CODES.map((code) => `/assets/openmoji/${code}.svg`)
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
