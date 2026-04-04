// ============================================================
//  07.Gestor.gs  — Endpoints do Painel Gestor
//  Versão: 3.1  |  Fase 3 — Consolidação Multi-slots + Cache
// ============================================================

function _assertGestor_(token) {
  const auth = validarToken_(token);
  if (!auth.ok) throw new Error(auth.erro || 'Token inválido.');
  const role = (auth.user.tipo_vinculo || '').toUpperCase();
  if (!['GESTOR', 'FISCAL', 'LIDER'].includes(role)) throw new Error('Acesso negado. Perfil "' + role + '" não autorizado.');
  return auth.user;
}

function _getPromotoresMap_(ss) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('promotores_map');
  if (cached) {
    try { return JSON.parse(cached); } catch(_) {}
  }
  const ws   = ss.getSheetByName('PROMOTORES'); if (!ws) return {};
  const data = ws.getDataRange().getValues();
  const h    = data[0].map(v => String(v).toLowerCase().trim());
  const iId  = h.indexOf('user_id'), iNome = h.indexOf('nome_completo');
  const iCargo = h.indexOf('cargo_principal'), iVinc = h.indexOf('tipo_vinculo');
  const iCid = h.indexOf('cidade_base'), iTg = h.indexOf('telegram_user_id');
  const map = {};
  for (let r = 1; r < data.length; r++) {
    const id = String(data[r][iId]).trim();
    if (id) map[id] = {
      nome: data[r][iNome] || '',
      cargo: data[r][iCargo] || '',
      cargo_principal: data[r][iCargo] || '',
      tipo_vinculo: (data[r][iVinc] || 'MEI').toUpperCase(),
      cidade: data[r][iCid] || '',
      telegram_user_id: data[r][iTg] || ''
    };
  }
  try { cache.put('promotores_map', JSON.stringify(map), 30); } catch(_) {}
  return map;
}


function _getSlotsMap_(ss) {
  const cache  = CacheService.getScriptCache();
  const cached = cache.get('slots_map');
  if (cached) {
    try { return JSON.parse(cached); } catch(_) {}
  }
  const ws   = ss.getSheetByName('SLOTS'); if (!ws) return {};
  const data = ws.getDataRange().getValues();
  const h    = data[0].map(v => String(v).toLowerCase().trim());
  const iId  = h.indexOf('slot_id'), iNome = h.indexOf('local_nome');
  const iLat = h.indexOf('lat'), iLng = h.indexOf('lng');
  const iRaio = h.indexOf('raio_metros'), iIni = h.indexOf('inicio');
  const iFim = h.indexOf('fim'), iOp = h.indexOf('operacao');
  const iDt  = h.indexOf('data'), iCid = h.indexOf('cidade');
  const map = {};
  for (let r = 1; r < data.length; r++) {
    const id = String(data[r][iId]).trim();
    if (id) map[id] = {
      nome: data[r][iNome] || '',
      lat: data[r][iLat] || null,
      lng: data[r][iLng] || null,
      raio_metros: data[r][iRaio] || 100,
      inicio: data[r][iIni] || '',
      fim: data[r][iFim] || '',
      operacao: data[r][iOp] || 'PROMO',
      data: String(data[r][iDt] || '').substring(0, 10),
      cidade: data[r][iCid] || ''
    };
  }
  try { cache.put('slots_map', JSON.stringify(map), 30); } catch(_) {}
  return map;
}


