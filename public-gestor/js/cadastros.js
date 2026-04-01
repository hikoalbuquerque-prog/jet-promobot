// ─── cadastros.js — Cadastros pendentes ──────────────────────────────────────
const cadastrosScreen = (() => {
  let _lista = [];

  async function render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <section class="screen" id="screen-cadastros">
        <div class="screen-header">
          <h2 class="screen-title">Cadastros Pendentes</h2>
          <button class="btn-icon" id="btn-refresh-cad">↻</button>
        </div>
        <div id="cad-list"><div class="list-empty">Carregando...</div></div>
      </section>`;
    document.getElementById('btn-refresh-cad').addEventListener('click', _load);
    await _load();
  }

  async function _load() {
    const el = document.getElementById('cad-list');
    if (el) el.innerHTML = '<div class="list-empty">Carregando...</div>';
    try {
      const res = await api.getCadastrosPendentes();
      _lista = res.data || [];
      _render();
    } catch(e) {
      if (el) el.innerHTML = '<div class="list-empty" style="color:#fc8181">Erro ao carregar.</div>';
    }
  }

  function _render() {
    const el = document.getElementById('cad-list');
    if (!el) return;
    if (!_lista.length) {
      el.innerHTML = '<div class="list-empty">Nenhum cadastro pendente.</div>';
      return;
    }
    el.innerHTML = _lista.map((c, i) => `
      <div class="card" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div>
            <div style="font-size:15px;font-weight:700">${c.nome_completo || '—'}</div>
            <div style="font-size:12px;color:#718096;margin-top:2px">${c.cargo || '—'} · ${c.cidade || '—'}</div>
          </div>
          <span style="font-size:11px;padding:3px 8px;border-radius:20px;background:rgba(245,183,0,.15);color:#f5b700;border:1px solid rgba(245,183,0,.3)">${c.status || 'PENDENTE'}</span>
        </div>
        <div style="font-size:12px;color:#718096;margin-bottom:12px">
          Telegram: ${c.telegram_nome || '—'} · ${c.criado_em ? new Date(c.criado_em).toLocaleDateString('pt-BR') : '—'}
        </div>
        ${c.cpf ? `<div style="font-size:12px;color:#718096;margin-bottom:4px">CPF: ${c.cpf} · Nasc: ${c.data_nascimento || '—'}</div>` : ''}
        ${(!c.status || c.status === 'PENDENTE') ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <button class="btn-success" onclick="cadastrosScreen._aprovar('${c.id}', ${i})">✓ Aprovar</button>
          <button class="btn-danger"  onclick="cadastrosScreen._rejeitar('${c.id}', ${i})">✕ Rejeitar</button>
        </div>` : ''}
      </div>`).join('');
  }

  async function _aprovar(id, idx) {
    const cad = _lista[idx];
    if (!cad) return;

    // Modal para preencher token e tipo vinculo
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.innerHTML = `
      <div style="background:#1a2035;border:1px solid rgba(99,179,237,.2);border-radius:12px;padding:24px;width:100%;max-width:400px">
        <div style="font-size:16px;font-weight:700;margin-bottom:16px">Aprovar cadastro</div>
        <div style="font-size:14px;color:#a0aec0;margin-bottom:16px">${cad.nome_completo} · ${cad.cargo}</div>
        <div style="margin-bottom:12px">
          <label class="modal-label">TOKEN DE ACESSO *</label>
          <input id="apr-token" class="modal-textarea" style="height:36px;resize:none" placeholder="Deixe vazio para gerar automaticamente"/>
        </div>
        <div style="margin-bottom:12px">
          <label class="modal-label">TIPO VÍNCULO *</label>
          <select id="apr-vinculo" class="modal-textarea" style="height:36px;resize:none">
            <option value="MEI">MEI</option>
            <option value="CLT">CLT</option>
          </select>
        </div>
        <div style="margin-bottom:16px">
          <label class="modal-label">CPF (opcional)</label>
          <input id="apr-cpf" class="modal-textarea" style="height:36px;resize:none" placeholder="Apenas números"/>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn-danger" onclick="this.closest('div[style*=fixed]').remove()">Cancelar</button>
          <button class="btn-success" id="btn-apr-confirmar">✓ Confirmar Aprovação</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelector('#btn-apr-confirmar').addEventListener('click', async () => {
      const token   = modal.querySelector('#apr-token').value.trim();
      const vinculo = modal.querySelector('#apr-vinculo').value;
      const cpf     = modal.querySelector('#apr-cpf').value.trim();

      try {
        const res = await api.aprovarCadastro({ id, token_override: token, tipo_vinculo: vinculo, cpf, dados: cad });
        if (res.ok) {
          modal.remove();
          _lista[idx].status = 'APROVADO';
          _render();
        } else {
          alert('Erro: ' + (res.erro || res.mensagem));
        }
      } catch(e) { alert('Erro de conexão.'); }
    });
  }

  async function _rejeitar(id, idx) {
    if (!confirm('Rejeitar este cadastro?')) return;
    try {
      const res = await api.aprovarCadastro({ id, status: 'REJEITADO' });
      if (res.ok) { _lista[idx].status = 'REJEITADO'; _render(); }
    } catch(e) { alert('Erro de conexão.'); }
  }

  return { render, _aprovar, _rejeitar };
})();
