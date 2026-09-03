// ---------------------------------------------------------------------------
// VERIFICADOR DE L'ENUM
//
// Una sola feina: comprovar que les llistes de `comarca` i de `categoria`
// diuen exactament el mateix a tots els llocs del repositori on es copien.
// No arregla res, no escriu res, no toca la xarxa. Només mira i informa.
//
// PER QUÈ EXISTEIX AQUEST FITXER. El projecte no té cap sistema de mòduls
// —vegeu el §3 de CLAUDE.md—, o sigui que cada punt d'entrada porta la seva
// còpia de la llista a mà. N'hi ha catorze de `categoria` en nou fitxers. Cap
// compilador no en pot comparar cap parell, perquè no hi ha compilador.
//
// El 29 d'agost de 2026 es va afegir `Concentració` a l'enum i es va posar
// només a dos dels catorze llocs (el filtre i les icones d'`app.js`). El
// resultat va ser una fila publicada a `events.json` amb una categoria que
// `curador.html` i `worker/worker.js` no reconeixien i que `valorPermes()`
// hauria buidat en silenci en desar-la. Cap error, cap avís, cap registre.
// Aquest guió és el que hauria cridat aquell dia.
//
// D'ON SURT LA LLISTA BONA. **No d'aquí.** Aquest fitxer NO declara cap enum,
// a posta: si en declarés un, seria la còpia número quinze i tindria el mateix
// problema que vol resoldre. La llista bona la llegeix de
// `prompts/extract-event.txt`, que el §7 de CLAUDE.md ja diu que és el mestre,
// i tots els altres llocs es comparen contra aquell.
//
// Això vol dir que per afegir una categoria es comença sempre pel prompt. Si
// algú la posa només al prompt, aquest guió marcarà els altres tretze llocs
// com a incorrectes, que és exactament el que ha de dir.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/verifica-enum.js
//
// Torna 0 si tot quadra i 1 si res no quadra, de manera que també serveix per
// aturar qualsevol cosa que el cridi abans de desplegar.
//
// SI HI AFEGEIXES UN LLOC: la taula `LLOCS` d'aquí baix és l'única cosa que
// s'ha de tocar, i ha de dir el mateix que el §4 bis de CLAUDE.md. Si algun
// dia les dues llistes no diuen el mateix, la del §4 bis és la de referència
// per al lector i aquesta és la que es comprova de debò: quadreu-les.
// ---------------------------------------------------------------------------

var fs = require('fs');
var path = require('path');


// --- Constants --------------------------------------------------------------

// L'arrel del repositori, vista des d'aquesta carpeta.
var ARREL = path.join(__dirname, '..');

// El fitxer que manda: d'aquí surten les dues llistes bones.
var CAMI_MESTRE = 'prompts/extract-event.txt';

