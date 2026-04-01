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
app.get('/version', (_req, res) => res.json({ ok: true, service: 'promo-telegram-gateway', version: '1.0.0', now: new Date().toISOString() }));
// ─────────────────────────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(corsMiddleware);

const CFG = loadConfig();

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
      if (evento === 'ACEITAR_SLOT') await reconcileAcceptedSlotMessage(result, null);
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
    const texto = isLembrete
      ? `⚠️ <b>Você ainda não fez check-in!</b>\n\n📍 ${local_nome || slot_id}\n🕐 ${inicio || '—'}\n\nO que deseja fazer?`
      : `🔔 <b>Hora do seu slot!</b>\n\n📍 <b>${local_nome || slot_id}</b>\n🕐 ${inicio || '—'}\n\nAbra o app para fazer o check-in.`;

    const botoes = isLembrete ? [
      [
        { text: '📲 Vou fazer check-in agora', callback_data: 'CHECKIN_APP:' + (confirmacao_id||slot_id) },
        { text: '🚗 Estou a caminho', callback_data: 'CHECKIN_CAMINHO:' + (confirmacao_id||slot_id) }
      ],
      [
        { text: '❌ Cancelar slot (penalidade)', callback_data: 'CHECKIN_CANCELAR:' + (confirmacao_id||slot_id) }
      ]
    ] : [
      [{ text: '📲 Abrir app para check-in', url: 'https://promo-telegram-gateway-v3-476120210909.southamerica-east1.run.app' }]
    ];

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
        { text: '🌐 Abrir app', url: 'https://hikoalbuquerque-prog.github.io/jet-promobot' }
      ]];
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
    const promotorResult = await callAppsScriptPost({ evento: 'BOT_GET_SESSION', integration_secret: CFG.appsScriptSharedSecret, telegram_user_id: telegramUserId });
    const promotorId = promotorResult?.promotor_id || '';
    const cidade     = promotorResult?.cidade || '';
    if (!promotorId) { await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Faça /cadastro primeiro.', show_alert: true }); return; }
    const result = await callAppsScriptPost({ evento: 'ACEITAR_SLOT_TELEGRAM', integration_secret: CFG.appsScriptSharedSecret, slot_id: slotId, promotor_id: promotorId, cidade, telegram_user_id: String(from.id || ''), telegram_nome: [from.first_name, from.last_name].filter(Boolean).join(' ') });
    if (!result.ok) { await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: result.mensagem || 'Erro ao aceitar.', show_alert: true }); return; }
    await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Slot aceito com sucesso.' });
    await processIntegracoes(result.integracoes, { evento: 'ACEITAR_SLOT_TELEGRAM', result });
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
    let result; try { result = await callAppsScriptPost({ evento: 'BOT_PRECADASTRO', integration_secret: CFG.appsScriptSharedSecret, telegram_user_id: telegramUserId, telegram_nome: payload.telegram_nome || '', nome_completo: payload.nome_completo || '', cargo: payload.cargo || '', cidade: payload.cidade || '', cpf: payload.cpf || '', data_nascimento: payload.data_nascimento || '' }); } catch(e) { console.log('[cadastro] ERRO callPost:', e.message); result = {ok:false}; }
    console.log('[cadastro] result:', JSON.stringify(result).substring(0,200));
    await botClearSessionCloudRun(telegramUserId);
    await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Enviado!' });
    if (result.ok) {
      await telegramApi('sendMessage', { chat_id: chat.id, parse_mode: 'HTML', text: '✅ <b>Pré-cadastro enviado!</b>\n\nAguarde a aprovação da gestão. Você será notificado quando seu acesso for liberado.' });
    } else {
      await telegramApi('sendMessage', { chat_id: chat.id, text: '❌ Erro ao salvar. Tente novamente com /cadastro.' });
    }
    return;
  }

  // ── Jornada via bot (pausa/retorno/checkout) ────────────────────────────────
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

  // ── Jornada via bot (pausa/retorno/checkout) ────────────────────────────────
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

  // ── Jornada via bot (pausa/retorno/checkout) ────────────────────────────────
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
        await telegramApi('sendMessage', { chat_id: from.id, text: '📲 Acesse o app para fazer o check-in:\nhttps://hikoalbuquerque-prog.github.io/jet-promobot' });
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
      console.log('[T60] confirmacaoId:', confirmacaoId, 'resposta:', resposta);
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
      console.log('[T60] result:', JSON.stringify(result).substring(0,300));
      // Processa integrações retornadas (mensagens de resposta)
      for (const integ of (result.integracoes || [])) {
        if (integ.tipo === 'TELEGRAM_MSG' && integ.telegram_user_id) {
          await telegramApi('sendMessage', { chat_id: integ.telegram_user_id, text: integ.texto, parse_mode: 'Markdown' });
        }
        if (integ.tipo === 'TELEGRAM_GESTAO' && integ.cidade) {
          const grupos = getCityGroups(integ.cidade);
          if (grupos?.group_id) {
            await telegramApi('sendMessage', { chat_id: grupos.group_id, text: `⚠️ Alerta: ${integ.alerta} — Promotor: ${integ.user_id}` });
          }
        }
      }
      await telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text: 'Resposta registrada!' });
      // Edita a mensagem original para não mostrar botões novamente
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
    await telegramApi('sendMessage', { chat_id: chat.id, parse_mode: 'HTML', text: '👋 <b>Promo Intelligence BOT</b>\n\nUse estes comandos no privado:\n/cadastro — vincular seu Telegram ao promotor\n/update — trocar promotor_id e/ou cidade\n/cancel — cancelar o fluxo atual' });
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
    await telegramApi('sendMessage', { chat_id: chat.id, text: 'Envie /cadastro para fazer seu pr\u00e9-cadastro.' });
    return;
  }
  if (estado === 'AWAITING_NOME') {
    const nome = text.trim();
    if (nome.length < 3) {
      await telegramApi('sendMessage', { chat_id: chat.id, text: 'Nome muito curto. Digite seu nome completo.' });
      return;
    }
    const cargosCLT = ['SCOUT','CHARGER','MOTORISTA','FISCAL'];
    const ehCLT = cargosCLT.includes((payload.cargo || '').toUpperCase());
    if (ehCLT) {
      await botSetSessionCloudRun(telegramUserId, 'AWAITING_CPF', { ...payload, nome_completo: nome });
      await telegramApi('sendMessage', { chat_id: chat.id, text: 'Digite seu CPF (somente números):' });
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
    await _confirmarCadastro(telegramUserId, chat.id, { ...payload, data_nascimento: nasc, senha_inicial: nasc });
    return;
  }
  await telegramApi('sendMessage', { chat_id: chat.id, text: 'Fluxo não reconhecido. Envie /cancel e comece novamente.' });
}

