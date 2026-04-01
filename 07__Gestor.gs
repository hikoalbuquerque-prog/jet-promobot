// ============================================================
//  07.Gestor.gs  — Endpoints do Painel Gestor
//  Versão: 3.0  |  Fase 3 — Notificações Telegram
// ============================================================

function _assertGestor_(token) {
  const auth = validarToken_(token);
  if (!auth.ok) throw new Error(auth.erro || 'Token inválido.');
  const role = (auth.user.tipo_vinculo || '').toUpperCase();
  if (!['GESTOR', 'FISCAL', 'LIDER'].includes(role)) throw new Error('Acesso negado. Perfil "' + role + '" não autorizado.');
  return auth.user;
}

function _getPromotoresMap_(ss) {
  const ws=ss.getSheetByName('PROMOTORES'); if(!ws) return {};
  const data=ws.getDataRange().getValues(), h=data[0].map(v=>String(v).toLowerCase().trim());
  const iId=h.indexOf('user_id'), iNome=h.indexOf('nome_completo'), iCargo=h.indexOf('cargo_principal');
  const iVinc=h.indexOf('tipo_vinculo'), iCid=h.indexOf('cidade_base'), iTg=h.indexOf('telegram_user_id');
  const map={};
  for (let r=1;r<data.length;r++) {
    const id=String(data[r][iId]).trim();
    if (id) map[id]={
      nome:data[r][iNome]||'', cargo:data[r][iCargo]||'',
      cargo_principal:data[r][iCargo]||'',
      tipo_vinculo:(data[r][iVinc]||'MEI').toUpperCase(),
      cidade:data[r][iCid]||'',
      telegram_user_id:data[r][iTg]||'',
    };
  }
  return map;
}

function _getSlotsMap_(ss) {
  const ws=ss.getSheetByName('SLOTS'); if(!ws) return {};
  const data=ws.getDataRange().getValues(), h=data[0].map(v=>String(v).toLowerCase().trim());
  const iId=h.indexOf('slot_id'), iNome=h.indexOf('local_nome'), iLat=h.indexOf('lat'), iLng=h.indexOf('lng');
  const iRaio=h.indexOf('raio_metros'), iIni=h.indexOf('inicio'), iFim=h.indexOf('fim'), iOp=h.indexOf('operacao');
  const map={};
  for (let r=1;r<data.length;r++) {
    const id=String(data[r][iId]).trim();
    if (id) map[id]={nome:data[r][iNome]||'',lat:data[r][iLat]||null,lng:data[r][iLng]||null,raio_metros:data[r][iRaio]||100,inicio:data[r][iIni]||'',fim:data[r][iFim]||'',operacao:data[r][iOp]||'PROMO'};
  }
  return map;
}

