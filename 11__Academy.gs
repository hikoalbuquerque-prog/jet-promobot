// ============================================================
//  11.Academy.gs — Trilha Integral e Estruturada JET Academy
//  Carga Mestra: 33 Módulos de Alta Performance + Notificações
// ============================================================

/**
 * Retorna a trilha de módulos disponível para o usuário
 */
function getAcademyTrilha_(user) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const wsMod = ss.getSheetByName('MODULOS'), wsProg = ss.getSheetByName('ACADEMY_PROGRESSO');
  if (!wsMod || !wsProg) return { ok: false, erro: 'Abas do Academy não encontradas' };

  const dataProg = wsProg.getDataRange().getValues();
  const concluidos = [];
  for (let r = 1; r < dataProg.length; r++) { 
    if (String(dataProg[r][0]).trim() === user.user_id) concluidos.push(String(dataProg[r][1]).trim()); 
  }
  
  const dataMod = wsMod.getDataRange().getValues(), hMod = dataMod[0].map(v => String(v).toLowerCase().trim());
  const modulos = [];
  const iId = hMod.indexOf('modulo_id'), iAtivo = hMod.indexOf('ativo'), iTit = hMod.indexOf('titulo'), iNiv = hMod.indexOf('nivel'), iPts = hMod.indexOf('pontos'), iOrd = hMod.indexOf('ordem');

  for (let r = 1; r < dataMod.length; r++) {
    if (String(dataMod[r][iAtivo]).toUpperCase() === 'TRUE' || String(dataMod[r][iAtivo]).toUpperCase() === 'SIM') {
      modulos.push({
        modulo_id: String(dataMod[r][iId]).trim(),
        titulo: String(dataMod[r][iTit]).trim(),
        nivel: String(dataMod[r][iNiv]).trim(),
        pontos: parseInt(dataMod[r][iPts] || '0'),
        ordem: parseInt(dataMod[r][iOrd] || '0'),
        concluido: concluidos.includes(String(dataMod[r][iId]).trim()),
        desbloqueado: true // Simplificado no GAS, o Cloud Run aplica a regra real se houver cache
      });
    }
  }
  
  return { ok: true, progresso_ids: concluidos, modulos: modulos }; 
}

function getAcademyModulo_(params, user) {
  // O Cloud Run agora serve os módulos via CACHE. 
  // Esta função só é chamada se o cache falhar ou para fallback.
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

/**
 * Sincroniza todos os módulos e quizzes com o cache do Cloud Run
 */
function sincronizarAcademyCache_() {
  try {
    const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
    const wsMod = ss.getSheetByName('MODULOS'), wsQuiz = ss.getSheetByName('QUIZ');
    if (!wsMod || !wsQuiz) return;

    const dataMod = wsMod.getDataRange().getValues(), hMod = dataMod[0].map(v => String(v).toLowerCase().trim());
    const modulos = [];
    for (let r = 1; r < dataMod.length; r++) {
      if (String(dataMod[r][hMod.indexOf('ativo')]).toUpperCase() === 'TRUE') {
        const m = rowToObj_(hMod, dataMod[r]);
        m.blocks = m.blocks_json ? JSON.parse(m.blocks_json) : [];
        modulos.push(m);
      }
    }

    const dataQ = wsQuiz.getDataRange().getValues(), hQ = dataQ[0].map(v => String(v).toLowerCase().trim());
    const quizzes = {};
    for (let r = 1; r < dataQ.length; r++) {
      const qid = String(dataQ[r][hQ.indexOf('quiz_id')]).trim();
      if (!quizzes[qid]) quizzes[qid] = [];
      quizzes[qid].push(rowToObj_(hQ, dataQ[r]));
    }

    const url = getConfig_('cloud_run_url') + '/internal/sync-academy';
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        integration_secret: getConfig_('integration_secret'),
        modulos: modulos,
        quizzes: quizzes
      }),
      muteHttpExceptions: true
    });
    console.log('Academy sincronizada com Cloud Run.');
  } catch (e) {
    console.log('Erro ao sincronizar Academy:', e.message);
  }
}


