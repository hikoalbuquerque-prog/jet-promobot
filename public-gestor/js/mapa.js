const mapaScreen = (() => {
  let _map = null, _interval = null, _layerSlots = null, _layerPromotores = null, _layerRaios = null, _layerRota = null;
  let _todosSlots = [], _todosPromotores = [], _stats = {}, _dataFiltroAtual = new Date().toLocaleDateString('en-CA');
  const _visible = { promotores: true, slots: true, raios: false };

  function render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <section style="display:flex;flex-direction:column;height:100%;background:#0a0f1e;color:#e2e8f0;font-family:'IBM Plex Sans',sans-serif;overflow:hidden">
        <div style="background:#0d1526;border-bottom:1px solid rgba(99,179,237,0.15);padding:10px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:200px">
            <span style="font-size:13px;font-weight:700;color:#63b3ed;letter-spacing:1px">MAPA OPERACIONAL</span>
            <input type="date" id="mapa-filtro-data" style="background:#1a2744;border:1px solid rgba(99,179,237,0.3);color:#e2e8f0;padding:4px 8px;border-radius:6px;font-size:12px;cursor:pointer" onchange="mapaScreen._setDataFiltro(this.value)" />
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap" id="mapa-stats">
            <span class="stat-pill stat-total">— total</span>
            <span class="stat-pill stat-ativo">— ativos</span>
            <span class="stat-pill stat-vago">— vagos</span>
          </div>
          <span id="mapa-ts" style="font-size:10px;color:#4a5568;white-space:nowrap">—</span>
        </div>
        <div style="background:#0d1526;border-bottom:1px solid rgba(99,179,237,0.1);padding:8px 16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex-shrink:0">
          <button class="toggle-btn active" id="toggle-slots" onclick="mapaScreen._toggleLayer('slots')">📍 Slots</button>
          <button class="toggle-btn active" id="toggle-promotores" onclick="mapaScreen._toggleLayer('promotores')">👤 Pessoas</button>
          <button class="toggle-btn" id="toggle-raios" onclick="mapaScreen._toggleLayer('raios')">⭕ Raios</button>
          <div style="width:1px;height:20px;background:rgba(99,179,237,0.2);margin:0 4px"></div>
          <select id="filtro-cidade" onchange="mapaScreen._aplicarFiltros()" style="background:#1a2744;border:1px solid rgba(99,179,237,0.2);color:#e2e8f0;padding:4px 8px;border-radius:6px;font-size:11px">
            <option value="">Todas as cidades</option>
          </select>
          <select id="filtro-status" onchange="mapaScreen._aplicarFiltros()" style="background:#1a2744;border:1px solid rgba(99,179,237,0.2);color:#e2e8f0;padding:4px 8px;border-radius:6px;font-size:11px">
            <option value="">Todos os status</option>
            <option value="DISPONIVEL">Disponível</option>
            <option value="OCUPADO">Aceito</option>
            <option value="ATIVO">Em atividade</option>
          </select>
          <button onclick="mapaScreen._limparFiltros()" style="background:rgba(252,129,129,0.1);border:1px solid rgba(252,129,129,0.3);color:#fc8181;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer">✕ Limpar</button>
        </div>
        <div style="display:flex;flex:1;min-height:0;overflow:hidden">
          <div id="leaflet-map" style="flex:1;min-width:0;z-index:1"></div>
          <div id="mapa-painel" style="width:280px;flex-shrink:0;background:#0d1526;border-left:1px solid rgba(99,179,237,0.15);overflow-y:auto;display:flex;flex-direction:column">
            <div style="padding:12px 14px;border-bottom:1px solid rgba(99,179,237,0.1);display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:12px;font-weight:700;color:#63b3ed">PROMOTORES ATIVOS</span>
              <span id="lista-count" style="font-size:11px;color:#718096">0</span>
            </div>
            <div id="lista-promotores" style="flex:1;padding:8px"></div>
          </div>
        </div>
      </section>`;

    _initMap();
    _load();
    _interval = setInterval(_load, 15000);
    const inp = document.getElementById('mapa-filtro-data');
    if (inp) inp.value = _dataFiltroAtual;
  }

  function _initMap() {
    if (_map) { _map.remove(); _map = null; }
    _map = L.map('leaflet-map', { zoomControl: true }).setView([-23.55, -46.63], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(_map);
    _layerSlots = L.markerClusterGroup({
      maxClusterRadius: 30,
      iconCreateFunction: function(cluster) {
        return L.divIcon({ html: `<div style="background:rgba(99,179,237,0.9);color:#fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid #fff">${cluster.getChildCount()}</div>`, className: '', iconSize: [30, 30] });
      }
    }).addTo(_map);
    _layerPromotores = L.layerGroup().addTo(_map);
    _layerRaios = L.layerGroup();
    _layerRota = L.layerGroup().addTo(_map);
  }

  async function _load() {
    try {
      const [slotsRes, promRes] = await Promise.all([
        api.getSlotsHoje(_dataFiltroAtual),
        api.get('GET_MAPA_PROMOTOR')
      ]);
      _todosSlots = slotsRes?.data || [];
      _todosPromotores = promRes?.pontos || [];
      _stats = slotsRes?.stats || {};
      _atualizarStats();
      _atualizarFiltroCidades();
      _renderSlots(_aplicarFiltrosLocais(_todosSlots));
      _renderPromotores(_aplicarFiltrosPromotores(_todosPromotores));
      _renderListaLateral(_aplicarFiltrosPromotores(_todosPromotores));
      const ts = document.getElementById('mapa-ts');
      if (ts) ts.textContent = 'Atualizado ' + new Date().toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
    } catch(e) {
      console.error('[mapa] Erro ao carregar dados:', e.message);
    }
  }

  function _atualizarStats() {
    const pills = { '.stat-total': `${_stats.total||0} locais`, '.stat-ativo': `${_stats.ocupados||0} ocupados`, '.stat-vago': `${_stats.disponiveis||0} vagos` };
    for (const [sel, txt] of Object.entries(pills)) { const el = document.querySelector(sel); if (el) el.textContent = txt; }
  }

  function _atualizarFiltroCidades() {
    const sel = document.getElementById('filtro-cidade'); if (!sel) return;
    const valAtual = sel.value;
    const cidadesSet = new Set();
    _todosSlots.forEach(s => { if(s.cidade) cidadesSet.add(s.cidade); });
    const cidades = Array.from(cidadesSet).filter(Boolean).sort();
    sel.innerHTML = '<option value="">Todas as cidades</option>' + cidades.map(c => `<option value="${c}">${c}</option>`).join('');
    sel.value = valAtual;
  }

  function _aplicarFiltrosLocais(slots) {
    const cid = document.getElementById('filtro-cidade')?.value, st = document.getElementById('filtro-status')?.value;
    return slots.filter(s => (!cid || s.cidade === cid) && (!st || s.status_geral === st));
  }

  function _aplicarFiltrosPromotores(proms) {
    const cid = document.getElementById('filtro-cidade')?.value;
    return proms.filter(p => !cid || p.cidade === cid);
  }

  function _renderSlots(slots) {
    if (!_layerSlots) return; _layerSlots.clearLayers(); _layerRaios.clearLayers();
    slots.forEach(s => {
      const cor = { DISPONIVEL:'#3182ce', OCUPADO:'#ed8936', ATIVO:'#48bb78' }[s.status_geral] || '#718096';
      const label = s.status_geral === 'DISPONIVEL' ? 'VAGO' : (s.promotores[0]?.nome.split(' ')[0] || 'OK');
      
      const icon = L.divIcon({
        html: `<div style="background:${cor};border:2px solid #fff;border-radius:12px;padding:2px 6px;min-width:60px;text-align:center;color:#fff;font-size:10px;font-weight:800;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap">${s.inicio_slot} · ${label}</div>`,
        className: '', iconSize: [60, 20], iconAnchor: [30, 10]
      });
      
      const marker = L.marker([s.lat, s.lng], { icon }).addTo(_layerSlots);
      
      let pop = `<strong>📍 ${s.nome}</strong><br><small>${s.cidade}</small><br><br>`;
      pop += `⏰ ${s.inicio_slot} – ${s.fim_slot}<br>`;
      pop += `📊 Vagas: ${s.vagas_ocupadas} / ${s.max_promotores}<br>`;
      if (s.promotores.length > 0) {
        pop += `<hr style="margin:8px 0;border:0;border-top:1px solid #eee">`;
        s.promotores.forEach(p => {
          pop += `👤 ${p.nome} (${p.status})<br>`;
        });
      }
      marker.bindPopup(pop);

      if (_visible.raios && s.raio_metros) {
        L.circle([s.lat, s.lng], { radius: s.raio_metros, color: cor, fillOpacity: 0.1, weight: 1 }).addTo(_layerRaios);
      }
    });
    if (_visible.raios) _layerRaios.addTo(_map); else _layerRaios.remove();
  }

  function _renderPromotores(proms) {
    if (!_layerPromotores) return; _layerPromotores.clearLayers();
    proms.forEach(p => {
      const isPausa = p.status_jornada === 'PAUSADO';
      const cor = isPausa ? '#a0aec0' : '#68d391';
      const icon = L.divIcon({
        html: `<div style="display:flex;flex-direction:column;align-items:center"><div style="background:${cor};border:2px solid #fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${isPausa?'⏳':'⚡'}</div><div style="background:rgba(13,21,38,0.9);color:#fff;font-size:9px;font-weight:700;padding:1px 4px;border-radius:4px;margin-top:2px">${(p.nome_completo||'').split(' ')[0]}</div></div>`,
        className: '', iconSize:[40,42], iconAnchor:[20,42]
      });
      L.marker([p.lat, p.lng], { icon }).addTo(_layerPromotores).on('click', () => _showPromotorPanel(p));
    });
  }

  function _renderListaLateral(proms) {
    const list = document.getElementById('lista-promotores'); if (!list) return;
    document.getElementById('lista-count').textContent = proms.length;
    list.innerHTML = proms.map(p => `
      <div onclick="mapaScreen._focarPromotor('${p.user_id}')" style="background:#1a2744;border:1px solid rgba(99,179,237,0.15);border-radius:8px;padding:10px;margin-bottom:6px;cursor:pointer">
        <div style="font-size:12px;font-weight:700">${p.nome_completo}</div>
        <div style="font-size:10px;color:#718096">${p.status_jornada}</div>
      </div>`).join('');
  }

  function _showPromotorPanel(p) {
    const painel = document.getElementById('mapa-painel');
    painel.innerHTML = `
      <div style="padding:14px">
        <div style="display:flex;justify-content:space-between;margin-bottom:12px"><b>PROMOTOR</b><button onclick="mapaScreen._voltarLista()">✕</button></div>
        <div style="font-size:14px;font-weight:700">${p.nome_completo}</div>
        <div style="font-size:12px;color:#718096;margin-bottom:12px">Status: ${p.status_jornada}</div>
        <button onclick="mapaScreen._verRota('${p.user_id}')" style="width:100%;background:#4f8ef7;color:#fff;border:none;padding:8px;border-radius:6px;cursor:pointer">Ver Rota</button>
      </div>`;
  }

  function _voltarLista() { _load(); }
  function _toggleLayer(l) { _visible[l] = !_visible[l]; _load(); }
  function _focarPromotor(uid) { const p = _todosPromotores.find(x => x.user_id === uid); if (p) _map.setView([p.lat, p.lng], 16); }
  function _setDataFiltro(d) { _dataFiltroAtual = d; _load(); }
  function _aplicarFiltros() { _load(); }
  function _limparFiltros() { document.getElementById('filtro-cidade').value = ''; document.getElementById('filtro-status').value = ''; _load(); }
  async function _verRota(uid) { 
    _layerRota.clearLayers(); 
    try {
      const res = await api.get('GET_HISTORICO_LOCALIZACAO', { promotor_id: uid, data: _dataFiltroAtual });
      const pts = (res?.pontos || []).map(p => [parseFloat(p.lat), parseFloat(p.lng)]);
      if (pts.length) { L.polyline(pts, { color: '#4f8ef7', weight: 3 }).addTo(_layerRota); _map.fitBounds(L.latLngBounds(pts)); }
    } catch(e) { console.error(e); }
  }

  function destroy() {
    if (_interval) clearInterval(_interval);
    if (_map) { _map.remove(); _map = null; }
  }

  return { _setDataFiltro, _toggleLayer, _aplicarFiltros, _limparFiltros, _focarPromotor, _voltarLista, _verRota, render, destroy };
})();