function getPromotoresAtivos_(token) {
  _assertGestor_(token);
  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const promMap=_getPromotoresMap_(ss), slotsMap=_getSlotsMap_(ss);

  const posMap={};
  const locWs=ss.getSheetByName('LOCALIZACAO_TEMPO_REAL');
  if (locWs) {
    const locData=locWs.getDataRange().getValues(), lh=locData[0].map(v=>String(v).toLowerCase().trim());
    const iUsr=lh.indexOf('user_id'), iLat=lh.indexOf('lat'), iLng=lh.indexOf('lng');
    const iTs=lh.indexOf('horario_servidor'), iScore=lh.indexOf('location_trust_score');
    // Percorre todas as linhas e mantém apenas a posição MAIS RECENTE por user_id
    for (let r=1;r<locData.length;r++) {
      const uid=String(locData[r][iUsr]).trim(); if(!uid) continue;
      const ts=locData[r][iTs]?new Date(locData[r][iTs]).getTime():0;
      const existing=posMap[uid];
      const existingTs=existing&&existing._ts||0;
      if (!existing||ts>existingTs) {
        posMap[uid]={lat:locData[r][iLat]||null,lng:locData[r][iLng]||null,ultima_posicao:locData[r][iTs]||null,location_trust_score:locData[r][iScore]||null,_ts:ts};
      }
    }
    // Remove campo interno _ts antes de retornar
    Object.values(posMap).forEach(p=>delete p._ts);
  }

  const result=[], vistos=new Set();

  const jWs=ss.getSheetByName('JORNADAS');
  if (jWs) {
    const jData=jWs.getDataRange().getValues(), jh=jData[0].map(v=>String(v).toLowerCase().trim());
    const iUsr=jh.indexOf('user_id'), iSlt=jh.indexOf('slot_id'), iStt=jh.indexOf('status'), iIni=jh.indexOf('inicio_real');
    for (let r=1;r<jData.length;r++) {
      const status=String(jData[r][iStt]).trim();
      if (!['ACEITO','EM_ATIVIDADE','PAUSADO','EM_TURNO'].includes(status)) continue;
      const uid=String(jData[r][iUsr]).trim(); if(vistos.has(uid)) continue; vistos.add(uid);
      const slotId=String(jData[r][iSlt]).trim(), prom=promMap[uid]||{}, slot=slotsMap[slotId]||{}, pos=posMap[uid]||{};
      result.push({promotor_id:uid,user_id:uid,nome:prom.nome||uid,cargo_principal:prom.cargo_principal||'',tipo_vinculo:(prom.tipo_vinculo||'MEI').toUpperCase(),cidade:prom.cidade||slot.nome||'',operacao:slot.operacao||'PROMO',status_jornada:status,slot_id:slotId,slot_nome:slot.nome||slotId,inicio_real:jData[r][iIni]?new Date(jData[r][iIni]).toISOString():null,lat:pos.lat||null,lng:pos.lng||null,ultima_posicao:pos.ultima_posicao||null,location_trust_score:pos.location_trust_score||null});
    }
  }

  const tWs=ss.getSheetByName('TURNOS_CLT');
  if (tWs) {
    const tData=tWs.getDataRange().getValues(), th=tData[0].map(v=>String(v).toLowerCase().trim());
    const iUsr=th.indexOf('user_id'), iStt=th.indexOf('status'), iIni=th.indexOf('checkin_hora');
    const iZon=th.indexOf('zona_nome'), iCar=th.indexOf('cargo_clt'), iNom=th.indexOf('nome_completo');
    for (let r=1;r<tData.length;r++) {
      const status=String(tData[r][iStt]).trim();
      if (!['CONFIRMADO','EM_ANDAMENTO'].includes(status)) continue;
      const uid=String(tData[r][iUsr]).trim(); if(vistos.has(uid)) continue; vistos.add(uid);
      const prom=promMap[uid]||{}, pos=posMap[uid]||{};
      result.push({promotor_id:uid,user_id:uid,nome:tData[r][iNom]||prom.nome||uid,cargo_principal:tData[r][iCar]||prom.cargo_principal||'',tipo_vinculo:'CLT',cidade:prom.cidade||tData[r][iZon]||'',operacao:'LOGISTICA',status_jornada:status,slot_id:'',slot_nome:tData[r][iZon]||'—',inicio_real:tData[r][iIni]?new Date(tData[r][iIni]).toISOString():null,lat:pos.lat||null,lng:pos.lng||null,ultima_posicao:pos.ultima_posicao||null,location_trust_score:pos.location_trust_score||null});
    }
  }

  return{ok:true,data:result};
}

function getSlotsHoje_(token) {
  _assertGestor_(token);
  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const slotsWs=ss.getSheetByName('SLOTS'); if(!slotsWs) return{ok:true,data:[]};
  const data=slotsWs.getDataRange().getValues(), h=data[0].map(v=>String(v).toLowerCase().trim());
  const promMap=_getPromotoresMap_(ss);
  const statusValidos=['DISPONIVEL','ACEITO','EM_ATIVIDADE','PAUSADO'];
  const result=[];
  for (let r=1;r<data.length;r++) {
    const status=String(data[r][h.indexOf('status')]).trim();
    if (!statusValidos.includes(status)) continue;
    const userId=String(data[r][h.indexOf('user_id')]).trim(), prom=promMap[userId]||{};
    const statusFront={DISPONIVEL:'DISPONIVEL',ACEITO:'OCUPADO',EM_ATIVIDADE:'OCUPADO',PAUSADO:'OCUPADO'}[status]||status;
    result.push({slot_id:String(data[r][h.indexOf('slot_id')]).trim(),nome:data[r][h.indexOf('local_nome')]||'',endereco:'',lat:data[r][h.indexOf('lat')]||null,lng:data[r][h.indexOf('lng')]||null,raio_metros:data[r][h.indexOf('raio_metros')]||100,cidade:data[r][h.indexOf('cidade')]||'',status:statusFront,promotor_nome:prom.nome||'',inicio_slot:data[r][h.indexOf('inicio')]||'',fim_slot:data[r][h.indexOf('fim')]||'',checkin_hora:null});
  }
  return{ok:true,data:result};
}

