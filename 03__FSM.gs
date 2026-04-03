// ============================================================
//  03.FSM.gs  — Motor FSM + Jornadas + Sequenciamento de Slots
//  Versão: 3.1  |  Fase 3 — Consolidação Multi-slots + iOS Checkin
// ============================================================

function processarFSM_(user, body, evento) {
  const ss       = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const slotId   = body.slot_id   || '';
  const jornId   = body.jornada_id || '';
  const lat      = parseFloat(body.lat  || 0);
  const lng      = parseFloat(body.lng  || 0);
  const foto     = body.foto_url  || '';
  const motivo   = body.motivo    || '';

  let jornada = null;
  if (jornId) {
    jornada = getJornada_(ss, jornId);
  } else if (slotId) {
    jornada = getJornadaPorSlot_(ss, slotId, user.user_id);
  }
  if (!jornada && evento !== 'ACEITAR_SLOT') return { ok: false, erro: 'jornada não encontrada' };

  const estadoAtual = jornada ? jornada.status : 'DISPONIVEL';
  const transicao = buscarTransicao_(ss, estadoAtual, evento, user);
  if (!transicao) return { ok: false, erro: `Transição inválida: ${estadoAtual} → ${evento}` };

  const horarioServidor = new Date().toISOString();

  let score = 0;
  if (transicao.requer_localizacao === 'TRUE' || transicao.requer_localizacao === true) {
    if (!lat || !lng) return { ok: false, erro: 'Localização obrigatória para este evento' };
    score = calcularLocationTrustScore_({ lat, lng, isMock: body.is_mock === true, accuracy: body.accuracy || 999 });
    const minScore = parseInt(getConfig_('location_trust_min_checkin') || '50');
    if (score < minScore) return { ok: false, erro: `location_trust_score insuficiente: ${score} (mín: ${minScore})` };
  }

  if (transicao.requer_evidencia === 'TRUE' || transicao.requer_evidencia === true) {
    if (!foto && !motivo) return { ok: false, erro: 'Evidência (foto ou motivo) obrigatória' };
  }

  let resultado = {};
  switch (evento) {
    case 'ACEITAR_SLOT':          resultado = aceitarSlot_(ss, user, body, horarioServidor);              break;
    case 'CHECKIN':               resultado = executarCheckin_(ss, jornada, user, body, horarioServidor); break;
    case 'PAUSE':                 resultado = mudarStatus_(ss, jornada, transicao.proximo_estado, horarioServidor); break;
    case 'RESUME':                resultado = mudarStatus_(ss, jornada, transicao.proximo_estado, horarioServidor); break;
    case 'CHECKOUT':              resultado = executarCheckout_(ss, jornada, user, body, horarioServidor, false); break;
    case 'CHECKOUT_EXCEPCIONAL':  resultado = executarCheckout_(ss, jornada, user, body, horarioServidor, true);  break;
    default:                      resultado = mudarStatus_(ss, jornada, transicao.proximo_estado, horarioServidor);
  }

  if (!resultado.ok) return resultado;

  registrarEventoLog_({
    user_id: user.user_id,
    jornada_id: resultado.jornada_id || jornId,
    evento,
    estado_anterior: estadoAtual,
    estado_novo: transicao.proximo_estado,
    origem: 'app',
    tipo_evento: 'HUMANO',
    criticidade: 'informativo',
    payload: body,
    horario_servidor: horarioServidor
  });

  const integracoes = montarIntegracoes_(evento, resultado, user, body, jornada);

  return { ok: true, estado_novo: transicao.proximo_estado, jornada_id: resultado.jornada_id, integracoes };
}

function buscarTransicao_(ss, estadoAtual, evento, user) {
  const ws   = ss.getSheetByName('FSM_TRANSICOES');
  const data = ws.getDataRange().getValues();
  const h    = data[0].map(v => String(v).toLowerCase().trim());
  const iEstado=h.indexOf('estado_atual'), iEvento=h.indexOf('evento'), iProximo=h.indexOf('proximo_estado');
  const iScopeOp=h.indexOf('scope_operacao'), iScopeVinc=h.indexOf('scope_vinculo');
  const iScopeCargo=h.indexOf('scope_cargo'), iReqLoc=h.indexOf('requer_localizacao');
  const iReqEv=h.indexOf('requer_evidencia'), iReqAp=h.indexOf('requer_aprovacao'), iAtivo=h.indexOf('ativo');

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (String(row[iAtivo]).toLowerCase() !== 'true') continue;
    if (row[iEstado] !== estadoAtual) continue;
    if (row[iEvento] !== evento) continue;
    const op=String(row[iScopeOp]), vinc=String(row[iScopeVinc]), cargo=String(row[iScopeCargo]);
    if (op    !== '*' && op    !== (user.operacao       || '')) continue;
    if (vinc  !== '*' && vinc  !== (user.tipo_vinculo   || '')) continue;
    if (cargo !== '*' && cargo !== (user.cargo_principal|| '')) continue;
    return { proximo_estado:row[iProximo], requer_localizacao:row[iReqLoc], requer_evidencia:row[iReqEv], requer_aprovacao:row[iReqAp] };
  }
  return null;
}

