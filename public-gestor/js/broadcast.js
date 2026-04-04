const broadcast = {
  async render() {
    document.getElementById('app').innerHTML = `
      <div style="min-height:100vh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
        <div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:12px">
          <button onclick="router.back()" style="background:#1e2a45;border:none;color:#eaf0fb;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer">&#8249;</button>
          <div style="font-size:17px;font-weight:700">📢 Broadcast</div>
        </div>
        <div style="padding:16px;display:flex;flex-direction:column;gap:14px" id="bc-container">
          <div style="text-align:center;padding:40px;color:#a0aec0">Carregando filtros...</div>
        </div>
      </div>`;

    try {
      const res = await api.get('GET_BROADCAST_FILTERS');
      this._renderForm(res);
    } catch(e) {
      document.getElementById('bc-container').innerHTML = `<div style="color:#fc8181">Erro ao carregar: ${e.message}</div>`;
    }
  },

  _renderForm(filtros) {
    const container = document.getElementById('bc-container');
    const cidades = filtros.cidades || [];
    const cargos = filtros.cargos || [];

    container.innerHTML = `
      <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:14px">
        <div style="font-size:12px;font-weight:700;color:#63b3ed;margin-bottom:6px">SOBRE O BROADCAST</div>
        <div style="font-size:13px;color:#a0aec0">Envia mensagem no privado do Telegram.</div>
      </div>

      <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px">
        <div>
          <div style="font-size:11px;color:#a0aec0;margin-bottom:4px">CIDADE</div>
          <select id="bc-cidade" style="width:100%;background:#0a0f1e;border:1px solid #2a3a55;border-radius:8px;color:#eaf0fb;font-size:14px;padding:12px">
            <option value="">Todas as cidades</option>
            ${cidades.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <div style="font-size:11px;color:#a0aec0;margin-bottom:4px">CARGO</div>
          <select id="bc-cargo" style="width:100%;background:#0a0f1e;border:1px solid #2a3a55;border-radius:8px;color:#eaf0fb;font-size:14px;padding:12px">
            <option value="">Todos os cargos</option>
            ${cargos.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
      </div>

      <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px">
        <div style="font-size:12px;font-weight:700;color:#a0aec0;margin-bottom:8px">MENSAGEM</div>
        <textarea id="bc-msg" placeholder="Digite sua mensagem..." style="width:100%;background:#0a0f1e;border:1px solid #2a3a55;border-radius:8px;color:#eaf0fb;font-size:14px;padding:12px;resize:vertical;min-height:120px;box-sizing:border-box"></textarea>
      </div>

      <button onclick="broadcast._enviar()" id="bc-btn" style="background:linear-gradient(135deg,#4f8ef7,#2b6cb0);border:none;color:#fff;padding:16px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer">
        🚀 Enviar Mensagem
      </button>

      <div id="bc-result" style="display:none;padding:14px;border-radius:12px;font-size:14px;text-align:center"></div>
    `;
  },

  async _enviar() {
    const msg = document.getElementById('bc-msg').value.trim();
    const cidade = document.getElementById('bc-cidade').value;
    const cargo = document.getElementById('bc-cargo').value;

    if (!msg) { alert('Digite uma mensagem'); return; }
    if (!confirm('Deseja enviar este broadcast para o segmento selecionado?')) return;

    const btn = document.getElementById('bc-btn');
    btn.disabled = true; btn.textContent = 'Enviando...';

    try {
      const res = await api.post('BROADCAST_PROMOTOR', { mensagem: msg, cidade, cargo });
      const result = document.getElementById('bc-result');
      result.style.display = 'block';
      if (res.ok) {
        result.style.background = 'rgba(104,211,145,0.15)';
        result.style.color = '#68d391';
        result.textContent = `Sucesso! Enviado para ${res.enviados} promotores.`;
        document.getElementById('bc-msg').value = '';
      } else {
        result.style.background = 'rgba(252,129,129,0.15)';
        result.style.color = '#fc8181';
        result.textContent = 'Erro: ' + res.erro;
      }
    } catch(e) { alert('Erro: ' + e.message); }
    btn.disabled = false; btn.textContent = '🚀 Enviar Mensagem';
  }
};
