// ─── escala_clt.js ────────────────────────────────────────────────────────────
const escalaCLTScreen = (() => {
  let _sugestoes = [];
  let _turnosDia = [];
  const CARGOS_CLT = ['SCOUT','CHARGER','MOTORISTA','FISCAL'];

  function render() {
    const app  = document.getElementById('app');
    const hoje = new Date().toISOString().split('T')[0];
    app.innerHTML = `
      <section class="screen" id="screen-escala-clt">
        <div class="screen-header">
          <h2 class="screen-title">Escala CLT</h2>
          <button class="btn-icon" id="btn-refresh-clt">↻</button>
        </div>

        <div style="background:#0d1526;border:1px solid rgba(99,179,237,.1);border-radius:6px;padding:16px;display:flex;flex-direction:column;gap:12px">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px">
            <div><label class="modal-label">DATA</label>
              <input id="clt-data" type="date" value="${hoje}" class="modal-textarea" style="height:36px;resize:none"/></div>
            <div><label class="modal-label">INÍCIO</label>
              <input id="clt-inicio" type="time" value="08:00" class="modal-textarea" style="height:36px;resize:none"/></div>
            <div><label class="modal-label">FIM</label>
              <input id="clt-fim" type="time" value="16:00" class="modal-textarea" style="height:36px;resize:none"/></div>
            <div><label class="modal-label">TURNO</label>
              <select onchange="(function(v){var m={T1:['00:00','08:00'],T2:['08:00','16:00'],T3:['16:00','00:00']}[v];if(m){document.getElementById('clt-inicio').value=m[0];document.getElementById('clt-fim').value=m[1];}})(this.value)" class="modal-textarea" style="height:36px;resize:none">
                <option value="">Livre</option>
                <option value="T1">T1 — 00h às 08h</option>
                <option value="T2" selected>T2 — 08h às 16h</option>
                <option value="T3">T3 — 16h às 00h</option>
              </select></div>
            <div><label class="modal-label">CARGO</label>
              <select id="clt-cargo" class="modal-textarea" style="height:36px;resize:none">
                <option value="">Todos</option>
                ${CARGOS_CLT.map(c=>`<option value="${c}">${c}</option>`).join('')}
              </select></div>
          </div>
          <button id="btn-buscar" style="background:rgba(99,179,237,.15);border:1px solid rgba(99,179,237,.3);color:#63b3ed;padding:9px;border-radius:4px;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:1px">
            🔍 BUSCAR DISPONÍVEIS
          </button>
        </div>

        <div style="display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,.08)">
          <button class="clt-tab active" data-tab="sugestoes" style="padding:8px 16px;background:none;border:none;border-bottom:2px solid #63b3ed;color:#63b3ed;cursor:pointer;font-size:13px">💡 Sugestões</button>
          <button class="clt-tab" data-tab="turnos" style="padding:8px 16px;background:none;border:none;border-bottom:2px solid transparent;color:#718096;cursor:pointer;font-size:13px">📋 Turnos do Dia</button>
          <button class="clt-tab" data-tab="banco" style="padding:8px 16px;background:none;border:none;border-bottom:2px solid transparent;color:#718096;cursor:pointer;font-size:13px">⏱️ Banco de Horas</button>
        </div>

        <div id="tab-sugestoes" class="card-list"><div class="list-empty">Configure os filtros e clique em Buscar.</div></div>
        <div id="tab-turnos" class="card-list" style="display:none"><div class="list-loading">Selecione uma data.</div></div>
        <div id="tab-banco" class="card-list" style="display:none"><div class="list-empty">Clique em ⏱️ Banco em um promotor.</div></div>
      </section>

      <div id="modal-turno" class="modal hidden">
        <div class="modal-box" style="max-width:480px">
          <div class="modal-title">⚡ Criar Turno CLT</div>
          <div id="turno-info" class="modal-body" style="margin-bottom:16px"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
            <div><label class="modal-label">ZONA / LOCAL</label>
              <input id="turno-zona" class="modal-textarea" style="height:36px;resize:none" placeholder="Ex: Zona Sul SP"/></div>
            <div><label class="modal-label">PONTO DE REFERÊNCIA</label>
              <input id="turno-ponto" class="modal-textarea" style="height:36px;resize:none" placeholder="Ex: Depot Pinheiros"/></div>
          </div>
          <div id="turno-extra-aviso" style="display:none;background:rgba(246,173,85,.08);border:1px solid rgba(246,173,85,.3);border-radius:4px;padding:10px;font-size:12px;color:#f6ad55;margin-bottom:12px">
            ⚠️ Este turno excederá a carga horária semanal — será registrado como hora extra.
          </div>
          <div id="turno-error" style="display:none;color:#fc8181;font-size:12px;margin-bottom:12px;padding:8px;background:rgba(252,129,129,.1);border-radius:4px"></div>
          <div class="modal-actions">
            <button class="btn-danger" id="btn-turno-cancel">Cancelar</button>
            <button class="btn-success" id="btn-turno-ok">✓ Criar Turno</button>
          </div>
        </div>
      </div>

      <div id="modal-banco" class="modal hidden">
        <div class="modal-box" style="max-width:540px;max-height:80vh;overflow-y:auto">
          <div class="modal-title" id="banco-titulo">Banco de Horas</div>
          <div id="banco-content"></div>
          <button class="modal-cancel" id="btn-banco-fechar" style="margin-top:12px">Fechar</button>
        </div>
      </div>`;

    _bind();
    _carregarTurnos();
  }

  function _bind() {
    document.getElementById('btn-refresh-clt').addEventListener('click', () => { _buscar(); _carregarTurnos(); });
    document.getElementById('btn-buscar').addEventListener('click', _buscar);
    document.getElementById('btn-turno-cancel').addEventListener('click', () => document.getElementById('modal-turno').classList.add('hidden'));
    document.getElementById('btn-banco-fechar').addEventListener('click', () => document.getElementById('modal-banco').classList.add('hidden'));
    document.getElementById('clt-data').addEventListener('change', () => {
      if (document.querySelector('.clt-tab[data-tab="turnos"]')?.classList.contains('active')) _carregarTurnos();
    });
    ['modal-turno','modal-banco'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', e => { if (e.target.id === id) e.target.classList.add('hidden'); });
    });
    document.querySelectorAll('.clt-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.clt-tab').forEach(t => { t.style.borderBottomColor='transparent'; t.style.color='#718096'; t.classList.remove('active'); });
        tab.style.borderBottomColor='#63b3ed'; tab.style.color='#63b3ed'; tab.classList.add('active');
        ['sugestoes','turnos','banco'].forEach(id => {
          const el = document.getElementById('tab-'+id);
          if (el) el.style.display = tab.dataset.tab===id ? 'flex' : 'none';
          if (el) el.style.flexDirection = 'column';
        });
        if (tab.dataset.tab==='turnos') _carregarTurnos();
      });
    });
  }

  async function _buscar() {
    const data=document.getElementById('clt-data')?.value, inicio=document.getElementById('clt-inicio')?.value,
          fim=document.getElementById('clt-fim')?.value, cargo=document.getElementById('clt-cargo')?.value;
    const el=document.getElementById('tab-sugestoes');
    if (!data||!inicio||!fim) { el.innerHTML='<div class="list-error">Preencha data, início e fim.</div>'; return; }
    el.innerHTML='<div class="list-loading">Buscando disponíveis...</div>';
    try {
      const res = await api.getSugestoesEscala({data,inicio,fim,cargo_clt:cargo});
      _sugestoes = res?.data||[];
      _renderSugestoes(_sugestoes,data,inicio,fim);
    } catch(e) { el.innerHTML=`<div class="list-error">Erro: ${e.message}</div>`; }
  }

  function _renderSugestoes(lista,data,inicio,fim) {
    const el=document.getElementById('tab-sugestoes');
    if (!el) return;
    if (!lista.length) { el.innerHTML='<div class="list-empty">Nenhum CLT com PERFIL_CLT cadastrado.</div>'; return; }
    const disp=lista.filter(s=>s.disponivel).length;
    el.innerHTML=`<div style="font-size:11px;color:#718096;letter-spacing:2px;padding:4px 0">${disp} DISPONÍVEL(IS) · ${lista.length-disp} BLOQUEADO(S)</div>`+
    lista.map(s => {
      const cor=s.disponivel?(s.score>=70?'#68d391':s.score>=50?'#63b3ed':'#f6ad55'):'#718096';
      const label=s.disponivel?(s.score>=70?'Alta compatibilidade':s.score>=50?'Compatível':'Baixa prioridade'):s.motivo_bloqueio;
      return `<div class="card" style="border-left:3px solid ${cor}${!s.disponivel?';opacity:.6':''}">
        <div class="card-header">
          <div><div class="card-title">${s.nome}</div><div class="card-sub">${s.cargo_clt} · ${s.zona_nome||'—'}</div></div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <span class="status-badge" style="background:${cor}20;color:${cor};border-color:${cor}40">${label}</span>
            ${s.disponivel?`<span style="font-size:10px;color:#4a5568;font-family:'IBM Plex Mono',monospace">score ${s.score}</span>`:''}
          </div>
        </div>
        ${s.disponivel?`<div class="card-body">
          ${s.dist_km!==null?`<div class="card-row"><span>Distância da zona</span><strong>${s.dist_km}km</strong></div>`:''}
          <div class="card-row"><span>Horas disponíveis</span><strong style="color:${s.sera_hora_extra?'#f6ad55':'#68d391'}">${s.horas_disponiveis}h${s.sera_hora_extra?' (hora extra)':''}</strong></div>
          <div class="card-row"><span>Horas do turno</span><strong>${s.horas_turno}h</strong></div>
        </div>
        <div class="card-actions">
          <button class="btn-success btn-sm" onclick="escalaCLTScreen.abrirTurno('${s.user_id}','${s.nome}','${s.cargo_clt}','${data}','${inicio}','${fim}',${s.sera_hora_extra})">⚡ Escalar</button>
          <button class="panel-btn btn-sm" style="flex:none;width:auto;padding:5px 12px;margin-top:0" onclick="escalaCLTScreen.verBanco('${s.user_id}','${s.nome}')">⏱️ Banco</button>
        </div>`:''}
      </div>`;
    }).join('');
  }

  async function _carregarTurnos() {
    const data=document.getElementById('clt-data')?.value;
    const el=document.getElementById('tab-turnos');
    if (!el||!data) return;
    el.innerHTML='<div class="list-loading">Carregando...</div>';
    try {
      const res=await api.getTurnosDia(data);
      _turnosDia=res?.data||[];
      if (!_turnosDia.length) { el.innerHTML=`<div class="list-empty">Nenhum turno CLT em ${data}.</div>`; return; }
      const cores={ESCALADO:'#63b3ed',CONFIRMADO:'#68d391',EM_ANDAMENTO:'#f6ad55',ENCERRADO:'#718096',CANCELADO:'#fc8181',FALTA:'#fc8181'};
      el.innerHTML=_turnosDia.map(t=>{const cor=cores[t.status]||'#718096'; return `
        <div class="card">
          <div class="card-header">
            <div><div class="card-title">${t.nome||t.user_id}</div><div class="card-sub">${t.cargo_clt||''} · ${t.zona_nome||''}</div></div>
            <span class="status-badge" style="background:${cor}20;color:${cor};border-color:${cor}40">${t.status}</span>
          </div>
          <div class="card-body">
            <div class="card-row"><span>Horário</span><strong>${_fh(t.inicio)} – ${_fh(t.fim)}</strong></div>
            ${t.horas_turno?`<div class="card-row"><span>Horas</span><strong>${t.horas_turno}h</strong></div>`:''}
          </div>
        </div>`;}).join('');
    } catch(e) { el.innerHTML=`<div class="list-error">Erro: ${e.message}</div>`; }
  }

  function abrirTurno(uid,nome,cargo,data,inicio,fim,extra) {
    const modal=document.getElementById('modal-turno');
    document.getElementById('turno-info').innerHTML=`
      <div class="modal-info-row"><span>Promotor</span><strong>${nome}</strong></div>
      <div class="modal-info-row"><span>Cargo</span><strong>${cargo}</strong></div>
      <div class="modal-info-row"><span>Data</span><strong>${data}</strong></div>
      <div class="modal-info-row"><span>Horário</span><strong>${inicio} – ${fim}</strong></div>`;
    document.getElementById('turno-extra-aviso').style.display=extra?'block':'none';
    document.getElementById('turno-error').style.display='none';
    document.getElementById('turno-zona').value='';
    document.getElementById('turno-ponto').value='';
    modal.classList.remove('hidden');
    const btn=document.getElementById('btn-turno-ok');
    const novo=btn.cloneNode(true); btn.parentNode.replaceChild(novo,btn);
    novo.addEventListener('click', async()=>{
      novo.disabled=true; novo.textContent='Criando...';
      try {
        const res=await api.criarTurnoCLT({user_id:uid,data,inicio,fim,cargo_clt:cargo,
          zona_nome:document.getElementById('turno-zona')?.value?.trim()||'',
          ponto_referencia:document.getElementById('turno-ponto')?.value?.trim()||''});
        if (res.ok) { modal.classList.add('hidden'); _carregarTurnos(); document.querySelector('.clt-tab[data-tab="turnos"]')?.click(); }
        else { const e=document.getElementById('turno-error'); e.textContent=res.erro||res.mensagem||'Erro.'; e.style.display='block'; }
      } catch(e) { const el=document.getElementById('turno-error'); el.textContent=e.message||'Sem conexão.'; el.style.display='block'; }
      novo.disabled=false; novo.textContent='✓ Criar Turno';
    });
  }

  async function verBanco(uid,nome) {
    const modal=document.getElementById('modal-banco');
    document.getElementById('banco-titulo').textContent='⏱️ Banco de Horas — '+nome;
    document.getElementById('banco-content').innerHTML='<div class="list-loading">Carregando...</div>';
    modal.classList.remove('hidden');
    // Mudar para tab banco
    document.querySelector('.clt-tab[data-tab="banco"]')?.click();
    const el=document.getElementById('tab-banco');
    if (el) el.innerHTML='<div class="list-loading">Carregando...</div>';
    try {
      const res=await api.getBancoHorasPromotor(uid,8);
      const semanas=res?.data||[];
      const html=!semanas.length?'<div class="list-empty">Sem registros ainda.</div>':semanas.map(s=>{
        const saldo=parseFloat(s.saldo_horas)||0, cor=saldo>=0?'#68d391':'#fc8181', extra=parseFloat(s.horas_extra)||0;
        return `<div class="card" style="margin-bottom:8px">
          <div class="card-header">
            <div><div class="card-title" style="font-size:13px">${_fd(s.semana_inicio)} – ${_fd(s.semana_fim)}</div><div class="card-sub">${s.status_semana||'ABERTA'}</div></div>
            ${extra>0?`<span class="status-badge" style="background:#f6ad5520;color:#f6ad55;border-color:#f6ad5540">+${extra}h extra</span>`:''}
          </div>
          <div class="card-body">
            <div class="card-row"><span>Contrato</span><strong>${s.horas_contrato}h</strong></div>
            <div class="card-row"><span>Escaladas</span><strong>${s.horas_escaladas}h</strong></div>
            <div class="card-row"><span>Realizadas</span><strong>${s.horas_realizadas||0}h</strong></div>
            <div class="card-row"><span>Saldo</span><strong style="color:${cor}">${saldo>=0?'+':''}${saldo}h</strong></div>
          </div>
        </div>`;}).join('');
      if (el) el.innerHTML=html;
      document.getElementById('banco-content').innerHTML=html;
    } catch(e) {
      const msg=`<div class="list-error">Erro: ${e.message}</div>`;
      if (el) el.innerHTML=msg;
      document.getElementById('banco-content').innerHTML=msg;
    }
    modal.classList.add('hidden'); // Mostrar na tab, não no modal
  }

  function _fh(v) {
    if (!v) return '—';
    const s=String(v);
    if (/^\d{2}:\d{2}/.test(s)) return s.substring(0,5);
    try { return new Date(v).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); } catch(_) { return '—'; }
  }
  function _fd(v) {
    if (!v) return '—';
    const s=String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const[,m,d]=s.split('-'); return `${d}/${m}`; }
    return s.substring(0,10);
  }

  function destroy() {}
  return { render, destroy, abrirTurno, verBanco };
})();