// ---------------------------------------------------------------------------
// PROVES DEL VERIFICADOR DE LES CÒPIES LITERALS DEL WORKER
//
// Proven `eines/verifica-copies-worker.js`: verd sobre el repositori real, i
// vermell quan una còpia temporal del Worker es desvia de l'original o en porta
// una declaració de més. Cap prova no toca els fitxers reals.
//
// Ús: node --test proves/copies-literals-del-worker.test.js
// ---------------------------------------------------------------------------

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var os = require('os');
var path = require('path');
var childProcess = require('child_process');

var ARREL = path.join(__dirname, '..');
var VERIFICADOR = path.join(ARREL, 'eines', 'verifica-copies-worker.js');
var FITXERS = ['worker/worker.js', 'eines/fila-segura.js', 'eines/admet-entrada.js', 'url-segura.js'];


// --- Ajudants ---------------------------------------------------------------

// Copia els quatre fitxers a una arrel temporal nova i en torna el camí.
function copiaArrel() {
  var arrel = fs.mkdtempSync(path.join(os.tmpdir(), 'copies-worker-'));
  FITXERS.forEach(function (cami) {
    fs.mkdirSync(path.join(arrel, path.dirname(cami)), { recursive: true });
    fs.copyFileSync(path.join(ARREL, cami), path.join(arrel, cami));
  });
  return arrel;
}

// Executa el verificador sobre una arrel i en torna { codi, sortida }.
function verifica(arrel) {
  var resultat = childProcess.spawnSync(process.execPath, [VERIFICADOR, arrel], { encoding: 'utf8' });
  return { codi: resultat.status, sortida: resultat.stdout + resultat.stderr };
}

// Canvia un tros de text del Worker de l'arrel temporal.
function canviaWorker(arrel, abans, despres) {
  var cami = path.join(arrel, 'worker', 'worker.js');
  var text = fs.readFileSync(cami, 'utf8');
  assert.ok(text.indexOf(abans) !== -1, 'el Worker no porta «' + abans + '»');
  fs.writeFileSync(cami, text.replace(abans, despres));
}


// --- Les proves -------------------------------------------------------------

test('verd sobre el repositori real', function () {
  var resultat = verifica(ARREL);
  assert.equal(resultat.codi, 0, resultat.sortida);
  assert.match(resultat.sortida, /0 problemes/);
});

test('vermell si una línia d’una còpia canvia', function () {
  var arrel = copiaArrel();
  canviaWorker(arrel, 'var MAX_FILES_PORTES_PER_DIA = 20;', 'var MAX_FILES_PORTES_PER_DIA = 200;');
  var resultat = verifica(arrel);
  assert.equal(resultat.codi, 1);
  assert.match(resultat.sortida, /MAX_FILES_PORTES_PER_DIA: diferent/);
});

test('vermell si una peça hi és declarada dues vegades', function () {
  var arrel = copiaArrel();
  canviaWorker(arrel, 'function talla(text, sostre) {', 'function talla(a) {\n  return a;\n}\n\nfunction talla(text, sostre) {');
  var resultat = verifica(arrel);
  assert.equal(resultat.codi, 1);
  assert.match(resultat.sortida, /talla: worker\/worker\.js en té 2 declaracions/);
});

test('un comentari de més al Worker no compta', function () {
  var arrel = copiaArrel();
  canviaWorker(arrel, 'function talla(text, sostre) {', 'function talla(text, sostre) {\n  // Un comentari que només té el Worker.');
  assert.equal(verifica(arrel).codi, 0);
});