async function _confirmarCadastro(telegramUserId, chatId, p) {
  await botSetSessionCloudRun(telegramUserId, 'CONFIRMAR_CADASTRO', p);
  const cargosCLT = ['SCOUT','CHARGER','MOTORISTA','FISCAL'];
  const ehCLT = cargosCLT.includes((p.cargo || '').toUpperCase());
  const extras = ehCLT
    ? '\n📋 CPF: <b>' + (p.cpf || '') + '</b>\n🎂 Nasc: <b>' + (p.data_nascimento || '') + '</b>'
    : '';
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
    if (item.tipo === 'group_message') {
      const group = resolveCityGroup(item.cidade);
      if (!group) continue;
      const sent = await telegramApi('sendMessage', { chat_id: group.chatId, message_thread_id: topicId(group, item.topic_key), parse_mode: item.parse_mode || 'HTML', disable_web_page_preview: true, text: item.text_html || item.text || '' });
      out.push(sent);
      if (context?.evento && context.evento.startsWith('ACEITAR_SLOT') && item.topic_key === 'SLOTS_OCUPADOS') {
        const slotId = context?.result?.dados?.slot?.slot_id;
        if (slotId && sent.ok && sent.result?.message_id) {
          await callAppsScriptPost({ evento: 'INTERNAL_REGISTRAR_SLOT_TELEGRAM_META', integration_secret: CFG.appsScriptSharedSecret, slot_id: slotId, kind: 'ocupado', chat_id: String(group.chatId), topic_key: item.topic_key, message_id: String(sent.result.message_id) });
        }
      }
    }
    if (item.tipo === 'private_message' && item.telegram_user_id) {
      const sent = await telegramApi('sendMessage', { chat_id: item.telegram_user_id, parse_mode: item.parse_mode || 'HTML', disable_web_page_preview: true, text: item.text_html || item.text || '' });
      out.push(sent);
    }
  }
  return out;
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