// ============================================================
//  10.Score.gs  — Gamificação, Ranking e Badges
//  Versão: 2.1  |  Fase 3 — Integrado com novas Badges
// ============================================================

function registrarScore_(ss, userId, tipo, pontos, descricao, jornadaId) {
  const ws = ss.getSheetByName('SCORE_HISTORICO');
  if (!ws) return;
  const agora = new Date().toISOString();
  ws.appendRow([gerarId_('SCR'), userId, tipo, pontos, descricao, jornadaId || '', agora]);
  
  const wsProm = ss.getSheetByName('PROMOTORES');
  const data   = wsProm.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim());
  const iId = h.indexOf('user_id'), iScore = h.indexOf('score_operacional');
  if (iScore < 0) return;
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iId]).trim() === userId) {
      const scoreAtual = parseFloat(data[r][iScore] || '0') || 0;
      wsProm.getRange(r+1, iScore+1).setValue(scoreAtual + pontos);
      break;
    }
  }
}

function getScore_(userId) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws = ss.getSheetByName('PROMOTORES'), data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim());
  const iId = h.indexOf('user_id'), iScore = h.indexOf('score_operacional'), iStreak = h.indexOf('streak_dias');
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iId]).trim() === userId) return { score: parseFloat(data[r][iScore] || '0') || 0, streak: parseInt(data[r][iStreak] || '0') || 0 };
  }
  return { score: 0, streak: 0 };
}

function getRankings_(user, periodo) {
  // periodo: 'SEMANAL' | 'MENSAL' | 'GERAL'
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws = ss.getSheetByName('SCORE_HISTORICO');
  if (!ws) return { ok: true, nacional: [], regional: [], equipes: [] };
  
  const data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim());
  const iUsr = h.indexOf('user_id'), iPts = h.indexOf('pontos'), iDt = h.indexOf('criado_em');
  
  const agora = new Date();
  let dataLimite = null;
  
  if (periodo === 'SEMANAL') {
    dataLimite = new Date(agora.getTime() - 7 * 86400000);
  } else if (periodo === 'MENSAL') {
    dataLimite = new Date(agora.getFullYear(), agora.getMonth(), 1); 
  }

  const totais = {};
  const totaisEquipe = {};
  
  const promMap = _getPromotoresMap_(ss);
  
  // Mapeamento de Equipes
  const userToEquipe = {};
  const equipeInfo = {};
  const wsEq = ss.getSheetByName('EQUIPE');
  const wsMem = ss.getSheetByName('EQUIPE_MEMBROS');
  if (wsEq && wsMem) {
    const dEq = wsEq.getDataRange().getValues(), hEq = dEq[0].map(v => String(v).toLowerCase().trim());
    for(let r=1; r<dEq.length; r++) {
      const eqId = String(dEq[r][hEq.indexOf('equipe_id')]).trim();
      equipeInfo[eqId] = { nome: dEq[r][hEq.indexOf('nome_equipe')], cidade: dEq[r][hEq.indexOf('cidade')] };
    }
    const dMem = wsMem.getDataRange().getValues(), hMem = dMem[0].map(v => String(v).toLowerCase().trim());
    for(let r=1; r<dMem.length; r++) {
      if (String(dMem[r][hMem.indexOf('ativo')]).toUpperCase() === 'TRUE') {
        userToEquipe[String(dMem[r][hMem.indexOf('user_id')]).trim()] = String(dMem[r][hMem.indexOf('equipe_id')]).trim();
      }
    }
  }

  for (let r = 1; r < data.length; r++) {
    const dataRegistro = new Date(data[r][iDt]);
    if (dataLimite && dataRegistro < dataLimite) continue;
    const uid = String(data[r][iUsr]).trim();
    if (!uid) continue;
    const pts = parseFloat(data[r][iPts] || '0');
    totais[uid] = (totais[uid] || 0) + pts;
    
    const eqId = userToEquipe[uid];
    if (eqId) {
      totaisEquipe[eqId] = (totaisEquipe[eqId] || 0) + pts;
    }
  }
  
  const entries = Object.entries(totais).sort((a, b) => b[1] - a[1]);
  
  const nacional = entries.slice(0, 10).map(([uid, pts], i) => ({
    posicao: i + 1,
    user_id: uid,
    nome: promMap[uid]?.nome || uid,
    pontos: pts,
    cidade: promMap[uid]?.cidade || ''
  }));

  const userCity = user?.cidade_base || '';
  const regionalEntries = entries.filter(([uid]) => normStr_(promMap[uid]?.cidade) === normStr_(userCity));
  const regional = regionalEntries.slice(0, 10).map(([uid, pts], i) => ({
    posicao: i + 1,
    user_id: uid,
    nome: promMap[uid]?.nome || uid,
    pontos: pts
  }));

  const eqEntries = Object.entries(totaisEquipe).sort((a, b) => b[1] - a[1]);
  const rankingEquipes = eqEntries.slice(0, 5).map(([eqId, pts], i) => ({
    posicao: i + 1,
    equipe_id: eqId,
    nome: equipeInfo[eqId]?.nome || eqId,
    cidade: equipeInfo[eqId]?.cidade || '',
    pontos: Math.round(pts)
  }));

  let meuNacional = null;
  let minhaEquipeRanking = null;

  if (user?.user_id) {
    const nIdx = entries.findIndex(e => e[0] === user.user_id);
    if (nIdx > -1) meuNacional = { posicao: nIdx + 1, pontos: totais[user.user_id] };
    
    let meuRegional = null;
    const rIdx = regionalEntries.findIndex(e => e[0] === user.user_id);
    if (rIdx > -1) meuRegional = { posicao: rIdx + 1, pontos: totais[user.user_id] };

    const eqId = userToEquipe[user.user_id];
    if (eqId) {
      const eIdx = eqEntries.findIndex(e => e[0] === eqId);
      minhaEquipeRanking = { 
        posicao: eIdx + 1, 
        pontos: Math.round(totaisEquipe[eqId]), 
        nome: equipeInfo[eqId]?.nome,
        equipe_id: eqId
      };
    }
    
    return { ok: true, nacional, regional, equipes: rankingEquipes, meuNacional, meuRegional, minhaEquipeRanking, cidade: userCity };
  }

  return { ok: true, nacional, regional, equipes: rankingEquipes, cidade: userCity };
}

