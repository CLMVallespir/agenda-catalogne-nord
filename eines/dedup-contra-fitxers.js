// ---------------------------------------------------------------------------
// DEDUPLICACIÓ CONTRA EL QUE JA TENIM — pendents.json i events.json
//
// Una sola feina: donada una oferta entrant ja mapejada a fila, dir si aquell
// acte ja el tenim en algun lloc, i on. Res més.
//
//   - Cap crida a cap API. Codi pur: entren files, surt una classificació.
//   - NO llegeix cap fitxer i NO n'escriu cap. Les dues llistes —les files de
//     `pendents.json` i les d'`events.json`— les passa qui la crida.
//   - **`events.json` NO S'ESCRIU MAI DES D'AQUÍ, EN CAP CAS.** Aquesta peça
//     no en té ni la ruta. Vegeu §«Per què no escriu res».
//   - No esborra res, no fusiona res i no canvia cap `estat`. Torna una
//     etiqueta per oferta entrant i prou; qui la crida decideix què en fa.
//   - Cap detall d'ADT66 més enllà d'un: la capa 1 llegeix el tag
//     `[ADT66 id: …]` que hi escriu `eines/mapeja-adt66.js`, i el llegeix amb
//     la funció d'aquell mòdul, no amb cap còpia. Una fila sense tag —correu,
//     Typebot, CSV de recerca— es salta la capa 1 sense error.
//
//
// --- LA REGLA QUE MANA TOT EL DISSENY: SI DUBTES, ENCUA -------------------
//
// Els dos errors possibles no valen igual. Un duplicat que arriba a
// `pendents.json` és VISIBLE: surt a la cua del curador al costat del seu
// bessó i es resol en un clic. Un acte descartat per error no el veurà mai
// ningú —ni el curador, que no sap que existia— i no deixa cap rastre on
// anar-lo a buscar.
//
// Per això aquesta peça està esbiaixada, a posta i en tot moment, cap a
// 'nova'. Tot el que no sigui una coincidència que aguanti mirar-se-la de prop
// es classifica com a nova i entra a la cua. La conseqüència acceptada és que
// alguns duplicats hi passaran; la conseqüència NO acceptada seria perdre un
// acte en silenci.
//
//
// --- LES DUES CAPES, I PER QUÈ NO TENEN LA MATEIXA FORÇA ------------------
//
// CAPA 1, EXACTA, CONTRA `pendents.json`. Les files de la cua conserven
// `nota_curador`, i les d'origen ADT66 hi porten el tag `[ADT66 id: …]`. Dues
// files amb el mateix `SyndicObjectID` són la mateixa oferta del proveïdor:
// és una igualtat d'identificador, no una semblança, i no hi ha cap llindar a
// triar. Cobreix els tres estats amb la mateixa precisió (vegeu §«Quins
// estats tracta»): una oferta ja encuada no torna a entrar, i una ja
// rebutjada tampoc —que és, en realitat, per què `pendents.json` guarda els
// rebuigs en comptes de suprimir-los (§4 de `CLAUDE.md`).
//
// CAPA 2, DIFUSA, CONTRA `events.json`. Les files publicades no porten cap
// identificador i no en portaran mai: `recullFitxa()` es queda els 16 camps
// canònics i `nota_curador` —el tag inclòs— s'atura a la cua. El sondeig de
// `docs/SONDEIG-FONT-URL-ADT66.md` va tancar també l'última porta: cap camp
// del flux no porta URL de fitxa, o sigui que `font_url` tampoc no pot fer
// d'ancoratge. Queda comparar el CONTINGUT, i comparar contingut és estimar.
// D'aquí ve tot el §«El llindar».
//
//
// --- QUINS ESTATS TRACTA (§4 de CLAUDE.md ho exigeix declarat) ------------
//
// D'AQUEST FITXER: **els tres**, cadascun amb la seva etiqueta pròpia i cap
// per omissió. El repartiment el fa `classificacioPerEstat()`, amb tres
// comparacions explícites `=== 'pendent'`, `=== 'publicat'` i
// `=== 'rebutjat'` —mai un `!== 'rebutjat'`, que és justament el que el §4
// prohibeix.
//
// Un estat que no sigui cap dels tres NO es classifica com si ho fos: la
// funció torna `null` i l'oferta acaba a 'nova'. És el costat segur d'AQUESTA
// peça, i val la pena veure que no és el mateix costat que a `curador.html`.
// Allà el dubte es resol deixant la fila FORA de la cua; aquí es resol
// deixant-la ENTRAR. No és cap contradicció: als dos llocs el costat segur és
// el que no fa desaparèixer informació sense que ningú ho vegi.
//
// DE `pendents.json` EN GENERAL: la capa 1 mira totes les files del fitxer,
// sense filtrar-ne cap per estat abans de comparar. Filtrar-hi «només les
// pendents» seria l'error concret que el §4 descriu: l'oferta rebutjada
// tornaria a entrar cada setmana.
//
//
// --- EL LLINDAR: 0,75, I D'ON SURT ----------------------------------------
//
// La capa 2 exigeix DUES coses per gosar dir 'ja_publicat':
//
//   1. que `comparaEsdeveniments()` hagi dit 'mateix-esdeveniment' —o sigui
//      municipi normalitzat igual, `data_inici` igual, i títols comparables
//      dins d'una sola llengua—, i
//   2. que la similitud de Jaccard dels títols arribi a 0,75.
//
// La segona condició és MÉS ESTRICTA que la del mòdul de dedup, que fusiona a
// partir de 0,55. Són dos números diferents perquè són dues decisions
// diferents: allà fusionar deixa una fila a la cua, que el curador encara
// veurà; aquí passar el llindar vol dir que l'acte no arriba enlloc.
//
// El número surt de mesurar els 92 títols reals que tenim (84 de
// `pendents.json` + 8 d'`events.json`), no d'arrodonir:
//
//   - EL PARELL QUE NO S'HA DE FUSIONAR MAI. «El Taller de les Barques de
//     Paulilles» i «El Taller de les Descobertes de Paulilles», tots dos a
//     Portvendres el 2026-09-19: mateixa clau forta, Jaccard 0,500, i són DOS
//     TALLERS DIFERENTS. És el fals positiu més perillós del corpus, i marca
//     el terra: el llindar ha de quedar clarament per damunt de 0,500. A 0,55
//     el marge és de cinc centèsimes; a 0,75 és de vint-i-cinc.
//
//   - PER QUÈ 0,75 I NO 0,60. Amb títols curts, la franja [0,55–0,75) és
//     exactament la de «una paraula distintiva canviada»: quatre paraules
//     contra quatre compartint-ne tres dona 0,600, i cinc contra cinc
//     compartint-ne quatre dona 0,667. I una paraula canviada és,
//     literalment, el que separa els dos tallers de Paulilles —n'hi ha prou
//     d'afegir-hi el municipi a tots dos títols, que és el que fan els títols
//     de l'ADT66, per pujar aquell parell de 0,500 a 0,600 i fer-lo caure a
//     dins de la franja.
//
//   - QUÈ GARANTEIX 0,75. Una substitució d'una paraula entre dos títols de
//     n paraules dona (n−1)/(n+1), que no arriba a 0,75 fins a n = 7. Dels 92
//     títols reals, 88 tenen sis paraules significatives o menys (mediana:
//     tres). Per tant, en la pràctica, per damunt de 0,75 no hi ha
//     substitucions: només hi ha títols que AFEGEIXEN paraules a un altre
//     —«5es Jornades d'Història Nacional» dins de la seva versió llarga—, que
//     és la forma que té un duplicat de debò.
//
//   - EL DUPLICAT DE DEBÒ QUE ES DEIXA PASSAR, I ESTÀ BÉ. «5es Jornades
//     d'Història Nacional» (publicat) i «5es Jornades d'Història Nacional:
//     dels Fets de Prats de Molló a la Constitució de l'Havana» (a la cua)
//     són el mateix acte i fan Jaccard 0,444. No arriben ni a 0,55: aquest
//     duplicat ja s'encuava abans i continuarà encuant-se. És la direcció
//     bona de l'error, mesurada sobre les dades d'avui.
//
//
// --- PER QUÈ NO ESCRIU RES ------------------------------------------------
//
// Perquè les dues escriptures possibles són decisions que no li toquen. Què
// fer amb una oferta 'ja_a_la_cua' —refrescar-ne els camps o deixar-la
// estar—, i què fer amb una 'nova' —encuar-la ara o esperar el filtre previ—
// són tries de qui munta la canonada. I `events.json` és un cas a part i
// tancat: és l'arxiu públic, l'omple `curador.html` en publicar i cap agent
// automàtic no hi toca mai.
//
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/dedup-contra-fitxers.js    -> passa la bateria de proves
// ---------------------------------------------------------------------------


