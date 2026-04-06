// ─── ia.js ──────────────────────────────────────────────────────────────────
// Tela de Insights e Recomendações geradas por IA (Gemini)

const iaScreen = (() => {
  let _insight = "";
  let _loading = false;

  async function loadData() {
    _loading = true;
    _insight = "";
    render();
    try {
      const res = await api.get('GET_IA_INSIGHTS');
      _insight = res.insight || "Nenhum insight disponível.";
    } catch (e) {
      _insight = "Erro ao conectar com a Inteligência Artificial: " + e.message;
    } finally {
      _loading = false;
      render();
    }
  }

  function render() {
    const main = document.getElementById('app');
    if (!main) return;

    if (_loading) {
      main.innerHTML = `
        <div class="screen" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh">
          <div class="ia-loader" style="font-size:40px;margin-bottom:20px">🤖</div>
          <div style="color:#63b3ed;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:12px">Analisando dados da operação...</div>
          <div style="color:#4a5568;font-size:11px;margin-top:8px">O Gemini está processando as ocorrências e KPIs.</div>
        </div>
        <style>
          .ia-loader { animation: pulse-ia 1.5s infinite ease-in-out; }
          @keyframes pulse-ia { 0% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1); opacity: 0.5; } }
        </style>
      `;
      return;
    }

    main.innerHTML = `
      <div class="screen">
        <div class="screen-header">
          <h1 class="screen-title">🤖 Insights de Inteligência Artificial</h1>
          <button class="btn-success" style="font-size:11px;padding:6px 12px" onclick="iaScreen.render()">↻ Atualizar Análise</button>
        </div>

        <div class="card" style="margin-top:20px;border-left:4px solid #63b3ed;background:linear-gradient(to right, rgba(99,179,237,0.05), transparent)">
          <div class="card-body" style="padding:30px">
            <div style="display:flex;gap:20px;align-items:flex-start">
              <div style="font-size:32px">💡</div>
              <div style="flex:1;line-height:1.8;color:#eaf0fb;font-size:15px">
                ${_insight ? _insight.replace(/\n/g, '<br>') : 'Clique no botão acima para gerar uma nova análise da operação.'}
              </div>
            </div>
          </div>
        </div>

        <div style="margin-top:30px;background:rgba(0,0,0,0.2);padding:20px;border-radius:12px;border:1px dashed rgba(255,255,255,0.05)">
          <h3 style="font-size:13px;color:#63b3ed;margin-bottom:10px">🔍 RADAR DE RETENÇÃO (PREDIÇÃO DE CHURN)</h3>
          <p style="font-size:12px;color:#718096;line-height:1.6;margin-bottom:15px">
            Verifique o risco de desengajamento de um promotor específico. A IA analisa o padrão de frequência (dias úteis vs FDS), a queda no score e o engajamento com as pílulas diárias.
          </p>
          <div style="display:flex;gap:10px">
            <input type="text" id="churn-user-id" class="modal-textarea" style="margin:0;flex:1" placeholder="Digite o User ID ou use o autocomplete" list="list-promotores-all" />
            <button class="btn-success" onclick="iaScreen.analisarChurn()" style="white-space:nowrap">Analisar Risco</button>
          </div>
          <div id="churn-result" style="margin-top:15px;display:none;padding:15px;background:rgba(0,0,0,0.3);border-radius:8px;font-size:13px;line-height:1.5;color:#eaf0fb;border-left:3px solid #f6ad55">
            <!-- Resultado da IA -->
          </div>
        </div>

        <div style="margin-top:30px;background:rgba(0,0,0,0.2);padding:20px;border-radius:12px;border:1px dashed rgba(255,255,255,0.05)">
          <h3 style="font-size:13px;color:#63b3ed;margin-bottom:10px">COMO FUNCIONA?</h3>
          <p style="font-size:12px;color:#718096;line-height:1.6">
            O Gemini analisa em tempo real os <b>KPIs de presença</b>, o status dos <b>slots</b> e, principalmente, o texto das <b>ocorrências</b> enviadas pelos promotores. 
            Ele busca padrões que humanos podem demorar a notar, como problemas recorrentes em uma zona específica ou quedas de performance causadas por fatores externos.
          </p>
        </div>
      </div>
    `;
  }

  async function analisarChurn() {
    const uid = document.getElementById('churn-user-id').value.trim();
    if (!uid) return alert('Selecione um promotor.');

    const resBox = document.getElementById('churn-result');
    resBox.style.display = 'block';
    resBox.innerHTML = '<i>Processando dados históricos e gerando predição...</i>';

    try {
      const res = await api.get('GET_CHURN_PREDICTION', { user_id: uid });
      if (res.ok) {
        resBox.innerHTML = `
          <div style="font-weight:700;color:#63b3ed;margin-bottom:8px">Análise para: ${res.nome}</div>
          <div style="margin-bottom:10px;font-size:11px;color:#a0aec0">
            📊 30 dias: ${res.stats.diasUteis} dias úteis / ${res.stats.diasFDS} FDS<br>
            💊 Pílulas: ${res.stats.pilulasCompletas} respondidas<br>
            📈 Tendência Score: ${res.stats.tendencia >= 0 ? '+' : ''}${res.stats.tendencia} pts
          </div>
          <div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:6px;color:#fff">
            ${res.prediction.replace(/\n/g, '<br>')}
          </div>
        `;
      } else {
        resBox.innerHTML = '<span style="color:#fc8181">' + res.erro + '</span>';
      }
    } catch (e) {
      resBox.innerHTML = '<span style="color:#fc8181">Erro na comunicação.</span>';
    }
  }

  return { render: loadData, analisarChurn };
})();
