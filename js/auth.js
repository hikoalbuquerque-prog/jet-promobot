const auth = {

  async init() {
    this._renderLogin('');
    const token = state.loadToken();
    if (token) {
      this._renderSplash();
      try {
        const res = await api.post({ evento: 'VALIDAR_TOKEN', token }, { skipToken: true, tokenOverride: token });
        if (res.ok) {
          state.saveToken(token);
          const me = await api.get('GET_ME');
          if (me.ok) {
            state.setPromotor(me.dados || me.user);
            this._rotearPorPerfil(me.dados || me.user);
            return;
          }
        }
      } catch (_) {}
      state.clearToken();
    }
    this._renderLogin('');
  },

  _rotearPorPerfil(user) {
    const vinculo = (user.tipo_vinculo || '').toUpperCase();
    if (vinculo === 'CLT') {
      router.replace('home-clt');
    } else {
      router.replace('home');
    }
    // Carrega score e badge
    this._atualizarScore();
    this._atualizarBadgeSlots();
    this._atualizarBadgesHome();
    setInterval(() => this._atualizarScore(), 60000);
    setInterval(() => this._atualizarBadgeSlots(), 30000);
  },

  _indicar() {
    const p = state.get('promotor');
    if (!p) return;
    const link = 'https://promo-telegram-gateway-v3-476120210909.southamerica-east1.run.app/indicacao?ref=' + p.user_id;
    if (navigator.share) {
      navigator.share({ title: 'Seja um Promotor JET', text: 'Olha essa vaga de promotor!', url: link });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(link).then(function() { ui.toast('Link copiado!', 'success'); });
    } else {
      prompt('Copie o link:', link);
    }
  },

  _indicar() {
    const p = state.get('promotor');
    if (!p) return;
    const link = 'https://promo-telegram-gateway-v3-476120210909.southamerica-east1.run.app/indicacao?ref=' + p.user_id;
    if (navigator.share) {
      navigator.share({ title: 'Seja um Promotor JET', text: 'Olha essa vaga de promotor!', url: link });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(link).then(function() { ui.toast('Link copiado!', 'success'); });
    } else {
      prompt('Copie o link:', link);
    }
  },

  async _atualizarBadgesHome() {
    try {
      const [badgeRes, meRes] = await Promise.all([
        api.get('GET_BADGES'),
        api.get('GET_ME')
      ]);
      const badges = badgeRes?.badges || [];
      const score  = meRes?.user?.score_operacional || 0;
      const streak = meRes?.user?.streak_dias || 0;
      const el = document.getElementById('home-badges');
      if (!el) return;
      let html = '';
      if (score > 0) html += '<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;background:rgba(246,173,85,0.15);color:#f6ad55;border:1px solid rgba(246,173,85,0.3)">⭐ ' + score + ' pts</span>';
      if (streak >= 3) html += '<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;background:rgba(246,173,85,0.15);color:#f6ad55;border:1px solid rgba(246,173,85,0.3)">🔥 ' + streak + 'd</span>';
      badges.slice(0, 3).forEach(b => {
        html += '<span style="font-size:14px" title="' + b.descricao + '">' + b.descricao.split(' ')[0] + '</span>';
      });
      el.innerHTML = html;
    } catch(_) {}
  },

  async _atualizarScore() {
    try {
      const me = await api.get('GET_ME');
      const score = me?.user?.score_operacional ?? me?.user?.score ?? null;
      document.querySelectorAll('#hdr-score').forEach(el => {
        if (score !== null) { el.textContent = '⭐ ' + score; el.style.display = 'block'; }
      });
    } catch(_) {}
  },

  async _atualizarBadgeSlots() {
    try {
      const disp = await api.get('GET_SLOTS_DISPONIVEIS');
      const count = disp?.slots?.length || 0;
      document.querySelectorAll('#badge-slots').forEach(el => {
        el.textContent = count;
        el.style.display = count > 0 ? 'block' : 'none';
      });
    } catch(_) {}
  },

  _renderLogin(erro) {
    document.getElementById("app").innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:16px;font-family:-apple-system,sans-serif">
        <div style="font-size:32px;font-weight:800;color:#4f8ef7;letter-spacing:2px">JET·OPS</div>
        <div style="font-size:13px;color:#a0aec0;text-align:center">Sistema Operacional de Promotores</div>
        <div style="width:100%;max-width:340px;display:flex;flex-direction:column;gap:10px">
          <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px">
            <div style="font-size:11px;color:#a0aec0;letter-spacing:1px">CPF</div>
            <input id="inp-cpf" type="tel" placeholder="000.000.000-00" autocomplete="off"
              style="background:#16213e;border:1.5px solid #2a3a55;border-radius:10px;color:#eaf0fb;font-size:15px;padding:13px;width:100%;outline:none;box-sizing:border-box"/>
            <div style="font-size:11px;color:#a0aec0;letter-spacing:1px;margin-top:4px">DATA DE NASCIMENTO (senha)</div>
            <input id="inp-senha" type="password" placeholder="DD/MM/AAAA"
              style="background:#16213e;border:1.5px solid #2a3a55;border-radius:10px;color:#eaf0fb;font-size:15px;padding:13px;width:100%;outline:none;box-sizing:border-box"/>
          </div>
          <button id="btn-entrar" onclick="auth._loginCPF()"
            style="background:#4f8ef7;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:700;padding:15px;width:100%;cursor:pointer">
            Entrar →
          </button>
        </div>
        ${erro ? `<div style="color:#e74c3c;font-size:13px;text-align:center;padding:10px 16px;background:rgba(231,76,60,.15);border-radius:8px;border:1px solid rgba(231,76,60,.3);width:100%;max-width:340px;box-sizing:border-box">${erro}</div>` : ""}
        <div style="font-size:12px;color:#6c7a8d;text-align:center;max-width:300px">
          Use o CPF e sua data de nascimento para entrar
        </div>
        <div id="pwa-install-wrap" style="width:100%;max-width:340px;display:none">
          <button onclick="auth._instalarPWA()" style="width:100%;padding:13px;border:1.5px solid #4f8ef7;border-radius:10px;background:transparent;color:#4f8ef7;font-size:14px;font-weight:700;cursor:pointer">
            📲 Instalar app na tela inicial
          </button>
        </div>
        <div id="pwa-ios-wrap" style="width:100%;max-width:340px;display:none">
          <div style="border:1px solid #2a3a55;border-radius:10px;padding:12px 14px;font-size:12px;color:#a0aec0;text-align:center;line-height:1.6">
            Para instalar: toque em <strong style="color:#4f8ef7">Compartilhar</strong> → <strong style="color:#4f8ef7">Adicionar à Tela Inicial</strong>
          </div>
        </div>
      </div>`;
    const inp = document.getElementById("inp-cpf");
    if (inp) {
      inp.focus();
      inp.onkeydown = e => { if (e.key === "Enter") document.getElementById("inp-senha")?.focus(); };
    }
    const inpSenha = document.getElementById("inp-senha");
    if (inpSenha) inpSenha.onkeydown = e => { if (e.key === "Enter") auth._loginCPF(); };
  },

  _switchTab(tab) {
    const isToken = tab === 'token';
    document.getElementById('tab-token').style.background = isToken ? '#4f8ef7' : 'none';
    document.getElementById('tab-token').style.color      = isToken ? '#fff' : '#6c7a8d';
    document.getElementById('tab-clt').style.background   = isToken ? 'none' : '#2ecc71';
    document.getElementById('tab-clt').style.color        = isToken ? '#6c7a8d' : '#fff';
    document.getElementById('form-token').style.display   = isToken ? 'flex' : 'none';
    document.getElementById('form-clt').style.display     = isToken ? 'none' : 'flex';
    if (isToken) document.getElementById('inp-token')?.focus();
    else document.getElementById('inp-cpf')?.focus();
  },

  async _loginCPF() {
    const cpf   = (document.getElementById("inp-cpf")?.value || "").replace(/\D/g, "");
    const senha = (document.getElementById("inp-senha")?.value || "").replace(/\D/g, "");
    if (!cpf || !senha) { this._renderLogin("Informe CPF e data de nascimento."); return; }
    const btn = document.getElementById("btn-entrar");
    if (btn) { btn.textContent = "Verificando..."; btn.disabled = true; }
    try {
      const res = await api.post({ evento: "LOGIN_CLT", cpf, senha }, { skipToken: true });
      if (!res.ok) { this._renderLogin(res.erro || res.mensagem || "CPF ou senha incorretos."); return; }
      state.saveToken(res.token);
      state.setPromotor(res.user);
      this._rotearPorPerfil(res.user);
    } catch (_) {
      this._renderLogin("Sem conexao. Verifique sua internet.");
    }
  },

  async _loginToken() {
    const input = document.getElementById('inp-token');
    const token = (input?.value || '').trim();
    if (!token) { this._renderLogin('Digite seu token.'); return; }
    const btn = document.getElementById('btn-token');
    if (btn) { btn.textContent = 'Verificando...'; btn.disabled = true; }
    try {
      const res = await api.post({ evento: 'VALIDAR_TOKEN', token }, { skipToken: true, tokenOverride: token });
      if (!res.ok) { this._renderLogin(res.mensagem || res.erro || 'Token inválido.'); return; }
      state.saveToken(token);
      const me = await api.get('GET_ME');
      if (!me.ok) { this._renderLogin(me.mensagem || 'Erro ao carregar perfil.'); return; }
      state.setPromotor(me.dados || me.user);
      this._rotearPorPerfil(me.dados || me.user);
    } catch (_) {
      this._renderLogin('Sem conexão. Verifique sua internet.');
    }
  },

  async _loginCLT() {
    const cpf   = (document.getElementById('inp-cpf')?.value || '').replace(/\D/g, '');
    const senha = (document.getElementById('inp-senha')?.value || '').trim();
    if (!cpf || !senha) { this._renderLogin('Informe CPF e senha.'); auth._switchTab('clt'); return; }
    const btn = document.getElementById('btn-clt');
    if (btn) { btn.textContent = 'Verificando...'; btn.disabled = true; }
    try {
      const res = await api.post({ evento: 'LOGIN_CLT', cpf, senha }, { skipToken: true });
      if (!res.ok) {
        this._renderLogin(res.erro || res.mensagem || 'CPF ou senha incorretos.');
        auth._switchTab('clt');
        return;
      }
      state.saveToken(res.token);
      state.setPromotor(res.user);
      this._rotearPorPerfil(res.user);
    } catch (_) {
      this._renderLogin('Sem conexão. Verifique sua internet.');
      auth._switchTab('clt');
    }
  },

  _renderSplash() {
    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:-apple-system,sans-serif">
        <div style="font-size:32px;font-weight:800;color:#4f8ef7">JET·OPS</div>
        <div style="width:36px;height:36px;border:3px solid #2a3a55;border-top-color:#4f8ef7;border-radius:50%;animation:spin .7s linear infinite"></div>
        <div style="color:#a0aec0;font-size:14px">Verificando acesso...</div>
        <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
      </div>`;
  },

  renderSplash() { this._renderSplash(); },
  renderAcesso(tipo, msg) { this._renderLogin(msg); },
  loginComTokenManual() { this._loginToken(); },

  _instalarPWA() {
    if (window.__pwaPrompt) {
      window.__pwaPrompt.prompt();
      window.__pwaPrompt.userChoice.then((result) => {
        console.log('[PWA] Install choice:', result.outcome);
        window.__pwaPrompt = null;
        document.getElementById('pwa-install-wrap') && (document.getElementById('pwa-install-wrap').style.display = 'none');
      });
    }
  },

  logout() {
    state.clearToken();
    state.set('promotor', null);
    state.set('slot', null);
    state.set('turno_clt_ativo', null);
    try { sessionStorage.clear(); } catch(_) {}
    this._renderLogin('');
  },
};