// Els llocs on es copia un enum, amb la manera de treure-l'en. `enum` diu
// quina de les dues llistes hi ha; `com` diu quin extractor la sap llegir, i
// `nom` és el que necessita l'extractor per trobar-la.
//
// L'ordre és el del §4 bis de CLAUDE.md, per poder-los comparar d'una ullada.
var LLOCS = [
  // 1. El mestre. Es comprova ell mateix (recompte i duplicats), no contra
  //    ningú: no té ningú per damunt.
  { fitxer: 'prompts/extract-event.txt', que: 'línia del prompt', enumeracio: 'categoria', com: 'prompt', nom: 'categoria' },
  { fitxer: 'prompts/extract-event.txt', que: 'línia del prompt', enumeracio: 'comarca', com: 'prompt', nom: 'comarca' },

  // 2-5. El Worker, i el Worker concatenat. Cadascun en porta DUES de cada:
  //      l'array que fa servir valorPermes() i la còpia literal del prompt.
  { fitxer: 'worker/worker.js', que: 'CATEGORIA_VALUES', enumeracio: 'categoria', com: 'array', nom: 'CATEGORIA_VALUES' },
  { fitxer: 'worker/worker.js', que: 'còpia del prompt', enumeracio: 'categoria', com: 'prompt', nom: 'categoria' },
  { fitxer: 'worker/worker.js', que: 'COMARCA_VALUES', enumeracio: 'comarca', com: 'array', nom: 'COMARCA_VALUES' },
  { fitxer: 'worker/worker.js', que: 'còpia del prompt', enumeracio: 'comarca', com: 'prompt', nom: 'comarca' },
  { fitxer: 'worker/worker.js', que: 'COMARQUES_BREVO', enumeracio: 'comarca', com: 'brevo', nom: 'COMARQUES_BREVO' },

  { fitxer: 'worker/worker-concatenat.js', que: 'CATEGORIA_VALUES', enumeracio: 'categoria', com: 'array', nom: 'CATEGORIA_VALUES' },
  { fitxer: 'worker/worker-concatenat.js', que: 'còpia del prompt', enumeracio: 'categoria', com: 'prompt', nom: 'categoria' },
  { fitxer: 'worker/worker-concatenat.js', que: 'COMARCA_VALUES', enumeracio: 'comarca', com: 'array', nom: 'COMARCA_VALUES' },
  { fitxer: 'worker/worker-concatenat.js', que: 'còpia del prompt', enumeracio: 'comarca', com: 'prompt', nom: 'comarca' },
  { fitxer: 'worker/worker-concatenat.js', que: 'COMARQUES_BREVO', enumeracio: 'comarca', com: 'brevo', nom: 'COMARQUES_BREVO' },

  // 6-7. El web públic: el filtre (amb el francès al costat) i les icones.
  { fitxer: 'app.js', que: 'CATEGORIES (filtre)', enumeracio: 'categoria', com: 'bilingue', nom: 'CATEGORIES' },
  { fitxer: 'app.js', que: 'CATEGORIA_ICONES', enumeracio: 'categoria', com: 'icones', nom: 'CATEGORIA_ICONES' },
  { fitxer: 'app.js', que: 'COMARQUES', enumeracio: 'comarca', com: 'array', nom: 'COMARQUES' },

  // 8. El curador: el desplegable I la coerció en desar, el mateix array.
  { fitxer: 'curador.html', que: 'CATEGORIA_VALUES', enumeracio: 'categoria', com: 'array', nom: 'CATEGORIA_VALUES' },
  { fitxer: 'curador.html', que: 'COMARCA_VALUES', enumeracio: 'comarca', com: 'array', nom: 'COMARCA_VALUES' },

  // 9. La importació del CSV.
  { fitxer: 'importa-csv.js', que: 'CATEGORIA_VALUES', enumeracio: 'categoria', com: 'array', nom: 'CATEGORIA_VALUES' },
  { fitxer: 'importa-csv.js', que: 'COMARCA_VALUES', enumeracio: 'comarca', com: 'array', nom: 'COMARCA_VALUES' },

  // 10-12. Les eines de la canonada.
  { fitxer: 'eines/dedup-esdeveniments.js', que: 'CATEGORIES', enumeracio: 'categoria', com: 'array', nom: 'CATEGORIES' },
  { fitxer: 'eines/dedup-esdeveniments.js', que: 'COMARQUES', enumeracio: 'comarca', com: 'array', nom: 'COMARQUES' },
  { fitxer: 'eines/mapeja-adt66.js', que: 'CATEGORIES', enumeracio: 'categoria', com: 'array', nom: 'CATEGORIES' },
  { fitxer: 'eines/mapeja-adt66.js', que: 'COMARQUES', enumeracio: 'comarca', com: 'array', nom: 'COMARQUES' },
  { fitxer: 'eines/mapeja-recerca.js', que: 'CATEGORIES', enumeracio: 'categoria', com: 'array', nom: 'CATEGORIES' },
  { fitxer: 'eines/mapeja-recerca.js', que: 'COMARQUES', enumeracio: 'comarca', com: 'array', nom: 'COMARQUES' },

  // 13-14. El mirall offline del web públic.
  { fitxer: 'prova-local.html', que: 'CATEGORIES (filtre)', enumeracio: 'categoria', com: 'bilingue', nom: 'CATEGORIES' },
  { fitxer: 'prova-local.html', que: 'CATEGORIA_ICONES', enumeracio: 'categoria', com: 'icones', nom: 'CATEGORIA_ICONES' },
  { fitxer: 'prova-local.html', que: 'COMARQUES', enumeracio: 'comarca', com: 'array', nom: 'COMARQUES' }
];

