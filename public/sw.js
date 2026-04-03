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

// ── Web Push Notifications ───────────────────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'JET Ops';
  const options = {
    body: data.body || '',
    icon: data.icon || BASE + '/assets/icons/icon-192x192.png',
    badge: BASE + '/assets/icons/icon-96x96.png',
    data: data.data || { url: '/' }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const urlToOpen = new URL(e.notification.data.url, self.location.origin).href;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
