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
  }
}

function getTelegramUserId_(ss, userId) {
  const ws = ss.getSheetByName('PROMOTORES');
  const data = ws.getDataRange().getValues();
  const h = data[0].map(v => String(v).toLowerCase().trim());
  const iId = h.indexOf('user_id'), iTg = h.indexOf('telegram_user_id');
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iId]).trim() === userId) return data[r][iTg] || null;
  }
  return null;
}

function registrarFotoEvidencia_(user, params) {
  const { url, tipo } = params;
  if (!url) return { ok: false, erro: 'URL obrigatória' };
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws = ss.getSheetByName('EVIDENCIAS_FOTOS');
  if (ws) ws.appendRow([gerarId_('IMG'), user.user_id, tipo || 'GERAL', url, new Date().toISOString()]);
  return { ok: true };
}

function internalGetSlot_(params) {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws = ss.getSheetByName('SLOTS');
  const data = ws.getDataRange().getValues(), h = data[0].map(v => String(v).toLowerCase().trim());
  const iId = h.indexOf('slot_id');
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iId]).trim() === params.slot_id) return { ok: true, slot: rowToObj_(h, data[r]) };
  }
  return { ok: false, erro: 'slot não encontrado' };
}

function getMapaPromotor_(user, params) {
  const ss    = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const wsLoc = ss.getSheetByName('LOCALIZACAO_TEMPO_REAL');
  const wsJor = ss.getSheetByName('JORNADAS');
  if (!wsLoc || !wsJor) return { ok: true, pontos: [] };

  const dataLoc = wsLoc.getDataRange().getValues(), hLoc = dataLoc[0].map(v => String(v).toLowerCase().trim());
  const dataJor = wsJor.getDataRange().getValues(), hJor = dataJor[0].map(v => String(v).toLowerCase().trim());
  
  // Buscar promotores sem usar cache para garantir dados novos no mapa
  const wsP = ss.getSheetByName('PROMOTORES'), dataP = wsP.getDataRange().getValues();
  const hP = dataP[0].map(v => String(v).toLowerCase().trim()), iIdP = hP.indexOf('user_id'), iNomP = hP.indexOf('nome_completo');
  const promMap = {};
  for(let r=1; r<dataP.length; r++) { promMap[String(dataP[r][iIdP]).trim()] = String(dataP[r][iNomP] || ''); }

  const iUsrLoc = hLoc.indexOf('user_id'), iUsrJor = hJor.indexOf('user_id'), iStJor = hJor.indexOf('status'), iUpdLoc = hLoc.indexOf('atualizado_em');
  const iNomJor = hJor.indexOf('nome_completo') > -1 ? hJor.indexOf('nome_completo') : hJor.indexOf('promotor_nome');

  // Mapeia status atual de cada promotor (apenas jornadas de HOJE ou ativas)
  const statusMap = {};
  const hoje = new Date().toISOString().substring(0,10);
  for (let r = 1; r < dataJor.length; r++) {
    const uid = String(dataJor[r][iUsrJor]).trim();
    const st = String(dataJor[r][iStJor]).trim().toUpperCase();
    const dt = String(dataJor[r][hJor.indexOf('inicio_previsto')] || '').substring(0,10);
    
    if (!uid || (dt !== hoje && !['EM_ATIVIDADE','PAUSADO'].includes(st))) continue;
    
    // Sobrescreve com a mais recente
    statusMap[uid] = { status: st, nome: promMap[uid] || String(dataJor[r][iNomJor] || uid).trim() };
  }

  const role = (user.tipo_vinculo || '').toUpperCase();
  const isGestor = ['GESTOR','FISCAL','LIDER'].includes(role);

  const pontos = [];
  const seen = new Set();
  const agoraMs = new Date().getTime();

  for (let r = dataLoc.length - 1; r >= 1; r--) {
    const uid = String(dataLoc[r][iUsrLoc]).trim();
    if (!uid || seen.has(uid)) continue;
    
    // Ignorar pontos com mais de 12 horas
    const updStr = dataLoc[r][iUpdLoc];
    const updMs = updStr ? new Date(updStr).getTime() : 0;
    if (agoraMs - updMs > 12 * 60 * 60 * 1000) continue;

    seen.add(uid);
    const info = statusMap[uid] || { status: 'OFFLINE', nome: promMap[uid] || uid };
    
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
    if (typeof sincronizarAcademyCache_ === 'function') {
      sincronizarAcademyCache_();
    }
    sincronizarCacheGlobal();
    return { ok: true, mensagem: 'Sincronização global disparada com sucesso.' };
  } catch (e) {
    Logger.log('Erro internalSyncAll: ' + e.message);
    return { ok: false, erro: e.message };
  }
}

