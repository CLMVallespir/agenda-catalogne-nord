// ---------------------------------------------------------------------------
// EINA D'UN SOL ÚS — 27 d'octubre de 2026
// ELS CARTELLS DE LES FILES PUBLICADES, A CLOUDINARY
//
// Una sola feina: recórrer `events.json`, agafar les files amb `data_fi >= avui`
// el cartell de les quals encara és a casa d'un tercer, pujar-lo a Cloudinary i
// reescriure `imatge_url` amb el `secure_url`. Després, posar la mateixa URL a
// la fila `publicat` germana de `pendents.json`, perquè les dues còpies de
// l'acte no diguin coses diferents. Res més. Un cop passada i comitejada,
// aquest fitxer s'esborra.
//
// És la mateixa eina que la del 30 de setembre (843b626), esborrada el 26
// d'octubre, més el pas de `pendents.json`. Cal tornar-la a passar perquè
// cartells-a-cloudinary.js no s'havia llançat després de les passades ADT66
// d'octubre, i el curador va publicar les miniatures de 150 px tal com venien.
//
//   - Fa servir eines/puja-cartell.js (decideix i cursa les variants d'URL) amb
//     el pujador d'eines/cloudinary-adapter.js. Cap lògica pròpia sobre cartells.
//   - NOMÉS ESCRIU `imatge_url`. Cap altre camp no es toca.
//   - SI UNA PUJADA FALLA, LA FILA ES QUEDA COM ESTAVA. pujaCartell() en un cas
//     així buida `imatge_url` (està pensada per a la cua, on hi va la nota
//     groga); aquí això seria esborrar un cartell d'una fila ja pública, de
//     manera que només s'accepta el resultat si és una URL de Cloudinary.
//   - A `pendents.json` només toca files `estat === 'publicat'` que coincideixin
//     per `id` + `titol` + `municipi` i portin la mateixa URL forana. Les
//     `pendent` són de cartells-a-cloudinary.js; les `rebutjat` no es toquen.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/cartells-publicats-a-cloudinary.js             -> en sec: compta, no surt
//                                                        a la xarxa, no escriu
//   node eines/cartells-publicats-a-cloudinary.js --escriu    -> puja i reescriu els dos fitxers
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
var CAMI_PENDENTS = path.join(__dirname, '..', 'pendents.json');
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
// La clau que identifica un acte (§4 de CLAUDE.md): `id` + `titol` + `municipi`.
// ------------------------------------------------------------
function clauDeFila(fila) {
  return fila.id + '\u0000' + fila.titol + '\u0000' + fila.municipi;
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
// Copia una fila canviant-ne només `imatge_url`.
// ------------------------------------------------------------
function ambImatge(fila, urlNova) {
  var copia = {};
  var claus = Object.keys(fila);
  for (var c = 0; c < claus.length; c++) {
    copia[claus[c]] = fila[claus[c]];
  }
  copia.imatge_url = urlNova;
  return copia;
}

// ------------------------------------------------------------
// Passa les files candidates pel pujador i torna
// { files, candidates, pujats, canvis, errors }. `canvis` és una llista de
// { clau, abans, despres } per al pas de `pendents.json`; `errors`, una llista
// de { titol, host, motiu }. La llista de sortida és nova.
// ------------------------------------------------------------
async function pujaElsCartells(files, avui, funcioPujada) {
  var sortida = files.slice();
  var candidates = 0;
  var canvis = [];
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
      sortida[i] = ambImatge(abans, urlNova);
      canvis.push({ clau: clauDeFila(abans), abans: abans.imatge_url, despres: urlNova });
    } else {
      errors.push({
        titol: abans.titol,
        host: hostDe(abans.imatge_url),
        motiu: resultat.fila.nota_curador
      });
    }
  }

  return { files: sortida, candidates: candidates, pujats: canvis.length, canvis: canvis, errors: errors };
}

// ------------------------------------------------------------
// Posa la URL nova a les files `publicat` de `pendents.json` que són el mateix
// acte i encara porten la URL forana d'abans. Torna { files, tocades }.
// ------------------------------------------------------------
function actualitzaPublicades(files, canvis) {
  var sortida = files.slice();
  var perClau = {};
  var tocades = 0;

  for (var c = 0; c < canvis.length; c++) {
    perClau[canvis[c].clau] = canvis[c];
  }

  for (var i = 0; i < files.length; i++) {
    var fila = files[i];
    if (fila.estat !== 'publicat') {
      continue;
    }
    var canvi = perClau[clauDeFila(fila)];
    if (canvi && fila.imatge_url === canvi.abans) {
      sortida[i] = ambImatge(fila, canvi.despres);
      tocades += 1;
    }
  }

  return { files: sortida, tocades: tocades };
}

// ------------------------------------------------------------
// Serialitza com ja té el fitxer: dos espais, el mateix salt de línia que hi
// havia (CRLF o LF) i un salt final.
// ------------------------------------------------------------
function serialitza(files, textOriginal) {
  var salt = textOriginal.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
  return JSON.stringify(files, null, 2).replace(/\n/g, salt) + salt;
}


// --- Ús des del terminal ----------------------------------------------------

async function passada(escriu) {
  var textEvents = fs.readFileSync(CAMI_EVENTS, 'utf8');
  var files = JSON.parse(textEvents);
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

  for (var e = 0; e < resultat.errors.length; e++) {
    console.log('  ERROR ' + resultat.errors[e].host + ' · ' + resultat.errors[e].titol + ' · ' + resultat.errors[e].motiu);
  }

  fs.writeFileSync(CAMI_EVENTS, serialitza(resultat.files, textEvents), 'utf8');
  console.log('events.json reescrit.');

  var textPendents = fs.readFileSync(CAMI_PENDENTS, 'utf8');
  var publicades = actualitzaPublicades(JSON.parse(textPendents), resultat.canvis);
  fs.writeFileSync(CAMI_PENDENTS, serialitza(publicades.files, textPendents), 'utf8');
  console.log('pendents.json: ' + publicades.tocades + ' files publicat posades al dia.');
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    process.argv[1].indexOf('cartells-publicats-a-cloudinary') !== -1) {
  passada(process.argv.indexOf('--escriu') !== -1);
}
