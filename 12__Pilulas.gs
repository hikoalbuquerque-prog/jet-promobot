// ============================================================
//  12.Pilulas.gs  — Pílulas diárias de conhecimento (Telegram)
//  Versão: 3.0  |  Inteligência, Streak e Cache de Elite
// ============================================================

/**
 * Disparador diário: Envia pílulas personalizadas para cada promotor.
 */
function enviarPilulasHoje() {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const wsPro = ss.getSheetByName('PROMOTORES');
  const wsProg = ss.getSheetByName('ACADEMY_PROGRESSO');
  if (!wsPro || !wsProg) return;

  const hoje = new Date().toISOString().split('T')[0];
  const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const diaSemana = new Date().getDay();
  if (diaSemana === 0 || diaSemana === 6) return; // Não envia fds

  // 1. Buscar Pool de Quizzes via Cache (Item 4)
  const poolQuizzes = getPoolQuizzesFromCache_();
  if (!poolQuizzes || Object.keys(poolQuizzes).length === 0) return;

  const dataPro = wsPro.getDataRange().getValues(), hP = dataPro[0].map(v => String(v).toLowerCase().trim());
  const dataProg = wsProg.getDataRange().getValues();
  
  const iTgId = hP.indexOf('telegram_user_id'), iUserId = hP.indexOf('user_id'), iStatus = hP.indexOf('status');
  const prop = PropertiesService.getScriptProperties();

  for (let r = 1; r < dataPro.length; r++) {
    const status = String(dataPro[r][iStatus] || '').trim().toUpperCase();
    const userId = String(dataPro[r][iUserId]).trim();
    const tgId = String(dataPro[r][iTgId] || '').trim();
    if (!tgId || status === 'INATIVO' || status === 'BLOQUEADO') continue;

    // 2. Personalização (Item 1)
    const concluidos = dataProg.filter(row => String(row[0]).trim() === userId).map(row => String(row[1]).trim());
    const pilulasUser = escolherPilulasSmart_(poolQuizzes, concluidos);
    
    // Salvar pílulas específicas do usuário para hoje
    prop.setProperty(`PILULAS_USER_${userId}_${hoje}`, JSON.stringify(pilulasUser));
    prop.setProperty(`PILULA_ESTADO_${userId}_${hoje}`, JSON.stringify({ respondidas: 0, acertos: 0, concluida: false }));

    // 3. Enviar Primeira Questão
    const p = pilulasUser[0];
    const letras = ['a','b','c','d'];
    const teclado = p.opcoes.map((opt, i) => [{ 
      text: `${letras[i].toUpperCase()}. ${String(opt).substring(0, 35)}`, 
      callback_data: `PILULA_${hoje}_0_${letras[i]}_${userId}` 
    }]);
    
    const saudacao = concluidos.length > 25 ? "💎 Desafio Master" : "💊 Pílula de Conhecimento";
    const msg = `<b>${saudacao}</b>\n\n` +
                `Reforce seu conhecimento e ganhe pontos!\n\n` +
                `<b>1/3:</b> ${p.pergunta}`;

    processIntegracoes([{ 
      canal:'telegram', 
      tipo:'private_message', 
      telegram_user_id:tgId, 
      parse_mode:'HTML', 
      text_html: msg, 
      reply_markup: { inline_keyboard: teclado } 
    }], { evento:'PILULA_ENVIO' });

    Utilities.sleep(150); // Evitar flood
  }
}

/**
 * Processa a resposta do usuário e gerencia score/streak.
 */
