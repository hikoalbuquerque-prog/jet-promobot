// ============================================================
//  11.Academy.gs — Trilha Integral JET Academy (33 Módulos)
// ============================================================

function getAcademyTrilha_(user) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const wsMod = ss.getSheetByName('MODULOS'), wsProg = ss.getSheetByName('ACADEMY_PROGRESSO');
  if (!wsMod || !wsProg) return { ok: false, erro: 'Abas do Academy não encontradas' };
  const dataMod = wsMod.getDataRange().getValues(), hMod = dataMod[0].map(v => String(v).toLowerCase().trim());
  const dataProg = wsProg.getDataRange().getValues(), hProg = dataProg[0].map(v => String(v).toLowerCase().trim());
  const concluidos = new Set();
  for (let r = 1; r < dataProg.length; r++) {
    if (String(dataProg[r][0]).trim() === user.user_id) concluidos.add(String(dataProg[r][1]).trim());
  }
  const modulosRaw = [];
  for (let r = 1; r < dataMod.length; r++) {
    if (String(dataMod[r][hMod.indexOf('ativo')]).toUpperCase() !== 'TRUE') continue;
    modulosRaw.push(rowToObj_(hMod, dataMod[r]));
  }
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
  
  // ── Verificação de Missão Operacional ──────────────────────
  if (modulo_id.startsWith('APP-')) {
    const wsJor = ss.getSheetByName('JORNADAS');
    const dataJ = wsJor.getDataRange().getValues();
    const count = dataJ.filter(r => String(r[1]).trim() === user.user_id && String(r[4]).trim() === 'ENCERRADO').length;
    if (count < 3) {
      return { ok: false, erro: '⚠️ Missão Bloqueada: você precisa completar pelo menos 3 jornadas reais no ponto para finalizar este módulo do App.' };
    }
  }

  const dataP = wsProg.getDataRange().getValues();
  for (let r = 1; r < dataP.length; r++) { if (String(dataP[r][0]).trim() === user.user_id && String(dataP[r][1]).trim() === modulo_id) return { ok: true, ja_concluido: true }; }
  wsProg.appendRow([user.user_id, modulo_id, score_quiz || 100, new Date().toISOString()]);
  if (pontos > 0) registrarScore_(ss, user.user_id, 'ACADEMY_CONCLUSAO', pontos, `Conclusão do módulo ${modulo_id}`, '');
  verificarBadgesAcademy_(ss, user.user_id);
  return { ok: true, ja_concluido: false };
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
      if (!wsBadges.getDataRange().getValues().some(r => r[0] === userId && r[1] === bTipo)) wsBadges.appendRow([userId, bTipo, 'Concluiu ' + niv, new Date().toISOString()]);
    }
  });
}

/**
 * CARGA INTEGRAL DE TODOS OS MÓDULOS ENVIADOS
 */
