const SW_VERSION = 'jet-ops-gh-v1';
const BASE = '/jet-promobot';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(SW_VERSION).then(c => c.addAll([
    BASE + '/', BASE + '/index.html',
    BASE + '/js/router.js', BASE + '/js/auth.js',
    BASE + '/js/ui.js', BASE + '/js/state.js',
    BASE + '/js/api.js', BASE + '/js/config.js',
    BASE + '/css/main.css', BASE + '/css/components.css'
  ])));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== SW_VERSION).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
