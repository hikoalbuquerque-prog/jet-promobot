// ─── 08.EscalaCLT.gs ──────────────────────────────────────────────────────────
// Motor de escala CLT — completo, consolidado e otimizado (Fase 8)

function _getPerfilCLTMap_(ss) {
  var ws=ss.getSheetByName('PERFIL_CLT'); if(!ws) return {};
  var data=ws.getDataRange().getValues(), h=data[0].map(v => String(v).toLowerCase().trim());
  var map={};
  for(var r=1;r<data.length;r++){
    var uid=String(data[r][h.indexOf('user_id')]).trim();
    if(!uid||String(data[r][h.indexOf('ativo')]).trim()!=='SIM') continue;
    map[uid] = {
      perfil_id: data[r][h.indexOf('perfil_id')],
      user_id: uid, nome_completo: data[r][h.indexOf('nome_completo')],
      cargo_clt: String(data[r][h.indexOf('cargo_clt')]).trim(),
      zona_nome: data[r][h.indexOf('zona_nome')] || '',
      zona_lat: parseFloat(data[r][h.indexOf('zona_lat_centro')]) || 0,
      zona_lng: parseFloat(data[r][h.indexOf('zona_lng_centro')]) || 0,
      zona_raio_km: parseFloat(data[r][h.indexOf('zona_raio_km')]) || 5,
      zona_poligono: _safeJsonCLT_(data[r][h.indexOf('zona_poligono_json')], null),
      horas_semanais: parseFloat(data[r][h.indexOf('horas_semanais_contrato')]) || 44,
      turno_padrao: String(data[r][h.indexOf('turno_padrao')] || 'FLEXIVEL').trim(),
      folga_semanal_dia: parseInt(data[r][h.indexOf('folga_semanal_dia')]),
      folga_movel_regra: String(data[r][h.indexOf('folga_movel_regra')] || 'NENHUMA').trim()
    };
  }
  return map;
}

function _getRegrasMap_(ss) {
  var ws=ss.getSheetByName('REGRAS_FOLGA'); if(!ws) return {};
  var data=ws.getDataRange().getValues(), h=data[0].map(v => String(v).toLowerCase().trim()), map={};
  for(var r=1;r<data.length;r++){
    if(String(data[r][h.indexOf('ativo')]).trim()!=='SIM') continue;
    var cargo=String(data[r][h.indexOf('cargo_clt')]).trim();
    if(!map[cargo]) map[cargo]=[];
    map[cargo].push({tipo:String(data[r][h.indexOf('tipo_regra')]).trim(),dia_semana:parseInt(data[r][h.indexOf('dia_semana')]),n_ocorrencia:parseInt(data[r][h.indexOf('n_ocorrencia_mes')])||0,ciclo_trabalho:parseInt(data[r][h.indexOf('ciclo_trabalho')])||0,ciclo_folga:parseInt(data[r][h.indexOf('ciclo_folga')])||0});
  }
  return map;
}

function _getTurnosDaData_(ss,data_iso) {
  var ws=ss.getSheetByName('TURNOS_CLT'); if(!ws) return [];
  var rows=ws.getDataRange().getValues(), h=rows[0].map(v => String(v).toLowerCase().trim()), result=[];
  for(var r=1;r<rows.length;r++){
    if(String(rows[r][h.indexOf('data')]).substring(0,10)!==data_iso) continue;
    result.push({user_id:String(rows[r][h.indexOf('user_id')]).trim(),inicio:rows[r][h.indexOf('inicio')],fim:rows[r][h.indexOf('fim')],status:String(rows[r][h.indexOf('status')]).trim()});
  }
  return result;
}

