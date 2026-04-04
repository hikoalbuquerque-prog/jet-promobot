// ============================================================
//  11.Academy.gs — Trilha Integral JET Academy (Carga Completa)
// ============================================================

function getAcademyTrilha_(user) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const wsMod = ss.getSheetByName('MODULOS'), wsProg = ss.getSheetByName('ACADEMY_PROGRESSO');
  if (!wsMod || !wsProg) return { ok: false, erro: 'Abas do Academy não encontradas' };
  const dataMod = wsMod.getDataRange().getValues(), hMod = dataMod[0].map(v => String(v).toLowerCase().trim());
  const dataProg = wsProg.getDataRange().getValues();
  const concluidos = new Set();
  for (let r = 1; r < dataProg.length; r++) { if (String(dataProg[r][0]).trim() === user.user_id) concluidos.add(String(dataProg[r][1]).trim()); }
  
  const modulosRaw = [];
  for (let r = 1; r < dataMod.length; r++) { if (String(dataMod[r][hMod.indexOf('ativo')]).toUpperCase() === 'TRUE') modulosRaw.push(rowToObj_(hMod, dataMod[r])); }
  
  const ordemNiveis = ['MANUAL APP', 'BASICO', 'INTERMEDIARIO', 'AVANCADO', 'ESPECIALISTA', 'MASTER'];
  modulosRaw.sort((a, b) => {
    const na = ordemNiveis.indexOf(a.nivel), nb = ordemNiveis.indexOf(b.nivel);
    if (na !== nb) return na - nb;
    return parseInt(a.ordem || 0) - parseInt(b.ordem || 0);
  });

  const trilha = [];
  modulosRaw.forEach((m, idx) => {
    const isConcluido = concluidos.has(m.modulo_id);
    let isDesbloqueado = false;
    if (idx === 0) isDesbloqueado = true;
    else {
      const reqs = m.pre_requisitos_json ? JSON.parse(m.pre_requisitos_json) : {};
      if (reqs.must_complete_modulos && reqs.must_complete_modulos.length) isDesbloqueado = reqs.must_complete_modulos.every(id => concluidos.has(id));
      else isDesbloqueado = concluidos.has(modulosRaw[idx - 1].modulo_id);
    }
    trilha.push({ modulo_id: m.modulo_id, nivel: m.nivel, titulo: m.titulo, pontos: m.pontos, concluido: isConcluido, desbloqueado: isDesbloqueado });
  });
  return { ok: true, modulos: trilha };
}

function getAcademyModulo_(params, user) {
  const moduloId = params.modulo_id, ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const wsMod = ss.getSheetByName('MODULOS'), wsQuiz = ss.getSheetByName('QUIZ');
  const dataMod = wsMod.getDataRange().getValues(), hMod = dataMod[0].map(v => String(v).toLowerCase().trim());
  let modulo = null;
  for (let r = 1; r < dataMod.length; r++) { if (String(dataMod[r][hMod.indexOf('modulo_id')]).trim() === moduloId) { modulo = rowToObj_(hMod, dataMod[r]); break; } }
  if (!modulo) return { ok: false, erro: 'Módulo não encontrado' };
  modulo.blocks = modulo.blocks_json ? JSON.parse(modulo.blocks_json) : [];
  
  const quizzesIds = modulo.blocks.filter(b => b.type === 'quiz').map(b => b.quiz_id);
  const quizzesData = {};
  if (quizzesIds.length > 0 && wsQuiz) {
    const dataQ = wsQuiz.getDataRange().getValues(), hQ = dataQ[0].map(v => String(v).toLowerCase().trim());
    quizzesIds.forEach(qid => {
      quizzesData[qid] = [];
      for (let r = 1; r < dataQ.length; r++) {
        if (String(dataQ[r][hQ.indexOf('quiz_id')]).trim() === qid) {
          const q = rowToObj_(hQ, dataQ[r]);
          quizzesData[qid].push({ pergunta: q.pergunta, a: q.a, b: q.b, c: q.c, d: q.d, correta: q.correta });
        }
      }
    });
  }
  modulo.quizzes = quizzesData;
  return { ok: true, modulo };
}

