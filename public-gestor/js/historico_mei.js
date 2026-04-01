const historicoMEIScreen = (() => {
  function render() {
    document.getElementById('app').innerHTML = '<div class="screen"><div class="list-loading">Carregando...</div></div>';
    _load();
  }
  async function _load() {
    const app = document.getElementById('app');
    try {
      const de  = (document.getElementById('hm-de')  || {}).value || _dd(-30);
      const ate = (document.getElementById('hm-ate') || {}).value || _dd(0);
      const res = await api.getHistoricoJornadas({ de, ate });
      const lista = res.jornadas || res.historico || [];
      app.innerHTML = `<div class="screen">
        <div class="screen-header"><h1 class="screen-title">Histórico MEI</h1><span class="screen-subtitle">${lista.length} registros</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:4px">
          <input id="hm-de"  type="date" value="${de}"  style="background:#0d1526;border:1px solid rgba(99,179,237,.2);color:#e2e8f0;padding:6px 10px;border-radius:4px;font-size:12px" />
          <span style="color:#718096">→</span>
          <input id="hm-ate" type="date" value="${ate}" style="background:#0d1526;border:1px solid rgba(99,179,237,.2);color:#e2e8f0;padding:6px 10px;border-radius:4px;font-size:12px" />
          <button onclick="historicoMEIScreen._buscar()" style="background:rgba(99,179,237,.1);border:1px solid rgba(99,179,237,.3);color:#63b3ed;padding:6px 14px;border-radius:4px;font-size:12px;cursor:pointer">Filtrar</button>
        </div>
        <div class="card-list">${lista.length === 0 ? '<div class="list-empty">Nenhuma jornada no período</div>' : lista.map(_card).join('')}</div>
      </div>`;
    } catch(e) {
      app.innerHTML = '<div class="screen"><div class="list-error">Erro: ' + e.message + '</div></div>';
    }
  }
  function _card(j) {
    var sc = {EM_ATIVIDADE:'#68d391',ACEITO:'#63b3ed',PAUSADO:'#f6ad55',ENCERRADO:'#718096',CANCELADO:'#fc8181'}[j.status] || '#718096';
    var ci = j.inicio_real ? new Date(j.inicio_real).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '—';
    var co = j.fim_real    ? new Date(j.fim_real).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})    : '—';
    var dt = j.criado_em   ? new Date(j.criado_em).toLocaleDateString('pt-BR') : '—';
    var dur = _dur(j.inicio_real, j.fim_real);
    var loc = j.local_nome || j.local || j.slot_id || '—';
    return '<div class="card"><div class="card-header"><div><div class="card-title">' + loc + '</div><div class="card-sub">' + (j.nome||j.user_id||'—') + ' · ' + (j.cidade||'') + '</div></div><span class="status-badge" style="background:' + sc + '20;color:' + sc + ';border-color:' + sc + '40">' + (j.status||'').replace('_',' ') + '</span></div><div class="card-body"><div class="card-row"><span>Data</span><strong>' + dt + '</strong></div><div class="card-row"><span>Check-in</span><strong>' + ci + '</strong></div><div class="card-row"><span>Check-out</span><strong>' + co + '</strong></div><div class="card-row"><span>Duração</span><strong>' + dur + '</strong></div></div></div>';
  }
  function _buscar() { _load(); }
  function _dur(a, b) {
    if (!a || !b) return '—';
    var d = Math.floor((new Date(b) - new Date(a)) / 1000);
    if (d <= 0) return '—';
    return Math.floor(d/3600) + 'h' + String(Math.floor((d%3600)/60)).padStart(2,'0');
  }
  function _dd(offset) {
    var d = new Date(); d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  }
  return { render, _buscar };
})();
// endpoint adicionado via patch