function getPromotoresAtivos_(token) {
  const adminUser = _assertGestor_(token);
  const isFiscal = (adminUser.cargo_principal || '').toUpperCase() === 'FISCAL';
  const myCity = normStr_(adminUser.cidade_base || adminUser.cidade || '');

  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const promMap=_getPromotoresMap_(ss), slotsMap=_getSlotsMap_(ss);

  const posMap={};
  const locWs=ss.getSheetByName('LOCALIZACAO_TEMPO_REAL');
  if (locWs) {
    const locData=locWs.getDataRange().getValues(), lh=locData[0].map(v=>String(v).toLowerCase().trim());
    const iUsr=lh.indexOf('user_id'), iLat=lh.indexOf('lat'), iLng=lh.indexOf('lng');
    const iTs=lh.indexOf('horario_servidor'), iScore=lh.indexOf('location_trust_score');
    for (let r=1;r<locData.length;r++) {
      const uid=String(locData[r][iUsr]).trim(); if(!uid) continue;
      const ts=locData[r][iTs]?new Date(locData[r][iTs]).getTime():0;
      const existing=posMap[uid];
      const existingTs=existing&&existing._ts||0;
      if (!existing||ts>existingTs) {
        posMap[uid]={lat:locData[r][iLat]||null,lng:locData[r][iLng]||null,ultima_posicao:locData[r][iTs]||null,location_trust_score:locData[r][iScore]||null,_ts:ts};
      }
    }
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
      const uid=String(jData[r][iUsr]).trim();
      const slotId=String(jData[r][iSlt]).trim(), prom=promMap[uid]||{}, slot=slotsMap[slotId]||{}, pos=posMap[uid]||{};
      
      const cidadeCard = prom.cidade || slot.nome || '';
      if (isFiscal && normStr_(cidadeCard) !== myCity && normStr_(slot.cidade || '') !== myCity) continue;

      result.push({promotor_id:uid,user_id:uid,nome:prom.nome||uid,cargo_principal:prom.cargo_principal||'',tipo_vinculo:(prom.tipo_vinculo||'MEI').toUpperCase(),cidade:cidadeCard,operacao:slot.operacao||'PROMO',status_jornada:status,slot_id:slotId,slot_nome:slot.nome||slotId,inicio_real:jData[r][iIni]?new Date(jData[r][iIni]).toISOString():null,lat:pos.lat||null,lng:pos.lng||null,ultima_posicao:pos.ultima_posicao||null,location_trust_score:pos.location_trust_score||null,confirmacao_presenca:jData[r][jh.indexOf('confirmacao_presenca')]||''});
    }
  }

  const tWs=ss.getSheetByName('TURNOS_CLT');
  if (tWs) {
    const tData=tWs.getDataRange().getValues(), th=tData[0].map(v=>String(v).toLowerCase().trim());
    const iUsr=th.indexOf('user_id'), iStt=th.indexOf('status'), iIni=th.indexOf('checkin_hora');
    const iZon=th.indexOf('zona_nome'), iCar=th.indexOf('cargo_clt'), iNom=th.indexOf('nome_completo');
    for (let r=1;r<tData.length;r++) {
      const status=String(tData[r][iStt]).trim();
      if (!['CONFIRMADO','EM_ANDAMENTO','PAUSADO'].includes(status)) continue;
      const uid=String(tData[r][iUsr]).trim(); if(vistos.has(uid)) continue; vistos.add(uid);
      const prom=promMap[uid]||{}, pos=posMap[uid]||{};
      const cargo = String(tData[r][iCar] || prom.cargo_principal || '').toUpperCase();
      const tipoVinc = cargo === 'FISCAL' ? 'FISCAL' : 'CLT';
      const cidadeCard = prom.cidade || tData[r][iZon] || '';
      
      if (isFiscal && normStr_(cidadeCard) !== myCity) continue;

      result.push({
        promotor_id:uid,
        user_id:uid,
        nome:tData[r][iNom]||prom.nome||uid,
        cargo_principal:cargo,
        tipo_vinculo:tipoVinc,
        cidade:cidadeCard,
        operacao:'LOGISTICA',
        status_jornada:status,
        slot_id:'',
        slot_nome:tData[r][iZon]||'—',
        inicio_real:tData[r][iIni]?new Date(tData[r][iIni]).toISOString():null,
        lat:pos.lat||null,
        lng:pos.lng||null,
        ultima_posicao:pos.ultima_posicao||null,
        location_trust_score:pos.location_trust_score||null
      });
    }
  }

  return{ok:true,data:result};
}

