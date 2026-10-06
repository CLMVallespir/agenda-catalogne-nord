// ---------------------------------------------------------------------------
// PASSADA EN SEC DE L'ACTION
//
// Aquest mòdul fa una passada en sec de l'Action (`sincronitzaProgramada()`)
// sobre entrades congelades, sense tocar cap línia de codi de producció.
// Congela tres coses, i cadascuna per una raó:
//
//   1. El flux de l'ADT66. Se substitueix `adt66.sincronitzaADT66` perquè la
//      prova no depengui de la xarxa ni del que l'ADT66 publiqui avui.
//   2. Els dos fitxers `pendents.json` i `events.json`. S'escriuen en una
//      carpeta temporal i s'hi fa `chdir`, perquè sense token la passada els
//      llegeix del directori de treball i la prova no ha de dependre de la
//      cua viva.
//   3. El rellotge. `new Date()` escapa d'`avui` en dos llocs:
//      `eines/mapeja-adt66.js` (`data_entrada`) i `eines/adt66-sincronitza.js`
//      (`dataDavuiAParis()`, que tria la propera data d'una sèrie dispersa).
//      Sense congelar-lo, dues passades no donarien mai la mateixa sortida.
//
// No hi ha cap costura nova a la interfície de `sincronitzaProgramada()`
// (decisió D-02 de `docs/DECISIONS-ARQUITECTURA.md`).
//
// Nota: `MockTimers` de `node:test` pot escriure un avís d'API experimental
// segons la versió de Node. L'avís no vol dir cap error.
//
// Ús: el fan servir `proves/passada-action.test.js` i
// `proves/regenera-esperat-passada.js`.
// ---------------------------------------------------------------------------

var fs = require('fs');
var os = require('os');
var path = require('path');
var mock = require('node:test').mock;
var sincronitzaProgramada = require('../eines/sincronitza-programada.js').sincronitzaProgramada;
var adt66 = require('../eines/adt66-sincronitza.js');


// --- Constants --------------------------------------------------------------

// Els dos dies de la prova (el dia de la captura del flux i 40 dies després); el coordinador la fixa.
var ESCENARIS = ['2026-10-06', '2026-11-15'];


// --- La passada -------------------------------------------------------------

// Fa una passada en sec amb les entrades congelades i en torna l'informe com a JSON pla.
async function passadaEnSec(entrades) {
  if (typeof entrades.avui !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entrades.avui)) {
    throw new Error('«avui» ha de ser una cadena amb el format AAAA-MM-DD.');
  }

  var carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'quefas-passada-'));
  var directoriAbans = process.cwd();
  var ofertes = entrades.ofertes;
  var avui = entrades.avui;

  try {
    fs.writeFileSync(path.join(carpeta, 'pendents.json'), JSON.stringify(entrades.pendents));
    fs.writeFileSync(path.join(carpeta, 'events.json'), JSON.stringify(entrades.events));
    process.chdir(carpeta);
    // Les 08:00 UTC són les 10 a París, el mateix dia.
    mock.timers.enable({ apis: ['Date'], now: new Date(avui + 'T08:00:00Z') });
    mock.method(adt66, 'sincronitzaADT66', async function () {
      return { ofertes: ofertes };
    });

    var informe = await sincronitzaProgramada({ enSec: true, avui: avui, pausaMs: 0 });
    return JSON.parse(JSON.stringify(informe));
  } finally {
    mock.timers.reset();
    mock.restoreAll();
    process.chdir(directoriAbans);
    fs.rmSync(carpeta, { recursive: true, force: true });
  }
}


// --- El que surt d'aquest fitxer --------------------------------------------

module.exports = {
  ESCENARIS: ESCENARIS,
  passadaEnSec: passadaEnSec
};
