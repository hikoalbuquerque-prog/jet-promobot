// ============================================================
//  04.Utils.gs  — Helpers compartilhados
//  Versão: 2.1  |  Fase 3 — Centralizado
// ============================================================

var _configCache = null;

function getConfig_(chave) {
  if (!_configCache) {
    try {
      var ssId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
        || '1_PREENCHA_O_ID_DA_PLANILHA_AQUI';
      var ss   = SpreadsheetApp.openById(ssId);
      var ws   = ss.getSheetByName('CONFIG');
      if (!ws) { Logger.log('ERRO: aba CONFIG não encontrada'); return ''; }
      var data = ws.getDataRange().getValues();
      _configCache = {};
      for (var r = 1; r < data.length; r++) {
        if (data[r][0]) {
          _configCache[String(data[r][0]).trim()] = String(data[r][1]).trim();
        }
      }
      if (!_configCache['spreadsheet_id_master']) {
        _configCache['spreadsheet_id_master'] = ssId;
      }
    } catch (e) {
      Logger.log('ERRO getConfig_: ' + e.message);
      return '';
    }
  }
  return _configCache[chave] || '';
}

function limparCacheConfig_() {
  _configCache = null;
}

function gerarId_(prefix) {
  return `${prefix}_${new Date().getTime()}_${Math.random().toString(36).slice(2,7).toUpperCase()}`;
}

// rowToObj_ centralizado (remover dos outros arquivos se houver)
function rowToObj_(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
  return obj;
}

function registrarEventoLog_({ user_id, jornada_id, evento, estado_anterior, estado_novo, origem, tipo_evento, criticidade, payload, horario_servidor }) {
  try {
    const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
    const ws = ss.getSheetByName('EVENT_LOG');
    if (!ws) return;
    const deviceInfo = (payload && payload.device_info) ? String(payload.device_info).substring(0, 200) : '';
    ws.appendRow([
      gerarId_('LOG'), gerarId_('EVT'), gerarId_('REQ'), '',
      user_id || '', jornada_id || '', evento || '',
      estado_anterior || '', estado_novo || '', origem || 'sistema',
      tipo_evento || 'OPERACIONAL', criticidade || 'informativo',
      JSON.stringify(payload || {}), horario_servidor || new Date().toISOString(),
      deviceInfo, ''
    ]);
  } catch (_) {}
}

function registrarAuditoria_({ tabela, registro_id, campo, valor_anterior, valor_novo, alterado_por, origem, override, motivo_override }) {
  try {
    const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
    const ws = ss.getSheetByName('AUDITORIA');
    if (!ws) return;
    ws.appendRow([
      gerarId_('AUD'), tabela, registro_id, campo, valor_anterior, valor_novo,
      alterado_por, origem, new Date().toISOString(),
      override ? 'TRUE' : 'FALSE', motivo_override || ''
    ]);
  } catch (_) {}
}

function gerarConviteCalendar_(user, slot, jornadaId) {
  try {
    if (!user.email || !slot.data || !slot.inicio || !slot.fim) return;
    const [ano, mes, dia] = String(slot.data).split('-').map(Number);
    const [hI, mI]        = String(slot.inicio).split(':').map(Number);
    const [hF, mF]        = String(slot.fim).split(':').map(Number);
    const inicio = new Date(ano, mes - 1, dia, hI, mI, 0);
    const fim    = new Date(ano, mes - 1, dia, hF, mF, 0);

    const cal    = CalendarApp.getDefaultCalendar();
    const evento = cal.createEvent(
      `Slot Promo — ${slot.local_nome || slot.local || slot.cidade}`,
      inicio, fim,
      {
        description: `Jornada: ${jornadaId}\nLocal: ${slot.local_nome || ''}\nCidade: ${slot.cidade}\nCargo: ${user.cargo_principal}`,
        guests: user.email,
        sendInvites: true
      }
    );
    return evento.getId();
  } catch (e) {
    logErro_('gerarConviteCalendar_', e);
    return null;
  }
}

function botGetSession_(params) {
  const tgId = params.telegram_user_id || '';
  if (!tgId) return { ok: false, erro: 'telegram_user_id obrigatório' };
  const ss   = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws   = ss.getSheetByName('BOT_SESSOES');
  const data = ws.getDataRange().getValues();
  const h    = data[0].map(v => String(v).toLowerCase().trim());
  const iId  = h.indexOf('telegram_user_id');
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iId]).trim() === String(tgId)) return { ok: true, sessao: rowToObj_(h, data[r]) };
  }
  return { ok: true, sessao: null };
}

