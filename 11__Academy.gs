// ============================================================
//  11.Academy.gs  — Gestão de Trilhas e Módulos
//  Versão: 2.1  |  Fase 3 — Integrado com Gamificação
// ============================================================

function getAcademyTrilha_(user) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const wsMod = ss.getSheetByName('MODULOS');
  const wsProg = ss.getSheetByName('ACADEMY_PROGRESSO');
  if (!wsMod) return { ok: false, erro: 'Aba MODULOS nao encontrada' };

  const dataMod = wsMod.getDataRange().getValues(), hM = dataMod[0].map(v => String(v).toLowerCase().trim());
  const iId = hM.indexOf('modulo_id'), iNivel = hM.indexOf('nivel'), iOrdem = hM.indexOf('ordem'), iTitulo = hM.indexOf('titulo'), iAtivo = hM.indexOf('ativo'), iPts = hM.indexOf('pontos'), iPreReq = hM.indexOf('pre_req_json');

  const concluidos = new Set();
  if (wsProg) {
    const dataP = wsProg.getDataRange().getValues(), hP = dataP[0].map(v => String(v).toLowerCase().trim());
    const iUsr = hP.indexOf('user_id'), iMod = hP.indexOf('modulo_id'), iConc = hP.indexOf('concluido');
    for (let r = 1; r < dataP.length; r++) { if (String(dataP[r][iUsr]).trim() === user.user_id && String(dataP[r][iConc]).trim().toUpperCase() === 'TRUE') concluidos.add(String(dataP[r][iMod]).trim()); }
  }

  const modulos = [];
  for (let r = 1; r < dataMod.length; r++) {
    if (String(dataMod[r][iAtivo]).trim().toUpperCase() !== 'TRUE') continue;
    const modId = String(dataMod[r][iId]).trim(), preReq = dataMod[r][iPreReq] ? JSON.parse(String(dataMod[r][iPreReq])) : {};
    const mustComplete = preReq.must_complete_modulos || [], desbloqueado = mustComplete.every(m => concluidos.has(m));
    modulos.push({ modulo_id:modId, nivel:String(dataMod[r][iNivel]), ordem:parseInt(dataMod[r][iOrdem]||0), titulo:String(dataMod[r][iTitulo]), pontos:parseInt(dataMod[r][iPts]||0), concluido:concluidos.has(modId), desbloqueado:mustComplete.length === 0 || desbloqueado });
  }

  const nivelOrd = { BASICO:0, INTERMEDIARIO:1, AVANCADO:2, ESPECIALISTA:3, MASTER:4 };
  modulos.sort((a, b) => (nivelOrd[a.nivel] || 9) - (nivelOrd[b.nivel] || 9) || a.ordem - b.ordem);
  
  return { 
    ok: true, 
    modulos, 
    total_concluidos: concluidos.size,
    progresso_ids: Array.from(concluidos) 
  };
}

function getAcademyModulo_(params, user) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), wsMod = ss.getSheetByName('MODULOS'), wsQuiz = ss.getSheetByName('QUIZ');
  const modId = params.modulo_id || ''; if (!modId) return { ok: false, erro: 'modulo_id obrigatorio' };
  const dataMod = wsMod.getDataRange().getValues(), hM = dataMod[0].map(v => String(v).toLowerCase().trim());
  let modulo = null;
  for (let r = 1; r < dataMod.length; r++) {
    if (String(dataMod[r][hM.indexOf('modulo_id')]).trim() === modId) {
      modulo = { modulo_id:modId, titulo:String(dataMod[r][hM.indexOf('titulo')]), pontos:parseInt(dataMod[r][hM.indexOf('pontos')]||0), rules:JSON.parse(String(dataMod[r][hM.indexOf('rules_json')]||'{}')), blocks:JSON.parse(String(dataMod[r][hM.indexOf('blocks_json')]||'[]')) };
      break;
    }
  }
  if (!modulo) return { ok: false, erro: 'Modulo nao encontrado' };

  const quizIds = new Set();
  modulo.blocks.forEach(b => { if (b.quiz_id || b.type === 'quiz') quizIds.add(b.quiz_id); });
  const quizzes = {};
  if (wsQuiz && quizIds.size > 0) {
    const dataQ = wsQuiz.getDataRange().getValues(), hQ = dataQ[0].map(v => String(v).toLowerCase().trim());
    for (let r = 1; r < dataQ.length; r++) {
      const qid = String(dataQ[r][hQ.indexOf('quiz_id')]).trim(); if (!quizIds.has(qid)) continue;
      if (!quizzes[qid]) quizzes[qid] = [];
      quizzes[qid].push({ q_id:String(dataQ[r][hQ.indexOf('q_id')]), pergunta:String(dataQ[r][hQ.indexOf('pergunta')]), opcoes:[dataQ[r][hQ.indexOf('a')], dataQ[r][hQ.indexOf('b')], dataQ[r][hQ.indexOf('c')], dataQ[r][hQ.indexOf('d')]].filter(Boolean), correta:String(dataQ[r][hQ.indexOf('correta')]).trim(), pontos:parseInt(dataQ[r][hQ.indexOf('pontos')]||1) });
    }
  }
  modulo.quizzes = quizzes;
  return { ok: true, modulo };
}

