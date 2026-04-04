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
          <h2 class="screen-title">Operação de Hoje</h2>
          <span id="kpi-updated" class="screen-subtitle">Atualizando...</span>
        </div>

        <div class="kpi-grid" id="kpi-grid">
          ${_cardSkeleton(6)}
        </div>

        <div class="section-title">Ações Rápidas</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:24px">
          <button onclick="router.navigate('broadcast')" style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px;color:#eaf0fb;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;font-size:13px;font-weight:600">
            <span style="font-size:24px">📢</span> Broadcast
          </button>
          <button onclick="router.navigate('slots')" style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px;color:#eaf0fb;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;font-size:13px;font-weight:600">
            <span style="font-size:24px">📍</span> Criar Slot
          </button>
        </div>

        <div class="section-title">Promotores em campo</div>
        <div id="kpi-promotores-lista" class="promotor-list">
          <div class="list-loading">Carregando...</div>
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
      { label: 'Promotores Ativos',  value: k.promotores_ativos  ?? '—', icon: '👤', color: '#63b3ed' },
      { label: 'Em Operação',        value: k.em_operacao         ?? '—', icon: '🛴', color: '#68d391' },
      { label: 'Slots Ocupados',     value: k.slots_ocupados      ?? '—', icon: '📍', color: '#f6ad55' },
      { label: 'Slots Disponíveis',  value: k.slots_disponiveis   ?? '—', icon: '🟢', color: '#68d391' },
      { label: 'Check-ins Hoje',     value: k.checkins_hoje       ?? '—', icon: '✅', color: '#b794f4' },
      { label: 'Solicitações Abertas', value: k.solicitacoes_abertas ?? '—', icon: '🔔', color: '#fc8181' },
    ];

    grid.innerHTML = cards.map(c => `
      <div class="kpi-card" style="--accent:${c.color}">
        <div class="kpi-icon">${c.icon}</div>
        <div class="kpi-value" style="color:${c.color}">${c.value}</div>
        <div class="kpi-label">${c.label}</div>
      </div>
    `).join('');
  }

  function _cardSkeleton(n) {
    return Array(n).fill(0).map(() => `
      <div class="kpi-card skeleton">
        <div class="kpi-icon">·</div>
        <div class="kpi-value">—</div>
        <div class="kpi-label">Carregando</div>
      </div>
    `).join('');
  }

  // ── Lista de promotores ──────────────────────────────────────────────────────
  function _renderPromotores(lista) {
    const el = document.getElementById('kpi-promotores-lista');
    if (!el) return;

    if (!lista.length) {
      el.innerHTML = '<div class="list-empty">Nenhum promotor em campo agora.</div>';
      return;
    }

    el.innerHTML = lista.map(p => {
      const status = _statusBadge(p.status_jornada);
      const tempoStr = p.inicio_real
        ? _elapsed(p.inicio_real)
        : '—';

      return `
        <div class="promotor-item">
          <div class="promotor-info">
            <div class="promotor-nome">${p.nome}</div>
            <div class="promotor-detalhe">${p.slot_nome || 'Sem slot'} · ${tempoStr}</div>
          </div>
          ${status}
        </div>
      `;
    }).join('');
  }

  function _statusBadge(status) {
    const map = {
      EM_OPERACAO:  { label: 'Em operação',  color: '#68d391' },
      PAUSADO:      { label: 'Pausado',       color: '#f6ad55' },
      CHECKIN_FEITO:{ label: 'Check-in feito',color: '#63b3ed' },
    };
    const s = map[status] || { label: status || 'Ativo', color: '#718096' };
    return `<span class="status-badge" style="background:${s.color}20;color:${s.color};border-color:${s.color}40">${s.label}</span>`;
  }

  function _elapsed(isoStr) {
    const inicio = new Date(isoStr);
    const diff = Math.floor((Date.now() - inicio) / 60000);
    if (diff < 60) return `${diff}min`;
    return `${Math.floor(diff / 60)}h${String(diff % 60).padStart(2, '0')}`;
  }

  return { render, destroy };
})();