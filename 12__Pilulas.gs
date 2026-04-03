// ============================================================
//  12.Pilulas.gs  — Pílulas diárias de conhecimento (Telegram)
//  Versão: 2.1  |  Fase 3 — Integrado com Cloud Run
// ============================================================

function enviarPilulasHoje() {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), wsQ = ss.getSheetByName('QUIZ'), wsPro = ss.getSheetByName('PROMOTORES');
  if (!wsQ || !wsPro) return;

  const hoje = new Date().toISOString().split('T')[0], diaSemana = new Date().getDay();
  if (diaSemana === 0 || diaSemana === 6) return;

  const dataQ = wsQ.getDataRange().getValues(), hQ = dataQ[0].map(v => String(v).toLowerCase().trim());
  const todasPergs = [];
  for (let r = 1; r < dataQ.length; r++) {
    const opcoes = [dataQ[r][hQ.indexOf('a')], dataQ[r][hQ.indexOf('b')], dataQ[r][hQ.indexOf('c')], dataQ[r][hQ.indexOf('d')]].filter(Boolean);
    if (opcoes.length < 2) continue;
    todasPergs.push({ quiz_id:String(dataQ[r][hQ.indexOf('quiz_id')]), q_id:String(dataQ[r][hQ.indexOf('q_id')]), pergunta:String(dataQ[r][hQ.indexOf('pergunta')]), opcoes:opcoes, correta:String(dataQ[r][hQ.indexOf('correta')]).trim() });
  }

  const pilulas = todasPergs.sort(() => 0.5 - Math.random()).slice(0, 3);
  const prop = PropertiesService.getScriptProperties();
  prop.setProperty('PILULAS_HOJE_' + hoje, JSON.stringify(pilulas));

  const dataPro = wsPro.getDataRange().getValues(), hP = dataPro[0].map(v => String(v).toLowerCase().trim());
  const iTgId = hP.indexOf('telegram_user_id'), iUserId = hP.indexOf('user_id'), iStatus = hP.indexOf('status'), p = pilulas[0], letras = ['a','b','c','d'];

  for (let r = 1; r < dataPro.length; r++) {
    const tgId = String(dataPro[r][iTgId] || '').trim(), status = String(dataPro[r][iStatus] || '').trim(), userId = String(dataPro[r][iUserId]).trim();
    if (!tgId || status === 'INATIVO') continue;

    prop.setProperty('PILULA_' + userId + '_' + hoje, JSON.stringify({ respondidas: 0, acertos: 0, concluida: false }));
    const teclado = p.opcoes.map((opt, i) => [{ text: letras[i].toUpperCase() + '. ' + String(opt).substring(0, 30), callback_data: `PILULA_${hoje}_0_${letras[i]}_${userId}` }]);
    
    processIntegracoes([{ canal:'telegram', tipo:'private_message', telegram_user_id:tgId, parse_mode:'HTML', text_html:`<b>💊 Pílula do Dia</b>\n\n<b>1/3</b> ${p.pergunta}`, reply_markup: { inline_keyboard: teclado } }], { evento:'PILULA_ENVIO' });
    Utilities.sleep(100);
  }
}

