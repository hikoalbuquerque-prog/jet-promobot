// ─── fiscal_turno.js — Turno do Fiscal ───────────────────────────────────────
const fiscalTurnoScreen = (() => {
  let _timer = null;
  let _heartbeat = null;
  let _watchId = null;
  let _segundos = 0;
  let _pausado = false;
  let _turno = null;

  const CARGOS_CLT = ['SCOUT','CHARGER','MOTORISTA','FISCAL'];

  async function render() {
    const gestor = state.get('gestor');
    const app = document.getElementById('app');

    // Aviso de folga na segunda
    const hoje = new Date().getDay();
    const avisoFolga = hoje === 1
      ? '<div style="background:rgba(245,183,0,.15);border:1px solid rgba(245,183,0,.3);border-radius:8px;padding:10px 14px;font-size:13px;color:#f5b700;margin-bottom:12px">⚠️ Hoje é segunda-feira — seu dia de folga. Você pode iniciar o turno mesmo assim.</div>'
      : '';

    app.innerHTML = `
      <section class="screen" id="screen-fiscal-turno">
        <div class="screen-header">
          <h2 class="screen-title">Meu Turno</h2>
          <button class="btn-icon" id="btn-refresh-ft">↻</button>
        </div>
        <div style="padding:4px 0 16px">
          ${avisoFolga}
          <div id="ft-conteudo"><div class="list-empty">Carregando...</div></div>
        </div>
      </section>`;

    document.getElementById('btn-refresh-ft').addEventListener('click', render);
    await _carregar();
  }

  async function _carregar() {
    const gestor = state.get('gestor');
    try {
      const res = await api.getMeusTurnosCLT();
      const hoje = new Date().toISOString().split('T')[0];
      const turnoHoje = (res.data || []).find(t =>
        t.data === hoje && ['ESCALADO','CONFIRMADO','EM_ANDAMENTO','PAUSADO'].includes(t.status)
      );
      _turno = turnoHoje || null;
      _renderEstado();
    } catch(e) {
      document.getElementById('ft-conteudo').innerHTML =
        '<div class="list-empty" style="color:#fc8181">Erro ao carregar turno.</div>';
    }
  }

  function _renderEstado() {
    if (!_turno) {
      _renderSemTurno(); return;
    }
    if (_turno.status === 'EM_ANDAMENTO') { _renderAtivo(); return; }
    if (_turno.status === 'PAUSADO')      { _renderPausado(); return; }
    _renderAguardando();
  }

  function _renderSemTurno() {
    document.getElementById('ft-conteudo').innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:#718096">
        <div style="font-size:48px;margin-bottom:12px">📋</div>
        <div style="font-size:15px;margin-bottom:6px">Nenhum turno escalado para hoje</div>
        <div style="font-size:13px">Entre em contato com a gestão.</div>
      </div>`;
  }

  function _renderAguardando() {
    const t = _turno;
    document.getElementById('ft-conteudo').innerHTML = `
      <div class="card" style="margin-bottom:12px">
        <div style="font-size:11px;color:#63b3ed;font-weight:700;letter-spacing:1px;margin-bottom:8px">TURNO DE HOJE</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:4px">⏰ ${t.inicio||'—'} – ${t.fim||'—'}</div>
        <div style="font-size:13px;color:#718096">${t.zona_nome||'—'}</div>
      </div>
      <div id="ft-gps-strip" style="background:#0d1526;border:1px solid rgba(99,179,237,.15);border-radius:8px;padding:12px;display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="width:10px;height:10px;border-radius:50%;background:#f5b700;flex-shrink:0" id="ft-gps-dot"></div>
        <div style="flex:1;font-size:13px;color:#a0aec0" id="ft-gps-status">Obtendo GPS...</div>
        <div style="font-size:11px;color:#718096" id="ft-gps-acc"></div>
      </div>
      <button id="btn-ft-checkin" class="btn-success" disabled onclick="fiscalTurnoScreen._fazerCheckin()" style="width:100%;padding:14px;border-radius:8px;font-size:15px;font-weight:700;border:none;cursor:pointer;opacity:.5">
        ✅ Iniciar Turno
      </button>`;
    _iniciarGPS();
  }

  function _renderAtivo() {
    const t = _turno;
    const checkinHora = t.checkin_hora
      ? new Date(t.checkin_hora).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
      : '—';
    document.getElementById('ft-conteudo').innerHTML = `
      <div class="card" style="text-align:center;padding:24px;margin-bottom:12px;border-color:rgba(72,187,120,.3)">
        <div style="font-size:11px;color:#68d391;letter-spacing:1px;margin-bottom:8px">EM ANDAMENTO</div>
        <div id="ft-timer" style="font-size:48px;font-weight:800;color:#68d391;letter-spacing:-2px;line-height:1">00:00:00</div>
        <div style="font-size:12px;color:#718096;margin-top:6px">Check-in às ${checkinHora}</div>
      </div>
      <div id="ft-gps-live" style="background:#0d1526;border:1px solid rgba(99,179,237,.15);border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="width:8px;height:8px;border-radius:50%;background:#68d391;flex-shrink:0;animation:pulse 2s infinite" id="ft-gps-dot-live"></div>
        <div style="flex:1;font-size:12px;color:#a0aec0" id="ft-gps-coords-live">Aguardando GPS...</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <button onclick="fiscalTurnoScreen._pausar()" style="background:rgba(245,183,0,.15);border:1px solid rgba(245,183,0,.3);color:#f5b700;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer">⏸ Pausar</button>
        <button onclick="fiscalTurnoScreen._registrarChuva()" style="background:rgba(99,179,237,.1);border:1px solid rgba(99,179,237,.2);color:#63b3ed;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer">🌧️ Chuva</button>
      </div>
      <button onclick="fiscalTurnoScreen._abrirSolicitacao()" style="width:100%;background:rgba(99,179,237,.08);border:1px solid rgba(99,179,237,.15);color:#63b3ed;border-radius:8px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:10px">🔔 Solicitar suporte</button>
      <button onclick="fiscalTurnoScreen._encerrar()" style="width:100%;background:rgba(252,129,129,.1);border:1px solid rgba(252,129,129,.3);color:#fc8181;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer">🏁 Encerrar turno</button>`;

    _iniciarTimer();
    _iniciarHeartbeat();
  }

  function _renderPausado() {
    const t = _turno;
    document.getElementById('ft-conteudo').innerHTML = `
      <div class="card" style="text-align:center;padding:24px;margin-bottom:12px;border-color:rgba(245,183,0,.3)">
        <div style="font-size:36px;margin-bottom:8px">⏸️</div>
        <div style="font-size:18px;font-weight:700;color:#f5b700">Turno Pausado</div>
        <div style="font-size:13px;color:#718096;margin-top:4px">${t.zona_nome||'—'}</div>
      </div>
      <button onclick="fiscalTurnoScreen._retomar()" style="width:100%;background:#2f855a;color:#fff;border:none;border-radius:8px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px">▶️ Retomar Turno</button>
      <button onclick="fiscalTurnoScreen._encerrar()" style="width:100%;background:rgba(252,129,129,.1);border:1px solid rgba(252,129,129,.3);color:#fc8181;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer">🏁 Encerrar mesmo assim</button>`;
  }

  // ── GPS ───────────────────────────────────────────────────────────────────
  function _iniciarGPS() {
    if (!navigator.geolocation) {
      const btn = document.getElementById('btn-ft-checkin');
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
      return;
    }
    _watchId = navigator.geolocation.watchPosition(
      pos => {
        const dot = document.getElementById('ft-gps-dot');
        const st  = document.getElementById('ft-gps-status');
        const acc = document.getElementById('ft-gps-acc');
        const btn = document.getElementById('btn-ft-checkin');
        if (dot) dot.style.background = '#68d391';
        if (st)  st.textContent = 'GPS ativo';
        if (acc) acc.textContent = '±' + Math.round(pos.coords.accuracy) + 'm';
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
        state.set('gps_fiscal', { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, ok: true });
      },
      () => {
        const btn = document.getElementById('btn-ft-checkin');
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
    );
    setTimeout(() => {
      const btn = document.getElementById('btn-ft-checkin');
      if (btn && btn.disabled) { btn.disabled = false; btn.style.opacity = '1'; }
    }, 15000);
  }

  // ── Timer ─────────────────────────────────────────────────────────────────
  function _iniciarTimer() {
    if (_timer) clearInterval(_timer);
    const t = _turno;
    const inicio = t.checkin_hora ? new Date(t.checkin_hora).getTime() : Date.now();
    _timer = setInterval(() => {
      if (_pausado) return;
      const el = document.getElementById('ft-timer');
      if (!el) { clearInterval(_timer); return; }
      const diff = Math.floor((Date.now() - inicio) / 1000);
      const h = Math.floor(diff/3600), m = Math.floor((diff%3600)/60), s = diff%60;
      el.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }, 1000);
  }

  // ── Heartbeat GPS a cada 3 minutos ────────────────────────────────────────
  function _iniciarHeartbeat() {
    if (_heartbeat) clearInterval(_heartbeat);
    _heartbeat = setInterval(() => {
      const gps = state.get('gps_fiscal') || {};
      if (!gps.ok || !_turno) return;
      // Atualizar coords no mapa live
      const el = document.getElementById('ft-gps-coords-live');
      if (el) el.textContent = gps.lat.toFixed(5) + ', ' + gps.lng.toFixed(5);
      // Enviar para backend
      api.post('HEARTBEAT_CLT', {
        turno_id: _turno.turno_id,
        lat:      gps.lat,
        lng:      gps.lng,
        accuracy: gps.accuracy || 999,
      }).catch(() => {});
      // Atualizar GPS no watchPosition
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => state.set('gps_fiscal', { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, ok: true }),
          () => {}, { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
        );
      }
    }, 180000); // 3 minutos
  }

  // ── Acoes ──────────────────────────────────────────────────────────────────
  async function _fazerCheckin() {
    const btn = document.getElementById('btn-ft-checkin');
    if (btn) { btn.textContent = 'Iniciando...'; btn.disabled = true; }
    const gps = state.get('gps_fiscal') || {};
    const gestor = state.get('gestor');
    try {
      const res = await api.post('CHECKIN_TURNO_CLT', {
        token:    gestor.token,
        turno_id: _turno.turno_id,
        lat:      gps.lat  || null,
        lng:      gps.lng  || null,
        accuracy: gps.accuracy || null,
      });
      if (res.ok) {
        _turno.status = 'EM_ANDAMENTO';
        _turno.checkin_hora = res.checkin_hora || new Date().toISOString();
        _renderAtivo();
      } else {
        alert('Erro: ' + (res.erro || res.mensagem));
        if (btn) { btn.textContent = '✅ Iniciar Turno'; btn.disabled = false; }
      }
    } catch(e) { alert('Erro de conexão.'); if (btn) { btn.textContent = '✅ Iniciar Turno'; btn.disabled = false; } }
  }

  async function _pausar() {
    const gestor = state.get('gestor');
    try {
      const res = await api.post('PAUSAR_TURNO_CLT', { token: gestor.token, turno_id: _turno.turno_id });
      if (res.ok) {
        _pausado = true;
        if (_timer) clearInterval(_timer);
        if (_heartbeat) clearInterval(_heartbeat);
        _turno.status = 'PAUSADO';
        _renderPausado();
      }
    } catch(e) { alert('Erro de conexão.'); }
  }

  async function _retomar() {
    const gestor = state.get('gestor');
    try {
      const res = await api.post('RETOMAR_TURNO_CLT', { token: gestor.token, turno_id: _turno.turno_id });
      if (res.ok) {
        _pausado = false;
        _turno.status = 'EM_ANDAMENTO';
        _turno.checkin_hora = res.checkin_hora || _turno.checkin_hora;
        _renderAtivo();
      }
    } catch(e) { alert('Erro de conexão.'); }
  }

  async function _encerrar() {
    if (!confirm('Confirmar encerramento do turno?')) return;
    const gestor = state.get('gestor');
    try {
      const res = await api.post('CHECKOUT_TURNO_CLT', { token: gestor.token, turno_id: _turno.turno_id });
      if (res.ok) {
        if (_timer) clearInterval(_timer);
        if (_heartbeat) clearInterval(_heartbeat);
        if (_watchId !== null) { navigator.geolocation.clearWatch(_watchId); _watchId = null; }
        const h = res.duracao_real_horas || 0;
        document.getElementById('ft-conteudo').innerHTML = `
          <div style="text-align:center;padding:40px 20px">
            <div style="font-size:48px;margin-bottom:12px">✅</div>
            <div style="font-size:20px;font-weight:700;color:#68d391;margin-bottom:8px">Turno encerrado!</div>
            <div style="font-size:14px;color:#718096">Duração: ${h}h</div>
          </div>`;
      }
    } catch(e) { alert('Erro de conexão.'); }
  }

  function _registrarChuva() {
    const gestor = state.get('gestor');
    api.post('SOLICITAR_REALOCACAO', {
      jornada_id: '',
      slot_id:    '',
      descricao:  'Registro de chuva — Fiscal em campo.',
      motivo_ocorrencia: 'CHUVA',
      ocorrencia_climatica: true,
    }).then(() => alert('🌧️ Chuva registrada!')).catch(() => {});
  }

  function _abrirSolicitacao() {
    const gestor = state.get('gestor');
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
    modal.innerHTML = `
      <div style="background:#1a2035;border:1px solid rgba(99,179,237,.2);border-radius:24px 24px 0 0;padding:24px 20px 32px;width:100%;max-width:430px">
        <div style="width:40px;height:4px;background:#2d3748;border-radius:2px;margin:0 auto 20px"></div>
        <div style="font-size:17px;font-weight:700;margin-bottom:16px">Solicitar suporte</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button data-tipo="REFORCO_PATINETES" style="background:#0d1526;border:1px solid rgba(99,179,237,.15);color:#e2e8f0;border-radius:10px;padding:14px;font-size:14px;text-align:left;cursor:pointer">🛴 Reforço de patinetes</button>
          <button data-tipo="TROCA_BATERIA" style="background:#0d1526;border:1px solid rgba(99,179,237,.15);color:#e2e8f0;border-radius:10px;padding:14px;font-size:14px;text-align:left;cursor:pointer">🔋 Troca de bateria</button>
          <button data-tipo="OCORRENCIA" style="background:#0d1526;border:1px solid rgba(99,179,237,.15);color:#e2e8f0;border-radius:10px;padding:14px;font-size:14px;text-align:left;cursor:pointer">⚠️ Registrar ocorrência</button>
          <button data-tipo="CANCELAR" style="background:none;border:none;color:#718096;padding:10px;font-size:14px;cursor:pointer">Cancelar</button>
        </div>
      </div>`;
    modal.querySelectorAll('button[data-tipo]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tipo = btn.getAttribute('data-tipo');
        if (tipo === 'CANCELAR') { document.body.removeChild(modal); return; }
        const eventos = {
          'REFORCO_PATINETES': 'SOLICITAR_REFORCO_PATINETES',
          'TROCA_BATERIA':     'SOLICITAR_TROCA_BATERIA',
          'OCORRENCIA':        'REGISTRAR_OCORRENCIA',
        };
        document.body.removeChild(modal);
        try {
          await api.post(eventos[tipo], {
            token:      gestor.token,
            jornada_id: '',
            slot_id:    '',
            descricao:  'Solicitação do Fiscal em campo.',
          });
          alert('✅ Solicitação enviada!');
        } catch(e) { alert('Erro de conexão.'); }
      });
    });
    document.body.appendChild(modal);
  }

  function destroy() {
    if (_timer)    { clearInterval(_timer); _timer = null; }
    if (_heartbeat){ clearInterval(_heartbeat); _heartbeat = null; }
    if (_watchId !== null) { navigator.geolocation.clearWatch(_watchId); _watchId = null; }
  }

  // Expor _fazerCheckin para o botao inline
  window._fiscalCheckin = _fazerCheckin;

  return { render, _fazerCheckin, _pausar, _retomar, _encerrar, _registrarChuva, _abrirSolicitacao, destroy };
})();
