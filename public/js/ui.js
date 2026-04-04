const ui = {
  render(html) { document.getElementById('app').innerHTML = html; },

  initNetworkListeners() {
    const updateOnlineStatus = () => {
      const banner = document.getElementById('offline-banner');
      if (!banner) return;
      if (navigator.onLine) {
        banner.style.display = 'none';
        document.querySelectorAll('.btn-checkin-critical').forEach(btn => btn.disabled = false);
      } else {
        banner.style.display = 'block';
        document.querySelectorAll('.btn-checkin-critical').forEach(btn => btn.disabled = true);
      }
    };
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus(); // Set initial state
  },

  toast(msg, type = 'info', duration = 3000) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast ${type}`;
    setTimeout(() => { el.className = 'toast hidden'; }, duration);
  },

  spinner(label = 'Carregando…') {
    return `<div class="spinner-wrap"><div class="spinner"></div><span class="spinner-label">${label}</span></div>`;
  },

  statusBadge(status) {
    const map = {
      EM_ATIVIDADE:  ['badge-green',  '● Em atividade'],
      ACEITO:        ['badge-blue',   '● Aceito'],
      PAUSADO:       ['badge-yellow', '● Pausado'],
      ENCERRADO:     ['badge-gray',   '● Encerrado'],
      REALOCADO:     ['badge-purple', '● Realocado'],
      SEM_SLOT:      ['badge-gray',   '● Sem slot'],
      EM_TURNO:      ['badge-green',  '● Em turno'],
      SEM_SINAL:     ['badge-red',    '● Sem sinal'],
      MAPEAMENTO_INTERROMPIDO: ['badge-red', '● Mapeamento interrompido'],
    };
    const [cls, label] = map[status] || ['badge-gray', status || '—'];
    return `<span class="badge ${cls}">${label}</span>`;
  },

  hora(iso) {
    if (!iso) return '—';
    try {
      // Se for só "HH:MM" ou "HH:MM:SS", retornar diretamente
      if (/^\d{2}:\d{2}/.test(String(iso))) return String(iso).substring(0, 5);
      return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (_) { return '—'; }
  },

  header(title, sub = '', showBack = true) {
    return `<div class="header">
      ${showBack ? '<button onclick="router.back()" style="min-height:44px;padding:0 16px;border-radius:12px;background:var(--card);border:1px solid var(--border);color:var(--text);font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;flex-shrink:0;-webkit-tap-highlight-color:transparent;touch-action:manipulation;white-space:nowrap">← Voltar</button>' : ''}
      <div style="flex:1"><div class="header-title">${title}</div>${sub ? `<div class="header-sub">${sub}</div>` : ''}</div>
      <div id="hdr-score" style="font-size:11px;color:#f6ad55;font-weight:700;background:rgba(246,173,85,0.15);border:1px solid rgba(246,173,85,0.3);padding:3px 10px;border-radius:20px;display:none">⭐ —</div>
    </div>`;
  },

  bottomNav(active) {
    const items = [
      { id: 'home',     icon: '🏠', label: 'Home',     screen: 'home' },
      { id: 'slot',     icon: '⚡', label: 'Jornada',  screen: 'slot', badge: true },
      { id: 'historico',icon: '📋', label: 'Histórico',screen: 'historico' },
      { id: 'ranking',  icon: '🏆', label: 'Ranking',  screen: 'ranking' },
      { id: 'academy',  icon: '🎓', label: 'Academy',  screen: 'academy' },
    ];
    return `<nav class="bottom-nav">${items.map(it =>
      `<button class="nav-item ${active === it.id ? 'active' : ''}" onclick="router.go('${it.screen}')" style="position:relative">
        <span class="nav-icon">${it.icon}</span>
        ${it.badge ? '<span id="badge-slots" style="display:none;position:absolute;top:4px;right:calc(50% - 16px);background:#e74c3c;color:#fff;font-size:9px;font-weight:800;padding:1px 5px;border-radius:10px;min-width:14px;text-align:center">0</span>' : ''}
        <span>${it.label}</span>
      </button>`
    ).join('')}</nav>`;
  },

  // Timer formatado HH:MM:SS
  formatTimer(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
  },

  // Distância em metros formatada
  formatDist(m) {
    return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
  },

  setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
      btn._originalText = btn.innerHTML;
      btn.innerHTML = `<div class="spinner" style="width:20px;height:20px;border-width:3px"></div>`;
    } else if (btn._originalText) {
      btn.innerHTML = btn._originalText;
    }
  }
};