// --- El que ve de fora ------------------------------------------------------

// La comparació de contingut, sencera: clau forta, municipis amb dos noms,
// paraules buides per llengua i Jaccard. Aquí no se'n copia ni una línia; la
// capa 2 hi posa només un llindar més exigent al damunt.
var dedup = require('./dedup-esdeveniments.js');

// La lectura del tag `[ADT66 id: …]` de dins de `nota_curador`. També aquí es
// reutilitza en comptes de copiar-se: el patró del tag ha de viure en un sol
// lloc, i aquell és el seu.
var identificador = require('./adt66-identificador.js');


// --- Constants --------------------------------------------------------------

// La similitud de títols que la capa 2 exigeix per dir que un acte ja és
// publicat. Vegeu el §«El llindar» de la capçalera: 0,75 i no 0,55 perquè
// aquí un encert de més val menys que un error de menys.
var LLINDAR_JA_PUBLICAT = 0.75;

// Les quatre etiquetes que aquesta peça pot tornar, i les úniques.
var JA_PUBLICAT = 'ja_publicat';
var JA_A_LA_CUA = 'ja_a_la_cua';
var JA_REBUTJAT = 'ja_rebutjat';
var NOVA = 'nova';

// L'ordre en què surten a l'informe de recompte. 'nova' va l'última perquè és
// la que interessa comptar contra el total.
var ETIQUETES = [JA_PUBLICAT, JA_A_LA_CUA, JA_REBUTJAT, NOVA];