function aceitarSlot_(ss, user, body, horarioServidor) {
  const slotId = body.slot_id;
  if (!slotId) return { ok: false, erro: 'slot_id obrigatório' };

  const wsSlots = ss.getSheetByName('SLOTS');
  const dataS   = wsSlots.getDataRange().getValues();
  const hS      = dataS[0].map(v => String(v).toLowerCase().trim());
  const iSlotId=hS.indexOf('slot_id'), iStatus=hS.indexOf('status'), iUserId=hS.indexOf('user_id');
  const iJornId=hS.indexOf('jornada_id'), iUpdAt=hS.indexOf('atualizado_em');

  for (let r = 1; r < dataS.length; r++) {
    if (String(dataS[r][iSlotId]).trim() !== slotId) continue;
    if (dataS[r][iStatus] !== 'DISPONIVEL') return { ok: false, erro: 'Slot não disponível: ' + dataS[r][iStatus] };

    const verificacao = verificarSequenciamento_(ss, user.user_id, dataS[r], hS);
    if (verificacao.conflito) return { ok: false, erro: verificacao.mensagem };

    const jornId = gerarId_('JRN');
    wsSlots.getRange(r+1, iStatus+1).setValue('ACEITO');
    wsSlots.getRange(r+1, iUserId+1).setValue(user.user_id);
    wsSlots.getRange(r+1, iJornId+1).setValue(jornId);
    wsSlots.getRange(r+1, iUpdAt+1).setValue(horarioServidor);

    if (verificacao.slot_anterior_id) {
      const iSlotAnt=hS.indexOf('slot_anterior_id'), iTempDesc=hS.indexOf('tempo_estimado_deslocamento_min');
      const iTransPre=hS.indexOf('transicao_pre_aprovada'), iTipoTran=hS.indexOf('tipo_transicao');
      if (iSlotAnt>-1)  wsSlots.getRange(r+1, iSlotAnt+1).setValue(verificacao.slot_anterior_id);
      if (iTempDesc>-1) wsSlots.getRange(r+1, iTempDesc+1).setValue(verificacao.tempo_estimado_min);
      if (iTransPre>-1) wsSlots.getRange(r+1, iTransPre+1).setValue(verificacao.pre_aprovado ? 'TRUE' : 'FALSE');
      if (iTipoTran>-1) wsSlots.getRange(r+1, iTipoTran+1).setValue(verificacao.tipo_transicao);
    }

    const slot = mapearSlot_(hS, dataS[r]);
    criarJornada_(ss, { jornada_id: jornId, user, slot, horarioServidor });
    gerarConviteCalendar_(user, slot, jornId);

    return { ok: true, jornada_id: jornId, slot_id: slotId, slot };
  }
  return { ok: false, erro: 'slot_id não encontrado' };
}


function executarCheckin_(ss, jornada, user, body, horarioServidor) {
  const lat = parseFloat(body.lat || 0);
  const lng = parseFloat(body.lng || 0);
  const forcar = body.forcar === true || body.ignore_radius === true;

  const slot  = getSlot_(ss, jornada.slot_id);
  const raio  = parseFloat(slot ? slot.raio_metros : getConfig_('raio_checkin_metros') || 200);
  const distM = haversineMetros_(lat, lng, parseFloat(slot.lat), parseFloat(slot.lng));
  
  if (distM > raio && !forcar) {
    return { ok: false, erro: `Fora do raio: ${Math.round(distM)}m (máx ${raio}m)`, fora_do_raio: true, distancia: Math.round(distM) };
  }

  // ── Validação de horário ────────────────────────────────────
  const dataSlot  = String(slot?.data || '').substring(0, 10);
  const inicioStr = String(slot?.inicio || '').substring(0, 5);
  if (dataSlot && inicioStr) {
    const agora    = new Date(horarioServidor);
    const slotDt   = new Date(dataSlot + 'T' + inicioStr + ':00');
    const diffMin  = (slotDt - agora) / 60000; // positivo = falta X min para começar
    if (diffMin > 60) return { ok: false, erro: `Check-in disponível apenas 1h antes do início. Faltam ${Math.round(diffMin)} minutos.` };
    if (diffMin < -120) return { ok: false, erro: 'Este slot já encerrou.' };
  }

  const score = calcularLocationTrustScore_({ lat, lng, isMock: body.is_mock === true, accuracy: body.accuracy || 999 });
  atualizarJornada_(ss, jornada.jornada_id, {
    status: 'EM_ATIVIDADE', inicio_real: horarioServidor,
    checkin_lat: lat, checkin_lng: lng, location_trust_score: score,
    horario_servidor_checkin: horarioServidor, evidencia_checkin: body.foto_url || '', atualizado_em: horarioServidor,
    checkin_fora_raio: distM > raio
  });

  consolidarPromocode_(ss, jornada.slot_id, user.user_id);

  // ── Calcula atraso ──────────────────────────────────────────
  const slotDt    = slot?.data && slot?.inicio ? new Date(String(slot.data).substring(0,10) + 'T' + String(slot.inicio).substring(0,5) + ':00') : null;
  const atrasoMin = slotDt ? Math.floor((new Date(horarioServidor) - slotDt) / 60000) : 999;
  const pontual   = atrasoMin <= 5;

  // ── Score ───────────────────────────────────────────────────
  try {
    registrarScore_(ss, user.user_id, pontual ? 'CHECKIN_PONTUAL' : 'CHECKIN_ATRASADO', pontual ? 10 : 5, pontual ? 'Check-in pontual' : `Check-in com ${atrasoMin}min de atraso`, jornada.jornada_id);
  } catch(_) {}

  // ── Badges ──────────────────────────────────────────────────
  try {
    verificarBadges_(ss, user.user_id, {
      evento: 'CHECKIN',
      pontual,
      streak: getScore_(user.user_id).streak
    });
  } catch(_) {}

  return { ok: true, jornada_id: jornada.jornada_id, slot, distancia_metros: Math.round(distM), location_trust_score: score };
}