function botSetSession_(body) {
  const telegram_user_id = body.telegram_user_id;
  const estado = body.estado;
  const payload_json = body.payload || body.payload_json || {};
  if (!telegram_user_id) return { ok: false, erro: 'telegram_user_id obrigatório' };
  const ss   = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws   = ss.getSheetByName('BOT_SESSOES');
  const data = ws.getDataRange().getValues();
  const h    = data[0].map(v => String(v).toLowerCase().trim());
  const iId  = h.indexOf('telegram_user_id');
  const iEst = h.indexOf('estado');
  const iPay = h.indexOf('payload_json');
  const iUpd = h.indexOf('atualizado_em');
  const agora = new Date().toISOString();
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iId]).trim() === String(telegram_user_id)) {
      ws.getRange(r+1, iEst+1).setValue(estado || '');
      ws.getRange(r+1, iPay+1).setValue(typeof payload_json === 'string' ? payload_json : JSON.stringify(payload_json || {}));
      ws.getRange(r+1, iUpd+1).setValue(agora);
      return { ok: true };
    }
  }
  ws.appendRow([String(telegram_user_id), estado || '', typeof payload_json === 'string' ? payload_json : JSON.stringify(payload_json || {}), agora, agora]);
  return { ok: true };
}

function botClearSession_(body) {
  return botSetSession_({ telegram_user_id: body.telegram_user_id, estado: '', payload_json: '{}' });
}

function internalRegistrarSlotTgMeta_(body) {
  const { slot_id, tipo, chat_id, topic_key, message_id } = body;
  const ss   = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws   = ss.getSheetByName('SLOTS');
  const data = ws.getDataRange().getValues();
  const h    = data[0].map(v => String(v).toLowerCase().trim());
  const iId  = h.indexOf('slot_id');
  const prefix = tipo === 'disponivel' ? 'tg_disponivel_' : 'tg_ocupado_';
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iId]).trim() !== slot_id) continue;
    ['chat_id','topic_key','message_id'].forEach(f => {
      const col = h.indexOf(prefix + f);
      if (col > -1) ws.getRange(r+1, col+1).setValue({ chat_id, topic_key, message_id }[f] || '');
    });
    return { ok: true };
  }
  return { ok: false, erro: 'slot não encontrado' };
}

function internalLimparSlotTgMeta_(body) {
  return internalRegistrarSlotTgMeta_({ ...body, chat_id: '', topic_key: '', message_id: '' });
}

function getHistorico_(user, params) {
  const ss   = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws   = ss.getSheetByName('JORNADAS');
  const data = ws.getDataRange().getValues();
  const h    = data[0].map(v => String(v).toLowerCase().trim());
  const iUsr = h.indexOf('user_id');
  const registros = [];
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iUsr]).trim() === user.user_id) registros.push(rowToObj_(h, data[r]));
  }
  return { ok: true, historico: registros };
}

function getMapaPromotor_(user, params) {
  const ss    = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const wsLoc = ss.getSheetByName('LOCALIZACAO_TEMPO_REAL');
  const wsJor = ss.getSheetByName('JORNADAS');
  if (!wsLoc || !wsJor) return { ok: true, pontos: [] };

  const dataLoc = wsLoc.getDataRange().getValues(), hLoc = dataLoc[0].map(v => String(v).toLowerCase().trim());
  const dataJor = wsJor.getDataRange().getValues(), hJor = dataJor[0].map(v => String(v).toLowerCase().trim());
  const promMap = _getPromotoresMap_(ss);

  const iUsrLoc = hLoc.indexOf('user_id'), iUsrJor = hJor.indexOf('user_id'), iStJor = hJor.indexOf('status');
  const iNomeJor = hJor.indexOf('nome_completo') > -1 ? hJor.indexOf('nome_completo') : hJor.indexOf('promotor_nome');

  // Mapeia status atual de cada promotor
  const statusMap = {};
  for (let r = dataJor.length - 1; r >= 1; r--) {
    const uid = String(dataJor[r][iUsrJor]).trim();
    if (!uid || statusMap[uid]) continue;
    const prom = promMap[uid] || {};
    statusMap[uid] = {
      status: String(dataJor[r][iStJor]).trim().toUpperCase(),
      nome: prom.nome || String(dataJor[r][iNomeJor] || uid).trim()
    };
  }

  const role = (user.tipo_vinculo || '').toUpperCase();
  const isGestor = ['GESTOR','FISCAL','LIDER'].includes(role);

  const pontos = [];
  const seen = new Set();
  for (let r = dataLoc.length - 1; r >= 1; r--) {
    const uid = String(dataLoc[r][iUsrLoc]).trim();
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);

    const prom = promMap[uid] || {};
    const info = statusMap[uid] || { status: 'OFFLINE', nome: prom.nome || uid };
    
    // Regra de Visibilidade: 
    // Se for promotor, só vê ATIVO ou PAUSADO. Se for gestor, vê tudo de hoje.
    if (!isGestor && !['EM_ATIVIDADE', 'PAUSADO', 'A_CAMINHO'].includes(info.status)) continue;

    const obj = rowToObj_(hLoc, dataLoc[r]);
    obj.status_jornada = info.status;
    obj.nome_completo = info.nome;
    pontos.push(obj);
  }
  return { ok: true, pontos };
}

