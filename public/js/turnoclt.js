// ---- motivo_ocorrencia CLT helpers ----
function _selecionarMotivoCLT(titulo,msg){
  return new Promise(function(resolve){
    var ov=document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
    ov.innerHTML='<div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:24px 24px 0 0;padding:24px 20px 32px;width:100%;max-width:430px">'
      +'<div style="font-size:17px;font-weight:700;margin-bottom:6px">'+titulo+'</div>'
      +'<div style="font-size:13px;color:#a0aec0;margin-bottom:20px">'+msg+'</div>'
      +'<div style="display:flex;flex-direction:column;gap:10px">'
      +'<button data-m="CHUVA" data-c="1" style="background:rgba(99,179,237,.15);border:1px solid rgba(99,179,237,.3);color:#63b3ed;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer">🌧️ Chuva ou condição climática</button>'
      +'<button data-m="TRANSPORTE" data-c="0" style="background:rgba(245,183,0,.1);border:1px solid rgba(245,183,0,.25);color:#f5b700;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer">🚌 Problema de transporte</button>'
      +'<button data-m="SAUDE" data-c="0" style="background:rgba(252,129,129,.1);border:1px solid rgba(252,129,129,.25);color:#fc8181;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer">🏥 Saúde</button>'
      +'<button data-m="OUTRO" data-c="0" style="background:#1e2a45;border:1px solid #2a3a55;color:#a0aec0;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer">Outro motivo</button>'
      +'<button data-m="CANCELAR" style="background:none;border:none;color:#6c7a8d;padding:10px;font-size:14px;cursor:pointer">Cancelar</button>'
      +'</div></div>';
    ov.querySelectorAll('button[data-m]').forEach(function(b){
      b.addEventListener('click',function(){
        document.body.removeChild(ov);
        var mv=b.getAttribute('data-m');
        if(mv==='CANCELAR'){resolve(null);return;}
        resolve({motivo_ocorrencia:mv,ocorrencia_climatica:b.getAttribute('data-c')==='1'});
      });
    });
    document.body.appendChild(ov);
  });
}
function _minutosAtrasoCLT(s){if(!s)return 0;var a=new Date(),p=String(s).substring(0,5).split(':'),b=new Date();b.setHours(parseInt(p[0]),parseInt(p[1]),0,0);return Math.floor((a-b)/60000);}
function _minutosAntecipadoCLT(s){if(!s)return 0;var a=new Date(),p=String(s).substring(0,5).split(':'),b=new Date();b.setHours(parseInt(p[0]),parseInt(p[1]),0,0);return Math.floor((b-a)/60000);}

// ─── turnoclt.js ──────────────────────────────────────────────────────────────
// Tela de turno ativo CLT: checkin → em andamento → checkout