// Els fitxers que porten una còpia LITERAL del prompt mestre. No n'hi ha prou
// de comprovar que la llista de categories hi quadri: el §7 de CLAUDE.md diu
// que el text sencer ha de ser idèntic al peu de la lletra.
var COPIES_DEL_PROMPT = ['worker/worker.js', 'worker/worker-concatenat.js'];

// Els numerals en català, per comprovar que el prompt diu «tretze» i no «deu»
// quan la llista en té tretze. És l'error que va passar de debò: la llista es
// va allargar i el text del davant es va quedar com era.
var NUMERALS = ['zero', 'un', 'dos', 'tres', 'quatre', 'cinc', 'sis', 'set',
  'vuit', 'nou', 'deu', 'onze', 'dotze', 'tretze', 'catorze', 'quinze',
  'setze', 'disset', 'divuit', 'dinou', 'vint'];


// --- La feina ---------------------------------------------------------------

// ------------------------------------------------------------
// Comprova tots els llocs de la taula i escriu l'informe. Torna el nombre de
// problemes trobats, que és el que decideix el codi de sortida.
// ------------------------------------------------------------
function verificaLenum() {
  var mestre = llegeixFitxer(CAMI_MESTRE);
  var problemes = [];

  if (mestre === null) {
    console.log('MAL  no puc llegir el mestre ' + CAMI_MESTRE);
    return 1;
  }

  // Les dues llistes bones, tretes del mestre.
  var bones = {
    categoria: treuDelPrompt(mestre, 'categoria'),
    comarca: treuDelPrompt(mestre, 'comarca')
  };

  console.log('El mestre és ' + CAMI_MESTRE + '.');

  var noms = ['categoria', 'comarca'];
  for (var i = 0; i < noms.length; i++) {
    var nom = noms[i];
    if (bones[nom] === null) {
      problemes.push('no trobo la línia de «' + nom + '» al mestre');
      console.log('  MAL  la llista de «' + nom + '» no és al mestre');
      continue;
    }
    console.log('  ' + nom + ': ' + bones[nom].valors.length + ' valors — ' +
      bones[nom].valors.join(' · '));
    afegeix(problemes, revisaElMestre(nom, bones[nom]));
  }

  console.log('');
  console.log('Els llocs que s\'hi comparen:');

  for (var j = 0; j < LLOCS.length; j++) {
    afegeix(problemes, revisaUnLloc(LLOCS[j], bones));
  }

  console.log('');
  console.log('Les còpies literals del prompt:');

  for (var k = 0; k < COPIES_DEL_PROMPT.length; k++) {
    afegeix(problemes, revisaLaCopiaDelPrompt(COPIES_DEL_PROMPT[k], mestre));
  }

  console.log('');
  console.log(LLOCS.length + ' llocs comprovats, ' + problemes.length +
    (problemes.length === 1 ? ' problema.' : ' problemes.'));

  if (problemes.length > 0) {
    console.log('');
    console.log('La llista dels llocs on viu l\'enum és al §4 bis de CLAUDE.md.');
  }

  return problemes.length;
}

// ------------------------------------------------------------
// El mestre no es compara amb ningú, o sigui que se li miren les coses que
// pot tenir malament tot sol: valors repetits, valors buits, i el numeral del
// text del davant que no quadri amb quants valors hi ha de debò.
// ------------------------------------------------------------
function revisaElMestre(nom, trobat) {
  var problemes = [];
  var valors = trobat.valors;

  for (var i = 0; i < valors.length; i++) {
    if (valors[i] === '') {
      problemes.push('el mestre té un valor buit a «' + nom + '»');
    }
    if (valors.indexOf(valors[i]) !== i) {
      problemes.push('el mestre repeteix «' + valors[i] + '» a ' + nom);
    }
  }

  var esperat = NUMERALS[valors.length];

  if (esperat === undefined) {
    return problemes;
  }

  if (trobat.numeral !== esperat) {
    problemes.push('el mestre diu «' + trobat.numeral + '» i n\'hi ha ' +
      valors.length + ' («' + esperat + '»)');
    console.log('  MAL  el prompt diu «una d\'aquestes ' + trobat.numeral +
      '» i la llista de «' + nom + '» en té ' + valors.length +
      ': hauria de dir «' + esperat + '»');
  }

  return problemes;
}