function concluirModulo_(user, body) {
  const { modulo_id, score_quiz, pontos } = body;
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), wsProg = ss.getSheetByName('ACADEMY_PROGRESSO');
  
  if (modulo_id.startsWith('APP-')) {
    const wsJor = ss.getSheetByName('JORNADAS');
    const dataJ = wsJor.getDataRange().getValues();
    const count = dataJ.filter(r => String(r[1]).trim() === user.user_id && String(r[4]).trim() === 'ENCERRADO').length;
    if (count < 3) return { ok: false, erro: '⚠️ Missão Bloqueada: complete pelo menos 3 jornadas reais no campo para finalizar este módulo.' };
  }

  wsProg.appendRow([user.user_id, modulo_id, score_quiz || 100, new Date().toISOString()]);
  if (pontos > 0) registrarScore_(ss, user.user_id, 'ACADEMY_CONCLUSAO', pontos, `Módulo ${modulo_id}`, '');
  verificarBadgesAcademy_(ss, user.user_id);
  return { ok: true };
}

function verificarBadgesAcademy_(ss, userId) {
  const wsProg = ss.getSheetByName('ACADEMY_PROGRESSO'), wsMod = ss.getSheetByName('MODULOS'), wsBadges = ss.getSheetByName('BADGES');
  const dP = wsProg.getDataRange().getValues(), dM = wsMod.getDataRange().getValues(), hM = dM[0].map(v => String(v).toLowerCase().trim());
  const concluidos = dP.filter(r => String(r[0]).trim() === userId).map(r => String(r[1]).trim());
  const niveis = ['MANUAL APP', 'BASICO', 'INTERMEDIARIO', 'AVANCADO', 'ESPECIALISTA', 'MASTER'];
  niveis.forEach(niv => {
    const modsNivel = dM.filter(r => String(r[hM.indexOf('nivel')]).trim() === niv).map(r => String(r[hM.indexOf('modulo_id')]).trim());
    if (modsNivel.length > 0 && modsNivel.every(id => concluidos.includes(id))) {
      const bTipo = 'ACADEMY_' + niv.replace(' ', '_');
      if (!wsBadges.getDataRange().getValues().some(r => r[0] === userId && r[1] === bTipo)) wsBadges.appendRow([userId, bTipo, 'Certificado ' + niv, new Date().toISOString()]);
    }
  });
}

