// ---------------------------------------------------------------------------
// CRITERI EDITORIAL AUTOMÀTIC — OFERTES DE L'ADT66 QUE NO ENTREN MAI A LA CUA
//
// Una sola feina: aplicar a l'oferta CRUA del flux de l'ADT66 tot el criteri
// editorial automàtic de l'Action, en un sol mòdul i amb un sol veredicte per
// lot (aplicaCriteriAutomatic()). Res més. Són dues peces, en aquest ordre:
//
//   1. R4, la visita comentada (docs/CRITERI-EDITORIAL.md), amb els seus dos
//      rescats: la menció del català i «portes ouvertes».
//   2. La llista d'exclusions editorials ja decidides pel propietari
//      (EXCLUSIONS_EDITORIALS: el Cinema d'Elna, el tast comercial…).
//
//   - Sense estat ni cap efecte de fora. trobaExclusio() és pura: entra una
//     oferta, en surt l'entrada de la llista que l'atrapa o `null`. La
//     interfície de lot, en canvi, té un únic efecte: enganxa l'avís de rescat
//     a `nota_curador` de les files que R4 rescata. No crida cap API, no llegeix
//     ni escriu cap fitxer.
//   - NO posa cap `estat` a res. Una oferta descartada o exclosa simplement no
//     entra a `pendents.json` (ni, per tant, gasta cap crida a Gemini): és el
//     que fa eines/sincronitza-programada.js amb el que torna el lot.
//   - Mira camps del flux TAL COM ARRIBEN (`Commune`, `DETAILADRESSE`,
//     `RechercheTYPE`, `SyndicObjectName`, `DETAILDESCRIPTIF`, `COMMUNNOM`,
//     `ACCROCHE150`). Per això s'ha d'aplicar mentre es té l'oferta a sobre, i
//     no sobre la fila ja mapejada.
//
// PER QUÈ AQUÍ I PER QUÈ EN AQUEST ORDRE. El criteri va just darrere del
// mapeig, i no podria anar més tard: és l'ÚNIC lloc del camí on encara es té
// l'oferta crua, perquè la fusió de la deduplicació dins del lot construeix
// files noves que ja no la porten. I va ABANS de tota classificació perquè una
// oferta descartada o exclosa no ha de ser mai «ja rebutjada» ni «nova»: si la
// classificació la veiés primer, l'oferta del cinema d'Elna, que ja és a
// pendents.json com a rebutjada, sortiria com a ja_rebutjada i l'exclusió no
// s'aplicaria mai —es va veure en la primera passada en sec. El recompte del
// registre és així el de TOTES les ofertes del flux que hi cauen, sense mirar
// dates ni estat. L'ordre intern, R4 primer i la llista després, és el que el
// camí ha tingut sempre: una oferta que cauria a les dues es compta com a visita
// descartada, no com a exclosa. Com que el flux torna a oferir cada setmana
// les mateixes ofertes, cada setmana cauen igual.
//
// QUÈ NO ÉS AQUEST FITXER: no és el filtre previ (eines/filtra-candidats.js,
// que mira dates i soroll mecànic). És una llista de decisions editorials
// concretes, cadascuna amb el seu nom, el seu motiu i la data en què es va
// prendre, perquè qui obri el registre d'un run sàpiga per què una oferta no hi
// és, més la regla R4, que no és una llista sinó una regla amb dos rescats.
//
// PER AFEGIR-N'HI UNA A LA LLISTA: un objecte més a EXCLUSIONS_EDITORIALS, amb
// `nom`, `motiu`, `data` i `coincideix(oferta)`. La funció rep l'oferta crua i
// torna cert o fals; res més.
//
// Les comparacions de text de la llista són insensibles a majúscules, accents i
// puntuació (vegeu normalitzaPerExclusio()), perquè el flux escriu la mateixa
// adreça de maneres diferents («13, Bd Voltaire», «13 boulevard Voltaire»). Les
// d'R4 ho són també, però amb una normalització pròpia (normalitzaPerVisita()).
//
// Interfície per a qui crida: aplicaCriteriAutomatic(lot), amb `lot` =
// [{ oferta, fila, font }, ...] (els candidats mapejats). Retorna
// { passen, visitesDescartades, visitesRescatades, excloses }.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node -e "console.log(require('./eines/exclusions-editorials.js').EXCLUSIONS_EDITORIALS.length)"
// ---------------------------------------------------------------------------


