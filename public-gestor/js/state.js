// ─── state.js ─────────────────────────────────────────────────────────────────
// Estado global do painel do gestor — persiste sessão no sessionStorage

const STATE_KEY = 'gestor_session';

const state = (() => {
  let _data = {
    gestor: null,       // { token, nome, cargo, tipo_vinculo, equipe_id }
    promotores: [],     // lista atualizada pelo mapa
    slots: [],          // lista atualizada pela aba de slots
    solicitacoes: [],   // lista atualizada pela aba de solicitações
    kpis: {},           // snapshot dos KPIs
  };

  // Restaura sessão salva
  try {
    const saved = sessionStorage.getItem(STATE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.gestor) _data.gestor = parsed.gestor;
    }
  } catch (_) {}

  function _persist() {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({ gestor: _data.gestor }));
    } catch (_) {}
  }

  return {
    get(key) { return _data[key]; },

    set(key, value) {
      _data[key] = value;
      if (key === 'gestor') _persist();
    },

    isAuthenticated() {
      return !!_data.gestor?.token;
    },

    clear() {
      _data = { gestor: null, promotores: [], slots: [], solicitacoes: [], kpis: {} };
      sessionStorage.removeItem(STATE_KEY);
    },
  };
})();