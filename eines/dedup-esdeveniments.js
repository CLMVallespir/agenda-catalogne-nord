// ---------------------------------------------------------------------------
// DEDUPLICACIÓ D'ESDEVENIMENTS — comparació de dues files candidates
//
// Una sola feina: donades DUES files de l'esquema de setze camps, dir si són
// el mateix acte, si són actes diferents, o si no es pot decidir i ha de mirar-
// s'ho el curador. Res més.
//
//   - Cap crida a Gemini ni a cap API. Codi pur: entren dues files, surt una
//     decisió. No llegeix res i no escriu enlloc.
//   - Cap detall d'ADT66 ni de cap altra font concreta. Serveix el dia que
//     entri una font nova a la cua.
//   - MAI fusiona en silenci quan hi ha dubte: el dubte és una de les tres
//     respostes possibles, i porta les dues files perquè es puguin ensenyar.
//
// Com es reutilitza: dins de Node, amb `require()` —ho fa
// `eines/processa-lot.js`, i és l'únic que n'exporta la funció. Dins del Worker
// no hi ha mòduls: qui la hi vulgui copia el bloc de constants i el de peces
// tal qual —MÉS la taula d'`eines/pobles-alies.js`, que és l'única cosa que
// aquest fitxer importa de fora. El bloc final de proves no es copia mai.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/dedup-esdeveniments.js    -> passa la bateria de proves
//
// L'esquema de setze camps és el del §4 de CLAUDE.md. Aquesta peça no l'amplia:
// el que li falta —de quina font ve cada fila i en quina llengua està escrit el
// títol— arriba a part, en un descriptor `font`, perquè els setze camps no ho
// saben dir i no és feina d'aquesta tasca inventar-ne un dissetè.
// ---------------------------------------------------------------------------


// --- El que ve de fora ------------------------------------------------------

// L'única importació d'aquest fitxer: els noms de poble en les dues llengües.
// Vegeu eines/pobles-alies.js per què viuen allà i no aquí.
var pobles = require('./pobles-alies.js');


// --- Constants: els llindars ------------------------------------------------

// Similitud de Jaccard entre les paraules significatives dels dos títols a
// partir de la qual, amb la clau forta ja igual, es dona per fet que és el
// mateix acte. 0,55 vol dir «més de la meitat del vocabulari útil compartit»:
// «Concert de Goulamas'k a Ceret» i «Goulamas'k en concert» hi arriben; dos
// concerts diferents del mateix dia, no.
var LLINDAR_TITOL_MATEIX = 0.55;

// Per sota d'aquesta similitud, amb la clau forta igual, es consideren actes
// diferents: al mateix poble i el mateix dia hi pot haver dues coses, i a
// Perpinyà n'hi ha sempre. Entre els dos llindars, la zona grisa: dubtós.
var LLINDAR_TITOL_DUBTOS = 0.25;


// --- Constants: la jerarquia de fonts ---------------------------------------

// Qui mana quan dues files duplicades no diuen el mateix en un camp. Un número
// més alt guanya. És una taula a posta, no una cadena d'`if`: el dia que
// s'afegeixi una font nova, s'hi posa una línia i prou.
//
//   organitzador     l'entitat que fa l'acte, o l'ajuntament del municipi:
//                    ho sap de primera mà i ho corregeix si canvia
//   oficina-turisme  una oficina de turisme comarcal: ho ha copiat d'algú
//   agregador        un flux que recull el que li arriba (ADT66, portals):
//                    l'última baula, i la que més sovint arrossega errors
//
// Una font que no sigui a la taula val RANG_DESCONEGUT, que és el mínim: una
// procedència que no sabem classificar no pot manar sobre cap de conegudes.
var JERARQUIA_FONTS = {
  'organitzador': 3,
  'oficina-turisme': 2,
  'agregador': 1
};

var RANG_DESCONEGUT = 0;


// --- Constants: l'esquema ---------------------------------------------------

// Els disset camps, amb el nom i l'ordre del §4 de CLAUDE.md.
var CAMPS = [
  'id', 'titol', 'data_inici', 'data_fi', 'hora', 'lloc', 'municipi',
  'comarca', 'categoria', 'descripcio_ca', 'descripcio_fr', 'associacio',
  'imatge_url', 'font_url', 'estat', 'data_entrada', 'nota_curador'
];

var COMARQUES = ['Rosselló', 'Conflent', 'Vallespir', 'Capcir', 'Cerdanya'];

var CATEGORIES = [
  'Música', 'Teatre', 'Dansa i ball', 'Conferència', 'Exposició', 'Mercat',
  'Cinema', 'Taller', 'Activitat infantil', 'Patrimoni i tradicions',
  'Concentració', 'Esports', 'Vida associativa'
];


// --- Constants: els municipis amb dos noms ----------------------------------

