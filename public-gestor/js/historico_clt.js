// ─── historico_clt.js (gestor) ────────────────────────────────────────────────
// Histórico de turnos CLT por promotor, função e período

const historicoCLTScreen = (() => {
  let _turnos = [];

  function render() {
    const app = document.getElementById('app');
    const hoje = new Date().toISOString().split('T')[0];
    const mesInicio = hoje.substring(0,7) + '-01';

    app.innerHTML = `
      <section class="screen" id="screen-historico-clt">
        <div class="screen-header">
          <h2 class="screen-title">Histórico CLT</h2>
          <button class="btn-icon" id="btn-refresh-hclt">↻</button>
        </div>

        <!-- Filtros -->
        <div style="background:#0d1526;border:1px solid rgba(99,179,237,.1);border-radius:6px;padding:14px;display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end">
          <div>
            <label class="modal-label">DE</label>
            <input id="hclt-de" type="date" value="${mesInicio}" class="modal-textarea" style="height:36px;resize:none;width:140px"/>
          </div>
          <div>
            <label class="modal-label">ATÉ</label>
            <input id="hclt-ate" type="date" value="${hoje}" class="modal-textarea" style="height:36px;resize:none;width:140px"/>
          </div>
          <div>
            <label class="modal-label">CARGO / FUNÇÃO</label>
            <select id="hclt-cargo" class="modal-textarea" style="height:36px;resize:none;width:140px">
              <option value="">Todos</option>
              <option value="SCOUT">Scout</option>
              <option value="CHARGER">Charger</option>
              <option value="MOTORISTA">Motorista</option>
              <option value="FISCAL">Fiscal</option>
            </select>
          </div>
          <div>
            <label class="modal-label">STATUS</label>
            <select id="hclt-status" class="modal-textarea" style="height:36px;resize:none;width:130px">
              <option value="">Todos</option>
              <option value="ENCERRADO">Encerrado</option>
              <option value="EM_ANDAMENTO">Em andamento</option>
              <option value="CANCELADO">Cancelado</option>
              <option value="FALTA">Falta</option>
            </select>
          </div>
          <button id="btn-buscar-hclt" style="background:rgba(99,179,237,.15);border:1px solid rgba(99,179,237,.3);color:#63b3ed;padding:8px 16px;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:1px;height:36px">
            🔍 BUSCAR
          </button>
        </div>

        <!-- Resumo -->
        <div id="hclt-resumo" style="display:none;background:#0d1526;border:1px solid rgba(99,179,237,.1);border-radius:6px;padding:14px">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px" id="hclt-kpis"></div>
        </div>

        <!-- Lista -->
        <div id="hclt-lista" class="card-list">
          <div class="list-empty">Configure os filtros e clique em Buscar.</div>
        </div>
      </section>
    `;

    document.getElementById('btn-refresh-hclt').addEventListener('click', _buscar);
    document.getElementById('btn-buscar-hclt').addEventListener('click', _buscar);
    _buscar();
  }

  async function _buscar() {
    const de     = document.getElementById('hclt-de')?.value;
    const ate    = document.getElementById('hclt-ate')?.value;
    const cargo  = document.getElementById('hclt-cargo')?.value;
    const status = document.getElementById('hclt-status')?.value;
    const lista  = document.getElementById('hclt-lista');

    if (lista) lista.innerHTML = '<div class="list-loading">Buscando...</div>';

    try {
      const res = await api.getHistoricoTurnosCLT({ de, ate, cargo_clt: cargo, status });
      _turnos = res?.data || [];
      _renderLista();
      _renderResumo();
    } catch(e) {
      if (lista) lista.innerHTML = `<div class="list-error">Erro: ${e.message}</div>`;
    }
  }

  function _renderResumo() {
    const resumoEl = document.getElementById('hclt-resumo');
    const kpisEl   = document.getElementById('hclt-kpis');
    if (!resumoEl || !kpisEl || !_turnos.length) { if(resumoEl) resumoEl.style.display='none'; return; }

    const encerrados  = _turnos.filter(t => t.status === 'ENCERRADO');
    const totalHoras  = encerrados.reduce((s,t) => s + (parseFloat(t.duracao_real_horas)||0), 0);
    const totalExtra  = encerrados.reduce((s,t) => s + (parseFloat(t.hora_extra)||0), 0);
    const faltas      = _turnos.filter(t => t.status === 'FALTA').length;

    resumoEl.style.display = 'block';
    kpisEl.innerHTML = [
      { label:'Turnos',     value: _turnos.length,           color:'#63b3ed' },
      { label:'Horas reais',value: totalHoras.toFixed(1)+'h', color:'#68d391' },
      { label:'Horas extra', value: totalExtra.toFixed(1)+'h', color:'#f6ad55' },
      { label:'Faltas',      value: faltas,                   color:'#fc8181' },
    ].map(k => `
      <div style="text-align:center">
        <div style="font-size:22px;font-weight:700;color:${k.color};font-family:'IBM Plex Mono',monospace">${k.value}</div>
        <div style="font-size:10px;color:#4a5568;letter-spacing:1px;text-transform:uppercase">${k.label}</div>
      </div>`).join('');
  }

  function _renderLista() {
    const el = document.getElementById('hclt-lista');
    if (!el) return;

    if (!_turnos.length) {
      el.innerHTML = '<div class="list-empty">Nenhum turno encontrado para o período.</div>';
      return;
    }

    const cores = {
      ENCERRADO:'#68d391', EM_ANDAMENTO:'#f6ad55', ESCALADO:'#63b3ed',
      CONFIRMADO:'#63b3ed', CANCELADO:'#718096', FALTA:'#fc8181',
    };

    el.innerHTML = _turnos.map(t => {
      const cor    = cores[t.status] || '#718096';
      const dur    = t.duracao_real_horas ? `${t.duracao_real_horas}h` : '—';
      const extra  = parseFloat(t.hora_extra) > 0;

      return `
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">${t.nome_completo || t.user_id}</div>
              <div class="card-sub">${t.cargo_clt || '—'} · ${_fd(t.data)}</div>
            </div>
            <span class="status-badge" style="background:${cor}20;color:${cor};border-color:${cor}40">${t.status}</span>
          </div>
          <div class="card-body">
            <div class="card-row"><span>Horário</span><strong>${_fh(t.inicio)} – ${_fh(t.fim)}</strong></div>
            <div class="card-row"><span>Zona</span><strong>${t.zona_nome || '—'}</strong></div>
            <div class="card-row"><span>Duração real</span><strong style="color:${extra?'#f6ad55':'#e2e8f0'}">${dur}${extra ? ` (+${t.hora_extra}h extra)` : ''}</strong></div>
          </div>
        </div>`;
    }).join('');
  }

  function _fh(v) {
    if (!v) return '—';
    const s = String(v);
    if (/^\d{2}:\d{2}/.test(s)) return s.substring(0,5);
    try { return new Date(v).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); } catch(_) { return '—'; }
  }

  function _fd(v) {
    if (!v) return '—';
    const s = String(v).substring(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const [a,m,d] = s.split('-');
    return `${d}/${m}/${a.substring(2)}`;
  }

  function destroy() {}
  return { render, destroy };
})();