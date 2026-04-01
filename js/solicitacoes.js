const solicitacoes = {
  renderNova() {
    ui.render(`
      <div class="screen">
        ${ui.header('Solicitar Suporte', '', true)}
        <div class="content">
          <div class="section-label">Tipo de solicitação</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <button class="btn btn-ghost" onclick="solicitacoes.renderReforco()">🛴 Reforço de patinetes</button>
            <button class="btn btn-ghost" onclick="solicitacoes.renderBateria()">🔋 Troca de bateria</button>
            <button class="btn btn-ghost" onclick="solicitacoes.renderRealocacao()">📍 Solicitar realocação</button>
            <button class="btn btn-ghost" onclick="solicitacoes.renderOcorrencia()">⚠️ Registrar ocorrência</button>
          </div>
        </div>
      </div>
    `);
  },

  renderReforco()    { this._renderForm('REFORCO_PATINETES',  '🛴 Reforço de Patinetes',  'SOLICITAR_REFORCO_PATINETES'); },
  renderBateria()    { this._renderForm('TROCA_BATERIA',       '🔋 Troca de Bateria',       'SOLICITAR_TROCA_BATERIA'); },
  renderRealocacao() {
    ui.render(
      '<div class="screen">'
      + ui.header('📍 Atualizar Localização', '', true)
      + '<div class="content">'
      + '<div class="gps-indicator" id="rel-gps-strip">'
      + '<div class="gps-dot" id="rel-gps-dot" style="background:var(--yellow)"></div>'
      + '<div style="flex:1"><div style="font-weight:600;font-size:13px" id="rel-gps-status">Obtendo GPS...</div>'
      + '<div style="font-size:11px;color:var(--text2)" id="rel-gps-coords">—</div></div>'
      + '<div style="font-size:11px;color:var(--text2)" id="rel-gps-acc"></div></div>'
      + '<div class="card"><div class="section-label" style="margin-bottom:8px">OBSERVAÇÃO (opcional)</div>'
      + '<textarea id="rel-obs" class="input" style="min-height:80px;resize:none;line-height:1.5" placeholder="Ex: Estou na saída do metrô..."></textarea></div>'
      + '<button id="btn-rel" class="btn btn-primary" disabled onclick="solicitacoes._enviarRelocacao()">'
      + '📍 Confirmar nova posição</button>'
      + '<button class="btn btn-ghost" onclick="router.back()">Cancelar</button>'
      + '</div></div>'
    );
    solicitacoes._iniciarGpsRelocacao();
  },

  _gpsWatchRel: null,

  _iniciarGpsRelocacao() {
    if (!navigator.geolocation) {
      const s = document.getElementById('rel-gps-status');
      if (s) s.textContent = 'GPS indisponível';
      const b = document.getElementById('btn-rel');
      if (b) b.disabled = false;
      return;
    }
    this._gpsWatchRel = navigator.geolocation.watchPosition(
      pos => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude, acc = pos.coords.accuracy;
        state.patch('gps_rel', { lat, lng, accuracy: acc, ok: true });
        const dot = document.getElementById('rel-gps-dot');
        const st  = document.getElementById('rel-gps-status');
        const co  = document.getElementById('rel-gps-coords');
        const ac  = document.getElementById('rel-gps-acc');
        const btn = document.getElementById('btn-rel');
        if (dot) { dot.style.background = 'var(--green)'; dot.style.boxShadow = '0 0 6px var(--green)'; }
        if (st)  st.textContent  = 'GPS ativo';
        if (co)  co.textContent  = lat.toFixed(5) + ', ' + lng.toFixed(5);
        if (ac)  ac.textContent  = '±' + Math.round(acc) + 'm';
        if (btn) btn.disabled = false;
      },
      () => {
        const s = document.getElementById('rel-gps-status');
        const b = document.getElementById('btn-rel');
        if (s) s.textContent = 'GPS indisponível — usando última posição';
        if (b) b.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
    );
    setTimeout(() => {
      const b = document.getElementById('btn-rel');
      if (b) b.disabled = false;
    }, 15000);
  },

  async _enviarRelocacao() {
    const jornada = state.loadJornada();
    const slot    = state.get('slot');
    const gps     = state.get('gps_rel') || state.get('gps') || {};
    const obs     = document.getElementById('rel-obs')?.value?.trim() || '';

    if (this._gpsWatchRel !== null) {
      navigator.geolocation.clearWatch(this._gpsWatchRel);
      this._gpsWatchRel = null;
    }

    ui.setLoading('btn-rel', true);
    try {
      // 1. Atualizar posicao em LOCALIZACAO_TEMPO_REAL via HEARTBEAT
      if (gps.lat && gps.lng) {
        await api.post({
          evento:      'HEARTBEAT',
          jornada_id:  jornada?.jornada_id || '',
          lat:         gps.lat,
          lng:         gps.lng,
          accuracy:    gps.accuracy || 999,
          is_mock:     false,
          horario_dispositivo: new Date().toISOString(),
        });
        state.patch('gps', { ok: true, lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy });
      }
      // 2. Registrar solicitacao com observacao
      const res = await api.post({
        evento:     'SOLICITAR_REALOCACAO',
        jornada_id: jornada?.jornada_id || '',
        slot_id:    slot?.slot_id || '',
        descricao:  obs || 'Promotor atualizou localização manualmente.',
        lat:        gps.lat  || null,
        lng:        gps.lng  || null,
      });
      if (res.ok) {
        ui.toast('📍 Localização atualizada!', 'success');
        router.go('em-atividade');
      } else {
        ui.toast('❌ ' + (res.erro || res.mensagem || 'Erro'), 'error');
        ui.setLoading('btn-rel', false);
      }
    } catch (_) {
      ui.toast('❌ Sem conexão.', 'error');
      ui.setLoading('btn-rel', false);
    }
  },

  renderOcorrencia() { this._renderForm('OCORRENCIA',          '⚠️ Registrar Ocorrência',   'REGISTRAR_OCORRENCIA'); },

  _renderForm(tipo, titulo, evento) {
    const jornada = state.loadJornada();
    const slot    = state.get('slot');
    ui.render(
      '<div class="screen">'
      + ui.header(titulo, '', true)
      + '<div class="content">'
      + '<div class="card"><div class="section-label" style="margin-bottom:8px">DESCRIÇÃO</div>'
      + '<textarea id="sol-descricao" class="input" style="min-height:100px;resize:none;line-height:1.5" placeholder="Descreva brevemente a situação..."></textarea></div>'
      + '<button id="btn-sol" class="btn btn-primary" data-evento="' + evento + '" data-tipo="' + tipo + '" onclick="solicitacoes._enviarForm()">Enviar Solicitação</button>'
      + '<button class="btn btn-ghost" onclick="router.back()">Cancelar</button>'
      + '</div></div>'
    );
  },

  _enviarForm() {
    const btn = document.getElementById('btn-sol');
    if (!btn) return;
    const evento = btn.getAttribute('data-evento');
    const tipo   = btn.getAttribute('data-tipo');
    this._enviar(evento, tipo);
  },

  async _enviar(evento, tipo) {
    const descricao = document.getElementById('sol-descricao')?.value?.trim() || '';
    const jornada   = state.loadJornada();
    const slot      = state.get('slot');

    ui.setLoading('btn-sol', true);
    try {
      const res = await api.post({
        evento,
        jornada_id:  jornada?.jornada_id || '',
        slot_id:     slot?.slot_id || '',
        descricao,
      });
      if (res.ok) {
        ui.toast('✅ Solicitação enviada!', 'success');
        router.go('em-atividade');
      } else {
        ui.toast('❌ ' + (res.erro || res.mensagem || 'Erro'), 'error');
        ui.setLoading('btn-sol', false);
      }
    } catch (_) {
      ui.toast('❌ Sem conexão.', 'error');
      ui.setLoading('btn-sol', false);
    }
  },

  renderLista() {
    ui.render(`<div class="screen">${ui.header('Minhas Solicitações', '', true)}<div class="content">${ui.spinner('Carregando…')}</div></div>`);
    api.get('GET_MINHAS_SOLICITACOES').then(res => {
      if (!res.ok || !res.solicitacoes?.length) {
        ui.render(`<div class="screen">${ui.header('Minhas Solicitações', '', true)}<div class="content"><div class="empty-state"><div class="empty-icon">📭</div><div class="empty-label">Nenhuma solicitação ainda</div></div></div></div>`);
        return;
      }
      const lista = res.solicitacoes.map(s => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="font-weight:700;font-size:14px">${s.tipo}</span>
            <span class="badge ${s.status === 'ATENDIDA' ? 'badge-green' : s.status === 'ABERTA' ? 'badge-blue' : 'badge-gray'}">${s.status}</span>
          </div>
          <div style="font-size:13px;color:var(--text2)">${s.descricao || '—'}</div>
        </div>`).join('');
      ui.render(`<div class="screen">${ui.header('Minhas Solicitações', '', true)}<div class="content">${lista}</div></div>`);
    }).catch(() => {
      ui.toast('Erro ao carregar.', 'error');
    });
  }
};
