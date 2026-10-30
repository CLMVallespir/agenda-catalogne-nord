// ---------------------------------------------------------------------------
// PROVES DE LA BAIXADA DEL FLUX DE L'ADT66
//
// El temps màxim i la mida màxima de la baixada (D-09), provats per la
// interfície de `eines/adt66-sincronitza.js` (`sincronitzaADT66()`) amb un
// fetch fals. Cap prova no toca la xarxa.
//
// Ús: node --test proves/baixada-del-flux.test.js
// ---------------------------------------------------------------------------

var test = require('node:test');
var assert = require('node:assert/strict');
var adt66 = require('../eines/adt66-sincronitza.js');

var SOSTRE = 20000000;


// --- Ajudants ---------------------------------------------------------------

// Un cos que envia `megues` trossos d'1 000 000 bytes, sense declarar-ne la mida.
function cosDeMegues(megues) {
  var enviats = 0;
  return new ReadableStream({
    pull: function (controlador) {
      if (enviats >= megues) {
        controlador.close();
        return;
      }
      enviats++;
      controlador.enqueue(new Uint8Array(1000000).fill(32));
    }
  });
}


// --- Les proves -------------------------------------------------------------

test('la baixada porta un temps màxim', async function (t) {
  var crida = null;
  t.mock.method(globalThis, 'fetch', async function (adreca, init) {
    crida = init;
    return new Response(JSON.stringify({ value: [] }), { status: 200 });
  });

  await adt66.sincronitzaADT66('');

  assert.ok(crida.signal instanceof AbortSignal);
});

test('un flux normal es llegeix com sempre', async function (t) {
  t.mock.method(globalThis, 'fetch', async function () {
    return new Response(JSON.stringify({ value: [{ SyndicObjectID: 'A1', Updated: '2026-10-29T10:00:00' }] }), { status: 200 });
  });

  var resultat = await adt66.sincronitzaADT66('');

  assert.equal(resultat.ofertes.length, 1);
});

test('una mida declarada per sobre del sostre s’atura abans de llegir', async function (t) {
  // El cos és petit i bo: si es llegís, la baixada sortiria bé. Que peti amb
  // aquest missatge vol dir que s'ha aturat per la capçalera.
  t.mock.method(globalThis, 'fetch', async function () {
    return new Response(JSON.stringify({ value: [] }), {
      status: 200,
      headers: { 'Content-Length': String(SOSTRE + 1) }
    });
  });

  await assert.rejects(adt66.sincronitzaADT66(''), /fa 20000001 bytes, més del sostre de 20000000/);
});

test('un cos sense mida declarada que passa del sostre s’atura en sec', async function (t) {
  t.mock.method(globalThis, 'fetch', async function () {
    return new Response(cosDeMegues(25), { status: 200 });
  });

  await assert.rejects(adt66.sincronitzaADT66(''), /passa del sostre de 20000000 bytes/);
});
