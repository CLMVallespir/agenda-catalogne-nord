// ---------------------------------------------------------------------------
// VERIFICADOR DEL JOC DE CAMPS
//
// Una sola feina: comprovar que el joc de camps d'un esdeveniment diu
// exactament el mateix a tots els llocs del repositori on s'escriu a mà.
// No arregla res, no escriu res, no toca la xarxa. Només mira i informa.
//
// PER QUÈ EXISTEIX AQUEST FITXER. És el germà de `verifica-enum.js`, i neix
// del mateix problema amb una agreujant. L'enum viu a catorze còpies i, quan
// se'n van tocar dues de catorze, la conseqüència va ser visible: una fila amb
// una categoria que `valorPermes()` buidava. El JOC DE CAMPS viu a més llocs
// encara, i quan se'n toca un de sol la conseqüència NO es veu: no hi ha cap
// `valorPermes()` dels noms de camp, i el camp que falta simplement no hi és.
// Cap error, cap avís, cap registre, cap bateria aturada.
//
// El §4.G de `docs/DECISIO-ACTIVITATS-PERMANENTS.md` ho diu així: «Res, avui,
// no enxamparia una fila que hagi perdut el camp nou en un dels 23 llocs.»
// Aquest guió és aquell «res».
//
// D'ON SURT LA LLISTA BONA. **No d'aquí.** Com a `verifica-enum.js`, aquest
// fitxer NO declara el joc de camps: si el declarés seria una còpia més i
// tindria el mateix problema que vol resoldre. La llista bona la llegeix de
// `prompts/extract-event.txt`, que el §7 de CLAUDE.md ja diu que és el mestre,
// i tots els altres llocs es comparen contra aquell.
//
// L'ÚNICA EXCEPCIÓ, I ÉS A POSTA: `nota_curador`. El mestre no el pot dir,
// perquè el mestre és el prompt d'extracció i el §4 de CLAUDE.md prohibeix que
// el model l'ompli: «el prompt no el coneix». És l'únic nom de camp que aquest
// fitxer escriu, a la constant `CAMP_DE_CUA` d'aquí baix, i queda dit aquí
// perquè ningú no ho confongui amb un descuit.
//
// LES TRES MENES DE LLOC. No tots els llocs han de portar els mateixos camps,
// i la taula `LLOCS` diu de quina mena és cadascun:
//
//   public    els camps del mestre i cap més. És el contracte d'`events.json`
//   cua       els del mestre més `nota_curador`. És el de `pendents.json`
//   editable  els del mestre menys els que omple el sistema (CAMPS_DEL_SISTEMA)
//
// EL QUE AQUEST GUIÓ NO MIRA, i queda dit perquè no s'hi confiï de més:
//
//   - `CAMPS_CONTRASTABLES` d'`eines/verifica-esdeveniment.js` (9 camps). És
//     curt A POSTA —el comentari de la 125 ho explica— i no és cap còpia del
//     joc de camps: és una tria de què es pot contrastar amb la font original.
//     No hi entra.
//   - Les files de prova en línia de `prova-local.html` i els fitxers de
//     dades (`events.json`, `pendents.json`, `events-exemple.json`): són
//     dades, no esquemes. Una fila a qui li falti un camp es comporta com si
//     el tingués buit, que és el que diu el §4.F de la decisió.
//   - `docs/arxiu-google/`: codi mort (§9 de CLAUDE.md).
//   - Els numerals escrits en prosa dins dels comentaris («els disset
//     camps»). Sí que es mira, en canvi, el numeral del prompt («aquestes 16
//     claus»), perquè aquell text se li envia al model de debò.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/verifica-camps.js
//
// Torna 0 si tot quadra i 1 si res no quadra, de manera que també serveix per
// aturar qualsevol cosa que el cridi abans de desplegar.
//
// SI HI AFEGEIXES UN LLOC: la taula `LLOCS` d'aquí baix és l'única cosa que
// s'ha de tocar, i ha de dir el mateix que el §4 de
// `docs/DECISIO-ACTIVITATS-PERMANENTS.md`. La columna `punt` és el número que
// aquell inventari li dona, per poder-los comparar d'una ullada.
// ---------------------------------------------------------------------------