/**
 * Sincroniza dados das abas principais para o Cloud Run.
 */
function sincronizarCacheGlobal() {
  try {
    const ssId = getConfig_('spreadsheet_id_master');
    if (!ssId) throw new Error('spreadsheet_id_master não configurado em CONFIG');
    const ss = SpreadsheetApp.openById(ssId);
    
    function getTab(name) {
      const ws = ss.getSheetByName(name);
      if (!ws) return [];
      const data = ws.getDataRange().getValues();
      if (data.length < 2) return [];
      const h = data[0].map(v => String(v).toLowerCase().trim());
      const rows = [];
      for (let r = 1; r < data.length; r++) {
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
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    Logger.log('Sincronização global (Cache) concluída.');
  } catch (e) {
    Logger.log('Erro sincronizarCacheGlobal: ' + e.message);
    throw e;
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
 * Configurar no Google Apps Script: "Gatilhos (Triggers) > Baseado no tempo > Semanal > Segunda-feira > 03:00 às 04:00"
 */
function limparDadosAntigos() {
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

// ==========================================
// Sessões do Bot (Via Sheet BOT_SESSIONS)
// ==========================================
function botGetSession_(params) {
  const tgId = String(params.telegram_user_id || '').trim();
  if (!tgId) return { ok: false, sessao: null };
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  let ws = ss.getSheetByName('BOT_SESSIONS');
  if (!ws) {
    ws = ss.insertSheet('BOT_SESSIONS');
    ws.appendRow(['telegram_user_id', 'estado', 'payload_json', 'atualizado_em']);
    return { ok: true, sessao: null };
  }
  const data = ws.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][0]).trim() === tgId) {
      return { ok: true, sessao: { estado: String(data[r][1] || ''), payload_json: String(data[r][2] || '') } };
    }
  }
  return { ok: true, sessao: null };
}

function botSetSession_(params) {
  const tgId = String(params.telegram_user_id || '').trim();
  if (!tgId) return { ok: false };
  const payloadJson = params.payload_json ? String(params.payload_json) : (params.payload ? JSON.stringify(params.payload) : '{}');
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  let ws = ss.getSheetByName('BOT_SESSIONS');
  if (!ws) {
    ws = ss.insertSheet('BOT_SESSIONS');
    ws.appendRow(['telegram_user_id', 'estado', 'payload_json', 'atualizado_em']);
  }
  const data = ws.getDataRange().getValues();
  let found = false;
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][0]).trim() === tgId) {
      ws.getRange(r + 1, 2, 1, 3).setValues([[params.estado || '', payloadJson, new Date().toISOString()]]);
      found = true;
      break;
    }
  }
  if (!found) {
    ws.appendRow([tgId, params.estado || '', payloadJson, new Date().toISOString()]);
  }
  return { ok: true };
}

function botClearSession_(params) {
  const tgId = String(params.telegram_user_id || '').trim();
  if (!tgId) return { ok: false };
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  let ws = ss.getSheetByName('BOT_SESSIONS');
  if (!ws) return { ok: true };
  const data = ws.getDataRange().getValues();
  for (let r = data.length - 1; r >= 1; r--) {
    if (String(data[r][0]).trim() === tgId) {
      ws.deleteRow(r + 1);
      return { ok: true };
    }
  }
  return { ok: true };
}

/**
 * Força o encerramento de qualquer jornada ativa do promotor (Reset)
 */
