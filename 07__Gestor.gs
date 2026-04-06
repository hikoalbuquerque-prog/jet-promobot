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

  const iSlotId  = h.indexOf('slot_id'), iStatus = h.indexOf('status'), iUserId = h.indexOf('user_id');
  const iNome = h.indexOf('local_nome'), iLat = h.indexOf('lat'), iLng = h.indexOf('lng'), iRaio = h.indexOf('raio_metros');
  const iCidade = h.indexOf('cidade'), iInicio = h.indexOf('inicio'), iFim = h.indexOf('fim'), iData = h.indexOf('data'), iMax = h.indexOf('max_promotores');

  const locaisMap = {};
  let vagos = 0, ocupados = 0;

  // BUSCAR SOLICITAÇÕES ABERTAS (Ativos e Baterias)
  const wsSol = ss.getSheetByName('SOLICITACOES_OPERACIONAIS');
  const solPorSlot = {};
  if (wsSol) {
    const sData = wsSol.getDataRange().getValues(), sh = sData[0].map(v => String(v).toLowerCase().trim());
    const siSlt = sh.indexOf('slot_id'), siStt = sh.indexOf('status'), siTip = sh.indexOf('tipo');
    for (let r = 1; r < sData.length; r++) {
      if (String(sData[r][siStt]).trim() !== 'ABERTA') continue;
      const sId = String(sData[r][siSlt]).trim();
      if (!sId) continue;
      if (!solPorSlot[sId]) solPorSlot[sId] = [];
      solPorSlot[sId].push(String(sData[r][siTip]).trim());
    }
  }

  for (let r = 1; r < data.length; r++) {
    const statusRaw = String(data[r][iStatus] || 'DISPONIVEL').trim().toUpperCase();
    if (statusRaw === 'CANCELADO') continue;

    const dataSlot = String(data[r][iData] || '').substring(0, 10);
    if (dataSlot && dataSlot !== dataFiltro) continue;

    const cidade = String(data[r][iCidade] || '');
    if (isFiscal && normStr_(cidade) !== myCity) continue;

    const slotId = String(data[r][iSlotId]).trim(), userId = String(data[r][iUserId]).trim();
    const nome = String(data[r][iNome] || '').trim(), inicio = String(data[r][iInicio] || '').substring(0, 5), fim = String(data[r][iFim] || '').substring(0, 5);
    const lat = data[r][iLat] || null, lng = data[r][iLng] || null, raio = data[r][iRaio] || 100, maxProm = parseInt(data[r][iMax] || '1') || 1;
    const prom = promMap[userId] || {};

    // Mapeamento consistente de status para o Gestor
    const statusFront = (['ACEITO', 'EM_ATIVIDADE', 'PAUSADO', 'EM_TURNO'].includes(statusRaw)) ? 'OCUPADO' : statusRaw;
    
    if (statusFront === 'DISPONIVEL') vagos++;
    else if (statusFront === 'OCUPADO') ocupados++;

    const chave = nome + '__' + inicio + '__' + fim + '__' + lat + '__' + lng;

    if (!locaisMap[chave]) {
      // IA Clima: Buscar clima do local (apenas uma vez por chave de local)
      const clima = getPrevisaoClima_(lat, lng);
      
      locaisMap[chave] = { 
        slot_id:slotId, nome:nome, lat:lat, lng:lng, raio_metros:raio, cidade:cidade, 
        inicio_slot:inicio, fim_slot:fim, data_slot:dataSlot, max_promotores:maxProm, 
        slots:[], promotores:[], vagas_ocupadas:0, status_geral:'DISPONIVEL', 
        problemas: [],
        clima: clima.ok ? { temp: clima.temp, desc: clima.clima, icone: clima.icone } : null
      };
    }

    const local = locaisMap[chave];
    local.slots.push(slotId);
    if (solPorSlot[slotId]) {
      solPorSlot[slotId].forEach(p => { if (!local.problemas.includes(p)) local.problemas.push(p); });
    }
    if (maxProm > local.max_promotores) local.max_promotores = maxProm;

    if (userId && prom.nome) {
      local.promotores.push({ user_id:userId, nome:prom.nome, status:statusRaw, slot_id:slotId });
      if (statusFront === 'OCUPADO') local.vagas_ocupadas++;
    }

    const prioridade = { OCUPADO:3, DISPONIVEL:1, ENCERRADO:0 };
    if ((prioridade[statusFront] || 0) > (prioridade[local.status_geral] || 0)) local.status_geral = statusFront;
  }

  const result = Object.values(locaisMap).sort((a, b) => a.inicio_slot < b.inicio_slot ? -1 : 1);
  return { ok: true, data: result, stats: { total: result.length, ocupados, disponiveis: vagos } };
}