const homeScreen = {
  render() {
    const p = state.get('promotor');
    if (!p) return router.go('splash');
    const vinculo = (p.tipo_vinculo || '').toUpperCase();
    if (vinculo === 'CLT') return router.replace('home-clt');

    const slot    = state.get('slot');
    const jornada = state.loadJornada();
    const status  = jornada?.status || slot?.status || 'SEM_SLOT';
    const corStatus = { EM_ATIVIDADE:'#2ecc71', ACEITO:'#4f8ef7', PAUSADO:'#f1c40f', ENCERRADO:'#6c7a8d' }[status] || '#6c7a8d';

    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
        <div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:50">
          <div style="flex:1">
            <div style="font-size:17px;font-weight:700">${p.nome_completo||p.nome||'Promotor'}</div>
            <div style="font-size:12px;color:#a0aec0">${p.cidade_base||p.cidade||'—'} · ${p.cargo_principal||p.cargo||''}</div>
            <div id="home-badges" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px"></div>
          </div>
          <span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;background:${corStatus}22;color:${corStatus};border:1px solid ${corStatus}44">${status.replace(/_/g,' ')}</span>
          <button onclick="auth.logout()" style="margin-left:8px;background:#e74c3c22;border:1px solid #e74c3c44;color:#e74c3c;border-radius:8px;font-size:12px;font-weight:700;padding:6px 10px;cursor:pointer">Sair</button>
        </div>
        <div style="padding:16px;display:flex;flex-direction:column;gap:12px">
          ${jornada && jornada.status !== 'ENCERRADO' ? `
            <div onclick="router.go('operacao')" style="background:#1e2a45;border:1px solid #2ecc7144;border-radius:14px;padding:16px;cursor:pointer;border-left:3px solid #2ecc71">
              <div style="font-size:11px;color:#2ecc71;font-weight:700;margin-bottom:6px;letter-spacing:1px">JORNADA ATIVA</div>
              <div style="font-size:16px;font-weight:700">${slot?.local||slot?.local_nome||'Slot ativo'}</div>
              <div style="font-size:13px;color:#a0aec0;margin-top:4px">${slot?.cidade||''}</div>
              <div style="margin-top:10px;color:#4f8ef7;font-size:13px;font-weight:600">Abrir jornada →</div>
            </div>` : ''}
          ${!jornada || jornada.status === 'ENCERRADO' ? `
            <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:14px;padding:20px;text-align:center;color:#a0aec0;font-size:14px">
              Nenhuma jornada ativa
            </div>` : ''}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <button onclick="router.go('slot')" style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px;color:#eaf0fb;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:13px;font-weight:600">
              <span style="font-size:24px">📍</span>Slots
            </button>
            <button onclick="router.go('historico')" style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px;color:#eaf0fb;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:13px;font-weight:600">
              <span style="font-size:24px">📋</span>Histórico
            </button>
            <button onclick="router.go('calculadora')" style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px;color:#eaf0fb;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:13px;font-weight:600">
              <span style="font-size:24px">💰</span>Ganhos
            </button>
            <button onclick="homeScreen._indicar()" style="background:#1e2a45;border:1px solid rgba(104,211,145,0.3);border-radius:12px;padding:16px;color:#68d391;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:13px;font-weight:600">
              <span style="font-size:24px">🤝</span>Indicar
            </button>
            
          </div>
        </div>
        ${ui.bottomNav('home')}
      </div>`;

    // Atualizar slot em background
    api.get('GET_SLOT_ATUAL').then(res => {
      if (res.ok && res.jornada) { state.saveJornada(res.jornada); state.set('slot', res.slot); }
    }).catch(() => {});
  }
};