function botResetJornada_(params) {
  const tgId = String(params.telegram_user_id || '').trim();
  if (!tgId) return { ok: false, erro: 'telegram_user_id obrigatório' };
  
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const wsP = ss.getSheetByName('PROMOTORES'), dataP = wsP.getDataRange().getValues();
  const hP = dataP[0].map(v => String(v).toLowerCase().trim()), iIdP = hP.indexOf('user_id'), iTgP = hP.indexOf('telegram_user_id');
  
  let userId = null;
  for (let r = 1; r < dataP.length; r++) {
    if (String(dataP[r][iTgP]).trim() === tgId) { userId = String(dataP[r][iIdP]).trim(); break; }
  }
  if (!userId) return { ok: false, erro: 'Promotor não vinculado ao Telegram.' };

  const wsJ = ss.getSheetByName('JORNADAS'), dataJ = wsJ.getDataRange().getValues();
  const hJ = dataJ[0].map(v => String(v).toLowerCase().trim()), iSttJ = hJ.indexOf('status'), iUsrJ = hJ.indexOf('user_id'), iSltJ = hJ.indexOf('slot_id');
  const ativos = ['ACEITO', 'EM_ATIVIDADE', 'PAUSADO', 'AGUARDANDO_RASTREIO', 'EM_TURNO', 'SEM_SINAL', 'MAPEAMENTO_INTERROMPIDO'];
  
  let count = 0;
  const agora = new Date().toISOString();
  for (let r = 1; r < dataJ.length; r++) {
    if (String(dataJ[r][iUsrJ]).trim() === userId && ativos.includes(String(dataJ[r][iSttJ]).trim().toUpperCase())) {
      const slotId = String(dataJ[r][iSltJ]).trim();
      wsJ.getRange(r + 1, iSttJ + 1).setValue('RESET_PELO_BOT');
      if (slotId) atualizarSlotStatus_(ss, slotId, 'DISPONIVEL', agora);
      count++;
    }
  }
  
  return { ok: true, resetados: count };
}

/**
 * Retorna dados resumidos do perfil para o Bot
 */
function botGetPerfil_(params) {
  const tgId = String(params.telegram_user_id || '').trim();
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const wsP = ss.getSheetByName('PROMOTORES'), dataP = wsP.getDataRange().getValues();
  const hP = dataP[0].map(v => String(v).toLowerCase().trim());
  const iId = hP.indexOf('user_id'), iTg = hP.indexOf('telegram_user_id');
  const iNome = hP.indexOf('nome_completo'), iScore = hP.indexOf('score_operacional'), iStreak = hP.indexOf('streak_dias');
  const iCid = hP.indexOf('cidade_base') > -1 ? hP.indexOf('cidade_base') : hP.indexOf('cidade');

  for (let r = 1; r < dataP.length; r++) {
    if (String(dataP[r][iTg]).trim() === tgId) {
      const userId = String(dataP[r][iId]).trim();
      const bloqueio = verificarBloqueiosPromotores_(ss, userId);
      return {
        ok: true,
        nome: iNome > -1 ? String(dataP[r][iNome] || '') : 'Sem Nome',
        cidade: iCid > -1 ? String(dataP[r][iCid] || '') : '',
        score: iScore > -1 ? parseFloat(dataP[r][iScore] || '0') : 0,
        streak: iStreak > -1 ? parseInt(dataP[r][iStreak] || '0') : 0,
        bloqueado: bloqueio.bloqueado,
        motivo_bloqueio: bloqueio.motivo
      };
    }
  }
  return { ok: false, erro: 'Perfil não encontrado.' };
}

// ============================================================
//  Auditoria e Segurança (Anti-Fraude)
// ============================================================

function verificarAlertasFraude_(ss, user, dados) {
  const { score, deviceId, lat, lng } = dados;
  const integracoes = [];
  let alerta = false;
  let motivo = [];

  // 1. Verificar Score de Localização Baixo (Potencial Mock ou GPS ruim)
  if (score < 60) {
    alerta = true;
    motivo.push(`Baixa confiança de localização (Score: ${score}%)`);
  }

  // 2. Verificar duplicidade de Device ID (Mesmo aparelho para usuários diferentes hoje)
  if (deviceId) {
    const wsJ = ss.getSheetByName('JORNADAS');
    if (wsJ) {
      const dataJ = wsJ.getDataRange().getValues(), hJ = dataJ[0].map(v => String(v).toLowerCase().trim());
      const iDev = hJ.indexOf('device_id'), iUsr = hJ.indexOf('user_id'), iStt = hJ.indexOf('status'), iCri = hJ.indexOf('criado_em');
      const hoje = new Date().toISOString().substring(0, 10);
      
      for (let r = 1; r < dataJ.length; r++) {
        const dId = String(dataJ[r][iDev]).trim();
        const uId = String(dataJ[r][iUsr]).trim();
        const cri = String(dataJ[r][iCri]).substring(0, 10);
        const stt = String(dataJ[r][iStt]).toUpperCase();

        if (dId === deviceId && uId !== user.user_id && cri === hoje && !['CANCELADO', 'RESET_PELO_BOT'].includes(stt)) {
          alerta = true;
          motivo.push(`Dispositivo (Device ID) já utilizado hoje pelo usuário ${uId}`);
          break;
        }
      }
    }
  }

  if (alerta) {
    const lideres = _getLideresDoUsuario_(ss, user.user_id);
    const msg = `🚩 <b>ALERTA DE AUDITORIA</b>\n\n👤 <b>${user.nome_completo || user.nome}</b>\n⚠️ Motivo: ${motivo.join('; ')}\n📍 Lat/Lng: ${lat},${lng}\n📱 Device: ${deviceId || 'N/A'}`;

    if (lideres.length > 0) {
      lideres.forEach(lid => {
        if (lid.telegram_user_id) {
          integracoes.push({
            canal: 'telegram',
            tipo: 'private_message',
            telegram_user_id: String(lid.telegram_user_id),
            parse_mode: 'HTML',
            text_html: msg
          });
        }
      });
    }

    // Também envia para o canal de alertas da cidade
    integracoes.push({
      canal: 'telegram',
      tipo: 'group_message',
      cidade: user.cidade_base || user.cidade || '',
      topic_key: 'ALERTAS',
      parse_mode: 'HTML',
      text_html: msg
    });
  }

  return { alerta, integracoes };
}