function getSlotsHoje_(token, params) {
  const adminUser = _assertGestor_(token);
  const isFiscal = (adminUser.cargo_principal || '').toUpperCase() === 'FISCAL';
  const myCity = normStr_(adminUser.cidade_base || adminUser.cidade || '');

  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const slotsWs = ss.getSheetByName('SLOTS');
  if (!slotsWs) return { ok: true, data: [], stats: {} };

  const data  = slotsWs.getDataRange().getValues();
  const h     = data[0].map(v => String(v).toLowerCase().trim());
  const promMap = _getPromotoresMap_(ss);

  const dataFiltro = (params && params.data)
    ? String(params.data).substring(0, 10)
    : Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");

  const statusValidos = ['DISPONIVEL', 'ACEITO', 'EM_ATIVIDADE', 'PAUSADO', 'ENCERRADO', 'CANCELADO'];
  const iSlotId  = h.indexOf('slot_id'), iStatus = h.indexOf('status'), iUserId = h.indexOf('user_id');
  const iNome = h.indexOf('local_nome'), iLat = h.indexOf('lat'), iLng = h.indexOf('lng'), iRaio = h.indexOf('raio_metros');
  const iCidade = h.indexOf('cidade'), iInicio = h.indexOf('inicio'), iFim = h.indexOf('fim'), iData = h.indexOf('data'), iMax = h.indexOf('max_promotores');

  const locaisMap = {};

  for (let r = 1; r < data.length; r++) {
    const status = String(data[r][iStatus]).trim() || 'DISPONIVEL';
    if (!statusValidos.includes(status)) continue;

    const dataSlot = String(data[r][iData] || '').substring(0, 10);
    if (dataSlot && dataSlot !== dataFiltro) continue;

    const cidade = String(data[r][iCidade] || '');
    if (isFiscal && normStr_(cidade) !== myCity) continue;

    const slotId = String(data[r][iSlotId]).trim(), userId = String(data[r][iUserId]).trim();
    const nome = String(data[r][iNome] || '').trim(), inicio = String(data[r][iInicio] || '').substring(0, 5), fim = String(data[r][iFim] || '').substring(0, 5);
    const lat = data[r][iLat] || null, lng = data[r][iLng] || null, raio = data[r][iRaio] || 100, maxProm = parseInt(data[r][iMax] || '1') || 1;
    const prom = promMap[userId] || {};

    const statusFront = { DISPONIVEL:'DISPONIVEL', ACEITO:'OCUPADO', EM_ATIVIDADE:'ATIVO', PAUSADO:'PAUSADO', ENCERRADO:'ENCERRADO', CANCELADO:'CANCELADO' }[status] || status;
    const chave = nome + '__' + inicio + '__' + fim + '__' + lat + '__' + lng;

    if (!locaisMap[chave]) {
      locaisMap[chave] = { slot_id:slotId, nome:nome, lat:lat, lng:lng, raio_metros:raio, cidade:cidade, inicio_slot:inicio, fim_slot:fim, data_slot:dataSlot, max_promotores:maxProm, slots:[], promotores:[], vagas_ocupadas:0, status_geral:'DISPONIVEL' };
    }

    const local = locaisMap[chave];
    local.slots.push(slotId);
    if (maxProm > local.max_promotores) local.max_promotores = maxProm;

    if (userId && prom.nome) {
      local.promotores.push({ user_id:userId, nome:prom.nome, status:statusFront, slot_id:slotId });
      if (['OCUPADO', 'ATIVO', 'PAUSADO'].includes(statusFront)) local.vagas_ocupadas++;
    }

    const prioridade = { ATIVO:4, OCUPADO:3, PAUSADO:2, DISPONIVEL:1, ENCERRADO:0, CANCELADO:0 };
    if ((prioridade[statusFront] || 0) > (prioridade[local.status_geral] || 0)) local.status_geral = statusFront;
  }

  const result = Object.values(locaisMap).sort((a, b) => a.inicio_slot < b.inicio_slot ? -1 : 1);
  const stats = { total:result.length, ocupados:result.filter(s => ['OCUPADO','ATIVO','PAUSADO'].includes(s.status_geral)).length, disponiveis:result.filter(s => s.status_geral === 'DISPONIVEL').length, encerrados:result.filter(s => s.status_geral === 'ENCERRADO').length };

  return { ok: true, data: result, stats: stats };
}

