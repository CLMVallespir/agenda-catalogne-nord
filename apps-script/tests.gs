// ============================================================
// TESTS — in-script test runner (audit §7, Pattern A)
// GAS has no local test runner, so this file IS the safety net:
// run executaTotsElsTests() from the "Agenda" menu (or the editor)
// and it checks the project's pure logic in the real GAS
// environment, writing PASS/FAIL detail to the log and a summary
// to a popup.
//
// It tests ONLY pure logic (no Google service, no network): the
// functions a prompt tweak, a model change or a careless refactor
// could silently break — Gemini-answer parsing, enum filtering, id
// building, the row contract (estat always "pendent", 16 fields,
// out-of-enum values emptied), and the digest's date/HTML helpers.
//
// Integration checks that need the real environment or a test sheet
// (digest idempotency, lock release, publish conflict) are run by
// hand on the test-sheet copy — see docs/pas-proves-i-desplegament.md.
//
// This file pushes NOTHING and writes NO row: it is safe to run any
// time, including against production, because it never touches the
// sheet, Gmail, Cloudinary, GitHub or Brevo.
// ============================================================

// --- Accumulators, reset at the start of every run ---
var _testsPassats = 0;
var _testsFallats = 0;
var _testsDetall = [];

// ------------------------------------------------------------
// MENU ENTRY POINT. Runs every test group, logs the detail, and shows a
// popup with the PASS/FAIL summary. Returns nothing.
// ------------------------------------------------------------
function executaTotsElsTests() {
  _testsPassats = 0;
  _testsFallats = 0;
  _testsDetall = [];

  testAnalitzaJsonResposta();
  testExtreuTextResposta();
  testValorPermes();
  testCreaId();
  testConstrueixFila();
  testBessonsDelDigest();

  var resum = 'Tests: ' + _testsPassats + ' OK, ' + _testsFallats + ' FALLATS.';
  Logger.log('executaTotsElsTests — ' + resum);
  for (var i = 0; i < _testsDetall.length; i++) {
    Logger.log(_testsDetall[i]);
  }

  // The popup only works when run from the sheet UI; if run from the
  // editor there is no UI, so guard it.
  try {
    var ui = SpreadsheetApp.getUi();
    var missatge = resum;
    if (_testsFallats > 0) {
      missatge = missatge + '\n\nMira el registre (Ctrl+Enter) per al detall dels FALLATS.';
    }
    ui.alert('Resultat dels tests', missatge, ui.ButtonSet.OK);
  } catch (senseUi) {
    Logger.log('executaTotsElsTests: sense UI (executat des de l\'editor). Resum al registre.');
  }
}

// --- Tiny assert helpers -----------------------------------------------

// Records a PASS or FAIL for one comparison of two values.
function comprovaIgual(actual, esperat, nom) {
  if (actual === esperat) {
    _registraPass(nom);
  } else {
    _registraFail(nom, 'esperava "' + esperat + '", he obtingut "' + actual + '"');
  }
}

// Records a PASS if cond is true, a FAIL otherwise.
function comprovaCert(cond, nom) {
  if (cond === true) {
    _registraPass(nom);
  } else {
    _registraFail(nom, 'esperava cert');
  }
}

// Records a PASS if fn() throws, a FAIL if it returns without throwing.
function comprovaLlancaError(fn, nom) {
  var haLlancat = false;
  try {
    fn();
  } catch (e) {
    haLlancat = true;
  }
  if (haLlancat) {
    _registraPass(nom);
  } else {
    _registraFail(nom, 'esperava que llancés un error i no ho ha fet');
  }
}

function _registraPass(nom) {
  _testsPassats = _testsPassats + 1;
  _testsDetall.push('OK   — ' + nom);
}

function _registraFail(nom, motiu) {
  _testsFallats = _testsFallats + 1;
  _testsDetall.push('FALLAT — ' + nom + ' (' + motiu + ')');
}

// --- Test groups -------------------------------------------------------

// analitzaJsonResposta (processNewEmails.gs): clean JSON, fenced/preamble
// JSON, no object (throws), truncated (throws).
function testAnalitzaJsonResposta() {
  var net = analitzaJsonResposta('{"titol":"x"}');
  comprovaIgual(net.titol, 'x', 'analitzaJsonResposta: JSON net');

  var ambFences = analitzaJsonResposta('Aquí tens: ```json\n{"titol":"y"}\n```');
  comprovaIgual(ambFences.titol, 'y', 'analitzaJsonResposta: amb fences i preàmbul');

  comprovaLlancaError(function () {
    analitzaJsonResposta('cap json aquí');
  }, 'analitzaJsonResposta: sense objecte JSON llança');

  comprovaLlancaError(function () {
    analitzaJsonResposta('{"titol":"tallat"');
  }, 'analitzaJsonResposta: JSON truncat llança');
}

// extreuTextResposta (processNewEmails.gs): normal answer, no candidates,
// MAX_TOKENS, no parts — the last three must throw.
function testExtreuTextResposta() {
  var normal = { candidates: [ { content: { parts: [ { text: '{"a":1}' } ] } } ] };
  comprovaIgual(extreuTextResposta(normal), '{"a":1}', 'extreuTextResposta: resposta normal');

  comprovaLlancaError(function () {
    extreuTextResposta({ candidates: [] });
  }, 'extreuTextResposta: cap candidat llança');

  comprovaLlancaError(function () {
    extreuTextResposta({ candidates: [ { finishReason: 'MAX_TOKENS' } ] });
  }, 'extreuTextResposta: MAX_TOKENS llança');

  comprovaLlancaError(function () {
    extreuTextResposta({ candidates: [ { content: { parts: [] }, finishReason: 'STOP' } ] });
  }, 'extreuTextResposta: sense parts llança');
}