// --- El que ve de fora ------------------------------------------------------

// Desfà l'HTML i les entitats d'un camp del flux («Lieu :», «&eacute;»…). Cap
// decisió editorial: només deixa el text llegible abans de comparar-lo.
var neteja = require('./neteja-text.js');

// La regla comuna d'encadenar notes, que R4 fa servir per enganxar l'avís de
// rescat darrere del tag [ADT66 id: …] sense trepitjar-lo.
var dedup = require('./dedup-esdeveniments.js');


// --- Constants: les paraules del tast comercial -----------------------------

// Fragments que diuen «tast» o «visita de celler» (subcadena, ja normalitzats).
var PARAULES_TAST = ['degust', 'visite de cave', 'visite de la cave', 'visite des caves', 'visite du domaine', 'caveau'];

// Llocs vinícoles, com a paraula sencera en singular o plural (ja normalitzats).
var PARAULES_LLOC_VINICOLA = ['domaine', 'cave', 'caveau', 'chateau', 'vignoble', 'cellier', 'vigneron'];

// Paraules de festa o d'espectacle al títol, com a paraula sencera en singular o plural (ja normalitzades): si n'hi ha una, l'oferta no s'exclou.
var PARAULES_FESTA = ['fete', 'festa', 'foire', 'fira', 'vendange', 'verema', 'festival', 'spectacle', 'theatre', 'scene', 'concert', 'conte'];


// --- Constants: la visita comentada (R4) ------------------------------------

// Els dos valors de `RechercheTYPE` que mou la regla d'aquí sota. Es comparen
// sobre el valor ja normalitzat —minúscules i sense accents—, perquè al flux
// venen «Visite guidée» i «Portes ouvertes» amb l'accent posat.
var TIPUS_VISITA_GUIADA = 'visite guidee';
var TIPUS_PORTES_OBERTES = 'portes ouvertes';

// Els tres camps del flux on es busca la menció del català. Són els que porten
// text lliure escrit per qui va entrar l'oferta; la resta o són codis interns o
// són el títol, que ve sempre en francès i en majúscules.
var CAMPS_DE_LLENGUA = ['DETAILDESCRIPTIF', 'COMMUNNOM', 'ACCROCHE150'];

// El senyal textual, un i prou. Sobre el text ja normalitzat, «catala» surt
// igualment de «català», de «catalan», de «catalane» i de «catalanes»: totes
// quatre comencen igual un cop tret l'accent. No enganxa «Catalogne», que
// segueix per o.
var SENYAL_CATALA = 'catala';

// Els dos avisos que s'enganxen darrere del tag [ADT66 id: …] quan una visita
// comentada es rescata. Diuen per quin dels dos motius s'ha quedat, perquè el
// curador pugui comprovar-ho: cap dels dos senyals no és una prova.
var AVIS_RESCAT_CATALA =
  'Visita comentada (R4): es queda perquè el text esmenta el català. Comprova que la visita es faci de debò en català.';
var AVIS_RESCAT_PORTES_OBERTES =
  'Visita comentada (R4): es queda perquè hi consta també «Portes ouvertes», que és obertura de patrimoni i no discurs. Comprova-ho.';


// --- Constants: la llista ---------------------------------------------------