// Sense això la clau forta és una ficció. Una associació escriu «Prats de
// Molló» i el flux d'una oficina de turisme escriu «PRATS-DE-MOLLO-LA-PRESTE»:
// són el mateix poble i cap comparació de text ho endevina sola.
//
// La taula viu a eines/pobles-alies.js, que és l'origen de veritat compartit
// amb eines/mapeja-recerca.js. Aquí no en cal cap còpia: es llegeix en tots
// dos sentits, i qualsevol de les dues formes porta a la mateixa clau.
//
// Hi ha parells que aquest fitxer no necessita —«Céret» i «Ceret» ja cauen
// igual en normalitzar— i no fan cap nosa: mapegen la clau a ella mateixa.
var MUNICIPIS_EQUIVALENTS = pobles.POBLES_ALIES;


// --- Constants: les paraules que no compten ---------------------------------

// Articles, preposicions i conjuncions. Si comptessin, «Concert de rock» i
// «Mercat de Nadal» compartirien el «de» i tindrien una similitud que no
// vol dir res. Una llista per llengua, perquè els títols es comparen sempre
// dins d'una sola llengua.
var PARAULES_BUIDES = {
  'ca': [
    'el', 'la', 'els', 'les', 'un', 'una', 'uns', 'unes', 'de', 'del', 'dels',
    'al', 'als', 'en', 'amb', 'per', 'sense', 'sobre', 'sota', 'entre', 'fins',
    'des', 'com', 'que', 'no', 'ja', 'se', 'es', 'ho', 'hi', 'li', 'seu',
    'seva', 'seus', 'seves', 'aquest', 'aquesta', 'aquests', 'aquestes'
  ],
  'fr': [
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux', 'et', 'ou',
    'en', 'pour', 'par', 'avec', 'sans', 'sur', 'sous', 'dans', 'entre',
    'jusqu', 'que', 'qui', 'ne', 'pas', 'ce', 'cette', 'ces', 'son', 'sa',
    'ses', 'leur', 'leurs'
  ]
};


// --- La funció --------------------------------------------------------------

// ------------------------------------------------------------
// Compara dues files candidates i torna una decisió. Cada candidata és un
// objecte de dues parts:
//
//   { fila: <els setze camps>, font: { tipus: '...', llengua: 'ca' | 'fr' } }
//
// `font.tipus` és una clau de JERARQUIA_FONTS i decideix qui mana en cas de
// conflicte de camps. `font.llengua` és la llengua en què està escrit el TÍTOL
// tal com el dona la font, no la llengua de l'acte: sense aquest dada els
// títols no es comparen mai (vegeu titolsComparables).
//
// Torna sempre els mateixos set camps, sempre presents:
//
//   decisio     'mateix-esdeveniment' · 'esdeveniments-diferents' · 'dubtos'
//   motiu       una frase en català que explica per què, per ensenyar-la
//   clau        la clau forta calculada, o '' si no s'ha pogut fer
//   similitud   el Jaccard dels títols (0..1), o null si no s'ha calculat
//   fila        la fila fusionada — NOMÉS quan la decisió és mateix; si no, null
//   opcions     [filaA, filaB] — NOMÉS quan és dubtós, per al curador; si no, null
//   guanyadora  'A' o 'B', la font que ha manat en fusionar; si no, ''
// ------------------------------------------------------------
function comparaEsdeveniments(candidatA, candidatB) {
  var filaA = filaDe(candidatA);
  var filaB = filaDe(candidatB);
  var fontA = fontDe(candidatA);
  var fontB = fontDe(candidatB);

  var dataA = cadena(filaA.data_inici);
  var dataB = cadena(filaB.data_inici);
  var municipiA = normalitzaMunicipi(filaA.municipi);
  var municipiB = normalitzaMunicipi(filaB.municipi);

  // 1. Dues dates conegudes i diferents: no cal mirar res més.
  if (dataA !== '' && dataB !== '' && dataA !== dataB) {
    return resultatComparacio({
      decisio: 'esdeveniments-diferents',
      motiu: 'Les dates d\'inici no coincideixen (' + dataA + ' / ' + dataB + ').'
    });
  }

  // 2. La clau forta no es pot muntar. No vol dir que siguin diferents: vol
  //    dir que no ho sabem, i això va al curador amb les dues files.
  if (dataA === '' || dataB === '' || municipiA === '' || municipiB === '') {
    return resultatComparacio({
      decisio: 'dubtos',
      motiu: 'La clau forta és incompleta: a alguna de les dues files hi falta la data d\'inici o el municipi.',
      opcions: [filaA, filaB]
    });
  }

  // 3. Mateixa data, municipis diferents: dos actes diferents.
  if (municipiA !== municipiB) {
    return resultatComparacio({
      decisio: 'esdeveniments-diferents',
      motiu: 'Mateixa data, però el municipi no coincideix (' + municipiA + ' / ' + municipiB + ').'
    });
  }

  var clau = municipiA + '|' + dataA;

  // 4. Clau forta igual. Ara el títol fa de desempat — però només si es pot
  //    comparar honestament, és a dir dins d'una sola llengua.
  if (!titolsComparables(fontA, fontB)) {
    return resultatComparacio({
      decisio: 'dubtos',
      motiu: 'Mateix municipi i mateixa data, però els títols venen en llengües diferents o desconegudes i no es poden comparar.',
      clau: clau,
      opcions: [filaA, filaB]
    });
  }

  var paraulesA = paraulesSignificatives(filaA.titol, fontA.llengua);
  var paraulesB = paraulesSignificatives(filaB.titol, fontB.llengua);

  if (paraulesA.length === 0 || paraulesB.length === 0) {
    return resultatComparacio({
      decisio: 'dubtos',
      motiu: 'Mateix municipi i mateixa data, però algun dels dos títols no té cap paraula significativa amb què comparar.',
      clau: clau,
      opcions: [filaA, filaB]
    });
  }

  var similitud = similitudJaccard(paraulesA, paraulesB);

  if (similitud >= LLINDAR_TITOL_MATEIX) {
    var fusio = fusionaFiles(candidatA, candidatB);
    return resultatComparacio({
      decisio: 'mateix-esdeveniment',
      motiu: 'Mateix municipi, mateixa data i títols que comparteixen ' + percentatge(similitud) + ' del vocabulari útil.',
      clau: clau,
      similitud: similitud,
      fila: fusio.fila,
      guanyadora: fusio.guanyadora
    });
  }

  if (similitud < LLINDAR_TITOL_DUBTOS) {
    return resultatComparacio({
      decisio: 'esdeveniments-diferents',
      motiu: 'Mateix municipi i mateixa data, però els títols només comparteixen ' + percentatge(similitud) + ' del vocabulari útil: són dos actes al mateix poble el mateix dia.',
      clau: clau,
      similitud: similitud
    });
  }

  return resultatComparacio({
    decisio: 'dubtos',
    motiu: 'Mateix municipi i mateixa data, i títols que comparteixen ' + percentatge(similitud) + ' del vocabulari útil: ni prou per fusionar, ni prou poc per separar.',
    clau: clau,
    similitud: similitud,
    opcions: [filaA, filaB]
  });
}


