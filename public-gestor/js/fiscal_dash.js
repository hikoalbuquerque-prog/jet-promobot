// ─── fiscal_dash.js — Dashboard Fiscal (Gestor) ──────────────────────────────
const fiscalDashScreen = (() => {
  let _fiscais = [];
  let _dados = {};

  async function render() {
    const app = document.getElementById('app');
    const hoje = new Date().toISOString().split('T')[0];
    app.innerHTML =
      '<section class="screen" id="screen-fiscal-dash">' +
        '<div class="screen-header">' +
          '<h2 class="screen-title">🔍 Dashboard Fiscal</h2>' +
          '<button class="btn-icon" id="btn-refresh-fdash">↻</button>' +
        '</div>' +

        '<div style="background:#0d1526;border:1px solid rgba(99,179,237,.1);border-radius:6px;padding:12px;margin-bottom:12px;display:flex;gap:10px;align-items:center">' +
          '<div><label class="modal-label">DATA</label>' +
            '<input id="fdash-data" type="date" value="' + hoje + '" class="modal-textarea" style="height:36px;resize:none;min-width:140px"/></div>' +
          '<div><label class="modal-label">FISCAL</label>' +
            '<select id="fdash-fiscal" class="modal-textarea" style="height:36px;resize:none;min-width:160px">' +
              '<option value="">Todos</option>' +
            '</select></div>' +
          '<button id="btn-fdash-buscar" style="margin-top:16px;background:rgba(99,179,237,.15);border:1px solid rgba(99,179,237,.3);color:#63b3ed;padding:9px 16px;border-radius:4px;font-size:13px;font-weight:700;cursor:pointer">🔍 Buscar</button>' +
        '</div>' +

        '<div id="fdash-resumo" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px"></div>' +

        '<div style="display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:12px">' +
          '<button class="fdash-tab active" data-tab="metas" style="padding:8px 14px;background:none;border:none;border-bottom:2px solid #63b3ed;color:#63b3ed;cursor:pointer;font-size:13px">🎯 Metas</button>' +
          '<button class="fdash-tab" data-tab="infracoes" style="padding:8px 14px;background:none;border:none;border-bottom:2px solid transparent;color:#718096;cursor:pointer;font-size:13px">🚨 Infrações</button>' +
          '<button class="fdash-tab" data-tab="turnos" style="padding:8px 14px;background:none;border:none;border-bottom:2px solid transparent;color:#718096;cursor:pointer;font-size:13px">⏱️ Turnos</button>' +
        '</div>' +

        '<div id="fdash-tab-metas" class="card-list"><div class="list-loading">Carregando...</div></div>' +
        '<div id="fdash-tab-infracoes" class="card-list" style="display:none"><div class="list-empty">Selecione e busque.</div></div>' +
        '<div id="fdash-tab-turnos" class="card-list" style="display:none"><div class="list-empty">Selecione e busque.</div></div>' +
      '</section>';

    _bindEvents();
    await _carregarFiscais();
    await _buscar();
  }

  function _bindEvents() {
    document.getElementById('btn-refresh-fdash').addEventListener('click', _buscar);
    document.getElementById('btn-fdash-buscar').addEventListener('click', _buscar);
    document.querySelectorAll('.fdash-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.fdash-tab').forEach(t => {
          t.style.borderBottomColor = 'transparent'; t.style.color = '#718096'; t.classList.remove('active');
        });
        tab.style.borderBottomColor = '#63b3ed'; tab.style.color = '#63b3ed'; tab.classList.add('active');
        ['metas','infracoes','turnos'].forEach(id => {
          const el = document.getElementById('fdash-tab-' + id);
          if (el) el.style.display = tab.dataset.tab === id ? 'flex' : 'none';
          if (el) el.style.flexDirection = 'column';
        });
      });
    });
  }

  async function _carregarFiscais() {
    try {
      const res = await api.getFiscaisCLT();
      _fiscais = res.data || [];
      const sel = document.getElementById('fdash-fiscal');
      if (sel) {
        _fiscais.forEach(f => {
          const opt = document.createElement('option');
          opt.value = f.user_id;
          opt.textContent = f.nome_completo;
          sel.appendChild(opt);
        });
      }
    } catch(e) {}
  }

  async function _buscar() {
    const data = document.getElementById('fdash-data')?.value;
    const fiscalId = document.getElementById('fdash-fiscal')?.value;
    if (!data) return;

    ['metas','infracoes','turnos'].forEach(id => {
      const el = document.getElementById('fdash-tab-' + id);
      if (el) el.innerHTML = '<div class="list-loading">Carregando...</div>';
    });
    document.getElementById('fdash-resumo').innerHTML = '';

    try {
      const res = await api.get('GET_DASHBOARD_FISCAL', { data, fiscal_id: fiscalId });
      if (!res.ok) throw new Error(res.erro || 'Erro ao carregar');
      _dados = res;
      _renderResumo(res);
      _renderMetas(res);
      _renderInfracoes(res);
      _renderTurnos(res);
    } catch(e) {
      document.getElementById('fdash-tab-metas').innerHTML = '<div class="list-error">Erro: ' + e.message + '</div>';
    }
  }

  function _renderResumo(d) {
    const el = document.getElementById('fdash-resumo');
    const cards = [
      { label: 'Fiscais Ativos', valor: d.fiscais_ativos || 0, cor: '#68d391' },
      { label: 'Infrações Hoje', valor: d.total_infracoes || 0, cor: '#4f8ef7' },
      { label: 'Organizações', valor: d.total_organizacoes || 0, cor: '#f6ad55' },
      { label: 'Meta Atingida', valor: (d.fiscais_meta_atingida || 0) + '/' + (d.total_fiscais || 0), cor: d.fiscais_meta_atingida >= d.total_fiscais ? '#68d391' : '#fc8181' }
    ];
    el.innerHTML = cards.map(c =>
      '<div style="background:#0d1526;border:1px solid rgba(99,179,237,.1);border-radius:8px;padding:12px;text-align:center">' +
        '<div style="font-size:10px;color:#718096;letter-spacing:1px;margin-bottom:6px">' + c.label.toUpperCase() + '</div>' +
        '<div style="font-size:22px;font-weight:800;color:' + c.cor + '">' + c.valor + '</div>' +
      '</div>'
    ).join('');
  }

  function _renderMetas(d) {
    const el = document.getElementById('fdash-tab-metas');
    const lista = d.metas_por_fiscal || [];
    if (!lista.length) { el.innerHTML = '<div class="list-empty">Nenhum dado encontrado.</div>'; return; }

    el.innerHTML = lista.map(f => {
      const pctOcr = Math.min(100, Math.round((f.ocorrencias_hoje / 15) * 100));
      const pctOrg = Math.min(100, Math.round((f.organizacao_hoje / 15) * 100));
      const corOcr = f.ocorrencias_hoje >= 15 ? '#68d391' : f.ocorrencias_hoje >= 10 ? '#f6ad55' : '#fc8181';
      const corOrg = f.organizacao_hoje >= 15 ? '#68d391' : f.organizacao_hoje >= 10 ? '#f6ad55' : '#fc8181';
      const emTurno = f.status_turno === 'EM_ANDAMENTO';

      return '<div class="card" style="margin-bottom:10px">' +
        '<div class="card-header">' +
          '<div>' +
            '<div class="card-title">' + f.nome + '</div>' +
            '<div class="card-sub">' + (f.zona_nome || '—') + '</div>' +
          '</div>' +
          '<span class="status-badge" style="background:' + (emTurno ? '#68d39120' : '#71809620') + ';color:' + (emTurno ? '#68d391' : '#718096') + ';border-color:' + (emTurno ? '#68d39140' : '#71809640') + '">' +
            (emTurno ? 'EM TURNO' : (f.status_turno || 'SEM TURNO')) +
          '</span>' +
        '</div>' +
        '<div class="card-body">' +
          '<div style="margin-bottom:8px">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:3px">' +
              '<span style="font-size:11px;color:#a0aec0">Infrações</span>' +
              '<span style="font-size:11px;font-weight:700;color:' + corOcr + '">' + f.ocorrencias_hoje + '/15</span>' +
            '</div>' +
            '<div style="background:#1e2a45;border-radius:4px;height:6px;overflow:hidden">' +
              '<div style="background:' + corOcr + ';height:100%;width:' + pctOcr + '%;transition:width .3s"></div>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:3px">' +
              '<span style="font-size:11px;color:#a0aec0">Organização</span>' +
              '<span style="font-size:11px;font-weight:700;color:' + corOrg + '">' + f.organizacao_hoje + '/15</span>' +
            '</div>' +
            '<div style="background:#1e2a45;border-radius:4px;height:6px;overflow:hidden">' +
              '<div style="background:' + corOrg + ';height:100%;width:' + pctOrg + '%;transition:width .3s"></div>' +
            '</div>' +
          '</div>' +
          (f.ociosidade_min > 0 ? '<div class="card-row" style="margin-top:8px"><span>Ociosidade</span><strong style="color:' + (f.ociosidade_min > 20 ? '#fc8181' : '#f6ad55') + '">' + f.ociosidade_min + ' min</strong></div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function _renderInfracoes(d) {
    const el = document.getElementById('fdash-tab-infracoes');
    const lista = d.infracoes || [];
    if (!lista.length) { el.innerHTML = '<div class="list-empty">Nenhuma infração no período.</div>'; return; }

    const porTipo = {};
    lista.forEach(i => { porTipo[i.tipo] = (porTipo[i.tipo] || 0) + 1; });

    el.innerHTML =
      '<div style="background:#0d1526;border-radius:8px;padding:12px;margin-bottom:12px">' +
        '<div style="font-size:11px;color:#718096;letter-spacing:1px;margin-bottom:8px">POR TIPO</div>' +
        Object.entries(porTipo).map(([tipo, count]) =>
          '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)">' +
            '<span style="font-size:12px;color:#a0aec0">' + tipo.replace(/_/g,' ') + '</span>' +
            '<strong style="font-size:12px;color:#4f8ef7">' + count + '</strong>' +
          '</div>'
        ).join('') +
      '</div>' +
      lista.slice(0,30).map(i =>
        '<div class="card" style="margin-bottom:8px">' +
          '<div class="card-header">' +
            '<div><div class="card-title" style="font-size:13px">' + i.tipo.replace(/_/g,' ') + '</div>' +
            '<div class="card-sub">' + (i.nome_fiscal || i.user_id) + ' · ' + _fh(i.criado_em) + '</div></div>' +
            (i.foto_url ? '<a href="' + i.foto_url + '" target="_blank" style="font-size:11px;color:#4f8ef7;text-decoration:none">📷 Ver</a>' : '') +
          '</div>' +
          (i.patinete_id && i.patinete_id !== '000000' ? '<div style="font-size:12px;color:#718096;padding:4px 0">Patinete: <strong>' + i.patinete_id + '</strong></div>' : '') +
        '</div>'
      ).join('');
  }

  function _renderTurnos(d) {
    const el = document.getElementById('fdash-tab-turnos');
    const lista = d.turnos || [];
    if (!lista.length) { el.innerHTML = '<div class="list-empty">Nenhum turno no período.</div>'; return; }

    const cores = { PLANEJADO:'#63b3ed', ESCALADO:'#63b3ed', CONFIRMADO:'#68d391', EM_ANDAMENTO:'#f6ad55', ENCERRADO:'#718096', CANCELADO:'#fc8181' };
    el.innerHTML = lista.map(t => {
      const cor = cores[t.status] || '#718096';
      return '<div class="card" style="margin-bottom:8px">' +
        '<div class="card-header">' +
          '<div><div class="card-title" style="font-size:13px">' + (t.nome || t.user_id) + '</div>' +
          '<div class="card-sub">' + _fh(t.inicio) + ' – ' + _fh(t.fim) + ' · ' + (t.zona_nome || '—') + '</div></div>' +
          '<span class="status-badge" style="background:' + cor + '20;color:' + cor + ';border-color:' + cor + '40">' + t.status + '</span>' +
        '</div>' +
        '<div class="card-body">' +
          (t.duracao_real_horas ? '<div class="card-row"><span>Horas realizadas</span><strong>' + t.duracao_real_horas + 'h</strong></div>' : '') +
          (t.checkin_foto_url ? '<div class="card-row"><span>Foto checkin</span><a href="' + t.checkin_foto_url + '" target="_blank" style="color:#4f8ef7;font-size:12px">📷 Ver</a></div>' : '') +
          (t.checkout_foto_url ? '<div class="card-row"><span>Foto checkout</span><a href="' + t.checkout_foto_url + '" target="_blank" style="color:#4f8ef7;font-size:12px">📷 Ver</a></div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function _fh(v) {
    if (!v) return '—';
    const s = String(v);
    if (/^\d{2}:\d{2}/.test(s)) return s.substring(0,5);
    try { return new Date(v).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}); } catch(_) { return '—'; }
  }

  function destroy() {}
  return { render, destroy };
})();
