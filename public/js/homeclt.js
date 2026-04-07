const homeScreenCLT = {
  async render() {
    const p = state.get('promotor');
    if (!p) return router.go('splash');

    const nome  = p.nome_completo || p.nome || 'Funcionário';
    const cargo = p.cargo_principal || '';

    const el = document.getElementById('app');
    el.innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
        <div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:50">
          <div style="flex:1">
            <div style="font-size:17px;font-weight:700">${nome}</div>
            <div style="font-size:12px;color:#a0aec0">${cargo} &middot; CLT</div>
          </div>
          <span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;background:#2ecc7122;color:#2ecc71;border:1px solid #2ecc7144">CLT</span>
          <button onclick="auth.logout()" style="margin-left:8px;background:#e74c3c22;border:1px solid #e74c3c44;color:#e74c3c;border-radius:8px;font-size:12px;font-weight:700;padding:6px 10px;cursor:pointer">Sair</button>
        </div>
        <div style="padding:16px;display:flex;flex-direction:column;gap:14px">
          <div style="font-size:11px;color:#a0aec0;font-weight:700;letter-spacing:1px">PRÓXIMOS TURNOS</div>
          <div id="clt-turnos-lista">
            <div style="text-align:center;padding:40px;color:#a0aec0">Carregando turnos...</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
            <button onclick="router.go('historico-clt')" style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px;color:#eaf0fb;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:13px;font-weight:600"><span style="font-size:24px">📋</span>Histórico</button>
            <button onclick="homeScreenCLT.verBancoHoras()" style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px;color:#eaf0fb;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:13px;font-weight:600"><span style="font-size:24px">⏱️</span>Banco Horas</button>
          </div>
        </div>
        <nav style="position:fixed;bottom:0;left:0;right:0;background:#16213e;border-top:1px solid #2a3a55;display:flex;justify-content:space-around;padding:10px 0 calc(10px + env(safe-area-inset-bottom,0px));z-index:100">
          <button onclick="router.go('home-clt')" style="background:none;border:none;color:#4f8ef7;font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:22px">🏠</span>Home</button>
          <button onclick="router.go('turno-ativo')" style="background:none;border:none;color:#6c7a8d;font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:22px">⚡</span>Turno</button>
          <button onclick="router.go('historico-clt')" style="background:none;border:none;color:#6c7a8d;font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:22px">📋</span>Histórico</button>
        </nav>
      </div>
      <style>
        .turno-card:active { transform: scale(0.98); filter: brightness(1.2); }
      </style>
    `;

    await this._carregarTurnos();
  },

  async _carregarTurnos() {
    const el = document.getElementById('clt-turnos-lista');
    if (!el) return;
    try {
      const res = await api.get('GET_MEUS_TURNOS_CLT');
      const turnos = res.data || [];
      if (!turnos.length) {
        el.innerHTML = '<div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:14px;padding:20px;text-align:center;color:#a0aec0;font-size:14px">Nenhum turno escalado para os próximos dias</div>';
        return;
      }

      const d = new Date();
      const hojeISO = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
      const cores = { PLANEJADO:'#4f8ef7', ESCALADO:'#4f8ef7', CONFIRMADO:'#2ecc71', EM_ANDAMENTO:'#f1c40f', ENCERRADO:'#6c7a8d' };

      el.innerHTML = turnos.map(t => {
        const sData = String(t.data).substring(0, 10);
        const eHoje = sData === hojeISO;
        const ativo = t.status === 'EM_ANDAMENTO';
        const cor   = cores[t.status] || '#6c7a8d';
        
        let acao = "";
        if (t.status === 'CONFIRMADO' || ativo) acao = "router.go('turno-ativo')";
        else if (t.status === 'PLANEJADO' || t.status === 'ESCALADO') acao = `homeScreenCLT._confirmarPresenca('${t.turno_id}')`;

        return `
          <div onclick="${acao}" class="turno-card" style="background:#1e2a45;border:1px solid ${eHoje ? '#4f8ef744' : '#2a3a55'};border-radius:14px;padding:16px;margin-bottom:10px;cursor:pointer;position:relative;${ativo ? 'border-left:4px solid #f1c40f' : ''}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <div style="font-size:13px;font-weight:700">${_fmtDataCLTPwa(t.data)}</div>
              <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;background:${cor}22;color:${cor};border:1px solid ${cor}44">${t.status}</span>
            </div>
            <div style="font-size:15px;font-weight:600;margin-bottom:4px">⏰ ${_fmtHoraCLTPwa(t.inicio)} - ${_fmtHoraCLTPwa(t.fim)}</div>
            <div style="font-size:12px;color:#a0aec0">${t.zona_nome || ''}</div>
            ${eHoje && (t.status === 'ESCALADO' || t.status === 'PLANEJADO') ? '<div style="width:100%;margin-top:12px;padding:12px;background:#4f8ef7;border-radius:10px;color:#fff;font-size:14px;font-weight:700;text-align:center">Confirmar presença</div>' : ''}
            ${eHoje && t.status === 'CONFIRMADO' ? '<div style="width:100%;margin-top:12px;padding:12px;background:#2ecc71;border-radius:10px;color:#fff;font-size:14px;font-weight:700;text-align:center">▶️ Iniciar turno</div>' : ''}
            ${ativo ? '<div style="width:100%;margin-top:12px;padding:12px;background:rgba(241,196,15,0.2);border:1px solid #f1c40f;border-radius:10px;color:#f1c40f;font-size:14px;font-weight:700;text-align:center">Abrir turno ativo</div>' : ''}
          </div>`;
      }).join('');
    } catch(e) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:#e74c3c;font-size:13px">Erro ao carregar turnos</div>';
    }
  },

  async _confirmarPresenca(turnoId) {
    try {
      ui.toast('Confirmando...', 'info');
      await api.post({ evento: 'CONFIRMAR_TURNO_CLT', turno_id: turnoId, resposta: 'CONFIRMADO' });
      ui.toast('Presença confirmada!', 'success');
      await this._carregarTurnos();
    } catch(e) {
      ui.toast('Erro ao confirmar', 'error');
    }
  },

  verBancoHoras() { router.go('banco-horas'); }
};

function _fmtDataCLTPwa(v) {
  if (!v) return '-';
  const s = String(v).substring(0, 10);
  const d = new Date();
  const hoje = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  const am = new Date(Date.now() + 86400000);
  const amanha = [am.getFullYear(), String(am.getMonth()+1).padStart(2,'0'), String(am.getDate()).padStart(2,'0')].join('-');
  if (s === hoje) return 'Hoje';
  if (s === amanha) return 'Amanhã';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const p = s.split('-'); return p[2] + '/' + p[1];
}

function _fmtHoraCLTPwa(v) {
  if (!v) return '-';
  const s = String(v);
  if (/^\d{2}:\d{2}/.test(s)) return s.substring(0, 5);
  try { return new Date(v).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}); } catch(_) { return '-'; }
}