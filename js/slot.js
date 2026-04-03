// helper local
function _fmtHora(v) {
  if (!v) return '—';
  const s = String(v);
  if (/^\d{2}:\d{2}/.test(s)) return s.substring(0, 5);
  try { return new Date(v).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}); } catch(_) { return '—'; }
}

const slotScreen = {
  async render() {
    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
        <div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;display:flex;align-items:center;gap:12px">
          <button onclick="router.go('home')" style="background:#1e2a45;border:1px solid #2a3a55;color:#eaf0fb;font-size:14px;font-weight:600;padding:8px 16px;border-radius:10px;cursor:pointer">← Voltar</button>
          <div style="font-size:17px;font-weight:700;flex:1">Slots Disponíveis</div>
        </div>
        <div style="padding:16px" id="slot-content">
          <div style="text-align:center;padding:40px;color:#a0aec0">Carregando...</div>
        </div>
        ${ui.bottomNav('slot')}
      </div>`;

    try {
      // Verificar jornadas ativas primeiro
      const atual = await api.get('GET_SLOT_ATUAL');
      if (atual.ok && (atual.jornadas?.length || atual.jornada)) {
        const jornadasAtivas = atual.jornadas || (atual.jornada ? [{jornada: atual.jornada, slot: atual.slot}] : []);
        
        // Renderizar jornadas ativas
        document.getElementById('slot-content').innerHTML = `
          <div style="font-size:11px;color:#a0aec0;font-weight:700;letter-spacing:1px;margin-bottom:12px">MINHA JORNADA</div>
          ${jornadasAtivas.map(item => this._renderItemAtivo(item.slot, item.jornada)).join('')}
        `;

        // Carrega slots disponíveis adicionais (sem sobreposição)
        try {
          const disp2 = await api.get('GET_SLOTS_DISPONIVEIS');
          if (disp2.ok && disp2.slots?.length) {
            const extra = document.createElement('div');
            extra.innerHTML = '<div style="font-size:11px;color:#a0aec0;font-weight:700;letter-spacing:1px;margin:16px 0 8px">OUTROS SLOTS DISPONÍVEIS</div>'
              + disp2.slots.map(slot => `
                <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:14px;padding:16px;margin-bottom:10px">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
                    <div>
                      <div style="font-size:16px;font-weight:700">📍 ${slot.local_nome||slot.local||'—'}</div>
                      <div style="font-size:13px;color:#a0aec0;margin-top:2px">${slot.cidade||''} · ${slot.operacao||''}</div>
                    </div>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
                    <div><div style="font-size:10px;color:#6c7a8d;margin-bottom:2px">DATA</div><div style="font-size:13px;font-weight:600">${slot.data||'—'}</div></div>
                    <div><div style="font-size:10px;color:#6c7a8d;margin-bottom:2px">INÍCIO</div><div style="font-size:13px;font-weight:600">${_fmtHora(slot.inicio)||'—'}</div></div>
                    <div><div style="font-size:10px;color:#6c7a8d;margin-bottom:2px">FIM</div><div style="font-size:13px;font-weight:600">${_fmtHora(slot.fim)||'—'}</div></div>
                  </div>
                  <button onclick="slotScreen._aceitar('${slot.slot_id}', event)" data-slot-id="${slot.slot_id}" data-slot-inicio="${slot.inicio||''}" data-slot-data="${slot.data||''}"
                    style="width:100%;background:#2ecc71;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;padding:13px;cursor:pointer">
                    ✅ Aceitar Slot
                  </button>
                </div>`).join('');
            document.getElementById('slot-content')?.appendChild(extra);
          }
        } catch(_) {}
        return;
      }

      // Sem jornada ativa — mostrar slots disponíveis
      const disp = await api.get('GET_SLOTS_DISPONIVEIS');
      // Atualiza badge
      try {
        const _badge = document.getElementById('badge-slots');
        const _count = disp.slots?.length || 0;
        if (_badge) { _badge.textContent = _count; _badge.style.display = _count > 0 ? 'block' : 'none'; }
      } catch(_) {}
      // Atualiza badge
      try {
        const _badge = document.getElementById('badge-slots');
        const _count = disp.slots?.length || 0;
        if (_badge) { _badge.textContent = _count; _badge.style.display = _count > 0 ? 'block' : 'none'; }
      } catch(_) {}
      if (!disp.ok || !disp.slots?.length) {
        document.getElementById('slot-content').innerHTML = `
          <div style="text-align:center;padding:48px 20px;display:flex;flex-direction:column;align-items:center;gap:12px">
            <div style="font-size:48px;opacity:.4">📭</div>
            <div style="font-size:15px;color:#a0aec0">Nenhum slot disponível no momento</div>
          </div>`;
        return;
      }

      this._renderDisponiveis(disp.slots);
    } catch(err) {
      console.error('slot.js catch:', err);
      document.getElementById('slot-content').innerHTML = `
        <div style="text-align:center;padding:40px;color:#e74c3c">Erro: ${err.message}</div>`;
    }
  },

  _renderItemAtivo(slot, jornada) {
    const statusColor = {EM_ATIVIDADE:'#2ecc71',ACEITO:'#4f8ef7',PAUSADO:'#f1c40f'}[jornada.status]||'#6c7a8d';
    return `
      <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:14px;padding:18px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}44">${jornada.status.replace(/_/g,' ')}</span>
          <span style="font-size:11px;color:#a0aec0">${slot?.slot_id||''}</span>
        </div>
        <div style="font-size:18px;font-weight:700;margin-bottom:4px">📍 ${slot?.local_nome||slot?.local||'—'}</div>
        <div style="font-size:13px;color:#a0aec0;margin-bottom:14px">${slot?.cidade||''} · ${slot?.operacao||''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
          <div><div style="font-size:10px;color:#6c7a8d;margin-bottom:3px">INÍCIO</div><div style="font-weight:700">${_fmtHora(slot?.inicio)||'—'}</div></div>
          <div><div style="font-size:10px;color:#6c7a8d;margin-bottom:3px">FIM</div><div style="font-weight:700">${_fmtHora(slot?.fim)||'—'}</div></div>
          <div><div style="font-size:10px;color:#6c7a8d;margin-bottom:3px">RAIO</div><div style="font-weight:700">${slot?.raio_metros||100}m</div></div>
        </div>
        ${slot?.lat && slot?.lng ? `
          <button onclick="window.open('https://maps.google.com/?q=${slot.lat},${slot.lng}','_blank')"
            style="width:100%;background:#1a1a2e;border:1px solid #2a3a55;border-radius:10px;color:#4f8ef7;padding:12px;font-size:14px;cursor:pointer;margin-bottom:10px">
            🗺️ Ver no Google Maps
          </button>` : ''}
        <button onclick="state.set('slot', ${JSON.stringify(slot).replace(/"/g,'&quot;')}); state.saveJornada(${JSON.stringify(jornada).replace(/"/g,'&quot;')}); router.go('operacao')"
          style="width:100%;background:#4f8ef7;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:700;padding:15px;cursor:pointer;margin-bottom:10px">
          ⚡ Abrir Jornada
        </button>
        ${jornada.status === 'ACEITO' ? `
          <button onclick="slotScreen._cancelar('${jornada.jornada_id||''}','${slot?.slot_id||''}')"
            style="width:100%;background:transparent;border:1px solid rgba(231,76,60,.4);border-radius:10px;color:#e74c3c;padding:12px;font-size:14px;font-weight:600;cursor:pointer">
            ✕ Cancelar slot aceito
          </button>` : ''}
      </div>`;
  },

  _renderDisponiveis(slots) {
    document.getElementById('slot-content').innerHTML = `
      <div style="font-size:11px;color:#a0aec0;font-weight:700;letter-spacing:1px;margin-bottom:12px">SLOTS DISPONÍVEIS</div>
      ${slots.map(slot => `
        <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:14px;padding:16px;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
            <div>
              <div style="font-size:16px;font-weight:700">📍 ${slot.local_nome||slot.local||'—'}</div>
              <div style="font-size:13px;color:#a0aec0;margin-top:2px">${slot.cidade||''} · ${slot.operacao||''}</div>
            </div>
            <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;background:#4f8ef722;color:#4f8ef7;border:1px solid #4f8ef744;white-space:nowrap">DISPONÍVEL</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
            <div><div style="font-size:10px;color:#6c7a8d;margin-bottom:2px">DATA</div><div style="font-size:13px;font-weight:600">${slot.data||'—'}</div></div>
            <div><div style="font-size:10px;color:#6c7a8d;margin-bottom:2px">INÍCIO</div><div style="font-size:13px;font-weight:600">${_fmtHora(slot.inicio)||'—'}</div></div>
            <div><div style="font-size:10px;color:#6c7a8d;margin-bottom:2px">FIM</div><div style="font-size:13px;font-weight:600">${_fmtHora(slot.fim)||'—'}</div></div>
          </div>
          <button onclick="slotScreen._aceitar('${slot.slot_id}', event)" data-slot-inicio="${slot.inicio||''}" data-slot-data="${slot.data||''}"
            style="width:100%;background:#2ecc71;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;padding:13px;cursor:pointer">
            ✅ Aceitar Slot
          </button>
        </div>`).join('')}`;
  },

  async _cancelar(jornadaId, slotId) {
    if (!confirm('Cancelar este slot?\nEsta ação não pode ser desfeita.')) return;
    try {
      const res = await api.post({ evento: 'CANCELAR_SLOT', jornada_id: jornadaId, slot_id: slotId });
      if (res.ok) {
        state.set('jornada', null);
        state.set('slot', null);
        try { sessionStorage.removeItem('jet_jornada'); } catch(_) {}
        ui.toast('Slot cancelado.', 'info');
        this.render();
      } else {
        ui.toast('❌ ' + (res.erro || 'Erro ao cancelar'), 'error');
      }
    } catch(_) {
      ui.toast('❌ Sem conexão.', 'error');
    }
  },

  async _aceitar(slotId, evtOrBtn) {
    const btn = evtOrBtn?.target || evtOrBtn || (typeof event !== 'undefined' ? event?.target : null);
    // Verificar se o horario do slot ja passou
    const _allSlots = document.querySelectorAll('[data-slot-id]');
    const _slotCard = btn.closest('[data-slot-inicio]');
    const _inicio = btn.closest('[data-slot-inicio]')?.getAttribute('data-slot-inicio');
    if (_inicio) {
      const _iniParts = _inicio.split(':');
      const _slotData = btn.closest('[data-slot-data]')?.getAttribute('data-slot-data') || new Date().toISOString().split('T')[0];
      const _iniD = new Date(_slotData + 'T' + _iniParts[0].padStart(2,'0') + ':' + (_iniParts[1]||'00') + ':00');
      const _atrasoMin = Math.floor((Date.now() - _iniD.getTime()) / 60000);
      if (_atrasoMin > 5) {
        if (!confirm('⚠️ Este slot começou há ' + _atrasoMin + ' minutos.\n\nVocê irá fazer check-in com atraso. Deseja continuar?')) return;
      }
    }
    btn.textContent = 'Aceitando...';
    btn.disabled = true;
    try {
      const res = await api.post({ evento: 'ACEITAR_SLOT', slot_id: slotId });
      if (res.ok) {
        state.saveJornada({ jornada_id: res.jornada_id, slot_id: slotId, status: 'ACEITO' });
        ui.toast('✅ Slot aceito! Faça o check-in no horário.', 'success');
        // Marcar o botao como aceito sem sumir da lista
        btn.textContent = '✅ Aceito!';
        btn.style.background = '#1e2a45';
        btn.style.border = '1px solid #2ecc7144';
        btn.style.color = '#2ecc71';
        btn.disabled = true;
        // Adicionar banner de acao
        const card = btn.closest('div[style*="border-radius:14px"]');
        if (card) {
          const banner = document.createElement('div');
          banner.style.cssText = 'margin-top:10px;background:rgba(46,204,113,.1);border:1px solid rgba(46,204,113,.3);border-radius:10px;padding:12px;display:flex;justify-content:space-between;align-items:center';
          banner.innerHTML = '<span style="font-size:13px;color:#2ecc71;font-weight:600">✅ Slot aceito</span>'
            + '<button onclick="router.go(\'operacao\')" style="background:#2ecc71;color:#000;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer">⚡ Abrir jornada</button>';
          card.appendChild(banner);
        }
      } else {
        ui.toast('❌ ' + (res.erro || res.mensagem || 'Erro ao aceitar'), 'error');
        btn.textContent = '✅ Aceitar Slot';
        btn.disabled = false;
      }
    } catch(_) {
      ui.toast('❌ Sem conexão.', 'error');
      btn.textContent = '✅ Aceitar Slot';
      btn.disabled = false;
    }
  }
};
