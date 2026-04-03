// ─── 08.EscalaCLT.gs ──────────────────────────────────────────────────────────
// Motor de escala CLT — funções completas e otimizadas

function _getPerfilCLTMap_(ss) {
  var ws=ss.getSheetByName('PERFIL_CLT'); if(!ws) return {};
  var data=ws.getDataRange().getValues();
  var h=data[0].map(function(v){return String(v).toLowerCase().trim();});
  var map={};
  for(var r=1;r<data.length;r++){
    var uid=String(data[r][h.indexOf('user_id')]).trim();
    if(!uid||String(data[r][h.indexOf('ativo')]).trim()!=='SIM') continue;
    map[uid]={perfil_id:data[r][h.indexOf('perfil_id')],user_id:uid,nome_completo:data[r][h.indexOf('nome_completo')],cargo_clt:String(data[r][h.indexOf('cargo_clt')]).trim(),zona_nome:data[r][h.indexOf('zona_nome')]||'',zona_lat:parseFloat(data[r][h.indexOf('zona_lat_centro')])||0,zona_lng:parseFloat(data[r][h.indexOf('zona_lng_centro')])||0,zona_raio_km:parseFloat(data[r][h.indexOf('zona_raio_km')])||5,horas_semanais:parseFloat(data[r][h.indexOf('horas_semanais_contrato')])||44,turno_padrao:String(data[r][h.indexOf('turno_padrao')]||'FLEXIVEL').trim(),folga_semanal_dia:parseInt(data[r][h.indexOf('folga_semanal_dia')]),folga_movel_regra:String(data[r][h.indexOf('folga_movel_regra')]||'NENHUMA').trim(),folga_movel_config:_safeJsonCLT_(data[r][h.indexOf('folga_movel_config_json')],{})};
  }
  return map;
}

function _getRegrasMap_(ss) {
  var ws=ss.getSheetByName('REGRAS_FOLGA'); if(!ws) return {};
  var data=ws.getDataRange().getValues();
  var h=data[0].map(function(v){return String(v).toLowerCase().trim();});
  var map={};
  for(var r=1;r<data.length;r++){
    if(String(data[r][h.indexOf('ativo')]).trim()!=='SIM') continue;
    var cargo=String(data[r][h.indexOf('cargo_clt')]).trim();
    if(!map[cargo]) map[cargo]=[];
    map[cargo].push({tipo:String(data[r][h.indexOf('tipo_regra')]).trim(),dia_semana:parseInt(data[r][h.indexOf('dia_semana')]),n_ocorrencia:parseInt(data[r][h.indexOf('n_ocorrencia_mes')])||0,ciclo_trabalho:parseInt(data[r][h.indexOf('ciclo_trabalho')])||0,ciclo_folga:parseInt(data[r][h.indexOf('ciclo_folga')])||0});
  }
  return map;
}

function _getBancoHorasMap_(ss,semanaInicio) {
  var ws=ss.getSheetByName('BANCO_HORAS'); if(!ws) return {};
  var data=ws.getDataRange().getValues();
  var h=data[0].map(function(v){return String(v).toLowerCase().trim();});
  var map={};
  for(var r=1;r<data.length;r++){
    var sem=String(data[r][h.indexOf('semana_inicio')]).substring(0,10);
    if(sem!==semanaInicio) continue;
    var uid=String(data[r][h.indexOf('user_id')]).trim();
    map[uid]={horas_contrato:parseFloat(data[r][h.indexOf('horas_contrato')])||44,horas_escaladas:parseFloat(data[r][h.indexOf('horas_escaladas')])||0};
  }
  return map;
}

