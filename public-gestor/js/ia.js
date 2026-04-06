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
          <h3 style="font-size:13px;color:#63b3ed;margin-bottom:10px">COMO FUNCIONA?</h3>
          <p style="font-size:12px;color:#718096;line-height:1.6">
            O Gemini analisa em tempo real os <b>KPIs de presença</b>, o status dos <b>slots</b> e, principalmente, o texto das <b>ocorrências</b> enviadas pelos promotores. 
            Ele busca padrões que humanos podem demorar a notar, como problemas recorrentes em uma zona específica ou quedas de performance causadas por fatores externos.
          </p>
        </div>
      </div>
    `;
  }

  return { render: loadData };
})();
