// ─── kpis.js ──────────────────────────────────────────────────────────────────
// Dashboard de KPIs do dia — atualiza automaticamente

const kpisScreen = (() => {
  let _interval = null;

  // ── Render principal ─────────────────────────────────────────────────────────
  function render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <section class="screen" id="screen-kpis">
        <div class="screen-header">
          <div style="width:40px;height:40px;background:rgba(99,179,237,0.1);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#63b3ed;font-size:20px">📊</div>
          <div>
            <h2 class="screen-title">Panorama Operacional</h2>
            <div style="font-size:12px;color:#718096;margin-top:2px">Acompanhamento em tempo real da operação</div>
          </div>
          <span id="kpi-updated" class="screen-subtitle">Sincronizando...</span>
        </div>

        <div class="kpi-grid" id="kpi-grid">
          ${_cardSkeleton(6)}
        </div>

        <div class="section-title">Ações Rápidas</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px">
          <button onclick="router.navigate('broadcast')" class="kpi-card" style="cursor:pointer;flex-direction:row;align-items:center;gap:16px;padding:16px 20px">
            <span style="font-size:24px">📢</span>
            <div style="text-align:left">
              <div style="font-size:14px;font-weight:700;color:#fff">Broadcast</div>
              <div style="font-size:11px;color:#718096">Aviso em massa</div>
            </div>
          </button>
          
          <button onclick="router.navigate('slots')" class="kpi-card" style="cursor:pointer;flex-direction:row;align-items:center;gap:16px;padding:16px 20px">
            <span style="font-size:24px">📍</span>
            <div style="text-align:left">
              <div style="font-size:14px;font-weight:700;color:#fff">Novo Slot</div>
              <div style="font-size:11px;color:#718096">Criar ponto vago</div>
            </button>

          <button onclick="mapaScreen.render()" class="kpi-card" style="cursor:pointer;flex-direction:row;align-items:center;gap:16px;padding:16px 20px">
            <span style="font-size:24px">🗺️</span>
            <div style="text-align:left">
              <div style="font-size:14px;font-weight:700;color:#fff">Ver Mapa</div>
              <div style="font-size:11px;color:#718096">Monitorar campo</div>
            </button>
        </div>

        <div class="section-title">Promotores em campo</div>
        <div id="kpi-promotores-lista" class="promotor-list">
          <div style="grid-column:1/-1;padding:40px;text-align:center;color:#4a5568">Carregando lista...</div>
        </div>

        <div class="section-title">Performance por Equipe (Semanal)</div>
        <div id="kpi-equipes-chart" style="background:#0d1526;border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:24px;margin-top:12px">
          <div style="text-align:center;color:#4a5568;padding:20px">Carregando comparativo...</div>
        </div>
      </section>
    `;

    _load();
    _interval = setInterval(_load, CONFIG.KPI_REFRESH_INTERVAL);
  }

  function destroy() {
    clearInterval(_interval);
    _interval = null;
  }

  // ── Carga de dados ───────────────────────────────────────────────────────────
  async function _load() {
    try {
      const [kpiRes, promRes] = await Promise.all([
        api.getKpisDia(),
        api.getPromotoresAtivos(),
      ]);

      const kpis = kpiRes?.data || {};
      const promotores = promRes?.data || [];

      state.set('kpis', kpis);
      state.set('promotores', promotores);

      _renderCards(kpis);
      _renderPromotores(promotores);
      _renderEquipesChart(kpis.performance_equipes || []);

      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const el = document.getElementById('kpi-updated');
      if (el) el.textContent = `Atualizado às ${now}`;

    } catch (err) {
      console.error('[KPIs] Erro ao carregar:', err);
    }
  }

  // ── Cards de KPI ─────────────────────────────────────────────────────────────
  function _renderCards(k) {
    const grid = document.getElementById('kpi-grid');
    if (!grid) return;

    const cards = [
      { label: 'Promotores Ativos',  value: k.promotores_ativos  ?? '—', icon: '👤', color: '#63b3ed', sub: 'No sistema hoje' },
      { label: 'Em Operação',        value: k.em_operacao         ?? '—', icon: '⚡', color: '#68d391', sub: 'Com GPS ativo' },
      { label: 'Slots Ocupados',     value: k.slots_ocupados      ?? '—', icon: '📍', color: '#f6ad55', sub: 'Vagas preenchidas' },
      { label: 'Slots Disponíveis',  value: k.slots_disponiveis   ?? '—', icon: '🟢', color: '#68d391', sub: 'Vagas em aberto' },
      { label: 'Check-ins Hoje',     value: k.checkins_hoje       ?? '—', icon: '✅', color: '#b794f4', sub: 'Entradas totais' },
      { label: 'Solicitações',       value: k.solicitacoes_abertas ?? '—', icon: '🔔', color: '#fc8181', sub: 'Aguardando ação' },
    ];

    grid.innerHTML = cards.map(c => `
      <div class="kpi-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="width:36px;height:36px;background:${c.color}15;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px">${c.icon}</div>
          <div style="font-size:10px;color:#4a5568;font-weight:700;letter-spacing:1px;text-transform:uppercase">LIVE</div>
        </div>
        <div style="margin-top:12px">
          <div class="kpi-value" style="color:${c.color}">${c.value}</div>
          <div class="kpi-label">${c.label}</div>
          <div style="font-size:11px;color:#4a5568;margin-top:2px">${c.sub}</div>
        </div>
      </div>
    `).join('');
  }

  function _cardSkeleton(n) {
    return Array(n).fill(0).map(() => `
      <div class="kpi-card skeleton">
        <div style="width:36px;height:36px;background:rgba(255,255,255,0.05);border-radius:8px"></div>
        <div style="margin-top:12px">
          <div style="height:32px;width:60px;background:rgba(255,255,255,0.05);border-radius:4px;margin-bottom:8px"></div>
          <div style="height:12px;width:100px;background:rgba(255,255,255,0.05);border-radius:4px"></div>
        </div>
      </div>
    `).join('');
  }

  // ── Lista de promotores ──────────────────────────────────────────────────────
  function _renderPromotores(lista) {
    const el = document.getElementById('kpi-promotores-lista');
    if (!el) return;

    if (!lista.length) {
      el.innerHTML = '<div style="grid-column:1/-1;padding:60px;text-align:center;color:#4a5568;background:rgba(0,0,0,0.1);border-radius:12px;border:1px dashed rgba(255,255,255,0.05)">Nenhum promotor em campo neste momento.</div>';
      return;
    }

    el.innerHTML = lista.map(p => {
      const status = _statusBadge(p.status_jornada);
      const tempoStr = p.inicio_real ? _elapsed(p.inicio_real) : '—';
      const vinculacao = (p.tipo_vinculo || 'MEI').toUpperCase();
      const corVinc = vinculacao === 'MEI' ? '#63b3ed' : '#b794f4';

      return `
        <div class="promotor-item">
          <div style="display:flex;align-items:center;gap:14px">
            <div style="width:42px;height:42px;background:rgba(255,255,255,0.03);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:1px solid rgba(255,255,255,0.05)">
              ${p.status_jornada === 'PAUSADO' ? '☕' : '👤'}
            </div>
            <div>
              <div class="promotor-nome">${p.nome}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:2px">
                <span style="font-size:10px;font-weight:800;color:${corVinc};background:${corVinc}15;padding:1px 6px;border-radius:4px;letter-spacing:0.5px">${vinculacao}</span>
                <span class="promotor-detalhe">${p.slot_nome || 'Sem slot'}</span>
              </div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;font-weight:700;color:#fff;font-family:'IBM Plex Mono',monospace;margin-bottom:4px">⏱️ ${tempoStr}</div>
            ${status}
          </div>
        </div>
      `;
    }).join('');
  }

  function _renderEquipesChart(equipes) {
    const el = document.getElementById('kpi-equipes-chart');
    if (!el) return;

    if (!equipes.length) {
      el.innerHTML = '<div style="text-align:center;color:#4a5568">Sem dados de equipes para o período.</div>';
      return;
    }

    const maxPts = Math.max(...equipes.map(e => e.pontos), 1);
    
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px">
        ${equipes.map(eq => {
          const perc = (eq.pontos / maxPts) * 100;
          return `
            <div style="display:flex;flex-direction:column;gap:6px">
              <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600">
                <span style="color:#fff">${eq.nome}</span>
                <span style="color:#63b3ed">${eq.pontos} pts</span>
              </div>
              <div style="height:8px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden">
                <div style="height:100%;width:${perc}%;background:linear-gradient(90deg, #63b3ed, #4299e1);border-radius:4px;transition:width 1s ease-out"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function _statusBadge(status) {
    const map = {
      EM_OPERACAO:  { label: 'Operando',  color: '#68d391' },
      EM_TURNO:     { label: 'Operando',  color: '#68d391' },
      PAUSADO:      { label: 'Pausado',   color: '#f6ad55' },
      CHECKIN_FEITO:{ label: 'No Local',  color: '#63b3ed' },
      ACEITO:       { label: 'A caminho', color: '#4a5568' },
    };
    const s = map[status] || { label: status || 'Ativo', color: '#718096' };
    return `<span class="status-badge" style="background:${s.color}15;color:${s.color};border-color:${s.color}30">${s.label}</span>`;
  }

  function _elapsed(isoStr) {
    try {
      const inicio = new Date(isoStr);
      const diff = Math.floor((Date.now() - inicio) / 60000);
      if (diff < 0) return '0min';
      if (diff < 60) return `${diff}min`;
      return `${Math.floor(diff / 60)}h${String(diff % 60).padStart(2, '0')}`;
    } catch(e) { return '—'; }
  }

  return { render, destroy };
})();