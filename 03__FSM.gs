// ============================================================
//  03.FSM.gs  — Motor FSM + Jornadas + Sequenciamento de Slots
//  Versão: 3.2  |  Fase 3 — Consolidação Multi-slots + Cache + Preferência
// ============================================================

function triggerAlertaNoShow() {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws = ss.getSheetByName('SLOTS');
  if (!ws) return;
  const data = ws.getDataRange().getValues();
  const h = data[0].map(v => String(v).toLowerCase().trim());
  
  const iId = h.indexOf('slot_id'), iSt = h.indexOf('status'), iDt = h.indexOf('data');
  const iIni = h.indexOf('inicio'), iUsr = h.indexOf('user_id'), iNome = h.indexOf('local_nome');
  const iCid = h.indexOf('cidade'), iAlerta = h.indexOf('tg_alerta_noshow');
  
  if (iAlerta < 0) {
    console.log('Aba SLOTS precisa da coluna técnica "tg_alerta_noshow"');
    return;
  }

  const agora = new Date();
  const hojeStr = agora.toISOString().split('T')[0];
  const promotoresMap = _getPromotoresMap_(ss);

  for (let r = 1; r < data.length; r++) {
    const status = String(data[r][iSt]).trim();
    if (status !== 'ACEITO') continue; 

    const dataSlot = String(data[r][iDt]).substring(0, 10);
    if (dataSlot !== hojeStr) continue;

    const inicioStr = String(data[r][iIni]).substring(0, 5);
    if (!inicioStr) continue;

    const slotDt = new Date(dataSlot + 'T' + inicioStr + ':00');
    const diffMin = (agora - slotDt) / 60000;

    if (diffMin >= 15 && !data[r][iAlerta]) {
      const userId = String(data[r][iUsr]).trim();
      const prom = promotoresMap[userId] || {};
      const local = data[r][iNome] || data[r][iId];
      const cidade = data[r][iCid] || '';

      const integracoes = [{
        canal: 'telegram', tipo: 'group_message',
        cidade: cidade,
        topic_key: 'ALERTAS',
        parse_mode: 'HTML',
        text_html: `🚨 <b>ALERTA DE NO-SHOW</b>\n\nO promotor ainda não fez check-in!\n\n👤 <b>${prom.nome || userId}</b>\n📍 ${local}\n⏰ Início era: ${inicioStr}\n⏱️ Atraso: ${Math.round(diffMin)} min`,
      }];

      processIntegracoes(integracoes, { evento: 'ALERTA_NOSHOW' });

      // Notificação Push Direta para o Promotor
      enviarPush_(
        userId, 
        '⏰ Alerta de Atraso!', 
        `Você ainda não iniciou seu slot em ${local}. Faça o check-in agora!`,
        'https://hikoalbuquerque-prog.github.io/jet-promobot'
      );

      ws.getRange(r + 1, iAlerta + 1).setValue('ENVIADO_' + agora.toISOString());
    }
  }
}

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

  // ── Verificação de Bloqueios ────────────────────────────────
  const bloqueio = verificarBloqueiosPromotores_(ss, user.user_id);
  if (bloqueio.bloqueado) return { ok: false, erro: bloqueio.motivo };

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); 

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

  } catch (e) {
    return { ok: false, erro: 'Erro de concorrência: tente novamente em instantes.' };
  } finally {
    lock.releaseLock();
  }
}