/**
 * Retorna cidades e cargos únicos para o seletor de broadcast.
 */
function getBroadcastFilters_() {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws = ss.getSheetByName('PROMOTORES');
  if (!ws) return { ok: false, erro: 'Aba PROMOTORES não encontrada' };
  
  const data = ws.getDataRange().getValues();
  const h = data[0].map(v => String(v).toLowerCase().trim());
  
  // Busca flexível de colunas
  const iCid = h.findIndex(v => v.includes('cidade'));
  const iCar = h.findIndex(v => v.includes('cargo') || v.includes('função'));
  const iSt  = h.findIndex(v => v.includes('status'));

  const cidades = new Set(), cargos = new Set();
  for (let r = 1; r < data.length; r++) {
    const status = String(data[r][iSt] || '').toUpperCase();
    if (status !== 'INATIVO' && status !== 'BLOQUEADO') {
      if (iCid > -1 && data[r][iCid]) cidades.add(String(data[r][iCid]).trim());
      if (iCar > -1 && data[r][iCar]) cargos.add(String(data[r][iCar]).trim());
    }
  }

  return { 
    ok: true, 
    cidades: Array.from(cidades).sort(), 
    cargos: Array.from(cargos).sort() 
  };
}

function processIntegracoes(integracoes, contexto) {
  if (!integracoes || !integracoes.length) return;
  const url = getConfig_('cloud_run_url') + '/app/event';
  integracoes.forEach(integ => {
    try {
      UrlFetchApp.fetch(url, {
        method: 'post', contentType: 'application/json',
        payload: JSON.stringify({ integration_secret: getConfig_('integration_secret'), ...integ }),
        muteHttpExceptions: true
      });
    } catch(e) { console.log('Erro ao processar integração:', e.message); }
  });
}

/**
 * Salva a assinatura de push do navegador na planilha.
 */
function registrarPushToken_(body) {
  const { user_id, subscription_json } = body;
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  let ws = ss.getSheetByName('PUSH_SUBSCRIPTIONS');
  if (!ws) {
    ws = ss.insertSheet('PUSH_SUBSCRIPTIONS');
    ws.appendRow(['user_id', 'subscription_json', 'atualizado_em']);
  }
  
  const data = ws.getDataRange().getValues();
  const agora = new Date().toISOString();
  
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][0]).trim() === user_id) {
      ws.getRange(r + 1, 2).setValue(subscription_json);
      ws.getRange(r + 1, 3).setValue(agora);
      return { ok: true };
    }
  }
  
  ws.appendRow([user_id, subscription_json, agora]);
  return { ok: true };
}

/**
 * Envia uma notificação push nativa para um usuário específico.
 */