var fs = require('fs');
var path = require('path');


// --- Constants --------------------------------------------------------------

// L'arrel del repositori, vista des d'aquesta carpeta.
var ARREL = path.join(__dirname, '..');

// El fitxer que mana: d'aquí surt la llista bona.
var CAMI_MESTRE = 'prompts/extract-event.txt';

// L'únic nom de camp que aquest fitxer escriu, i el bàner de dalt explica per
// què no el pot llegir d'enlloc.
var CAMP_DE_CUA = 'nota_curador';

// Els camps que el curador NO pot editar a la fitxa perquè els omple el
// sistema: l'id el reconstrueix `creaId()` en desar, i l'estat i la data
// d'entrada es queden com eren. Compte: `imatge_url` i `font_url` SÍ que són
// editables encara que el model no els ompli mai, o sigui que aquesta llista
// no és la de «CAMPS QUE NO HAS D'OMPLIR MAI» del prompt.
var CAMPS_DEL_SISTEMA = ['id', 'estat', 'data_entrada'];

// Els llocs on el joc de camps s'escriu a mà, amb la manera de treure-l'en.
// `mena` diu quins camps hi ha d'haver; `com` diu quin extractor els sap
// llegir. L'ordre és el del §4 de la decisió, i `punt` és el seu número.
var LLOCS = [
  // --- Les còpies del prompt (§4.A) ---------------------------------------
  // El mestre no es compara amb ningú: d'ell surt la llista bona. El que sí
  // que se li mira és que l'exemple de resposta digui les mateixes claus que
  // la línia de dalt, que és la manera que té de contradir-se ell tot sol.
  { punt: '1', fitxer: 'prompts/extract-event.txt', que: 'exemple de resposta', mena: 'public', com: 'exemple' },
  { punt: '2', fitxer: 'worker/worker.js', que: 'còpia del prompt — línia de claus', mena: 'public', com: 'prompt' },
  { punt: '2', fitxer: 'worker/worker.js', que: 'còpia del prompt — exemple', mena: 'public', com: 'exemple' },
  { punt: '3', fitxer: 'worker/worker-concatenat.js', que: 'còpia del prompt — línia de claus', mena: 'public', com: 'prompt' },
  { punt: '3', fitxer: 'worker/worker-concatenat.js', que: 'còpia del prompt — exemple', mena: 'public', com: 'exemple' },

  // --- Els constructors de fila de les portes d'entrada (§4.B) ------------
  { punt: '4', fitxer: 'worker/worker.js', que: 'construeixFila()', mena: 'public', com: 'objecte', dins: 'construeixFila', obre: 'return {' },
  { punt: '5', fitxer: 'worker/worker.js', que: 'construeixFilaFormulari()', mena: 'public', com: 'objecte', dins: 'construeixFilaFormulari', obre: 'return {' },
  { punt: '6', fitxer: 'worker/worker-concatenat.js', que: 'construeixFila()', mena: 'public', com: 'objecte', dins: 'construeixFila', obre: 'return {' },
  { punt: '7', fitxer: 'worker/worker-concatenat.js', que: 'construeixFilaFormulari()', mena: 'public', com: 'objecte', dins: 'construeixFilaFormulari', obre: 'return {' },
  { punt: '8', fitxer: 'curador.html', que: 'recullFitxa()', mena: 'public', com: 'objecte', dins: 'recullFitxa', obre: 'return {' },
  { punt: '9', fitxer: 'curador.html', que: 'creaFitxa() — camps editables', mena: 'editable', com: 'fitxa', dins: 'creaFitxa' },
  { punt: '10', fitxer: 'importa-csv.js', que: 'ESQUEMA', mena: 'public', com: 'array', nom: 'ESQUEMA' },
  { punt: '11', fitxer: 'importa-csv.js', que: 'construeixFila()', mena: 'public', com: 'objecte', dins: 'construeixFila', obre: 'return {' },
  { punt: '12', fitxer: 'eines/mapeja-adt66.js', que: 'CAMPS_PRODUCCIO', mena: 'cua', com: 'array', nom: 'CAMPS_PRODUCCIO' },
  { punt: '13', fitxer: 'eines/mapeja-adt66.js', que: 'mapejaOfertaADT66()', mena: 'cua', com: 'objecte', dins: 'mapejaOfertaADT66', obre: 'var fila = {' },
  { punt: '14', fitxer: 'eines/mapeja-recerca.js', que: 'CAMPS_PRODUCCIO', mena: 'cua', com: 'array', nom: 'CAMPS_PRODUCCIO' },
  { punt: '15', fitxer: 'eines/mapeja-recerca.js', que: 'mapejaAProduccio()', mena: 'cua', com: 'objecte', dins: 'mapejaAProduccio', obre: 'var fila = {' },

  // --- Els consumidors de dades (§4.C) ------------------------------------
  { punt: '16', fitxer: 'eines/dedup-esdeveniments.js', que: 'CAMPS', mena: 'cua', com: 'array', nom: 'CAMPS' },
  { punt: '18', fitxer: 'eines/processa-lot.js', que: 'CAMPS_PRODUCCIO', mena: 'cua', com: 'array', nom: 'CAMPS_PRODUCCIO' },

  // --- Els ajudants de prova (§5) -----------------------------------------
  // Aquests sis són el deute tècnic que la decisió inventaria: llistes de
  // camps escrites a mà dins d'un ajudant de prova, sense ningú que les
  // compari amb la mestra. Aquest guió és aquell ningú.
  { punt: '§5', fitxer: 'eines/adt66-identificador.js', que: 'camps de filaDeProva()', mena: 'cua', com: 'array', nom: 'camps', dins: 'filaDeProva' },
  { punt: '§5', fitxer: 'eines/classifica-editorial.js', que: 'CAMPS', mena: 'cua', com: 'array', nom: 'CAMPS' },
  { punt: '§5', fitxer: 'eines/deteccio-retirades.js', que: 'camps de filaDeProva()', mena: 'cua', com: 'array', nom: 'camps', dins: 'filaDeProva' },
  { punt: '§5', fitxer: 'eines/puja-cartell.js', que: 'CAMPS', mena: 'cua', com: 'array', nom: 'CAMPS' },
  { punt: '§5', fitxer: 'eines/verifica-esdeveniment.js', que: 'CAMPS', mena: 'cua', com: 'array', nom: 'CAMPS' },
  { punt: '§5', fitxer: 'eines/dedup-contra-fitxers.js', que: 'filaDeProva()', mena: 'cua', com: 'objecte', dins: 'filaDeProva', obre: 'var fila = {' },

  // --- Posterior a l'inventari --------------------------------------------
  // `eines/neteja-cua.js` és del 16 de setembre de 2026 i el §4 de la decisió
  // —escrit sobre 041d0e8— no el podia conèixer.
  { punt: 'nou', fitxer: 'eines/neteja-cua.js', que: 'CAMPS_CANONICS', mena: 'cua', com: 'array', nom: 'CAMPS_CANONICS' }
];