function executarCheckout_(ss, jornada, user, body, horarioServidor, excepcional) {
  const lat = parseFloat(body.lat || 0);
  const lng = parseFloat(body.lng || 0);
  const campos = { status:'ENCERRADO', fim_real:horarioServidor, horario_servidor_checkout:horarioServidor, evidencia_checkout:body.foto_url||'', atualizado_em:horarioServidor };
  if (lat && lng) { campos.checkout_lat=lat; campos.checkout_lng=lng; }

  atualizarJornada_(ss, jornada.jornada_id, campos);
  atualizarSlotStatus_(ss, jornada.slot_id, 'ENCERRADO', horarioServidor);

  const slot = getSlot_(ss, jornada.slot_id);
  let duracao = '—';
  const inicioReal = jornada.inicio_real || '';
  if (inicioReal) {
    try {
      const diffMs = new Date(horarioServidor) - new Date(inicioReal);
      if (diffMs > 0) {
        const hh = Math.floor(diffMs/3600000), mm = Math.floor((diffMs%3600000)/60000);
        duracao = hh + 'h' + String(mm).padStart(2,'0');
      }
    } catch(_) {}
  }

  // ── Score: checkout +5 ──────────────────────────────────────
  try {
    registrarScore_(ss, user.user_id, 'CHECKOUT', 5, 'Jornada encerrada — ' + duracao, jornada.jornada_id);
    atualizarStreak_(ss, user.user_id, horarioServidor);
  } catch(_) {}

  try {
    verificarBadges_(ss, user.user_id, {
      evento: 'CHECKOUT',
      streak: getScore_(user.user_id).streak
    });
  } catch(_) {}


  if (excepcional) {
    registrarScore_(ss, user.user_id, 'CHECKOUT_SEM_GPS', -5, 'Checkout sem GPS', jornada.jornada_id);
  }


  return { ok: true, jornada_id: jornada.jornada_id, slot, duracao, excepcional };
}

function cancelarSlot_(user, body) {
  const ss     = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const jornId = body.jornada_id || '';
  const slotId = body.slot_id    || '';
  const agora  = new Date().toISOString();

  const jornada = getJornada_(ss, jornId);
  if (!jornada) return { ok: false, erro: 'Jornada não encontrada' };
  if (jornada.status !== 'ACEITO') return { ok: false, erro: 'Só é possível cancelar slot no status ACEITO' };
  if (jornada.user_id !== user.user_id) return { ok: false, erro: 'Sem permissão' };

  atualizarJornada_(ss, jornId, { status: 'CANCELADO', atualizado_em: agora });

  const wsSlots = ss.getSheetByName('SLOTS');
  if (wsSlots && slotId) {
    const data = wsSlots.getDataRange().getValues();
    const h    = data[0].map(v => String(v).toLowerCase().trim());
    const iId  = h.indexOf('slot_id'), iSt = h.indexOf('status');
    const iUsr = h.indexOf('user_id'), iJrn = h.indexOf('jornada_id'), iUpd = h.indexOf('atualizado_em');
    for (let r = 1; r < data.length; r++) {
      if (String(data[r][iId]).trim() !== slotId) continue;
      if (iSt  > -1) wsSlots.getRange(r+1, iSt+1).setValue('DISPONIVEL');
      if (iUsr > -1) wsSlots.getRange(r+1, iUsr+1).setValue('');
      if (iJrn > -1) wsSlots.getRange(r+1, iJrn+1).setValue('');
      if (iUpd > -1) wsSlots.getRange(r+1, iUpd+1).setValue(agora);
      break;
    }
  }

  // ── Score: cancelamento -20 ─────────────────────────────────
  try {
    registrarScore_(ss, user.user_id, 'CANCELAMENTO', -20, 'Slot cancelado antecipadamente', jornId);
  } catch(_) {}

  const slot = getSlot_(ss, slotId);
  const hora = new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  const integracoes = [{
    canal: 'telegram', tipo: 'group_message',
    cidade: user.cidade_base || slot?.cidade || '',
    topic_key: 'ENCERRAMENTOS',
    parse_mode: 'HTML',
    text_html: `⚠️ <b>Slot Cancelado</b>\n\n👤 <b>${user.nome_completo || user.user_id}</b>\n🔧 ${user.cargo_principal || ''}\n📍 ${slot?.local_nome || slot?.local || slotId}\n⏰ ${hora}`,
  }];

  return { ok: true, integracoes };
}

