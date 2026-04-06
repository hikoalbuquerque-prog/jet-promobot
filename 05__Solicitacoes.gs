// ============================================================
//  05.Solicitacoes.gs  — Solicitações, vendas, movimentações
//  Versão: 3.1  |  Fase 3 — Integrado com Multi-slots
// ============================================================

function abrirSolicitacao_(user, body, tipo) {
  const ss    = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws    = ss.getSheetByName('SOLICITACOES_OPERACIONAIS');
  const agora = new Date().toISOString();
  const solId = gerarId_('SOL');

  ws.appendRow([
    solId, tipo, user.user_id,
    body.slot_id   || '', body.jornada_id || '',
    user.cidade_base || '', 'ABERTA',
    body.descricao  || '', '', agora, agora, agora
  ]);

  registrarEventoLog_({
    user_id: user.user_id, jornada_id: body.jornada_id || '',
    evento: 'SOLICITACAO_ABERTA_' + tipo, origem: 'app',
    tipo_evento: 'OPERACIONAL',
    criticidade: tipo === 'OCORRENCIA' ? 'critico' : 'atencao',
    payload: body, horario_servidor: agora
  });

  const tipoLabel = {
    REFORCO_PATINETES:'🛴 Reforço de Patinetes', TROCA_BATERIA:'🔋 Troca de Bateria',
    REALOCACAO:'📍 Realocação', OCORRENCIA:'⚠️ Ocorrência',
  }[tipo] || tipo;

  const operacao = (user.operacao || 'PROMO').toUpperCase();
  const cidade   = user.cidade_base || '';
  const hora     = new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });

  // ALERTA PRIORITÁRIO PARA LIDERANÇA (Patinete Faltando ou Bateria)
  const isCritico = ['REFORCO_PATINETES', 'TROCA_BATERIA'].includes(tipo);
  
  const integracoes = [{
    canal: 'telegram', tipo: 'group_message',
    cidade,
    topic_key: 'SUPORTE_DUVIDAS',
    parse_mode: 'HTML',
    text_html: `🔔 <b>Nova Solicitação</b>\n\n${tipoLabel}\n👤 <b>${user.nome_completo || user.user_id}</b>\n🔧 ${user.cargo_principal || ''} · ${operacao}\n💬 ${body.descricao || '—'}\n⏰ ${hora}`,
  }];

  if (isCritico) {
    const lideres = _getLideresDoUsuario_(ss, user.user_id);
    const msgLider = `🚨 <b>ALERTA OPERACIONAL CRÍTICO</b>\n\n${tipoLabel}\n📍 Slot: <b>${body.slot_id || 'N/A'}</b>\n👤 Promotor: ${user.nome_completo}\n⚠️ Status: Necessita atenção imediata.`;
    
    lideres.forEach(lid => {
      if (lid.telegram_user_id) {
        integracoes.push({
          canal: 'telegram', tipo: 'private_message',
          telegram_user_id: String(lid.telegram_user_id),
          parse_mode: 'HTML', text_html: msgLider
        });
      }
    });

    // IA: RESPOSTA INSTANTÂNEA PARA O PROMOTOR
    const feedbackIA = callGeminiAI_(
      `O promotor relatou o seguinte problema: "${body.descricao || 'Faltam patinetes ou bateria baixa'}". 
       Tipo: ${tipoLabel}. Local: ${body.slot_id}. 
       Dê uma resposta curta (máx 3 frases) e empática em português, sugerindo uma ação básica enquanto o líder não chega.`,
      "Você é o assistente técnico do JET Promobot. Seja prestativo e direto."
    );

    if (feedbackIA) {
      integracoes.push({
        canal: 'telegram', tipo: 'private_message',
        telegram_user_id: String(user.telegram_user_id || getTelegramUserId_(ss, user.user_id)),
        parse_mode: 'HTML',
        text_html: `🤖 <b>Assistente JET:</b>\n\n${feedbackIA}`
      });
    }
  }

  return { ok: true, solicitacao_id: solId, integracoes };
}