// --- La feina ---------------------------------------------------------------

// ------------------------------------------------------------
// Comprova tots els llocs de la taula i escriu l'informe. Torna el nombre de
// problemes trobats, que és el que decideix el codi de sortida.
// ------------------------------------------------------------
function verificaElsCamps() {
  var mestre = llegeixFitxer(CAMI_MESTRE);
  var problemes = [];

  if (mestre === null) {
    console.log('MAL  no puc llegir el mestre ' + CAMI_MESTRE);
    return 1;
  }

  var bo = treuDelPrompt(mestre);

  if (bo === null) {
    console.log('MAL  no trobo la línia de claus al mestre ' + CAMI_MESTRE);
    return 1;
  }

  console.log('El mestre és ' + CAMI_MESTRE + '.');
  console.log('  públics (' + bo.camps.length + '): ' + bo.camps.join(' · '));
  console.log('  de cua (' + (bo.camps.length + 1) + '): els de dalt més «' +
    CAMP_DE_CUA + '»');
  console.log('  editables (' + (bo.camps.length - CAMPS_DEL_SISTEMA.length) +
    '): els públics menys «' + CAMPS_DEL_SISTEMA.join('», «') + '»');

  afegeix(problemes, revisaElMestre(bo));

  console.log('');
  console.log('Els llocs que s\'hi comparen:');

  var fitxers = [];

  for (var i = 0; i < LLOCS.length; i++) {
    afegeix(problemes, revisaUnLloc(LLOCS[i], bo.camps));
    if (fitxers.indexOf(LLOCS[i].fitxer) === -1) {
      fitxers.push(LLOCS[i].fitxer);
    }
  }

  console.log('');
  console.log(LLOCS.length + ' comprovacions a ' + fitxers.length +
    ' fitxers, ' + problemes.length +
    (problemes.length === 1 ? ' problema.' : ' problemes.'));

  if (problemes.length > 0) {
    console.log('');
    console.log('L\'inventari dels llocs on viu el joc de camps és al §4 de');
    console.log('docs/DECISIO-ACTIVITATS-PERMANENTS.md.');
  }

  return problemes.length;
}

