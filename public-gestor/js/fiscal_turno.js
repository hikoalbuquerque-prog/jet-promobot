// ─── fiscal_turno.js — Turno do Fiscal ───────────────────────────────────────
const fiscalTurnoScreen = (() => {
  let _turno = null, _timer = null, _heartbeat = null, _watchId = null, _pausado = false;

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
          <div style="text-align:center;padding:40px;color:#a0aec0">Sincronizando turno...</div>
        </div>

        <div id="ft-roteiro" style="display:none;margin-top:24px">
          <div class="section-title">📍 Roteiro de Fiscalização</div>
          <div id="ft-roteiro-lista" style="display:flex;flex-direction:column;gap:12px;margin-top:16px"></div>
        </div>
      </section>
    `;

    _loadTurno();
  }

  function _getHojeISO() {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  }

  async function _loadTurno() {
    try {
      const res = await api.get('GET_MEUS_TURNOS_CLT');
      const hoje = _getHojeISO();
      const turnoHoje = (res.data || []).find(t =>
        String(t.data).substring(0,10) === hoje && ['PLANEJADO','ESCALADO','CONFIRMADO','EM_ANDAMENTO','PAUSADO'].includes(t.status)
      );
      _turno = turnoHoje || null;
      _renderEstado();
    } catch(e) {
      document.getElementById('ft-conteudo').innerHTML = `<div style="text-align:center;padding:20px;color:#fc8181">Erro ao carregar turno: ${e.message}</div>`;
    }
  }

  function _renderEstado() {
    if (!_turno) { _renderSemTurno(); return; }
    if (_turno.status === 'EM_ANDAMENTO') { _renderAtivo(); return; }
    if (_turno.status === 'PAUSADO')      { _renderPausado(); return; }
    _renderAguardando();
  }

  function _renderSemTurno() {
    document.getElementById('ft-conteudo').innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:#718096">
        <div style="font-size:48px;margin-bottom:12px">📋</div>
        <div style="font-size:15px;margin-bottom:6px">Nenhum turno escalado para hoje</div>
        <div style="font-size:13px">Verifique sua escala no menu "Escala CLT".</div>
      </div>`;
  }

  function _renderAguardando() {
    const t = _turno;
    document.getElementById('ft-conteudo').innerHTML = `
      <div class="card" style="margin-bottom:16px;border-left:4px solid #63b3ed">
        <div style="font-size:11px;color:#63b3ed;font-weight:700;letter-spacing:1px;margin-bottom:8px">PRONTO PARA INICIAR</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:4px">⏰ ${t.inicio||'—'} – ${t.fim||'—'}</div>
        <div style="font-size:13px;color:#718096">${t.zona_nome||'—'}</div>
      </div>

      <div id="ft-distancia-alerta" style="display:none;background:rgba(245,183,0,0.1);border:1px solid rgba(245,183,0,0.3);border-radius:10px;padding:12px;margin-bottom:16px;color:#f5b700;font-size:13px;display:flex;align-items:center;gap:10px">
        <span style="font-size:18px">⚠️</span>
        <div id="ft-distancia-msg">Calculando distância...</div>
      </div>

      <div id="ft-gps-strip" style="background:#0d1526;border:1px solid rgba(99,179,237,.15);border-radius:10px;padding:12px;display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <div style="width:10px;height:10px;border-radius:50%;background:#f5b700;flex-shrink:0" id="ft-gps-dot"></div>
        <div style="flex:1;font-size:13px;color:#a0aec0" id="ft-gps-status">Aguardando localização...</div>
      </div>

      <button id="btn-ft-checkin" class="btn-success" onclick="fiscalTurnoScreen._fazerCheckin()" 
        style="width:100%;padding:20px;border-radius:14px;font-size:17px;font-weight:800;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(72,187,120,0.3)">
        ▶️ INICIAR TURNO AGORA
      </button>
      <p style="text-align:center;font-size:11px;color:#4a5568;margin-top:12px">Ao iniciar, sua localização será compartilhada com a gestão.</p>`;
    _iniciarGPS();
  }

  function _renderAtivo() {
    const t = _turno;
    const checkinHora = t.checkin_hora ? new Date(t.checkin_hora).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '—';
    
    document.getElementById('ft-conteudo').innerHTML = `
      <div class="card" style="text-align:center;padding:24px;margin-bottom:12px;border-color:rgba(72,187,120,.3);background:rgba(72,187,120,0.05)">
        <div style="font-size:11px;color:#68d391;letter-spacing:1px;margin-bottom:8px">TURNO EM ANDAMENTO</div>
        <div id="ft-timer" style="font-size:48px;font-weight:800;color:#68d391;letter-spacing:-2px;line-height:1">00:00:00</div>
        <div style="font-size:12px;color:#718096;margin-top:6px">Check-in realizado às ${checkinHora}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <button onclick="fiscalTurnoScreen._abrirModoFiscalizacao()" style="background:#4f8ef7;color:#fff;border:none;border-radius:14px;padding:20px;font-size:14px;font-weight:700;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px">
          <span style="font-size:28px">🚨</span> Registrar Infração
        </button>
        <button onclick="fiscalTurnoScreen._acionarSOS()" style="background:#fc8181;color:#fff;border:none;border-radius:14px;padding:20px;font-size:14px;font-weight:700;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px">
          <span style="font-size:28px">🆘</span> Botão SOS
        </button>
      </div>

      <div id="ft-gps-live" style="background:#0d1526;border:1px solid rgba(99,179,237,.15);border-radius:10px;padding:12px;display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="width:8px;height:8px;border-radius:50%;background:#68d391;flex-shrink:0;animation:pulse 2s infinite"></div>
        <div style="flex:1;font-size:12px;color:#a0aec0" id="ft-gps-coords-live">Localização ativa</div>
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <button onclick="fiscalTurnoScreen._pausar()" style="background:rgba(245,183,0,.1);border:1px solid rgba(245,183,0,.2);color:#f5b700;border-radius:10px;padding:14px;font-size:14px;font-weight:700;cursor:pointer">⏸ Pausar</button>
        <button onclick="fiscalTurnoScreen._registrarChuva()" style="background:rgba(99,179,237,.1);border:1px solid rgba(99,179,237,.2);color:#63b3ed;border-radius:10px;padding:14px;font-size:14px;font-weight:700;cursor:pointer">🌧️ Chuva</button>
      </div>
      <button onclick="fiscalTurnoScreen._abrirSolicitacao()" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#a0aec0;border-radius:10px;padding:14px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:10px">🔔 Solicitar Suporte</button>
      <button onclick="fiscalTurnoScreen._encerrar()" style="width:100%;background:rgba(229,62,62,0.1);border:1px solid rgba(229,62,62,0.2);color:#fc8181;border-radius:10px;padding:14px;font-size:15px;font-weight:700;cursor:pointer">🏁 ENCERRAR TURNO</button>`;

    _carregarRoteiro();
    _iniciarTimer();
    _iniciarHeartbeat();
  }

  function _iniciarGPS() {
    if (!navigator.geolocation) {
      document.getElementById('ft-gps-status').textContent = 'GPS não suportado neste navegador.';
      return;
    }
    
    _watchId = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        state.set('gps_fiscal', { lat, lng, accuracy, ok: true });
        
        const dot = document.getElementById('ft-gps-dot');
        const st  = document.getElementById('ft-gps-status');
        if (dot) dot.style.background = '#68d391';
        if (st)  st.textContent = 'Localização OK (±' + Math.round(accuracy) + 'm)';

        // Checar distância
        if (_turno && _turno.zona_lat && _turno.zona_lng) {
          const R = 6371000;
          const dLat = (_turno.zona_lat - lat) * Math.PI/180;
          const dLng = (_turno.zona_lng - lng) * Math.PI/180;
          const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180)*Math.cos(_turno.zona_lat*Math.PI/180)*Math.sin(dLng/2)**2;
          const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
          const raio = (_turno.zona_raio_km || 5) * 1000;
          
          const alerta = document.getElementById('ft-distancia-alerta');
          const msg = document.getElementById('ft-distancia-msg');
          if (dist > raio) {
            if (alerta) alerta.style.display = 'flex';
            if (msg) msg.textContent = `Você está a ${dist}m da sua zona (raio permitido: ${raio}m).`;
          } else {
            if (alerta) alerta.style.display = 'none';
          }
        }
      },
      err => { console.warn('[GPS] Erro:', err.message); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function _fazerCheckin() {
    const btn = document.getElementById('btn-ft-checkin');
    const gpsData = state.get('gps_fiscal') || {};
    const gestor = state.get('gestor');

    // Validação de segurança para o clique
    if (btn.disabled) return;
    btn.textContent = '⏱️ PROCESSANDO...';
    btn.disabled = true;

    try {
      const res = await api.post('CHECKIN_TURNO_CLT', {
        token:    gestor.token,
        turno_id: _turno.turno_id,
        lat:      gpsData.lat  || null,
        lng:      gpsData.lng  || null,
        accuracy: gpsData.accuracy || null,
        foto_base64: 'LOGADO_VIA_GESTOR_BYPASS'
      });

      if (res.ok) {
        _turno.status = 'EM_ANDAMENTO';
        _turno.checkin_hora = res.checkin_hora || new Date().toISOString();
        _renderAtivo();
      } else {
        alert('❌ ERRO NO CHECK-IN:\n' + (res.erro || res.mensagem));
        btn.textContent = '▶️ INICIAR TURNO AGORA';
        btn.disabled = false;
      }
    } catch(e) { 
      alert('❌ ERRO DE CONEXÃO:\nVerifique sua internet e tente novamente.'); 
      btn.textContent = '▶️ INICIAR TURNO AGORA';
      btn.disabled = false;
    }
  }

  async function _pausar() {
    try {
      const res = await api.post('PAUSAR_TURNO_CLT', { token: state.get('gestor').token, turno_id: _turno.turno_id });
      if (res.ok) { _turno.status = 'PAUSADO'; _renderEstado(); }
    } catch(e) { alert('Erro na pausa.'); }
  }

  async function _retomar() {
    try {
      const res = await api.post('RETOMAR_TURNO_CLT', { token: state.get('gestor').token, turno_id: _turno.turno_id });
      if (res.ok) { _turno.status = 'EM_ANDAMENTO'; _renderEstado(); }
    } catch(e) { alert('Erro ao retomar.'); }
  }

  async function _encerrar() {
    if (!confirm('Confirmar encerramento do turno?')) return;
    try {
      const res = await api.post('CHECKOUT_TURNO_CLT', { token: state.get('gestor').token, turno_id: _turno.turno_id });
      if (res.ok) { 
        if (_watchId) navigator.geolocation.clearWatch(_watchId);
        fiscalTurnoScreen.render(); 
      }
    } catch(e) { alert('Erro no encerramento.'); }
  }

  async function _carregarRoteiro() {
    const rot = document.getElementById('ft-roteiro');
    const lista = document.getElementById('ft-roteiro-lista');
    try {
      const res = await api.getSlotsHoje();
      const ativos = (res.data || []).filter(s => s.vagas_ocupadas > 0);
      if (ativos.length > 0) {
        rot.style.display = 'block';
        lista.innerHTML = ativos.map(s => `
          <div class="card" style="padding:14px;display:flex;justify-content:space-between;align-items:center;border-left:4px solid ${s.problemas?.length > 0 ? '#fc8181' : '#4f8ef7'}">
            <div>
              <div style="font-size:14px;font-weight:700">${s.nome}</div>
              <div style="font-size:11px;color:#718096">${s.vagas_ocupadas} promotor(es) ativo(s)</div>
            </div>
            <button class="btn-success" style="padding:8px 12px;font-size:11px" onclick="router.navigate('mapa')">📍 MAPA</button>
          </div>
        `).join('');
      }
    } catch(e) {}
  }

  function _iniciarTimer() {
    if (_timer) clearInterval(_timer);
    const inicio = _turno.checkin_hora ? new Date(_turno.checkin_hora).getTime() : Date.now();
    _timer = setInterval(() => {
      const el = document.getElementById('ft-timer');
      if (!el) return clearInterval(_timer);
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
      api.post('HEARTBEAT_CLT', { turno_id: _turno.turno_id, lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy }).catch(() => {});
    }, 180000);
  }

  function _acionarSOS() {
    if (confirm('🚨 ACIONAR BOTÃO DE PÂNICO?')) {
      const gps = state.get('gps_fiscal') || {};
      api.post('REGISTRAR_SOS_FISCAL', { lat: gps.lat, lng: gps.lng }).then(() => alert('🆘 SOS ACIONADO! SEGURANÇA NOTIFICADA.'));
    }
  }

  function _abrirModoFiscalizacao() {
    const modal = document.createElement('div');
    modal.id = 'modal-modo-fiscalizacao';
    modal.style.cssText = 'position:fixed;inset:0;background:#0a0f1e;z-index:9999;display:flex;flex-direction:column;padding:20px;';
    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h2 style="font-size:18px;font-weight:700;margin:0">🚨 MODO FISCALIZAÇÃO</h2>
        <button onclick="document.getElementById('modal-modo-fiscalizacao').remove()" style="background:none;border:none;color:#718096;font-size:24px">×</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;flex:1;overflow-y:auto">
        <button onclick="fiscalTurnoScreen._enviarInfracao('DUAS_PESSOAS')" class="btn-infra">👥 Duas pessoas no patinete</button>
        <button onclick="fiscalTurnoScreen._enviarInfracao('MENOR_IDADE')" class="btn-infra">🔞 Menor de 18 anos</button>
        <button onclick="fiscalTurnoScreen._enviarInfracao('ESTACIONAMENTO_IRREGULAR')" class="btn-infra">🅿️ Estacionamento irregular</button>
        <button onclick="fiscalTurnoScreen._enviarInfracao('TRANSITO_PERIGOSO')" class="btn-infra">🚲 Condução perigosa</button>
        <button onclick="fiscalTurnoScreen._enviarInfracao('DANO_INTENCIONAL')" class="btn-infra">🔨 Dano ao patrimônio</button>
      </div>
      <style>.btn-infra{background:#1e2a45;border:1px solid #2a3a55;color:#fff;border-radius:12px;padding:20px;font-size:14px;font-weight:700;text-align:left;cursor:pointer;}</style>
    `;
    document.body.appendChild(modal);
  }

  async function _enviarInfracao(tipo) {
    if (!confirm('Registrar infração?')) return;
    const gps = state.get('gps_fiscal') || {};
    try {
      await api.post('REGISTRAR_INFRACAO_FISCAL', { tipo_infracao: tipo, lat: gps.lat, lng: gps.lng });
      alert('✅ Infração registrada!');
      document.getElementById('modal-modo-fiscalizacao').remove();
    } catch(e) { alert('Erro ao registrar.'); }
  }

  function _abrirSolicitacao() {
    const m = prompt('Motivo do suporte:');
    if (m) api.post('REGISTRAR_SOLICITACAO_FISCAL', { motivo: m }).then(() => alert('✅ Enviado!'));
  }

  function _registrarChuva() {
    if (confirm('Registrar chuva no local?')) api.post('REGISTRAR_CHUVA_FISCAL', { status: 'CHUVA' }).then(() => alert('✅ Enviado!'));
  }

  function destroy() {
    if (_timer) clearInterval(_timer);
    if (_heartbeat) clearInterval(_heartbeat);
    if (_watchId) navigator.geolocation.clearWatch(_watchId);
  }

  return { render, _fazerCheckin, _pausar, _retomar, _encerrar, _registrarChuva, _abrirSolicitacao, _acionarSOS, _enviarInfracao, destroy };
})();