// --- Les peces --------------------------------------------------------------

// ------------------------------------------------------------
// La fila d'una candidata. Si no en porta, una fila buida: així la resta de
// la funció no ha de comprovar mai si existeix.
// ------------------------------------------------------------
function filaDe(candidat) {
  if (!candidat || !candidat.fila) {
    return {};
  }
  return candidat.fila;
}

// ------------------------------------------------------------
// El descriptor de font d'una candidata. Sense descriptor, una font
// desconeguda i sense llengua: el rang mínim i cap comparació de títols.
// ------------------------------------------------------------
function fontDe(candidat) {
  if (!candidat || !candidat.font) {
    return { tipus: '', llengua: '' };
  }
  return {
    tipus: cadena(candidat.font.tipus),
    llengua: cadena(candidat.font.llengua)
  };
}

// ------------------------------------------------------------
// Qualsevol valor, convertit a la cadena retallada que demana el §4 de
// CLAUDE.md: desconegut és sempre '', mai null ni undefined.
// ------------------------------------------------------------
function cadena(valor) {
  if (typeof valor !== 'string') {
    return '';
  }
  return valor.trim();
}

// ------------------------------------------------------------
// El nom d'un municipi reduït a una sola forma comparable: minúscules, sense
// accents, sense apòstrofs, sense guions ni espais. Després es passa per la
// taula de municipis amb dos noms, de manera que «Prats-de-Mollo-la-Preste» i
// «Prats de Molló» acaben tots dos a la mateixa clau. Torna '' si no hi ha nom.
// ------------------------------------------------------------
function normalitzaMunicipi(municipi) {
  var text = pobles.normalitzaNom(municipi);
  if (text === '') {
    return '';
  }

  if (MAPA_MUNICIPIS[text]) {
    return MAPA_MUNICIPIS[text];
  }
  return text;
}

// ------------------------------------------------------------
// Munta el diccionari «forma normalitzada -> forma canònica» a partir de la
// taula de parells. Les dues formes hi apunten, i la canònica és sempre la
// catalana (la primera columna de la taula).
// ------------------------------------------------------------
function construeixMapaDeMunicipis() {
  var mapa = {};

  for (var i = 0; i < MUNICIPIS_EQUIVALENTS.length; i++) {
    var parell = MUNICIPIS_EQUIVALENTS[i];
    var canonica = pobles.normalitzaNom(parell[0]);
    var alternativa = pobles.normalitzaNom(parell[1]);
    mapa[canonica] = canonica;
    mapa[alternativa] = canonica;
  }

  return mapa;
}

// El diccionari es munta un sol cop, en carregar el fitxer.
var MAPA_MUNICIPIS = construeixMapaDeMunicipis();

// ------------------------------------------------------------
// Diu si els títols de dues fonts es poden comparar entre ells. Només si totes
// dues diuen en quina llengua està escrit el títol I és la mateixa.
//
// El motiu és el que demana la tasca: una traducció no es compara mai amb un
// original. «Fira del bestiar» i «Foire au bétail» no comparteixen ni una
// paraula i el Jaccard diria 0 —«actes diferents»— quan són el mateix acte. I
// a l'inrevés, dos títols en llengües diferents que compartissin un nom propi
// donarien una similitud que és sort, no prova. Quan no es poden comparar, la
// decisió no és «diferents» sinó «dubtós»: ho mira el curador.
// ------------------------------------------------------------
function titolsComparables(fontA, fontB) {
  if (fontA.llengua === '' || fontB.llengua === '') {
    return false;
  }
  return fontA.llengua === fontB.llengua;
}