// ------------------------------------------------------------
// El mestre no es compara amb ningú, o sigui que se li mira el que pot tenir
// malament tot sol: claus repetides, claus buides, i el numeral del text del
// davant que no quadri amb quantes claus hi ha de debò. És l'error que ja va
// passar una vegada amb l'enum: la llista es va allargar i el text del davant
// es va quedar com era.
// ------------------------------------------------------------
function revisaElMestre(bo) {
  var problemes = [];
  var camps = bo.camps;

  for (var i = 0; i < camps.length; i++) {
    if (camps[i] === '') {
      problemes.push('el mestre té una clau buida');
    }
    if (camps.indexOf(camps[i]) !== i) {
      problemes.push('el mestre repeteix la clau «' + camps[i] + '»');
    }
  }

  if (String(camps.length) !== bo.numeral) {
    problemes.push('el mestre diu «' + bo.numeral + ' claus» i n\'hi ha ' +
      camps.length);
    console.log('  MAL  el prompt diu «aquestes ' + bo.numeral +
      ' claus» i la llista en té ' + camps.length);
  }

  return problemes;
}

// ------------------------------------------------------------
// Un sol lloc de la taula: en treu la llista de camps i la compara amb la que
// li toca segons la mena. La comparació és per nom I per ordre, perquè el §4
// de CLAUDE.md demana les dues coses.
// ------------------------------------------------------------
function revisaUnLloc(lloc, publics) {
  var etiqueta = '[' + lloc.punt + '] ' + lloc.fitxer + ' — ' + lloc.que;
  var text = llegeixFitxer(lloc.fitxer);

  if (text === null) {
    console.log('  MAL  ' + etiqueta + ': no puc llegir el fitxer');
    return ['no puc llegir ' + lloc.fitxer];
  }

  var esperats = llistaEsperada(lloc.mena, publics);

  if (esperats === null) {
    console.log('  MAL  ' + etiqueta + ': mena desconeguda «' + lloc.mena + '»');
    return [etiqueta + ': mena desconeguda'];
  }

  var trobats = treuElsCamps(text, lloc);

  if (trobats === null) {
    console.log('  MAL  ' + etiqueta + ': no hi trobo la llista');
    return ['no trobo la llista a ' + etiqueta];
  }

  var diferencia = compara(esperats, trobats);

  if (diferencia === '') {
    console.log('  BÉ   ' + etiqueta + ': ' + trobats.length + ' camps (' +
      lloc.mena + ')');
    return [];
  }

  console.log('  MAL  ' + etiqueta + ': ' + diferencia);
  return [etiqueta + ': ' + diferencia];
}

// ------------------------------------------------------------
// Els camps que ha de portar un lloc, segons la seva mena. Tot surt de la
// llista del mestre: aquesta funció no n'escriu cap nom, llevat del de cua,
// que el bàner de dalt ja explica per què.
// ------------------------------------------------------------
function llistaEsperada(mena, publics) {
  if (mena === 'public') {
    return publics;
  }
  if (mena === 'cua') {
    return publics.concat([CAMP_DE_CUA]);
  }
  if (mena === 'editable') {
    return senseEls(publics, CAMPS_DEL_SISTEMA);
  }
  return null;
}


