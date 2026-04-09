/**
 * Script de Automação de Testes - Fiscal JET (Fase 8) - Versão Header-Aware
 * Este script identifica a ordem das colunas da sua planilha e insere os dados corretamente.
 */

function configurarTesteFiscal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const agora = new Date().toISOString();
  
  // Função auxiliar para inserir dados respeitando os cabeçalhos
  const appendRowAware = (sheetName, dataObj) => {
    let ws = ss.getSheetByName(sheetName);
    if (!ws) return;
    const headers = ws.getDataRange().getValues()[0].map(h => String(h).toLowerCase().trim());
    const row = headers.map(h => dataObj[h] !== undefined ? dataObj[h] : "");
    ws.appendRow(row);
  };

  // 1. Configuração do Perfil CLT
  const perfilData = {
    "perfil_id": "PER_FIS_001",
    "user_id": "TEST_FIS_001",
    "nome_completo": "Fiscal Teste JET",
    "cargo_clt": "FISCAL",
    "zona_nome": "ZONA TESTE SP",
    "zona_lat_centro": -23.5505,
    "zona_lng_centro": -46.6333,
    "zona_raio_km": 5,
    "zona_poligono_json": JSON.stringify({"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-46.64,-23.56],[-46.62,-23.56],[-46.62,-23.54],[-46.64,-23.54],[-46.64,-23.56]]]},"properties":{}}]}),
    "horas_semanais_contrato": 44,
    "turno_padrao": "FLEXIVEL",
    "folga_semanal_dia": 0,
    "folga_movel_regra": "NENHUMA",
    "ativo": "SIM",
    "cidade_base": "São Paulo",
    "criado_em": agora,
    "atualizado_em": agora
  };
  appendRowAware('PERFIL_CLT', perfilData);

  // 2. Configuração do Login (PROMOTORES)
  const loginData = {
    "user_id": "TEST_FIS_001",
    "nome_completo": "Fiscal Teste JET",
    "cpf": "12345678901",
    "senha_hash": "01012000",
    "tipo_vinculo": "CLT",
    "operacao": "PROMO",
    "cargo_principal": "FISCAL",
    "ativo": "SIM",
    "cidade_base": "São Paulo",
    "token": "TK_TEST_FIS_001",
    "criado_em": agora,
    "atualizado_em": agora
  };
  appendRowAware('PROMOTORES', loginData);

  // 3. Configuração do Turno (TURNOS_CLT)
  const turnoData = {
    "turno_id": "TUR_FIS_001",
    "user_id": "TEST_FIS_001",
    "data": "2026-04-06",
    "inicio": "08:00",
    "fim": "17:00",
    "status": "PLANEJADO",
    "zona_nome": "ZONA TESTE SP",
    "zona_lat": -23.5505,
    "zona_lng": -46.6333,
    "ponto_referencia": "Base SP",
    "horas_turno": 9
  };
  appendRowAware('TURNOS_CLT', turnoData);

  // 4. Configuração das Regras de Folga
  const regraData = {
    "cargo_clt": "FISCAL",
    "tipo_regra": "FIXO_SEMANAL",
    "dia_semana": 0,
    "ativo": "SIM"
  };
  appendRowAware('REGRAS_FOLGA', regraData);

  // 5. Configuração do Banco de Horas
  const bancoData = {
    "user_id": "TEST_FIS_001",
    "nome_completo": "Fiscal Teste JET",
    "semana_inicio": "2026-04-06",
    "horas_contrato": 44,
    "horas_realizadas": 0,
    "saldo_horas": -44
  };
  appendRowAware('BANCO_HORAS', bancoData);

  Logger.log('Configuração Realinhada: TEST_FIS_001 configurado respeitando seus cabeçalhos.');
  try {
    const ui = SpreadsheetApp.getUi();
    if (ui) ui.alert('Teste do Fiscal REALINHADO com sucesso!');
  } catch (e) {}
}
