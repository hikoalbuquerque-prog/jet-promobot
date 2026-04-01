// ─── slots.js (gestor) v2 ────────────────────────────────────────────────────
// Lista slots + criação unitária + lote (repetição semanal, cópia, CSV)

const slotsScreen = (() => {
  let _slots = [];

  function render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <section class="screen" id="screen-slots">
        <div class="screen-header">
          <h2 class="screen-title">Slots</h2>
          <div style="display:flex;gap:8px;margin-left:auto">
            <button class="btn-icon" id="btn-importar-csv" title="Importar CSV" style="color:#b794f4;border-color:#b794f440">CSV</button>
            <button class="btn-icon" id="btn-lote" title="Criar em lote" style="color:#f6ad55;border-color:#f6ad5540;font-size:13px;width:auto;padding:0 10px">+ Lote</button>
            <button class="btn-icon" id="btn-novo-slot" title="Novo slot" style="color:#63b3ed;border-color:#63b3ed40;font-size:18px">+</button>
            <button class="btn-icon" id="btn-refresh-slots" title="Atualizar">↻</button>
          </div>
        </div>

        <div class="filter-bar">
          <button class="filter-btn active" data-filter="TODOS">Todos</button>
          <button class="filter-btn" data-filter="DISPONIVEL">Disponíveis</button>
          <button class="filter-btn" data-filter="OCUPADO">Ocupados</button>
          <button class="filter-btn" data-filter="ENCERRADO">Encerrados</button>
        </div>

        <div id="slots-lista" class="card-list">
          <div class="list-loading">Carregando slots...</div>
        </div>
      </section>

      <!-- Modal: Novo Slot (unitário) -->
      <div id="modal-novo-slot" class="modal hidden">
        <div class="modal-box" style="max-width:520px;max-height:90vh;overflow-y:auto">
          <div class="modal-title">+ Novo Slot</div>
          ${_formSlotHTML('ns')}
          <div id="ns-error" style="display:none;color:#fc8181;font-size:12px;margin-bottom:12px;padding:8px;background:rgba(252,129,129,.1);border-radius:4px"></div>
          <div class="modal-actions">
            <button class="btn-danger" id="btn-ns-cancel">Cancelar</button>
            <button class="btn-success" id="btn-ns-criar">✓ Criar Slot</button>
          </div>
        </div>
      </div>

      <!-- Modal: Criar em Lote -->
      <div id="modal-lote" class="modal hidden">
        <div class="modal-box" style="max-width:580px;max-height:90vh;overflow-y:auto">
          <div class="modal-title">+ Criar Slots em Lote</div>

          <!-- Tabs -->
          <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:1px solid rgba(255,255,255,.08)">
            <button class="lote-tab active" data-tab="repetir" style="padding:8px 16px;background:none;border:none;border-bottom:2px solid #63b3ed;color:#63b3ed;cursor:pointer;font-size:13px">📅 Repetição semanal</button>
            <button class="lote-tab" data-tab="copiar" style="padding:8px 16px;background:none;border:none;border-bottom:2px solid transparent;color:#718096;cursor:pointer;font-size:13px">📋 Copiar slot</button>
          </div>

          <!-- Tab: Repetição semanal -->
          <div id="tab-repetir">
            ${_formSlotHTML('lt')}
            <div style="margin-bottom:12px">
              <label class="modal-label">DIAS DA SEMANA</label>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
                ${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((d,i) => `
                  <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px;color:#a0aec0">
                    <input type="checkbox" class="lote-dia" value="${i}" style="accent-color:#63b3ed"> ${d}
                  </label>`).join('')}
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
              <div>
                <label class="modal-label">DATA INÍCIO</label>
                <input id="lt-data-ini" class="modal-textarea" style="height:40px;resize:none" type="date" />
              </div>
              <div>
                <label class="modal-label">DATA FIM</label>
                <input id="lt-data-fim" class="modal-textarea" style="height:40px;resize:none" type="date" />
              </div>
            </div>
            <div id="lt-preview" style="font-size:12px;color:#718096;margin-bottom:12px"></div>
          </div>

          <!-- Tab: Copiar slot -->
          <div id="tab-copiar" style="display:none">
            <div style="margin-bottom:12px">
              <label class="modal-label">SLOT DE ORIGEM</label>
              <select id="cp-slot-origem" class="modal-textarea" style="height:40px;resize:none">
                <option value="">Selecione um slot...</option>
              </select>
            </div>
            <div style="margin-bottom:12px">
              <label class="modal-label">NOVAS DATAS (uma por linha)</label>
              <textarea id="cp-datas" class="modal-textarea" rows="5" placeholder="2026-04-01&#10;2026-04-08&#10;2026-04-15"></textarea>
            </div>
          </div>

          <div id="lote-error" style="display:none;color:#fc8181;font-size:12px;margin-bottom:12px;padding:8px;background:rgba(252,129,129,.1);border-radius:4px"></div>
          <div id="lote-progress" style="display:none;font-size:12px;color:#63b3ed;margin-bottom:12px;padding:8px;background:rgba(99,179,237,.08);border-radius:4px"></div>

          <div class="modal-actions">
            <button class="btn-danger" id="btn-lote-cancel">Cancelar</button>
            <button class="btn-success" id="btn-lote-criar">✓ Criar Slots</button>
          </div>
        </div>
      </div>

      <!-- Modal: Importar CSV -->
      <div id="modal-csv" class="modal hidden">
        <div class="modal-box" style="max-width:520px">
          <div class="modal-title">📄 Importar Slots via CSV</div>
          <div style="font-size:12px;color:#718096;margin-bottom:12px;line-height:1.6">
            Formato esperado (com cabeçalho):<br>
            <code style="color:#63b3ed">nome,cidade,lat,lng,data,inicio,fim,raio_metros,cargo_previsto</code>
          </div>
          <button id="btn-baixar-modelo" class="panel-btn" style="margin-bottom:12px">⬇️ Baixar modelo CSV</button>
          <div style="margin-bottom:12px">
            <label class="modal-label">SELECIONAR ARQUIVO CSV</label>
            <input id="csv-file" type="file" accept=".csv,.txt" style="width:100%;padding:10px;background:#0a0f1e;border:1px solid rgba(99,179,237,.2);border-radius:4px;color:#e2e8f0;font-size:13px" />
          </div>
          <div id="csv-preview" style="display:none;margin-bottom:12px;max-height:200px;overflow-y:auto"></div>
          <div id="csv-error" style="display:none;color:#fc8181;font-size:12px;margin-bottom:12px;padding:8px;background:rgba(252,129,129,.1);border-radius:4px"></div>
          <div id="csv-progress" style="display:none;font-size:12px;color:#63b3ed;margin-bottom:12px;padding:8px;background:rgba(99,179,237,.08);border-radius:4px"></div>
          <div class="modal-actions">
            <button class="btn-danger" id="btn-csv-cancel">Cancelar</button>
            <button class="btn-success" id="btn-csv-importar" disabled>✓ Importar</button>
          </div>
        </div>
      </div>
    `;

    _bindEvents();
    _preencherDataHoje();
    _load();
  }

  function _formSlotHTML(prefix) {
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div><label class="modal-label">LOCAL / NOME *</label><input id="${prefix}-nome" class="modal-textarea" style="height:40px;resize:none" placeholder="Ex: Parque Ibirapuera" /></div>
        <div><label class="modal-label">CIDADE *</label><input id="${prefix}-cidade" class="modal-textarea" style="height:40px;resize:none" placeholder="São Paulo" /></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div><label class="modal-label">LATITUDE *</label><input id="${prefix}-lat" class="modal-textarea" style="height:40px;resize:none" placeholder="-23.5873" type="number" step="any" /></div>
        <div><label class="modal-label">LONGITUDE *</label><input id="${prefix}-lng" class="modal-textarea" style="height:40px;resize:none" placeholder="-46.6573" type="number" step="any" /></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
        <div><label class="modal-label">DATA *</label><input id="${prefix}-data" class="modal-textarea" style="height:40px;resize:none" type="date" /></div>
        <div><label class="modal-label">INÍCIO *</label><input id="${prefix}-inicio" class="modal-textarea" style="height:40px;resize:none" type="time" /></div>
        <div><label class="modal-label">FIM *</label><input id="${prefix}-fim" class="modal-textarea" style="height:40px;resize:none" type="time" /></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div><label class="modal-label">RAIO (m)</label><input id="${prefix}-raio" class="modal-textarea" style="height:40px;resize:none" type="number" placeholder="100" value="100" /></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div><label class="modal-label">CARGO PREVISTO</label><input id="${prefix}-cargo" class="modal-textarea" style="height:40px;resize:none" placeholder="PROMOTOR" value="PROMOTOR" /></div>
        <div><label class="modal-label">OPERAÇÃO</label><input id="${prefix}-operacao" class="modal-textarea" style="height:40px;resize:none" placeholder="PROMO" value="PROMO" /></div>
      </div>`;
  }

  function _bindEvents() {
    // Filtros
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _renderLista(btn.dataset.filter);
      });
    });

    document.getElementById('btn-refresh-slots').addEventListener('click', _load);

    // Modal unitário
    document.getElementById('btn-novo-slot').addEventListener('click', () => _openModal('modal-novo-slot'));
    document.getElementById('btn-ns-cancel').addEventListener('click', () => _closeModal('modal-novo-slot'));
    document.getElementById('btn-ns-criar').addEventListener('click', _criarUnitario);

    // Modal lote
    document.getElementById('btn-lote').addEventListener('click', () => {
      _popularSelectSlots();
      _openModal('modal-lote');
    });
    document.getElementById('btn-lote-cancel').addEventListener('click', () => _closeModal('modal-lote'));
    document.getElementById('btn-lote-criar').addEventListener('click', _criarLote);

    // Tabs do lote
    document.querySelectorAll('.lote-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.lote-tab').forEach(t => {
          t.style.borderBottomColor = 'transparent';
          t.style.color = '#718096';
          t.classList.remove('active');
        });
        tab.style.borderBottomColor = '#63b3ed';
        tab.style.color = '#63b3ed';
        tab.classList.add('active');
        document.getElementById('tab-repetir').style.display = tab.dataset.tab === 'repetir' ? 'block' : 'none';
        document.getElementById('tab-copiar').style.display  = tab.dataset.tab === 'copiar'  ? 'block' : 'none';
      });
    });

    // Preview de datas no lote
    ['lt-data-ini','lt-data-fim'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', _atualizarPreview);
    });
    document.querySelectorAll('.lote-dia').forEach(cb => cb.addEventListener('change', _atualizarPreview));

    // Modal CSV
    document.getElementById('btn-importar-csv').addEventListener('click', () => _openModal('modal-csv'));
    document.getElementById('btn-csv-cancel').addEventListener('click', () => _closeModal('modal-csv'));
    document.getElementById('btn-csv-importar').addEventListener('click', _importarCSV);
    document.getElementById('btn-baixar-modelo').addEventListener('click', _baixarModeloCSV);
    document.getElementById('csv-file').addEventListener('change', _previewCSV);

    // Fechar modais clicando fora
    ['modal-novo-slot','modal-lote','modal-csv'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', e => {
        if (e.target.id === id) _closeModal(id);
      });
    });
  }

  function _preencherDataHoje() {
    const hoje = new Date().toISOString().split('T')[0];
    const amanhã = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const nsData = document.getElementById('ns-data');
    if (nsData) nsData.value = hoje;
    const ltIni = document.getElementById('lt-data-ini');
    if (ltIni) ltIni.value = hoje;
    const ltFim = document.getElementById('lt-data-fim');
    if (ltFim) ltFim.value = new Date(Date.now() + 28 * 86400000).toISOString().split('T')[0];
  }

  async function _load() {
    const lista = document.getElementById('slots-lista');
    if (lista) lista.innerHTML = '<div class="list-loading">Carregando...</div>';
    try {
      const res = await api.getSlotsHoje();
      _slots = res?.data || [];
      state.set('slots', _slots);
      _renderLista('TODOS');
    } catch (err) {
      if (lista) lista.innerHTML = `<div class="list-error">Erro: ${err.message}</div>`;
    }
  }

  function _renderLista(filtro) {
    const lista = document.getElementById('slots-lista');
    if (!lista) return;
    const filtrados = filtro === 'TODOS' ? _slots : _slots.filter(s => s.status === filtro);
    if (!filtrados.length) {
      lista.innerHTML = `<div class="list-empty">Nenhum slot encontrado.</div>`;
      return;
    }
    lista.innerHTML = filtrados.map(s => {
      const si = _statusSlot(s.status);
      return `
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">${s.nome || s.slot_id}</div>
              <div class="card-sub">${s.slot_id || ''}</div>
            </div>
            <span class="status-badge" style="background:${si.color}20;color:${si.color};border-color:${si.color}40">${si.label}</span>
          </div>
          <div class="card-body">
            <div class="card-row"><span>Horário</span><strong>${s.inicio_slot||'—'} → ${s.fim_slot||'—'}</strong></div>
            <div class="card-row"><span>Raio</span><strong>${s.raio_metros}m</strong></div>
            <div class="card-row"><span>Promotor</span><strong>${s.promotor_nome||'—'}</strong></div>
          </div>
          <div class="card-actions">
            <button class="btn-success btn-sm" onclick="slotsScreen.copiarSlot('${s.slot_id}')">📋 Copiar</button>
          </div>
        </div>`;
    }).join('');
  }

  // ── Criar unitário ────────────────────────────────────────────────────────
  async function _criarUnitario() {
    const dados = _coletarForm('ns');
    if (!dados) return;
    const btn = document.getElementById('btn-ns-criar');
    btn.disabled = true; btn.textContent = 'Criando...';
    try {
      const res = await api.criarSlot(dados);
      if (res.ok) { _closeModal('modal-novo-slot'); await _load(); }
      else _showError('ns-error', res.erro || res.mensagem || 'Erro ao criar slot.');
    } catch(e) { _showError('ns-error', 'Sem conexão.'); }
    btn.disabled = false; btn.textContent = '✓ Criar Slot';
  }

  // ── Criar em lote ─────────────────────────────────────────────────────────
  async function _criarLote() {
    const tabAtiva = document.querySelector('.lote-tab.active')?.dataset.tab;
    const btn = document.getElementById('btn-lote-criar');
    btn.disabled = true; btn.textContent = 'Criando...';

    let slots = [];

    if (tabAtiva === 'repetir') {
      const base = _coletarForm('lt');
      if (!base) { btn.disabled = false; btn.textContent = '✓ Criar Slots'; return; }

      const dias = [...document.querySelectorAll('.lote-dia:checked')].map(c => parseInt(c.value));
      const dataIni = document.getElementById('lt-data-ini')?.value;
      const dataFim = document.getElementById('lt-data-fim')?.value;

      if (!dias.length) { _showError('lote-error', 'Selecione pelo menos um dia da semana.'); btn.disabled = false; btn.textContent = '✓ Criar Slots'; return; }
      if (!dataIni || !dataFim) { _showError('lote-error', 'Informe data início e fim.'); btn.disabled = false; btn.textContent = '✓ Criar Slots'; return; }

      const datas = _gerarDatas(dataIni, dataFim, dias);
      slots = datas.map(data => ({ ...base, data }));

    } else if (tabAtiva === 'copiar') {
      const slotOrigemId = document.getElementById('cp-slot-origem')?.value;
      const datasRaw     = document.getElementById('cp-datas')?.value || '';
      const slotOrigem   = _slots.find(s => s.slot_id === slotOrigemId);

      if (!slotOrigem) { _showError('lote-error', 'Selecione um slot de origem.'); btn.disabled = false; btn.textContent = '✓ Criar Slots'; return; }

      const datas = datasRaw.split('\n').map(d => d.trim()).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
      if (!datas.length) { _showError('lote-error', 'Informe pelo menos uma data válida (AAAA-MM-DD).'); btn.disabled = false; btn.textContent = '✓ Criar Slots'; return; }

      slots = datas.map(data => ({
        nome:          slotOrigem.nome,
        cidade:        slotOrigem.cidade || '',
        lat:           slotOrigem.lat,
        lng:           slotOrigem.lng,
        inicio:        slotOrigem.inicio_slot || '',
        fim:           slotOrigem.fim_slot    || '',
        raio_metros:   slotOrigem.raio_metros || 100,
        cargo_previsto:slotOrigem.cargo_previsto || 'PROMOTOR',
        operacao:      slotOrigem.operacao || 'PROMO',

        data,
      }));
    }

    if (!slots.length) { _showError('lote-error', 'Nenhum slot a criar.'); btn.disabled = false; btn.textContent = '✓ Criar Slots'; return; }

    // Criar em sequência com progress
    let criados = 0;
    const progEl = document.getElementById('lote-progress');
    progEl.style.display = 'block';

    for (const slot of slots) {
      progEl.textContent = `Criando ${criados + 1} de ${slots.length}...`;
      try {
        const res = await api.criarSlot(slot);
        if (res.ok) criados++;
      } catch(_) {}
    }

    progEl.textContent = `✅ ${criados} de ${slots.length} slots criados com sucesso.`;
    btn.textContent = 'Concluído';
    setTimeout(async () => { _closeModal('modal-lote'); await _load(); }, 1500);
  }

  // ── Copiar slot (atalho da lista) ─────────────────────────────────────────
  function copiarSlot(slotId) {
    const slot = _slots.find(s => s.slot_id === slotId);
    if (!slot) return;
    _popularSelectSlots();
    _openModal('modal-lote');
    // Ativar tab copiar
    document.querySelectorAll('.lote-tab').forEach(t => {
      const ativo = t.dataset.tab === 'copiar';
      t.style.borderBottomColor = ativo ? '#63b3ed' : 'transparent';
      t.style.color = ativo ? '#63b3ed' : '#718096';
      if (ativo) t.classList.add('active'); else t.classList.remove('active');
    });
    document.getElementById('tab-repetir').style.display = 'none';
    document.getElementById('tab-copiar').style.display  = 'block';
    const sel = document.getElementById('cp-slot-origem');
    if (sel) sel.value = slotId;
  }

  // ── Importar CSV ──────────────────────────────────────────────────────────
  function _previewCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const linhas = ev.target.result.split('\n').filter(l => l.trim());
      const preview = document.getElementById('csv-preview');
      const btnImportar = document.getElementById('btn-csv-importar');
      preview.style.display = 'block';
      preview.innerHTML = `
        <div style="font-size:11px;color:#718096;margin-bottom:6px">${linhas.length - 1} slots encontrados</div>
        <div style="background:#0a0f1e;border-radius:4px;padding:10px;font-size:11px;font-family:'IBM Plex Mono',monospace;color:#a0aec0;white-space:pre-wrap;max-height:150px;overflow-y:auto">${linhas.slice(0, 6).join('\n')}${linhas.length > 6 ? '\n...' : ''}</div>`;
      btnImportar.disabled = linhas.length < 2;
    };
    reader.readAsText(file);
  }

  async function _importarCSV() {
    const file = document.getElementById('csv-file').files[0];
    if (!file) return;

    const btn = document.getElementById('btn-csv-importar');
    btn.disabled = true; btn.textContent = 'Importando...';

    const reader = new FileReader();
    reader.onload = async ev => {
      const linhas = ev.target.result.split('\n').filter(l => l.trim());
      const header = linhas[0].split(',').map(h => h.trim().toLowerCase());
      const slots  = [];

      for (let i = 1; i < linhas.length; i++) {
        const cols = linhas[i].split(',').map(c => c.trim());
        const slot = {};
        header.forEach((h, idx) => { slot[h] = cols[idx] || ''; });
        if (slot.nome && slot.lat && slot.lng && slot.data && slot.inicio && slot.fim) {
          slots.push(slot);
        }
      }

      if (!slots.length) {
        _showError('csv-error', 'Nenhum slot válido encontrado. Verifique o formato.');
        btn.disabled = false; btn.textContent = '✓ Importar';
        return;
      }

      let criados = 0;
      const progEl = document.getElementById('csv-progress');
      progEl.style.display = 'block';

      for (const slot of slots) {
        progEl.textContent = `Importando ${criados + 1} de ${slots.length}...`;
        try {
          const res = await api.criarSlot({
            nome:          slot.nome,
            cidade:        slot.cidade || 'São Paulo',
            lat:           slot.lat,
            lng:           slot.lng,
            data:          slot.data,
            inicio:        slot.inicio,
            fim:           slot.fim,
            raio_metros:   slot.raio_metros || 100,
            cargo_previsto:slot.cargo_previsto || 'PROMOTOR',
            operacao:      slot.operacao || 'PROMO',
          });
          if (res.ok) criados++;
        } catch(_) {}
      }

      progEl.textContent = `✅ ${criados} de ${slots.length} slots importados.`;
      btn.textContent = 'Concluído';
      setTimeout(async () => { _closeModal('modal-csv'); await _load(); }, 1500);
    };
    reader.readAsText(file);
  }

  function _baixarModeloCSV() {
    const csv = 'nome,cidade,lat,lng,data,inicio,fim,raio_metros,cargo_previsto\nParque Ibirapuera,São Paulo,-23.5873,-46.6573,2026-04-01,09:00,13:00,100,PROMOTOR\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'modelo_slots.csv';
    a.click();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _gerarDatas(dataIni, dataFim, diasSemana) {
    const datas = [];
    const cur   = new Date(dataIni + 'T12:00:00');
    const fim   = new Date(dataFim + 'T12:00:00');
    while (cur <= fim) {
      if (diasSemana.includes(cur.getDay())) {
        datas.push(cur.toISOString().split('T')[0]);
      }
      cur.setDate(cur.getDate() + 1);
    }
    return datas;
  }

  function _atualizarPreview() {
    const dias    = [...document.querySelectorAll('.lote-dia:checked')].map(c => parseInt(c.value));
    const dataIni = document.getElementById('lt-data-ini')?.value;
    const dataFim = document.getElementById('lt-data-fim')?.value;
    const preview = document.getElementById('lt-preview');
    if (!preview) return;
    if (!dias.length || !dataIni || !dataFim) { preview.textContent = ''; return; }
    const datas = _gerarDatas(dataIni, dataFim, dias);
    preview.textContent = `${datas.length} slot(s) serão criados: ${datas.slice(0,3).join(', ')}${datas.length > 3 ? '...' : ''}`;
    preview.style.color = '#63b3ed';
  }

  function _popularSelectSlots() {
    const sel = document.getElementById('cp-slot-origem');
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione um slot...</option>' +
      _slots.map(s => `<option value="${s.slot_id}">${s.nome || s.slot_id} (${s.inicio_slot||''}–${s.fim_slot||''})</option>`).join('');
  }

  function _coletarForm(prefix) {
    const v = id => document.getElementById(id)?.value?.trim() || '';
    const nome   = v(`${prefix}-nome`);
    const cidade = v(`${prefix}-cidade`);
    const lat    = v(`${prefix}-lat`);
    const lng    = v(`${prefix}-lng`);
    const inicio = v(`${prefix}-inicio`);
    const fim    = v(`${prefix}-fim`);

    const data = v(`${prefix}-data`) || new Date().toISOString().split('T')[0];

    if (!nome || !cidade || !lat || !lng || !inicio || !fim || !data) {
      _showError(`${prefix}-error`, 'Preencha todos os campos obrigatórios (*).');
      return null;
    }
    return {
      nome, cidade, lat, lng, data, inicio, fim,
      raio_metros:    v(`${prefix}-raio`)    || 100,
      cargo_previsto: v(`${prefix}-cargo`)   || 'PROMOTOR',
      operacao:       v(`${prefix}-operacao`)|| 'PROMO',
    };
  }

  function _showError(elId, msg) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  }

  function _openModal(id)  { document.getElementById(id)?.classList.remove('hidden'); }
  function _closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

  function _statusSlot(status) {
    const m = {
      DISPONIVEL: { label:'Disponível', color:'#68d391' },
      OCUPADO:    { label:'Ocupado',    color:'#f6ad55' },
      ENCERRADO:  { label:'Encerrado',  color:'#718096' },
    };
    return m[status] || { label: status||'—', color:'#718096' };
  }

  function destroy() {}
  return { render, destroy, copiarSlot };
})();