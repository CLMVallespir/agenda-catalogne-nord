// ---------------------------------------------------------------------------
// REGENERA L'ESPERAT DE LA PASSADA DE L'ACTION
//
// Regenera l'esperat de la xarxa de la passada de l'Action a partir dels tres
// fitxers de `proves/dades/` (`flux-adt66.json`, `pendents.json`,
// `events.json`) i de les dates d'`ESCENARIS`, i el desa a
// `proves/dades/passada-esperada.json`.
//
// Només s'executa en un encàrrec que canvia el comportament a posta, i el
// commit ho diu. Mai en una refactorització.
//
// Ús: node proves/regenera-esperat-passada.js
// ---------------------------------------------------------------------------

var fs = require('fs');
var path = require('path');
var passada = require('./passada-en-sec.js');


// --- Lectura i resum --------------------------------------------------------

// Llegeix un fitxer JSON de `proves/dades/` pel nom.
function llegeixDades(nom) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'dades', nom), 'utf8'));
}

// Imprimeix la data, la longitud de cada llista de l'informe i el recompte (mai cap fila).
function imprimeixResum(data, informe) {
  var parts = [];
  Object.keys(informe).forEach(function (camp) {
    if (Array.isArray(informe[camp])) {
      parts.push(camp + ': ' + informe[camp].length);
    }
  });
  console.log(data + ' ' + parts.join(', '));
  console.log('recompte: ' + JSON.stringify(informe.recompte));
}


// --- Funció principal -------------------------------------------------------

// Fa una passada per escenari, una darrere l'altra, i escriu l'esperat.
async function regeneraEsperat() {
  try {
    var ofertes = llegeixDades('flux-adt66.json');
    var pendents = llegeixDades('pendents.json');
    var events = llegeixDades('events.json');
    var esperat = {};

    for (var i = 0; i < passada.ESCENARIS.length; i++) {
      var data = passada.ESCENARIS[i];
      var informe = await passada.passadaEnSec({
        ofertes: ofertes,
        pendents: pendents,
        events: events,
        avui: data
      });
      esperat[data] = informe;
      imprimeixResum(data, informe);
    }

    var desti = path.join(__dirname, 'dades', 'passada-esperada.json');
    fs.writeFileSync(desti, JSON.stringify(esperat, null, 2) + '\n');
  } catch (error) {
    console.error("No s'ha pogut regenerar l'esperat de la passada: " + error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  regeneraEsperat();
}
