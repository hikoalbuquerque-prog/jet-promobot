// ============================================================
//  06.PreJornada.gs  — Pré-jornada T-90 + Escala + Promocodes
//  Versão: 3.0  |  Escala Nacional + Fluxo Consolidado
// ============================================================

function dispararPreJornada_(body) {
  const ss  = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws  = ss.getSheetByName('PRE_JORNADA_CONFIRMACOES');
  if (!ws) return { ok: false, erro: 'aba PRE_JORNADA_CONFIRMACOES não encontrada' };

  const { slot_id, user_id, cidade } = body;
  if (!slot_id || !user_id) return { ok: false, erro: 'slot_id e user_id obrigatórios' };

  const data = ws.getDataRange().getValues();
  const h    = data[0].map(v => String(v).toLowerCase().trim());
  const iSlt = h.indexOf('slot_id'), iUsr = h.indexOf('user_id');
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iSlt]).trim() === slot_id && String(data[r][iUsr]).trim() === user_id) {
      return { ok: false, erro: 'Pré-jornada já disparada para este slot/usuário' };
    }
  }

  const slot = getSlot_(ss, slot_id);
  const localNome = slot ? (slot.local_nome || slot.nome || slot_id) : slot_id;
  const inicio = slot ? String(slot.inicio || '').substring(0, 5) : '—';
  const fim = slot ? String(slot.fim || '').substring(0, 5) : '—';
  const agora = new Date().toISOString(), confId = gerarId_('CONF');

  ws.appendRow([confId, slot_id, '', user_id, cidade || '', 'PENDENTE', 'system', agora, '', 'FALSE', agora, agora]);

  const tgId = getTelegramUserId_(ss, user_id);
  const texto = `⏰ <b>Seu slot começa em 1h30!</b> (90 min)\n\n📍 <b>${localNome}</b>\n🕐 ${inicio} – ${fim}\n\nConfirme sua presença para garantir seu promocode:`;

  return {
    ok: true, confirmacao_id: confId,
    integracoes: [{
      canal: 'telegram',
      tipo: 'private_message',
      telegram_user_id: tgId,
      parse_mode: 'HTML',
      text_html: texto,
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Estou a caminho',   callback_data: 'CONF_A_CAMINHO:' + confId }],
          [{ text: '❌ Não vou conseguir', callback_data: 'CONF_NAO_VAI:' + confId }],
          [{ text: '🆘 Preciso de ajuda',  callback_data: 'CONF_PRECISA_AJUDA:' + confId }]
        ]
      }
    }]
  };
}

