// ---------------------------------------------------------------------------
// VERIFICADOR DEL WORKER CONCATENAT
//
// Una sola feina: comprovar que `worker/worker-concatenat.js` és, exactament,
// `worker/postal-mime.js` + un bàner + `worker/worker.js`, amb les dues úniques
// retallades que la convenció permet. No arregla res, no escriu res, no toca la
// xarxa. Només mira i informa.
//
// PER QUÈ EXISTEIX. El §3 de CLAUDE.md diu que el Worker es desplega enganxant
// el codi al tauler de Cloudflare, i que la sortida acceptada és concatenar el
// fitxer vendoritzat dins el Worker. El concatenat és una còpia feta a mà: si
// `worker.js` canvia i el concatenat no, el tauler rep codi vell sense cap error.
//
// LA CONVENCIÓ QUE COMPROVA:
//
//   A. El concatenat comença amb `postal-mime.js` sense la línia
//      `export default PostalMime;`, línia per línia.
//   B. El concatenat acaba amb `worker.js` sense la línia
//      `import PostalMime from './postal-mime.js';` ni la línia de just abans
//      ni la de just després, si són en blanc.
//   C. Entre A i B només hi ha línies en blanc o de comentari (`//` després de
//      treure els espais), i almenys una conté
//      `FI DE LA DEPENDÈNCIA VENDORITZADA`.
//
// Les regles es comproven en l'ordre A, B, C i s'informa només de la primera
// que falla. Els números de línia són 1-based; els de la font són els del
// fitxer original (comptant-hi les línies que s'han tret).
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/verifica-worker-concatenat.js [carpeta]
//
// Per omissió la carpeta és `worker/`. Torna 0 si tot quadra i 1 si no.
// ---------------------------------------------------------------------------

var fs = require('fs');
var path = require('path');


// --- Constants --------------------------------------------------------------

var LINIA_EXPORT = 'export default PostalMime;';
var LINIA_IMPORT = "import PostalMime from './postal-mime.js';";
var MARCADOR = 'FI DE LA DEPENDÈNCIA VENDORITZADA';
var LLARGADA_MAXIMA = 120;
var FRASE_FINAL = "Torna a generar worker/worker-concatenat.js (CLAUDE.md §3) i no l'enganxis al tauler fins que això surti en verd.";


// --- Lectura ----------------------------------------------------------------

// Llegeix un fitxer i el parteix en línies (CRLF o LF), sense l'element buit final.
function llegeixLinies(cami) {
  var text = fs.readFileSync(cami, 'utf8');
  var linies = text.split(/\r?\n/);
  if (linies.length > 0 && linies[linies.length - 1] === '') {
    linies.pop();
  }
  return linies;
}

// Llegeix un fitxer; si no es pot, ho diu i torna null.
function llegeixOInforma(carpeta, nom) {
  try {
    return llegeixLinies(path.join(carpeta, nom));
  } catch (error) {
    console.error('No es pot llegir ' + nom + ': ' + error.message);
    process.exitCode = 1;
    return null;
  }
}


// --- Fonts retallades -------------------------------------------------------

// Torna les línies d'una font sense els índexs indicats, amb el número original de cada una.
function retalla(linies, indexosTrets) {
  var resultat = { text: [], numero: [] };
  for (var i = 0; i < linies.length; i++) {
    if (indexosTrets.indexOf(i) === -1) {
      resultat.text.push(linies[i]);
      resultat.numero.push(i + 1);
    }
  }
  return resultat;
}

// La font A: postal-mime.js sense la línia de l'export.
function construeixFontA(linies) {
  var indexExport = linies.indexOf(LINIA_EXPORT);
  if (indexExport === -1) {
    return null;
  }
  return retalla(linies, [indexExport]);
}

// La font B: worker.js sense l'import ni les línies en blanc veïnes.
function construeixFontB(linies) {
  var indexImport = linies.indexOf(LINIA_IMPORT);
  if (indexImport === -1) {
    return null;
  }
  var trets = [indexImport];
  if (indexImport > 0 && linies[indexImport - 1].trim() === '') {
    trets.push(indexImport - 1);
  }
  if (indexImport + 1 < linies.length && linies[indexImport + 1].trim() === '') {
    trets.push(indexImport + 1);
  }
  return retalla(linies, trets);
}


// --- Informes ---------------------------------------------------------------

// Talla un text a la llargada màxima de la sortida.
function talla(text) {
  if (text === undefined) {
    return '(no hi ha cap línia)';
  }
  if (text.length > LLARGADA_MAXIMA) {
    return text.slice(0, LLARGADA_MAXIMA);
  }
  return text;
}

