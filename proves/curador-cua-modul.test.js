// ---------------------------------------------------------------------------
// PROVES DIRECTES DE `curador-cua.js`
//
// El fitxer es carrega aquí per `require()`, sense pàgina ni document fals:
// és el camí de Node. `proves/curador-cua.test.js` ja prova la mateixa lògica
// a través de la pàgina; aquest només afegeix el que per la pàgina no es veu:
// que el `module.exports` exporta el que toca, i les peces que `publica()` i
// `rebutja()` fan servir sense que es vegi la seva entrada ni la seva sortida.
//
// Ús: node --test proves/curador-cua-modul.test.js
// ---------------------------------------------------------------------------

var test = require('node:test');
var assert = require('node:assert/strict');
var cua = require('../curador-cua.js');
var pagina = require('./curador-pagina.js');

var filaPendent = pagina.filaPendent;


// --- Auxiliars --------------------------------------------------------------

// Els disset camps d'una fila d'events.json: els de la cua menys nota_curador.
function filaEvent(canvis) {
  var fila = filaPendent(canvis);
  var publica = {};
  pagina.CAMPS_DE_CUA.slice(0, 17).forEach(function (nom) {
    publica[nom] = fila[nom];
  });
  return publica;
}


// --- Les proves -------------------------------------------------------------

test('el mòdul exporta exactament el que la pàgina veu com a globals', async function () {
  var diposit = pagina.creaDipositFals({ 'pendents.json': [], 'events.json': [] });
  var pag = await pagina.carregaCurador(diposit);

  Object.keys(cua).forEach(function (nom) {
    assert.equal(typeof pag.ctx[nom], typeof cua[nom], nom);
  });
  assert.equal(pag.ctx.JA_NO_HI_ES, cua.JA_NO_HI_ES);
  assert.equal(pag.ctx.JA_PUBLICAT, cua.JA_PUBLICAT);
  assert.deepEqual(Object.keys(cua).sort(), [
    'JA_NO_HI_ES', 'JA_PUBLICAT', 'afegeixAPublicats', 'creaFilaPublicada',
    'filesPendents', 'idJaPublicat', 'marcaRebutjadaALaCua',
    'substitueixPerPublicada', 'treuDeLaCua', 'trobaIndex'
  ]);
});

test('filesPendents: només «pendent», i una llista nova', function () {
  var dades = [
    filaPendent({ titol: 'A' }),
    filaPendent({ titol: 'B', estat: 'rebutjat' }),
    filaPendent({ titol: 'C', estat: 'publicat' }),
    filaPendent({ titol: 'D', estat: '' }),
    filaPendent({ titol: 'E' })
  ];

  var queda = cua.filesPendents(dades);

  assert.deepEqual(queda.map(function (fila) { return fila.titol; }), ['A', 'E']);
  assert.equal(dades.length, 5);
});

test('treuDeLaCua: treu totes les coincidències exactes i cap altra, sense tocar la llista', function () {
  var a = filaPendent({ titol: 'A' });
  var b = filaPendent({ titol: 'B' });
  var parcial = filaPendent({ titol: 'A', hora: '22:00' });
  var llista = [a, b, filaPendent({ titol: 'A' }), parcial];

  var queda = cua.treuDeLaCua(llista, a);

  assert.deepEqual(queda, [b, parcial]);
  assert.equal(llista.length, 4);
});

test('afegeixAPublicats: afegeix una còpia amb estat «publicat» al final, sense tocar l’original ni la llista', function () {
  var editat = filaEvent({ estat: 'pendent' });
  var events = [filaEvent({ id: '2026-10-30-altre-acte', titol: 'Altre acte', estat: 'publicat' })];

  var nova = cua.afegeixAPublicats(editat)(events);

  assert.equal(nova.length, 2);
  assert.equal(nova[1].estat, 'publicat');
  assert.deepEqual(Object.keys(nova[1]), Object.keys(editat));
  assert.equal(editat.estat, 'pendent');
  assert.equal(events.length, 1);
});

test('afegeixAPublicats: un id que ja hi és peta amb el text i l’id; un id buit no', function () {
  var editat = filaEvent({});
  var jaHiEra = [filaEvent({ estat: 'publicat' })];

  assert.throws(function () {
    cua.afegeixAPublicats(editat)(jaHiEra);
  }, { message: cua.JA_PUBLICAT + ' Identificador: 2026-11-07-ball-a-prats.' });

  var sensePata = filaEvent({ id: '', data_inici: '', data_fi: '' });
  var altreSensePata = [filaEvent({ id: '', titol: 'Un altre', data_inici: '', data_fi: '' })];
  assert.equal(cua.afegeixAPublicats(sensePata)(altreSensePata).length, 2);
});