// Les exclusions vigents. Una línia de comentari per entrada diu què fa.
var EXCLUSIONS_EDITORIALS = [
  {
    // Cinema d'Elna: l'oferta és d'Elna i l'adreça és la del cinema (13,
    // boulevard Voltaire). Només el lloc: una projecció d'un altre organitzador
    // a Elna, en una altra adreça, passa (decisió de Miquel, 6 d'octubre de 2026).
    nom: 'Cinema d\'Elna',
    motiu: 'criteri polític: exclusió per lloc (CRITERI-EDITORIAL.md)',
    data: '2026-10-01',
    coincideix: function (oferta) {
      if (normalitzaPerExclusio(valorDelFlux(oferta, 'Commune')) !== 'elne') {
        return false;
      }
      return adrecaDelCinemaDElna(oferta);
    }
  },
  {
    // Tast comercial: parla de tast o de visita de cel·ler (A), hi surt un lloc
    // vinícola com a paraula sencera (B) i el títol no és de festa (C).
    nom: 'Tast comercial',
    motiu: 'criteri editorial: activitat comercial, tastos i visites de caves (CRITERI-EDITORIAL.md)',
    data: '2026-10-01',
    coincideix: function (oferta) {
      var titol = normalitzaPerExclusio(valorDelFlux(oferta, 'SyndicObjectName'));
      var descripcio = normalitzaPerExclusio(valorDelFlux(oferta, 'DETAILDESCRIPTIF'));
      var tot = titol + ' ' + descripcio;

      if (!conteAlgunaSubcadena(tot, PARAULES_TAST)) {
        return false;
      }
      if (!conteAlgunaParaulaSencera(tot, PARAULES_LLOC_VINICOLA)) {
        return false;
      }
      return !conteAlgunaParaulaDeLlista(titol, PARAULES_FESTA);
    }
  }
];


// --- La interfície: el criteri editorial automàtic --------------------------

// Aplica tot el criteri editorial automàtic a un lot de {oferta, fila}: primer
// R4 (la visita comentada, amb els seus dos rescats), després la llista
// d'exclusions. Retorna { passen, visitesDescartades, visitesRescatades, excloses }.
function aplicaCriteriAutomatic(lot) {
  var visites = apartaVisitesGuiades(lot);
  var exclusio = aplicaExclusionsEditorials(visites.passen);
  return {
    passen: exclusio.passen,
    visitesDescartades: visites.descartades,
    visitesRescatades: visites.rescatades,
    excloses: exclusio.excloses
  };
}




// --- Les peces: la visita comentada (R4) ------------------------------------
// Aquesta secció fa UNA regla editorial i prou, i és l'única del fitxer que no
// és una entrada de la llista d'exclusions. No és
// el filtre previ: filtraCandidats() mira dates i soroll mecànic i no sap res
// de criteri. Això és R4 de docs/CRITERI-EDITORIAL.md, aplicada de la manera
// més estreta possible —només al valor «Visite guidée» de `RechercheTYPE`— i
// escrita a part perquè es vegi que hi és i es pugui treure d'una peça.
//
// R4 diu: una visita comentada és DISCURS, i per tant queda fora si no es fa
// en català. El problema pràctic és que el flux de l'ADT66 no declara enlloc la
// llengua de l'acte: no hi ha cap camp que ho digui. Per tant no es pot
// comprovar, i la regla s'aplica al revés —una visita que no esmenta enlloc el
// català es dona per francesa i queda fora.
//
// I es rescata per dos motius, tots dos de la mateixa R4:
//
//   (a) el text esmenta el català. És el senyal que hi ha, i és feble: dir
//       «catalane» dins d'una descripció no vol dir que la visita es faci en
//       català. Per això la fila rescatada entra amb un avís que demana al
//       curador que ho comprovi.
//   (b) l'oferta porta TAMBÉ «Portes ouvertes». És l'excepció literal d'R4:
//       una OBERTURA de patrimoni no és discurs.
//
// PER QUÈ AQUESTA REGLA SÍ QUE DESCARTA, quan a tot arreu el biaix del projecte
// és encuar. El §4 ter de CLAUDE.md diu «si dubtes, ENCUA», i és per a la
// deduplicació: allà el dubte és sobre si un acte JA HI ÉS, i equivocar-se vol
// dir perdre un acte que ningú no ha vist mai. Aquí el dubte no hi és: R4 és una
// decisió ja presa pel propietari sobre una classe sencera d'actes, i el que es
// descarta no és un acte desconegut sinó una visita comentada en francès, que el
// criteri diu que no ha d'entrar. La memòria de rebuig del §4 no hi perd res:
// aquestes ofertes no arriben mai a `pendents.json`, o sigui que no hi ha cap
// rebuig a recordar —el flux les tornarà a oferir cada setmana i cada setmana
// cauran igual, que és exactament el que ha de passar.