function _safeJsonCLT_(str,def){try{return JSON.parse(str);}catch(_){return def;}}
function _haversineKmCLT_(lat1,lng1,lat2,lng2){var R=6371,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180,a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
function _horaParaMinutosCLT_(hora){if(!hora)return 0;var s=String(hora);if(s.indexOf('T')>-1||s.indexOf('1899')>-1){try{var d=new Date(s);return d.getHours()*60+d.getMinutes();}catch(_){return 0;}}var p=s.substring(0,5).split(':');return parseInt(p[0])*60+(parseInt(p[1])||0);}
function _calcHorasTurnoCLT_(inicio,fim){var i=_horaParaMinutosCLT_(inicio),f=_horaParaMinutosCLT_(fim);if(f<i)f+=1440;return(f-i)/60;}
function _semanaInicioCLT_(data_iso){var d=new Date(data_iso+'T12:00:00'),dia=d.getDay(),diff=dia===0?-6:1-dia;d.setDate(d.getDate()+diff);return d.toISOString().substring(0,10);}

function _isFolgaCLT_(perfil, regras, data_iso, folgasMap) {
  var d = new Date(data_iso + 'T12:00:00'), diaSemana = d.getDay();
  if (folgasMap && folgasMap[perfil.user_id]) return { folga: true, motivo: folgasMap[perfil.user_id] };
  if (!isNaN(perfil.folga_semanal_dia) && diaSemana === perfil.folga_semanal_dia) return { folga: true, motivo: 'Folga semanal fixa' };
  var regrasC = regras[perfil.cargo_clt] || [];
  for (var i = 0; i < regrasC.length; i++) {
    var r = regrasC[i];
    if (r.tipo === 'FIXO_SEMANAL' && diaSemana === r.dia_semana) return { folga: true, motivo: 'Folga semanal por cargo' };
    if (r.tipo === 'CICLO_DIAS' && r.ciclo_trabalho > 0) {
      var epoch = Math.floor(new Date(data_iso).getTime() / 86400000), ciclo = r.ciclo_trabalho + r.ciclo_folga;
      if (ciclo > 0 && (epoch % ciclo) >= r.ciclo_trabalho) return { folga: true, motivo: 'Folga por ciclo' };
    }
  }
  return { folga: false, motivo: '' };
}

function confirmarTurnoCLT_(user, params) {
  const turnoId = String(params.turno_id || '').trim();
  const resposta = String(params.resposta || 'CONFIRMADO').toUpperCase();
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws = ss.getSheetByName('TURNOS_CLT');
  if (!ws) throw new Error('Aba TURNOS_CLT não encontrada.');

  const data = ws.getDataRange().getValues();
  const h = data[0].map(v => String(v).toLowerCase().trim());
  const iTid = h.indexOf('turno_id'), iUid = h.indexOf('user_id'), iStt = h.indexOf('status');

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iTid]).trim() === turnoId && String(data[r][iUid]).trim() === user.user_id) {
      ws.getRange(r + 1, iStt + 1).setValue(resposta);
      registrarAuditoria_({
        tabela: 'TURNOS_CLT',
        registro_id: turnoId,
        campo: 'status',
        valor_anterior: data[r][iStt],
        valor_novo: resposta,
        alterado_por: user.user_id,
        origem: 'app_clt'
      });
      return { ok: true, mensagem: 'Presença confirmada!', status: resposta };
    }
  }
  throw new Error('Turno não encontrado.');
}

function _formatDataISO_(val) {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().substring(0, 10);
  const s = String(val).trim();
  if (s.indexOf('T') > -1) return s.substring(0, 10);
  return s; // Assume yyyy-mm-dd
}

function getMeusTurnosCLT_(user){
  var ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), ws=ss.getSheetByName('TURNOS_CLT'); if(!ws) return{ok:true,data:[]};
  var rows=ws.getDataRange().getValues(), h=rows[0].map(v => String(v).toLowerCase().trim()), hoje=new Date(); hoje.setHours(0,0,0,0);
  var limite=new Date(hoje); limite.setDate(limite.getDate()+14), result=[];
  const metas = _getProgressoMetasFiscal_(ss, user.user_id);
  
  const iUid = h.indexOf('user_id'), iStt = h.indexOf('status'), iDt = h.indexOf('data');
  const iTid = h.indexOf('turno_id'), iIni = h.indexOf('inicio'), iFim = h.indexOf('fim');

  for(var r=1;r<rows.length;r++){
    if(String(rows[r][iUid]).trim()!==user.user_id) continue;
    var stt=String(rows[r][iStt]).trim(); if(stt==='CANCELADO'||stt==='FALTA') continue;
    
    var dataStr = _formatDataISO_(rows[r][iDt]);
    if (!dataStr) continue;
    
    var dataD = new Date(dataStr+'T12:00:00'); 
    if(dataD < hoje || dataD > limite) continue;
    
    result.push({
      turno_id: rows[r][iTid], 
      data: dataStr, 
      inicio: rows[r][iIni], 
      fim: rows[r][iFim], 
      status: stt, 
      zona_nome: rows[r][h.indexOf('zona_nome')] || '', 
      zona_lat: parseFloat(rows[r][h.indexOf('zona_lat')]) || 0, 
      zona_lng: parseFloat(rows[r][h.indexOf('zona_lng')]) || 0, 
      ponto_referencia:rows[r][h.indexOf('ponto_referencia')] || '', 
      horas_turno: rows[r][h.indexOf('horas_turno')] || '', 
      checkin_hora: rows[r][h.indexOf('checkin_hora')] ? String(rows[r][h.indexOf('checkin_hora')]) : null, 
      checkout_hora: rows[r][h.indexOf('checkout_hora')]? String(rows[r][h.indexOf('checkout_hora')]): null
    });
  }
  result.sort((a,b) => a.data>b.data?1:-1);
  return{ok:true, data:result, metas_atuais: metas};
}