// ------------------------------------------------------------
// Un sol lloc de la taula: en treu la llista i la compara amb la bona. La
// comparació és per valor I per ordre, perquè el §4 de CLAUDE.md demana les
// dues coses.
// ------------------------------------------------------------
function revisaUnLloc(lloc, bones) {
  var etiqueta = lloc.fitxer + ' — ' + lloc.que + ' (' + lloc.enumeracio + ')';
  var text = llegeixFitxer(lloc.fitxer);

  if (text === null) {
    console.log('  MAL  ' + etiqueta + ': no puc llegir el fitxer');
    return ['no puc llegir ' + lloc.fitxer];
  }

  var valors = treuLaLlista(text, lloc);

  if (valors === null) {
    console.log('  MAL  ' + etiqueta + ': no hi trobo la llista');
    return ['no trobo la llista a ' + etiqueta];
  }

  var bona = bones[lloc.enumeracio];

  if (bona === null) {
    return [];
  }

  var diferencia = compara(bona.valors, valors);

  if (diferencia === '') {
    console.log('  BÉ   ' + etiqueta + ': ' + valors.length + ' valors');
    return [];
  }

  console.log('  MAL  ' + etiqueta + ': ' + diferencia);
  return [etiqueta + ': ' + diferencia];
}

// ------------------------------------------------------------
// Que la còpia del prompt d'un Worker sigui idèntica al mestre, caràcter per
// caràcter. La tanca markdown va escapada dins del literal de plantilla
// (\` perquè el text viu entre cometes invertides): es desescapa abans de
// comparar, que és l'única diferència legítima que hi pot haver.
// ------------------------------------------------------------
function revisaLaCopiaDelPrompt(cami, mestre) {
  var text = llegeixFitxer(cami);

  if (text === null) {
    console.log('  MAL  ' + cami + ': no puc llegir el fitxer');
    return ['no puc llegir ' + cami];
  }

  var copia = treuElPromptSencer(text);

  if (copia === null) {
    console.log('  MAL  ' + cami + ': no hi trobo EXTRACTION_PROMPT');
    return ['no trobo EXTRACTION_PROMPT a ' + cami];
  }

  if (copia === mestre.trim()) {
    console.log('  BÉ   ' + cami + ': idèntica al mestre (' + copia.length +
      ' caràcters)');
    return [];
  }

  var on = primeraDiferencia(mestre.trim(), copia);
  console.log('  MAL  ' + cami + ': difereix del mestre al caràcter ' + on);
  console.log('       mestre: ' + retall(mestre.trim(), on));
  console.log('       còpia:  ' + retall(copia, on));
  return [cami + ': la còpia del prompt no és literal'];
}


// --- Els extractors ---------------------------------------------------------

// ------------------------------------------------------------
// Tria l'extractor que toca segons el `com` del lloc.
// ------------------------------------------------------------
function treuLaLlista(text, lloc) {
  if (lloc.com === 'array') {
    return treuUnArray(text, lloc.nom);
  }
  if (lloc.com === 'bilingue') {
    return treuElsCatalansDunArray(text, lloc.nom);
  }
  if (lloc.com === 'icones') {
    return treuLesClausDunMapa(text, lloc.nom);
  }
  if (lloc.com === 'brevo') {
    return treuLesComarquesDeBrevo(text, lloc.nom);
  }
  if (lloc.com === 'prompt') {
    var trobat = treuDelPrompt(text, lloc.nom);
    return trobat === null ? null : trobat.valors;
  }
  return null;
}

