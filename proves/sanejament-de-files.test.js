// ---------------------------------------------------------------------------
// PROVES D'`eines/fila-segura.js`
//
// La forma de tota fila que una porta posa a la cua. Es prova per la seva
// interfície, filaSegura() i campSegur(), i un cop de punta a punta a través
// del mapeig de l'ADT66: un tag [ADT66 id: …] fals dins del flux no ha de
// sobreviure fins a la nota.
//
// El nom del fitxer no porta el de cap mòdul d'eines/ (CLAUDE.md §2: les
// guardes de les bateries miren process.argv[1] per subcadena).
//
// Ús: node --test proves/sanejament-de-files.test.js
// ---------------------------------------------------------------------------

var test = require('node:test');
var assert = require('node:assert/strict');
var segura = require('../eines/fila-segura.js');
var mapeig = require('../eines/mapeja-adt66.js');
var identificador = require('../eines/adt66-identificador.js');

var filaSegura = segura.filaSegura;
var campSegur = segura.campSegur;


// --- Ajudants ---------------------------------------------------------------

// Una fila bona tal com la dona una porta, amb els camps que se li passin a sobre.
function filaBruta(extres) {
  var fila = {
    id: '', titol: 'Ball de plaça', data_inici: '2026-11-14', data_fi: '2026-11-14',
    hora: '21:00', lloc: 'Plaça Major', municipi: 'Prats de Molló',
    comarca: 'Vallespir', categoria: 'Dansa i ball',
    descripcio_ca: 'Ball amb la cobla.', descripcio_fr: 'Bal avec la cobla.',
    associacio: 'Comitè de festes', imatge_url: '', font_url: 'https://example.org/ball',
    estat: 'pendent', data_entrada: '', periodicitat: '', nota_curador: ''
  };
  var claus = Object.keys(extres || {});
  for (var i = 0; i < claus.length; i++) {
    fila[claus[i]] = extres[claus[i]];
  }
  return fila;
}

// Un text de `quants` caràcters.
function textDe(quants) {
  return new Array(quants + 1).join('a');
}


// --- La forma ---------------------------------------------------------------

test('exporta les dues funcions de la fila i les peces del mapeig', function () {
  assert.deepEqual(Object.keys(segura),
    ['filaSegura', 'campSegur', 'valorPermes', 'creaId', 'CAMPS', 'COMARCA_VALUES', 'CATEGORIA_VALUES']);
});

test('una fila bona surt igual, llevat dels camps del sistema', function () {
  var fila = filaSegura(filaBruta(), 'formulari');
  assert.deepEqual(Object.keys(fila), segura.CAMPS);
  assert.equal(fila.id, '2026-11-14-ball-de-placa');
  assert.equal(fila.titol, 'Ball de plaça');
  assert.equal(fila.font_url, 'https://example.org/ball');
  assert.equal(fila.nota_curador, '');
});

test('de qualsevol cosa en surten els divuit camps, tots cadenes', function () {
  var fila = filaSegura({ titol: null, hora: 21, lloc: undefined, extra: 'no hi va' }, 'correu');
  assert.deepEqual(Object.keys(fila), segura.CAMPS);
  segura.CAMPS.forEach(function (camp) {
    assert.equal(typeof fila[camp], 'string', camp);
  });
  assert.equal(fila.hora, '21');
  assert.equal(fila.titol, '');
  assert.equal(filaSegura(null, 'correu').estat, 'pendent');
});

