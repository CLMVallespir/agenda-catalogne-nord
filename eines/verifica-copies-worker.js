// ---------------------------------------------------------------------------
// VERIFICADOR DE LES CÒPIES LITERALS DEL WORKER
//
// Una sola feina: comprovar que cada peça que el Worker porta copiada d'un
// mòdul de Node hi és idèntica. No arregla res, no escriu res, no toca la
// xarxa. Només mira i informa.
//
// PER QUÈ EXISTEIX. El Worker no pot fer `require`: s'enganxa sencer al tauler
// de Cloudflare (CLAUDE.md §3). Les regles que també ha de complir —la forma de
// la fila, quines adreces van a un enllaç— viuen en un mòdul que Node prova, i
// el Worker en porta una còpia. Una còpia que es desvia no dona cap error: el
// Worker escriu files amb una regla vella. Aquest guió és el que ho veu.
//
// QUÈ COMPARA. Per a cada nom de la taula COPIES, la declaració sencera
// (`function nom(` fins a la `}` de la columna 0, o `var nom =` fins al `;`)
// a l'original i a worker/worker.js. Es comparen les línies de codi: les
// línies que només són comentari i les línies en blanc no compten, perquè
// el Worker hi pot dur un comentari de més sense canviar res. Tota la resta,
// sagnat inclòs, ha de ser igual. Cada nom hi ha de ser declarat una vegada i
// prou: dues declaracions amb el mateix nom en un mòdul fan que guanyi la de
// sota sense cap avís.
//
// worker/worker-concatenat.js no es mira aquí: que sigui igual a worker.js ho
// comprova eines/verifica-worker-concatenat.js.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/verifica-copies-worker.js            -> el repositori
//   node eines/verifica-copies-worker.js <arrel>    -> una altra arrel (proves)
//
// Torna 0 si tot quadra i 1 si res no quadra.
//
// SI HI AFEGEIXES UNA PEÇA: la taula COPIES és l'única cosa que s'ha de tocar.
// ---------------------------------------------------------------------------

var fs = require('fs');
var path = require('path');


// --- Constants --------------------------------------------------------------

// On és la còpia.
var WORKER = 'worker/worker.js';

// Les peces copiades, agrupades per l'original d'on surten. COMARCA_VALUES i
// CATEGORIA_VALUES no hi són a posta: les compara valor per valor
// eines/verifica-enum.js, i aquí només en faria nosa el salt de línia.
var COPIES = [
  {
    original: 'eines/fila-segura.js',
    noms: [
      'CAMPS', 'SOSTRES', 'SOSTRE_ADRECA', 'PATRO_DATA', 'PATRO_TAG_AL_DAVANT',
      'filaSegura', 'textDelCamp', 'tallaAlsSostres', 'talla', 'dataSegura',
      'adrecaSegura', 'notaSenseTagsFalsos', 'ajuntaAvisos',
      'valorPermes', 'creaId'
    ]
  },
  {
    original: 'url-segura.js',
    noms: ['ESQUEMES_SEGURS', 'esUrlSegura']
  },
  {
    original: 'eines/admet-entrada.js',
    noms: [
      'MAX_FILES_PORTES_PER_DIA', 'MAX_CARACTERS_CORREU', 'MARCA_ADT66',
      'admetEntrada', 'filesDeLesPortesDAvui'
    ]
  }
];


// --- La lectura -------------------------------------------------------------

// ------------------------------------------------------------
// Les línies d'un fitxer, sense els finals CRLF. Torna null i ho diu si no
// es pot llegir.
// ------------------------------------------------------------
function llegeixLinies(arrel, cami) {
  try {
    return fs.readFileSync(path.join(arrel, cami), 'utf8').split(/\r?\n/);
  } catch (error) {
    console.error('No es pot llegir ' + cami + ': ' + error.message);
    return null;
  }
}

// ------------------------------------------------------------
// Els índexs de les línies on comença una declaració de `nom` a la columna 0.
// ------------------------------------------------------------
function iniciDeclaracions(linies, nom) {
  var patro = new RegExp('^(function ' + nom + '\\(|var ' + nom + ' =)');
  var trobats = [];
  for (var i = 0; i < linies.length; i++) {
    if (patro.test(linies[i])) {
      trobats.push(i);
    }
  }
  return trobats;
}