const turnoCLT = {
  _timer: null,
  _watchId: null,

  async render() {
    const p = state.get('promotor');
    if (!p) return router.go('splash');

    // Buscar turno ativo do dia
    document.getElementById('app').innerHTML = _renderLoading();

    try {
      const res = await api.get('GET_MEUS_TURNOS_CLT');
      const turnos = res.data || [];
      const hoje = new Date().toLocaleDateString('en-CA');
      const ativo = turnos.find(t =>
        t.data === hoje &&
        ['PLANEJADO','ESCALADO','CONFIRMADO','EM_ANDAMENTO'].includes(t.status)
      );

      if (!ativo) {
        document.getElementById('app').innerHTML = _renderSemTurno();
        return;
      }

      state.set('turno_clt_ativo', ativo);

      if (ativo.status === 'EM_ANDAMENTO') {
        this._renderAtivo(ativo);
      } else {
        this._renderCheckin(ativo);
      }
    } catch(e) {
      document.getElementById('app').innerHTML = _renderErro(e.message);
    }
  },

  _renderCheckin(turno) {
    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
        ${_navHeader('Meu Turno')}
        <div style="padding:16px;display:flex;flex-direction:column;gap:14px">

          <div style="background:#1e2a45;border:1px solid #4f8ef744;border-radius:14px;padding:18px">
            <div style="font-size:11px;color:#4f8ef7;font-weight:700;letter-spacing:1px;margin-bottom:10px">TURNO DE HOJE</div>
            <div style="font-size:18px;font-weight:700;margin-bottom:6px">⏰ ${_fh(turno.inicio)} – ${_fh(turno.fim)}</div>
            <div style="font-size:13px;color:#a0aec0">${turno.zona_nome || '—'}</div>
            ${turno.ponto_referencia ? `<div style="font-size:13px;color:#a0aec0">${turno.ponto_referencia}</div>` : ''}
            <div style="margin-top:10px;display:flex;justify-content:space-between">
              <span style="font-size:12px;color:#a0aec0">Horas previstas</span>
              <strong style="font-size:12px">${turno.horas_turno || '—'}h</strong>
            </div>
          </div>

          <div id="gps-status-clt" style="background:#1e2a45;border:1px solid #2a3a55;border-radius:10px;padding:12px;display:flex;align-items:center;gap:10px">
            <div style="width:10px;height:10px;border-radius:50%;background:#f1c40f;animation:pulse 1.5s infinite"></div>
            <span style="font-size:13px;color:#a0aec0">Obtendo GPS...</span>
          </div>

          <button id="btn-checkin-clt" disabled onclick="turnoCLT._fazerCheckin('${turno.turno_id}')"
            style="background:#2ecc71;color:#fff;border:none;border-radius:12px;font-size:17px;font-weight:700;padding:18px;width:100%;cursor:pointer;opacity:.5">
            ✅ Registrar Check-in
          </button>

          <button onclick="router.go('home-clt')"
            style="background:none;border:1px solid #2a3a55;border-radius:10px;color:#a0aec0;font-size:14px;padding:12px;cursor:pointer">
            ← Voltar
          </button>
        </div>
        ${_navBottom('turno-ativo')}
        <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}</style>
      </div>`;

    this._iniciarGPS();
  },

  _renderAtivo(turno) {
    const checkinHora = turno.checkin_hora
      ? new Date(turno.checkin_hora).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
      : '—';

    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
        ${_navHeader('Turno em Andamento')}
        <div style="padding:16px;display:flex;flex-direction:column;gap:14px">

          <div style="background:#1e2a45;border:1px solid #2ecc7144;border-left:4px solid #2ecc71;border-radius:14px;padding:18px">
            <div style="font-size:11px;color:#2ecc71;font-weight:700;letter-spacing:1px;margin-bottom:10px">EM ANDAMENTO</div>
            <div style="font-size:22px;font-weight:800;font-family:monospace;color:#2ecc71" id="clt-timer">00:00:00</div>
            <div style="font-size:13px;color:#a0aec0;margin-top:6px">Check-in às ${checkinHora}</div>
            <div style="margin-top:10px;font-size:14px;font-weight:600">${turno.zona_nome || '—'}</div>
            ${turno.ponto_referencia ? `<div style="font-size:13px;color:#a0aec0">${turno.ponto_referencia}</div>` : ''}
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:14px;text-align:center">
              <div style="font-size:10px;color:#6c7a8d;margin-bottom:4px">PREVISTO FIM</div>
              <div style="font-size:16px;font-weight:700">${_fh(turno.fim)}</div>
            </div>
            <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:14px;text-align:center">
              <div style="font-size:10px;color:#6c7a8d;margin-bottom:4px">HORAS PREVISTAS</div>
              <div style="font-size:16px;font-weight:700">${turno.horas_turno || '—'}h</div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <button onclick="turnoCLT._pausar('${turno.turno_id}')" id="btn-pause-clt"
              style="background:#f1c40f22;border:1px solid #f1c40f44;color:#f1c40f;border-radius:12px;font-size:15px;font-weight:700;padding:14px;cursor:pointer">
              ⏸️ Pausar
            </button>
            <button onclick="turnoCLT._fazerCheckout('${turno.turno_id}')" id="btn-checkout-clt"
              style="background:#e74c3c;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;padding:14px;cursor:pointer">
              🔴 Check-out
            </button>
          </div>
        </div>
        ${_navBottom('turno-ativo')}
      </div>`;

    // Heartbeat GPS (Global + Background)
    heartbeat.iniciar(turno.turno_id);

    // Timer
    if (turno.checkin_hora) {
      const inicio = new Date(turno.checkin_hora).getTime();
      this._timer = setInterval(() => {
        const el = document.getElementById('clt-timer');
        if (!el) { clearInterval(turnoCLT._timer); return; }
        const diff = Math.floor((Date.now() - inicio) / 1000);
        const h = Math.floor(diff/3600), m = Math.floor((diff%3600)/60), s = diff%60;
        el.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      }, 1000);
    }
  },

  _iniciarGPS() {
    gps.iniciar();
    const unsub = gps.onChange(g => {
      const el = document.getElementById('gps-status-clt');
      if (g.ok) {
        if (el) el.innerHTML = `<div style="width:10px;height:10px;border-radius:50%;background:#2ecc71"></div><span style="font-size:13px;color:#2ecc71">GPS ativo · ±${Math.round(g.accuracy)}m</span>`;
        state.set('gps_clt', g);
        this._liberarCheckin(g);
      } else {
        if (el) el.innerHTML = `<div style="width:10px;height:10px;border-radius:50%;background:#f1c40f"></div><span style="font-size:13px;color:#f1c40f">GPS indisponível — checkin sem localização</span>`;
        this._liberarCheckin(null);
      }
    });
    state.set('_gpsUnsubCLT', unsub);

    // Timeout 15s — liberar mesmo sem GPS
    setTimeout(() => {
      const btn = document.getElementById('btn-checkin-clt');
      if (btn && btn.disabled) this._liberarCheckin(null);
    }, 15000);
  },

  _liberarCheckin(pos) {
    const btn = document.getElementById('btn-checkin-clt');
    if (!btn) return;
    btn.disabled = false;
    btn.style.opacity = '1';
  },

  async _fazerCheckin(turnoId) {
    const btn = document.getElementById('btn-checkin-clt');
    const gps = state.get('gps_clt') || {};
    const turno = state.get('turno_clt_ativo') || {};
    const _amclt = _minutosAtrasoCLT(turno.inicio); let _mcclt = null;
    if (_amclt > 5) { _mcclt = await _selecionarMotivoCLT('Check-in com atraso de ' + _amclt + ' min', 'Informe o motivo para não afetar sua pontuação.'); }

    if (btn) { btn.textContent = 'Registrando...'; btn.disabled = true; }

    const enviarCheckin = async (lat, lng, accuracy) => {
      // Verificar raio da zona CLT se tiver coordenadas
      const turno = state.get('turno_clt_ativo') || {};
      if (lat && turno.zona_lat && turno.zona_lng) {
        const R = 6371000;
        const dLat = (turno.zona_lat - lat) * Math.PI/180;
        const dLng = (turno.zona_lng - lng) * Math.PI/180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180)*Math.cos(turno.zona_lat*Math.PI/180)*Math.sin(dLng/2)**2;
        const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
        const raio = (turno.zona_raio_km || 5) * 1000;
        if (dist > raio) {
          if (!confirm('⚠️ Você está a ' + dist + 'm da sua zona (máx ' + raio + 'm).\n\nDeseja fazer o check-in fora da zona? A gestão será notificada.')) {
            if (btn) { btn.textContent = '✅ Registrar Check-in'; btn.disabled = false; }
            return;
          }
        }
      }

      try {
        const res = await api.post(Object.assign({
          evento: 'CHECKIN_TURNO_CLT',
          turno_id: turnoId,
          lat:  lat  || null,
          lng:  lng  || null,
          accuracy: accuracy || null,
        }, _mcclt || {}));

        if (!res.ok) {
          ui.toast('❌ ' + (res.erro || res.mensagem || 'Erro'), 'error');
          if (btn) { btn.textContent = '✅ Registrar Check-in'; btn.disabled = false; }
          return;
        }

        if (this._watchId !== null) { navigator.geolocation.clearWatch(this._watchId); this._watchId = null; }
        ui.toast('✅ Check-in registrado!', 'success');
        const turno = state.get('turno_clt_ativo') || {};
        turno.status = 'EM_ANDAMENTO';
        turno.checkin_hora = res.checkin_hora || new Date().toISOString();
        state.set('turno_clt_ativo', turno);
        setTimeout(() => this._renderAtivo(turno), 800);

      } catch(_) {
        ui.toast('❌ Sem conexão.', 'error');
        if (btn) { btn.textContent = '✅ Registrar Check-in'; btn.disabled = false; }
      }
    };

    if (gps.ok && gps.lat) {
      await enviarCheckin(gps.lat, gps.lng, gps.accuracy);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => enviarCheckin(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
        ()  => enviarCheckin(null, null, null),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    } else {
      await enviarCheckin(null, null, null);
    }
  },

  async _pausar(turnoId) {
    const btn = document.getElementById('btn-pause-clt');
    if (btn) { btn.textContent = 'Pausando...'; btn.disabled = true; }
    try {
      const res = await api.post({ evento: 'PAUSAR_TURNO_CLT', turno_id: turnoId });
      if (res.ok) {
        clearInterval(this._timer);
        heartbeat.parar();
        gps.parar();
        ui.toast('⏸️ Turno pausado', 'success');
        // Recarregar tela mostrando estado pausado
        const turno = state.get('turno_clt_ativo') || {};
        turno.status = 'PAUSADO';
        state.set('turno_clt_ativo', turno);
        this._renderPausado(turno);
      } else {
        ui.toast('❌ ' + (res.erro || res.mensagem), 'error');
        if (btn) { btn.textContent = '⏸️ Pausar'; btn.disabled = false; }
      }
    } catch(_) { ui.toast('❌ Sem conexão.', 'error'); if (btn) { btn.textContent = '⏸️ Pausar'; btn.disabled = false; } }
  },

  _renderPausado(turno) {
    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
        ${_navHeader('Turno Pausado')}
        <div style="padding:16px;display:flex;flex-direction:column;gap:14px">
          <div style="background:#1e2a45;border:1px solid #f1c40f44;border-left:4px solid #f1c40f;border-radius:14px;padding:18px;text-align:center">
            <div style="font-size:36px;margin-bottom:8px">⏸️</div>
            <div style="font-size:18px;font-weight:700;color:#f1c40f">Turno Pausado</div>
            <div style="font-size:13px;color:#a0aec0;margin-top:6px">${turno.zona_nome || '—'}</div>
          </div>
          <button onclick="turnoCLT._retomar('${turno.turno_id}')" id="btn-resume-clt"
            style="background:#2ecc71;color:#fff;border:none;border-radius:12px;font-size:17px;font-weight:700;padding:18px;width:100%;cursor:pointer">
            ▶️ Retomar Turno
          </button>
          <button onclick="turnoCLT._fazerCheckout('${turno.turno_id}')"
            style="background:#e74c3c22;border:1px solid #e74c3c44;color:#e74c3c;border-radius:12px;font-size:15px;font-weight:700;padding:14px;cursor:pointer">
            🔴 Encerrar Turno
          </button>
        </div>
        ${_navBottom('turno-ativo')}
      </div>`;
  },

  async _retomar(turnoId) {
    const btn = document.getElementById('btn-resume-clt');
    if (btn) { btn.textContent = 'Retomando...'; btn.disabled = true; }
    try {
      const res = await api.post({ evento: 'RETOMAR_TURNO_CLT', turno_id: turnoId });
      if (res.ok) {
        ui.toast('▶️ Turno retomado!', 'success');
        const turno = state.get('turno_clt_ativo') || {};
        turno.status = 'EM_ANDAMENTO';
        turno.checkin_hora = res.checkin_hora || turno.checkin_hora;
        state.set('turno_clt_ativo', turno);
        this._renderAtivo(turno);
      } else {
        ui.toast('❌ ' + (res.erro || res.mensagem), 'error');
        if (btn) { btn.textContent = '▶️ Retomar Turno'; btn.disabled = false; }
      }
    } catch(_) { ui.toast('❌ Sem conexão.', 'error'); if (btn) { btn.textContent = '▶️ Retomar Turno'; btn.disabled = false; } }
  },

  async _fazerCheckout(turnoId) {
    if (!confirm('Confirmar check-out? Isso encerrará seu turno.')) return;
    const btn = document.getElementById('btn-checkout-clt');
    if (btn) { btn.textContent = 'Registrando...'; btn.disabled = true; }
    try {
      const _turnoA=state.get('turno_clt_ativo')||{};
      const _anclt=_minutosAntecipadoCLT(_turnoA.fim);let _mchoclt=null;
      if(_anclt>5){_mchoclt=await _selecionarMotivoCLT('Encerramento antecipado em '+_anclt+' min','Informe o motivo para não afetar sua pontuação.');}
      const res = await api.post(Object.assign({evento:'CHECKOUT_TURNO_CLT',turno_id:turnoId},_mchoclt||{}));
      if (res.ok) {
        clearInterval(this._timer);
        heartbeat.parar();
        gps.parar();
        state.set('turno_clt_ativo', null);
        const h = res.duracao_real_horas || 0;
        const extra = res.hora_extra || 0;
        const horaCheckout = res.checkout_hora
          ? new Date(res.checkout_hora).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
          : new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
        document.getElementById('app').innerHTML = `
          <div style="min-height:100dvh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:16px;font-family:-apple-system,sans-serif;text-align:center">
            <div style="font-size:48px">✅</div>
            <div style="font-size:22px;font-weight:700;color:#2ecc71">Turno encerrado!</div>
            <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:14px;padding:20px;width:100%;max-width:300px">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <span style="color:#a0aec0">Check-out às</span>
                <strong style="color:#2ecc71">${horaCheckout}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="color:#a0aec0">Duração real</span><strong>${h}h</strong></div>
              ${extra > 0 ? `<div style="display:flex;justify-content:space-between"><span style="color:#f6ad55">Hora extra</span><strong style="color:#f6ad55">+${extra}h</strong></div>` : ''}
            </div>
            <button onclick="router.go('home-clt')" style="background:#4f8ef7;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:700;padding:14px 40px;cursor:pointer">
              Ir para Home
            </button>
          </div>`;
      } else {
        ui.toast('❌ ' + (res.erro || res.mensagem || 'Erro'), 'error');
        if (btn) { btn.textContent = '🔴 Registrar Check-out'; btn.disabled = false; }
      }
    } catch(_) {
      ui.toast('❌ Sem conexão.', 'error');
      if (btn) { btn.textContent = '🔴 Registrar Check-out'; btn.disabled = false; }
    }
  },

  destroy() {
    if (this._timer)        { clearInterval(this._timer); this._timer = null; }
    if (this._heartbeatCLT) { clearInterval(this._heartbeatCLT); this._heartbeatCLT = null; }
    if (this._watchId !== null) { navigator.geolocation.clearWatch(this._watchId); this._watchId = null; }
  }
};

// ── Histórico de turnos CLT ───────────────────────────────────────────────────
const historicoCLT = {
  async render() {
    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
        ${_navHeader('Histórico de Turnos')}
        <div style="padding:16px" id="hist-clt-content">
          <div style="text-align:center;padding:40px;color:#a0aec0">Carregando...</div>
        </div>
        ${_navBottom('historico')}
      </div>`;

    try {
      const res = await api.get('GET_HISTORICO_TURNOS_CLT');
      const turnos = res.data || [];
      const el = document.getElementById('hist-clt-content');

      if (!turnos.length) {
        el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;padding:60px 20px;gap:12px"><div style="font-size:48px;opacity:.4">📋</div><div style="color:#a0aec0">Nenhum turno registrado ainda</div></div>`;
        return;
      }

      const cores = { ENCERRADO:'#2ecc71', EM_ANDAMENTO:'#f1c40f', ESCALADO:'#4f8ef7', CONFIRMADO:'#63b3ed', CANCELADO:'#6c7a8d', FALTA:'#e74c3c' };
      el.innerHTML = turnos.map(t => {
        const cor = cores[t.status] || '#6c7a8d';
        const dur = t.duracao_real_horas ? `${t.duracao_real_horas}h` : '—';
        const extra = parseFloat(t.hora_extra) > 0 ? `<span style="color:#f6ad55;font-size:11px"> +${t.hora_extra}h extra</span>` : '';
        return `
          <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:14px;padding:16px;margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <div style="font-size:14px;font-weight:700">${_fd(t.data)}</div>
              <span style="font-size:11px;padding:3px 8px;border-radius:20px;background:${cor}22;color:${cor};border:1px solid ${cor}44">${t.status}</span>
            </div>
            <div style="font-size:15px;font-weight:600;margin-bottom:4px">⏰ ${_fh(t.inicio)} – ${_fh(t.fim)}</div>
            <div style="font-size:12px;color:#a0aec0;margin-bottom:8px">${t.zona_nome || '—'}</div>
            <div style="display:flex;justify-content:space-between;font-size:13px">
              <span style="color:#a0aec0">Duração</span>
              <strong>${dur}${extra}</strong>
            </div>
          </div>`;
      }).join('');
    } catch(e) {
      const el = document.getElementById('hist-clt-content');
      if (el) el.innerHTML = `<div style="text-align:center;padding:40px;color:#e74c3c">Erro ao carregar</div>`;
    }
  }
};