function criarSlot_(token, params) {
  const gestor=_assertGestor_(token);
  const{nome,cidade,lat,lng,data,inicio,fim,raio_metros,cargo_previsto}=params;
  if(!nome||!cidade||!lat||!lng||!data||!inicio||!fim) throw new Error('Campos obrigatórios faltando.');
  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const sheet=ss.getSheetByName('SLOTS'); if(!sheet) throw new Error('Aba SLOTS não encontrada.');
  const slotId='SLT_'+new Date().getTime(), agora=new Date().toISOString();
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  const row=new Array(headers.length).fill(''), h=headers.map(v=>String(v).toLowerCase().trim());
  row[h.indexOf('slot_id')]=slotId; row[h.indexOf('cidade')]=cidade; row[h.indexOf('operacao')]='PROMO';
  row[h.indexOf('local_nome')]=nome; row[h.indexOf('lat')]=parseFloat(lat); row[h.indexOf('lng')]=parseFloat(lng);
  row[h.indexOf('raio_metros')]=parseInt(raio_metros)||100; row[h.indexOf('status')]='DISPONIVEL';
  row[h.indexOf('cargo_previsto')]=cargo_previsto||'PROMOTOR'; row[h.indexOf('criado_em')]=agora; row[h.indexOf('atualizado_em')]=agora;
  sheet.appendRow(row);
  const lastRow=sheet.getLastRow();
  const iData=h.indexOf('data'), iInicio=h.indexOf('inicio'), iFim=h.indexOf('fim');
  if(iData>-1)   sheet.getRange(lastRow,iData+1).setNumberFormat('@').setValue(String(data).substring(0,10));
  if(iInicio>-1) sheet.getRange(lastRow,iInicio+1).setNumberFormat('@').setValue(String(inicio).substring(0,5));
  if(iFim>-1)    sheet.getRange(lastRow,iFim+1).setNumberFormat('@').setValue(String(fim).substring(0,5));
  registrarAuditoria_({tabela:'SLOTS',registro_id:slotId,campo:'criacao',valor_anterior:'',valor_novo:JSON.stringify({nome,cidade,data,inicio,fim}),alterado_por:gestor.user_id||'',origem:'painel_gestor'});
  return{ok:true,slot_id:slotId,mensagem:'Slot criado com sucesso.'};
}

function getSolicitacoesAbertas_(token) {
  _assertGestor_(token);
  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const sheet=ss.getSheetByName('SOLICITACOES_OPERACIONAIS'); if(!sheet) return{ok:true,data:[]};
  const data=sheet.getDataRange().getValues(), h=data[0].map(v=>String(v).toLowerCase().trim());
  const promMap=_getPromotoresMap_(ss), slotsMap=_getSlotsMap_(ss);
  const result=[];
  for (let r=1;r<data.length;r++) {
    const id=String(data[r][h.indexOf('solicitacao_id')]).trim(); if(!id) continue;
    const userId=String(data[r][h.indexOf('user_id')]).trim(), slotId=String(data[r][h.indexOf('slot_id')]).trim();
    const prom=promMap[userId]||{}, slot=slotsMap[slotId]||{};
    const criadoEm=data[r][h.indexOf('criado_em')];
    result.push({solicitacao_id:id,jornada_id:data[r][h.indexOf('jornada_id')]||'',promotor_id:userId,promotor_nome:prom.nome||userId,tipo_solicitacao:data[r][h.indexOf('tipo')]||'',descricao:data[r][h.indexOf('descricao')]||'',slot_nome:slot.nome||slotId,status:data[r][h.indexOf('status')]||'ABERTA',criado_em:criadoEm?new Date(criadoEm).toISOString():null,respondida_em:null,observacao:data[r][h.indexOf('aprovado_por')]||''});
  }
  result.sort((a,b)=>{if(a.status==='ABERTA'&&b.status!=='ABERTA')return -1;if(a.status!=='ABERTA'&&b.status==='ABERTA')return 1;return 0;});
  return{ok:true,data:result};
}