// ------------------------------------------------------------
// Les paraules d'un títol que valen per comparar: en minúscules, sense
// accents, sense repeticions, sense les paraules buides de la seva llengua i
// sense les d'una sola lletra.
//
// Un detall que no es veu i que importa: aquí els apòstrofs es tornen ESPAI,
// mentre que a creaId() desapareixen. Són dues feines diferents. A creaId un
// apòstrof sobra dins d'un identificador; aquí, «l'Havana» ha de donar
// «havana» i no «lhavana», o el mateix nom escrit sense article no lligaria.
// ------------------------------------------------------------
function paraulesSignificatives(titol, llengua) {
  var text = cadena(titol).toLowerCase();
  if (text === '') {
    return [];
  }

  text = text.normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Tot el que no sigui lletra o xifra es torna espai, apòstrofs inclosos.
  text = text.replace(/[^a-z0-9]+/g, ' ').trim();
  if (text === '') {
    return [];
  }

  var buides = PARAULES_BUIDES[llengua] || [];
  var paraules = text.split(/\s+/);
  var significatives = [];

  for (var i = 0; i < paraules.length; i++) {
    var paraula = paraules[i];
    if (paraula.length < 2) {
      continue;
    }
    if (buides.indexOf(paraula) !== -1) {
      continue;
    }
    if (significatives.indexOf(paraula) !== -1) {
      continue;
    }
    significatives.push(paraula);
  }

  return significatives;
}

// ------------------------------------------------------------
// La similitud de Jaccard entre dues llistes de paraules: quantes comparteixen
// dividit per quantes n'hi ha en total sense repetir. 1 vol dir el mateix
// vocabulari, 0 vol dir cap paraula en comú. Totes dues llistes han de portar
// alguna cosa; qui la crida ja ho ha comprovat.
// ------------------------------------------------------------
function similitudJaccard(paraulesA, paraulesB) {
  var comunes = 0;

  for (var i = 0; i < paraulesA.length; i++) {
    if (paraulesB.indexOf(paraulesA[i]) !== -1) {
      comunes += 1;
    }
  }

  var total = paraulesA.length + paraulesB.length - comunes;
  if (total === 0) {
    return 0;
  }

  return comunes / total;
}

// ------------------------------------------------------------
// El rang d'una font segons la taula de jerarquia. Una font que no hi és val
// el mínim: no pot manar sobre cap de coneguda.
// ------------------------------------------------------------
function rangDeFont(font) {
  var rang = JERARQUIA_FONTS[font.tipus];
  if (typeof rang !== 'number') {
    return RANG_DESCONEGUT;
  }
  return rang;
}

// ------------------------------------------------------------
// Fusiona dues files que ja s'han donat per duplicades. Camp a camp: mana la
// fila de la font de rang més alt, i només quan aquesta el té buit s'agafa el
// de l'altra. Així una fitxa d'agregador pot completar el que a l'organitzador
// li faltava, però no li pot sobreescriure mai res.
//
// Torna { fila, guanyadora } amb guanyadora 'A' o 'B'.
// ------------------------------------------------------------
function fusionaFiles(candidatA, candidatB) {
  var filaA = filaDe(candidatA);
  var filaB = filaDe(candidatB);
  var rangA = rangDeFont(fontDe(candidatA));
  var rangB = rangDeFont(fontDe(candidatB));

  var guanyadora = 'A';
  if (rangB > rangA) {
    guanyadora = 'B';
  }
  // Empat de rang: mana la que ja era al sistema, és a dir la que va entrar
  // abans. No és cap criteri de qualitat: és el que no fa dependre el
  // resultat de l'ordre en què arriben les dues files a la funció.
  if (rangA === rangB && cadena(filaB.data_entrada) !== '' &&
      (cadena(filaA.data_entrada) === '' || cadena(filaB.data_entrada) < cadena(filaA.data_entrada))) {
    guanyadora = 'B';
  }

  var mana = (guanyadora === 'A') ? filaA : filaB;
  var completa = (guanyadora === 'A') ? filaB : filaA;

  var fusionada = {};
  for (var i = 0; i < CAMPS.length; i++) {
    var camp = CAMPS[i];
    var valor = cadena(mana[camp]);
    if (valor === '') {
      valor = cadena(completa[camp]);
    }
    fusionada[camp] = valor;
  }

  // La data d'entrada no la decideix la jerarquia de fonts: vé de la fila que
  // ja existia, perquè és la seva història, no informació sobre l'acte.
  var primera = filaMesAntiga(filaA, filaB);
  fusionada.data_entrada = cadena(primera.data_entrada);

  // L'estat, en canvi, no el decideix cap posició —ni l'ordre dels arguments
  // ni qui va entrar abans—: el decideix la precedència de resolEstat().
  fusionada.estat = resolEstat(filaA.estat, filaB.estat);

  // La nota del curador és l'excepció a la regla de «mana el rang més alt»:
  // no és informació sobre l'acte, és el que algú ha d'anar a mirar. Quedar-se
  // només la de la fila guanyadora perdria justament l'avís de la fila que
  // potser tenia el problema. Es queden totes dues.
  fusionada.nota_curador = ajuntaNotes(filaA.nota_curador, filaB.nota_curador);

  // Les mateixes garanties de sempre (§4 de CLAUDE.md): enums coercits i
  // l'id reconstruït, mai heretat.
  fusionada.comarca = valorPermes(fusionada.comarca, COMARQUES);
  fusionada.categoria = valorPermes(fusionada.categoria, CATEGORIES);
  fusionada.id = creaId(fusionada.data_inici, fusionada.titol);

  return { fila: fusionada, guanyadora: guanyadora };
}