function aprovarCadastro_(token, params) {
  _assertGestor_(token);
  const { id, token_override, tipo_vinculo, cpf, dados, status } = params;
  
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const wsPre = ss.getSheetByName('PRE_CADASTROS');
  
  if (status === 'REJEITADO') {
    if (wsPre) {
      const dataPre = wsPre.getDataRange().getValues();
      for (let r = 1; r < dataPre.length; r++) {
        if (String(dataPre[r][0]).trim() === id) {
          wsPre.deleteRow(r + 1);
          return { ok: true, mensagem: 'Cadastro rejeitado e removido.' };
        }
      }
    }
    return { ok: false, erro: 'Registro não encontrado para rejeição.' };
  }

  // Lógica de Aprovação (Criar Promotor)
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    
    const wsPro = ss.getSheetByName('PROMOTORES');
    if (!wsPro) throw new Error('Aba PROMOTORES não encontrada');

    const novoToken = token_override || gerarId_('TK');
    const userId = 'USR_' + new Date().getTime();
    
    // Adiciona na aba PROMOTORES
    const headers = wsPro.getRange(1, 1, 1, wsPro.getLastColumn()).getValues()[0].map(v => String(v).toLowerCase().trim());
    const row = new Array(headers.length).fill('');
    row[headers.indexOf('user_id')] = userId;
    row[headers.indexOf('token')] = novoToken;
    row[headers.indexOf('nome_completo')] = dados.nome_completo;
    row[headers.indexOf('telegram_user_id')] = dados.telegram_user_id;
    row[headers.indexOf('telegram_nome')] = dados.telegram_nome;
    row[headers.indexOf('cidade_base')] = dados.cidade;
    row[headers.indexOf('cargo_principal')] = dados.cargo;
    row[headers.indexOf('tipo_vinculo')] = tipo_vinculo || 'MEI';
    row[headers.indexOf('status')] = 'ATIVO';
    row[headers.indexOf('score_operacional')] = 100;
    row[headers.indexOf('criado_em')] = new Date().toISOString();
    if (cpf && headers.indexOf('cpf') > -1) row[headers.indexOf('cpf')] = cpf;

    wsPro.appendRow(row);

    // REMOVE do pré-cadastro para não aparecer mais como pendente
    if (wsPre) {
      const dataPre = wsPre.getDataRange().getValues();
      for (let r = 1; r < dataPre.length; r++) {
        if (String(dataPre[r][0]).trim() === id) {
          wsPre.deleteRow(r + 1);
          break;
        }
      }
    }

    invalidarCache_();
    return { ok: true, userId, token: novoToken };

  } finally {
    lock.releaseLock();
  }
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
  const performance_equipes = (resRankings.equipes || []).map(eq => ({
    nome: eq.nome,
    pontos: eq.pontos
  }));

  // IA: Insight Rápido (Cache de 1 hora)
  const cache = CacheService.getScriptCache();
  const cachedInsight = cache.get('ai_quick_insight_' + adminUser.user_id);
  let insight_rapido = cachedInsight;

  if (!insight_rapido) {
    const prompt = `Resuma em uma única frase curta e impactante o status atual da operação para este gestor: ${promotores_ativos} ativos, ${solicitacoes_abertas} solicitações.`;
    insight_rapido = callGeminiAI_(prompt, "Você é o assistente de performance JET.");
    if (insight_rapido) cache.put('ai_quick_insight_' + adminUser.user_id, insight_rapido, 3600);
  }

  return{ok:true,data:{promotores_ativos,em_operacao,slots_ocupados,slots_disponiveis,checkins_hoje,solicitacoes_abertas,performance_equipes,insight_rapido}};
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
  const adminUser = _assertGestor_(token);
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const sheet = ss.getSheetByName('ESCALAS_DRAFT');
  if (!sheet) return { ok: true, data: [] };

  const allowedUsers = _getUsersDaHierarquia_(ss, adminUser);
  const data = sheet.getDataRange().getValues();
  const h = data[0].map(v => String(v).toLowerCase().trim());
  const promMap = _getPromotoresMap_(ss);
  const result = [];

  const iEq = h.indexOf('equipe_id'), iUsr = h.indexOf('user_id'), iId = h.indexOf('escala_draft_id');

  for (let r = 1; r < data.length; r++) {
    const id = String(data[r][iId]).trim();
    if (!id) continue;

    const uid = String(data[r][iUsr]).trim();
    if (allowedUsers && !allowedUsers.has(uid)) continue;

    const row = rowToObj_(h, data[r]);
    row.promotor_nome = promMap[uid]?.nome || uid;
    result.push(row);
  }
  return { ok: true, data: result };
}

