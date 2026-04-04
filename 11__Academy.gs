// ============================================================
//  11.Academy.gs — Motor de Treinamento e Trilha de Aprendizado
// ============================================================

/**
 * Retorna a trilha de módulos disponível para o usuário, 
 * marcando o que está concluído e o que está desbloqueado.
 */
function getAcademyTrilha_(user) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const wsMod = ss.getSheetByName('MODULOS');
  const wsProg = ss.getSheetByName('ACADEMY_PROGRESSO');
  if (!wsMod || !wsProg) return { ok: false, erro: 'Abas do Academy não encontradas' };

  const dataMod = wsMod.getDataRange().getValues();
  const hMod = dataMod[0].map(v => String(v).toLowerCase().trim());
  
  const dataProg = wsProg.getDataRange().getValues();
  const hProg = dataProg[0].map(v => String(v).toLowerCase().trim());
  const iUsrP = hProg.indexOf('user_id'), iModP = hProg.indexOf('modulo_id');

  const concluidos = new Set();
  for (let r = 1; r < dataProg.length; r++) {
    if (String(dataProg[r][iUsrP]).trim() === user.user_id) {
      concluidos.add(String(dataProg[r][iModP]).trim());
    }
  }

  const modulosRaw = [];
  for (let r = 1; r < dataMod.length; r++) {
    if (String(dataMod[r][hMod.indexOf('ativo')]).toUpperCase() !== 'TRUE') continue;
    modulosRaw.push(rowToObj_(hMod, dataMod[r]));
  }

  const ordemNiveis = ['MANUAL APP', 'TECNICA VENDAS', 'AVANCADO', 'ESPECIALISTA', 'MASTER'];
  modulosRaw.sort((a, b) => {
    const na = ordemNiveis.indexOf(a.nivel), nb = ordemNiveis.indexOf(b.nivel);
    if (na !== nb) return na - nb;
    return parseInt(a.ordem || 0) - parseInt(b.ordem || 0);
  });

  const trilha = [];
  modulosRaw.forEach((m, idx) => {
    const isConcluido = concluidos.has(m.modulo_id);
    let isDesbloqueado = false;

    if (idx === 0) {
      isDesbloqueado = true;
    } else {
      const requisitos = m.pre_requisitos_json ? JSON.parse(m.pre_requisitos_json) : {};
      if (requisitos.must_complete_modulos && requisitos.must_complete_modulos.length > 0) {
        isDesbloqueado = requisitos.must_complete_modulos.every(id => concluidos.has(id));
      } else {
        const anterior = modulosRaw[idx - 1];
        isDesbloqueado = concluidos.has(anterior.modulo_id);
      }
    }

    trilha.push({
      modulo_id: m.modulo_id,
      nivel: m.nivel,
      titulo: m.titulo,
      pontos: m.pontos,
      concluido: isConcluido,
      desbloqueado: isDesbloqueado
    });
  });

  return { ok: true, modulos: trilha };
}

/**
 * Retorna os detalhes de um módulo específico (blocos de conteúdo e quizzes)
 */
function getAcademyModulo_(params, user) {
  const moduloId = params.modulo_id;
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const wsMod = ss.getSheetByName('MODULOS');
  const wsQuiz = ss.getSheetByName('QUIZ');
  
  const dataMod = wsMod.getDataRange().getValues();
  const hMod = dataMod[0].map(v => String(v).toLowerCase().trim());
  const iId = hMod.indexOf('modulo_id');

  let modulo = null;
  for (let r = 1; r < dataMod.length; r++) {
    if (String(dataMod[r][iId]).trim() === moduloId) {
      modulo = rowToObj_(hMod, dataMod[r]);
      break;
    }
  }

  if (!modulo) return { ok: false, erro: 'Módulo não encontrado' };
  modulo.blocks = modulo.blocks_json ? JSON.parse(modulo.blocks_json) : [];
  
  const quizzesIds = modulo.blocks.filter(b => b.type === 'quiz').map(b => b.quiz_id);
  const quizzesData = {};

  if (quizzesIds.length > 0 && wsQuiz) {
    const dataQ = wsQuiz.getDataRange().getValues();
    const hQ = dataQ[0].map(v => String(v).toLowerCase().trim());
    const iQid = hQ.indexOf('quiz_id');

    quizzesIds.forEach(qid => {
      quizzesData[qid] = [];
      for (let r = 1; r < dataQ.length; r++) {
        if (String(dataQ[r][iQid]).trim() === qid) {
          const q = rowToObj_(hQ, dataQ[r]);
          quizzesData[qid].push({
            pergunta: q.pergunta,
            a: q.a, b: q.b, c: q.c, d: q.d,
            correta: q.correta
          });
        }
      }
    });
  }

  modulo.quizzes = quizzesData;
  return { ok: true, modulo };
}

/**
 * Registra a conclusão de um módulo e bonifica o promotor
 */