function concluirModulo_(user, body) {
  const userId = String(user.user_id || body.user_id || '').trim();
  const moduloId = String(body.modulo_id || '').trim();
  const scoreQuiz = body.score_quiz;
  const pontos = parseInt(body.pontos) || 0;

  if (!userId || !moduloId) return { ok: false, erro: 'Dados incompletos para conclusão.' };

  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const wsProg = ss.getSheetByName('ACADEMY_PROGRESSO');
  if (!wsProg) return { ok: false, erro: 'Aba de progresso não encontrada.' };
  
  // Bloqueio especial para módulos de MANUAL APP (exige experiência em campo)
  if (moduloId.startsWith('APP-')) {
    const wsJor = ss.getSheetByName('JORNADAS');
    if (wsJor) {
      const dataJ = wsJor.getDataRange().getValues();
      const count = dataJ.filter(r => String(r[1]).trim() === userId && String(r[4]).trim() === 'ENCERRADO').length;
      if (count < 3) return { ok: false, erro: '⚠️ Missão Bloqueada: complete pelo menos 3 jornadas reais no campo para finalizar este módulo.' };
    }
  }

  // Verificar se já concluiu (evitar duplicatas)
  const dataP = wsProg.getDataRange().getValues();
  const jaConcluiu = dataP.some(r => String(r[0]).trim() === userId && String(r[1]).trim() === moduloId);
  if (jaConcluiu) return { ok: true, ja_concluido: true };
  
  // Gravar progresso
  wsProg.appendRow([userId, moduloId, scoreQuiz || 100, new Date().toISOString()]);
  
  // Pontuar promotor
  if (pontos > 0) {
    registrarScore_(ss, userId, 'ACADEMY_CONCLUSAO', pontos, `Módulo ${moduloId}`, '');
  }

  // Verificar conquistas de nível (Badges)
  verificarBadgesAcademy_(ss, userId);
  
  // Invalida cache de sincronização global para refletir no Cloud Run
  try {
    const cache = CacheService.getScriptCache();
    cache.remove('academy_progresso_' + userId);
  } catch(e) {}

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
      const bData = wsBadges.getDataRange().getValues();
      if (!bData.some(r => String(r[0]).trim() === userId && String(r[1]).trim() === bTipo)) {
        wsBadges.appendRow([userId, bTipo, 'Certificado ' + niv, new Date().toISOString()]);
        
        // Notificação Telegram (Item 3)
        try {
          const user = getUserById_(userId);
          const msg = `🎓 *NOVO CERTIFICADO JET ACADEMY*\n\n` +
                      `👤 *Promotor:* ${user.nome}\n` +
                      `🎖️ *Nível Concluído:* ${niv}\n` +
                      `🚀 *Status:* ${niv === 'MASTER' ? 'LENDÁRIO!' : 'Evoluindo...'}`;
          notificarTelegram_(msg, 'GESTOR');
        } catch(e) { console.log('Erro ao notificar level up:', e.message); }
      }
    }
  });
}

/**
 * SETUP MESTRE: 33 MÓDULOS COM CONTEÚDO DE ALTA PERFORMANCE
 */