function mudarStatus_(ss, jornada, novoStatus, horarioServidor) {
  atualizarJornada_(ss, jornada.jornada_id, { status: novoStatus, atualizado_em: horarioServidor });
  return { ok: true, jornada_id: jornada.jornada_id };
}

function processarHeartbeat_(user, body) {
  const ss     = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const jornId = body.jornada_id;
  if (!jornId) return { ok: false, erro: 'jornada_id obrigatório' };

  const lat=parseFloat(body.lat||0), lng=parseFloat(body.lng||0);
  const isMock=body.is_mock===true, acc=body.accuracy||999;
  const score=calcularLocationTrustScore_({lat,lng,isMock,accuracy:acc});
  const agora=new Date().toISOString();

  const ws=ss.getSheetByName('LOCALIZACAO_TEMPO_REAL');
  if (ws) ws.appendRow([gerarId_('LOC'),user.user_id,jornId,lat,lng,acc,isMock,score,false,agora,body.horario_dispositivo||agora,body.app_version||'',body.device_id||'']);

  const jornada=getJornada_(ss,jornId);
  if (!jornada) return { ok: false, erro: 'jornada não encontrada' };

  let novoStatus=jornada.status;
  if (['SEM_SINAL','MAPEAMENTO_INTERROMPIDO','AGUARDANDO_RASTREIO'].includes(jornada.status)) {
    novoStatus='EM_TURNO';
    atualizarJornada_(ss,jornId,{status:novoStatus,atualizado_em:agora});
  }
  return { ok: true, status: novoStatus, location_trust_score: score };
}

// ── Integrações de retorno — NOTIFICAÇÕES TELEGRAM ───────────────────────────
function montarIntegracoes_(evento, resultado, user, body, jornadaAnterior) {
  const integracoes = [];
  const cidade = user.cidade_base || resultado.slot?.cidade || '';
  const operacao = (user.operacao || resultado.slot?.operacao || 'PROMO').toUpperCase();

  if (evento === 'ACEITAR_SLOT') {
    const slotNome = resultado.slot?.local_nome || resultado.slot?.local || body.slot_id || '';
    const hora = new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    
    // Notificação privada para o promotor
    if (user.telegram_user_id) {
      integracoes.push({
        canal: 'telegram', tipo: 'private_message',
        telegram_user_id: String(user.telegram_user_id),
        parse_mode: 'HTML',
        text_html: `✅ <b>Slot Aceito com Sucesso</b>\n\n📍 <b>Local:</b> ${slotNome}\n⏰ <b>Horário:</b> ${hora}\n\nO slot foi vinculado à sua jornada. Não esqueça de realizar o check-in ao chegar no local!`,
      });
    }

    // Notificação em grupo para visibilidade da operação
    integracoes.push({
      canal: 'telegram', tipo: 'group_message',
      cidade,
      topic_key: 'SLOTS_DISPONIVEIS',
      parse_mode: 'HTML',
      text_html: `🤝 <b>Slot Aceito</b>\n\n👤 <b>${user.nome_completo || user.user_id}</b>\n🔧 ${user.cargo_principal || ''} · ${operacao}\n📍 ${slotNome}\n⏰ ${hora}`,
    });
  }

  if (evento === 'CHECKIN') {
    const slotNome = resultado.slot?.local_nome || resultado.slot?.local || body.slot_id || '';
    const hora = new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    integracoes.push({
      canal: 'telegram', tipo: 'group_message',
      cidade,
      topic_key: 'CHECKIN_PRESENCA',
      parse_mode: 'HTML',
      text_html: `✅ <b>Check-in</b>\n\n👤 <b>${user.nome_completo || user.user_id}</b>\n🔧 ${user.cargo_principal || ''} · ${operacao}\n📍 ${slotNome}\n⏰ ${hora}`,
    });
  }

  if (evento === 'CHECKOUT' || evento === 'CHECKOUT_EXCEPCIONAL') {
    const slotNome = resultado.slot?.local_nome || resultado.slot?.local || body.slot_id || '';
    const hora = new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    integracoes.push({
      canal: 'telegram', tipo: 'group_message',
      cidade,
      topic_key: 'ENCERRAMENTOS',
      parse_mode: 'HTML',
      text_html: `🔴 <b>Checkout${evento === 'CHECKOUT_EXCEPCIONAL' ? ' Excepcional' : ''}</b>\n\n👤 <b>${user.nome_completo || user.user_id}</b>\n🔧 ${user.cargo_principal || ''} · ${operacao}\n📍 ${slotNome}\n⏱️ Duração: ${resultado.duracao || '—'}\n⏰ ${hora}`,
    });
  }

  return integracoes;
}

