// ---------------------------------------------------------------------------
// XARXA DE CARACTERITZACIÓ DE LA PASSADA DE L'ACTION
//
// Xarxa de caracterització de la passada en sec de l'Action
// (`sincronitzaProgramada()`): compara la sortida d'avui amb
// `proves/dades/passada-esperada.json`, una prova per escenari.
//
// Una refactorització no en pot canviar la sortida (regla 2 del §6 de
// `docs/COORDINACIO.md`). Si la sortida canvia a posta, l'esperat es torna a
// generar amb `node proves/regenera-esperat-passada.js` i el commit ho ha de
// dir.
//
// Ús: node --test proves/passada-action.test.js
// ---------------------------------------------------------------------------

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');
var passada = require('./passada-en-sec.js');


// --- Lectura ----------------------------------------------------------------

// Llegeix un fitxer JSON de `proves/dades/` pel nom.
function llegeixDades(nom) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'dades', nom), 'utf8'));
}


// --- Les proves -------------------------------------------------------------

passada.ESCENARIS.forEach(function (data) {
  test('passada en sec del ' + data + " igual a l'esperada", async function () {
    var esperat = llegeixDades('passada-esperada.json');
    var obtingut = await passada.passadaEnSec({
      ofertes: llegeixDades('flux-adt66.json'),
      pendents: llegeixDades('pendents.json'),
      events: llegeixDades('events.json'),
      avui: data
    });
    assert.deepStrictEqual(obtingut, esperat[data]);
  });
});