function concluirModulo_(user, body) {
  const { modulo_id, score_quiz, pontos } = body;
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const wsProg = ss.getSheetByName('ACADEMY_PROGRESSO');
  
  const dataP = wsProg.getDataRange().getValues();
  const hP = dataP[0].map(v => String(v).toLowerCase().trim());
  const iUsr = hP.indexOf('user_id'), iMod = hP.indexOf('modulo_id');

  for (let r = 1; r < dataP.length; r++) {
    if (String(dataP[r][iUsr]).trim() === user.user_id && String(dataP[r][iMod]).trim() === modulo_id) {
      return { ok: true, ja_concluido: true };
    }
  }

  const agora = new Date().toISOString();
  const newRow = new Array(hP.length).fill('');
  newRow[iUsr] = user.user_id;
  newRow[iMod] = modulo_id;
  newRow[hP.indexOf('score_quiz')] = score_quiz || 100;
  newRow[hP.indexOf('concluido_em')] = agora;
  wsProg.appendRow(newRow);

  if (pontos > 0) {
    registrarScore_(ss, user.user_id, 'ACADEMY_CONCLUSAO', pontos, `Conclusão do módulo ${modulo_id}`, '');
  }

  verificarBadgesAcademy_(ss, user.user_id);
  return { ok: true, ja_concluido: false };
}

function verificarBadgesAcademy_(ss, userId) {
  const wsProg = ss.getSheetByName('ACADEMY_PROGRESSO');
  const wsMod = ss.getSheetByName('MODULOS');
  const dataProg = wsProg.getDataRange().getValues();
  const dataMod = wsMod.getDataRange().getValues();
  const hMod = dataMod[0].map(v => String(v).toLowerCase().trim());
  const iIdM = hMod.indexOf('modulo_id'), iNivM = hMod.indexOf('nivel');

  const concluidos = dataProg.filter(r => String(r[0]).trim() === userId).map(r => String(r[1]).trim());
  
  const niveis = ['MANUAL APP', 'TECNICA VENDAS', 'AVANCADO', 'ESPECIALISTA', 'MASTER'];
  niveis.forEach(niv => {
    const modsNivel = dataMod.filter(r => String(r[iNivM]).trim() === niv).map(r => String(r[iIdM]).trim());
    if (modsNivel.length > 0 && modsNivel.every(id => concluidos.includes(id))) {
      const badgeTipo = 'ACADEMY_' + niv.replace(' ', '_');
      const badgeDesc = 'Concluiu todos os módulos de ' + niv;
      const wsBadges = ss.getSheetByName('BADGES');
      const bData = wsBadges.getDataRange().getValues();
      if (!bData.some(r => String(r[0]).trim() === userId && String(r[1]).trim() === badgeTipo)) {
        wsBadges.appendRow([userId, badgeTipo, badgeDesc, new Date().toISOString()]);
      }
    }
  });
}

/**
 * CONFIGURAÇÃO COMPLETA DA TRILHA JET ACADEMY
 */