function processarPilulaResposta_(body) {
  const { usuario_id, data_pilula, questao_idx, resposta } = body;
  const prop = PropertiesService.getScriptProperties();
  const hoje = data_pilula;
  
  const pilulas = JSON.parse(prop.getProperty(`PILULAS_USER_${usuario_id}_${hoje}`) || '[]');
  const estado = JSON.parse(prop.getProperty(`PILULA_ESTADO_${usuario_id}_${hoje}`) || '{"respondidas":0,"acertos":0,"concluida":false}');
  
  if (estado.concluida) return { ok: true, ja_concluida: true };

  const pilula = pilulas[questao_idx];
  if (!pilula) return { ok: false, erro: 'Questão não encontrada' };

  const acertou = resposta.toLowerCase() === String(pilula.correta).toLowerCase();
  if (acertou) estado.acertos++;
  estado.respondidas++;

  const user = getPromotorById_(SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), usuario_id);
  const feedback = acertou ? '✅ <b>Correto!</b>' : `❌ <b>Incorreto.</b> A resposta certa era: <b>${pilula.correta.toUpperCase()}</b>`;

  if (questao_idx < 2) {
    const prox = pilulas[questao_idx + 1];
    const letras = ['a','b','c','d'];
    const teclado = prox.opcoes.map((opt, i) => [{ 
      text: `${letras[i].toUpperCase()}. ${String(opt).substring(0, 35)}`, 
      callback_data: `PILULA_${hoje}_${questao_idx+1}_${letras[i]}_${usuario_id}` 
    }]);

    processIntegracoes([{ 
      canal:'telegram', 
      tipo:'private_message', 
      telegram_user_id:user.telegram_user_id, 
      parse_mode:'HTML', 
      text_html:`${feedback}\n\n<b>${questao_idx+2}/3:</b> ${prox.pergunta}`, 
      reply_markup: { inline_keyboard: teclado } 
    }], { evento:'PILULA_PROXIMA' });
  } else {
    // FIM DO CICLO DE HOJE
    estado.concluida = true;
    const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
    
    // Score por acerto total (Item 2)
    let ptsGanhos = 0;
    let msgFinal = `${feedback}\n\n🏁 <b>Pílulas de hoje concluídas!</b>\nVocê acertou ${estado.acertos}/3.`;

    if (estado.acertos === 3) {
      ptsGanhos += 5;
      registrarScore_(ss, usuario_id, 'PILULA_DIARIA', 5, 'Gabaritou pílulas do dia (3/3)', hoje);
      msgFinal += `\n🌟 <b>+5 pontos por gabaritar!</b>`;
    }

    // Gerenciar Streak (Item 2)
    const streakKey = `STREAK_PILULA_${usuario_id}`;
    let streak = parseInt(prop.getProperty(streakKey) || '0');
    const ultimaData = prop.getProperty(`LAST_PILULA_${usuario_id}`);
    const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (ultimaData === ontem) {
      streak++;
    } else {
      streak = 1;
    }
    prop.setProperty(streakKey, streak.toString());
    prop.setProperty(`LAST_PILULA_${usuario_id}`, hoje);

    if (streak > 1) msgFinal += `\n🔥 <b>Fogo alto!</b> ${streak} dias seguidos.`;
    
    if (streak % 5 === 0) {
      ptsGanhos += 5;
      registrarScore_(ss, usuario_id, 'PILULA_STREAK', 5, `Bônus Streak ${streak} dias`, hoje);
      msgFinal += `\n🎁 <b>BÔNUS: +5 pontos por 5 dias seguidos!</b>`;
    }

    processIntegracoes([{ 
      canal:'telegram', 
      tipo:'private_message', 
      telegram_user_id:user.telegram_user_id, 
      parse_mode:'HTML', 
      text_html: msgFinal 
    }], { evento:'PILULA_FIM' });
  }

  prop.setProperty(`PILULA_ESTADO_${usuario_id}_${hoje}`, JSON.stringify(estado));
  return { ok: true, acertou, concluida: estado.concluida };
}

/**
 * Escolhe 3 pílulas baseadas no progresso do usuário.
 */
function escolherPilulasSmart_(pool, concluidos) {
  const todas = [];
  Object.keys(pool).forEach(qid => {
    pool[qid].forEach(q => {
      todas.push({
        quiz_id: qid,
        pergunta: q.pergunta,
        opcoes: [q.a, q.b, q.c, q.d].filter(Boolean),
        correta: q.correta
      });
    });
  });

  // Priorizar perguntas de módulos NÃO concluídos
  const pendentes = todas.filter(p => !concluidos.includes(p.quiz_id));
  
  let selecionadas = [];
  if (pendentes.length >= 3) {
    selecionadas = pendentes.sort(() => 0.5 - Math.random()).slice(0, 3);
  } else {
    // Se terminou tudo ou quase tudo, mistura pendentes com Master/Especialista
    const masterPool = todas.filter(p => p.quiz_id.startsWith('MAS-') || p.quiz_id.startsWith('ESP-'));
    selecionadas = [...pendentes, ...masterPool].sort(() => 0.5 - Math.random()).slice(0, 3);
  }

  // Fallback final se pool estiver vazio (não deve acontecer)
  if (selecionadas.length < 3) selecionadas = todas.sort(() => 0.5 - Math.random()).slice(0, 3);
  
  return selecionadas;
}

/**
 * Busca os quizzes do Cloud Cache.
 */
function getPoolQuizzesFromCache_() {
  try {
    const url = getConfig_('cloud_run_url') + '/internal/get-academy-cache';
    const res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + getConfig_('integration_secret') }, // Se houver auth simples
      muteHttpExceptions: true
    });
    const data = JSON.parse(res.getContentText());
    return data.quizzes || {};
  } catch(e) {
    // Fallback: ler da planilha se o cache falhar
    const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
    const wsQ = ss.getSheetByName('QUIZ');
    if (!wsQ) return {};
    const dataQ = wsQ.getDataRange().getValues(), hQ = dataQ[0].map(v => String(v).toLowerCase().trim());
    const quizzes = {};
    for (let r = 1; r < dataQ.length; r++) {
      const qid = String(dataQ[r][hQ.indexOf('quiz_id')]).trim();
      if (!quizzes[qid]) quizzes[qid] = [];
      quizzes[qid].push(rowToObj_(hQ, dataQ[r]));
    }
    return quizzes;
  }
}