function setupNovosModulosAcademy() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsMod = ss.getSheetByName('MODULOS'); wsMod.clear();
  wsMod.appendRow(["modulo_id", "nivel", "ordem", "titulo", "ativo", "pontos", "pre_requisitos_json", "config_conclusao_json", "blocks_json"]);

  const dataModulos = [
    // MANUAL APP
    ["APP-01", "MANUAL APP", 1, "Primeiro Acesso e Perfil", "TRUE", 10, "{}", "{}", JSON.stringify([{type:"welcome_screen",title:"Bem-vindo!",subtitle:"Aprenda a navegar no JET·OPS."},{type:"text_md",value:"## Perfil\nVeja seu Score e Streak na Home."},{type:"quiz",quiz_id:"APP-01"}])],
    ["APP-02", "MANUAL APP", 2, "Gestão de Vagas (Slots)", "TRUE", 15, "{}", "{}", JSON.stringify([{type:"text_md",value:"## Vagas\nAceite em HOJE ou AMANHÃ. Fique atento às SUGESTÕES do gestor."},{type:"quiz",quiz_id:"APP-02"}])],
    ["APP-03", "MANUAL APP", 3, "Check-in e Checkout (GPS)", "TRUE", 20, "{}", "{}", JSON.stringify([{type:"text_md",value:"## Ponto Eletrônico\nBata o ponto dentro do raio. Cuidado: GPS Falso gera bloqueio!"},{type:"quiz",quiz_id:"APP-03"}])],
    ["APP-04", "MANUAL APP", 4, "Função Reforço", "TRUE", 15, "{}", "{}", JSON.stringify([{type:"text_md",value:"## Vim Trabalhar\nInicie jornadas extras sem reserva prévia usando o botão de Reforço."},{type:"quiz",quiz_id:"APP-04"}])],
    ["APP-05", "MANUAL APP", 5, "Suporte e Ranking", "TRUE", 10, "{}", "{}", JSON.stringify([{type:"text_md",value:"## SOS e Fama\nPeça ajuda pelo SOS e acompanhe sua posição no Ranking."},{type:"quiz",quiz_id:"APP-05"}])],

    // BASICO (VENDAS)
    ["BAS-00", "BASICO", 1, "Bem-vindo a JET Academy", "TRUE", 5, "{\"must_complete_modulos\":[\"APP-05\"]}", "{}", JSON.stringify([{type:"text_md",value:"## Boas-vindas\nTreinamento oficial de vendas."}])],
    ["BAS-01", "BASICO", 2, "Quem e a JET e como funciona", "TRUE", 10, "{}", "{}", JSON.stringify([{type:"text_md",value:"## JET\nMicromobilidade urbana compartilhada."},{type:"quiz",quiz_id:"BAS-01"}])],
    ["BAS-02", "BASICO", 3, "O papel do promotor JET", "TRUE", 10, "{}", "{}", JSON.stringify([{type:"text_md",value:"## Papel\nAbordar, orientar e vender."},{type:"quiz",quiz_id:"BAS-02"}])],
    ["BAS-03", "BASICO", 4, "Produtos: PLUS e Combos", "TRUE", 15, "{}", "{}", JSON.stringify([{type:"text_md",value:"## Produtos\nPLUS (Assinatura) e Combos (PLUS+Minutos)."}])],
    ["BAS-04", "BASICO", 5, "Estrategia: Foco no Combo", "TRUE", 15, "{}", "{}", JSON.stringify([{type:"text_md",value:"## Estrategia\nOfereça sempre PLUS+200 primeiro."}])],
    ["BAS-FINAL", "BASICO", 99, "Prova do Basico", "TRUE", 25, "{}", "{}", JSON.stringify([{type:"quiz",quiz_id:"BAS-FINAL"}])],

    // INTERMEDIARIO
    ["INT-01", "INTERMEDIARIO", 1, "Qualificacao Rapida", "TRUE", 15, "{\"must_complete_modulos\":[\"BAS-FINAL\"]}", "{}", JSON.stringify([{type:"text_md",value:"## 3 Perguntas\nFrequencia, Motivo e Trajeto."}])],
    ["INT-02", "INTERMEDIARIO", 2, "Fechamento A/B", "TRUE", 15, "{}", "{}", JSON.stringify([{type:"text_md",value:"## Fechamento\nOfereça duas opções de escolha."}])],
    ["INT-FINAL", "INTERMEDIARIO", 99, "Prova do Intermediario", "TRUE", 25, "{}", "{}", JSON.stringify([{type:"quiz",quiz_id:"INT-FINAL"}] )],

    // AVANCADO
    ["AVA-01", "AVANCADO", 1, "Venda Consultiva", "TRUE", 20, "{\"must_complete_modulos\":[\"INT-FINAL\"]}", "{}", JSON.stringify([{type:"text_md",value:"## Consultoria\nConecte a rotina com a economia."}])],
    ["AVA-FINAL", "AVANCADO", 99, "Prova do Avancado", "TRUE", 30, "{}", "{}", JSON.stringify([{type:"quiz",quiz_id:"AVA-FINAL"}])],

    // ESPECIALISTA
    ["ESP-01", "ESPECIALISTA", 1, "Liderar pelo Exemplo", "TRUE", 30, "{\"must_complete_modulos\":[\"AVA-FINAL\"]}", "{}", JSON.stringify([{type:"text_md",value:"## Lideranca\nInfluencie o time pelo seu comportamento."}])],
    ["ESP-FINAL", "ESPECIALISTA", 99, "Prova do Especialista", "TRUE", 40, "{}", "{}", JSON.stringify([{type:"quiz",quiz_id:"ESP-FINAL"}])],

    // MASTER
    ["MAS-01", "MASTER", 1, "Formacao de Novos", "TRUE", 50, "{\"must_complete_modulos\":[\"ESP-FINAL\"]}", "{}", JSON.stringify([{type:"text_md",value:"## Onboarding\nTransforme novatos em vendedores."}])],
    ["MAS-FINAL", "MASTER", 99, "Prova do Master", "TRUE", 100, "{}", "{}", JSON.stringify([{type:"quiz",quiz_id:"MAS-FINAL"}])]
  ];

  dataModulos.forEach(r => wsMod.appendRow(r));

  const wsQuiz = ss.getSheetByName('QUIZ'); wsQuiz.clear();
  wsQuiz.appendRow(["quiz_id", "q_id", "pergunta", "a", "b", "c", "d", "correta", "pontos"]);
  const dataPerguntas = [
    ["APP-01", 1, "Como acessa o app?", "Email", "CPF/Nasc", "Celular", "Nome", "b", 1],
    ["APP-02", 1, "Onde reserva vaga?", "Home", "Aba Vagas", "WhatsApp", "Ligação", "b", 1],
    ["APP-03", 1, "GPS Falso causa?", "Mais pontos", "Bloqueio", "Nada", "Prêmio", "b", 1],
    ["BAS-01", 1, "O que e a JET?", "Patinetes", "Carros", "Bikes", "Bus", "a", 1],
    ["INT-FINAL", 1, "O que e Fechamento A/B?", "Brigar", "Dar 2 opcoes", "Gritar", "Sair", "b", 1]
  ];
  dataPerguntas.forEach(r => wsQuiz.appendRow(r));

  if (typeof internalSyncAll === 'function') internalSyncAll();
  return "JET Academy Completa Carregada com Sucesso!";
}