function criarSlot_(token, params) {
  const gestor=_assertGestor_(token);
  const{nome,cidade,lat,lng,data,inicio,fim,raio_metros,cargo_previsto}=params;
  if(!nome||!cidade||!lat||!lng||!data||!inicio||!fim) throw new Error('Campos obrigatórios faltando.');

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

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

  } finally {
    lock.releaseLock();
  }
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

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

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

      const userId=String(data[r][h.indexOf('user_id')]).trim(), promMap=_getPromotoresMap_(ss), prom=promMap[userId]||{}, telegramUserId=prom.telegram_user_id||'';
      const tipo=data[r][h.indexOf('tipo')]||'', tipoLabel={REFORCO_PATINETES:'Reforço de Patinetes',TROCA_BATERIA:'Troca de Bateria',REALOCACAO:'Realocação',OCORRENCIA:'Ocorrência'}[tipo]||tipo, emoji=novoStatus==='ATENDIDA'?'✅':'❌';

      const integracoes=[];
      if (telegramUserId) {
        integracoes.push({ canal:'telegram', tipo:'private_message', telegram_user_id:String(telegramUserId), parse_mode:'HTML', text_html:`${emoji} <b>Solicitação ${novoStatus==='ATENDIDA'?'Aprovada':'Negada'}</b>\n\nTipo: ${tipoLabel}${observacao?'\nObs: '+observacao:''}` });
      }
      return{ok:true,mensagem:'Solicitação '+decisao+' com sucesso.',integracoes};
    }
    throw new Error('Solicitação não encontrada: '+solicitacao_id);

  } finally {
    lock.releaseLock();
  }
}

function getKpisDia_(token) {
  _assertGestor_(token);
  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), hoje=new Date(); hoje.setHours(0,0,0,0);
  let promotores_ativos=0,em_operacao=0,slots_ocupados=0,slots_disponiveis=0,checkins_hoje=0,solicitacoes_abertas=0;
  const jWs=ss.getSheetByName('JORNADAS');
  if (jWs) {
    const jData=jWs.getDataRange().getValues(), jh=jData[0].map(v=>String(v).toLowerCase().trim());
    const iCri=jh.indexOf('criado_em'), iStt=jh.indexOf('status'), iIni=jh.indexOf('inicio_real'), ativos=['ACEITO','EM_ATIVIDADE','PAUSADO','EM_TURNO'];
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
  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), sheet=ss.getSheetByName('LOCALIZACAO_TEMPO_REAL'); if(!sheet) return{ok:true,data:[]};
  const rows=sheet.getDataRange().getValues(), h=rows[0].map(v=>String(v).toLowerCase().trim());
  const iUsr=h.indexOf('user_id'), iLat=h.indexOf('lat'), iLng=h.indexOf('lng'), iTs=h.indexOf('horario_servidor'), iScore=h.indexOf('location_trust_score'), filtroData=new Date(data); filtroData.setHours(0,0,0,0);
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
  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), sheet=ss.getSheetByName('ESCALAS_DRAFT'); if(!sheet) return{ok:true,data:[]};
  const data=sheet.getDataRange().getValues(), h=data[0].map(v=>String(v).toLowerCase().trim()), promMap=_getPromotoresMap_(ss), slotsMap=_getSlotsMap_(ss), result=[];
  for (let r=1;r<data.length;r++) {
    const id=String(data[r][h.indexOf('escala_draft_id')]).trim(); if(!id) continue;
    const uid=String(data[r][h.indexOf('user_id')]).trim(), slotId=String(data[r][h.indexOf('slot_id')]||'').trim(), prom=promMap[uid]||{}, slot=slotsMap[slotId]||{};
    result.push({escala_draft_id:id,user_id:uid,slot_id:slotId,promotor_nome:prom.nome||uid,slot_nome:slot.nome||slotId,data:data[r][h.indexOf('data')]||'',inicio:data[r][h.indexOf('inicio')]||'',fim:data[r][h.indexOf('fim')]||'',funcao_prevista:data[r][h.indexOf('funcao_prevista')]||'',cargo_principal:data[r][h.indexOf('cargo_principal')]||'',tipo_jornada:data[r][h.indexOf('tipo_jornada')]||'SLOT',status_draft:data[r][h.indexOf('status_draft')]||'RASCUNHO'});
  }
  return{ok:true,data:result};
}