function getAcademyProgresso_(user) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), ws = ss.getSheetByName('ACADEMY_PROGRESSO');
  if (!ws) return { ok: true, progresso: [] };
  const data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim());
  const prog = [];
  for (let r = 1; r < data.length; r++) { if (String(data[r][h.indexOf('user_id')]).trim() === user.user_id) prog.push({ modulo_id:String(data[r][h.indexOf('modulo_id')]), concluido:String(data[r][h.indexOf('concluido')]) === 'TRUE', score_quiz:data[r][h.indexOf('score_quiz')], concluido_em:String(data[r][h.indexOf('concluido_em')]) }); }
  return { ok: true, progresso: prog };
}

function concluirModulo_(user, body) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), modId = body.modulo_id || '', scoreQuiz = parseInt(body.score_quiz || 0), pontos = parseInt(body.pontos || 0);
  if (!modId) return { ok: false, erro: 'modulo_id obrigatorio' };
  const ws = ss.getSheetByName('ACADEMY_PROGRESSO');
  const data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim());
  for (let r = 1; r < data.length; r++) { if (String(data[r][h.indexOf('user_id')]).trim() === user.user_id && String(data[r][h.indexOf('modulo_id')]).trim() === modId && String(data[r][h.indexOf('concluido')]).trim().toUpperCase() === 'TRUE') return { ok: true, ja_concluido: true }; }
  ws.appendRow([user.user_id, modId, 'TRUE', scoreQuiz, new Date().toISOString()]);
  registrarScore_(ss, user.user_id, 'ACADEMY_MODULO', pontos, 'Academy: ' + modId, modId);
  return { ok: true, pontos_ganhos: pontos, score_quiz: scoreQuiz };
}

/**
 * Sincroniza os módulos e quizzes com o Cloud Run para carregamento instantâneo.
 */
function sincronizarAcademyCache_() {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  
  // 1. Pega módulos (simulando um user fake apenas para pegar a estrutura)
  const resTrilha = getAcademyTrilha_({ user_id: 'SYSTEM' });
  
  // 2. Pega todos os Quizzes da aba QUIZ
  const wsQuiz = ss.getSheetByName('QUIZ');
  const quizzes = {};
  if (wsQuiz) {
    const dataQ = wsQuiz.getDataRange().getValues();
    const hQ    = dataQ[0].map(v => String(v).toLowerCase().trim());
    const iQId  = hQ.indexOf('quiz_id');
    for (let r = 1; r < dataQ.length; r++) {
      const qid = String(dataQ[r][iQId]).trim();
      if (!qid) continue;
      if (!quizzes[qid]) quizzes[qid] = [];
      quizzes[qid].push({
        q_id:String(dataQ[r][hQ.indexOf('q_id')]),
        pergunta:String(dataQ[r][hQ.indexOf('pergunta')]),
        opcoes:[dataQ[r][hQ.indexOf('a')], dataQ[r][hQ.indexOf('b')], dataQ[r][hQ.indexOf('c')], dataQ[r][hQ.indexOf('d')]].filter(Boolean),
        correta:String(dataQ[r][hQ.indexOf('correta')]).trim(),
        pontos:parseInt(dataQ[r][hQ.indexOf('pontos')]||1)
      });
    }
  }

  const url = getConfig_('cloud_run_url') + '/internal/sync-academy';
  const payload = {
    integration_secret: getConfig_('integration_secret'),
    modulos: resTrilha.modulos,
    quizzes: quizzes
  };

  try {
    UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    console.log('Cache do Academy sincronizado!');
  } catch (e) {
    console.log('Erro ao sincronizar Academy:', e.message);
  }
}