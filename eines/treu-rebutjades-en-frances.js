// ---------------------------------------------------------------------------
// TREU LES REBUTJADES EN FRANCÈS — EINA D'UN SOL ÚS
//
// Una sola feina: suprimir de `pendents.json` les files que compleixen les
// quatre condicions alhora, i prou:
//
//   estat === 'rebutjat'
//   descripcio_ca buida
//   descripcio_fr plena
//   dins la finestra de la sincronització: la mateixa regla de
//   filtraCandidats() (eines/filtra-candidats.js), amb una data_inici de debò
//
// No toca cap camp de cap fila que es quedi i no escriu enlloc més.
//
// PER QUÈ. Aquestes files es van rebutjar perquè havien entrat a la cua en
// francès, abans que el pas 7 bis les traduís: el rebuig era de la fila, no de
// l'acte. Mentre hi siguin, la capa 1 del §4 ter de CLAUDE.md les troba pel tag
// i diu `ja_rebutjat`, i l'oferta no torna a entrar. Suprimides, la propera
// passada de la sincronització les torna a oferir, ja traduïdes. Per això
// només les que són dins la finestra: les altres el filtre no les tornaria a
// deixar passar, o ja se n'encarrega la poda.
//
// ÉS UNA EXCEPCIÓ A LA MEMÒRIA DE REBUIG del §4 de CLAUDE.md, i és deliberada:
// es perd la memòria d'un rebuig que no era cap decisió sobre l'acte.
//
// FORA D'ABAST, a posta: les rebutjades AMB català. Aquelles són decisions
// editorials del curador i es queden on són.
//
// Ús des del terminal (Node 18 o superior, cap dependència), des de l'arrel:
//
//   node eines/treu-rebutjades-en-frances.js            -> en sec: escriu la
//                                                          llista i no toca res
//   node eines/treu-rebutjades-en-frances.js --escriu   -> escriu la llista i
//                                                          suprimeix les files
//   --llista=CAMI    on va la llista de títols (per omissió,
//                    rebutjades-en-frances.txt)
//
// EN SEC ÉS EL DEFECTE. Sense `--escriu` no es toca `pendents.json`.
// ---------------------------------------------------------------------------

var fs = require('fs');
var filtre = require('./filtra-candidats.js');


// --- Constants --------------------------------------------------------------

// El fitxer de la cua, a l'arrel del repositori. `events.json` queda fora.
var FITXER_CUA = 'pendents.json';

// On va la llista de títols si no es diu res.
var LLISTA_PER_OMISSIO = 'rebutjades-en-frances.txt';


// --- La decisió -------------------------------------------------------------

// ------------------------------------------------------------
// Diu si una fila és de les que se'n van: les quatre condicions del bàner.
// ------------------------------------------------------------
function esRebutjadaEnFrances(fila, avui) {
  if (fila.estat !== 'rebutjat') {
    return false;
  }

  if (textNet(fila.descripcio_ca) !== '') {
    return false;
  }

  if (textNet(fila.descripcio_fr) === '') {
    return false;
  }

  return esDinsLaFinestra(fila, avui);
}

// ------------------------------------------------------------
// Diu si l'acte és dins la finestra de la sincronització. La regla no es copia:
// es passa la fila per filtraCandidats() i es mira que no surti «fora de
// finestra». Una fila sense data_inici de debò no hi compta: el filtre la
// deixaria passar, però aquí «dins la finestra» vol dir tenir-hi una data.
// ------------------------------------------------------------
function esDinsLaFinestra(fila, avui) {
  if (!esData(fila.data_inici)) {
    return false;
  }

  var resultat = filtre.filtraCandidats([fila], avui);

  for (var i = 0; i < resultat.descartats.length; i++) {
    if (resultat.descartats[i].motiu === 'fora de finestra') {
      return false;
    }
  }

  return true;
}

// ------------------------------------------------------------
// Parteix la cua en dues llistes. Les que es queden surten tal com han entrat:
// el mateix objecte, cap camp tocat.
// ------------------------------------------------------------
function separaLaCua(files, avui) {
  var queden = [];
  var fora = [];

  for (var i = 0; i < files.length; i++) {
    if (esRebutjadaEnFrances(files[i], avui)) {
      fora.push(files[i]);
    } else {
      queden.push(files[i]);
    }
  }

  return { queden: queden, fora: fora };
}


