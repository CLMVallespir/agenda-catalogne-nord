// ---------------------------------------------------------------------------
// ELS CARTELLS DE LA CUA, A CLOUDINARY
//
// Una sola feina: agafar `pendents.json` tal com és, fer passar cada fila per
// eines/puja-cartell.js amb el pujador de debò d'eines/cloudinary-adapter.js, i
// tornar a escriure el fitxer. Res més.
//
//   - Cap crida a Gemini. Cap mapeig, cap deduplicació, cap filtre, cap
//     classificació: cadascuna és una peça a part i cap no es toca des d'aquí.
//   - Cap lògica pròpia sobre cartells. Qui decideix què es puja, què es
//     descarta i què s'escriu a `nota_curador` és pujaCartell(); aquest fitxer
//     només llegeix el JSON, l'hi passa fila a fila i el desa.
//   - No toca `events.json`. El que ja és públic no es remena.
//   - Només mira les files `estat === 'pendent'`. Una fila rebutjada és una
//     decisió presa: es queda tal com és i no gasta ni una petició.
//
// ÉS INCREMENTAL, i no per cap comptabilitat pròpia sinó per la guarda que ja
// porta pujaCartell(): una fila que ja té l'`imatge_url` a `res.cloudinary.com`
// surt tal com ha entrat i **no gasta cap petició**. Per això la segona passada
// sobre el mateix fitxer no puja res: la primera ja hi ha deixat escrites les
// adreces de Cloudinary. La incrementalitat de debò, la de no tornar a mapejar
// mil cinc-centes ofertes, és de sincronitzaADT66(), que només baixa les que
// han canviat; aquesta d'aquí és la segona xarxa, per si una fila hi torna.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   CLOUDINARY_CLOUD_NAME=clm-agenda node eines/cartells-a-cloudinary.js --prova
//   CLOUDINARY_CLOUD_NAME=clm-agenda node eines/cartells-a-cloudinary.js
//
// Amb `--prova` no surt a la xarxa i no escriu res: només diu quantes files
// tenen cartell forà i quantes ja són nostres. Sense `--prova`, puja de debò i
// reescriu `pendents.json`. Cada pujada deixa una còpia PERMANENT a Cloudinary,
// també per a files que potser no es publicaran mai: no és una comanda que es
// llanci de passada.
// ---------------------------------------------------------------------------


// --- El que ve de fora ------------------------------------------------------

var fs = require('fs');
var path = require('path');

// Les dues peces que aquest fitxer encadena. Cap de les dues no s'ha tocat.
var cartells = require('./puja-cartell.js');
var adaptador = require('./cloudinary-adapter.js');


// --- Constants --------------------------------------------------------------

// La cua del curador, a l'arrel del repositori. Aquest fitxer viu a `eines/`.
var CAMI_PENDENTS = path.join(__dirname, '..', 'pendents.json');


// --- La funció --------------------------------------------------------------