// ------------------------------------------------------------
// Aparta del lot les visites comentades que R4 deixa fora, i deixa passar les
// que rescata. Torna tres coses:
//
//   passen       [{ fila, font, oferta }, ...]  el lot que continua el camí
//   descartades  [{ titol }, ...]               les que no hi entren
//   rescatades   [{ titol, motiu }, ...]        les que s'hi queden, i per què
//
// `motiu` és 'menció del català' o 'portes obertes'. Es miren en aquest ordre i
// el primer que enganxa és el que es diu: una oferta que compleixi els dos surt
// com a 'menció del català', que és el senyal més fort dels dos.
//
// La fila rescatada surt amb un avís enganxat DARRERE del que ja portés, que és
// sempre el tag [ADT66 id: …] del mapeig (§«La nota del curador» de
// eines/mapeja-adt66.js: el tag va primer). S'ajunta amb la regla compartida
// d'encadenar notes, no amb una concatenació a mà.
// ------------------------------------------------------------
function apartaVisitesGuiades(entrants) {
  var llista = Array.isArray(entrants) ? entrants : [];
  var passen = [];
  var descartades = [];
  var rescatades = [];

  for (var i = 0; i < llista.length; i++) {
    var candidat = llista[i];

    if (!esVisitaGuiada(candidat.oferta)) {
      passen.push(candidat);
      continue;
    }

    var motiu = motiuDeRescat(candidat.oferta);

    if (motiu === '') {
      descartades.push({ titol: candidat.fila.titol });
      continue;
    }

    candidat.fila.nota_curador = dedup.ajuntaNotes(
      candidat.fila.nota_curador, avisDeRescat(motiu)
    );
    rescatades.push({ titol: candidat.fila.titol, motiu: motiu });
    passen.push(candidat);
  }

  return { passen: passen, descartades: descartades, rescatades: rescatades };
}

// ------------------------------------------------------------
// Diu si una oferta del flux és una visita comentada, mirant `RechercheTYPE`.
// ------------------------------------------------------------
function esVisitaGuiada(oferta) {
  return tipusDeLoferta(oferta).indexOf(TIPUS_VISITA_GUIADA) !== -1;
}

// ------------------------------------------------------------
// El motiu pel qual una visita comentada es rescata, o '' si no se'n rescata
// cap. Els dos motius es miren en ordre i el primer que enganxa mana.
// ------------------------------------------------------------
function motiuDeRescat(oferta) {
  if (esmentaElCatala(oferta)) {
    return 'menció del català';
  }

  if (tipusDeLoferta(oferta).indexOf(TIPUS_PORTES_OBERTES) !== -1) {
    return 'portes obertes';
  }

  return '';
}

// ------------------------------------------------------------
// L'avís que li toca a cada motiu de rescat. Una sola feina: triar el text.
// ------------------------------------------------------------
function avisDeRescat(motiu) {
  if (motiu === 'menció del català') {
    return AVIS_RESCAT_CATALA;
  }

  return AVIS_RESCAT_PORTES_OBERTES;
}

// ------------------------------------------------------------
// Els valors de `RechercheTYPE` d'una oferta, normalitzats i un per un. Es
// parteix per comes, igual que fa eines/mapeja-adt66.js, i amb el mateix efecte
// lateral conegut: dos valors del vocabulari de l'ADT66 porten una coma a dins
// («Projection, cinéma» i «Randonnée, balade») i es parteixen per la meitat. No
// molesta aquí: cap dels dos valors que aquesta regla mira no en porta.
// ------------------------------------------------------------
function tipusDeLoferta(oferta) {
  var brut = '';
  if (oferta && typeof oferta.RechercheTYPE === 'string') {
    brut = oferta.RechercheTYPE;
  }

  var trossos = brut.split(',');
  var tipus = [];

  for (var i = 0; i < trossos.length; i++) {
    var net = normalitzaPerVisita(trossos[i]);
    if (net !== '') {
      tipus.push(net);
    }
  }

  return tipus;
}

