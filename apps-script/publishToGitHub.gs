// ============================================================
// STEP 7 — "Publica" button: Sheets -> GitHub
// Adds an "Agenda" menu to the spreadsheet with one item that
// publishes every row with estat = publicat to events.json in
// the GitHub repository, via the GitHub Contents API.
//
// This file lives in the SAME bound Apps Script project as the
// other steps and REUSES helpers/constants from utils.gs:
//   - getSecret, indexDeColumna, textDeCella, NOM_FULL
//
// Script Properties needed (Configuració del projecte >
// Propietats de l'script):
//   GITHUB_OWNER  the GitHub username that owns the repository
//   GITHUB_TOKEN  fine-grained personal access token, scoped to
//                 this repository only, permission "Contents:
//                 Read and write"
// ============================================================

// Fixed coordinates of the published file. The owner comes from
// Script Properties so this code never needs editing.
var GITHUB_REPO = 'agenda-catalogne-nord';
var GITHUB_BRANCH = 'main';
var GITHUB_FILE_PATH = 'events.json';

// ------------------------------------------------------------
// Runs automatically every time the spreadsheet is opened.
// Adds the "Agenda" menu with the publish item. Returns nothing.
// ------------------------------------------------------------
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Agenda')
    .addItem('Publica els esdeveniments aprovats', 'publishToGitHub')
    .addSeparator()
    .addItem('Executa els tests', 'executaTotsElsTests')
    .addToUi();
}

// ------------------------------------------------------------
// Menu entry point. Reads the publicat rows, turns them into
// JSON and uploads them to GitHub. Shows a popup with the result
// (or with the error, so the curator always sees what happened).
// Returns nothing.
// ------------------------------------------------------------
function publishToGitHub() {
  var ui = SpreadsheetApp.getUi();
  try {
    var esdeveniments = llegeixEsdevenimentsPublicats();

    // Publishing zero events would empty the public agenda. That is
    // allowed, but ask first: most of the time it is an oversight.
    if (esdeveniments.length === 0) {
      var resposta = ui.alert(
        'Publicar una llista buida?',
        'No hi ha cap fila amb estat "publicat". Vols publicar igualment una llista buida? El web quedarà sense esdeveniments.',
        ui.ButtonSet.YES_NO
      );
      if (resposta !== ui.Button.YES) {
        return;
      }
    }

    var json = JSON.stringify(esdeveniments, null, 2);
    var contingutBase64 = Utilities.base64Encode(json, Utilities.Charset.UTF_8);

    var owner = getSecret('GITHUB_OWNER');
    var token = getSecret('GITHUB_TOKEN');

    var shaActual = obtenirShaActual(owner, token);
    pujaFitxerAGitHub(owner, token, contingutBase64, shaActual, esdeveniments.length);

    ui.alert('Publicació completada. ' + esdeveniments.length + ' esdeveniments publicats.');
    Logger.log('publishToGitHub: ' + esdeveniments.length + ' esdeveniments publicats a ' + GITHUB_FILE_PATH + '.');
  } catch (error) {
    Logger.log('publishToGitHub error: ' + error.message);
    ui.alert('Error en publicar: ' + error.message);
  }
}

