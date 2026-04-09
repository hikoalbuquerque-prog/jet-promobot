// ============================================================
//  09.Precadastro.gs  — Fluxo de cadastro e aprovação
//  Versão: 2.1  |  Fase 3 — Limpeza e Padronização
// ============================================================

function botPrecadastro_(body) {
  var ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  var ws = ss.getSheetByName('CADASTROS_PENDENTES');
  if (!ws) {
    ws = ss.insertSheet('CADASTROS_PENDENTES');
    ws.appendRow(['id','telegram_user_id','telegram_nome','nome_completo','cargo','cidade','cpf','data_nascimento','status','criado_em']);
  }
  var id = 'CAD_' + new Date().getTime();
  ws.appendRow([id, body.telegram_user_id || '', body.telegram_nome || '', body.nome_completo || '', body.cargo || '', body.cidade || '', body.cpf || '', body.data_nascimento || '', 'PENDENTE', new Date().toISOString()]);
  
  // Notificar Gestão sobre Novo Cadastro
  try {
    processIntegracoes([{
      canal: 'telegram', tipo: 'group_message',
      cidade: body.cidade || '',
      topic_key: 'ALERTAS',
      parse_mode: 'HTML',
      text_html: `👤 <b>Novo Cadastro Pendente</b>\n\n<b>Nome:</b> ${body.nome_completo}\n<b>Cidade:</b> ${body.cidade}\n<b>Cargo:</b> ${body.cargo}\n\n<i>Acesse o painel para aprovar ou rejeitar.</i>`
    }], { evento: 'NOVO_CADASTRO' });
  } catch(_) {}

  return { ok: true, id: id };
}

function getCadastrosPendentes_(token) {
  _assertGestor_(token);
  var ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  var ws = ss.getSheetByName('CADASTROS_PENDENTES');
  if (!ws) return { ok: true, data: [] };
  var rows = ws.getDataRange().getValues(), h = rows[0].map(function(v){ return String(v).toLowerCase().trim(); });
  var result = [];
  for (var r = 1; r < rows.length; r++) {
    if (!rows[r][0]) continue;
    result.push({
      id:               String(rows[r][h.indexOf('id')]               || ''),
      telegram_user_id: String(rows[r][h.indexOf('telegram_user_id')] || ''),
      telegram_nome:    String(rows[r][h.indexOf('telegram_nome')]    || ''),
      nome_completo:    String(rows[r][h.indexOf('nome_completo')]    || ''),
      cargo:            String(rows[r][h.indexOf('cargo')]            || ''),
      cidade:           String(rows[r][h.indexOf('cidade')]           || ''),
      cpf:              String(rows[r][h.indexOf('cpf')]              || ''),
      data_nascimento:  String(rows[r][h.indexOf('data_nascimento')]  || ''),
      status:           String(rows[r][h.indexOf('status')]           || 'PENDENTE'),
      criado_em:        String(rows[r][h.indexOf('criado_em')]        || ''),
    });
  }
  result.sort(function(a,b){ return a.status==='PENDENTE'?-1:1; });
  return { ok: true, data: result };
}

function aprovarCadastro_(token, body) {
  _assertGestor_(token);
  var ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  var wsCad = ss.getSheetByName('CADASTROS_PENDENTES');
  if (!wsCad) throw new Error('Aba CADASTROS_PENDENTES nao encontrada.');
  var rows = wsCad.getDataRange().getValues(), h = rows[0].map(function(v){ return String(v).toLowerCase().trim(); });

  var rowIdx = -1;
  for (var r = 1; r < rows.length; r++) { if (String(rows[r][h.indexOf('id')]).trim() === body.id) { rowIdx = r; break; } }
  if (rowIdx < 0) throw new Error('Cadastro nao encontrado: ' + body.id);

  var novoStatus = body.status || 'APROVADO';
  wsCad.getRange(rowIdx+1, h.indexOf('status')+1).setValue(novoStatus);
  if (novoStatus !== 'APROVADO') return { ok: true };

  var cad = rows[rowIdx], cargo = String(cad[h.indexOf('cargo')] || '').toUpperCase(), cargosCLT = ['SCOUT','CHARGER','MOTORISTA','FISCAL'], ehCLT = cargosCLT.indexOf(cargo) >= 0;
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', sufixo = '';
  for (var i = 0; i < 6; i++) sufixo += chars[Math.floor(Math.random() * chars.length)];
  var tokenGerado = body.token_override || ('TKN_' + sufixo), uid = 'USR_' + new Date().getTime(), agora = new Date().toISOString();

  var wsProm = ss.getSheetByName('PROMOTORES'), hp = wsProm.getRange(1,1,1,wsProm.getLastColumn()).getValues()[0].map(v=>String(v).toLowerCase().trim());
  var row = new Array(hp.length).fill('');
  function sc(col, val) { var i = hp.indexOf(col); if (i >= 0) row[i] = val; }

  sc('user_id', uid); sc('nome_completo', String(cad[h.indexOf('nome_completo')] || ''));
  sc('cidade_base', String(cad[h.indexOf('cidade')] || '')); sc('cargo_principal', cargo);
  sc('tipo_vinculo', cargo === 'FISCAL' ? 'FISCAL' : (ehCLT ? 'CLT' : 'MEI'));
  sc('operacao', 'PROMO'); sc('telegram_user_id', String(cad[h.indexOf('telegram_user_id')] || ''));
  sc('ativo', true); sc('criado_em', agora); sc('atualizado_em', agora); sc('token', tokenGerado);
  sc('cpf', String(body.cpf || cad[h.indexOf('cpf')] || '').replace(/\D/g,''));
  sc('senha_hash', String(cad[h.indexOf('data_nascimento')] || '').replace(/\D/g,'').substring(0,8));

  wsProm.appendRow(row);

  if (String(cad[h.indexOf('telegram_user_id')])) {
    processIntegracoes([{ canal:'telegram', tipo:'private_message', telegram_user_id:String(cad[h.indexOf('telegram_user_id')]), parse_mode:'HTML', text_html:`\u2705 <b>Cadastro aprovado!</b>\n\nSeu acesso foi liberado.\n\n\u{1F511} CPF: <code>${String(body.cpf||cad[h.indexOf('cpf')]).replace(/\D/g,'')}</code>\n\u{1F510} Senha: <code>${String(cad[h.indexOf('data_nascimento')]).replace(/\D/g,'').substring(0,8)}</code>\n\n\u{1F4F2} <b>Acesse o app:</b>\n${getConfig_('cloud_run_url')}` }], { evento:'CADASTRO_APROVADO' });
  }
  return { ok: true, user_id: uid, token: tokenGerado };
}