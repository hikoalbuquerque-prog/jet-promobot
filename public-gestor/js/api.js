// ─── api.js ───────────────────────────────────────────────────────────────────
// Camada de comunicação com Apps Script (gestor)
const api = (() => {
  function _token() { return state.get('gestor')?.token || ''; }

  async function _get(evento, params = {}) {
    const url = new URL(CONFIG.APPS_SCRIPT_URL);
    url.searchParams.set('evento', evento);
    url.searchParams.set('token', _token());
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.erro || json.mensagem || 'Erro no servidor');
    return json;
  }

  async function _post(evento, body = {}) {
    const payload = { evento, token: _token(), ...body };
    const res = await fetch(CONFIG.CLOUD_RUN_URL + '/app/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.erro || json.mensagem || 'Erro no servidor');
    return json;
  }

  return {
    get(evento, params) { return _get(evento, params); },
    post(evento, body) { return _post(evento, body); },
    getPromotoresAtivos(data)       { return _get('GET_PROMOTORES_ATIVOS', data ? { data } : {}); },
    getSlotsHoje(data)              { return _get('GET_SLOTS_HOJE', data ? { data } : {}); },
    getSolicitacoesAbertas()        { return _get('GET_SOLICITACOES_ABERTAS'); },
    getKpisDia()                    { return _get('GET_KPIS_DIA'); },
    getEquipes()                    { return _get('GET_EQUIPES'); },
    getPromotoresLista()            { return _get('GET_PROMOTORES_LISTA'); },
    salvarEquipe(dados)             { return _post('SALVAR_EQUIPE', dados); },
    getHistoricoLocalizacao(uid, data) { return _get('GET_HISTORICO_LOCALIZACAO', { promotor_id: uid, data }); },
    criarSlot(dados)                { return _post('CRIAR_SLOT', dados); },
    getEscalaDrafts()         { return _get('GET_ESCALA_DRAFTS'); },
    criarEscalaDraft(dados)   { return _post('CRIAR_ESCALA_DRAFT', dados); },
    publicarEscala(draftId)   { return _post('INTERNAL_PUBLICAR_ESCALA', { escala_draft_id: draftId, publicado_por: state.get('gestor')?.user_id || '' }); },
    excluirEscalaDraft(id)    { return _post('EXCLUIR_ESCALA_DRAFT', { escala_draft_id: id }); },
    getSugestoesEscala(params)           { return _get('GET_SUGESTOES_ESCALA', params); },
    getTurnosDia(data)                   { return _get('GET_TURNOS_DIA', {data}); },
    getBancoHorasPromotor(uid, semanas)  { return _get('GET_BANCO_HORAS_PROMOTOR', {user_id:uid, semanas}); },
    getHistoricoTurnosCLT(params)        { return _get('GET_HISTORICO_TURNOS_CLT', params); },
    getHistoricoJornadas(params)         { return _get('GET_HISTORICO_JORNADAS_GESTOR', params); },
    criarTurnoCLT(dados)                 { return _post('CRIAR_TURNO_CLT', dados); },
    getCadastrosPendentes()              { return _get('GET_CADASTROS_PENDENTES'); },
    getMeusTurnosCLT()                  { return _get('GET_MEUS_TURNOS_CLT'); },
    aprovarCadastro(dados)               { return _post('APROVAR_CADASTRO', dados); },
    responderSolicitacao(id, decisao, obs) {
      return _post('RESPONDER_SOLICITACAO', { solicitacao_id: id, decisao, observacao: obs || '' });
    },
  };
})();
