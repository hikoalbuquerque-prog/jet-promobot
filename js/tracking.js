/**
 * Utilitários Globais de Rastreamento e Tempo
 * Compartilhado entre operacao.js e turnoclt.js
 */

// ── GPS ────────────────────────────────────────────────────────
const gps = (() => {
  let _watchId = null;
  let _cbs = [];

  function iniciar() {
    if (!navigator.geolocation || _watchId !== null) return;
    _watchId = navigator.geolocation.watchPosition(
      pos => {
        const g = { ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, isMock: false };
        state.patch('gps', g);
        _cbs.forEach(fn => fn(g));
      },
      err => {
        const g = { ok: false, erro: err.message };
        state.patch('gps', g);
        _cbs.forEach(fn => fn(g));
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    );
  }

  function parar() {
    if (_watchId !== null) { navigator.geolocation.clearWatch(_watchId); _watchId = null; }
    _cbs = [];
  }

  function onChange(fn) { _cbs.push(fn); return () => { _cbs = _cbs.filter(f => f !== fn); }; }

  function distancia(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const d1 = lat1 * Math.PI / 180, d2 = lat2 * Math.PI / 180;
    const dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(d1)*Math.cos(d2)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function trustScore({ accuracy, isMock }) {
    let s = 100;
    if (isMock) s -= 80;
    if (accuracy > 500) s -= 40; else if (accuracy > 200) s -= 20; else if (accuracy > 100) s -= 10;
    return Math.max(0, Math.min(100, s));
  }

  return { iniciar, parar, onChange, distancia, trustScore };
})();

// ── Timer ──────────────────────────────────────────────────────
const timer = (() => {
  let _acc = 0, _startTs = null, _interval = null, _cbs = [];

  function iniciar()  { if (_interval) return; _startTs = Date.now(); _interval = setInterval(() => _cbs.forEach(fn => fn(segundos())), 1000); }
  function pausar()   { _acc += Math.floor((Date.now() - _startTs) / 1000); _startTs = null; clearInterval(_interval); _interval = null; }
  function retomar()  { _startTs = Date.now(); _interval = setInterval(() => _cbs.forEach(fn => fn(segundos())), 1000); }
  function parar()    { if (_interval) { clearInterval(_interval); _interval = null; } _acc = 0; _startTs = null; }
  function segundos() { return _acc + (_startTs ? Math.floor((Date.now() - _startTs) / 1000) : 0); }
  function onTick(fn) { _cbs.push(fn); return () => { _cbs = _cbs.filter(f => f !== fn); }; }

  function setAcc(v) { _acc = v; }
  return { iniciar, pausar, retomar, parar, segundos, onTick, setAcc };
})();

// ── Heartbeat (Rastreamento Periódico em Background) ───────────
const heartbeat = (() => {
  const INTERVAL_MS = 2 * 60 * 1000;
  const SYNC_TAG    = 'jet-heartbeat';
  let _interval = null, _wakeLock = null, _jornadaId = null;

  function _salvarEstadoSW(jornadaId) {
    const g = state.get('gps') || {};
    const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!sw) return;
    sw.postMessage({ type: 'SALVAR_HEARTBEAT_STATE', payload: {
      token: state.get('token'),
      gasUrl: (window.APP_CONFIG && window.APP_CONFIG.API_URL) + '/app/event',
      jornada_id: jornadaId, lat: g.lat||null, lng: g.lng||null,
      accuracy: g.accuracy||null, is_mock: g.isMock||false,
    }});
  }

  function _limparEstadoSW() {
    const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (sw) sw.postMessage({ type: 'SALVAR_HEARTBEAT_STATE', payload: null });
  }

  async function _ping(jornadaId) {
    let g = state.get('gps') || {};
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 })
      );
      g = { ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, isMock: false };
      state.patch('gps', g);
    } catch(_) {}
    _salvarEstadoSW(jornadaId);
    try {
      await api.post({ evento: 'HEARTBEAT', jornada_id: jornadaId, token: state.get('token'),
        lat: g.lat||null, lng: g.lng||null, accuracy: g.accuracy||null,
        is_mock: g.isMock||false, horario_dispositivo: new Date().toISOString() }, { skipToken: true });
    } catch(_) {}
  }

  async function _adquirirWakeLock() {
    if (!navigator.wakeLock) return;
    try { _wakeLock = await navigator.wakeLock.request('screen');
      _wakeLock.addEventListener('release', () => { _wakeLock = null; }); } catch(_) {}
  }

  function _liberarWakeLock() {
    if (_wakeLock) { _wakeLock.release().catch(()=>{}); _wakeLock = null; }
  }

  async function _registrarBGSync() {
    const reg = window.__swReg;
    if (!reg) return;
    
    // Background Sync (One-shot ao voltar online)
    if ('sync' in reg) { try { await reg.sync.register(SYNC_TAG); } catch(_) {} }
    
    // Periodic Background Sync (Rastreamento periódico em BG)
    if ('periodicSync' in reg) {
      try {
        const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
        if (status.state === 'granted') {
          await reg.periodicSync.register(SYNC_TAG, { minInterval: INTERVAL_MS });
        }
      } catch(_) {}
    }
  }

  function _onVisibility() {
    if (document.hidden) {
      clearInterval(_interval); _interval = null;
      _liberarWakeLock(); _registrarBGSync();
    } else { _iniciarTimer(_jornadaId); _adquirirWakeLock(); }
  }

  function _iniciarTimer(jornadaId) {
    if (_interval) return;
    _ping(jornadaId);
    _interval = setInterval(() => _ping(jornadaId), INTERVAL_MS);
  }

  function iniciar(jornadaId) {
    if (_jornadaId) return;

    const user = state.get('promotor');
    if (!user) return;
    
    // Verificação de LGPD e Preferência
    const isCLT = (user.tipo_vinculo || '').toUpperCase() === 'CLT';
    const aceiteLGPD = user.lgpd_aceite || false;
    const prefContinuo = state.get('pref_rastreio_continuo') !== false; // default true
    
    // Só inicia se aceitou LGPD. 
    // Se for MEI, respeita a checkbox (prefContinuo).
    if (!aceiteLGPD) return;
    if (!isCLT && !prefContinuo) return;

    _jornadaId = jornadaId;
    _salvarEstadoSW(jornadaId);
    _iniciarTimer(jornadaId);
    _adquirirWakeLock();
    document.addEventListener('visibilitychange', _onVisibility);
  }

  function parar() {
    if (_interval) { clearInterval(_interval); _interval = null; }
    _liberarWakeLock(); _limparEstadoSW();
    document.removeEventListener('visibilitychange', _onVisibility);
    _jornadaId = null;
  }

  return { iniciar, parar };
})();