// ------------------------------------------------------------
// Diu si algun dels tres camps de text lliure de l'oferta esmenta el català. El
// text es passa primer per netejaTextFont(), que desfà l'HTML i les entitats: al
// flux «català» arriba escrit «catal&agrave;», i sense desfer l'entitat el
// senyal no s'hi veuria.
// ------------------------------------------------------------
function esmentaElCatala(oferta) {
  if (!oferta) {
    return false;
  }

  for (var i = 0; i < CAMPS_DE_LLENGUA.length; i++) {
    var brut = oferta[CAMPS_DE_LLENGUA[i]];

    if (typeof brut === 'string' && brut !== '') {
      var text = normalitzaPerVisita(neteja.netejaTextFont(brut));
      if (text.indexOf(SENYAL_CATALA) !== -1) {
        return true;
      }
    }
  }

  return false;
}

// ------------------------------------------------------------
// Un text reduït a lletres comparables: minúscules, sense accents, i tot el que
// no sigui lletra o xifra convertit en un sol espai. És la mateixa normalització
// que fa eines/filtra-candidats.js, i a posta: dues peces que comparen text del
// mateix flux l'han de comparar igual. NO és normalitzaPerExclusio(): aquella
// també converteix «bd» en «boulevard» (per a les adreces) i no es pot compartir
// sense canviar què compara R4 (el tipus i el català, on «bd» no vol dir res).
// ------------------------------------------------------------
function normalitzaPerVisita(text) {
  if (typeof text !== 'string' || text === '') {
    return '';
  }

  var net = text.toLowerCase();
  net = net.normalize('NFD').replace(/[̀-ͯ]/g, '');
  net = net.replace(/[^a-z0-9]+/g, ' ');

  return net.trim();
}


// --- Les peces: les exclusions editorials sobre un lot ----------------------

// ------------------------------------------------------------
// Treu dels candidats mapejats (els que encara porten l'oferta crua) els que una
// exclusió editorial deixa fora (EXCLUSIONS_EDITORIALS). Un candidat
// sense oferta (les proves en fan) no s'exclou mai.
//
// No posa cap estat a res: l'exclosa no entra. Torna dues coses:
//
//   passen   [candidat, ...]            el que continua el camí
//   excloses [{ nom, id, titol }, ...]  les que queden fora: nom de l'entrada,
//                                       SyndicObjectID de l'oferta i títol
// ------------------------------------------------------------
function aplicaExclusionsEditorials(candidats) {
  var llista = Array.isArray(candidats) ? candidats : [];
  var passen = [];
  var excloses = [];

  for (var i = 0; i < llista.length; i++) {
    var entrada = trobaExclusio(llista[i].oferta);

    if (entrada === null) {
      passen.push(llista[i]);
    } else {
      excloses.push({
        nom: entrada.nom,
        id: String(llista[i].oferta.SyndicObjectID || ''),
        titol: llista[i].fila.titol
      });
    }
  }

  return { passen: passen, excloses: excloses };
}


// --- La funció --------------------------------------------------------------

// ------------------------------------------------------------
// L'entrada de EXCLUSIONS_EDITORIALS que atrapa una oferta crua, o `null` si no
// n'atrapa cap. Si en n'atrapessin dues, mana la primera de la llista.
// ------------------------------------------------------------
function trobaExclusio(oferta) {
  if (!oferta || typeof oferta !== 'object') {
    return null;
  }

  for (var i = 0; i < EXCLUSIONS_EDITORIALS.length; i++) {
    if (EXCLUSIONS_EDITORIALS[i].coincideix(oferta)) {
      return EXCLUSIONS_EDITORIALS[i];
    }
  }

  return null;
}


// --- La peça del Cinema d'Elna ----------------------------------------------

// ------------------------------------------------------------
// Diu si `DETAILADRESSE` porta l'adreça del cinema: «13 boulevard Voltaire». El
// «bd» es llegeix com a «boulevard» (vegeu normalitzaPerExclusio()), de manera
// que «13, Bd Voltaire» també coincideix.
// ------------------------------------------------------------
function adrecaDelCinemaDElna(oferta) {
  var adreca = normalitzaPerExclusio(valorDelFlux(oferta, 'DETAILADRESSE'));
  return conteExpressio(adreca, '13 boulevard voltaire');
}


