// ============================================================
//  02.Auth.gs  — Autenticação por token e GET_ME
//  Versão: 2.1  |  Fase 3 — Integrado com Multi-slots
// ============================================================

function validarToken_(token) {
  if (!token) return { ok: false, erro: 'token ausente' };
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws = ss.getSheetByName('PROMOTORES');
  if (!ws) return { ok: false, erro: 'aba PROMOTORES não encontrada' };

  const data = ws.getDataRange().getValues();
  const headers = data[0].map(h => String(h).toLowerCase().trim());
  const iToken  = headers.indexOf('token');
  const iAtivo  = headers.indexOf('ativo');

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (String(row[iToken]).trim() !== token) continue;
    if (String(row[iAtivo]).toLowerCase() === 'false') {
      return { ok: false, erro: 'usuário inativo' };
    }
    return { ok: true, user: rowToUser_(headers, row) };
  }
  return { ok: false, erro: 'token inválido' };
}

function validarIntegrationSecret_(secret) {
  return secret === getConfig_('cloud_run_shared_secret');
}

function getMe_(user) {
  return { ok: true, user };
}

function rowToUser_(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
  
  // Identificação de Perfil CLT (Fase 8)
  const cargosCLT = ['SCOUT', 'CHARGER', 'MOTORISTA', 'FISCAL', 'LIDER', 'GESTOR'];
  const cargo = String(obj.cargo_principal || '').toUpperCase().trim();
  obj.eh_clt = cargosCLT.includes(cargo);
  
  // Nunca expor token ou senha_hash sensível no objeto user público
  delete obj.token;
  delete obj.senha_hash;
  return obj;
}

function botVincularPromotor_(body) {
  const { promotor_id, telegram_user_id, cidade } = body;
  if (!promotor_id || !telegram_user_id) return { ok: false, erro: 'promotor_id e telegram_user_id obrigatórios' };

  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws = ss.getSheetByName('PROMOTORES');
  const data = ws.getDataRange().getValues();
  const headers = data[0].map(h => String(h).toLowerCase().trim());

  const iId        = headers.indexOf('user_id');
  const iTgId      = headers.indexOf('telegram_user_id');
  const iCidade    = headers.indexOf('cidade_base');
  const iUpdatedAt = headers.indexOf('atualizado_em');

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iId]).trim() !== promotor_id) continue;
    const tgExistente = verificarTgIdEmUso_(data, headers, telegram_user_id, promotor_id);
    if (tgExistente) return { ok: false, erro: 'telegram_user_id já vinculado a outro promotor' };

    ws.getRange(r + 1, iTgId + 1).setValue(telegram_user_id);
    if (cidade) ws.getRange(r + 1, iCidade + 1).setValue(cidade);
    ws.getRange(r + 1, iUpdatedAt + 1).setValue(new Date().toISOString());

    registrarAuditoria_({ tabela: 'PROMOTORES', registro_id: promotor_id, campo: 'telegram_user_id', valor_anterior: '', valor_novo: telegram_user_id, alterado_por: 'bot', origem: 'bot' });
    return { ok: true, mensagem: 'Promotor vinculado com sucesso', promotor_id, telegram_user_id };
  }
  return { ok: false, erro: 'promotor_id não encontrado' };
}

function botUpdatePromotor_(body) {
  const { telegram_user_id, nome_completo, cidade, cargo } = body;
  if (!telegram_user_id) return { ok: false, erro: 'telegram_user_id obrigatório' };

  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws = ss.getSheetByName('PROMOTORES');
  const data = ws.getDataRange().getValues();
  const headers = data[0].map(h => String(h).toLowerCase().trim());

  const iTgId      = headers.indexOf('telegram_user_id');
  const iNome      = headers.indexOf('nome_completo');
  const iCidade    = headers.indexOf('cidade_base');
  const iCargo     = headers.indexOf('cargo_principal');
  const iUpdatedAt = headers.indexOf('atualizado_em');

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iTgId]).trim() !== String(telegram_user_id)) continue;
    const agora = new Date().toISOString();
    const regId = data[r][0];
    if (nome_completo) {
      const anterior = data[r][iNome];
      ws.getRange(r + 1, iNome + 1).setValue(nome_completo);
      registrarAuditoria_({ tabela: 'PROMOTORES', registro_id: regId, campo: 'nome_completo', valor_anterior: anterior, valor_novo: nome_completo, alterado_por: 'bot', origem: 'bot' });
    }
    if (cidade) {
      const anterior = data[r][iCidade];
      ws.getRange(r + 1, iCidade + 1).setValue(cidade);
      registrarAuditoria_({ tabela: 'PROMOTORES', registro_id: regId, campo: 'cidade_base', valor_anterior: anterior, valor_novo: cidade, alterado_por: 'bot', origem: 'bot' });
    }
    if (cargo) {
      const anterior = data[r][iCargo];
      ws.getRange(r + 1, iCargo + 1).setValue(cargo);
      registrarAuditoria_({ tabela: 'PROMOTORES', registro_id: regId, campo: 'cargo_principal', valor_anterior: anterior, valor_novo: cargo, alterado_por: 'bot', origem: 'bot' });
    }
    ws.getRange(r + 1, iUpdatedAt + 1).setValue(agora);
    return { ok: true, mensagem: 'Dados atualizados com sucesso' };
  }
  return { ok: false, erro: 'telegram_user_id não encontrado' };
}

