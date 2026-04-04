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

  // Mapeia o que o usuário já concluiu
  const concluidos = new Set();
  for (let r = 1; r < dataProg.length; r++) {
    if (String(dataProg[r][iUsrP]).trim() === user.user_id) {
      concluidos.add(String(dataProg[r][iModP]).trim());
    }
  }

  const trilha = [];
  const modulosRaw = [];
  for (let r = 1; r < dataMod.length; r++) {
    if (String(dataMod[r][hMod.indexOf('ativo')]).toUpperCase() !== 'TRUE') continue;
    modulosRaw.push(rowToObj_(hMod, dataMod[r]));
  }

  // Ordena por nível e ordem
  const ordemNiveis = ['MANUAL APP', 'TECNICA VENDAS', 'AVANCADO', 'ESPECIALISTA', 'MASTER'];
  modulosRaw.sort((a, b) => {
    const na = ordemNiveis.indexOf(a.nivel), nb = ordemNiveis.indexOf(b.nivel);
    if (na !== nb) return na - nb;
    return parseInt(a.ordem || 0) - parseInt(b.ordem || 0);
  });

  // Determina desbloqueio
  modulosRaw.forEach((m, idx) => {
    const isConcluido = concluidos.has(m.modulo_id);
    let isDesbloqueado = false;

    if (idx === 0) {
      isDesbloqueado = true;
    } else {
      const requisitos = m.pre_requisitos_json ? JSON.parse(m.pre_requisitos_json) : {};
      if (requisitos.must_complete_modulos) {
        isDesbloqueado = requisitos.must_complete_modulos.every(id => concluidos.has(id));
      } else {
        // Se não tem requisito explícito, desbloqueia se o anterior da lista estiver feito
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

  // Parse dos blocos de conteúdo
  modulo.blocks = modulo.blocks_json ? JSON.parse(modulo.blocks_json) : [];
  
  // Busca quizzes associados
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
  
  // Verifica se já concluiu
  const dataP = wsProg.getDataRange().getValues();
  const hP = dataP[0].map(v => String(v).toLowerCase().trim());
  const iUsr = hP.indexOf('user_id'), iMod = hP.indexOf('modulo_id');

  for (let r = 1; r < dataP.length; r++) {
    if (String(dataP[r][iUsr]).trim() === user.user_id && String(dataP[r][iMod]).trim() === modulo_id) {
      return { ok: true, ja_concluido: true };
    }
  }

  // Registra progresso
  const agora = new Date().toISOString();
  const newRow = new Array(hP.length).fill('');
  newRow[iUsr] = user.user_id;
  newRow[iMod] = modulo_id;
  newRow[hP.indexOf('score_quiz')] = score_quiz || 100;
  newRow[hP.indexOf('concluido_em')] = agora;
  wsProg.appendRow(newRow);

  // Bonifica com Score
  if (pontos > 0) {
    registrarScore_(ss, user.user_id, 'ACADEMY_CONCLUSAO', pontos, `Conclusão do módulo ${modulo_id}`, '');
  }

  // Verifica Badges de Academy
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
 * Função para configurar a nova trilha JET Academy (Manual do App + Vendas)
 * Execute esta função uma única vez no editor para atualizar suas abas de MODULOS e QUIZ.
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
    // --- TRILHA: MANUAL DO APP ---
    ["APP-01", "MANUAL APP", 1, "Primeiro Acesso e Perfil", "TRUE", 10, "{}", "{\"min_seconds\": 10}", JSON.stringify([
      {type: "welcome_screen", title: "Seja bem-vindo!", subtitle: "Neste módulo você vai aprender a navegar no seu novo painel operacional.", points_info: "Ganhe 10 pontos ao concluir."},
      {type: "text_md", value: "## O seu Perfil\nNa tela inicial, você vê seu **Score Total** e seu **Streak (Fogo)**.\n\n- **Score:** São seus pontos acumulados. Quanto mais pontos, melhor sua posição no ranking.\n- **Streak:** Mostra quantos dias seguidos você trabalhou sem faltar."},
      {type: "text_md", value: "## Botão Sair\nSe precisar trocar de conta, o botão **Sair** fica no topo direito. Lembre-se: sua senha é sempre sua data de nascimento (DDMMYYYY)."},
      {type: "quiz", quiz_id: "APP-01"}
    ])],
    ["APP-02", "MANUAL APP", 2, "Como Aceitar Vagas (Slots)", "TRUE", 15, "{\"must_complete_modulos\": [\"APP-01\"]}", "{\"min_seconds\": 10, \"require_quiz_pass\": true}", JSON.stringify([
      {type: "text_md", value: "## Tela de Slots\nAqui é onde você garante seu trabalho. As vagas são divididas em:\n\n- **HOJE:** Vagas que você pode aceitar e já começar a trabalhar agora.\n- **AMANHÃ:** Vagas para garantir seu turno no dia seguinte."},
      {type: "text_md", value: "## Vagas Sugeridas\nSe uma vaga tiver uma borda amarela e o selo **SUGESTÃO**, significa que o gestor indicou esse ponto especialmente para você. Você tem preferência para aceitar!"},
      {type: "choice_simulation", scenario: "Você quer garantir trabalho para amanhã cedo.", question: "Onde você deve procurar?", options: ["Na aba de Vagas, seção AMANHÃ", "Esperar o gestor ligar"], correct_index: 0, feedback_correct: "Correto! Planeje-se aceitando vagas com antecedência.", feedback_wrong: "Seja proativo! Garanta sua vaga na seção AMANHÃ."},
      {type: "quiz", quiz_id: "APP-02"}
    ])],
    ["APP-03", "MANUAL APP", 3, "Check-in, Checkout e Pausas", "TRUE", 20, "{\"must_complete_modulos\": [\"APP-02\"]}", "{\"min_seconds\": 15, \"require_quiz_pass\": true}", JSON.stringify([
      {type: "text_md", value: "## Bate-ponto (GPS)\nPara fazer Check-in, você precisa estar dentro do **Raio do Ponto** (círculo azul no mapa).\n\n- **Check-in:** Inicia sua jornada.\n- **Pausa:** Use para almoço ou descanso. O tempo para de contar.\n- **Checkout:** Finaliza seu dia. Nunca esqueça de fazer o checkout ao sair!"},
      {type: "text_md", value: "## GPS Falso\nO sistema detecta aplicativos de 'Fake GPS'. Se tentar usar, sua conta será **bloqueada automaticamente**."},
      {type: "quiz", quiz_id: "APP-03"}
    ])],
    ["APP-04", "MANUAL APP", 4, "Função Reforço (Vim Trabalhar)", "TRUE", 15, "{\"must_complete_modulos\": [\"APP-03\"]}", "{\"min_seconds\": 10, \"require_quiz_pass\": true}", JSON.stringify([
      {type: "text_md", value: "## Cheguei no ponto e não tenho vaga?\nUse o botão **'✨ Vim trabalhar (Reforço)'**.\n\n1. Clique no botão ao final da lista de vagas.\n2. Escolha o local onde você está.\n3. O sistema cria um slot na hora para você e avisa o gestor."},
      {type: "choice_simulation", scenario: "O PDV está cheio de trabalho, mas você não tinha vaga reservada.", question: "O que fazer?", options: ["Ir embora para casa", "Usar a função 'Vim trabalhar (Reforço)' no app"], correct_index: 1, feedback_correct: "Isso aí! O Reforço serve para essas situações extras.", feedback_wrong: "Não perca a oportunidade. Use o botão de Reforço!"},
      {type: "quiz", quiz_id: "APP-04"}
    ])],
    ["APP-05", "MANUAL APP", 5, "Suporte e Ranking", "TRUE", 10, "{\"must_complete_modulos\": [\"APP-04\"]}", "{\"min_seconds\": 10, \"require_quiz_pass\": true}", JSON.stringify([
      {type: "text_md", value: "## Precisa de ajuda?\nUse o botão **SOS Suporte**. Você pode descrever seu problema e o gestor receberá um alerta imediato no Telegram para te responder."},
      {type: "text_md", value: "## Ranking Nacional e Regional\nNo botão **🏆 Ranking**, você vê quem são os melhores da sua cidade e do Brasil. Subir no ranking te dá visibilidade para melhores vagas e bônus!"},
      {type: "quiz", quiz_id: "APP-05"}
    ])]
  ];

  modulos.forEach(row => wsMod.appendRow(row));

  // 2. Configurar Aba QUIZ
  const wsQuiz = ss.getSheetByName('QUIZ');
  if (!wsQuiz) { throw new Error('Aba QUIZ não encontrada.'); }
  wsQuiz.clear();
  
  const quizHeaders = ["quiz_id", "q_id", "pergunta", "a", "b", "c", "d", "correta", "pontos"];
  wsQuiz.appendRow(quizHeaders);

  const perguntas = [
    ["APP-01", 1, "Como você acessa o aplicativo?", "Com e-mail e senha", "Com CPF e data de nascimento", "Com o número do celular", "Com o nome completo", "b", 1],
    ["APP-01", 2, "O que o Streak (ícone de fogo) representa?", "Sua pontuação total", "Dias seguidos de trabalho sem faltas", "Sua velocidade de atendimento", "O nível da bateria do patinete", "b", 1],
    ["APP-02", 1, "Qual a diferença entre a seção HOJE e AMANHÃ na tela de vagas?", "Nenhuma, são iguais", "Hoje são vagas atuais; Amanhã são para reserva antecipada", "Hoje é só para Fiscais; Amanhã para Promotores", "Hoje é para quem tem carro; Amanhã para quem vai a pé", "b", 1],
    ["APP-02", 2, "O que significa o selo SUGESTÃO em uma vaga?", "Que a vaga é opcional", "Que o gestor indicou você para aquele ponto e você tem preferência", "Que a vaga paga menos pontos", "Que o local está fechado", "b", 1],
    ["APP-03", 1, "O que acontece se você bater o ponto usando um aplicativo de GPS Falso?", "Você ganha mais pontos", "Sua conta é bloqueada automaticamente", "O sistema ignora e aceita", "O gestor recebe um elogio", "b", 1],
    ["APP-03", 2, "Quando você deve usar a função PAUSA?", "Ao final do dia", "No horário de almoço ou descanso", "Quando o patinete quebra", "Nunca deve usar", "b", 1],
    ["APP-04", 1, "Para que serve a função 'Vim trabalhar (Reforço)'?", "Para pedir demissão", "Para iniciar uma jornada extra em um local sem ter vaga reservada", "Para trocar de turno com um colega", "Para avisar que vai chegar atrasado", "b", 1],
    ["APP-05", 1, "Onde você deve pedir ajuda técnica ou operacional?", "No grupo geral do Telegram", "No botão SOS Suporte dentro do app", "Ligando para o dono da empresa", "Mandando SMS", "b", 1]
  ];

  perguntas.forEach(row => wsQuiz.appendRow(row));

  // Sincroniza com Cloud Run
  if (typeof internalSyncAll === 'function') {
    internalSyncAll();
  }

  Logger.log('Academy reconfigurado com sucesso! Trilha MANUAL DO APP ativa.');
  return "JET Academy atualizada com sucesso!";
}