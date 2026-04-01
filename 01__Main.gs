// ============================================================
//  01.Main.gs  — Roteamento principal doGet / doPost
//  Versão: 4.0  |  Fase 3 — CLT completo
// ============================================================

function doGet(e) {
  try {
    const params      = e.parameter || {};
    const evento      = (params.evento || params.action || '').toUpperCase();
    const token       = params.token   || '';
    const integSecret = params.integration_secret || '';

    // ── Internos ─────────────────────────────────────────────
    if (integSecret) {
      if (!validarIntegrationSecret_(integSecret)) return jsonResp_({ ok: false, erro: 'integration_secret inválido' }, 401);
      if (evento === 'INTERNAL_LISTAR_SLOTS_DISPONIVEIS') return jsonResp_(internalListarSlotsDisponiveis_(params));
      if (evento === 'INTERNAL_GET_SLOT')                 return jsonResp_(internalGetSlot_(params));
      if (evento === 'BOT_GET_SESSION')                   return jsonResp_(botGetSession_(params));
      return jsonResp_({ ok: false, erro: 'evento interno GET não reconhecido' }, 400);
    }

    if (evento === 'PING') return jsonResp_({ ok: true, ts: new Date().toISOString() });

    const auth = validarToken_(token);
    if (!auth.ok) return jsonResp_(auth, 401);
    const user = auth.user;

    switch (evento) {
      // ── Promotor / MEI ──────────────────────────────────────
      case 'GET_ME':                  return jsonResp_(getMe_(user));
      case 'GET_SLOT_ATUAL':          return jsonResp_(getSlotAtual_(user));
      case 'GET_SLOTS_DISPONIVEIS':   return jsonResp_(getSlotsDisponiveis_(params, user));
      case 'GET_MINHAS_SOLICITACOES': return jsonResp_(getMinhasSolicitacoes_(user));
      case 'GET_HISTORICO':           return jsonResp_(getHistorico_(user, params));
      case 'GET_MAPA_PROMOTOR':       return jsonResp_(getMapaPromotor_(user, params));

      // ── CLT (próprio) ────────────────────────────────────────
      case 'GET_MEUS_TURNOS_CLT':               return jsonResp_(getMeusTurnosCLT_(user));
      case 'GET_MEU_BANCO_HORAS':               return jsonResp_(getMeuBancoHoras_(user));
      case 'GET_HISTORICO_TURNOS_CLT_PROPRIO':  return jsonResp_(getMeusHistoricoTurnosCLT_(user));

      // ── Gestor CLT ───────────────────────────────────────────
      case 'GET_HISTORICO_TURNOS_CLT':          return jsonResp_(getHistoricoTurnosCLT_(token, params));

      // ── Gestor ───────────────────────────────────────────────
      case 'GET_PROMOTORES_ATIVOS':       return jsonResp_(getPromotoresAtivos_(token));
      case 'GET_SLOTS_HOJE':              return jsonResp_(getSlotsHoje_(token));
      case 'GET_SOLICITACOES_ABERTAS':    return jsonResp_(getSolicitacoesAbertas_(token));
      case 'GET_KPIS_DIA':               return jsonResp_(getKpisDia_(token));
      case 'GET_HISTORICO_LOCALIZACAO':   return jsonResp_(getHistoricoLocalizacao_(token, { promotor_id: params.promotor_id, data: params.data }));
      case 'GET_ESCALA_DRAFTS':          return jsonResp_(getEscalaDrafts_(token));

      // ── Gestor CLT ───────────────────────────────────────────
      case 'GET_SUGESTOES_ESCALA':        return jsonResp_(getSugestoesEscala_(token, params));
      case 'GET_TURNOS_DIA':             return jsonResp_(getTurnosDia_(token, params));
      case 'GET_BANCO_HORAS_PROMOTOR':   return jsonResp_(getBancoHorasPromotor_(token, params));

      default:
        return jsonResp_({ ok: false, erro: 'evento GET não reconhecido: ' + evento }, 400);
    }
  } catch (err) {
    logErro_('doGet', err);
    return jsonResp_({ ok: false, erro: err.message }, 500);
  }
}

