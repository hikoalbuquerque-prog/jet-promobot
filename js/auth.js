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
            const user = me.dados || me.user;
            state.setPromotor(user);
            if (typeof pushManager !== 'undefined') pushManager.init();
            
            if (user.lgpd_aceite) {
              this._rotearPorPerfil(user);
            } else {
              this._renderLGPD(user);
            }
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
    if (vinculo === 'CLT' || vinculo === 'FISCAL') {
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
        <div style="font-size:10px;color:#4a5568;text-align:center;margin-top:10px;letter-spacing:1px">VERSÃO v1.3.14-GH</div>
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
      const user = res.user;
      state.setPromotor(user);
      
      if (user.lgpd_aceite) {
        this._rotearPorPerfil(user);
      } else {
        this._renderLGPD(user);
      }
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

  _renderLGPD(user) {
    const isCLT = (user.tipo_vinculo || '').toUpperCase() === 'CLT';
    const textoRastreio = isCLT 
      ? 'Como colaborador CLT, seu rastreamento de localização será contínuo durante o turno para fins de registro de jornada e segurança operacional.'
      : 'Para promotores MEI, você pode optar pelo rastreamento contínuo durante o turno (melhor para sua pontuação e visibilidade do gestor) ou apenas nos registros de entrada e saída.';

    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;padding:24px;font-family:-apple-system,sans-serif;display:flex;flex-direction:column">
        <div style="font-size:24px;font-weight:800;color:#4f8ef7;margin-bottom:20px;text-align:center">Termos de Uso e LGPD</div>
        
        <div style="flex:1;background:#1e2a45;border-radius:14px;padding:20px;overflow-y:auto;border:1px solid #2a3a55;margin-bottom:20px;font-size:14px;line-height:1.6;color:#a0aec0">
          <p style="margin-bottom:12px;color:#eaf0fb;font-weight:600">Olá, ${user.nome_completo || 'Promotor'}!</p>
          <p style="margin-bottom:12px">Para operar no sistema JET·OPS, precisamos tratar alguns de seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD).</p>
          
          <div style="background:rgba(79,142,247,0.1);border-left:4px solid #4f8ef7;padding:12px;margin-bottom:16px;border-radius:0 8px 8px 0">
            <strong style="color:#4f8ef7;display:block;margin-bottom:4px">📍 Localização (GPS)</strong>
            ${textoRastreio}
          </div>

          <p style="margin-bottom:12px">Utilizamos seus dados para:
            <br>• Validar presença nos pontos de venda.
            <br>• Gerar indicadores de performance.
            <br>• Garantir a segurança durante o turno.
          </p>

          <p>Você pode revogar este consentimento a qualquer momento entrando em contato com a gestão, porém isso impedirá o uso do aplicativo para operação.</p>
        </div>

        ${!isCLT ? `
        <div style="background:#1e2a45;border-radius:14px;padding:16px;margin-bottom:16px;border:1px solid #2a3a55">
          <label style="display:flex;align-items:center;gap:12px;cursor:pointer">
            <input type="checkbox" id="check-continuo" checked style="width:20px;height:20px;accent-color:#4f8ef7"/>
            <span style="font-size:14px;color:#eaf0fb">Desejo habilitar o <b>rastreamento contínuo</b> (Recomendado)</span>
          </label>
        </div>
        ` : ''}

        <button id="btn-aceitar-lgpd" onclick="auth._aceitarLGPD()"
          style="background:#4f8ef7;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:700;padding:18px;width:100%;cursor:pointer">
          Concordo e Desejo Continuar
        </button>
      </div>
    `;
  },

  async _aceitarLGPD() {
    const btn = document.getElementById('btn-aceitar-lgpd');
    const checkContinuo = document.getElementById('check-continuo');
    const rastreioContinuo = checkContinuo ? checkContinuo.checked : true; // CLT sempre true

    if (btn) { btn.disabled = true; btn.textContent = 'Gravando...'; }

    try {
      const res = await api.post({ evento: 'ACEITAR_LGPD' });
      if (res.ok) {
        const me = await api.get('GET_ME');
        if (me.ok) {
          const user = me.user || me.dados;
          // Salva preferência local de rastreio para MEIs
          state.set('pref_rastreio_continuo', rastreioContinuo);
          state.setPromotor(user);
          this._rotearPorPerfil(user);
        }
      } else {
        alert('Erro ao salvar aceite: ' + (res.erro || res.mensagem || 'Erro desconhecido.'));
        if (btn) { btn.disabled = false; btn.textContent = 'Concordo e Desejo Continuar'; }
      }
    } catch(e) {
      alert('Sem conexão.');
      if (btn) { btn.disabled = false; btn.textContent = 'Concordo e Desejo Continuar'; }
    }
  },

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
    const link = 'https://promo-telegram-gateway-476120210909.southamerica-east1.run.app/indicacao?ref=' + p.user_id;
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
            <button onclick="homeScreen._abrirIA()" style="background:#1e2a45;border:1px solid #4f8ef744;border-radius:12px;padding:16px 8px;color:#eaf0fb;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;font-weight:600">
              <span style="font-size:20px">🤖</span>Assistente IA
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

    this._verificarAvisos();
  },

  async _verificarAvisos() {
    try {
      const res = await api.get('GET_MURAL_AVISOS');
      if (res.ok && res.avisos?.length) {
        const modalId = 'modal-avisos-mural';
        if (document.getElementById(modalId)) return;

        const m = document.createElement('div');
        m.id = modalId;
        m.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
        
        const aviso = res.avisos[0]; // Mostra o mais recente ou percorre
        const cor = aviso.criticidade === 'URGENTE' ? '#fc8181' : '#4f8ef7';

        m.innerHTML = `
          <div style="background:#16213e;border:1px solid ${cor};border-radius:16px;width:100%;max-width:400px;padding:24px;position:relative">
            <div style="background:${cor}22;color:${cor};font-size:10px;font-weight:800;padding:4px 8px;border-radius:4px;display:inline-block;margin-bottom:12px;letter-spacing:1px">COMUNICADO ${aviso.criticidade}</div>
            <h2 style="font-size:20px;font-weight:700;margin:0 0 12px 0;color:#fff">${aviso.titulo}</h2>
            <div style="font-size:14px;color:#a0aec0;line-height:1.6;margin-bottom:24px">${aviso.mensagem.replace(/\n/g, '<br>')}</div>
            <button onclick="document.getElementById('${modalId}').remove()" 
              style="background:${cor};color:#fff;border:none;border-radius:10px;padding:14px;width:100%;font-size:15px;font-weight:700;cursor:pointer">
              ENTENDIDO
            </button>
          </div>
        `;
        document.body.appendChild(m);
      }
    } catch(e) {}
  },

  async _pedirPush() {
    if (Notification.permission === 'denied') {
      alert('⚠️ Notificações Bloqueadas!\n\nVocê bloqueou as notificações. Para ativar:\n1. Clique no cadeado (🔒) na barra de endereço\n2. Ative "Notificações"\n3. Recarregue a página.');
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
  },

  _abrirIA() {
    const modalId = 'modal-ia-assistant';
    if (document.getElementById(modalId)) return;

    const m = document.createElement('div');
    m.id = modalId;
    m.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;flex-direction:column;padding:20px;';
    m.innerHTML = `
      <div style="background:#16213e;border:1px solid #4f8ef744;border-radius:20px;width:100%;max-width:500px;margin:auto;display:flex;flex-direction:column;max-height:80vh;overflow:hidden">
        <div style="padding:16px;border-bottom:1px solid #2a3a55;display:flex;justify-content:space-between;align-items:center;background:#1e2a45">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:24px">🤖</span>
            <div>
              <div style="font-size:14px;font-weight:700">Assistente JET</div>
              <div style="font-size:10px;color:#68d391">Online e pronto para ajudar</div>
            </div>
          </div>
          <button onclick="document.getElementById('${modalId}').remove()" style="background:none;border:none;color:#718096;font-size:24px;cursor:pointer">×</button>
        </div>
        
        <div id="ia-chat-box" style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px">
          <div style="background:#0a0f1e;padding:12px 16px;border-radius:14px 14px 14px 0;align-self:flex-start;max-width:85%;font-size:14px;line-height:1.5">
            Olá! Eu sou o assistente de IA da JET. Posso tirar dúvidas sobre módulos do <b>Academy</b>, regras da <b>Calculadora</b> ou sobre o <b>Clima</b>. O que deseja saber?
          </div>
        </div>

        <div style="padding:16px;background:#1e2a45;display:flex;gap:10px">
          <input type="text" id="ia-pergunta" placeholder="Digite sua dúvida aqui..." 
            style="flex:1;background:#0a0f1e;border:1px solid #2a3a55;border-radius:10px;padding:12px;color:#fff;font-size:14px;outline:none"
            onkeydown="if(event.key==='Enter') homeScreen._enviarPerguntaIA()" />
          <button onclick="homeScreen._enviarPerguntaIA()" 
            style="background:#4f8ef7;border:none;border-radius:10px;width:44px;height:44px;color:#fff;font-size:18px;cursor:pointer">🚀</button>
        </div>
      </div>
    `;
    document.body.appendChild(m);
  },

  async _enviarPerguntaIA() {
    const input = document.getElementById('ia-pergunta');
    const box = document.getElementById('ia-chat-box');
    const pergunta = input.value.trim();
    if (!pergunta) return;

    // Add user message
    const uMsg = document.createElement('div');
    uMsg.style.cssText = 'background:#4f8ef7;color:#fff;padding:12px 16px;border-radius:14px 14px 0 14px;align-self:flex-end;max-width:85%;font-size:14px;line-height:1.5';
    uMsg.textContent = pergunta;
    box.appendChild(uMsg);
    input.value = '';
    box.scrollTop = box.scrollHeight;

    // Add loading
    const lMsg = document.createElement('div');
    lMsg.id = 'ia-loading';
    lMsg.style.cssText = 'background:#0a0f1e;color:#718096;padding:12px 16px;border-radius:14px 14px 14px 0;align-self:flex-start;font-size:13px';
    lMsg.textContent = 'Digitando...';
    box.appendChild(lMsg);
    box.scrollTop = box.scrollHeight;

    try {
      const res = await api.get('ASK_IA_ASSISTANTE', { pergunta });
      lMsg.remove();
      const aMsg = document.createElement('div');
      aMsg.style.cssText = 'background:#0a0f1e;color:#eaf0fb;padding:12px 16px;border-radius:14px 14px 14px 0;align-self:flex-start;max-width:85%;font-size:14px;line-height:1.5;border:1px solid #2a3a55';
      aMsg.innerHTML = res.resposta.replace(/\n/g, '<br>');
      box.appendChild(aMsg);
      box.scrollTop = box.scrollHeight;
    } catch(e) {
      lMsg.textContent = 'Erro ao conectar. Tente novamente.';
    }
  }
};