function checkinTurnoCLT_(user,params){
  var turno_id=String(params.turno_id||'').trim(), ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), ws=ss.getSheetByName('TURNOS_CLT'); if(!ws) throw new Error('Aba TURNOS_CLT nao encontrada.');
  var rows=ws.getDataRange().getValues(), h=rows[0].map(v => String(v).toLowerCase().trim());
  
  const iTid = h.indexOf('turno_id'), iUid = h.indexOf('user_id'), iStt = h.indexOf('status');

  for(var r=1;r<rows.length;r++){
    if(String(rows[r][iTid]).trim()!==turno_id) continue;
    if(String(rows[r][iUid]).trim()!==user.user_id) throw new Error('Turno nao pertence a este usuario.');
    
    var stt=String(rows[r][iStt]).trim(); 
    if(stt==='EM_ANDAMENTO') return{ok:true,mensagem:'Checkin ja realizado.', eh_clt: true};
    
    // Validação de Foto / Bypass via Gestor
    if (params.foto_base64 === 'LOGADO_VIA_GESTOR_BYPASS') {
      // Aceita sem validar IA pois vem do painel administrativo
    } else if (params.foto_base64) {
      const validacaoIA = callGeminiVisionAI_(params.foto_base64, "Analise esta foto de um fiscal da JET iniciando o turno. Verifique se é uma foto real de uma pessoa, preferencialmente uniformizada. Responda APENAS 'APROVADO' ou 'REPROVADO'.");
      if (validacaoIA && validacaoIA.toUpperCase().indexOf('REPROVADO') > -1) throw new Error('⛔ Foto de check-in reprovada pela IA. Certifique-se de estar uniformizado.');
    } else { 
      throw new Error('Foto de check-in obrigatória para Fiscais.'); 
    }
    
    var agora=new Date().toISOString(); 
    ws.getRange(r+1,iStt+1).setValue('EM_ANDAMENTO'); 
    ws.getRange(r+1,h.indexOf('checkin_hora')+1).setValue(agora);
    
    registrarAuditoria_({tabela:'TURNOS_CLT',registro_id:turno_id,campo:'status',valor_anterior:stt,valor_novo:'EM_ANDAMENTO',alterado_por:user.user_id,origem:'app_clt'});
    
    return {
      ok:true,
      turno_id:turno_id,
      checkin_hora:agora,
      mensagem:'Check-in registrado.',
      eh_clt: true // Garante que o App mantenha o modo Fiscal
    };
  }
  throw new Error('Turno ID "'+turno_id+'" nao encontrado para check-in.');
}

