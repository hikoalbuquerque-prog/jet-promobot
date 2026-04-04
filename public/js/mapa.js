const mapa = {
  _map: null,
  _markers: {},
  _watchId: null,

  render() {
    document.getElementById('app').innerHTML = `
      <div style="height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;display:flex;flex-direction:column;overflow:hidden">
        <div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;display:flex;align-items:center;gap:12px;flex-shrink:0;z-index:100">
          <button onclick="router.back()" style="background:#1e2a45;border:none;color:#eaf0fb;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer">‹</button>
          <div style="font-size:17px;font-weight:700;flex:1">Mapa Operacional</div>
          <button onclick="mapa._centralizar()" style="background:#1e2a45;border:none;color:#4f8ef7;font-size:13px;font-weight:600;padding:6px 12px;border-radius:8px;cursor:pointer">📍 Centralizar</button>
        </div>

        <div id="mapa-container" style="flex:1;position:relative;background:#1a1a2e;overflow:hidden">
          <div id="leaflet-map" style="width:100%;height:100%;z-index:1"></div>
          <div id="mapa-loading" style="position:absolute;inset:0;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:1000">
            <div style="width:36px;height:36px;border:3px solid #2a3a55;border-top-color:#4f8ef7;border-radius:50%;animation:spin .7s linear infinite"></div>
            <div style="color:#a0aec0;font-size:14px">Carregando mapa...</div>
          </div>
        </div>

        <div style="background:#16213e;border-top:1px solid #2a3a55;padding:10px 16px;display:flex;gap:10px;align-items:center;flex-shrink:0;z-index:100">
          <div id="mapa-gps-status" style="font-size:11px;color:#a0aec0;flex:1">Obtendo GPS...</div>
          <div style="display:flex;gap:8px">
             <span style="font-size:9px;color:#718096;display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;border-radius:50%;background:#68d391"></span>Ativo</span>
             <span style="font-size:9px;color:#718096;display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;border-radius:50%;background:#a0aec0"></span>Pausa</span>
          </div>
        </div>

        <nav style="background:#16213e;border-top:1px solid #2a3a55;display:flex;justify-content:space-around;padding:8px 0 calc(8px + env(safe-area-inset-bottom,0px));flex-shrink:0;z-index:100">
          <button onclick="router.go('home')" style="background:none;border:none;color:#6c7a8d;font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:20px">🏠</span>Home</button>
          <button onclick="router.go('operacao')" style="background:none;border:none;color:#6c7a8d;font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:20px">⚡</span>Jornada</button>
          <button onclick="router.go('slot')" style="background:none;border:none;color:#6c7a8d;font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:20px">📍</span>Slot</button>
          <button onclick="router.go('mapa')" style="background:none;border:none;color:#4f8ef7;font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:20px">🗺️</span>Mapa</button>
        </nav>
      </div>`;

    this._carregarLeaflet();
  },

  _carregarLeaflet() {
    if (window.L) { this._inicializar(); return; }
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => this._inicializar();
    document.head.appendChild(script);
  },

  async _inicializar() {
    const mapEl = document.getElementById('leaflet-map');
    if (!mapEl) return;
    this._map = L.map('leaflet-map', { center: [-23.55, -46.63], zoom: 13, zoomControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(this._map);
    document.getElementById('mapa-loading').style.display = 'none';
    await Promise.all([this._plotarSlot(), this._plotarPromotoresAtivos(), this._iniciarGPS()]);
  },

  async _plotarSlot() {
    try {
      const res = await api.get('GET_SLOT_ATUAL');
      if (res.ok && res.slot?.lat) {
        const slot = res.slot;
        const lat = parseFloat(slot.lat), lng = parseFloat(slot.lng);
        const icon = L.divIcon({ html: `<div style="background:#4f8ef7;border:2px solid #fff;border-radius:50%;width:16px;height:16px;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`, className: '', iconSize: [16, 16], iconAnchor: [8, 8] });
        L.marker([lat, lng], { icon }).addTo(this._map).bindPopup(`<b>📍 ${slot.local_nome || 'Meu Ponto'}</b>`);
        L.circle([lat, lng], { radius: parseFloat(slot.raio_metros || 100), color: '#4f8ef7', fillOpacity: 0.1 }).addTo(this._map);
        this._slotLatLng = [lat, lng];
        this._map.setView([lat, lng], 15);
      }
    } catch(_) {}
  },

  async _plotarPromotoresAtivos() {
    try {
      const res = await api.get('GET_MAPA_PROMOTOR');
      if (!res.ok || !res.pontos?.length) return;
      const meuId = state.get('promotor')?.user_id;
      res.pontos.forEach(p => {
        if (!p.lat || !p.lng || p.user_id === meuId) return;
        
        // Status: ATIVO (Verde), PAUSADO (Cinza/Azul)
        const isPausa = p.status_jornada === 'PAUSADO';
        const cor = isPausa ? '#a0aec0' : '#68d391';
        const label = isPausa ? '⏳' : '⚡';
        const nomeCurto = (p.nome_completo || 'Promotor').split(' ')[0];

        const icon = L.divIcon({
          html: `<div style="display:flex;flex-direction:column;align-items:center"><div style="background:${cor};border:2px solid #fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${label}</div><div style="background:rgba(13,21,38,0.9);color:#fff;font-size:9px;font-weight:700;padding:1px 4px;border-radius:4px;margin-top:2px;white-space:nowrap">${nomeCurto}</div></div>`,
          className: '', iconSize: [40, 42], iconAnchor: [20, 42]
        });

        L.marker([parseFloat(p.lat), parseFloat(p.lng)], { icon }).addTo(this._map).bindPopup(`<b>${p.nome_completo}</b><br>Status: ${p.status_jornada}`);
      });
    } catch(_) {}
  },

  _iniciarGPS() {
    if (!navigator.geolocation) return;
    this._watchId = navigator.geolocation.watchPosition(pos => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude, acc = Math.round(pos.coords.accuracy);
      const statusEl = document.getElementById('mapa-gps-status');
      if (!this._markers.eu) {
        const icon = L.divIcon({ html: `<div style="background:#f1c40f;border:2px solid #fff;border-radius:50%;width:16px;height:16px;box-shadow:0 2px 6px rgba(0,0,0,.5)"></div>`, className: '', iconSize: [16, 16], iconAnchor: [8, 8] });
        this._markers.eu = L.marker([lat, lng], { icon }).addTo(this._map).bindPopup('<b>🟡 Você</b>');
      } else { this._markers.eu.setLatLng([lat, lng]); }
      if (statusEl) statusEl.innerHTML = `GPS Ativo (${acc}m)`;
    }, null, { enableHighAccuracy: true });
  },

  _centralizar() {
    if (this._markers.eu) this._map.setView(this._markers.eu.getLatLng(), 16);
    else if (this._slotLatLng) this._map.setView(this._slotLatLng, 15);
  },

  destroy() {
    if (this._watchId !== null) navigator.geolocation.clearWatch(this._watchId);
    if (this._map) this._map.remove();
    this._map = null; this._markers = {};
  }
};