function processarPilulaResposta_(body) {
  const { usuario_id, data_pilula, questao_idx, resposta } = body;
  const prop = PropertiesService.getScriptProperties(), pilulas = JSON.parse(prop.getProperty('PILULAS_HOJE_' + data_pilula) || '[]');
  const estado = JSON.parse(prop.getProperty('PILULA_' + usuario_id + '_' + data_pilula) || '{"respondidas":0,"acertos":0,"concluida":false}');
  if (estado.concluida) return { ok: true, ja_concluida: true };

  const pilula = pilulas[questao_idx]; if (!pilula) return { ok: false, erro: 'Questão não encontrada' };
  const acertou = resposta === pilula.correta; if (acertou) estado.acertos++; estado.respondidas++;

  const user = getPromotorById_(SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), usuario_id);
  const feedback = acertou ? '✅ <b>Correto!</b>' : `❌ <b>Incorreto.</b> A resposta era: ${pilula.correta.toUpperCase()}`;

  if (questao_idx < 2) {
    const prox = pilulas[questao_idx + 1], letras = ['a','b','c','d'];
    const teclado = prox.opcoes.map((opt, i) => [{ text: letras[i].toUpperCase() + '. ' + String(opt).substring(0, 30), callback_data: `PILULA_${data_pilula}_${questao_idx+1}_${letras[i]}_${usuario_id}` }]);
    processIntegracoes([{ canal:'telegram', tipo:'private_message', telegram_user_id:user.telegram_user_id, parse_mode:'HTML', text_html:`${feedback}\n\n<b>${questao_idx+2}/3</b> ${prox.pergunta}`, reply_markup: { inline_keyboard: teclado } }], { evento:'PILULA_PROXIMA' });
  } else {
    estado.concluida = true;
    const pts = estado.acertos === 3 ? 5 : 0;
    if (pts > 0) registrarScore_(SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), usuario_id, 'PILULA_DIARIA', pts, 'Pílula concluída com 3 acertos', data_pilula);
    processIntegracoes([{ canal:'telegram', tipo:'private_message', telegram_user_id:user.telegram_user_id, parse_mode:'HTML', text_html:`${feedback}\n\n🏁 <b>Pílulas de hoje concluídas!</b>\nVocê acertou ${estado.acertos}/3.${pts>0 ? '\n🌟 <b>+5 pontos ganhos!</b>' : ''}` }], { evento:'PILULA_FIM' });
  }

  prop.setProperty('PILULA_' + usuario_id + '_' + data_pilula, JSON.stringify(estado));
  return { ok: true, acertou, concluida: estado.concluida };
}

function broadcastPromotor_(body) {
  const { mensagem, cidade, cargo } = body;
  if (!mensagem) return { ok: false, erro: 'Mensagem obrigatória' };

  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const wsPro = ss.getSheetByName('PROMOTORES');
  const dataPro = wsPro.getDataRange().getValues();
  const hP = dataPro[0].map(v => String(v).toLowerCase().trim());
  
  const iTg = hP.indexOf('telegram_user_id'), iSt = hP.indexOf('status');
  const iCid = hP.indexOf('cidade_base'), iCar = hP.indexOf('cargo_principal');

  let enviados = 0;
  for (let r = 1; r < dataPro.length; r++) {
    const tgId = String(dataPro[r][iTg] || '').trim();
    if (!tgId) continue;

    // Filtros de Status
    const status = String(dataPro[r][iSt]).trim().toUpperCase();
    if (status === 'INATIVO' || status === 'BLOQUEADO') continue;

    // Filtro de Cidade (Opcional)
    if (cidade && normStr_(dataPro[r][iCid]) !== normStr_(cidade)) continue;

    // Filtro de Cargo (Opcional)
    if (cargo && String(dataPro[r][iCar]).trim().toUpperCase() !== String(cargo).trim().toUpperCase()) continue;

    processIntegracoes([{
      canal: 'telegram',
      tipo: 'private_message',
      telegram_user_id: tgId,
      parse_mode: 'HTML',
      text_html: mensagem
    }], { evento: 'BROADCAST' });

    enviados++;
    Utilities.sleep(100); 
  }
  return { ok: true, enviados };
}

function getPilulaHoje_(user) {
  const hoje = new Date().toISOString().split('T')[0], prop = PropertiesService.getScriptProperties();
  return { ok: true, pilulas: JSON.parse(prop.getProperty('PILULAS_HOJE_' + hoje) || '[]'), estado: JSON.parse(prop.getProperty('PILULA_' + user.user_id + '_' + hoje) || '{"respondidas":0,"acertos":0,"concluida":false}'), hoje };
}