// El descriptor de font de les files d'`events.json`. La `llengua` és 'ca'
// perquè el §4 de `CLAUDE.md` diu que `titol` va en català i perquè una fila
// publicada ja ha passat pel curador: el títol és català per construcció.
// El `tipus` es deixa buit a posta —no és cap oblit—: només serviria per
// decidir qui mana en fusionar, i aquí no es fusiona mai res.
var FONT_PUBLICADA = { tipus: '', llengua: 'ca' };


// --- La funció --------------------------------------------------------------

// ------------------------------------------------------------
// Classifica un lot sencer d'ofertes entrants contra el que ja tenim.
//
// `entrants` és una llista d'elements que poden ser:
//
//   - { fila: <els disset camps>, font: { tipus, llengua } }, o
//   - una fila tal qual, i llavors s'hi aplica `fontDelLot`.
//
// `filesPendents` són les files de `pendents.json` senceres, sense filtrar-ne
// cap per estat. `filesPublicades` són les d'`events.json`. Cap de les dues
// no es modifica.
//
// Torna:
//
//   classificacions    [{ ... }, ...]  una per oferta entrant, en el mateix
//                      ordre (vegeu classificaEntrant() per la forma)
//   recompte           { ja_publicat, ja_a_la_cua, ja_rebutjat, nova, total }
//   duplicatsAncorats  els tags repetits dins de pendents.json, si n'hi ha
// ------------------------------------------------------------
function classificaContraFitxers(entrants, filesPendents, filesPublicades, fontDelLot) {
  var llista = Array.isArray(entrants) ? entrants : [];
  var pendents = Array.isArray(filesPendents) ? filesPendents : [];
  var publicades = Array.isArray(filesPublicades) ? filesPublicades : [];
  var fontPerOmissio = fontDeclarada(fontDelLot);

  // L'índex de la capa 1 es munta un sol cop per lot, no un per oferta.
  var ancorat = identificador.construeixAncoratge(pendents);

  var classificacions = [];

  for (var i = 0; i < llista.length; i++) {
    var candidat = candidatDe(llista[i], fontPerOmissio);
    classificacions.push(classificaEntrant(candidat, ancorat.ancoratge, publicades));
  }

  return {
    classificacions: classificacions,
    recompte: comptaClassificacions(classificacions),
    duplicatsAncorats: ancorat.duplicats
  };
}


// --- Les peces --------------------------------------------------------------

// ------------------------------------------------------------
// Classifica UNA oferta entrant. Primer la capa 1, que és exacta; només si
// aquella no diu res, la capa 2, que és difusa. L'ordre no és indiferent: una
// igualtat d'identificador no s'ha de posar mai a votació amb una semblança
// de títol.
//
// Torna sempre els mateixos sis camps, sempre presents:
//
//   classificacio    'ja_publicat' · 'ja_a_la_cua' · 'ja_rebutjat' · 'nova'
//   capa             1, 2, o 0 quan no ha decidit ningú i l'oferta és nova
//   motiu            una frase en català que ho explica, per ensenyar-la
//   syndicObjectID   el tag de l'oferta entrant, o '' si no en porta
//   filaExistent     la fila nostra que ha fet la coincidència, o null
//   similitud        el Jaccard de la capa 2 (0..1), o null si no s'ha calculat
// ------------------------------------------------------------
function classificaEntrant(candidat, ancoratge, filesPublicades) {
  var syndicObjectID = identificador.extreuIdentificador(candidat.fila.nota_curador);

  var exacta = cercaExacta(syndicObjectID, ancoratge);

  if (exacta !== null) {
    return resultat({
      classificacio: exacta.classificacio,
      capa: 1,
      motiu: 'Capa 1: el flux ja havia portat l\'oferta ' + syndicObjectID +
             ', i la fila que en va sortir és a pendents.json amb estat «' +
             exacta.estat + '».',
      syndicObjectID: syndicObjectID,
      filaExistent: exacta.fila
    });
  }

  var difusa = cercaDifusa(candidat, filesPublicades);

  if (difusa !== null) {
    return resultat({
      classificacio: JA_PUBLICAT,
      capa: 2,
      motiu: 'Capa 2: mateix municipi i mateixa data que una fila d\'events.json, ' +
             'i els títols comparteixen ' + tantPerCent(difusa.similitud) +
             ' del vocabulari útil (llindar: ' + tantPerCent(LLINDAR_JA_PUBLICAT) + ').',
      syndicObjectID: syndicObjectID,
      filaExistent: difusa.fila,
      similitud: difusa.similitud
    });
  }

  return resultat({
    classificacio: NOVA,
    capa: 0,
    motiu: motiuDeNova(syndicObjectID, candidat, filesPublicades),
    syndicObjectID: syndicObjectID
  });
}