function checkoutTurnoCLT_(user,params){
  var turno_id=params.turno_id||'', ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), ws=ss.getSheetByName('TURNOS_CLT'); if(!ws) throw new Error('Aba TURNOS_CLT nao encontrada.');
  var rows=ws.getDataRange().getValues(), h=rows[0].map(v => String(v).toLowerCase().trim());
  for(var r=1;r<rows.length;r++){
    if(String(rows[r][h.indexOf('turno_id')]).trim()!==turno_id) continue;
    if(String(rows[r][h.indexOf('user_id')]).trim()!==user.user_id) throw new Error('Turno nao pertence a este usuario.');
    var agora=new Date().toISOString(), checkinHora=rows[r][h.indexOf('checkin_hora')], duracaoReal=checkinHora?Math.round((new Date(agora)-new Date(checkinHora))/36000)/100:0;
    const cache = CacheService.getScriptCache(), ociosidadeKey = `ociosidade_fiscal_${user.user_id}`, logOciosidade = JSON.parse(cache.get(ociosidadeKey) || '{"promotor_id":null, "minutos":0}'), tempoIneficiente = logOciosidade.minutos || 0;
    const metas = _getProgressoMetasFiscal_(ss, user.user_id);
    ws.getRange(r+1,h.indexOf('status')+1).setValue('ENCERRADO'); ws.getRange(r+1,h.indexOf('checkout_hora')+1).setValue(agora);
    if(h.indexOf('duracao_real_horas')>-1) ws.getRange(r+1,h.indexOf('duracao_real_horas')+1).setValue(duracaoReal);
    var dataStr=String(rows[r][h.indexOf('data')]).substring(0,10), perfilMap=_getPerfilCLTMap_(ss), perfil=perfilMap[user.user_id];
    if(perfil) _atualizarRealizadasBancoHoras_(ss,user.user_id,dataStr,duracaoReal);
    registrarAuditoria_({tabela:'TURNOS_CLT', registro_id:turno_id, campo:'status', valor_anterior:'EM_ANDAMENTO', valor_novo:'ENCERRADO', alterado_por:user.user_id, origem:'app_clt', motivo_override: `Metas: ${metas.hoje}/15, ${metas.semana}/100 | Ocioso: ${tempoIneficiente}min`});
    let msgCoach = ""; try { msgCoach = callGeminiAI_(`Fiscal ${user.nome_completo}. Meta hoje: ${metas.hoje}/15. Meta semana: ${metas.semana}/100. Ocioso: ${tempoIneficiente}min. Se abaixo da meta, recomende FORTEMENTE refazer o módulo FIS-01 no Academy.`, "Supervisor JET."); } catch(e) { msgCoach = "Bom descanso! Meta semanal: "+metas.semana+"/100."; }
    var integracoesCho=[{canal:'telegram', tipo:'group_message', cidade:perfil.cidade_base||'', topic_key:'ENCERRAMENTOS', parse_mode:'HTML', text_html:`🔴 <b>Checkout CLT (FISCAL)</b>\n\n👤 <b>${user.nome_completo}</b>\n📸 Metas: <b>${metas.hoje}/15 (dia) | ${metas.semana}/100 (sem)</b>\n⚠️ Ociosidade: <b>${tempoIneficiente} min</b>\n\n🤖 <b>Coach JET:</b>\n<i>"${msgCoach}"</i>`}];
    if (tempoIneficiente > 20 || metas.hoje < 10) integracoesCho.push({canal: 'telegram', tipo: 'group_message', cidade: perfil.cidade_base||'', topic_key: 'GESTAO_FISCAL', parse_mode: 'HTML', text_html: `🚨 <b>ALERTA PRODUTIVIDADE</b>\n\n👤 Fiscal: <b>${user.nome_completo}</b>\n⚠️ Registros hoje: <b>${metas.hoje}</b> (mín 15)\n⚠️ Ociosidade: <b>${tempoIneficiente} min</b>.`});
    cache.remove(ociosidadeKey); return{ok:true, turno_id:turno_id, checkout_hora:agora, mensagem:'Checkout registrado.', integracoes:integracoesCho};
  }
  throw new Error('Turno nao encontrado.');
}

function heartbeatCLT_(user, params) {
  var turno_id = params.turno_id || '', lat = parseFloat(params.lat || 0), lng = parseFloat(params.lng || 0), acc = parseFloat(params.accuracy || 999), mock = !!params.is_mock, agora = new Date().toISOString(), ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  _monitorarOciosidadePromotor_(ss, user, lat, lng);
  if (mock) processIntegracoes([{canal: 'telegram', tipo: 'group_message', cidade: user.cidade_base || '', topic_key: 'GESTAO_FISCAL', parse_mode: 'HTML', text_html: `🚨 <b>ALERTA SEGURANÇA: GPS MOCK</b>\n\n👤 Fiscal: <b>${user.nome_completo}</b>\n⚠️ O sistema detectou simulador de GPS.`}], { evento: 'ALERTA_FAKE_GPS_GESTAO' });
  var ws = ss.getSheetByName('LOCALIZACAO_TEMPO_REAL'); if (ws && lat && lng) ws.appendRow([gerarId_('LOC'), user.user_id, turno_id, lat, lng, acc, mock, (params.trust_score || 100), false, agora, agora, '', '']);
  return { ok: true };
}

