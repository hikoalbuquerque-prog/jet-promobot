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
            if (typeof pushManager !== 'undefined') pushManager.init();
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
    this._atualizarScore();
    this._atualizarBadgeSlots();
    this._atualizarBadgesHome();
    setInterval(() => this._atualizarScore(), 60000);
    setInterval(() => this._atualizarBadgeSlots(), 30000);
  },

  async _atualizarBadgesHome() {
    try {
      const [badgeRes, meRes] = await Promise.all([
        api.get('GET_BADGES'),
        api.get('GET_ME')
      ]);
      const badges = badgeRes?.badges || [];
      const user = meRes?.user || meRes?.dados || {};
      const score  = user.score_operacional || 0;
      const streak = user.streak_dias || 0;
      const el = document.getElementById('home-badges');
      if (!el) return;
      let html = '';
      if (score > 0) html += `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;background:rgba(246,173,85,0.15);color:#f6ad55;border:1px solid rgba(246,173,85,0.3)">⭐ ${score} pts</span>`;
      if (streak >= 3) html += `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;background:rgba(246,173,85,0.15);color:#f6ad55;border:1px solid rgba(246,173,85,0.3)">🔥 ${streak}d</span>`;
      badges.slice(0, 3).forEach(b => {
        html += `<span style="font-size:14px" title="${b.descricao}">${b.descricao.split(' ')[0]}</span>`;
      });
      el.innerHTML = html;
    } catch(_) {}
  },

  async _atualizarScore() {
    try {
      const me = await api.get('GET_ME');
      const user = me?.user || me?.dados || {};
      const score = user.score_operacional ?? user.score ?? null;
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
      </div>`;
  },

  async _loginCPF() {
    const cpf   = (document.getElementById("inp-cpf")?.value || "").replace(/\D/g, "");
    const senha = (document.getElementById("inp-senha")?.value || "").replace(/\D/g, "");
    if (!cpf || !senha) { alert("Informe CPF e data de nascimento."); return; }
    const btn = document.getElementById("btn-entrar");
    if (btn) { btn.textContent = "Verificando..."; btn.disabled = true; }
    try {
      const res = await api.post({ evento: "LOGIN_CLT", cpf, senha }, { skipToken: true });
      if (!res.ok) { alert(res.erro || res.mensagem || "CPF ou senha incorretos."); this._renderLogin(""); return; }
      state.saveToken(res.token);
      state.setPromotor(res.user);
      this._rotearPorPerfil(res.user);
    } catch (_) {
      alert("Sem conexão.");
      if (btn) { btn.textContent = "Entrar →"; btn.disabled = false; }
    }
  },

  _renderSplash() {
    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:-apple-system,sans-serif">
        <div style="font-size:32px;font-weight:800;color:#4f8ef7">JET·OPS</div>
        <div style="width:36px;height:36px;border:3px solid #2a3a55;border-top-color:#4f8ef7;border-radius:50%;animation:spin .7s linear infinite"></div>
        <div style="color:#a0aec0;font-size:14px">Verificando acesso...</div>
      </div>`;
  },

  renderSplash() { this._renderSplash(); },

  logout() {
    state.clearToken();
    state.set('promotor', null);
    state.set('slot', null);
    try { sessionStorage.clear(); } catch(_) {}
    this._renderLogin('');
  },
};

