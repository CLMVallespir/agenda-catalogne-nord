// ---------------------------------------------------------------------------
// EINA D'UN SOL ÚS — 30 de setembre de 2026
// ELS CARTELLS DE LES FILES PUBLICADES, A CLOUDINARY
//
// Una sola feina: recórrer `events.json`, agafar les files amb `data_fi >= avui`
// el cartell de les quals encara és a casa d'un tercer, pujar-lo a Cloudinary i
// reescriure `imatge_url` amb el `secure_url`. Res més. Un cop passada i
// comitejada, aquest fitxer es pot esborrar.
//
//   - Fa servir eines/puja-cartell.js (decideix i cursa les variants d'URL) amb
//     el pujador d'eines/cloudinary-adapter.js. Cap lògica pròpia sobre cartells.
//   - NOMÉS ESCRIU `imatge_url`. Cap altre camp no es toca.
//   - SI UNA PUJADA FALLA, LA FILA ES QUEDA COM ESTAVA. pujaCartell() en un cas
//     així buida `imatge_url` (està pensada per a la cua, on hi va la nota
//     groga); aquí això seria esborrar un cartell d'una fila ja pública, de
//     manera que només s'accepta el resultat si és una URL de Cloudinary. Tot
//     el que no ho és surt a la llista d'errors, amb el host.
//   - No toca `pendents.json`.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/cartells-publicats-a-cloudinary.js             -> en sec: compta, no surt
//                                                        a la xarxa, no escriu
//   node eines/cartells-publicats-a-cloudinary.js --escriu    -> puja i reescriu events.json
//
// El nom del cloud és a l'entorn (CLOUDINARY_CLOUD_NAME); si no hi és, s'usa
// `clm-agenda`, que no és cap secret (surt a cada URL d'imatge del web públic).
//
// Cada pujada deixa una còpia PERMANENT a Cloudinary.
// ---------------------------------------------------------------------------


var fs = require('fs');
var path = require('path');

var cartells = require('./puja-cartell.js');
var adaptador = require('./cloudinary-adapter.js');


// --- Constants --------------------------------------------------------------

var CAMI_EVENTS = path.join(__dirname, '..', 'events.json');
var CLOUD_PER_DEFECTE = 'clm-agenda';


// --- Les peces --------------------------------------------------------------

// ------------------------------------------------------------
// Avui, en `YYYY-MM-DD` i en hora local (la dels actes).
// ------------------------------------------------------------
function dataDAvui() {
  var ara = new Date();
  var mes = String(ara.getMonth() + 1).padStart(2, '0');
  var dia = String(ara.getDate()).padStart(2, '0');
  return ara.getFullYear() + '-' + mes + '-' + dia;
}

// ------------------------------------------------------------
// Diu si una fila és candidata: encara no ha passat i el cartell és forà.
// Una `data_fi` buida es resol amb `data_inici`, com a la poda de l'Action.
// ------------------------------------------------------------
function esCandidata(fila, avui) {
  var darreraData = fila.data_fi !== '' ? fila.data_fi : fila.data_inici;

  if (darreraData === '' || darreraData < avui) {
    return false;
  }
  if (fila.imatge_url === '' || cartells.esDeCloudinary(fila.imatge_url)) {
    return false;
  }
  return true;
}

// ------------------------------------------------------------
// El host d'una URL, per a la llista d'errors. Si no es pot llegir, el text tal
// com és.
// ------------------------------------------------------------
function hostDe(url) {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return url;
  }
}

// ------------------------------------------------------------
// Passa les files candidates pel pujador i torna { files, pujats, errors }.
// `errors` és una llista de { titol, host, motiu }. La llista de sortida és nova.
// ------------------------------------------------------------
async function pujaElsCartells(files, avui, funcioPujada) {
  var sortida = files.slice();
  var candidates = 0;
  var pujats = 0;
  var errors = [];

  for (var i = 0; i < files.length; i++) {
    var abans = files[i];

    if (!esCandidata(abans, avui)) {
      continue;
    }
    candidates += 1;

    if (funcioPujada === null) {
      continue;
    }

    var resultat = await cartells.pujaCartell({ fila: abans }, funcioPujada);
    var urlNova = resultat.fila.imatge_url;

    if (cartells.esDeCloudinary(urlNova)) {
      var fila = {};
      var claus = Object.keys(abans);
      for (var c = 0; c < claus.length; c++) {
        fila[claus[c]] = abans[claus[c]];
      }
      fila.imatge_url = urlNova;
      sortida[i] = fila;
      pujats += 1;
    } else {
      errors.push({
        titol: abans.titol,
        host: hostDe(abans.imatge_url),
        motiu: resultat.fila.nota_curador
      });
    }
  }

  return { files: sortida, candidates: candidates, pujats: pujats, errors: errors };
}

// ------------------------------------------------------------
// Serialitza com ja té el fitxer: dos espais, salts de línia CRLF i un salt
// final.
// ------------------------------------------------------------
function serialitza(files) {
  return JSON.stringify(files, null, 2).replace(/\n/g, '\r\n') + '\r\n';
}


// --- Ús des del terminal ----------------------------------------------------

async function passada(escriu) {
  var files = JSON.parse(fs.readFileSync(CAMI_EVENTS, 'utf8'));
  var avui = dataDAvui();
  var pujador = null;

  if (escriu) {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      process.env.CLOUDINARY_CLOUD_NAME = CLOUD_PER_DEFECTE;
    }
    pujador = adaptador.funcioPujada;
  }

  var resultat = await pujaElsCartells(files, avui, pujador);

  console.log('Mode: ' + (escriu ? 'de debò' : 'en sec (cap crida, cap escriptura)') + ' · avui ' + avui);
  console.log('files: ' + files.length + ' · candidates: ' + resultat.candidates);

  if (!escriu) {
    return;
  }

  console.log('pujats: ' + resultat.pujats + ' · errors: ' + resultat.errors.length);

  var perHost = {};
  for (var e = 0; e < resultat.errors.length; e++) {
    var host = resultat.errors[e].host;
    perHost[host] = (perHost[host] || 0) + 1;
    console.log('  ERROR ' + host + ' · ' + resultat.errors[e].titol + ' · ' + resultat.errors[e].motiu);
  }

  fs.writeFileSync(CAMI_EVENTS, serialitza(resultat.files), 'utf8');
  console.log('events.json reescrit.');
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    process.argv[1].indexOf('cartells-publicats-a-cloudinary') !== -1) {
  passada(process.argv.indexOf('--escriu') !== -1);
}