function confirmarPreJornada_(body) {
  const { confirmacao_id, resposta, origem } = body;
  if (!confirmacao_id || !resposta) return { ok: false, erro: 'confirmacao_id e resposta obrigatórios' };

  const ss   = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws   = ss.getSheetByName('PRE_JORNADA_CONFIRMACOES');
  const data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim());
  const iId = h.indexOf('confirmacao_id'), iStt = h.indexOf('status'), iOrg = h.indexOf('origem'), iRes = h.indexOf('resposta_em'), iPro = h.indexOf('promocode_emitido'), iSlt = h.indexOf('slot_id'), iUsr = h.indexOf('user_id'), iCid = h.indexOf('cidade');
  const agora = new Date().toISOString();

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iId]).trim() !== confirmacao_id) continue;
    if (data[r][iStt] !== 'PENDENTE') return { ok: false, erro: 'Confirmação já respondida: ' + data[r][iStt] };

    const novoStatus = resposta.toUpperCase();
    ws.getRange(r+1, iStt+1).setValue(novoStatus);
    ws.getRange(r+1, iOrg+1).setValue(origem || 'bot');
    ws.getRange(r+1, iRes+1).setValue(agora);

    const slotId = String(data[r][iSlt]), userId = String(data[r][iUsr]), cidade = String(data[r][iCid]), tgId = getTelegramUserId_(ss, userId);
    let integracoes = [];

    if (novoStatus === 'A_CAMINHO') {
      const jornada = getJornadaPorSlot_(ss, slotId, userId);
      if (jornada) atualizarJornada_(ss, jornada.jornada_id, { confirmacao_presenca: 'A_CAMINHO', atualizado_em: agora });
      
      const resPc = emitirPromocode_(ss, { confirmacao_id, slot_id: slotId, user_id: userId, cidade });
      if (resPc.ok) {
        ws.getRange(r+1, iPro+1).setValue('TRUE');
        integracoes.push({ canal:'telegram', tipo:'private_message', telegram_user_id:tgId, parse_mode:'HTML', text_html:`🛴 <b>Ótimo! Te esperamos no slot.</b>\n\n🎟 Seu promocode de deslocamento: <code>${resPc.codigo}</code>\n⏳ Válido até o check-in.\n\n💡 O bônus é confirmado após o check-in presencial.` });
      } else {
        integracoes.push({ canal:'telegram', tipo:'private_message', telegram_user_id:tgId, text_html:'✅ <b>Confirmado!</b> Te esperamos no slot. Boa operação!' });
      }
    } else if (novoStatus === 'NAO_VAI') {
      // Liberar o slot
      atualizarSlotStatus_(ss, slotId, 'DISPONIVEL', agora);
      
      // Notificar Gestão e Grupos (Vaga Urgente)
      const slotObj = getSlot_(ss, slotId);
      integracoes.push({ canal:'telegram', tipo:'group_message', cidade, topic_key:'ALERTAS', parse_mode:'HTML', text_html:`⚠️ <b>FALTA CONFIRMADA (T-90)</b>\n\nO promotor informou que não comparecerá.\n👤 <b>${userId}</b>\n📍 Slot: ${slotObj.local_nome || slotId}\n\nO slot foi liberado e republicado.` });
      
      integracoes.push({ 
        canal:'telegram', tipo:'group_message', cidade, topic_key:'SLOTS_DISPONIVEIS', parse_mode:'HTML', 
        text_html:`🔥 <b>VAGA URGENTE DISPONÍVEL!</b>\n\n📍 <b>${slotObj.local_nome || slotObj.local}</b>\n🏙 ${cidade}\n🕐 ${slotObj.inicio} – ${slotObj.fim}\n\n<a href="${getConfig_('cloud_run_url')}">👉 ACEITAR AGORA</a>` 
      });

      integracoes.push({ canal:'telegram', tipo:'private_message', telegram_user_id:tgId, text_html:'📝 <b>Registrado.</b> O slot foi liberado para outro promotor. Obrigado por avisar.' });
    }

    return { ok: true, confirmacao_id, status: novoStatus, integracoes };
  }
  return { ok: false, erro: 'confirmacao_id não encontrada' };
}

function emitirPromocode_(ss, { confirmacao_id, slot_id, user_id, cidade }) {
  const wsPc = ss.getSheetByName('PROMOCODES_DESLOCAMENTO');
  if (!wsPc) return { ok: false, erro: 'Aba não encontrada' };
  const pcId = gerarId_('PC'), agora = new Date().toISOString(), expira = new Date(Date.now() + 4 * 3600000).toISOString();
  const codigo = 'PROMO' + Math.random().toString(36).slice(2,8).toUpperCase();
  wsPc.appendRow([pcId, codigo, user_id, slot_id, confirmacao_id, cidade, 'EMITIDO', '0', agora, expira, '', '']);
  return { ok: true, promocode_id: pcId, codigo, expira_em: expira };
}

function publicarEscala_(body) {
  const { escala_draft_id, publicado_por } = body;
  if (!escala_draft_id) return { ok: false, erro: 'escala_draft_id obrigatório' };
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const wsDr = ss.getSheetByName('ESCALAS_DRAFT');
  const dataDr = wsDr.getDataRange().getValues(), hDr = dataDr[0].map(v => String(v).toLowerCase().trim());
  const iId = hDr.indexOf('escala_draft_id'), iStt = hDr.indexOf('status_draft');

  for (let r = 1; r < dataDr.length; r++) {
    if (String(dataDr[r][iId]).trim() !== escala_draft_id) continue;
    if (!['RASCUNHO','VALIDADO'].includes(dataDr[r][iStt])) return { ok: false, erro: 'Draft não publicável' };

    const draft = rowToObj_(hDr, dataDr[r]);
    const agora = new Date().toISOString(), escalaId = gerarId_('ESC');
    wsDr.getRange(r+1, iStt+1).setValue('PUBLICADO');

    const wsPub = ss.getSheetByName('ESCALAS_PUBLICADAS');
    wsPub.appendRow([escalaId, escala_draft_id, draft.gestor_id, draft.equipe_id, draft.user_id, draft.cidade, draft.operacao, draft.cargo_principal, draft.funcao_prevista, draft.tipo_jornada, draft.data, draft.inicio, draft.fim, 'ATIVA', '', agora, publicado_por || '']);

    if (draft.tipo_jornada === 'TURNO') {
      const jrnId = gerarId_('JRN');
      ss.getSheetByName('JORNADAS').appendRow([jrnId, draft.user_id, '', escalaId, draft.cidade, draft.operacao, 'TURNO', 'CLT', draft.cargo_principal, draft.funcao_prevista || draft.cargo_principal, 'ESCALADO', `${draft.data}T${draft.inicio}:00`, `${draft.data}T${draft.fim}:00`, '','','','','','','','','','','','','', agora, agora]);
    }

    const tgId = getTelegramUserId_(ss, draft.user_id);
    const integracoes = [{ canal:'telegram', tipo:'private_message', telegram_user_id:tgId, parse_mode:'HTML', text_html:`📅 <b>Você foi escalado!</b>\n\n📆 Data: ${draft.data}\n🕐 ${draft.inicio} – ${draft.fim}\n🏙 ${draft.cidade} | ${draft.operacao}\n👔 Função: ${draft.funcao_prevista || draft.cargo_principal}` }];
    return { ok: true, escala_id: escalaId, integracoes };
  }
  return { ok: false, erro: 'escala_draft_id não encontrada' };
}