function getPromotorByTelegramId_(ss, telegramUserId) {
  const ws = ss.getSheetByName('PROMOTORES');
  if (!ws) return null;
  const data = ws.getDataRange().getValues();
  const h = data[0].map(v => String(v).toLowerCase().trim());
  const iTg = h.indexOf('telegram_user_id');
  if (iTg < 0) return null;

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iTg]).trim() === String(telegramUserId)) {
      return rowToUser_(h, data[r]);
    }
  }
  return null;
}

function verificarTgIdEmUso_(data, headers, tgId, excludeUserId) {
  const iTgId = headers.indexOf('telegram_user_id');
  const iId   = headers.indexOf('user_id');
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iTgId]).trim() === String(tgId) && String(data[r][iId]).trim() !== excludeUserId) return true;
  }
  return false;
}

function loginCLT_(params) {
  const cpf   = String(params.cpf   || '').replace(/\D/g, '');
  const senha = String(params.senha  || '').trim();
  if (!cpf || !senha) return { ok: false, erro: 'CPF e senha obrigatórios.' };

  const ss    = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws    = ss.getSheetByName('PROMOTORES');
  const data  = ws.getDataRange().getValues();
  const h     = data[0].map(v => String(v).toLowerCase().trim());

  const iCpf   = h.indexOf('cpf');
  const iSenha = h.indexOf('senha_hash');
  const iToken = h.indexOf('token');
  const iAtivo = h.indexOf('ativo');

  if (iCpf < 0 || iSenha < 0) return { ok: false, erro: 'Colunas CPF/senha não configuradas.' };

  for (let r = 1; r < data.length; r++) {
    const rowCpf   = String(data[r][iCpf]).replace(/\D/g, '');
    const rowSenha = String(data[r][iSenha]).trim();
    const ativo    = String(data[r][iAtivo]).trim().toUpperCase();

    if (rowCpf !== cpf) continue;
    if (rowSenha !== senha) return { ok: false, erro: 'Senha incorreta.' };
    if (ativo !== 'SIM' && ativo !== 'TRUE' && ativo !== '1') return { ok: false, erro: 'Usuário inativo.' };

    const token = String(data[r][iToken]).trim();
    const auth  = validarToken_(token);
    if (!auth.ok) return { ok: false, erro: 'Erro ao carregar perfil.' };

    return { ok: true, token, user: auth.user };
  }

  return { ok: false, erro: 'CPF não encontrado.' };
}

function aceitarLGPD_(user, body) {
  if (!user) return { ok: false, erro: 'Usuário não autenticado (sessão inválida).' };
  
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws = ss.getSheetByName('PROMOTORES');
  if (!ws) return { ok: false, erro: 'Aba PROMOTORES não encontrada.' };
  
  const data = ws.getDataRange().getValues();
  const headers = data[0].map(h => String(h).toLowerCase().trim());
  
  const iId      = headers.indexOf('user_id');
  const iToken   = headers.indexOf('token');
  const iLgpd    = headers.indexOf('lgpd_aceite');
  const iLgpdEm  = headers.indexOf('lgpd_aceite_em');
  
  if (iLgpd < 0 || iLgpdEm < 0) {
    return { ok: false, erro: 'Colunas de LGPD (lgpd_aceite/lgpd_aceite_em) não encontradas na aba PROMOTORES.' };
  }
  
  const targetId = String(user.user_id || '').trim();
  const targetToken = String(body.token || '').trim();
  
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const matchId = iId >= 0 && targetId && String(row[iId]).trim() === targetId;
    const matchToken = iToken >= 0 && targetToken && String(row[iToken]).trim() === targetToken;
    
    if (matchId || matchToken) {
      ws.getRange(r + 1, iLgpd + 1).setValue(true);
      ws.getRange(r + 1, iLgpdEm + 1).setValue(new Date().toISOString());
      
      return { ok: true, mensagem: 'LGPD aceita com sucesso.' };
    }
  }
  
  return { ok: false, erro: 'Usuário não localizado na base para salvar o aceite.' };
}