// ─── turnoclt.js ──────────────────────────────────────────────────────────────
// Tela de turno ativo CLT: checkin → em andamento → checkout

const turnoCLT = {
  _timer: null,
  _watchId: null,

  async render() {
    const p = state.get('promotor');
    if (!p) return router.go('splash');

    // Buscar turno ativo do dia
    document.getElementById('app').innerHTML = _renderLoading();

    try {
      const res = await api.get('GET_MEUS_TURNOS_CLT');
      const turnos = res.data || [];
      const d = new Date();
      const hoje = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
      
      const ativo = turnos.find(t =>
        String(t.data).substring(0,10) === hoje &&
        ['PLANEJADO','ESCALADO','CONFIRMADO','EM_ANDAMENTO'].includes(t.status)
      );

      if (!ativo) {
        document.getElementById('app').innerHTML = _renderSemTurno();
        return;
      }

      state.set('turno_clt_ativo', ativo);

      if (ativo.status === 'EM_ANDAMENTO') {
        this._renderAtivo(ativo);
      } else {
        this._renderCheckin(ativo);
      }
    } catch(e) {
      document.getElementById('app').innerHTML = _renderErro(e.message);
    }
  },

  _renderCheckin(turno) {
    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
        ${_navHeader('Meu Turno')}
        <div style="padding:16px;display:flex;flex-direction:column;gap:14px">

          <div style="background:#1e2a45;border:1px solid #4f8ef744;border-radius:14px;padding:18px">
            <div style="font-size:11px;color:#4f8ef7;font-weight:700;letter-spacing:1px;margin-bottom:10px">TURNO DE HOJE</div>
            <div style="font-size:18px;font-weight:700;margin-bottom:6px">⏰ ${_fh(turno.inicio)} – ${_fh(turno.fim)}</div>
            <div style="font-size:13px;color:#a0aec0">${turno.zona_nome || '—'}</div>
            ${turno.ponto_referencia ? `<div style="font-size:13px;color:#a0aec0">${turno.ponto_referencia}</div>` : ''}
            <div style="margin-top:10px;display:flex;justify-content:space-between">
              <span style="font-size:12px;color:#a0aec0">Horas previstas</span>
              <strong style="font-size:12px">${turno.horas_turno || '—'}h</strong>
            </div>
          </div>

          <div id="gps-status-clt" style="background:#1e2a45;border:1px solid #2a3a55;border-radius:10px;padding:12px;display:flex;align-items:center;gap:10px">
            <div style="width:10px;height:10px;border-radius:50%;background:#f1c40f;animation:pulse 1.5s infinite"></div>
            <span style="font-size:13px;color:#a0aec0">Obtendo GPS...</span>
          </div>

          <button id="btn-checkin-clt" onclick="turnoCLT._fazerCheckin('${turno.turno_id}')"
            style="background:#2ecc71;color:#fff;border:none;border-radius:12px;font-size:17px;font-weight:700;padding:18px;width:100%;cursor:pointer;">
            ✅ Registrar Check-in
          </button>

          <button onclick="router.go('home-clt')"
            style="background:none;border:1px solid #2a3a55;border-radius:10px;color:#a0aec0;font-size:14px;padding:12px;cursor:pointer">
            ← Voltar
          </button>
        </div>
        ${_navBottom('turno-ativo')}
        <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}</style>
      </div>`;

    this._iniciarGPS();
  },

  _renderAtivo(turno) {
    const checkinHora = turno.checkin_hora
      ? new Date(turno.checkin_hora).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
      : '—';

    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
        ${_navHeader('Turno em Andamento')}
        <div style="padding:16px;display:flex;flex-direction:column;gap:14px">

          <div style="background:#1e2a45;border:1px solid #2ecc7144;border-left:4px solid #2ecc71;border-radius:14px;padding:18px">
            <div style="font-size:11px;color:#2ecc71;font-weight:700;letter-spacing:1px;margin-bottom:10px">EM ANDAMENTO</div>
            <div style="font-size:22px;font-weight:800;font-family:monospace;color:#2ecc71" id="clt-timer">00:00:00</div>
            <div style="font-size:13px;color:#a0aec0;margin-top:6px">Check-in às ${checkinHora}</div>
            <div style="margin-top:10px;font-size:14px;font-weight:600">${turno.zona_nome || '—'}</div>
            ${turno.ponto_referencia ? `<div style="font-size:13px;color:#a0aec0">${turno.ponto_referencia}</div>` : ''}
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:14px;text-align:center">
              <div style="font-size:10px;color:#6c7a8d;margin-bottom:4px">PREVISTO FIM</div>
              <div style="font-size:16px;font-weight:700">${_fh(turno.fim)}</div>
            </div>
            <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:14px;text-align:center">
              <div style="font-size:10px;color:#6c7a8d;margin-bottom:4px">HORAS PREVISTAS</div>
              <div style="font-size:16px;font-weight:700">${turno.horas_turno || '—'}h</div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <button onclick="turnoCLT._pausar('${turno.turno_id}')" id="btn-pause-clt"
              style="background:#f1c40f22;border:1px solid #f1c40f44;color:#f1c40f;border-radius:12px;font-size:15px;font-weight:700;padding:14px;cursor:pointer">
              ⏸️ Pausar
            </button>
            <button onclick="turnoCLT._fazerCheckout('${turno.turno_id}')" id="btn-checkout-clt"
              style="background:#e74c3c;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;padding:14px;cursor:pointer">
              🔴 Check-out
            </button>
          </div>
        </div>
        ${_navBottom('turno-ativo')}
      </div>`;

    heartbeat.iniciar(turno.turno_id);

    if (turno.checkin_hora) {
      const inicio = new Date(turno.checkin_hora).getTime();
      this._timer = setInterval(() => {
        const el = document.getElementById('clt-timer');
        if (!el) { clearInterval(turnoCLT._timer); return; }
        const diff = Math.floor((Date.now() - inicio) / 1000);
        const h = Math.floor(diff/3600), m = Math.floor((diff%3600)/60), s = diff%60;
        el.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      }, 1000);
    }
  },

  _iniciarGPS() {
    gps.iniciar();
    const unsub = gps.onChange(g => {
      const el = document.getElementById('gps-status-clt');
      if (g.ok) {
        if (el) el.innerHTML = `<div style="width:10px;height:10px;border-radius:50%;background:#2ecc71"></div><span style="font-size:13px;color:#2ecc71">GPS ativo · ±${Math.round(g.accuracy)}m</span>`;
        state.set('gps_clt', g);
      } else {
        if (el) el.innerHTML = `<div style="width:10px;height:10px;border-radius:50%;background:#f1c40f"></div><span style="font-size:13px;color:#f1c40f">GPS instável</span>`;
      }
    });
    state.set('_gpsUnsubCLT', unsub);
  },

  async _fazerCheckin(turnoId) {
    const btn = document.getElementById('btn-checkin-clt');
    const g = state.get('gps_clt') || {};
    const u = state.get('promotor') || {};
    
    if (btn) { btn.textContent = 'Processando...'; btn.disabled = true; }

    try {
      const payload = {
        evento: 'CHECKIN_TURNO_CLT',
        turno_id: turnoId,
        lat: g.lat || null,
        lng: g.lng || null,
        accuracy: g.accuracy || null
      };

      // Bypass automático de foto para Fiscais no PWA (até termos UI de câmera aqui)
      if (['FISCAL','SCOUT','MOTORISTA','CHARGER'].includes((u.cargo_principal||'').toUpperCase())) {
        payload.foto_base64 = 'LOGADO_VIA_PWA_CLT_BYPASS';
      }

      const res = await api.post(payload);

      if (res.ok) {
        ui.toast('✅ Check-in realizado!', 'success');
        this.render();
      } else {
        alert('Erro: ' + (res.erro || res.mensagem));
        if (btn) { btn.textContent = '✅ Registrar Check-in'; btn.disabled = false; }
      }
    } catch(e) {
      ui.toast('Erro de conexão.', 'error');
      if (btn) { btn.textContent = '✅ Registrar Check-in'; btn.disabled = false; }
    }
  },

  async _pausar(turnoId) {
    try {
      const res = await api.post({ evento: 'PAUSAR_TURNO_CLT', turno_id: turnoId });
      if (res.ok) this.render();
    } catch(e) { ui.toast('Erro ao pausar', 'error'); }
  },

  async _fazerCheckout(turnoId) {
    if (!confirm('Encerrar turno agora?')) return;
    try {
      const res = await api.post({ evento: 'CHECKOUT_TURNO_CLT', turno_id: turnoId });
      if (res.ok) {
        clearInterval(this._timer);
        heartbeat.parar();
        this.render();
      }
    } catch(e) { ui.toast('Erro ao encerrar', 'error'); }
  }
};