function criarEscalaDraft_(token,params) {
  _assertGestor_(token);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), sheet=ss.getSheetByName('ESCALAS_DRAFT'); if(!sheet) throw new Error('Aba ESCALAS_DRAFT não encontrada.');
    const draftId='DRAFT_'+new Date().getTime(), agora=new Date().toISOString(), gestor=validarToken_(token), gestorId=gestor.user?.user_id||'';
    sheet.appendRow([draftId,gestorId,'',params.user_id||'',params.cidade||'',params.operacao||'PROMO',params.cargo_principal||'PROMOTOR',params.funcao_prevista||params.cargo_principal||'PROMOTOR',params.tipo_jornada||'SLOT',params.data||'',params.inicio||'',params.fim||'','RASCUNHO',params.slot_id||'',agora,agora]);
    return{ok:true,escala_draft_id:draftId};

  } finally {
    lock.releaseLock();
  }
}

function excluirEscalaDraft_(token,params) {
  _assertGestor_(token);
  const{escala_draft_id}=params; if(!escala_draft_id) throw new Error('escala_draft_id obrigatório.');
  const ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), sheet=ss.getSheetByName('ESCALAS_DRAFT');
  const data=sheet.getDataRange().getValues(), h=data[0].map(v=>String(v).toLowerCase().trim()), iId=h.indexOf('escala_draft_id');
  for (let r=1;r<data.length;r++) { if(String(data[r][iId]).trim()===escala_draft_id){sheet.deleteRow(r+1);return{ok:true};} }
  throw new Error('Draft não encontrado.');
}

function getHistoricoJornadasGestor_(token, params) {
  _assertGestor_(token);
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), ws = ss.getSheetByName('JORNADAS'), data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim()), promMap = _getPromotoresMap_(ss), slotsMap = _getSlotsMap_(ss);
  const de = params.de ? new Date(params.de) : new Date(Date.now() - 30*86400000), ate = params.ate ? new Date(params.ate + 'T23:59:59') : new Date(), resultado = [];
  for (let r = 1; r < data.length; r++) {
    const row = rowToObj_(h, data[r]); if (!row.criado_em) continue;
    const d = new Date(row.criado_em); if (d < de || d > ate) continue;
    const prom = promMap[row.user_id] || {}, slot = slotsMap[row.slot_id] || {};
    row.nome = prom.nome || row.user_id; row.local_nome = slot.nome || row.slot_id; row.local = slot.nome || '';
    resultado.push(row);
  }
  resultado.sort((a,b) => new Date(b.criado_em) - new Date(a.criado_em));
  return { ok: true, historico: resultado };
}

function getPromotoresSemSlot_(token, params) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), cidade = params.cidade || '', promMap = _getPromotoresMap_(ss), ativos = new Set(), jWs = ss.getSheetByName('JORNADAS');
  if (jWs) {
    const jData = jWs.getDataRange().getValues(), jh = jData[0].map(v => String(v).toLowerCase().trim()), iUsr = jh.indexOf('user_id'), iStt = jh.indexOf('status');
    for (let r = 1; r < jData.length; r++) { if (['ACEITO','EM_ATIVIDADE','PAUSADO'].includes(String(jData[r][iStt]).trim())) ativos.add(String(jData[r][iUsr]).trim()); }
  }
  const result = [];
  for (const [uid, prom] of Object.entries(promMap)) {
    if (ativos.has(uid)) continue;
    if (cidade && String(prom.cidade || '').toLowerCase() !== cidade.toLowerCase()) continue;
    if ((prom.tipo_vinculo || '').toUpperCase() !== 'MEI') continue;
    if (!prom.telegram_user_id) continue;
    result.push({ user_id: uid, nome: prom.nome || uid, telegram_user_id: prom.telegram_user_id });
  }
  return { ok: true, data: result };
}

