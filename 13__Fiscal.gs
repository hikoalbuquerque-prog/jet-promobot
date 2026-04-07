// ============================================================
//  13.Fiscal.gs  — Funções específicas do perfil Fiscal
//  Versão: 1.0  |  Fase 3 — Validação de Dados
// ============================================================

/**
 * Faz o upload de uma imagem em base64 para uma pasta no Google Drive.
 * @param {string} foto_base64 A imagem em formato base64.
 * @param {string} nome_arquivo O nome para o arquivo a ser salvo.
 * @param {string} configKey A chave de configuração para o ID da pasta do Drive (ex: 'drive_folder_id_infracoes').
 * @param {string} estado O nome do estado para organizar a pasta.
 * @param {string} nome_fiscal O nome do fiscal para organizar a pasta.
 * @returns {string} A URL pública do arquivo.
 */
function _uploadFotoParaDrive_(foto_base64, nome_arquivo, configKey = 'drive_folder_id_infracoes', estado = '', nome_fiscal = '') {
  try {
    const baseFolderId = getConfig_(configKey);
    if (!baseFolderId) {
      logErro_('_uploadFotoParaDrive_', new Error(`ID da pasta do Drive não configurado em CONFIG para a chave: ${configKey}`));
      return '';
    }

    let currentFolder = DriveApp.getFolderById(baseFolderId);

    // Create State subfolder if it doesn't exist
    if (estado) {
      let stateFolder = null;
      const folders = currentFolder.getFoldersByName(estado);
      if (folders.hasNext()) {
        stateFolder = folders.next();
      } else {
        stateFolder = currentFolder.createFolder(estado);
      }
      currentFolder = stateFolder;
    }

    // Create Fiscal Name subfolder if it doesn't exist
    if (nome_fiscal) {
      let fiscalFolder = null;
      const folders = currentFolder.getFoldersByName(nome_fiscal);
      if (folders.hasNext()) {
        fiscalFolder = folders.next();
      } else {
        fiscalFolder = currentFolder.createFolder(nome_fiscal);
      }
      currentFolder = fiscalFolder;
    }

    const decoded = Utilities.base64Decode(foto_base64.replace(/^data:image\/(jpeg|png);base64,/, ''));
    const blob = Utilities.newBlob(decoded, 'image/jpeg', nome_arquivo + '.jpg');
    const file = currentFolder.createFile(blob);

    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return file.getUrl().replace(/&export=download$/, '');

  } catch (e) {
    logErro_('_uploadFotoParaDrive_', e);
    return '';
  }
}

/**
 * Registra uma infração reportada por um fiscal.
 * Salva a foto no Drive e os dados na planilha de solicitações.
 */
function registrarInfracaoFiscal_(user, body) {
  const { tipo_infracao, lat, lng, patinete_id, foto_base64 } = body;

  if (!patinete_id || !/^\d{6}$/.test(patinete_id)) {
    throw new Error('ID do patinete inválido (deve ter 6 dígitos).');
  }
  if (!foto_base64) {
    throw new Error('Foto da infração é obrigatória.');
  }

  const agora = new Date();
  const agoraISO = agora.toISOString();
  const nome_arquivo = `infracao_${patinete_id}_${agora.getTime()}`;

  // 1. Fazer upload da foto
  const foto_url = _uploadFotoParaDrive_(foto_base64, nome_arquivo, 'drive_folder_id_infracoes', user.cidade_base || '', user.nome_completo || '');
  if (!foto_url) {
    throw new Error('Falha ao salvar a foto da infração.');
  }

  // 2. Salvar na planilha
  const ss = SpreadsheetApp.openById(getConfig_('spreadsheet_id_master'));
  const ws = ss.getSheetByName('SOLICITACOES_OPERACIONAIS');
  const solId = gerarId_('INF');

  // Adiciona a nova linha com as colunas extras no final
  // ATENÇÃO: Isso pressupõe que a planilha `SOLICITACOES_OPERACIONAIS`
  // tenha as colunas `patinete_id` e `foto_url` adicionadas.
  ws.appendRow([
    solId,                    // solicitacao_id
    tipo_infracao,            // tipo
    user.user_id,             // user_id
    '',                       // slot_id (não aplicável diretamente)
    body.jornada_id || '',    // jornada_id
    user.cidade_base || '',   // cidade
    'CONCLUIDA',              // status
    `[Fiscal] ${tipo_infracao.replace(/_/g, ' ')}`, // descricao
    user.user_id,             // aprovado_por (auto-aprovado)
    agoraISO,                 // criado_em
    agoraISO,                 // atualizado_em
    agoraISO,                 // concluido_em
    patinete_id,              // patinete_id (nova coluna)
    foto_url,                 // foto_url (nova coluna)
    lat || '',                // lat (nova coluna)
    lng || ''                 // lng (nova coluna)
  ]);

  registrarEventoLog_({
    user_id: user.user_id,
    jornada_id: body.jornada_id || '',
    evento: 'REGISTRAR_INFRACAO_FISCAL',
    origem: 'app',
    tipo_evento: 'FISCALIZACAO',
    criticidade: 'atencao',
    payload: { ...body, foto_url },
    horario_servidor: agoraISO
  });

  return { ok: true, solicitacao_id: solId, foto_url: foto_url };
}

/**
 * Analisa o histórico de infrações para gerar um mapa de calor (hotspots).
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss A planilha principal.
 * @returns {Array<Object>} Uma lista de objetos de hotspot.
 */
function _gerarHotspotsInfracoes_(ss) {
  const ws = ss.getSheetByName('SOLICITACOES_OPERACIONAIS');
  if (!ws) return [];

  const data = ws.getDataRange().getValues();
  const h = data[0].map(v => String(v).toLowerCase().trim());
  const iTipo = h.indexOf('tipo');
  const iLat = h.indexOf('lat');
  const iLng = h.indexOf('lng');
  const iCriado = h.indexOf('criado_em');

  if (iLat === -1 || iLng === -1) return []; // Colunas de GPS não existem

  const tiposInfracao = [
    'DUAS_PESSOAS', 'MENOR_IDADE', 'ESTACIONAMENTO_IRREGULAR',
    'TRANSITO_PERIGOSO', 'DANO_INTENCIONAL'
  ];
  
  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const locationCounts = {};

  for (let r = 1; r < data.length; r++) {
    const tipo = String(data[r][iTipo]);
    const lat = parseFloat(data[r][iLat]);
    const lng = parseFloat(data[r][iLng]);
    const criadoEm = new Date(data[r][iCriado]);

    if (tiposInfracao.includes(tipo) && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && criadoEm >= trintaDiasAtras) {
      // Agrupa por coordenadas arredondadas para criar "clusters"
      const key = lat.toFixed(3) + ',' + lng.toFixed(3);
      if (!locationCounts[key]) {
        locationCounts[key] = { lat: lat, lng: lng, count: 0 };
      }
      locationCounts[key].count++;
    }
  }

  const hotspots = Object.values(locationCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5) // Pega os 5 locais com mais infrações
    .map((spot, index) => ({
      nome: `Hotspot #${index + 1} (Histórico)`,
      lat: spot.lat,
      lng: spot.lng,
      descricao: `${spot.count} infrações recentes nesta área.`,
      tipo: 'HOTSPOT'
    }));

  return hotspots;
}
