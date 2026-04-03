// ---- motivo_ocorrencia helpers ----
function _selecionarMotivo(titulo,msg){
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
function _minutosAtraso(s){if(!s)return 0;var a=new Date(),p=String(s).substring(0,5).split(':'),b=new Date();b.setHours(parseInt(p[0]),parseInt(p[1]),0,0);return Math.floor((a-b)/60000);}
function _minutosAntecipado(s){if(!s)return 0;var a=new Date(),p=String(s).substring(0,5).split(':'),b=new Date();b.setHours(parseInt(p[0]),parseInt(p[1]),0,0);return Math.floor((b-a)/60000);}

// ── GPS ────────────────────────────────────────────────────────
const gps = (() => {
  let _watchId = null;
  let _cbs = [];

  function iniciar() {
    if (!navigator.geolocation || _watchId !== null) return;
    _watchId = navigator.geolocation.watchPosition(
      pos => {
        const g = { ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, isMock: false };
        state.patch('gps', g);
        _cbs.forEach(fn => fn(g));
      },
      err => {
        const g = { ok: false, erro: err.message };
        state.patch('gps', g);
        _cbs.forEach(fn => fn(g));
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    );
  }

  function parar() {
    if (_watchId !== null) { navigator.geolocation.clearWatch(_watchId); _watchId = null; }
    _cbs = [];
  }

  function onChange(fn) { _cbs.push(fn); return () => { _cbs = _cbs.filter(f => f !== fn); }; }

  function distancia(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const d1 = lat1 * Math.PI / 180, d2 = lat2 * Math.PI / 180;
    const dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(d1)*Math.cos(d2)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function trustScore({ accuracy, isMock }) {
    let s = 100;
    if (isMock) s -= 80;
    if (accuracy > 500) s -= 40; else if (accuracy > 200) s -= 20; else if (accuracy > 100) s -= 10;
    return Math.max(0, Math.min(100, s));
  }

  return { iniciar, parar, onChange, distancia, trustScore };
})();

// ── Timer ──────────────────────────────────────────────────────
const timer = (() => {
  let _acc = 0, _startTs = null, _interval = null, _cbs = [];

  function iniciar()  { _startTs = Date.now(); _interval = setInterval(() => _cbs.forEach(fn => fn(segundos())), 1000); }
  function pausar()   { _acc += Math.floor((Date.now() - _startTs) / 1000); _startTs = null; clearInterval(_interval); _interval = null; }
  function retomar()  { _startTs = Date.now(); _interval = setInterval(() => _cbs.forEach(fn => fn(segundos())), 1000); }
  function parar()    { if (_interval) { clearInterval(_interval); _interval = null; } _acc = 0; _startTs = null; }
  function segundos() { return _acc + (_startTs ? Math.floor((Date.now() - _startTs) / 1000) : 0); }
  function onTick(fn) { _cbs.push(fn); return () => { _cbs = _cbs.filter(f => f !== fn); }; }

  function setAcc(v) { _acc = v; }
  return { iniciar, pausar, retomar, parar, segundos, onTick, setAcc };
})();

// ── operacao (telas de checkin → pausa → resume → checkout) ───
const operacao = {

  // ── CHECKIN ──────────────────────────────────────────────────
  async renderCheckin() {
    // Sempre recarrega slot e jornada do GAS para garantir dados frescos
    let slot = null;
    let jornada = null;
    try {
      const currentSlot = state.get('slot');
      const res = await api.get('GET_SLOT_ATUAL' + (currentSlot?.slot_id ? '&slot_id=' + currentSlot.slot_id : ''));
      if (res.ok && res.slot)    { slot    = res.slot;    state.set('slot', slot); }
      if (res.ok && res.jornada) { jornada = res.jornada; state.saveJornada(jornada); }
    } catch(_) {}
    // Fallback para state local
    if (!slot)    slot    = state.get('slot');
    if (!jornada) jornada = state.loadJornada();

    ui.render(`
      <div class="screen">
        ${ui.header('Check-in', slot?.local || slot?.local_nome || '', true)}
        <div class="content">

          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              ${ui.statusBadge('ACEITO')}
              <span style="font-size:12px;color:var(--text2)">${slot?.slot_id || ''}</span>
            </div>
            <div style="font-size:17px;font-weight:700;margin-bottom:4px">${slot?.local || slot?.local_nome || '—'}</div>
            <div style="font-size:13px;color:var(--text2)">${slot?.cidade || ''} · ${slot?.operacao || ''}</div>
            <div style="display:flex;gap:20px;margin-top:12px;flex-wrap:wrap">
              <div><div class="section-label" style="margin-bottom:2px">INÍCIO</div><div style="font-weight:700">${_fmtHora(slot?.inicio)}</div></div>
              <div><div class="section-label" style="margin-bottom:2px">FIM</div><div style="font-weight:700">${_fmtHora(slot?.fim)}</div></div>
              <div><div class="section-label" style="margin-bottom:2px">RAIO</div><div style="font-weight:700">${slot?.raio_metros || 100}m</div></div>
            </div>
          </div>

          <div class="gps-indicator" id="gps-strip">
            <div class="gps-dot waiting" id="gps-dot"></div>
            <div style="flex:1">
              <div id="gps-label" style="font-weight:600">Obtendo localização...</div>
              <div id="gps-coords" style="font-size:11px;color:var(--text2)">—</div>
            </div>
            <div id="gps-acc" style="font-size:11px;color:var(--text2)"></div>
          </div>

          <div style="text-align:center;padding:8px 0">
            <div id="dist-valor" style="font-size:40px;font-weight:800;color:var(--text2)">—</div>
            <div style="font-size:12px;color:var(--text2);margin-top:2px" id="dist-hint">Aguardando GPS...</div>
          </div>

          <div id="checkin-alert" style="display:none"></div>

          <button id="btn-checkin" class="btn btn-success" disabled onclick="operacao._executarCheckin()">
            ✅ Fazer Check-in
          </button>
        </div>
      </div>
    `);

    gps.iniciar();
    const unsub = gps.onChange(g => operacao._atualizarGpsCheckin(g, slot));

    // GPS imediato — não espera watchPosition
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function(pos) {
          var g = { ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, isMock: false };
          state.patch('gps', g);
          operacao._atualizarGpsCheckin(g, slot);
        },
        function() {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
      );
    }

    // Timeout 10s — oferecer checkin manual
    const _gpsTimeout = setTimeout(() => {
      const btn = document.getElementById('btn-checkin');
      const hint = document.getElementById('dist-hint');
      const gpsAtual = state.get('gps');
      if (!gpsAtual?.ok) {
        if (hint) hint.textContent = 'GPS demorando... Você pode tentar o checkin mesmo assim.';
        if (btn) {
          btn.disabled = false;
          btn.style.background = '#f1c40f';
          btn.style.color = '#1a1a2e';
          btn.innerHTML = '⚠️ Fazer Check-in sem GPS';
        }
      }
    }, 10000);
    state.set('_gpsTimeout', _gpsTimeout);
    // Atualizar com estado já disponível
    const gAtual = state.get('gps');
    if (gAtual?.ok) operacao._atualizarGpsCheckin(gAtual, slot);
    // Guardar cleanup no state para usar no unmount (via router)
    state.set('_gpsUnsub', unsub);
  },

  _atualizarGpsCheckin(g, slot) {
    const dot   = document.getElementById('gps-dot');
    const label = document.getElementById('gps-label');
    const coords= document.getElementById('gps-coords');
    const acc   = document.getElementById('gps-acc');
    const distEl= document.getElementById('dist-valor');
    const hint  = document.getElementById('dist-hint');
    const btn   = document.getElementById('btn-checkin');
    const alert = document.getElementById('checkin-alert');
    if (!dot) return;

    if (!g.ok) {
      dot.className = 'gps-dot error';
      if (label) label.textContent = 'GPS indisponível';
      return;
    }

    // GPS chegou — cancelar timeout e restaurar botão
    const t = state.get('_gpsTimeout');
    if (t) { clearTimeout(t); state.set('_gpsTimeout', null); }
    if (btn && btn.innerHTML.includes('sem GPS')) {
      btn.style.background = '';
      btn.style.color = '';
      btn.innerHTML = '✅ Fazer Check-in';
    }
    dot.className = 'gps-dot ok';
    if (label)  label.textContent = 'GPS Ativo';
    if (coords) coords.textContent = `${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}`;
    if (acc && g.accuracy) acc.textContent = `±${Math.round(g.accuracy)}m`;

    if (!slot?.lat || !slot?.lng) return;

    const dist  = gps.distancia(g.lat, g.lng, parseFloat(slot.lat), parseFloat(slot.lng));
    const raio  = parseFloat(slot.raio_metros || 100);
    const dentro= dist <= raio;

    if (distEl) {
      distEl.textContent = ui.formatDist(dist);
      distEl.style.color = dentro ? 'var(--green)' : 'var(--red)';
    }
    if (hint)   hint.textContent = dentro ? `✅ Dentro do raio de ${raio}m` : `Chegue a menos de ${raio}m do local`;
    if (btn)    btn.disabled = !dentro;
    if (alert)  alert.style.display = dentro ? 'none' : 'block';
    if (alert && !dentro) alert.innerHTML = `<div class="card" style="border-color:var(--yellow);color:var(--yellow);font-size:13px">📍 Você está a ${ui.formatDist(dist)} do local. Aproxime-se para habilitar o check-in.</div>`;
  },

  async _executarCheckin() {
    const slot    = state.get('slot');
    const jornada = state.loadJornada();
    const g       = state.get('gps');

    if (!g?.ok || !g.lat || !g.lng) {
      if (!confirm('GPS não disponível. Fazer check-in sem validação de localização?')) return;
    } else if (slot?.lat && slot?.lng) {
      const dist = gps.distancia(g.lat, g.lng, parseFloat(slot.lat), parseFloat(slot.lng));
      const raio = parseFloat(slot.raio_metros || 100);
      if (dist > raio) {
        if (!confirm('⚠️ Você está a ' + Math.round(dist) + 'm do local (máx ' + raio + 'm).\n\nDeseja fazer o check-in fora do raio? A gestão será notificada.')) return;
        body_fora_raio = true;
      }
    }

    const _am=_minutosAtraso(slot?.inicio);let _mc=null;
    if(_am>5){
      _mc=await _selecionarMotivo('Check-in com atraso de '+_am+' min','Informe o motivo para não afetar sua pontuação.');
      if(_mc===null && _am>5) return; // cancelou o modal — nao prosseguir
    }
    ui.setLoading('btn-checkin', true);
    try {
      const res = await api.post({
        evento:     'CHECKIN',
        jornada_id: jornada?.jornada_id,
        slot_id:    slot?.slot_id,
        lat:        g.lat,
        lng:        g.lng,
        accuracy:   g.accuracy,
        is_mock:    g.isMock || false,
        ...(_mc||{}),
      });

      if (res.ok) {
        state.saveJornada({ ...(jornada || {}), jornada_id: res.jornada_id || jornada?.jornada_id, status: 'EM_ATIVIDADE', inicio_real: new Date().toISOString() });
        state.set('slot', { ...slot, status: 'EM_ATIVIDADE' });
        ui.toast('✅ Check-in registrado!', 'success');
        router.go('em-atividade');
      } else {
        ui.toast('❌ ' + (res.erro || res.mensagem || 'Erro no check-in'), 'error');
        ui.setLoading('btn-checkin', false);
      }
    } catch (_) {
      ui.toast('❌ Sem conexão.', 'error');
      ui.setLoading('btn-checkin', false);
    }
  },

  // ── EM ATIVIDADE ─────────────────────────────────────────────
  renderAtivo() {
    const slot    = state.get('slot');
    const jornada = state.loadJornada();

    ui.render(`
      <div class="screen">
        ${ui.header('Em Atividade', slot?.local || slot?.local_nome || '', false)}
        <div class="content">

          ${ui.statusBadge('EM_ATIVIDADE')}

          <div class="card" style="text-align:center;padding:24px 20px">
            <div class="section-label" style="margin-bottom:8px">TEMPO ATIVO</div>
            <div id="timer-display" style="font-size:48px;font-weight:800;color:var(--green);letter-spacing:-2px;line-height:1">00:00:00</div>
          </div>

          <div id="progress-wrap" style="display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2)">
              <span>Progresso</span><span id="progress-pct">0%</span>
            </div>
            <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">
              <div id="progress-fill" style="height:100%;background:var(--green);width:0%;transition:width 1s linear;border-radius:2px"></div>
            </div>
          </div>

          <div class="card">
            <div class="info-row"><span class="info-label">Local</span><span class="info-value">${slot?.local || slot?.local_nome || '—'}</span></div>
            <div class="info-row"><span class="info-label">Check-in</span><span class="info-value" id="at-checkin">${ui.hora(jornada?.inicio_real)}</span></div>
            <div class="info-row"><span class="info-label">Término previsto</span><span class="info-value">${_fmtHora(slot?.fim)}</span></div>
            <div class="info-row"><span class="info-label">Restante</span><span class="info-value" id="at-restante">—</span></div>
          </div>

          <div class="gps-indicator">
            <div class="gps-dot ok"></div>
            <div style="flex:1"><div style="font-weight:600;font-size:13px">GPS Ativo</div><div id="gps-coords-at" style="font-size:11px;color:var(--text2)">—</div></div>
            <div id="gps-acc-at" style="font-size:11px;color:var(--text2)"></div>
          </div>

          <div style="display:flex;gap:10px">
            <button class="btn btn-warning" style="flex:1" onclick="router.go('pausa')">⏸ Pausar</button>
            <button class="btn btn-ghost"   style="flex:1" onclick="solicitacoes.renderNova()">🔔 Solicitar</button>
          </div>
          <button class="btn btn-ghost" onclick="solicitacoes.renderRealocacao()">📍 Estou aqui — Atualizar localização</button>
          <button class="btn btn-ghost" onclick="vendas.render()">📊 Registrar resultado</button>
          <button class="btn btn-danger" onclick="router.go('checkout')">🏁 Encerrar jornada</button>

        </div>
      </div>
    `);

    gps.iniciar();
    const unsubGps = gps.onChange(g => {
      const coords = document.getElementById('gps-coords-at');
      const acc    = document.getElementById('gps-acc-at');
      if (g.ok) {
        if (coords) coords.textContent = `${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}`;
        if (acc && g.accuracy) acc.textContent = `±${Math.round(g.accuracy)}m`;
      }
    });
    state.set('_gpsUnsub', unsubGps);

    const _jorn = state.loadJornada();
    if (_jorn?.jornada_id) _heartbeatTimer.iniciar(_jorn.jornada_id);
    // Retoma o timer a partir do inicio_real da jornada
    if (_jorn?.inicio_real) {
      const decorridoSeg = Math.floor((Date.now() - new Date(_jorn.inicio_real).getTime()) / 1000);
      timer.parar();
      timer._acc = Math.max(0, decorridoSeg);
      timer.retomar();
    } else {
      timer.iniciar();
    }
    let _avisoFimMostrado = false;
    const unsubTimer = timer.onTick(s => {
      const el = document.getElementById('timer-display');
      if (el) el.textContent = ui.formatTimer(s);
      this._atualizarProgress(s);
      // Aviso fim de slot
      if (!_avisoFimMostrado) {
        const _slot = state.get('slot');
        const _jorn = state.loadJornada();
        if (_slot?.fim && _jorn?.inicio_real) {
          const _fimParts = String(_slot.fim).substring(0,5).split(':');
          const _fimD = new Date(_jorn.inicio_real);
          _fimD.setHours(parseInt(_fimParts[0]), parseInt(_fimParts[1]), 0, 0);
          if (_fimD < new Date(_jorn.inicio_real)) _fimD.setDate(_fimD.getDate()+1);
          const _restMs = _fimD.getTime() - Date.now();
          if (_restMs <= 0 && !document.getElementById('banner-fim-slot')) {
            _avisoFimMostrado = true;
            const banner = document.createElement('div');
            banner.id = 'banner-fim-slot';
            banner.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);width:calc(100% - 32px);max-width:398px;background:#1e2a45;border:1px solid rgba(241,196,15,.4);border-radius:14px;padding:16px;z-index:500;box-shadow:0 8px 32px rgba(0,0,0,.5)';
            banner.innerHTML = '<div style="font-size:15px;font-weight:700;color:#f1c40f;margin-bottom:6px">⌛ Seu slot terminou às ' + String(_slot.fim).substring(0,5) + '</div>'
              + '<div style="font-size:13px;color:#a0aec0;margin-bottom:14px">Você ainda está ativo. O que deseja fazer?</div>'
              + '<div style="display:flex;gap:10px">'
              + '<button onclick="document.getElementById(\'banner-fim-slot\').remove();router.go(\'checkout\')" style="flex:1;background:#e74c3c;color:#fff;border:none;border-radius:10px;padding:12px;font-size:14px;font-weight:700;cursor:pointer">🏁 Encerrar agora</button>'
              + '<button onclick="document.getElementById(\'banner-fim-slot\').remove()" style="flex:1;background:rgba(241,196,15,.15);border:1px solid rgba(241,196,15,.3);color:#f1c40f;border-radius:10px;padding:12px;font-size:14px;font-weight:700;cursor:pointer">⏰ Continuar</button>'
              + '</div>';
            document.body.appendChild(banner);
          }
        }
      }
    });
  },

  _atualizarProgress(s) {
    const slot    = state.get('slot');
    const jornada = state.loadJornada();
    const fill    = document.getElementById('progress-fill');
    const pctEl   = document.getElementById('progress-pct');
    const restEl  = document.getElementById('at-restante');
    if (!slot?.fim || !jornada?.inicio_real) return;

    const ini  = new Date(jornada.inicio_real).getTime();
    const fim  = (() => {
      const t = String(slot.fim);
      if (/^\d{2}:\d{2}/.test(t)) {
        const d = new Date(jornada.inicio_real);
        const [h,m] = t.split(':').map(Number);
        d.setHours(h, m, 0);
        return d.getTime();
      }
      return new Date(slot.fim).getTime();
    })();

    const totalS   = (fim - ini) / 1000;
    const pct      = Math.min(100, (s / totalS * 100)).toFixed(1);
    const restS    = Math.max(0, totalS - s);
    const rh = Math.floor(restS / 3600), rm = Math.floor((restS % 3600) / 60);

    if (fill)  fill.style.width  = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
    if (restEl) restEl.textContent = `${rh}h ${rm.toString().padStart(2,'0')}m`;
  },

  // ── PAUSA ─────────────────────────────────────────────────────
  renderPausa() {
    const jornada = state.loadJornada();
    const segundosAtuais = ui.formatTimer(timer.segundos());

    ui.render(`
      <div class="screen">
        ${ui.header('Pausar Jornada', '', true)}
        <div class="content">
          <div class="card" style="text-align:center;padding:24px">
            <div class="section-label" style="margin-bottom:8px">TEMPO ACUMULADO</div>
            <div style="font-size:40px;font-weight:800;color:var(--yellow)">${segundosAtuais}</div>
          </div>
          <div class="card" style="color:var(--text2);font-size:14px;line-height:1.6">
            O timer para durante a pausa. Retome quando estiver pronto para continuar.
          </div>
          <button id="btn-pausar" class="btn btn-warning" onclick="operacao._executarPausa()">⏸ Confirmar Pausa</button>
          <button class="btn btn-ghost" onclick="router.back()">Voltar</button>
        </div>
      </div>
    `);
  },

  async _executarPausa() {
    const jornada = state.loadJornada();
    ui.setLoading('btn-pausar', true);
    try {
      const res = await api.post({ evento: 'PAUSE', jornada_id: jornada?.jornada_id });
      if (res.ok) {
        timer.pausar();
        state.saveJornada({ ...jornada, status: 'PAUSADO' });
        ui.toast('⏸ Jornada pausada', 'success');
        router.go('pausado');
      } else {
        ui.toast('❌ ' + (res.erro || res.mensagem || 'Erro'), 'error');
        ui.setLoading('btn-pausar', false);
      }
    } catch (_) {
      ui.toast('❌ Sem conexão.', 'error');
      ui.setLoading('btn-pausar', false);
    }
  },

  // ── PAUSADO ───────────────────────────────────────────────────
  renderPausado() {
    const s = ui.formatTimer(timer.segundos());
    ui.render(`
      <div class="screen">
        ${ui.header('Jornada Pausada', '', false)}
        <div class="content">
          ${ui.statusBadge('PAUSADO')}
          <div class="card" style="text-align:center;padding:24px">
            <div class="section-label" style="margin-bottom:8px">TEMPO ACUMULADO</div>
            <div style="font-size:40px;font-weight:800;color:var(--yellow)">${s}</div>
            <div style="font-size:13px;color:var(--text2);margin-top:8px">⏸ Pausado</div>
          </div>
          <div class="card" style="color:var(--text2);font-size:14px">Retome quando estiver pronto para continuar a jornada.</div>
          <button id="btn-resume" class="btn btn-success" onclick="operacao._executarResume()">▶ Retomar Jornada</button>
          <button class="btn btn-danger" onclick="router.go('checkout')">🏁 Encerrar mesmo assim</button>
        </div>
      </div>
    `);
  },

  async _executarResume() {
    const jornada = state.loadJornada();
    ui.setLoading('btn-resume', true);
    try {
      const res = await api.post({ evento: 'RESUME', jornada_id: jornada?.jornada_id });
      if (res.ok) {
        timer.retomar();
        state.saveJornada({ ...jornada, status: 'EM_ATIVIDADE' });
        router.go('em-atividade');
      } else {
        ui.toast('❌ ' + (res.erro || res.mensagem || 'Erro'), 'error');
        ui.setLoading('btn-resume', false);
      }
    } catch (_) {
      ui.toast('❌ Sem conexão.', 'error');
      ui.setLoading('btn-resume', false);
    }
  },

  // ── CHECKOUT ──────────────────────────────────────────────────
  renderCheckout() {
    ui.render(`
      <div class="screen">
        ${ui.header('Encerrar Jornada', '', true)}
        <div class="content">
          <div class="card" style="font-size:14px;color:var(--text2);line-height:1.6">
            Sua localização atual será registrada como ponto de check-out. Esta ação não pode ser desfeita.
          </div>
          <div class="gps-indicator" id="checkout-gps">
            <div class="gps-dot waiting" id="checkout-gps-dot"></div>
            <div style="flex:1">
              <div style="font-weight:600;font-size:13px" id="checkout-gps-label">Aguardando GPS...</div>
              <div style="font-size:11px;color:var(--text2)" id="checkout-gps-coords"></div>
            </div>
          </div>
          <button id="btn-checkout" class="btn btn-danger" onclick="operacao._executarCheckout(false)">🏁 Encerrar Jornada</button>
          <button class="btn btn-ghost" onclick="router.back()">Voltar</button>
          <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px">
            <div style="font-size:12px;color:var(--text2);margin-bottom:8px;text-align:center">Sem sinal de GPS?</div>
            <button class="btn btn-warning" style="width:100%;font-size:13px" onclick="operacao._executarCheckout(true)">
              ⚠️ Checkout sem GPS — Gestão será notificada
            </button>
          </div>
        </div>
      </div>
    `);
    // Atualiza GPS em tempo real
    const _atualizarGpsCheckout = (g) => {
      const dot    = document.getElementById('checkout-gps-dot');
      const label  = document.getElementById('checkout-gps-label');
      const coords = document.getElementById('checkout-gps-coords');
      if (!dot) return;
      if (g?.ok) {
        dot.className = 'gps-dot ok';
        if (label)  label.textContent  = 'GPS pronto';
        if (coords) coords.textContent = g.lat.toFixed(5) + ', ' + g.lng.toFixed(5);
      } else {
        dot.className = 'gps-dot waiting';
        if (label)  label.textContent  = 'Aguardando GPS...';
        if (coords) coords.textContent = '';
      }
    };
    gps.onChange(_atualizarGpsCheckout);
    const gAtual = state.get('gps');
    if (gAtual?.ok) _atualizarGpsCheckout(gAtual);
    // GPS imediato
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const g = { ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          state.patch('gps', g);
          _atualizarGpsCheckout(g);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
      );
    }
  },

  async _executarCheckout(excepcional = false) {
    const jornada = state.loadJornada();
    const slot    = state.get('slot');
    const g       = state.get('gps');
    const _an=_minutosAntecipado(slot?.fim);let _mco=null;
    if(!excepcional&&_an>5){_mco=await _selecionarMotivo('Encerramento antecipado em '+_an+' min','Informe o motivo para não afetar sua pontuação.');}
    ui.setLoading('btn-checkout', true);

    const payload = { jornada_id: jornada?.jornada_id };
    if (g?.ok && !excepcional) { payload.lat = g.lat; payload.lng = g.lng; payload.accuracy = g.accuracy; }
    if (excepcional) payload.motivo = 'EXCEPCIONAL_SEM_GPS';
    if (_mco) Object.assign(payload,_mco);

    try {
      const res = await api.post({ evento: excepcional ? 'CHECKOUT_EXCEPCIONAL' : 'CHECKOUT', ...payload });
      if (res.ok) {
        timer.parar();
        _heartbeatTimer.parar();
        gps.parar();
        state.saveJornada({ ...jornada, status: 'ENCERRADO' });
        state.set('slot', null);
        router.go('encerrado');
      } else {
        ui.toast('❌ ' + (res.erro || res.mensagem || 'Erro'), 'error');
        ui.setLoading('btn-checkout', false);
      }
    } catch (_) {
      ui.toast('❌ Sem conexão.', 'error');
      ui.setLoading('btn-checkout', false);
    }
  },

  // ── ENCERRADO ─────────────────────────────────────────────────
  renderEncerrado() {
    const jornada = state.loadJornada();
    const total   = timer.segundos();
    ui.render(`
      <div class="screen no-bottom">
        ${ui.header('Jornada Encerrada', '', false)}
        <div class="content">
          <div class="card" style="text-align:center;padding:28px 20px">
            <div style="font-size:40px;margin-bottom:8px">✅</div>
            <div style="font-size:20px;font-weight:800;margin-bottom:4px">Jornada concluída!</div>
            <div style="font-size:13px;color:var(--text2)">Obrigado pelo seu trabalho.</div>
          </div>
          <div class="card">
            <div class="info-row"><span class="info-label">Duração total</span><span class="info-value" style="font-weight:800;font-size:18px">${ui.formatTimer(total)}</span></div>
            <div class="info-row"><span class="info-label">Check-in</span><span class="info-value">${ui.hora(jornada?.inicio_real)}</span></div>
            <div class="info-row"><span class="info-label">Check-out</span><span class="info-value">${ui.hora(new Date().toISOString())}</span></div>
          </div>
          <button class="btn btn-primary" onclick="router.go('home')">← Voltar ao início</button>
        </div>
      </div>
    `);
    state.saveJornada(null);
  },

  // ── Dispatch por status da jornada ────────────────────────────
  async renderPorStatus() {
    // Usar estado local primeiro — sem chamada de API
    let jornada = state.loadJornada();
    const currentSlot = state.get('slot');

    // Só busca da API se não tiver jornada local
    if (!jornada) {
      const res = await api.get('GET_SLOT_ATUAL' + (currentSlot?.slot_id ? '&slot_id=' + currentSlot.slot_id : ''));
      if (res.ok && res.jornada) {
        state.saveJornada(res.jornada);
        state.set('slot', res.slot);
        jornada = res.jornada;
      }
    }

    const status = jornada?.status || 'ACEITO';
    const map = {
      'ACEITO':        'checkin',
      'EM_ATIVIDADE':  'em-atividade',
      'PAUSADO':       'pausado',
      'ENCERRADO':     'encerrado',
    };
    router.go(map[status] || 'checkin', false);
  }
};

