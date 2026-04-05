const express = require('express');
const path = require('path');

const app = express();

// ── PWA e Painel Gestor: registrar ANTES de qualquer configuração de runtime ──
// Isso garante que os frontends funcionam mesmo se loadConfig() falhar.

// Painel do gestor
app.use('/gestor', express.static(path.join(__dirname, 'public-gestor')));
app.get('/gestor', (_req, res) => res.sendFile(path.join(__dirname, 'public-gestor', 'index.html')));
app.get('/gestor/*', (_req, res) => res.sendFile(path.join(__dirname, 'public-gestor', 'index.html')));

// PWA do promotor
// Manifest e SW nunca em cache — essencial para PWA instalável
app.get('/manifest.json', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});
app.get('/sw.js', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/version', (_req, res) => res.json({ ok: true, service: 'promo-telegram-gateway', version: '1.3.5', now: new Date().toISOString() }));
// ─────────────────────────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(corsMiddleware);

const webpush = require('web-push');

const CFG = loadConfig();

// ── Web Push Configuration ──────────────────────────────────────────────────
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BCyAa3hD-bzlH4gr3iYvr7fSOXU0MTU6kKMRGiBaW-kBN5vGbbAxloNDjnGWit-G31tpf-wHkmSqMaWYVWs9QNc',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'M4p9PZSjabld-fXWCs-Xlgccg40wu9GcS_XVolFSw7w'
};

