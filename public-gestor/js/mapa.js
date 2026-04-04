const mapaScreen = (() => {
  let _map = null, _interval = null, _layerSlots = null, _layerPromotores = null, _layerRaios = null, _layerRota = null;
  let _todosSlots = [], _todosPromotores = [], _stats = {}, _dataFiltroAtual = new Date().toLocaleDateString('en-CA');
  const _visible = { promotores: true, slots: true, raios: false };

  function render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <section style="display:flex;flex-direction:column;height:100%;background:#0a0f1e;color:#eaf0fb;font-family:'IBM Plex Sans',sans-serif;overflow:hidden">
        
        <!-- Toolbar Superior -->
        <div style="background:rgba(13,21,38,0.8);backdrop-filter:blur(10px);border-bottom:1px solid rgba(99,179,237,0.15);padding:12px 20px;display:flex;align-items:center;gap:16px;flex-shrink:0;z-index:1000">
          <div style="display:flex;align-items:center;gap:10px;flex:1">
            <div style="width:32px;height:32px;background:rgba(99,179,237,0.1);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#63b3ed;font-size:18px">🗺️</div>
            <div>
              <div style="font-size:11px;font-weight:700;color:#63b3ed;letter-spacing:1px;text-transform:uppercase">Mapa Operacional</div>
              <div id="mapa-ts" style="font-size:10px;color:#718096;font-family:'IBM Plex Mono',monospace">Carregando...</div>
            </div>
          </div>

          <div style="display:flex;gap:8px;align-items:center;background:rgba(0,0,0,0.2);padding:4px 12px;border-radius:20px;border:1px solid rgba(255,255,255,0.05)">
            <input type="date" id="mapa-filtro-data" 
              style="background:transparent;border:none;color:#eaf0fb;font-size:12px;font-family:'IBM Plex Mono',monospace;outline:none;cursor:pointer" 
              onchange="mapaScreen._setDataFiltro(this.value)" />
          </div>

          <div style="display:flex;gap:12px" id="mapa-stats">
            <div style="text-align:right">
              <div style="font-size:10px;color:#718096;text-transform:uppercase;letter-spacing:1px">Ativos</div>
              <div class="stat-ativo" style="font-size:14px;font-weight:700;color:#68d391;font-family:'IBM Plex Mono',monospace">0</div>
            </div>
            <div style="width:1px;height:24px;background:rgba(255,255,255,0.1)"></div>
            <div style="text-align:right">
              <div style="font-size:10px;color:#718096;text-transform:uppercase;letter-spacing:1px">Vagos</div>
              <div class="stat-vago" style="font-size:14px;font-weight:700;color:#f6ad55;font-family:'IBM Plex Mono',monospace">0</div>
            </div>
          </div>
        </div>

        <!-- Filtros e Controles -->
        <div style="background:rgba(13,21,38,0.5);border-bottom:1px solid rgba(255,255,255,0.05);padding:8px 20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;flex-shrink:0;z-index:999">
          <div class="filter-bar">
            <button class="filter-btn active" id="toggle-slots" onclick="mapaScreen._toggleLayer('slots')">📍 Slots</button>
            <button class="filter-btn active" id="toggle-promotores" onclick="mapaScreen._toggleLayer('promotores')">👤 Promotores</button>
            <button class="filter-btn" id="toggle-raios" onclick="mapaScreen._toggleLayer('raios')">⭕ Raios</button>
          </div>
          
          <div style="width:1px;height:20px;background:rgba(255,255,255,0.1)"></div>
          
          <select id="filtro-cidade" onchange="mapaScreen._aplicarFiltros()" 
            style="background:#1a2744;border:1px solid rgba(99,179,237,0.2);color:#eaf0fb;padding:6px 12px;border-radius:8px;font-size:12px;outline:none">
            <option value="">Todas as cidades</option>
          </select>
          
          <select id="filtro-status" onchange="mapaScreen._aplicarFiltros()" 
            style="background:#1a2744;border:1px solid rgba(99,179,237,0.2);color:#eaf0fb;padding:6px 12px;border-radius:8px;font-size:12px;outline:none">
            <option value="">Todos os status</option>
            <option value="DISPONIVEL">Disponível</option>
            <option value="OCUPADO">Aceito</option>
            <option value="ATIVO">Em operação</option>
          </select>

          <button onclick="mapaScreen._limparFiltros()" 
            style="background:rgba(252,129,129,0.1);border:1px solid rgba(252,129,129,0.2);color:#fc8181;padding:6px 14px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;transition:all 0.2s">
            LIMPAR
          </button>
        </div>

        <!-- Área do Mapa e Painel Lateral -->
        <div style="display:flex;flex:1;min-height:0;overflow:hidden;position:relative">
          
          <div id="leaflet-map" style="flex:1;min-width:0;z-index:1;background:#0a0f1e"></div>
          
          <div id="mapa-painel" style="width:320px;flex-shrink:0;background:#0d1526;border-left:1px solid rgba(99,179,237,0.15);overflow-y:auto;display:flex;flex-direction:column;box-shadow:-4px 0 24px rgba(0,0,0,0.3);z-index:10">
            <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.2)">
              <span style="font-size:12px;font-weight:700;color:#63b3ed;letter-spacing:1px">EM CAMPO AGORA</span>
              <span id="lista-count" style="background:#1a2744;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;color:#63b3ed;font-family:'IBM Plex Mono',monospace">0</span>
            </div>
            <div id="lista-promotores" style="flex:1;padding:12px">
              <div style="padding:40px;text-align:center;color:#4a5568;font-size:12px;font-family:'IBM Plex Mono',monospace">Sincronizando...</div>
            </div>
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
    _map = L.map('leaflet-map', { zoomControl: false }).setView([-23.55, -46.63], 13);
    
    // Zoom control customizado no canto inferior direito
    L.control.zoom({ position: 'bottomright' }).addTo(_map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CartoDB'
    }).addTo(_map);

    _layerSlots = L.markerClusterGroup({
      maxClusterRadius: 40,
      showCoverageOnHover: false,
      iconCreateFunction: function(cluster) {
        return L.divIcon({ 
          html: `<div style="background:#63b3ed;color:#0a0f1e;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:800;border:3px solid rgba(255,255,255,0.2);box-shadow:0 4px 12px rgba(99,179,237,0.4);font-size:12px">${cluster.getChildCount()}</div>`, 
          className: '', 
          iconSize: [32, 32] 
        });
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
    const elAtivo = document.querySelector('.stat-ativo');
    const elVago = document.querySelector('.stat-vago');
    if (elAtivo) elAtivo.textContent = _stats.ocupados || 0;
    if (elVago) elVago.textContent = _stats.disponiveis || 0;
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
        html: `<div style="background:${cor};border:2px solid #fff;border-radius:12px;padding:3px 8px;min-width:70px;text-align:center;color:#fff;font-size:10px;font-weight:800;box-shadow:0 4px 12px rgba(0,0,0,0.4);white-space:nowrap;transition:all 0.2s">${s.inicio_slot} · ${label}</div>`,
        className: '', iconSize: [70, 24], iconAnchor: [35, 12]
      });
      
      const marker = L.marker([s.lat, s.lng], { icon }).addTo(_layerSlots);
      
      let pop = `<div style="padding:4px;font-family:'IBM Plex Sans',sans-serif">
        <div style="font-weight:700;font-size:14px;color:#1a1a2e;margin-bottom:2px">📍 ${s.nome}</div>
        <div style="font-size:11px;color:#718096;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">${s.cidade}</div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>⏰ Horário:</span><strong>${s.inicio_slot} – ${s.fim_slot}</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px"><span>📊 Ocupação:</span><strong>${s.vagas_ocupadas} / ${s.max_promotores}</strong></div>`;
      
      if (s.promotores.length > 0) {
        pop += `<div style="border-top:1px solid #eee;padding-top:8px;margin-top:8px">`;
        s.promotores.forEach(p => {
          const sColor = p.status === 'ATIVO' ? '#48bb78' : '#ed8936';
          pop += `<div style="font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="width:8px;height:8px;border-radius:50%;background:${sColor}"></span>
            <span>${p.nome}</span>
          </div>`;
        });
        pop += `</div>`;
      }
      pop += `</div>`;
      marker.bindPopup(pop);

      if (_visible.raios && s.raio_metros) {
        L.circle([s.lat, s.lng], { radius: s.raio_metros, color: cor, fillOpacity: 0.1, weight: 1.5, dashArray: '4, 4' }).addTo(_layerRaios);
      }
    });
    if (_visible.raios) _layerRaios.addTo(_map); else _layerRaios.remove();
  }

  function _renderPromotores(proms) {
    if (!_layerPromotores) return; _layerPromotores.clearLayers();
    proms.forEach(p => {
      const isPausa = p.status_jornada === 'PAUSADO';
      const cor = isPausa ? '#f6ad55' : '#68d391';
      const glow = isPausa ? 'rgba(246,173,85,0.4)' : 'rgba(104,211,145,0.4)';
      
      const icon = L.divIcon({
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 4px 12px ${glow})">
            <div style="background:${cor};border:3px solid #fff;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 4px 12px rgba(0,0,0,0.4);overflow:hidden">
              ${isPausa?'☕':'⚡'}
            </div>
            <div style="background:#1a1a2e;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;margin-top:4px;border:1px solid rgba(255,255,255,0.1);white-space:nowrap">
              ${(p.nome_completo||'').split(' ')[0]}
            </div>
          </div>`,
        className: '', iconSize:[40,50], iconAnchor:[20,50]
      });
      L.marker([p.lat, p.lng], { icon }).addTo(_layerPromotores).on('click', () => _showPromotorPanel(p));
    });
  }

  function _renderListaLateral(proms) {
    const list = document.getElementById('lista-promotores'); if (!list) return;
    document.getElementById('lista-count').textContent = proms.length;
    
    if (proms.length === 0) {
      list.innerHTML = `<div style="padding:40px;text-align:center;color:#4a5568;font-size:12px">Nenhum promotor no filtro selecionado.</div>`;
      return;
    }

    list.innerHTML = proms.map(p => {
      const isPausa = p.status_jornada === 'PAUSADO';
      const statusColor = isPausa ? '#f6ad55' : '#68d391';
      const battery = p.bateria ? `${p.bateria}%` : '--%';
      
      return `
        <div class="promotor-card-mini" onclick="mapaScreen._focarPromotor('${p.user_id}')" 
          style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:12px;margin-bottom:8px;cursor:pointer;transition:all 0.2s">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
            <div style="font-size:13px;font-weight:700;color:#fff">${p.nome_completo}</div>
            <div style="font-size:10px;font-weight:700;color:${statusColor}">${isPausa?'PAUSADO':'OPERANDO'}</div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#718096;font-family:'IBM Plex Mono',monospace">
            <span>${p.slot_nome || 'SEM SLOT'}</span>
            <span style="display:flex;align-items:center;gap:4px">🔋 ${battery}</span>
          </div>
        </div>`;
    }).join('');
  }

  function _showPromotorPanel(p) {
    const painel = document.getElementById('mapa-painel');
    const isPausa = p.status_jornada === 'PAUSADO';
    const statusColor = isPausa ? '#f6ad55' : '#68d391';
    
    painel.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%">
        <div style="padding:20px;background:rgba(0,0,0,0.2);border-bottom:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;align-items:center">
          <b style="color:#63b3ed;font-size:11px;letter-spacing:1px">DETALHES DO PROMOTOR</b>
          <button onclick="mapaScreen._voltarLista()" style="background:none;border:none;color:#718096;cursor:pointer;font-size:18px">✕</button>
        </div>
        
        <div style="padding:24px;display:flex;flex-direction:column;gap:20px;flex:1">
          <div style="text-align:center">
            <div style="width:64px;height:64px;background:rgba(99,179,237,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 12px;border:2px solid rgba(99,179,237,0.3)">
              ${isPausa?'☕':'⚡'}
            </div>
            <div style="font-size:18px;font-weight:700;color:#fff">${p.nome_completo}</div>
            <div style="font-size:12px;color:${statusColor};font-weight:700;margin-top:4px">${p.status_jornada}</div>
          </div>

          <div style="display:flex;flex-direction:column;gap:12px;background:rgba(0,0,0,0.2);padding:16px;border-radius:12px;border:1px solid rgba(255,255,255,0.03)">
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:#718096">Cidade</span>
              <strong style="color:#fff">${p.cidade || '—'}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:#718096">Slot Atual</span>
              <strong style="color:#fff">${p.slot_nome || '—'}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:#718096">Vínculo</span>
              <strong style="color:#fff">${(p.tipo_vinculo||'MEI').toUpperCase()}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:#718096">Último Sinal</span>
              <strong style="color:#fff;font-family:'IBM Plex Mono',monospace">${p.ultima_posicao ? new Date(p.ultima_posicao).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) : '—'}</strong>
            </div>
          </div>

          <button class="panel-btn" onclick="mapaScreen._verRota('${p.user_id}')" style="margin-top:auto">
            📈 VER HISTÓRICO DE ROTA
          </button>
        </div>
      </div>`;
  }

  function _voltarLista() { _load(); }
  function _toggleLayer(l) { 
    _visible[l] = !_visible[l]; 
    const btn = document.getElementById(`toggle-${l}`);
    if (btn) {
      if (_visible[l]) btn.classList.add('active');
      else btn.classList.remove('active');
    }
    _load(); 
  }
  function _focarPromotor(uid) { 
    const p = _todosPromotores.find(x => x.user_id === uid); 
    if (p) {
      _map.setView([p.lat, p.lng], 16);
      _showPromotorPanel(p);
    } 
  }
  function _setDataFiltro(d) { _dataFiltroAtual = d; _load(); }
  function _aplicarFiltros() { _load(); }
  function _limparFiltros() { 
    document.getElementById('filtro-cidade').value = ''; 
    document.getElementById('filtro-status').value = ''; 
    _load(); 
  }
  
  async function _verRota(uid) { 
    _layerRota.clearLayers(); 
    try {
      const res = await api.get('GET_HISTORICO_LOCALIZACAO', { promotor_id: uid, data: _dataFiltroAtual });
      const pts = (res?.data || res?.pontos || []).map(p => [parseFloat(p.lat), parseFloat(p.lng)]);
      if (pts.length) { 
        L.polyline(pts, { color: '#63b3ed', weight: 4, opacity: 0.8, dashArray: '10, 10' }).addTo(_layerRota); 
        _map.fitBounds(L.latLngBounds(pts), { padding: [50, 50] }); 
      } else {
        ui.toast('Nenhuma rota encontrada para este dia', 'info');
      }
    } catch(e) { console.error(e); }
  }

  function destroy() {
    if (_interval) clearInterval(_interval);
    if (_map) { _map.remove(); _map = null; }
  }

  return { _setDataFiltro, _toggleLayer, _aplicarFiltros, _limparFiltros, _focarPromotor, _voltarLista, _verRota, render, destroy };
})();