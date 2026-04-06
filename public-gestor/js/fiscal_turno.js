// ─── fiscal_turno.js — Turno do Fiscal ───────────────────────────────────────
const fiscalTurnoScreen = (() => {
  let _turno = null, _timer = null, _heartbeat = null, _watchId = null, _pausado = false;
  const CARGOS_CLT = ['SCOUT','CHARGER','MOTORISTA','FISCAL'];

  async function render() {
    const gestor = state.get('gestor');
    if (!gestor) return router.navigate('login');

    const app = document.getElementById('app');
    app.innerHTML = `
      <section class="screen" id="screen-fiscal-turno">
        <div class="screen-header">
          <h1 class="screen-title">⚡ Meu Turno</h1>
          <div class="screen-subtitle">Controle de Jornada Fiscal</div>
        </div>

        <div id="ft-conteudo">
          <div class="list-empty">Sincronizando turno...</div>
        </div>

        <div id="ft-roteiro" style="display:none;margin-top:24px">
          <div class="section-title">📍 Roteiro de Fiscalização</div>
          <div id="ft-roteiro-lista" style="display:flex;flex-direction:column;gap:12px;margin-top:16px">
             <div style="text-align:center;padding:20px;color:#718096;font-size:12px">Carregando roteiro...</div>
          </div>
        </div>
      </section>
    `;

    _loadTurno();
  }

  async function _loadTurno() {
    try {
      const res = await api.get('GET_MEUS_TURNOS_CLT');
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

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <button onclick="fiscalTurnoScreen._abrirModoFiscalizacao()" style="background:#4f8ef7;color:#fff;border:none;border-radius:12px;padding:16px;font-size:14px;font-weight:700;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px">
          <span style="font-size:24px">🚨</span> Registrar Infração
        </button>
        <button onclick="fiscalTurnoScreen._acionarSOS()" style="background:#fc8181;color:#fff;border:none;border-radius:12px;padding:16px;font-size:14px;font-weight:700;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px">
          <span style="font-size:24px">🆘</span> Botão SOS
        </button>
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

    const rot = document.getElementById('ft-roteiro');
    if (rot) rot.style.display = 'block';
    _carregarRoteiro();

    _iniciarTimer();
    _iniciarHeartbeat();
  }

  function _abrirModoFiscalizacao() {
    const modal = document.createElement('div');
    modal.id = 'modal-modo-fiscalizacao';
    modal.style.cssText = 'position:fixed;inset:0;background:#0a0f1e;z-index:9999;display:flex;flex-direction:column;padding:20px;';
    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h2 style="font-size:18px;font-weight:700;margin:0">🚨 MODO FISCALIZAÇÃO</h2>
        <button onclick="document.body.removeChild(this.parentElement.parentElement)" style="background:none;border:none;color:#718096;font-size:24px">×</button>
      </div>
      <p style="font-size:12px;color:#718096;margin-bottom:20px">Clique no botão para registrar a infração detectada. O GPS será capturado automaticamente.</p>
      
      <div style="display:flex;flex-direction:column;gap:12px;flex:1;overflow-y:auto">
        <button onclick="fiscalTurnoScreen._enviarInfracao('DUAS_PESSOAS')" class="btn-infra">👥 Duas pessoas no patinete</button>
        <button onclick="fiscalTurnoScreen._enviarInfracao('MENOR_IDADE')" class="btn-infra">🔞 Menor de 18 anos</button>
        <button onclick="fiscalTurnoScreen._enviarInfracao('ESTACIONAMENTO_IRREGULAR')" class="btn-infra">🅿️ Estacionamento irregular</button>
        <button onclick="fiscalTurnoScreen._enviarInfracao('TRANSITO_PERIGOSO')" class="btn-infra">🚲 Condução perigosa</button>
        <button onclick="fiscalTurnoScreen._enviarInfracao('DANO_INTENCIONAL')" class="btn-infra">🔨 Dano ao patrimônio</button>
      </div>
      <style>
        .btn-infra { background:#1e2a45; border:1px solid #2a3a55; color:#fff; border-radius:12px; padding:20px; font-size:14px; font-weight:700; text-align:left; cursor:pointer; }
        .btn-infra:active { background:#2a3a55; }
      </style>
    `;
    document.body.appendChild(modal);
  }

  function _acionarSOS() {
    if (confirm('🚨 ACIONAR BOTÃO DE PÂNICO?\n\nIsso enviará sua localização em tempo real para a segurança e para todos os grupos de gestão.')) {
      const gps = state.get('gps_fiscal') || {};
      api.post('REGISTRAR_SOS_FISCAL', {
        lat: gps.lat,
        lng: gps.lng,
        accuracy: gps.accuracy
      }).then(() => alert('🆘 SOS ACIONADO! Permaneça em local seguro.'));
    }
  }

  function _iniciarTimer() {
    if (_timer) clearInterval(_timer);
    const inicio = _turno.checkin_hora ? new Date(_turno.checkin_hora).getTime() : Date.now();
    _timer = setInterval(() => {
      const el = document.getElementById('ft-timer');
      if (!el) { clearInterval(_timer); return; }
      const diff = Math.floor((Date.now() - inicio) / 1000);
      const h = Math.floor(diff/3600), m = Math.floor((diff%3600)/60), s = diff%60;
      el.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }, 1000);
  }

  function _iniciarHeartbeat() {
    if (_heartbeat) clearInterval(_heartbeat);
    _heartbeat = setInterval(() => {
      const gps = state.get('gps_fiscal') || {};
      if (!gps.ok || !_turno) return;
      const el = document.getElementById('ft-gps-coords-live');
      if (el) el.textContent = gps.lat.toFixed(5) + ', ' + gps.lng.toFixed(5);
      api.post('HEARTBEAT_CLT', {
        turno_id: _turno.turno_id,
        lat:      gps.lat,
        lng:      gps.lng,
        accuracy: gps.accuracy || 999,
      }).catch(() => {});
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => state.set('gps_fiscal', { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, ok: true }),
          () => {}, { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
        );
      }
    }, 180000);
  }

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
      err => {
        console.warn('[GPS] Erro:', err.message);
        const btn = document.getElementById('btn-ft-checkin');
        if (btn && btn.disabled) { btn.disabled = false; btn.style.opacity = '1'; }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    setTimeout(() => {
      const btn = document.getElementById('btn-ft-checkin');
      if (btn && btn.disabled) {
        btn.disabled = false;
        btn.style.opacity = '1';
        const st = document.getElementById('ft-gps-status');
        if (st) st.textContent = 'GPS lento — checkin liberado';
      }
    }, 10000);
  }

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
        foto_base64: 'LOGADO_VIA_GESTOR_BYPASS'
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
            <button onclick="fiscalTurnoScreen.render()" style="margin-top:24px;background:#1e2a45;border:1px solid #2a3a55;color:#fff;border-radius:8px;padding:12px 24px;cursor:pointer">Voltar</button>
          </div>`;
      }
    } catch(e) { alert('Erro de conexão.'); }
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

  async function _carregarRoteiro() {
    const lista = document.getElementById('ft-roteiro-lista');
    if (!lista) return;
    try {
      const res = await api.getSlotsHoje();
      const slots = res.data || [];
      const ativos = slots.filter(s => s.vagas_ocupadas > 0);
      if (ativos.length === 0) {
        lista.innerHTML = '<div style="text-align:center;color:#4a5568;font-size:12px;padding:20px">Nenhum ponto com promotores ativos no momento.</div>';
        return;
      }
      lista.innerHTML = ativos.map(s => `
        <div class="card" style="padding:12px;display:flex;justify-content:space-between;align-items:center;border-left:4px solid ${s.problemas?.length > 0 ? '#fc8181' : '#4f8ef7'}">
          <div>
            <div style="font-size:13px;font-weight:700">${s.nome}</div>
            <div style="font-size:11px;color:#718096">${s.inicio_slot} – ${s.fim_slot} | ${s.vagas_ocupadas} promotor(es)</div>
          </div>
          <button class="btn-success" style="padding:6px 10px;font-size:11px" onclick="router.navigate('mapa')">📍 Mapa</button>
        </div>
      `).join('');
    } catch(e) { lista.innerHTML = '<div style="text-align:center;color:#fc8181;font-size:11px">Erro ao carregar roteiro.</div>'; }
  }

  async function _enviarInfracao(tipo) {
    if (!confirm('Registrar infração "' + tipo + '" no local atual?')) return;
    const gps = state.get('gps_fiscal') || {};
    try {
      await api.post('REGISTRAR_INFRACAO_FISCAL', {
        tipo_infracao: tipo,
        lat: gps.lat,
        lng: gps.lng,
        accuracy: gps.accuracy
      });
      alert('Infração registrada com sucesso!');
      document.getElementById('modal-modo-fiscalizacao').remove();
    } catch(e) { alert('Erro ao registrar infração.'); }
  }

  function _abrirSolicitacao() {
    const m = prompt('Informe o motivo do suporte:');
    if (m) {
      api.post('REGISTRAR_SOLICITACAO_FISCAL', { motivo: m })
        .then(() => alert('Solicitação enviada!'));
    }
  }

  function _registrarChuva() {
    if (confirm('Registrar chuva no local atual?')) {
      api.post('REGISTRAR_CHUVA_FISCAL', { status: 'CHUVA' })
        .then(() => alert('Registro de chuva enviado!'));
    }
  }

  function destroy() {
    if (_timer)    { clearInterval(_timer); _timer = null; }
    if (_heartbeat){ clearInterval(_heartbeat); _heartbeat = null; }
    if (_watchId !== null) { navigator.geolocation.clearWatch(_watchId); _watchId = null; }
  }

  window._fiscalCheckin = _fazerCheckin;

  return { render, _fazerCheckin, _pausar, _retomar, _encerrar, _registrarChuva, _abrirSolicitacao, _acionarSOS, _enviarInfracao, destroy };
})();