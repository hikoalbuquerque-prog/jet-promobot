// ─── solicitacoes.js ──────────────────────────────────────────────────────────
// Lista e aprovação de solicitações operacionais

const solicitacoesScreen = (() => {
  let _lista = [];

  function render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <section class="screen" id="screen-solicitacoes">
        <div class="screen-header">
          <h2 class="screen-title">Solicitações</h2>
          <button class="btn-icon" id="btn-refresh-sol" title="Atualizar">↻</button>
        </div>

        <!-- Filtros -->
        <div class="filter-bar">
          <button class="filter-btn active" data-filter="ABERTA">Abertas</button>
          <button class="filter-btn" data-filter="TODAS">Todas</button>
          <button class="filter-btn" data-filter="APROVADA">Aprovadas</button>
          <button class="filter-btn" data-filter="NEGADA">Negadas</button>
        </div>

        <div id="sol-lista" class="card-list">
          <div class="list-loading">Carregando...</div>
        </div>
      </section>

      <!-- Modal de decisão -->
      <div id="modal-decisao" class="modal hidden">
        <div class="modal-box">
          <div class="modal-title" id="modal-titulo">Responder Solicitação</div>
          <div class="modal-body" id="modal-detalhes"></div>
          <label class="modal-label">Observação (opcional)</label>
          <textarea id="modal-obs" class="modal-textarea" rows="3" placeholder="Ex: Aprovado conforme critério X..."></textarea>
          <div class="modal-actions">
            <button class="btn-danger" id="btn-negar">✕ Negar</button>
            <button class="btn-success" id="btn-aprovar">✓ Aprovar</button>
          </div>
          <button class="modal-cancel" id="btn-modal-cancel">Cancelar</button>
        </div>
      </div>
    `;

    document.getElementById('btn-refresh-sol').addEventListener('click', _load);
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _renderLista(btn.dataset.filter);
      });
    });

    document.getElementById('btn-modal-cancel').addEventListener('click', _closeModal);
    document.getElementById('modal-decisao').addEventListener('click', e => {
      if (e.target.id === 'modal-decisao') _closeModal();
    });

    _load();
  }

  async function _load() {
    const lista = document.getElementById('sol-lista');
    if (lista) lista.innerHTML = '<div class="list-loading">Carregando...</div>';

    try {
      const res = await api.getSolicitacoesAbertas();
      _lista = res?.data || [];
      state.set('solicitacoes', _lista);
      _renderLista('ABERTA');
    } catch (err) {
      if (lista) lista.innerHTML = `<div class="list-error">Erro: ${err.message}</div>`;
    }
  }

  function _renderLista(filtro) {
    const lista = document.getElementById('sol-lista');
    if (!lista) return;

    const filtrados = filtro === 'TODAS'
      ? _lista
      : _lista.filter(s => s.status === filtro);

    if (!filtrados.length) {
      const msgs = {
        ABERTA:   'Nenhuma solicitação aberta. ✓',
        TODAS:    'Nenhuma solicitação registrada.',
        APROVADA: 'Nenhuma aprovada ainda.',
        NEGADA:   'Nenhuma negada.',
      };
      lista.innerHTML = `<div class="list-empty">${msgs[filtro] || 'Sem resultados.'}</div>`;
      return;
    }

    lista.innerHTML = filtrados.map(s => {
      const tipo = _tipoLabel(s.tipo_solicitacao);
      const st   = _statusSol(s.status);
      const aberta = s.status === 'ABERTA';

      return `
        <div class="card ${aberta ? 'card-urgent' : ''}">
          <div class="card-header">
            <div>
              <div class="card-title">${tipo}</div>
              <div class="card-sub">${s.promotor_nome} · ${_formatDate(s.criado_em)}</div>
            </div>
            <span class="status-badge" style="
              background:${st.color}20;color:${st.color};border-color:${st.color}40;
            ">${st.label}</span>
          </div>

          <div class="card-body">
            ${s.descricao ? `<div class="card-desc">"${s.descricao}"</div>` : ''}
            ${s.slot_nome ? `<div class="card-row"><span>Slot</span><strong>${s.slot_nome}</strong></div>` : ''}
            ${s.status !== 'ABERTA' && s.observacao ? `
              <div class="card-row"><span>Observação</span><strong>${s.observacao}</strong></div>
              <div class="card-row"><span>Respondida</span><strong>${_formatDate(s.respondida_em)}</strong></div>
            ` : ''}
          </div>

          ${aberta ? `
            <div class="card-actions">
              <button class="btn-danger btn-sm" data-id="${s.solicitacao_id}" data-action="NEGAR">✕ Negar</button>
              <button class="btn-success btn-sm" data-id="${s.solicitacao_id}" data-action="APROVAR">✓ Aprovar</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Bind nos botões de ação
    lista.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sol = _lista.find(s => s.solicitacao_id === btn.dataset.id);
        if (sol) _openModal(sol, btn.dataset.action);
      });
    });
  }

  // ── Modal de decisão ─────────────────────────────────────────────────────────
  let _modalSol = null;
  let _modalAcao = null;

  function _openModal(sol, acao) {
    _modalSol = sol;
    _modalAcao = acao;

    const modal = document.getElementById('modal-decisao');
    const titulo = document.getElementById('modal-titulo');
    const detalhes = document.getElementById('modal-detalhes');

    titulo.textContent = acao === 'APROVAR' ? '✓ Aprovar Solicitação' : '✕ Negar Solicitação';
    detalhes.innerHTML = `
      <div class="modal-info-row"><span>Promotor</span><strong>${sol.promotor_nome}</strong></div>
      <div class="modal-info-row"><span>Tipo</span><strong>${_tipoLabel(sol.tipo_solicitacao)}</strong></div>
      ${sol.descricao ? `<div class="modal-info-row"><span>Descrição</span><strong>${sol.descricao}</strong></div>` : ''}
    `;

    document.getElementById('modal-obs').value = '';

    const btnAprovar = document.getElementById('btn-aprovar');
    const btnNegar   = document.getElementById('btn-negar');

    // Remove listeners antigos clonando os botões
    btnAprovar.replaceWith(btnAprovar.cloneNode(true));
    btnNegar.replaceWith(btnNegar.cloneNode(true));

    document.getElementById('btn-aprovar').addEventListener('click', () => _confirmar('APROVADA'));
    document.getElementById('btn-negar').addEventListener('click',   () => _confirmar('NEGADA'));

    modal.classList.remove('hidden');
  }

  async function _confirmar(decisao) {
    const obs = document.getElementById('modal-obs').value.trim();
    const btn = document.getElementById(decisao === 'APROVADA' ? 'btn-aprovar' : 'btn-negar');

    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
      const res = await api.responderSolicitacao(_modalSol.solicitacao_id, decisao, obs);
      if (res.status !== 'ok') throw new Error(res.message || 'Erro ao responder.');

      _closeModal();
      await _load();

    } catch (err) {
      alert(`Erro: ${err.message}`);
      btn.disabled = false;
      btn.textContent = decisao === 'APROVADA' ? '✓ Aprovar' : '✕ Negar';
    }
  }

  function _closeModal() {
    document.getElementById('modal-decisao')?.classList.add('hidden');
    _modalSol = null;
    _modalAcao = null;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function _tipoLabel(tipo) {
    const m = {
      PAUSA_EMERGENCIAL:    'Pausa Emergencial',
      RELOCALIZACAO:        'Relocalização',
      PROBLEMA_PATINETE:    'Problema com Patinete',
      ENCERRAMENTO_ANTECIP: 'Encerramento Antecipado',
    };
    return m[tipo] || tipo || 'Solicitação';
  }

  function _statusSol(status) {
    const m = {
      ABERTA:   { label: 'Aberta',   color: '#f6ad55' },
      APROVADA: { label: 'Aprovada', color: '#68d391' },
      NEGADA:   { label: 'Negada',   color: '#fc8181' },
    };
    return m[status] || { label: status || '—', color: '#718096' };
  }

  function _formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
    } catch (_) { return iso; }
  }

  function destroy() {}

  return { render, destroy };
})();