function marcarSolicitacaoAtendida_(user, body) {
  const solId = body.solicitacao_id;
  if (!solId) return { ok: false, erro: 'solicitacao_id obrigatório' };
  return _atualizarSolicitacao_(solId, 'ATENDIDA', user.user_id);
}

function cancelarSolicitacao_(user, body) {
  const solId = body.solicitacao_id;
  if (!solId) return { ok: false, erro: 'solicitacao_id obrigatório' };
  return _atualizarSolicitacao_(solId, 'CANCELADA', user.user_id);
}

function _atualizarSolicitacao_(solId, novoStatus, aprovadoPor) {
  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws=ss.getSheetByName('SOLICITACOES_OPERACIONAIS');
  const data=ws.getDataRange().getValues(), h=data[0].map(v=>String(v).toLowerCase().trim());
  const iId=h.indexOf('solicitacao_id'), iSt=h.indexOf('status'), iAp=h.indexOf('aprovado_por'), iUpd=h.indexOf('atualizado_em');
  for (let r=1;r<data.length;r++) {
    if (String(data[r][iId]).trim()!==solId) continue;
    ws.getRange(r+1, iSt+1).setValue(novoStatus);
    ws.getRange(r+1, iAp+1).setValue(aprovadoPor);
    ws.getRange(r+1, iUpd+1).setValue(new Date().toISOString());
    return{ok:true,solicitacao_id:solId,status:novoStatus};
  }
  return{ok:false,erro:'solicitacao não encontrada'};
}

function getMinhasSolicitacoes_(user) {
  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws=ss.getSheetByName('SOLICITACOES_OPERACIONAIS');
  if (!ws) return { ok: true, solicitacoes: [] };
  const data=ws.getDataRange().getValues(), h=data[0].map(v=>String(v).toLowerCase().trim());
  const iUsr=h.indexOf('user_id'), lista=[];
  for (let r=1;r<data.length;r++) { if(String(data[r][iUsr]).trim()===user.user_id) lista.push(rowToObj_(h,data[r])); }
  return{ok:true,solicitacoes:lista};
}

function registrarResultadoVendas_(user, body) {
  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws=ss.getSheetByName('RESULTADOS_VENDAS');
  if (!ws) return { ok: false, erro: 'Aba RESULTADOS_VENDAS não encontrada' };
  const agora=new Date().toISOString(), resId=gerarId_('RES');
  ws.appendRow([resId,user.user_id,body.slot_id||'',body.jornada_id||'',user.cidade_base||'',body.tipo_resultado||'',body.quantidade||0,body.valor||0,body.observacao||'',agora,agora]);
  return{ok:true,resultado_id:resId};
}

function registrarMovimentacao_(user, body) {
  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws=ss.getSheetByName('MOVIMENTACOES_PATINETES'); if(!ws) return{ok:false,erro:'aba não encontrada'};
  const tipos=['COLETA','ENTREGA','REDISTRIBUICAO','RECOLHIMENTO','TROCA_BATERIA','ABASTECIMENTO','ORGANIZACAO_PONTO'];
  const tipo=(body.tipo_movimentacao||'').toUpperCase();
  if(!tipos.includes(tipo)) return{ok:false,erro:'tipo_movimentacao inválido'};
  const agora=new Date().toISOString(), movId=gerarId_('MOV');
  ws.appendRow([movId,user.user_id,body.jornada_id||'',user.cargo_principal||'',body.funcao_executada||user.cargo_principal||'',user.cidade_base||'',tipo,body.quantidade||1,body.veiculo||'',body.origem_lat||'',body.origem_lng||'',body.destino_lat||'',body.destino_lng||'',body.foto_inicio_url||'',body.foto_fim_url||'',body.observacao||'',agora,agora]);
  return{ok:true,movimentacao_id:movId};
}