// --- Les peces: neteja i comparació de text ---------------------------------

// ------------------------------------------------------------
// El valor d'un camp de l'oferta crua, net d'HTML i d'entitats, o '' si el camp
// no hi és o no és text.
// ------------------------------------------------------------
function valorDelFlux(oferta, camp) {
  if (!oferta || typeof oferta[camp] !== 'string') {
    return '';
  }

  return neteja.netejaTextFont(oferta[camp]);
}

// ------------------------------------------------------------
// Un text reduït a paraules comparables: minúscules, sense accents, tot el que
// no és lletra o xifra convertit en un sol espai, i la paraula «bd» llegida com
// a «boulevard». És la normalització de filtra-candidats.js amb aquest afegit per
// a les adreces; la de la visita comentada és normalitzaPerVisita(), sense l'afegit.
// ------------------------------------------------------------
function normalitzaPerExclusio(text) {
  if (typeof text !== 'string' || text === '') {
    return '';
  }

  var net = text.toLowerCase();
  net = net.normalize('NFD').replace(/[̀-ͯ]/g, '');
  net = net.replace(/[^a-z0-9]+/g, ' ').trim();
  net = (' ' + net + ' ').replace(/ bd /g, ' boulevard ');

  return net.trim();
}

// ------------------------------------------------------------
// Diu si un text ja normalitzat conté una expressió sencera, paraula per
// paraula: «113 boulevard voltaire» no conté «13 boulevard voltaire».
// ------------------------------------------------------------
function conteExpressio(text, expressio) {
  return (' ' + text + ' ').indexOf(' ' + expressio + ' ') !== -1;
}

// ------------------------------------------------------------
// Diu si un text normalitzat conté, com a subcadena, algun element de la llista.
// ------------------------------------------------------------
function conteAlgunaSubcadena(text, llista) {
  for (var i = 0; i < llista.length; i++) {
    if (text.indexOf(llista[i]) !== -1) {
      return true;
    }
  }
  return false;
}

// ------------------------------------------------------------
// Diu si un text normalitzat conté, com a paraula sencera, algun element de la
// llista, tal qual o en plural (+s): «cave» i «caves», però no «cavernes».
// ------------------------------------------------------------
function conteAlgunaParaulaSencera(text, llista) {
  var paraules = text.split(' ');

  for (var i = 0; i < paraules.length; i++) {
    for (var j = 0; j < llista.length; j++) {
      if (paraules[i] === llista[j] || paraules[i] === llista[j] + 's') {
        return true;
      }
    }
  }

  // «chateaux» és el plural de «chateau», que no segueix la regla del +s.
  return paraules.indexOf('chateaux') !== -1;
}


// ------------------------------------------------------------
// Diu si un text normalitzat conté, com a paraula sencera, algun element de la
// llista, tal qual o en plural (+s): «conte» i «contes», però no «bisconte».
// ------------------------------------------------------------
function conteAlgunaParaulaDeLlista(text, llista) {
  var paraules = text.split(' ');

  for (var i = 0; i < paraules.length; i++) {
    for (var j = 0; j < llista.length; j++) {
      if (paraules[i] === llista[j] || paraules[i] === llista[j] + 's') {
        return true;
      }
    }
  }

  return false;
}


// --- El que surt d'aquest fitxer --------------------------------------------

module.exports = {
  EXCLUSIONS_EDITORIALS: EXCLUSIONS_EDITORIALS,
  PARAULES_TAST: PARAULES_TAST,
  PARAULES_LLOC_VINICOLA: PARAULES_LLOC_VINICOLA,
  PARAULES_FESTA: PARAULES_FESTA,
  conteAlgunaSubcadena: conteAlgunaSubcadena,
  conteAlgunaParaulaSencera: conteAlgunaParaulaSencera,
  trobaExclusio: trobaExclusio,
  normalitzaPerExclusio: normalitzaPerExclusio,
  aplicaCriteriAutomatic: aplicaCriteriAutomatic
};