function getMeuExtratoScore_(userId) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws = ss.getSheetByName('SCORE_HISTORICO');
  if (!ws) return { ok: true, extrato: [] };
  
  const data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim());
  const iUsr = h.indexOf('user_id'), iPts = h.indexOf('pontos'), iTipo = h.indexOf('tipo'), iDesc = h.indexOf('descricao'), iDt = h.indexOf('criado_em');
  
  const extrato = [];
  // Pega os últimos 30 registros do usuário (lendo de baixo para cima)
  for (let r = data.length - 1; r >= 1; r--) {
    if (String(data[r][iUsr]).trim() === userId) {
      extrato.push({
        tipo: data[r][iTipo],
        pontos: data[r][iPts],
        descricao: data[r][iDesc],
        criado_em: data[r][iDt]
      });
      if (extrato.length >= 30) break;
    }
  }
  
  return { ok: true, extrato };
}

function verificarBadges_(ss, userId, contexto) {
  const wsBadges = ss.getSheetByName('BADGES');
  if (!wsBadges) return [];

  const data = wsBadges.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim());
  const iUsr = h.indexOf('user_id'), iTipo = h.indexOf('tipo'), conquistados = new Set();
  for (let r = 1; r < data.length; r++) { if (String(data[r][iUsr]).trim() === userId) conquistados.add(String(data[r][iTipo]).trim()); }

  const agora = new Date().toISOString(), novos = [];
  function darBadge(tipo, descricao) {
    if (conquistados.has(tipo)) return;
    wsBadges.appendRow([gerarId_('BDG'), userId, tipo, descricao, agora]);
    conquistados.add(tipo);
    novos.push({ tipo, descricao });
  }

  if (contexto.evento === 'CHECKIN') {
    const total = (getHistorico_( {user_id:userId}, {} )).historico?.length || 0;
    if (total <= 1) darBadge('PRIMEIRO_CHECKIN', '🌟 Primeiro check-in realizado!');
    if (total >= 10) darBadge('DEZ_JORNADAS', '💪 10 jornadas completas!');
    if (contexto.pontual) darBadge('CHECKIN_PONTUAL_1', '🎯 Primeiro check-in pontual!');
    if (new Date().getHours() < 7) darBadge('MADRUGADOR', '🚀 Madrugador — check-in antes das 7h!');
  }

  if (contexto.streak >= 5)  darBadge('STREAK_5',  '🔥 5 dias consecutivos!');
  if (contexto.streak >= 10) darBadge('STREAK_10', '⚡ 10 dias consecutivos!');

  if (contexto.evento === 'CHECKOUT' && verificarSemCancelamentoMes_(ss, userId)) darBadge('SEM_CANCELAMENTO_MES', '🏆 Mês sem cancelamentos!');

  if (contexto.evento === 'INDICACAO') {
    const wsInd = ss.getSheetByName('INDICACOES');
    if (wsInd) {
      const dataInd = wsInd.getDataRange().getValues(), hInd = dataInd[0].map(v => String(v).toLowerCase().trim());
      let totalInd = 0;
      for (let r = 1; r < dataInd.length; r++) { if (String(dataInd[r][hInd.indexOf('indicado_por')]).trim() === userId) totalInd++; }
      if (totalInd >= 1) darBadge('INDICACAO_1', '🤝 1 indicação');
      if (totalInd >= 5) darBadge('INDICACAO_5', '🤝 5 indicações');
    }
  }

  if (contexto.evento === 'LIDER_CAMPEAO_SEMANA') {
    darBadge('TOP3_MES_LIDER', `Líder da Equipe Campeã: ${contexto.nome_equipe}`);
  }

  return novos;
}