function doPost(e) {
  try {
    const body        = JSON.parse(e.postData.contents || '{}');
    const evento      = (body.evento || body.action || '').toUpperCase();
    const integSecret = body.integration_secret || '';

    // ── Login CLT — não requer token ─────────────────────────
    if (evento === 'LOGIN_CLT') return jsonResp_(loginCLT_(body));

    // ── Internos ─────────────────────────────────────────────
    if (integSecret) {
      if (!validarIntegrationSecret_(integSecret)) return jsonResp_({ ok: false, erro: 'integration_secret inválido' }, 401);
      switch (evento) {
        case 'INTERNAL_REGISTRAR_SLOT_TELEGRAM_META': return jsonResp_(internalRegistrarSlotTgMeta_(body));
        case 'INTERNAL_LIMPAR_SLOT_TELEGRAM_META':    return jsonResp_(internalLimparSlotTgMeta_(body));
        case 'ACEITAR_SLOT_TELEGRAM':                 return jsonResp_(aceitarSlotTelegram_(body));
        case 'BOT_SET_SESSION':                       return jsonResp_(botSetSession_(body));
        case 'BOT_CLEAR_SESSION':                     return jsonResp_(botClearSession_(body));
        case 'BOT_VINCULAR_PROMOTOR':                 return jsonResp_(botVincularPromotor_(body));
        case 'BOT_UPDATE_PROMOTOR':                   return jsonResp_(botUpdatePromotor_(body));
        case 'INTERNAL_CONFIRMAR_PRE_JORNADA':        return jsonResp_(confirmarPreJornada_(body));
        case 'INTERNAL_PUBLICAR_ESCALA':              return jsonResp_(publicarEscala_(body));
        case 'CRIAR_ESCALA_DRAFT':                    return jsonResp_(criarEscalaDraft_(body.token, body));
        case 'EXCLUIR_ESCALA_DRAFT':                  return jsonResp_(excluirEscalaDraft_(body.token, body));
        default: return jsonResp_({ ok: false, erro: 'evento interno POST não reconhecido' }, 400);
      }
    }

    // ── Públicos ─────────────────────────────────────────────
    const auth = validarToken_(body.token || '');
    if (!auth.ok) return jsonResp_(auth, 401);
    const user = auth.user;

    switch (evento) {
      // ── Auth ────────────────────────────────────────────────
      case 'VALIDAR_TOKEN': return jsonResp_(auth);

      // ── FSM MEI ─────────────────────────────────────────────
      case 'ACEITAR_SLOT':                return jsonResp_(processarFSM_(user, body, 'ACEITAR_SLOT'));
      case 'CHECKIN':                     return jsonResp_(processarFSM_(user, body, 'CHECKIN'));
      case 'PAUSE':                       return jsonResp_(processarFSM_(user, body, 'PAUSE'));
      case 'RESUME':                      return jsonResp_(processarFSM_(user, body, 'RESUME'));
      case 'CHECKOUT':                    return jsonResp_(processarFSM_(user, body, 'CHECKOUT'));
      case 'CHECKOUT_EXCEPCIONAL':        return jsonResp_(processarFSM_(user, body, 'CHECKOUT_EXCEPCIONAL'));
      case 'CANCELAR_SLOT':               return jsonResp_(cancelarSlot_(user, body));

      // ── Solicitações ─────────────────────────────────────────
      case 'SOLICITAR_REALOCACAO':        return jsonResp_(abrirSolicitacao_(user, body, 'REALOCACAO'));
      case 'SOLICITAR_REFORCO_PATINETES': return jsonResp_(abrirSolicitacao_(user, body, 'REFORCO_PATINETES'));
      case 'SOLICITAR_TROCA_BATERIA':     return jsonResp_(abrirSolicitacao_(user, body, 'TROCA_BATERIA'));
      case 'REGISTRAR_OCORRENCIA':        return jsonResp_(abrirSolicitacao_(user, body, 'OCORRENCIA'));
      case 'MARCAR_SOLICITACAO_ATENDIDA': return jsonResp_(marcarSolicitacaoAtendida_(user, body));
      case 'CANCELAR_SOLICITACAO':        return jsonResp_(cancelarSolicitacao_(user, body));

      // ── Resultados / Heartbeat ───────────────────────────────
      case 'REGISTRAR_RESULTADO_VENDAS':  return jsonResp_(registrarResultadoVendas_(user, body));
      case 'REGISTRAR_MOVIMENTACAO':      return jsonResp_(registrarMovimentacao_(user, body));
      case 'HEARTBEAT':                   return jsonResp_(processarHeartbeat_(user, body));

      // ── Slots ────────────────────────────────────────────────
      case 'CRIAR_SLOT':                  return jsonResp_(criarSlot_(body.token, body));

      // ── CLT (próprio) ────────────────────────────────────────
      case 'CONFIRMAR_TURNO_CLT':         return jsonResp_(confirmarTurnoCLT_(user, body));
      case 'CHECKIN_TURNO_CLT':           return jsonResp_(checkinTurnoCLT_(user, body));
      case 'CHECKOUT_TURNO_CLT':          return jsonResp_(checkoutTurnoCLT_(user, body));
      case 'PAUSAR_TURNO_CLT':            return jsonResp_(pausarTurnoCLT_(user, body));
      case 'RETOMAR_TURNO_CLT':           return jsonResp_(retomarTurnoCLT_(user, body));
      case 'HEARTBEAT_CLT':               return jsonResp_(heartbeatCLT_(user, body));
      
      // ── Gestor ───────────────────────────────────────────────
      case 'RESPONDER_SOLICITACAO':       return jsonResp_(responderSolicitacao_(body.token, body));
      case 'CRIAR_TURNO_CLT':             return jsonResp_(criarTurnoCLT_(body.token, body));

      default:
        return jsonResp_({ ok: false, erro: 'evento POST não reconhecido: ' + evento }, 400);
    }
  } catch (err) {
    logErro_('doPost', err);
    return jsonResp_({ ok: false, erro: err.message }, 500);
  }
}

// ── Helpers de resposta ──────────────────────────────────────
function jsonResp_(data, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function logErro_(origem, err) {
  try {
    const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
    const ws = ss.getSheetByName('EVENT_LOG');
    if (!ws) return;
    ws.appendRow([
      gerarId_('LOG'), gerarId_('EVT'), '', '', '', '',
      'ERRO_SISTEMA', '', '', 'sistema', 'TECNICO', 'critico',
      JSON.stringify({ origem, mensagem: err.message, stack: err.stack }),
      new Date().toISOString(), '', ''
    ]);
  } catch (_) {}
}