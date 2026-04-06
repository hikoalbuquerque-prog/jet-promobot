/**
 * Script de Automação de Testes - Fiscal JET (Fase 8)
 * Este script configura o ambiente necessário na Planilha Master para testar o perfil CLT de Fiscal.
 */

function configurarTesteFiscal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Configuração da Aba PERFIL_CLT
  let wsPerfil = ss.getSheetByName('PERFIL_CLT');
  if (!wsPerfil) {
    wsPerfil = ss.insertSheet('PERFIL_CLT');
    const headPerfil = [
      "user_id", "ativo", "perfil_id", "nome_completo", "cargo_clt", 
      "zona_nome", "zona_lat_centro", "zona_lng_centro", "zona_raio_km", 
      "zona_poligono_json", "horas_semanais_contrato", "turno_padrao", 
      "folga_semanal_dia", "folga_movel_regra", "cidade_base"
    ];
    wsPerfil.appendRow(headPerfil);
    wsPerfil.getRange(1, 1, 1, headPerfil.length).setFontWeight("bold").setBackground("#f3f3f3");
  }
  
  const poligonoTeste = JSON.stringify({
    "type": "FeatureCollection",
    "features": [{
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-46.64,-23.56],[-46.62,-23.56],[-46.62,-23.54],[-46.64,-23.54],[-46.64,-23.56]]]
      },
      "properties": {}
    }]
  });
  
  wsPerfil.appendRow([
    "TEST_FIS_001", "SIM", "PER_FIS_001", "Fiscal Teste JET", "FISCAL", 
    "ZONA TESTE SP", -23.5505, -46.6333, 5, poligonoTeste, 
    44, "FLEXIVEL", 0, "NENHUMA", "São Paulo"
  ]);

  // 2. Configuração da Aba TURNOS_CLT
  let wsTurnos = ss.getSheetByName('TURNOS_CLT');
  if (!wsTurnos) {
    wsTurnos = ss.insertSheet('TURNOS_CLT');
    const headTurnos = [
      "turno_id", "user_id", "data", "inicio", "fim", "status", 
      "zona_nome", "zona_lat", "zona_lng", "ponto_referencia", 
      "horas_turno", "checkin_hora", "checkout_hora", "duracao_real_horas"
    ];
    wsTurnos.appendRow(headTurnos);
    wsTurnos.getRange(1, 1, 1, headTurnos.length).setFontWeight("bold").setBackground("#f3f3f3");
  }
  
  // Criar turno para hoje (06/04/2026)
  wsTurnos.appendRow([
    "TUR_FIS_001", "TEST_FIS_001", "2026-04-06", "08:00", "17:00", 
    "PLANEJADO", "ZONA TESTE SP", -23.5505, -46.6333, "Base SP", 9, "", "", ""
  ]);

  // 3. Configuração da Aba REGRAS_FOLGA
  let wsRegras = ss.getSheetByName('REGRAS_FOLGA');
  if (!wsRegras) {
    wsRegras = ss.insertSheet('REGRAS_FOLGA');
    const headRegras = [
      "cargo_clt", "tipo_regra", "dia_semana", "ativo", 
      "n_ocorrencia_mes", "ciclo_trabalho", "ciclo_folga"
    ];
    wsRegras.appendRow(headRegras);
    wsRegras.getRange(1, 1, 1, headRegras.length).setFontWeight("bold").setBackground("#f3f3f3");
  }
  
  wsRegras.appendRow(["FISCAL", "FIXO_SEMANAL", 0, "SIM", 0, 0, 0]);
  
  // 4. Verificação de Aba SOLICITACOES_OPERACIONAIS (Metas)
  if (!ss.getSheetByName('SOLICITACOES_OPERACIONAIS')) {
    let wsSol = ss.insertSheet('SOLICITACOES_OPERACIONAIS');
    const headSol = ["solicitacao_id", "tipo", "user_id", "slot_id", "jornada_id", "cidade", "status", "descricao", "foto_url", "criado_em", "atualizado_em", "finalizado_em"];
    wsSol.appendRow(headSol);
  }

  // 5. Verificação de Aba BANCO_HORAS
  if (!ss.getSheetByName('BANCO_HORAS')) {
    let wsBH = ss.insertSheet('BANCO_HORAS');
    const headBH = ["user_id", "nome_completo", "semana_inicio", "horas_contrato", "horas_realizadas", "saldo_horas"];
    wsBH.appendRow(headBH);
    // Adicionar saldo inicial para o fiscal de teste nesta semana (Início 06/04/2026)
    wsBH.appendRow(["TEST_FIS_001", "Fiscal Teste JET", "2026-04-06", 44, 0, -44]);
  }

  // 6. Cadastro de Login na aba PROMOTORES
  let wsLogin = ss.getSheetByName('PROMOTORES');
  if (wsLogin) {
    const dataL = wsLogin.getDataRange().getValues();
    const hL = dataL[0].map(v => String(v).toLowerCase().trim());
    const iCpf = hL.indexOf('cpf');
    let jaExiste = false;
    for (let i = 1; i < dataL.length; i++) {
      if (String(dataL[i][iCpf]).replace(/\D/g, '') === '12345678901') {
        jaExiste = true;
        break;
      }
    }
    if (!jaExiste) {
      // Criar linha com as colunas mínimas para login CLT
      const novaLinha = hL.map(h => {
        if (h === 'user_id') return 'TEST_FIS_001';
        if (h === 'nome_completo') return 'Fiscal Teste JET';
        if (h === 'cpf') return '12345678901';
        if (h === 'senha_hash') return '01012000'; // Senha para o teste
        if (h === 'ativo') return 'SIM';
        if (h === 'cargo_principal') return 'FISCAL';
        if (h === 'tipo_vinculo') return 'CLT';
        if (h === 'operacao') return 'PROMO';
        if (h === 'cidade_base') return 'São Paulo';
        if (h === 'token') return 'TK_TEST_FIS_001';
        return '';
      });
      wsLogin.appendRow(novaLinha);
    }
  }

  Logger.log('Configuração completa: TEST_FIS_001 pronto para teste.');
  try {
    const ui = SpreadsheetApp.getUi();
    if (ui) ui.alert('Perfil de Teste do Fiscal configurado com sucesso!');
  } catch (e) {
    Logger.log('Aviso: Não foi possível exibir o alerta visual, mas os dados foram inseridos.');
  }
}
