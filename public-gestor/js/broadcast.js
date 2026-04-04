const broadcast = {
  async render() {
    document.getElementById('app').innerHTML = `
      <section class="screen" id="screen-broadcast">
        <div class="screen-header">
          <div style="width:40px;height:40px;background:rgba(99,179,237,0.1);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#63b3ed;font-size:20px">📢</div>
          <div>
            <h2 class="screen-title">Broadcast</h2>
            <div style="font-size:12px;color:#718096;margin-top:2px">Envio de comunicados via Telegram</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 320px;gap:24px">
          
          <!-- Lado Esquerdo: Formulário -->
          <div style="display:flex;flex-direction:column;gap:20px">
            
            <div class="card">
              <div class="card-header"><span class="card-title">Configurar Envio</span></div>
              <div class="card-body">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                  <div>
                    <label class="modal-label">Cidade Destino</label>
                    <select id="bc-cidade" class="modal-textarea" style="margin-top:6px;height:42px">
                      <option value="">Todas as cidades</option>
                    </select>
                  </div>
                  <div>
                    <label class="modal-label">Cargo Destino</label>
                    <select id="bc-cargo" class="modal-textarea" style="margin-top:6px;height:42px">
                      <option value="">Todos os cargos</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label class="modal-label">Mensagem (Suporta HTML básico)</label>
                  <textarea id="bc-msg" class="modal-textarea" placeholder="Ex: Olá <b>promotor</b>, temos novidades..." 
                    style="margin-top:6px;min-height:150px" oninput="broadcast._updatePreview()"></textarea>
                </div>
              </div>
              <div class="card-actions">
                <button onclick="broadcast._enviar()" id="bc-btn" class="btn-success" style="flex:1">🚀 DISPARAR PARA TELEGRAM</button>
              </div>
            </div>

            <div id="bc-result" style="display:none;padding:16px;border-radius:12px;font-size:14px;text-align:center;font-weight:600"></div>
          </div>

          <!-- Lado Direito: Preview e Dicas -->
          <div style="display:flex;flex-direction:column;gap:20px">
            <div class="card">
              <div class="card-header"><span class="card-title">Preview no Celular</span></div>
              <div class="card-body" style="background:#0a0f1e;min-height:200px;border-radius:0 0 12px 12px;padding:16px;position:relative">
                <div style="background:#1e2a45;padding:12px;border-radius:12px 12px 12px 0;max-width:90%;font-size:14px;line-height:1.4;color:#eaf0fb;box-shadow:0 2px 8px rgba(0,0,0,0.2)" id="bc-preview">
                  Sua mensagem aparecerá aqui...
                </div>
                <div style="font-size:10px;color:#4a5568;margin-top:8px;font-family:'IBM Plex Mono',monospace">TELEGRAM PREVIEW</div>
              </div>
            </div>

            <div class="card" style="background:rgba(99,179,237,0.05);border-color:rgba(99,179,237,0.2)">
              <div class="card-body" style="font-size:12px;color:#a0aec0;gap:8px">
                <strong style="color:#63b3ed">DICAS DE FORMATAÇÃO:</strong>
                <div>• &lt;b&gt;<b>Negrito</b>&lt;/b&gt;</div>
                <div>• &lt;i&gt;<i>Itálico</i>&lt;/i&gt;</div>
                <div>• &lt;code&gt;<code>Código</code>&lt;/code&gt;</div>
                <div style="margin-top:8px;font-size:11px;font-style:italic">O envio é feito apenas para promotores que possuem o Telegram vinculado e status ATIVO ou EM CAMPO.</div>
              </div>
            </div>
          </div>

        </div>
      </section>`;

    this._loadFilters();
  },

  async _loadFilters() {
    try {
      const res = await api.get('GET_BROADCAST_FILTERS');
      if (res.ok) {
        const selCid = document.getElementById('bc-cidade');
        const selCar = document.getElementById('bc-cargo');
        res.cidades.forEach(c => selCid.innerHTML += `<option value="${c}">${c}</option>`);
        res.cargos.forEach(c => selCar.innerHTML += `<option value="${c}">${c}</option>`);
      }
    } catch(e) { console.error('Erro filtros:', e); }
  },

  _updatePreview() {
    const msg = document.getElementById('bc-msg').value.trim();
    const preview = document.getElementById('bc-preview');
    if (!msg) {
      preview.innerHTML = '<span style="color:#4a5568">Sua mensagem aparecerá aqui...</span>';
      return;
    }
    // Sanitização básica apenas para o preview não quebrar a UI do painel
    preview.innerHTML = msg.replace(/\n/g, '<br>');
  },

  async _enviar() {
    const msg = document.getElementById('bc-msg').value.trim();
    const cidade = document.getElementById('bc-cidade').value;
    const cargo = document.getElementById('bc-cargo').value;

    if (!msg) { ui.toast('Digite uma mensagem', 'warning'); return; }
    if (!confirm('CONFIRMAR DISPARO?\n\nEsta mensagem será enviada individualmente para todos os promotores filtrados.')) return;

    const btn = document.getElementById('bc-btn');
    btn.disabled = true; btn.textContent = 'PROCESSANDO DISPARO...';

    try {
      const res = await api.post('BROADCAST_PROMOTORES', { mensagem: msg, cidade, cargo });
      const result = document.getElementById('bc-result');
      result.style.display = 'block';
      
      if (res.ok) {
        result.style.background = 'rgba(72,187,120,0.15)';
        result.style.color = '#68d391';
        result.style.border = '1px solid rgba(72,187,120,0.3)';
        result.textContent = `✅ SUCESSO! Mensagem enviada para ${res.enviados} promotores.`;
        document.getElementById('bc-msg').value = '';
        this._updatePreview();
        ui.toast('Broadcast concluído!', 'success');
      } else {
        result.style.background = 'rgba(229,62,62,0.15)';
        result.style.color = '#fc8181';
        result.style.border = '1px solid rgba(229,62,62,0.3)';
        result.textContent = '❌ FALHA: ' + (res.erro || 'Erro desconhecido');
      }
    } catch(e) { 
      ui.toast('Erro na conexão com o servidor', 'error');
    }
    btn.disabled = false; btn.textContent = '🚀 DISPARAR PARA TELEGRAM';
  }
};