function setupNovosModulosAcademy() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsMod = ss.getSheetByName('MODULOS'); wsMod.clear();
  wsMod.appendRow(["modulo_id", "nivel", "ordem", "titulo", "ativo", "pontos", "pre_requisitos_json", "config_conclusao_json", "blocks_json"]);

  const m = [
    // --- MANUAL APP (5 Módulos) ---
    ["APP-01","MANUAL APP",1,"Acesso e Perfil","TRUE",10,"{}","{}",JSON.stringify([
      {type:"welcome_screen",title:"Bem-vindo ao JET·OPS",subtitle:"O App é sua principal ferramenta de ganhos."},
      {type:"text_md",value:"## 🔑 Seu Acesso\nUse seu **CPF** e sua **Data de Nascimento** (8 dígitos).\n\n## 👤 Seu Perfil\nNa Home, acompanhe seu **Score** (pontos) e **Streak** (fogo). O Streak aumenta se você trabalhar dias seguidos!\n\n> **Dica de Ouro:** Se o app não entrar, verifique se sua internet está ativa e se não há espaços extras no CPF."},
      {type:"quiz",quiz_id:"APP-01"}
    ])],
    ["APP-02","MANUAL APP",2,"Vagas e Sugestões","TRUE",15,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## 📅 Reservando Slots\n- **HOJE:** Vagas que abrem durante o dia.\n- **AMANHÃ:** Planejamento antecipado.\n\n## ✨ Sugestões do Gestor\nSlots com **borda amarela** são indicações diretas para você. Elas costumam ter bônus de pontos!"},
      {type:"quiz",quiz_id:"APP-02"}
    ])],
    ["APP-03","MANUAL APP",3,"Check-in e Segurança","TRUE",20,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## 📍 O Raio do GPS\nVocê só consegue iniciar se estiver dentro do **círculo azul** no mapa.\n\n⚠️ **Cuidado:** O uso de 'Fake GPS' causa bloqueio imediato e permanente da conta. O sistema detecta automaticamente."},
      {type:"quiz",quiz_id:"APP-03"}
    ])],
    ["APP-04","MANUAL APP",4,"Função Reforço (✨)","TRUE",15,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## ✨ Cheguei e não tem vaga?\nUse o botão **'Vim Trabalhar (Reforço)'** no final da lista de slots. Ele cria sua vaga na hora se você estiver no ponto físico correto.\n\n> **Uso ideal:** Quando você quer trabalhar mas todas as vagas normais já foram preenchidas."},
      {type:"quiz",quiz_id:"APP-04"}
    ])],
    ["APP-05","MANUAL APP",5,"Suporte e Ranking","TRUE",10,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## 🆘 Preciso de ajuda!\nO botão **SOS** avisa seu gestor no Telegram em tempo real. Use apenas para problemas técnicos ou emergências.\n\n## 🏆 Ranking\nQuanto mais pontos (Score), mais alto você sobe no Ranking Nacional. Os Top 3 sempre ganham prêmios extras!"},
      {type:"quiz",quiz_id:"APP-05"}
    ])],

    // --- BÁSICO (9 Módulos) ---
    ["BAS-00","BASICO",1,"Manual JET Vendas","TRUE",5,"{\"must_complete_modulos\":[\"APP-05\"]}","{}",JSON.stringify([{type:"welcome_screen",title:"Escola de Vendas",subtitle:"Do Zero ao Combo em 30 segundos."}])],
    ["BAS-01","BASICO",2,"O Coração da JET","TRUE",10,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## 🛴 O que vendemos?\nNão vendemos patinetes. Vendemos **TEMPO** e **LIBERDADE**. O patinete é apenas o meio."},
      {type:"choice_simulation",scenario:"Um pedestre olha com curiosidade para o patinete. Qual sua primeira frase?",question:"Escolha a melhor abordagem:",options:["Quer comprar um pacote de minutos?","Sabia que você chega no trabalho em 5 min com esse patinete?","Oi, você tem o app da JET instalado?"],correct_index:1,feedback_correct:"Excelente! Você focou no BENEFÍCIO (tempo), não no produto.",feedback_wrong:"Muito direto ao ponto de venda ou técnico. Foque no problema que o patinete resolve!"},
      {type:"quiz",quiz_id:"BAS-01"}
    ])],
    ["BAS-02","BASICO",3,"Papel do Promotor","TRUE",10,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## 🎯 Sua Missão\n1. **Abordar:** 100% das pessoas que passarem.\n2. **Orientar:** Ensinar a usar o app.\n3. **Vender:** Fechar o Combo PLUS."},
      {type:"quiz",quiz_id:"BAS-02"}
    ])],
    ["BAS-03","BASICO",4,"Produtos JET","TRUE",15,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## 📦 Nossos Produtos\n- **Avulso:** Caro (para curiosos).\n- **PLUS:** Assinatura (para usuários).\n- **Combo:** PLUS + Minutos (**Melhor custo-benefício**)."},
      {type:"quiz",quiz_id:"BAS-03"}
    ])],
    ["BAS-04","BASICO",5,"Pilar Comercial: O Combo","TRUE",20,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## 💎 Por que focar no Combo?\nO Combo PLUS + 200 min é o que gera a maior economia real para o cliente. Se ele economiza, ele volta.\n\n> **Regra de Ouro:** Nunca comece oferecendo o avulso. Comece pelo Combo!"},
      {type:"quiz",quiz_id:"BAS-04"}
    ])],
    ["BAS-05","BASICO",6,"A Abordagem de 5 Segundos","TRUE",15,"{}","{}",JSON.stringify([{type:"text_md",value:"## ⏱️ O Tempo é Curto\nVocê tem 5 segundos para ganhar a atenção. Use frases de impacto: 'Já conhece o novo jeito de fugir do trânsito?'"},{type:"quiz",quiz_id:"BAS-05"}])],
    ["BAS-06","BASICO",7,"Vencendo o 'Não'","TRUE",10,"{}","{}",JSON.stringify([{type:"text_md",value:"## 🛑 Objeções comuns\n- 'Tá caro' -> Mostre o custo do Uber/Ônibus.\n- 'Tenho medo' -> Ofereça um teste assistido de 1 minuto."},{type:"quiz",quiz_id:"BAS-06"}])],
    ["BAS-07","BASICO",8,"O Erro do 'Fala-Muito'","TRUE",10,"{}","{}",JSON.stringify([{type:"text_md",value:"## 🤐 Menos é Mais\nFalar demais confunde o cliente. Deixe-o testar o patinete o quanto antes. A experiência vende sozinha."},{type:"quiz",quiz_id:"BAS-07"}])],
    ["BAS-FINAL","BASICO",99,"Certificação Nível Básico","TRUE",50,"{}","{}",JSON.stringify([{type:"quiz",quiz_id:"BAS-FINAL"}])],

    // --- INTERMEDIÁRIO (6 Módulos) ---
    ["INT-01","INTERMEDIARIO",1,"Qualificação Ninja","TRUE",15,"{\"must_complete_modulos\":[\"BAS-FINAL\"]}","{}",JSON.stringify([
      {type:"text_md",value:"## 🔍 Qualificar é Ganhar Tempo\nDescubra se ele mora perto, onde trabalha e como se desloca. Se o trajeto for curto, ele é um cliente de COMBO."},
      {type:"quiz",quiz_id:"INT-01"}
    ])],
    ["INT-02","INTERMEDIARIO",2,"O Poder do Fechamento A/B","TRUE",15,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## 🥊 Fechamento Direto\nNão pergunte 'Vai querer?'. Pergunte: 'Você prefere o pacote de 200 minutos para o mês todo ou o de 60 minutos para testar agora?'"},
      {type:"quiz",quiz_id:"INT-02"}
    ])],
    ["INT-03","INTERMEDIARIO",3,"Upsell: Vendendo Mais","TRUE",15,"{}","{}",JSON.stringify([{type:"text_md",value:"## 🚀 Aumentando o Ticket\nSe o cliente quer 60 min, mostre que por apenas R$ X a mais ele leva o triplo de tempo."},{type:"quiz",quiz_id:"INT-03"}])],
    ["INT-04","INTERMEDIARIO",4,"Linguagem Corporal","TRUE",15,"{}","{}",JSON.stringify([{type:"text_md",value:"## Atitude Vencedora\nPostura ereta, contato visual e sorriso. O cliente compra VOCÊ antes do patinete."},{type:"quiz",quiz_id:"INT-04"}])],
    ["INT-05","INTERMEDIARIO",5,"Organização de PDV","TRUE",10,"{}","{}",JSON.stringify([{type:"text_md",value:"## Vitrine Ativa\nPatinetes limpos e virados para o fluxo vendem 30% mais."},{type:"quiz",quiz_id:"INT-05"}])],
    ["INT-FINAL","INTERMEDIARIO",99,"Certificação Intermediária","TRUE",60,"{}","{}",JSON.stringify([{type:"quiz",quiz_id:"INT-FINAL"}])],

    // --- AVANÇADO (4 Módulos) ---
    ["AVA-01","AVANCADO",1,"Gatilhos Mentais Pro","TRUE",30,"{\"must_complete_modulos\":[\"INT-FINAL\"]}","{}",JSON.stringify([
      {type:"text_md",value:"## 🧠 Psicologia de Vendas\n- **Escassez:** 'Tenho poucos patinetes com bateria 100% agora.'\n- **Autoridade:** 'Sou especialista em mobilidade da JET e vou te ajudar.'\n- **Prova Social:** 'Só hoje já ativei 15 pessoas aqui nessa saída.'"},
      {type:"choice_simulation",scenario:"O cliente diz: 'Vou pensar e volto depois'.",question:"Qual gatilho usar?",options:["Escassez: 'Tudo bem, mas as vagas do combo podem acabar logo.'","Autoridade: 'Eu não recomendo esperar, você vai perder tempo no trânsito agora.'","Prova Social: 'Muita gente aqui no prédio já aderiu para fugir do trânsito.'"],correct_index:1,feedback_correct:"Autoridade e urgência! Você é o especialista.",feedback_wrong:"Gatilhos fracos para esse momento. Use sua autoridade!"},
      {type:"quiz",quiz_id:"AVA-01"}
    ])],
    ["AVA-02","AVANCADO",2,"Leitura de Perfil (DISC)","TRUE",20,"{}","{}",JSON.stringify([{type:"text_md",value:"## Adaptabilidade\nVenda rápido para o Dominante, com detalhes para o Analítico e com emoção para o Estável."},{type:"quiz",quiz_id:"AVA-02"}])],
    ["AVA-03","AVANCADO",3,"Custo de Oportunidade","TRUE",20,"{}","{}",JSON.stringify([{type:"text_md",value:"## Matemática de Venda\nMostre que 20 minutos perdidos no trânsito por dia valem R$ 500 no final do mês."},{type:"quiz",quiz_id:"AVA-03"}])],
    ["AVA-FINAL","AVANCADO",99,"Certificação Avançada","TRUE",80,"{}","{}",JSON.stringify([{type:"quiz",quiz_id:"AVA-FINAL"}])],

    // --- ESPECIALISTA (5 Módulos) ---
    ["ESP-01","ESPECIALISTA",1,"Microgestão de Campo","TRUE",40,"{\"must_complete_modulos\":[\"AVA-FINAL\"]}","{}",JSON.stringify([
      {type:"text_md",value:"## Dominando o Ponto\nComo gerir 3 promotores em uma estação de metrô. Posicionamento em triângulo para cobertura 100%."},
      {type:"quiz",quiz_id: "ESP-01"}
    ])],
    ["ESP-02","ESPECIALISTA",2,"Coaching On-The-Job","TRUE",30,"{}","{}",JSON.stringify([{type:"text_md",value:"## Feedback 360\nComo corrigir a abordagem de um novato sem quebrar o ritmo de venda dele."},{type:"quiz",quiz_id:"ESP-02"}])],
    ["ESP-03","ESPECIALISTA",3,"Conversão e Funil","TRUE",30,"{}","{}",JSON.stringify([{type:"text_md",value:"## Analista de Dados\nSe o seu ponto aborda muito mas vende pouco, o problema é o Pitch ou o Fechamento? Aprenda a diagnosticar."},{type:"quiz",quiz_id:"ESP-03"}])],
    ["ESP-04","ESPECIALISTA",4,"Estratégias de Turno","TRUE",25,"{}","{}",JSON.stringify([{type:"text_md",value:"## Otimização de Pico\nComo escalar a equipe para os 45 minutos de ouro da saída do trabalho."},{type:"quiz",quiz_id:"ESP-04"}])],
    ["ESP-FINAL","ESPECIALISTA",99,"Certificação Especialista","TRUE",100,"{}","{}",JSON.stringify([{type:"quiz",quiz_id:"ESP-FINAL"}])],

    // --- MASTER (4 Módulos) ---
    ["MAS-01","MASTER",1,"Cultura de Tropa de Elite","TRUE",60,"{\"must_complete_modulos\":[\"ESP-FINAL\"]}","{}",JSON.stringify([
      {type:"text_md",value:"## Liderança Visionária\nComo manter a motivação do time no 100% mesmo sob pressão de metas agressivas."},
      {type: "quiz", quiz_id: "MAS-01"}
    ])],
    ["MAS-02","MASTER",2,"Gestão de Crises Operacionais","TRUE",40,"{}","{}",JSON.stringify([{type:"text_md",value:"## Plano de Contingência\nO que fazer quando 50% dos patinetes do ponto ficam sem bateria ao mesmo tempo."},{type:"quiz",quiz_id:"MAS-02"}])],
    ["MAS-03","MASTER",3,"Visão de Business JET","TRUE",40,"{}","{}",JSON.stringify([{type:"text_md",value:"## Além do Campo\nEntenda como sua operação impacta o lucro da cidade e os planos de expansão da JET."},{type:"quiz",quiz_id:"MAS-03"}])],
    ["MAS-FINAL","MASTER",99,"CERTIFICAÇÃO JET MASTER PRO","TRUE",250,"{}","{}",JSON.stringify([{type:"quiz",quiz_id:"MAS-FINAL"}])]
  ];
  m.forEach(r => wsMod.appendRow(r));

  const wsQuiz = ss.getSheetByName('QUIZ'); wsQuiz.clear();
  wsQuiz.appendRow(["quiz_id","q_id","pergunta","a","b","c","d","correta","pontos"]);
  const q = [
    ["APP-01",1,"Qual dado NÃO é usado no login?","CPF","Data Nasc","Nome Mãe","8 dígitos","c",1],
    ["APP-02",1,"O que significa a borda amarela na vaga?","Vaga Lotada","Sugestão do Gestor","Erro no GPS","Vaga Grátis","b",1],
    ["APP-03",1,"Usar Fake GPS gera qual punição?","Perda de pontos","Aviso verbal","Bloqueio Permanente","Nenhuma","c",1],
    ["APP-04",1,"Quando usar o botão 'Reforço'?","Para pedir folga","Para trabalhar sem reserva","Para trocar de turno","Para falar com suporte","b",1],
    ["APP-05",1,"Para que serve o botão SOS?","Pedir comida","Emergência/Ajuda Técnica","Ver o ranking","Trocar senha","b",1],
    ["BAS-01",1,"Qual o maior benefício do patinete para o cliente?","A cor bonita","Ganhar tempo no trânsito","Fazer exercício","Carregar o celular","b",1],
    ["BAS-02",1,"Qual a prioridade 1 do promotor?","Limpar os patinetes","Abordar e vender","Falar no WhatsApp","Sentar no banco","b",1],
    ["BAS-03",1,"Qual produto tem o melhor custo-benefício?","Viagem Avulsa","Combo PLUS + Minutos","Apenas o PLUS","Nenhum","b",1],
    ["BAS-04",1,"Por qual oferta você deve SEMPRE começar?","A mais barata","O Combo de maior valor","O teste grátis","Não oferecer nada","b",1],
    ["BAS-05",1,"Qual o tempo ideal da primeira frase?","30 segundos","10 minutos","5 segundos","1 hora","c",1],
    ["BAS-06",1,"O que fazer quando o cliente tem medo?","Rir dele","Oferecer teste assistido","Ignorar e ir para o próximo","Insistir na venda","b",1],
    ["BAS-07",1,"Falar demais durante a venda pode:","Ajudar o cliente","Confundir e travar o fechamento","Aumentar o bônus","Nada","b",1],
    ["BAS-FINAL",1,"No Nível Básico, o foco principal é:","Gerir equipes","Abordagem e Venda de Combos","Mecânica complexa","Administrativo","b",1],
    ["INT-01",1,"Qualificar o cliente serve para:","Saber a vida dele","Entender se o produto resolve a dor dele","Pedir CPF","Nada","b",1],
    ["INT-02",1,"O Fechamento A/B consiste em:","Dar duas opções de compra","Brigar com o cliente","Dar desconto de 90%","Sair de perto","a",1],
    ["INT-03",1,"Upsell é a técnica de:","Vender o produto mais caro/melhor","Dar o produto de graça","Vender menos","Ignorar o cliente","a",1],
    ["INT-04",1,"Linguagem corporal impacta na venda:","Nada","Muito, gera confiança imediata","Pouco","Só se estiver sol","b",1],
    ["INT-05",1,"Patinetes alinhados e limpos ajudam a:","Gastar bateria","Atrair mais clientes e vender","Nada","Atrapalhar a calçada","b",1],
    ["INT-FINAL",1,"Se o cliente diz 'está caro', você deve:","Concordar e sair","Comparar com o custo de outros meios","Dar o seu dinheiro","Chorar","b",1],
    ["AVA-01",1,"Gatilho de Prova Social usa:","Medo","Exemplo de outras pessoas que compraram","Descontos","Gritos","b",1],
    ["AVA-01",2,"Gatilho de Autoridade foca em:","Ser engraçado","Mostrar conhecimento especialista","Dar ordens","Nenhuma","b",1],
    ["AVA-02",1,"Para vender para um perfil 'Dominante', você deve:","Ser muito lento","Ir direto ao ponto e focar em resultados","Contar histórias longas","Nada","b",1],
    ["AVA-03",1,"Custo de oportunidade é:","O preço do patinete","O valor do tempo que o cliente perde no trânsito","Um desconto","Nada","b",1],
    ["AVA-FINAL",1,"No nível avançado, a venda é:","Por sorte","Baseada em gatilhos mentais e psicologia","Lenta","Apenas técnica","b",1],
    ["ESP-01",1,"Posicionamento em triângulo serve para:","Descansar","Cobertura 100% do fluxo de pessoas","Ficar bonito","Nada","b",1],
    ["ESP-02",1,"Como corrigir um novato no campo?","Gritando","Feedback construtivo após a abordagem","Ignorando","Demitindo","b",1],
    ["ESP-03",1,"Diagnóstico de 'Aborda muito / Vende pouco':","Sorte ruim","Pitch fraco ou Falta de fechamento","Ponto ruim","Nada","b",1],
    ["ESP-04",1,"Gestão de pausas no pico:","Deve ser evitada para maximizar vendas","É obrigatória","Pode ser a qualquer hora","Nada","a",1],
    ["ESP-FINAL",1,"O Especialista garante:","Suas próprias vendas","A performance de todo o seu ponto","Nada","A limpeza","b",1],
    ["MAS-01",1,"O Onboarding de um novato deve focar em:","Dar um manual e sair","Acolhimento e ensino prático","Não falar com ele","Mandar ele embora","b",1],
    ["MAS-02",1,"Em um conflito na equipe, o Master deve:","Gritar mais alto","Gerir com inteligência emocional e diálogo","Ignorar","Demitir todos","b",1],
    ["MAS-03",1,"Uma cultura de alta performance foca em:","Sorte","Metas claras e evolução contínua","Fofoca","Desculpas","b",1],
    ["MAS-FINAL",1,"O JET Master PRO é responsável por:","Vender sozinho","O resultado estratégico da cidade/operação","Limpar patinetes","Nada","b",1]
  ];
  q.forEach(r => wsQuiz.appendRow(r));
  
  // Sincronização Automática (Item 5)
  if (typeof internalSyncAll === 'function') internalSyncAll();
  return "JET Academy ELITE Carregada com Notificações e Sync!";
}
