// ============================================================
//  gestor.js  — Painel Gestor integrado ao PWA JET OPS
//  Detectado automaticamente pelo cargo/tipo_vinculo do token
// ============================================================
'use strict';

const gestor = (() => {

  const GESTOR_ROLES = ['GESTOR','LIDER','FISCAL','GES','LID'];

  function isGestorUser(user) {
    if (!user) return false;
    const role = (user.tipo_vinculo || user.cargo_principal || '').toUpperCase();
    return GESTOR_ROLES.includes(role);
  }

  // ── Estado interno ────────────────────────────────────────
  let _page = 'dashboard';
  let _solData = [], _solFilter = 'all';
  let _promData = [];
  let _rankingPeriodo = 'SEMANAL';
  let _bcVinculo = 'all', _bcCidade = 'all';
  let _broadcastFilters = null;
  let _cltDate = '';
  let _slotFilter = 'all';
  let _autoRefresh = null;
  let _activeSolId = null, _activeCadId = null;
  let _mapObj = null, _mapMarkers = [], _mapInit = false;
  let _mapaDia = 'hoje', _mapaCidade = 'all';

  const pages = {
    dashboard:    { title: 'Dashboard',            sub: 'Visao geral operacional' },
    mapa:         { title: 'Mapa ao Vivo',          sub: 'Localizacao dos promotores' },
    slots:        { title: 'Slots / Locais',        sub: 'Pontos de operacao do dia' },
    solicitacoes: { title: 'Solicitacoes',          sub: 'Pedidos e ocorrencias abertas' },
    promotores:   { title: 'Promotores',            sub: 'Equipe ativa e historico' },
    clt:          { title: 'Turnos CLT',            sub: 'Gestao de turnos' },
    ranking:      { title: 'Ranking',               sub: 'Pontuacao semanal / mensal' },
    broadcast:    { title: 'Broadcast',             sub: 'Envio de mensagens em massa' },
    cadastros:    { title: 'Cadastros Pendentes',   sub: 'Aprovacao de novos promotores' },
  };

  // ── API helpers ───────────────────────────────────────────
  async function gGet(evento, params) {
    return api.get(evento, params || {});
  }
  async function gPost(evento, body) {
    return api.post({ evento, ...(body || {}) });
  }

  // ── HTML helpers ──────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function ago(iso) {
    if (!iso) return '';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return 'agora';
    if (diff < 3600) return Math.floor(diff/60) + 'min atras';
    if (diff < 86400) return Math.floor(diff/3600) + 'h atras';
    return Math.floor(diff/86400) + 'd atras';
  }
  function badge(cls, label) {
    return '<span class="g-badge g-badge-' + cls + '">' + label + '</span>';
  }
  function spinner() {
    return '<div class="g-loading"><div class="g-spinner"></div></div>';
  }
  function empty(icon, msg) {
    return '<div class="g-empty"><div class="g-empty-icon">' + icon + '</div><div class="g-empty-msg">' + msg + '</div></div>';
  }

  // ── Toast ─────────────────────────────────────────────────
  function toast(msg, tipo) {
    const c = document.getElementById('g-toast-container');
    if (!c) return;
    const el = document.createElement('div');
    el.className = 'g-toast g-toast-' + (tipo || 'info');
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3500);
  }

  function openModal(id)  { const m = document.getElementById(id); if(m) m.classList.add('open'); }
  function closeModal(id) { const m = document.getElementById(id); if(m) m.classList.remove('open'); }

  // ── RENDER SHELL ──────────────────────────────────────────
  function renderShell(user) {
    const nome = (user.nome_completo || user.nome || 'Gestor').split(' ').slice(0,2).join(' ');
    const role = (user.tipo_vinculo || user.cargo_principal || 'GESTOR').toUpperCase();
    const av   = (user.nome_completo || user.nome || 'G').charAt(0).toUpperCase();

    document.getElementById('app').innerHTML =
      '<div id="g-sidebar-overlay" class="g-sidebar-overlay"></div>' +
      '<aside id="g-sidebar" class="g-sidebar">' +
        '<div class="g-sidebar-logo">' +
          '<div class="g-logo-mark">J</div>' +
          '<div><div class="g-logo-name">JET OPS</div><div class="g-logo-sub">Painel Gestor</div></div>' +
        '</div>' +
        '<div class="g-sidebar-user">' +
          '<div class="g-avatar" id="g-user-av">' + esc(av) + '</div>' +
          '<div><div class="g-user-name">' + esc(nome) + '</div><div class="g-user-role">' + esc(role) + '</div></div>' +
        '</div>' +
        '<div class="g-nav-section">' +
          '<div class="g-nav-label">Operacao</div>' +
          navBtn('dashboard','&#9632;','Dashboard') +
          navBtn('mapa','&#9675;','Mapa ao Vivo','badge-ativos') +
          navBtn('slots','&#9670;','Slots / Locais') +
          navBtn('solicitacoes','&#9651;','Solicitacoes','badge-sol') +
        '</div>' +
        '<div class="g-nav-section">' +
          '<div class="g-nav-label">Equipe</div>' +
          navBtn('promotores','&#9632;','Promotores') +
          navBtn('clt','&#9711;','Turnos CLT') +
          navBtn('ranking','&#9733;','Ranking') +
        '</div>' +
        '<div class="g-nav-section">' +
          '<div class="g-nav-label">Ferramentas</div>' +
          navBtn('broadcast','&#9654;','Broadcast') +
          navBtn('cadastros','&#43;','Cadastros Pendentes','badge-cad','warn') +
        '</div>' +
        '<div class="g-sidebar-footer">' +
          '<button class="g-logout-btn" id="g-logout-btn">&#8592; Sair</button>' +
        '</div>' +
      '</aside>' +

      '<div id="g-main" class="g-main">' +
        '<header class="g-header">' +
          '<button class="g-menu-btn" id="g-menu-btn">&#9776;</button>' +
          '<div><div class="g-header-title" id="g-header-title">Dashboard</div>' +
          '<div class="g-header-sub" id="g-header-sub">Visao geral operacional</div></div>' +
          '<div class="g-header-actions">' +
            '<div class="g-pill"><span class="g-dot"></span><span>Ao vivo</span></div>' +
            '<button class="g-btn g-btn-ghost" id="g-refresh-btn">&#8635;</button>' +
          '</div>' +
        '</header>' +
        '<div id="g-content" class="g-content">' +
          '<div id="g-page-dashboard" class="g-page active">' + spinner() + '</div>' +
          '<div id="g-page-mapa"         class="g-page"></div>' +
          '<div id="g-page-slots"        class="g-page"></div>' +
          '<div id="g-page-solicitacoes" class="g-page"></div>' +
          '<div id="g-page-promotores"   class="g-page"></div>' +
          '<div id="g-page-clt"          class="g-page"></div>' +
          '<div id="g-page-ranking"      class="g-page"></div>' +
          '<div id="g-page-broadcast"    class="g-page"></div>' +
          '<div id="g-page-cadastros"    class="g-page"></div>' +
        '</div>' +
      '</div>' +

      // Modals
      '<div class="g-modal-backdrop" id="g-modal-sol">' +
        '<div class="g-modal">' +
          '<button class="g-modal-close" id="g-modal-sol-close">&#215;</button>' +
          '<div class="g-modal-title" id="g-modal-sol-title">Responder Solicitacao</div>' +
          '<div class="g-modal-sub" id="g-modal-sol-desc"></div>' +
          '<div class="g-field"><label>Resposta</label>' +
            '<select class="g-select" id="g-modal-sol-status">' +
              '<option value="ATENDIDA">Atendida</option>' +
              '<option value="EM_ATENDIMENTO">Em Atendimento</option>' +
              '<option value="RECUSADA">Recusada</option>' +
            '</select></div>' +
          '<div class="g-field"><label>Observacao (opcional)</label>' +
            '<textarea class="g-textarea" id="g-modal-sol-obs" placeholder="Comentario..."></textarea></div>' +
          '<div class="g-modal-footer">' +
            '<button class="g-btn g-btn-ghost" id="g-modal-sol-cancel">Cancelar</button>' +
            '<button class="g-btn g-btn-primary" id="g-modal-sol-confirm">Confirmar</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="g-modal-backdrop" id="g-modal-cad">' +
        '<div class="g-modal">' +
          '<button class="g-modal-close" id="g-modal-cad-close">&#215;</button>' +
          '<div class="g-modal-title">Aprovar Cadastro</div>' +
          '<div class="g-modal-sub" id="g-modal-cad-desc"></div>' +
          '<div class="g-field"><label>Tipo de Vinculo</label>' +
            '<select class="g-select" id="g-modal-cad-vinculo">' +
              '<option value="MEI">MEI</option>' +
              '<option value="CLT">CLT</option>' +
              '<option value="FISCAL">Fiscal</option>' +
            '</select></div>' +
          '<div class="g-modal-footer">' +
            '<button class="g-btn g-btn-danger" id="g-modal-cad-reject">Rejeitar</button>' +
            '<button class="g-btn g-btn-primary" id="g-modal-cad-approve">Aprovar</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div id="g-toast-container" class="g-toast-container"></div>';

    bindEvents();
    goPage('dashboard');
    startAutoRefresh();
  }

  function navBtn(page, icon, label, badgeId, badgeCls) {
    const b = badgeId
      ? '<span class="g-nav-badge' + (badgeCls ? ' ' + badgeCls : '') + '" id="' + badgeId + '" style="display:none">0</span>'
      : '';
    return '<button class="g-nav-item" data-page="' + page + '">' +
      '<span class="g-ni">' + icon + '</span>' + esc(label) + b + '</button>';
  }

  // ── EVENTS ────────────────────────────────────────────────
  function bindEvents() {
    // Nav
    document.querySelectorAll('.g-nav-item[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        goPage(btn.dataset.page);
        closeSidebar();
      });
    });

    // Hamburger
    document.getElementById('g-menu-btn').addEventListener('click', () => {
      document.getElementById('g-sidebar').classList.toggle('open');
      document.getElementById('g-sidebar-overlay').classList.toggle('open');
    });
    document.getElementById('g-sidebar-overlay').addEventListener('click', closeSidebar);

    // Refresh
    document.getElementById('g-refresh-btn').addEventListener('click', () => loadPage(_page));

    // Logout
    document.getElementById('g-logout-btn').addEventListener('click', () => {
      if (_autoRefresh) clearInterval(_autoRefresh);
      _mapInit = false; _mapObj = null; _mapMarkers = [];
      GPS.parar();
      state.clearToken();
      router.go('splash');
    });

    // Modal sol
    document.getElementById('g-modal-sol-close').addEventListener('click', () => closeModal('g-modal-sol'));
    document.getElementById('g-modal-sol-cancel').addEventListener('click', () => closeModal('g-modal-sol'));
    document.getElementById('g-modal-sol-confirm').addEventListener('click', confirmSol);

    // Modal cad
    document.getElementById('g-modal-cad-close').addEventListener('click', () => closeModal('g-modal-cad'));
    document.getElementById('g-modal-cad-approve').addEventListener('click', () => confirmCad('APROVADO'));
    document.getElementById('g-modal-cad-reject').addEventListener('click',  () => confirmCad('REJEITADO'));
  }

  function closeSidebar() {
    document.getElementById('g-sidebar').classList.remove('open');
    document.getElementById('g-sidebar-overlay').classList.remove('open');
  }

  function goPage(page) {
    _page = page;
    document.querySelectorAll('.g-nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    document.querySelectorAll('.g-page').forEach(p => p.classList.remove('active'));
    const pg = document.getElementById('g-page-' + page);
    if (pg) pg.classList.add('active');
    const info = pages[page] || {};
    document.getElementById('g-header-title').textContent = info.title || page;
    document.getElementById('g-header-sub').textContent   = info.sub   || '';
    loadPage(page);
  }

  function loadPage(page) {
    if (page === 'dashboard')    loadDashboard();
    else if (page === 'mapa')         loadMapa();
    else if (page === 'slots')        loadSlots();
    else if (page === 'solicitacoes') loadSolicitacoes();
    else if (page === 'promotores')   loadPromotores();
    else if (page === 'clt')          loadClt();
    else if (page === 'ranking')      loadRanking();
    else if (page === 'broadcast')    loadBroadcast();
    else if (page === 'cadastros')    loadCadastros();
  }

  function setPage(page, html) {
    const el = document.getElementById('g-page-' + page);
    if (el) el.innerHTML = html;
  }

  function startAutoRefresh() {
    if (_autoRefresh) clearInterval(_autoRefresh);
    _autoRefresh = setInterval(() => {
      if (_page === 'dashboard')    loadDashboard();
      else if (_page === 'mapa')         loadMapa();
      else if (_page === 'slots')        loadSlots();
      else if (_page === 'solicitacoes') loadSolicitacoes();
    }, 30000);
  }

  // ── DASHBOARD ─────────────────────────────────────────────
  async function loadDashboard() {
    try {
      const [ar, sr] = await Promise.all([
        gGet('GET_PROMOTORES_ATIVOS'),
        gGet('GET_SLOTS_HOJE'),
      ]);
      const ativos = ar.promotores || ar.data || [];
      const slots  = sr.data || [];

      const emOperacao  = slots.filter(s => ['OCUPADO','ACEITO','EM_ATIVIDADE','PAUSADO'].includes(s.status_geral)).length;
      const agora = new Date();
      const minAtual = agora.getHours() * 60 + agora.getMinutes();
      const encerrados = slots.filter(s => {
        if (['ENCERRADO','CANCELADO'].includes(s.status_geral)) return true;
        if (!s.fim_slot || s.status_geral === 'OCUPADO') return false;
        const parts = s.fim_slot.split(':').map(Number);
        return (parts[0] * 60 + (parts[1] || 0)) < minAtual;
      }).length;
      const disponiveis = slots.filter(s => {
        if (s.status_geral !== 'DISPONIVEL') return false;
        if (!s.fim_slot) return true;
        const parts = s.fim_slot.split(':').map(Number);
        return (parts[0] * 60 + (parts[1] || 0)) >= minAtual;
      }).length;

      const kpis = [
        { l:'Promotores Ativos',  v: ativos.length,  c:'green' },
        { l:'Em Operacao Agora',  v: emOperacao,     c:'blue'  },
        { l:'Encerrados Hoje',    v: encerrados,     c:'gray'  },
        { l:'Disponiveis',        v: disponiveis,    c:'warn'  },
        { l:'Total do Dia',       v: slots.length,   c:''      },
      ];

      const badgeAt = document.getElementById('badge-ativos');
      if (badgeAt) { badgeAt.textContent = ativos.length; badgeAt.style.display = ativos.length ? '' : 'none'; }

      const kpiHtml = '<div class="g-kpi-grid">' + kpis.map(k =>
        '<div class="g-kpi-card ' + k.c + '">' +
          '<div class="g-kpi-label">' + k.l + '</div>' +
          '<div class="g-kpi-value ' + k.c + '">' + k.v + '</div>' +
        '</div>'
      ).join('') + '</div>';

      const statusCls = { EM_ATIVIDADE:'green', ACEITO:'blue', PAUSADO:'warn', EM_TURNO:'green', CONFIRMADO:'blue' };
      const statusLbl = { EM_ATIVIDADE:'Em atividade', ACEITO:'Aceito', PAUSADO:'Pausado', EM_TURNO:'Em turno', CONFIRMADO:'Confirmado' };
      const tblHtml = ativos.length
        ? '<div class="g-table-wrap"><table><thead><tr><th>Nome</th><th>Status</th><th>Tipo</th><th>Local</th><th>Desde</th></tr></thead><tbody>' +
          ativos.map(p => {
            const ini = p.inicio_real ? new Date(p.inicio_real).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '—';
            return '<tr><td class="g-bold">' + esc(p.nome) + '</td>' +
              '<td>' + badge(statusCls[p.status_jornada] || 'gray', statusLbl[p.status_jornada] || p.status_jornada) + '</td>' +
              '<td>' + badge('gray', p.tipo_vinculo || '?') + '</td>' +
              '<td>' + esc(p.slot_nome || p.cidade || '—') + '</td>' +
              '<td class="g-mono">' + ini + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : empty('&#128100;','Nenhum promotor ativo');

      // D+1 preview
      const d1Date = new Date(); d1Date.setDate(d1Date.getDate() + 1);
      const amanhaStr = d1Date.toISOString().split('T')[0];
      const amanhaFmt = d1Date.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'2-digit' });

      let d1Html = '';
      try {
        const d1r = await gGet('GET_SLOTS_HOJE', { data: amanhaStr });
        const d1slots = d1r.data || [];
        const d1cidades = [...new Set(d1slots.map(s => s.cidade).filter(Boolean))].sort();
        const d1ocupados = d1slots.filter(s => s.promotores && s.promotores.length > 0).length;
        const d1livres   = d1slots.filter(s => !s.promotores || s.promotores.length === 0).length;

        const d1cidadesHtml = d1cidades.map(cidade => {
          const slotsC = d1slots.filter(s => s.cidade === cidade);
          const ocC = slotsC.filter(s => s.promotores && s.promotores.length > 0).length;
          const livC = slotsC.length - ocC;
          return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid var(--border)">' +
            '<span style="font-size:13px;font-weight:600;color:var(--text)">' + esc(cidade) + '</span>' +
            '<span style="font-size:12px;font-family:var(--mono);color:var(--text2)">' +
              '<span style="color:var(--accent)">' + ocC + ' confirmados</span>' +
              ' &nbsp;·&nbsp; ' +
              '<span style="color:var(--warn)">' + livC + ' vagos</span>' +
            '</span>' +
          '</div>';
        }).join('');

        d1Html = '<div class="g-card" style="margin-top:14px">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
            '<div class="g-card-title" style="margin-bottom:0">Previsao Amanha</div>' +
            '<span style="font-size:11px;font-family:var(--mono);color:var(--text3)">' + esc(amanhaFmt) + '</span>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">' +
            '<div style="background:var(--surface2);border-radius:10px;padding:12px;text-align:center">' +
              '<div style="font-size:22px;font-weight:800;font-family:var(--mono);color:var(--text)">' + d1slots.length + '</div>' +
              '<div style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.05em">Total Slots</div>' +
            '</div>' +
            '<div style="background:var(--surface2);border-radius:10px;padding:12px;text-align:center">' +
              '<div style="font-size:22px;font-weight:800;font-family:var(--mono);color:var(--accent)">' + d1ocupados + '</div>' +
              '<div style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.05em">Confirmados</div>' +
            '</div>' +
            '<div style="background:var(--surface2);border-radius:10px;padding:12px;text-align:center">' +
              '<div style="font-size:22px;font-weight:800;font-family:var(--mono);color:var(--warn)">' + d1livres + '</div>' +
              '<div style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.05em">Vagos</div>' +
            '</div>' +
          '</div>' +
          (d1cidadesHtml || '<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px">Nenhum slot cadastrado para amanha</div>') +
        '</div>';
      } catch(_) {}

      setPage('dashboard', kpiHtml + d1Html + '<div class="g-card" style="margin-top:14px"><div class="g-card-title">Promotores Ativos Agora</div>' + tblHtml + '</div>');
    } catch(e) {
      setPage('dashboard', empty('&#9888;', 'Erro: ' + e.message));
    }
  }

  async function _mapaRefresh() {
    if (!_mapObj) return;
    try {
      const hoje = new Date();
      const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
      const fmt = d => d.toISOString().split('T')[0];
      const dataParam = _mapaDia === 'amanha' ? fmt(amanha) : fmt(hoje);

      const [ar, sr] = await Promise.all([
        _mapaDia === 'hoje' ? gGet('GET_PROMOTORES_ATIVOS') : Promise.resolve({ promotores: [] }),
        gGet('GET_SLOTS_HOJE', { data: dataParam }),
      ]);
      const ativos = ar.promotores || ar.data || [];
      let slots  = sr.data || [];

      // Extrair cidades disponíveis e atualizar filtro
      const cidades = [...new Set(slots.map(s => s.cidade).filter(Boolean))].sort();
      const cidadeWrap = document.getElementById('g-mapa-cidade-wrap');
      if (cidadeWrap && cidades.length > 1) {
        cidadeWrap.innerHTML = '<select id="g-mapa-cidade-sel" class="g-select" style="padding:4px 8px;font-size:11px;width:auto">' +
          '<option value="all">Todas cidades</option>' +
          cidades.map(c => '<option value="' + esc(c) + '"' + (_mapaCidade===c?' selected':'') + '>' + esc(c) + '</option>').join('') +
          '</select>';
        document.getElementById('g-mapa-cidade-sel').addEventListener('change', e => {
          _mapaCidade = e.target.value;
          _mapaRefresh();
        });
      }

      // Filtrar por cidade
      if (_mapaCidade !== 'all') slots = slots.filter(s => s.cidade === _mapaCidade);
      const stats  = sr.stats || {};
      const emOperacao  = slots.filter(s => ['OCUPADO','ACEITO','EM_ATIVIDADE','PAUSADO'].includes(s.status_geral)).length;
      const agora = new Date();
      const minAtual = agora.getHours() * 60 + agora.getMinutes();
      const encerrados = slots.filter(s => {
        if (['ENCERRADO','CANCELADO'].includes(s.status_geral)) return true;
        if (!s.fim_slot || s.status_geral === 'OCUPADO') return false;
        const parts = s.fim_slot.split(':').map(Number);
        return (parts[0] * 60 + (parts[1] || 0)) < minAtual;
      }).length;
      const disponiveis = slots.filter(s => {
        if (s.status_geral !== 'DISPONIVEL') return false;
        if (!s.fim_slot) return true;
        const parts = s.fim_slot.split(':').map(Number);
        return (parts[0] * 60 + (parts[1] || 0)) >= minAtual;
      }).length;
      const kpis = [
        { l:'Promotores Ativos',  v: ativos.length,  c:'green' },
        { l:'Em Operacao Agora',  v: emOperacao,     c:'blue'  },
        { l:'Encerrados Hoje',    v: encerrados,     c:'gray'  },
        { l:'Disponiveis',        v: disponiveis,    c:'warn'  },
        { l:'Total do Dia',       v: slots.length,   c:''      },
      ];

      const badgeAt = document.getElementById('badge-ativos');
      if (badgeAt) { badgeAt.textContent = ativos.length; badgeAt.style.display = ativos.length ? '' : 'none'; }

      const kpiHtml = '<div class="g-kpi-grid">' + kpis.map(k =>
        '<div class="g-kpi-card ' + k.c + '">' +
          '<div class="g-kpi-label">' + k.l + '</div>' +
          '<div class="g-kpi-value ' + k.c + '">' + k.v + '</div>' +
        '</div>'
      ).join('') + '</div>';

      const statusCls = { EM_ATIVIDADE:'green', ACEITO:'blue', PAUSADO:'warn', EM_TURNO:'green', CONFIRMADO:'blue' };
      const statusLbl = { EM_ATIVIDADE:'Em atividade', ACEITO:'Aceito', PAUSADO:'Pausado', EM_TURNO:'Em turno', CONFIRMADO:'Confirmado' };
      const tblHtml = ativos.length
        ? '<div class="g-table-wrap"><table><thead><tr><th>Nome</th><th>Status</th><th>Tipo</th><th>Local</th><th>Desde</th></tr></thead><tbody>' +
          ativos.map(p => {
            const ini = p.inicio_real ? new Date(p.inicio_real).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '—';
            return '<tr><td class="g-bold">' + esc(p.nome) + '</td>' +
              '<td>' + badge(statusCls[p.status_jornada] || 'gray', statusLbl[p.status_jornada] || p.status_jornada) + '</td>' +
              '<td>' + badge('gray', p.tipo_vinculo || '?') + '</td>' +
              '<td>' + esc(p.slot_nome || p.cidade || '—') + '</td>' +
              '<td class="g-mono">' + ini + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : empty('&#128100;','Nenhum promotor ativo');

      // D+1 preview
      const d1Date = new Date(); d1Date.setDate(d1Date.getDate() + 1);
      const amanhaStr = d1Date.toISOString().split('T')[0];
      const amanhaFmt = d1Date.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'2-digit' });

      let d1Html = '';
      try {
        const d1r = await gGet('GET_SLOTS_HOJE', { data: amanhaStr });
        const d1slots = d1r.data || [];
        const d1cidades = [...new Set(d1slots.map(s => s.cidade).filter(Boolean))].sort();
        const d1ocupados = d1slots.filter(s => s.promotores && s.promotores.length > 0).length;
        const d1livres   = d1slots.filter(s => !s.promotores || s.promotores.length === 0).length;

        const d1cidadesHtml = d1cidades.map(cidade => {
          const slotsC = d1slots.filter(s => s.cidade === cidade);
          const ocC = slotsC.filter(s => s.promotores && s.promotores.length > 0).length;
          const livC = slotsC.length - ocC;
          return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid var(--border)">' +
            '<span style="font-size:13px;font-weight:600;color:var(--text)">' + esc(cidade) + '</span>' +
            '<span style="font-size:12px;font-family:var(--mono);color:var(--text2)">' +
              '<span style="color:var(--accent)">' + ocC + ' confirmados</span>' +
              ' &nbsp;·&nbsp; ' +
              '<span style="color:var(--warn)">' + livC + ' vagos</span>' +
            '</span>' +
          '</div>';
        }).join('');

        d1Html = '<div class="g-card" style="margin-top:14px">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
            '<div class="g-card-title" style="margin-bottom:0">Previsao Amanha</div>' +
            '<span style="font-size:11px;font-family:var(--mono);color:var(--text3)">' + esc(amanhaFmt) + '</span>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">' +
            '<div style="background:var(--surface2);border-radius:10px;padding:12px;text-align:center">' +
              '<div style="font-size:22px;font-weight:800;font-family:var(--mono);color:var(--text)">' + d1slots.length + '</div>' +
              '<div style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.05em">Total Slots</div>' +
            '</div>' +
            '<div style="background:var(--surface2);border-radius:10px;padding:12px;text-align:center">' +
              '<div style="font-size:22px;font-weight:800;font-family:var(--mono);color:var(--accent)">' + d1ocupados + '</div>' +
              '<div style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.05em">Confirmados</div>' +
            '</div>' +
            '<div style="background:var(--surface2);border-radius:10px;padding:12px;text-align:center">' +
              '<div style="font-size:22px;font-weight:800;font-family:var(--mono);color:var(--warn)">' + d1livres + '</div>' +
              '<div style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.05em">Vagos</div>' +
            '</div>' +
          '</div>' +
          (d1cidadesHtml || '<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px">Nenhum slot cadastrado para amanha</div>') +
        '</div>';
      } catch(_) {}

      setPage('dashboard', kpiHtml + d1Html + '<div class="g-card" style="margin-top:14px"><div class="g-card-title">Promotores Ativos Agora</div>' + tblHtml + '</div>');
    } catch(e) {
      setPage('dashboard', empty('&#9888;', 'Erro: ' + e.message));
    }
  }

  // ── MAPA ──────────────────────────────────────────────────
  async function loadMapa() {
    const pg = document.getElementById('g-page-mapa');
    if (!pg) return;

    if (!_mapInit) {
      pg.innerHTML =
        '<div class="g-filter-row" style="margin-bottom:10px;gap:8px;flex-wrap:wrap" id="g-mapa-controls">' +
          '<button class="g-filter-tag active" data-dia="hoje">Hoje</button>' +
          '<button class="g-filter-tag" data-dia="amanha">Amanha (D+1)</button>' +
          '<span style="margin-left:auto;font-size:11px;color:var(--text3);font-family:var(--mono)" id="g-mapa-cidade-wrap"></span>' +
        '</div>' +
        '<div id="g-leaflet-map" style="height:calc(100vh - 170px);border-radius:12px;overflow:hidden"></div>' +
        '<div class="g-map-stats" id="g-map-stats"></div>';
      await new Promise(r => setTimeout(r, 80));

      if (typeof L === 'undefined') {
        pg.innerHTML = empty('&#128506;','Leaflet nao carregado. Verifique conexao.');
        return;
      }
      _mapObj = L.map('g-leaflet-map').setView([-23.55,-46.63], 11);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom:19 }).addTo(_mapObj);
      _mapInit = true;

      // Bind day toggle buttons
      document.querySelectorAll('#g-mapa-controls [data-dia]').forEach(btn => {
        btn.addEventListener('click', () => {
          _mapaDia = btn.dataset.dia;
          document.querySelectorAll('#g-mapa-controls [data-dia]').forEach(b => b.classList.toggle('active', b.dataset.dia === _mapaDia));
          _mapaRefresh();
        });
      });
    }

    await _mapaRefresh();
  }

  async function _mapaRefresh() {
    if (!_mapObj) return;
    try {
      const hoje = new Date();
      const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
      const fmt = d => d.toISOString().split('T')[0];
      const dataParam = _mapaDia === 'amanha' ? fmt(amanha) : fmt(hoje);

      const [ar, sr] = await Promise.all([
        _mapaDia === 'hoje' ? gGet('GET_PROMOTORES_ATIVOS') : Promise.resolve({ promotores: [] }),
        gGet('GET_SLOTS_HOJE', { data: dataParam }),
      ]);
      const ativos = ar.promotores || ar.data || [];
      let slots  = sr.data || [];

      // Extrair cidades disponíveis e atualizar filtro
      const cidades = [...new Set(slots.map(s => s.cidade).filter(Boolean))].sort();
      const cidadeWrap = document.getElementById('g-mapa-cidade-wrap');
      if (cidadeWrap && cidades.length > 1) {
        cidadeWrap.innerHTML = '<select id="g-mapa-cidade-sel" class="g-select" style="padding:4px 8px;font-size:11px;width:auto">' +
          '<option value="all">Todas cidades</option>' +
          cidades.map(c => '<option value="' + esc(c) + '"' + (_mapaCidade===c?' selected':'') + '>' + esc(c) + '</option>').join('') +
          '</select>';
        document.getElementById('g-mapa-cidade-sel').addEventListener('change', e => {
          _mapaCidade = e.target.value;
          _mapaRefresh();
        });
      }

      // Filtrar por cidade
      if (_mapaCidade !== 'all') slots = slots.filter(s => s.cidade === _mapaCidade);
      _mapMarkers.forEach(m => _mapObj.removeLayer(m));
      _mapMarkers = [];

      // Agrupar slots por coordenada (mesmo local, varios horarios)
      const locaisMap = {};
      slots.forEach(s => {
        const lat = parseFloat(s.lat); const lng = parseFloat(s.lng);
        if (!lat || !lng) return;
        const key = lat.toFixed(5) + ',' + lng.toFixed(5);
        if (!locaisMap[key]) locaisMap[key] = { lat, lng, nome: s.nome, cidade: s.cidade, turnos: [], status_geral: 'ENCERRADO' };
        locaisMap[key].turnos.push(s);
        // Status geral do local = mais prioritario entre os turnos
        const prio = { OCUPADO:3, DISPONIVEL:2, ENCERRADO:1, CANCELADO:0 };
        if ((prio[s.status_geral]||0) > (prio[locaisMap[key].status_geral]||0)) {
          locaisMap[key].status_geral = s.status_geral;
        }
      });

      const slotCores = { OCUPADO:'#00FF87', DISPONIVEL:'#3B9EFF', ENCERRADO:'#555', CANCELADO:'#444' };
      let slotsNoMapa = 0;

      // Um pin por local agrupado
      Object.values(locaisMap).forEach(local => {
        slotsNoMapa++;
        const cor = slotCores[local.status_geral] || '#3B9EFF';
        const isOcc = local.status_geral === 'OCUPADO';
        const totalProms = local.turnos.reduce((acc, t) => acc + (t.promotores||[]).length, 0);
        const label = isOcc && totalProms > 0
          ? local.turnos.find(t => t.promotores && t.promotores.length)?.promotores[0]?.nome.split(' ').map(w=>w[0]).join('').substring(0,2) || '&#9679;'
          : '&#9679;';

        const icon = L.divIcon({
          className:'',
          html: '<div style="text-align:center">' +
            '<div style="width:' + (isOcc?'38':'32') + 'px;height:' + (isOcc?'38':'32') + 'px;border-radius:50%;background:' + cor + ';border:2px solid rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#000;box-shadow:0 2px 8px rgba(0,0,0,.4);margin:0 auto">' +
            label + '</div>' +
            '<div style="font-size:9px;font-weight:700;color:#fff;text-shadow:0 1px 3px #000;margin-top:2px;white-space:nowrap;max-width:80px;overflow:hidden;text-overflow:ellipsis;margin:2px auto 0">' +
            esc(local.nome||'') + '</div>' +
            '</div>',
          iconSize:[80,52], iconAnchor:[40,22]
        });

        // Popup com todos os turnos do local
        const turnosHtml = local.turnos.map(t => {
          const statusCor = { OCUPADO:'#00FF87', DISPONIVEL:'#3B9EFF', ENCERRADO:'#888', DISPONIVEL:'#3B9EFF' };
          const cor2 = statusCor[t.status_geral] || '#888';
          const proms = t.promotores && t.promotores.length
            ? t.promotores.map(p => p.nome).join(', ')
            : '<span style="color:#888">Sem promotor</span>';
          return '<div style="border-top:1px solid #333;padding:6px 0;margin-top:4px">' +
            '<span style="color:' + cor2 + ';font-weight:700;font-size:11px">' + (t.status_geral||'?') + '</span>' +
            ' &nbsp;<span style="color:#aaa;font-size:11px">' + (t.inicio_slot||'?') + ' - ' + (t.fim_slot||'?') + '</span>' +
            '<br><span style="font-size:11px">' + proms + '</span>' +
            '<br><span style="color:#666;font-size:10px">Vagas: ' + (t.vagas_ocupadas||0) + '/' + (t.max_promotores||1) + '</span>' +
            '</div>';
        }).join('');

        const popup = '<div style="font-family:sans-serif;min-width:180px">' +
          '<b style="font-size:13px">' + esc(local.nome) + '</b>' +
          '<br><span style="color:#aaa;font-size:11px">&#128205; ' + esc(local.cidade||'') + '</span>' +
          turnosHtml + '</div>';

        const m = L.marker([local.lat, local.lng], {icon}).addTo(_mapObj);
        m.bindPopup(popup, { maxWidth: 260 });
        _mapMarkers.push(m);
      });

      // Pins de PROMOTORES com GPS real (posicao atual)
      let comGps = 0;
      ativos.forEach(p => {
        if (!p.lat || !p.lng) return;
        comGps++;
        const icon = L.divIcon({
          className:'',
          html:'<div style="width:24px;height:24px;border-radius:50%;background:#F5B700;border:2px solid #000;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#000">' + (p.nome||'?').charAt(0) + '</div>',
          iconSize:[24,24], iconAnchor:[12,12]
        });
        const ul = p.ultima_posicao ? new Date(p.ultima_posicao).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '—';
        const m = L.marker([p.lat,p.lng],{icon}).addTo(_mapObj);
        m.bindPopup('<b>' + esc(p.nome) + '</b> (GPS ao vivo)<br>' + esc(p.slot_nome||'—') + '<br>Ultima pos: ' + ul);
        _mapMarkers.push(m);
      });

      const statsEl = document.getElementById('g-map-stats');
      if (statsEl) statsEl.innerHTML =
        '<span class="g-map-stat"><strong style="color:var(--accent)">' + ativos.length + '</strong> ativos</span>' +
        '<span class="g-map-stat"><strong style="color:var(--blue)">' + slotsNoMapa + '</strong> slots</span>' +
        '<span class="g-map-stat"><strong style="color:var(--warn)">' + comGps + '</strong> com GPS</span>';

      if (_mapMarkers.length) _mapObj.fitBounds(L.featureGroup(_mapMarkers).getBounds().pad(.15));
      else _mapObj.setView([-23.55,-46.63], 12);
    } catch(e) { toast('Erro mapa: ' + e.message, 'error'); }
  }

  // ── SLOTS ─────────────────────────────────────────────────
  let _slotsDia = 'hoje';

  async function loadSlots() {
    setPage('slots', spinner());
    try {
      const hoje = new Date();
      const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
      const fmt = d => d.toISOString().split('T')[0];
      const dataParam = _slotsDia === 'amanha' ? fmt(amanha) : fmt(hoje);

      const res = await gGet('GET_SLOTS_HOJE', { data: dataParam });
      const slots = res.data || [];
      const cities = [...new Set(slots.map(s => s.cidade).filter(Boolean))].sort();

      const diaHtml = '<div class="g-filter-row" id="g-slots-dia" style="margin-bottom:8px">' +
        '<button class="g-filter-tag' + (_slotsDia==='hoje'?' active':'') + '" data-dia="hoje">Hoje</button>' +
        '<button class="g-filter-tag' + (_slotsDia==='amanha'?' active':'') + '" data-dia="amanha">Amanha (D+1)</button>' +
        '</div>';

      const filterHtml = '<div class="g-filter-row" id="g-slot-filters">' +
        ['all', ...cities].map(c =>
          '<button class="g-filter-tag' + (_slotFilter === c ? ' active' : '') + '" data-city="' + esc(c) + '">' +
          (c === 'all' ? 'Todas cidades' : esc(c)) + '</button>'
        ).join('') + '</div>';

      const statsHtml = '<div style="font-size:11px;color:var(--text3);font-family:var(--mono);margin-bottom:10px">' +
        slots.length + ' slots &nbsp;|&nbsp; ' +
        slots.filter(s=>s.status_geral==='OCUPADO').length + ' ocupados &nbsp;|&nbsp; ' +
        slots.filter(s=>s.status_geral==='DISPONIVEL').length + ' disponiveis' +
        (slots.filter(s=>s.status_geral==='ENCERRADO').length ? ' &nbsp;|&nbsp; ' + slots.filter(s=>s.status_geral==='ENCERRADO').length + ' encerrados' : '') +
        '</div>';

      setPage('slots', diaHtml + filterHtml + statsHtml + '<div id="g-slot-grid">' + renderSlotsGrid(slots, _slotFilter) + '</div>');

      document.querySelectorAll('#g-slots-dia .g-filter-tag').forEach(btn => {
        btn.addEventListener('click', () => {
          _slotsDia = btn.dataset.dia;
          loadSlots();
        });
      });

      document.querySelectorAll('#g-slot-filters .g-filter-tag').forEach(btn => {
        btn.addEventListener('click', () => {
          _slotFilter = btn.dataset.city;
          document.querySelectorAll('#g-slot-filters .g-filter-tag').forEach(b => b.classList.toggle('active', b.dataset.city === _slotFilter));
          const grid = document.getElementById('g-slot-grid');
          if (grid) grid.innerHTML = renderSlotsGrid(slots, _slotFilter);
        });
      });
    } catch(e) { setPage('slots', empty('&#9888;', e.message)); }
  }

  function renderSlotsGrid(slots, filter) {
    const filtered = filter === 'all' ? slots : slots.filter(s => s.cidade === filter);
    if (!filtered.length) return empty('&#128205;','Nenhum slot encontrado');
    const sc = { EM_ATIVIDADE:'#00FF87', ACEITO:'#3B9EFF', PAUSADO:'#F5B700' };
    return '<div class="g-slot-grid">' + filtered.map(s => {
      const vagas = s.max_promotores - s.vagas_ocupadas;
      const isOcc = s.status_geral === 'OCUPADO';
      const isProb = s.problemas && s.problemas.length;
      const statusBdg = isOcc ? badge('green','&#9679; Ocupado') :
        s.status_geral === 'ENCERRADO' ? badge('gray','Encerrado') :
        badge('warn','Disponivel (' + vagas + ' vaga' + (vagas!==1?'s':'') + ')');
      const proms = s.promotores.map(p => {
        const ini = (p.nome||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
        const cor = sc[p.status]||'#555';
        return '<div class="g-prom-row"><div class="g-prom-av" style="border-color:' + cor + ';color:' + cor + '">' + ini + '</div>' +
          '<span class="g-prom-name">' + esc(p.nome) + '</span>' + badge('gray',p.status||'?') + '</div>';
      }).join('');
      const probHtml = isProb ? '<div class="g-prob-row">' + s.problemas.map(p => badge('danger',esc(p))).join(' ') + '</div>' : '';
      return '<div class="g-slot-card' + (isOcc?' occupied':'') + (isProb?' problem':'') + '">' +
        '<div class="g-slot-header"><span class="g-slot-name">' + esc(s.nome) + '</span>' + statusBdg + '</div>' +
        '<div class="g-slot-time">&#128336; ' + esc(s.inicio_slot||'?') + ' - ' + esc(s.fim_slot||'?') +
        (s.cidade ? ' &nbsp;&#128205; ' + esc(s.cidade) : '') + '</div>' +
        probHtml +
        (s.promotores.length ? '<div class="g-prom-list">' + proms + '</div>' : '') +
        '</div>';
    }).join('') + '</div>';
  }

  // ── SOLICITACOES ──────────────────────────────────────────
  async function loadSolicitacoes() {
    setPage('solicitacoes', spinner());
    try {
      const res = await gGet('GET_SOLICITACOES_ABERTAS');
      _solData = res.data || res.solicitacoes || [];
      const badge_sol = document.getElementById('badge-sol');
      if (badge_sol) { badge_sol.textContent = _solData.length; badge_sol.style.display = _solData.length ? '' : 'none'; }

      const filters = ['all','REFORCO_PATINETES','TROCA_BATERIA','REALOCACAO','OCORRENCIA'];
      const flabels = { all:'Todas', REFORCO_PATINETES:'Reforco', TROCA_BATERIA:'Bateria', REALOCACAO:'Realocacao', OCORRENCIA:'Ocorrencia' };
      const filterHtml = '<div class="g-filter-row" id="g-sol-filters">' +
        filters.map(f => '<button class="g-filter-tag' + (_solFilter===f?' active':'') + '" data-filter="' + f + '">' + flabels[f] + '</button>').join('') + '</div>';

      setPage('solicitacoes', filterHtml + '<div id="g-sol-list">' + renderSolList(_solData, _solFilter) + '</div>');

      document.querySelectorAll('#g-sol-filters .g-filter-tag').forEach(btn => {
        btn.addEventListener('click', () => {
          _solFilter = btn.dataset.filter;
          document.querySelectorAll('#g-sol-filters .g-filter-tag').forEach(b => b.classList.toggle('active', b.dataset.filter === _solFilter));
          const list = document.getElementById('g-sol-list');
          if (list) list.innerHTML = renderSolList(_solData, _solFilter);
        });
      });
    } catch(e) { setPage('solicitacoes', empty('&#9888;', e.message)); }
  }

  function renderSolList(data, filter) {
    const filtered = filter === 'all' ? data : data.filter(s => s.tipo === filter);
    if (!filtered.length) return empty('&#10003;','Nenhuma solicitacao aberta');
    const tcls = { REFORCO_PATINETES:'green', TROCA_BATERIA:'blue', REALOCACAO:'blue', OCORRENCIA:'warn', SOS:'danger' };
    const tlbl = { REFORCO_PATINETES:'Reforco de Patinetes', TROCA_BATERIA:'Troca de Bateria', REALOCACAO:'Realocacao', OCORRENCIA:'Ocorrencia', SOS:'SOS Emergencia' };
    return filtered.map(s => {
      const sid = esc(s.solicitacao_id || s.id || '');
      const tit = esc((tlbl[s.tipo]||s.tipo||'?') + ' — ' + (s.promotor_nome||s.user_id||''));
      return '<div class="g-sol-card' + (s.tipo==='SOS'?' urgent':'') + '">' +
        '<div class="g-sol-header">' +
          '<div>' + badge(tcls[s.tipo]||'gray', tlbl[s.tipo]||s.tipo||'?') + ' <span class="g-sol-who">' + esc(s.promotor_nome||s.user_id||'—') + '</span></div>' +
          '<span class="g-sol-time">' + ago(s.criado_em) + '</span>' +
        '</div>' +
        '<div class="g-sol-desc">' + esc(s.descricao||s.observacao||s.mensagem||'(Sem descricao)') + '</div>' +
        '<div class="g-sol-meta">' + badge('gray','&#128205; ' + esc(s.cidade||'—')) + (s.slot_nome ? ' ' + badge('gray',esc(s.slot_nome)) : '') + '</div>' +
        '<div class="g-sol-actions"><button class="g-btn g-btn-primary g-btn-sm" data-id="' + sid + '" data-title="' + tit + '" onclick="gestor._openSolModal(this.dataset.id,this.dataset.title)">Responder</button></div>' +
        '</div>';
    }).join('');
  }

  function _openSolModal(id, title) {
    _activeSolId = id;
    document.getElementById('g-modal-sol-title').textContent = 'Responder: ' + title;
    document.getElementById('g-modal-sol-desc').textContent  = 'ID: ' + id;
    document.getElementById('g-modal-sol-obs').value = '';
    openModal('g-modal-sol');
  }

  async function confirmSol() {
    const status = document.getElementById('g-modal-sol-status').value;
    const obs    = document.getElementById('g-modal-sol-obs').value;
    const btn    = document.getElementById('g-modal-sol-confirm');
    btn.disabled = true;
    try {
      const res = await gPost('RESPONDER_SOLICITACAO', { solicitacao_id: _activeSolId, status, observacao: obs });
      if (res.ok) { toast('Solicitacao respondida!','success'); closeModal('g-modal-sol'); loadSolicitacoes(); }
      else toast(res.mensagem || res.erro || 'Erro','error');
    } catch(e) { toast('Erro: ' + e.message,'error'); }
    btn.disabled = false;
  }

  // ── PROMOTORES ────────────────────────────────────────────
  async function loadPromotores() {
    setPage('promotores',
      '<input type="search" id="g-prom-search" class="g-search" placeholder="Buscar por nome..."/>' +
      '<div id="g-prom-table">' + spinner() + '</div>'
    );
    document.getElementById('g-prom-search').addEventListener('input', e => {
      const tbl = document.getElementById('g-prom-table');
      if (tbl) tbl.innerHTML = renderPromTable(_promData, e.target.value);
    });
    try {
      const res = await gGet('GET_PROMOTORES_LISTA');
      _promData = res.data || res.promotores || [];
      const tbl = document.getElementById('g-prom-table');
      if (tbl) tbl.innerHTML = renderPromTable(_promData, '');
    } catch(e) {
      const tbl = document.getElementById('g-prom-table');
      if (tbl) tbl.innerHTML = empty('&#9888;', e.message);
    }
  }

  function renderPromTable(data, search) {
    const filtered = search ? data.filter(p => (p.nome_completo||p.nome||'').toLowerCase().includes(search.toLowerCase())) : data;
    if (!filtered.length) return empty('&#128100;','Nenhum resultado');
    const vcls = { CLT:'blue', FISCAL:'purple', MEI:'gray' };
    return '<div class="g-table-wrap"><table><thead><tr><th>Nome</th><th>Tipo</th><th>Cidade</th><th>Score</th><th>Status</th></tr></thead><tbody>' +
      filtered.map(p => {
        const v = (p.tipo_vinculo||'MEI').toUpperCase();
        const sc = (p.status||'').toUpperCase() === 'ATIVO' ? 'green' : 'gray';
        return '<tr><td class="g-bold">' + esc(p.nome_completo||p.nome||'—') + '</td>' +
          '<td>' + badge(vcls[v]||'gray',v) + '</td>' +
          '<td>' + esc(p.cidade_base||p.cidade||'—') + '</td>' +
          '<td class="g-mono g-accent">' + (p.score_operacional||p.score||'—') + '</td>' +
          '<td>' + badge(sc, p.status||'—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  // ── CLT ───────────────────────────────────────────────────
  function initCltDate() {
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    _cltDate = d.toISOString().split('T')[0];
  }

  async function loadClt() {
    if (!_cltDate) initCltDate();
    setPage('clt',
      '<div class="g-filter-row"><input type="date" id="g-clt-date" class="g-date-input" value="' + _cltDate + '"/></div>' +
      '<div id="g-clt-list">' + spinner() + '</div>'
    );
    document.getElementById('g-clt-date').addEventListener('change', e => { _cltDate = e.target.value; fetchClt(); });
    fetchClt();
  }

  async function fetchClt() {
    const list = document.getElementById('g-clt-list');
    if (!list) return;
    list.innerHTML = spinner();
    try {
      const res = await gGet('GET_HISTORICO_TURNOS_CLT_GESTOR', { data: _cltDate });
      const turnos = res.data || res.turnos || [];
      if (!turnos.length) { list.innerHTML = empty('&#128197;','Nenhum turno neste dia'); return; }
      const scls = { EM_ANDAMENTO:'green', CONFIRMADO:'blue', PAUSADO:'warn', CONCLUIDO:'gray', FALTA:'danger' };
      list.innerHTML = turnos.map(t => {
        const ini = t.checkin_hora  ? new Date(t.checkin_hora).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})  : t.inicio_previsto||'—';
        const fim = t.checkout_hora ? new Date(t.checkout_hora).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : t.fim_previsto||'—';
        return '<div class="g-turno-card">' +
          '<div class="g-turno-time"><div class="g-turno-val">' + ini + '</div><div class="g-turno-lbl">Entrada</div></div>' +
          '<div class="g-turno-time"><div class="g-turno-val">' + fim + '</div><div class="g-turno-lbl">Saida</div></div>' +
          '<div class="g-turno-info"><div class="g-bold">' + esc(t.nome_completo||t.user_id||'?') + '</div><div class="g-sub">' + esc(t.cargo_clt||t.zona_nome||'—') + '</div></div>' +
          badge(scls[t.status]||'gray', t.status||'?') + '</div>';
      }).join('');
    } catch(e) { list.innerHTML = empty('&#9888;', e.message); }
  }

  // ── RANKING ───────────────────────────────────────────────
  async function loadRanking() {
    const filterHtml = '<div class="g-filter-row" id="g-rank-filters">' +
      ['SEMANAL','MENSAL'].map(p => '<button class="g-filter-tag' + (_rankingPeriodo===p?' active':'') + '" data-periodo="' + p + '">' + p.charAt(0) + p.slice(1).toLowerCase() + '</button>').join('') + '</div>' +
      '<div id="g-rank-list">' + spinner() + '</div>';
    setPage('ranking', filterHtml);
    document.querySelectorAll('#g-rank-filters .g-filter-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        _rankingPeriodo = btn.dataset.periodo;
        document.querySelectorAll('#g-rank-filters .g-filter-tag').forEach(b => b.classList.toggle('active', b.dataset.periodo === _rankingPeriodo));
        fetchRanking();
      });
    });
    fetchRanking();
  }

  async function fetchRanking() {
    const list = document.getElementById('g-rank-list');
    if (!list) return;
    list.innerHTML = spinner();
    try {
      const res = await gGet('GET_RANKING_SEMANAL', { periodo: _rankingPeriodo });
      const ranking = res.ranking || res.data || [];
      if (!ranking.length) { list.innerHTML = empty('&#9733;','Sem dados de ranking'); return; }
      const pCls = ['gold','silver','bronze'];
      list.innerHTML = '<div class="g-rank-list">' + ranking.slice(0,30).map((p,i) =>
        '<div class="g-rank-item' + (i<3?' top3':'') + '">' +
          '<div class="g-rank-pos ' + (pCls[i]||'') + '">' + (i+1) + '</div>' +
          '<div class="g-rank-name">' + esc(p.nome||p.nome_completo||p.user_id||'?') + '</div>' +
          '<div class="g-rank-score">' + (p.score_total||p.score||p.pontos||0) + ' pts</div>' +
        '</div>'
      ).join('') + '</div>';
    } catch(e) { list.innerHTML = empty('&#9888;', e.message); }
  }

  // ── BROADCAST ─────────────────────────────────────────────
  async function loadBroadcast() {
    setPage('broadcast',
      '<div class="g-card" style="margin-bottom:14px">' +
        '<div class="g-card-title">Filtros</div>' +
        '<div class="g-filter-row" id="g-bc-vinculo">' +
          ['all','MEI','CLT','FISCAL'].map(v => '<span class="g-filter-tag' + (_bcVinculo===v?' active':'') + '" data-val="' + v + '">' + (v==='all'?'Todos':v) + '</span>').join('') +
        '</div>' +
        '<div class="g-filter-row" id="g-bc-cidade"><span class="g-filter-tag active" data-val="all">Todas</span></div>' +
        '<div class="g-bc-info">Destinatarios: <strong id="g-bc-dest">?</strong></div>' +
      '</div>' +
      '<div class="g-card">' +
        '<div class="g-card-title">Mensagem</div>' +
        '<div class="g-field"><label>Texto (HTML basico permitido)</label>' +
          '<textarea class="g-textarea" id="g-bc-texto" rows="5" placeholder="Digite sua mensagem..."></textarea>' +
          '<div class="g-bc-counter"><span id="g-bc-chars">0</span>/4000</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end">' +
          '<button class="g-btn g-btn-ghost" id="g-bc-preview">Pre-visualizar</button>' +
          '<button class="g-btn g-btn-primary" id="g-bc-send">Enviar Broadcast</button>' +
        '</div>' +
      '</div>'
    );

    document.querySelectorAll('#g-bc-vinculo .g-filter-tag').forEach(el => {
      el.addEventListener('click', () => {
        _bcVinculo = el.dataset.val;
        document.querySelectorAll('#g-bc-vinculo .g-filter-tag').forEach(b => b.classList.toggle('active', b.dataset.val === _bcVinculo));
      });
    });

    document.getElementById('g-bc-texto').addEventListener('input', e => {
      const el = document.getElementById('g-bc-chars');
      if (el) el.textContent = e.target.value.length;
    });

    document.getElementById('g-bc-send').addEventListener('click', sendBroadcast);
    document.getElementById('g-bc-preview').addEventListener('click', () => {
      const txt = document.getElementById('g-bc-texto').value.trim();
      if (!txt) { toast('Digite uma mensagem primeiro','warn'); return; }
      if (confirm('Pre-visualizacao:\n\n' + txt.replace(/<[^>]+>/g,'') + '\n\nEnviar para todos?')) sendBroadcast();
    });

    if (!_broadcastFilters) {
      try {
        const res = await gGet('GET_BROADCAST_FILTERS');
        _broadcastFilters = res;
        const cidades = res.cidades || [];
        const fcEl = document.getElementById('g-bc-cidade');
        if (fcEl) {
          fcEl.innerHTML = '<span class="g-filter-tag active" data-val="all">Todas</span>' +
            cidades.map(c => '<span class="g-filter-tag" data-val="' + esc(c) + '">' + esc(c) + '</span>').join('');
          fcEl.querySelectorAll('.g-filter-tag').forEach(el => {
            el.addEventListener('click', () => {
              _bcCidade = el.dataset.val;
              fcEl.querySelectorAll('.g-filter-tag').forEach(b => b.classList.toggle('active', b.dataset.val === _bcCidade));
            });
          });
        }
        const dest = document.getElementById('g-bc-dest');
        if (dest) dest.textContent = res.total_promotores || '?';
      } catch(_) {}
    }
  }

  async function sendBroadcast() {
    const texto = (document.getElementById('g-bc-texto').value || '').trim();
    if (!texto) { toast('Digite uma mensagem','warn'); return; }
    const btn = document.getElementById('g-bc-send');
    if (btn) btn.disabled = true;
    try {
      const res = await gPost('BROADCAST_PROMOTORES', {
        texto,
        tipo_vinculo: _bcVinculo === 'all' ? null : _bcVinculo,
        cidade: _bcCidade === 'all' ? null : _bcCidade
      });
      if (res.ok) {
        toast('Broadcast enviado! (' + (res.enviados||'?') + ' dest.)','success');
        const ta = document.getElementById('g-bc-texto');
        if (ta) ta.value = '';
      } else toast(res.mensagem || res.erro || 'Erro','error');
    } catch(e) { toast('Erro: ' + e.message,'error'); }
    if (btn) btn.disabled = false;
  }

  // ── CADASTROS ─────────────────────────────────────────────
  async function loadCadastros() {
    setPage('cadastros', spinner());
    try {
      const res = await gGet('GET_CADASTROS_PENDENTES');
      const cads = res.data || res.cadastros || [];
      const badgeCad = document.getElementById('badge-cad');
      if (badgeCad) { badgeCad.textContent = cads.length; badgeCad.style.display = cads.length ? '' : 'none'; }
      if (!cads.length) { setPage('cadastros', empty('&#10003;','Nenhum cadastro pendente')); return; }
      setPage('cadastros', cads.map(c => {
        const id = esc(c.id || c.pre_cadastro_id || '');
        const nome = esc(c.nome_completo || c.nome || 'Novo Promotor');
        return '<div class="g-sol-card" style="margin-bottom:10px">' +
          '<div class="g-sol-header"><div class="g-bold">' + nome + '</div><span class="g-sol-time">' + ago(c.criado_em||c.created_at) + '</span></div>' +
          '<div class="g-sol-meta">' + badge('blue', esc(c.cargo||c.cargo_principal||'?')) + ' ' + badge('gray','&#128205; ' + esc(c.cidade||'?')) + (c.telegram_nome ? ' ' + badge('gray','@'+esc(c.telegram_nome)) : '') + '</div>' +
          '<div class="g-sol-actions">' +
            '<button class="g-btn g-btn-danger g-btn-sm" data-id="' + id + '" data-nome="rejeitar" onclick="gestor._openCadModal(this.dataset.id,this.dataset.nome)">Rejeitar</button>' +
            '<button class="g-btn g-btn-primary g-btn-sm" data-id="' + id + '" data-nome="' + nome + '" onclick="gestor._openCadModal(this.dataset.id,this.dataset.nome)">Aprovar</button>' +
          '</div>' +
        '</div>';
      }).join(''));
    } catch(e) { setPage('cadastros', empty('&#9888;', e.message)); }
  }

  function _openCadModal(id, nome) {
    _activeCadId = id;
    document.getElementById('g-modal-cad-desc').textContent = (nome === 'rejeitar' ? 'Rejeitar ID: ' : nome + ' — ID: ') + id;
    openModal('g-modal-cad');
  }

  async function confirmCad(acao) {
    const vinculo = document.getElementById('g-modal-cad-vinculo').value;
    const btn = acao === 'APROVADO' ? document.getElementById('g-modal-cad-approve') : document.getElementById('g-modal-cad-reject');
    if (btn) btn.disabled = true;
    try {
      const body = acao === 'APROVADO'
        ? { id: _activeCadId, tipo_vinculo: vinculo, status: 'APROVADO' }
        : { id: _activeCadId, status: 'REJEITADO' };
      const res = await gPost('APROVAR_CADASTRO', body);
      if (res.ok) { toast(acao === 'APROVADO' ? 'Cadastro aprovado!' : 'Cadastro rejeitado.', acao==='APROVADO'?'success':'info'); closeModal('g-modal-cad'); loadCadastros(); }
      else toast(res.mensagem || res.erro || 'Erro','error');
    } catch(e) { toast('Erro: ' + e.message,'error'); }
    if (btn) btn.disabled = false;
  }

  // ── CSS INJECTION ─────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('g-styles')) return;
    const s = document.createElement('style');
    s.id = 'g-styles';
    s.textContent = `
:root{--accent:#00FF87;--accent-dim:rgba(0,255,135,.1);--blue:#3B9EFF;--blue-dim:rgba(59,158,255,.1);--warn:#F5B700;--warn-dim:rgba(245,183,0,.1);--danger:#FF3B5C;--danger-dim:rgba(255,59,92,.1);--purple:#A78BFA;--purple-dim:rgba(167,139,250,.1);--bg:#0A0A0A;--bg2:#111;--surface:#161616;--surface2:#1C1C1C;--surface3:#242424;--border:#2C2C2C;--border2:#383838;--text:#EFEFEF;--text2:#A0A0A0;--text3:#555;--font:'Syne',sans-serif;--mono:'JetBrains Mono',monospace}
#app{display:flex;height:100vh;overflow:hidden;background:var(--bg);color:var(--text);font-family:var(--font)}
.g-sidebar{width:240px;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;transition:transform .25s;z-index:100}
.g-sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99}
.g-sidebar-overlay.open{display:block}
.g-sidebar-logo{padding:20px 18px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border)}
.g-logo-mark{width:32px;height:32px;background:var(--accent);border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#000;flex-shrink:0}
.g-logo-name{font-weight:700;font-size:14px;color:var(--text);line-height:1.2}
.g-logo-sub{font-size:10px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.05em}
.g-sidebar-user{padding:12px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px}
.g-avatar{width:34px;height:34px;border-radius:50%;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:var(--accent);flex-shrink:0;border:1px solid var(--border2)}
.g-user-name{font-size:13px;font-weight:600;color:var(--text)}
.g-user-role{font-size:10px;color:var(--text3);font-family:var(--mono)}
.g-nav-section{padding:12px 10px 4px}
.g-nav-label{font-size:9px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.1em;color:var(--text3);padding:0 8px;margin-bottom:4px}
.g-nav-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;color:var(--text2);transition:all .15s;border:none;background:none;width:100%;text-align:left;font-family:var(--font)}
.g-nav-item:hover{background:var(--surface2);color:var(--text)}
.g-nav-item.active{background:var(--accent-dim);color:var(--accent)}
.g-ni{width:18px;text-align:center;font-size:16px;flex-shrink:0}
.g-nav-badge{margin-left:auto;background:var(--danger);color:#fff;font-size:9px;font-family:var(--mono);font-weight:700;padding:2px 6px;border-radius:99px;min-width:18px;text-align:center}
.g-nav-badge.warn{background:var(--warn);color:#000}
.g-sidebar-footer{margin-top:auto;padding:12px;border-top:1px solid var(--border)}
.g-logout-btn{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;color:var(--text3);background:none;border:none;width:100%;transition:all .15s;font-family:var(--font)}
.g-logout-btn:hover{color:var(--danger);background:var(--danger-dim)}
.g-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.g-header{height:56px;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 20px;gap:12px;flex-shrink:0}
.g-menu-btn{display:none;background:none;border:none;color:var(--text2);cursor:pointer;padding:4px;border-radius:6px;font-size:18px}
.g-menu-btn:hover{color:var(--text);background:var(--surface2)}
.g-header-title{font-size:15px;font-weight:700;color:var(--text)}
.g-header-sub{font-size:11px;color:var(--text3);font-family:var(--mono)}
.g-header-actions{margin-left:auto;display:flex;align-items:center;gap:8px}
.g-pill{display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:99px;border:1px solid var(--border);background:var(--surface);font-size:11px;font-family:var(--mono);color:var(--text2)}
.g-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:g-pulse 2s infinite}
@keyframes g-pulse{0%,100%{opacity:1}50%{opacity:.3}}
.g-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:none;transition:all .15s;font-family:var(--font)}
.g-btn-primary{background:var(--accent);color:#000}
.g-btn-primary:hover{background:#00e67a}
.g-btn-primary:disabled{opacity:.5;cursor:not-allowed}
.g-btn-ghost{background:none;border:1px solid var(--border);color:var(--text2)}
.g-btn-ghost:hover{border-color:var(--border2);color:var(--text);background:var(--surface2)}
.g-btn-danger{background:var(--danger-dim);border:1px solid var(--danger);color:var(--danger)}
.g-btn-danger:hover{background:var(--danger);color:#fff}
.g-btn-sm{font-size:11px;padding:5px 10px}
.g-content{flex:1;overflow-y:auto;overflow-x:hidden}
.g-page{padding:20px;display:none}
.g-page.active{display:block}
.g-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px}
.g-kpi-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;transition:border .15s}
.g-kpi-card:hover{border-color:var(--border2)}
.g-kpi-label{font-size:10px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.07em;color:var(--text3);margin-bottom:6px}
.g-kpi-value{font-size:28px;font-weight:800;line-height:1;font-family:var(--mono);color:var(--text)}
.g-kpi-value.green{color:var(--accent)}.g-kpi-value.blue{color:var(--blue)}.g-kpi-value.warn{color:var(--warn)}.g-kpi-value.danger{color:var(--danger)}
.g-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px}
.g-card-title{font-size:11px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--text3);margin-bottom:12px}
.g-table-wrap{overflow-x:auto;border-radius:10px;border:1px solid var(--border)}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:var(--surface2);padding:10px 12px;text-align:left;font-size:9px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--text3);font-weight:400;white-space:nowrap}
td{padding:10px 12px;border-top:1px solid var(--border);color:var(--text2);vertical-align:middle}
tr:hover td{background:var(--surface2)}
.g-bold{font-weight:600;color:var(--text)!important}
.g-mono{font-family:var(--mono)}
.g-accent{color:var(--accent)!important}
.g-sub{font-size:11px;color:var(--text3)}
.g-badge{display:inline-flex;align-items:center;padding:3px 8px;border-radius:99px;font-size:10px;font-family:var(--mono);font-weight:700;white-space:nowrap}
.g-badge-green{background:rgba(0,255,135,.12);color:var(--accent)}
.g-badge-blue{background:var(--blue-dim);color:var(--blue)}
.g-badge-warn{background:var(--warn-dim);color:var(--warn)}
.g-badge-danger{background:var(--danger-dim);color:var(--danger)}
.g-badge-gray{background:var(--surface3);color:var(--text3)}
.g-badge-purple{background:var(--purple-dim);color:var(--purple)}
.g-loading{display:flex;align-items:center;justify-content:center;padding:60px 20px}
.g-spinner{width:32px;height:32px;border:2px solid var(--border2);border-top-color:var(--accent);border-radius:50%;animation:g-spin .7s linear infinite}
@keyframes g-spin{to{transform:rotate(360deg)}}
.g-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:8px}
.g-empty-icon{font-size:32px;opacity:.4}
.g-empty-msg{font-size:14px;color:var(--text3)}
.g-filter-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.g-filter-tag{padding:5px 10px;border-radius:99px;border:1px solid var(--border);font-size:11px;cursor:pointer;color:var(--text2);transition:all .15s;background:none;font-family:var(--font)}
.g-filter-tag:hover{border-color:var(--border2);color:var(--text)}
.g-filter-tag.active{border-color:var(--blue);color:var(--blue);background:var(--blue-dim)}
.g-sol-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;transition:border .15s}
.g-sol-card.urgent{border-color:var(--danger)}
.g-sol-header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px}
.g-sol-who{font-size:12px;font-weight:600;color:var(--text);margin-left:6px}
.g-sol-time{font-size:10px;font-family:var(--mono);color:var(--text3);white-space:nowrap}
.g-sol-desc{font-size:12px;color:var(--text2);margin-bottom:10px;line-height:1.5}
.g-sol-meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.g-sol-actions{display:flex;gap:8px;padding-top:10px;border-top:1px solid var(--border)}
.g-slot-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px}
.g-slot-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;transition:all .15s}
.g-slot-card:hover{border-color:var(--border2);transform:translateY(-1px)}
.g-slot-card.occupied{border-color:rgba(0,255,135,.2)}
.g-slot-card.problem{border-color:rgba(255,59,92,.2)}
.g-slot-header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px}
.g-slot-name{font-size:14px;font-weight:700;color:var(--text)}
.g-slot-time{font-size:11px;font-family:var(--mono);color:var(--text3);margin-bottom:8px}
.g-prob-row{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px}
.g-prom-list{display:flex;flex-direction:column;gap:4px;margin-top:8px}
.g-prom-row{display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--surface2);border-radius:8px}
.g-prom-av{width:24px;height:24px;border-radius:50%;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;border:1.5px solid var(--border)}
.g-prom-name{flex:1;font-size:12px;font-weight:600;color:var(--text);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.g-search{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);font-family:var(--font);font-size:13px;width:220px;outline:none;margin-bottom:14px}
.g-search:focus{border-color:var(--accent)}
.g-turno-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:14px}
.g-turno-time{background:var(--surface2);border-radius:8px;padding:8px 12px;text-align:center;flex-shrink:0;min-width:64px}
.g-turno-val{font-size:14px;font-weight:700;font-family:var(--mono);color:var(--text)}
.g-turno-lbl{font-size:9px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.05em}
.g-turno-info{flex:1}
.g-rank-list{display:flex;flex-direction:column;gap:6px}
.g-rank-item{display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;transition:border .15s}
.g-rank-item:hover{border-color:var(--border2)}
.g-rank-item.top3{border-color:rgba(245,183,0,.3);background:linear-gradient(90deg,rgba(245,183,0,.04),transparent)}
.g-rank-pos{font-size:13px;font-weight:800;font-family:var(--mono);width:28px;text-align:center;color:var(--text3)}
.g-rank-pos.gold{color:#FFD700}.g-rank-pos.silver{color:#C0C0C0}.g-rank-pos.bronze{color:#CD7F32}
.g-rank-name{flex:1;font-size:13px;font-weight:600;color:var(--text)}
.g-rank-score{font-size:14px;font-weight:700;font-family:var(--mono);color:var(--accent)}
.g-bc-info{padding:10px 12px;background:var(--surface2);border-radius:8px;font-size:12px;color:var(--text3);margin-top:4px}
.g-bc-counter{font-size:11px;font-family:var(--mono);color:var(--text3);text-align:right;margin-top:4px}
.g-field{margin-bottom:14px}
.g-field label{display:block;font-size:11px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
.g-select,.g-textarea,.g-date-input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 14px;font-size:13px;color:var(--text);font-family:var(--font);outline:none}
.g-select:focus,.g-textarea:focus,.g-date-input:focus{border-color:var(--accent)}
.g-textarea{resize:vertical;min-height:80px}
.g-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:500;display:none;align-items:center;justify-content:center;padding:20px}
.g-modal-backdrop.open{display:flex}
.g-modal{background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:24px;width:100%;max-width:460px;position:relative}
.g-modal-title{font-size:16px;font-weight:700;margin-bottom:4px;color:var(--text)}
.g-modal-sub{font-size:12px;color:var(--text2);margin-bottom:18px}
.g-modal-close{position:absolute;top:16px;right:16px;background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px;padding:4px;border-radius:6px}
.g-modal-close:hover{color:var(--text);background:var(--surface2)}
.g-modal-footer{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
.g-map-stats{position:absolute;bottom:12px;left:12px;z-index:1000;background:rgba(10,10,10,.9);border:1px solid var(--border);border-radius:10px;padding:10px 16px;display:flex;gap:16px;font-size:12px;font-family:var(--mono)}
.g-map-stat{color:var(--text3)}
.g-toast-container{position:fixed;bottom:20px;right:20px;z-index:9000;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.g-toast{padding:12px 16px;border-radius:10px;font-size:13px;font-weight:600;max-width:300px;animation:g-toastIn .2s ease;pointer-events:auto;font-family:var(--font)}
.g-toast-success{background:var(--accent);color:#000}
.g-toast-error{background:var(--danger);color:#fff}
.g-toast-info{background:var(--surface3);border:1px solid var(--border2);color:var(--text)}
.g-toast-warn{background:var(--warn);color:#000}
.g-toast.out{animation:g-toastOut .2s ease forwards}
@keyframes g-toastIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes g-toastOut{to{transform:translateX(20px);opacity:0}}
@media(max-width:768px){
  .g-sidebar{position:fixed;top:0;left:0;height:100%;transform:translateX(-100%)}
  .g-sidebar.open{transform:translateX(0)}
  .g-menu-btn{display:flex;align-items:center;justify-content:center;width:36px;height:36px}
  .g-page{padding:14px}
  .g-kpi-grid{grid-template-columns:repeat(2,1fr)}
}`;
    document.head.appendChild(s);
  }

  // ── PUBLIC API ────────────────────────────────────────────
  return {
    isGestorUser,
    init(user) {
      injectStyles();
      renderShell(user);
    },
    // Exposed for inline onclick handlers
    _openSolModal,
    _openCadModal,
  };

})();