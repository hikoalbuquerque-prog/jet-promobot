// ─── router.js ────────────────────────────────────────────────────────────────
// Roteador SPA do painel gestor

const router = (() => {
  let _current = null;
  const _history = [];

  // Telas registradas
  const _screens = {
    login:        { module: auth,              method: 'renderLogin', hasNav: false },
    dashboard:    { module: kpisScreen,        method: 'render',      hasNav: true,  navId: 'nav-kpis'    },
    mapa:         { module: mapaScreen,        method: 'render',      hasNav: true,  navId: 'nav-mapa'    },
    solicitacoes: { module: solicitacoesScreen, method: 'render',     hasNav: true,  navId: 'nav-sol'     },
    slots:        { module: slotsScreen,       method: 'render',      hasNav: true,  navId: 'nav-slots'   },
    escala:       { module: escalaScreen,      method: 'render',      hasNav: true,  navId: 'nav-escala'  },
    escalaCLT:    { module: escalaCLTScreen,   method: 'render',      hasNav: true,  navId: 'nav-escala-clt' },
    historicoCLT: { module: historicoCLTScreen, method: 'render',     hasNav: true,  navId: 'nav-hist-clt' },
    historicoMEI: { module: historicoMEIScreen,  method: 'render',     hasNav: true,  navId: 'nav-hist-mei' },
    cadastros:    { module: cadastrosScreen,     method: 'render',     hasNav: true,  navId: 'nav-cadastros' },
    broadcast:    { module: broadcast,           method: 'render',     hasNav: true,  navId: 'nav-broadcast' },
  };

  const _FISCAL_ALLOWED = ['mapa', 'slots'];

  let _alertInterval = null;

  function checkAlerts() {
    if (!state.get('gestor')) return;
    Promise.all([
      api.get('GET_CADASTROS_PENDENTES').catch(()=>({cadastros:[]})),
      api.get('GET_SOLICITACOES_ABERTAS').catch(()=>({solicitacoes:[]}))
    ]).then(([resCad, resSol]) => {
      const cads = resCad.cadastros ? resCad.cadastros.length : 0;
      const sols = resSol.solicitacoes ? resSol.solicitacoes.filter(s=>s.status==='ABERTA').length : 0;
      const total = cads + sols;
      
      const badge = document.getElementById('gestor-alert-count');
      const bCads = document.getElementById('alert-cadastros');
      const bSols = document.getElementById('alert-solicitacoes');
      
      if (badge) {
        badge.textContent = total;
        badge.style.display = total > 0 ? 'block' : 'none';
      }
      if (bCads) bCads.textContent = cads;
      if (bSols) bSols.textContent = sols;
    });
  }

  function _toggleAlertMenu() {
    const menu = document.getElementById('gestor-alert-menu');
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  }

  function navigate(screen, pushHistory = true) {
    if (_alertInterval === null && state.get('gestor')) {
      checkAlerts();
      _alertInterval = setInterval(checkAlerts, 60000);
    }
    const _cargoNav2 = state.get('gestor')?.cargo?.toUpperCase();
    if (_cargoNav2 === 'FISCAL' && screen !== 'login' && !_FISCAL_ALLOWED.includes(screen)) {
      screen = 'mapa';
    }
    if (_current) {
      const prev = _screens[_current];
      if (prev?.module?.destroy) prev.module.destroy();
      if (pushHistory) _history.push(_current);
    }

    _current = screen;
    const route = _screens[screen];
    if (!route) { console.error('[Router] Tela desconhecida:', screen); return; }

    // Telas sem nav (login): limpa o body inteiro
    if (!route.hasNav) {
      document.getElementById('app-shell')?.remove();
      route.module[route.method]();
      return;
    }

    // Guard: deve estar autenticado
    if (!state.isAuthenticated()) {
      navigate('login');
      return;
    }

    // Garante o shell
    _ensureShell();

    // Atualiza nav ativo
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(route.navId)?.classList.add('active');
    // Fiscal: ocultar itens de nav nao permitidos
    const _cargoNav = state.get('gestor')?.cargo?.toUpperCase();
    document.querySelectorAll('.nav-item[data-route]').forEach(btn => {
      const r = btn.getAttribute('data-route');
      if (_cargoNav === 'FISCAL') {
        btn.style.display = _FISCAL_ALLOWED.includes(r) ? '' : 'none';
      } else {
        btn.style.display = '';
      }
    });

    // Renderiza o conteúdo
    route.module[route.method]();
  }

  function back() {
    const prev = _history.pop();
    navigate(prev || 'dashboard', false);
  }

  // ── Shell do painel (navbar + #app) ─────────────────────────────────────────
  function _ensureShell() {
    if (document.getElementById('app-shell')) return;

    const gestor = state.get('gestor');
    const iniciais = (gestor?.nome || 'G').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

    document.body.style.cssText = `margin:0;padding:0;background:#0a0f1e;`;
    document.body.innerHTML = `
      <div id="app-shell" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;">

        <!-- Top bar -->
        <header style="
          display:flex; align-items:center; justify-content:space-between;
          padding:0 24px; height:56px; flex-shrink:0;
          background:#0d1526; border-bottom:1px solid rgba(99,179,237,0.15);
        ">
          <div style="display:flex;align-items:center;gap:12px;">
            <button id="btn-sidebar-toggle" style="background:none;border:1px solid rgba(99,179,237,0.3);color:#63b3ed;width:32px;height:32px;border-radius:4px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;" title="Menu">☰</button>
            <div style="font-size:11px;letter-spacing:3px;color:#63b3ed;font-family:'IBM Plex Mono',monospace;">
              JET PROMOBOT
            </div>
            <div style="width:1px;height:20px;background:rgba(255,255,255,0.1);"></div>
            <div style="font-size:12px;color:#718096;font-family:'IBM Plex Mono',monospace;">
              PAINEL DO GESTOR
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:12px;">
            <div id="gestor-alert-bell" style="position:relative;cursor:pointer;margin-right:10px" onclick="router._toggleAlertMenu()">
              <span style="font-size:20px">🔔</span>
              <span id="gestor-alert-count" style="display:none;position:absolute;top:-4px;right:-8px;background:#e53e3e;color:#fff;font-size:10px;font-weight:bold;padding:2px 5px;border-radius:10px;">0</span>
              <div id="gestor-alert-menu" style="display:none;position:absolute;top:32px;right:0;background:#16213e;border:1px solid #2a3a55;border-radius:8px;padding:8px;width:220px;box-shadow:0 4px 12px rgba(0,0,0,0.5);z-index:999;">
                 <div onclick="router.go('cadastros')" style="padding:10px;border-bottom:1px solid #2a3a55;font-size:13px;color:#e2e8f0;cursor:pointer">Cadastros Pendentes: <b id="alert-cadastros" style="color:#f6ad55">0</b></div>
                 <div onclick="router.go('solicitacoes')" style="padding:10px;font-size:13px;color:#e2e8f0;cursor:pointer">Solicitações Abertas: <b id="alert-solicitacoes" style="color:#63b3ed">0</b></div>
              </div>
            </div>
            <div style="
              font-size:12px;color:#a0aec0;
              font-family:'IBM Plex Mono',monospace;
            ">${gestor?.nome || ''}</div>
            <div style="
              width:32px;height:32px;border-radius:50%;
              background:#63b3ed20;border:1px solid #63b3ed40;
              display:flex;align-items:center;justify-content:center;
              font-size:11px;font-weight:700;color:#63b3ed;
              font-family:'IBM Plex Mono',monospace;
            ">${iniciais}</div>
            <button id="btn-logout" style="
              background:none;border:1px solid rgba(252,129,129,0.3);
              color:#fc8181;padding:4px 10px;border-radius:3px;
              font-size:11px;font-family:'IBM Plex Mono',monospace;
              cursor:pointer;letter-spacing:1px;
            ">SAIR</button>
          </div>
        </header>

        <!-- Nav lateral + conteúdo -->
        <div style="display:flex;flex:1;overflow:hidden;">

          <!-- Sidebar -->
          <nav style="
            width:200px;flex-shrink:0;background:#0d1526;
            border-right:1px solid rgba(99,179,237,0.1);
            padding:24px 0;display:flex;flex-direction:column;gap:4px;
          ">
            <button class="nav-item" id="nav-kpis"  data-route="dashboard">
              📊 Dashboard
            </button>
            <button class="nav-item" id="nav-mapa"  data-route="mapa">
              🗺️ Mapa
            </button>
            <button class="nav-item" id="nav-slots" data-route="slots">
              📍 Slots
            </button>
            <button class="nav-item" id="nav-sol"   data-route="solicitacoes">
              🔔 Solicitações
              <span id="badge-sol" class="nav-badge hidden"></span>
            </button>
            <button class="nav-item" id="nav-escala" data-route="escala">
              📅 Escala
            </button>
            <button class="nav-item" id="nav-escala-clt" data-route="escalaCLT">
              ⚙️ Escala CLT
            </button>
            <button class="nav-item" id="nav-hist-clt" data-route="historicoCLT">
              📋 Hist. CLT
            </button>
            <button class="nav-item" id="nav-hist-mei" data-route="historicoMEI">
              📋 Hist. MEI
            </button>
            <button class="nav-item" id="nav-cadastros" data-route="cadastros">
              🆔 Cadastros
            </button>
            <button class="nav-item" id="nav-broadcast" data-route="broadcast">
              📢 Broadcast
            </button>
          </nav>

          <!-- Área de conteúdo -->
          <main id="app" style="
            flex:1;overflow-y:auto;overflow-x:hidden;
            background:#0a0f1e;
          "></main>

        </div>
      </div>
    `;

    // Injetar CSS global
    _injectStyles();

    // Listeners de nav
    document.querySelectorAll('.nav-item[data-route]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.route));
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
      if (confirm('Sair do painel?')) auth.logout();
    });

    // Sidebar toggle
    (function() {
      var _sidebarOpen = true;
      var _btnToggle = document.getElementById('btn-sidebar-toggle');
      var _sidebar = document.querySelector('#app-shell nav');
      if (!_sidebar) _sidebar = document.querySelector('#app-shell > div > nav');
      if (_btnToggle && _sidebar) {
        _btnToggle.addEventListener('click', function() {
          _sidebarOpen = !_sidebarOpen;
          _sidebar.style.width    = _sidebarOpen ? '200px' : '0px';
          _sidebar.style.minWidth = _sidebarOpen ? '200px' : '0px';
          _sidebar.style.overflow = _sidebarOpen ? 'visible' : 'hidden';
          _sidebar.style.padding  = _sidebarOpen ? '24px 0' : '0';
          _btnToggle.textContent  = _sidebarOpen ? '☰' : '▶';
        });
      }
    })();

    // Badge de solicitações
    _startBadgePoller();
  }

  // ── Badge de solicitações abertas ────────────────────────────────────────────
  let _badgeInterval = null;

  function _startBadgePoller() {
    clearInterval(_badgeInterval);
    _badgePoller();
    _badgeInterval = setInterval(_badgePoller, 60_000);
  }

  async function _badgePoller() {
    try {
      const res = await api.getSolicitacoesAbertas();
      const abertas = (res?.data || []).filter(s => s.status === 'ABERTA').length;
      const badge = document.getElementById('badge-sol');
      if (!badge) return;
      if (abertas > 0) {
        badge.textContent = abertas;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    } catch (_) {}
  }

  // ── Injeção de estilos globais ───────────────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById('gestor-styles')) return;

    const style = document.createElement('style');
    style.id = 'gestor-styles';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

      *, *::before, *::after { box-sizing: border-box; }

      body { font-family: 'IBM Plex Sans', sans-serif; color: #e2e8f0; }

      /* ── Nav ── */
      .nav-item {
        position: relative;
        display: flex; align-items: center; gap: 10px;
        width: 100%; padding: 11px 20px;
        background: none; border: none; border-left: 3px solid transparent;
        color: #718096; font-size: 13px; font-family: 'IBM Plex Sans', sans-serif;
        cursor: pointer; text-align: left; transition: all 0.15s;
      }
      .nav-item:hover { background: rgba(99,179,237,0.05); color: #a0aec0; }
      .nav-item.active { border-left-color: #63b3ed; color: #e2e8f0; background: rgba(99,179,237,0.08); }

      .nav-badge {
        margin-left: auto;
        background: #fc8181; color: #0a0f1e;
        font-size: 10px; font-weight: 700;
        padding: 2px 6px; border-radius: 10px;
        font-family: 'IBM Plex Mono', monospace;
      }
      .nav-badge.hidden { display: none; }

      /* ── Tela ── */
      .screen {
        padding: 28px 32px;
        display: flex; flex-direction: column; gap: 20px;
        min-height: 100%;
      }
      .screen-map {
        padding: 0;
        height: 100%;
      }

      .screen-header {
        display: flex; align-items: center; gap: 12px;
      }
      .screen-title {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 18px; font-weight: 700; color: #e2e8f0;
        margin: 0; letter-spacing: -0.5px;
      }
      .screen-subtitle {
        font-size: 11px; color: #4a5568;
        font-family: 'IBM Plex Mono', monospace;
        margin-left: auto;
      }

      /* ── KPI grid ── */
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 16px;
      }
      .kpi-card {
        background: #0d1526;
        border: 1px solid rgba(99,179,237,0.1);
        border-radius: 6px;
        padding: 20px 18px;
        display: flex; flex-direction: column; gap: 6px;
      }
      .kpi-card.skeleton { opacity: 0.4; }
      .kpi-icon { font-size: 20px; }
      .kpi-value { font-size: 28px; font-weight: 700; font-family: 'IBM Plex Mono', monospace; }
      .kpi-label { font-size: 11px; color: #718096; text-transform: uppercase; letter-spacing: 1px; }

      /* ── Section title ── */
      .section-title {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 11px; letter-spacing: 3px; color: #4a5568;
        text-transform: uppercase; padding-bottom: 8px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }

      /* ── Promotor list ── */
      .promotor-list { display: flex; flex-direction: column; gap: 8px; }
      .promotor-item {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 16px;
        background: #0d1526; border: 1px solid rgba(255,255,255,0.05);
        border-radius: 4px;
      }
      .promotor-nome { font-size: 14px; font-weight: 600; }
      .promotor-detalhe { font-size: 12px; color: #718096; margin-top: 2px; }

      /* ── Status badge ── */
      .status-badge {
        font-size: 11px; font-weight: 600; font-family: 'IBM Plex Mono', monospace;
        padding: 3px 8px; border-radius: 3px; border: 1px solid;
        white-space: nowrap;
      }

      /* ── Filter bar ── */
      .filter-bar {
        display: flex; gap: 8px; flex-wrap: wrap;
      }
      .filter-btn {
        padding: 6px 14px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        color: #718096; font-size: 12px;
        border-radius: 3px; cursor: pointer; transition: all 0.15s;
      }
      .filter-btn:hover { color: #a0aec0; border-color: rgba(255,255,255,0.15); }
      .filter-btn.active { background: rgba(99,179,237,0.1); border-color: #63b3ed40; color: #63b3ed; }

      /* ── Card list ── */
      .card-list { display: flex; flex-direction: column; gap: 12px; }
      .card {
        background: #0d1526;
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 6px; overflow: hidden;
      }
      .card-urgent { border-left: 3px solid #f6ad55; }
      .card-header {
        display: flex; align-items: flex-start; justify-content: space-between;
        padding: 16px 20px; gap: 12px;
      }
      .card-title { font-size: 14px; font-weight: 600; color: #e2e8f0; }
      .card-sub { font-size: 12px; color: #718096; margin-top: 2px; }
      .card-body { padding: 0 20px 16px; display: flex; flex-direction: column; gap: 6px; }
      .card-row { display: flex; justify-content: space-between; font-size: 13px; color: #a0aec0; }
      .card-row strong { color: #e2e8f0; }
      .card-desc { font-size: 13px; color: #a0aec0; font-style: italic; margin-bottom: 4px; }
      .card-actions {
        display: flex; gap: 8px; padding: 12px 20px;
        border-top: 1px solid rgba(255,255,255,0.05);
        background: rgba(0,0,0,0.15);
      }

      /* ── Botões ── */
      .btn-icon {
        background: none; border: 1px solid rgba(255,255,255,0.1);
        color: #718096; width: 32px; height: 32px; border-radius: 3px;
        cursor: pointer; font-size: 16px; transition: all 0.15s;
        margin-left: auto;
      }
      .btn-icon:hover { color: #e2e8f0; border-color: rgba(255,255,255,0.2); }

      .btn-success {
        background: #68d39120; border: 1px solid #68d39140;
        color: #68d391; padding: 8px 16px; border-radius: 3px;
        font-size: 13px; cursor: pointer; transition: all 0.15s;
      }
      .btn-success:hover { background: #68d39130; }

      .btn-danger {
        background: #fc818120; border: 1px solid #fc818140;
        color: #fc8181; padding: 8px 16px; border-radius: 3px;
        font-size: 13px; cursor: pointer; transition: all 0.15s;
      }
      .btn-danger:hover { background: #fc818130; }

      .btn-sm { padding: 5px 12px; font-size: 12px; }
      .panel-btn {
        width: 100%; padding: 10px; margin-top: 8px;
        background: rgba(99,179,237,0.1); border: 1px solid rgba(99,179,237,0.3);
        color: #63b3ed; border-radius: 3px; font-size: 13px; cursor: pointer;
        transition: all 0.15s;
      }
      .panel-btn:hover { background: rgba(99,179,237,0.2); }

      /* ── Estados de lista ── */
      .list-loading, .list-empty, .list-error {
        padding: 40px; text-align: center;
        font-size: 13px; color: #4a5568;
        font-family: 'IBM Plex Mono', monospace;
      }
      .list-error { color: #fc8181; }

      /* ── Mapa ── */
      .map-toolbar {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 16px; flex-wrap: wrap;
        background: #0d1526; border-bottom: 1px solid rgba(99,179,237,0.1);
        flex-shrink: 0;
      }
      .map-title {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 13px; font-weight: 700; color: #e2e8f0;
        margin-right: 8px;
      }
      .map-toggles { display: flex; gap: 6px; flex-wrap: wrap; }
      .toggle-btn {
        padding: 5px 12px; font-size: 11px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        color: #4a5568; border-radius: 3px; cursor: pointer; transition: all 0.15s;
      }
      .toggle-btn.active { background: rgba(99,179,237,0.1); border-color: #63b3ed40; color: #63b3ed; }
      .map-updated {
        font-size: 10px; color: #4a5568;
        font-family: 'IBM Plex Mono', monospace;
        margin-left: auto;
      }

      /* Painel lateral do mapa */
      .map-panel {
        position: absolute; right: 0; top: 56px; bottom: 0;
        width: 300px; background: #0d1526;
        border-left: 1px solid rgba(99,179,237,0.15);
        padding: 20px; overflow-y: auto;
        z-index: 1000;
        display: flex; flex-direction: column; gap: 12px;
      }
      .map-panel.hidden { display: none; }
      .map-panel-close {
        position: absolute; top: 12px; right: 12px;
        background: none; border: none; color: #718096;
        font-size: 16px; cursor: pointer; padding: 4px;
      }
      .panel-section { display: flex; flex-direction: column; gap: 6px; }
      .panel-name { font-size: 16px; font-weight: 600; color: #e2e8f0; }
      .panel-sub  { font-size: 12px; color: #718096; }
      .panel-row  { display: flex; justify-content: space-between; font-size: 13px; color: #a0aec0; }
      .panel-row strong { color: #e2e8f0; }

      /* ── Modal ── */
      .modal {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999;
      }
      .modal.hidden { display: none; }
      .modal-box {
        background: #0d1526; border: 1px solid rgba(99,179,237,0.2);
        border-radius: 6px; padding: 28px;
        width: 100%; max-width: 460px;
        display: flex; flex-direction: column; gap: 16px;
      }
      .modal-title { font-family: 'IBM Plex Mono', monospace; font-size: 16px; font-weight: 700; }
      .modal-body { display: flex; flex-direction: column; gap: 8px; }
      .modal-info-row { display: flex; justify-content: space-between; font-size: 13px; color: #a0aec0; }
      .modal-info-row strong { color: #e2e8f0; }
      .modal-label { font-size: 11px; letter-spacing: 2px; color: #718096; text-transform: uppercase; }
      .modal-textarea {
        width: 100%; padding: 10px 12px;
        background: #0a0f1e; border: 1px solid rgba(99,179,237,0.2);
        border-radius: 3px; color: #e2e8f0; font-size: 13px;
        font-family: 'IBM Plex Sans', sans-serif; resize: vertical; outline: none;
      }
      .modal-actions { display: flex; gap: 10px; }
      .modal-actions .btn-danger, .modal-actions .btn-success { flex: 1; padding: 12px; font-size: 13px; }
      .modal-cancel {
        background: none; border: none; color: #4a5568; font-size: 12px;
        cursor: pointer; text-align: center; padding: 4px;
        font-family: 'IBM Plex Mono', monospace;
      }
      .modal-cancel:hover { color: #718096; }

      /* ── Leaflet fix ── */
      #leaflet-map { background: #111827; }
      .leaflet-container { font-family: 'IBM Plex Sans', sans-serif; }
      .leaflet-popup-content-wrapper {
        background: #0d1526; color: #e2e8f0;
        border: 1px solid rgba(99,179,237,0.2);
      }
      .leaflet-popup-tip { background: #0d1526; }
    `;
    document.head.appendChild(style);
  }

  // ── Service Worker + PWA install (Sessão 4) ─────────────────────────────────
  window.__pwaPrompt = null;
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window.__pwaPrompt = e;
    var wrap = document.getElementById('pwa-install-wrap');
    if (wrap) wrap.style.display = 'block';
  });

  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  if (isIOS && !isStandalone) {
    setTimeout(function() {
      var wrap = document.getElementById('pwa-ios-wrap');
      if (wrap) wrap.style.display = 'block';
    }, 500);
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/gestor/sw.js', { updateViaCache: 'none', scope: '/gestor/' })
      .then(function(reg) {
        window.__swReg = reg;
        reg.addEventListener('updatefound', function() {
          var nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', function() {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              _mostrarBannerAtualizacaoGestor(reg);
            }
          });
        });
      })
      .catch(function() {});
  }

  return { navigate, back, _toggleAlertMenu };
})();

function _mostrarBannerAtualizacaoGestor(reg) {
  document.getElementById('jet-update-banner') && document.getElementById('jet-update-banner').remove();
  var banner = document.createElement('div');
  banner.id = 'jet-update-banner';
  banner.style.cssText = 'position:fixed;bottom:20px;left:16px;right:16px;z-index:9999;' +
    'background:#0d1526;color:#e2e8f0;border-left:4px solid #63b3ed;' +
    'padding:12px 16px;border-radius:4px;display:flex;align-items:center;' +
    'justify-content:space-between;box-shadow:0 4px 24px rgba(0,0,0,0.5);font-size:13px;' +
    'font-family:IBM Plex Mono,monospace;';
  banner.innerHTML = '<span>🔄 Nova versão disponível</span>' +
    '<button id="jet-update-btn" style="background:#63b3ed;color:#0a0f1e;border:none;' +
    'padding:6px 14px;border-radius:3px;font-weight:700;cursor:pointer;font-size:12px;' +
    'font-family:IBM Plex Mono,monospace;">ATUALIZAR</button>';
  document.body.appendChild(banner);
  document.getElementById('jet-update-btn').addEventListener('click', function() {
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    banner.remove();
    navigator.serviceWorker.addEventListener('controllerchange', function() { window.location.reload(); });
  });
}