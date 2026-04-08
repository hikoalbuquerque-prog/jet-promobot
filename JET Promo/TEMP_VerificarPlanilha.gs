/**
 * @OnlyCurrentDoc
 * Esta função temporária verifica a estrutura da planilha principal,
 * listando todas as abas e as colunas das abas críticas.
 */
function TEMP_verificarEstruturaPlanilha() {
  try {
    // Tenta obter o ID da planilha principal a partir da configuração do projeto.
    const ssId = getConfig_('spreadsheet_id_master');
    if (!ssId) {
      Logger.log("ERRO: Não foi possível obter o 'spreadsheet_id_master' nas configurações.");
      return;
    }
    
    const ss = SpreadsheetApp.openById(ssId);
    const todasAsAbas = ss.getSheets().map(sheet => sheet.getName());

    const saida = {
      spreadsheet_id: ssId,
      abas_encontradas: todasAsAbas,
      detalhes_colunas: {}
    };

    const abasParaVerificar = ['TURNOS_CLT', 'AUDITORIA'];
    abasParaVerificar.forEach(nomeAba => {
      const ws = ss.getSheetByName(nomeAba);
      if (ws) {
        // Pega apenas os cabeçalhos da primeira linha.
        const headers = ws.getRange(1, 1, 1, ws.getLastColumn()).getValues()[0];
        saida.detalhes_colunas[nomeAba] = headers;
      } else {
        saida.detalhes_colunas[nomeAba] = 'ABA_NAO_ENCONTRADA';
      }
    });

    // Exibe o resultado nos logs para o usuário copiar.
    Logger.log(JSON.stringify(saida, null, 2));
    
  } catch (e) {
    Logger.log(`ERRO ao executar a verificação: ${e.toString()}`);
  }
}