// --- Els extractors ---------------------------------------------------------

// ------------------------------------------------------------
// Tria l'extractor que toca segons el `com` del lloc.
// ------------------------------------------------------------
function treuElsCamps(text, lloc) {
  if (lloc.com === 'prompt') {
    var trobat = treuDelPrompt(text);
    return trobat === null ? null : trobat.camps;
  }
  if (lloc.com === 'exemple') {
    return treuDeLExemple(text);
  }
  if (lloc.com === 'array') {
    return treuDunArray(text, lloc.nom, lloc.dins);
  }
  if (lloc.com === 'objecte') {
    return treuDunObjecte(text, lloc.dins, lloc.obre);
  }
  if (lloc.com === 'fitxa') {
    return treuDeLaFitxa(text, lloc.dins);
  }
  return null;
}

// ------------------------------------------------------------
// La línia de claus del prompt. Torna el numeral que hi diu i les claus,
// perquè les dues coses s'han de comprovar:
//
//   2. L'objecte conté exactament aquestes 16 claus, totes presents sempre,
//      en aquest ordre:
//      id, titol, data_inici, …
// ------------------------------------------------------------
function treuDelPrompt(text) {
  var patro = /exactament aquestes (\d+) claus[^\n]*\n\s*([^\n]+)/;
  var trobat = text.match(patro);

  if (trobat === null) {
    return null;
  }

  return { numeral: trobat[1], camps: parteixPerComes(trobat[2]) };
}

// ------------------------------------------------------------
// Les claus de l'exemple de resposta del prompt. És un bloc JSON, o sigui que
// les claus van entre cometes dobles i seguides de dos punts.
// ------------------------------------------------------------
function treuDeLExemple(text) {
  var des = text.indexOf('EXEMPLE DE RESPOSTA');

  if (des === -1) {
    return null;
  }

  var obre = text.indexOf('{', des);

  if (obre === -1) {
    return null;
  }

  var tanca = tancaEquilibrada(text, obre, '{', '}');

  if (tanca === -1) {
    return null;
  }

  return totesLesCoincidencies(text.slice(obre, tanca), /"([a-z_]+)"\s*:/g);
}

// ------------------------------------------------------------
// Els noms d'un array de cadenes: `var NOM = ['id', 'titol', …]`. Si el lloc
// diu `dins`, l'array es busca només dins del cos d'aquella funció, perquè
// els ajudants de prova el declaren com a variable local.
// ------------------------------------------------------------
function treuDunArray(text, nom, dins) {
  var on = text;

  if (dins) {
    var cos = zonaDeLaFuncio(text, dins);
    if (cos === null) {
      return null;
    }
    on = cos.brut;
  }

  var ancora = new RegExp('var\\s+' + nom + '\\s*=\\s*\\[');
  var zona = zonaEntreDelimitadors(on, ancora, '[', ']');

  if (zona === null) {
    return null;
  }

  return cadenesDeLaZona(zona);
}