function getTelegramUserId_(ss, userId) {
  const ws = ss.getSheetByName('PROMOTORES'), data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim());
  const iId = h.indexOf('user_id'), iTg = h.indexOf('telegram_user_id');
  for (let r = 1; r < data.length; r++) { if (String(data[r][iId]).trim() === userId) return String(data[r][iTg]); }
  return '';
}

function triggerPreJornada() {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), ws = ss.getSheetByName('SLOTS');
  if (!ws) return;
  const data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim());
  const iId = h.indexOf('slot_id'), iUsr = h.indexOf('user_id'), iStt = h.indexOf('status'), iData = h.indexOf('data'), iIni = h.indexOf('inicio'), iCid = h.indexOf('cidade');
  const agora = new Date();

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iStt]).trim() !== 'ACEITO') continue;
    const userId = String(data[r][iUsr]).trim(); if (!userId) continue;
    const dataSlot = String(data[r][iData]).substring(0, 10), inicioStr = String(data[r][iIni]).substring(0, 5);
    if (!dataSlot || !inicioStr) continue;
    const slotDt = new Date(dataSlot + 'T' + inicioStr + ':00'), diffMin = (slotDt - agora) / 60000;
    // Dispara entre 85 e 100 minutos antes (aprox 90 min)
    if (diffMin < 85 || diffMin > 100) continue;

    const res = dispararPreJornada_({ slot_id: String(data[r][iId]).trim(), user_id: userId, cidade: String(data[r][iCid]).trim() });
    if (res.ok) processIntegracoes(res.integracoes, { evento: 'PRE_JORNADA' });
  }
}

function triggerSlotsDiarios() {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), ws = ss.getSheetByName('SLOTS');
  const data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim());
  const iId = h.indexOf('slot_id'), iStt = h.indexOf('status'), iData = h.indexOf('data'), iIni = h.indexOf('inicio'), iFim = h.indexOf('fim'), iNome = h.indexOf('local_nome'), iCid = h.indexOf('cidade');
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = amanha.toISOString().split('T')[0], slotsPorCidade = {};

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iStt]).trim() !== 'DISPONIVEL') continue;
    if (String(data[r][iData]).substring(0,10) !== amanhaStr) continue;
    const cid = String(data[r][iCid]).trim();
    if (!slotsPorCidade[cid]) slotsPorCidade[cid] = [];
    slotsPorCidade[cid].push(`📍 ${String(data[r][iNome]).trim()} · ${String(data[r][iIni]).substring(0,5)}–${String(data[r][iFim]).substring(0,5)}`);
  }

  for (const [cidade, slots] of Object.entries(slotsPorCidade)) {
    const texto = `📅 <b>Slots para amanhã</b>\n\n${slots.join('\n')}\n\n<a href="${getConfig_('cloud_run_url')}">👉 Abrir app para aceitar</a>`;
    processIntegracoes([{ canal:'telegram', tipo:'group_message', cidade, topic_key:'SLOTS_DISPONIVEIS', text_html:texto }], { evento:'BROADCAST_DIARIO' });
  }
}

