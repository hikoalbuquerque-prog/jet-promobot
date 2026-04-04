const mapa = {
  _map: null,
  _markers: {},
  _watchId: null,

  render() {
    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;display:flex;flex-direction:column">
        <div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;display:flex;align-items:center;gap:12px;flex-shrink:0">
          <button onclick="router.back()" style="background:#1e2a45;border:none;color:#eaf0fb;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer">‹</button>
          <div style="font-size:17px;font-weight:700;flex:1">Mapa Operacional</div>
          <button onclick="mapa._centralizar()" style="background:#1e2a45;border:none;color:#4f8ef7;font-size:13px;font-weight:600;padding:6px 12px;border-radius:8px;cursor:pointer">📍 Centralizar</button>
        </div>

        <div id="mapa-container" style="flex:1;position:relative;min-height:calc(100dvh - 130px)">
          <div id="leaflet-map" style="width:100%;height:100%;min-height:calc(100dvh - 130px)"></div>
          <div id="mapa-loading" style="position:absolute;inset:0;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:1000">
            <div style="width:36px;height:36px;border:3px solid #2a3a55;border-top-color:#4f8ef7;border-radius:50%;animation:spin .7s linear infinite"></div>
            <div style="color:#a0aec0;font-size:14px">Carregando mapa...</div>
          </div>
        </div>

        <div id="mapa-info" style="background:#16213e;border-top:1px solid #2a3a55;padding:10px 16px;display:flex;gap:10px;align-items:center;flex-shrink:0;flex-wrap:wrap">
          <div id="mapa-gps-status" style="font-size:12px;color:#a0aec0;flex:1">Obtendo GPS...</div>
          <button id="mapa-gmaps-btn" style="display:none;background:#4f8ef7;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer" onclick="mapa._abrirGoogleMaps()">🗺️ Abrir no Maps</button>
        </div>

        <nav style="background:#16213e;border-top:1px solid #2a3a55;display:flex;justify-content:space-around;padding:10px 0 calc(10px + env(safe-area-inset-bottom,0px));flex-shrink:0">
          <button onclick="router.go('home')" style="background:none;border:none;color:#6c7a8d;font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:22px">🏠</span>Home</button>
          <button onclick="router.go('operacao')" style="background:none;border:none;color:#6c7a8d;font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:22px">⚡</span>Jornada</button>
          <button onclick="router.go('slot')" style="background:none;border:none;color:#6c7a8d;font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:22px">📍</span>Slot</button>
          <button onclick="router.go('mapa')" style="background:none;border:none;color:#4f8ef7;font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:22px">🗺️</span>Mapa</button>
        </nav>
      </div>`;

    this._carregarLeaflet();
  },

  _carregarLeaflet() {
    if (window.L) { this._inicializar(); return; }
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => this._inicializar();
    document.head.appendChild(script);
  },

  async _inicializar() {
    const mapEl = document.getElementById('leaflet-map');
    if (!mapEl) return;
    this._map = L.map('leaflet-map', { center: [-23.5505, -46.6333], zoom: 13, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(this._map);
    document.getElementById('mapa-loading').style.display = 'none';
    await Promise.all([this._plotarSlot(), this._plotarPromotoresAtivos(), this._iniciarGPS()]);
  },

  async _plotarSlot() {
    try {
      const slot = state.get('slot');
      if (!slot?.lat) {
        const res = await api.get('GET_SLOT_ATUAL');
        if (res.ok && res.slot?.lat) { state.set('slot', res.slot); this._adicionarMarcadorSlot(res.slot); }
        return;
      }
      this._adicionarMarcadorSlot(slot);
    } catch(_) {}
  },

  _adicionarMarcadorSlot(slot) {
    if (!this._map || !slot?.lat) return;
    const lat = parseFloat(slot.lat), lng = parseFloat(slot.lng), raio = parseFloat(slot.raio_metros || 100);
    const icon = L.divIcon({ html: `<div style="background:#4f8ef7;border:3px solid #fff;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`, className: '', iconSize: [20, 20], iconAnchor: [10, 10] });
    this._markers.slot = L.marker([lat, lng], { icon }).addTo(this._map).bindPopup(`<b>📍 ${slot.local_nome || 'Slot'}</b><br>${slot.cidade || ''}`);
    L.circle([lat, lng], { radius: raio, color: '#4f8ef7', fillColor: '#4f8ef7', fillOpacity: 0.1, weight: 2 }).addTo(this._map);
    this._slotLatLng = [lat, lng];
    const btn = document.getElementById('mapa-gmaps-btn'); if (btn) btn.style.display = 'block';
    this._map.setView([lat, lng], 15);
  },

  async _plotarPromotoresAtivos() {
    try {
      const res = await api.get('GET_MAPA_PROMOTOR');
      if (!res.ok || !res.pontos?.length) return;
      const meuId = state.get('promotor')?.user_id;
      res.pontos.forEach(p => {
        if (!p.lat || !p.lng || p.user_id === meuId) return;
        const nomeParaExibir = p.nome_completo || p.nome || p.user_id || 'Promotor';
        const primeiroNome = nomeParaExibir.split(' ')[0];
        const icon = L.divIcon({
          html: `<div style="display:flex;flex-direction:column;align-items:center"><div style="background:#2ecc71;border:2px solid #fff;border-radius:50%;width:16px;height:14px;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div><div style="background:rgba(13,21,38,0.8);color:#fff;font-size:9px;font-weight:700;padding:1px 4px;border-radius:4px;margin-top:2px;white-space:nowrap">${primeiroNome}</div></div>`,
          className: '', iconSize: [40, 30], iconAnchor: [20, 7]
        });
        L.marker([parseFloat(p.lat), parseFloat(p.lng)], { icon }).addTo(this._map).bindPopup(`<b>🟢 ${nomeParaExibir}</b><br>Em atividade`);
      });
    } catch(_) {}
  },

  _iniciarGPS() {
    if (!navigator.geolocation) return;
    this._watchId = navigator.geolocation.watchPosition(pos => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude, acc = Math.round(pos.coords.accuracy);
      const statusEl = document.getElementById('mapa-gps-status');
      if (statusEl) statusEl.innerHTML = `<span style="color:#2ecc71">●</span> GPS ativo · precisão ${acc}m`;
      if (!this._markers.eu) {
        const icon = L.divIcon({ html: `<div style="background:#f1c40f;border:3px solid #fff;border-radius:50%;width:18px;height:18px;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>`, className: '', iconSize: [18, 18], iconAnchor: [9, 9] });
        this._markers.eu = L.marker([lat, lng], { icon }).addTo(this._map).bindPopup('<b>🟡 Você</b>');
        if (!this._slotLatLng) this._map.setView([lat, lng], 15);
      } else { this._markers.eu.setLatLng([lat, lng]); }
      if (this._slotLatLng) {
        const dist = this._calcDist(lat, lng, this._slotLatLng[0], this._slotLatLng[1]);
        if (statusEl) statusEl.innerHTML = `<span style="color:#2ecc71">●</span> Você está a <b>${this._formatDist(dist)}</b> do slot · ±${acc}m`;
      }
    }, null, { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 });
  },

  _centralizar() {
    if (!this._map) return;
    if (this._markers.eu) this._map.setView(this._markers.eu.getLatLng(), 16);
    else if (this._slotLatLng) this._map.setView(this._slotLatLng, 15);
  },

  _abrirGoogleMaps() {
    if (!this._slotLatLng) return;
    const [lat, lng] = this._slotLatLng;
    window.open(`https://maps.google.com/?q=${lat},${lng}`, '_blank');
  },

  _calcDist(lat1, lng1, lat2, lng2) {
    const R = 6371000, d1 = lat1 * Math.PI/180, d2 = lat2 * Math.PI/180;
    const dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(d1)*Math.cos(d2)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  },

  _formatDist(m) { return m >= 1000 ? `${(m/1000).toFixed(1)}km` : `${Math.round(m)}m`; },

  destroy() {
    if (this._watchId !== null) navigator.geolocation.clearWatch(this._watchId);
    if (this._map) this._map.remove();
    this._map = null; this._markers = {}; this._slotLatLng = null;
  }
};