const homeScreen = {
  _indicar() {
    const p = state.get('promotor');
    if (!p) return;
    const link = 'https://promo-telegram-gateway-v3-476120210909.southamerica-east1.run.app/indicacao?ref=' + p.user_id;
    if (navigator.share) {
      navigator.share({ title: 'Seja um Promotor JET', text: 'Olha essa vaga de promotor!', url: link });
    } else {
      prompt('Copie o link:', link);
    }
  },
  render() {
    const p = state.get('promotor');
    if (!p) return router.go('splash');

    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
        
        <div id="push-permission-bar" style="display:none;background:#4f8ef7;padding:10px 16px;text-align:center;font-size:12px;font-weight:700;color:#fff;cursor:pointer" onclick="homeScreen._pedirPush()">
          🔔 Clique aqui para ativar notificações push!
        </div>

        <div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:50">
          <div style="flex:1">
            <div style="font-size:17px;font-weight:700">${p.nome_completo||p.nome||'Promotor'}</div>
            <div style="font-size:12px;color:#a0aec0">${p.cidade_base||p.cidade||'—'} · ${p.cargo_principal||p.cargo||''}</div>
            <div id="home-badges" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px"></div>
          </div>
          <button onclick="auth.logout()" style="margin-left:8px;background:#e74c3c22;border:1px solid #e74c3c44;color:#e74c3c;border-radius:8px;font-size:12px;font-weight:700;padding:6px 10px;cursor:pointer">Sair</button>
        </div>
        <div style="padding:16px;display:flex;flex-direction:column;gap:12px">
          <div id="home-jornada-container">
            <div style="text-align:center;padding:20px;color:#a0aec0;font-size:13px">Carregando jornada...</div>
          </div>
          
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <button onclick="router.go('slot')" style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px;color:#eaf0fb;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:13px;font-weight:600">
              <span style="font-size:24px">📍</span>Slots
            </button>
            <button onclick="router.go('mapa')" style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px;color:#eaf0fb;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:13px;font-weight:600">
              <span style="font-size:24px">🗺️</span>Mapa
            </button>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <button onclick="router.go('solicitacoes-lista')" style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px 8px;color:#eaf0fb;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;font-weight:600">
              <span style="font-size:20px">🆘</span>Suporte
            </button>
            <button onclick="router.go('ranking')" style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px 8px;color:#eaf0fb;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;font-weight:600">
              <span style="font-size:20px">🏆</span>Ranking
            </button>
            <button onclick="router.go('calculadora')" style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px 8px;color:#eaf0fb;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;font-weight:600">
              <span style="font-size:20px">🧮</span>Calculadora
            </button>
          </div>

          <button onclick="router.go('academy')" style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px;color:#eaf0fb;cursor:pointer;display:flex;justify-content:center;align-items:center;gap:10px;font-size:13px;font-weight:700">
            <span style="font-size:24px">🎓</span>JET Academy
          </button>
        </div>
        ${ui.bottomNav('home')}
      </div>`;

    api.get('GET_SLOT_ATUAL').then(res => {
      const container = document.getElementById('home-jornada-container');
      if (!container) return;
      if (res.ok && res.jornadas?.length) {
        container.innerHTML = res.jornadas.map(item => `
          <div onclick="state.set('slot', ${JSON.stringify(item.slot).replace(/"/g,'&quot;')}); state.saveJornada(${JSON.stringify(item.jornada).replace(/"/g,'&quot;')}); router.go('operacao')" 
            style="background:#1e2a45;border:1px solid #2ecc7144;border-radius:14px;padding:16px;cursor:pointer;border-left:3px solid ${item.jornada.status === 'EM_ATIVIDADE' ? '#2ecc71' : '#4f8ef7'};margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <div style="font-size:11px;color:${item.jornada.status === 'EM_ATIVIDADE' ? '#2ecc71' : '#4f8ef7'};font-weight:700;letter-spacing:1px">${item.jornada.status.replace(/_/g,' ')}</div>
              <div style="font-size:10px;color:#a0aec0">${item.slot?.slot_id || ''}</div>
            </div>
            <div style="font-size:16px;font-weight:700">${item.slot?.local_nome||item.slot?.local||'Slot ativo'}</div>
            <div style="font-size:13px;color:#a0aec0;margin-top:4px">${item.slot?.cidade||''} · ${item.slot?.inicio || ''} - ${item.slot?.fim || ''}</div>
            <div style="margin-top:10px;color:#4f8ef7;font-size:13px;font-weight:600">Abrir jornada →</div>
          </div>
        `).join('');
      } else {
        container.innerHTML = `<div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:14px;padding:20px;text-align:center;color:#a0aec0;font-size:14px">Nenhuma jornada ativa</div>`;
      }
    });

    if (Notification.permission !== 'granted') {
      const bar = document.getElementById('push-permission-bar');
      if (bar) bar.style.display = 'block';
    }
  },

  async _pedirPush() {
    if (Notification.permission === 'denied') {
      alert('⚠️ Notificações Bloqueadas!\n\nVocê bloqueou as notificações deste site. Para ativar:\n1. Clique no cadeado (🔒) na barra de endereço\n2. Ative o botão "Notificações"\n3. Recarregue a página.');
      return;
    }
    if (typeof pushManager === 'undefined') { alert('Erro: pushManager não carregado.'); return; }
    try {
      const ok = await pushManager.requestPermission();
      if (ok) {
        document.getElementById('push-permission-bar').style.display = 'none';
        ui.toast('Notificações ativadas!', 'success');
      }
    } catch(e) { alert('Erro: ' + e.message); }
  }
};