// Escriu l'informe de fallada d'una regla i marca la sortida com a 1.
function informaFallada(regla, motiu, numeroConcatenat, textConcatenat, descripcioFont, textFont) {
  console.error('Regla ' + regla + ' no es compleix: ' + motiu);
  console.error('  Concatenat, línia ' + numeroConcatenat + ': ' + talla(textConcatenat));
  console.error('  Font, ' + descripcioFont + ': ' + talla(textFont));
  console.error(FRASE_FINAL);
  process.exitCode = 1;
}


// --- Regles -----------------------------------------------------------------

// Regla A: les primeres línies del concatenat són la font A. Torna true si quadra.
function comprovaReglaA(concatenat, fontA) {
  for (var i = 0; i < fontA.text.length; i++) {
    if (concatenat[i] !== fontA.text[i]) {
      informaFallada('A', 'el concatenat no comença amb postal-mime.js.', i + 1, concatenat[i],
        'postal-mime.js línia ' + fontA.numero[i], fontA.text[i]);
      return false;
    }
  }
  return true;
}

// Regla B: les últimes línies del concatenat són la font B. Torna true si quadra.
function comprovaReglaB(concatenat, fontB) {
  var inici = concatenat.length - fontB.text.length;
  for (var k = 0; k < fontB.text.length; k++) {
    var indexConcatenat = inici + k;
    var textConcatenat = undefined;
    if (indexConcatenat >= 0) {
      textConcatenat = concatenat[indexConcatenat];
    }
    if (textConcatenat !== fontB.text[k]) {
      informaFallada('B', 'el concatenat no acaba amb worker.js.', indexConcatenat + 1, textConcatenat,
        'worker.js línia ' + fontB.numero[k], fontB.text[k]);
      return false;
    }
  }
  return true;
}

// Regla C: el bàner del mig és només blanc o comentari i porta el marcador. Torna true si quadra.
function comprovaReglaC(concatenat, llargadaA, llargadaB) {
  var primera = llargadaA;
  var darrera = concatenat.length - llargadaB;
  if (darrera < primera) {
    informaFallada('C', 'el concatenat té menys línies que A + B: les dues zones es trepitgen.',
      concatenat.length, concatenat[concatenat.length - 1],
      'no existeix per a C', '(la regla C no té font)');
    return false;
  }
  var trobatMarcador = false;
  for (var i = primera; i < darrera; i++) {
    var neta = concatenat[i].trim();
    if (neta !== '' && neta.indexOf('//') !== 0) {
      informaFallada('C', 'el bàner té una línia que no és en blanc ni de comentari.',
        i + 1, concatenat[i], 'no existeix per a C', '(la regla C no té font)');
      return false;
    }
    if (concatenat[i].indexOf(MARCADOR) !== -1) {
      trobatMarcador = true;
    }
  }
  if (!trobatMarcador) {
    informaFallada('C', 'cap línia del bàner conté «' + MARCADOR + '».',
      primera + 1, concatenat[primera], 'no existeix per a C', '(la regla C no té font)');
    return false;
  }
  return true;
}


// --- Principal --------------------------------------------------------------

// Llegeix els tres fitxers, aplica A, B i C en ordre i informa.
function main() {
  var carpeta = process.argv[2];
  if (!carpeta) {
    carpeta = path.join(__dirname, '..', 'worker');
  }

  var postal = llegeixOInforma(carpeta, 'postal-mime.js');
  var worker = llegeixOInforma(carpeta, 'worker.js');
  var concatenat = llegeixOInforma(carpeta, 'worker-concatenat.js');
  if (postal === null || worker === null || concatenat === null) {
    return;
  }

  var fontA = construeixFontA(postal);
  if (fontA === null) {
    console.error('A postal-mime.js no hi ha la línia «' + LINIA_EXPORT + '»; no es pot comprovar res més.');
    process.exitCode = 1;
    return;
  }
  var fontB = construeixFontB(worker);
  if (fontB === null) {
    console.error('A worker.js no hi ha la línia «' + LINIA_IMPORT + '»; no es pot comprovar res més.');
    process.exitCode = 1;
    return;
  }

  if (!comprovaReglaA(concatenat, fontA)) {
    return;
  }
  if (!comprovaReglaB(concatenat, fontB)) {
    return;
  }
  if (!comprovaReglaC(concatenat, fontA.text.length, fontB.text.length)) {
    return;
  }

  var llargadaBaner = concatenat.length - fontA.text.length - fontB.text.length;
  console.log('worker-concatenat.js coincideix amb postal-mime.js i worker.js (A: ' +
    fontA.text.length + ' línies, bàner: ' + llargadaBaner + ', B: ' + fontB.text.length + ').');
}

main();