// --- Els fitxers ------------------------------------------------------------

// ------------------------------------------------------------
// Llegeix la cua i comprova que és una llista. Si el JSON és dolent, peta aquí
// i no s'arriba a tocar res.
// ------------------------------------------------------------
function llegeixCua(cami) {
  var dades = JSON.parse(fs.readFileSync(cami, 'utf8'));

  if (!Array.isArray(dades)) {
    throw new Error(cami + ' no conté cap llista');
  }

  return dades;
}

// ------------------------------------------------------------
// Escriu la llista de títols que se'n van, una fila per línia, amb la data i el
// municipi al davant perquè es puguin reconèixer.
// ------------------------------------------------------------
function escriuLlista(cami, fora, avui, enSec) {
  var linies = [];
  linies.push('Rebutjades en francès dins la finestra — avui = ' + avui +
    (enSec ? ' — EN SEC, no s\'ha suprimit res' : ' — SUPRIMIDES'));
  linies.push(fora.length + ' files');
  linies.push('');

  for (var i = 0; i < fora.length; i++) {
    linies.push(fora[i].data_inici + '  ' + fora[i].municipi + '  ' + fora[i].titol);
  }

  fs.writeFileSync(cami, linies.join('\n') + '\n', 'utf8');
}

// ------------------------------------------------------------
// Escriu la cua amb el format del projecte: dos espais d'indentació i un salt
// de línia final, com curador.html, el Worker i eines/neteja-cua.js.
// ------------------------------------------------------------
function escriuCua(cami, dades) {
  fs.writeFileSync(cami, JSON.stringify(dades, null, 2) + '\n', 'utf8');
}


// --- Peces petites ----------------------------------------------------------

// El text d'un camp sense espais, o '' si no és una cadena.
function textNet(valor) {
  if (typeof valor !== 'string') {
    return '';
  }
  return valor.trim();
}

// Diu si un valor té la forma AAAA-MM-DD.
function esData(valor) {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

// El dia d'avui en AAAA-MM-DD, en UTC com totes les dates del projecte.
function diaDavui() {
  return new Date().toISOString().slice(0, 10);
}

// El valor d'un argument --nom=valor de la línia d'ordres, o '' si no hi és.
function argument(argv, nom) {
  for (var i = 0; i < argv.length; i++) {
    if (argv[i].indexOf(nom) === 0) {
      return argv[i].slice(nom.length);
    }
  }

  return '';
}


// --- Punt d'entrada ---------------------------------------------------------

// ------------------------------------------------------------
// Llegeix, separa, escriu la llista i, només amb --escriu, la cua. Després
// d'escriure torna a llegir el fitxer i comprova que el compte quadra i que no
// hi queda cap fila de les que se n'havien d'anar.
// ------------------------------------------------------------
function principal() {
  var enSec = process.argv.indexOf('--escriu') === -1;
  var cami = argument(process.argv, '--llista=') || LLISTA_PER_OMISSIO;
  var avui = diaDavui();

  var cua = llegeixCua(FITXER_CUA);
  var separat = separaLaCua(cua, avui);

  escriuLlista(cami, separat.fora, avui, enSec);

  console.log('Rebutjades en francès — ' + (enSec ? 'EN SEC, no s\'escriu res' : 'ESCRIVINT'));
  console.log('avui = ' + avui);
  console.log('cua d\'entrada   ' + cua.length);
  console.log('se\'n van        ' + separat.fora.length);
  console.log('es queden       ' + separat.queden.length);
  console.log('llista a        ' + cami);

  if (enSec) {
    return;
  }

  escriuCua(FITXER_CUA, separat.queden);

  var escrita = llegeixCua(FITXER_CUA);
  var restants = separaLaCua(escrita, avui).fora.length;

  if (escrita.length !== separat.queden.length || restants !== 0) {
    console.log('MAL  la cua escrita té ' + escrita.length + ' files (n\'esperava ' +
      separat.queden.length + ') i ' + restants + ' de les que se n\'havien d\'anar');
    process.exitCode = 1;
    return;
  }

  console.log('BÉ   escrit i comprovat: ' + escrita.length + ' files');
}

if (require.main === module) {
  try {
    principal();
  } catch (error) {
    console.error('Ha fallat: ' + error.message);
    process.exitCode = 1;
  }
}