// ------------------------------------------------------------
// CAPA 1. La fila de la cua que porti el mateix `SyndicObjectID`, amb
// l'etiqueta que li toqui per estat. `null` vol dir «aquesta capa no diu res»:
// perquè l'oferta no porta tag, perquè el tag no és a la cua, o perquè la fila
// que hi és té un estat que no reconeixem.
// ------------------------------------------------------------
function cercaExacta(syndicObjectID, ancoratge) {
  if (syndicObjectID === null || syndicObjectID === '') {
    return null;
  }

  if (!ancoratge || ancoratge.has(syndicObjectID) === false) {
    return null;
  }

  var fila = ancoratge.get(syndicObjectID);
  var estat = cadena(fila.estat);
  var classificacio = classificacioPerEstat(estat);

  // Un estat inesperat no s'endevina: es deixa passar l'oferta i que es vegi.
  if (classificacio === null) {
    return null;
  }

  return { classificacio: classificacio, estat: estat, fila: fila };
}

// ------------------------------------------------------------
// L'etiqueta que correspon a un `estat` de `pendents.json`. Els tres estats
// del §4 de `CLAUDE.md`, cadascun amb un `===` propi i explícit; qualsevol
// altra cosa és `null`, i qui la cridi ja sap que això vol dir 'nova'.
// ------------------------------------------------------------
function classificacioPerEstat(estat) {
  if (estat === 'pendent') {
    return JA_A_LA_CUA;
  }
  if (estat === 'publicat') {
    return JA_PUBLICAT;
  }
  if (estat === 'rebutjat') {
    return JA_REBUTJAT;
  }
  return null;
}

// ------------------------------------------------------------
// CAPA 2. La fila d'`events.json` que sigui el mateix acte que l'oferta
// entrant, o `null` si no n'hi ha cap prou clara. Exigeix les dues coses del
// §«El llindar»: que la comparació digui 'mateix-esdeveniment' I que la
// similitud arribi a LLINDAR_JA_PUBLICAT.
//
// Es queda la coincidència MÉS ALTA, no la primera: si dues files publicades
// passessin el llindar, la que decideix ha de ser la millor i no la que
// l'atzar de l'ordre del fitxer hagi posat abans.
// ------------------------------------------------------------
function cercaDifusa(candidat, filesPublicades) {
  var millor = null;

  for (var i = 0; i < filesPublicades.length; i++) {
    var candidatPublicat = { fila: filesPublicades[i], font: FONT_PUBLICADA };
    var comparacio = dedup.comparaEsdeveniments(candidat, candidatPublicat);

    if (comparacio.decisio !== 'mateix-esdeveniment') {
      continue;
    }

    if (comparacio.similitud === null || comparacio.similitud < LLINDAR_JA_PUBLICAT) {
      continue;
    }

    if (millor === null || comparacio.similitud > millor.similitud) {
      millor = { fila: filesPublicades[i], similitud: comparacio.similitud };
    }
  }

  return millor;
}

// ------------------------------------------------------------
// Per què una oferta ha quedat com a 'nova'. No és cosmètica: sense això,
// «no he trobat res» i «no he pogut ni mirar» es confondrien a l'informe, i
// justament la segona és la que cal saber que passa.
// ------------------------------------------------------------
function motiuDeNova(syndicObjectID, candidat, filesPublicades) {
  var parts = [];

  if (syndicObjectID === null || syndicObjectID === '') {
    parts.push('Capa 1 saltada: l\'oferta no porta cap tag [ADT66 id: …]');
  } else {
    parts.push('Capa 1 sense coincidència: l\'identificador ' + syndicObjectID +
               ' no és a cap fila de pendents.json');
  }

  if (filesPublicades.length === 0) {
    parts.push('capa 2 sense res a comparar: events.json no porta cap fila');
    return parts.join('; ') + '.';
  }

  parts.push('capa 2 per sota del llindar: ' + resumDifusa(candidat, filesPublicades));
  return parts.join('; ') + '.';
}

// ------------------------------------------------------------
// El millor que la capa 2 ha arribat a veure, dit en una frase. Serveix per
// poder mirar de prop els casos que ronden el llindar sense haver de tornar a
// calcular res a mà.
// ------------------------------------------------------------
function resumDifusa(candidat, filesPublicades) {
  var millorSimilitud = null;
  var decisions = {};

  for (var i = 0; i < filesPublicades.length; i++) {
    var candidatPublicat = { fila: filesPublicades[i], font: FONT_PUBLICADA };
    var comparacio = dedup.comparaEsdeveniments(candidat, candidatPublicat);

    decisions[comparacio.decisio] = (decisions[comparacio.decisio] || 0) + 1;

    if (comparacio.similitud === null) {
      continue;
    }
    if (millorSimilitud === null || comparacio.similitud > millorSimilitud) {
      millorSimilitud = comparacio.similitud;
    }
  }

  if (millorSimilitud === null) {
    return 'cap parella no ha arribat a comparar títols (' + resumDecisions(decisions) + ')';
  }

  return 'la similitud més alta ha estat ' + tantPerCent(millorSimilitud) +
         ' (' + resumDecisions(decisions) + ')';
}

// ------------------------------------------------------------
// El recompte de decisions de la capa de dedup, escrit curt.
// ------------------------------------------------------------
function resumDecisions(decisions) {
  var noms = Object.keys(decisions).sort();
  var trossos = [];

  for (var i = 0; i < noms.length; i++) {
    trossos.push(noms[i] + ': ' + decisions[noms[i]]);
  }

  if (trossos.length === 0) {
    return 'cap comparació';
  }
  return trossos.join(', ');
}