function atualizarStreak_(ss, userId, horarioServidor) {
  const wsProm = ss.getSheetByName('PROMOTORES');
  const data   = wsProm.getDataRange().getValues();
  const h      = data[0].map(v => String(v).toLowerCase().trim());
  const iId    = h.indexOf('user_id');
  const iStreak = h.indexOf('streak_dias');
  const iUltimo = h.indexOf('ultimo_checkout_em');
  if (iStreak < 0) return;

  const hoje = horarioServidor.substring(0, 10);

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iId]).trim() !== userId) continue;
    const ultimoCheckout = String(data[r][iUltimo] || '').substring(0, 10);
    const streakAtual    = parseInt(data[r][iStreak] || '0') || 0;

    const diffDias = ultimoCheckout
      ? Math.round((new Date(hoje) - new Date(ultimoCheckout)) / 86400000)
      : 0;

    let novoStreak = 1;
    if (diffDias === 1) {
      novoStreak = streakAtual + 1;
      if (novoStreak % 5 === 0) {
        registrarScore_(ss, userId, 'STREAK_BONUS', 25, `Streak de ${novoStreak} dias consecutivos! 🔥`, '');
      }
    } else if (diffDias > 1) {
      novoStreak = 1;
    }

    wsProm.getRange(r+1, iStreak+1).setValue(novoStreak);
    if (iUltimo > -1) wsProm.getRange(r+1, iUltimo+1).setValue(hoje);
    break;
  }
}

// ── Sequenciamento ───────────────────────────────────────────────────────────
function verificarSequenciamento_(ss, userId, slotRow, headers) {
  const iData    = headers.indexOf('data');
  const iInicio  = headers.indexOf('inicio');
  const iFimNovo = headers.indexOf('fim');
  const iLat     = headers.indexOf('lat');
  const iLng     = headers.indexOf('lng');
 
  const dataSlot   = String(slotRow[iData]).substring(0, 10);
  const inicioSlot = String(slotRow[iInicio]).substring(0, 5);
  const fimSlot    = String(slotRow[iFimNovo]).substring(0, 5);
  const latNovo    = parseFloat(slotRow[iLat]);
  const lngNovo    = parseFloat(slotRow[iLng]);
 
  const wsSlots = ss.getSheetByName('SLOTS');
  const data    = wsSlots.getDataRange().getValues();
  const h2      = data[0].map(v => String(v).toLowerCase().trim());
  const iUsr    = h2.indexOf('user_id');
  const iStatus = h2.indexOf('status');
  const iDt     = h2.indexOf('data');
  const iIni    = h2.indexOf('inicio');
  const iFim    = h2.indexOf('fim');
  const iLat2   = h2.indexOf('lat');
  const iLng2   = h2.indexOf('lng');
  const iSlotId = h2.indexOf('slot_id');
  const bufferMin = parseInt(getConfig_('buffer_pre_aprovado_min') || '30');
 
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (String(row[iUsr]).trim() !== userId) continue;
    if (!['ACEITO', 'EM_ATIVIDADE', 'PAUSADO'].includes(String(row[iStatus]).trim())) continue;
    if (String(row[iDt]).substring(0, 10) !== dataSlot) continue;
 
    const fimExist   = String(row[iFim]).substring(0, 5);
    const iniExist   = String(row[iIni]).substring(0, 5);
 
    if (slotsConflitam_(fimExist, inicioSlot, fimSlot, iniExist)) {
      return { conflito: true, mensagem: 'Slots sobrepostos: horários se sobrepõem' };
    }
 
    const distM          = haversineMetros_(parseFloat(row[iLat2]), parseFloat(row[iLng2]), latNovo, lngNovo);
    const tempoDeslocMin = Math.ceil(distM / 250);
 
    if (tempoDeslocMin > bufferMin) {
      return { conflito: false, tipo_transicao: 'REQUER_APROVACAO', slot_anterior_id: row[iSlotId], tempo_estimado_min: tempoDeslocMin, pre_aprovado: false };
    }
    const tipo = distM < 100 ? 'MESMO_LOCAL' : 'PRE_APROVADO_COM_DESLOCAMENTO';
    return { conflito: false, tipo_transicao: tipo, slot_anterior_id: row[iSlotId], tempo_estimado_min: tempoDeslocMin, pre_aprovado: true };
  }
  return { conflito: false, tipo_transicao: 'MESMO_LOCAL', pre_aprovado: false };
}


function calcularGapMinutos_(horaFim, horaInicio) {
  const partsF = String(horaFim).split(':').map(Number);
  const partsI = String(horaInicio).split(':').map(Number);
  const fMin = (partsF[0] || 0) * 60 + (partsF[1] || 0);
  const iMin = (partsI[0] || 0) * 60 + (partsI[1] || 0);
  let gap = iMin - fMin;
  if (gap < -720) gap += 1440;
  return gap;
}