function getRelatorioSupervisao_(token, params) {
  _assertGestor_(token);
  const { fiscal_id, data } = params;
  if (!fiscal_id || !data) throw new Error('fiscal_id e data obrigatórios.');

  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const locWs = ss.getSheetByName('LOCALIZACAO_TEMPO_REAL');
  const jornWs = ss.getSheetByName('JORNADAS');
  const slotsMap = _getSlotsMap_(ss);
  
  const rows = locWs.getDataRange().getValues();
  const h = rows[0].map(v => String(v).toLowerCase().trim());
  const iUsr = h.indexOf('user_id'), iLat = h.indexOf('lat'), iLng = h.indexOf('lng'), iTs = h.indexOf('horario_servidor');

  const filtroData = data.substring(0, 10);
  
  // 0. Buscar quais slots o fiscal cobriu oficialmente neste dia
  const slotsCobertos = new Set();
  if (jornWs) {
    const jData = jornWs.getDataRange().getValues(), jh = jData[0].map(v => String(v).toLowerCase().trim());
    for (let r = 1; r < jData.length; r++) {
      if (String(jData[r][jh.indexOf('user_id')]).trim() === fiscal_id && String(jData[r][jh.indexOf('criado_em')]).substring(0, 10) === filtroData) {
        slotsCobertos.add(String(jData[r][jh.indexOf('slot_id')]).trim());
      }
    }
  }

  const trajetos = [];
  for (let r = 1; r < rows.length; r++) {
    if (String(rows[r][iUsr]).trim() !== fiscal_id) continue;
    if (String(rows[r][iTs]).substring(0, 10) !== filtroData) continue;
    trajetos.push({ lat: rows[r][iLat], lng: rows[r][iLng], ts: new Date(rows[r][iTs]).getTime() });
  }

  const visitas = [];
  let visitaAtual = null;

  trajetos.forEach(ponto => {
    let localEncontrado = null;
    for (const sid in slotsMap) {
      const s = slotsMap[sid];
      const dist = haversineMetros_(ponto.lat, ponto.lng, s.lat, s.lng);
      if (dist <= 150) {
        localEncontrado = { id: sid, nome: s.nome };
        break;
      }
    }

    if (localEncontrado) {
      if (!visitaAtual || visitaAtual.slot_id !== localEncontrado.id) {
        if (visitaAtual) {
          visitaAtual.fim = ponto.ts;
          visitaAtual.duracao_min = Math.round((visitaAtual.fim - visitaAtual.inicio) / 60000);
          visitaAtual.is_cobertura = slotsCobertos.has(visitaAtual.slot_id);
          if (visitaAtual.duracao_min >= 5) visitas.push(visitaAtual);
        }
        visitaAtual = { slot_id: localEncontrado.id, local: localEncontrado.nome, inicio: ponto.ts };
      }
    } else if (visitaAtual) {
      visitaAtual.fim = ponto.ts;
      visitaAtual.duracao_min = Math.round((visitaAtual.fim - visitaAtual.inicio) / 60000);
      visitaAtual.is_cobertura = slotsCobertos.has(visitaAtual.slot_id);
      if (visitaAtual.duracao_min >= 5) visitas.push(visitaAtual);
      visitaAtual = null;
    }
  });

  return { ok: true, visitas };
}

function invalidarCache_() {
  const cache = CacheService.getScriptCache();
  cache.remove('promotores_map');
  cache.remove('slots_map');
}

