const slotScreen = {
  async render() {
    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
        <div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;position:sticky;top:0;z-index:50">
          <div style="font-size:17px;font-weight:700">📍 Vagas Disponíveis</div>
        </div>
        <div style="padding:16px" id="slot-content">
          <div style="text-align:center;padding:40px;color:#a0aec0">Buscando vagas...</div>
        </div>
        ${ui.bottomNav('slot')}
      </div>`;

    try {
      const res = await api.get('GET_SLOTS_DISPONIVEIS');
      const container = document.getElementById('slot-content');
      if (!container) return;

      if (!res.ok) {
        container.innerHTML = `
          <div style="text-align:center;padding:40px;color:#fc8181">
            <div style="font-size:40px;margin-bottom:10px">⚠️</div>
            <div>${res.erro || res.mensagem || 'Erro ao carregar vagas.'}</div>
            <button onclick="location.reload()" style="margin-top:20px;background:transparent;border:1px solid #4a5568;color:#a0aec0;padding:8px 16px;border-radius:10px;font-size:12px;cursor:pointer">Tentar novamente</button>
          </div>`;
        return;
      }

      if (!res.slots || res.slots.length === 0) {
        container.innerHTML = `
          <div style="text-align:center;padding:40px;color:#a0aec0">
            <div style="font-size:40px;margin-bottom:10px">⛱️</div>
            <div>Nenhuma vaga disponível no momento.</div>
            <button onclick="slotScreen._solicitarReforco()" style="margin-top:24px;background:#4f8ef7;color:#fff;border:none;padding:12px 20px;border-radius:10px;font-weight:700;cursor:pointer">
              ✨ Vim trabalhar (Reforço)
            </button>
          </div>`;
        return;
      }

      const agoraLocal = new Date();
      const hojeStr = agoraLocal.toLocaleDateString('sv-SE'); // Formato YYYY-MM-DD local
      
      const amanhaLocal = new Date(agoraLocal);
      amanhaLocal.setDate(agoraLocal.getDate() + 1);
      const amanhaStr = amanhaLocal.toLocaleDateString('sv-SE');

      let lastDate = '';
      let slotsHtml = '';

      res.slots.forEach(s => {
        const dataSlot = String(s.data || '').substring(0, 10);
        if (dataSlot !== lastDate) {
          lastDate = dataSlot;
          const label = dataSlot === hojeStr ? 'HOJE' : (dataSlot === amanhaStr ? 'AMANHÃ' : dataSlot);
          slotsHtml += `
            <div style="font-size:11px;font-weight:800;color:#f6ad55;margin:20px 0 10px 4px;letter-spacing:1px;display:flex;align-items:center;gap:8px">
              <span style="width:12px;height:2px;background:#f6ad55;border-radius:2px"></span> ${label}
            </div>`;
        }

        slotsHtml += `
          <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:16px;padding:16px;margin-bottom:12px;position:relative;${s.is_sugestao ? 'border-left:4px solid #f6ad55' : ''}">
            ${s.is_sugestao ? '<div style="position:absolute;top:10px;right:16px;background:#f6ad55;color:#1a1a2e;font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px">SUGESTÃO</div>' : ''}
            <div style="font-size:13px;color:#63b3ed;font-weight:700;margin-bottom:4px">${s.operacao || 'PROMO'}</div>
            <div style="font-size:16px;font-weight:700;margin-bottom:4px">${s.local_nome || s.local}</div>
            <div style="font-size:13px;color:#a0aec0;margin-bottom:12px">⏰ ${s.inicio} - ${s.fim}</div>
            
            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid rgba(255,255,255,0.05)">
              <div style="font-size:11px;color:#718096">📍 ${s.cidade || ''}</div>
              <button onclick="slotScreen._aceitar('${s.slot_id}', this)" style="background:#4f8ef7;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">Aceitar Vaga</button>
            </div>
          </div>`;
      });

      container.innerHTML = slotsHtml + `
        <div style="text-align:center;padding:20px 0">
          <button onclick="slotScreen._solicitarReforco()" style="background:transparent;border:1px solid #4a5568;color:#a0aec0;padding:10px 16px;border-radius:10px;font-size:12px;cursor:pointer">
            ✨ Vim trabalhar sem slot (Reforço)
          </button>
        </div>`;
    } catch(e) {
      console.error('[slots]', e);
      document.getElementById('slot-content').innerHTML = `<div style="text-align:center;padding:40px;color:#fc8181">Erro ao carregar vagas.</div>`;
    }
  },

  async _aceitar(slotId, btn) {
    if (!confirm('Deseja aceitar esta vaga?')) return;
    btn.disabled = true; btn.textContent = '...';
    try {
      const res = await api.post({ evento: 'ACEITAR_SLOT', slot_id: slotId });
      if (res.ok) {
        ui.toast('✅ Vaga aceita!', 'success');
        router.go('operacao');
      } else {
        alert(res.erro || 'Erro ao aceitar');
        btn.disabled = false; btn.textContent = 'Aceitar Vaga';
      }
    } catch(e) { alert('Erro de conexão.'); btn.disabled = false; btn.textContent = 'Aceitar Vaga'; }
  },

  async _solicitarReforco() {
    if (!confirm('Deseja iniciar um reforço em sua localização atual?')) return;
    
    ui.toast('Obtendo localização...', 'info');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      ui.toast('Registrando...', 'info');
      try {
        const res = await api.post({ 
          evento: 'CRIAR_SLOT_REFORCO', 
          lat, 
          lng, 
          accuracy 
        });
        if (res.ok) { 
          ui.toast('✅ Reforço ok!', 'success'); 
          router.go('operacao'); 
        } else {
          alert(res.erro || 'Erro ao registrar reforço');
        }
      } catch(e) { 
        alert('Erro de conexão.'); 
      }
    }, (err) => {
      alert('Erro de GPS: ' + err.message);
    }, { enableHighAccuracy: true, timeout: 10000 });
  }
};