function criarEscalaDraft_(token, params) {
  const adminUser = _assertGestor_(token);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
    const sheet = ss.getSheetByName('ESCALAS_DRAFT');
    if (!sheet) throw new Error('Aba ESCALAS_DRAFT não encontrada.');

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const h = headers.map(v => String(v).toLowerCase().trim());
    
    const draftId = 'DRAFT_' + new Date().getTime();
    const agora = new Date().toISOString();
    
    const newRow = new Array(headers.length).fill('');
    const sc = (col, val) => { const i = h.indexOf(col); if (i >= 0) newRow[i] = val; };

    sc('escala_draft_id', draftId);
    sc('gestor_id', adminUser.user_id);
    sc('equipe_id', params.equipe_id || '');
    sc('user_id', params.user_id || '');
    sc('cidade', params.cidade || '');
    sc('operacao', params.operacao || 'PROMO');
    sc('cargo_principal', params.cargo_principal || 'PROMOTOR');
    sc('funcao_prevista', params.funcao_prevista || params.cargo_principal || 'PROMOTOR');
    sc('tipo_jornada', params.tipo_jornada || 'SLOT');
    sc('data', params.data || '');
    sc('inicio', params.inicio || '');
    sc('fim', params.fim || '');
    sc('status_draft', 'RASCUNHO');
    sc('observacao', params.observacao || '');
    sc('criado_em', agora);
    sc('atualizado_em', agora);

    sheet.appendRow(newRow);
    return { ok: true, escala_draft_id: draftId };

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
  const adminUser = _assertGestor_(token);
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), ws = ss.getSheetByName('JORNADAS'), data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim()), promMap = _getPromotoresMap_(ss), slotsMap = _getSlotsMap_(ss);
  const allowedUsers = _getUsersDaHierarquia_(ss, adminUser);
  const de = params.de ? new Date(params.de) : new Date(Date.now() - 30*86400000), ate = params.ate ? new Date(params.ate + 'T23:59:59') : new Date(), resultado = [];
  const iUsr = h.indexOf('user_id');
  for (let r = 1; r < data.length; r++) {
    const userId = String(data[r][iUsr]).trim();
    if (allowedUsers && !allowedUsers.has(userId)) continue;

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

/**
 * Envia uma mensagem em massa para promotores filtrados por cidade e/ou cargo.
 */
function broadcastPromotor_(body) {
  const { token, mensagem, cidade, cargo } = body;
  _assertGestor_(token);

  if (!mensagem) return { ok: false, erro: 'Mensagem vazia' };

  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const promWs = ss.getSheetByName('PROMOTORES');
  if (!promWs) return { ok: false, erro: 'Aba PROMOTORES não encontrada' };

  const data = promWs.getDataRange().getValues();
  const h = data[0].map(v => String(v).toLowerCase().trim());
  
  const iTg = h.indexOf('telegram_user_id');
  const iCid = h.findIndex(v => v.includes('cidade'));
  const iCar = h.findIndex(v => v.includes('cargo') || v.includes('função'));
  const iSt = h.findIndex(v => v.includes('status'));

  const integracoes = [];
  let enviados = 0;

  for (let r = 1; r < data.length; r++) {
    const tgId = String(data[r][iTg] || '').trim();
    if (!tgId) continue;

    const status = String(data[r][iSt] || '').toUpperCase();
    if (status === 'INATIVO' || status === 'BLOQUEADO') continue;

    if (cidade && String(data[r][iCid] || '').trim() !== cidade) continue;
    if (cargo && String(data[r][iCar] || '').trim() !== cargo) continue;

    integracoes.push({
      canal: 'telegram',
      tipo: 'private_message',
      telegram_user_id: tgId,
      parse_mode: 'HTML',
      text_html: mensagem
    });
    enviados++;
  }

  if (integracoes.length > 0) {
    processIntegracoes(integracoes, { evento: 'BROADCAST_MANUAL' });
  }

  return { ok: true, enviados };
}

// ============================================================
//  Gestão de Equipes (Hierarquia)
// ============================================================

function getEquipes_(token) {
  const adminUser = _assertGestor_(token);
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  
  const wsEq = ss.getSheetByName('EQUIPE');
  const wsMem = ss.getSheetByName('EQUIPE_MEMBROS');
  
  const equipes = [];
  const membros = [];

  if (wsEq) {
    const dataEq = wsEq.getDataRange().getValues();
    const hEq = dataEq[0].map(v => String(v).toLowerCase().trim());
    for (let r = 1; r < dataEq.length; r++) {
      equipes.push(rowToObj_(hEq, dataEq[r]));
    }
  }

  if (wsMem) {
    const dataMem = wsMem.getDataRange().getValues();
    const hMem = dataMem[0].map(v => String(v).toLowerCase().trim());
    for (let r = 1; r < dataMem.length; r++) {
      membros.push(rowToObj_(hMem, dataMem[r]));
    }
  }

  return { ok: true, equipes, membros };
}

function getPromotoresLista_(token) {
  const adminUser = _assertGestor_(token);
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const promMap = _getPromotoresMap_(ss);
  
  const lista = Object.values(promMap).map(p => ({
    user_id: p.user_id,
    nome: p.nome,
    cidade: p.cidade_base || p.cidade || ''
  }));
  
  return { ok: true, lista };
}

function salvarEquipe_(token, body) {
  const adminUser = _assertGestor_(token);
  // Apenas Gestor ou Regional pode criar equipe, LIDER não deveria poder.
  if ((adminUser.tipo_vinculo || '').toUpperCase() === 'LIDER') {
    return { ok: false, erro: 'Líder não pode criar ou editar equipes.' };
  }

  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  let wsEq = ss.getSheetByName('EQUIPE');
  let wsMem = ss.getSheetByName('EQUIPE_MEMBROS');

  if (!wsEq || !wsMem) return { ok: false, erro: 'Abas de equipe não configuradas no sistema.' };

  const agora = new Date().toISOString();
  let equipeId = body.equipe_id;

  const dataEq = wsEq.getDataRange().getValues();
  const hEq = dataEq[0].map(v => String(v).toLowerCase().trim());
  const iId = hEq.indexOf('equipe_id');

  if (equipeId) {
    // Editar
    for (let r = 1; r < dataEq.length; r++) {
      if (String(dataEq[r][iId]).trim() === equipeId) {
        if (hEq.indexOf('gestor_id') > -1) wsEq.getRange(r+1, hEq.indexOf('gestor_id')+1).setValue(body.gestor_id || '');
        if (hEq.indexOf('regional_id') > -1) wsEq.getRange(r+1, hEq.indexOf('regional_id')+1).setValue(body.regional_id || '');
        if (hEq.indexOf('cidade') > -1) wsEq.getRange(r+1, hEq.indexOf('cidade')+1).setValue(body.cidade || '');
        if (hEq.indexOf('operacao') > -1) wsEq.getRange(r+1, hEq.indexOf('operacao')+1).setValue(body.operacao || '');
        if (hEq.indexOf('nome_equipe') > -1) wsEq.getRange(r+1, hEq.indexOf('nome_equipe')+1).setValue(body.nome_equipe || '');
        if (hEq.indexOf('ativo') > -1) wsEq.getRange(r+1, hEq.indexOf('ativo')+1).setValue(body.ativo !== false ? 'TRUE' : 'FALSE');
        break;
      }
    }
  } else {
    // Nova equipe
    equipeId = gerarId_('EQP');
    const newRow = hEq.map(col => {
      if (col === 'equipe_id') return equipeId;
      if (col === 'gestor_id') return body.gestor_id || adminUser.user_id;
      if (col === 'regional_id') return body.regional_id || '';
      if (col === 'cidade') return body.cidade || '';
      if (col === 'operacao') return body.operacao || '';
      if (col === 'nome_equipe') return body.nome_equipe || '';
      if (col === 'ativo') return 'TRUE';
      if (col === 'criado_em') return agora;
      return '';
    });
    wsEq.appendRow(newRow);
  }

  // Atualizar membros
  if (Array.isArray(body.membros)) {
    const dataMem = wsMem.getDataRange().getValues();
    const hMem = dataMem[0].map(v => String(v).toLowerCase().trim());
    const mEqId = hMem.indexOf('equipe_id');
    const mUsrId = hMem.indexOf('user_id');

    // Desativar ou remover antigos
    for (let r = 1; r < dataMem.length; r++) {
      if (String(dataMem[r][mEqId]).trim() === equipeId) {
        // Para simplificar, exclui ou marca inativo
        const idxAtivo = hMem.indexOf('ativo');
        if (idxAtivo > -1) wsMem.getRange(r+1, idxAtivo+1).setValue('FALSE');
      }
    }

    // Adicionar novos
    body.membros.forEach(m => {
      const newRow = hMem.map(col => {
        if (col === 'equipe_id') return equipeId;
        if (col === 'user_id') return m.user_id;
        if (col === 'papel_na_equipe') return m.papel_na_equipe || 'PROMOTOR';
        if (col === 'ativo') return 'TRUE';
        if (col === 'adicionado_em') return agora;
        return '';
      });
      wsMem.appendRow(newRow);
    });
  }

  return { ok: true, equipe_id: equipeId };
}

function getRelatorioExport_(token, params) {
  const adminUser = _assertGestor_(token);
  const { tipo, de, ate, periodo } = params;
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  
  let csv = "";
  
  if (tipo === 'JORNADAS') {
    const ws = ss.getSheetByName('JORNADAS');
    const data = ws.getDataRange().getValues();
    const h = data[0];
    const filtered = [h];
    const iCri = h.map(v => String(v).toLowerCase()).indexOf('criado_em');
    const start = de ? new Date(de) : new Date(0);
    const end = ate ? new Date(ate + 'T23:59:59') : new Date();

    for (let r=1; r<data.length; r++) {
      const dt = new Date(data[r][iCri]);
      if (dt >= start && dt <= end) filtered.push(data[r]);
    }
    csv = _arrayToCSV(filtered);
  } 
  else if (tipo === 'SCORE') {
    const res = getRankings_(null, periodo || 'GERAL');
    const rows = [["Posicao", "User ID", "Nome", "Pontos", "Cidade"]];
    (res.nacional || []).forEach(p => rows.push([p.posicao, p.user_id, p.nome, p.pontos, p.cidade]));
    csv = _arrayToCSV(rows);
  }
  else if (tipo === 'FRAUDES') {
    const ws = ss.getSheetByName('JORNADAS');
    const data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim());
    const iScore = h.indexOf('location_trust_score'), iUsr = h.indexOf('user_id'), iCri = h.indexOf('criado_em'), iDev = h.indexOf('device_id');
    const rows = [["Data", "User ID", "Score Confianca", "Device ID"]];
    for (let r=1; r<data.length; r++) {
      if (parseFloat(data[r][iScore]) < 60) {
        rows.push([data[r][iCri], data[r][iUsr], data[r][iScore], data[r][iDev]]);
      }
    }
    csv = _arrayToCSV(rows);
  }

  return { ok: true, csv };
}

