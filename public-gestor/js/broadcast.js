const broadcast = {
  render() {
    document.getElementById('app').innerHTML =
      '<div style="min-height:100vh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">'
      + '<div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:12px">'
      + '<button onclick="router.back()" style="background:#1e2a45;border:none;color:#eaf0fb;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer">&#8249;</button>'
      + '<div style="font-size:17px;font-weight:700">&#128226; Broadcast</div>'
      + '</div>'
      + '<div style="padding:16px;display:flex;flex-direction:column;gap:14px">'

      // Info
      + '<div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:14px">'
      + '<div style="font-size:12px;font-weight:700;color:#63b3ed;margin-bottom:6px">SOBRE O BROADCAST</div>'
      + '<div style="font-size:13px;color:#a0aec0">Envia mensagem no privado do Telegram para todos os promotores vinculados. Suporta HTML basico: &lt;b&gt;negrito&lt;/b&gt;, &lt;i&gt;italico&lt;/i&gt;.</div>'
      + '</div>'

      // Campo de mensagem
      + '<div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px">'
      + '<div style="font-size:12px;font-weight:700;color:#a0aec0;margin-bottom:8px">MENSAGEM</div>'
      + '<textarea id="bc-msg" placeholder="Digite sua mensagem..." style="width:100%;background:#0a0f1e;border:1px solid #2a3a55;border-radius:8px;color:#eaf0fb;font-size:14px;padding:12px;resize:vertical;min-height:120px;box-sizing:border-box"></textarea>'
      + '</div>'

      // Preview
      + '<div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:14px">'
      + '<div style="font-size:12px;font-weight:700;color:#a0aec0;margin-bottom:8px">PREVIEW</div>'
      + '<div id="bc-preview" style="font-size:13px;color:#eaf0fb;min-height:40px;background:#0a0f1e;border-radius:8px;padding:10px">A mensagem aparecera aqui...</div>'
      + '</div>'

      // Botao
      + '<button onclick="broadcast._enviar()" id="bc-btn" style="background:linear-gradient(135deg,#4f8ef7,#2b6cb0);border:none;color:#fff;padding:14px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer">'
      + '&#128226; Enviar para todos os promotores</button>'

      + '<div id="bc-result" style="display:none;padding:14px;border-radius:12px;font-size:14px;text-align:center"></div>'
      + '</div></div>';

    // Live preview
    document.getElementById('bc-msg').addEventListener('input', function() {
      document.getElementById('bc-preview').innerHTML = this.value || 'A mensagem aparecera aqui...';
    });
  },

  async _enviar() {
    const msg = document.getElementById('bc-msg').value.trim();
    if (!msg) { alert('Digite uma mensagem'); return; }
    if (!confirm('Enviar para TODOS os promotores com Telegram vinculado?')) return;

    const btn = document.getElementById('bc-btn');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
      const res = await fetch('https://promo-telegram-gateway-v3-476120210909.southamerica-east1.run.app/gestor/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: msg, token: state.getToken() })
      });
      const data = await res.json();
      const result = document.getElementById('bc-result');
      result.style.display = 'block';
      if (data.ok) {
        result.style.background = 'rgba(104,211,145,0.15)';
        result.style.color = '#68d391';
        result.textContent = 'Enviado para ' + data.enviados + ' promotores!' + (data.erros > 0 ? ' (' + data.erros + ' erros)' : '');
        document.getElementById('bc-msg').value = '';
        document.getElementById('bc-preview').innerHTML = 'A mensagem aparecera aqui...';
      } else {
        result.style.background = 'rgba(252,129,129,0.15)';
        result.style.color = '#fc8181';
        result.textContent = 'Erro: ' + (data.erro || 'Erro desconhecido');
      }
    } catch(e) {
      alert('Erro de conexao: ' + e.message);
    }
    btn.disabled = false;
    btn.textContent = '&#128226; Enviar para todos os promotores';
  }
};
