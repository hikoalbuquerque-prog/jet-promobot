// ─── auth.js ──────────────────────────────────────────────────────────────────
// Login do gestor — estilos 100% inline

const auth = (() => {

  function renderLogin() {
    document.body.style.cssText = `margin:0;padding:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0f1e;font-family:'IBM Plex Mono',monospace;`;

    document.body.innerHTML = `
      <div style="width:100%;max-width:420px;padding:48px 40px;background:rgba(255,255,255,0.03);border:1px solid rgba(99,179,237,0.2);border-radius:4px;box-shadow:0 0 60px rgba(99,179,237,0.05);">
        <div style="margin-bottom:40px;">
          <div style="font-size:11px;letter-spacing:4px;color:#63b3ed;text-transform:uppercase;margin-bottom:12px;">JET PromoBot</div>
          <div style="font-size:28px;font-weight:700;color:#e2e8f0;line-height:1.2;">Painel do<br>Gestor</div>
          <div style="width:40px;height:2px;background:#63b3ed;margin-top:16px;"></div>
        </div>

        <div style="margin-bottom:24px;">
          <label style="display:block;font-size:11px;letter-spacing:2px;color:#718096;text-transform:uppercase;margin-bottom:8px;">Token de acesso</label>
          <input id="inp-token" type="password" placeholder="••••••••••••"
            autocomplete="off" spellcheck="false"
            style="width:100%;box-sizing:border-box;padding:14px 16px;background:#0d1526;border:1px solid rgba(99,179,237,0.3);border-radius:3px;color:#e2e8f0;font-family:'IBM Plex Mono',monospace;font-size:14px;outline:none;"
            onfocus="this.style.borderColor='#63b3ed'" onblur="this.style.borderColor='rgba(99,179,237,0.3)'"
          />
        </div>

        <div id="login-error" style="display:none;margin-bottom:16px;padding:10px 14px;background:rgba(252,129,129,0.1);border:1px solid rgba(252,129,129,0.3);border-radius:3px;color:#fc8181;font-size:12px;"></div>

        <button id="btn-login" style="width:100%;padding:14px;background:#63b3ed;color:#0a0f1e;border:none;border-radius:3px;font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer;">Entrar</button>
        <div id="login-loading" style="display:none;text-align:center;margin-top:20px;font-size:11px;color:#718096;letter-spacing:2px;">AUTENTICANDO...</div>

        <div id="pwa-install-wrap" style="display:none;margin-top:16px;">
          <button id="pwa-install-btn" onclick="auth._instalarPWA()"
            style="width:100%;padding:11px;border:1px solid rgba(99,179,237,0.4);border-radius:3px;background:transparent;color:#63b3ed;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer;">
            📲 INSTALAR PAINEL
          </button>
        </div>
        <div id="pwa-ios-wrap" style="display:none;margin-top:12px;padding:10px 12px;border:1px solid rgba(99,179,237,0.2);border-radius:3px;font-size:11px;color:#718096;text-align:center;line-height:1.6;font-family:'IBM Plex Mono',monospace;">
          iOS: Compartilhar → <span style="color:#63b3ed;">Adicionar à Tela Inicial</span>
        </div>

      </div>`;

    document.getElementById('btn-login').addEventListener('click', _doLogin);
    document.getElementById('inp-token').addEventListener('keydown', e => { if (e.key === 'Enter') _doLogin(); });
    document.getElementById('inp-token').focus();
  }

  async function _doLogin() {
    const token = document.getElementById('inp-token').value.trim();
    if (!token) { _showError('Informe o token de acesso.'); return; }

    document.getElementById('btn-login').style.display = 'none';
    document.getElementById('login-loading').style.display = 'block';
    document.getElementById('login-error').style.display = 'none';

    try {
      // GET_ME via Apps Script
      const url = new URL(CONFIG.APPS_SCRIPT_URL);
      url.searchParams.set('evento', 'GET_ME');
      url.searchParams.set('token', token);
      const res = await fetch(url.toString()).then(r => r.json());

      // Apps Script retorna { ok: true, user: {...} }
      if (!res.ok || !res.user) {
        throw new Error(res.erro || res.mensagem || 'Token inválido.');
      }

      const user = res.user;
      const role = (user.tipo_vinculo || '').toUpperCase();

      if (!CONFIG.GESTOR_ROLES.includes(role)) {
        throw new Error(`Perfil "${role}" não autorizado. Use o app do promotor.`);
      }

      state.set('gestor', {
        token,
        nome:         user.nome_completo || user.nome || '',
        cargo:        user.cargo_principal || '',
        tipo_vinculo: role,
        user_id:      user.user_id || '',
        equipe_id:    user.equipe_id || null,
        cidade_base:  user.cidade_base || '',
      });

      const isFiscal = (user.cargo_principal || '').toUpperCase() === 'FISCAL';
      router.navigate(isFiscal ? 'mapa' : 'dashboard');

    } catch (err) {
      document.getElementById('btn-login').style.display = 'block';
      document.getElementById('login-loading').style.display = 'none';
      _showError(err.message);
    }
  }

  function _showError(msg) {
    const el = document.getElementById('login-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  }

  function logout() {
    state.clear();
    router.navigate('login');
  }

  function _instalarPWA() {
    if (window.__pwaPrompt) {
      window.__pwaPrompt.prompt();
      window.__pwaPrompt.userChoice.then(function(result) {
        window.__pwaPrompt = null;
        var wrap = document.getElementById('pwa-install-wrap');
        if (wrap) wrap.style.display = 'none';
      });
    }
  }

  return { renderLogin, logout, _instalarPWA };
})();