function _getLideresDoUsuario_(ss, userId) {
  const wsMem = ss.getSheetByName('EQUIPE_MEMBROS');
  if (!wsMem) return [];

  const dataMem = wsMem.getDataRange().getValues(), hMem = dataMem[0].map(v => String(v).toLowerCase().trim());
  const iEq = hMem.indexOf('equipe_id'), iUsr = hMem.indexOf('user_id'), iPpl = hMem.indexOf('papel_na_equipe'), iAto = hMem.indexOf('ativo');
  
  const equipeIds = [];
  for (let r = 1; r < dataMem.length; r++) {
    if (String(dataMem[r][iUsr]).trim() === userId && String(dataMem[r][iAto]).toUpperCase() === 'TRUE') {
      equipeIds.push(String(dataMem[r][iEq]).trim());
    }
  }

  if (equipeIds.length === 0) return [];

  const lideres = [];
  const promMap = _getPromotoresMap_(ss);

  for (let r = 1; r < dataMem.length; r++) {
    const eqId = String(dataMem[r][iEq]).trim();
    const uId = String(dataMem[r][iUsr]).trim();
    const papel = String(dataMem[r][iPpl]).toUpperCase();
    const ativo = String(dataMem[r][iAto]).toUpperCase() === 'TRUE';

    if (equipeIds.includes(eqId) && papel === 'LIDER' && ativo) {
      const p = promMap[uId];
      if (p) lideres.push({ user_id: uId, telegram_user_id: p.telegram_user_id });
    }
  }

  return lideres;
}

// ============================================================
//  Inteligência Artificial (Gemini API)
// ============================================================

/**
 * Chama a API do Gemini para processar textos e gerar insights.
 */
function callGeminiAI_(prompt, systemInstruction = "") {
  const apiKey = getConfig_('gemini_api_key');
  if (!apiKey) {
    console.log('Gemini API Key não encontrada em CONFIG.');
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: (systemInstruction ? systemInstruction + "\n\n" : "") + prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
    }
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const resJson = JSON.parse(response.getContentText());
    if (resJson.candidates && resJson.candidates[0] && resJson.candidates[0].content) {
      return resJson.candidates[0].content.parts[0].text;
    } else {
      console.log('Erro na resposta do Gemini:', response.getContentText());
      return null;
    }
  } catch (e) {
    console.log('Erro ao chamar Gemini:', e.message);
    return null;
  }
}

/**
 * Obtém a previsão do tempo básica para um par de coordenadas.
 * Usa a API do OpenWeather (requer openweather_api_key em CONFIG).
 */