// ------------------------------------------------------------
// Quantes ofertes han caigut a cada etiqueta. Les quatre hi surten sempre,
// també amb zero: un informe on una etiqueta desapareix quan és buida no és
// un informe, és una llista de sorpreses.
// ------------------------------------------------------------
function comptaClassificacions(classificacions) {
  var recompte = { total: classificacions.length };

  for (var i = 0; i < ETIQUETES.length; i++) {
    recompte[ETIQUETES[i]] = 0;
  }

  for (var j = 0; j < classificacions.length; j++) {
    var etiqueta = classificacions[j].classificacio;
    recompte[etiqueta] = (recompte[etiqueta] || 0) + 1;
  }

  return recompte;
}

// ------------------------------------------------------------
// L'informe de recompte en text, per ensenyar-lo al terminal. Una línia per
// etiqueta, sempre les quatre, i el total al final.
// ------------------------------------------------------------
function informeDeRecompte(recompte) {
  var linies = [];

  for (var i = 0; i < ETIQUETES.length; i++) {
    var etiqueta = ETIQUETES[i];
    linies.push('  ' + encoixina(etiqueta, 14) + recompte[etiqueta]);
  }

  linies.push('  ' + encoixina('TOTAL', 14) + recompte.total);
  return linies.join('\n');
}

// ------------------------------------------------------------
// Un candidat { fila, font } a partir d'un element del lot, que pot venir amb
// font pròpia o sense. Mateix conveni que processaLot(): la font pròpia mana,
// i si no n'hi ha s'aplica la del lot.
// ------------------------------------------------------------
function candidatDe(element, fontPerOmissio) {
  if (!element) {
    return { fila: {}, font: fontPerOmissio };
  }

  if (element.fila) {
    var propia = fontDeclarada(element.font);
    if (propia.tipus === '' && propia.llengua === '') {
      return { fila: element.fila, font: fontPerOmissio };
    }
    return { fila: element.fila, font: propia };
  }

  return { fila: element, font: fontPerOmissio };
}

// ------------------------------------------------------------
// Un descriptor de font sencer a partir del que hagin passat. Els dos camps
// hi són sempre, buits si no els han dit: així ningú no ha de comprovar mai
// si existeixen.
// ------------------------------------------------------------
function fontDeclarada(font) {
  if (!font) {
    return { tipus: '', llengua: '' };
  }
  return { tipus: cadena(font.tipus), llengua: cadena(font.llengua) };
}

// ------------------------------------------------------------
// Els sis camps del resultat, sempre tots, amb els valors per omissió que
// toquen. Igual que a dedup-esdeveniments.js: qui llegeixi el resultat no ha
// de comprovar mai si un camp hi és.
// ------------------------------------------------------------
function resultat(parts) {
  return {
    classificacio: parts.classificacio,
    capa: parts.capa,
    motiu: parts.motiu,
    syndicObjectID: parts.syndicObjectID || '',
    filaExistent: parts.filaExistent || null,
    similitud: typeof parts.similitud === 'number' ? parts.similitud : null
  };
}

// ------------------------------------------------------------
// Un valor com a cadena retallada. Un camp desconegut és '' (§4 de CLAUDE.md).
// ------------------------------------------------------------
function cadena(valor) {
  if (valor === null || valor === undefined) {
    return '';
  }
  return String(valor).trim();
}

// ------------------------------------------------------------
// Una similitud escrita en tant per cent, per ensenyar-la en un motiu.
// ------------------------------------------------------------
function tantPerCent(similitud) {
  return Math.round(similitud * 100) + '%';
}

// ------------------------------------------------------------
// Un text encoixinat a l'amplada que es demana, per alinear l'informe.
// ------------------------------------------------------------
function encoixina(text, amplada) {
  var alineat = String(text);
  while (alineat.length < amplada) {
    alineat = alineat + ' ';
  }
  return alineat;
}


// --- El que s'exporta -------------------------------------------------------

module.exports = {
  classificaContraFitxers: classificaContraFitxers,
  informeDeRecompte: informeDeRecompte,
  LLINDAR_JA_PUBLICAT: LLINDAR_JA_PUBLICAT
};


// --- Proves des del terminal ------------------------------------------------
// Tot el que ve a partir d'aquí és per poder exercitar les funcions a mà. No
// forma part de la peça i no s'ha de copiar enlloc. Cap prova no toca la xarxa
// i cap prova no llegeix ni escriu cap fitxer: les files de prova són literals
// fets a mà a partir de files reals de `pendents.json` i d'`events.json`, amb
// els títols i les dates que porten de debò.

// ------------------------------------------------------------
// Una fila dels disset camps amb el mínim per poder comparar-la, més el que
// se li vulgui posar a sobre.
// ------------------------------------------------------------
function filaDeProva(titol, dataInici, municipi, extres) {
  var fila = {
    id: '', titol: titol, data_inici: dataInici, data_fi: dataInici, hora: '',
    lloc: '', municipi: municipi, comarca: '', categoria: '',
    descripcio_ca: '', descripcio_fr: '', associacio: '', imatge_url: '',
    font_url: '', estat: 'pendent', data_entrada: '', nota_curador: ''
  };

  if (extres) {
    var claus = Object.keys(extres);
    for (var i = 0; i < claus.length; i++) {
      fila[claus[i]] = extres[claus[i]];
    }
  }

  return fila;
}