function criarJornada_(ss,{jornada_id,user,slot,horarioServidor}) {
  const ws=ss.getSheetByName('JORNADAS'); 
  if(!ws) { console.log('ERRO: aba JORNADAS não encontrada'); return; }
  try {
    const dataSlot=slot.data?String(slot.data).substring(0,10):'';
    const inicioPrevisto=dataSlot&&slot.inicio?dataSlot+'T'+String(slot.inicio)+':00':String(slot.inicio||'');
    const fimPrevisto=dataSlot&&slot.fim?dataSlot+'T'+String(slot.fim)+':00':String(slot.fim||'');
    ws.appendRow([jornada_id,user.user_id,slot.slot_id,'',slot.cidade,slot.operacao,user.modo_jornada_padrao||'SLOT',user.tipo_vinculo,user.cargo_principal,user.cargo_principal,'ACEITO',inicioPrevisto,fimPrevisto,'','','','','','','','','','','',horarioServidor,horarioServidor]);
    console.log('criarJornada_ OK:', jornada_id);
  } catch(e) {
    console.log('criarJornada_ ERRO:', e.message);
  }
}

function getJornada_(ss,jornadaId) {
  const ws=ss.getSheetByName('JORNADAS'), data=ws.getDataRange().getValues();
  const h=data[0].map(v=>String(v).toLowerCase().trim()), iId=h.indexOf('jornada_id');
  for (let r=1;r<data.length;r++) { if (String(data[r][iId]).trim()===jornadaId) return rowToObj_(h,data[r]); }
  return null;
}

function getJornadaPorSlot_(ss,slotId,userId) {
  const ws=ss.getSheetByName('JORNADAS'), data=ws.getDataRange().getValues();
  const h=data[0].map(v=>String(v).toLowerCase().trim()), iSlt=h.indexOf('slot_id'), iUsr=h.indexOf('user_id'), iStt=h.indexOf('status');
  const IGNORAR = ['CANCELADO','ENCERRADO'];
  for (let r=1;r<data.length;r++) {
    if (String(data[r][iSlt]).trim()!==slotId||String(data[r][iUsr]).trim()!==userId) continue;
    if (iStt>-1 && IGNORAR.includes(String(data[r][iStt]).trim().toUpperCase())) continue;
    return rowToObj_(h,data[r]);
  }
  return null;
}

function atualizarJornada_(ss,jornadaId,campos) {
  const ws=ss.getSheetByName('JORNADAS'), data=ws.getDataRange().getValues();
  const h=data[0].map(v=>String(v).toLowerCase().trim()), iId=h.indexOf('jornada_id');
  for (let r=1;r<data.length;r++) {
    if (String(data[r][iId]).trim()!==jornadaId) continue;
    for (const [campo,valor] of Object.entries(campos)) { const col=h.indexOf(campo.toLowerCase()); if(col>-1) ws.getRange(r+1,col+1).setValue(valor); }
    return;
  }
}

function getSlot_(ss,slotId) {
  if (!slotId) return null;
  const ws=ss.getSheetByName('SLOTS'), data=ws.getDataRange().getValues();
  const h=data[0].map(v=>String(v).toLowerCase().trim()), iId=h.indexOf('slot_id');
  for (let r=1;r<data.length;r++) { if (String(data[r][iId]).trim()===slotId) return rowToObj_(h,data[r]); }
  return null;
}

function mapearSlot_(headers,row) { return rowToObj_(headers,row); }

function atualizarSlotStatus_(ss,slotId,status,horarioServidor) {
  if (!slotId) return;
  const ws=ss.getSheetByName('SLOTS'), data=ws.getDataRange().getValues();
  const h=data[0].map(v=>String(v).toLowerCase().trim());
  const iId=h.indexOf('slot_id'), iSt=h.indexOf('status'), iUpd=h.indexOf('atualizado_em');
  for (let r=1;r<data.length;r++) {
    if (String(data[r][iId]).trim()!==slotId) continue;
    ws.getRange(r+1,iSt+1).setValue(status);
    ws.getRange(r+1,iUpd+1).setValue(horarioServidor);
    if (typeof invalidarCache_ === 'function') invalidarCache_();
    return;
  }
}

function getSlotsDisponiveis_(params, user) {
  const ss    = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws    = ss.getSheetByName('SLOTS');
  const data  = ws.getDataRange().getValues();
  const h     = data[0].map(v => String(v).toLowerCase().trim());
  const iSt   = h.indexOf('status');
  const iCid  = h.indexOf('cidade');
  const iDt   = h.indexOf('data');
  const iFim  = h.indexOf('fim');

  const cidadeUser = (user && user.cidade_base) ? String(user.cidade_base).trim() : '';

  const agora     = new Date();
  const hojeStr   = agora.toISOString().split('T')[0];
  const amanha    = new Date(agora); amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = amanha.toISOString().split('T')[0];
  const agoraMin  = agora.getHours() * 60 + agora.getMinutes();

  const slots = [];
  for (let r = 1; r < data.length; r++) {
    if (data[r][iSt] !== 'DISPONIVEL') continue;

    if (cidadeUser) {
      const cidadeSlot = String(data[r][iCid] || '').trim();
      if (cidadeSlot && cidadeSlot !== cidadeUser) continue;
    }

    const dataSlot = String(data[r][iDt] || '').substring(0, 10);
    if (dataSlot && dataSlot !== hojeStr && dataSlot !== amanhaStr) continue;

    if (dataSlot === hojeStr && iFim > -1) {
      const fimStr = String(data[r][iFim] || '').substring(0, 5);
      if (fimStr) {
        const parts  = fimStr.split(':');
        const fimMin = parseInt(parts[0] || 0) * 60 + parseInt(parts[1] || 0);
        if (fimMin < agoraMin) continue;
      }
    }

    slots.push(rowToObj_(h, data[r]));
  }

  slots.sort((a, b) => {
    const dA = String(a.data || '').substring(0, 10);
    const dB = String(b.data || '').substring(0, 10);
    if (dA !== dB) return dA < dB ? -1 : 1;
    return String(a.inicio || '') < String(b.inicio || '') ? -1 : 1;
  });

  return { ok: true, slots };
}


