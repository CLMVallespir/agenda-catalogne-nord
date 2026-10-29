// ---------------------------------------------------------------------------
// PROVES DE `url-segura.js`
//
// La regla que decideix si una adreça pot anar a un `href`. Es prova per la
// seva interfície, sense pàgina: és una funció pura.
//
// Ús: node --test proves/url-segura.test.js
// ---------------------------------------------------------------------------

var test = require('node:test');
var assert = require('node:assert/strict');
var urlSegura = require('../url-segura.js');

var esUrlSegura = urlSegura.esUrlSegura;


// --- Les proves -------------------------------------------------------------

test('el mòdul exporta només esUrlSegura', function () {
  assert.deepEqual(Object.keys(urlSegura), ['esUrlSegura']);
});

test('esUrlSegura: http i https passen, tal com arriben de l’ADT66 i de Cloudinary', function () {
  assert.equal(esUrlSegura('https://www.ceret.fr/agenda'), true);
  assert.equal(esUrlSegura('http://cdt66.media.tourinsoft.eu/upload/cartell.jpg?width=150&height=120'), true);
  assert.equal(esUrlSegura('https://res.cloudinary.com/clm-agenda/image/upload/v1/clm-agenda/posters/a.webp'), true);
  assert.equal(esUrlSegura('HTTPS://WWW.CERET.FR/'), true);
});

test('esUrlSegura: cap altre esquema, ni amagat amb majúscules, espais o tabuladors', function () {
  assert.equal(esUrlSegura('javascript:alert(1)'), false);
  assert.equal(esUrlSegura('JavaScript:alert(1)'), false);
  assert.equal(esUrlSegura('  javascript:alert(1)'), false);
  assert.equal(esUrlSegura('java\tscript:alert(1)'), false);
  assert.equal(esUrlSegura('java\nscript:alert(1)'), false);
  assert.equal(esUrlSegura('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(esUrlSegura('vbscript:msgbox(1)'), false);
  assert.equal(esUrlSegura('mailto:contacte@clm.cat'), false);
  assert.equal(esUrlSegura('ftp://exemple.cat/fitxer'), false);
});

test('esUrlSegura: el que no és cap adreça absoluta no passa', function () {
  assert.equal(esUrlSegura(''), false);
  assert.equal(esUrlSegura('www.ceret.fr'), false);
  assert.equal(esUrlSegura('/agenda'), false);
  assert.equal(esUrlSegura('Voir le site'), false);
  assert.equal(esUrlSegura(null), false);
  assert.equal(esUrlSegura(undefined), false);
  assert.equal(esUrlSegura(42), false);
});
