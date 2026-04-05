// ─── relatorios.js ──────────────────────────────────────────────────────────
// Exportação de dados e relatórios consolidados

const relatoriosScreen = (() => {
  function render() {
    const main = document.getElementById('app');
    if (!main) return;

    main.innerHTML = `
      <div class="screen">
        <div class="screen-header">
          <h1 class="screen-title">📄 Relatórios e Exportação</h1>
          <div class="screen-subtitle">Extração de dados consolidados</div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;margin-top:20px">
          
          <div class="card">
            <div class="card-header">
              <div class="card-title">Jornadas MEI</div>
            </div>
            <div class="card-body">
              <p style="font-size:12px;color:#718096">Exportação de check-ins, checkouts e motivos de ocorrência por período.</p>
              <div style="display:flex;gap:10px;margin-top:10px">
                <input type="date" id="rep-jor-inicio" class="modal-textarea" style="margin:0" />
                <input type="date" id="rep-jor-fim" class="modal-textarea" style="margin:0" />
              </div>
            </div>
            <div class="card-actions">
              <button class="btn-success" style="flex:1" onclick="relatoriosScreen.exportar('JORNADAS')">Exportar CSV</button>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">Score & Ranking</div>
            </div>
            <div class="card-body">
              <p style="font-size:12px;color:#718096">Consolidado de pontos por promotor para fechamento de bonificação.</p>
              <select id="rep-score-periodo" class="modal-textarea" style="margin-top:10px">
                <option value="SEMANAL">Semana Atual</option>
                <option value="MENSAL">Mês Atual</option>
                <option value="GERAL">Histórico Geral</option>
              </select>
            </div>
            <div class="card-actions">
              <button class="btn-success" style="flex:1" onclick="relatoriosScreen.exportar('SCORE')">Exportar CSV</button>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">Auditoria de GPS</div>
            </div>
            <div class="card-body">
              <p style="font-size:12px;color:#718096">Relatório de jornadas com baixo trust score ou dispositivos duplicados.</p>
            </div>
            <div class="card-actions">
              <button class="btn-success" style="flex:1" onclick="relatoriosScreen.exportar('FRAUDES')">Ver Relatório</button>
            </div>
          </div>

        </div>
      </div>
    `;
    
    // Set default dates
    const hoje = new Date().toISOString().split('T')[0];
    const trintaDias = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    if (document.getElementById('rep-jor-inicio')) document.getElementById('rep-jor-inicio').value = trintaDias;
    if (document.getElementById('rep-jor-fim')) document.getElementById('rep-jor-fim').value = hoje;
  }

  async function exportar(tipo) {
    ui.toast('Gerando relatório...', 'info');
    try {
      let params = {};
      if (tipo === 'JORNADAS') {
        params = { de: document.getElementById('rep-jor-inicio').value, ate: document.getElementById('rep-jor-fim').value };
      } else if (tipo === 'SCORE') {
        params = { periodo: document.getElementById('rep-score-periodo').value };
      }

      const res = await api.get('GET_RELATORIO_EXPORT', { tipo, ...params });
      if (res.ok && res.csv) {
        _downloadCSV(`relatorio_\${tipo.toLowerCase()}_\${new Date().getTime()}.csv`, res.csv);
      } else {
        alert('Erro ao gerar relatório: ' + (res.erro || 'Vazio'));
      }
    } catch (e) {
      alert('Falha na exportação: ' + e.message);
    }
  }

  function _downloadCSV(filename, text) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  return { render, exportar };
})();