function _arrayToCSV(arr) {
  return arr.map(row => row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join("\n");
}

// ─── Mural de Avisos ──────────────────────────────────────────

function getMuralAvisos_(user) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws = ss.getSheetByName('MURAL_AVISOS');
  if (!ws) return { ok: true, avisos: [] };

  const data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim());
  const agora = new Date();
  const avisos = [];

  // Mapear equipe do usuário
  const userEquipes = [];
  const wsMem = ss.getSheetByName('EQUIPE_MEMBROS');
  if (wsMem) {
    const dMem = wsMem.getDataRange().getValues(), hMem = dMem[0].map(v => String(v).toLowerCase().trim());
    for(let r=1; r<dMem.length; r++) {
      if (String(dMem[r][hMem.indexOf('user_id')]).trim() === user.user_id && String(dMem[r][hMem.indexOf('ativo')]).toUpperCase() === 'TRUE') {
        userEquipes.push(String(dMem[r][hMem.indexOf('equipe_id')]).trim());
      }
    }
  }

  const iEq = h.indexOf('equipe_id'), iExp = h.indexOf('expira_em');

  for (let r = 1; r < data.length; r++) {
    const eqId = String(data[r][iEq]).trim();
    const exp = data[r][iExp] ? new Date(data[r][iExp]) : null;

    if (exp && exp < agora) continue; // Expirado
    if (eqId !== '*' && !userEquipes.includes(eqId)) continue; // Não é pra equipe dele

    avisos.push(rowToObj_(h, data[r]));
  }

  return { ok: true, avisos };
}

