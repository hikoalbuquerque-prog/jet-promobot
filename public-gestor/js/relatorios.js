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

          <div class="card">
            <div class="card-header">
              <div class="card-title">Mural de Avisos</div>
            </div>
            <div class="card-body">
              <p style="font-size:12px;color:#718096">Publicar comunicados para equipes específicas no App do Promotor.</p>
            </div>
            <div class="card-actions">
              <button class="btn-success" style="flex:1" onclick="relatoriosScreen.abrirModalMural()">Publicar Aviso</button>
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
        _downloadCSV(`relatorio_${tipo.toLowerCase()}_${new Date().getTime()}.csv`, res.csv);
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

  async function abrirModalMural() {
    let equipes = [];
    try {
      const res = await api.getEquipes();
      equipes = res.equipes || [];
    } catch(e) {}

    const m = document.createElement('div');
    m.id = 'modal-mural';
    m.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    m.innerHTML = `
      <div class="modal-box" style="width:100%;max-width:450px">
        <div class="modal-title">Novo Aviso no Mural</div>
        <div class="modal-body" style="margin-top:20px">
          <label class="modal-label">Equipe Destino</label>
          <select id="mur-equipe" class="modal-textarea">
            <option value="*">TODAS AS EQUIPES</option>
            ${equipes.map(eq => `<option value="${eq.equipe_id}">${eq.nome_equipe} (${eq.cidade})</option>`).join('')}
          </select>

          <label class="modal-label">Título</label>
          <input type="text" id="mur-titulo" class="modal-textarea" placeholder="Ex: Mudança de Ponto" />

          <label class="modal-label">Mensagem</label>
          <textarea id="mur-msg" class="modal-textarea" rows="4" placeholder="Digite o comunicado..."></textarea>

          <label class="modal-label">Criticidade</label>
          <select id="mur-crit" class="modal-textarea">
            <option value="INFO">INFORMATIVO (Azul)</option>
            <option value="URGENTE">URGENTE (Vermelho)</option>
          </select>

          <label class="modal-label">Expira em (Opcional)</label>
          <input type="date" id="mur-exp" class="modal-textarea" />
        </div>
        <div class="modal-actions" style="margin-top:24px">
          <button class="modal-cancel" onclick="document.getElementById('modal-mural').remove()" style="flex:1">CANCELAR</button>
          <button class="btn-success" onclick="relatoriosScreen.enviarAviso()" style="flex:2">PUBLICAR AGORA</button>
        </div>
      </div>
    `;
    document.body.appendChild(m);
  }

  async function enviarAviso() {
    const payload = {
      equipe_id: document.getElementById('mur-equipe').value,
      titulo: document.getElementById('mur-titulo').value.trim(),
      mensagem: document.getElementById('mur-msg').value.trim(),
      criticidade: document.getElementById('mur-crit').value,
      expira_em: document.getElementById('mur-exp').value
    };

    if (!payload.titulo || !payload.mensagem) return alert('Preencha título e mensagem.');

    try {
      const btn = document.querySelector('#modal-mural .btn-success');
      btn.textContent = 'PUBLICANDO...'; btn.disabled = true;
      const res = await api.salvarAviso(payload);
      if (res.ok) {
        ui.toast('Aviso publicado com sucesso!', 'success');
        document.getElementById('modal-mural').remove();
      } else {
        alert('Erro: ' + res.erro);
        btn.textContent = 'PUBLICAR AGORA'; btn.disabled = false;
      }
    } catch(e) {
      alert('Falha na comunicação.');
      const btn = document.querySelector('#modal-mural .btn-success');
      btn.textContent = 'PUBLICAR AGORA'; btn.disabled = false;
    }
  }

  return { render, exportar, abrirModalMural, enviarAviso };
})();