function executarCheckin_(ss, jornada, user, body, horarioServidor) {
  const lat = parseFloat(body.lat || 0);
  const lng = parseFloat(body.lng || 0);
  const forcar = body.forcar === true || body.ignore_radius === true;

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const slot  = getSlot_(ss, jornada.slot_id);
    const raio  = parseFloat(slot ? slot.raio_metros : getConfig_('raio_checkin_metros') || 200);
    const distM = haversineMetros_(lat, lng, parseFloat(slot.lat), parseFloat(slot.lng));
    
    if (distM > raio && !forcar) {
      return { ok: false, erro: `Fora do raio: ${Math.round(distM)}m (máx ${raio}m)`, fora_do_raio: true, distancia: Math.round(distM) };
    }

    const dataSlot  = String(slot?.data || '').substring(0, 10);
    const inicioStr = String(slot?.inicio || '').substring(0, 5);
    if (dataSlot && inicioStr) {
      const agora    = new Date(horarioServidor);
      const slotDt   = new Date(dataSlot + 'T' + inicioStr + ':00');
      const diffMin  = (slotDt - agora) / 60000;
      if (diffMin > 60) return { ok: false, erro: `Check-in disponível apenas 1h antes do início. Faltam ${Math.round(diffMin)} minutos.` };
      if (diffMin < -120) return { ok: false, erro: 'Este slot já encerrou.' };
    }

    const score = calcularLocationTrustScore_({ lat, lng, isMock: body.is_mock === true, accuracy: body.accuracy || 999 });
    
    // BLOQUEIO GPS FALSO
    if (body.is_mock === true || score < 20) {
      return { ok: false, erro: '⛔ GPS FALSO DETECTADO. O uso de simuladores de localização é proibido e pode gerar suspensão.' };
    }

    atualizarJornada_(ss, jornada.jornada_id, {
      status: 'EM_ATIVIDADE', inicio_real: horarioServidor,
      checkin_lat: lat, checkin_lng: lng, location_trust_score: score,
      horario_servidor_checkin: horarioServidor, evidencia_checkin: body.foto_url || '', atualizado_em: horarioServidor,
      checkin_fora_raio: distM > raio
    });

    consolidarPromocode_(ss, jornada.slot_id, user.user_id);

    const slotDt    = slot?.data && slot?.inicio ? new Date(String(slot.data).substring(0,10) + 'T' + String(slot.inicio).substring(0,5) + ':00') : null;
    const atrasoMin = slotDt ? Math.floor((new Date(horarioServidor) - slotDt) / 60000) : 999;
    const pontual   = atrasoMin <= 5;

    try {
      registrarScore_(ss, user.user_id, pontual ? 'CHECKIN_PONTUAL' : 'CHECKIN_ATRASADO', pontual ? 10 : 5, pontual ? 'Check-in pontual' : `Check-in com ${atrasoMin}min de atraso`, jornada.jornada_id);
    } catch(_) {}

    try {
      verificarBadges_(ss, user.user_id, {
        evento: 'CHECKIN',
        pontual,
        streak: getScore_(user.user_id).streak
      });
    } catch(_) {}

    return { ok: true, jornada_id: jornada.jornada_id, slot, distancia_metros: Math.round(distM), location_trust_score: score };

  } catch (e) {
    return { ok: false, erro: 'Sistema ocupado, tente novamente.' };
  } finally {
    lock.releaseLock();
  }
}

function executarCheckout_(ss, jornada, user, body, horarioServidor, excepcional) {
  const lat = parseFloat(body.lat || 0);
  const lng = parseFloat(body.lng || 0);

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

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

  } catch (e) {
    return { ok: false, erro: 'Erro ao encerrar jornada, tente novamente.' };
  } finally {
    lock.releaseLock();
  }
}

function cancelarSlot_(user, body) {
  const ss     = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const jornId = body.jornada_id || '';
  const slotId = body.slot_id    || '';
  const agora  = new Date().toISOString();

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

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

    const hojeStr = new Date().toISOString().split('T')[0];
    const dataSlot = String(slot?.data || '').substring(0, 10);
    if (dataSlot === hojeStr) {
      broadcastVagaUrgente_(ss, slot);
    }

    return { ok: true, integracoes };

  } catch (e) {
    return { ok: false, erro: 'Erro ao cancelar slot, tente novamente.' };
  } finally {
    lock.releaseLock();
  }
}