function salvarAviso_(token, body) {
  const adminUser = _assertGestor_(token);
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  let ws = ss.getSheetByName('MURAL_AVISOS');
  if (!ws) {
    ws = ss.insertSheet('MURAL_AVISOS');
    ws.appendRow(['aviso_id', 'equipe_id', 'titulo', 'mensagem', 'criticidade', 'criado_em', 'expira_em']);
  }

  const avisoId = gerarId_('AVS');
  const agora = new Date().toISOString();
  
  ws.appendRow([
    avisoId,
    body.equipe_id || '*',
    body.titulo || 'Aviso Operacional',
    body.mensagem || '',
    body.criticidade || 'INFO',
    agora,
    body.expira_em || ''
  ]);

  return { ok: true, aviso_id: avisoId };
}

function getIAInsights_(token) {
  const adminUser = _assertGestor_(token);
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const allowedUsers = _getUsersDaHierarquia_(ss, adminUser);
  
  // 1. Coletar dados do dia (já respeita a hierarquia internamente)
  const kpiRes = getKpisDia_(token);
  const kpis = kpiRes.data || {};
  
  // 2. Coletar ocorrências abertas filtradas pela hierarquia
  const wsSol = ss.getSheetByName('SOLICITACOES_OPERACIONAIS');
  let ocorrenciasResumo = "";
  if (wsSol) {
    const sData = wsSol.getDataRange().getValues(), sh = sData[0].map(v => String(v).toLowerCase().trim());
    const iStt = sh.indexOf('status'), iDesc = sh.indexOf('descricao'), iCri = sh.indexOf('criado_em'), iUsr = sh.indexOf('user_id');
    const hoje = new Date().toISOString().substring(0, 10);
    
    let count = 0;
    for (let r = 1; r < sData.length; r++) {
      const uId = String(sData[r][iUsr]).trim();
      if (allowedUsers && !allowedUsers.has(uId)) continue; // Filtro de Hierarquia

      if (String(sData[r][iCri]).substring(0, 10) === hoje) {
        count++;
        ocorrenciasResumo += `- ${sData[r][iDesc]} (Status: ${sData[r][iStt]})\n`;
      }
      if (count > 15) break; 
    }
  }

  const prompt = `Gere um resumo executivo da operação de hoje:
  - Promotores Ativos: ${kpis.promotores_ativos || 0}
  - Em Operação: ${kpis.em_operacao || 0}
  - Slots Vagos: ${kpis.slots_disponiveis || 0}
  - Solicitações Abertas: ${kpis.solicitacoes_abertas || 0}
  
  Ocorrências Recentes:
  ${ocorrenciasResumo || "Nenhuma ocorrência grave registrada até o momento."}
  
  Dê 3 recomendações acionáveis para o gestor regional focar nas próximas horas. Seja curto e profissional.`;

  const insight = callGeminiAI_(prompt, "Você é o Analista de Operações Sênior da JET.");

  return { ok: true, insight: insight || "Não foi possível gerar insights no momento. Verifique a chave de API." };
}

