const SW_VERSION = 'jet-ops-v10';
const HEARTBEAT_SYNC_TAG = 'jet-heartbeat';

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/main.css',
  '/css/components.css',
  '/js/state.js',
  '/js/config.js',
  '/js/api.js',
  '/js/ui.js',
  '/js/auth.js',
  '/js/slot.js',
  '/js/operacao.js',
  '/js/solicitacoes.js',
  '/js/vendas.js',
  '/js/mapa.js',
  '/js/historico.js',
  '/js/prejornada.js',
  '/js/homeclt.js',
  '/js/turnoclt.js',
  '/js/router.js',
  '/assets/logo-jet.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  console.log('[SW] Install', SW_VERSION);
  e.waitUntil(
    caches.open(SW_VERSION).then((cache) =>
      Promise.allSettled(
        PRECACHE.map((url) =>
          cache.add(url).catch((err) =>
            console.warn('[SW] Não cacheou:', url, err.message)
          )
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  console.log('[SW] Activate', SW_VERSION);
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SW_VERSION && k !== 'jet-heartbeat-state')
            .map((k) => { console.log('[SW] Deletando cache antigo:', k); return caches.delete(k); })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;
  if (
    url.includes('script.google.com') ||
    url.includes('run.app/api') ||
    url.includes('api.telegram.org')
  ) return;
  const path = new URL(url).pathname;
  if (path.match(/\.(js|css|png|jpg|svg|woff2|ico|webp)$/) ||
      path === '/' || path === '/index.html') {
    e.respondWith(cacheFirst(req));
    return;
  }
  e.respondWith(networkFirst(req));
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) { const clone = res.clone(); caches.open(SW_VERSION).then(cache => cache.put(req, clone)); }
    return res;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) { const clone = res.clone(); caches.open(SW_VERSION).then(cache => cache.put(req, clone)); }
    return res;
  } catch {
    return (await caches.match(req)) || new Response('Offline', { status: 503 });
  }
}

self.addEventListener('sync', (e) => {
  if (e.tag === HEARTBEAT_SYNC_TAG) {
    console.log('[SW] Background Sync: heartbeat');
    e.waitUntil(swHeartbeat());
  }
});

self.addEventListener('periodicsync', (e) => {
  if (e.tag === HEARTBEAT_SYNC_TAG) e.waitUntil(swHeartbeat());
});

async function swHeartbeat() {
  let payload = null;
  try {
    const cache = await caches.open('jet-heartbeat-state');
    const resp = await cache.match('/heartbeat-state');
    if (resp) payload = await resp.json();
  } catch (err) {
    console.warn('[SW] Sem estado de heartbeat:', err.message);
  }
  if (!payload?.token || !payload?.gasUrl) {
    console.warn('[SW] Heartbeat abortado — sem token/gasUrl');
    return;
  }
  try {
    await fetch(payload.gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evento:     'HEARTBEAT',
        token:      payload.token,
        jornada_id: payload.jornada_id,
        lat:        payload.lat,
        lng:        payload.lng,
        accuracy:   payload.accuracy,
        is_mock:    payload.is_mock || false,
        horario_dispositivo: new Date().toISOString(),
      }),
    });
    console.log('[SW] Heartbeat background enviado');
  } catch (err) {
    console.error('[SW] Heartbeat background falhou:', err.message);
  }
}

self.addEventListener('message', (e) => {
  const { type, payload } = e.data || {};
  if (type === 'SALVAR_HEARTBEAT_STATE') salvarEstadoHeartbeat(payload);
  if (type === 'SKIP_WAITING') self.skipWaiting();
});

async function salvarEstadoHeartbeat(payload) {
  try {
    const cache = await caches.open('jet-heartbeat-state');
    if (!payload) { await cache.delete('/heartbeat-state'); return; }
    await cache.put(
      '/heartbeat-state',
      new Response(JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
  } catch (err) {
    console.error('[SW] Erro ao salvar estado heartbeat:', err.message);
  }
}
