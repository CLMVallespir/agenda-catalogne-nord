// ---------------------------------------------------------------------------
// PROVES DEL VERIFICADOR DEL WORKER CONCATENAT
//
// Proven `eines/verifica-worker-concatenat.js`: que doni verd sobre la carpeta
// `worker/` real i que doni vermell, amb la regla correcta, quan es trenca una
// còpia temporal (A: postal-mime, B: worker, C: bàner). També que els finals de
// línia CRLF no el confonguin. Cap prova no toca els fitxers reals.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node --test proves/verifica-worker-concatenat.test.js
// ---------------------------------------------------------------------------

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');
var os = require('os');
var childProcess = require('child_process');


// --- Constants --------------------------------------------------------------

var VERIFICADOR = path.join(__dirname, '..', 'eines', 'verifica-worker-concatenat.js');
var CARPETA_REAL = path.join(__dirname, '..', 'worker');
var FITXERS = ['worker.js', 'postal-mime.js', 'worker-concatenat.js'];
var MARCADOR = 'FI DE LA DEPENDÈNCIA VENDORITZADA';


// --- Auxiliars --------------------------------------------------------------

// Copia els tres fitxers del Worker a una carpeta temporal nova i en torna el camí.
function copiaCarpetaWorker() {
  var carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'verifica-worker-'));
  FITXERS.forEach(function (nom) {
    fs.copyFileSync(path.join(CARPETA_REAL, nom), path.join(carpeta, nom));
  });
  return carpeta;
}

// Esborra una carpeta temporal amb tot el que conté.
function esborraCarpeta(carpeta) {
  fs.rmSync(carpeta, { recursive: true, force: true });
}

// Llança el procés del verificador i en torna el resultat cru.
function llancaVerificador(carpeta) {
  return childProcess.spawnSync(process.execPath, [VERIFICADOR, carpeta], { encoding: 'utf8' });
}

// Executa el verificador sobre una carpeta i en torna el codi i el text (stdout + stderr).
function executaVerificador(carpeta) {
  var resultat = llancaVerificador(carpeta);
  return { codi: resultat.status, text: resultat.stdout + resultat.stderr };
}

// Canvia la línia del mig d'un fitxer de la carpeta, afegint-hi text al final.
function canviaLiniaDelMig(carpeta, nom) {
  var cami = path.join(carpeta, nom);
  var linies = fs.readFileSync(cami, 'utf8').split(/\r?\n/);
  var mig = Math.floor(linies.length / 2);
  linies[mig] = linies[mig] + ' // canviada per la prova';
  fs.writeFileSync(cami, linies.join('\n'));
}

// Insereix una línia de codi just després de la línia del marcador del bàner.
function inserixCodiAlBaner(carpeta) {
  var cami = path.join(carpeta, 'worker-concatenat.js');
  var linies = fs.readFileSync(cami, 'utf8').split(/\r?\n/);
  var posicio = linies.findIndex(function (linia) {
    return linia.indexOf(MARCADOR) !== -1;
  });
  assert.notEqual(posicio, -1, 'no trobo el marcador al bàner');
  linies.splice(posicio + 1, 0, 'var x = 1;');
  fs.writeFileSync(cami, linies.join('\n'));
}

// Converteix els tres fitxers de la carpeta a finals de línia CRLF.
function convertisACrlf(carpeta) {
  FITXERS.forEach(function (nom) {
    var cami = path.join(carpeta, nom);
    var linies = fs.readFileSync(cami, 'utf8').split(/\r?\n/);
    fs.writeFileSync(cami, linies.join('\r\n'));
  });
}


// --- Proves -----------------------------------------------------------------

test('la carpeta worker/ real surt en verd', function () {
  var resultat = executaVerificador(CARPETA_REAL);
  assert.equal(resultat.codi, 0, resultat.text);
});

test('una línia canviada a worker.js fa fallar la regla B', function (t) {
  var carpeta = copiaCarpetaWorker();
  t.after(function () { esborraCarpeta(carpeta); });
  canviaLiniaDelMig(carpeta, 'worker.js');
  var resultat = executaVerificador(carpeta);
  assert.equal(resultat.codi, 1, resultat.text);
  assert.match(resultat.text, /Regla B/);
});

test('una línia canviada a postal-mime.js fa fallar la regla A', function (t) {
  var carpeta = copiaCarpetaWorker();
  t.after(function () { esborraCarpeta(carpeta); });
  canviaLiniaDelMig(carpeta, 'postal-mime.js');
  var resultat = executaVerificador(carpeta);
  assert.equal(resultat.codi, 1, resultat.text);
  assert.match(resultat.text, /Regla A/);
});

test('una línia de codi dins el bàner fa fallar la regla C', function (t) {
  var carpeta = copiaCarpetaWorker();
  t.after(function () { esborraCarpeta(carpeta); });
  inserixCodiAlBaner(carpeta);
  var resultat = executaVerificador(carpeta);
  assert.equal(resultat.codi, 1, resultat.text);
  assert.match(resultat.text, /Regla C/);
});

test('els tres fitxers amb finals de línia CRLF surten en verd', function (t) {
  var carpeta = copiaCarpetaWorker();
  t.after(function () { esborraCarpeta(carpeta); });
  convertisACrlf(carpeta);
  var resultat = executaVerificador(carpeta);
  assert.equal(resultat.codi, 0, resultat.text);
});
