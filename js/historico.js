const historico = {
  async render() {
    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
        <div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:50">
          <button onclick="router.back()" style="background:#1e2a45;border:none;color:#eaf0fb;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer">‹</button>
          <div style="font-size:17px;font-weight:700;flex:1">Histórico</div>
        </div>
        <div style="padding:16px" id="hist-content">
          <div style="text-align:center;padding:40px;color:#a0aec0;font-size:14px">Carregando...</div>
        </div>
        <nav style="position:fixed;bottom:0;left:0;right:0;background:#16213e;border-top:1px solid #2a3a55;display:flex;justify-content:space-around;padding:10px 0 calc(10px + env(safe-area-inset-bottom,0px));z-index:100">
          <button onclick="router.go('home')" style="background:none;border:none;color:#6c7a8d;font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:22px">🏠</span>Home</button>
          <button onclick="router.go('operacao')" style="background:none;border:none;color:#6c7a8d;font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:22px">⚡</span>Jornada</button>
          <button onclick="router.go('slot')" style="background:none;border:none;color:#6c7a8d;font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:22px">📍</span>Slot</button>
          <button onclick="router.go('historico')" style="background:none;border:none;color:#4f8ef7;font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:22px">📋</span>Histórico</button>
        </nav>
      </div>`;

    try {
      const res = await api.get('GET_HISTORICO');
      const el  = document.getElementById('hist-content');
      if (!el) return;

      const lista = res.historico || res.dados || [];
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
        const da = new Date(a.criado_em || 0);
        const db = new Date(b.criado_em || 0);
        return db - da;
      });

      el.innerHTML = ordenado.map(j => {
        const status   = j.status || 'ENCERRADO';
        const cor      = { EM_ATIVIDADE:'#2ecc71', ACEITO:'#4f8ef7', PAUSADO:'#f1c40f', ENCERRADO:'#6c7a8d' }[status] || '#6c7a8d';
        const duracao  = _calcDuracao(j.inicio_real, j.fim_real);
        const dataStr  = _formatData(j.criado_em);
        const checkin  = _formatHora(j.inicio_real);
        const checkout = _formatHora(j.fim_real);

        return `
          <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:14px;padding:16px;margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
              <div>
                <div style="font-size:15px;font-weight:700">${j.local_nome || j.local || j.slot_id || 'Jornada'}</div>
                <div style="font-size:12px;color:#a0aec0;margin-top:2px">${dataStr} · ${j.cidade || ''} · ${j.operacao || ''}</div>
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

// Expor helpers como métodos do objeto (evita referência interna com this em callbacks)
historico._calcDuracao = historico._calcDuracao.bind(historico);
historico._formatData  = historico._formatData.bind(historico);
historico._formatHora  = historico._formatHora.bind(historico);

// Referência interna correta via closure
const _calcDuracao = (a,b) => historico._calcDuracao(a,b);
const _formatData  = (a)   => historico._formatData(a);
const _formatHora  = (a)   => historico._formatHora(a);