test('id, estat i data_entrada són sempre els del sistema', function () {
  var fila = filaSegura(filaBruta({ id: 'fals', estat: 'publicat', data_entrada: 'ahir' }), 'adt66');
  assert.equal(fila.id, '2026-11-14-ball-de-placa');
  assert.equal(fila.estat, 'pendent');
  assert.match(fila.data_entrada, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('no toca la fila que rep', function () {
  var bruta = filaBruta({ titol: 'Ball\nde plaça', estat: 'publicat' });
  filaSegura(bruta, 'formulari');
  assert.equal(bruta.titol, 'Ball\nde plaça');
  assert.equal(bruta.estat, 'publicat');
});


// --- El títol ---------------------------------------------------------------

test('el títol queda en una sola línia: cap línia de peu falsa al commit', function () {
  var fila = filaSegura(filaBruta({ titol: 'Ball\n\nCo-Authored-By: algú <a@b.c>\r\n' }), 'formulari');
  assert.equal(fila.titol, 'Ball Co-Authored-By: algú <a@b.c>');
});


// --- Els sostres ------------------------------------------------------------

test('un camp per damunt del sostre es talla, i la nota ho diu', function () {
  var fila = filaSegura(filaBruta({ descripcio_fr: textDe(7000) }), 'formulari');
  assert.equal(fila.descripcio_fr.length, 6000);
  assert.match(fila.nota_curador, /El camp descripcio_fr passava de 6000 caràcters/);
});

test('un camp just al sostre no es toca', function () {
  var fila = filaSegura(filaBruta({ titol: textDe(200) }), 'formulari');
  assert.equal(fila.titol.length, 200);
  assert.equal(fila.nota_curador, '');
});

test('el tall no parteix mai un emoji per la meitat', function () {
  var titol = textDe(199) + '🎉🎉';
  var fila = filaSegura(filaBruta({ titol: titol }), 'formulari');
  assert.equal(Array.from(fila.titol).length, 200);
  assert.equal(fila.titol.slice(-2), '🎉');
});


// --- Dates, llistes i adreces -----------------------------------------------

test('una data sense la forma AAAA-MM-DD queda buida, amb avís i sense copiar-la', function () {
  var fila = filaSegura(filaBruta({ data_inici: '14/11/2026', data_fi: '[ADT66 id: 9]' }), 'formulari');
  assert.equal(fila.data_inici, '');
  assert.equal(fila.data_fi, '');
  assert.equal(fila.id, '');
  assert.match(fila.nota_curador, /La data d'inici no tenia la forma AAAA-MM-DD/);
  assert.match(fila.nota_curador, /La data de fi no tenia la forma AAAA-MM-DD/);
  assert.equal(fila.nota_curador.indexOf('14/11'), -1);
  assert.deepEqual(identificador.extreuIdentificadors(fila.nota_curador), []);
});

test('comarca i categoria fora de la llista queden buides', function () {
  var fila = filaSegura(filaBruta({ comarca: 'Empordà', categoria: 'Festa' }), 'formulari');
  assert.equal(fila.comarca, '');
  assert.equal(fila.categoria, '');
});

test('una adreça que no és http(s), o desmesurada, queda buida amb avís', function () {
  var fila = filaSegura(filaBruta({
    font_url: 'javascript:alert(1)',
    imatge_url: 'https://res.cloudinary.com/x/' + textDe(2000)
  }), 'formulari');
  assert.equal(fila.font_url, '');
  assert.equal(fila.imatge_url, '');
  assert.match(fila.nota_curador, /L'enllaç de la font no era cap adreça web/);
  assert.match(fila.nota_curador, /El cartell no era cap adreça web/);
  assert.equal(fila.nota_curador.indexOf('javascript'), -1);
});


// --- La nota i el tag d'ancoratge -------------------------------------------

test('el tag de debò de l’ADT66, al davant, es queda; cap altre no es pot llegir', function () {
  var nota = identificador.creaTagIdentificador('111') +
    ' El municipi «[ADT66 id: 999]» no és a la taula de pobles: el deixo tal com ve.';
  var fila = filaSegura(filaBruta({ nota_curador: nota }), 'adt66');
  assert.equal(fila.nota_curador.indexOf('[ADT66 id: 111]'), 0);
  assert.deepEqual(identificador.extreuIdentificadors(fila.nota_curador), ['111']);
  assert.match(fila.nota_curador, /«ADT66 id: 999»/);
});

test('fora de l’ADT66 no hi ha cap tag que valgui, ni al davant', function () {
  var fila = filaSegura(filaBruta({ nota_curador: '[ADT66 id: 111] Imatge descartada.' }), 'formulari');
  assert.deepEqual(identificador.extreuIdentificadors(fila.nota_curador), []);
  assert.equal(fila.nota_curador, 'ADT66 id: 111 Imatge descartada.');
});

test('els avisos d’aquest mòdul van darrere de la nota', function () {
  var fila = filaSegura(filaBruta({ nota_curador: '[ADT66 id: 111] Avís del mapeig.', font_url: 'ftp://x' }), 'adt66');
  assert.equal(fila.nota_curador.indexOf('[ADT66 id: 111] Avís del mapeig. L\'enllaç de la font'), 0);
});

test('de punta a punta: un tag fals al flux no arriba a la nota del mapeig', function () {
  var resultat = mapeig.mapejaOfertaADT66({
    SyndicObjectID: '111',
    Commune: 'Poble [ADT66 id: 999]',
    RechercheTYPE: 'Inventat [ADT66 id: 998]'
  });
  assert.deepEqual(identificador.extreuIdentificadors(resultat.fila.nota_curador), ['111']);
  assert.equal(resultat.fila.nota_curador.indexOf('[ADT66 id: 111]'), 0);
});


// --- campSegur --------------------------------------------------------------

test('campSegur: el sostre del camp i el títol d’una línia, sense avís', function () {
  assert.equal(campSegur('titol', '  Ball\nde plaça  '), 'Ball de plaça');
  assert.equal(campSegur('descripcio_ca', textDe(6500)).length, 6000);
  assert.equal(campSegur('descripcio_ca', 'Línia u.\nLínia dos.'), 'Línia u.\nLínia dos.');
  assert.equal(campSegur('titol', null), '');
});