// ------------------------------------------------------------
// La línia del prompt d'un camp d'enumeració. Torna el numeral que hi diu i
// els valors, perquè les dues coses s'han de comprovar.
//
//   - categoria: NOMÉS una d'aquestes tretze, escrita exactament així: Música,
//     Teatre, … Vida associativa. Si cap no encaixa clarament, cadena buida.
// ------------------------------------------------------------
function treuDelPrompt(text, camp) {
  var patro = new RegExp('- ' + camp +
    ': NOMÉS una d\'aquestes (\\w+), escrita exactament així: ([^.]+)\\.');
  var trobat = text.match(patro);

  if (trobat === null) {
    return null;
  }

  return { numeral: trobat[1], valors: parteixPerComes(trobat[2]) };
}

// ------------------------------------------------------------
// Els valors entre cometes simples d'un array de cadenes de JavaScript.
// ------------------------------------------------------------
function treuUnArray(text, nom) {
  var dins = trosDeLaDeclaracio(text, nom, '[', ']');
  return dins === null ? null : totesLesCadenes(dins);
}

// ------------------------------------------------------------
// Els valors `ca:` d'un array d'objectes bilingües: `{ ca: '…', fr: '…' }`.
// Del francès no se'n comprova res: no és cap enum, és una traducció.
// ------------------------------------------------------------
function treuElsCatalansDunArray(text, nom) {
  var dins = trosDeLaDeclaracio(text, nom, '[', ']');

  if (dins === null) {
    return null;
  }

  return totesLesCoincidencies(dins, /ca:\s*'([^']*)'/g);
}

// ------------------------------------------------------------
// Les claus d'un mapa de categoria a alguna cosa (avui, a icona SVG). Només
// mira les claus que obren una línia, perquè dins del text d'una icona hi pot
// haver qualsevol cosa entre cometes.
// ------------------------------------------------------------
function treuLesClausDunMapa(text, nom) {
  var dins = trosDeLaDeclaracio(text, nom, '{', '}');

  if (dins === null) {
    return null;
  }

  return totesLesCoincidencies(dins, /^\s*'([^']*)':/gm);
}

// ------------------------------------------------------------
// El camp `comarca` de la taula de llistes de Brevo del Worker. És un lloc de
// debò on viu l'enum, i dels traïdors: si algun dia s'hi afegís una comarca
// sense afegir-la aquí, el digest d'aquella comarca no s'enviaria mai, i el
// Worker no en diria res perquè per a ell la taula sencera és la veritat.
// ------------------------------------------------------------
function treuLesComarquesDeBrevo(text, nom) {
  var dins = trosDeLaDeclaracio(text, nom, '[', ']');

  if (dins === null) {
    return null;
  }

  return totesLesCoincidencies(dins, /comarca:\s*'([^']*)'/g);
}

// ------------------------------------------------------------
// El text sencer del literal de plantilla `EXTRACTION_PROMPT`, desescapat.
// La tanca del literal és la primera cometa invertida que NO va precedida
// d'una barra invertida.
// ------------------------------------------------------------
function treuElPromptSencer(text) {
  var obre = text.indexOf('var EXTRACTION_PROMPT = `');

  if (obre === -1) {
    return null;
  }

  var des = obre + 'var EXTRACTION_PROMPT = `'.length;
  var i = des;

  while (true) {
    i = text.indexOf('`', i);
    if (i === -1) {
      return null;
    }
    if (text.charAt(i - 1) !== '\\') {
      break;
    }
    i += 1;
  }

  return text.slice(des, i).trim().split('\\`').join('`');
}


// --- Les peces petites ------------------------------------------------------

// ------------------------------------------------------------
// El tros de text de dins dels delimitadors d'una declaració `var nom = …`.
// Compta els delimitadors que s'obren i es tanquen, de manera que un mapa amb
// claus a dins (o un array amb objectes) no s'escapci per la primera tanca.
// ------------------------------------------------------------
function trosDeLaDeclaracio(text, nom, obre, tanca) {
  var patro = new RegExp('var\\s+' + nom + '\\s*=\\s*\\' + obre);
  var trobat = text.match(patro);

  if (trobat === null) {
    return null;
  }

  var des = trobat.index + trobat[0].length;
  var nivell = 1;

  for (var i = des; i < text.length; i++) {
    var lletra = text.charAt(i);
    if (lletra === obre) {
      nivell += 1;
    } else if (lletra === tanca) {
      nivell -= 1;
      if (nivell === 0) {
        return text.slice(des, i);
      }
    }
  }

  return null;
}

