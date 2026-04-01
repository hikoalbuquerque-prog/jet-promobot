const preJornada = {

  async verificar(jornada, slot) {
    if (!jornada || jornada.status !== 'ACEITO') return;
    const agora = Date.now();
    const inicio = _parseHorario(slot?.inicio, slot?.data);
    if (!inicio) return;
    const diffMin = Math.floor((inicio - agora) / 60000);
    if (diffMin > 60 || diffMin < -5) return;
    const confirmacaoSalva = sessionStorage.getItem('pj_confirmado_' + jornada.jornada_id);
    if (confirmacaoSalva) { this._renderBannerConfirmado(confirmacaoSalva, diffMin); return; }
    this._renderBannerPendente(jornada, slot, diffMin);
  },

  _renderBannerPendente(jornada, slot, diffMin) {
    const container = document.getElementById('pj-banner-container');
    if (!container) return;
    const textoTempo = diffMin <= 0 ? 'Seu slot está começando agora!' : `Seu slot começa em ${diffMin} min`;
    container.innerHTML = `
      <div style="background:linear-gradient(135deg,rgba(59,130,246,.15),rgba(16,185,129,.1));border:1px solid rgba(59,130,246,.3);border-radius:14px;padding:16px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:700;color:#60a5fa;margin-bottom:4px">⏰ ${textoTempo}</div>
        <div style="font-size:12px;color:#a0aec0;margin-bottom:12px">Confirme sua presença para garantir o promocode de deslocamento.</div>
        <div style="display:flex;gap:8px">
          <button onclick="preJornada._confirmar('${jornada.jornada_id}','A_CAMINHO')"
            style="flex:1;padding:9px 6px;border:1px solid rgba(16,185,129,.4);border-radius:10px;background:rgba(16,185,129,.1);color:#34d399;font-size:12px;font-weight:700;cursor:pointer">
            ✅ A caminho
          </button>
          <button onclick="preJornada._confirmar('${jornada.jornada_id}','NAO_VAI')"
            style="flex:1;padding:9px 6px;border:1px solid rgba(239,68,68,.4);border-radius:10px;background:rgba(239,68,68,.1);color:#f87171;font-size:12px;font-weight:700;cursor:pointer">
            ❌ Não vou
          </button>
          <button onclick="preJornada._confirmar('${jornada.jornada_id}','PRECISA_AJUDA')"
            style="flex:1;padding:9px 6px;border:1px solid rgba(245,158,11,.4);border-radius:10px;background:rgba(245,158,11,.1);color:#fbbf24;font-size:12px;font-weight:700;cursor:pointer">
            🆘 Ajuda
          </button>
        </div>
      </div>`;
  },

  async _confirmar(jornadaId, resposta) {
    sessionStorage.setItem('pj_confirmado_' + jornadaId, resposta);
    const msgs = {
      'A_CAMINHO':     { txt: '✅ Confirmado! Boa operação.', cor: '#34d399' },
      'NAO_VAI':       { txt: '📝 Registrado. Obrigado por avisar.', cor: '#fbbf24' },
      'PRECISA_AJUDA': { txt: '🆘 Aviso enviado para a equipe.', cor: '#f87171' },
    };
    const m = msgs[resposta] || { txt: 'Registrado.', cor: '#a0aec0' };
    const container = document.getElementById('pj-banner-container');
    if (container) {
      container.innerHTML = `
        <div style="background:rgba(0,0,0,.2);border:1px solid ${m.cor}44;border-radius:14px;padding:12px 16px;margin-bottom:12px;color:${m.cor};font-size:13px;font-weight:600">
          ${m.txt}
        </div>`;
    }
    try {
      await api.post({ evento: 'CONFIRMAR_PRE_JORNADA', jornada_id: jornadaId, resposta, origem: 'app' });
    } catch(_) {}
  },

  _renderBannerConfirmado(resposta, diffMin) {
    const container = document.getElementById('pj-banner-container');
    if (!container || diffMin < -5) return;
    const msgs = {
      'A_CAMINHO':     { txt: '✅ Você confirmou presença', cor: '#34d399' },
      'NAO_VAI':       { txt: '📝 Ausência registrada', cor: '#fbbf24' },
      'PRECISA_AJUDA': { txt: '🆘 Equipe avisada', cor: '#f87171' },
    };
    const m = msgs[resposta] || { txt: 'Confirmado', cor: '#a0aec0' };
    container.innerHTML = `
      <div style="background:rgba(0,0,0,.2);border:1px solid ${m.cor}44;border-radius:14px;padding:10px 14px;margin-bottom:12px;color:${m.cor};font-size:12px;font-weight:600">
        ${m.txt}
      </div>`;
  },
};

function _parseHorario(hora, data) {
  if (!hora) return null;
  try {
    const hoje = data ? String(data).substring(0,10) : new Date().toISOString().substring(0,10);
    const [h, m] = String(hora).split(':').map(Number);
    const d = new Date(hoje + 'T00:00:00');
    d.setHours(h, m, 0, 0);
    return d.getTime();
  } catch(_) { return null; }
}
