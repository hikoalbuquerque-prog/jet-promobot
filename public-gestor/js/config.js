// ─── config.js ────────────────────────────────────────────────────────────────
// Única fonte de verdade para URLs e constantes do painel do gestor

const CONFIG = {
  CLOUD_RUN_URL: 'https://promo-telegram-gateway-v3-476120210909.southamerica-east1.run.app',
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxsWriuYAFDkqiwDDoKpu0L34u5DGa23rIz4qwN6hLklxw3qnXQrbZXjbut0kSBe56N/exec',

  // Tipos de vínculo autorizados a acessar o painel gestor
  GESTOR_ROLES: ['GESTOR', 'FISCAL', 'LIDER'],

  // Intervalo de atualização do mapa (ms)
  MAP_REFRESH_INTERVAL: 15_000,

  // Intervalo de atualização dos KPIs (ms)
  KPI_REFRESH_INTERVAL: 60_000,
};