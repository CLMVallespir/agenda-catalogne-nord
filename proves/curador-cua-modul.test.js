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
    'JA_NO_HI_ES', 'JA_PUBLICAT', 'afegeixAPublicats', 'combinaTransformacions',
    'creaFilaPublicada', 'darrerDiaDeLActe', 'esCaducada', 'esData', 'esDelNostreCloudinary',
    'filesPendents', 'idJaPublicat', 'marcaRebutjadaALaCua', 'missatgeDeLot',
    'podaEventsPassats', 'substitueixPerPublicada', 'treuDeLaCua', 'trobaIndex',
    'variantsDeCartell'
  ]);
});

test('esCaducada: l’últim dia és data_fi, o data_inici si és buida; avui encara no ha passat', function () {
  var avui = '2026-10-29';
  assert.equal(cua.esCaducada(filaEvent({ data_inici: '2026-10-28', data_fi: '2026-10-28' }), avui), true);
  assert.equal(cua.esCaducada(filaEvent({ data_inici: '2026-10-29', data_fi: '2026-10-29' }), avui), false);
  assert.equal(cua.esCaducada(filaEvent({ data_inici: '2026-10-01', data_fi: '2026-11-15' }), avui), false);
  assert.equal(cua.esCaducada(filaEvent({ data_inici: '2026-10-28', data_fi: '' }), avui), true);
});

test('esCaducada: una fila sense cap data utilitzable no ha passat', function () {
  var avui = '2026-10-29';
  assert.equal(cua.esCaducada(filaEvent({ data_inici: '', data_fi: '' }), avui), false);
  assert.equal(cua.esCaducada(filaEvent({ data_inici: '28/10/2026', data_fi: '' }), avui), false);
});

test('podaEventsPassats: separa els passats dels vius, en ordre i sense tocar la llista', function () {
  var passat = filaEvent({ id: 'a', data_inici: '2026-10-01', data_fi: '2026-10-01' });
  var viu = filaEvent({ id: 'b', data_inici: '2026-11-07', data_fi: '2026-11-07' });
  var senseData = filaEvent({ id: 'c', data_inici: '', data_fi: '' });
  var llarg = filaEvent({ id: 'd', data_inici: '2026-09-01', data_fi: '2026-12-31' });
  var events = [passat, viu, senseData, llarg];

  var poda = cua.podaEventsPassats(events, '2026-10-29');

  assert.deepEqual(poda.vius, [viu, senseData, llarg]);
  assert.deepEqual(poda.passats, [passat]);
  assert.equal(events.length, 4);
});

test('esDelNostreCloudinary: només el cloud de l’agenda, i sense nom de cloud mai', function () {
  var nostra = 'https://res.cloudinary.com/clm-agenda/image/upload/v1/ball.webp';
  assert.equal(cua.esDelNostreCloudinary(nostra, 'clm-agenda'), true);
  assert.equal(cua.esDelNostreCloudinary('https://res.cloudinary.com/un-altre/image/upload/ball.webp', 'clm-agenda'), false);
  assert.equal(cua.esDelNostreCloudinary('http://res.cloudinary.com/clm-agenda/image/upload/ball.webp', 'clm-agenda'), false);
  assert.equal(cua.esDelNostreCloudinary(nostra, ''), false);
  assert.equal(cua.esDelNostreCloudinary('', 'clm-agenda'), false);
});

test('variantsDeCartell: a l’ADT66, l’original abans que la miniatura; la resta, tal com és', function () {
  var miniatura = 'http://cdt66.media.tourinsoft.eu/upload/ball.jpg?width=150&height=120';
  assert.deepEqual(cua.variantsDeCartell(miniatura),
    ['http://cdt66.media.tourinsoft.eu/upload/ball.jpg', miniatura]);
  assert.deepEqual(cua.variantsDeCartell('http://cdt66.media.tourinsoft.eu/upload/ball.jpg'),
    ['http://cdt66.media.tourinsoft.eu/upload/ball.jpg']);

  // Un paràmetre d'un altre domini pot ser el que fa existir la imatge.
  var drupal = 'https://www.mairie-perpignan.fr/sites/default/files/musee.jpg?itok=hUbp1msg';
  assert.deepEqual(cua.variantsDeCartell(drupal), [drupal]);
  assert.deepEqual(cua.variantsDeCartell('https://media.tourinsoft.eu.exemple.net/a.jpg?x=1'),
    ['https://media.tourinsoft.eu.exemple.net/a.jpg?x=1']);
  assert.deepEqual(cua.variantsDeCartell('no és cap adreça'), ['no és cap adreça']);
});

test('combinaTransformacions: aplica en ordre, recull l’error de cada peça i només llança si peten totes', function () {
  var suma = function (n) {
    return function (llista) { return llista.concat([n]); };
  };
  var peta = function () { throw new Error('no'); };

  var combinada = cua.combinaTransformacions([suma(1), peta, suma(2)]);
  var original = [0];
  assert.deepEqual(combinada.transforma(original), [0, 1, 2]);
  assert.deepEqual(original, [0]);
  assert.equal(combinada.errors[0], null);
  assert.equal(combinada.errors[1].message, 'no');
  assert.equal(combinada.errors[2], null);

  var totes = cua.combinaTransformacions([peta, peta]);
  assert.throws(function () { totes.transforma([]); }, /no/);
  assert.equal(totes.errors.length, 2);
});

test('missatgeDeLot: una línia és la línia; més, el títol del lot i una línia per decisió', function () {
  assert.equal(cua.missatgeDeLot('Publica 2 actes', ['Publica A']), 'Publica A');
  assert.equal(cua.missatgeDeLot('Publica 2 actes', ['Publica A', 'Publica B']),
    'Publica 2 actes\n\nPublica A\nPublica B');
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
