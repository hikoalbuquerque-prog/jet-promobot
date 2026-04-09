// ─── turnoclt.js ──────────────────────────────────────────────────────────────
// Tela de turno ativo CLT: checkin → em andamento → checkout

const turnoCLT = {
  _timer: null,
  _watchId: null,
  _streamCheckin: null,
  _fotoCheckin: null,
  _streamInfra: null,
  _fotoInfra: null,

  async render() {
    const p = state.get('promotor');
    if (!p) return router.go('splash');

    // Buscar turno ativo do dia
    document.getElementById('app').innerHTML = _renderLoading();

    try {
      const res = await api.get('GET_MEUS_TURNOS_CLT');
      const turnos = res.data || [];
      const d = new Date();
      const hoje = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
      
      const ativo = turnos.find(t =>
        String(t.data).substring(0,10) === hoje &&
        ['PLANEJADO','ESCALADO','CONFIRMADO','EM_ANDAMENTO','PAUSADO'].includes(t.status)
      );

      if (!ativo) {
        document.getElementById('app').innerHTML = _renderSemTurno();
        return;
      }

      state.set('turno_clt_ativo', ativo);

      if (ativo.status === 'EM_ANDAMENTO') {
        this._renderAtivo(ativo);
      } else if (ativo.status === 'PAUSADO') {
        this._renderPausado(ativo);
      } else {
        this._renderCheckin(ativo);
      }
    } catch(e) {
      document.getElementById('app').innerHTML = _renderErro(e.message);
    }
  },

  _renderPausado(turno) {
    const isFiscal = ((state.get('promotor') || {}).cargo_principal || '').toUpperCase() === 'FISCAL';
    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
        ${_navHeader(isFiscal ? 'Turno Fiscal' : 'Turno em Andamento')}
        <div style="padding:16px;display:flex;flex-direction:column;gap:14px">
          <div style="background:#1e2a45;border:1px solid #f1c40f44;border-left:4px solid #f1c40f;border-radius:14px;padding:18px;text-align:center">
            <div style="font-size:11px;color:#f1c40f;font-weight:700;letter-spacing:1px;margin-bottom:8px">TURNO PAUSADO</div>
            <div style="font-size:15px;color:#a0aec0;margin-bottom:4px">${turno.zona_nome || ''}</div>
            <div style="font-size:13px;color:#718096">Horario: ${_fh(turno.inicio)} - ${_fh(turno.fim)}</div>
          </div>
          <button onclick="turnoCLT._retomar('${turno.turno_id}')" id="btn-retomar-clt"
            style="background:#2ecc71;color:#fff;border:none;border-radius:12px;font-size:17px;font-weight:700;padding:20px;width:100%;cursor:pointer">
            ▶️ RETOMAR TURNO
          </button>
          <button onclick="turnoCLT._fazerCheckout('${turno.turno_id}')"
            style="background:#e74c3c;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;padding:14px;width:100%;cursor:pointer">
            🏁 Encerrar Turno
          </button>
        </div>
        ${_navBottom('turno-ativo')}
      </div>`;
  },

  async _retomar(turnoId) {
    const btn = document.getElementById('btn-retomar-clt');
    if (btn) { btn.disabled = true; btn.textContent = 'Retomando...'; }
    try {
      const res = await api.post({ evento: 'RETOMAR_TURNO_CLT', turno_id: turnoId });
      if (res.ok) { ui.toast('Turno retomado!', 'success'); this.render(); }
      else { ui.toast(res.erro || 'Erro ao retomar.', 'error'); if (btn) { btn.disabled = false; btn.textContent = '▶️ RETOMAR TURNO'; } }
    } catch(e) { ui.toast('Sem conexao.', 'error'); if (btn) { btn.disabled = false; btn.textContent = '▶️ RETOMAR TURNO'; } }
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

          <div id="checkin-camera-container" style="display:none;background:#0d1526;border-radius:14px;overflow:hidden;border:1px solid #2a3a55;position:relative;aspect-ratio:4/3">
            <video id="video-checkin" autoplay playsinline style="width:100%;height:100%;object-fit:cover"></video>
            <canvas id="canvas-checkin" style="display:none"></canvas>
            <div id="foto-preview-checkin" style="display:none;position:absolute;inset:0;background-size:cover;background-position:center"></div>
            <button onclick="turnoCLT._tirarFotoCheckin()" style="position:absolute;bottom:20px;left:50%;transform:translateX(-50%);width:64px;height:64px;border-radius:50%;border:4px solid #fff;background:rgba(255,255,255,0.3);cursor:pointer;z-index:10"></button>
          </div>

          <div id="gps-status-clt" style="background:#1e2a45;border:1px solid #2a3a55;border-radius:10px;padding:12px;display:flex;align-items:center;gap:10px">
            <div style="width:10px;height:10px;border-radius:50%;background:#f1c40f;animation:pulse 1.5s infinite"></div>
            <span style="font-size:13px;color:#a0aec0">Obtendo GPS...</span>
          </div>

          <button id="btn-checkin-clt" onclick="turnoCLT._fazerCheckin('${turno.turno_id}')"
            style="background:#2ecc71;color:#fff;border:none;border-radius:12px;font-size:17px;font-weight:700;padding:18px;width:100%;cursor:pointer;">
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
    
    // Abrir câmera automaticamente se for Fiscal
    const u = state.get('promotor');
    if (u && (u.cargo_principal||'').toUpperCase() === 'FISCAL') {
      this._abrirCameraCheckin();
    }
  },

  async _abrirCameraCheckin() {
    const container = document.getElementById('checkin-camera-container');
    const video = document.getElementById('video-checkin');
    if (!container || !video) return;
    container.style.display = 'block';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      video.srcObject = stream;
      this._streamCheckin = stream;
    } catch(e) {
      ui.toast('Erro ao abrir câmera. Verifique permissões.', 'error');
    }
  },

  _tirarFotoCheckin() {
    const video = document.getElementById('video-checkin');
    const canvas = document.getElementById('canvas-checkin');
    const preview = document.getElementById('foto-preview-checkin');
    if (!video || !canvas || !preview) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    const base64 = canvas.toDataURL('image/jpeg', 0.7);
    this._fotoCheckin = base64;

    preview.style.backgroundImage = `url(${base64})`;
    preview.style.display = 'block';
    video.style.display = 'none';
    
    if (this._streamCheckin) {
      this._streamCheckin.getTracks().forEach(t => t.stop());
    }
  },

  async _fazerCheckin(turnoId) {
    const btn = document.getElementById('btn-checkin-clt');
    const g = state.get('gps_clt') || {};
    const u = state.get('promotor') || {};
    const isFiscal = (u.cargo_principal||'').toUpperCase() === 'FISCAL';
    
    if (isFiscal && !this._fotoCheckin) {
      ui.toast('Foto obrigatória para o Fiscal!', 'error');
      return;
    }

    if (btn) { btn.textContent = 'Processando...'; btn.disabled = true; }

    try {
      const payload = {
        evento: 'CHECKIN_TURNO_CLT',
        turno_id: turnoId,
        lat: g.lat || null,
        lng: g.lng || null,
        accuracy: g.accuracy || null,
        foto_base64: this._fotoCheckin || null
      };

      const res = await api.post(payload);

      if (res.ok) {
        ui.toast('✅ Check-in realizado!', 'success');
        this.render();
      } else {
        alert('Erro: ' + (res.erro || res.mensagem));
        if (btn) { btn.textContent = '✅ Registrar Check-in'; btn.disabled = false; }
        if (isFiscal) this._abrirCameraCheckin();
      }
    } catch(e) {
      ui.toast('Erro de conexão.', 'error');
      if (btn) { btn.textContent = '✅ Registrar Check-in'; btn.disabled = false; }
    }
  },

  _renderAtivo(turno) {
    const p = state.get('promotor');
    const isFiscal = (p.cargo_principal || '').toUpperCase() === 'FISCAL';
    const checkinHora = turno.checkin_hora
      ? new Date(turno.checkin_hora).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
      : '—';

    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
        ${_navHeader(isFiscal ? 'Turno Fiscal' : 'Turno em Andamento')}
        <div style="padding:16px;display:flex;flex-direction:column;gap:14px">

          <div style="background:#1e2a45;border:1px solid #2ecc7144;border-left:4px solid #2ecc71;border-radius:14px;padding:18px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
              <div>
                <div style="font-size:11px;color:#2ecc71;font-weight:700;letter-spacing:1px;margin-bottom:4px">EM ANDAMENTO</div>
                <div style="font-size:22px;font-weight:800;font-family:monospace;color:#2ecc71" id="clt-timer">00:00:00</div>
              </div>
              ${isFiscal ? `
              <div style="text-align:right">
                <div style="display:flex;gap:16px">
                <div style="text-align:center">
                  <div style="font-size:10px;color:#a0aec0;text-transform:uppercase">Ocorrências</div>
                  <div id="ft-meta-cont" style="font-size:18px;font-weight:800;color:#f1c40f">--/15</div>
                </div>
                <div style="text-align:center">
                  <div style="font-size:10px;color:#a0aec0;text-transform:uppercase">Organização</div>
                  <div id="ft-meta-org" style="font-size:18px;font-weight:800;color:#f1c40f">--/15</div>
                </div>
              </div>
              </div>` : ''}
            </div>
            <div style="font-size:13px;color:#a0aec0;margin-top:6px">Check-in às ${checkinHora}</div>
            <div style="margin-top:10px;font-size:14px;font-weight:600">${turno.zona_nome || '—'}</div>
            ${turno.ponto_referencia ? `<div style="font-size:13px;color:#a0aec0">${turno.ponto_referencia}</div>` : ''}
          </div>

          ${isFiscal ? `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <button onclick="turnoCLT._abrirModoFiscalizacao()" style="background:#4f8ef7;color:#fff;border:none;border-radius:12px;padding:16px;font-size:13px;font-weight:700;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px">
              <span style="font-size:24px">🚨</span> Infração
            </button>
            <button onclick="turnoCLT._acionarSOS()" style="background:#e74c3c;color:#fff;border:none;border-radius:12px;padding:16px;font-size:13px;font-weight:700;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px">
              <span style="font-size:24px">🆘</span> SOS
            </button>
            <button onclick="turnoCLT._abrirOrganizacaoPonto()" style="background:#68d39122;border:1px solid #68d39144;color:#68d391;border-radius:12px;padding:16px;font-size:13px;font-weight:700;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;grid-column:span 2">
              <span style="font-size:20px">🧹</span> Organização do Ponto (Antes / Depois)
            </button>
          </div>
          <div id="ft-roteiro" style="display:none">
            <div style="font-size:11px;color:#a0aec0;font-weight:700;letter-spacing:1px;margin-bottom:8px">📍 ROTEIRO DE FISCALIZAÇÃO</div>
            <div id="ft-roteiro-lista" style="display:flex;flex-direction:column;gap:10px"></div>
          </div>
          ` : `
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
          `}

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <button onclick="turnoCLT._pausar('${turno.turno_id}')" id="btn-pause-clt"
              style="background:#f1c40f22;border:1px solid #f1c40f44;color:#f1c40f;border-radius:12px;font-size:15px;font-weight:700;padding:14px;cursor:pointer">
              ⏸️ Pausar
            </button>
            <button onclick="turnoCLT._registrarChuva()"
              style="background:#63b3ed22;border:1px solid #63b3ed44;color:#63b3ed;border-radius:12px;font-size:15px;font-weight:700;padding:14px;cursor:pointer">
              🌧️ Chuva
            </button>
          </div>
          <button onclick="turnoCLT._abrirSolicitacao()" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#a0aec0;border-radius:12px;padding:14px;font-size:14px;font-weight:600;cursor:pointer">🔔 Suporte / Ocorrência</button>
          <button onclick="turnoCLT._fazerCheckout('${turno.turno_id}')" id="btn-checkout-clt"
            style="background:#e74c3c;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;padding:18px;width:100%;cursor:pointer;margin-top:10px">
            🏁 ENCERRAR TURNO
          </button>
        </div>
        ${_navBottom('turno-ativo')}
      </div>`;

    heartbeat.iniciar(turno.turno_id);
    if (isFiscal) {
      this._carregarRoteiro();
      this._atualizarMetas();
    }

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

  async _carregarRoteiro() {
    const rot = document.getElementById('ft-roteiro');
    const lista = document.getElementById('ft-roteiro-lista');
    if (!rot || !lista) return;
    try {
      const res = await api.get('GET_SLOTS_HOJE');
      const ativos = (res.data || res.slots || []).filter(s => s.vagas_ocupadas > 0);
      if (ativos.length > 0) {
        rot.style.display = 'block';
        lista.innerHTML = ativos.map(s => `
          <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:14px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:14px;font-weight:700;color:#fff">${s.nome||s.local_nome||'Ponto'}</div>
              <div style="font-size:11px;color:#a0aec0">${s.vagas_ocupadas} promotor(es) ativo(s)</div>
            </div>
            <button style="background:#4f8ef7;color:#fff;border:none;border-radius:8px;padding:8px 12px;font-size:11px;font-weight:700;cursor:pointer" onclick="router.go('mapa')">📍 MAPA</button>
          </div>
        `).join('');
      }
    } catch(e) {}
  },

  _acionarSOS() {
    if (confirm('🚨 ACIONAR BOTÃO DE PÂNICO?')) {
      const g = state.get('gps_clt') || {};
      api.post({ evento: 'REGISTRAR_SOS_FISCAL', lat: g.lat, lng: g.lng }).then(() => alert('🆘 SOS ACIONADO! SEGURANÇA NOTIFICADA.'));
    }
  },

  _abrirModoFiscalizacao() {
    const modal = document.createElement('div');
    modal.id = 'modal-modo-fiscalizacao';
    modal.style.cssText = 'position:fixed;inset:0;background:#0a0f1e;z-index:9999;display:flex;flex-direction:column;padding:20px;';
    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h2 style="font-size:18px;font-weight:700;margin:0;color:#fff">🚨 MODO FISCALIZAÇÃO</h2>
        <button onclick="document.getElementById('modal-modo-fiscalizacao').remove()" style="background:none;border:none;color:#718096;font-size:24px;cursor:pointer">×</button>
      </div>
      
      <div id="infra-camera-wrap" style="background:#000;border-radius:14px;overflow:hidden;margin-bottom:16px;aspect-ratio:4/3;position:relative">
         <video id="video-infra" autoplay playsinline style="width:100%;height:100%;object-fit:cover"></video>
         <canvas id="canvas-infra" style="display:none"></canvas>
         <div id="foto-preview-infra" style="display:none;position:absolute;inset:0;background-size:cover;background-position:center"></div>
         <button onclick="turnoCLT._tirarFotoInfra()" style="position:absolute;bottom:15px;left:50%;transform:translateX(-50%);width:50px;height:50px;border-radius:50%;border:3px solid #fff;background:rgba(255,255,255,0.2);z-index:10"></button>
      </div>

      <div style="background:#1e2a45;border-radius:12px;padding:12px;margin-bottom:16px">
        <div style="font-size:11px;color:#a0aec0;margin-bottom:6px">NÚMERO DO PATINETE (6 DÍGITOS)</div>
        <input type="tel" id="infra-patinete" placeholder="000000" maxlength="6"
          style="width:100%;background:#0d1526;border:1px solid #2a3a55;border-radius:8px;padding:12px;color:#fff;font-size:18px;font-weight:700;text-align:center;outline:none" />
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;flex:1;overflow-y:auto">
        <button onclick="turnoCLT._enviarInfracao('DUAS_PESSOAS')" class="btn-infra">👥 Duas pessoas no patinete</button>
        <button onclick="turnoCLT._enviarInfracao('MENOR_IDADE')" class="btn-infra">🔞 Menor de 18 anos</button>
        <button onclick="turnoCLT._enviarInfracao('ESTACIONAMENTO_IRREGULAR')" class="btn-infra">🅿️ Estacionamento irregular</button>
        <button onclick="turnoCLT._enviarInfracao('TRANSITO_PERIGOSO')" class="btn-infra">🚲 Condução perigosa</button>
        <button onclick="turnoCLT._enviarInfracao('DANO_INTENCIONAL')" class="btn-infra">🔨 Dano ao patrimônio</button>
      </div>
      <style>.btn-infra{background:#1e2a45;border:1px solid #2a3a55;color:#fff;border-radius:12px;padding:16px;font-size:13px;font-weight:700;text-align:left;cursor:pointer;}</style>
    `;
    document.body.appendChild(modal);
    this._abrirCameraInfra();
  },

  async _abrirCameraInfra() {
    const video = document.getElementById('video-infra');
    if (!video) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      video.srcObject = stream;
      this._streamInfra = stream;
    } catch(e) { ui.toast('Câmera não disponível.', 'error'); }
  },

  _tirarFotoInfra() {
    const video = document.getElementById('video-infra');
    const canvas = document.getElementById('canvas-infra');
    const preview = document.getElementById('foto-preview-infra');
    if (!video || !canvas || !preview) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.6);
    this._fotoInfra = base64;
    preview.style.backgroundImage = `url(${base64})`;
    preview.style.display = 'block';
    video.style.display = 'none';
    if (this._streamInfra) this._streamInfra.getTracks().forEach(t => t.stop());
  },

  async _enviarInfracao(tipo) {
    const patinete = (document.getElementById('infra-patinete')?.value || '').trim();
    if (patinete.length !== 6) { ui.toast('Informe o patinete (6 dígitos)!', 'error'); return; }
    if (!this._fotoInfra) { ui.toast('Tire uma foto da infração!', 'error'); return; }

    const g = state.get('gps_clt') || {};
    try {
      ui.toast('Registrando...', 'info');
      await api.post({ 
        evento: 'REGISTRAR_INFRACAO_FISCAL', 
        tipo_infracao: tipo, 
        lat: g.lat, 
        lng: g.lng,
        patinete_id: patinete,
        foto_base64: this._fotoInfra
      });
      ui.toast('✅ Infração registrada!', 'success');
      const m = document.getElementById('modal-modo-fiscalizacao');
      if (m) m.remove();
      this._fotoInfra = null;
    } catch(e) { ui.toast('Erro ao registrar.', 'error'); }
  },

  _abrirSolicitacao() {
    const m = prompt('Motivo do suporte / ocorrência:');
    if (m) api.post({ evento: 'REGISTRAR_SOLICITACAO_FISCAL', motivo: m }).then(() => ui.toast('✅ Enviado!', 'success'));
  },

  _registrarChuva() {
    const modal = document.createElement('div');
    modal.id = 'modal-chuva';
    modal.style.cssText = 'position:fixed;inset:0;background:#0a0f1eee;z-index:9999;display:flex;flex-direction:column;padding:20px;';
    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="font-size:17px;font-weight:700;color:#63b3ed;margin:0">🌧️ Registrar Chuva</h2>
        <button onclick="document.getElementById('modal-chuva').remove()" style="background:none;border:none;color:#718096;font-size:24px;cursor:pointer">×</button>
      </div>
      <div style="background:#1e2a45;border-radius:12px;overflow:hidden;margin-bottom:14px;aspect-ratio:4/3;position:relative">
        <video id="video-chuva" autoplay playsinline style="width:100%;height:100%;object-fit:cover"></video>
        <canvas id="canvas-chuva" style="display:none"></canvas>
        <div id="preview-chuva" style="display:none;position:absolute;inset:0;background-size:cover;background-position:center"></div>
        <button onclick="turnoCLT._tirarFotoChuva()" style="position:absolute;bottom:12px;left:50%;transform:translateX(-50%);width:46px;height:46px;border-radius:50%;border:3px solid #fff;background:rgba(255,255,255,.2);cursor:pointer;font-size:20px">📷</button>
      </div>
      <div style="background:#1e2a45;border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;color:#a0aec0" id="chuva-weather">
        📡 Obtendo condição climática...
      </div>
      <div id="chuva-error" style="display:none;color:#fc8181;font-size:12px;margin-bottom:10px"></div>
      <button onclick="turnoCLT._enviarChuva()" style="background:#63b3ed;color:#fff;border:none;border-radius:12px;padding:16px;font-size:15px;font-weight:700;cursor:pointer">
        ✅ CONFIRMAR REGISTRO DE CHUVA
      </button>`;
    document.body.appendChild(modal);
    // Abrir câmera
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(stream => { const v = document.getElementById('video-chuva'); if (v) { v.srcObject = stream; turnoCLT._streamChuva = stream; } })
      .catch(() => {});
    // Buscar clima
    const g = state.get('gps_clt') || {};
    if (g.lat && g.lng) {
      api.get('GET_CLIMA_LOCAL', { lat: g.lat, lng: g.lng })
        .then(res => {
          const el = document.getElementById('chuva-weather');
          if (el && res.ok) el.innerHTML = '🌡️ Temp: <strong>' + (res.temperatura || '--') + '°C</strong> &nbsp; 💧 Umidade: <strong>' + (res.umidade || '--') + '%</strong> &nbsp; ☁️ ' + (res.descricao || '');
        }).catch(() => {});
    }
  },

  _tirarFotoChuva() {
    const video = document.getElementById('video-chuva');
    const canvas = document.getElementById('canvas-chuva');
    const preview = document.getElementById('preview-chuva');
    if (!video || !canvas) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.6);
    turnoCLT._fotoChuva = base64;
    if (preview) { preview.style.backgroundImage = 'url(' + base64 + ')'; preview.style.display = 'block'; }
  },

  async _enviarChuva() {
    const g = state.get('gps_clt') || {};
    const payload = { evento: 'REGISTRAR_CHUVA_FISCAL', status: 'CHUVA', lat: g.lat, lng: g.lng };
    if (turnoCLT._fotoChuva) payload.foto_base64 = turnoCLT._fotoChuva;
    try {
      await api.post(payload);
      if (turnoCLT._streamChuva) turnoCLT._streamChuva.getTracks().forEach(t => t.stop());
      turnoCLT._fotoChuva = null;
      const m = document.getElementById('modal-chuva');
      if (m) m.remove();
      ui.toast('🌧️ Chuva registrada e equipe notificada!', 'success');
    } catch(e) {
      const el = document.getElementById('chuva-error');
      if (el) { el.textContent = 'Erro: ' + (e.message || 'sem conexão'); el.style.display = 'block'; }
    }
  },

  _iniciarGPS() {
    gps.iniciar();
    const unsub = gps.onChange(g => {
      const el = document.getElementById('gps-status-clt');
      if (g.ok) {
        if (el) el.innerHTML = `<div style="width:10px;height:10px;border-radius:50%;background:#2ecc71"></div><span style="font-size:13px;color:#2ecc71">GPS ativo · ±${Math.round(g.accuracy)}m</span>`;
        state.set('gps_clt', g);
      } else {
        if (el) el.innerHTML = `<div style="width:10px;height:10px;border-radius:50%;background:#f1c40f"></div><span style="font-size:13px;color:#f1c40f">GPS instável</span>`;
      }
    });
    state.set('_gpsUnsubCLT', unsub);
  },

  async _pausar(turnoId) {
    const btn = document.getElementById('btn-pause-clt');
    if (btn) { btn.disabled = true; btn.textContent = 'Pausando...'; }
    try {
      const res = await api.post({ evento: 'PAUSAR_TURNO_CLT', turno_id: turnoId });
      if (res.ok) { ui.toast('Turno pausado!', 'success'); this.render(); }
      else { ui.toast(res.erro || res.mensagem || 'Erro ao pausar.', 'error'); if (btn) { btn.disabled = false; btn.textContent = '⏸️ Pausar'; } }
    } catch(e) { ui.toast('Sem conexão ao pausar.', 'error'); if (btn) { btn.disabled = false; btn.textContent = '⏸️ Pausar'; } }
  },

  _abrirOrganizacaoPonto() {
    turnoCLT._fotoOrganizacaoAntes = null;
    turnoCLT._fotoOrganizacaoDepois = null;
    const modal = document.createElement('div');
    modal.id = 'modal-organizacao';
    modal.style.cssText = 'position:fixed;inset:0;background:#0a0f1eee;z-index:9999;overflow-y:auto;padding:20px;';
    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="font-size:17px;font-weight:700;color:#68d391;margin:0">🧹 Organização do Ponto</h2>
        <button onclick="document.getElementById('modal-organizacao').remove()" style="background:none;border:none;color:#718096;font-size:24px;cursor:pointer">×</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div>
          <div style="font-size:11px;color:#a0aec0;margin-bottom:6px;font-weight:700">📷 ANTES</div>
          <div style="background:#1e2a45;border-radius:10px;overflow:hidden;aspect-ratio:1;position:relative;cursor:pointer" onclick="turnoCLT._tirarFotoOrg('antes')">
            <div id="preview-org-antes" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#4a5568;font-size:30px">📷</div>
          </div>
        </div>
        <div>
          <div style="font-size:11px;color:#a0aec0;margin-bottom:6px;font-weight:700">✅ DEPOIS</div>
          <div style="background:#1e2a45;border-radius:10px;overflow:hidden;aspect-ratio:1;position:relative;cursor:pointer" onclick="turnoCLT._tirarFotoOrg('depois')">
            <div id="preview-org-depois" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#4a5568;font-size:30px">📷</div>
          </div>
        </div>
      </div>

      <textarea id="org-descricao" placeholder="Descrição (opcional)..."
        style="width:100%;background:#1e2a45;border:1px solid #2a3a55;border-radius:10px;padding:12px;color:#fff;font-size:13px;resize:none;height:80px;margin-bottom:12px"></textarea>

      <div id="org-error" style="display:none;color:#fc8181;font-size:12px;margin-bottom:10px"></div>
      <button onclick="turnoCLT._enviarOrganizacao()" style="width:100%;background:#68d391;color:#fff;border:none;border-radius:12px;padding:16px;font-size:15px;font-weight:700;cursor:pointer">
        ✅ REGISTRAR ORGANIZAÇÃO
      </button>

      <video id="video-org" autoplay playsinline style="display:none;width:100%;border-radius:10px;margin-top:10px;max-height:300px;object-fit:cover"></video>
      <canvas id="canvas-org" style="display:none"></canvas>
      <div id="org-fase" style="display:none;text-align:center;margin-top:8px;font-size:12px;color:#68d391"></div>
      <button id="btn-capturar-org" style="display:none;width:100%;margin-top:8px;background:#4f8ef7;color:#fff;border:none;border-radius:10px;padding:14px;font-weight:700;cursor:pointer" onclick="turnoCLT._capturarFotoOrg()">📷 Capturar</button>
    `;
    document.body.appendChild(modal);
  },

  async _tirarFotoOrg(fase) {
    const video = document.getElementById('video-org');
    const btn = document.getElementById('btn-capturar-org');
    const label = document.getElementById('org-fase');
    if (!video) return;
    try {
      if (turnoCLT._streamOrg) turnoCLT._streamOrg.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      turnoCLT._streamOrg = stream;
      turnoCLT._orgFaseAtual = fase;
      video.srcObject = stream;
      video.style.display = 'block';
      if (btn) btn.style.display = 'block';
      if (label) { label.textContent = fase === 'antes' ? '📷 Fotografando ANTES...' : '✅ Fotografando DEPOIS...'; label.style.display = 'block'; }
    } catch(e) { ui.toast('Câmera indisponível.', 'error'); }
  },

  _capturarFotoOrg() {
    const video = document.getElementById('video-org');
    const canvas = document.getElementById('canvas-org');
    if (!video || !canvas) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.6);
    const fase = turnoCLT._orgFaseAtual;
    if (fase === 'antes') {
      turnoCLT._fotoOrganizacaoAntes = base64;
      const p = document.getElementById('preview-org-antes');
      if (p) { p.style.backgroundImage = 'url(' + base64 + ')'; p.style.backgroundSize = 'cover'; p.style.backgroundPosition = 'center'; p.innerHTML = ''; }
    } else {
      turnoCLT._fotoOrganizacaoDepois = base64;
      const p = document.getElementById('preview-org-depois');
      if (p) { p.style.backgroundImage = 'url(' + base64 + ')'; p.style.backgroundSize = 'cover'; p.style.backgroundPosition = 'center'; p.innerHTML = ''; }
    }
    if (turnoCLT._streamOrg) { turnoCLT._streamOrg.getTracks().forEach(t => t.stop()); turnoCLT._streamOrg = null; }
    const video2 = document.getElementById('video-org');
    const btn = document.getElementById('btn-capturar-org');
    const label = document.getElementById('org-fase');
    if (video2) video2.style.display = 'none';
    if (btn) btn.style.display = 'none';
    if (label) label.style.display = 'none';
  },

  async _enviarOrganizacao() {
    if (!turnoCLT._fotoOrganizacaoAntes || !turnoCLT._fotoOrganizacaoDepois) {
      const el = document.getElementById('org-error');
      if (el) { el.textContent = 'Tire as fotos ANTES e DEPOIS para registrar.'; el.style.display = 'block'; }
      return;
    }
    const descEl = document.getElementById('org-descricao');
    const descricao = descEl ? descEl.value.trim() : '';
    const g = state.get('gps_clt') || {};
    try {
      const res = await api.post({
        evento: 'REGISTRAR_ORGANIZACAO_PONTO',
        foto_antes_base64: turnoCLT._fotoOrganizacaoAntes,
        foto_depois_base64: turnoCLT._fotoOrganizacaoDepois,
        descricao,
        lat: g.lat, lng: g.lng
      });
      if (res.ok) {
        if (turnoCLT._streamOrg) turnoCLT._streamOrg.getTracks().forEach(t => t.stop());
        const m = document.getElementById('modal-organizacao');
        if (m) m.remove();
        ui.toast('🧹 Organização registrada!', 'success');
        turnoCLT._atualizarMetas();
      }
    } catch(e) {
      const el = document.getElementById('org-error');
      if (el) { el.textContent = 'Erro: ' + (e.message || 'sem conexão'); el.style.display = 'block'; }
    }
  },

  async _atualizarMetas() {
    try {
      const res = await api.get('GET_METAS_FISCAL');
      if (!res.ok) return;
      const elOcr = document.getElementById('ft-meta-cont');
      if (elOcr) {
        elOcr.textContent = (res.metas.ocorrencias ? res.metas.ocorrencias.hoje : res.metas.hoje) + '/15';
        const v = res.metas.ocorrencias ? res.metas.ocorrencias.hoje : res.metas.hoje;
        elOcr.style.color = v >= 15 ? '#2ecc71' : '#f1c40f';
      }
      const elOrg = document.getElementById('ft-meta-org');
      if (elOrg && res.metas.organizacao) {
        elOrg.textContent = res.metas.organizacao.hoje + '/15';
        elOrg.style.color = res.metas.organizacao.hoje >= 15 ? '#2ecc71' : '#f1c40f';
      }
    } catch(e) {}
  },

  async _fazerCheckout(turnoId) {
    if (!confirm('Encerrar turno agora?')) return;
    try {
      ui.toast('Encerrando...', 'info');
      const res = await api.post({ evento: 'CHECKOUT_TURNO_CLT', turno_id: turnoId });
      if (res.ok) {
        clearInterval(this._timer);
        heartbeat.parar();
        
        // Mostrar Coach JET se houver mensagem
        if (res.msg_coach) {
          this._mostrarCoachJet(res.msg_coach);
        } else {
          this.render();
        }
      }
    } catch(e) { ui.toast('Erro ao encerrar', 'error'); }
  },

  _mostrarCoachJet(msg) {
    const modalId = 'modal-coach-jet';
    const m = document.createElement('div');
    m.id = modalId;
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:10000;display:flex;align-items:center;justify-content:center;padding:24px;';
    m.innerHTML = `
      <div style="background:#16213e;border:1px solid #4f8ef7;border-radius:24px;padding:30px;width:100%;max-width:400px;text-align:center;position:relative">
        <div style="font-size:48px;margin-bottom:20px">🤖</div>
        <h2 style="font-size:20px;font-weight:800;color:#fff;margin-bottom:16px;letter-spacing:1px">COACH JET</h2>
        <div style="font-size:15px;color:#a0aec0;line-height:1.6;margin-bottom:30px;font-style:italic">"${msg}"</div>
        <button onclick="document.getElementById('${modalId}').remove(); turnoCLT.render();" 
          style="background:#4f8ef7;color:#fff;border:none;border-radius:12px;padding:16px;width:100%;font-size:15px;font-weight:700;cursor:pointer">
          ENTENDIDO
        </button>
      </div>
    `;
    document.body.appendChild(m);
  },
};

function _navHeader(t) {
  return `<div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:50">
    <button onclick="router.go('home-clt')" style="background:#1e2a45;border:none;color:#eaf0fb;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer">‹</button>
    <div style="font-size:17px;font-weight:700;flex:1">${t}</div>
  </div>`;
}

function _navBottom(a) {
  const itens = [
    { id:'home-clt', icon:'🏠', label:'Home' },
    { id:'turno-ativo', icon:'⚡', label:'Turno' },
    { id:'historico-clt', icon:'📋', label:'Histórico' },
  ];
  return `<nav style="position:fixed;bottom:0;left:0;right:0;background:#16213e;border-top:1px solid #2a3a55;display:flex;justify-content:space-around;padding:10px 0 calc(10px + env(safe-area-inset-bottom,0px));z-index:100">
    ${itens.map(i => `<button onclick="router.go('${i.id}')" style="background:none;border:none;color:${i.id===a?'#4f8ef7':'#6c7a8d'};font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1"><span style="font-size:22px">${i.icon}</span>${i.label}</button>`).join('')}
  </nav>`;
}

function _fh(v) {
  if (!v) return '—';
  const s = String(v);
  if (/^\d{2}:\d{2}/.test(s)) return s.substring(0,5);
  try { return new Date(v).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); } catch(_) { return '—'; }
}

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

function _renderErro(m) {
  return `<div style="min-height:100dvh;background:#1a1a2e;display:flex;align-items:center;justify-content:center;color:#e74c3c;padding:20px;text-align:center">${m}</div>`;
}