webpush.setVapidDetails(
  'mailto:contato@jetpromo.com.br',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Salvar assinatura do navegador
app.post('/app/push-subscribe', async (req, res) => {
  try {
    const { subscription, user_id } = req.body;
    if (!subscription || !user_id) return res.status(400).json({ ok: false, erro: 'Dados incompletos.' });
    
    // Repassa para o Apps Script salvar na planilha
    const result = await callAppsScriptPost({
      evento: 'REGISTRAR_PUSH_TOKEN',
      user_id,
      subscription_json: JSON.stringify(subscription)
    });
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// Enviar notificação push (chamado internamente ou via Apps Script)
app.post('/internal/send-push', requireAdminSecret, async (req, res) => {
  try {
    const { subscription_json, title, body, icon, url } = req.body;
    const subscription = JSON.parse(subscription_json);
    
    const payload = JSON.stringify({
      title: title || 'JET Ops',
      body: body || '',
      icon: icon || '/assets/icons/icon-192x192.png',
      data: { url: url || '/' }
    });

    await webpush.sendNotification(subscription, payload);
    res.json({ ok: true });
  } catch (err) {
    console.error('[PUSH ERROR]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────

// ── Cache de Performance ─────────────────────────────────────────────────────
let GLOBAL_CACHE = {
  timestamp: 0,
  promotores: [],
  jornadas: [],
  slots: [], // Este substituirá o SLOTS_CACHE gradualmente
  turnos_clt: [],
  fsm_transicoes: []
};

let SLOTS_CACHE = {
  timestamp: 0,
  slots: []
};

let ACADEMY_CACHE = {
  timestamp: 0,
  modulos: [],
  quizzes: {}
};

let GROUPS_CACHE = {
  timestamp: 0,
  data: [] // [{ cidade, operacao, topico_key, chat_id, topic_id }]
};

app.post('/internal/sync-all', requireAdminSecret, (req, res) => {
  const { promotores, slots, jornadas, turnos_clt, fsm_transicoes } = req.body || {};
  GLOBAL_CACHE = {
    timestamp: Date.now(),
    promotores: Array.isArray(promotores) ? promotores : GLOBAL_CACHE.promotores,
    slots: Array.isArray(slots) ? slots : GLOBAL_CACHE.slots,
    jornadas: Array.isArray(jornadas) ? jornadas : GLOBAL_CACHE.jornadas,
    turnos_clt: Array.isArray(turnos_clt) ? turnos_clt : GLOBAL_CACHE.turnos_clt,
    fsm_transicoes: Array.isArray(fsm_transicoes) ? fsm_transicoes : GLOBAL_CACHE.fsm_transicoes
  };
  SLOTS_CACHE = { timestamp: Date.now(), slots: GLOBAL_CACHE.slots }; // Backward compatibility
  console.log(`[CACHE GLOBAL] Atualizado. Promotores: ${GLOBAL_CACHE.promotores.length}, Slots: ${GLOBAL_CACHE.slots.length}, Jornadas: ${GLOBAL_CACHE.jornadas.length}`);
  res.json({ ok: true });
});

app.post('/internal/sync-slots', requireAdminSecret, (req, res) => {
  const { slots } = req.body || {};
  if (!Array.isArray(slots)) return res.status(400).json({ ok: false, erro: 'Array de slots obrigatório' });
  SLOTS_CACHE = { timestamp: Date.now(), slots };
  console.log(`[CACHE] Sincronizados ${slots.length} slots.`);
  res.json({ ok: true, count: slots.length });
});

app.post('/internal/sync-academy', requireAdminSecret, (req, res) => {
  const { modulos, quizzes } = req.body || {};
  if (!Array.isArray(modulos)) return res.status(400).json({ ok: false, erro: 'Array de modulos obrigatório' });
  console.log(`[CACHE] Syncing Academy: ${modulos.length} modules, ${Object.keys(quizzes || {}).length} quizzes.`);
  ACADEMY_CACHE = {
    timestamp: Date.now(),
    modulos: modulos,
    quizzes: quizzes || {}
  };
  res.json({ ok: true });
});

app.get('/internal/get-academy-cache', requireAdminSecret, (req, res) => {
  res.json({ ok: true, modulos: ACADEMY_CACHE.modulos, quizzes: ACADEMY_CACHE.quizzes });
});

app.post('/internal/sync-groups', requireAdminSecret, (req, res) => {
  const { grupos } = req.body || {};
  if (!Array.isArray(grupos)) return res.status(400).json({ ok: false, erro: 'Array de grupos obrigatório' });
  GROUPS_CACHE = {
    timestamp: Date.now(),
    data: grupos
  };
  console.log(`[CACHE] Grupos de Telegram sincronizados: ${grupos.length} regras.`);
  res.json({ ok: true });
});
// ─────────────────────────────────────────────────────────────────────────────

app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

app.get('/ready', (_req, res) => {
  res.json({ ok: true, ready: true, service: 'promo-telegram-gateway', version: '1.0.0' });
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'promo-telegram-gateway', version: '1.0.0', now: new Date().toISOString() });
});

app.get('/app/query', async (req, res) => {
  try {
    const evento = String(req.query.evento || req.query.action || '').trim();
    if (!evento) return res.status(400).json({ ok: false, mensagem: 'evento obrigatório.' });

    // ── Cache Global Interception ──
    if (GLOBAL_CACHE.timestamp > 0 && (Date.now() - GLOBAL_CACHE.timestamp < 300000)) {
      const token = req.query.token;
      
      // Validação básica do token no cache
      let user = null;
      if (token && GLOBAL_CACHE.promotores) {
        user = GLOBAL_CACHE.promotores.find(p => p.token === token && String(p.ativo).toUpperCase() === 'SIM');
      }

      if (evento === 'GET_ME' && user) {
        // Remover campos sensíveis
        const u = { ...user }; delete u.token; delete u.senha_hash;
        return res.json({ ok: true, user: u, _cache: true });
      }

      if (evento === 'GET_SLOT_ATUAL' && user) {
        const jornada = GLOBAL_CACHE.jornadas.find(j => j.user_id === user.user_id && ['ACEITO', 'EM_ATIVIDADE', 'PAUSADO', 'AGUARDANDO_RASTREIO', 'EM_TURNO', 'SEM_SINAL', 'MAPEAMENTO_INTERROMPIDO'].includes(String(j.status).toUpperCase()));
        if (jornada) {
          const slot = GLOBAL_CACHE.slots.find(s => s.slot_id === jornada.slot_id);
          return res.json({ ok: true, jornada, slot, jornadas: [{ jornada, slot }], _cache: true });
        } else {
          return res.json({ ok: true, jornada: null, slot: null, jornadas: [], _cache: true });
        }
      }

      if (evento === 'GET_PROMOTORES_ATIVOS' && GLOBAL_CACHE.promotores && GLOBAL_CACHE.promotores.length > 0) {
        return res.json({ ok: true, promotores: GLOBAL_CACHE.promotores.filter(p => String(p.ativo).toUpperCase() === 'SIM').map(p => { const u={...p}; delete u.token; delete u.senha_hash; return u; }), _cache: true });
      }
    }

    // Se for listagem de slots e tivermos cache recente (menos de 5 min)
    if (evento === 'GET_SLOTS_DISPONIVEIS' && SLOTS_CACHE.slots.length > 0 && (Date.now() - SLOTS_CACHE.timestamp < 300000)) {
      console.log('[CACHE] Servindo slots via memória.');
      return res.json({ ok: true, slots: SLOTS_CACHE.slots, _cache: true });
    }

    if (evento === 'GET_ACADEMY_TRILHA') {
      if (ACADEMY_CACHE.modulos.length > 0) {
        console.log('[CACHE] Servindo trilha Academy via memória.');
        const result = await callAppsScriptGet(evento, req.query);
        if (result.ok) {
          const concluidos = new Set(result.progresso_ids || []);
          const ordemNiveis = ['MANUAL APP', 'BASICO', 'INTERMEDIARIO', 'AVANCADO', 'ESPECIALISTA', 'MASTER'];

          const modulosOrdenados = [...ACADEMY_CACHE.modulos].sort((a, b) => {
            const na = ordemNiveis.indexOf(a.nivel), nb = ordemNiveis.indexOf(b.nivel);
            if (na !== nb) return na - nb;
            return parseInt(a.ordem || 0) - parseInt(b.ordem || 0);
          });

          result.modulos = modulosOrdenados.map((m, idx) => {
            const isConcluido = concluidos.has(m.modulo_id);
            let isDesbloqueado = false;
            if (idx === 0) isDesbloqueado = true;
            else {
              const reqs = m.pre_requisitos_json ? JSON.parse(m.pre_requisitos_json) : {};
              if (reqs.must_complete_modulos && reqs.must_complete_modulos.length) {
                isDesbloqueado = reqs.must_complete_modulos.every(id => concluidos.has(id));
              } else {
                isDesbloqueado = concluidos.has(modulosOrdenados[idx - 1].modulo_id);
              }
            }
            return {
              modulo_id: m.modulo_id,
              nivel: m.nivel,
              titulo: m.titulo,
              pontos: m.pontos,
              concluido: isConcluido,
              desbloqueado: isDesbloqueado
            };
          });
          return res.json(result);
        }
      }
      // Se não tem cache, deixa passar para o GAS que agora retorna a lista básica
    }
    if (evento === 'GET_ACADEMY_MODULO' && req.query.modulo_id && ACADEMY_CACHE.modulos.length > 0) {
      const mod = ACADEMY_CACHE.modulos.find(m => m.modulo_id === req.query.modulo_id);
      if (mod) {
        console.log('[CACHE] Servindo módulo Academy via memória.');
        // Filtrar apenas quizzes deste módulo
        const quizzesModulo = {};
        const qids = (mod.blocks || []).filter(b => b.type === 'quiz').map(b => b.quiz_id);
        qids.forEach(qid => {
          if (ACADEMY_CACHE.quizzes[qid]) quizzesModulo[qid] = ACADEMY_CACHE.quizzes[qid];
        });
        return res.json({ ok: true, modulo: { ...mod, quizzes: quizzesModulo } });
      }
    }

    const result = await callAppsScriptGet(evento, req.query);
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    console.error('[GET /app/query]', err);
    res.status(500).json({ ok: false, mensagem: 'Erro interno no Cloud Run.' });
  }
});

app.post('/app/event', async (req, res) => {
  try {
    const body = req.body || {};
    const evento = String(body.evento || body.action || '').trim();
    if (!evento) return res.status(400).json({ ok: false, mensagem: 'evento obrigatório.' });
    const result = await callAppsScriptPost({ ...body, evento });
    if (result.ok) {
      await processIntegracoes(result.integracoes, { evento, result });
      if (evento === 'ACEITAR_SLOT') {
        await reconcileAcceptedSlotMessage(result, null);
        // Invalida cache local para forçar refresh na próxima consulta
        SLOTS_CACHE.timestamp = 0;
      }
    }
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    console.error('[POST /app/event]', err);
    res.status(500).json({ ok: false, mensagem: 'Erro interno no Cloud Run.' });
  }
});

app.post('/internal/publish-available-slots', requireAdminSecret, async (req, res) => {
  try {
    const requestedCity = req.body && req.body.cidade ? String(req.body.cidade) : '';
    const maxSlots = Number(req.body && req.body.limit ? req.body.limit : CFG.publishMaxSlots);
    const cities = requestedCity ? [requestedCity] : Object.values(CFG.cityGroups).map((g) => g.name);
    const summary = [];
    for (const city of cities) {
      const payload = await callAppsScriptPost({
        evento: 'INTERNAL_LISTAR_SLOTS_DISPONIVEIS',
        integration_secret: CFG.appsScriptSharedSecret,
        cidade: city,
        limit: maxSlots,
      });
      const slots = payload?.dados?.slots || [];
      let published = 0;
      for (const slot of slots) {
        const sent = await publishAvailableSlot(slot);
        if (sent.ok) published += 1;
      }
      summary.push({ cidade: city, encontrados: slots.length, publicados: published });
    }
    res.json({ ok: true, mensagem: 'Publicação concluída.', dados: summary });
  } catch (err) {
    console.error('[POST /internal/publish-available-slots]', err);
    res.status(500).json({ ok: false, mensagem: 'Erro ao publicar slots disponíveis.' });
  }
});

// ── Envia mensagem para grupo por cidade ─────────────────────────────────────
app.post('/internal/send-group-message', async (req, res) => {
  try {
    const { integration_secret, cidade, topic_key, text_html } = req.body || {};
    if (integration_secret !== CFG.appsScriptSharedSecret) return res.status(401).json({ ok: false });
    const grupo = resolveCityGroup(cidade);
    if (!grupo?.chatId) return res.json({ ok: false, erro: 'grupo não configurado' });
    const tid = topicId(grupo, topic_key);
    await telegramApi('sendMessage', {
      chat_id: grupo.chatId,
      text: text_html,
      parse_mode: 'HTML',
      ...(tid ? { message_thread_id: tid } : {})
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ── Checkin reminder: notifica promotor no horário do slot ──────────────────
app.post('/internal/send-checkin-reminder', async (req, res) => {
  try {
    const { integration_secret, telegram_user_id, confirmacao_id, slot_id, local_nome, inicio, tipo } = req.body || {};
    if (integration_secret !== CFG.appsScriptSharedSecret) return res.status(401).json({ ok: false });
    if (!telegram_user_id) return res.json({ ok: false, erro: 'telegram_user_id obrigatório' });

    const isLembrete = tipo === 'LEMBRETE_10MIN';
    const isAutoEncerrado = tipo === 'AUTO_ENCERRADO';

    let texto = `🔔 <b>Hora do seu slot!</b>\n\n📍 <b>${local_nome || slot_id}</b>\n🕐 ${inicio || '—'}\n\nAbra o app para fazer o check-in.`;
    let botoes = [[{ text: '📲 Abrir app para check-in', url: CFG.appUrl }]];

    if (isLembrete) {
      texto = `⚠️ <b>Você ainda não fez check-in!</b>\n\n📍 ${local_nome || slot_id}\n🕐 ${inicio || '—'}\n\nO que deseja fazer?`;
      botoes = [
        [
          { text: '📲 Vou fazer check-in agora', callback_data: 'CHECKIN_APP:' + (confirmacao_id||slot_id) },
          { text: '🚗 Estou a caminho', callback_data: 'CHECKIN_CAMINHO:' + (confirmacao_id||slot_id) }
        ],
        [
          { text: '❌ Cancelar slot (penalidade)', callback_data: 'CHECKIN_CANCELAR:' + (confirmacao_id||slot_id) }
        ]
      ];
    } else if (isAutoEncerrado) {
      texto = `🏁 <b>Jornada Encerrada Automaticamente</b>\n\n📍 ${local_nome || slot_id}\n\nSua jornada foi encerrada pelo sistema por ausência de checkout após o horário previsto.`;
      botoes = [[{ text: '📊 Ver meu histórico', url: CFG.appUrl }]];
    }

    await telegramApi('sendMessage', {
      chat_id: telegram_user_id,
      text: texto,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: botoes }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[checkin-reminder]', err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ── Jornada status: msg de controle (checkin/pausa/checkout) ────────────────
app.post('/internal/send-jornada-status', async (req, res) => {
  try {
    const { integration_secret, telegram_user_id, slot_id, jornada_id, local_nome, inicio, fim, tipo } = req.body || {};
    if (integration_secret !== CFG.appsScriptSharedSecret) return res.status(401).json({ ok: false });
    if (!telegram_user_id) return res.json({ ok: false, erro: 'telegram_user_id obrigatório' });

    const ref = slot_id + ':' + jornada_id;

    let texto, botoes;
    if (tipo === 'CHECKIN') {
      texto = `🟡 <b>Hora do seu slot!</b>\n\n📍 <b>${local_nome}</b>\n🕐 ${inicio} – ${fim}\n\nCompartilhe sua localização para fazer check-in:`;
      botoes = [[
        { text: '📍 Compartilhar localização', request_location: true }
      ], [
        { text: '🌐 Abrir app', url: CFG.appUrl }
      ]];
      // Salva estado para processar a localização quando o usuário enviar
      await botSetSessionCloudRun(telegram_user_id, 'AWAITING_CHECKIN_LOCATION', { slot_id, jornada_id, user_id: req.body.user_id });
    } else if (tipo === 'EM_ATIVIDADE') {
      texto = `✅ <b>Você está em atividade!</b>\n\n📍 ${local_nome}\n🕐 ${inicio} – ${fim}\n\nO que deseja fazer?`;
      botoes = [[
        { text: '⏸️ Pausar jornada', callback_data: 'JORNADA_PAUSAR:' + ref },
        { text: '🏁 Encerrar agora', callback_data: 'JORNADA_CHECKOUT:' + ref }
      ]];
    } else if (tipo === 'PAUSADO') {
      texto = `⏸️ <b>Jornada pausada</b>\n\n📍 ${local_nome}\n\nRetornar quando estiver pronto:`;
      botoes = [[{ text: '▶️ Retomar jornada', callback_data: 'JORNADA_RETOMAR:' + ref }]];
    }

    await telegramApi('sendMessage', {
      chat_id: telegram_user_id,
      text: texto,
      parse_mode: 'HTML',
      reply_markup: tipo === 'CHECKIN'
        ? { keyboard: botoes, resize_keyboard: true, one_time_keyboard: true }
        : { inline_keyboard: botoes }
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[send-jornada-status]', err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ── Página pública de indicação ─────────────────────────────────────────────
app.get('/indicacao', (req, res) => {
  const ref = req.query.ref || '';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>JET Promo — Seja um Promotor</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;background:#0a0f1e;color:#eaf0fb;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#16213e;border:1px solid #2a3a55;border-radius:20px;padding:28px 24px;max-width:420px;width:100%}
.logo{text-align:center;font-size:32px;margin-bottom:8px}
h1{text-align:center;font-size:20px;font-weight:800;margin-bottom:6px}
.sub{text-align:center;font-size:13px;color:#a0aec0;margin-bottom:24px}
label{font-size:12px;font-weight:700;color:#a0aec0;letter-spacing:1px;display:block;margin-bottom:6px;margin-top:14px}
input{width:100%;background:#1e2a45;border:1px solid #2a3a55;border-radius:10px;color:#eaf0fb;font-size:15px;padding:12px 14px;outline:none}
input:focus{border-color:#4f8ef7}
.btn{width:100%;margin-top:24px;background:linear-gradient(135deg,#4f8ef7,#2b6cb0);border:none;border-radius:12px;color:#fff;font-size:16px;font-weight:700;padding:14px;cursor:pointer}
.success{display:none;text-align:center;padding:20px}
.success .icon{font-size:48px;margin-bottom:12px}
.err{color:#fc8181;font-size:13px;margin-top:8px;display:none}
</style>
</head>
<body>
<div class="card">
  <div id="form-area">
    <div class="logo">📍</div>
    <h1>Seja um Promotor JET</h1>
    <p class="sub">Preencha seus dados e entraremos em contato!</p>
    <label>NOME COMPLETO</label>
    <input id="nome" type="text" placeholder="Seu nome completo" autocomplete="name">
    <label>CPF</label>
    <input id="cpf" type="text" placeholder="000.000.000-00" maxlength="14" oninput="fmtCpf(this)">
    <label>TELEFONE</label>
    <input id="tel" type="tel" placeholder="(11) 99999-9999" maxlength="15" oninput="fmtTel(this)">
    <label>CIDADE</label>
    <input id="cidade" type="text" placeholder="Sua cidade (ex: Sao Paulo)">
    <label>E-MAIL</label>
    <input id="email" type="email" placeholder="seu@email.com">
    <div class="err" id="err">Preencha todos os campos corretamente.</div>
    <button class="btn" onclick="enviar()">Quero ser Promotor ✨</button>
  </div>
  <div class="success" id="success">
    <div class="icon">🎉</div>
    <h1>Cadastro enviado!</h1>
    <p style="color:#a0aec0;font-size:14px;margin-top:8px">Em breve nossa equipe entrará em contato. Obrigado!</p>
  </div>
</div>
<script>
var REF = '${ref}';
function fmtCpf(el){var v=el.value.replace(/\D/g,'');if(v.length>9)v=v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/,'$1.$2.$3-$4');else if(v.length>6)v=v.replace(/(\d{3})(\d{3})(\d{0,3})/,'$1.$2.$3');else if(v.length>3)v=v.replace(/(\d{3})(\d{0,3})/,'$1.$2');el.value=v;}
function fmtTel(el){var v=el.value.replace(/\D/g,'');if(v.length>10)v=v.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3');else if(v.length>6)v=v.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');else if(v.length>2)v=v.replace(/(\d{2})(\d*)/,'($1) $2');el.value=v;}
function enviar(){
  var nome=document.getElementById('nome').value.trim();
  var cpf=document.getElementById('cpf').value.trim();
  var tel=document.getElementById('tel').value.trim();
  var email=document.getElementById('email').value.trim();
  var err=document.getElementById('err');
  var cpfClean=cpf.replace(/\\D/g,''); var telClean=tel.replace(/\\D/g,''); if(!nome||cpfClean.length<11||telClean.length<10||!email.includes('@')){err.style.display='block';return;}
  err.style.display='none';
  fetch('/indicacao/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome,cpf,telefone:tel,email,cidade:document.getElementById('cidade').value.trim(),ref:REF})})
    .then(function(r){return r.json();})
    .then(function(r){
      if(r.ok){document.getElementById('form-area').style.display='none';document.getElementById('success').style.display='block';}
      else{err.textContent=r.erro||'Erro ao enviar.';err.style.display='block';}
    }).catch(function(){err.textContent='Erro de conexão.';err.style.display='block';});
}
</script>
</body>
</html>`);
});

// ── POST /indicacao/submit ────────────────────────────────────────────────────
app.post('/indicacao/submit', async (req, res) => {
  try {
    const { nome, cpf, telefone, email, ref } = req.body || {};
    if (!nome || !cpf || !telefone || !email) return res.json({ ok: false, erro: 'Campos obrigatórios' });

    // Salva no GAS
    const result = await callAppsScriptPost({
      evento: 'REGISTRAR_INDICACAO',
      integration_secret: CFG.appsScriptSharedSecret,
      nome, cpf, telefone, email,
      indicado_por: ref || ''
    });

    // Notifica gestor no Telegram
    const grupos = CFG.telegramGroupIds || {};
    const chatId = grupos['São Paulo'] || Object.values(grupos)[0];
    if (chatId) {
      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: '<b>Nova Indicacao!</b>\n\nNome: ' + nome + '\nTel: ' + telefone + '\nEmail: ' + email + '\nCPF: ' + cpf + (ref ? '\nIndicado por: <code>' + ref + '</code>' : ''),
        parse_mode: 'HTML'
      });
    }

    res.json({ ok: true });
  } catch(e) {
    console.error('[indicacao]', e.message);
    res.status(500).json({ ok: false, erro: e.message });
  }
});

// ── Rota interna: envia mensagem Telegram ────────────────────────────────────
app.post('/internal/telegram-send', async (req, res) => {
  try {
    const { integration_secret, chat_id, text, reply_markup } = req.body || {};
    if (integration_secret !== CFG.appsScriptSharedSecret) return res.status(401).json({ ok: false });
    if (!chat_id || !text) return res.json({ ok: false, erro: 'chat_id e text obrigatorios' });
    const payload = { chat_id, text, parse_mode: 'HTML' };
    if (reply_markup) payload.reply_markup = reply_markup;
    await telegramApi('sendMessage', payload);
    res.json({ ok: true });
  } catch(e) {
    console.error('[telegram-send]', e.message);
    res.status(500).json({ ok: false, erro: e.message });
  }
});

// ── Broadcast para promotores ───────────────────────────────────────────────
app.post('/gestor/broadcast', async (req, res) => {
  try {
    const { mensagem, token } = req.body || {};
    if (!mensagem) return res.json({ ok: false, erro: 'Mensagem obrigatoria' });
    const result = await callAppsScriptPost({
      evento: 'BROADCAST_PROMOTORES',
      integration_secret: CFG.appsScriptSharedSecret,
      mensagem
    });
    res.json(result);
  } catch(e) {
    console.error('[broadcast]', e.message);
    res.status(500).json({ ok: false, erro: e.message });
  }
});

// ── Fim de turno: pergunta se encerrou ou ficará mais ────────────────────────
app.post('/internal/send-fim-turno', async (req, res) => {
  try {
    const { integration_secret, telegram_user_id, slot_id, user_id, local_nome, fim } = req.body || {};
    if (integration_secret !== CFG.appsScriptSharedSecret) return res.status(401).json({ ok: false });
    if (!telegram_user_id) return res.json({ ok: false, erro: 'telegram_user_id obrigatório' });

    await telegramApi('sendMessage', {
      chat_id: telegram_user_id,
      parse_mode: 'HTML',
      text: `🕐 <b>Fim do seu turno!</b>\n\n📍 ${local_nome || slot_id}\n⏰ Previsão de encerramento: ${fim || '—'}\n\nO que deseja fazer?`,
      reply_markup: { inline_keyboard: [
        [
          { text: '✅ Encerrar agora', callback_data: 'FIM_ENCERRAR:' + slot_id + ':' + (user_id||'') },
          { text: '⏱️ Ficar mais 30min', callback_data: 'FIM_CONTINUAR:' + slot_id + ':' + (user_id||'') }
        ]
      ]}
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[send-fim-turno]', err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ── Slot liberado: notifica grupo + promotores sem slot ativo ────────────────
app.post('/internal/slot-liberado', async (req, res) => {
  try {
    const { integration_secret, slot_id, local_nome, inicio, fim, cidade } = req.body || {};
    if (integration_secret !== CFG.appsScriptSharedSecret) return res.status(401).json({ ok: false });

    // 1. Notifica grupo no tópico Slots Disponíveis
    const grupo = resolveCityGroup(cidade);
    if (grupo?.chatId) {
      const topicId_ = topicId(grupo, 'SLOTS_DISPONIVEIS');
      const msgGrupo = `📢 <b>Slot disponível!</b>\n\n📍 <b>${local_nome || slot_id}</b>\n🕐 ${inicio || '—'} – ${fim || '—'}\n\nAcesse o app para aceitar.`;
      await telegramApi('sendMessage', {
        chat_id: grupo.chatId,
        text: msgGrupo,
        parse_mode: 'HTML',
        ...(topicId_ ? { message_thread_id: topicId_ } : {})
      });
    }

    // 2. Notifica promotores sem slot ativo no privado
    const promotores = await callAppsScriptGet('GET_PROMOTORES_SEM_SLOT', {
      integration_secret: CFG.appsScriptSharedSecret,
      cidade
    });

    for (const p of (promotores?.data || [])) {
      if (!p.telegram_user_id) continue;
      await telegramApi('sendMessage', {
        chat_id: p.telegram_user_id,
        parse_mode: 'HTML',
        text: `🔔 <b>Oportunidade disponível!</b>\n\n📍 <b>${local_nome || slot_id}</b>\n🕐 ${inicio || '—'} – ${fim || '—'}\n\nAcesse o app para aceitar este slot.`
      }).catch(() => {});
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[slot-liberado]', err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ── Pré-jornada T-60: envia mensagem com botões de confirmação ──────────────
app.post('/internal/send-prejornada', async (req, res) => {
  try {
    const { integration_secret, telegram_user_id, confirmacao_id, slot_id, texto, botoes } = req.body || {};
    if (integration_secret !== CFG.appsScriptSharedSecret) return res.status(401).json({ ok: false });
    if (!telegram_user_id || !confirmacao_id) return res.status(400).json({ ok: false, erro: 'campos obrigatórios faltando' });

    const keyboard = { inline_keyboard: [(botoes || []).map(b => ({ text: b.label, callback_data: b.callback }))] };
    await telegramApi('sendMessage', {
      chat_id:      telegram_user_id,
      text:         texto || '⏰ Seu slot começa em 1 hora. Confirme sua ida:',
      parse_mode:   'Markdown',
      reply_markup: keyboard
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[send-prejornada]', err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

app.post(`/telegram/webhook/${CFG.telegramWebhookSecretPath}`, async (req, res) => {
  try {
    await handleTelegramUpdate(req.body || {});
  } catch (err) {
    console.error('[POST /telegram/webhook]', err);
  }
  res.status(200).json({ ok: true });
});

app.use((req, res) => {
  if (req.path.startsWith('/app/') || req.path.startsWith('/internal/') || req.path.startsWith('/telegram/') || req.path.startsWith('/healthz') || req.path.startsWith('/ready')) {
    return res.status(404).json({ ok: false, mensagem: 'Rota não encontrada.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(CFG.port, () => {
  console.log(`promo-telegram-gateway listening on :${CFG.port}`);
});

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleTelegramUpdate(update) {
  if (update.callback_query) { await handleCallbackQuery(update.callback_query); return; }
  // Localização compartilhada pelo teclado de checkin
  if (update.message?.location) {
    await handleLocationMessage(update.message);
    return;
  }
  if (update.message && typeof update.message.text === 'string') { await handleTextMessage(update.message); return; }
}

async function handleLocationMessage(message) {
  const telegramUserId = String(message.from?.id || '');
  const { latitude, longitude } = message.location || {};
  console.log('[location] from:', telegramUserId, 'lat:', latitude, 'lng:', longitude);
  if (!telegramUserId || !latitude || !longitude) return;

  // Busca sessão para ver se está aguardando localização para checkin
  const session = await botGetSessionCloudRun(telegramUserId);
  const estado  = session?.sessao?.estado || '';
  console.log('[location] estado sessao:', estado);
  if (estado !== 'AWAITING_CHECKIN_LOCATION') {
    await telegramApi('sendMessage', { chat_id: message.chat.id, text: '📍 Localização recebida, mas não há check-in pendente. Use o app para fazer check-in.' });
    return;
  }

  const payload = session?.sessao?.payload_json ? JSON.parse(session.sessao.payload_json) : {};
  const { slot_id, jornada_id, user_id } = payload.payload || payload;

  // Executa checkin via GAS com localização do Telegram
  const result = await callAppsScriptPost({
    evento: 'CHECKIN',
    integration_secret: CFG.appsScriptSharedSecret,
    user_id,
    slot_id,
    jornada_id,
    lat: latitude,
    lng: longitude,
    accuracy: 50,
    is_mock: false,
    horario_dispositivo: new Date().toISOString()
  });

  if (!result.ok && result.fora_do_raio) {
    // Se estiver fora do raio, oferece opção de forçar
    const ref = slot_id + ':' + (jornada_id || '') + ':' + latitude + ':' + longitude + ':' + user_id;
    await telegramApi('sendMessage', {
      chat_id: message.chat.id,
      text: `📍 <b>Você está fora do raio!</b>\n\nDistância: ${result.distancia}m\n\nDeseja forçar o check-in mesmo assim? A gestão será notificada.`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Sim, forçar check-in', callback_data: 'CHECKIN_FORCAR:' + ref },
          { text: '❌ Não', callback_data: 'bot_clear_session' }
        ]]
      }
    });
    return;
  }

  await botClearSessionCloudRun(telegramUserId);

  // Remove teclado de localização
  await telegramApi('sendMessage', {
    chat_id: message.chat.id,
    text: result.ok
      ? '✅ <b>Check-in realizado!</b>\n\nBoa operação! Use o app para pausar ou encerrar.'
      : '❌ Erro no check-in: ' + (result.erro || 'tente pelo app'),
    parse_mode: 'HTML',
    reply_markup: { remove_keyboard: true }
  });
}

async function handleCallbackQuery(callbackQuery) {
  const callbackId     = callbackQuery.id;
  const from           = callbackQuery.from || {};
  const data           = String(callbackQuery.data || '').trim();
  const telegramUserId = String(from.id || '');
  const chat           = callbackQuery.message?.chat || {};

  if (data.startsWith('accept:')) {
    const slotId = data.split(':')[1];
    if (!slotId) { await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Slot inválido.', show_alert: true }); return; }
    
    try {
      const result = await callAppsScriptPost({ 
        evento: 'ACEITAR_SLOT_TELEGRAM', 
        integration_secret: CFG.appsScriptSharedSecret, 
        slot_id: slotId, 
        telegram_user_id: String(from.id || '')
      });

      if (!result.ok) { 
        await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: result.erro || 'Erro ao aceitar.', show_alert: true }); 
        return; 
      }

      await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Slot aceito com sucesso!' });
      await processIntegracoes(result.integracoes, { evento: 'ACEITAR_SLOT_TELEGRAM', result });
      
      // Tenta atualizar a mensagem original para remover o botão
      await reconcileAcceptedSlotMessage(result, { chatId: chat.id, messageId: callbackQuery.message?.message_id, acceptedBy: from.first_name });

    } catch(e) {
      console.error('[BOT] Error accepting slot:', e.message);
      await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Erro de conexão.', show_alert: true });
    }
    return;
  }

  if (data.startsWith('cargo:')) {
    const cargo   = data.split(':')[1];
    const session = await botGetSessionCloudRun(telegramUserId);
    const _rawPayload = session?.sessao?.payload_json ? JSON.parse(session.sessao.payload_json) : {};
  const payload = _rawPayload.payload || _rawPayload;
    await botSetSessionCloudRun(telegramUserId, 'AWAITING_CIDADE', { ...payload, cargo });
    await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Cargo selecionado!' });
    await telegramApi('sendMessage', { chat_id: chat.id, parse_mode: 'HTML', text: 'Qual é a sua cidade de trabalho?', reply_markup: JSON.stringify({ inline_keyboard: [[{ text: '📍 São Paulo', callback_data: 'cidade:Sao Paulo' }]] }) });
    return;
  }

  if (data.startsWith('cidade:')) {
    const cidade  = data.split(':')[1];
    const session = await botGetSessionCloudRun(telegramUserId);
    const _rawPayload = session?.sessao?.payload_json ? JSON.parse(session.sessao.payload_json) : {};
  const payload = _rawPayload.payload || _rawPayload;
    await botSetSessionCloudRun(telegramUserId, 'AWAITING_NOME', { ...payload, cidade });
    await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Cidade selecionada!' });
    await telegramApi('sendMessage', { chat_id: chat.id, text: 'Agora digite seu nome completo:' });
    return;
  }

  if (data === 'bot_clear_session') {
    await botClearSessionCloudRun(telegramUserId);
    await telegramApi('editMessageText', { chat_id: chat.id, message_id: callbackQuery.message?.message_id, text: 'Operação cancelada.' });
    await telegramApi('answerCallbackQuery', { callback_query_id: callbackId });
    return;
  }

  if (data === 'bot:perfil') {
    await handleTelegramUpdate({ message: { chat, from, text: '/perfil' } });
    await telegramApi('answerCallbackQuery', { callback_query_id: callbackId });
    return;
  }

  if (data === 'bot:links') {
    await handleTelegramUpdate({ message: { chat, from, text: '/links' } });
    await telegramApi('answerCallbackQuery', { callback_query_id: callbackId });
    return;
  }

  if (data === 'bot:slots') {
    await handleTelegramUpdate({ message: { chat, from, text: '/slots' } });
    await telegramApi('answerCallbackQuery', { callback_query_id: callbackId });
    return;
  }

  if (data === 'bot:jornada') {
    await handleTelegramUpdate({ message: { chat, from, text: '/jornada' } });
    await telegramApi('answerCallbackQuery', { callback_query_id: callbackId });
    return;
  }

  if (data === 'bot:reset_confirm') {
    await handleTelegramUpdate({ message: { chat, from, text: '/reset' } });
    await telegramApi('answerCallbackQuery', { callback_query_id: callbackId });
    return;
  }

  if (data === 'bot:reset_exec') {
    const result = await callAppsScriptPost({ evento: 'BOT_RESET_JORNADA', integration_secret: CFG.appsScriptSharedSecret, telegram_user_id: telegramUserId });
    const msg = result.ok ? `✅ Jornada resetada com sucesso! (${result.resetados} registros limpos). Agora você pode aceitar novas vagas.` : `❌ Erro: ${result.erro}`;
    await telegramApi('editMessageText', { chat_id: chat.id, message_id: callbackQuery.message?.message_id, text: msg });
    await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Reset concluído.' });
    return;
  }

  if (data.startsWith('CHECKIN_FORCAR:')) {
    const [_, slotId, jornadaId, lat, lng, userId] = data.split(':');
    try {
      const result = await callAppsScriptPost({
        evento: 'CHECKIN',
        integration_secret: CFG.appsScriptSharedSecret,
        user_id: userId,
        slot_id: slotId,
        jornada_id: jornadaId,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        accuracy: 50,
        forcar: true,
        horario_dispositivo: new Date().toISOString()
      });
      await botClearSessionCloudRun(telegramUserId);
      await telegramApi('editMessageText', {
        chat_id: chat.id,
        message_id: callbackQuery.message?.message_id,
        text: result.ok ? '✅ <b>Check-in forçado com sucesso!</b>' : '❌ Erro: ' + (result.erro || 'tente pelo app'),
        parse_mode: 'HTML'
      });
      await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: result.ok ? 'Check-in realizado!' : 'Erro' });
    } catch(e) {
      await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Erro na conexão.', show_alert: true });
    }
    return;
  }

  if (data.startsWith('confirmar:')) {
    const resp = data.split(':')[1];
    if (resp === 'nao') {
      await botClearSessionCloudRun(telegramUserId);
      await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Cancelado.' });
      await telegramApi('sendMessage', { chat_id: chat.id, text: 'Cadastro cancelado. Envie /cadastro para recomecar.' });
      return;
    }
    const session = await botGetSessionCloudRun(telegramUserId);
    console.log('[cadastro] session:', JSON.stringify(session).substring(0,300));
    const _rawPayload = session?.sessao?.payload_json ? JSON.parse(session.sessao.payload_json) : {};
    const payload = _rawPayload.payload || _rawPayload;
    console.log('[cadastro] payload:', JSON.stringify(payload).substring(0,200));
    
    const isUpdate = payload.mode === 'UPDATE';
    let result;
    try {
      if (isUpdate) {
        result = await callAppsScriptPost({ 
          evento: 'BOT_UPDATE_PROMOTOR', 
          integration_secret: CFG.appsScriptSharedSecret, 
          telegram_user_id: telegramUserId,
          nome_completo: payload.nome_completo || '',
          cargo: payload.cargo || '',
          cidade: payload.cidade || ''
        });
      } else {
        result = await callAppsScriptPost({ 
          evento: 'BOT_PRECADASTRO', 
          integration_secret: CFG.appsScriptSharedSecret, 
          telegram_user_id: telegramUserId, 
          telegram_nome: payload.telegram_nome || '', 
          nome_completo: payload.nome_completo || '', 
          cargo: payload.cargo || '', 
          cidade: payload.cidade || '', 
          cpf: payload.cpf || '', 
          data_nascimento: payload.data_nascimento || '' 
        });
      }
    } catch(e) { 
      console.log('[cadastro] ERRO callPost:', e.message); 
      result = {ok:false}; 
    }

    console.log('[cadastro] result:', JSON.stringify(result).substring(0,200));
    await botClearSessionCloudRun(telegramUserId);
    await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Sucesso!' });
    
    if (result.ok) {
      const msg = isUpdate ? '✅ <b>Seus dados foram atualizados!</b>' : '✅ <b>Pré-cadastro enviado!</b>\n\nAguarde a aprovação da gestão. Você será notificado quando seu acesso for liberado.';
      await telegramApi('sendMessage', { chat_id: chat.id, parse_mode: 'HTML', text: msg });
    } else {
      await telegramApi('sendMessage', { chat_id: chat.id, text: '❌ Erro ao processar. Tente novamente com /start.' });
    }
    return;
  }

  // ── Jornada via bot (pausa/retorno/checkout) ────────────────────────────────
  if (data.startsWith('PILULA_')) {
    const match = data.match(/PILULA_([0-9]{4}-[0-9]{2}-[0-9]{2})_([0-9]+)_([a-d])_(.+)/);
    if (match) {
      const dataPilula = match[1];
      const questaoIdx = parseInt(match[2]);
      const resposta   = match[3];
      const usuarioId  = match[4];
      try {
        await callAppsScriptPost({
          evento: 'PILULA_RESPOSTA',
          integration_secret: CFG.appsScriptSharedSecret,
          usuario_id: usuarioId,
          data_pilula: dataPilula,
          questao_idx: questaoIdx,
          resposta
        });
        await telegramApi('answerCallbackQuery', { callback_query_id: callbackQuery.id });
      } catch(e) { console.error('[pilula]', e.message); }
    }
    return res.sendStatus(200);
  }
  if (data.startsWith('JORNADA_PAUSAR:') || data.startsWith('JORNADA_RETOMAR:') || data.startsWith('JORNADA_CHECKOUT:')) {
    const parts   = data.split(':');
    const tipo    = parts[0];
    const slotId  = parts[1];
    const jornId  = parts[2] || '';
    try {
      if (tipo === 'JORNADA_PAUSAR') {
        // Pede motivo antes de pausar
        await telegramApi('sendMessage', {
          chat_id: from.id,
          text: '⏸️ Qual o motivo da pausa?',
          reply_markup: { inline_keyboard: [
            [{ text: '🍽️ Almoço/Refeição', callback_data: 'JORNADA_PAUSAR_MOTIVO:' + slotId + ':' + jornId + ':almoco' }],
            [{ text: '🚽 Banheiro', callback_data: 'JORNADA_PAUSAR_MOTIVO:' + slotId + ':' + jornId + ':banheiro' }],
            [{ text: '⚙️ Problema técnico', callback_data: 'JORNADA_PAUSAR_MOTIVO:' + slotId + ':' + jornId + ':tecnico' }],
            [{ text: '📦 Reposição de estoque', callback_data: 'JORNADA_PAUSAR_MOTIVO:' + slotId + ':' + jornId + ':estoque' }],
            [{ text: '🔧 Outro', callback_data: 'JORNADA_PAUSAR_MOTIVO:' + slotId + ':' + jornId + ':outro' }]
          ]}
        });
      } else if (tipo === 'JORNADA_RETOMAR') {
        const result = await callAppsScriptPost({
          evento: 'RESUME_BOT',
          integration_secret: CFG.appsScriptSharedSecret,
          slot_id: slotId, jornada_id: jornId
        });
        await telegramApi('sendMessage', { chat_id: from.id, text: result.ok ? '▶️ Jornada retomada! Bom trabalho.' : '❌ Erro: ' + (result.erro || 'tente pelo app') });
        await telegramApi('editMessageReplyMarkup', { chat_id: from.id, message_id: callbackQuery.message?.message_id, reply_markup: { inline_keyboard: [] } });
      } else if (tipo === 'JORNADA_CHECKOUT') {
        const result = await callAppsScriptPost({
          evento: 'CHECKOUT_BOT',
          integration_secret: CFG.appsScriptSharedSecret,
          slot_id: slotId, jornada_id: jornId,
          lat: 0, lng: 0
        });
        await telegramApi('sendMessage', { chat_id: from.id, text: result.ok ? '🏁 Jornada encerrada! Obrigado pelo trabalho.' : '❌ Erro: ' + (result.erro || 'tente pelo app') });
        await telegramApi('editMessageReplyMarkup', { chat_id: from.id, message_id: callbackQuery.message?.message_id, reply_markup: { inline_keyboard: [] } });
      }
      await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Registrado!' });
    } catch(e) {
      await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Erro.', show_alert: true });
    }
    return;
  }

  // ── Pausa com motivo ─────────────────────────────────────────────────────────
  if (data.startsWith('JORNADA_PAUSAR_MOTIVO:')) {
    const parts  = data.split(':');
    const slotId = parts[1], jornId = parts[2], motivo = parts[3];
    try {
      const result = await callAppsScriptPost({
        evento: 'PAUSE',
        integration_secret: CFG.appsScriptSharedSecret,
        slot_id: slotId, jornada_id: jornId, motivo
      });
      await telegramApi('sendMessage', {
        chat_id: from.id,
        text: result.ok ? '⏸️ Pausa registrada! Motivo: ' + motivo + '\n\nRetorne quando estiver pronto.' : '❌ Erro: ' + (result.erro || 'tente pelo app'),
        reply_markup: result.ok ? { inline_keyboard: [[{ text: '▶️ Retomar jornada', callback_data: 'JORNADA_RETOMAR:' + slotId + ':' + jornId }]] } : undefined
      });
      await telegramApi('editMessageReplyMarkup', { chat_id: from.id, message_id: callbackQuery.message?.message_id, reply_markup: { inline_keyboard: [] } });
      await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Pausa registrada!' });
    } catch(e) {
      await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Erro.', show_alert: true });
    }
    return;
  }

  // ── Fim de turno callbacks ───────────────────────────────────────────────────
  if (data.startsWith('FIM_ENCERRAR:') || data.startsWith('FIM_CONTINUAR:')) {
    const parts = data.split(':');
    const tipo = parts[0], slotId = parts[1], userId = parts[2] || '';
    try {
      if (tipo === 'FIM_ENCERRAR') {
        await callAppsScriptPost({
          evento: 'CHECKOUT_EXCEPCIONAL',
          integration_secret: CFG.appsScriptSharedSecret,
          slot_id: slotId,
          user_id: userId,
          motivo: 'checkout via bot'
        });
        await telegramApi('sendMessage', { chat_id: from.id, text: '✅ Turno encerrado! Obrigado pelo trabalho.' });
      } else {
        await telegramApi('sendMessage', { chat_id: from.id, text: '⏱️ Ok! Lembraremos novamente em 30 minutos.' });
      }
      await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Registrado!' });
      await telegramApi('editMessageReplyMarkup', { chat_id: from.id, message_id: callbackQuery.message?.message_id, reply_markup: { inline_keyboard: [] } });
    } catch(e) {
      await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Erro.', show_alert: true });
    }
    return;
  }

  // ── Checkin reminder callbacks ──────────────────────────────────────────────
  if (data.startsWith('CHECKIN_APP:') || data.startsWith('CHECKIN_CAMINHO:') || data.startsWith('CHECKIN_CANCELAR:')) {
    const [tipo, refId] = data.split(':');
    try {
      if (tipo === 'CHECKIN_CANCELAR') {
        const result = await callAppsScriptPost({
          evento: 'CANCELAR_SLOT_HORARIO',
          integration_secret: CFG.appsScriptSharedSecret,
          ref_id: refId,
          telegram_user_id: String(from.id)
        });
        const msg = result.ok
          ? '❌ Slot cancelado. Uma penalidade foi aplicada no seu score.'
          : '⚠️ Erro ao cancelar: ' + (result.erro || 'tente pelo app');
        await telegramApi('sendMessage', { chat_id: from.id, text: msg });
        await telegramApi('editMessageReplyMarkup', { chat_id: from.id, message_id: callbackQuery.message?.message_id, reply_markup: { inline_keyboard: [] } });
      } else if (tipo === 'CHECKIN_CAMINHO') {
        await telegramApi('sendMessage', { chat_id: from.id, text: '👍 Registrado! Faça o check-in pelo app assim que chegar.' });
        await telegramApi('editMessageReplyMarkup', { chat_id: from.id, message_id: callbackQuery.message?.message_id, reply_markup: { inline_keyboard: [] } });
      } else {
        await telegramApi('sendMessage', { chat_id: from.id, text: `📲 Acesse o app para fazer o check-in:\n${CFG.appUrl}` });
      }
      await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Registrado!' });
    } catch(e) {
      await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Erro.', show_alert: true });
    }
    return;
  }

  // ── Confirmação pré-jornada ──────────────────────────────────────────────
  if (data.startsWith('CONF_A_CAMINHO:') || data.startsWith('CONF_NAO_VAI:') || data.startsWith('CONF_PRECISA_AJUDA:')) {
    const [tipo, confirmacaoId] = data.split(':');
    const resposta = tipo.replace('CONF_', '');
    try {
      const result = await callAppsScriptPost({
        evento: 'INTERNAL_CONFIRMAR_PRE_JORNADA',
        integration_secret: CFG.appsScriptSharedSecret,
        confirmacao_id: confirmacaoId,
        resposta,
        origem: 'bot'
      });
      // Se NAO_VAI ou PRECISA_AJUDA — libera o slot APÓS confirmar
      if (tipo === 'CONF_NAO_VAI' || tipo === 'CONF_PRECISA_AJUDA') {
        await callAppsScriptPost({ evento: 'CANCELAR_SLOT_PRE_JORNADA', integration_secret: CFG.appsScriptSharedSecret, confirmacao_id: confirmacaoId }).catch(() => {});
      }
      // Processa integrações retornadas
      for (const integ of (result.integracoes || [])) {
        if (integ.tipo === 'TELEGRAM_MSG' && integ.telegram_user_id) {
          await telegramApi('sendMessage', { chat_id: integ.telegram_user_id, text: integ.texto, parse_mode: 'Markdown' });
        }
      }
      await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Resposta registrada!' });
      await telegramApi('editMessageReplyMarkup', { chat_id: from.id, message_id: callbackQuery.message?.message_id, reply_markup: { inline_keyboard: [] } });
    } catch(e) {
      await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Erro ao registrar.', show_alert: true });
    }
    return;
  }

  await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Ação não reconhecida.', show_alert: true });
}
async function handleTextMessage(message) {
  const chat = message.chat || {};
  const text = String(message.text || '').trim();
  const telegramUserId = String((message.from && message.from.id) || '');
  const privateChat = chat.type === 'private';

  if (!privateChat) {
    if (/^\/cadastro\b/i.test(text) || /^\/update\b/i.test(text)) {
      await telegramApi('sendMessage', { chat_id: chat.id, text: 'Faça esse comando no privado do bot para concluir o cadastro. Abra o bot e envie /cadastro.' });
    }
    return;
  }

  if (/^\/start\b/i.test(text)) {
    const perfil = await callAppsScriptPost({ evento: 'BOT_GET_PERFIL', integration_secret: CFG.appsScriptSharedSecret, telegram_user_id: telegramUserId });
    const isReg = perfil?.ok;

    const welcome = `👋 <b>Bem-vindo ao JET Intelligence BOT</b>\n\n` +
      `<b>Comandos principais:</b>\n` +
      (isReg ? `/update — Atualizar seus dados\n` : `/cadastro — Vincular Telegram ao promotor\n`) +
      `/perfil — Ver meu score, streak e bloqueios\n` +
      `/slots — Ver vagas disponíveis agora\n` +
      `/jornada — Ver minhas vagas aceitas\n` +
      `/reset — Resetar jornada travada\n` +
      `/links — Links úteis (NF, Newsletter, LinkedIn)\n\n` +
      `<b>Links Rápidos:</b>\n` +
      `• <a href="${CFG.appUrl}">JET Promo Web Bot</a>\n` +
      `• <a href="https://t.me/Promoter_GOJET_BOT">Lançar Vendas (Bot Vendas)</a>`;
    
    await telegramApi('sendMessage', { 
      chat_id: chat.id, 
      parse_mode: 'HTML', 
      text: welcome,
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [{ text: '👤 Perfil', callback_data: 'bot:perfil' }, { text: '📅 Minha Jornada', callback_data: 'bot:jornada' }],
          [{ text: '🔍 Vagas Disponíveis', callback_data: 'bot:slots' }, { text: '🔄 Resetar', callback_data: 'bot:reset_confirm' }],
          [{ text: '🔗 Links Úteis', callback_data: 'bot:links' }]
        ]
      })
    });
    return;
  }

  if (/^\/jornada\b/i.test(text)) {
    const auth = await callAppsScriptGet('BOT_GET_SESSION', { integration_secret: CFG.appsScriptSharedSecret, telegram_user_id: telegramUserId });
    const res = await callAppsScriptGet('GET_SLOT_ATUAL', { token: auth?.sessao?.token || '', telegram_user_id: telegramUserId });
    
    if (!res.ok || !res.jornadas?.length) {
      await telegramApi('sendMessage', { chat_id: chat.id, text: '📅 Você não possui nenhuma jornada ativa no momento.' });
      return;
    }

    const lista = res.jornadas.map(j => {
      const s = j.slot || {};
      const statusIcon = j.jornada.status === 'EM_ATIVIDADE' ? '✅' : '🟡';
      return `${statusIcon} <b>${s.local_nome || s.local || 'Local desconhecido'}</b>\n` +
             `📅 ${s.data || '—'} | 🕐 ${s.inicio || '—'}–${s.fim || '—'}\n` +
             `Status: <code>${j.jornada.status}</code>`;
    }).join('\n\n');

    await telegramApi('sendMessage', { 
      chat_id: chat.id, 
      parse_mode: 'HTML', 
      text: `📅 <b>Sua Agenda Atual:</b>\n\n${lista}\n\n<a href="${CFG.appUrl}">👉 Abrir App para Operar</a>`
    });
    return;
  }

  if (/^\/slots\b/i.test(text)) {
    console.log('[BOT] /slots called by', telegramUserId);
    const auth = await callAppsScriptGet('BOT_GET_SESSION', { integration_secret: CFG.appsScriptSharedSecret, telegram_user_id: telegramUserId });
    const perfil = await callAppsScriptPost({ evento: 'BOT_GET_PERFIL', integration_secret: CFG.appsScriptSharedSecret, telegram_user_id: telegramUserId });
    
    console.log('[BOT] /slots perfil:', JSON.stringify(perfil));
    const res = await callAppsScriptGet('GET_SLOTS_DISPONIVEIS', { 
      token: auth?.sessao?.token || '', 
      telegram_user_id: telegramUserId,
      cidade: perfil?.ok ? perfil.cidade : '' 
    });

    if (!res.ok || !res.slots?.length) {
      const cidMsg = perfil?.ok && perfil.cidade ? ` para ${perfil.cidade}` : '';
      await telegramApi('sendMessage', { chat_id: chat.id, text: `📭 Nenhuma vaga disponível no momento${cidMsg}.` });
      return;
    }
    const lista = res.slots.slice(0, 5).map(s => `📍 <b>${s.local_nome || s.local}</b>\n📅 ${s.data} | 🕐 ${s.inicio}–${s.fim}`).join('\n\n');
    await telegramApi('sendMessage', { 
      chat_id: chat.id, 
      parse_mode: 'HTML', 
      text: `🔍 <b>Vagas Disponíveis (Próximas):</b>\n\n${lista}\n\n<a href="${CFG.appUrl}">👉 Abrir App para Aceitar</a>`
    });
    return;
  }

  if (/^\/cancel\b/i.test(text)) {
    await botClearSessionCloudRun(telegramUserId);
    await telegramApi('sendMessage', { chat_id: chat.id, text: 'Fluxo cancelado.' });
    return;
  }

  if (/^\/(cadastro|update)\b/i.test(text)) {
    const telegramNome = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ');
    await botSetSessionCloudRun(telegramUserId, 'AWAITING_CARGO', {
      mode: text.startsWith('/update') ? 'UPDATE' : 'PRECADASTRO',
      telegram_nome: telegramNome,
    });
    await telegramApi('sendMessage', {
      chat_id: chat.id,
      parse_mode: 'HTML',
      text: '\u{1F44B} Ol\u00e1, <b>' + telegramNome + '</b>!\n\nQual \u00e9 o seu cargo?',
      reply_markup: JSON.stringify({ inline_keyboard: [
        [{ text: '\u{1F3C3} Promotor (MEI)', callback_data: 'cargo:PROMOTOR' }],
        [{ text: '\u{1F50D} Scout (CLT)', callback_data: 'cargo:SCOUT' }],
        [{ text: '\u26A1 Charger (CLT)', callback_data: 'cargo:CHARGER' }],
        [{ text: '\u{1F697} Motorista (CLT)', callback_data: 'cargo:MOTORISTA' }],
        [{ text: '\u{1F4CB} Fiscal (CLT)', callback_data: 'cargo:FISCAL' }],
      ]}),
    });
    return;
  }
  const session = await botGetSessionCloudRun(telegramUserId);
  const estado = session?.sessao?.estado || '';
  const _rawPayload = session?.sessao?.payload_json ? JSON.parse(session.sessao.payload_json) : {};
  const payload = _rawPayload.payload || _rawPayload;
  if (!estado) {
    const perfil = await callAppsScriptPost({ evento: 'BOT_GET_PERFIL', integration_secret: CFG.appsScriptSharedSecret, telegram_user_id: telegramUserId });
    if (perfil?.ok) {
      await telegramApi('sendMessage', { chat_id: chat.id, text: `Olá, ${perfil.nome || 'promotor'}! Use os botões abaixo ou envie /start para ver as opções.`,
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [{ text: '👤 Perfil', callback_data: 'bot:perfil' }, { text: '📅 Minha Jornada', callback_data: 'bot:jornada' }],
            [{ text: '🔍 Vagas Disponíveis', callback_data: 'bot:slots' }, { text: '🔄 Resetar', callback_data: 'bot:reset_confirm' }]
          ]
        })
      });
    } else {
      await telegramApi('sendMessage', { chat_id: chat.id, text: 'Envie /cadastro para fazer seu pré-cadastro.' });
    }
    return;
  }
  if (estado === 'AWAITING_NOME') {
    const nome = text.trim();
    if (nome.length < 3) {
      await telegramApi('sendMessage', { chat_id: chat.id, text: 'Nome muito curto. Digite seu nome completo.' });
      return;
    }
    const isUpdate = payload.mode === 'UPDATE';
    if (isUpdate) {
      // No modo UPDATE, pulamos CPF e Nascimento. Vamos direto para a Cidade.
      await botSetSessionCloudRun(telegramUserId, 'AWAITING_CIDADE', { ...payload, nome_completo: nome });
      await telegramApi('sendMessage', { chat_id: chat.id, text: 'Em qual cidade você atua?' });
    } else {
      await botSetSessionCloudRun(telegramUserId, 'AWAITING_CPF', { ...payload, nome_completo: nome });
      await telegramApi('sendMessage', { chat_id: chat.id, text: 'Digite seu CPF (só números):' });
    }
    return;
  }

  if (estado === 'AWAITING_CPF') {
    const cpf = text.replace(/\D/g, '');
    if (cpf.length !== 11) {
      await telegramApi('sendMessage', { chat_id: chat.id, text: 'CPF inválido. Digite apenas os 11 números, sem pontos ou traços.' });
      return;
    }
    await botSetSessionCloudRun(telegramUserId, 'AWAITING_NASCIMENTO', { ...payload, cpf });
    await telegramApi('sendMessage', { chat_id: chat.id, text: 'Digite sua data de nascimento (formato: ddmmaaaa). Ex: 15031990' });
    return;
  }

  if (estado === 'AWAITING_NASCIMENTO') {
    const nasc = text.replace(/\D/g, '');
    if (nasc.length !== 8) {
      await telegramApi('sendMessage', { chat_id: chat.id, text: 'Data inválida. Use o formato ddmmaaaa. Ex: 15031990' });
      return;
    }
    await botSetSessionCloudRun(telegramUserId, 'AWAITING_CIDADE', { ...payload, data_nascimento: nasc, senha_inicial: nasc });
    await telegramApi('sendMessage', { chat_id: chat.id, text: 'Em qual cidade você atua?' });
    return;
  }

  if (estado === 'AWAITING_CIDADE') {
    const cidade = text.trim().toUpperCase();
    if (cidade.length < 2) {
      await telegramApi('sendMessage', { chat_id: chat.id, text: 'Nome da cidade inválido.' });
      return;
    }
    await _confirmarCadastro(telegramUserId, chat.id, { ...payload, cidade });
    return;
  }
  await telegramApi('sendMessage', { chat_id: chat.id, text: 'Fluxo não reconhecido. Envie /cancel e comece novamente.' });
}

async function _confirmarCadastro(telegramUserId, chatId, p) {
  await botSetSessionCloudRun(telegramUserId, 'CONFIRMAR_CADASTRO', p);
  const cargosCLT = ['SCOUT','CHARGER','MOTORISTA','FISCAL'];
  const ehCLT = cargosCLT.includes((p.cargo || '').toUpperCase());
  const isUpdate = p.mode === 'UPDATE';
  
  let extras = '';
  if (isUpdate) {
    extras = '\n<i>(CPF e Nascimento permanecerão inalterados)</i>';
  } else if (ehCLT) {
    extras = '\n📋 CPF: <b>' + (p.cpf || '') + '</b>\n🎂 Nasc: <b>' + (p.data_nascimento || '') + '</b>';
  }

  await telegramApi('sendMessage', {
    chat_id: chatId,
    parse_mode: 'HTML',
    text: '📋 <b>Confirme seus dados:</b>\n\n'
      + '👤 Nome: <b>' + p.nome_completo + '</b>\n'
      + '💼 Cargo: <b>' + p.cargo + '</b>\n'
      + '📍 Cidade: <b>' + p.cidade + '</b>'
      + extras + '\n\nEstá correto?',
    reply_markup: JSON.stringify({ inline_keyboard: [
      [{ text: '✅ Confirmar', callback_data: 'confirmar:sim' }, { text: '❌ Corrigir', callback_data: 'confirmar:nao' }],
    ]}),
  });
}

async function publishAvailableSlot(slot) {
  const group = resolveCityGroup(slot.cidade);
  if (!group) { console.warn(`Cidade sem grupo configurado: ${slot.cidade}`); return { ok: false, reason: 'city_not_configured' }; }

  const message = await telegramApi('sendMessage', {
    chat_id: group.chatId,
    message_thread_id: topicId(group, 'SLOTS_DISPONIVEIS'),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    text: renderAvailableSlotMessage(slot),
    reply_markup: { inline_keyboard: [[{ text: '✅ Aceitar slot', callback_data: `accept:${slot.slot_id}` }]] },
  });

  if (message.ok && message.result && message.result.message_id) {
    await callAppsScriptPost({
      evento: 'INTERNAL_REGISTRAR_SLOT_TELEGRAM_META',
      integration_secret: CFG.appsScriptSharedSecret,
      slot_id: slot.slot_id,
      kind: 'disponivel',
      chat_id: String(group.chatId),
      topic_key: 'SLOTS_DISPONIVEIS',
      message_id: String(message.result.message_id),
    });
  }

  return { ok: !!message.ok, telegram: message };
}

async function reconcileAcceptedSlotMessage(result, callbackContext) {
  const slotMeta = result?.dados?.slot_telegram_meta?.disponivel || {};
  const targetChatId = callbackContext?.chatId || slotMeta.chat_id;
  const targetMessageId = callbackContext?.messageId || slotMeta.message_id;
  if (!targetChatId || !targetMessageId) return;

  const slotData = result?.dados?.slot || {};
  const acceptedBy = callbackContext?.acceptedBy || 'promotor';
  const text = '⛔️ <b>Slot aceito</b>\n' +
    `Cidade: <b>${escapeHtml(slotData.cidade || '—')}</b>\n` +
    `Local: <b>${escapeHtml(slotData.local || '—')}</b>\n` +
    `Status: <b>${escapeHtml(slotData.status || 'ACEITO')}</b>\n` +
    `Aceito por: <b>${escapeHtml(acceptedBy)}</b>\n` +
    `Slot ID: <code>${escapeHtml(slotData.slot_id || '')}</code>`;

  await telegramApi('editMessageText', { chat_id: targetChatId, message_id: Number(targetMessageId), parse_mode: 'HTML', text }).catch(() => null);
  await telegramApi('editMessageReplyMarkup', { chat_id: targetChatId, message_id: Number(targetMessageId), reply_markup: { inline_keyboard: [] } }).catch(() => null);

  if (slotData.slot_id) {
    await callAppsScriptPost({ evento: 'INTERNAL_LIMPAR_SLOT_TELEGRAM_META', integration_secret: CFG.appsScriptSharedSecret, slot_id: slotData.slot_id, kind: 'disponivel' });
  }
}

async function processIntegracoes(integracoes, context) {
  if (!Array.isArray(integracoes) || integracoes.length === 0) return [];
  const out = [];
  for (const item of integracoes) {
    if (!item || item.canal !== 'telegram') continue;
    
    let targetChatId = item.chat_id;
    let targetTopicId = item.topic_id;

    if (item.tipo === 'group_message' && !targetChatId) {
      // Tenta buscar no cache dinâmico da aba GRUPOS_TELEGRAM
      const rule = GROUPS_CACHE.data.find(g => 
        normStr(g.cidade) === normStr(item.cidade) && 
        g.topico_key === item.topic_key
      ) || GROUPS_CACHE.data.find(g => g.topico_key === item.topic_key); // Fallback p/ qualquer cidade

      if (rule) {
        targetChatId = rule.chat_id;
        targetTopicId = rule.topic_id;
      } else {
        // Fallback legado
        const group = resolveCityGroup(item.cidade);
        if (group) {
          targetChatId = group.chatId;
          targetTopicId = topicId(group, item.topic_key);
        }
      }
    }

    if (item.tipo === 'group_message' && targetChatId) {
      const sent = await telegramApi('sendMessage', { 
        chat_id: targetChatId, 
        message_thread_id: targetTopicId, 
        parse_mode: item.parse_mode || 'HTML', 
        disable_web_page_preview: true, 
        text: item.text_html || item.text || '',
        reply_markup: item.reply_markup
      });
      out.push(sent);
      
      if (context?.evento && context.evento.startsWith('ACEITAR_SLOT') && item.topic_key === 'SLOTS_OCUPADOS') {
        const slotId = context?.result?.dados?.slot?.slot_id;
        if (slotId && sent.ok && sent.result?.message_id) {
          await callAppsScriptPost({ evento: 'INTERNAL_REGISTRAR_SLOT_TELEGRAM_META', integration_secret: CFG.appsScriptSharedSecret, slot_id: slotId, kind: 'ocupado', chat_id: String(targetChatId), topic_key: item.topic_key, message_id: String(sent.result.message_id) });
        }
      }
    }

    if (item.tipo === 'private_message' && (item.telegram_user_id || item.chat_id)) {
      const sent = await telegramApi('sendMessage', { 
        chat_id: item.telegram_user_id || item.chat_id, 
        parse_mode: item.parse_mode || 'HTML', 
        disable_web_page_preview: true, 
        text: item.text_html || item.text || '',
        reply_markup: item.reply_markup
      });
      out.push(sent);
    }
  }
  return out;
}

function normStr(str) {
  if (!str) return '';
  return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

async function botGetSessionCloudRun(telegramUserId) {
  return callAppsScriptGet('BOT_GET_SESSION', { integration_secret: CFG.appsScriptSharedSecret, telegram_user_id: String(telegramUserId || '') });
}

async function botSetSessionCloudRun(telegramUserId, estado, payload) {
  return callAppsScriptGet('BOT_SET_SESSION', {
    integration_secret: CFG.appsScriptSharedSecret,
    telegram_user_id: String(telegramUserId || ''),
    estado,
    payload_json: JSON.stringify(payload || {})
  });
}
async function botClearSessionCloudRun(telegramUserId) {
  return callAppsScriptGet('BOT_CLEAR_SESSION', {
    integration_secret: CFG.appsScriptSharedSecret,
    telegram_user_id: String(telegramUserId || '')
  });
}

async function callAppsScriptGet(evento, params = {}) {
  const url = new URL(CFG.appsScriptUrl);
  url.searchParams.set('evento', evento);
  for (const [key, value] of Object.entries(params)) {
    if (value == null || key === 'evento' || key === 'action') continue;
    url.searchParams.set(key, String(value));
  }
  const resp = await fetch(url.toString(), { method: 'GET' });
  const text = await resp.text();
  return safeJson(text);
}

async function callAppsScriptPost(payload) {
  const resp = await fetch(CFG.appsScriptUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) });
  const text = await resp.text();
  return safeJson(text);
}

async function telegramApi(method, payload) {
  const url = `https://api.telegram.org/bot${CFG.telegramBotToken}/${method}`;
  const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) });
  const json = await resp.json();
  if (!json.ok) console.error(`[telegram:${method}]`, JSON.stringify(json));
  return json;
}

function renderAvailableSlotMessage(slot) {
  return '📆 <b>Slot disponível</b>\n' +
    `Cidade: <b>${escapeHtml(slot.cidade || '—')}</b>\n` +
    `Local: <b>${escapeHtml(slot.local || '—')}</b>\n` +
    `Atividade: <b>${escapeHtml(slot.tipo_atividade || '—')}</b>\n` +
    `Início: <b>${escapeHtml(formatDateTime(slot.inicio))}</b>\n` +
    `Fim: <b>${escapeHtml(formatDateTime(slot.fim))}</b>\n` +
    `Raio: <b>${escapeHtml(String(slot.raio_metros || '—'))}m</b>\n` +
    `Slot ID: <code>${escapeHtml(slot.slot_id || '')}</code>`;
}

function requireAdminSecret(req, res, next) {
  const provided = String(req.get('x-admin-secret') || req.body?.admin_secret || '').trim();
  if (!provided || provided !== CFG.adminSecret) return res.status(401).json({ ok: false, mensagem: 'Acesso negado.' });
  next();
}

function corsMiddleware(req, res, next) {
  const origin = req.get('origin') || '*';
  if (!CFG.corsOrigin || CFG.corsOrigin === '*' || origin === CFG.corsOrigin) res.setHeader('Access-Control-Allow-Origin', CFG.corsOrigin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Secret');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
}

function loadConfig() {
  const cityGroups = JSON.parse(process.env.CITY_GROUPS_JSON || '{}');
  const normalizedMap = {};
  for (const [rawCity, value] of Object.entries(cityGroups)) {
    normalizedMap[normalizeCity(rawCity)] = { name: value.name || rawCity, chatId: String(value.chatId), topics: value.topics || {} };
  }
  return {
    port: Number(process.env.PORT || 8080),
    appsScriptUrl: mustEnv('APPS_SCRIPT_URL'),
    appsScriptSharedSecret: mustEnv('APPS_SCRIPT_SHARED_SECRET'),
    telegramBotToken: mustEnv('TELEGRAM_BOT_TOKEN'),
    telegramWebhookSecretPath: mustEnv('TELEGRAM_WEBHOOK_SECRET_PATH'),
    adminSecret: mustEnv('ADMIN_SECRET'),
    corsOrigin: process.env.CORS_ORIGIN || '*',
    publishMaxSlots: Number(process.env.PUBLISH_MAX_SLOTS || 50),
    defaultCity: process.env.DEFAULT_CITY || '',
    appUrl: process.env.APP_URL || 'https://hikoalbuquerque-prog.github.io/jet-promobot/',
    cityGroups: normalizedMap,
  };
}

function mustEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function resolveCityGroup(city) {
  const normalized = normalizeCity(city || CFG.defaultCity || '');
  return CFG.cityGroups[normalized] || null;
}

function topicId(group, key) {
  if (!group) return undefined;
  const value = group.topics ? group.topics[key] : undefined;
  return value === null || value === '' || value === undefined ? undefined : Number(value);
}

function normalizeCity(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}

function safeJson(text) {
  try { return JSON.parse(text); } catch (_err) { return { ok: false, mensagem: 'Resposta inválida do Apps Script.', raw: text }; }
}

function truncateForCallback(text) {
  const clean = String(text || '');
  return clean.length <= 180 ? clean : `${clean.slice(0, 177)}...`;
}