/**
 * IA: Predição de Churn (Risco de Saída)
 * Analisa o comportamento do promotor e gera um alerta se houver risco de desengajamento.
 */
function getChurnPrediction_(token, params) {
  const adminUser = _assertGestor_(token);
  const userId = params.user_id;
  if (!userId) return { ok: false, erro: 'user_id obrigatório.' };

  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const promMap = _getPromotoresMap_(ss);
  const prom = promMap[userId];
  if (!prom) return { ok: false, erro: 'Promotor não encontrado.' };

  const agora = new Date();
  const trintaDiasAtras = new Date(agora.getTime() - 30 * 86400000);

  // 1. Coletar Histórico de Jornadas (Frequência e Padrão)
  const wsJ = ss.getSheetByName('JORNADAS');
  const jornadas = [];
  let diasFDS = 0, diasUteis = 0;
  if (wsJ) {
    const dataJ = wsJ.getDataRange().getValues(), hJ = dataJ[0].map(v => String(v).toLowerCase().trim());
    const iUsr = hJ.indexOf('user_id'), iDt = hJ.indexOf('data'), iStt = hJ.indexOf('status');
    for (let r = 1; r < dataJ.length; r++) {
      if (String(dataJ[r][iUsr]).trim() === userId) {
        const dt = new Date(dataJ[r][iDt]);
        if (dt >= trintaDiasAtras) {
          const status = String(dataJ[r][iStt]).toUpperCase();
          if (status === 'ENCERRADO' || status === 'EM_ATIVIDADE') {
            const diaSemana = dt.getDay(); // 0=dom, 6=sab
            if (diaSemana === 0 || diaSemana === 6) diasFDS++; else diasUteis++;
            jornadas.push({ data: dt, status });
          }
        }
      }
    }
  }

  // 2. Coletar Engajamento com Pílulas e Tendência de Score
  const wsScore = ss.getSheetByName('SCORE_HISTORICO');
  let pilulasCompletas = 0;
  let scoreSemana1 = 0, scoreSemana4 = 0; // Semana 1 (mais antiga) vs Semana 4 (mais recente)
  if (wsScore) {
    const dataS = wsScore.getDataRange().getValues(), hS = dataS[0].map(v => String(v).toLowerCase().trim());
    const iUsr = hS.indexOf('user_id'), iTipo = hS.indexOf('tipo'), iPts = hS.indexOf('pontos'), iDt = hS.indexOf('criado_em');
    
    const sem1 = new Date(agora.getTime() - 30 * 86400000);
    const sem2 = new Date(agora.getTime() - 21 * 86400000);
    const sem3 = new Date(agora.getTime() - 14 * 86400000);
    const sem4 = new Date(agora.getTime() - 7 * 86400000);

    for (let r = 1; r < dataS.length; r++) {
      if (String(dataS[r][iUsr]).trim() === userId) {
        const dt = new Date(dataS[r][iDt]);
        const tipo = String(dataS[r][iTipo]).toUpperCase();
        const pts = parseFloat(dataS[r][iPts] || '0');

        if (dt >= trintaDiasAtras) {
          if (tipo === 'PILULA_DIARIA') pilulasCompletas++;
          if (dt >= sem1 && dt < sem2) scoreSemana1 += pts;
          if (dt >= sem4) scoreSemana4 += pts;
        }
      }
    }
  }

  const prompt = `Analise o risco de Churn (desistência) do promotor ${prom.nome}:
  - Perfil de Atuação: ${diasUteis > diasFDS ? 'Atua mais em dias úteis' : 'Atua mais em finais de semana'}
  - Dias trabalhados nos últimos 30 dias: ${diasUteis} úteis, ${diasFDS} finais de semana.
  - Engajamento com Pílulas Diárias: Respondeu ${pilulasCompletas} vezes nos últimos 30 dias (máximo possível: 22).
  - Tendência de Score: Ganhou ${scoreSemana1} pts na primeira semana do mês vs ${scoreSemana4} pts na última semana.
  
  Considere que alguns promotores são focados apenas em FDS, então baixa atuação em dias úteis nem sempre é churn.
  Dê um "Risco de Churn" de 0 a 100% e uma breve recomendação para o Líder da Equipe.`;

  const prediction = callGeminiAI_(prompt, "Você é um Especialista em Retenção de Talentos e Psicologia Organizacional.");

  return { 
    ok: true, 
    userId, 
    nome: prom.nome, 
    stats: { diasUteis, diasFDS, pilulasCompletas, tendencia: scoreSemana4 - scoreSemana1 },
    prediction: prediction || "Análise indisponível no momento." 
  };
}