function verificarSemCancelamentoMes_(ss, userId) {
  const ws = ss.getSheetByName('JORNADAS'), data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim());
  const iUsr = h.indexOf('user_id'), iStt = h.indexOf('status'), iDt = h.indexOf('criado_em');
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0,0,0,0);
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iUsr]).trim() !== userId) continue;
    if (String(data[r][iStt]).trim() === 'CANCELADO' && new Date(String(data[r][iDt])) >= inicioMes) return false;
  }
  return true;
}

function getBadges_(userId) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), ws = ss.getSheetByName('BADGES');
  if (!ws) return { ok: true, badges: [] };
  const data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim());
  const badges = [];
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][h.indexOf('user_id')]).trim() !== userId) continue;
    badges.push({ tipo: String(data[r][h.indexOf('tipo')]), descricao: String(data[r][h.indexOf('descricao')]), conquistado_em: String(data[r][h.indexOf('conquistado_em')]) });
  }
  return { ok: true, badges };
}

/**
 * Trigger Automático: Ranking Semanal
 * Deve ser configurado para rodar toda Segunda-Feira (08:00 - 10:00)
 */
function triggerRankingSemanal() {
  const res = getRankings_(null, 'SEMANAL');
  if (!res.ok) return;

  const topEquipe = res.equipes[0];
  const topIndividual = res.nacional[0];

  if (!topEquipe && !topIndividual) return;

  const integracoes = [];
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const promMap = _getPromotoresMap_(ss);

  // 1. Mensagem de Alerta Geral / Broadcast
  let msg = `🏆 <b>HALL DA FAMA — RANKING SEMANAL</b> 🏆\n\n`;
  
  if (topIndividual) {
    msg += `🥇 <b>PROMOTOR DESTAQUE</b>\n👤 ${topIndividual.nome}\n📈 ${topIndividual.pontos} pontos\n\n`;
  }

  if (topEquipe) {
    msg += `👥 <b>EQUIPE CAMPEÃ</b>\n🚩 ${topEquipe.nome}\n🏙️ ${topEquipe.cidade}\n🔥 ${topEquipe.pontos} pontos acumulados\n\n`;
  }

  msg += `<i>Parabéns a todos pelo empenho na última semana! O ranking foi resetado e uma nova disputa começou.</i> 🚀`;

  // Enviar para canais de ALERTAS de cada cidade que teve destaque ou global
  const cidadesSet = new Set();
  if (topIndividual && topIndividual.cidade) cidadesSet.add(topIndividual.cidade);
  if (topEquipe && topEquipe.cidade) cidadesSet.add(topEquipe.cidade);

  if (cidadesSet.size > 0) {
    cidadesSet.forEach(cid => {
      integracoes.push({
        canal: 'telegram',
        tipo: 'group_message',
        cidade: cid,
        topic_key: 'ALERTAS',
        parse_mode: 'HTML',
        text_html: msg
      });
    });
  } else {
    // Fallback se não detectar cidade (envia via broadcast para todos os gestores)
    integracoes.push({
      canal: 'telegram',
      tipo: 'group_message',
      cidade: 'TODAS', // Se houver um grupo global mapeado
      topic_key: 'ALERTAS',
      parse_mode: 'HTML',
      text_html: msg
    });
  }

  // 2. Bonificação Especial (Badge de Líder da Semana)
  if (topEquipe) {
    const wsEq = ss.getSheetByName('EQUIPE');
    const wsMem = ss.getSheetByName('EQUIPE_MEMBROS');
    if (wsEq && wsMem) {
      const dEq = wsEq.getDataRange().getValues(), hEq = dEq[0].map(v => String(v).toLowerCase().trim());
      let gestorId = '';
      for (let r=1; r<dEq.length; r++) {
        if (String(dEq[r][hEq.indexOf('equipe_id')]).trim() === topEquipe.equipe_id) {
          gestorId = String(dEq[r][hEq.indexOf('gestor_id')]).trim();
          break;
        }
      }

      // Encontrar Líderes da equipe campeã
      const dMem = wsMem.getDataRange().getValues(), hMem = dMem[0].map(v => String(v).toLowerCase().trim());
      const iEq = hMem.indexOf('equipe_id'), iUsr = hMem.indexOf('user_id'), iPpl = hMem.indexOf('papel_na_equipe'), iAto = hMem.indexOf('ativo');
      
      for (let r=1; r<dMem.length; r++) {
        if (String(dMem[r][iEq]).trim() === topEquipe.equipe_id && 
            String(dMem[r][iPpl]).trim().toUpperCase() === 'LIDER' &&
            String(dMem[r][iAto]).toUpperCase() === 'TRUE') {
          
          const liderId = String(dMem[r][iUsr]).trim();
          // Badge temporária ou registro de conquista
          verificarBadges_(ss, liderId, { evento: 'LIDER_CAMPEAO_SEMANA', nome_equipe: topEquipe.nome });
          
          // Notificar o Líder no privado
          const pLider = promMap[liderId];
          if (pLider && pLider.telegram_user_id) {
            integracoes.push({
              canal: 'telegram',
              tipo: 'private_message',
              telegram_user_id: String(pLider.telegram_user_id),
              parse_mode: 'HTML',
              text_html: `🌟 <b>PARABÉNS, LÍDER!</b>\n\nSua equipe <b>${topEquipe.nome}</b> foi a campeã da semana! Seu empenho na gestão fez a diferença. Continue assim! 🏆`
            });
          }
        }
      }
    }
  }

  processIntegracoes(integracoes, { evento: 'RANKING_SEMANAL_AUTOMATICO' });

  // 3. Registrar no Hall da Fama (Aba RANKING_HISTORICO)
  registrarHallDaFama_(ss, topIndividual, topEquipe);

  // 4. Verificar Desafios de Equipe (Team Quests)
  verificarDesafiosEquipe_(ss);
}