// ------------------------------------------------------------
// Ajunta les notes de curador de dues files duplicades. Les dues, separades
// per un espai; si són iguals o una és buida, la que hi hagi i prou.
// ------------------------------------------------------------
function ajuntaNotes(notaA, notaB) {
  var a = cadena(notaA);
  var b = cadena(notaB);

  if (a === '' ) {
    return b;
  }
  if (b === '' || a === b) {
    return a;
  }

  return a + ' ' + b;
}

// ------------------------------------------------------------
// L'estat d'una fila fusionada, per precedència i no per posició: els dos
// estats decidits per una persona guanyen el que encara no s'ha decidit, i ho
// fan vingui la fila del costat que vingui i tant se val quina va entrar
// abans.
// ------------------------------------------------------------
function resolEstat(estatA, estatB) {
  var a = cadena(estatA);
  var b = cadena(estatB);

  // La precedència, de més forta a més fluixa, en una sola llista.
  //
  //   'publicat'  un esdeveniment publicat ja ha passat el filtre humà, i cap
  //               fusió automàtica no pot revertir-ho. Hi arriba el dia que es
  //               dedupliqui contra events.json (docs/HANDOFF-ADT66.md §4).
  //   'rebutjat'  un rebuig és una decisió sobre l'ESDEVENIMENT i no sobre la
  //               fila que el porta: ha de sobreviure la fusió, o la memòria de
  //               rebuig es perd i el curador torna a revisar el que ja havia
  //               dit que no.
  //   'pendent'   ningú no ha decidit res encara: és el que cedeix.
  if (a === 'publicat' || b === 'publicat') {
    return 'publicat';
  }
  if (a === 'rebutjat' || b === 'rebutjat') {
    return 'rebutjat';
  }
  if (a === 'pendent' || b === 'pendent') {
    return 'pendent';
  }

  // Cap dels dos no és cap dels tres estats coneguts: no s'inventa res, es
  // queda el primer que digui alguna cosa.
  if (a !== '') {
    return a;
  }
  return b;
}

// ------------------------------------------------------------
// De dues files, la que va entrar abans al sistema. Les marques de temps són
// ISO i totes surten del mateix rellotge, o sigui que es comparen com a text.
// Una fila sense data_entrada no pot ser la més antiga si l'altra en té.
// ------------------------------------------------------------
function filaMesAntiga(filaA, filaB) {
  var entradaA = cadena(filaA.data_entrada);
  var entradaB = cadena(filaB.data_entrada);

  if (entradaA === '') {
    return filaB;
  }
  if (entradaB === '') {
    return filaA;
  }
  if (entradaB < entradaA) {
    return filaB;
  }
  return filaA;
}

// ------------------------------------------------------------
// Una similitud escrita per ensenyar-la a algú: «62 %».
// ------------------------------------------------------------
function percentatge(similitud) {
  return Math.round(similitud * 100) + ' %';
}

// ------------------------------------------------------------
// Munta el resultat. Sempre els mateixos set camps, sempre presents, perquè
// qui la cridi no hagi de comprovar si hi són.
// ------------------------------------------------------------
function resultatComparacio(parts) {
  var similitud = null;
  if (typeof parts.similitud === 'number') {
    similitud = parts.similitud;
  }

  return {
    decisio: parts.decisio,
    motiu: parts.motiu,
    clau: parts.clau || '',
    similitud: similitud,
    fila: parts.fila || null,
    opcions: parts.opcions || null,
    guanyadora: parts.guanyadora || ''
  };
}


// --- Còpies literals de les funcions compartides ----------------------------
// Són les mateixes de docs/arxiu-google/utils.gs, worker/worker.js i
// curador.html. Es copien, no s'importen: el projecte no té cap sistema de
// mòduls i totes les vies d'entrada han de donar l'id idèntic.

// ------------------------------------------------------------
// Còpia literal de valorPermes: torna el valor només si és a la llista
// permesa, i '' si no hi és.
// ------------------------------------------------------------
function valorPermes(valor, llistaPermesa) {
  if (llistaPermesa.indexOf(valor) === -1) {
    return '';
  }
  return valor;
}

