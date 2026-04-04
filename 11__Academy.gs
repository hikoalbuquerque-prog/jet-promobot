// ============================================================
//  11.Academy.gs — Trilha Integral e Estruturada JET Academy
//  Carga Completa: 33 Módulos com Conteúdo Imersivo e Quizzes
// ============================================================

/**
 * Retorna a trilha de módulos disponível para o usuário
 */
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
    const wsJor = ss.getSheetByName('JORNADAS'), dataJ = wsJor.getDataRange().getValues();
    const count = dataJ.filter(r => String(r[1]).trim() === user.user_id && String(r[4]).trim() === 'ENCERRADO').length;
    if (count < 3) return { ok: false, erro: '⚠️ Missão Bloqueada: complete pelo menos 3 jornadas reais no campo para finalizar este módulo.' };
  }

  const dataP = wsProg.getDataRange().getValues();
  for (let r = 1; r < dataP.length; r++) { if (String(dataP[r][0]).trim() === user.user_id && String(dataP[r][1]).trim() === modulo_id) return { ok: true, ja_concluido: true }; }
  
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
      const bData = wsBadges.getDataRange().getValues();
      if (!bData.some(r => String(r[0]).trim() === userId && String(r[1]).trim() === bTipo)) wsBadges.appendRow([userId, bTipo, 'Certificado ' + niv, new Date().toISOString()]);
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
    // --- NÍVEL 0: MANUAL APP (5 Módulos) ---
    ["APP-01","MANUAL APP",1,"Primeiro Acesso e Perfil","TRUE",10,"{}","{}",JSON.stringify([
      {type:"welcome_screen",title:"Bem-vindo ao JET·OPS",subtitle:"O App é sua principal ferramenta de ganhos."},
      {type:"text_md",value:"## 🔑 Seu Acesso\nUse seu **CPF** e sua **Data de Nascimento** (8 dígitos).\\n\\n> **Dica de Ouro:** Se o app não entrar, verifique se sua internet está ativa e se não há espaços extras no CPF."},
      {type:"quiz",quiz_id:"APP-01"}
    ])],
    ["APP-02","MANUAL APP",2,"Vagas e Sugestões","TRUE",15,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## 📅 Reservando Slots\n- **HOJE:** Vagas que abrem durante o dia.\n- **AMANHÃ:** Planejamento antecipado.\\n\\n## ✨ Sugestões do Gestor\nSlots com **borda amarela** são indicações diretas para você. Elas costumam ter bônus de pontos!"},
      {type:"quiz",quiz_id:"APP-02"}
    ])],
    ["APP-03","MANUAL APP",3,"Check-in e Segurança","TRUE",20,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## 📍 O Raio do GPS\nVocê só consegue iniciar se estiver dentro do **círculo azul** no mapa.\\n\\n⚠️ **Cuidado:** O uso de 'Fake GPS' causa bloqueio imediato e permanente da conta. O sistema detecta automaticamente."},
      {type:"quiz",quiz_id:"APP-03"}
    ])],
    ["APP-04","MANUAL APP",4,"Função Reforço (✨)","TRUE",15,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## ✨ Cheguei e não tem vaga?\nUse o botão **'Vim Trabalhar (Reforço)'** no final da lista. Ele cria sua vaga na hora se você estiver no ponto físico correto.\\n\\n> **Uso ideal:** Quando você quer trabalhar mas todas as vagas normais já foram preenchidas."},
      {type:"quiz",quiz_id:"APP-04"}
    ])],
    ["APP-05","MANUAL APP",5,"SOS e Ranking","TRUE",10,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## 🆘 Preciso de ajuda!\nO botão **SOS** avisa seu gestor no Telegram em tempo real. Use apenas para problemas técnicos ou emergências.\\n\\n## 🏆 Ranking\nQuanto mais pontos (Score), mais alto você sobe no Ranking Nacional. Os Top 3 sempre ganham prêmios extras!"},
      {type:"quiz",quiz_id:"APP-05"}
    ])],

    // --- NÍVEL 1: BÁSICO (9 Módulos) ---
    ["BAS-00","BASICO",1,"Início da Jornada Academy","TRUE",5,"{\"must_complete_modulos\":[\"APP-05\"]}","{}",JSON.stringify([{type:"welcome_screen",title:"JET Academy",subtitle:"Transformando abordagens em vendas reais."}])],
    ["BAS-01","BASICO",2,"O Coração da JET","TRUE",10,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## 🛴 O que vendemos?\nNão vendemos patinetes. Vendemos **TEMPO** e **LIBERDADE**. O patinete é apenas o meio."},
      {type:"choice_simulation",scenario:"Um pedestre olha com curiosidade para o patinete. Qual sua primeira frase?",question:"Escolha a melhor abordagem:",options:["Quer comprar um pacote de minutos?","Sabia que você chega no trabalho em 5 min com esse patinete?","Oi, você tem o app da JET instalado?"],correct_index:1,feedback_ok:"Excelente! Você focou no BENEFÍCIO (tempo), não no produto.",feedback_err:"Muito direto ao ponto de venda ou técnico. Foque no problema que o patinete resolve!"},
      {type:"quiz",quiz_id:"BAS-01"}
    ])],
    ["BAS-02","BASICO",3,"Missão do Promotor","TRUE",10,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## 🎯 Seu Papel\n1. **Abordar:** 100% das pessoas que passarem.\n2. **Orientar:** Ensinar a usar o app.\n3. **Vender:** Fechar o Combo PLUS."},
      {type:"quiz",quiz_id:"BAS-02"}
    ])],
    ["BAS-03","BASICO",4,"PLUS e Combos","TRUE",15,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## 📦 Nossos Produtos\n- **Avulso:** Caro (para curiosos).\n- **PLUS:** Assinatura (para usuários).\n- **Combo:** PLUS + Minutos (**Melhor custo-benefício**)."},
      {type:"quiz",quiz_id:"BAS-03"}
    ])],
    ["BAS-04","BASICO",5,"Pilar Comercial: O Combo","TRUE",20,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## 💎 Por que focar no Combo?\nO Combo PLUS + 200 min é o que gera a maior economia real para o cliente. Se ele economiza, ele volta.\\n\\n> **Regra de Ouro:** Nunca comece oferecendo o avulso. Comece pelo Combo!"},
      {type:"quiz",quiz_id:"BAS-04"}
    ])],
    ["BAS-05","BASICO",6,"A Abordagem de 5 Segundos","TRUE",15,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## ⏱️ O Tempo é Curto\nVocê tem 5 segundos para ganhar a atenção. Use frases de impacto: 'Já conhece o novo jeito de fugir do trânsito?'"},
      {type:"quiz",quiz_id:"BAS-05"}
    ])],
    ["BAS-06","BASICO",7,"Vencendo o 'Não'","TRUE",10,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## 🛑 Objeções comuns\n- 'Tá caro' -> Mostre o custo do Uber/Ônibus.\n- 'Tenho medo' -> Ofereça um teste assistido de 1 minuto."},
      {type:"quiz",quiz_id:"BAS-06"}
    ])],
    ["BAS-07","BASICO",8,"O Erro do 'Fala-Muito'","TRUE",10,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## 🤐 Menos é Mais\nFalar demais confunde o cliente. Deixe-o testar o patinete o quanto antes. A experiência vende sozinha."},
      {type:"quiz",quiz_id:"BAS-07"}
    ])],
    ["BAS-FINAL","BASICO",99,"Certificação Nível Básico","TRUE",50,"{}","{}",JSON.stringify([{type:"quiz",quiz_id:"BAS-FINAL"}])],

    // --- NÍVEL 2: INTERMEDIÁRIO (6 Módulos) ---
    ["INT-01","INTERMEDIARIO",1,"Qualificação Ninja","TRUE",15,"{\"must_complete_modulos\":[\"BAS-FINAL\"]}","{}",JSON.stringify([
      {type:"text_md",value:"## 🔍 Qualificar é Ganhar Tempo\nDescubra se ele mora perto, onde trabalha e como se desloca. Se o trajeto for curto, ele é um cliente de COMBO."},
      {type:"quiz",quiz_id:"INT-01"}
    ])],
    ["INT-02","INTERMEDIARIO",2,"O Poder do Fechamento A/B","TRUE",15,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## 🥊 Fechamento Direto\nNão pergunte 'Vai querer?'. Pergunte: 'Você prefere o pacote de 200 minutos para o mês todo ou o de 60 minutos para testar agora?'"},
      {type:"quiz",quiz_id:"INT-02"}
    ])],
    ["INT-03","INTERMEDIARIO",3,"Upsell: Vendendo Mais","TRUE",15,"{}","{}",JSON.stringify([
      {type:"text_md",value:"## 🚀 Aumentando o Ticket\nSe o cliente quer 60 min, mostre que por apenas R$ X a mais ele leva o triplo de tempo."},
      {type:"quiz",quiz_id:"INT-03"}
    ])],
    ["INT-04","INTERMEDIARIO",4,"Simulação de Campo (Roleplay)","TRUE",10,"{}","{}",JSON.stringify([{type:"text_md",value:"## Prática\nAssista ao vídeo de uma abordagem real e identifique os pontos de melhoria."}, {type:"quiz",quiz_id:"INT-04"}])],
    ["INT-05","INTERMEDIARIO",5,"Checklist de Excelência","TRUE",10,"{}","{}",JSON.stringify([{type:"text_md",value:"## Organização\nPatinetes alinhados = Vendas aumentadas. O visual do ponto importa."}, {type:"quiz",quiz_id:"INT-05"}])],
    ["INT-FINAL","INTERMEDIARIO",99,"Certificação Intermediária","TRUE",60,"{}","{}",JSON.stringify([{type:"quiz",quiz_id:"INT-FINAL"}])],

    // --- NÍVEL 3: AVANÇADO (4 Módulos) ---
    ["AVA-01","AVANCADO",1,"Venda Consultiva de Luxo","TRUE",25,"{\"must_complete_modulos\":[\"INT-FINAL\"]}","{}",JSON.stringify([
      {type:"text_md",value:"## 👔 Seja um Consultor\nFaça a conta de economia anual para o cliente. Quando ele percebe que economiza R$ 2.000 no ano, a venda está feita."},
      {type:"quiz",quiz_id:"AVA-01"}
    ])],
    ["AVA-02","AVANCADO",2,"Dominando o Microterritório","TRUE",15,"{}","{}",JSON.stringify([{type:"text_md",value:"## Mapa de Calor\nIdentifique os horários de pico e posicione-se onde o fluxo de saída do metrô é maior."},{type:"quiz",quiz_id:"AVA-02"}])],
    ["AVA-03","AVANCADO",3,"KPIs: O que os números dizem","TRUE",15,"{}","{}",JSON.stringify([{type:"text_md",value:"## Conversão\nSe você aborda 100 e vende 2, sua conversão é 2%. O objetivo é chegar em 10%."},{type:"quiz",quiz_id:"AVA-03"}])],
    ["AVA-FINAL","AVANCADO",99,"Certificação Avançada","TRUE",80,"{}","{}",JSON.stringify([{type:"quiz",quiz_id:"AVA-FINAL"}])],

    // --- NÍVEL 4: ESPECIALISTA (5 Módulos) ---
    ["ESP-01","ESPECIALISTA",1,"Liderança por Atitude","TRUE",35,"{\"must_complete_modulos\":[\"AVA-FINAL\"]}","{}",JSON.stringify([
      {type:"text_md",value:"## 👑 Lidere pelo Exemplo\nNão adianta mandar o time abordar se você está no celular. Aborde 10 na frente deles e mostre como se faz."},
      {type:"quiz",quiz_id: "ESP-01"}
    ])],
    ["ESP-02","ESPECIALISTA",2,"Coaching de Campo","TRUE",20,"{}","{}",JSON.stringify([{type:"text_md",value:"## Feedback Real\nObserve seu colega vendendo e dê 1 dica construtiva ao final."},{type:"quiz",quiz_id:"ESP-02"}])],
    ["ESP-03","ESPECIALISTA",3,"Análise de Produtividade","TRUE",20,"{}","{}",JSON.stringify([{type:"text_md",value:"## Dashboards\nComo ler os dados de vendas da sua equipe na planilha master."},{type:"quiz",quiz_id:"ESP-03"}])],
    ["ESP-04","ESPECIALISTA",4,"Gestão de Tempo Crítica","TRUE",15,"{}","{}",JSON.stringify([{type:"text_md",value:"## Foco no Pico\nOrganize as pausas do time fora dos horários de maior venda."},{type:"quiz",quiz_id:"ESP-04"}])],
    ["ESP-FINAL","ESPECIALISTA",99,"Certificação Especialista","TRUE",100,"{}","{}",JSON.stringify([{type:"quiz",quiz_id:"ESP-FINAL"}])],

    // --- NÍVEL 5: MASTER (4 Módulos) ---
    ["MAS-01","MASTER",1,"Formação de Novos Talentos","TRUE",50,"{\"must_complete_modulos\":[\"ESP-FINAL\"]}","{}",JSON.stringify([
      {type:"text_md",value:"## 👶 Onboarding\nO primeiro dia do novato define se ele será um batedor de metas ou se vai desistir em uma semana. Acolha e ensine."},
      {type: "quiz", quiz_id: "MAS-01"}
    ])],
    ["MAS-02","MASTER",2,"Resolução de Conflitos","TRUE",30,"{}","{}",JSON.stringify([{type:"text_md",value:"## Inteligência Emocional\nComo lidar com clientes estressados e manter a calma da equipe."},{type:"quiz",quiz_id:"MAS-02"}])],
    ["MAS-03","MASTER",3,"Cultura de Alta Performance","TRUE",30,"{}","{}",JSON.stringify([{type:"text_md",value:"## Mindset\nTransforme seu time em uma máquina de bater metas e ganhar bônus."},{type:"quiz",quiz_id:"MAS-03"}])],
    ["MAS-FINAL","MASTER",99,"CERTIFICAÇÃO FINAL JET MASTER","TRUE",250,"{}","{}",JSON.stringify([{type:"quiz",quiz_id:"MAS-FINAL"}])]
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
    ["INT-04",1,"Roleplay é uma técnica de:","Descanso","Treinamento por simulação","Mecânica","GPS","b",1],
    ["INT-05",1,"Patinetes alinhados e limpos ajudam a:","Gastar bateria","Atrair mais clientes e vender","Nada","Atrapalhar a calçada","b",1],
    ["INT-FINAL",1,"Se o cliente diz 'está caro', você deve:","Concordar e sair","Comparar com o custo de outros meios","Dar o seu dinheiro","Chorar","b",1],
    ["AVA-01",1,"A venda consultiva foca em:","Preço baixo","Economia real na rotina do cliente","Pressão psicológica","Brindes","b",1],
    ["AVA-02",1,"Onde é o melhor lugar para se posicionar?","Escondido na sombra","No fluxo de saída de pessoas (ex: Metrô)","Longe dos patinetes","Em casa","b",1],
    ["AVA-03",1,"Se abordou 100 e vendeu 5, qual a conversão?","100%","50%","5%","1%","c",1],
    ["AVA-FINAL",1,"KPI de conversão mede:","Velocidade do patinete","Eficiência das suas abordagens","Carga da bateria","Clima","b",1],
    ["ESP-01",1,"O líder especialista deve:","Apenas dar ordens","Liderar pelo exemplo e atitude","Ficar no escritório","Não trabalhar","b",1],
    ["ESP-02",1,"O feedback de coaching deve ser:","Grosseria","Construtivo e focado em evolução","Apenas elogios falsos","Punição","b",1],
    ["ESP-03",1,"Analisar dados serve para:","Perder tempo","Identificar gargalos e agir","Culpar o time","Nada","b",1],
    ["ESP-04",1,"Gestão de tempo no campo exige:","Priorizar horários de pico","Chegar atrasado","Pausas longas no pico","Não ter horário","a",1],
    ["ESP-FINAL",1,"O Especialista domina:","Apenas a venda","A venda e o suporte técnico/liderança","Apenas o app","Nada","b",1],
    ["MAS-01",1,"O Onboarding de um novato deve focar em:","Dar um manual e sair","Acolhimento e ensino prático","Não falar com ele","Mandar ele embora","b",1],
    ["MAS-02",1,"Em um conflito na equipe, o Master deve:","Gritar mais alto","Gerir com inteligência emocional e diálogo","Ignorar","Demitir todos","b",1],
    ["MAS-03",1,"Uma cultura de alta performance foca em:","Sorte","Metas claras e evolução contínua","Fofoca","Desculpas","b",1],
    ["MAS-FINAL",1,"O título de JET MASTER é dado a quem:","Sabe andar de patinete","Lidera e eleva o resultado de toda a operação","Tem mais tempo de empresa","Não faz nada","b",1]
  ];
  q.forEach(r => wsQuiz.appendRow(r));
  
  if (typeof internalSyncAll === 'function') internalSyncAll();
  return "JET Academy Mestra Carregada com 33 Módulos e Quizzes!";
}
