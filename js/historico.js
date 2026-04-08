const historico = {
  async render() {
    const user = state.get('promotor');
    const isCLT = user && (!!user.eh_clt || ['FISCAL','SCOUT','MOTORISTA','CHARGER'].includes((user.cargo_principal||'').toUpperCase()));
    const evento = isCLT ? 'GET_HISTORICO_TURNOS_CLT_PROPRIO' : 'GET_HISTORICO';

    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
        <div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:50">
          <button onclick="router.back()" style="background:#1e2a45;border:none;color:#eaf0fb;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer">‹</button>
          <div style="font-size:17px;font-weight:700;flex:1">Histórico ${isCLT ? 'CLT' : ''}</div>
        </div>
        <div style="padding:16px" id="hist-content">
          <div style="text-align:center;padding:40px;color:#a0aec0;font-size:14px">Carregando...</div>
        </div>
        ${isCLT ? _navBottomCLT('historico-clt') : ui.bottomNav('historico')}
      </div>`;

    try {
      const res = await api.get(evento);
      const el  = document.getElementById('hist-content');
      if (!el) return;

      const lista = res.data || res.historico || res.dados || [];
      if (!lista.length) {
        el.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:12px;text-align:center">
            <div style="font-size:48px;opacity:.4">📋</div>
            <div style="font-size:15px;color:#a0aec0">Nenhuma jornada registrada ainda</div>
          </div>`;
        return;
      }

      // Ordenar mais recente primeiro
      const ordenado = [...lista].sort((a, b) => {
        const da = new Date(a.data || a.criado_em || 0);
        const db = new Date(b.data || b.criado_em || 0);
        return db - da;
      });

      el.innerHTML = ordenado.map(j => {
        const status   = j.status || 'ENCERRADO';
        const cor      = { EM_ATIVIDADE:'#2ecc71', EM_ANDAMENTO:'#f1c40f', ACEITO:'#4f8ef7', PAUSADO:'#f1c40f', ENCERRADO:'#6c7a8d' }[status] || '#6c7a8d';
        
        const inicio   = j.inicio_real || j.checkin_hora;
        const fim      = j.fim_real || j.checkout_hora;
        const duracao  = _calcDuracao(inicio, fim);
        const dataStr  = _formatData(j.data || j.criado_em);
        const checkin  = _formatHora(inicio);
        const checkout = _formatHora(fim);

        return `
          <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:14px;padding:16px;margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
              <div>
                <div style="font-size:15px;font-weight:700">${j.local_nome || j.zona_nome || j.local || 'Turno'}</div>
                <div style="font-size:12px;color:#a0aec0;margin-top:2px">${dataStr} · ${j.cidade || ''}</div>
              </div>
              <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${cor}22;color:${cor};border:1px solid ${cor}44">${status.replace('_',' ')}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
              <div>
                <div style="font-size:10px;color:#6c7a8d;margin-bottom:2px">CHECK-IN</div>
                <div style="font-size:13px;font-weight:600">${checkin}</div>
              </div>
              <div>
                <div style="font-size:10px;color:#6c7a8d;margin-bottom:2px">CHECK-OUT</div>
                <div style="font-size:13px;font-weight:600">${checkout}</div>
              </div>
              <div>
                <div style="font-size:10px;color:#6c7a8d;margin-bottom:2px">DURAÇÃO</div>
                <div style="font-size:13px;font-weight:600">${duracao}</div>
              </div>
            </div>
          </div>`;
      }).join('');
    } catch(e) {
      const el = document.getElementById('hist-content');
      if (el) el.innerHTML = `<div style="text-align:center;padding:40px;color:#e74c3c;font-size:13px">Erro ao carregar histórico</div>`;
    }
  },

  async renderBancoHoras() {
    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
        <div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:50">
          <button onclick="router.back()" style="background:#1e2a45;border:none;color:#eaf0fb;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer">‹</button>
          <div style="font-size:17px;font-weight:700;flex:1">Banco de Horas</div>
        </div>
        <div style="padding:16px" id="banco-content">
          <div style="text-align:center;padding:40px;color:#a0aec0;font-size:14px">Consultando saldo...</div>
        </div>
        ${_navBottomCLT('home-clt')}
      </div>`;

    try {
      const res = await api.get('GET_MEU_BANCO_HORAS');
      const el  = document.getElementById('banco-content');
      if (!el) return;

      const saldo = res.saldo_formatado || '00:00';
      const minutos = res.saldo_minutos || 0;
      const corSaldo = minutos >= 0 ? '#2ecc71' : '#e74c3c';

      el.innerHTML = `
        <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:20px;padding:30px;text-align:center;margin-bottom:20px">
          <div style="font-size:12px;color:#a0aec0;letter-spacing:1px;margin-bottom:8px;text-transform:uppercase">Saldo Acumulado</div>
          <div style="font-size:48px;font-weight:800;color:${corSaldo}">${saldo}</div>
          <div style="font-size:13px;color:#a0aec0;margin-top:10px">Horas totais apuradas no mês</div>
        </div>
        
        <div style="background:rgba(79,142,247,0.1);border:1px solid rgba(79,142,247,0.2);border-radius:14px;padding:16px;display:flex;align-items:center;gap:12px">
          <span style="font-size:24px">ℹ️</span>
          <div style="font-size:13px;color:#a0aec0;line-height:1.4">O saldo é atualizado automaticamente após o fechamento de cada turno. Em caso de divergência, procure seu gestor.</div>
        </div>
      `;
    } catch(e) {
      document.getElementById('banco-content').innerHTML = `<div style="text-align:center;padding:40px;color:#e74c3c;font-size:13px">Erro ao consultar banco de horas</div>`;
    }
  },

  _calcDuracao(inicio, fim) {
    if (!inicio || !fim) return '—';
    const diff = Math.floor((new Date(fim) - new Date(inicio)) / 1000);
    if (diff < 0) return '—';
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return `${h}h${String(m).padStart(2,'0')}`;
  },

  _formatData(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' }); }
    catch(_) { return '—'; }
  },

  _formatHora(iso) {
    if (!iso) return '—';
    try {
      const s = String(iso);
      if (s.includes('T') || s.includes('Z')) {
        return new Date(iso).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
      }
      return s.substring(0,5);
    } catch(_) { return '—'; }
  }
};

function _navBottomCLT(a) {
  const itens = [
    { id:'home-clt', icon:'🏠', label:'Home' },
    { id:'turno-ativo', icon:'⚡', label:'Turno' },
    { id:'historico-clt', icon:'📋', label:'Histórico' },
  ];
  return `<nav style="position:fixed;bottom:0;left:0;right:0;background:#16213e;border-top:1px solid #2a3a55;display:flex;justify-content:space-around;padding:10px 0 calc(10px + env(safe-area-inset-bottom,0px));z-index:100">
    ${itens.map(i => `<button onclick="router.go('${i.id}')" style="background:none;border:none;color:${i.id===a?'#4f8ef7':'#6c7a8d'};font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:22px">${i.icon}</span>${i.label}</button>`).join('')}
  </nav>`;
}

// Expor helpers
historico._calcDuracao = historico._calcDuracao.bind(historico);
historico._formatData  = historico._formatData.bind(historico);
historico._formatHora  = historico._formatHora.bind(historico);

const _calcDuracao = (a,b) => historico._calcDuracao(a,b);
const _formatData  = (a)   => historico._formatData(a);
const _formatHora  = (a)   => historico._formatHora(a);