function getSlotAtual_(user, slotIdSolicitado) {
  const ss   = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws   = ss.getSheetByName('JORNADAS');
  if (!ws) return { ok:true, jornada:null, slot:null, jornadas:[] };
  const data = ws.getDataRange().getValues();
  const h    = data[0].map(v => String(v).toLowerCase().trim());
  const iUsr = h.indexOf('user_id'), iStt = h.indexOf('status');
 
  const results = [];
  const statusValidos = ['ACEITO', 'EM_ATIVIDADE', 'PAUSADO', 'AGUARDANDO_RASTREIO', 'EM_TURNO', 'SEM_SINAL', 'MAPEAMENTO_INTERROMPIDO'];
  
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iUsr]).trim() !== user.user_id) continue;
    const status = String(data[r][iStt]).trim().toUpperCase();
    if (statusValidos.includes(status)) {
      const jornada = rowToObj_(h, data[r]);
      const slot    = getSlot_(ss, jornada.slot_id);
      results.push({ jornada, slot });
    }
  }

  if (results.length > 0) {
    let selecionado = results[0];
    if (slotIdSolicitado) {
      const found = results.find(r => r.slot?.slot_id === slotIdSolicitado);
      if (found) selecionado = found;
    }

    results.sort((a,b) => {
      const order = { 'EM_ATIVIDADE': 1, 'PAUSADO': 2, 'EM_TURNO': 3, 'ACEITO': 4 };
      const valA = order[a.jornada.status.toUpperCase()] || 99;
      const valB = order[b.jornada.status.toUpperCase()] || 99;
      if (valA !== valB) return valA - valB;
      return new Date(a.jornada.inicio_previsto) - new Date(b.jornada.inicio_previsto);
    });

    return { ok: true, jornada: selecionado.jornada, slot: selecionado.slot, jornadas: results };
  }

  return { ok: true, jornada: null, slot: null, jornadas: [] };
}


function internalListarSlotsDisponiveis_(params) {
  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws=ss.getSheetByName('SLOTS'), data=ws.getDataRange().getValues();
  const h=data[0].map(v=>String(v).toLowerCase().trim()), iSt=h.indexOf('status'), iCid=h.indexOf('cidade');
  const cidade=params.cidade||'', limit=parseInt(params.limit||'50'), slots=[];
  for (let r=1;r<data.length;r++) {
    if(data[r][iSt]!=='DISPONIVEL') continue;
    if(cidade&&data[r][iCid]!==cidade) continue;
    slots.push(rowToObj_(h,data[r]));
    if(slots.length>=limit) break;
  }
  return{ok:true,slots};
}

function internalGetSlot_(params) {
  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const slot=getSlot_(ss,params.slot_id||'');
  if (!slot) return{ok:false,erro:'slot não encontrado'};
  return{ok:true,slot};
}

function aceitarSlotTelegram_(body) {
  const{promotor_id,slot_id}=body;
  if (!promotor_id||!slot_id) return{ok:false,erro:'promotor_id e slot_id obrigatórios'};
  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws=ss.getSheetByName('PROMOTORES'), data=ws.getDataRange().getValues();
  const h=data[0].map(v=>String(v).toLowerCase().trim()), iId=h.indexOf('user_id');
  for (let r=1;r<data.length;r++) {
    if (String(data[r][iId]).trim()!==promotor_id) continue;
    const user=rowToUser_(h,data[r]);
    return aceitarSlot_(ss,user,{slot_id},new Date().toISOString());
  }
  return{ok:false,erro:'promotor_id não encontrado'};
}