// ------------------------------------------------------------
// Els casos de prova, cadascun amb el que espera. Els títols i les dates
// surten de files reals; el que s'hi ha canviat es diu al nom del cas.
// ------------------------------------------------------------
function casosDeProva() {
  var FONT_CA = { tipus: 'agregador', llengua: 'ca' };
  var FONT_FR = { tipus: 'agregador', llengua: 'fr' };

  // Les files publicades: les quatre d'`events.json` que fan falta aquí,
  // copiades tal com són al fitxer.
  var publicades = [
    filaDeProva('Concert de Goulamas\'k', '2026-09-12', 'Prats de Molló', { estat: 'publicat' }),
    filaDeProva('5es Jornades d\'Història Nacional', '2026-10-03', 'Prats de Molló', { estat: 'publicat' }),
    filaDeProva('El gran mercat de Prada', '2026-01-01', 'Prada', { estat: 'publicat' }),
    filaDeProva('Cat\'Festa', '2026-10-16', 'Sant Llorenç de Cerdans', { estat: 'publicat' })
  ];

  // La cua: tres files amb tag d'ADT66, una per estat, més una sense tag.
  var pendents = [
    filaDeProva('MARCHE TRADITIONNEL', '2026-01-01', 'Vernet',
      { estat: 'pendent', nota_curador: '[ADT66 id: FMALAR066FS00K4S] Res a dir.' }),
    filaDeProva('WHEELZ GAMES', '2026-09-26', 'Canet de Rosselló',
      { estat: 'rebutjat', nota_curador: '[ADT66 id: FMALAR066V50DSJE] Res a dir.' }),
    filaDeProva('VIDE GRENIER AU VILLAGE', '2026-09-27', 'Canet de Rosselló',
      { estat: 'publicat', nota_curador: '[ADT66 id: FMALAR066V50MJYW] Res a dir.' }),
    filaDeProva('El Taller de les Barques de Paulilles', '2026-09-19', 'Portvendres',
      { estat: 'pendent' })
  ];

  return [
    // --- Capa 1: els tres estats, cadascun amb la seva etiqueta ---
    {
      nom: 'capa 1 · tag d\'una fila pendent',
      entrant: { fila: filaDeProva('MARCHE TRADITIONNEL', '2026-01-01', 'Vernet',
        { nota_curador: '[ADT66 id: FMALAR066FS00K4S] Res a dir.' }), font: FONT_FR },
      esperat: { classificacio: 'ja_a_la_cua', capa: 1 }
    },
    {
      nom: 'capa 1 · tag d\'una fila rebutjada (memòria de rebuig)',
      entrant: { fila: filaDeProva('WHEELZ GAMES', '2026-09-26', 'Canet de Rosselló',
        { nota_curador: '[ADT66 id: FMALAR066V50DSJE] Res a dir.' }), font: FONT_FR },
      esperat: { classificacio: 'ja_rebutjat', capa: 1 }
    },
    {
      nom: 'capa 1 · tag d\'una fila publicada dins de la cua',
      entrant: { fila: filaDeProva('VIDE GRENIER AU VILLAGE', '2026-09-27', 'Canet de Rosselló',
        { nota_curador: '[ADT66 id: FMALAR066V50MJYW] Res a dir.' }), font: FONT_FR },
      esperat: { classificacio: 'ja_publicat', capa: 1 }
    },
    {
      nom: 'capa 1 · tag desconegut: no diu res, passa a la capa 2',
      entrant: { fila: filaDeProva('COSA NOVA', '2026-11-05', 'Vernet',
        { nota_curador: '[ADT66 id: FMALAR066XXXXXXX] Res a dir.' }), font: FONT_FR },
      esperat: { classificacio: 'nova', capa: 0 }
    },
    {
      nom: 'capa 1 · estat inesperat a la cua: cap al costat segur, encua',
      entrant: { fila: filaDeProva('COSA RARA', '2026-11-06', 'Vernet',
        { nota_curador: '[ADT66 id: FMALAR066RARESTAT] Res a dir.' }), font: FONT_FR },
      pendentsExtra: [filaDeProva('COSA RARA', '2026-11-06', 'Vernet',
        { estat: 'arxivat', nota_curador: '[ADT66 id: FMALAR066RARESTAT] Res a dir.' })],
      esperat: { classificacio: 'nova', capa: 0 }
    },

    // --- Capa 2: el llindar, mirat des dels dos costats ---
    {
      nom: 'capa 2 · títol idèntic al publicat: 100%',
      entrant: { fila: filaDeProva('Concert de Goulamas\'k', '2026-09-12', 'Prats de Molló'), font: FONT_CA },
      esperat: { classificacio: 'ja_publicat', capa: 2, similitud: 1 }
    },
    {
      nom: 'capa 2 · mateix vocabulari en un altre ordre: 100%',
      entrant: { fila: filaDeProva('Goulamas\'k en concert', '2026-09-12', 'Prats de Molló'), font: FONT_CA },
      esperat: { classificacio: 'ja_publicat', capa: 2, similitud: 1 }
    },
    {
      nom: 'capa 2 · tres paraules de quatre, sense afegir-ne cap: 75%, JUST al llindar',
      entrant: { fila: filaDeProva('Jornades d\'Història Nacional', '2026-10-03', 'Prats de Molló'), font: FONT_CA },
      esperat: { classificacio: 'ja_publicat', capa: 2, similitud: 0.75 }
    },
    {
      nom: 'capa 2 · una paraula afegida sobre dues: 67%, un pèl per sota, s\'encua',
      entrant: { fila: filaDeProva('Gran concert de Goulamas\'k', '2026-09-12', 'Prats de Molló'), font: FONT_CA },
      esperat: { classificacio: 'nova', capa: 0 }
    },
    {
      nom: 'capa 2 · una paraula afegida sobre quatre: 80%, un pèl per damunt',
      entrant: { fila: filaDeProva('5es Jornades d\'Història Nacional catalanes', '2026-10-03', 'Prats de Molló'), font: FONT_CA },
      esperat: { classificacio: 'ja_publicat', capa: 2, similitud: 0.8 }
    },
    {
      nom: 'capa 2 · dues paraules afegides sobre dues: 50%, per sota',
      entrant: { fila: filaDeProva('Concert de Goulamas\'k a Prats de Molló', '2026-09-12', 'Prats de Molló'), font: FONT_CA },
      esperat: { classificacio: 'nova', capa: 0 }
    },
    {
      nom: 'capa 2 · el duplicat real de les Jornades: 44%, s\'encua',
      entrant: { fila: filaDeProva('5es Jornades d\'Història Nacional: dels Fets de Prats de Molló a la Constitució de l\'Havana', '2026-10-03', 'Prats de Molló'), font: FONT_CA },
      esperat: { classificacio: 'nova', capa: 0 }
    },
    {
      nom: 'capa 2 · mateixa data, un altre municipi: no es compara',
      entrant: { fila: filaDeProva('Concert de Goulamas\'k', '2026-09-12', 'Perpinyà'), font: FONT_CA },
      esperat: { classificacio: 'nova', capa: 0 }
    },
    {
      nom: 'capa 2 · mateix títol, una altra data: no es compara',
      entrant: { fila: filaDeProva('Concert de Goulamas\'k', '2026-09-13', 'Prats de Molló'), font: FONT_CA },
      esperat: { classificacio: 'nova', capa: 0 }
    },
    {
      nom: 'capa 2 · títol en francès contra un publicat en català: no es compara',
      entrant: { fila: filaDeProva('CONCERT DE GOULAMAS\'K', '2026-09-12', 'Prats de Molló'), font: FONT_FR },
      esperat: { classificacio: 'nova', capa: 0 }
    },
    {
      nom: 'capa 2 · el mateix títol francès, però declarat en català: sí que es compara',
      entrant: { fila: filaDeProva('CONCERT DE GOULAMAS\'K', '2026-09-12', 'Prats de Molló'), font: FONT_CA },
      esperat: { classificacio: 'ja_publicat', capa: 2, similitud: 1 }
    },
    {
      nom: 'capa 2 · municipi amb els dos noms: PRATS-DE-MOLLO-LA-PRESTE lliga',
      entrant: { fila: filaDeProva('Concert de Goulamas\'k', '2026-09-12', 'PRATS-DE-MOLLO-LA-PRESTE'), font: FONT_CA },
      esperat: { classificacio: 'ja_publicat', capa: 2, similitud: 1 }
    },
    {
      nom: 'capa 2 · sense data d\'inici: la clau forta no es pot muntar, encua',
      entrant: { fila: filaDeProva('Concert de Goulamas\'k', '', 'Prats de Molló'), font: FONT_CA },
      esperat: { classificacio: 'nova', capa: 0 }
    },

    // --- L'ordre de les capes ---
    {
      nom: 'ordre · la capa 1 mana sobre la capa 2',
      entrant: { fila: filaDeProva('Concert de Goulamas\'k', '2026-09-12', 'Prats de Molló',
        { nota_curador: '[ADT66 id: FMALAR066V50DSJE] Res a dir.' }), font: FONT_CA },
      esperat: { classificacio: 'ja_rebutjat', capa: 1 }
    },

    // --- Files sense tag i sense res a què assemblar-se ---
    {
      nom: 'nova · sense tag i sense cap semblança',
      entrant: { fila: filaDeProva('Xerrada sobre les abelles', '2026-11-20', 'Ceret'), font: FONT_CA },
      esperat: { classificacio: 'nova', capa: 0 }
    }
  ];
}