function getPrevisaoClima_(lat, lng) {
  const apiKey = getConfig_('openweather_api_key');
  if (!apiKey) return { ok: false, msg: 'OpenWeather API Key não configurada.' };

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=pt_br`;
  
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const data = JSON.parse(response.getContentText());
    if (data.weather) {
      return {
        ok: true,
        temp: data.main.temp,
        clima: data.weather[0].description,
        icone: data.weather[0].icon,
        chuva: (data.rain && data.rain['1h']) ? data.rain['1h'] : 0,
        nuvens: data.clouds.all
      };
    }
  } catch (e) {}
  return { ok: false };
}

/**
 * Consolida o contexto operacional (Academy e Calculadora) para a IA.
 */
function getOperationalContext_() {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  
  // Contexto da Calculadora (Regras de Comissão)
  const calcRules = `
    REGRAS DE GANHOS (CALCULADORA):
    - Plus R$9,99: Comissão de 90% (R$ 8,99)
    - Plus R$14,99: Comissão de 90% (R$ 13,49)
    - Pacote 60min (R$25,00): Comissão de 15% (R$ 3,75)
    - Pacote 100min (R$44,00): Comissão base 15%, sobe para 20% se vender mais de 10 pacotes (100min ou 200min) na semana.
    - Pacote 200min (R$85,00): Comissão base 15%, sobe para 20% se vender mais de 10 pacotes (100min ou 200min) na semana.
  `;

  // Contexto do Academy (Módulos)
  let academyContext = "MÓDULOS JET ACADEMY:\n";
  const wsMod = ss.getSheetByName('MODULOS');
  if (wsMod) {
    const data = wsMod.getDataRange().getValues();
    const h = data[0].map(v => String(v).toLowerCase().trim());
    for (let r = 1; r < data.length; r++) {
      if (String(data[r][h.indexOf('ativo')]).toUpperCase() === 'TRUE') {
        academyContext += `- ${data[r][h.indexOf('titulo')]} (Nível: ${data[r][h.indexOf('nivel')]})\n`;
      }
    }
  }

  return calcRules + "\n" + academyContext;
}

/**
 * Analisa o risco climático para todos os slots do dia.
 * Deve ser configurado como um gatilho a cada 1 ou 2 horas.
 */
function analisarRiscoClimatico() {
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const hoje = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
  
  // Buscar slots de hoje
  const wsS = ss.getSheetByName('SLOTS');
  if (!wsS) return;
  const sData = wsS.getDataRange().getValues(), sh = sData[0].map(v => String(v).toLowerCase().trim());
  const iLat = sh.indexOf('lat'), iLng = sh.indexOf('lng'), iNom = sh.indexOf('local_nome'), iCid = sh.indexOf('cidade'), iStt = sh.indexOf('status'), iDt = sh.indexOf('data');

  const coordenadasVistas = new Set();
  const alertas = [];

  for (let r = 1; r < sData.length; r++) {
    const dt = String(sData[r][iDt]).substring(0, 10);
    const st = String(sData[r][iStt]).toUpperCase();
    if (dt !== hoje || st === 'CANCELADO') continue;

    const lat = sData[r][iLat], lng = sData[r][iLng];
    const key = `${lat},${lng}`;
    if (coordenadasVistas.has(key)) continue;
    coordenadasVistas.add(key);

    const clima = getPrevisaoClima_(lat, lng);
    if (clima.ok && (clima.chuva > 0 || clima.clima.toLowerCase().includes('chuva') || clima.clima.toLowerCase().includes('tempestade'))) {
      alertas.push({
        cidade: sData[r][iCid],
        local: sData[r][iNom] || 'Ponto Operacional',
        descricao: clima.clima,
        temp: clima.temp,
        chuva: clima.chuva
      });
    }
  }

  if (alertas.length > 0) {
    const resumo = alertas.map(a => `- ${a.cidade} (${a.local}): ${a.descricao} (${a.temp}°C)`).join('\n');
    
    // IA: GERAR INSIGHT OPERACIONAL
    const insightIA = callGeminiAI_(
      `Temos alerta de chuva nos seguintes pontos operacionais:\n${resumo}\n\nCom base nisso, gere uma recomendação curta e direta para os gestores sobre o que fazer com os patinetes e as equipes nestas cidades.`,
      "Você é o Diretor de Operações Logísticas da JET. Seja pragmático e focado em segurança e preservação do patrimônio."
    );

    if (insightIA) {
      processIntegracoes([{
        canal: 'telegram', tipo: 'group_message',
        cidade: 'TODAS', topic_key: 'ALERTAS',
        parse_mode: 'HTML',
        text_html: `⛈️ <b>ALERTA CLIMÁTICO & INSIGHT IA</b>\n\n${insightIA}\n\n<b>Pontos Afetados:</b>\n${resumo}`
      }], { evento: 'ALERTA_CLIMATICO_IA' });
    }
  }
}

function askIAAssistante_(user, params) {
  const pergunta = params.pergunta;
  if (!pergunta) return { ok: false, erro: 'Pergunta vazia.' };

  const operacional = getOperationalContext_();
  const systemPrompt = `Você é o Assistente Virtual da JET Operações. 
  Responda dúvidas de promotores sobre o Academy, Calculadora de Ganhos ou Clima.
  Use este contexto operacional:
  ${operacional}
  
  Seja empático, use emojis e dê respostas curtas e precisas. 
  Se não souber a resposta, peça para falar com o Líder da equipe.`;

  const resposta = callGeminiAI_(pergunta, systemPrompt);
  return { ok: true, resposta: resposta || "Estou com um pouco de instabilidade agora. Tente novamente em alguns segundos!" };
}