function _getTurnosDaData_(ss,data_iso) {
  var ws=ss.getSheetByName('TURNOS_CLT'); if(!ws) return [];
  var rows=ws.getDataRange().getValues();
  var h=rows[0].map(function(v){return String(v).toLowerCase().trim();});
  var result=[];
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

function _isFolgaCLT_(perfil,regras,data_iso){
  var d=new Date(data_iso+'T12:00:00'),diaSemana=d.getDay();
  if(!isNaN(perfil.folga_semanal_dia)&&diaSemana===perfil.folga_semanal_dia) return{folga:true,motivo:'Folga semanal fixa'};
  var regrasC=regras[perfil.cargo_clt]||[];
  for(var i=0;i<regrasC.length;i++){
    var r=regrasC[i];
    if(r.tipo==='FIXO_SEMANAL'&&diaSemana===r.dia_semana) return{folga:true,motivo:'Folga semanal por cargo'};
    if(r.tipo==='MOVEL_MES'&&diaSemana===r.dia_semana){var mes=d.getMonth(),ano=d.getFullYear(),oc=0;for(var day=1;day<=d.getDate();day++){if(new Date(ano,mes,day).getDay()===r.dia_semana)oc++;}if(oc===r.n_ocorrencia)return{folga:true,motivo:'Folga movel'};}
    if(r.tipo==='CICLO_DIAS'&&r.ciclo_trabalho>0){var epoch=Math.floor(new Date(data_iso).getTime()/86400000),ciclo=r.ciclo_trabalho+r.ciclo_folga;if(ciclo>0&&(epoch%ciclo)>=r.ciclo_trabalho)return{folga:true,motivo:'Folga por ciclo'};}
  }
  return{folga:false,motivo:''};
}

function _temConflitoCLT_(turnosDia,userId,inicio,fim){
  var iniMin=_horaParaMinutosCLT_(inicio),fimMin=_horaParaMinutosCLT_(fim);
  for(var i=0;i<turnosDia.length;i++){var t=turnosDia[i];if(t.user_id!==userId)continue;if(t.status==='CANCELADO'||t.status==='FALTA')continue;var tIni=_horaParaMinutosCLT_(t.inicio),tFim=_horaParaMinutosCLT_(t.fim);if(iniMin<tFim&&fimMin>tIni)return true;}
  return false;
}

function getSugestoesEscala_(token,params){
  _assertGestor_(token);
  var data_iso=String(params.data||'').substring(0,10),inicio=params.inicio||'',fim=params.fim||'';
  var cargo=String(params.cargo_clt||'').toUpperCase(),slotLat=parseFloat(params.slot_lat)||0,slotLng=parseFloat(params.slot_lng)||0;
  if(!data_iso||!inicio||!fim) throw new Error('data, inicio e fim obrigatorios.');
  var ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  var perfilMap=_getPerfilCLTMap_(ss),regrasMap=_getRegrasMap_(ss);
  var bancoMap=_getBancoHorasMap_(ss,_semanaInicioCLT_(data_iso));
  var turnosDia=_getTurnosDaData_(ss,data_iso),horasTurno=_calcHorasTurnoCLT_(inicio,fim);
  var sugestoes=[];
  for(var uid in perfilMap){
    var p=perfilMap[uid];
    if(cargo&&p.cargo_clt!==cargo) continue;
    var fi=_isFolgaCLT_(p,regrasMap,data_iso);
    if(fi.folga){sugestoes.push({user_id:uid,nome:p.nome_completo,cargo_clt:p.cargo_clt,zona_nome:p.zona_nome,disponivel:false,motivo_bloqueio:fi.motivo,score:0});continue;}
    if(_temConflitoCLT_(turnosDia,uid,inicio,fim)){sugestoes.push({user_id:uid,nome:p.nome_completo,cargo_clt:p.cargo_clt,zona_nome:p.zona_nome,disponivel:false,motivo_bloqueio:'Conflito de horario',score:0});continue;}
    var banco=bancoMap[uid]||{horas_contrato:p.horas_semanais,horas_escaladas:0};
    var horasDisp=banco.horas_contrato-banco.horas_escaladas,seraExtra=horasTurno>horasDisp,score=50;
    var distKm=(slotLat&&slotLng&&p.zona_lat&&p.zona_lng)?_haversineKmCLT_(p.zona_lat,p.zona_lng,slotLat,slotLng):999;
    if(distKm<=p.zona_raio_km)score+=20;else if(distKm<=p.zona_raio_km*2)score+=5;
    if(!seraExtra&&horasDisp>=horasTurno)score+=15;else if(seraExtra)score-=10;
    var hora=_horaParaMinutosCLT_(inicio),turnoD=hora<720?'MANHA':hora<1020?'TARDE':'NOITE';
    if(p.turno_padrao==='FLEXIVEL'||p.turno_padrao===turnoD)score+=10;
    if(cargo&&p.cargo_clt===cargo)score+=5;
    sugestoes.push({user_id:uid,nome:p.nome_completo,cargo_clt:p.cargo_clt,zona_nome:p.zona_nome,zona_lat:p.zona_lat,zona_lng:p.zona_lng,dist_km:distKm<999?Math.round(distKm*10)/10:null,disponivel:true,sera_hora_extra:seraExtra,horas_disponiveis:Math.round(horasDisp*10)/10,horas_turno:Math.round(horasTurno*10)/10,score:Math.max(0,Math.min(100,score))});
  }
  sugestoes.sort(function(a,b){if(a.disponivel&&!b.disponivel)return -1;if(!a.disponivel&&b.disponivel)return 1;return b.score-a.score;});
  return{ok:true,data:sugestoes};
}

function getTurnosDia_(token,params){
  _assertGestor_(token);
  var data_iso=String(params.data||new Date().toISOString()).substring(0,10);
  var ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  var turnos=_getTurnosDaData_(ss,data_iso),promMap=_getPromotoresMap_(ss);
  return{ok:true,data:turnos.map(function(t){var p=promMap[t.user_id]||{};return Object.assign({},t,{nome:p.nome||t.user_id});})};
}

function getBancoHorasPromotor_(token,params){_assertGestor_(token);var uid=params.user_id||'',sem=parseInt(params.semanas)||4;if(!uid)throw new Error('user_id obrigatorio.');return _buscarBancoHoras_(uid,sem);}

function getMeuBancoHoras_(user){return _buscarBancoHoras_(user.user_id,8);}

function _buscarBancoHoras_(uid,semanas){
  var ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  var ws=ss.getSheetByName('BANCO_HORAS'); if(!ws) return{ok:true,data:[]};
  var rows=ws.getDataRange().getValues(),h=rows[0].map(function(v){return String(v).toLowerCase().trim();});
  var result=[];
  for(var r=1;r<rows.length;r++){if(String(rows[r][h.indexOf('user_id')]).trim()!==uid)continue;result.push({semana_inicio:rows[r][h.indexOf('semana_inicio')],semana_fim:rows[r][h.indexOf('semana_fim')],horas_contrato:rows[r][h.indexOf('horas_contrato')],horas_escaladas:rows[r][h.indexOf('horas_escaladas')],horas_realizadas:rows[r][h.indexOf('horas_realizadas')],saldo_horas:rows[r][h.indexOf('saldo_horas')],horas_extra:rows[r][h.indexOf('horas_extra')],status_semana:rows[r][h.indexOf('status_semana')]});}
  result.sort(function(a,b){return String(b.semana_inicio)>String(a.semana_inicio)?1:-1;});
  return{ok:true,data:result.slice(0,semanas)};
}

function getMeusTurnosCLT_(user){
  var ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  var ws=ss.getSheetByName('TURNOS_CLT'); if(!ws) return{ok:true,data:[]};
  var rows=ws.getDataRange().getValues(),h=rows[0].map(function(v){return String(v).toLowerCase().trim();});
  var hoje=new Date(); hoje.setHours(0,0,0,0);
  var limite=new Date(hoje); limite.setDate(limite.getDate()+14);
  var result=[];
  for(var r=1;r<rows.length;r++){
    if(String(rows[r][h.indexOf('user_id')]).trim()!==user.user_id) continue;
    var stt=String(rows[r][h.indexOf('status')]).trim();
    if(stt==='CANCELADO'||stt==='FALTA') continue;
    var dataStr=String(rows[r][h.indexOf('data')]).substring(0,10);
    var dataD=new Date(dataStr+'T12:00:00');
    if(dataD<hoje||dataD>limite) continue;
    result.push({
      turno_id:        rows[r][h.indexOf('turno_id')],
      data:            dataStr,
      inicio:          rows[r][h.indexOf('inicio')],
      fim:             rows[r][h.indexOf('fim')],
      status:          stt,
      zona_nome:       rows[r][h.indexOf('zona_nome')]    || '',
      zona_lat:        parseFloat(rows[r][h.indexOf('zona_lat')])  || 0,
      zona_lng:        parseFloat(rows[r][h.indexOf('zona_lng')])  || 0,
      zona_raio_km:    parseFloat(rows[r][h.indexOf('zona_raio_km')]) || 5,
      ponto_referencia:rows[r][h.indexOf('ponto_referencia')] || '',
      horas_turno:     rows[r][h.indexOf('horas_turno')]  || '',
      checkin_hora:    rows[r][h.indexOf('checkin_hora')] ? String(rows[r][h.indexOf('checkin_hora')]) : null,
      checkout_hora:   rows[r][h.indexOf('checkout_hora')]? String(rows[r][h.indexOf('checkout_hora')]): null,
    });

  }
  result.sort(function(a,b){return a.data>b.data?1:-1;});
  return{ok:true,data:result};
}

function confirmarTurnoCLT_(user,params){
  var turno_id=params.turno_id||''; if(!turno_id) throw new Error('turno_id obrigatorio.');
  var ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  var ws=ss.getSheetByName('TURNOS_CLT'); if(!ws) throw new Error('Aba TURNOS_CLT nao encontrada.');
  var rows=ws.getDataRange().getValues(),h=rows[0].map(function(v){return String(v).toLowerCase().trim();});
  for(var r=1;r<rows.length;r++){
    if(String(rows[r][h.indexOf('turno_id')]).trim()!==turno_id) continue;
    if(String(rows[r][h.indexOf('user_id')]).trim()!==user.user_id) throw new Error('Turno nao pertence a este usuario.');
    if(rows[r][h.indexOf('status')]!=='ESCALADO') return{ok:true,mensagem:'Turno ja confirmado.'};
    ws.getRange(r+1,h.indexOf('status')+1).setValue('CONFIRMADO');
    ws.getRange(r+1,h.indexOf('atualizado_em')+1).setValue(new Date().toISOString());
    return{ok:true,mensagem:'Presenca confirmada.'};
  }
  throw new Error('Turno nao encontrado.');
}

function checkinTurnoCLT_(user,params){
  var turno_id=params.turno_id||''; if(!turno_id) throw new Error('turno_id obrigatorio.');
  var ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  var ws=ss.getSheetByName('TURNOS_CLT'); if(!ws) throw new Error('Aba TURNOS_CLT nao encontrada.');
  var rows=ws.getDataRange().getValues(),h=rows[0].map(function(v){return String(v).toLowerCase().trim();});
  for(var r=1;r<rows.length;r++){
    if(String(rows[r][h.indexOf('turno_id')]).trim()!==turno_id) continue;
    if(String(rows[r][h.indexOf('user_id')]).trim()!==user.user_id) throw new Error('Turno nao pertence a este usuario.');
    var stt=String(rows[r][h.indexOf('status')]).trim();
    if(stt==='EM_ANDAMENTO') return{ok:true,mensagem:'Checkin ja realizado.'};
    if(!['ESCALADO','CONFIRMADO'].includes(stt)) throw new Error('Status invalido para checkin: '+stt);
    var agora=new Date().toISOString();
    ws.getRange(r+1,h.indexOf('status')+1).setValue('EM_ANDAMENTO');
    ws.getRange(r+1,h.indexOf('checkin_hora')+1).setNumberFormat(' @').setValue(agora);
    ws.getRange(r+1,h.indexOf('atualizado_em')+1).setValue(agora);

    var colMotivo = h.indexOf('motivo_ocorrencia');
    var colClima  = h.indexOf('ocorrencia_climatica');
    if(params.motivo_ocorrencia && colMotivo > -1)
      ws.getRange(r+1,colMotivo+1).setValue(params.motivo_ocorrencia);
    if(colClima > -1)
      ws.getRange(r+1,colClima+1).setValue(params.ocorrencia_climatica ? 'TRUE' : 'FALSE');

    registrarAuditoria_({tabela:'TURNOS_CLT',registro_id:turno_id,campo:'status',valor_anterior:stt,valor_novo:'EM_ANDAMENTO',alterado_por:user.user_id,origem:'app_clt'});
    var latChk=parseFloat(params.lat||0),lngChk=parseFloat(params.lng||0);
    if(latChk&&lngChk){
      var wsLoc=ss.getSheetByName('LOCALIZACAO_TEMPO_REAL');
      if(wsLoc) wsLoc.appendRow([gerarId_('LOC'),user.user_id,turno_id,latChk,lngChk,params.accuracy||999,false,80,false,agora,agora,'','']);
    }
    var zonaChk=rows[r][h.indexOf('zona_nome')]||'';
    var cargoChk=rows[r][h.indexOf('cargo_clt')]||'';
    var promChk=(_getPromotoresMap_(ss))[user.user_id]||{};
    var cidadeChk=promChk.cidade||zonaChk||'';
    var horaChk=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    var integracoesChk=[{canal:'telegram',tipo:'group_message',cidade:cidadeChk,topic_key:'CHECKIN_PRESENCA',parse_mode:'HTML',
      text_html:'✅ <b>Check-in CLT</b>\n\n👤 <b>'+(user.nome_completo||user.user_id)+'</b>\n🔧 '+cargoChk+' · LOGISTICA\n📍 '+zonaChk+'\n⏰ '+horaChk+
      (params.motivo_ocorrencia?'\n⚠️ Motivo: '+params.motivo_ocorrencia:'')}];
    return{ok:true,turno_id:turno_id,checkin_hora:agora,mensagem:'Check-in registrado.',integracoes:integracoesChk};
  }
  throw new Error('Turno nao encontrado.');
}

function checkoutTurnoCLT_(user,params){
  var turno_id=params.turno_id||''; if(!turno_id) throw new Error('turno_id obrigatorio.');
  var ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  var ws=ss.getSheetByName('TURNOS_CLT'); if(!ws) throw new Error('Aba TURNOS_CLT nao encontrada.');
  var rows=ws.getDataRange().getValues(),h=rows[0].map(function(v){return String(v).toLowerCase().trim();});
  for(var r=1;r<rows.length;r++){
    if(String(rows[r][h.indexOf('turno_id')]).trim()!==turno_id) continue;
    if(String(rows[r][h.indexOf('user_id')]).trim()!==user.user_id) throw new Error('Turno nao pertence a este usuario.');
    if(rows[r][h.indexOf('status')]!=='EM_ANDAMENTO') throw new Error('Turno nao esta em andamento.');
    var agora=new Date().toISOString();
    var checkinHora=rows[r][h.indexOf('checkin_hora')];
    var duracaoReal=checkinHora?Math.round((new Date(agora)-new Date(checkinHora))/36000)/100:0;
    var horasTurno=parseFloat(rows[r][h.indexOf('horas_turno')])||0;
    var horaExtra=Math.max(0,Math.round((duracaoReal-horasTurno)*100)/100);
    ws.getRange(r+1,h.indexOf('status')+1).setValue('ENCERRADO');
    ws.getRange(r+1,h.indexOf('checkout_hora')+1).setValue(agora);
    if(h.indexOf('duracao_real_horas')>-1) ws.getRange(r+1,h.indexOf('duracao_real_horas')+1).setValue(duracaoReal);
    if(h.indexOf('hora_extra')>-1) ws.getRange(r+1,h.indexOf('hora_extra')+1).setValue(horaExtra);
    ws.getRange(r+1,h.indexOf('atualizado_em')+1).setValue(agora);

    var colMotivo = h.indexOf('motivo_ocorrencia');
    var colClima  = h.indexOf('ocorrencia_climatica');
    if(params.motivo_ocorrencia && colMotivo > -1)
      ws.getRange(r+1,colMotivo+1).setValue(params.motivo_ocorrencia);
    if(colClima > -1 && params.motivo_ocorrencia)
      ws.getRange(r+1,colClima+1).setValue(params.ocorrencia_climatica ? 'TRUE' : 'FALSE');

    var dataStr=String(rows[r][h.indexOf('data')]).substring(0,10);
    var perfilMap=_getPerfilCLTMap_(ss),perfil=perfilMap[user.user_id];
    if(perfil) _atualizarRealizadasBancoHoras_(ss,user.user_id,dataStr,duracaoReal);
    registrarAuditoria_({tabela:'TURNOS_CLT',registro_id:turno_id,campo:'status',valor_anterior:'EM_ANDAMENTO',valor_novo:'ENCERRADO',alterado_por:user.user_id,origem:'app_clt'});
    var zonaCho=rows[r][h.indexOf('zona_nome')]||'';
    var cargoCho=rows[r][h.indexOf('cargo_clt')]||'';
    var promCho=(_getPromotoresMap_(ss))[user.user_id]||{};
    var cidadeCho=promCho.cidade||zonaCho||'';
    var horaCho=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    var integracoesCho=[{canal:'telegram',tipo:'group_message',cidade:cidadeCho,topic_key:'ENCERRAMENTOS',parse_mode:'HTML',
      text_html:'🔴 <b>Checkout CLT</b>\n\n👤 <b>'+(user.nome_completo||user.user_id)+'</b>\n🔧 '+cargoCho+' · LOGISTICA\n📍 '+zonaCho+'\n⏱️ Duração: '+duracaoReal+'h\n⏰ '+horaCho+
      (params.motivo_ocorrencia?'\n⚠️ Motivo: '+params.motivo_ocorrencia:'')}];
    return{ok:true,turno_id:turno_id,checkout_hora:agora,duracao_real_horas:duracaoReal,hora_extra:horaExtra,mensagem:'Checkout registrado.',integracoes:integracoesCho};
  }
  throw new Error('Turno nao encontrado.');
}

function _atualizarRealizadasBancoHoras_(ss,user_id,data_iso,horasRealizadas){
  var semanaIni=_semanaInicioCLT_(data_iso);
  var ws=ss.getSheetByName('BANCO_HORAS'); if(!ws) return;
  var rows=ws.getDataRange().getValues(),h=rows[0].map(function(v){return String(v).toLowerCase().trim();});
  for(var r=1;r<rows.length;r++){
    if(String(rows[r][h.indexOf('user_id')]).trim()!==user_id) continue;
    if(String(rows[r][h.indexOf('semana_inicio')]).substring(0,10)!==semanaIni) continue;
    var novoReal=(parseFloat(rows[r][h.indexOf('horas_realizadas')])||0)+horasRealizadas;
    var contrato=parseFloat(rows[r][h.indexOf('horas_contrato')])||44;
    ws.getRange(r+1,h.indexOf('horas_realizadas')+1).setValue(Math.round(novoReal*100)/100);
    ws.getRange(r+1,h.indexOf('saldo_horas')+1).setValue(Math.round((novoReal-contrato)*100)/100);
    ws.getRange(r+1,h.indexOf('atualizado_em')+1).setValue(new Date().toISOString());
    return;
  }
}

function criarTurnoCLT_(token,params){
  var gestor=_assertGestor_(token);
  var user_id=params.user_id||'',data=String(params.data||'').substring(0,10),inicio=params.inicio||'',fim=params.fim||'';
  if(!user_id||!data||!inicio||!fim) throw new Error('user_id, data, inicio e fim obrigatorios.');
  var ss=SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  var perfilMap=_getPerfilCLTMap_(ss),regrasMap=_getRegrasMap_(ss),perfil=perfilMap[user_id];
  if(!perfil) throw new Error('Perfil CLT nao encontrado: '+user_id);
  var fi=_isFolgaCLT_(perfil,regrasMap,data); if(fi.folga) throw new Error('Promotor esta de folga: '+fi.motivo);
  var turnosDia=_getTurnosDaData_(ss,data);
  if(_temConflitoCLT_(turnosDia,user_id,inicio,fim)) throw new Error('Conflito de horario.');
  var horasTurno=_calcHorasTurnoCLT_(inicio,fim),turnoId='TRN_'+new Date().getTime(),agora=new Date().toISOString();
  var promMap=_getPromotoresMap_(ss),prom=promMap[user_id]||{};
  var wsT=ss.getSheetByName('TURNOS_CLT'); if(!wsT) throw new Error('Aba TURNOS_CLT nao encontrada.');
  var headers=wsT.getRange(1,1,1,wsT.getLastColumn()).getValues()[0];
  var h=headers.map(function(v){return String(v).toLowerCase().trim();});
  var row=new Array(headers.length).fill('');
  row[h.indexOf('turno_id')]=turnoId;
  row[h.indexOf('escala_draft_id')]=params.escala_draft_id||'';
  row[h.indexOf('user_id')]=user_id;
  row[h.indexOf('nome_completo')]=prom.nome||perfil.nome_completo||'';
  row[h.indexOf('cargo_clt')]=params.cargo_clt||perfil.cargo_clt;
  row[h.indexOf('zona_nome')]=params.zona_nome||perfil.zona_nome;
  row[h.indexOf('zona_lat')]=perfil.zona_lat;
  row[h.indexOf('zona_lng')]=perfil.zona_lng;
  row[h.indexOf('ponto_referencia')]=params.ponto_referencia||'';
  row[h.indexOf('status')]='ESCALADO';
  row[h.indexOf('horas_turno')]=Math.round(horasTurno*100)/100;
  row[h.indexOf('criado_em')]=agora; row[h.indexOf('atualizado_em')]=agora;
  wsT.appendRow(row);
  var lastRow=wsT.getLastRow();
  wsT.getRange(lastRow,h.indexOf('data')+1).setNumberFormat(' @').setValue(data);
  wsT.getRange(lastRow,h.indexOf('inicio')+1).setNumberFormat(' @').setValue(String(inicio).substring(0,5));
  wsT.getRange(lastRow,h.indexOf('fim')+1).setNumberFormat(' @').setValue(String(fim).substring(0,5));
  _atualizarBancoHorasCLT_(ss,user_id,perfil,data,horasTurno);
  registrarAuditoria_({tabela:'TURNOS_CLT',registro_id:turnoId,campo:'criacao',valor_anterior:'',valor_novo:JSON.stringify({user_id,data,inicio,fim}),alterado_por:gestor.user_id||'',origem:'painel_gestor'});
  return{ok:true,turno_id:turnoId,horas_turno:horasTurno};
}

function _atualizarBancoHorasCLT_(ss,user_id,perfil,data_iso,horasAdicionadas){
  var semanaIni=_semanaInicioCLT_(data_iso);
  var d=new Date(semanaIni+'T12:00:00'); d.setDate(d.getDate()+6);
  var semanaFim=d.toISOString().substring(0,10);
  var ws=ss.getSheetByName('BANCO_HORAS'); if(!ws) return;
  var rows=ws.getDataRange().getValues(),h=rows[0].map(function(v){return String(v).toLowerCase().trim();});
  for(var r=1;r<rows.length;r++){
    if(String(rows[r][h.indexOf('user_id')]).trim()!==user_id) continue;
    if(String(rows[r][h.indexOf('semana_inicio')]).substring(0,10)!==semanaIni) continue;
    var novoEsc=(parseFloat(rows[r][h.indexOf('horas_escaladas')])||0)+horasAdicionadas;
    var contrato=parseFloat(rows[r][h.indexOf('horas_contrato')])||perfil.horas_semanais;
    ws.getRange(r+1,h.indexOf('horas_escaladas')+1).setValue(Math.round(novoEsc*100)/100);
    ws.getRange(r+1,h.indexOf('horas_extra')+1).setValue(Math.max(0,Math.round((novoEsc-contrato)*100)/100));
    ws.getRange(r+1,h.indexOf('atualizado_em')+1).setValue(new Date().toISOString());
    return;
  }
  var promMap=_getPromotoresMap_(ss),prom=promMap[user_id]||{};
  ws.appendRow(['BH_'+new Date().getTime(),user_id,prom.nome||perfil.nome_completo||'',perfil.cargo_clt,semanaIni,semanaFim,perfil.horas_semanais,Math.round(horasAdicionadas*100)/100,0,0,Math.max(0,Math.round((horasAdicionadas-perfil.horas_semanais)*100)/100),'ABERTA','',new Date().toISOString()]);
}

function heartbeatCLT_(user, params) {
  var turno_id = params.turno_id || '';
  var lat      = parseFloat(params.lat || 0);
  var lng      = parseFloat(params.lng || 0);
  var acc      = parseFloat(params.accuracy || 999);
  var agora    = new Date().toISOString();

  var ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  var ws = ss.getSheetByName('LOCALIZACAO_TEMPO_REAL');
  if (ws && lat && lng) {
    ws.appendRow([
      gerarId_('LOC'), user.user_id, turno_id,
      lat, lng, acc, false, 80, false,
      agora, agora, '', ''
    ]);
  }
  return { ok: true };
}

function pausarTurnoCLT_(user, params) {
  var turno_id = params.turno_id || '';
  if (!turno_id) throw new Error('turno_id obrigatorio.');
  var ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  var ws = ss.getSheetByName('TURNOS_CLT');
  var rows = ws.getDataRange().getValues();
  var h = rows[0].map(function(v){ return String(v).toLowerCase().trim(); });
  for (var r = 1; r < rows.length; r++) {
    if (String(rows[r][h.indexOf('turno_id')]).trim() !== turno_id) continue;
    if (String(rows[r][h.indexOf('user_id')]).trim() !== user.user_id) throw new Error('Turno nao pertence a este usuario.');
    if (rows[r][h.indexOf('status')] !== 'EM_ANDAMENTO') throw new Error('Turno nao esta em andamento.');
    var agora = new Date().toISOString();
    ws.getRange(r+1, h.indexOf('status')+1).setValue('PAUSADO');
    ws.getRange(r+1, h.indexOf('atualizado_em')+1).setValue(agora);
    return { ok: true, mensagem: 'Turno pausado.' };
  }
  throw new Error('Turno nao encontrado.');
}

function retomarTurnoCLT_(user, params) {
  var turno_id = params.turno_id || '';
  if (!turno_id) throw new Error('turno_id obrigatorio.');
  var ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  var ws = ss.getSheetByName('TURNOS_CLT');
  var rows = ws.getDataRange().getValues();
  var h = rows[0].map(function(v){ return String(v).toLowerCase().trim(); });
  for (var r = 1; r < rows.length; r++) {
    if (String(rows[r][h.indexOf('turno_id')]).trim() !== turno_id) continue;
    if (String(rows[r][h.indexOf('user_id')]).trim() !== user.user_id) throw new Error('Turno nao pertence a este usuario.');
    if (rows[r][h.indexOf('status')] !== 'PAUSADO') throw new Error('Turno nao esta pausado.');
    var agora = new Date().toISOString();
    var checkinHora = rows[r][h.indexOf('checkin_hora')];
    ws.getRange(r+1, h.indexOf('status')+1).setValue('EM_ANDAMENTO');
    ws.getRange(r+1, h.indexOf('atualizado_em')+1).setValue(agora);
    return { ok: true, checkin_hora: checkinHora, mensagem: 'Turno retomado.' };
  }
  throw new Error('Turno nao encontrado.');
}

function getHistoricoTurnosCLT_(token, params) {
  _assertGestor_(token);
  var data_inicio = String(params.data_inicio || '').substring(0, 10);
  var data_fim    = String(params.data_fim    || '').substring(0, 10);
  var user_id     = String(params.user_id     || '').trim();
  var status_filtro = String(params.status    || '').toUpperCase().trim();

  var ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  var ws = ss.getSheetByName('TURNOS_CLT');
  if (!ws) return { ok: true, data: [], totais: {} };

  var rows = ws.getDataRange().getValues();
  var h = rows[0].map(function(v) { return String(v).toLowerCase().trim(); });

  var result = [];
  var totais = { turnos: 0, horas_escaladas: 0, horas_realizadas: 0, horas_extra: 0 };

  for (var r = 1; r < rows.length; r++) {
    var data = String(rows[r][h.indexOf('data')]).substring(0, 10);
    if (data_inicio && data < data_inicio) continue;
    if (data_fim    && data > data_fim)    continue;

    var uid = String(rows[r][h.indexOf('user_id')]).trim();
    if (user_id && uid !== user_id) continue;

    var stt = String(rows[r][h.indexOf('status')]).trim().toUpperCase();
    if (status_filtro && stt !== status_filtro) continue;

    var horas_turno   = parseFloat(rows[r][h.indexOf('horas_turno')])         || 0;
    var duracao_real  = parseFloat(rows[r][h.indexOf('duracao_real_horas')])   || 0;
    var hora_extra    = parseFloat(rows[r][h.indexOf('hora_extra')])           || 0;

    totais.turnos++;
    totais.horas_escaladas  += horas_turno;
    totais.horas_realizadas += duracao_real;
    totais.horas_extra      += hora_extra;

    result.push({
      turno_id:          rows[r][h.indexOf('turno_id')],
      user_id:           uid,
      nome_completo:     rows[r][h.indexOf('nome_completo')] || '',
      cargo_clt:         rows[r][h.indexOf('cargo_clt')],
      zona_nome:         rows[r][h.indexOf('zona_nome')]     || '',
      data:              data,
      inicio:            rows[r][h.indexOf('inicio')]        || '',
      fim:               rows[r][h.indexOf('fim')]           || '',
      status:            stt,
      checkin_hora:      rows[r][h.indexOf('checkin_hora')]  ? String(rows[r][h.indexOf('checkin_hora')])  : null,
      checkout_hora:     rows[r][h.indexOf('checkout_hora')] ? String(rows[r][h.indexOf('checkout_hora')]) : null,
      horas_turno:       horas_turno,
      duracao_real_horas:duracao_real,
      hora_extra:        hora_extra,
    });
  }

  result.sort(function(a, b) { return a.data > b.data ? -1 : 1; });

  totais.horas_escaladas  = Math.round(totais.horas_escaladas  * 100) / 100;
  totais.horas_realizadas = Math.round(totais.horas_realizadas * 100) / 100;
  totais.horas_extra      = Math.round(totais.horas_extra      * 100) / 100;

  return { ok: true, data: result, totais: totais };
}