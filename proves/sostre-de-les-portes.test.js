// ---------------------------------------------------------------------------
// PROVES D'`eines/admet-entrada.js`
//
// El sostre de les portes manuals (D-09): quantes files poden entrar en un dia
// i quant del text d'un correu va al model. Funcions pures, provades per la
// seva interfície. Les portes del Worker que les criden es proven a
// proves/portes-del-worker.test.js.
//
// Ús: node --test proves/sostre-de-les-portes.test.js
// ---------------------------------------------------------------------------

var test = require('node:test');
var assert = require('node:assert/strict');
var porta = require('../eines/admet-entrada.js');

var admetEntrada = porta.admetEntrada;
var filesDeLesPortesDAvui = porta.filesDeLesPortesDAvui;
var MAX_FILES = porta.MAX_FILES_PORTES_PER_DIA;
var MAX_TEXT = porta.MAX_CARACTERS_CORREU;


// --- Ajudants ---------------------------------------------------------------

// Una fila de la cua amb la data d'entrada i la nota que se li diguin.
function fila(dataEntrada, nota) {
  return { titol: 'x', estat: 'pendent', data_entrada: dataEntrada, nota_curador: nota };
}

// `quantes` files de les portes manuals entrades el dia `dia`.
function filesManuals(quantes, dia) {
  var llista = [];
  for (var i = 0; i < quantes; i++) {
    llista.push(fila(dia + 'T10:00:00.000Z', ''));
  }
  return llista;
}


// --- admetEntrada -----------------------------------------------------------

test('exporta les dues funcions i els dos sostres', function () {
  assert.deepEqual(Object.keys(porta),
    ['admetEntrada', 'filesDeLesPortesDAvui', 'MAX_FILES_PORTES_PER_DIA', 'MAX_CARACTERS_CORREU']);
  assert.equal(MAX_FILES, 20);
  assert.equal(MAX_TEXT, 20000);
});

test('per sota del sostre, s’admet i el text passa sencer', function () {
  var decisio = admetEntrada('Concert el dissabte.', MAX_FILES - 1);
  assert.deepEqual(decisio, { admesa: true, text: 'Concert el dissabte.', avis: '', motiu: '' });
});

test('al sostre de files, no s’admet i el motiu ho diu', function () {
  var decisio = admetEntrada('Concert.', MAX_FILES);
  assert.equal(decisio.admesa, false);
  assert.equal(decisio.text, '');
  assert.match(decisio.motiu, /avui ja han entrat 20 files per les portes manuals \(sostre: 20\)/);
});

test('un text massa llarg es talla i porta l’avís per al curador', function () {
  var decisio = admetEntrada(new Array(MAX_TEXT + 501).join('a'), 0);
  assert.equal(decisio.admesa, true);
  assert.equal(decisio.text.length, MAX_TEXT);
  assert.match(decisio.avis, /El correu passava de 20000 caràcters/);
});

test('el tall no parteix cap emoji', function () {
  var text = new Array(MAX_TEXT).join('a') + '🎉🎉';
  var decisio = admetEntrada(text, 0);
  assert.equal(Array.from(decisio.text).length, MAX_TEXT);
  assert.equal(decisio.text.slice(-2), '🎉');
});


// --- filesDeLesPortesDAvui --------------------------------------------------

test('compta només les d’avui que no són de l’ADT66, de tots tres estats', function () {
  var cua = filesManuals(3, '2026-11-02')
    .concat(filesManuals(2, '2026-11-01'))
    .concat([fila('2026-11-02T08:00:00.000Z', '[ADT66 id: 123] Avís.')])
    .concat([{ titol: 'y', estat: 'rebutjat', data_entrada: '2026-11-02T12:00:00.000Z', nota_curador: 'Imatge descartada.' }]);
  assert.equal(filesDeLesPortesDAvui(cua, '2026-11-02'), 4);
});

test('una fila sense data_entrada o sense nota no fa petar res', function () {
  var cua = [{}, null, { data_entrada: '2026-11-02T00:00:00.000Z' }];
  assert.equal(filesDeLesPortesDAvui(cua, '2026-11-02'), 1);
});