function _navHeader(t) {
  return `<div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:50">
    <button onclick="router.go('home-clt')" style="background:#1e2a45;border:none;color:#eaf0fb;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer">‹</button>
    <div style="font-size:17px;font-weight:700;flex:1">${t}</div>
  </div>`;
}

function _navBottom(a) {
  const itens = [
    { id:'home-clt', icon:'🏠', label:'Home' },
    { id:'turno-ativo', icon:'⚡', label:'Turno' },
    { id:'historico-clt', icon:'📋', label:'Histórico' },
  ];
  return `<nav style="position:fixed;bottom:0;left:0;right:0;background:#16213e;border-top:1px solid #2a3a55;display:flex;justify-content:space-around;padding:10px 0 calc(10px + env(safe-area-inset-bottom,0px));z-index:100">
    ${itens.map(i => `<button onclick="router.go('${i.id}')" style="background:none;border:none;color:${i.id===a?'#4f8ef7':'#6c7a8d'};font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:22px">${i.icon}</span>${i.label}</button>`).join('')}
  </nav>`;
}

function _fh(v) {
  if (!v) return '—';
  const s = String(v);
  if (/^\d{2}:\d{2}/.test(s)) return s.substring(0,5);
  try { return new Date(v).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); } catch(_) { return '—'; }
}

function _renderLoading() {
  return `<div style="min-height:100dvh;background:#1a1a2e;display:flex;align-items:center;justify-content:center"><div style="color:#a0aec0">Carregando...</div></div>`;
}

function _renderSemTurno() {
  return `
    <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
      ${_navHeader('Meu Turno')}
      <div style="padding:24px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center">
        <div style="font-size:48px;opacity:.4;margin-top:40px">⏰</div>
        <div style="font-size:16px;color:#a0aec0">Nenhum turno escalado para hoje</div>
        <button onclick="router.go('home-clt')" style="margin-top:16px;background:#4f8ef7;color:#fff;border:none;border-radius:10px;padding:12px 32px;font-size:14px;cursor:pointer">← Voltar</button>
      </div>
      ${_navBottom('turno-ativo')}
    </div>`;
}

function _renderErro(m) {
  return `<div style="min-height:100dvh;background:#1a1a2e;display:flex;align-items:center;justify-content:center;color:#e74c3c;padding:20px;text-align:center">${m}</div>`;
}