function triggerCheckinHorario() {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), ws = ss.getSheetByName('SLOTS');
  const data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim());
  const iId = h.indexOf('slot_id'), iUsr = h.indexOf('user_id'), iJrn = h.indexOf('jornada_id'), iStt = h.indexOf('status'), iData = h.indexOf('data'), iIni = h.indexOf('inicio'), iFim = h.indexOf('fim'), iNome = h.indexOf('local_nome');
  const agora = new Date();

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iStt]).trim() !== 'ACEITO') continue;
    const userId = String(data[r][iUsr]).trim(); if (!userId) continue;
    const dataSlot = String(data[r][iData]).substring(0, 10), inicioStr = String(data[r][iIni]).substring(0, 5), fimStr = String(data[r][iFim]).substring(0, 5);
    if (!dataSlot || !inicioStr) continue;
    const slotDt = new Date(dataSlot + 'T' + inicioStr + ':00'), diffMin = (slotDt - agora) / 60000;
    // Janela maior: envia se estiver entre 5 min antes e 5 min depois do início do slot
    if (diffMin < -5 || diffMin > 5) continue;

    const tgId = getTelegramUserId_(ss, userId);
    if (tgId) {
      const payload = { canal:'telegram', tipo:'private_message', telegram_user_id:tgId, parse_mode:'HTML', text_html:`🔔 <b>Hora do seu slot!</b>\n\n📍 <b>${String(data[r][iNome]).trim()}</b>\n🕐 ${inicioStr} – ${fimStr}\n\nAbra o app para fazer seu check-in.` };
      processIntegracoes([payload], { evento:'CHECKIN_REMINDER' });
      botSetSession_({ telegram_user_id:tgId, estado:'AWAITING_CHECKIN_LOCATION', payload:{ slot_id:String(data[r][iId]).trim(), jornada_id:String(data[r][iJrn]||'').trim(), user_id:userId } });
    }
  }
}

/**
 * Lembrete 10 minutos após o início se o check-in não foi feito.
 */
function triggerLembrete10Min() {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), ws = ss.getSheetByName('SLOTS');
  if (!ws) return;
  const data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim());
  const iId = h.indexOf('slot_id'), iUsr = h.indexOf('user_id'), iStt = h.indexOf('status'), iData = h.indexOf('data'), iIni = h.indexOf('inicio'), iNome = h.indexOf('local_nome');
  const agora = new Date();

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iStt]).trim() !== 'ACEITO') continue;
    const userId = String(data[r][iUsr]).trim(); if (!userId) continue;
    
    const dataSlot = String(data[r][iData]).substring(0, 10), inicioStr = String(data[r][iIni]).substring(0, 5);
    if (!dataSlot || !inicioStr) continue;
    
    const slotDt = new Date(dataSlot + 'T' + inicioStr + ':00');
    const diffMin = (agora - slotDt) / 60000;
    
    // Dispara se estiver entre 10 e 15 minutos de atraso
    if (diffMin >= 10 && diffMin < 15) {
      const tgId = getTelegramUserId_(ss, userId);
      if (tgId) {
        UrlFetchApp.fetch(getConfig_('cloud_run_url') + '/internal/send-checkin-reminder', {
          method: 'post', contentType: 'application/json',
          payload: JSON.stringify({
            integration_secret: getConfig_('integration_secret'),
            telegram_user_id: tgId,
            slot_id: String(data[r][iId]).trim(),
            local_nome: String(data[r][iNome]).trim(),
            inicio: inicioStr,
            tipo: 'LEMBRETE_10MIN'
          }),
          muteHttpExceptions: true
        });
      }
    }
  }
}

/**
 * Lembrete de Checkout no horário previsto de término.
 */
function triggerCheckoutLembrete() {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), ws = ss.getSheetByName('SLOTS');
  if (!ws) return;
  const data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim());
  const iId = h.indexOf('slot_id'), iUsr = h.indexOf('user_id'), iStt = h.indexOf('status'), iData = h.indexOf('data'), iFim = h.indexOf('fim'), iNome = h.indexOf('local_nome');
  const agora = new Date();

  for (let r = 1; r < data.length; r++) {
    // Apenas para quem está em atividade ou pausado
    const status = String(data[r][iStt]).trim().toUpperCase();
    if (!['EM_ATIVIDADE', 'PAUSADO'].includes(status)) continue;
    
    const userId = String(data[r][iUsr]).trim(); if (!userId) continue;
    const dataSlot = String(data[r][iData]).substring(0, 10), fimStr = String(data[r][iFim]).substring(0, 5);
    if (!dataSlot || !fimStr) continue;
    
    const slotDt = new Date(dataSlot + 'T' + fimStr + ':00'), diffMin = (agora - slotDt) / 60000;
    
    // Dispara no minuto exato do fim (janela de ±5 min)
    if (diffMin > -5 && diffMin < 5) {
      const tgId = getTelegramUserId_(ss, userId);
      if (tgId) {
        processIntegracoes([{
          canal: 'telegram', tipo: 'private_message', telegram_user_id: tgId, parse_mode: 'HTML',
          text_html: '🏁 <b>Seu slot terminou!</b>\n\n📍 ' + String(data[r][iNome]).trim() + '\n\nNão esqueça de realizar o <b>checkout</b> pelo app para garantir sua pontuação e evitar o auto-encerramento com penalidade.'
        }], { evento: 'CHECKOUT_REMINDER' });
      }
    }
  }
}

