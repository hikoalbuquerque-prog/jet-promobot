// ─── equipes.js ─────────────────────────────────────────────────────────────
// Gestão de Equipes (Hierarquia: Regional -> Gestor -> Líder -> Promotor)

const equipesScreen = (() => {
  let _equipes = [];
  let _membros = [];
  let _promotoresLista = [];
  let _loading = false;

  async function loadData() {
    _loading = true;
    render();
    try {
      const [resEq, resPl] = await Promise.all([
        api.getEquipes(),
        api.getPromotoresLista()
      ]);
      _equipes = resEq.equipes || [];
      _membros = resEq.membros || [];
      _promotoresLista = resPl.lista || [];
    } catch (e) {
      alert('Erro ao carregar equipes: ' + e.message);
    } finally {
      _loading = false;
      render();
    }
  }

  function _getMembrosEquipe(equipeId) {
    return _membros.filter(m => String(m.equipe_id) === String(equipeId) && String(m.ativo).toUpperCase() === 'TRUE');
  }

  function render() {
    const main = document.getElementById('app');
    if (!main) return;

    if (_loading) {
      main.innerHTML = `<div style="padding:40px;text-align:center;color:#a0aec0">Carregando equipes...</div>`;
      return;
    }

    const adminUser = state.get('gestor') || {};
    const isAdmin = ['GESTOR', 'REGIONAL'].includes((adminUser.tipo_vinculo || '').toUpperCase());

    let html = `
      <div class="screen">
        <div class="screen-header">
          <h1 class="screen-title">👥 Gestão de Equipes</h1>
          <div class="screen-subtitle">${_equipes.length} Equipe(s)</div>
        </div>
    `;

    if (isAdmin) {
      html += `
        <div style="margin-bottom: 20px;">
          <button class="btn-success" onclick="equipesScreen.openModal()">+ Nova Equipe</button>
        </div>
      `;
    }

    html += `<div class="card-list">`;
    
    if (_equipes.length === 0) {
      html += `<div style="padding:20px;color:#a0aec0;">Nenhuma equipe cadastrada.</div>`;
    } else {
      _equipes.forEach(eq => {
        const eqMembros = _getMembrosEquipe(eq.equipe_id);
        const lideres = eqMembros.filter(m => String(m.papel_na_equipe).toUpperCase() === 'LIDER');
        const promotores = eqMembros.filter(m => String(m.papel_na_equipe).toUpperCase() !== 'LIDER');

        html += `
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">${eq.nome_equipe || 'Equipe sem nome'}</div>
                <div class="card-sub">${eq.cidade} - ${eq.operacao}</div>
              </div>
              <div class="status-badge" style="border-color:${String(eq.ativo).toUpperCase() === 'TRUE' ? '#68d391;color:#68d391' : '#fc8181;color:#fc8181'}">
                ${String(eq.ativo).toUpperCase() === 'TRUE' ? 'ATIVA' : 'INATIVA'}
              </div>
            </div>
            <div class="card-body">
              <div class="card-row"><strong>ID:</strong> ${eq.equipe_id}</div>
              <div class="card-row"><strong>Gestor ID:</strong> ${eq.gestor_id}</div>
              <div class="card-row"><strong>Regional ID:</strong> ${eq.regional_id || 'N/A'}</div>
              <hr style="border:0;border-top:1px solid rgba(255,255,255,0.05);margin:10px 0"/>
              <div class="card-row"><strong>Líderes:</strong> ${lideres.length}</div>
              <div class="card-row"><strong>Promotores:</strong> ${promotores.length}</div>
            </div>
            ${isAdmin ? `
            <div class="card-actions">
              <button class="btn-success" style="flex:1" onclick="equipesScreen.openModal('${eq.equipe_id}')">Editar</button>
            </div>
            ` : ''}
          </div>
        `;
      });
    }

    html += `</div></div>`;
    main.innerHTML = html;
  }

  function openModal(equipeId = null) {
    let eq = {
      equipe_id: '', gestor_id: state.get('gestor')?.user_id || '', regional_id: '',
      cidade: '', operacao: 'PROMO', nome_equipe: '', ativo: true
    };
    let eqMembros = [];

    if (equipeId) {
      eq = _equipes.find(e => e.equipe_id === equipeId) || eq;
      eqMembros = _getMembrosEquipe(equipeId);
    }

    const membrosStr = eqMembros.map(m => m.user_id + ':' + m.papel_na_equipe).join('\\n');

    const m = document.createElement('div');
    m.id = 'modal-equipe';
    m.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    m.innerHTML = `
      <div class="modal-box" style="width:100%;max-width:550px;max-height:95vh;overflow-y:auto">
        <div class="modal-title" style="display:flex;justify-content:space-between">
          <span>${equipeId ? 'Editar Equipe' : 'Nova Equipe'}</span>
          <span style="font-size:12px;color:#718096">ID: ${equipeId || 'Novo'}</span>
        </div>
        <div class="modal-body" style="margin-top:20px">
          
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px">
            <div>
              <label class="modal-label">Nome da Equipe</label>
              <input type="text" id="eq-nome" class="modal-textarea" value="${eq.nome_equipe}" />
            </div>
            <div>
              <label class="modal-label">Cidade</label>
              <input type="text" id="eq-cid" class="modal-textarea" value="${eq.cidade}" />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:10px">
            <div>
              <label class="modal-label">Operação</label>
              <select id="eq-op" class="modal-textarea">
                <option value="PROMO" ${eq.operacao==='PROMO'?'selected':''}>PROMO</option>
                <option value="OPERACAO" ${eq.operacao==='OPERACAO'?'selected':''}>OPERAÇÃO</option>
              </select>
            </div>
            <div>
              <label class="modal-label">Ativo</label>
              <select id="eq-ativo" class="modal-textarea">
                <option value="TRUE" ${String(eq.ativo).toUpperCase()==='TRUE'?'selected':''}>SIM</option>
                <option value="FALSE" ${String(eq.ativo).toUpperCase()==='FALSE'?'selected':''}>NÃO</option>
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:10px">
             <div>
              <label class="modal-label">Gestor ID (Dono)</label>
              <input type="text" id="eq-gestor" class="modal-textarea" value="${eq.gestor_id}" list="list-promotores-all" />
            </div>
            <div>
              <label class="modal-label">Regional ID (Opcional)</label>
              <input type="text" id="eq-regional" class="modal-textarea" value="${eq.regional_id}" list="list-promotores-all" />
            </div>
          </div>

          <datalist id="list-promotores-all">
            ${_promotoresLista.map(p => `<option value="${p.user_id}">${p.nome} (${p.cidade})</option>`).join('')}
          </datalist>

          <hr style="border:0;border-top:1px solid rgba(255,255,255,0.1);margin:20px 0" />

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <label class="modal-label" style="margin:0">Membros da Equipe</label>
            <button class="btn-success" style="padding:4px 10px;font-size:11px" onclick="equipesScreen.addMembroManual()">+ Add Membro</button>
          </div>
          
          <div id="membros-container" style="display:flex;flex-direction:column;gap:8px;background:rgba(0,0,0,0.2);padding:10px;border-radius:8px;max-height:200px;overflow-y:auto">
            <!-- Injetado via JS -->
          </div>

        </div>
        <div class="modal-actions" style="margin-top:24px">
          <button class="modal-cancel" onclick="document.getElementById('modal-equipe').remove()" style="flex:1">CANCELAR</button>
          <button class="btn-success" onclick="equipesScreen.salvar('${equipeId || ''}')" style="flex:2">SALVAR EQUIPE</button>
        </div>
      </div>
    `;
    document.body.appendChild(m);
    
    // Popular membros iniciais
    if (eqMembros.length > 0) {
      eqMembros.forEach(m => _addMembroRow(m.user_id, m.papel_na_equipe));
    } else if (!equipeId) {
      // Se for nova, adiciona uma linha vazia
      _addMembroRow('', 'PROMOTOR');
    }
  }

  function _addMembroRow(userId = '', papel = 'PROMOTOR') {
    const container = document.getElementById('membros-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'membro-row';
    row.style.cssText = 'display:flex;gap:8px;align-items:center';
    row.innerHTML = `
      <input type="text" class="modal-textarea member-uid" placeholder="User ID" value="${userId}" list="list-promotores-all" style="flex:2" />
      <select class="modal-textarea member-papel" style="flex:1.2">
        <option value="PROMOTOR" ${papel==='PROMOTOR'?'selected':''}>PROMOTOR</option>
        <option value="LIDER" ${papel==='LIDER'?'selected':''}>LÍDER</option>
      </select>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#fc8181;cursor:pointer;font-size:18px;padding:0 5px">×</button>
    `;
    container.appendChild(row);
  }

  async function salvar(equipeId) {
    const nome = document.getElementById('eq-nome').value.trim();
    const cid = document.getElementById('eq-cid').value.trim();
    const op = document.getElementById('eq-op').value.trim();
    const gestor = document.getElementById('eq-gestor').value.trim();
    const regional = document.getElementById('eq-regional').value.trim();
    const ativo = document.getElementById('eq-ativo').value === 'TRUE';
    
    const rows = document.querySelectorAll('.membro-row');
    const membrosParams = [];
    
    for (const row of rows) {
      const uid = row.querySelector('.member-uid').value.trim();
      const papel = row.querySelector('.member-papel').value;
      if (uid) membrosParams.push({ user_id: uid, papel_na_equipe: papel });
    }

    if (!nome || !cid || !gestor) return alert('Preencha os campos obrigatórios (Nome, Cidade, Gestor)');

    const payload = {
      equipe_id: equipeId || undefined,
      nome_equipe: nome,
      cidade: cid,
      operacao: op,
      gestor_id: gestor,
      regional_id: regional,
      ativo: ativo,
      membros: membrosParams
    };

    try {
      const btn = document.querySelector('#modal-equipe .btn-success:last-child');
      btn.textContent = 'SALVANDO...'; btn.disabled = true;
      const res = await api.salvarEquipe(payload);
      if (res.ok) {
        document.getElementById('modal-equipe').remove();
        loadData();
      } else {
        alert('Erro: ' + res.erro);
        btn.textContent = 'SALVAR EQUIPE'; btn.disabled = false;
      }
    } catch (e) {
      alert('Falha na comunicação: ' + e.message);
      const btn = document.querySelector('#modal-equipe .btn-success:last-child');
      btn.textContent = 'SALVAR EQUIPE'; btn.disabled = false;
    }
  }

  return { render: loadData, openModal, salvar, addMembroManual: () => _addMembroRow() };
})();