function setupNovosModulosAcademy() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsMod = ss.getSheetByName('MODULOS'); wsMod.clear();
  wsMod.appendRow(["modulo_id", "nivel", "ordem", "titulo", "ativo", "pontos", "pre_requisitos_json", "config_conclusao_json", "blocks_json"]);

  const modulos = [
    ["APP-01", "MANUAL APP", 1, "Primeiro Acesso e Perfil", "TRUE", 10, "{}", "{}", JSON.stringify([{type:"welcome_screen",title:"Bem-vindo!",subtitle:"Aprenda a navegar."},{type:"text_md",value:"## Perfil\nVeja seu Score e Streak."},{type:"quiz",quiz_id:"APP-01"}])],
    ["APP-02", "MANUAL APP", 2, "Gestão de Vagas", "TRUE", 15, "{}", "{}", JSON.stringify([{type:"text_md",value:"## Vagas\nAceite em HOJE ou AMANHÃ."},{type:"quiz",quiz_id:"APP-02"}])],
    ["APP-03", "MANUAL APP", 3, "Check-in e Checkout", "TRUE", 20, "{}", "{}", JSON.stringify([{type:"text_md",value:"## GPS\nBata o ponto dentro do raio."},{type:"quiz",quiz_id:"APP-03"}])],
    ["APP-04", "MANUAL APP", 4, "Função Reforço", "TRUE", 15, "{}", "{}", JSON.stringify([{type:"text_md",value:"## Reforço\nBotão 'Vim Trabalhar' para extras."},{type:"quiz",quiz_id:"APP-04"}])],
    ["APP-05", "MANUAL APP", 5, "Suporte e Ranking", "TRUE", 10, "{}", "{}", JSON.stringify([{type:"text_md",value:"## SOS\nPeça ajuda e veja seu Rank."},{type:"quiz",quiz_id:"APP-05"}])],
    
    ["BAS-01", "BASICO", 1, "Quem é a JET", "TRUE", 10, "{\"must_complete_modulos\":[\"APP-05\"]}", "{}", JSON.stringify([{type:"text_md",value:"## JET\nMicromobilidade urbana."},{type:"quiz",quiz_id:"BAS-01"}])],
    ["BAS-02", "BASICO", 2, "Papel do Promotor", "TRUE", 10, "{}", "{}", JSON.stringify([{type:"text_md",value:"## Papel\nAbordar e vender."},{type:"quiz",quiz_id:"BAS-02"}])],
    ["BAS-03", "BASICO", 3, "Produtos JET", "TRUE", 15, "{}", "{}", JSON.stringify([{type:"text_md",value:"## Produtos\nCorrida, PLUS e Combos."},{type:"quiz",quiz_id:"BAS-03"}])],
    ["BAS-04", "BASICO", 4, "Foco no Combo", "TRUE", 15, "{}", "{}", JSON.stringify([{type:"text_md",value:"## Combo\nA oferta ideal."},{type:"quiz",quiz_id:"BAS-04"}])],
    ["BAS-FINAL", "BASICO", 99, "Prova do Básico", "TRUE", 25, "{}", "{}", JSON.stringify([{type:"quiz",quiz_id:"BAS-FINAL"}])],
    
    ["INT-01", "INTERMEDIARIO", 1, "Qualificação Rápida", "TRUE", 15, "{\"must_complete_modulos\":[\"BAS-FINAL\"]}", "{}", JSON.stringify([{type:"text_md",value:"## 3 Perguntas\nFrequencia, Motivo e Trajeto."},{type:"quiz",quiz_id:"INT-01"}])],
    ["INT-02", "INTERMEDIARIO", 2, "Fechamento A/B", "TRUE", 15, "{}", "{}", JSON.stringify([{type:"text_md",value:"## Fechamento\nOfereça escolha."},{type:"quiz",quiz_id:"INT-02"}])],
    ["INT-FINAL", "INTERMEDIARIO", 99, "Prova do Intermediário", "TRUE", 30, "{}", "{}", JSON.stringify([{type:"quiz",quiz_id:"INT-FINAL"}])]
  ];
  modulos.forEach(r => wsMod.appendRow(r));

  const wsQuiz = ss.getSheetByName('QUIZ'); wsQuiz.clear();
  wsQuiz.appendRow(["quiz_id", "q_id", "pergunta", "a", "b", "c", "d", "correta", "pontos"]);
  const perguntas = [
    ["APP-01", 1, "Como acessa o app?", "Email", "CPF/Nasc", "Celular", "Nome", "b", 1],
    ["APP-01", 2, "O que é o Streak?", "Pontos", "Dias seguidos", "Velocidade", "Bateria", "b", 1],
    ["APP-02", 1, "Onde reserva vaga?", "Home", "Aba Vagas", "WhatsApp", "Ligação", "b", 1],
    ["APP-03", 1, "GPS Falso causa?", "Mais pontos", "Bloqueio", "Nada", "Prêmio", "b", 1],
    ["BAS-01", 1, "O que é a JET?", "Patinetes", "Carros", "Bikes", "Bus", "a", 1],
    ["BAS-02", 1, "Papel do promotor?", "Limpeza", "Venda e Orientação", "Mecânica", "Nada", "b", 1],
    ["INT-01", 1, "Quantas perguntas na qualificação?", "1", "2", "3", "5", "c", 1]
  ];
  perguntas.forEach(r => wsQuiz.appendRow(r));
  
  if (typeof internalSyncAll === 'function') internalSyncAll();
  return "JET Academy Completa Carregada!";
}