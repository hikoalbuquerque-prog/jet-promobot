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
  if (!ws) return { ok: true, nacional: [], regional: [] };
  
  const data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim());
  const iUsr = h.indexOf('user_id'), iPts = h.indexOf('pontos'), iDt = h.indexOf('criado_em');
  
  const agora = new Date();
  let dataLimite = null;
  
  if (periodo === 'SEMANAL') {
    dataLimite = new Date(agora.getTime() - 7 * 86400000);
  } else if (periodo === 'MENSAL') {
    dataLimite = new Date(agora.getFullYear(), agora.getMonth(), 1); // Início do mês atual
  }

  const totais = {};
  for (let r = 1; r < data.length; r++) {
    if (dataLimite && new Date(data[r][iDt]) < dataLimite) continue;
    const uid = String(data[r][iUsr]).trim();
    totais[uid] = (totais[uid] || 0) + parseFloat(data[r][iPts] || '0');
  }
  
  const promMap = _getPromotoresMap_(ss);
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

  let meuNacional = null;
  if (user?.user_id) {
    const nIdx = entries.findIndex(e => e[0] === user.user_id);
    if (nIdx > -1) meuNacional = { posicao: nIdx + 1, pontos: totais[user.user_id] };
    
    let meuRegional = null;
    const rIdx = regionalEntries.findIndex(e => e[0] === user.user_id);
    if (rIdx > -1) meuRegional = { posicao: rIdx + 1, pontos: totais[user.user_id] };
    
    return { ok: true, nacional, regional, meuNacional, meuRegional, cidade: userCity };
  }

  return { ok: true, nacional, regional, cidade: userCity };
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