// ── Helpers internos ──────────────────────────────────────────────────────────
function _renderLoading() {
  return `<div style="min-height:100dvh;background:#1a1a2e;display:flex;align-items:center;justify-content:center"><div style="color:#a0aec0">Carregando...</div></div>`;
}

function _renderSemTurno() {
  return `
    <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
      ${_navHeader('Meu Turno')}
      <div style="padding:24px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center">
        <div style="font-size:48px;opacity:.4;margin-top:40px">⏰</div>
        <div style="font-size:16px;color:#a0aec0">Nenhum turno escalado para hoje</div>
        <button onclick="router.go('home-clt')" style="margin-top:16px;background:#4f8ef7;color:#fff;border:none;border-radius:10px;padding:12px 32px;font-size:14px;cursor:pointer">← Voltar</button>
      </div>
      ${_navBottom('turno-ativo')}
    </div>`;
}

function _renderErro(msg) {
  return `<div style="min-height:100dvh;background:#1a1a2e;display:flex;align-items:center;justify-content:center;color:#e74c3c;font-family:-apple-system,sans-serif">${msg}</div>`;
}

function _navHeader(titulo) {
  return `<div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:50">
    <button onclick="router.go('home-clt')" style="background:#1e2a45;border:none;color:#eaf0fb;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer">‹</button>
    <div style="font-size:17px;font-weight:700;flex:1">${titulo}</div>
  </div>`;
}