function haversineMetros_(lat1,lng1,lat2,lng2) {
  const R=6371000, d1=lat1*Math.PI/180, d2=lat2*Math.PI/180;
  const dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(d1)*Math.cos(d2)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function calcularLocationTrustScore_({lat,lng,isMock,accuracy}) {
  let score=100;
  if(isMock) score-=80;
  if(accuracy>500) score-=40; else if(accuracy>200) score-=20; else if(accuracy>100) score-=10;
  if(!lat||!lng) score-=50;
  return Math.max(0,Math.min(100,score));
}

function consolidarPromocode_(ss,slotId,userId) {
  if (!slotId) return;
  const ws=ss.getSheetByName('PROMOCODES_DESLOCAMENTO'); if(!ws) return;
  const data=ws.getDataRange().getValues(), h=data[0].map(v=>String(v).toLowerCase().trim());
  const iSlt=h.indexOf('slot_id'), iUsr=h.indexOf('user_id'), iStt=h.indexOf('status'), iCon=h.indexOf('consolidado_em');
  const agora=new Date().toISOString();
  for (let r=1;r<data.length;r++) {
    if(String(data[r][iSlt]).trim()!==slotId) continue;
    if(String(data[r][iUsr]).trim()!==userId) continue;
    if(data[r][iStt]!=='EMITIDO') continue;
    ws.getRange(r+1,iStt+1).setValue('CONSOLIDADO');
    ws.getRange(r+1,iCon+1).setValue(agora);
  }
}

function triggerFimTurno() {
  const ss    = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws    = ss.getSheetByName('SLOTS');
  if (!ws) return;
  const data  = ws.getDataRange().getValues();
  const h     = data[0].map(v => String(v).toLowerCase().trim());
  const iId   = h.indexOf('slot_id'), iUsr = h.indexOf('user_id'), iStt = h.indexOf('status'), iData = h.indexOf('data'), iFim = h.indexOf('fim'), iNome = h.indexOf('local_nome');
  const agora = new Date();

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iStt]).trim() !== 'EM_ATIVIDADE') continue;
    const userId = String(data[r][iUsr]).trim(); if (!userId) continue;
    const dataSlot = String(data[r][iData]).substring(0,10), fimStr = String(data[r][iFim]).substring(0,5);
    if (!dataSlot || !fimStr) continue;
    const fimDt  = new Date(dataSlot + 'T' + fimStr + ':00');
    const diffMin = (agora - fimDt) / 60000;
    if (diffMin < -2 || diffMin > 3) continue;

    const slotId = String(data[r][iId]).trim(), localNome = String(data[r][iNome]).trim(), tgId = getTelegramUserId_(ss, userId);
    if (!tgId) continue;

    UrlFetchApp.fetch(getConfig_('cloud_run_url') + '/internal/send-fim-turno', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ integration_secret: getConfig_('integration_secret'), telegram_user_id: tgId, slot_id: slotId, user_id: userId, local_nome: localNome, fim: fimStr }),
      muteHttpExceptions: true
    });
  }
}

function triggerAutoEncerramento() {
  const ss    = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws    = ss.getSheetByName('SLOTS');
  if (!ws) return;
  const data  = ws.getDataRange().getValues();
  const h     = data[0].map(v => String(v).toLowerCase().trim());
  const iId   = h.indexOf('slot_id'), iUsr = h.indexOf('user_id'), iStt = h.indexOf('status'), iData = h.indexOf('data'), iFim = h.indexOf('fim');
  const agora = new Date();

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iStt]).trim() !== 'EM_ATIVIDADE') continue;
    const userId = String(data[r][iUsr]).trim(), dataSlot = String(data[r][iData]).substring(0,10), fimStr = String(data[r][iFim]).substring(0,5);
    if (!dataSlot || !fimStr) continue;
    const fimDt  = new Date(dataSlot + 'T' + fimStr + ':00');
    const diffMin = (agora - fimDt) / 60000;
    if (diffMin < 29 || diffMin > 35) continue;

    const slotId  = String(data[r][iId]).trim(), jornada = getJornadaPorSlot_(ss, slotId, userId);
    if (!jornada) continue;

    const horario = agora.toISOString();
    atualizarJornada_(ss, jornada.jornada_id, { status: 'ENCERRADO', fim_real: horario, atualizado_em: horario, observacao: 'Auto-encerrado por ausência de checkout' });
    atualizarSlotStatus_(ss, slotId, 'ENCERRADO', horario);

    const tgId = getTelegramUserId_(ss, userId);
    if (tgId) {
      UrlFetchApp.fetch(getConfig_('cloud_run_url') + '/internal/send-checkin-reminder', {
        method: 'post', contentType: 'application/json',
        payload: JSON.stringify({ integration_secret: getConfig_('integration_secret'), telegram_user_id: tgId, slot_id: slotId, local_nome: '', inicio: fimStr, tipo: 'AUTO_ENCERRADO' }),
        muteHttpExceptions: true
      });
    }
  }
}

function slotsConflitam_(fimExistente, inicioNovo, fimNovo, inicioExistente) {
  const gap1 = calcularGapMinutos_(fimExistente, inicioNovo);
  const gap2 = calcularGapMinutos_(fimNovo, inicioExistente);
  return gap1 < -1 && gap2 < -1;
}

function processarFSMInterno_(body, evento) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const userId = body.user_id; if (!userId) return { ok: false, erro: 'user_id obrigatório' };
  const ws   = ss.getSheetByName('PROMOTORES'), data = ws.getDataRange().getValues();
  const h    = data[0].map(v => String(v).toLowerCase().trim()), iId = h.indexOf('user_id');
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iId]).trim() !== userId) continue;
    const user = rowToUser_(h, data[r]);
    return processarFSM_(user, body, evento);
  }
  return { ok: false, erro: 'usuário não encontrado' };
}