// ------------------------------------------------------------
// Totes les cadenes entre cometes simples d'un tros de codi.
// ------------------------------------------------------------
function totesLesCadenes(text) {
  return totesLesCoincidencies(text, /'([^']*)'/g);
}

// ------------------------------------------------------------
// El primer grup de captura de totes les coincidències d'un patró global.
// ------------------------------------------------------------
function totesLesCoincidencies(text, patro) {
  var trobades = [];

  patro.lastIndex = 0;
  var trobat = patro.exec(text);

  while (trobat !== null) {
    trobades.push(trobat[1]);
    trobat = patro.exec(text);
  }

  return trobades;
}

// ------------------------------------------------------------
// Una llista escrita amb comes en una sola línia, partida i neta d'espais.
// ------------------------------------------------------------
function parteixPerComes(text) {
  var trossos = text.split(',');
  var valors = [];

  for (var i = 0; i < trossos.length; i++) {
    var net = trossos[i].trim();
    if (net !== '') {
      valors.push(net);
    }
  }

  return valors;
}

// ------------------------------------------------------------
// Compara dues llistes per valor i per ordre. Torna '' si són iguals, i si no
// una frase que digui què falta, què hi sobra o què està desordenat.
// ------------------------------------------------------------
function compara(bona, trobada) {
  var falten = [];
  var sobren = [];
  var i;

  for (i = 0; i < bona.length; i++) {
    if (trobada.indexOf(bona[i]) === -1) {
      falten.push(bona[i]);
    }
  }
  for (i = 0; i < trobada.length; i++) {
    if (bona.indexOf(trobada[i]) === -1) {
      sobren.push(trobada[i]);
    }
  }

  if (falten.length > 0 || sobren.length > 0) {
    var parts = [];
    if (falten.length > 0) {
      parts.push('hi falta «' + falten.join('», «') + '»');
    }
    if (sobren.length > 0) {
      parts.push('hi sobra «' + sobren.join('», «') + '»');
    }
    return parts.join(' i ');
  }

  if (bona.join('|') !== trobada.join('|')) {
    return 'hi són tots però en un altre ordre: ' + trobada.join(' · ');
  }

  return '';
}

// ------------------------------------------------------------
// La posició del primer caràcter en què dues cadenes deixen de coincidir.
// ------------------------------------------------------------
function primeraDiferencia(a, b) {
  var fins = Math.min(a.length, b.length);

  for (var i = 0; i < fins; i++) {
    if (a.charAt(i) !== b.charAt(i)) {
      return i;
    }
  }

  return fins;
}

// ------------------------------------------------------------
// Un tros curt de text al voltant d'una posició, per ensenyar on falla.
// ------------------------------------------------------------
function retall(text, on) {
  var des = Math.max(0, on - 40);
  return '…' + text.slice(des, on + 40).split('\n').join('\\n') + '…';
}

// ------------------------------------------------------------
// Un fitxer del repositori com a text, o null si no s'hi pot llegir. Els
// salts de línia es normalitzen: al Windows del propietari, Git pot deixar
// CRLF, i una comparació de text no ha de fallar per això.
// ------------------------------------------------------------
function llegeixFitxer(cami) {
  try {
    var text = fs.readFileSync(path.join(ARREL, cami), 'utf8');
    return text.split('\r\n').join('\n');
  } catch (error) {
    return null;
  }
}

// ------------------------------------------------------------
// Afegeix tots els problemes d'una llista a una altra. Un `push` per element
// perquè la llista de fora és la que compta i no es vol substituir.
// ------------------------------------------------------------
function afegeix(problemes, nous) {
  for (var i = 0; i < nous.length; i++) {
    problemes.push(nous[i]);
  }
}


// --- El que surt d'aquest fitxer --------------------------------------------
// La funció, per si algun dia es vol cridar des d'un altre guió abans de
// desplegar. Les peces de dins són seves.

module.exports = {
  verificaLenum: verificaLenum
};


// --- Des del terminal -------------------------------------------------------

if (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    process.argv[1].indexOf('verifica-enum') !== -1) {
  process.exitCode = verificaLenum() > 0 ? 1 : 0;
}