function registrarIndicacao_(body) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), ws = ss.getSheetByName('INDICACOES'); if (!ws) return { ok: false, erro: 'Aba INDICACOES nao encontrada' };
  const agora = new Date().toISOString(), id = gerarId_('IND');
  ws.appendRow([id, body.nome||'', body.cpf||'', body.telefone||'', body.cidade||'', body.email||'', body.indicado_por||'', 'PENDENTE', agora]);
  if (body.indicado_por) {
    try { registrarScore_(ss, body.indicado_por, 'INDICACAO', 15, 'Indicacao de promotor', id); verificarBadges_(ss, body.indicado_por, { evento: 'INDICACAO' }); } catch(_) {}
  }
  return { ok: true, indicacao_id: id };
}

/**
 * Duplica os slots de uma data para outra (Escala em Massa).
 */
function replicarEscala_(token, params) {
  _assertGestor_(token);
  const { data_origem, data_destino } = params;
  if (!data_origem || !data_destino) throw new Error('Data origem e destino obrigatórias.');

  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws = ss.getSheetByName('SLOTS');
  if (!ws) throw new Error('Aba SLOTS não encontrada.');

  const data = ws.getDataRange().getValues();
  const h = data[0].map(v => String(v).toLowerCase().trim());
  
  const iId = h.indexOf('slot_id'), iSt = h.indexOf('status'), iDt = h.indexOf('data');
  const iUsr = h.indexOf('user_id'), iJrn = h.indexOf('jornada_id'), iAlerta = h.indexOf('tg_alerta_noshow');
  const iCri = h.indexOf('criado_em'), iUpd = h.indexOf('atualizado_em');

  const novosSlots = [];
  const agora = new Date().toISOString();

  for (let r = 1; r < data.length; r++) {
    const dataSlot = String(data[r][iDt]).substring(0, 10);
    if (dataSlot !== data_origem) continue;

    // Clona a linha e limpa campos de vínculo/status
    const newRow = [...data[r]];
    newRow[iId] = 'SLT_' + new Date().getTime() + '_' + Math.random().toString(36).substring(2, 5).toUpperCase();
    newRow[iDt] = data_destino;
    newRow[iSt] = 'DISPONIVEL';
    if (iUsr > -1) newRow[iUsr] = '';
    if (iJrn > -1) newRow[iJrn] = '';
    if (iAlerta > -1) newRow[iAlerta] = '';
    if (iCri > -1) newRow[iCri] = agora;
    if (iUpd > -1) newRow[iUpd] = agora;

    novosSlots.push(newRow);
  }

  if (novosSlots.length > 0) {
    ws.getRange(ws.getLastRow() + 1, 1, novosSlots.length, novosSlots[0].length).setValues(novosSlots);
    // Força sincronização do cache após criar em massa
    if (typeof sincronizarCacheSlots_ === 'function') sincronizarCacheSlots_();
  }

  return { ok: true, count: novosSlots.length, mensagem: `${novosSlots.length} slots replicados para ${data_destino}.` };
}

/**
 * Reclica uma semana inteira de slots (7 dias).
 */
function replicarSemana_(token, params) {
  _assertGestor_(token);
  const { data_inicio_origem, data_inicio_destino } = params;
  if (!data_inicio_origem || !data_inicio_destino) throw new Error('Datas de início obrigatórias.');

  let totalReplicado = 0;
  const dataOrigem = new Date(data_inicio_origem + 'T12:00:00');
  const dataDestino = new Date(data_inicio_destino + 'T12:00:00');

  for (let i = 0; i < 7; i++) {
    const dOrigem = new Date(dataOrigem);
    dOrigem.setDate(dOrigem.getDate() + i);
    const sOrigem = dOrigem.toISOString().split('T')[0];

    const dDestino = new Date(dataDestino);
    dDestino.setDate(dDestino.getDate() + i);
    const sDestino = dDestino.toISOString().split('T')[0];

    const res = replicarEscala_(token, { data_origem: sOrigem, data_destino: sDestino });
    totalReplicado += res.count;
  }

  return { ok: true, count: totalReplicado, mensagem: `Escala semanal replicada! Total de ${totalReplicado} slots criados.` };
}