function broadcastVagaUrgente_(ss, slot) {
  const cidade = slot.cidade || '';
  const local = slot.local_nome || slot.local || slot.slot_id;
  const horario = (slot.inicio || '') + ' - ' + (slot.fim || '');
  
  const text_html = `🔥 <b>VAGA URGENTE DISPONÍVEL!</b>\n\nUm slot acaba de ficar vago para HOJE em sua cidade.\n\n📍 <b>Local:</b> ${local}\n⏰ <b>Horário:</b> ${horario}\n🏙️ <b>Cidade:</b> ${cidade}\n\nCorra para o app para aceitar! 🏃💨`;
  
  const integracoes = [{
    canal: 'telegram', tipo: 'group_message',
    cidade: cidade,
    topic_key: 'COBERTURAS_URGENCIAS',
    parse_mode: 'HTML',
    text_html: text_html,
    reply_markup: {
      inline_keyboard: [[{ text: '📍 Ver Slots no App', url: 'https://hikoalbuquerque-prog.github.io/jet-promobot' }]]
    }
  }];

  processIntegracoes(integracoes, { evento: 'BROADCAST_URGENTE' });

  const promotoresMap = _getPromotoresMap_(ss);
  const integracoesPrivadas = [];
  for (const uid in promotoresMap) {
    const p = promotoresMap[uid];
    if (p.cidade === cidade && p.telegram_user_id && p.tipo_vinculo === 'MEI') {
      integracoesPrivadas.push({
        canal: 'telegram', tipo: 'private_message',
        telegram_user_id: String(p.telegram_user_id),
        parse_mode: 'HTML',
        text_html: text_html,
        reply_markup: {
          inline_keyboard: [[{ text: '✅ Aceitar Vaga Agora', url: 'https://hikoalbuquerque-prog.github.io/jet-promobot' }]]
        }
      });
    }
  }
  
  if (integracoesPrivadas.length > 0) {
    processIntegracoes(integracoesPrivadas, { evento: 'BROADCAST_URGENTE_PRIVADO' });
  }
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

function montarIntegracoes_(evento, resultado, user, body, jornadaAnterior) {
  const integracoes = [];
  const cidade = user.cidade_base || resultado.slot?.cidade || '';
  const operacao = (user.operacao || resultado.slot?.operacao || 'PROMO').toUpperCase();

  if (evento === 'ACEITAR_SLOT') {
    const slotNome = resultado.slot?.local_nome || resultado.slot?.local || body.slot_id || '';
    const hora = new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    
    if (user.telegram_user_id) {
      integracoes.push({
        canal: 'telegram', tipo: 'private_message',
        telegram_user_id: String(user.telegram_user_id),
        parse_mode: 'HTML',
        text_html: `✅ <b>Slot Aceito com Sucesso</b>\n\n📍 <b>Local:</b> ${slotNome}\n⏰ <b>Horário:</b> ${hora}\n\nO slot foi vinculado à sua jornada. Não esqueça de realizar o check-in ao chegar no local!`,
      });
    }

    integracoes.push({
      canal: 'telegram', tipo: 'group_message',
      cidade,
      topic_key: 'SLOTS_OCUPADOS',
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
  
  // ── Verificação de Bloqueio Preventiva ──────────────────────
  if (user?.user_id) {
    const bloqueio = verificarBloqueiosPromotores_(ss, user.user_id);
    if (bloqueio.bloqueado) {
      return { ok: false, erro: bloqueio.motivo, bloqueado: true };
    }
  }

  const ws    = ss.getSheetByName('SLOTS');
  const data  = ws.getDataRange().getValues();
  const h     = data[0].map(v => String(v).toLowerCase().trim());
  const iSt   = h.indexOf('status'), iCid = h.indexOf('cidade'), iDt = h.indexOf('data'), iFim = h.indexOf('fim');
  const iSugerido = h.indexOf('promotor_sugerido_id'), iPrefAte = h.indexOf('preferencia_ate');

  const cidadeUser = (user && user.cidade_base) ? String(user.cidade_base).trim() : '';
  const userId = user?.user_id || '';

  const agora     = new Date();
  const agoraMs   = agora.getTime();
  const hojeStr   = agora.toISOString().split('T')[0];
  const amanha    = new Date(agora); amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = amanha.toISOString().split('T')[0];
  const agoraMin  = agora.getHours() * 60 + agora.getMinutes();

  const slots = [];
  for (let r = 1; r < data.length; r++) {
    if (data[r][iSt] !== 'DISPONIVEL') continue;

    const obj = rowToObj_(h, data[r]);

    // ── Lógica de Preferência Dinâmica (13h-14h do dia anterior) ────────────────
    if (iSugerido > -1) {
      const sugeridoId = String(data[r][iSugerido]).trim();
      if (sugeridoId) {
        const dataSlotStr = String(data[r][iDt]).substring(0, 10);
        const dataSlot = new Date(dataSlotStr + 'T00:00:00');
        
        // Janela: 13h às 14h do dia ANTERIOR ao slot
        const inicioPref = new Date(dataSlot.getTime() - 24 * 60 * 60 * 1000);
        inicioPref.setHours(13, 0, 0, 0);
        const fimPref = new Date(dataSlot.getTime() - 24 * 60 * 60 * 1000);
        fimPref.setHours(14, 0, 0, 0);

        // Se estamos na janela de 13h-14h do dia anterior
        if (agoraMs >= inicioPref.getTime() && agoraMs < fimPref.getTime()) {
          if (sugeridoId !== userId) continue; // Esconde dos outros
          obj.is_sugerido = true;
          obj.preferencia_expira = fimPref.toISOString();
        }
        
        // Fallback: se preencheu preferencia_ate manualmente (ou se já passou das 14h mas quer manter reserva)
        if (iPrefAte > -1 && data[r][iPrefAte]) {
          const prefManual = new Date(data[r][iPrefAte]).getTime();
          if (agoraMs < prefManual) {
            if (sugeridoId !== userId) continue;
            obj.is_sugerido = true;
            obj.preferencia_expira = data[r][iPrefAte];
          }
        }
      }
    }

    // Filtra por cidade do promotor (Insensível a acento e caso)
    if (cidadeUser) {
      const cidadeSlot = String(data[r][iCid] || '').trim();
      if (cidadeSlot && normStr_(cidadeSlot) !== normStr_(cidadeUser)) continue;
    }

    // Permite MEI e FISCAL verem slots
    const vinc = (user?.tipo_vinculo || '').toUpperCase();
    if (vinc !== 'MEI' && vinc !== 'FISCAL') continue;

    // Normalização de Data para comparação segura
    let dataSlotRaw = data[r][iDt];
    if (dataSlotRaw instanceof Date) {
      dataSlotRaw = dataSlotRaw.toISOString().split('T')[0];
    }
    const dataSlot = String(dataSlotRaw || '').substring(0, 10);
    
    if (dataSlot && dataSlot !== hojeStr && dataSlot !== amanhaStr) continue;

    if (dataSlot === hojeStr && iFim > -1) {
      const fimStr = String(data[r][iFim] || '').substring(0, 5);
      if (fimStr) {
        const parts  = fimStr.split(':');
        const fimMin = parseInt(parts[0] || 0) * 60 + parseInt(parts[1] || 0);
        if (fimMin < agoraMin) continue;
      }
    }

    slots.push(obj);
  }

  slots.sort((a, b) => {
    if (a.is_sugerido && !b.is_sugerido) return -1;
    if (!a.is_sugerido && b.is_sugerido) return 1;
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

/**
 * Cria um slot de reforço na hora para um promotor que chegou no local sem vaga prévia.
 */
function criarSlotReforco_(user, body) {
  const { local_referencia } = body; // Nome ou ID do local aproximado
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws = ss.getSheetByName('SLOTS');
  if (!ws) return { ok: false, erro: 'Aba SLOTS não encontrada' };

  // Busca um slot modelo para copiar as coordenadas e dados do local
  const data = ws.getDataRange().getValues();
  const h = data[0].map(v => String(v).toLowerCase().trim());
  let modelo = null;
  for (let r = 1; r < data.length; r++) {
    if (data[r][h.indexOf('local_nome')] === local_referencia || data[r][h.indexOf('slot_id')] === local_referencia) {
      modelo = rowToObj_(h, data[r]);
      break;
    }
  }

  if (!modelo) return { ok: false, erro: 'Local de referência não encontrado.' };

  const slotId = 'SLT_REF_' + new Date().getTime();
  const agora = new Date();
  const hojeStr = agora.toISOString().split('T')[0];
  const horaAtual = agora.getHours().toString().padStart(2,'0') + ':' + agora.getMinutes().toString().padStart(2,'0');

  // Cria o novo slot já com status ACEITO para o usuário
  const newRow = new Array(h.length).fill('');
  newRow[h.indexOf('slot_id')] = slotId;
  newRow[h.indexOf('cidade')] = modelo.cidade;
  newRow[h.indexOf('local_nome')] = modelo.local_nome + ' (REFORÇO)';
  newRow[h.indexOf('lat')] = modelo.lat;
  newRow[h.indexOf('lng')] = modelo.lng;
  newRow[h.indexOf('raio_metros')] = modelo.raio_metros;
  newRow[h.indexOf('status')] = 'ACEITO';
  newRow[h.indexOf('user_id')] = user.user_id;
  newRow[h.indexOf('data')] = hojeStr;
  newRow[h.indexOf('inicio')] = horaAtual;
  newRow[h.indexOf('fim')] = modelo.fim; // Assume o mesmo fim do modelo
  newRow[h.indexOf('operacao')] = modelo.operacao;
  newRow[h.indexOf('criado_em')] = agora.toISOString();
  newRow[h.indexOf('atualizado_em')] = agora.toISOString();

  ws.appendRow(newRow);
  
  // Cria a jornada
  const jornId = gerarId_('JRN');
  const slotMapeado = rowToObj_(h, newRow);
  criarJornada_(ss, { jornada_id: jornId, user, slot: slotMapeado, horarioServidor: agora.toISOString() });

  // Notifica Gestão
  const integracoes = [{
    canal: 'telegram', tipo: 'group_message',
    cidade: modelo.cidade,
    topic_key: 'COBERTURAS_URGENCIAS',
    parse_mode: 'HTML',
    text_html: `✨ <b>Reforço Detectado</b>\n\n👤 <b>${user.nome_completo || user.user_id}</b>\n📍 ${modelo.local_nome}\n⏰ Iniciou reforço às ${horaAtual}\n\nO sistema criou um slot extraordinário para esta jornada.`,
  }];

  if (typeof sincronizarCacheSlots_ === 'function') sincronizarCacheSlots_();

  return { ok: true, jornada_id: jornId, slot_id: slotId, integracoes };
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

/**
 * Envia os slots disponíveis para o Cloud Run para acelerar o carregamento do app.
 */
function sincronizarCacheSlots_() {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const res = getSlotsDisponiveis_({}, null); 
  if (!res.ok) return;

  const url = getConfig_('cloud_run_url') + '/internal/sync-slots';
  const payload = {
    integration_secret: getConfig_('integration_secret'),
    slots: res.slots
  };

  try {
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    console.log('Sincronização de cache enviada ao Cloud Run.');
  } catch (e) {
    console.log('Erro ao sincronizar cache:', e.message);
  }
}

/**
 * Gatilho automático ao editar a planilha.
 */
function onEditSync(e) {
  const sheetName = e.range.getSheet().getName();
  if (sheetName === 'SLOTS') {
    const scriptCache = CacheService.getScriptCache();
    if (scriptCache.get('sync_lock')) return;
    scriptCache.put('sync_lock', '1', 30); 
    sincronizarCacheSlots_();
  }
}

/**
 * Verifica se um promotor possui bloqueios ativos (manuais ou automáticos)
 */
function verificarBloqueiosPromotores_(ss, userId) {
  // 1. Verificar Bloqueio Manual na aba PROMOTORES
  const wsP = ss.getSheetByName('PROMOTORES');
  if (wsP) {
    const dataP = wsP.getDataRange().getValues();
    const hP = dataP[0].map(v => String(v).toLowerCase().trim());
    const iId = hP.indexOf('user_id'), iSt = hP.indexOf('status');
    
    if (iId > -1 && iSt > -1) {
      for (let r = 1; r < dataP.length; r++) {
        if (String(dataP[r][iId]).trim() === userId) {
          const status = String(dataP[r][iSt]).trim().toUpperCase();
          if (status === 'BLOQUEADO' || status === 'SUSPENSO') {
            return { bloqueado: true, motivo: '⚠️ Seu cadastro está ' + status + '. Entre em contato com o suporte.' };
          }
          break;
        }
      }
    }
  }

  // 2. Verificar excesso de cancelamentos nos últimos 7 dias
  const wsJ = ss.getSheetByName('JORNADAS');
  if (wsJ) {
    const dataJ = wsJ.getDataRange().getValues();
    const hJ = dataJ[0].map(v => String(v).toLowerCase().trim());
    const iUsr = hJ.indexOf('user_id'), iStt = hJ.indexOf('status'), iUpd = hJ.indexOf('atualizado_em');
    
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    let cancelamentos = 0;

    for (let r = dataJ.length - 1; r >= 1; r--) {
      if (String(dataJ[r][iUsr]).trim() !== userId) continue;
      
      const dataAtt = new Date(dataJ[r][iUpd]);
      if (dataAtt < seteDiasAtras) break; 

      if (String(dataJ[r][iStt]).trim().toUpperCase() === 'CANCELADO') {
        cancelamentos++;
      }
    }

    // Pega limite das configurações ou padrão 3
    const limite = 3; 
    if (cancelamentos >= limite) {
      return { bloqueado: true, motivo: '⚠️ Você atingiu o limite de ' + limite + ' cancelamentos nos últimos 7 dias e está temporariamente suspenso.' };
    }
  }

  return { bloqueado: false, motivo: '' };
}