// ------------------------------------------------------------
// Passa la bateria i ensenya què ha sortit. Torna la llista de problemes.
// ------------------------------------------------------------
function passaLesProves() {
  var problemes = [];
  var casos = casosDeProva();

  var publicades = [
    filaDeProva('Concert de Goulamas\'k', '2026-09-12', 'Prats de Molló', { estat: 'publicat' }),
    filaDeProva('5es Jornades d\'Història Nacional', '2026-10-03', 'Prats de Molló', { estat: 'publicat' }),
    filaDeProva('El gran mercat de Prada', '2026-01-01', 'Prada', { estat: 'publicat' }),
    filaDeProva('Cat\'Festa', '2026-10-16', 'Sant Llorenç de Cerdans', { estat: 'publicat' })
  ];

  var pendentsBase = [
    filaDeProva('MARCHE TRADITIONNEL', '2026-01-01', 'Vernet',
      { estat: 'pendent', nota_curador: '[ADT66 id: FMALAR066FS00K4S] Res a dir.' }),
    filaDeProva('WHEELZ GAMES', '2026-09-26', 'Canet de Rosselló',
      { estat: 'rebutjat', nota_curador: '[ADT66 id: FMALAR066V50DSJE] Res a dir.' }),
    filaDeProva('VIDE GRENIER AU VILLAGE', '2026-09-27', 'Canet de Rosselló',
      { estat: 'publicat', nota_curador: '[ADT66 id: FMALAR066V50MJYW] Res a dir.' }),
    filaDeProva('El Taller de les Barques de Paulilles', '2026-09-19', 'Portvendres',
      { estat: 'pendent' })
  ];

  for (var i = 0; i < casos.length; i++) {
    var cas = casos[i];
    var pendents = pendentsBase;

    if (cas.pendentsExtra) {
      pendents = pendentsBase.concat(cas.pendentsExtra);
    }

    var sortida = classificaContraFitxers([cas.entrant], pendents, publicades);
    var obtingut = sortida.classificacions[0];

    var linia = obtingut.classificacio + ' (capa ' + obtingut.capa + ')';
    if (obtingut.similitud !== null) {
      linia = linia + ' · similitud ' + obtingut.similitud.toFixed(3);
    }
    console.log('  ' + linia);
    console.log('     ' + cas.nom);

    if (obtingut.classificacio !== cas.esperat.classificacio) {
      problemes.push(cas.nom + ': esperava «' + cas.esperat.classificacio +
                     '», n\'he tret «' + obtingut.classificacio + '»');
    }
    if (obtingut.capa !== cas.esperat.capa) {
      problemes.push(cas.nom + ': esperava la capa ' + cas.esperat.capa +
                     ', n\'he tret la ' + obtingut.capa);
    }
    if (typeof cas.esperat.similitud === 'number') {
      if (obtingut.similitud === null ||
          Math.abs(obtingut.similitud - cas.esperat.similitud) > 0.001) {
        problemes.push(cas.nom + ': esperava una similitud de ' + cas.esperat.similitud +
                       ', n\'he tret ' + obtingut.similitud);
      }
    }
  }

  return problemes;
}