/**
 * Auditoria de Confirmação (T-45): Alerta supervisor se o promotor não respondeu ao aviso de T-90.
 */
function triggerAuditoriaConfirmacao() {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const wsConf = ss.getSheetByName('PRE_JORNADA_CONFIRMACOES');
  if (!wsConf) return;
  
  const dataConf = wsConf.getDataRange().getValues(), hConf = dataConf[0].map(v => String(v).toLowerCase().trim());
  const iId = hConf.indexOf('confirmacao_id'), iStt = hConf.indexOf('status'), iSlt = hConf.indexOf('slot_id'), iUsr = hConf.indexOf('user_id'), iCid = hConf.indexOf('cidade');
  const agora = new Date();

  for (let r = 1; r < dataConf.length; r++) {
    if (String(dataConf[r][iStt]).trim() !== 'PENDENTE') continue;
    
    const slotId = String(dataConf[r][iSlt]);
    const slot = getSlot_(ss, slotId);
    if (!slot || slot.status !== 'ACEITO') continue;

    const dataSlot = String(slot.data).substring(0, 10), inicioStr = String(slot.inicio).substring(0, 5);
    const slotDt = new Date(dataSlot + 'T' + inicioStr + ':00');
    const diffMin = (slotDt - agora) / 60000;

    // Se falta menos de 45 minutos e ainda está pendente
    if (diffMin <= 45 && diffMin > 0) {
      const tgAlertaKey = 'AUDIT_CONF_' + slotId;
      const jaAlertado = PropertiesService.getScriptProperties().getProperty(tgAlertaKey);
      if (jaAlertado) continue;

      const promId = String(dataConf[r][iUsr]);
      const promMap = _getPromotoresMap_(ss);
      const prom = promMap[promId] || { nome: promId };
      
      processIntegracoes([{
        canal: 'telegram', tipo: 'group_message',
        cidade: String(dataConf[r][iCid]),
        topic_key: 'ALERTAS',
        parse_mode: 'HTML',
        text_html: '⚠️ <b>CONFIRMAÇÃO PENDENTE (T-45)</b>\n\nO promotor ainda não respondeu ao chamado de 90min.\n\n👤 <b>' + (prom.nome) + '</b>\n📍 ' + (slot.local_nome || slot.local) + '\n⏰ Início em: ' + inicioStr + '\n\n<i>Risco de no-show detectado.</i>'
      }], { evento: 'AUDITORIA_PRE_JORNADA' });

      PropertiesService.getScriptProperties().setProperty(tgAlertaKey, 'true');
    }
  }
}

/**
 * Lembrete de Pausa Longa: Avisa promotor se ele estiver em pausa há mais de 60 minutos.
 */
function triggerLembretePausa() {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const wsJ = ss.getSheetByName('JORNADAS');
  if (!wsJ) return;
  
  const dataJ = wsJ.getDataRange().getValues(), hJ = dataJ[0].map(v => String(v).toLowerCase().trim());
  const iStt = hJ.indexOf('status'), iUpd = hJ.indexOf('atualizado_em'), iUsr = hJ.indexOf('user_id');
  const agora = new Date();

  for (let r = 1; r < dataJ.length; r++) {
    if (String(dataJ[r][iStt]).trim() !== 'PAUSADO') continue;
    
    const ultimaAtu = new Date(dataJ[r][iUpd]);
    if (isNaN(ultimaAtu.getTime())) continue;
    const diffMin = (agora - ultimaAtu) / 60000;

    // Se está pausado há mais de 60 minutos (janela de 60 a 75 min para evitar flood)
    if (diffMin >= 60 && diffMin < 75) {
      const userId = String(dataJ[r][iUsr]);
      const tgId = getTelegramUserId_(ss, userId);
      if (tgId) {
        processIntegracoes([{
          canal: 'telegram', tipo: 'private_message', telegram_user_id: tgId, parse_mode: 'HTML',
          text_html: '☕ <b>Lembrete de Pausa</b>\n\nVocê está em pausa há mais de 60 minutos. Não esqueça de retornar ao trabalho e registrar o fim da pausa no app para evitar divergências na sua jornada.'
        }], { evento: 'PAUSA_LONGA_REMINDER' });
      }
    }
  }
}