function responderSolicitacao_(token, params) {
  const gestor=_assertGestor_(token);
  const{solicitacao_id,decisao,observacao=''}=params;
  if(!solicitacao_id) throw new Error('solicitacao_id obrigatório.');
  if(!['APROVADA','NEGADA','ATENDIDA','CANCELADA'].includes(decisao)) throw new Error('decisao inválida.');

  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const sheet=ss.getSheetByName('SOLICITACOES_OPERACIONAIS'); if(!sheet) throw new Error('Aba não encontrada.');
  const data=sheet.getDataRange().getValues(), h=data[0].map(v=>String(v).toLowerCase().trim());
  const iId=h.indexOf('solicitacao_id'), iStt=h.indexOf('status'), iAprov=h.indexOf('aprovado_por'), iUpd=h.indexOf('atualizado_em');

  for (let r=1;r<data.length;r++) {
    if (String(data[r][iId]).trim()!==solicitacao_id) continue;
    if (data[r][iStt]!=='ABERTA') throw new Error('Solicitação já respondida: '+data[r][iStt]);

    const agora=new Date().toISOString();
    const novoStatus=decisao==='APROVADA'?'ATENDIDA':'CANCELADA';
    sheet.getRange(r+1,iStt+1).setValue(novoStatus);
    sheet.getRange(r+1,iAprov+1).setValue(gestor.user_id||'');
    sheet.getRange(r+1,iUpd+1).setValue(agora);

    registrarAuditoria_({tabela:'SOLICITACOES_OPERACIONAIS',registro_id:solicitacao_id,campo:'status',valor_anterior:'ABERTA',valor_novo:decisao,alterado_por:gestor.user_id||'',origem:'painel_gestor'});

    // Notificação Telegram para o promotor (private_message)
    const userId=String(data[r][h.indexOf('user_id')]).trim();
    const promMap=_getPromotoresMap_(ss), prom=promMap[userId]||{};
    const telegramUserId=prom.telegram_user_id||'';
    const tipo=data[r][h.indexOf('tipo')]||'';
    const tipoLabel={REFORCO_PATINETES:'Reforço de Patinetes',TROCA_BATERIA:'Troca de Bateria',REALOCACAO:'Realocação',OCORRENCIA:'Ocorrência'}[tipo]||tipo;
    const emoji=novoStatus==='ATENDIDA'?'✅':'❌';

    const integracoes=[];
    if (telegramUserId) {
      integracoes.push({
        canal:'telegram', tipo:'private_message',
        telegram_user_id:String(telegramUserId),
        parse_mode:'HTML',
        text_html:`${emoji} <b>Solicitação ${novoStatus==='ATENDIDA'?'Aprovada':'Negada'}</b>\n\nTipo: ${tipoLabel}${observacao?'\nObs: '+observacao:''}`,
      });
    }

    return{ok:true,mensagem:'Solicitação '+decisao+' com sucesso.',integracoes};
  }
  throw new Error('Solicitação não encontrada: '+solicitacao_id);
}

function getKpisDia_(token) {
  _assertGestor_(token);
  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  let promotores_ativos=0,em_operacao=0,slots_ocupados=0,slots_disponiveis=0,checkins_hoje=0,solicitacoes_abertas=0;
  const jWs=ss.getSheetByName('JORNADAS');
  if (jWs) {
    const jData=jWs.getDataRange().getValues(), jh=jData[0].map(v=>String(v).toLowerCase().trim());
    const iCri=jh.indexOf('criado_em'), iStt=jh.indexOf('status'), iIni=jh.indexOf('inicio_real');
    const ativos=['ACEITO','EM_ATIVIDADE','PAUSADO','EM_TURNO'];
    for (let r=1;r<jData.length;r++) {
      const criadoEm=new Date(jData[r][iCri]); criadoEm.setHours(0,0,0,0);
      if(criadoEm.getTime()!==hoje.getTime()) continue;
      const status=String(jData[r][iStt]).trim();
      if(ativos.includes(status)){promotores_ativos++;if(status==='EM_ATIVIDADE'||status==='EM_TURNO')em_operacao++;slots_ocupados++;}else{slots_disponiveis++;}
      if(jData[r][iIni]) checkins_hoje++;
    }
  }
  const sWs=ss.getSheetByName('SOLICITACOES_OPERACIONAIS');
  if (sWs) {
    const sData=sWs.getDataRange().getValues(), sh=sData[0].map(v=>String(v).toLowerCase().trim()), iStt=sh.indexOf('status');
    for (let r=1;r<sData.length;r++) { if(String(sData[r][iStt]).trim()==='ABERTA') solicitacoes_abertas++; }
  }
  return{ok:true,data:{promotores_ativos,em_operacao,slots_ocupados,slots_disponiveis,checkins_hoje,solicitacoes_abertas}};
}