function _monitorarOciosidadePromotor_(ss, user, lat, lng) {
  const cache = CacheService.getScriptCache(), ociosidadeKey = `ociosidade_fiscal_${user.user_id}`, slotsMap = _getSlotsMap_(ss); let slotIdPerto = null, promotorIdPerto = null, nomePromotor = "";
  const wsJ = ss.getSheetByName('JORNADAS'), dataJ = wsJ.getDataRange().getValues(), hJ = dataJ[0].map(v => String(v).toLowerCase().trim());
  for (const sid in slotsMap) {
    const s = slotsMap[sid]; if (!s.lat || !s.lng) continue;
    if (_haversineKmCLT_(lat, lng, s.lat, s.lng) * 1000 <= 150) { 
      slotIdPerto = sid;
      for (let j = 1; j < dataJ.length; j++) { if (dataJ[j][hJ.indexOf('slot_id')] === sid && dataJ[j][hJ.indexOf('status')] === 'EM_ANDAMENTO') { promotorIdPerto = dataJ[j][hJ.indexOf('user_id')]; nomePromotor = dataJ[j][hJ.indexOf('nome_completo')] || promotorIdPerto; break; } }
      if (slotIdPerto) break;
    }
  }
  if (slotIdPerto && promotorIdPerto) {
    let log = JSON.parse(cache.get(ociosidadeKey) || '{"promotor_id":null, "minutos":0}');
    if (log.promotor_id === promotorIdPerto) log.minutos += 3; else log = { promotor_id: promotorIdPerto, nome: nomePromotor, minutos: 3 };
    cache.put(ociosidadeKey, JSON.stringify(log), 3600);
    if (log.minutos === 12) {
      registrarAuditoria_({tabela: 'GESTAO_FISCAL', registro_id: user.user_id, campo: 'OCIOSIDADE_COM_PROMOTOR', valor_anterior: 'ATIVO_NA_RUA', valor_novo: `PARADO_COM_${nomePromotor}`, alterado_por: 'SISTEMA_IA', origem: 'monitoramento_ociosidade'});
      processIntegracoes([{canal: 'telegram', tipo: 'group_message', cidade: user.cidade_base || '', topic_key: 'GESTAO_FISCAL', parse_mode: 'HTML', text_html: `⚠️ <b>AUDITORIA: FISCAL PARADO</b>\n\n👤 Fiscal: <b>${user.nome_completo}</b>\n📍 Local: Com promotor <b>${nomePromotor}</b>\n⏱️ Tempo: <b>12 minutos</b> acumulados.`}], { evento: 'ALERTA_OCIOSIDADE_FISCAL' });
    }
  } else cache.remove(ociosidadeKey);
}

function registrarOcorrenciaUsuario_(user, params) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), ws = ss.getSheetByName('SOLICITACOES_OPERACIONAIS'), solId = gerarId_('OCR'), agora = new Date().toISOString();
  const tipo = params.tipo || 'DUPLA_NO_PATINETE', foto = params.foto_url || '', patinete = String(params.numero_patinete || '').trim();
  if (!foto) throw new Error('Foto obrigatória (deve ser tirada direto da câmera).');
  if (!/^\d{6}$/.test(patinete)) throw new Error('Número do patinete inválido (deve ter exatamente 6 dígitos).');
  ws.appendRow([solId, tipo, user.user_id, params.slot_id || '', '', user.cidade_base || '', 'CONCLUIDA', `[Patinete: ${patinete}] ${params.descricao || ''}`, foto, agora, agora, agora]);
  return { ok: true, solicitacao_id: solId, metas_atuais: _getProgressoMetasFiscal_(ss, user.user_id) };
}

function registrarOrganizacaoPontoFiscal_(user, params) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), ws = ss.getSheetByName('SOLICITACOES_OPERACIONAIS'), solId = gerarId_('ORG'), agora = new Date().toISOString();
  ws.appendRow([solId, 'ORGANIZACAO_PONTO', user.user_id, params.slot_id || '', '', user.cidade_base || '', 'CONCLUIDA', params.descricao || 'Organização do ponto.', params.foto_url || '', agora, agora, agora]);
  return { ok: true, mensagem: 'Organização de ponto registrada.' };
}

function registrarChuvaFiscal_(user, params) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), ws = ss.getSheetByName('SOLICITACOES_OPERACIONAIS'), agora = new Date().toISOString(), solId = gerarId_('CHU'), fotoUrl = params.foto_url || '';
  ws.appendRow([solId, 'CLIMA_CHUVA', user.user_id, '', '', user.cidade_base || '', 'ABERTA', params.descricao || 'Chuva registrada.', fotoUrl, agora, agora, agora]);
  processIntegracoes([{canal: 'telegram', tipo: 'group_message', cidade: user.cidade_base || '', topic_key: 'ALERTAS', parse_mode: 'HTML', text_html: `🌧️ <b>ALERTA DE CHUVA (FISCAL)</b>\n\n📍 Cidade: <b>${user.cidade_base}</b>\n👤 Fiscal: ${user.nome_completo}\n${fotoUrl ? '📸 <a href="'+fotoUrl+'">Ver Foto</a>' : ''}`}], { evento: 'REGISTRO_CHUVA_FISCAL' });
  return { ok: true, solicitacao_id: solId };
}