// ------------------------------------------------------------
// Còpia literal de creaId: la data d'inici, un guió, i les tres primeres
// paraules del títol en minúscules i sense accents. Torna '' si no hi ha data.
// ------------------------------------------------------------
function creaId(dataInici, titol) {
  if (dataInici === '') {
    return '';
  }

  var text = titol.toLowerCase();
  text = text.normalize('NFD').replace(/[̀-ͯ]/g, '');
  text = text.replace(/['’]/g, '');
  text = text.replace(/[^a-z0-9]+/g, ' ');
  text = text.trim();

  if (text === '') {
    return dataInici;
  }

  var paraules = text.split(/\s+/);
  var paraulesCurtes = paraules.slice(0, 3);
  return dataInici + '-' + paraulesCurtes.join('-');
}


// --- El que surt d'aquest fitxer --------------------------------------------
// La funció, i una sola peça de dins. La resta són seves i no les ha de cridar
// ningú. L'exportació és per a Node (eines/processa-lot.js,
// eines/classifica-editorial.js). Al Worker no hi arriba mai per aquí: allà es
// copia, com diu la capçalera.
//
// ajuntaNotes surt a fora perquè la regla d'ajuntar dues notes de curador
// —totes dues, mai una— no pot viure copiada a cada agent que n'escriu una:
// el dia que canviés en un lloc i no a l'altre, dues peces del mateix sistema
// tractarien `nota_curador` de maneres diferents.

module.exports = {
  comparaEsdeveniments: comparaEsdeveniments,
  ajuntaNotes: ajuntaNotes
};


// --- Proves des del terminal ------------------------------------------------
// Tot el que ve a partir d'aquí és per poder exercitar la funció a mà. No
// forma part de la peça i no s'ha de copiar enlloc.

// ------------------------------------------------------------
// Una fila de prova: els setze camps, tots cadenes, amb els que no interessen
// buits. Estalvia repetir l'esquema sencer a cada cas.
// ------------------------------------------------------------
function filaDeProva(titol, dataInici, municipi, extres) {
  var fila = {};
  for (var i = 0; i < CAMPS.length; i++) {
    fila[CAMPS[i]] = '';
  }

  fila.titol = titol;
  fila.data_inici = dataInici;
  fila.data_fi = dataInici;
  fila.municipi = municipi;
  fila.estat = 'pendent';
  fila.id = creaId(dataInici, titol);

  if (extres) {
    var claus = Object.keys(extres);
    for (var j = 0; j < claus.length; j++) {
      fila[claus[j]] = extres[claus[j]];
    }
  }

  return fila;
}

// ------------------------------------------------------------
// Els casos. Cadascun diu quina decisió espera, de manera que la bateria es
// pugui llegir com una taula del comportament pactat.
// ------------------------------------------------------------
function casosDeProva() {
  return [
    {
      nom: 'El mateix concert, dues associacions, tots dos en català',
      a: {
        fila: filaDeProva('Concert de Goulamas\'k', '2026-09-12', 'Ceret'),
        font: { tipus: 'organitzador', llengua: 'ca' }
      },
      b: {
        fila: filaDeProva('Goulamas\'k en concert a Ceret', '2026-09-12', 'Céret'),
        font: { tipus: 'oficina-turisme', llengua: 'ca' }
      },
      espera: 'mateix-esdeveniment'
    },
    {
      nom: 'Mateix poble i mateix dia, però dos actes ben diferents',
      a: {
        fila: filaDeProva('Concert de Goulamas\'k', '2026-09-12', 'Perpinyà'),
        font: { tipus: 'organitzador', llengua: 'ca' }
      },
      b: {
        fila: filaDeProva('Mercat de artesans', '2026-09-12', 'Perpinyà'),
        font: { tipus: 'agregador', llengua: 'ca' }
      },
      espera: 'esdeveniments-diferents'
    },
    {
      nom: 'El mateix nom de poble en les dues llengües',
      a: {
        fila: filaDeProva('Festa de l\'ós', '2026-02-14', 'Prats de Molló'),
        font: { tipus: 'organitzador', llengua: 'ca' }
      },
      b: {
        fila: filaDeProva('La festa de l\'ós de Prats', '2026-02-14', 'PRATS-DE-MOLLO-LA-PRESTE'),
        font: { tipus: 'agregador', llengua: 'ca' }
      },
      espera: 'mateix-esdeveniment'
    },
    {
      nom: 'Títols en llengües diferents: no es comparen mai',
      a: {
        fila: filaDeProva('Fira del bestiar', '2026-10-03', 'Prada'),
        font: { tipus: 'organitzador', llengua: 'ca' }
      },
      b: {
        fila: filaDeProva('Foire au bétail', '2026-10-03', 'Prades'),
        font: { tipus: 'agregador', llengua: 'fr' }
      },
      espera: 'dubtos'
    },
    {
      nom: 'Dates diferents: no cal mirar res més',
      a: {
        fila: filaDeProva('Ball de gitanes', '2026-09-12', 'Ceret'),
        font: { tipus: 'organitzador', llengua: 'ca' }
      },
      b: {
        fila: filaDeProva('Ball de gitanes', '2026-09-13', 'Ceret'),
        font: { tipus: 'organitzador', llengua: 'ca' }
      },
      espera: 'esdeveniments-diferents'
    },
    {
      nom: 'Sense municipi: la clau forta no es pot muntar',
      a: {
        fila: filaDeProva('Ball de gitanes', '2026-09-12', ''),
        font: { tipus: 'organitzador', llengua: 'ca' }
      },
      b: {
        fila: filaDeProva('Ball de gitanes', '2026-09-12', 'Ceret'),
        font: { tipus: 'organitzador', llengua: 'ca' }
      },
      espera: 'dubtos'
    },
    {
      nom: 'Zona grisa entre els dos llindars',
      a: {
        fila: filaDeProva('Taller de cuina catalana', '2026-11-07', 'Elna'),
        font: { tipus: 'organitzador', llengua: 'ca' }
      },
      b: {
        fila: filaDeProva('Taller de cuina per a famílies', '2026-11-07', 'Elne'),
        font: { tipus: 'oficina-turisme', llengua: 'ca' }
      },
      espera: 'dubtos'
    },
    {
      nom: 'Fusió: l\'organitzador mana i l\'agregador només omple buits',
      a: {
        fila: filaDeProva('Exposició de fotografia', '2026-12-05', 'Illa', {
          lloc: 'Sala Municipal',
          associacio: 'Fotoclub del Riberal',
          data_entrada: '2026-08-01T10:00:00.000Z'
        }),
        font: { tipus: 'organitzador', llengua: 'ca' }
      },
      b: {
        fila: filaDeProva('Exposició de fotografia del Riberal', '2026-12-05', 'Ille-sur-Têt', {
          lloc: 'Salle des fêtes',
          imatge_url: 'https://res.cloudinary.com/exemple/cartell.webp',
          comarca: 'Rosselló',
          categoria: 'Exposició',
          data_entrada: '2026-08-20T10:00:00.000Z'
        }),
        font: { tipus: 'agregador', llengua: 'ca' }
      },
      espera: 'mateix-esdeveniment'
    },
    {
      nom: 'Fusió: les dues notes de curador es queden, no en mana cap',
      a: {
        fila: filaDeProva('Concert de tardor', '2026-10-02', 'Ceret', {
          nota_curador: 'Cal traduir el títol.',
          data_entrada: '2026-08-01T10:00:00.000Z'
        }),
        font: { tipus: 'organitzador', llengua: 'ca' }
      },
      b: {
        fila: filaDeProva('Concert de tardor a Ceret', '2026-10-02', 'Céret', {
          nota_curador: 'La categoria no té equivalent.',
          data_entrada: '2026-08-20T10:00:00.000Z'
        }),
        font: { tipus: 'agregador', llengua: 'ca' }
      },
      espera: 'mateix-esdeveniment',
      esperaNota: 'Cal traduir el títol. La categoria no té equivalent.'
    },
    {
      nom: 'Fusió: «publicat» guanya «rebutjat», publicada primera',
      a: {
        fila: filaDeProva('Fira del llibre', '2026-11-21', 'Ceret', {
          estat: 'publicat',
          data_entrada: '2026-08-20T10:00:00.000Z'
        }),
        font: { tipus: 'organitzador', llengua: 'ca' }
      },
      b: {
        fila: filaDeProva('Fira del llibre a Ceret', '2026-11-21', 'Céret', {
          estat: 'rebutjat',
          data_entrada: '2026-08-01T10:00:00.000Z'
        }),
        font: { tipus: 'agregador', llengua: 'ca' }
      },
      espera: 'mateix-esdeveniment',
      esperaEstat: 'publicat'
    },
    {
      nom: 'Fusió: «publicat» guanya «rebutjat», publicada segona',
      a: {
        fila: filaDeProva('Fira del llibre', '2026-11-21', 'Ceret', {
          estat: 'rebutjat',
          data_entrada: '2026-08-01T10:00:00.000Z'
        }),
        font: { tipus: 'organitzador', llengua: 'ca' }
      },
      b: {
        fila: filaDeProva('Fira del llibre a Ceret', '2026-11-21', 'Céret', {
          estat: 'publicat',
          data_entrada: '2026-08-20T10:00:00.000Z'
        }),
        font: { tipus: 'agregador', llengua: 'ca' }
      },
      espera: 'mateix-esdeveniment',
      esperaEstat: 'publicat'
    },
    {
      nom: 'Fusió: «publicat» guanya «pendent», publicada primera',
      a: {
        fila: filaDeProva('Fira del llibre', '2026-11-21', 'Ceret', {
          estat: 'publicat',
          data_entrada: '2026-08-20T10:00:00.000Z'
        }),
        font: { tipus: 'organitzador', llengua: 'ca' }
      },
      b: {
        fila: filaDeProva('Fira del llibre a Ceret', '2026-11-21', 'Céret', {
          estat: 'pendent',
          data_entrada: '2026-08-01T10:00:00.000Z'
        }),
        font: { tipus: 'agregador', llengua: 'ca' }
      },
      espera: 'mateix-esdeveniment',
      esperaEstat: 'publicat'
    },
    {
      nom: 'Fusió: «publicat» guanya «pendent», publicada segona',
      a: {
        fila: filaDeProva('Fira del llibre', '2026-11-21', 'Ceret', {
          estat: 'pendent',
          data_entrada: '2026-08-01T10:00:00.000Z'
        }),
        font: { tipus: 'organitzador', llengua: 'ca' }
      },
      b: {
        fila: filaDeProva('Fira del llibre a Ceret', '2026-11-21', 'Céret', {
          estat: 'publicat',
          data_entrada: '2026-08-20T10:00:00.000Z'
        }),
        font: { tipus: 'agregador', llengua: 'ca' }
      },
      espera: 'mateix-esdeveniment',
      esperaEstat: 'publicat'
    },
    {
      nom: 'Fusió: «rebutjat» guanya «pendent», rebutjada primera',
      a: {
        fila: filaDeProva('Fira del llibre', '2026-11-21', 'Ceret', {
          estat: 'rebutjat',
          data_entrada: '2026-08-20T10:00:00.000Z'
        }),
        font: { tipus: 'organitzador', llengua: 'ca' }
      },
      b: {
        fila: filaDeProva('Fira del llibre a Ceret', '2026-11-21', 'Céret', {
          estat: 'pendent',
          data_entrada: '2026-08-01T10:00:00.000Z'
        }),
        font: { tipus: 'agregador', llengua: 'ca' }
      },
      espera: 'mateix-esdeveniment',
      esperaEstat: 'rebutjat'
    },
    {
      nom: 'Fusió: «rebutjat» guanya «pendent», rebutjada segona',
      a: {
        fila: filaDeProva('Fira del llibre', '2026-11-21', 'Ceret', {
          estat: 'pendent',
          data_entrada: '2026-08-01T10:00:00.000Z'
        }),
        font: { tipus: 'organitzador', llengua: 'ca' }
      },
      b: {
        fila: filaDeProva('Fira del llibre a Ceret', '2026-11-21', 'Céret', {
          estat: 'rebutjat',
          data_entrada: '2026-08-20T10:00:00.000Z'
        }),
        font: { tipus: 'agregador', llengua: 'ca' }
      },
      espera: 'mateix-esdeveniment',
      esperaEstat: 'rebutjat'
    },
    {
      nom: 'Fusió: dues «pendent» segueixen «pendent»',
      a: {
        fila: filaDeProva('Fira del llibre', '2026-11-21', 'Ceret', {
          estat: 'pendent',
          data_entrada: '2026-08-01T10:00:00.000Z'
        }),
        font: { tipus: 'organitzador', llengua: 'ca' }
      },
      b: {
        fila: filaDeProva('Fira del llibre a Ceret', '2026-11-21', 'Céret', {
          estat: 'pendent',
          data_entrada: '2026-08-20T10:00:00.000Z'
        }),
        font: { tipus: 'agregador', llengua: 'ca' }
      },
      espera: 'mateix-esdeveniment',
      esperaEstat: 'pendent'
    }
  ];
}

// ------------------------------------------------------------
// Passa la bateria i n'escriu el resultat al terminal.
// ------------------------------------------------------------
function principal() {
  var casos = casosDeProva();
  var fallades = 0;

  for (var i = 0; i < casos.length; i++) {
    var cas = casos[i];
    var resposta = comparaEsdeveniments(cas.a, cas.b);
    var passa = (resposta.decisio === cas.espera);

    // Els casos que vigilen la nota de curador comproven també la fusió.
    if (passa && cas.esperaNota !== undefined) {
      passa = (resposta.fila !== null && resposta.fila.nota_curador === cas.esperaNota);
    }

    // Els que vigilen l'estat comproven la precedència de resolEstat().
    if (passa && cas.esperaEstat !== undefined) {
      passa = (resposta.fila !== null && resposta.fila.estat === cas.esperaEstat);
    }

    if (!passa) {
      fallades += 1;
    }

    console.log((passa ? 'BÉ  ' : 'MAL ') + cas.nom);
    console.log('     decisió   ' + resposta.decisio +
                (passa ? '' : '   (n\'esperava ' + cas.espera + ')'));
    console.log('     motiu     ' + resposta.motiu);
    if (resposta.clau !== '') {
      console.log('     clau      ' + resposta.clau);
    }
    if (resposta.fila) {
      console.log('     fusionada mana ' + resposta.guanyadora +
                  ' -> ' + resposta.fila.id);
      console.log('               lloc «' + resposta.fila.lloc + '»' +
                  ', imatge «' + resposta.fila.imatge_url + '»');
      var esperat = '';
      if (cas.esperaEstat !== undefined) {
        esperat = '   (esperat «' + cas.esperaEstat + '»)';
      }
      console.log('               estat «' + resposta.fila.estat + '»' + esperat);
    }
    console.log('');
  }

  console.log(casos.length + ' casos, ' + fallades + ' fallades.');
  if (fallades > 0) {
    process.exitCode = 1;
  }
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    process.argv[1].indexOf('dedup-esdeveniments') !== -1) {
  principal();
}