// valorPermes (utils.gs): inside the enum kept, outside emptied.
function testValorPermes() {
  comprovaIgual(valorPermes('Vallespir', COMARCA_VALUES), 'Vallespir', 'valorPermes: comarca vàlida');
  comprovaIgual(valorPermes('Occitània', COMARCA_VALUES), '', 'valorPermes: comarca forastera buidada');
  comprovaIgual(valorPermes('', COMARCA_VALUES), '', 'valorPermes: buit segueix buit');
  comprovaIgual(valorPermes('Circ', CATEGORIA_VALUES), '', 'valorPermes: categoria forastera buidada');
  comprovaIgual(valorPermes('Teatre', CATEGORIA_VALUES), 'Teatre', 'valorPermes: categoria vàlida');
}

// creaId (utils.gs): accents/apostrophes, punctuation-only title, empty
// date, three-word cap.
function testCreaId() {
  comprovaIgual(creaId('2026-09-14', 'Ball de la festa'), '2026-09-14-ball-de-la', 'creaId: retall a 3 paraules');
  comprovaIgual(creaId('2026-09-14', "L'Exposició d'Estiu"), '2026-09-14-lexposicio-destiu', 'creaId: accents i apòstrofs');
  comprovaIgual(creaId('2026-09-14', '!!!'), '2026-09-14', 'creaId: títol només puntuació');
  comprovaIgual(creaId('', 'Ball'), '', 'creaId: sense data torna buit');
}

// construeixFila (processNewEmails.gs): the row contract. A malicious
// extraction with estat "publicat" and out-of-enum values must still land
// as a 16-field row with estat "pendent" and those values emptied, and id
// rebuilt (never the model's).
function testConstrueixFila() {
  var maliciosa = {
    id: 'inventat-pel-model',
    titol: 'Concert de prova',
    data_inici: '2026-09-14',
    data_fi: '',
    hora: '20:00',
    lloc: 'Sala',
    municipi: 'Perpinyà',
    comarca: 'Occitània',   // fora d'enum
    categoria: 'Circ',      // fora d'enum
    descripcio_ca: 'ca',
    descripcio_fr: 'fr',
    associacio: 'Assoc',
    estat: 'publicat'       // intent d'escriure publicat
  };
  var fila = construeixFila(maliciosa, 'https://exemple/cartell.webp');

  comprovaIgual(fila.length, 16, 'construeixFila: exactament 16 posicions');
  comprovaIgual(fila[14], 'pendent', 'construeixFila: estat forçat a pendent');
  comprovaIgual(fila[7], '', 'construeixFila: comarca forastera buidada');
  comprovaIgual(fila[8], '', 'construeixFila: categoria forastera buidada');
  comprovaIgual(fila[0], '2026-09-14-concert-de-prova', 'construeixFila: id reconstruït, no el del model');
  comprovaIgual(fila[3], '2026-09-14', 'construeixFila: data_fi buida es copia de data_inici');
  comprovaIgual(fila[12], 'https://exemple/cartell.webp', 'construeixFila: imatge_url del sistema');
  comprovaIgual(fila[13], '', 'construeixFila: font_url buit en el camí correu');
}

// The digest's pure helpers (digestHtml.gs): finsAl, objecteDataDe,
// dataLlegibleCatala, escapaHtml, comencaAmbVocal, majuscula.
function testBessonsDelDigest() {
  // objecteDataDe
  comprovaCert(objecteDataDe('2026-09-14') !== null, 'objecteDataDe: data vàlida no és null');
  comprovaIgual(objecteDataDe('2026-13-99'), null, 'objecteDataDe: data impossible és null');
  comprovaIgual(objecteDataDe(''), null, 'objecteDataDe: buida és null');
  comprovaIgual(objecteDataDe('2026-09'), null, 'objecteDataDe: format curt és null');

  // finsAl
  comprovaIgual(finsAl('2026-13-99'), '', 'finsAl: data malformada torna buit');
  comprovaCert(finsAl('2026-09-20').indexOf('Fins al 20') === 0, 'finsAl: dia 20 comença "Fins al 20"');
  comprovaCert(finsAl('2026-09-20').indexOf('septembre') !== -1, 'finsAl: inclou el mes francès');
  comprovaCert(finsAl('2026-08-01').indexOf('1er') !== -1, 'finsAl: dia 1 dona "1er" en francès');

  // dataLlegibleCatala
  comprovaIgual(dataLlegibleCatala('2026-09-14'), '14 de setembre de 2026', 'dataLlegibleCatala: cas normal');
  comprovaIgual(dataLlegibleCatala(''), '', 'dataLlegibleCatala: buida torna buit');
  comprovaIgual(dataLlegibleCatala('2026-13-01'), '', 'dataLlegibleCatala: mes impossible torna buit');

  // escapaHtml
  comprovaIgual(escapaHtml('a & b < c > d " e \' f'), 'a &amp; b &lt; c &gt; d &quot; e &#39; f', 'escapaHtml: les 5 entitats');
  comprovaIgual(escapaHtml(null), '', 'escapaHtml: null torna buit');

  // comencaAmbVocal / majuscula
  comprovaCert(comencaAmbVocal('agost'), 'comencaAmbVocal: agost comença amb vocal');
  comprovaCert(comencaAmbVocal('setembre') === false, 'comencaAmbVocal: setembre no');
  comprovaIgual(majuscula('juny'), 'Juny', 'majuscula: posa la inicial en majúscula');
  comprovaIgual(majuscula(''), '', 'majuscula: buida segueix buida');
}
