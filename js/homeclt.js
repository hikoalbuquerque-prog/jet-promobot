const homeScreenCLT = {
  async render() {
    const p = state.get('promotor');
    if (!p) return router.go('splash');

    const nome  = p.nome_completo || p.nome || 'Funcionario';

    // Botão de logout via URL param para facilitar testes
    if (window.location.search.includes('logout')) {
      auth.logout(); return;
    }
    const cargo = p.cargo_principal || '';

    const el = document.getElementById('app');
    el.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.style.cssText = 'min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px';

    const header = document.createElement('div');
    header.style.cssText = 'background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:50';
    header.innerHTML = '<div style="flex:1"><div style="font-size:17px;font-weight:700">' + nome + '</div><div style="font-size:12px;color:#a0aec0">' + cargo + ' &middot; CLT</div></div>'   + '<span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;background:#2ecc7122;color:#2ecc71;border:1px solid #2ecc7144">CLT</span>'   + '<button onclick="auth.logout()" style="margin-left:8px;background:#e74c3c22;border:1px solid #e74c3c44;color:#e74c3c;border-radius:8px;font-size:12px;font-weight:700;padding:6px 10px;cursor:pointer">Sair</button>';

    const content = document.createElement('div');
    content.style.cssText = 'padding:16px;display:flex;flex-direction:column;gap:14px';
    content.innerHTML = '<div style="font-size:11px;color:#a0aec0;font-weight:700;letter-spacing:1px">PROXIMOS TURNOS</div><div id="clt-turnos-lista"><div style="text-align:center;padding:20px;color:#a0aec0;font-size:13px">Carregando...</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px"><button onclick="router.go(\'historico-clt\')" style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px;color:#eaf0fb;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:13px;font-weight:600"><span style="font-size:24px">&#x1F4CB;</span>Historico</button><button onclick="homeScreenCLT.verBancoHoras()" style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px;color:#eaf0fb;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:13px;font-weight:600"><span style="font-size:24px">&#x23F1;</span>Banco Horas</button></div>';

    const nav = document.createElement('nav');
    nav.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#16213e;border-top:1px solid #2a3a55;display:flex;justify-content:space-around;padding:10px 0 calc(10px + env(safe-area-inset-bottom,0px));z-index:100';
    nav.innerHTML = '<button onclick="router.go(\'home-clt\')" style="background:none;border:none;color:#4f8ef7;font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:22px">&#x1F3E0;</span>Home</button><button onclick="router.go(\'turno-ativo\')" style="background:none;border:none;color:#6c7a8d;font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:22px">&#x26A1;</span>Turno</button><button onclick="router.go(\'historico-clt\')" style="background:none;border:none;color:#6c7a8d;font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:22px">&#x1F4CB;</span>Historico</button>';

    wrap.appendChild(header);
    wrap.appendChild(content);
    wrap.appendChild(nav);
    el.appendChild(wrap);

    await this._carregarTurnos();
  },

  async _carregarTurnos() {
    const el = document.getElementById('clt-turnos-lista');
    if (!el) return;
    try {
      const res = await api.get('GET_MEUS_TURNOS_CLT');
      const turnos = res.data || res.turnos || [];
      if (!turnos.length) {
        el.innerHTML = '<div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:14px;padding:20px;text-align:center;color:#a0aec0;font-size:14px">Nenhum turno escalado nos proximos dias</div>';
        return;
      }
      const cores = { PLANEJADO:'#4f8ef7', ESCALADO:'#4f8ef7', CONFIRMADO:'#2ecc71', EM_ANDAMENTO:'#f1c40f', ENCERRADO:'#6c7a8d' };
      
      // Ajuste de data local (yyyy-mm-dd) para comparação precisa
      const hoje = new Date().toLocaleDateString('en-CA'); 
      
      el.innerHTML = turnos.map(function(t) {
        var cor   = cores[t.status] || '#6c7a8d';
        var sData = String(t.data).substring(0, 10);
        var eHoje = sData === hoje;
        var ativo = t.status === 'EM_ANDAMENTO';
        var dataStr = _fmtDataCLTPwa(t.data);
        var ini = _fmtHoraCLTPwa(t.inicio);
        var fim = _fmtHoraCLTPwa(t.fim);
        
        // Determinar ação do clique no CARD
        let acaoClique = "";
        if (eHoje) {
          if (t.status === 'CONFIRMADO' || ativo) acaoClique = "router.go('turno-ativo')";
          else if (t.status === 'PLANEJADO' || t.status === 'ESCALADO') acaoClique = "homeScreenCLT._confirmarPresenca('" + t.turno_id + "')";
        }

        var html = '<div onclick="' + acaoClique + '" class="turno-card" style="background:#1e2a45;border:1px solid ' + (eHoje ? '#4f8ef744' : '#2a3a55') + ';border-radius:14px;padding:16px;margin-bottom:10px;cursor:pointer;position:relative' + (ativo ? ';border-left:4px solid #f1c40f' : '') + '">';
        
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div style="font-size:13px;font-weight:700">' + dataStr + '</div>';
        html += '<span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;background:' + cor + '22;color:' + cor + ';border:1px solid ' + cor + '44">' + t.status + '</span></div>';
        
        html += '<div style="font-size:15px;font-weight:600;margin-bottom:4px">&#x23F0; ' + ini + ' - ' + fim + '</div>';
        html += '<div style="font-size:12px;color:#a0aec0">' + (t.zona_nome || '') + '</div>';
        
        if (eHoje && (t.status === 'ESCALADO' || t.status === 'PLANEJADO')) {
          html += '<div style="width:100%;margin-top:12px;padding:12px;background:#4f8ef7;border-radius:10px;color:#fff;font-size:14px;font-weight:700;text-align:center">Confirmar presença</div>';
        }
        if (eHoje && t.status === 'CONFIRMADO') {
          html += '<div style="width:100%;margin-top:12px;padding:12px;background:#2ecc71;border-radius:10px;color:#fff;font-size:14px;font-weight:700;text-align:center">▶️ Iniciar turno</div>';
        }
        if (ativo) {
          html += '<div style="width:100%;margin-top:12px;padding:12px;background:rgba(241,196,15,0.2);border:1px solid #f1c40f;border-radius:10px;color:#f1c40f;font-size:14px;font-weight:700;text-align:center">Abrir turno ativo</div>';
        }
        html += '</div>';
        return html;
      }).join('') + '<style>.turno-card:active{transform:scale(0.98);filter:brightness(1.2)}</style>';
    } catch(e) {
      if (el) el.innerHTML = '<div style="text-align:center;padding:20px;color:#e74c3c;font-size:13px">Erro ao carregar turnos</div>';
    }
  },

  async _confirmarPresenca(turnoId) {
    try {
      await api.post({ evento: 'CONFIRMAR_TURNO_CLT', turno_id: turnoId, resposta: 'CONFIRMADO' });
      ui.toast('Presenca confirmada!', 'success');
      await this._carregarTurnos();
    } catch(_) {
      ui.toast('Erro ao confirmar', 'error');
    }
  },

  async verBancoHoras() {
    router.go('banco-horas');
  }
};

function _fmtDataCLTPwa(v) {
  if (!v) return '-';
  var s = String(v).substring(0, 10);
  var hoje = new Date().toLocaleDateString('en-CA');
  var amanhaDate = new Date();
  amanhaDate.setDate(amanhaDate.getDate() + 1);
  var amanha = amanhaDate.toLocaleDateString('en-CA');
  
  if (s === hoje) return 'Hoje';
  if (s === amanha) return 'Amanhã';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var parts = s.split('-');
  return parts[2] + '/' + parts[1];
}

function _fmtHoraCLTPwa(v) {
  if (!v) return '-';
  var s = String(v);
  if (/^\d{2}:\d{2}/.test(s)) return s.substring(0, 5);
  try { return new Date(v).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}); }
  catch(_) { return '-'; }
}