// ------------------------------------------------------------
// Reads the "Esdeveniments" sheet and returns an array of plain
// event objects, one per row with estat = publicat, with the 16
// schema fields mapped explicitly by column name.
// ------------------------------------------------------------
function llegeixEsdevenimentsPublicats() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOM_FULL);
  if (sheet === null) {
    throw new Error('No trobo el full "' + NOM_FULL + '".');
  }

  var totesLesFiles = sheet.getDataRange().getValues();
  var capcaleres = totesLesFiles[0];

  // Locate every column once, by header name. If a header is
  // missing, indexDeColumna throws a clear error.
  var colId = indexDeColumna(capcaleres, 'id');
  var colTitol = indexDeColumna(capcaleres, 'titol');
  var colDataInici = indexDeColumna(capcaleres, 'data_inici');
  var colDataFi = indexDeColumna(capcaleres, 'data_fi');
  var colHora = indexDeColumna(capcaleres, 'hora');
  var colLloc = indexDeColumna(capcaleres, 'lloc');
  var colMunicipi = indexDeColumna(capcaleres, 'municipi');
  var colComarca = indexDeColumna(capcaleres, 'comarca');
  var colCategoria = indexDeColumna(capcaleres, 'categoria');
  var colDescripcioCa = indexDeColumna(capcaleres, 'descripcio_ca');
  var colDescripcioFr = indexDeColumna(capcaleres, 'descripcio_fr');
  var colAssociacio = indexDeColumna(capcaleres, 'associacio');
  var colImatgeUrl = indexDeColumna(capcaleres, 'imatge_url');
  var colFontUrl = indexDeColumna(capcaleres, 'font_url');
  var colEstat = indexDeColumna(capcaleres, 'estat');
  var colDataEntrada = indexDeColumna(capcaleres, 'data_entrada');

  var esdeveniments = [];

  // Row 0 is the header row, so data starts at row 1.
  for (var i = 1; i < totesLesFiles.length; i++) {
    var fila = totesLesFiles[i];

    var estat = textDeCella(fila[colEstat]);
    if (estat !== 'publicat') {
      continue;
    }

    // Build the object explicitly, field by field, in schema order.
    var esdeveniment = {
      id: textDeCella(fila[colId]),
      titol: textDeCella(fila[colTitol]),
      data_inici: textDeCella(fila[colDataInici]),
      data_fi: textDeCella(fila[colDataFi]),
      hora: textDeCella(fila[colHora]),
      lloc: textDeCella(fila[colLloc]),
      municipi: textDeCella(fila[colMunicipi]),
      comarca: textDeCella(fila[colComarca]),
      categoria: textDeCella(fila[colCategoria]),
      descripcio_ca: textDeCella(fila[colDescripcioCa]),
      descripcio_fr: textDeCella(fila[colDescripcioFr]),
      associacio: textDeCella(fila[colAssociacio]),
      imatge_url: textDeCella(fila[colImatgeUrl]),
      font_url: textDeCella(fila[colFontUrl]),
      estat: estat,
      data_entrada: textDeCella(fila[colDataEntrada])
    };

    esdeveniments.push(esdeveniment);
  }

  return esdeveniments;
}

// ------------------------------------------------------------
// Asks the GitHub API for the current SHA of events.json. The API
// requires this SHA to accept an update of an existing file.
// Returns the SHA string, or throws a clear error.
// ------------------------------------------------------------
function obtenirShaActual(owner, token) {
  var url = 'https://api.github.com/repos/' + owner + '/' + GITHUB_REPO +
    '/contents/' + GITHUB_FILE_PATH + '?ref=' + GITHUB_BRANCH;

  var resposta = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: capcaleresGitHub(token),
    muteHttpExceptions: true
  });

  var codi = resposta.getResponseCode();
  if (codi !== 200) {
    throw new Error('No he pogut llegir ' + GITHUB_FILE_PATH + ' de GitHub (codi ' + codi + '). Resposta: ' + resposta.getContentText());
  }

  var fitxer = JSON.parse(resposta.getContentText());
  return fitxer.sha;
}

// ------------------------------------------------------------
// Sends ONE PUT request to the GitHub Contents API that replaces
// events.json with the new base64 content. Returns nothing, or
// throws a clear error if GitHub refuses the update.
// ------------------------------------------------------------
function pujaFitxerAGitHub(owner, token, contingutBase64, shaActual, quantitat) {
  var url = 'https://api.github.com/repos/' + owner + '/' + GITHUB_REPO +
    '/contents/' + GITHUB_FILE_PATH;

  var cos = {
    message: 'Publica ' + quantitat + ' esdeveniments des del full de càlcul',
    content: contingutBase64,
    sha: shaActual,
    branch: GITHUB_BRANCH
  };

  var resposta = UrlFetchApp.fetch(url, {
    method: 'put',
    contentType: 'application/json',
    headers: capcaleresGitHub(token),
    payload: JSON.stringify(cos),
    muteHttpExceptions: true
  });

  var codi = resposta.getResponseCode();
  if (codi !== 200 && codi !== 201) {
    throw new Error('GitHub ha rebutjat l\'actualització (codi ' + codi + '). Resposta: ' + resposta.getContentText());
  }
}

// ------------------------------------------------------------
// Returns the HTTP headers that every GitHub API call needs.
// ------------------------------------------------------------
function capcaleresGitHub(token) {
  return {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}