// ------------------------------------------------------------
// Passa totes les files d'una cua pel pujador de cartells.
//
//   files         la llista de files de `pendents.json`, tal com és.
//   funcioPujada  el pujador injectat, amb el contracte d'eines/puja-cartell.js.
//                 Si no se'n passa cap, no es puja res: pujaCartell() escriurà
//                 la nota que ho diu i l'URL forà es quedarà on és.
//
// Torna { files, recompte }: la llista NOVA —cap fila d'entrada no es toca— i
// els números de la passada. Hi surten TOTES les files, també les que no s'han
// tocat, perquè qui la crida hi torna a escriure el fitxer sencer.
//
// NOMÉS PUJA ELS CARTELLS DE LES FILES `estat === 'pendent'`. Les altres surten
// tal com han entrat: una fila rebutjada és una decisió presa, i pujar-li el
// cartell —o reintentar-ho a cada passada programada— només gastaria quota per
// deixar a Cloudinary una còpia permanent d'un acte que no es publicarà mai.
// El filtre és literalment `=== 'pendent'`, no `!== 'rebutjat'`: qualsevol estat
// nou o inesperat es queda fora, que és el costat segur (§4 de CLAUDE.md).
// ------------------------------------------------------------
async function pujaElsCartellsDe(files, funcioPujada) {
  var sortida = files.slice();
  var recompte = { total: files.length, pendents: 0, altresEstats: 0, sensCartell: 0, jaNostres: 0, pujats: 0, fallats: 0 };

  // El filtre, abans del bucle de pujada: es guarden les POSICIONS de les
  // files pendents, de manera que la llista de sortida conserva l'ordre del
  // fitxer i les files que no toquem s'hi queden intactes.
  var posicionsPendents = [];
  for (var f = 0; f < files.length; f++) {
    if (files[f].estat === 'pendent') {
      posicionsPendents.push(f);
    } else {
      recompte.altresEstats += 1;
    }
  }
  recompte.pendents = posicionsPendents.length;

  for (var i = 0; i < posicionsPendents.length; i++) {
    var posicio = posicionsPendents[i];
    var abans = files[posicio];

    if (abans.imatge_url === '') {
      recompte.sensCartell += 1;
    } else if (cartells.esDeCloudinary(abans.imatge_url)) {
      recompte.jaNostres += 1;
    }

    var resultat = await cartells.pujaCartell({ fila: abans }, funcioPujada);
    var despres = resultat.fila;

    // Què ha passat amb aquesta fila es llegeix del que ha canviat, no d'un
    // comptador que el pujador hagi hagut d'omplir: així el recompte no pot
    // dir una cosa i el fitxer una altra.
    if (despres.imatge_url !== abans.imatge_url) {
      if (cartells.esDeCloudinary(despres.imatge_url)) {
        recompte.pujats += 1;
      } else {
        recompte.fallats += 1;
      }
    }

    sortida[posicio] = despres;
  }

  return { files: sortida, recompte: recompte };
}


// --- El que surt d'aquest fitxer --------------------------------------------

module.exports = {
  pujaElsCartellsDe: pujaElsCartellsDe
};


// --- Ús des del terminal ----------------------------------------------------

// ------------------------------------------------------------
// Llegeix la cua, la passa pel pujador i —si no és una prova— la torna a
// escriure amb el mateix format que fa servir tot el projecte.
// ------------------------------------------------------------
async function passadaSobreLaCua(esProva) {
  var files = JSON.parse(fs.readFileSync(CAMI_PENDENTS, 'utf8'));
  var pujador = null;

  if (!esProva) {
    pujador = adaptador.funcioPujada;
  }

  var resultat = await pujaElsCartellsDe(files, pujador);
  var recompte = resultat.recompte;

  console.log('Fitxer: ' + CAMI_PENDENTS);
  console.log('Mode:   ' + (esProva ? 'prova (cap crida, cap escriptura)' : 'de debò'));
  console.log('');
  console.log('  files al fitxer       ' + recompte.total);
  console.log('  files pendents        ' + recompte.pendents);
  console.log('  altres estats         ' + recompte.altresEstats + ' (intactes)');
  console.log('  sense cap cartell     ' + recompte.sensCartell);
  console.log('  ja a Cloudinary       ' + recompte.jaNostres);
  console.log('  cartells forans       ' +
    (recompte.pendents - recompte.sensCartell - recompte.jaNostres));

  if (!esProva) {
    console.log('  pujats ara            ' + recompte.pujats);
    console.log('  no pujats (amb nota)  ' + recompte.fallats);
    fs.writeFileSync(CAMI_PENDENTS, JSON.stringify(resultat.files, null, 2) + '\n', 'utf8');
    console.log('');
    console.log('pendents.json reescrit.');
  }
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    process.argv[1].indexOf('cartells-a-cloudinary') !== -1) {
  passadaSobreLaCua(process.argv.indexOf('--prova') !== -1);
}