// ------------------------------------------------------------
// Les claus d'un objecte literal muntat dins d'una funció: el `return {…}`
// d'un constructor de fila, o el `var fila = {…}` d'un mapeig. Es llegeixen
// de la màscara i no del text brut, de manera que uns dos punts dins d'una
// cadena o d'un comentari no es puguin fer passar per una clau.
// ------------------------------------------------------------
function treuDunObjecte(text, dins, obre) {
  var cos = zonaDeLaFuncio(text, dins);

  if (cos === null) {
    return null;
  }

  var zona = zonaEntreDelimitadors(cos.brut, obre, '{', '}');

  if (zona === null) {
    return null;
  }

  return totesLesCoincidencies(zona.mascara,
    /(?:^|[,{\n])\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g);
}

// ------------------------------------------------------------
// Els camps editables d'una fitxa del curador: el primer argument de cada
// `creaCamp()`, `creaDesplegable()` o `creaArea()`. Aquests tres són els qui
// posen el `data-camp` que després llegeix `recullFitxa()`, o sigui que la
// seva llista ÉS el joc de camps editables.
// ------------------------------------------------------------
function treuDeLaFitxa(text, dins) {
  var cos = zonaDeLaFuncio(text, dins);

  if (cos === null) {
    return null;
  }

  return totesLesCoincidencies(cos.brut,
    /crea(?:Camp|Desplegable|Area)\(\s*'([^']*)'/g);
}


// --- Les zones: trobar el tros de codi que interessa ------------------------
//
// Cada zona porta el text BRUT i la seva MÀSCARA, de la mateixa llargada: a la
// màscara, tot el que hi ha dins d'una cadena o d'un comentari és un espai.
// Els delimitadors es compten sobre la màscara —així una clau dins d'un
// comentari no desequilibra res— i els valors es llegeixen del brut.

// ------------------------------------------------------------
// La zona del cos d'una funció, buscada pel seu nom.
// ------------------------------------------------------------
function zonaDeLaFuncio(text, nom) {
  var ancora = new RegExp('function\\s+' + nom + '\\s*\\(');
  return zonaEntreDelimitadors(text, ancora, '{', '}');
}

// ------------------------------------------------------------
// La zona de dins d'un parell de delimitadors, a partir d'una ancora. L'ancora
// pot ser una expressió regular o un tros de text literal, i el delimitador
// que compta és el PRIMER que aparegui a partir d'on l'ancora comença.
//
// La màscara es fa a partir de l'ancora i no de dalt de tot del fitxer: una
// declaració de funció o de variable segur que és codi, i així no importa què
// hi hagi més amunt —HTML, CSS, expressions regulars amb cometes a dins.
// ------------------------------------------------------------
function zonaEntreDelimitadors(text, ancora, obre, tanca) {
  var des = posicioDeLAncora(text, ancora);

  if (des === -1) {
    return null;
  }

  var brut = text.slice(des);
  var mascara = emmascara(brut);
  var inici = mascara.indexOf(obre);

  if (inici === -1) {
    return null;
  }

  var final = tancaEquilibrada(mascara, inici, obre, tanca);

  if (final === -1) {
    return null;
  }

  return {
    brut: brut.slice(inici + 1, final),
    mascara: mascara.slice(inici + 1, final)
  };
}

// ------------------------------------------------------------
// On comença una ancora, sigui una expressió regular o un text literal.
// ------------------------------------------------------------
function posicioDeLAncora(text, ancora) {
  if (typeof ancora === 'string') {
    return text.indexOf(ancora);
  }

  var trobat = text.match(ancora);
  return trobat === null ? -1 : trobat.index;
}

// ------------------------------------------------------------
// La màscara d'un tros de codi: la mateixa llargada, amb un espai a tot el que
// hi ha dins d'una cadena o d'un comentari. Les cometes i els salts de línia
// s'hi queden, perquè encara serveixen per saber on comença i on s'acaba cada
// cosa. El tros ha de començar en codi de debò, no enmig d'una cadena.
// ------------------------------------------------------------
function emmascara(text) {
  var lletres = text.split('');
  var i = 0;

  while (i < lletres.length) {
    var lletra = lletres[i];

    if (lletra === '/' && lletres[i + 1] === '/') {
      i = esborraFinsAlSalt(lletres, i);
    } else if (lletra === '/' && lletres[i + 1] === '*') {
      i = esborraElBloc(lletres, i);
    } else if (lletra === '\'' || lletra === '"' || lletra === '`') {
      i = esborraLaCadena(lletres, i, lletra);
    } else {
      i += 1;
    }
  }

  return lletres.join('');
}

// ------------------------------------------------------------
// Esborra un comentari d'una línia i torna la posició del salt de línia.
// ------------------------------------------------------------
function esborraFinsAlSalt(lletres, des) {
  var i = des;

  while (i < lletres.length && lletres[i] !== '\n') {
    lletres[i] = ' ';
    i += 1;
  }

  return i;
}

// ------------------------------------------------------------
// Esborra un comentari de bloc i torna la posició de darrere de la tanca.
// ------------------------------------------------------------
function esborraElBloc(lletres, des) {
  var i = des;

  while (i < lletres.length) {
    if (lletres[i] === '*' && lletres[i + 1] === '/') {
      lletres[i] = ' ';
      lletres[i + 1] = ' ';
      return i + 2;
    }
    if (lletres[i] !== '\n') {
      lletres[i] = ' ';
    }
    i += 1;
  }

  return i;
}

// ------------------------------------------------------------
// Esborra el contingut d'una cadena i torna la posició de darrere de la cometa
// de tancar. Les cometes s'hi queden; una barra invertida es menja el caràcter
// de darrere, que és com una cadena pot portar la seva pròpia cometa.
// ------------------------------------------------------------
function esborraLaCadena(lletres, des, cometa) {
  var i = des + 1;

  while (i < lletres.length) {
    if (lletres[i] === '\\') {
      lletres[i] = ' ';
      if (i + 1 < lletres.length && lletres[i + 1] !== '\n') {
        lletres[i + 1] = ' ';
      }
      i += 2;
    } else if (lletres[i] === cometa) {
      return i + 1;
    } else {
      if (lletres[i] !== '\n') {
        lletres[i] = ' ';
      }
      i += 1;
    }
  }

  return i;
}

// ------------------------------------------------------------
// La posició de la tanca que equilibra el delimitador que obre a `des`.
// ------------------------------------------------------------
function tancaEquilibrada(text, des, obre, tanca) {
  var nivell = 0;

  for (var i = des; i < text.length; i++) {
    var lletra = text.charAt(i);
    if (lletra === obre) {
      nivell += 1;
    } else if (lletra === tanca) {
      nivell -= 1;
      if (nivell === 0) {
        return i;
      }
    }
  }

  return -1;
}


// --- Les peces petites ------------------------------------------------------

// ------------------------------------------------------------
// Les cadenes entre cometes simples d'una zona. Les posicions es busquen a la
// màscara, on cap comentari no en pot amagar ni inventar cap, i el valor es
// llegeix del brut.
// ------------------------------------------------------------
function cadenesDeLaZona(zona) {
  var valors = [];
  var patro = /'[^']*'/g;
  var trobat = patro.exec(zona.mascara);

  while (trobat !== null) {
    var des = trobat.index + 1;
    var fins = trobat.index + trobat[0].length - 1;
    valors.push(zona.brut.slice(des, fins));
    trobat = patro.exec(zona.mascara);
  }

  return valors;
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
// Una llista sense els elements d'una altra, conservant l'ordre de la primera.
// ------------------------------------------------------------
function senseEls(llista, fora) {
  var queden = [];

  for (var i = 0; i < llista.length; i++) {
    if (fora.indexOf(llista[i]) === -1) {
      queden.push(llista[i]);
    }
  }

  return queden;
}

// ------------------------------------------------------------
// Compara dues llistes per nom i per ordre. Torna '' si són iguals, i si no
// una frase que digui què falta, què hi sobra o què està desordenat.
// ------------------------------------------------------------
function compara(esperats, trobats) {
  var falten = [];
  var sobren = [];
  var i;

  for (i = 0; i < esperats.length; i++) {
    if (trobats.indexOf(esperats[i]) === -1) {
      falten.push(esperats[i]);
    }
  }
  for (i = 0; i < trobats.length; i++) {
    if (esperats.indexOf(trobats[i]) === -1) {
      sobren.push(trobats[i]);
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

  if (esperats.join('|') !== trobats.join('|')) {
    return 'hi són tots però en un altre ordre: ' + trobats.join(' · ');
  }

  return '';
}

// ------------------------------------------------------------
// Un fitxer del repositori com a text, o null si no s'hi pot llegir. Els salts
// de línia es normalitzen: al Windows del propietari, Git pot deixar CRLF, i
// una comparació de text no ha de fallar per això.
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
  verificaElsCamps: verificaElsCamps
};


// --- Des del terminal -------------------------------------------------------

if (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    process.argv[1].indexOf('verifica-camps') !== -1) {
  process.exitCode = verificaElsCamps() > 0 ? 1 : 0;
}