function getHistoricoLocalizacao_(token,params) {
  _assertGestor_(token);
  const{promotor_id,data}=params; if(!promotor_id||!data) throw new Error('promotor_id e data obrigatórios.');
  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const sheet=ss.getSheetByName('LOCALIZACAO_TEMPO_REAL'); if(!sheet) return{ok:true,data:[]};
  const rows=sheet.getDataRange().getValues(), h=rows[0].map(v=>String(v).toLowerCase().trim());
  const iUsr=h.indexOf('user_id'), iLat=h.indexOf('lat'), iLng=h.indexOf('lng');
  const iTs=h.indexOf('horario_servidor'), iScore=h.indexOf('location_trust_score');
  const filtroData=new Date(data); filtroData.setHours(0,0,0,0);
  const result=[];
  for (let r=1;r<rows.length;r++) {
    if(String(rows[r][iUsr]).trim()!==promotor_id) continue;
    const ts=new Date(rows[r][iTs]), tsD=new Date(ts); tsD.setHours(0,0,0,0);
    if(tsD.getTime()!==filtroData.getTime()) continue;
    result.push({lat:rows[r][iLat]||null,lng:rows[r][iLng]||null,registrado_em:ts.toISOString(),trust_score:rows[r][iScore]||null});
  }
  result.sort((a,b)=>new Date(a.registrado_em)-new Date(b.registrado_em));
  return{ok:true,data:result};
}

function getEscalaDrafts_(token) {
  _assertGestor_(token);
  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const sheet=ss.getSheetByName('ESCALAS_DRAFT'); if(!sheet) return{ok:true,data:[]};
  const data=sheet.getDataRange().getValues(), h=data[0].map(v=>String(v).toLowerCase().trim());
  const promMap=_getPromotoresMap_(ss), slotsMap=_getSlotsMap_(ss);
  const result=[];
  for (let r=1;r<data.length;r++) {
    const id=String(data[r][h.indexOf('escala_draft_id')]).trim(); if(!id) continue;
    const uid=String(data[r][h.indexOf('user_id')]).trim(), slotId=String(data[r][h.indexOf('slot_id')]||'').trim();
    const prom=promMap[uid]||{}, slot=slotsMap[slotId]||{};
    result.push({escala_draft_id:id,user_id:uid,slot_id:slotId,promotor_nome:prom.nome||uid,slot_nome:slot.nome||slotId,data:data[r][h.indexOf('data')]||'',inicio:data[r][h.indexOf('inicio')]||'',fim:data[r][h.indexOf('fim')]||'',funcao_prevista:data[r][h.indexOf('funcao_prevista')]||'',cargo_principal:data[r][h.indexOf('cargo_principal')]||'',tipo_jornada:data[r][h.indexOf('tipo_jornada')]||'SLOT',status_draft:data[r][h.indexOf('status_draft')]||'RASCUNHO'});
  }
  return{ok:true,data:result};
}

function criarEscalaDraft_(token,params) {
  _assertGestor_(token);
  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const sheet=ss.getSheetByName('ESCALAS_DRAFT'); if(!sheet) throw new Error('Aba ESCALAS_DRAFT não encontrada.');
  const draftId='DRAFT_'+new Date().getTime(), agora=new Date().toISOString();
  const gestor=validarToken_(token), gestorId=gestor.user?.user_id||'';
  sheet.appendRow([draftId,gestorId,'',params.user_id||'',params.cidade||'',params.operacao||'PROMO',params.cargo_principal||'PROMOTOR',params.funcao_prevista||params.cargo_principal||'PROMOTOR',params.tipo_jornada||'SLOT',params.data||'',params.inicio||'',params.fim||'','RASCUNHO',params.slot_id||'',agora,agora]);
  return{ok:true,escala_draft_id:draftId};
}

function excluirEscalaDraft_(token,params) {
  _assertGestor_(token);
  const{escala_draft_id}=params; if(!escala_draft_id) throw new Error('escala_draft_id obrigatório.');
  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const sheet=ss.getSheetByName('ESCALAS_DRAFT');
  const data=sheet.getDataRange().getValues(), h=data[0].map(v=>String(v).toLowerCase().trim()), iId=h.indexOf('escala_draft_id');
  for (let r=1;r<data.length;r++) { if(String(data[r][iId]).trim()===escala_draft_id){sheet.deleteRow(r+1);return{ok:true};} }
  throw new Error('Draft não encontrado.');
}