function _navBottom(ativo) {
  const itens = [
    { id:'home-clt', icon:'🏠', label:'Home' },
    { id:'turno-ativo', icon:'⚡', label:'Turno' },
    { id:'historico-clt', icon:'📋', label:'Histórico' },
  ];
  return `<nav style="position:fixed;bottom:0;left:0;right:0;background:#16213e;border-top:1px solid #2a3a55;display:flex;justify-content:space-around;padding:10px 0 calc(10px + env(safe-area-inset-bottom,0px));z-index:100">
    ${itens.map(i => `<button onclick="router.go('${i.id}')" style="background:none;border:none;color:${i.id===ativo?'#4f8ef7':'#6c7a8d'};font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:22px">${i.icon}</span>${i.label}</button>`).join('')}
  </nav>`;
}

function _fh(v) {
  if (!v) return '—';
  const s = String(v);
  if (/^\d{2}:\d{2}/.test(s)) return s.substring(0,5);
  try { return new Date(v).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); } catch(_) { return '—'; }
}

function _fd(v) {
  if (!v) return '—';
  const s = String(v).substring(0,10);
  const hoje = new Date().toISOString().split('T')[0];
  const ontem = new Date(Date.now()-86400000).toISOString().split('T')[0];
  if (s === hoje) return 'Hoje';
  if (s === ontem) return 'Ontem';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [,m,d] = s.split('-');
  return `${d}/${m}`;
}