function _getProgressoMetasFiscal_(ss, userId) {
  const ws = ss.getSheetByName('SOLICITACOES_OPERACIONAIS'); if (!ws) return { hoje: 0, semana: 0 };
  const data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim()), iUsr = h.indexOf('user_id'), iTipo = h.indexOf('tipo'), iCri = h.indexOf('criado_em');
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const pSemana = new Date(hoje); pSemana.setDate(hoje.getDate() - hoje.getDay() + (hoje.getDay() === 0 ? -6 : 1));
  let contH = 0, contS = 0; const tM = ['DUPLA_NO_PATINETE', 'MENOR_DE_IDADE'];
  for (let r = 1; r < data.length; r++) { if (String(data[r][iUsr]).trim() !== userId || !tM.includes(String(data[r][iTipo]))) continue; const cri = new Date(data[r][iCri]); if (cri >= hoje) contH++; if (cri >= pSemana) contS++; }
  return { hoje: contH, semana: contS };
}

function getRoadmapFiscal_(user, params) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), perfil = _getPerfilCLTMap_(ss)[user.user_id];
  if (!perfil || !perfil.zona_poligono) return { ok: true, roadmap: [] };
  return { ok: true, roadmap: [{nome: "Hotspots de Usuários", poligono: perfil.zona_poligono, descricao: "Foco em flagrantes de duplas e menores."}] };
}

function getMeusHistoricoTurnosCLT_(user) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master')), ws = ss.getSheetByName('TURNOS_CLT'); if (!ws) return { ok: true, data: [] };
  const rows = ws.getDataRange().getValues(), h = rows[0].map(v => String(v).toLowerCase().trim()), uid = String(user.user_id).trim(), res = [];
  for (let r = 1; r < rows.length; r++) { if (String(rows[r][h.indexOf('user_id')]).trim() !== uid) continue; const stt = String(rows[r][h.indexOf('status')]).trim(); if (stt === 'PLANEJADO' || stt === 'CANCELADO') continue; res.push({turno_id: rows[r][h.indexOf('turno_id')], data: String(rows[r][h.indexOf('data')]).substring(0, 10), status: stt, checkin_hora: rows[r][h.indexOf('checkin_hora')], checkout_hora: rows[r][h.indexOf('checkout_hora')], horas: rows[r][h.indexOf('duracao_real_horas')] || 0}); }
  return { ok: true, data: res.sort((a,b) => a.data<b.data?1:-1).slice(0, 50) };
}

function _atualizarRealizadasBancoHoras_(ss,uid,dt,hrs){
  var sem=_semanaInicioCLT_(dt), ws=ss.getSheetByName('BANCO_HORAS'); if(!ws) return;
  var rows=ws.getDataRange().getValues(), h=rows[0].map(v => String(v).toLowerCase().trim());
  for(var r=1;r<rows.length;r++){ if(String(rows[r][h.indexOf('user_id')]).trim()!==uid || String(rows[r][h.indexOf('semana_inicio')]).substring(0,10)!==sem) continue; var nR=(parseFloat(rows[r][h.indexOf('horas_realizadas')])||0)+hrs, c=parseFloat(rows[r][h.indexOf('horas_contrato')])||44; ws.getRange(r+1,h.indexOf('horas_realizadas')+1).setValue(Math.round(nR*100)/100); ws.getRange(r+1,h.indexOf('saldo_horas')+1).setValue(Math.round((nR-c)*100)/100); return; }
}

function _verificarSlotAtivoPromotor_(ss, uid) {
  const wsJ = ss.getSheetByName('JORNADAS'); if (!wsJ) return false;
  const dJ = wsJ.getDataRange().getValues(), hJ = dJ[0].map(v => String(v).toLowerCase().trim()), hj = new Date().toISOString().substring(0, 10);
  for (let r = 1; r < dJ.length; r++) { if (String(dJ[r][hJ.indexOf('user_id')]).trim() === uid && String(dJ[r][hJ.indexOf('criado_em')]).substring(0, 10) === hj && ['ACEITO', 'EM_ATIVIDADE', 'PAUSADO'].includes(String(dJ[r][hJ.indexOf('status')]).toUpperCase())) return true; }
  return false;
}