// Patch: calcular duração real pelo horario_servidor do backend
operacao._calcularDuracaoReal = function() {
  const jornada = state.loadJornada();
  if (!jornada?.inicio_real) return 0;
  const ini = new Date(jornada.inicio_real).getTime();
  const fim = Date.now();
  return Math.floor((fim - ini) / 1000);
};

// ── Heartbeat: GPS a cada 2min + BG Sync + WakeLock (Sessão 4)
const _heartbeatTimer = (() => {
  const INTERVAL_MS = 2 * 60 * 1000;
  const SYNC_TAG    = 'jet-heartbeat';
  let _interval = null, _wakeLock = null, _jornadaId = null;

  function _salvarEstadoSW(jornadaId) {
    const g = state.get('gps') || {};
    const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!sw) return;
    sw.postMessage({ type: 'SALVAR_HEARTBEAT_STATE', payload: {
      token: state.get('token'),
      gasUrl: (window.APP_CONFIG && window.APP_CONFIG.API_URL) + '/app/event',
      jornada_id: jornadaId, lat: g.lat||null, lng: g.lng||null,
      accuracy: g.accuracy||null, is_mock: g.isMock||false,
    }});
  }

  function _limparEstadoSW() {
    const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (sw) sw.postMessage({ type: 'SALVAR_HEARTBEAT_STATE', payload: null });
  }

  async function _ping(jornadaId) {
    let g = state.get('gps') || {};
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 })
      );
      g = { ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, isMock: false };
      state.patch('gps', g);
    } catch(_) {}
    _salvarEstadoSW(jornadaId);
    try {
      await api.post({ evento: 'HEARTBEAT', jornada_id: jornadaId,
        lat: g.lat||null, lng: g.lng||null, accuracy: g.accuracy||null,
        is_mock: g.isMock||false, horario_dispositivo: new Date().toISOString() });
    } catch(_) {}
  }

  async function _adquirirWakeLock() {
    if (!navigator.wakeLock) return;
    try { _wakeLock = await navigator.wakeLock.request('screen');
      _wakeLock.addEventListener('release', () => { _wakeLock = null; }); } catch(_) {}
  }

  function _liberarWakeLock() {
    if (_wakeLock) { _wakeLock.release().catch(()=>{}); _wakeLock = null; }
  }

  async function _registrarBGSync() {
    const reg = window.__swReg;
    if (reg && 'sync' in reg) { try { await reg.sync.register(SYNC_TAG); } catch(_) {} }
  }

  function _onVisibility() {
    if (document.hidden) {
      clearInterval(_interval); _interval = null;
      _liberarWakeLock(); _registrarBGSync();
    } else { _iniciarTimer(_jornadaId); _adquirirWakeLock(); }
  }

  function _iniciarTimer(jornadaId) {
    if (_interval) return;
    _ping(jornadaId);
    _interval = setInterval(() => _ping(jornadaId), INTERVAL_MS);
  }

  function iniciar(jornadaId) {
    if (_jornadaId) return;
    _jornadaId = jornadaId;
    _salvarEstadoSW(jornadaId);
    _iniciarTimer(jornadaId);
    _adquirirWakeLock();
    document.addEventListener('visibilitychange', _onVisibility);
  }

  function parar() {
    if (_interval) { clearInterval(_interval); _interval = null; }
    _liberarWakeLock(); _limparEstadoSW();
    document.removeEventListener('visibilitychange', _onVisibility);
    _jornadaId = null;
  }

  return { iniciar, parar };
})();
