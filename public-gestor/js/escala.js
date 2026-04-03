const escalaScreen = (() => {
  let _promotores = [];
  let _slots      = [];
  let _drafts     = [];

  function render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <section class="screen" id="screen-escala">
        <div class="screen-header">
          <h2 class="screen-title">Escala</h2>
          <button id="btn-replicar-semana" style="margin-left:auto;background:rgba(99,179,237,.1);border:1px solid rgba(99,179,237,.3);color:#63b3ed;padding:6px 12px;border-radius:6px;font-size:11px;cursor:pointer;font-weight:700">🔄 Replicar Semana Anterior</button>
          <button class="btn-icon" id="btn-nova-escala" style="color:#63b3ed;border-color:#63b3ed40;font-size:18px;margin-left:10px">+</button>
          <button class="btn-icon" id="btn-refresh-escala" title="Atualizar">↻</button>
        </div>
        <div class="filter-bar">
          <button class="filter-btn active" data-filter="RASCUNHO">Rascunhos</button>
          <button class="filter-btn" data-filter="PUBLICADO">Publicados</button>
          <button class="filter-btn" data-filter="TODOS">Todos</button>
        </div>
        <div id="escala-lista" class="card-list">
          <div class="list-loading">Carregando escala...</div>
        </div>
      </section>

      <div id="modal-escala" class="modal hidden">
        <div class="modal-box" style="max-width:520px;max-height:90vh;overflow-y:auto">
          <div class="modal-title">+ Vincular Promotor MEI ao Slot</div>
          <div style="margin-bottom:12px">
            <label class="modal-label">PROMOTOR *</label>
            <select id="esc-promotor" class="modal-textarea" style="height:40px;resize:none">
              <option value="">Selecione um promotor...</option>
            </select>
          </div>
          <div style="margin-bottom:12px">
            <label class="modal-label">SLOT *</label>
            <select id="esc-slot" class="modal-textarea" style="height:40px;resize:none">
              <option value="">Selecione um slot...</option>
            </select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div><label class="modal-label">FUNÇÃO EXECUTADA</label>
              <input id="esc-funcao" class="modal-textarea" style="height:40px;resize:none" placeholder="PROMOTOR" value="PROMOTOR"/></div>
            <input id="esc-tipo" type="hidden" value="SLOT"/>
          </div>
          <div id="esc-slot-info" style="display:none;background:#0a0f1e;border-radius:6px;padding:12px;margin-bottom:12px;font-size:13px;color:#a0aec0"></div>
          <div id="esc-error" style="display:none;color:#fc8181;font-size:12px;margin-bottom:12px;padding:8px;background:rgba(252,129,129,.1);border-radius:4px"></div>
          <div class="modal-actions">
            <button class="btn-danger" id="btn-esc-cancel">Cancelar</button>
            <button class="btn-success" id="btn-esc-salvar">✓ Salvar Rascunho</button>
          </div>
        </div>
      </div>

      <div id="modal-publicar" class="modal hidden">
        <div class="modal-box" style="max-width:420px">
          <div class="modal-title">📅 Publicar Escala</div>
          <div class="modal-body" id="modal-publicar-detalhes"></div>
          <div style="background:rgba(99,179,237,.08);border:1px solid rgba(99,179,237,.2);border-radius:6px;padding:12px;margin-bottom:16px;font-size:13px;color:#a0aec0">
            Ao publicar:<br>• O promotor receberá notificação no Telegram<br>• O slot ficará vinculado ao promotor
          </div>
          <div class="modal-actions">
            <button class="btn-danger" id="btn-pub-cancel">Cancelar</button>
            <button class="btn-success" id="btn-pub-confirmar">📅 Publicar</button>
          </div>
        </div>
      </div>`;

    _bindEscalaEvents();
    _loadEscala();
  }

  function _bindEscalaEvents() {
    document.getElementById('btn-refresh-escala').addEventListener('click', _loadEscala);
    document.getElementById('btn-nova-escala').addEventListener('click', async () => { await _popularSelects(); _openModal('modal-escala'); });
    
    document.getElementById('btn-replicar-semana')?.addEventListener('click', async () => {
      const orig = prompt('Data de INÍCIO da semana de ORIGEM (segunda-feira):\nExemplo: 2026-03-30');
      if (!orig) return;
      const dest = prompt('Data de INÍCIO da semana de DESTINO (segunda-feira):\nExemplo: 2026-04-06');
      if (!dest) return;

      if (!confirm(`Deseja replicar todos os slots de ${orig} (7 dias) para a semana de ${dest}?`)) return;

      const btn = document.getElementById('btn-replicar-semana');
      btn.textContent = '...Aguarde...'; btn.disabled = true;

      try {
        const res = await api.get('REPLICAR_SEMANA', { data_inicio_origem: orig, data_inicio_destino: dest });
        alert(res.mensagem || 'Escala replicada com sucesso!');
        _loadEscala();
      } catch(e) {
        alert('Erro ao replicar: ' + e.message);
      } finally {
        btn.textContent = '🔄 Replicar Semana Anterior'; btn.disabled = false;
      }
    });

    document.getElementById('btn-esc-cancel').addEventListener('click', () => _closeModal('modal-escala'));
    document.getElementById('btn-esc-salvar').addEventListener('click', _salvarDraft);
    document.getElementById('btn-pub-cancel').addEventListener('click', () => _closeModal('modal-publicar'));
    document.getElementById('esc-slot')?.addEventListener('change', _mostrarInfoSlot);
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _renderEscala(btn.dataset.filter);
      });
    });
    ['modal-escala','modal-publicar'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', e => { if (e.target.id === id) _closeModal(id); });
    });
  }

  async function _loadEscala() {
    const lista = document.getElementById('escala-lista');
    if (lista) lista.innerHTML = '<div class="list-loading">Carregando...</div>';
    try {
      const [promRes, slotsRes, escalaRes] = await Promise.all([
        api.getPromotoresAtivos(),
        api.getSlotsHoje(),
        api.getEscalaDrafts(),
      ]);
      _promotores = promRes?.data  || [];
      _slots      = slotsRes?.data || [];
      _drafts     = escalaRes?.data|| [];
      _renderEscala('RASCUNHO');
    } catch(err) {
      if (lista) lista.innerHTML = `<div class="list-error">Erro: ${err.message}</div>`;
    }
  }

  function _renderEscala(filtro) {
    const lista = document.getElementById('escala-lista');
    if (!lista) return;
    const filtrados = filtro === 'TODOS' ? _drafts : _drafts.filter(d => d.status_draft === filtro);
    if (!filtrados.length) {
      lista.innerHTML = `<div class="list-empty">${filtro==='RASCUNHO'?'Nenhum rascunho. Clique em + para vincular.':'Nenhum registro encontrado.'}</div>`;
      return;
    }
    lista.innerHTML = filtrados.map(d => {
      const pub = d.status_draft === 'PUBLICADO';
      const cor = pub ? '#68d391' : '#63b3ed';
      return `
        <div class="card" style="border-left:3px solid ${cor}">
          <div class="card-header">
            <div>
              <div class="card-title">${d.promotor_nome||d.user_id}</div>
              <div class="card-sub">${d.slot_nome||d.slot_id} · ${_fdEscala(d.data)} · ${_fh(d.inicio)}–${_fh(d.fim)}</div>
            </div>
            <span class="status-badge" style="background:${cor}20;color:${cor};border-color:${cor}40">${pub?'Publicado':'Rascunho'}</span>
          </div>
          <div class="card-body">
            <div class="card-row"><span>Função</span><strong>${d.funcao_prevista||d.cargo_principal||'—'}</strong></div>
            <div class="card-row"><span>Tipo</span><strong>${d.tipo_jornada||'SLOT'}</strong></div>
          </div>
          ${!pub?`<div class="card-actions">
            <button class="btn-success btn-sm" onclick="escalaScreen.publicar('${d.escala_draft_id}')">📅 Publicar</button>
            <button class="btn-danger btn-sm" onclick="escalaScreen.excluirDraft('${d.escala_draft_id}')">✕ Excluir</button>
          </div>`:''}
        </div>`;
    }).join('');
  }

  async function _popularSelects() {
    try {
      const [promRes, slotsRes] = await Promise.all([api.getPromotoresAtivos(), api.getSlotsHoje()]);
      _promotores = promRes?.data||[];
      _slots      = slotsRes?.data||[];
    } catch(_) {}
    const selProm = document.getElementById('esc-promotor');
    const selSlot = document.getElementById('esc-slot');
    if (selProm) selProm.innerHTML = '<option value="">Selecione um promotor...</option>' +
      _promotores.map(p=>`<option value="${p.promotor_id}">${p.nome} (${p.cargo_principal||''})</option>`).join('');
    if (selSlot) selSlot.innerHTML = '<option value="">Selecione um slot...</option>' +
      _slots.filter(s=>s.status==='DISPONIVEL').map(s=>`<option value="${s.slot_id}">${s.nome||s.slot_id} · ${s.inicio_slot||''}–${s.fim_slot||''}</option>`).join('');
  }

  function _mostrarInfoSlot() {
    const slotId = document.getElementById('esc-slot')?.value;
    const infoEl = document.getElementById('esc-slot-info');
    const slot   = _slots.find(s=>s.slot_id===slotId);
    if (!slot||!infoEl) { if (infoEl) infoEl.style.display='none'; return; }
    infoEl.style.display='block';
    infoEl.innerHTML=`📍 <strong>${slot.nome||slot.slot_id}</strong><br>🕐 ${slot.inicio_slot||'—'} – ${slot.fim_slot||'—'} · Raio: ${slot.raio_metros}m`;
  }

  async function _salvarDraft() {
    const promotorId = document.getElementById('esc-promotor')?.value;
    const slotId     = document.getElementById('esc-slot')?.value;
    const funcao     = document.getElementById('esc-funcao')?.value?.trim()||'PROMOTOR';
    const tipo       = document.getElementById('esc-tipo')?.value||'SLOT';
    if (!promotorId||!slotId) { _showEscalaError('esc-error','Selecione promotor e slot.'); return; }
    const slot = _slots.find(s=>s.slot_id===slotId);
    const prom = _promotores.find(p=>p.promotor_id===promotorId);
    const btn  = document.getElementById('btn-esc-salvar');
    btn.disabled=true; btn.textContent='Salvando...';
    try {
      const res = await api.criarEscalaDraft({
        user_id:promotorId, slot_id:slotId, funcao_prevista:funcao, tipo_jornada:tipo,
        data:slot?.data_slot||new Date().toISOString().split('T')[0],
        inicio:slot?.inicio_slot||'', fim:slot?.fim_slot||'',
        cargo_principal:prom?.cargo_principal||'PROMOTOR',
        cidade:slot?.cidade||'', operacao:'PROMO',
      });
      if (res.ok) { _closeModal('modal-escala'); await _loadEscala(); document.querySelector('.filter-btn[data-filter="RASCUNHO"]')?.click(); }
      else _showEscalaError('esc-error', res.erro||res.mensagem||'Erro ao salvar.');
    } catch(e) { _showEscalaError('esc-error','Sem conexão.'); }
    btn.disabled=false; btn.textContent='✓ Salvar Rascunho';
  }

  async function publicar(draftId) {
    const draft = _drafts.find(d=>d.escala_draft_id===draftId);
    if (!draft) return;
    const detalhes = document.getElementById('modal-publicar-detalhes');
    if (detalhes) detalhes.innerHTML=`
      <div class="modal-info-row"><span>Promotor</span><strong>${draft.promotor_nome||draft.user_id}</strong></div>
      <div class="modal-info-row"><span>Slot</span><strong>${draft.slot_nome||draft.slot_id}</strong></div>
      <div class="modal-info-row"><span>Data</span><strong>${draft.data||'—'}</strong></div>
      <div class="modal-info-row"><span>Horário</span><strong>${_fh(draft.inicio)} – ${_fh(draft.fim)}</strong></div>`;
    _openModal('modal-publicar');
    const btn = document.getElementById('btn-pub-confirmar');
    const novo = btn.cloneNode(true); btn.parentNode.replaceChild(novo,btn);
    novo.addEventListener('click', async()=>{
      novo.disabled=true; novo.textContent='Publicando...';
      try {
        const res = await api.publicarEscala(draftId);
        if (res.ok) { _closeModal('modal-publicar'); await _loadEscala(); }
        else alert('Erro: '+(res.erro||res.mensagem));
      } catch(e) { alert('Sem conexão.'); }
      novo.disabled=false; novo.textContent='📅 Publicar';
    });
  }

  async function excluirDraft(draftId) {
    if (!confirm('Excluir este rascunho?')) return;
    try { await api.excluirEscalaDraft(draftId); await _loadEscala(); }
    catch(e) { alert('Erro ao excluir.'); }
  }

  function _fh(v) {
    if (!v) return '—';
    const s=String(v);
    if (/^\d{2}:\d{2}/.test(s)) return s.substring(0,5);
    try { return new Date(v).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); } catch(_) { return '—'; }
  }
  function _showEscalaError(elId,msg) { const el=document.getElementById(elId); if(!el)return; el.textContent=msg; el.style.display='block'; }
  function _openModal(id)  { document.getElementById(id)?.classList.remove('hidden'); }
  function _closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }
  function destroy() {}
  return { render, destroy, publicar, excluirDraft };
})();

function _fdEscala(v) {
  if (!v) return '—';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  try {
    return new Date(v).toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric'});
  } catch(_) { return '—'; }
}