// ------------------------------------------------------------
// Comprova que la peça no toca cap de les dues llistes que li passen. No és
// paranoia: el requisit és que `events.json` no es modifiqui mai, i una prova
// val més que una promesa al comentari.
// ------------------------------------------------------------
function provaNoEscriuRes() {
  var problemes = [];

  var publicades = [filaDeProva('Concert de Goulamas\'k', '2026-09-12', 'Prats de Molló', { estat: 'publicat' })];
  var pendents = [filaDeProva('MARCHE TRADITIONNEL', '2026-01-01', 'Vernet',
    { estat: 'pendent', nota_curador: '[ADT66 id: FMALAR066FS00K4S] Res a dir.' })];

  var abansPublicades = JSON.stringify(publicades);
  var abansPendents = JSON.stringify(pendents);

  classificaContraFitxers([
    { fila: filaDeProva('Concert de Goulamas\'k', '2026-09-12', 'Prats de Molló'), font: { tipus: 'agregador', llengua: 'ca' } },
    { fila: filaDeProva('MARCHE TRADITIONNEL', '2026-01-01', 'Vernet',
      { nota_curador: '[ADT66 id: FMALAR066FS00K4S] Res a dir.' }), font: { tipus: 'agregador', llengua: 'fr' } }
  ], pendents, publicades);

  if (JSON.stringify(publicades) !== abansPublicades) {
    problemes.push('la llista d\'events.json ha canviat: no ha de canviar mai');
  }
  if (JSON.stringify(pendents) !== abansPendents) {
    problemes.push('la llista de pendents.json ha canviat: aquesta peça no escriu');
  }

  return problemes;
}

// ------------------------------------------------------------
// El punt d'entrada des del terminal.
// ------------------------------------------------------------
function principal() {
  console.log('');
  console.log('DEDUPLICACIÓ CONTRA pendents.json I events.json — bateria de proves');
  console.log('llindar de la capa 2: ' + LLINDAR_JA_PUBLICAT);
  console.log('');

  var problemes = passaLesProves().concat(provaNoEscriuRes());

  console.log('');

  if (problemes.length === 0) {
    console.log('Tot correcte.');
    return;
  }

  console.log('PROBLEMES (' + problemes.length + '):');
  for (var i = 0; i < problemes.length; i++) {
    console.log('  - ' + problemes[i]);
  }
  process.exitCode = 1;
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    process.argv[1].indexOf('dedup-contra-fitxers') !== -1) {
  principal();
}