function enviarPush_(userId, titulo, mensagem, url = '/') {
  try {
    const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
    const ws = ss.getSheetByName('PUSH_SUBSCRIPTIONS');
    if (!ws) return;

    const data = ws.getDataRange().getValues();
    let subJson = null;
    for (let r = 1; r < data.length; r++) {
      if (String(data[r][0]).trim() === userId) {
        subJson = data[r][1];
        break;
      }
    }

    if (!subJson) return;

    const cloudUrl = getConfig_('cloud_run_url') + '/internal/send-push';
    const payload = {
      integration_secret: getConfig_('integration_secret'),
      subscription_json: subJson,
      title: titulo,
      body: mensagem,
      url: url
    };

    UrlFetchApp.fetch(cloudUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (e) {
    console.log('Erro ao enviar Push:', e.message);
  }
}

/**
 * Sincroniza TUDO com o Cloud Run (Grupos, Slots, Academy).
 * Pública para execução manual no editor do Apps Script.
 */
function internalSyncAll() {
  try {
    sincronizarGruposCache_();
    if (typeof sincronizarAcademyCache_ === 'function') sincronizarAcademyCache_();
    sincronizarCacheGlobal_();
    return { ok: true, mensagem: 'Sincronização global disparada.' };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

/**
 * Sincroniza dados das abas principais para o Cloud Run.
 */
function sincronizarCacheGlobal_() {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  
  function getTab(name) {
    const ws = ss.getSheetByName(name);
    if (!ws) return [];
    const data = ws.getDataRange().getValues();
    if (data.length < 2) return [];
    const h = data[0].map(v => String(v).toLowerCase().trim());
    const rows = [];
    for (let r = 1; r < data.length; r++) {
      // Remover valores vazios no fim
      if (data[r].join('').trim() === '') continue;
      
      const obj = {};
      h.forEach((col, i) => {
        let val = data[r][i];
        if (val instanceof Date) val = val.toISOString();
        obj[col] = val;
      });
      rows.push(obj);
    }
    return rows;
  }

  const payload = {
    integration_secret: getConfig_('integration_secret'),
    promotores: getTab('PROMOTORES'),
    slots: getTab('SLOTS'),
    jornadas: getTab('JORNADAS'),
    turnos_clt: getTab('TURNOS_CLT'),
    fsm_transicoes: getTab('FSM_TRANSICOES')
  };

  const url = getConfig_('cloud_run_url') + '/internal/sync-all';
  try {
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    console.log('Cache Global sincronizado.');
  } catch (e) {
    console.log('Erro sync global:', e.message);
  }
}

/**
 * Sincroniza as regras de grupos de Telegram com o Cloud Run.
 */
function sincronizarGruposCache_() {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws = ss.getSheetByName('GRUPOS_TELEGRAM');
  if (!ws) return;

  const data = ws.getDataRange().getValues();
  const h = data[0].map(v => String(v).toLowerCase().trim());
  const grupos = [];

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][h.indexOf('ativo')]).trim().toUpperCase() !== 'SIM') continue;
    grupos.push({
      cidade: String(data[r][h.indexOf('cidade')] || '').trim(),
      operacao: String(data[r][h.indexOf('operacao')] || '').trim(),
      topico_key: String(data[r][h.indexOf('topico_key')] || '').trim(),
      chat_id: String(data[r][h.indexOf('chat_id')] || '').trim(),
      topic_id: String(data[r][h.indexOf('topic_id')] || '').trim()
    });
  }

  const url = getConfig_('cloud_run_url') + '/internal/sync-groups';
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      integration_secret: getConfig_('integration_secret'),
      grupos: grupos
    }),
    muteHttpExceptions: true
  });
  console.log('Grupos sincronizados com Cloud Run.');
}

/**
 * Limpeza Automática de Dados (Data Retention)
 * Remove SLOTS e JORNADAS com mais de 14 dias para evitar lentidão.
 * Configurar no Google Apps Script: "Gatilhos (Triggers) > time-driven > Semanal > Segunda-feira > 03:00 às 04:00"
 */
function limparDadosAntigos_() {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const limiteMs = new Date().getTime() - (14 * 24 * 60 * 60 * 1000); // 14 dias atrás
  
  const abasParaLimpar = ['SLOTS', 'JORNADAS'];
  
  abasParaLimpar.forEach(nomeAba => {
    const ws = ss.getSheetByName(nomeAba);
    if (!ws) return;
    
    const data = ws.getDataRange().getValues();
    if (data.length < 2) return;
    
    const h = data[0].map(v => String(v).toLowerCase().trim());
    let indexData = h.indexOf('data');
    if (indexData === -1) indexData = h.indexOf('atualizado_em'); // fallback para JORNADAS
    if (indexData === -1) return;
    
    let deletadas = 0;
    
    // Reverse loop para não quebrar os índices durante a exclusão
    for (let r = data.length - 1; r >= 1; r--) {
      let valorData = data[r][indexData];
      if (!valorData) continue;
      
      let dataLinhaMs = new Date(valorData).getTime();
      if (dataLinhaMs < limiteMs) {
        ws.deleteRow(r + 1);
        deletadas++;
      }
    }
    console.log(`Limpeza: ${deletadas} linhas apagadas na aba ${nomeAba}.`);
  });
}

/**
 * Normaliza uma string removendo acentos e convertendo para minúsculas.
 */
function normStr_(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}