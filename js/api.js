const API_URL = (window.APP_CONFIG && window.APP_CONFIG.API_URL)
  || 'https://promo-telegram-gateway-v3-476120210909.southamerica-east1.run.app';

async function _parseResponse(res) {
  const isJson = res.headers.get('content-type')?.includes('application/json');
  if (isJson) {
    const data = await res.json();
    if (!res.ok && !data.ok) {
      // Se a resposta tem ok:false e status de erro, retornamos o JSON 
      // para que o chamador possa tratar a mensagem de erro específica (ex: bloqueio)
      return data;
    }
    return data;
  }
  if (!res.ok) throw new Error(`Erro de conexão (${res.status}).`);
  return res.text();
}

const api = {
  // GET → /app/query?evento=...&token=...
  async get(evento, params = {}) {
    const token = state.get('token');
    const device_info = navigator.userAgent || 'unknown';
    const query = { ...params, evento, token: token || '', device_info };
    const qs = new URLSearchParams(query).toString();
    const res = await fetch(`${API_URL}/app/query?${qs}`);
    return _parseResponse(res);
  },

  // POST → /app/event  { evento, token, ...body }
  async post(body, options = {}) {
    const token = options.tokenOverride ?? state.get('token');
    const device_info = navigator.userAgent || 'unknown';
    const payload = options.skipToken ? { ...body, device_info } : { ...body, token, device_info };
    const res = await fetch(`${API_URL}/app/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return _parseResponse(res);
  },

  getHistoricoTurnosCLT() {
    return this.get('GET_HISTORICO_TURNOS_CLT_PROPRIO');
  }
};