// ------------------------------------------------------------
// Les línies de la declaració que comença a `inici`: una funció fins a la `}`
// de la columna 0; un `var` fins a la línia que acaba en `;` a la columna 0
// (`];`, `};`) o, si és d'una línia, només aquella. Torna null si no es tanca.
// ------------------------------------------------------------
function declaracio(linies, inici) {
  var esFuncio = linies[inici].indexOf('function ') === 0;
  if (!esFuncio && /;\s*$/.test(linies[inici])) {
    return [linies[inici]];
  }

  for (var i = inici + 1; i < linies.length; i++) {
    if (esFuncio && linies[i] === '}') {
      return linies.slice(inici, i + 1);
    }
    if (!esFuncio && /^[\]\}];\s*$/.test(linies[i])) {
      return linies.slice(inici, i + 1);
    }
  }
  return null;
}

// ------------------------------------------------------------
// Les línies de codi d'una declaració: fora les línies en blanc, fora les que
// només són comentari, i fora els espais del final.
// ------------------------------------------------------------
function codi(linies) {
  var net = [];
  for (var i = 0; i < linies.length; i++) {
    var linia = linies[i].replace(/\s+$/, '');
    var sensSagnat = linia.trim();
    if (sensSagnat === '' || sensSagnat.indexOf('//') === 0) {
      continue;
    }
    net.push(linia);
  }
  return net;
}


// --- La comparació ----------------------------------------------------------

// ------------------------------------------------------------
// Els problemes d'un nom: que no hi sigui, que hi sigui dos cops, que no es
// tanqui o que el codi no sigui igual. Torna una llista de textos.
// ------------------------------------------------------------
function comparaNom(nom, original, liniesOriginal, liniesWorker) {
  var problemes = [];
  var aOriginal = iniciDeclaracions(liniesOriginal, nom);
  var aWorker = iniciDeclaracions(liniesWorker, nom);

  if (aOriginal.length !== 1) {
    problemes.push(nom + ': ' + original + ' en té ' + aOriginal.length + ' declaracions, n\'hi ha d\'haver una.');
  }
  if (aWorker.length !== 1) {
    problemes.push(nom + ': ' + WORKER + ' en té ' + aWorker.length + ' declaracions, n\'hi ha d\'haver una.');
  }
  if (problemes.length > 0) {
    return problemes;
  }

  var tros = declaracio(liniesOriginal, aOriginal[0]);
  var copia = declaracio(liniesWorker, aWorker[0]);
  if (tros === null || copia === null) {
    problemes.push(nom + ': la declaració no es tanca on s\'espera.');
    return problemes;
  }

  var a = codi(tros);
  var b = codi(copia);
  for (var i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      problemes.push(nom + ': diferent a ' + WORKER + ' (línia ' + (aWorker[0] + 1) + ').\n' +
        '    a ' + original + ': ' + (a[i] === undefined ? '(res)' : a[i].trim()) + '\n' +
        '    al Worker:  ' + (b[i] === undefined ? '(res)' : b[i].trim()));
      break;
    }
  }
  return problemes;
}

// ------------------------------------------------------------
// Compara totes les peces de la taula i n'informa. Posa el codi de sortida a 1
// si n'hi ha cap que no quadri.
// ------------------------------------------------------------
function main() {
  var arrel = process.argv[2] || path.join(__dirname, '..');
  var liniesWorker = llegeixLinies(arrel, WORKER);
  if (liniesWorker === null) {
    process.exitCode = 1;
    return;
  }

  var problemes = [];
  var comptades = 0;
  for (var i = 0; i < COPIES.length; i++) {
    var liniesOriginal = llegeixLinies(arrel, COPIES[i].original);
    if (liniesOriginal === null) {
      process.exitCode = 1;
      return;
    }
    for (var j = 0; j < COPIES[i].noms.length; j++) {
      problemes = problemes.concat(comparaNom(COPIES[i].noms[j], COPIES[i].original, liniesOriginal, liniesWorker));
      comptades++;
    }
  }

  for (var k = 0; k < problemes.length; k++) {
    console.error('MALAMENT  ' + problemes[k]);
  }
  if (problemes.length > 0) {
    console.error('\n' + comptades + ' peces comprovades, ' + problemes.length + ' problemes. ' +
      'Copia l\'original al Worker, regenera worker/worker-concatenat.js i torna-ho a provar.');
    process.exitCode = 1;
    return;
  }
  console.log(comptades + ' peces comprovades, 0 problemes: les còpies del Worker són literals.');
}

main();
