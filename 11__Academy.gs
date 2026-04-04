// ============================================================
//  11.Academy.gs — Trilha Integral e Estruturada JET Academy
//  Carga Mestra: Conteúdo Avançado, Especialista e Master PRO
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
 * SETUP ELITE: 33 MÓDULOS COM FOCO EM PERFORMANCE E VENDA RÁPIDA
 */
function setupNovosModulosAcademy() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsMod = ss.getSheetByName('MODULOS'); wsMod.clear();
  wsMod.appendRow(["modulo_id", "nivel", "ordem", "titulo", "ativo", "pontos", "pre_requisitos_json", "config_conclusao_json", "blocks_json"]);

  const m = [
    // --- NÍVEL 0: MANUAL APP (Manter foco operacional rápido) ---
    ["APP-01","MANUAL APP",1,"Acesso Expresso","TRUE",10,"{}","{}",JSON.stringify([{type:"text_md",value:"## Login de Guerra\nSempre use CPF (apenas números) e Data de Nascimento (DDMMYYYY). Não perca tempo com espaços extras."},{type:"quiz",quiz_id:"APP-01"}])],
    ["APP-02","MANUAL APP",2,"Slots Estratégicos","TRUE",10,"{}","{}",JSON.stringify([{type:"text_md",value:"## Sugestão do Gestor\nSempre aceite vagas com borda amarela. Elas são locais de alta conversão mapeados pelo sistema."},{type:"quiz",quiz_id:"APP-02"}])],
    ["APP-03","MANUAL APP",3,"GPS e Bloqueios","TRUE",10,"{}","{}",JSON.stringify([{type:"text_md",value:"## Raio de Operação\nNão bata o ponto longe do círculo. O sistema entende como tentativa de fraude."},{type:"quiz",quiz_id:"APP-03"}])],
    ["APP-04","MANUAL APP",4,"Aceleração de Reforço","TRUE",10,"{}","{}",JSON.stringify([{type:"text_md",value:"## ✨ Reforço Ativo\nChegou e o ponto está bombando mas não tem vaga? Ative o Reforço imediatamente."},{type:"quiz",quiz_id:"APP-04"}])],
    ["APP-05","MANUAL APP",5,"SOS e Ranking Pro","TRUE",10,"{}","{}",JSON.stringify([{type:"text_md",value:"## Ranking = Prêmios\nO ranking não é só status, é a base para sua bonificação mensal."},{type:"quiz",quiz_id:"APP-05"}])],

    // --- NÍVEL 1: BÁSICO (Abordagem e Produto) ---
    ["BAS-00","BASICO",1,"Manual JET Vendas","TRUE",5,"{\"must_complete_modulos\":[\"APP-05\"]}","{}",JSON.stringify([{type:"welcome_screen",title:"Escola de Vendas",subtitle:"Do Zero ao Combo em 30 segundos."}])],
    ["BAS-01","BASICO",2,"O Que Vendemos?","TRUE",10,"{}","{}",JSON.stringify([{type:"text_md",value:"## Venda Liberdade\nO cliente quer chegar rápido e sem suar. O patinete é o caminho, o tempo é o valor."},{type:"quiz",quiz_id:"BAS-01"}])],
    ["BAS-02","BASICO",3,"A Regra dos 100%","TRUE",10,"{}","{}",JSON.stringify([{type:"text_md",value:"## Abordagem em Massa\nNunca escolha para quem falar. Aborde TODOS. O segredo está no volume."},{type:"quiz",quiz_id:"BAS-02"}])],
    ["BAS-03","BASICO",4,"Produtos JET","TRUE",10,"{}","{}",JSON.stringify([{type:"text_md",value:"## Tabela de Ganhos\n- Avulso: Baixa retenção.\n- PLUS: Cliente fiel.\n- Combo: Sua meta real."},{type:"quiz",quiz_id:"BAS-03"}])],
    ["BAS-04","BASICO",5,"Pilar do Combo","TRUE",15,"{}","{}",JSON.stringify([{type:"text_md",value:"## Ouro do Negócio\nSempre apresente o Combo primeiro. Ele é a única opção lógica de economia."},{type:"quiz",quiz_id:"BAS-04"}])],
    ["BAS-05","BASICO",6,"Pitch de 5 Segundos","TRUE",15,"{}","{}",JSON.stringify([{type:"text_md",value:"## Pitch de Impacto\n'Já conhece a economia da JET? Chegue em 5 min no trabalho hoje!'"},{type:"quiz",quiz_id:"BAS-05"}])],
    ["BAS-06","BASICO",7,"Quebra de Objeção I","TRUE",10,"{}","{}",JSON.stringify([{type:"text_md",value:"## 'Tá Caro'\nResposta: 'Caro é o Uber de R$ 20. Aqui você gasta R$ 2 e chega na frente dele.'"},{type:"quiz",quiz_id:"BAS-06"}])],
    ["BAS-07","BASICO",8,"Foco no Fechamento","TRUE",10,"{}","{}",JSON.stringify([{type:"text_md",value:"## Não perca tempo\nSe o cliente não tem o app, peça para baixar na hora. Não deixe para depois."},{type:"quiz",quiz_id:"BAS-07"}])],
    ["BAS-FINAL","BASICO",99,"Prova Nível Básico","TRUE",25,"{}","{}",JSON.stringify([{type:"quiz",quiz_id:"BAS-FINAL"}])],

    // --- NÍVEL 2: INTERMEDIÁRIO (Psicologia e Técnica) ---
    ["INT-01","INTERMEDIARIO",1,"Qualificação Veloz","TRUE",15,"{\"must_complete_modulos\":[\"BAS-FINAL\"]}","{}",JSON.stringify([{type:"text_md",value:"## Scanner Humano\nIdentifique o trajeto dele em 2 perguntas. Se for metrô/ônibus, ele PRECISA do combo."},{type:"quiz",quiz_id:"INT-01"}])],
    ["INT-02","INTERMEDIARIO",2,"Dualidade (A/B)","TRUE",15,"{}","{}",JSON.stringify([{type:"text_md",value:"## Indução de Escolha\n'Prefere o teste de 60 min ou a economia de 200 min?'"},{type:"quiz",quiz_id:"INT-02"}])],
    ["INT-03","INTERMEDIARIO",3,"Upsell Dinâmico","TRUE",15,"{}","{}",JSON.stringify([{type:"text_md",value:"## Venda Casada\n'Já que vai levar os minutos, a assinatura sai quase de graça agora.'"},{type:"quiz",quiz_id:"INT-03"}])],
    ["INT-04","INTERMEDIARIO",4,"Linguagem Corporal","TRUE",15,"{}","{}",JSON.stringify([{type:"text_md",value:"## Atitude Vencedora\nPostura ereta, contato visual e sorriso. O cliente compra VOCÊ antes do patinete."},{type:"quiz",quiz_id:"INT-04"}])],
    ["INT-05","INTERMEDIARIO",5,"Organização de PDV","TRUE",10,"{}","{}",JSON.stringify([{type:"text_md",value:"## Vitrine Ativa\nPatinetes limpos e virados para o fluxo vendem 30% mais."},{type:"quiz",quiz_id:"INT-05"}])],
    ["INT-FINAL","INTERMEDIARIO",99,"Prova Intermediária","TRUE",30,"{}","{}",JSON.stringify([{type:"quiz",quiz_id:"INT-FINAL"}])],

    // --- NÍVEL 3: AVANÇADO (Gatilhos e Autoridade) ---
    ["AVA-01","AVANCADO",1,"Gatilhos Mentais Pro","TRUE",30,"{\"must_complete_modulos\":[\"INT-FINAL\"]}","{}",JSON.stringify([
      {type:"text_md",value:"## 🧠 Psicologia de Vendas\n- **Escassez:** 'Tenho poucos patinetes com bateria 100% agora.'\n- **Autoridade:** 'Sou especialista em mobilidade da JET e vou te ajudar.'\n- **Prova Social:** 'Só hoje já ativei 15 pessoas aqui nessa saída.'"},
      {type:"choice_simulation",scenario:"O cliente diz: 'Vou pensar e volto depois'.",question:"Qual gatilho usar?",options:["Escassez: 'Tudo bem, mas as vagas do combo podem acabar logo.'","Autoridade: 'Eu não recomendo esperar, você vai perder tempo no trânsito agora.'","Prova Social: 'Muita gente aqui no prédio já aderiu para fugir do trânsito.'"],correct_index:1,feedback_ok:"Autoridade e urgência! Você é o especialista.",feedback_err:"Gatilhos fracos para esse momento. Use sua autoridade!"},
      {type:"quiz",quiz_id:"AVA-01"}
    ])],
    ["AVA-02","AVANCADO",2,"Leitura de Perfil (DISC)","TRUE",20,"{}","{}",JSON.stringify([{type:"text_md",value:"## Adaptabilidade\nVenda rápido para o Dominante, com detalhes para o Analítico e com emoção para o Estável."},{type:"quiz",quiz_id:"AVA-02"}])],
    ["AVA-03","AVANCADO",3,"Custo de Oportunidade","TRUE",20,"{}","{}",JSON.stringify([{type:"text_md",value:"## Matemática de Venda\nMostre que 20 minutos perdidos no trânsito por dia valem R$ 500 no final do mês."},{type:"quiz",quiz_id:"AVA-03"}])],
    ["AVA-FINAL","AVANCADO",99,"Certificação Avançada","TRUE",50,"{}","{}",JSON.stringify([{type:"quiz",quiz_id:"AVA-FINAL"}])],

    // --- NÍVEL 4: ESPECIALISTA (Gestão e Treinamento) ---
    ["ESP-01","ESPECIALISTA",1,"Microgestão de Campo","TRUE",40,"{\"must_complete_modulos\":[\"AVA-FINAL\"]}","{}",JSON.stringify([
      {type:"text_md",value:"## Dominando o Ponto\nComo gerir 3 promotores em uma estação de metrô. Posicionamento em triângulo para cobertura 100%."},
      {type:"quiz",quiz_id: "ESP-01"}
    ])],
    ["ESP-02","ESPECIALISTA",2,"Coaching On-The-Job","TRUE",30,"{}","{}",JSON.stringify([{type:"text_md",value:"## Feedback 360\nComo corrigir a abordagem de um novato sem quebrar o ritmo de venda dele."},{type:"quiz",quiz_id:"ESP-02"}])],
    ["ESP-03","ESPECIALISTA",3,"Conversão e Funil","TRUE",30,"{}","{}",JSON.stringify([{type:"text_md",value:"## Analista de Dados\nSe o seu ponto aborda muito mas vende pouco, o problema é o Pitch ou o Fechamento? Aprenda a diagnosticar."},{type:"quiz",quiz_id:"ESP-03"}])],
    ["ESP-04","ESPECIALISTA",4,"Estratégias de Turno","TRUE",25,"{}","{}",JSON.stringify([{type:"text_md",value:"## Otimização de Pico\nComo escalar a equipe para os 45 minutos de ouro da saída do trabalho."},{type:"quiz",quiz_id:"ESP-04"}])],
    ["ESP-FINAL","ESPECIALISTA",99,"Certificação Especialista","TRUE",70,"{}","{}",JSON.stringify([{type:"quiz",quiz_id:"ESP-FINAL"}])],

    // --- NÍVEL 5: MASTER (Estratégia e Operações) ---
    ["MAS-01","MASTER",1,"Cultura de Tropa de Elite","TRUE",60,"{\"must_complete_modulos\":[\"ESP-FINAL\"]}","{}",JSON.stringify([
      {type:"text_md",value:"## Liderança Visionária\nComo manter a motivação do time no 100% mesmo sob pressão de metas agressivas."},
      {type: "quiz", quiz_id: "MAS-01"}
    ])],
    ["MAS-02","MASTER",2,"Gestão de Crises Operacionais","TRUE",40,"{}","{}",JSON.stringify([{type:"text_md",value:"## Plano de Contingência\nO que fazer quando 50% dos patinetes do ponto ficam sem bateria ao mesmo tempo."},{type:"quiz",quiz_id:"MAS-02"}])],
    ["MAS-03","MASTER",3,"Visão de Business JET","TRUE",40,"{}","{}",JSON.stringify([{type:"text_md",value:"## Além do Campo\nEntenda como sua operação impacta o lucro da cidade e os planos de expansão da JET."},{type:"quiz",quiz_id:"MAS-03"}])],
    ["MAS-FINAL","MASTER",99,"CERTIFICAÇÃO JET MASTER PRO","TRUE",200,"{}","{}",JSON.stringify([{type:"quiz",quiz_id:"MAS-FINAL"}])]
  ];
  m.forEach(r => wsMod.appendRow(r));

  const wsQuiz = ss.getSheetByName('QUIZ'); wsQuiz.clear();
  wsQuiz.appendRow(["quiz_id","q_id","pergunta","a","b","c","d","correta","pontos"]);
  const q = [
    // Quizzes Operacionais Rápidos
    ["APP-01",1,"Qual o erro mais comum no login?","Senha errada","Espaços extras no CPF","App desatualizado","Bateria baixa","b",1],
    ["APP-02",1,"Por que aceitar Sugestões do Gestor?","É obrigatório","São pontos de alta conversão","Ganha mais tempo","Nada","b",1],
    ["APP-03",1,"Fake GPS resulta em:","Aviso","Bônus","Bloqueio Permanente","Nada","c",1],
    ["APP-04",1,"Função Reforço deve ser usada:","Para sair cedo","Quando não há vagas no ponto bombando","Para pedir ajuda","Nada","b",1],
    ["APP-05",1,"O Ranking Nacional define:","Sua cor no app","Sua bonificação e prêmios","Nada","Seu nome","b",1],
    
    // Quizzes Básico e Intermediário
    ["BAS-01",1,"O foco da venda deve ser:","O modelo do patinete","O tempo e liberdade do cliente","A cor do app","O preço avulso","b",1],
    ["BAS-04",1,"Qual a primeira oferta apresentada?","Combo PLUS","Viagem Avulsa","Teste Grátis","Nada","a",1],
    ["INT-02",1,"O fechamento A/B induz o cliente a:","Sair correndo","Escolher entre duas opções de compra","Pedir desconto","Nada","b",1],
    ["INT-04",1,"Linguagem corporal impacta na venda:","Nada","Muito, gera confiança imediata","Pouco","Só se estiver sol","b",1],

    // Quizzes AVANÇADOS (Mais difíceis)
    ["AVA-01",1,"Gatilho de Prova Social usa:","Medo","Exemplo de outras pessoas que compraram","Descontos","Gritos","b",1],
    ["AVA-01",2,"Gatilho de Autoridade foca em:","Ser engraçado","Mostrar conhecimento especialista","Dar ordens","Nenhuma","b",1],
    ["AVA-02",1,"Para vender para um perfil 'Dominante', você deve:","Ser muito lento","Ir direto ao ponto e focar em resultados","Contar histórias longas","Nada","b",1],
    ["AVA-03",1,"Custo de oportunidade é:","O preço do patinete","O valor do tempo que o cliente perde no trânsito","Um desconto","Nada","b",1],
    ["AVA-FINAL",1,"No nível avançado, a venda é:","Por sorte","Baseada em gatilhos mentais e psicologia","Lenta","Apenas técnica","b",1],

    // Quizzes ESPECIALISTA (Gestão)
    ["ESP-01",1,"Posicionamento em triângulo serve para:","Descansar","Cobertura 100% do fluxo de pessoas","Ficar bonito","Nada","b",1],
    ["ESP-02",1,"Como corrigir um novato no campo?","Gritando","Feedback construtivo após a abordagem","Ignorando","Demitindo","b",1],
    ["ESP-03",1,"Diagnóstico de 'Aborda muito / Vende pouco':","Sorte ruim","Pitch fraco ou Falta de fechamento","Ponto ruim","Nada","b",1],
    ["ESP-04",1,"Gestão de pausas no pico:","Deve ser evitada para maximizar vendas","É obrigatória","Pode ser a qualquer hora","Nada","a",1],
    ["ESP-FINAL",1,"O Especialista garante:","Suas próprias vendas","A performance de todo o seu ponto","Nada","A limpeza","b",1],

    // Quizzes MASTER (Estratégia)
    ["MAS-01",1,"Cultura de alta performance exige:","Punições","Metas claras e exemplo da liderança","Sorte","Menos trabalho","b",1],
    ["MAS-02",1,"Crise de bateria no ponto exige:","Desespero","Remanejamento rápido e aviso ao gestor","Ir embora","Nada","b",1],
    ["MAS-03",1,"O Master entende que a operação:","É só vender","Afeta o lucro e expansão da empresa","É chata","Não importa","b",1],
    ["MAS-FINAL",1,"O JET Master PRO é responsável por:","Vender sozinho","O resultado estratégico da cidade/operação","Limpar patinetes","Nada","b",1]
  ];
  q.forEach(r => wsQuiz.appendRow(r));
  
  if (typeof internalSyncAll === 'function') internalSyncAll();
  return "JET Academy ELITE Carregada: 33 Módulos de Alta Performance!";
}