function getTeamChurnSummary_(token) {
  const adminUser = _assertGestor_(token);
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const allowedUsers = _getUsersDaHierarquia_(ss, adminUser);
  if (!allowedUsers) return { ok: false, erro: 'Acesso negado ou hierarquia não encontrada.' };

  const promMap = _getPromotoresMap_(ss);
  const agora = new Date();
  const trintaDiasAtras = new Date(agora.getTime() - 30 * 86400000);
  const seteDiasAtras = new Date(agora.getTime() - 7 * 86400000);

  // 1. Mapear Jornadas
  const wsJ = ss.getSheetByName('JORNADAS');
  const userStats = {};
  allowedUsers.forEach(uId => { userStats[uId] = { diasUteis: 0, diasFDS: 0, scoreSemana1: 0, scoreSemana4: 0, pilulas: 0, nome: promMap[uId]?.nome || uId }; });

  if (wsJ) {
    const dataJ = wsJ.getDataRange().getValues(), hJ = dataJ[0].map(v => String(v).toLowerCase().trim());
    const iUsr = hJ.indexOf('user_id'), iDt = hJ.indexOf('data'), iStt = hJ.indexOf('status');
    for (let r = 1; r < dataJ.length; r++) {
      const uId = String(dataJ[r][iUsr]).trim();
      if (!allowedUsers.has(uId)) continue;
      const dt = new Date(dataJ[r][iDt]);
      if (dt < trintaDiasAtras) continue;
      
      const stt = String(dataJ[r][iStt]).toUpperCase();
      if (stt === 'ENCERRADO' || stt === 'EM_ATIVIDADE') {
        const dSemana = dt.getDay();
        if (dSemana === 0 || dSemana === 6) userStats[uId].diasFDS++; else userStats[uId].diasUteis++;
      }
    }
  }

  // 2. Mapear Score e Pílulas
  const wsS = ss.getSheetByName('SCORE_HISTORICO');
  if (wsS) {
    const dataS = wsS.getDataRange().getValues(), hS = dataS[0].map(v => String(v).toLowerCase().trim());
    const iUsr = hS.indexOf('user_id'), iTipo = hS.indexOf('tipo'), iPts = hS.indexOf('pontos'), iDt = hS.indexOf('criado_em');
    
    const sem1Start = new Date(agora.getTime() - 30 * 86400000);
    const sem1End = new Date(agora.getTime() - 21 * 86400000);

    for (let r = 1; r < dataS.length; r++) {
      const uId = String(dataS[r][iUsr]).trim();
      if (!allowedUsers.has(uId)) continue;
      const dt = new Date(dataS[r][iDt]);
      if (dt < trintaDiasAtras) continue;

      const pts = parseFloat(dataS[r][iPts] || '0');
      const tipo = String(dataS[r][iTipo]).toUpperCase();

      if (tipo === 'PILULA_DIARIA') userStats[uId].pilulas++;
      if (dt >= sem1Start && dt < sem1End) userStats[uId].scoreSemana1 += pts;
      if (dt >= seteDiasAtras) userStats[uId].scoreSemana4 += pts;
    }
  }

  const rankingRisco = Object.values(userStats).map(u => {
    // Cálculo simplificado de Risco (0-100)
    let ptsRisco = 0;
    if (u.pilulas < 5) ptsRisco += 30; // Baixo engajamento acadêmico
    if (u.scoreSemana4 < u.scoreSemana1) ptsRisco += 40; // Queda de performance
    if (u.diasUteis + u.diasFDS < 2) ptsRisco += 30; // Quase inativo

    return {
      ...u,
      deltaScore: u.scoreSemana4 - u.scoreSemana1,
      nivelRisco: ptsRisco
    };
  }).sort((a, b) => b.nivelRisco - a.nivelRisco);

  return { ok: true, resumo: rankingRisco.slice(0, 10) };
}