function registrarHallDaFama_(ss, topInd, topEq) {
  let ws = ss.getSheetByName('RANKING_HISTORICO');
  if (!ws) {
    ws = ss.insertSheet('RANKING_HISTORICO');
    ws.appendRow(['periodo_fim', 'tipo', 'vencedor_id', 'nome', 'pontos', 'cidade']);
  }
  const dataRef = new Date().toISOString().substring(0, 10);
  if (topInd) ws.appendRow([dataRef, 'INDIVIDUAL', topInd.user_id, topInd.nome, topInd.pontos, topInd.cidade]);
  if (topEq)  ws.appendRow([dataRef, 'EQUIPE', topEq.equipe_id, topEq.nome, topEq.pontos, topEq.cidade]);
}

function verificarDesafiosEquipe_(ss) {
  // Exemplo de Quest: "Equipe com mais de 500 pontos na semana ganha bônus"
  const res = getRankings_(null, 'SEMANAL');
  const metaPontos = 500;
  const bonusQuest = 50;

  res.equipes.forEach(eq => {
    if (eq.pontos >= metaPontos) {
      // Dar bônus para todos os membros ativos da equipe
      const wsMem = ss.getSheetByName('EQUIPE_MEMBROS');
      const dMem = wsMem.getDataRange().getValues(), hMem = dMem[0].map(v => String(v).toLowerCase().trim());
      const iEq = hMem.indexOf('equipe_id'), iUsr = hMem.indexOf('user_id'), iAto = hMem.indexOf('ativo');
      
      for (let r=1; r<dMem.length; r++) {
        if (String(dMem[r][iEq]).trim() === eq.equipe_id && String(dMem[r][iAto]).toUpperCase() === 'TRUE') {
          const uId = String(dMem[r][iUsr]).trim();
          registrarScore_(ss, uId, 'TEAM_QUEST_BONUS', bonusQuest, `Bônus Meta de Equipe: ${eq.nome}`, '');
          enviarPush_(uId, '🏆 Meta de Equipe Batida!', `Sua equipe atingiu a meta semanal! +${bonusQuest} pontos de bônus pra você.`);
        }
      }
    }
  });
}