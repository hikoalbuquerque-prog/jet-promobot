/**
 * sw.js — JET Ops Gestor Service Worker
 * Sessão 4 | Scope: /gestor/
 */

const SW_VERSION = 'jet-gestor-v6';

const PRECACHE = [
  '/gestor',
  '/gestor/',
  '/gestor/index.html',
];

self.addEventListener('install', (e) => {
  console.log('[SW Gestor] Install', SW_VERSION);
  e.waitUntil(
    caches.open(SW_VERSION).then((cache) =>
      Promise.allSettled(PRECACHE.map((url) =>
        cache.add(url).catch((err) => console.warn('[SW Gestor] Não cacheou:', url, err.message))
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  console.log('[SW Gestor] Activate', SW_VERSION);
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SW_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (url.includes('script.google.com') || url.includes('api.telegram.org')) return;
  // Network-first para o gestor (dados sempre frescos)
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const clone = res.clone(); caches.open(SW_VERSION).then((cache) => cache.put(e.request, clone)); }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
