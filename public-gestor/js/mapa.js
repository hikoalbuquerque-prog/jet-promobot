// ─── mapa.js ──────────────────────────────────────────────────────────────────
// Mapa operacional — layout revisado com capacidade, filtros e lista lateral
const mapaScreen = (() => {
  let _map        = null;
  let _interval   = null;
  let _layerSlots      = null;
  let _layerPromotores = null;
  let _layerRaios      = null;
  let _layerRota       = null;

  let _todosSlots      = [];
  let _todosPromotores = [];
  let _stats           = {};
  let _dataFiltroAtual = new Date().toISOString().split('T')[0];

  const _visible = { promotores: true, slots: true, raios: false };
  const _filtros = { cidade: '', vinculo: '', cargo: '', operacao: '', status: '' };

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
            <span class="stat-pill stat-enc">— encerrados</span>
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
            <option value="ENCERRADO">Encerrado</option>
          </select>
          <select id="filtro-horario" onchange="mapaScreen._aplicarFiltros()" style="background:#1a2744;border:1px solid rgba(99,179,237,0.2);color:#e2e8f0;padding:4px 8px;border-radius:6px;font-size:11px">
            <option value="">Todos os horários</option>
            <option value="manha">Manhã (até 12h)</option>
            <option value="tarde">Tarde (12h–18h)</option>
            <option value="noite">Noite (18h+)</option>
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
            <div id="lista-promotores" style="flex:1;padding:8px">
              <div style="text-align:center;padding:20px;color:#4a5568;font-size:12px">Carregando...</div>
            </div>
          </div>
        </div>
        <div style="background:#0d1526;border-top:1px solid rgba(99,179,237,0.1);padding:6px 16px;display:flex;gap:16px;flex-wrap:wrap;flex-shrink:0">
          <span style="font-size:10px;color:#718096;display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:50%;background:#4299e1;display:inline-block"></span>Disponível</span>
          <span style="font-size:10px;color:#718096;display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:50%;background:#f6ad55;display:inline-block"></span>Aceito</span>
          <span style="font-size:10px;color:#718096;display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:50%;background:#68d391;display:inline-block"></span>Em atividade</span>
          <span style="font-size:10px;color:#718096;display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:50%;background:#718096;display:inline-block"></span>Encerrado</span>
          <span style="font-size:10px;color:#718096;display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:50%;background:#63b3ed;display:inline-block"></span>Promotor</span>
        </div>
      </section>`;

    _initMap();
    _load();
    _interval = setInterval(_load, 15000);
    const hoje = new Date().toISOString().split('T')[0];
    _dataFiltroAtual = hoje;
    mapaScreen._dataFiltro = hoje;
    setTimeout(() => { const inp = document.getElementById('mapa-filtro-data'); if (inp) inp.value = hoje; }, 50);
  }

  function _initMap() {
    if (_map) { _map.remove(); _map = null; }
    _map = L.map('leaflet-map', { zoomControl: true }).setView([-23.55052, -46.63331], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19
    }).addTo(_map);
    _layerSlots = L.markerClusterGroup({
      maxClusterRadius: 40, showCoverageOnHover: false, disableClusteringAtZoom: 16,
      iconCreateFunction(cluster) {
        const count = cluster.getChildCount();
        return L.divIcon({ html: `<div style="background:#1a56db;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:2px solid #63b3ed">${count}</div>`, className: '', iconSize: [32,32] });
      }
    }).addTo(_map);
    _layerPromotores = L.layerGroup().addTo(_map);
    _layerRaios      = L.layerGroup();
    _layerRota       = L.layerGroup().addTo(_map);
  }

  async function _load() {
    try {
      const [slotsRes, promRes] = await Promise.all([
        api.getSlotsHoje(_dataFiltroAtual || ''),
        api.getPromotoresAtivos(_dataFiltroAtual || '')
      ]);
      _todosSlots      = slotsRes?.data  || [];
      _todosPromotores = promRes?.data   || [];
      _stats           = slotsRes?.stats || {};
      _atualizarStats();
      _atualizarFiltroCidades();
      _renderSlots(_aplicarFiltrosLocais(_todosSlots));
      _renderPromotores(_aplicarFiltrosPromotores(_todosPromotores));
      _renderListaLateral(_aplicarFiltrosPromotores(_todosPromotores));
      const ts = document.getElementById('mapa-ts');
      if (ts) ts.textContent = 'Atualizado ' + new Date().toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    } catch(e) { console.error('[mapa]', e.message); }
  }

  function _atualizarFiltroCidades() {
    const sel = document.getElementById('filtro-cidade');
    if (!sel) return;
    const valAtual = sel.value;
    
    // Pega cidades únicas de slots e promotores
    const cidadesSet = new Set();
    _todosSlots.forEach(s => { if(s.cidade) cidadesSet.add(s.cidade); });
    _todosPromotores.forEach(p => { if(p.cidade) cidadesSet.add(p.cidade); });
    
    const cidades = Array.from(cidadesSet).filter(Boolean).sort();
    
    sel.innerHTML = '<option value="">Todas as cidades</option>' + 
      cidades.map(c => `<option value="${c}">${c}</option>`).join('');
    
    sel.value = valAtual;
  }

  function _atualizarStats() {
    const pills = { '.stat-total': `${_stats.total||0} slots`, '.stat-ativo': `${_stats.ocupados||0} ativos`, '.stat-vago': `${_stats.disponiveis||0} vagos`, '.stat-enc': `${_stats.encerrados||0} enc.` };
    for (const [sel, txt] of Object.entries(pills)) { const el = document.querySelector(sel); if (el) el.textContent = txt; }
  }

  function _aplicarFiltrosLocais(slots) {
    const cidade  = (document.getElementById('filtro-cidade')?.value  || '').trim();
    const status  = (document.getElementById('filtro-status')?.value  || '').trim();
    const horario = (document.getElementById('filtro-horario')?.value || '').trim();
    return slots.filter(s => {
      if (cidade && s.cidade !== cidade) return false;
      if (status && s.status_geral !== status) return false;
      if (horario) {
        const h = parseInt((s.inicio_slot||'00').split(':')[0]);
        if (horario === 'manha' && h >= 12) return false;
        if (horario === 'tarde' && (h < 12 || h >= 18)) return false;
        if (horario === 'noite' && h < 18) return false;
      }
      return true;
    });
  }

  function _aplicarFiltrosPromotores(promotores) {
    const cidade = (document.getElementById('filtro-cidade')?.value || '').trim();
    return promotores.filter(p => {
      if (cidade && p.cidade !== cidade) return false;
      return true;
    });
  }

  function _corSlot(status) {
    return { DISPONIVEL:'#2b6cb0', OCUPADO:'#c05621', ATIVO:'#276749', PAUSADO:'#7b341e', ENCERRADO:'#2d3748', CANCELADO:'#2d3748' }[status] || '#2d3748';
  }
  function _corBorda(status) {
    return { DISPONIVEL:'#63b3ed', OCUPADO:'#f6ad55', ATIVO:'#68d391', PAUSADO:'#fc8181', ENCERRADO:'#4a5568', CANCELADO:'#4a5568' }[status] || '#4a5568';
  }

  function _renderSlots(slots) {
    if (!_layerSlots) return;
    _layerSlots.clearLayers();
    _layerRaios.clearLayers();

    // Agrupa por posição para calcular offset
    const posMap = {};
    slots.forEach(s => {
      if (!s.lat || !s.lng) return;
      const key = s.lat + '_' + s.lng;
      if (!posMap[key]) posMap[key] = [];
      posMap[key].push(s);
    });

    // Offsets em espiral para slots no mesmo local
    const offsets = [
      [0, 0], [0, 0.0003], [0, -0.0003],
      [0.0003, 0], [-0.0003, 0],
      [0.0002, 0.0002], [-0.0002, 0.0002],
      [0.0002, -0.0002], [-0.0002, -0.0002]
    ];

    slots.forEach(s => {
      if (!s.lat || !s.lng) return;
      const key = s.lat + '_' + s.lng;
      const grupo = posMap[key];
      const idx   = grupo.indexOf(s);
      const off   = offsets[idx] || [idx * 0.0003, 0];
      const lat   = parseFloat(s.lat) + off[0];
      const lng   = parseFloat(s.lng) + off[1];
      s._lat = lat; s._lng = lng;
      const vagas = s.max_promotores || 1;
      const ocup  = s.vagas_ocupadas || 0;
      const cor   = _corSlot(s.status_geral);
      const borda = _corBorda(s.status_geral);
      const nome  = (s.nome||'').split(' ').slice(0,3).join(' ');
      const icon  = L.divIcon({
        html: `<div style="display:flex;flex-direction:column;align-items:center"><div style="background:${cor};border:2px solid ${borda};border-radius:8px;padding:4px 7px;min-width:52px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.4)"><div style="font-size:9px;color:rgba(255,255,255,0.8);white-space:nowrap;max-width:80px;overflow:hidden;text-overflow:ellipsis">${nome}</div><div style="font-size:10px;font-weight:800;color:#fff;margin-top:1px">${s.inicio_slot||'—'}–${s.fim_slot||'—'}</div><div style="font-size:11px;font-weight:900;color:#fff;margin-top:2px">${ocup}/${vagas} <span style="font-size:9px;opacity:.8">vagas</span></div></div><div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${cor}"></div></div>`,
        className: '', iconSize: [70,60], iconAnchor: [35,60]
      });
      L.marker([s._lat || s.lat, s._lng || s.lng], { icon })
        .bindTooltip(`<b>${s.nome}</b><br>${s.inicio_slot} – ${s.fim_slot}<br>${ocup}/${vagas} vagas`, { permanent:false, direction:'top', className:'jet-tooltip' })
        .on('click', () => _showSlotPanel(s))
        .addTo(_layerSlots);
      if (s.raio_metros) {
        L.circle([parseFloat(s.lat), parseFloat(s.lng)], { radius:s.raio_metros, color:cor, fillColor:cor, fillOpacity:0.06, weight:1, dashArray:'4,4' }).addTo(_layerRaios);
      }
    });
  }

  function _renderPromotores(promotores) {
    if (!_layerPromotores) return;
    _layerPromotores.clearLayers();
    promotores.forEach(p => {
      if (!p.lat || !p.lng) return;
      const isFiscal = p.tipo_vinculo === 'FISCAL' || p.cargo_principal === 'FISCAL';
      const cor   = isFiscal ? '#9f7aea' : (p.status_jornada === 'EM_ATIVIDADE' ? '#68d391' : '#63b3ed');
      const label = isFiscal ? '⭐' : (p.confirmacao_presenca === 'A_CAMINHO' ? '🚀' : (p.status_jornada === 'EM_ATIVIDADE' ? '⚡' : '⏳'));
      const icon  = L.divIcon({
        html: `<div style="display:flex;flex-direction:column;align-items:center"><div style="background:${cor};border:2px solid #fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${label}</div><div style="background:rgba(13,21,38,0.9);color:#e2e8f0;font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;margin-top:2px;white-space:nowrap;max-width:70px;overflow:hidden;text-overflow:ellipsis">${(p.nome||'').split(' ')[0]}</div></div>`,
        className: '', iconSize:[36,52], iconAnchor:[18,52]
      });
      L.marker([p.lat, p.lng], { icon })
        .bindTooltip(`<b>${isFiscal ? '[FISCAL] ' : ''}${p.nome}</b><br>${p.slot_nome||'—'}<br>${(p.status_jornada||'').replace('_',' ')}`, { permanent:false, direction:'top', className:'jet-tooltip' })
        .on('click', () => _showPromotorPanel(p))
        .addTo(_layerPromotores);
    });
  }

  function _renderListaLateral(promotores) {
    const lista = document.getElementById('lista-promotores');
    const count = document.getElementById('lista-count');
    if (!lista) return;
    if (count) count.textContent = promotores.length;
    if (!promotores.length) { lista.innerHTML = '<div style="text-align:center;padding:20px;color:#4a5568;font-size:12px">Nenhum promotor ativo</div>'; return; }
    lista.innerHTML = promotores.map(p => {
      const isFiscal = p.tipo_vinculo === 'FISCAL' || p.cargo_principal === 'FISCAL';
      const cor    = isFiscal ? '#9f7aea' : (p.status_jornada === 'EM_ATIVIDADE' ? '#68d391' : '#63b3ed');
      const status = isFiscal ? 'Supervisão' : (p.status_jornada === 'EM_ATIVIDADE' ? 'Em atividade' : (p.confirmacao_presenca === 'A_CAMINHO' ? 'A caminho' : 'Aceito'));
      return `<div onclick="mapaScreen._focarPromotor('${p.user_id}')" style="background:#1a2744;border:1px solid ${isFiscal ? '#9f7aea44' : 'rgba(99,179,237,0.15)'};border-radius:8px;padding:10px 12px;margin-bottom:6px;cursor:pointer" onmouseover="this.style.borderColor='${isFiscal ? '#9f7aea88' : 'rgba(99,179,237,0.4)'}'" onmouseout="this.style.borderColor='${isFiscal ? '#9f7aea44' : 'rgba(99,179,237,0.15)'}'"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div style="font-size:12px;font-weight:700;color:#e2e8f0">${isFiscal ? '⭐ ' : ''}${p.nome||'—'}</div><span style="font-size:10px;font-weight:700;color:${cor};background:${cor}20;padding:2px 6px;border-radius:10px;flex-shrink:0">${status}</span></div><div style="font-size:11px;color:#718096;margin-top:3px">${p.slot_nome||'—'}</div><div style="font-size:10px;color:#4a5568;margin-top:2px">${p.cargo_principal||''} · ${p.tipo_vinculo||''}</div></div>`;
    }).join('');
  }

  function _showSlotPanel(s) {
    const painel = document.getElementById('mapa-painel');
    if (!painel) return;
    const proms = (s.promotores||[]).map(p =>
      `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(99,179,237,0.1)"><span style="font-size:12px;color:#e2e8f0">${p.nome}</span><span style="font-size:10px;color:${_corBorda(p.status)}">${p.status}</span></div>`
    ).join('') || '<div style="font-size:12px;color:#4a5568;padding:8px 0">Nenhum promotor alocado</div>';
    painel.innerHTML = `<div style="padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span style="font-size:12px;font-weight:700;color:#63b3ed">SLOT</span><button onclick="mapaScreen._voltarLista()" style="background:none;border:none;color:#718096;cursor:pointer;font-size:12px">← Lista</button></div><div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-bottom:4px">${s.nome||'—'}</div><div style="font-size:12px;color:#718096;margin-bottom:12px">${s.inicio_slot} – ${s.fim_slot}</div><div style="display:flex;gap:8px;margin-bottom:12px"><div style="flex:1;background:#1a2744;border-radius:6px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:#e2e8f0">${s.vagas_ocupadas||0}</div><div style="font-size:10px;color:#718096">ocupadas</div></div><div style="flex:1;background:#1a2744;border-radius:6px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:#63b3ed">${(s.max_promotores||1)-(s.vagas_ocupadas||0)}</div><div style="font-size:10px;color:#718096">disponíveis</div></div><div style="flex:1;background:#1a2744;border-radius:6px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:#f6ad55">${s.max_promotores||1}</div><div style="font-size:10px;color:#718096">capacidade</div></div></div><div style="font-size:11px;font-weight:700;color:#718096;margin-bottom:6px">PROMOTORES</div>${proms}</div>`;
  }

  function _showPromotorPanel(p) {
    const painel = document.getElementById('mapa-painel');
    if (!painel) return;
    const isFiscal = p.tipo_vinculo === 'FISCAL' || p.cargo_principal === 'FISCAL';
    
    painel.innerHTML = `
      <div style="padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span style="font-size:12px;font-weight:700;color:#63b3ed">${isFiscal ? 'FISCAL' : 'PROMOTOR'}</span>
          <button onclick="mapaScreen._voltarLista()" style="background:none;border:none;color:#718096;cursor:pointer;font-size:12px">← Lista</button>
        </div>
        <div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-bottom:2px">${isFiscal ? '⭐ ' : ''}${p.nome||'—'}</div>
        <div style="font-size:12px;color:#718096;margin-bottom:12px">${p.cargo_principal||''} · ${p.tipo_vinculo||''}</div>
        <div style="background:#1a2744;border-radius:8px;padding:10px">
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(99,179,237,0.1)">
            <span style="font-size:11px;color:#718096">Local Atual</span>
            <span style="font-size:11px;color:#e2e8f0">${p.slot_nome||'—'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(99,179,237,0.1)">
            <span style="font-size:11px;color:#718096">Status</span>
            <span style="font-size:11px;color:#68d391">${(p.status_jornada||'').replace('_',' ')}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(99,179,237,0.1)">
            <span style="font-size:11px;color:#718096">Cidade</span>
            <span style="font-size:11px;color:#e2e8f0">${p.cidade||'—'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:5px 0">
            <span style="font-size:11px;color:#718096">Última pos.</span>
            <span style="font-size:11px;color:#e2e8f0">${p.ultima_posicao?new Date(p.ultima_posicao).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'—'}</span>
          </div>
        </div>
        
        <button onclick="mapaScreen._verRota('${p.user_id}')" style="width:100%;margin-top:12px;background:rgba(99,179,237,0.1);border:1px solid rgba(99,179,237,0.3);color:#63b3ed;padding:8px;border-radius:6px;font-size:12px;cursor:pointer">🗺️ Ver trajeto hoje</button>
        
        ${isFiscal ? `
          <button onclick="mapaScreen._verRelatorioFiscal('${p.user_id}', '${p.nome}')" style="width:100%;margin-top:8px;background:rgba(159,122,234,0.1);border:1px solid rgba(159,122,234,0.3);color:#9f7aea;padding:8px;border-radius:6px;font-size:12px;cursor:pointer">📊 Relatório de Supervisão</button>
        ` : ''}
      </div>`;
  }

  function _voltarLista() {
    const painel = document.getElementById('mapa-painel');
    if (!painel) return;
    painel.innerHTML = `<div style="padding:12px 14px;border-bottom:1px solid rgba(99,179,237,0.1);display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;font-weight:700;color:#63b3ed">PROMOTORES ATIVOS</span><span id="lista-count" style="font-size:11px;color:#718096">${_todosPromotores.length}</span></div><div id="lista-promotores" style="flex:1;padding:8px"></div>`;
    _renderListaLateral(_todosPromotores);
  }

  function _toggleLayer(layer) {
    _visible[layer] = !_visible[layer];
    const btn = document.getElementById('toggle-' + layer);
    if (btn) btn.classList.toggle('active', _visible[layer]);
    const lg = { slots:_layerSlots, promotores:_layerPromotores, raios:_layerRaios }[layer];
    if (!lg || !_map) return;
    if (_visible[layer]) { if (!_map.hasLayer(lg)) _map.addLayer(lg); }
    else { if (_map.hasLayer(lg)) _map.removeLayer(lg); }
  }

  function _aplicarFiltros() { 
    _renderSlots(_aplicarFiltrosLocais(_todosSlots)); 
    _renderPromotores(_aplicarFiltrosPromotores(_todosPromotores));
    _renderListaLateral(_aplicarFiltrosPromotores(_todosPromotores));
  }

  function _limparFiltros() {
    ['filtro-cidade', 'filtro-status', 'filtro-horario'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    _aplicarFiltros();
  }
  function _setDataFiltro(data) {
    _dataFiltroAtual = data;
    mapaScreen._dataFiltro = data;
    // Remove e recria layers (clearLayers não funciona com MarkerClusterGroup)
    if (_layerSlots && _map)      { _map.removeLayer(_layerSlots); }
    if (_layerPromotores && _map) { _map.removeLayer(_layerPromotores); }
    if (_layerRaios && _map)      { _map.removeLayer(_layerRaios); }
    _layerSlots = L.markerClusterGroup({
      maxClusterRadius: 40, showCoverageOnHover: false, disableClusteringAtZoom: 16,
      iconCreateFunction(cluster) {
        const n = cluster.getChildCount();
        return L.divIcon({ html: '<div style="background:#1a56db;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:2px solid #63b3ed">' + n + '</div>', className: '', iconSize: [32,32] });
      }
    });
    _layerPromotores = L.layerGroup();
    _layerRaios      = L.layerGroup();
    if (_map) {
      _map.addLayer(_layerSlots);
      _map.addLayer(_layerPromotores);
      if (_visible.raios) _map.addLayer(_layerRaios);
    }
    _load();
  }
  function _focarPromotor(userId) {
    const p = _todosPromotores.find(x => x.user_id === userId);
    if (p && p.lat && p.lng && _map) _map.setView([p.lat, p.lng], 16, { animate: true });
  }

  async function _verRelatorioFiscal(fiscalId, nome) {
    const painel = document.getElementById('mapa-painel');
    if (!painel) return;
    
    painel.innerHTML = `<div style="padding:14px;color:#a0aec0;font-size:12px">📊 Gerando relatório de ${nome.split(' ')[0]}...</div>`;
    
    try {
      const res = await api.get('GET_RELATORIO_SUPERVISAO', { fiscal_id: fiscalId, data: _dataFiltroAtual });
      if (!res.ok) throw new Error(res.erro);
      
      const visitasHtml = (res.visitas || []).map(v => {
        const isLonga = v.duracao_min > 45 && !v.is_cobertura;
        const bg = v.is_cobertura ? 'rgba(159,122,234,0.1)' : (isLonga ? 'rgba(252,129,129,0.05)' : 'transparent');
        return `
          <div style="padding:10px;border-bottom:1px solid rgba(99,179,237,0.1);background:${bg}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
              <div style="font-size:13px;font-weight:700;color:#e2e8f0">📍 ${v.local}</div>
              ${v.is_cobertura ? '<span style="font-size:9px;font-weight:800;background:#9f7aea;color:#fff;padding:2px 5px;border-radius:4px;letter-spacing:0.5px">COBERTURA</span>' : ''}
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px">
              <span>⏰ ${new Date(v.inicio).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})} - ${new Date(v.fim).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
              <span style="font-weight:800;color:${v.is_cobertura ? '#9f7aea' : (isLonga ? '#fc8181' : '#68d391')}">⏱️ ${v.duracao_min} min</span>
            </div>
            ${isLonga ? '<div style="font-size:9px;color:#fc8181;margin-top:4px;font-weight:700">⚠️ PERMANÊNCIA LONGA</div>' : ''}
          </div>`;
      }).join('') || '<div style="padding:20px;text-align:center;color:#4a5568">Nenhuma visita registrada hoje.</div>';

      painel.innerHTML = `
        <div style="padding:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <span style="font-size:12px;font-weight:700;color:#9f7aea">RELATÓRIO DE VISITAS</span>
            <button onclick="mapaScreen._voltarLista()" style="background:none;border:none;color:#718096;cursor:pointer;font-size:12px">← Voltar</button>
          </div>
          <div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-bottom:2px">⭐ ${nome}</div>
          <div style="font-size:11px;color:#718096;margin-bottom:16px">Data: ${new Date(_dataFiltroAtual).toLocaleDateString('pt-BR')}</div>
          
          <div style="background:#1a2744;border-radius:10px;overflow:hidden;border:1px solid rgba(99,179,237,0.1)">
            ${visitasHtml}
          </div>
          
          <div style="margin-top:16px;font-size:10px;color:#4a5568;line-height:1.4">
            * Consideramos "visita" permanências de no mínimo 5 minutos dentro de um raio de 150m do slot.
          </div>
        </div>`;
    } catch(e) {
      painel.innerHTML = `<div style="padding:14px;color:#fc8181">❌ Erro ao carregar: ${e.message}</div><button onclick="mapaScreen._voltarLista()">Voltar</button>`;
    }
  }

  async function _verRota(promotorId) {
    if (!_layerRota || !_map) return;
    _layerRota.clearLayers();
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const res  = await api.getHistoricoLocalizacao(promotorId, hoje);
      const pts  = (res?.pontos || []).filter(p => p.lat && p.lng);
      if (pts.length < 2) return;
      const latlngs = pts.map(p => [parseFloat(p.lat), parseFloat(p.lng)]);
      L.polyline(latlngs, { color:'#63b3ed', weight:3, opacity:.8, dashArray:'6,4' }).addTo(_layerRota);
      L.circleMarker(latlngs[0], { radius:7, color:'#68d391', fillColor:'#68d391', fillOpacity:1, weight:2 }).bindTooltip('Início').addTo(_layerRota);
      L.circleMarker(latlngs[latlngs.length-1], { radius:7, color:'#fc8181', fillColor:'#fc8181', fillOpacity:1, weight:2 }).bindTooltip('Atual').addTo(_layerRota);
      _map.fitBounds(L.latLngBounds(latlngs), { padding:[40,40] });
    } catch(e) { console.error('[rota]', e.message); }
  }

  function destroy() {
    clearInterval(_interval); _interval = null;
    if (_map) { _map.remove(); _map = null; }
  }

  return { _dataFiltro: new Date().toISOString().split('T')[0], _setDataFiltro, _toggleLayer, _aplicarFiltros, _limparFiltros, _focarPromotor, _voltarLista, _verRota, render, destroy };
})();
