const SW_VERSION = 'jet-ops-gh-v1.3.1';
const BASE = ''; // Servido da raiz do public no Cloud Run

const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'css/main.css',
  'css/components.css',
  'js/state.js',
  'js/config.js',
  'js/api.js',
  'js/ui.js',
  'js/auth.js',
  'js/slot.js',
  'js/operacao.js',
  'js/solicitacoes.js',
  'js/vendas.js',
  'js/mapa.js',
  'js/historico.js',
  'js/ranking.js',
  'js/calculadora.js',
  'js/academy.js',
  'js/prejornada.js',
  'js/homeclt.js',
  'js/turnoclt.js',
  'js/push.js',
  'js/router.js',
  'icons/icon-192.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(SW_VERSION).then(c => c.addAll(ASSETS))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== SW_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  
  // Estratégia: Cache First para Assets, Network First para API (futuro)
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).catch(() => {
        // Fallback offline para navegação
        if (e.request.mode === 'navigate') return caches.match('index.html');
      });
    })
  );
});

// ── Web Push Notifications ───────────────────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'JET Ops';
  const options = {
    body: data.body || '',
    icon: data.icon || 'icons/icon-192.png',
    badge: 'icons/icon-96.png',
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