function setupNovosModulosAcademy() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Configurar Aba MODULOS
  const wsMod = ss.getSheetByName('MODULOS');
  if (!wsMod) { throw new Error('Aba MODULOS não encontrada.'); }
  wsMod.clear();
  const modHeaders = ["modulo_id", "nivel", "ordem", "titulo", "ativo", "pontos", "pre_requisitos_json", "config_conclusao_json", "blocks_json"];
  wsMod.appendRow(modHeaders);

  const modulos = [
    // --- NÍVEL 1: MANUAL DO APP ---
    ["APP-01", "MANUAL APP", 1, "Primeiro Acesso e Perfil", "TRUE", 10, "{}", "{\"min_seconds\": 10}", JSON.stringify([
      {type: "welcome_screen", title: "Seja bem-vindo!", subtitle: "Neste módulo você vai aprender a navegar no seu novo painel operacional.", points_info: "Ganhe 10 pontos ao concluir."},
      {type: "text_md", value: "## O seu Perfil\nNa tela inicial, você vê seu **Score Total** e seu **Streak (Fogo)**.\n\n- **Score:** São seus pontos acumulados.\n- **Streak:** Mostra quantos dias seguidos você trabalhou sem faltar."},
      {type: "quiz", quiz_id: "APP-01"}
    ])],
    ["APP-02", "MANUAL APP", 2, "Como Aceitar Vagas (Slots)", "TRUE", 15, "{\"must_complete_modulos\": [\"APP-01\"]}", "{\"min_seconds\": 10, \"require_quiz_pass\": true}", JSON.stringify([
      {type: "text_md", value: "## Tela de Slots\nAqui você garante seu trabalho. As vagas são divididas em:\n\n- **HOJE:** Vagas para começar agora.\n- **AMANHÃ:** Vagas para reserva antecipada."},
      {type: "quiz", quiz_id: "APP-02"}
    ])],
    ["APP-03", "MANUAL APP", 3, "Check-in, Checkout e Pausas", "TRUE", 20, "{\"must_complete_modulos\": [\"APP-02\"]}", "{\"min_seconds\": 15, \"require_quiz_pass\": true}", JSON.stringify([
      {type: "text_md", value: "## Bate-ponto (GPS)\nPara Check-in, esteja dentro do raio azul.\n\n- **Check-in:** Inicia jornada.\n- **Pausa:** Almoço/Descanso.\n- **Checkout:** Finaliza o dia."},
      {type: "quiz", quiz_id: "APP-03"}
    ])],
    ["APP-04", "MANUAL APP", 4, "Função Reforço (Vim Trabalhar)", "TRUE", 15, "{\"must_complete_modulos\": [\"APP-03\"]}", "{\"min_seconds\": 10, \"require_quiz_pass\": true}", JSON.stringify([
      {type: "text_md", value: "## Vim trabalhar (Reforço)\nUse ao chegar num ponto sem vaga reservada. O sistema cria um slot na hora e avisa o gestor."},
      {type: "quiz", quiz_id: "APP-04"}
    ])],
    ["APP-05", "MANUAL APP", 5, "Suporte e Ranking", "TRUE", 10, "{\"must_complete_modulos\": [\"APP-04\"]}", "{\"min_seconds\": 10, \"require_quiz_pass\": true}", JSON.stringify([
      {type: "text_md", value: "## SOS Suporte\nPrecisa de ajuda? Use o botão SOS Suporte. O gestor recebe um alerta imediato."},
      {type: "quiz", quiz_id: "APP-05"}
    ])],

    // --- NÍVEL 2: TÉCNICA DE VENDAS (Antigo Básico) ---
    ["BAS-01", "TECNICA VENDAS", 1, "Quem é a JET e como funciona", "TRUE", 10, "{\"must_complete_modulos\": [\"APP-05\"]}", "{\"min_seconds\": 10, \"require_quiz_pass\": true}", JSON.stringify([
      {type: "text_md", value: "## O que é a JET\nA JET é uma empresa de micromobilidade urbana com patinetes elétricos compartilhados."},
      {type: "quiz", quiz_id: "BAS-01"}
    ])],
    ["BAS-02", "TECNICA VENDAS", 2, "Estratégia Oficial: Foco no Combo", "TRUE", 15, "{\"must_complete_modulos\": [\"BAS-01\"]}", "{\"min_seconds\": 10, \"require_quiz_pass\": true}", JSON.stringify([
      {type: "text_md", value: "## Prioridade Comercial\n1. PLUS + 200 min (Combo Ideal)\n2. PLUS + 100 min\n3. PLUS + 60 min"},
      {type: "quiz", quiz_id: "BAS-02"}
    ])],

    // --- NÍVEIS SEGUINTES (Exemplos de estrutura) ---
    ["INT-01", "AVANCADO", 1, "Venda Consultiva", "TRUE", 20, "{\"must_complete_modulos\": [\"BAS-02\"]}", "{\"min_seconds\": 10, \"require_quiz_pass\": true}", JSON.stringify([{type: "text_md", value: "Conteúdo avançado..."}])]
  ];

  modulos.forEach(row => wsMod.appendRow(row));

  // 2. Configurar Aba QUIZ
  const wsQuiz = ss.getSheetByName('QUIZ');
  wsQuiz.clear();
  wsQuiz.appendRow(["quiz_id", "q_id", "pergunta", "a", "b", "c", "d", "correta", "pontos"]);

  const perguntas = [
    ["APP-01", 1, "Como você acessa o app?", "E-mail", "CPF e Data de Nasc.", "Celular", "Nome", "b", 1],
    ["APP-02", 1, "Onde reserva vaga para amanhã?", "Home", "Aba de Vagas (Amanhã)", "WhatsApp", "Não reserva", "b", 1],
    ["APP-03", 1, "O que acontece com GPS Falso?", "Mais pontos", "Bloqueio automático", "Nada", "Elogio", "b", 1],
    ["APP-04", 1, "Para que serve o Reforço?", "Sair cedo", "Iniciar jornada sem reserva", "Trocar turno", "Avisar atraso", "b", 1],
    ["APP-05", 1, "Onde pedir ajuda técnica?", "Telegram Geral", "Botão SOS Suporte", "SMS", "Ligação", "b", 1],
    ["BAS-01", 1, "O que é a JET?", "Patinetes compartilhados", "Carros", "Bikes", "Ônibus", "a", 1],
    ["BAS-02", 1, "Qual o combo ideal?", "PLUS + 200", "PLUS + 60", "Avulso", "Nenhum", "a", 1]
  ];

  perguntas.forEach(row => wsQuiz.appendRow(row));
  if (typeof internalSyncAll === 'function') internalSyncAll();
  return "JET Academy atualizada com toda a trilha!";
}