// ---------------------------------------------------------------------------
// PROTEGEIX PUBLICATS — PROTECCIÓ RETROACTIVA DE LES FILES JA PUBLICADES
//
// Eina d'UN SOL ÚS. Una sola feina: donar, retroactivament, a cada fila
// d'`events.json` que ja és publicada, la protecció que les publicacions noves
// ja tenen des del commit a6a9d8b: una fila `publicat` a `pendents.json` amb
// els tags `[ADT66 id: …]` a `nota_curador`, perquè la capa 1 de
// `eines/dedup-contra-fitxers.js` reconegui l'oferta i no la torni a encuar.
//
//   - PER DEFECTE NOMÉS INFORMA (execució en sec). Escriu un informe a
//     `Claude outputs/protegeix-publicats-sec-20261001.txt` i l'imprimeix.
//   - ESCRIU NOMÉS AMB `--escriu`, i només `pendents.json`, d'una sola
//     escriptura (`JSON.stringify(dades, null, 2)`).
//   - EL NIVELL A PER DESCRIPCIÓ (vegeu més avall) NO S'ESCRIU, ni amb
//     `--escriu`, si no hi ha també `--accepta-descripcio`.
//   - **`events.json` NO S'ESCRIU MAI DES D'AQUÍ.** Només es llegeix.
//   - No crida cap model ni cap altra API. L'única xarxa és la descàrrega del
//     flux ADT66, com fa la sincronització (`sincronitzaADT66('')`); el mapeig
//     és el de `mapejaOfertaADT66()`, sense cap còpia.
//
// QUINS ESTATS DE `pendents.json` TRACTA (§4 de CLAUDE.md ho exigeix declarat):
//
//   - `pendent`: les files amb tag `[ADT66 id: …]` són una font de candidates
//     (font 2) i, si queden vinculades a un esdeveniment protegit, s'ESBORREN.
//     El filtre és literalment `=== 'pendent'`, mai `!== 'rebutjat'`.
//   - `publicat`: es busca la fila amb el mateix `id` per afegir-hi els tags que
//     falten, o se'n crea una de nova.
//   - `rebutjat`: NO ES TOCA MAI. Només compta com a col·lisió d'`id`.
//   - Qualsevol altre estat: no es toca ni es llegeix com a candidata.
//
//
// --- LES TRES FONTS D'IDENTIFICADORS ---------------------------------------
//
//   1. L'HISTORIAL (`Claude outputs/ids-historial-20261001.json`):
//      `{ "<id d'events.json>": ["<id ADT66>", …] }`, o bé l'entrada és
//      `{ "ids": [...], "contradictori": true }`. Sempre nivell A, EXCEPTE els
//      contradictoris, que van al nivell B (origen «historial»).
//   2. LES FILES `pendent` AMB TAG de `pendents.json`.
//   3. LES OFERTES DEL FLUX, mapejades.
//
// Les fonts 2 i 3 només compten si hi ha coincidència de CONTINGUT:
//
//   NIVELL A  mateixa `data_inici`, mateix municipi (normalitzat com ho fa
//             `dedup-esdeveniments.js`) i mateixa `hora` NO buida, amb
//             correspondència ÚNICA en els dos sentits.
//   NIVELL B  mateixa `data_inici` i mateix municipi, però l'hora és diferent o
//             buida en algun costat, o la correspondència no és única.
//   Cap altra coincidència no compta.
//
// --- ELS FILTRES (1 d'octubre de 2026) -------------------------------------
//
//   Esdeveniments EXCLOSOS de la classificació (no generen cap cas, ni A ni B;
//   l'informe compta cada motiu per separat):
//     - `data_fi` anterior a avui (si `data_fi` és buida, compta `data_inici`).
//       Avui és la data LOCAL d'execució, AAAA-MM-DD.
//     - els que ja tenen a `pendents.json` una fila `publicat` amb el mateix `id`.
//   Ofertes del flux EXCLOSES de les unitats (font 3): les que tenen un
//   identificador ADT66 que ja és a la `nota_curador` de qualsevol fila de
//   `pendents.json`, sigui quin sigui l'estat (`extreuIdentificadors()`).
//
// --- EL NIVELL A PER DESCRIPCIÓ --------------------------------------------
//
//   Un cas que aniria al nivell B (hora diferent o buida, candidats múltiples)
//   passa a «nivell A per descripció» si la similitud entre la `descripcio_fr`
//   de l'esdeveniment i la de la unitat:
//     (a) arriba a LLINDAR_JA_PUBLICAT (0,75, el de la capa 2 de
//         `eines/dedup-contra-fitxers.js`, importat d'allà);
//     (b) només l'assoleix una unitat de l'esdeveniment, i
//     (c) la unitat no l'assoleix amb cap altre esdeveniment.
//   La similitud és la mateixa de la capa 2 (Jaccard sobre paraules
//   significatives, amb les paraules buides del francès), obtinguda cridant
//   `paraulesSignificatives()` i `similitudJaccard()` d'`eines/dedup-esdeveniments.js`.
//   Les col·lisions d'`id` el continuen bloquejant.
//   Cada línia del nivell B mostra la similitud de descripció (dos decimals).
//
// DECISIONS DE LECTURA (l'especificació no les concreta):
//
//   - UNA OFERTA I LA SEVA FILA PENDENT SÓN UN SOL CANDIDAT. Una fila `pendent`
//     amb tag ve del flux: si la comptéssim dues vegades (fila + oferta) cap
//     esdeveniment no tindria mai una «correspondència única». Els candidats
//     que comparteixen algun identificador es fusionen en una sola unitat.
//   - LA UNICITAT ES COMPTA SOBRE LA COINCIDÈNCIA DE DATA I MUNICIPI, no només
//     sobre la d'hora: si un esdeveniment té dos candidats al mateix poble el
//     mateix dia, encara que només un tingui la mateixa hora, no és únic i va al
//     nivell B. És el costat segur: B no escriu res si no ho accepta el
//     propietari.
//   - LA NORMALITZACIÓ DEL MUNICIPI no es reimplementa: es llegeix de la clau
//     forta que torna `comparaEsdeveniments()` (vegeu clauMunicipi()).
//   - UNA FILA PENDENT S'ESBORRA NOMÉS SI TOTS ELS SEUS TAGS ja són a una fila
//     protegida. Si només alguns ho són, es queda i es llista a l'informe.
//
// COL·LISIÓ D'ID (c). Si la fila nova xocaria amb un `id` que ja és a
// `pendents.json` amb estat `pendent` o `rebutjat` (i no hi ha cap fila
// `publicat` amb aquest id), l'esdeveniment passa al nivell B amb el motiu, no
// és acceptable amb `--nivell-b` i no s'escriu res per a ell. S'aplica contra el
// fitxer TAL COM ÉS, abans de cap esborrat d'aquesta mateixa passada: una fila
// `pendent` que s'esborraria igualment per vinculada també compta com a
// col·lisió (l'informe ho diu al motiu). Un `id` buit tampoc no es pot escriure.
//
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/protegeix-publicats.js                  -> execució en sec
//   node eines/protegeix-publicats.js --nivell-b=1,4,7 -> en sec, comptant-hi
//                                                         aquests casos del B
//   node eines/protegeix-publicats.js --escriu [--nivell-b=...]
//                                                      -> escriu pendents.json
//   node eines/protegeix-publicats.js --escriu --accepta-descripcio
//                                                      -> escriu també el nivell
//                                                         A per descripció
//   node eines/protegeix-publicats.js --autoprova      -> proves sintètiques
// ---------------------------------------------------------------------------


// --- El que ve de fora ------------------------------------------------------

var fs = require('fs');
var path = require('path');

var adt66 = require('./adt66-sincronitza.js');
var mapeig = require('./mapeja-adt66.js');
var dedup = require('./dedup-esdeveniments.js');
var identificador = require('./adt66-identificador.js');
var contraFitxers = require('./dedup-contra-fitxers.js');


// --- Constants --------------------------------------------------------------

var ARREL = path.join(__dirname, '..');
var RUTA_EVENTS = path.join(ARREL, 'events.json');
var RUTA_PENDENTS = path.join(ARREL, 'pendents.json');
var RUTA_HISTORIAL = path.join(ARREL, 'Claude outputs', 'ids-historial-20261001.json');
var RUTA_SORTIDA_SEC = path.join(ARREL, 'Claude outputs', 'protegeix-publicats-sec-20261001.txt');

// Els 17 camps públics, en l'ordre canònic del §4 de CLAUDE.md.
var CAMPS_PUBLICS = [
  'id', 'titol', 'data_inici', 'data_fi', 'hora', 'lloc', 'municipi', 'comarca',
  'categoria', 'descripcio_ca', 'descripcio_fr', 'associacio', 'imatge_url',
  'font_url', 'estat', 'data_entrada', 'periodicitat'
];

// Els 18 camps d'una fila de pendents.json: els 17 públics i `nota_curador`.
var CAMPS_FILA = CAMPS_PUBLICS.concat(['nota_curador']);

// El text que tanca la nota de les files creades.
var NOTA_RETROACTIVA = 'Protecció retroactiva 2026-10-01';

// Una data qualsevol, només per poder demanar la clau forta d'un municipi.
var DATA_REFERENCIA = '2000-01-01';

// El llindar de similitud de descripció: el mateix de la capa 2.
var LLINDAR_DESCRIPCIO = contraFitxers.LLINDAR_JA_PUBLICAT;

// L'ordre dels orígens a l'informe i a la numeració del nivell B.
var ORDRE_ORIGENS = ['historial', 'pendent', 'flux'];


// --- Les peces: valors i municipis ------------------------------------------

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
// Un valor com a cadena SENSE retallar, per copiar camps d'events.json tal qual.
// ------------------------------------------------------------
function copiaCadena(valor) {
  if (valor === null || valor === undefined) {
    return '';
  }
  return String(valor);
}

// ------------------------------------------------------------
// El municipi reduït a la forma normalitzada de dedup-esdeveniments.js, que no
// l'exporta: es llegeix de la clau forta («municipi|data») que torna
// comparaEsdeveniments() en comparar una fila amb ella mateixa. '' si no n'hi ha.
// ------------------------------------------------------------
function clauMunicipi(municipi) {
  var candidat = { fila: { data_inici: DATA_REFERENCIA, municipi: cadena(municipi) } };
  var comparacio = dedup.comparaEsdeveniments(candidat, candidat);

  if (comparacio.clau === '') {
    return '';
  }
  return comparacio.clau.slice(0, comparacio.clau.lastIndexOf('|'));
}


// --- Les peces: l'historial -------------------------------------------------

// ------------------------------------------------------------
// L'historial en una sola forma: { "<id>": { ids: [...], contradictori: bool } }.
// Accepta l'entrada com a llista o com a objecte { ids, contradictori }.
// ------------------------------------------------------------
function normalitzaHistorial(historial) {
  var resultat = {};
  var claus = Object.keys(historial || {});

  for (var i = 0; i < claus.length; i++) {
    var entrada = historial[claus[i]];
    var ids = [];
    var contradictori = false;

    if (Array.isArray(entrada)) {
      ids = entrada;
    } else if (entrada && Array.isArray(entrada.ids)) {
      ids = entrada.ids;
      contradictori = entrada.contradictori === true;
    }

    resultat[claus[i]] = { ids: ids.map(cadena).filter(nomesNoBuits), contradictori: contradictori };
  }

  return resultat;
}

// ------------------------------------------------------------
// Filtre per treure les cadenes buides d'una llista.
// ------------------------------------------------------------
function nomesNoBuits(valor) {
  return valor !== '';
}


// --- Les peces: les unitats candidates (fonts 2 i 3) ------------------------

// ------------------------------------------------------------
// Les files del flux, ja mapejades, amb la mateixa funció que la sincronització.
// ------------------------------------------------------------
function filesDelFlux(ofertes) {
  var llista = Array.isArray(ofertes) ? ofertes : [];
  var files = [];

  for (var i = 0; i < llista.length; i++) {
    files.push(mapeig.mapejaOfertaADT66(llista[i]).fila);
  }

  return files;
}

// ------------------------------------------------------------
// Una unitat candidata nova a partir d'una fila, amb els ids que li toquen.
// ------------------------------------------------------------
function creaUnitat(fila, ids, origen, indexPendent) {
  return {
    origen: origen,
    ids: ids.slice(),
    data: cadena(fila.data_inici),
    clau: clauMunicipi(fila.municipi),
    municipi: cadena(fila.municipi),
    hora: cadena(fila.hora),
    titol: cadena(fila.titol),
    descripcioFr: cadena(fila.descripcio_fr),
    indexosPendents: indexPendent === -1 ? [] : [indexPendent]
  };
}

// ------------------------------------------------------------
// L'índex de la unitat que ja porta algun dels ids donats, o -1.
// ------------------------------------------------------------
function trobaUnitat(unitats, ids) {
  for (var i = 0; i < unitats.length; i++) {
    for (var j = 0; j < ids.length; j++) {
      if (unitats[i].ids.indexOf(ids[j]) !== -1) {
        return i;
      }
    }
  }
  return -1;
}

// ------------------------------------------------------------
// Afegeix una unitat a la llista, o la fusiona amb la que comparteixi algun id.
// ------------------------------------------------------------
function afegeixUnitat(unitats, fila, ids, origen, indexPendent) {
  var existent = trobaUnitat(unitats, ids);

  if (existent === -1) {
    unitats.push(creaUnitat(fila, ids, origen, indexPendent));
    return;
  }

  var unitat = unitats[existent];
  if (unitat.descripcioFr === '') {
    unitat.descripcioFr = cadena(fila.descripcio_fr);
  }
  for (var i = 0; i < ids.length; i++) {
    if (unitat.ids.indexOf(ids[i]) === -1) {
      unitat.ids.push(ids[i]);
    }
  }
  if (indexPendent !== -1) {
    unitat.indexosPendents.push(indexPendent);
  }
}

// ------------------------------------------------------------
// Les unitats candidates: primer les files `pendent` amb tag (font 2), després
// les ofertes del flux (font 3) que no siguin ja una d'aquelles.
// ------------------------------------------------------------
function construeixUnitats(pendents, filesFlux) {
  var unitats = [];

  for (var i = 0; i < pendents.length; i++) {
    if (pendents[i].estat === 'pendent') {
      var ids = identificador.extreuIdentificadors(pendents[i].nota_curador);
      if (ids.length > 0) {
        afegeixUnitat(unitats, pendents[i], ids, 'pendent', i);
      }
    }
  }

  for (var j = 0; j < filesFlux.length; j++) {
    var idOferta = identificador.extreuIdentificador(filesFlux[j].nota_curador);
    if (idOferta !== null) {
      afegeixUnitat(unitats, filesFlux[j], [idOferta], 'flux', -1);
    }
  }

  return unitats;
}


// --- Les peces: els filtres i la similitud ----------------------------------

// ------------------------------------------------------------
// La data local d'execució, AAAA-MM-DD.
// ------------------------------------------------------------
function dataLocalAvui() {
  var ara = new Date();
  var mes = String(ara.getMonth() + 1);
  var dia = String(ara.getDate());

  if (mes.length < 2) {
    mes = '0' + mes;
  }
  if (dia.length < 2) {
    dia = '0' + dia;
  }
  return ara.getFullYear() + '-' + mes + '-' + dia;
}

// ------------------------------------------------------------
// El motiu pel qual un esdeveniment queda fora de la classificació: 'passat',
// 'ja-publicat' o '' si hi entra.
// ------------------------------------------------------------
function motiuDExclusio(esdeveniment, pendents, avui) {
  var ultimDia = cadena(esdeveniment.data_fi);
  var id = cadena(esdeveniment.id);

  if (ultimDia === '') {
    ultimDia = cadena(esdeveniment.data_inici);
  }
  if (ultimDia !== '' && ultimDia < avui) {
    return 'passat';
  }
  if (id !== '' && trobaPublicat(pendents, id) !== -1) {
    return 'ja-publicat';
  }
  return '';
}

// ------------------------------------------------------------
// Tots els identificadors ADT66 que apareixen a pendents.json, de qualsevol estat.
// ------------------------------------------------------------
function idsDeTotesLesFiles(pendents) {
  var ids = [];

  for (var i = 0; i < pendents.length; i++) {
    uneixIds(ids, identificador.extreuIdentificadors(pendents[i].nota_curador));
  }
  return ids;
}

// ------------------------------------------------------------
// Separa les ofertes del flux: les que es conserven i el recompte de les que ja
// tenen el seu identificador a alguna nota_curador de pendents.json.
// ------------------------------------------------------------
function filtraOfertesBloquejades(pendents, filesFlux) {
  var idsConeguts = idsDeTotesLesFiles(pendents);
  var files = [];
  var excloses = 0;

  for (var i = 0; i < filesFlux.length; i++) {
    var idOferta = identificador.extreuIdentificador(filesFlux[i].nota_curador);
    if (idOferta !== null && idsConeguts.indexOf(idOferta) !== -1) {
      excloses += 1;
    } else {
      files.push(filesFlux[i]);
    }
  }

  return { files: files, excloses: excloses };
}

// ------------------------------------------------------------
// La similitud (0..1) entre dues descripcions franceses; similitudJaccard i paraulesSignificatives vénen d'eines/dedup-esdeveniments.js i el llindar d'eines/dedup-contra-fitxers.js. 0 si alguna és buida.
// ------------------------------------------------------------
function similitudDescripcio(descripcioA, descripcioB) {
  var paraulesA = dedup.paraulesSignificatives(cadena(descripcioA), 'fr');
  var paraulesB = dedup.paraulesSignificatives(cadena(descripcioB), 'fr');

  if (paraulesA.length === 0 || paraulesB.length === 0) {
    return 0;
  }
  return dedup.similitudJaccard(paraulesA, paraulesB);
}

// ------------------------------------------------------------
// Les similituds de descripció d'un esdeveniment amb cada unitat coincident, en
// l'ordre de `coincidencies`.
// ------------------------------------------------------------
function similitudsDelsCandidats(esdeveniment, unitats, coincidencies) {
  var similituds = [];

  for (var i = 0; i < coincidencies.length; i++) {
    similituds.push(similitudDescripcio(esdeveniment.descripcio_fr, unitats[coincidencies[i]].descripcioFr));
  }
  return similituds;
}

// ------------------------------------------------------------
// Quants esdeveniments assoleixen el llindar de descripció amb cada unitat.
// ------------------------------------------------------------
function comptaSobreLlindarPerUnitat(coincidencies, similituds, quantesUnitats) {
  var comptes = [];
  var u;

  for (u = 0; u < quantesUnitats; u++) {
    comptes.push(0);
  }
  for (var i = 0; i < coincidencies.length; i++) {
    for (var j = 0; j < coincidencies[i].length; j++) {
      if (similituds[i][j] >= LLINDAR_DESCRIPCIO) {
        comptes[coincidencies[i][j]] += 1;
      }
    }
  }
  return comptes;
}

// ------------------------------------------------------------
// Quantes similituds d'una llista arriben al llindar de descripció.
// ------------------------------------------------------------
function comptaArriben(similituds) {
  var quantes = 0;

  for (var i = 0; i < similituds.length; i++) {
    if (similituds[i] >= LLINDAR_DESCRIPCIO) {
      quantes += 1;
    }
  }
  return quantes;
}

// ------------------------------------------------------------
// Diu si un candidat és nivell A per descripció: arriba al llindar, és l'únic de
// l'esdeveniment que hi arriba i cap altre esdeveniment no hi arriba amb ell.
// ------------------------------------------------------------
function protegitPerDescripcio(similituds, posicio, quantsEsdevenimentsSobreLlindar) {
  if (similituds[posicio] < LLINDAR_DESCRIPCIO) {
    return false;
  }
  if (comptaArriben(similituds) !== 1) {
    return false;
  }
  return quantsEsdevenimentsSobreLlindar === 1;
}


// --- Les peces: la classificació --------------------------------------------

// ------------------------------------------------------------
// Les posicions de les unitats que coincideixen amb l'esdeveniment en data i
// municipi (la clau forta). Sense data o sense municipi, cap.
// ------------------------------------------------------------
function unitatsCoincidents(esdeveniment, unitats) {
  var data = cadena(esdeveniment.data_inici);
  var clau = clauMunicipi(esdeveniment.municipi);
  var posicions = [];

  if (data === '' || clau === '') {
    return posicions;
  }

  for (var i = 0; i < unitats.length; i++) {
    if (unitats[i].data === data && unitats[i].clau === clau) {
      posicions.push(i);
    }
  }

  return posicions;
}

// ------------------------------------------------------------
// Per què una coincidència no és de nivell A. '' si ho és.
// ------------------------------------------------------------
function motiuDeNivellB(horaPublicada, unitat, quantsCandidats, quantsEsdeveniments) {
  var motius = [];

  if (horaPublicada === '' || unitat.hora === '') {
    motius.push('hora buida a algun costat');
  } else if (horaPublicada !== unitat.hora) {
    motius.push('hora diferent');
  }
  if (quantsCandidats > 1) {
    motius.push('l\'esdeveniment té ' + quantsCandidats + ' candidats');
  }
  if (quantsEsdeveniments > 1) {
    motius.push('el candidat coincideix amb ' + quantsEsdeveniments + ' esdeveniments');
  }

  return motius.join('; ');
}

// ------------------------------------------------------------
// Descriu la col·lisió d'id d'un esdeveniment amb pendents.json, o '' si no n'hi
// ha. Una fila `publicat` amb el mateix id no és col·lisió: és el cas (a).
// ------------------------------------------------------------
function descriuColisio(esdeveniment, pendents, idsDelCas) {
  var id = cadena(esdeveniment.id);
  var trobades = [];

  if (id === '') {
    return 'l\'esdeveniment no té id';
  }

  for (var i = 0; i < pendents.length; i++) {
    if (cadena(pendents[i].id) !== id) {
      continue;
    }
    if (pendents[i].estat === 'publicat') {
      return '';
    }
    if (pendents[i].estat === 'pendent' || pendents[i].estat === 'rebutjat') {
      trobades.push(pendents[i]);
    }
  }

  if (trobades.length === 0) {
    return '';
  }

  return 'l\'id ' + id + ' ja és a pendents.json amb estat «' + trobades[0].estat + '»' +
         notaDeVinculada(trobades[0], idsDelCas);
}

// ------------------------------------------------------------
// Una nota que diu si la fila amb què xoca és una pendent vinculada als ids del cas.
// ------------------------------------------------------------
function notaDeVinculada(fila, idsDelCas) {
  var idsFila = identificador.extreuIdentificadors(fila.nota_curador);

  for (var i = 0; i < idsFila.length; i++) {
    if (idsDelCas.indexOf(idsFila[i]) !== -1) {
      return ' (és una fila vinculada que s\'esborraria igualment; el fitxer es mira tal com és)';
    }
  }
  return '';
}

// ------------------------------------------------------------
// Afegeix a una llista els ids que encara no hi són.
// ------------------------------------------------------------
function uneixIds(llista, ids) {
  for (var i = 0; i < ids.length; i++) {
    if (llista.indexOf(ids[i]) === -1) {
      llista.push(ids[i]);
    }
  }
}

// ------------------------------------------------------------
// Classifica UN esdeveniment: els ids de nivell A (amb l'origen de cadascun) i
// els casos de nivell B. No sap res de col·lisions.
// ------------------------------------------------------------
function classificaEsdeveniment(posicio, esdeveniment, historial, unitats, coincidencies, quantsEsdeveniments, similituds, sobreLlindar) {
  var resultat = { idsHistorial: [], idsUnitats: [], idsDescripcio: [], items: [] };
  var id = cadena(esdeveniment.id);
  var entrada = id === '' ? null : historial[id];

  if (entrada && entrada.ids.length > 0) {
    if (entrada.contradictori) {
      resultat.items.push({
        esdeveniment: posicio, origen: 'historial', ids: entrada.ids.slice(),
        horaOferta: '', titolOferta: '', similitud: null, motiu: 'historial contradictori', acceptable: true
      });
    } else {
      uneixIds(resultat.idsHistorial, entrada.ids);
    }
  }

  var hora = cadena(esdeveniment.hora);

  for (var i = 0; i < coincidencies.length; i++) {
    var unitat = unitats[coincidencies[i]];
    var quantsDelCandidat = quantsEsdeveniments[coincidencies[i]];
    var motiu = motiuDeNivellB(hora, unitat, coincidencies.length, quantsDelCandidat);

    if (motiu === '') {
      uneixIds(resultat.idsUnitats, unitat.ids);
    } else if (protegitPerDescripcio(similituds, i, sobreLlindar[coincidencies[i]])) {
      uneixIds(resultat.idsDescripcio, unitat.ids);
    } else {
      resultat.items.push({
        esdeveniment: posicio, origen: unitat.origen, ids: unitat.ids.slice(),
        horaOferta: unitat.hora, titolOferta: unitat.titol, similitud: similituds[i],
        motiu: motiu, acceptable: true
      });
    }
  }

  return resultat;
}

// ------------------------------------------------------------
// Quants esdeveniments coincideixen amb cada unitat (data + municipi).
// ------------------------------------------------------------
function comptaEsdevenimentsPerUnitat(coincidenciesPerEsdeveniment, quantesUnitats) {
  var comptes = [];
  for (var u = 0; u < quantesUnitats; u++) {
    comptes.push(0);
  }
  for (var i = 0; i < coincidenciesPerEsdeveniment.length; i++) {
    for (var j = 0; j < coincidenciesPerEsdeveniment[i].length; j++) {
      comptes[coincidenciesPerEsdeveniment[i][j]] += 1;
    }
  }
  return comptes;
}

// ------------------------------------------------------------
// L'ordre estable del nivell B: esdeveniment, origen, ids.
// ------------------------------------------------------------
function comparaItems(a, b) {
  if (a.esdeveniment !== b.esdeveniment) {
    return a.esdeveniment - b.esdeveniment;
  }
  var ordreA = ORDRE_ORIGENS.indexOf(a.origen.split('+')[0]);
  var ordreB = ORDRE_ORIGENS.indexOf(b.origen.split('+')[0]);
  if (ordreA !== ordreB) {
    return ordreA - ordreB;
  }
  var idsA = a.ids.join(',') + '|' + a.motiu;
  var idsB = b.ids.join(',') + '|' + b.motiu;
  if (idsA < idsB) {
    return -1;
  }
  if (idsA > idsB) {
    return 1;
  }
  return 0;
}

// ------------------------------------------------------------
// L'origen d'un cas de nivell A, per a una col·lisió: «historial», «pendent»...
// ------------------------------------------------------------
function origenDelNivellA(resultat) {
  var origens = [];
  if (resultat.idsHistorial.length > 0) {
    origens.push('historial');
  }
  if (resultat.idsUnitats.length > 0) {
    origens.push('unitats');
  }
  if (resultat.idsDescripcio.length > 0) {
    origens.push('descripcio');
  }
  return origens.join('+');
}

// ------------------------------------------------------------
// Classifica tots els esdeveniments. Torna:
//   esdeveniments  [{ idsHistorial, idsUnitats, bloqueig }] un per fila d'events
//   nivellB        [{ numero, esdeveniment, origen, ids, horaOferta, titolOferta,
//                     motiu, acceptable }] numerat i en ordre estable
// `bloqueig` és el motiu de col·lisió ('' si no n'hi ha).
// ------------------------------------------------------------
function classifica(events, pendents, historialBrut, filesFlux, avui) {
  var historial = normalitzaHistorial(historialBrut);
  var flux = filtraOfertesBloquejades(pendents, filesFlux);
  var unitats = construeixUnitats(pendents, flux.files);
  var coincidencies = [];
  var similituds = [];
  var motiusExclusio = [];
  var exclosos = { passats: 0, jaPublicats: 0, ofertesBloquejades: flux.excloses };
  var i;

  for (i = 0; i < events.length; i++) {
    var motiuExclusio = motiuDExclusio(events[i], pendents, avui);
    motiusExclusio.push(motiuExclusio);
    if (motiuExclusio === 'passat') {
      exclosos.passats += 1;
    } else if (motiuExclusio === 'ja-publicat') {
      exclosos.jaPublicats += 1;
    }
    if (motiuExclusio === '') {
      coincidencies.push(unitatsCoincidents(events[i], unitats));
    } else {
      coincidencies.push([]);
    }
    similituds.push(similitudsDelsCandidats(events[i], unitats, coincidencies[i]));
  }

  var quantsEsdeveniments = comptaEsdevenimentsPerUnitat(coincidencies, unitats.length);
  var sobreLlindar = comptaSobreLlindarPerUnitat(coincidencies, similituds, unitats.length);
  var esdeveniments = [];
  var nivellB = [];

  for (i = 0; i < events.length; i++) {
    if (motiusExclusio[i] !== '') {
      esdeveniments.push({ idsHistorial: [], idsUnitats: [], idsDescripcio: [], bloqueig: '' });
      continue;
    }

    var resultat = classificaEsdeveniment(i, events[i], historial, unitats, coincidencies[i], quantsEsdeveniments, similituds[i], sobreLlindar);
    var idsA = resultat.idsHistorial.concat(resultat.idsUnitats);
    var idsBloquejables = idsA.slice();
    uneixIds(idsBloquejables, resultat.idsDescripcio);
    var idsDelCas = idsBloquejables.slice();
    var k;

    for (k = 0; k < resultat.items.length; k++) {
      uneixIds(idsDelCas, resultat.items[k].ids);
    }

    var bloqueig = '';
    if (idsDelCas.length > 0) {
      bloqueig = descriuColisio(events[i], pendents, idsDelCas);
    }

    if (bloqueig !== '' && idsBloquejables.length > 0) {
      resultat.items.push({
        esdeveniment: i, origen: origenDelNivellA(resultat), ids: idsBloquejables,
        horaOferta: '', titolOferta: '', similitud: null,
        motiu: 'Col·lisió d\'id (no acceptable): ' + bloqueig, acceptable: false
      });
      resultat.idsHistorial = [];
      resultat.idsUnitats = [];
      resultat.idsDescripcio = [];
    }

    if (bloqueig !== '') {
      for (k = 0; k < resultat.items.length; k++) {
        if (resultat.items[k].acceptable) {
          resultat.items[k].motiu += ' [no s\'escriuria encara que s\'acceptés: ' + bloqueig + ']';
          resultat.items[k].acceptable = false;
        }
      }
    }

    esdeveniments.push({
      idsHistorial: resultat.idsHistorial, idsUnitats: resultat.idsUnitats,
      idsDescripcio: resultat.idsDescripcio, bloqueig: bloqueig
    });
    nivellB = nivellB.concat(resultat.items);
  }

  nivellB.sort(comparaItems);
  for (i = 0; i < nivellB.length; i++) {
    nivellB[i].numero = i + 1;
  }

  return { esdeveniments: esdeveniments, nivellB: nivellB, unitats: unitats, exclosos: exclosos };
}


// --- Les peces: el pla d'escriptura -----------------------------------------

// ------------------------------------------------------------
// La posició de la primera fila `publicat` de pendents.json amb aquest id, o -1.
// ------------------------------------------------------------
function trobaPublicat(pendents, id) {
  for (var i = 0; i < pendents.length; i++) {
    if (pendents[i].estat === 'publicat' && cadena(pendents[i].id) === id) {
      return i;
    }
  }
  return -1;
}

// ------------------------------------------------------------
// Els ids protegits d'UN esdeveniment: nivell A més els casos de B acceptats.
// ------------------------------------------------------------
function idsProtegits(posicio, classificacio, acceptats, acceptaDescripcio) {
  var info = classificacio.esdeveniments[posicio];
  var ids = [];

  uneixIds(ids, info.idsHistorial);
  uneixIds(ids, info.idsUnitats);
  if (acceptaDescripcio === true) {
    uneixIds(ids, info.idsDescripcio);
  }

  for (var i = 0; i < classificacio.nivellB.length; i++) {
    var cas = classificacio.nivellB[i];
    if (cas.esdeveniment === posicio && cas.acceptable && acceptats.indexOf(cas.numero) !== -1) {
      uneixIds(ids, cas.ids);
    }
  }

  return ids;
}

// ------------------------------------------------------------
// Els tags d'una llista d'ids, separats per un espai.
// ------------------------------------------------------------
function tagsDe(ids) {
  var tags = [];
  for (var i = 0; i < ids.length; i++) {
    var tag = identificador.creaTagIdentificador(ids[i]);
    if (tag !== '') {
      tags.push(tag);
    }
  }
  return tags.join(' ');
}

// ------------------------------------------------------------
// La fila nova de pendents.json: els 17 camps públics de la fila d'events.json
// (els que hi falten, buits) més nota_curador, amb estat «publicat».
// ------------------------------------------------------------
function construeixFilaNova(esdeveniment, ids) {
  var fila = {};

  for (var i = 0; i < CAMPS_FILA.length; i++) {
    fila[CAMPS_FILA[i]] = copiaCadena(esdeveniment[CAMPS_FILA[i]]);
  }

  fila.estat = 'publicat';
  fila.nota_curador = dedup.ajuntaNotes(tagsDe(ids), NOTA_RETROACTIVA);
  return fila;
}

// ------------------------------------------------------------
// Quantes files d'events.json no tenen els 17 camps públics.
// ------------------------------------------------------------
function comptaFilesIncompletes(events) {
  var quantes = 0;

  for (var i = 0; i < events.length; i++) {
    for (var j = 0; j < CAMPS_PUBLICS.length; j++) {
      if (!Object.prototype.hasOwnProperty.call(events[i], CAMPS_PUBLICS[j])) {
        quantes += 1;
        break;
      }
    }
  }

  return quantes;
}

// ------------------------------------------------------------
// Afegeix els ids que falten a la llista d'un esdeveniment ja planificat.
// ------------------------------------------------------------
function planificaUnEsdeveniment(pla, pendents, esdeveniment, ids) {
  var id = cadena(esdeveniment.id);
  var creada = pla.creadesPerId[id];

  if (creada !== undefined) {
    uneixIds(pla.novesFiles[creada].ids, ids);
    return;
  }

  var posicio = trobaPublicat(pendents, id);

  if (posicio === -1) {
    pla.creadesPerId[id] = pla.novesFiles.length;
    pla.novesFiles.push({ esdeveniment: esdeveniment, ids: ids.slice() });
    return;
  }

  var jaTingudes = identificador.extreuIdentificadors(pendents[posicio].nota_curador);
  var faltants = [];
  for (var i = 0; i < ids.length; i++) {
    if (jaTingudes.indexOf(ids[i]) === -1) {
      faltants.push(ids[i]);
    }
  }
  if (faltants.length > 0) {
    pla.completades.push({ index: posicio, id: id, ids: faltants });
  } else {
    pla.jaProtegides += 1;
  }
}

// ------------------------------------------------------------
// Les posicions de les files `pendent` que queden vinculades (tots els seus tags
// protegits), i les que només ho són en part.
// ------------------------------------------------------------
function filesPendentsVinculades(pendents, idsGlobals) {
  var esborrables = [];
  var parcials = [];

  for (var i = 0; i < pendents.length; i++) {
    if (pendents[i].estat !== 'pendent') {
      continue;
    }
    var ids = identificador.extreuIdentificadors(pendents[i].nota_curador);
    var cobertes = 0;
    for (var j = 0; j < ids.length; j++) {
      if (idsGlobals.indexOf(ids[j]) !== -1) {
        cobertes += 1;
      }
    }
    if (ids.length > 0 && cobertes === ids.length) {
      esborrables.push(i);
    } else if (cobertes > 0) {
      parcials.push(i);
    }
  }

  return { esborrables: esborrables, parcials: parcials };
}

// ------------------------------------------------------------
// El pla complet: què es crearia, què es completaria, què s'esborraria i què
// s'ha acceptat que no es pot escriure. No toca res.
// ------------------------------------------------------------
function planifica(classificacio, events, pendents, acceptats, acceptaDescripcio) {
  var pla = {
    novesFiles: [], completades: [], creadesPerId: {}, jaProtegides: 0,
    esborrades: [], parcials: [], refusats: [],
    protegitsHistorial: 0, protegitsUnitats: 0, protegitsDescripcio: 0
  };
  var idsGlobals = [];
  var i;

  for (i = 0; i < events.length; i++) {
    var info = classificacio.esdeveniments[i];
    if (info.bloqueig !== '') {
      continue;
    }
    if (info.idsDescripcio.length > 0) {
      pla.protegitsDescripcio += 1;
    }
    var ids = idsProtegits(i, classificacio, acceptats, acceptaDescripcio);
    if (ids.length === 0) {
      continue;
    }
    if (info.idsHistorial.length > 0) {
      pla.protegitsHistorial += 1;
    } else if (info.idsUnitats.length > 0) {
      pla.protegitsUnitats += 1;
    }
    uneixIds(idsGlobals, ids);
    planificaUnEsdeveniment(pla, pendents, events[i], ids);
  }

  for (i = 0; i < classificacio.nivellB.length; i++) {
    var cas = classificacio.nivellB[i];
    if (acceptats.indexOf(cas.numero) !== -1 && !cas.acceptable) {
      pla.refusats.push(cas.numero);
    }
  }

  var vinculades = filesPendentsVinculades(pendents, idsGlobals);
  pla.esborrades = vinculades.esborrables;
  pla.parcials = vinculades.parcials;
  return pla;
}

// ------------------------------------------------------------
// Aplica el pla a una còpia de les files de pendents.json i la torna. No muta
// l'entrada.
// ------------------------------------------------------------
function aplicaPla(pendents, pla) {
  var copia = JSON.parse(JSON.stringify(pendents));
  var i;

  for (i = 0; i < pla.completades.length; i++) {
    var completada = pla.completades[i];
    var fila = copia[completada.index];
    fila.nota_curador = dedup.ajuntaNotes(fila.nota_curador, tagsDe(completada.ids));
  }

  var resultat = [];
  for (i = 0; i < copia.length; i++) {
    if (pla.esborrades.indexOf(i) === -1) {
      resultat.push(copia[i]);
    }
  }

  for (i = 0; i < pla.novesFiles.length; i++) {
    resultat.push(construeixFilaNova(pla.novesFiles[i].esdeveniment, pla.novesFiles[i].ids));
  }

  return resultat;
}


// --- Les peces: l'informe ---------------------------------------------------

// ------------------------------------------------------------
// Els grups de duplicats dins d'events.json (mateixa data, municipi i hora).
// ------------------------------------------------------------
function grupsDeDuplicats(events) {
  var grups = {};
  var ordre = [];

  for (var i = 0; i < events.length; i++) {
    var data = cadena(events[i].data_inici);
    var clau = clauMunicipi(events[i].municipi);
    if (data === '' || clau === '') {
      continue;
    }
    var marca = data + '|' + clau + '|' + cadena(events[i].hora);
    if (grups[marca] === undefined) {
      grups[marca] = [];
      ordre.push(marca);
    }
    grups[marca].push(events[i]);
  }

  var repetits = [];
  for (var j = 0; j < ordre.length; j++) {
    if (grups[ordre[j]].length > 1) {
      repetits.push({ marca: ordre[j], files: grups[ordre[j]] });
    }
  }
  return repetits;
}

// ------------------------------------------------------------
// Una línia de la llista del nivell B.
// ------------------------------------------------------------
function liniaDeNivellB(cas, events) {
  var esdeveniment = events[cas.esdeveniment];
  var hores = (cadena(esdeveniment.hora) || '-') + ' / ' + (cas.horaOferta || '-');

  return [
    cas.numero, cadena(esdeveniment.data_inici), cadena(esdeveniment.municipi), hores,
    cadena(esdeveniment.titol), cas.titolOferta || '-', cas.origen,
    'desc ' + (cas.similitud === null ? '-' : cas.similitud.toFixed(2)),
    cas.motiu + ' [ids: ' + cas.ids.join(', ') + ']'
  ].join(' | ');
}

// ------------------------------------------------------------
// L'informe en text de la passada: recomptes, nivell B i duplicats.
// ------------------------------------------------------------
function construeixInforme(events, pendents, classificacio, pla, acceptats, escriu, acceptaDescripcio) {
  var linies = [];
  var i;

  linies.push('PROTEGEIX PUBLICATS — ' + (escriu ? 'ESCRIPTURA' : 'EXECUCIÓ EN SEC'));
  linies.push('');
  linies.push('Files a events.json: ' + events.length + ' · files a pendents.json: ' + pendents.length);
  linies.push('Nivell B acceptats (--nivell-b): ' + (acceptats.length === 0 ? 'cap' : acceptats.join(',')));
  linies.push('Nivell A per descripció acceptat (--accepta-descripcio): ' + (acceptaDescripcio ? 'sí' : 'no'));
  linies.push('');
  linies.push('RECOMPTES');
  linies.push('  Esdeveniments protegits per l\'historial:               ' + pla.protegitsHistorial);
  linies.push('  Esdeveniments protegits pel nivell A (fonts 2 i 3):     ' + pla.protegitsUnitats);
  linies.push('  Esdeveniments protegits per descripció:                 ' + pla.protegitsDescripcio +
              (acceptaDescripcio ? '' : ' (no s\'escriuen sense --accepta-descripcio)'));
  linies.push('  Esdeveniments exclosos, ja passats:                     ' + classificacio.exclosos.passats);
  linies.push('  Esdeveniments exclosos, amb fila publicat a pendents:   ' + classificacio.exclosos.jaPublicats);
  linies.push('  Ofertes del flux excloses (id ja a pendents.json):      ' + classificacio.exclosos.ofertesBloquejades);
  linies.push('  Files pendents que s\'esborrarien:                      ' + pla.esborrades.length);
  linies.push('  Files publicat que es crearien:                         ' + pla.novesFiles.length);
  linies.push('  Files publicat existents que rebrien ids afegits:       ' + pla.completades.length);
  linies.push('  Files publicat existents ja protegides (res a fer):     ' + pla.jaProtegides);
  linies.push('  Files pendents amb tags només en part protegits (es queden): ' + pla.parcials.length);
  linies.push('  Files d\'events.json sense els 17 camps públics:         ' + comptaFilesIncompletes(events));
  linies.push('  Casos de nivell B:                                      ' + classificacio.nivellB.length);
  if (pla.refusats.length > 0) {
    linies.push('  ATENCIÓ: acceptats però no acceptables (col·lisió): ' + pla.refusats.join(','));
  }
  linies.push('');
  linies.push('NIVELL B (número | data | municipi | hora publicada / hora de l\'oferta | títol publicat | títol de l\'oferta o fila pendent | origen | similitud de descripció | motiu)');
  for (i = 0; i < classificacio.nivellB.length; i++) {
    linies.push(liniaDeNivellB(classificacio.nivellB[i], events));
  }
  if (classificacio.nivellB.length === 0) {
    linies.push('(cap)');
  }
  linies.push('');
  linies.push('DUPLICATS DINS D\'EVENTS.JSON (informatiu, cap acció)');
  var grups = grupsDeDuplicats(events);
  for (i = 0; i < grups.length; i++) {
    var titols = grups[i].files.map(titolIId).join(' ;; ');
    linies.push('  ' + grups[i].marca + ' (' + grups[i].files.length + '): ' + titols);
  }
  if (grups.length === 0) {
    linies.push('  (cap)');
  }

  return linies.join('\n') + '\n';
}

// ------------------------------------------------------------
// «títol (id)» d'una fila, per a la llista de duplicats.
// ------------------------------------------------------------
function titolIId(fila) {
  return cadena(fila.titol) + ' (' + cadena(fila.id) + ')';
}


// --- La passada -------------------------------------------------------------

// ------------------------------------------------------------
// Una passada sencera sobre dades ja llegides. `entrades` és { events, pendents,
// historial, filesFlux }; `opcions` és { escriu, acceptats, acceptaDescripcio, avui, escriuPendents }.
// `escriuPendents(files)` només es crida amb escriu cert, UNA sola vegada.
// ------------------------------------------------------------
function executaPassada(entrades, opcions) {
  var acceptats = opcions.acceptats || [];
  var acceptaDescripcio = opcions.acceptaDescripcio === true;
  var avui = opcions.avui || dataLocalAvui();
  var classificacio = classifica(entrades.events, entrades.pendents, entrades.historial, entrades.filesFlux, avui);
  var pla = planifica(classificacio, entrades.events, entrades.pendents, acceptats, acceptaDescripcio);
  var informe = construeixInforme(entrades.events, entrades.pendents, classificacio, pla, acceptats, opcions.escriu === true, acceptaDescripcio);

  if (opcions.escriu === true) {
    opcions.escriuPendents(aplicaPla(entrades.pendents, pla));
  }

  return { classificacio: classificacio, pla: pla, informe: informe };
}


// --- El que s'exporta -------------------------------------------------------

module.exports = {
  classifica: classifica,
  planifica: planifica,
  aplicaPla: aplicaPla,
  construeixFilaNova: construeixFilaNova,
  executaPassada: executaPassada,
  filesDelFlux: filesDelFlux
};


// --- Terminal: lectura, escriptura i arguments ------------------------------

// ------------------------------------------------------------
// Llegeix un fitxer JSON.
// ------------------------------------------------------------
function llegeixJson(cami) {
  try {
    return JSON.parse(fs.readFileSync(cami, 'utf8'));
  } catch (error) {
    throw new Error('no he pogut llegir ' + cami + ': ' + error.message);
  }
}

// ------------------------------------------------------------
// Escriu pendents.json sencer, d'una sola escriptura.
// ------------------------------------------------------------
function escriuPendentsAlDisc(files) {
  try {
    fs.writeFileSync(RUTA_PENDENTS, JSON.stringify(files, null, 2) + '\n', 'utf8');
  } catch (error) {
    throw new Error('no he pogut escriure pendents.json: ' + error.message);
  }
}

// ------------------------------------------------------------
// Els números de `--nivell-b=1,4,7`; llista buida si no hi és. Atura si n'hi ha
// algun que no és un enter positiu.
// ------------------------------------------------------------
function llegeixNivellB(args) {
  var valor = '';
  for (var i = 0; i < args.length; i++) {
    if (args[i].indexOf('--nivell-b=') === 0) {
      valor = args[i].slice('--nivell-b='.length);
    }
  }
  if (valor === '') {
    return [];
  }

  var numeros = [];
  var trossos = valor.split(',');
  for (var j = 0; j < trossos.length; j++) {
    var numero = Number(trossos[j]);
    if (!Number.isInteger(numero) || numero < 1) {
      throw new Error('--nivell-b: «' + trossos[j] + '» no és un número de la llista del nivell B.');
    }
    numeros.push(numero);
  }
  return numeros;
}

// ------------------------------------------------------------
// La passada real: llegeix els fitxers i el flux, i informa o escriu.
// ------------------------------------------------------------
async function passadaReal(args) {
  var escriu = args.indexOf('--escriu') !== -1;
  var acceptats = llegeixNivellB(args);
  var resposta;

  try {
    resposta = await adt66.sincronitzaADT66('');
  } catch (error) {
    throw new Error('no he pogut baixar el flux ADT66: ' + error.message);
  }

  var entrades = {
    events: llegeixJson(RUTA_EVENTS),
    pendents: llegeixJson(RUTA_PENDENTS),
    historial: llegeixJson(RUTA_HISTORIAL),
    filesFlux: filesDelFlux(resposta.ofertes)
  };
  var sortida = executaPassada(entrades, {
    escriu: escriu, acceptats: acceptats, escriuPendents: escriuPendentsAlDisc,
    acceptaDescripcio: args.indexOf('--accepta-descripcio') !== -1
  });

  console.log(sortida.informe);

  if (!escriu) {
    fs.writeFileSync(RUTA_SORTIDA_SEC, sortida.informe, 'utf8');
    console.log('Informe escrit a ' + RUTA_SORTIDA_SEC);
  } else {
    console.log('pendents.json escrit.');
  }
}


// --- Autoprova (dades sintètiques en memòria, cap xarxa, cap fitxer) --------

// Avui fix per a l'autoprova, perquè els resultats no depenguin del dia.
var AVUI_DE_PROVA = '2026-10-01';

// Una descripció francesa i una de molt diferent, per a les proves.
var DESCRIPCIO_BAL = 'Grand bal populaire avec orchestre et danses traditionnelles sur la place du village';
var DESCRIPCIO_ALTRA = 'Exposition photographique consacrée aux montagnes pyrénéennes et à leurs sentiers';

// ------------------------------------------------------------
// Una fila d'events.json sintètica, amb els 17 camps públics.
// ------------------------------------------------------------
function eventDeProva(id, titol, data, municipi, hora) {
  return {
    id: id, titol: titol, data_inici: data, data_fi: data, hora: hora, lloc: '',
    municipi: municipi, comarca: '', categoria: '', descripcio_ca: '', descripcio_fr: '',
    associacio: '', imatge_url: '', font_url: '', estat: 'publicat', data_entrada: '',
    periodicitat: ''
  };
}

// ------------------------------------------------------------
// Una fila de pendents.json sintètica (18 camps) amb tag opcional.
// ------------------------------------------------------------
function pendentDeProva(id, titol, data, municipi, hora, estat, idAdt) {
  var fila = eventDeProva(id, titol, data, municipi, hora);
  fila.estat = estat;
  fila.nota_curador = idAdt === '' ? '' : '[ADT66 id: ' + idAdt + '] Res a dir.';
  return fila;
}

// ------------------------------------------------------------
// Una passada en sec sobre dades de prova, sense cap escriptura.
// ------------------------------------------------------------
function passadaDeProva(events, pendents, historial, acceptats, filesFlux) {
  return executaPassada(
    { events: events, pendents: pendents, historial: historial, filesFlux: filesFlux || [] },
    { escriu: false, acceptats: acceptats || [], avui: AVUI_DE_PROVA }
  );
}

// ------------------------------------------------------------
// Un esdeveniment de prova amb descripció francesa.
// ------------------------------------------------------------
function eventAmbDescripcio(id, hora, descripcio) {
  var fila = eventDeProva(id, 'Ball', '2026-10-10', 'Prada', hora);
  fila.descripcio_fr = descripcio;
  return fila;
}

// ------------------------------------------------------------
// Una fila pendent de prova amb tag i descripció francesa.
// ------------------------------------------------------------
function pendentAmbDescripcio(id, hora, idAdt, descripcio) {
  var fila = pendentDeProva(id, 'BAL', '2026-10-10', 'Prada', hora, 'pendent', idAdt);
  fila.descripcio_fr = descripcio;
  return fila;
}

// ------------------------------------------------------------
// Els casos de l'autoprova: cadascun torna '' si va bé o el motiu si falla.
// ------------------------------------------------------------
function casosDAutoprova() {
  return [
    {
      nom: 'nivell A: data, municipi (dos noms) i hora iguals, correspondència única',
      comprova: function () {
        var events = [eventDeProva('2026-10-10-ball', 'Ball', '2026-10-10', 'Prats de Molló', '20:00')];
        var pendents = [pendentDeProva('x-ball', 'BAL', '2026-10-10', 'Prats-de-Mollo-la-Preste', '20:00', 'pendent', 'AAA')];
        var sortida = passadaDeProva(events, pendents, {});
        var nova = aplicaPla(pendents, sortida.pla);
        if (sortida.classificacio.nivellB.length !== 0) { return 'no hauria d\'haver cap cas de B'; }
        if (sortida.pla.novesFiles.length !== 1 || sortida.pla.esborrades.length !== 1) { return 'esperava 1 fila nova i 1 d\'esborrada'; }
        if (nova.length !== 1 || nova[0].estat !== 'publicat') { return 'esperava una sola fila publicat'; }
        if (nova[0].nota_curador !== '[ADT66 id: AAA] ' + NOTA_RETROACTIVA) { return 'nota inesperada: ' + nova[0].nota_curador; }
        return '';
      }
    },
    {
      nom: 'hora diferent: va al nivell B, i només s\'escriu si s\'accepta',
      comprova: function () {
        var events = [eventDeProva('2026-10-10-ball', 'Ball', '2026-10-10', 'Prada', '20:00')];
        var pendents = [pendentDeProva('x', 'BAL', '2026-10-10', 'Prada', '21:00', 'pendent', 'AAA')];
        var sec = passadaDeProva(events, pendents, {});
        if (sec.classificacio.nivellB.length !== 1) { return 'esperava 1 cas de B'; }
        if (sec.pla.novesFiles.length !== 0 || sec.pla.esborrades.length !== 0) { return 'sense acceptar no ha de planificar res'; }
        var acceptat = passadaDeProva(events, pendents, {}, [1]);
        if (acceptat.pla.novesFiles.length !== 1 || acceptat.pla.esborrades.length !== 1) { return 'acceptat el 1, esperava 1 nova i 1 esborrada'; }
        return '';
      }
    },
    {
      nom: 'correspondència doble: dos candidats per a un esdeveniment, tot a B',
      comprova: function () {
        var events = [eventDeProva('2026-10-10-ball', 'Ball', '2026-10-10', 'Prada', '20:00')];
        var pendents = [
          pendentDeProva('x1', 'BAL 1', '2026-10-10', 'Prada', '20:00', 'pendent', 'AAA'),
          pendentDeProva('x2', 'BAL 2', '2026-10-10', 'Prada', '20:00', 'pendent', 'BBB')
        ];
        var sortida = passadaDeProva(events, pendents, {});
        if (sortida.classificacio.nivellB.length !== 2) { return 'esperava 2 casos de B'; }
        if (sortida.pla.novesFiles.length !== 0) { return 'no s\'ha de crear res'; }
        return '';
      }
    },
    {
      nom: 'correspondència doble inversa: un candidat per a dos esdeveniments, tot a B',
      comprova: function () {
        var events = [
          eventDeProva('2026-10-10-ball', 'Ball', '2026-10-10', 'Prada', '20:00'),
          eventDeProva('2026-10-10-ball-bis', 'Ball bis', '2026-10-10', 'Prada', '20:00')
        ];
        var pendents = [pendentDeProva('x1', 'BAL', '2026-10-10', 'Prada', '20:00', 'pendent', 'AAA')];
        var sortida = passadaDeProva(events, pendents, {});
        if (sortida.classificacio.nivellB.length !== 2) { return 'esperava 2 casos de B'; }
        if (grupsDeDuplicats(events).length !== 1) { return 'esperava 1 grup de duplicats'; }
        return '';
      }
    },
    {
      nom: 'col·lisió d\'id: l\'id ja és a pendents.json com a rebutjat, va a B i no s\'escriu',
      comprova: function () {
        var events = [eventDeProva('2026-10-10-ball', 'Ball', '2026-10-10', 'Prada', '20:00')];
        var pendents = [
          pendentDeProva('2026-10-10-ball', 'Ball', '2026-10-10', 'Prada', '20:00', 'rebutjat', 'ZZZ'),
          pendentDeProva('x1', 'BAL', '2026-10-10', 'Prada', '20:00', 'pendent', 'AAA')
        ];
        var sortida = passadaDeProva(events, pendents, {}, [1]);
        if (sortida.classificacio.nivellB.length !== 1) { return 'esperava 1 cas de B'; }
        if (sortida.classificacio.nivellB[0].acceptable) { return 'la col·lisió no ha de ser acceptable'; }
        if (sortida.pla.novesFiles.length !== 0 || sortida.pla.esborrades.length !== 0) { return 'no s\'ha d\'escriure res'; }
        if (sortida.pla.refusats.length !== 1) { return 'acceptar-la s\'ha de refusar'; }
        if (aplicaPla(pendents, sortida.pla).length !== 2) { return 'la fila rebutjada no es pot tocar'; }
        return '';
      }
    },
    {
      nom: 'fila d\'events.json sense periodicitat: fila nova amb periodicitat "" i 18 camps',
      comprova: function () {
        var event = eventDeProva('2026-10-10-ball', 'Ball', '2026-10-10', 'Prada', '20:00');
        delete event.periodicitat;
        var sortida = passadaDeProva([event], [], { '2026-10-10-ball': ['AAA'] });
        var nova = aplicaPla([], sortida.pla);
        if (nova.length !== 1) { return 'esperava 1 fila nova'; }
        if (nova[0].periodicitat !== '') { return 'periodicitat ha de ser ""'; }
        if (Object.keys(nova[0]).join(',') !== CAMPS_FILA.join(',')) { return 'els 18 camps no són en ordre'; }
        if (comptaFilesIncompletes([event]) !== 1) { return 'esperava 1 fila incompleta'; }
        return '';
      }
    },
    {
      nom: 'historial: normal és nivell A i crea la fila publicat amb els ids; contradictori va a B',
      comprova: function () {
        var events = [
          eventDeProva('2026-10-10-ball', 'Ball', '2026-10-10', 'Prada', '20:00'),
          eventDeProva('2026-10-11-concert', 'Concert', '2026-10-11', 'Prada', '')
        ];
        var pendents = [];
        var historial = {
          '2026-10-10-ball': ['AAA', 'BBB'],
          '2026-10-11-concert': { ids: ['CCC'], contradictori: true }
        };
        var sortida = passadaDeProva(events, pendents, historial);
        if (sortida.pla.novesFiles.length !== 1 || sortida.pla.completades.length !== 0) { return 'esperava 1 fila nova i cap de completada'; }
        if (sortida.classificacio.nivellB.length !== 1 || sortida.classificacio.nivellB[0].origen !== 'historial') { return 'el contradictori ha d\'anar a B amb origen historial'; }
        var resultat = aplicaPla(pendents, sortida.pla);
        if (resultat[0].nota_curador.indexOf('[ADT66 id: AAA] [ADT66 id: BBB]') === -1) { return 'falten els tags AAA i BBB'; }
        return '';
      }
    },
    {
      nom: 'sense --escriu no s\'escriu res; amb --escriu s\'escriu una sola vegada; l\'entrada no es muta',
      comprova: function () {
        var events = [eventDeProva('2026-10-10-ball', 'Ball', '2026-10-10', 'Prada', '20:00')];
        var pendents = [pendentDeProva('x1', 'BAL', '2026-10-10', 'Prada', '20:00', 'pendent', 'AAA')];
        var abansEvents = JSON.stringify(events);
        var abansPendents = JSON.stringify(pendents);
        var crides = 0;
        var espia = function () { crides += 1; };
        var entrades = { events: events, pendents: pendents, historial: {}, filesFlux: [] };

        executaPassada(entrades, { escriu: false, acceptats: [], avui: AVUI_DE_PROVA, escriuPendents: espia });
        if (crides !== 0) { return 'en sec s\'ha escrit'; }
        executaPassada(entrades, { escriu: true, acceptats: [], avui: AVUI_DE_PROVA, escriuPendents: espia });
        if (crides !== 1) { return 'amb --escriu esperava 1 escriptura, n\'hi ha ' + crides; }
        if (JSON.stringify(events) !== abansEvents || JSON.stringify(pendents) !== abansPendents) { return 'les entrades han canviat'; }
        return '';
      }
    },
    {
      nom: 'esdeveniment passat: exclòs, cap cas ni A ni B, i es compta',
      comprova: function () {
        var events = [eventDeProva('2026-09-20-ball', 'Ball', '2026-09-20', 'Prada', '21:00')];
        var pendents = [pendentDeProva('x1', 'BAL', '2026-09-20', 'Prada', '20:00', 'pendent', 'AAA')];
        var sortida = passadaDeProva(events, pendents, {});
        if (sortida.classificacio.exclosos.passats !== 1) { return 'esperava 1 exclòs per passat'; }
        if (sortida.classificacio.nivellB.length !== 0) { return 'no ha de generar cap cas de B'; }
        if (sortida.pla.novesFiles.length !== 0) { return 'no s\'ha de crear res'; }
        return '';
      }
    },
    {
      nom: 'esdeveniment amb fila publicat al mateix id: exclòs i es compta',
      comprova: function () {
        var events = [eventDeProva('2026-10-10-ball', 'Ball', '2026-10-10', 'Prada', '20:00')];
        var pendents = [
          pendentDeProva('2026-10-10-ball', 'Ball', '2026-10-10', 'Prada', '20:00', 'publicat', 'AAA'),
          pendentDeProva('x1', 'BAL', '2026-10-10', 'Prada', '21:00', 'pendent', 'BBB')
        ];
        var sortida = passadaDeProva(events, pendents, { '2026-10-10-ball': ['CCC'] });
        if (sortida.classificacio.exclosos.jaPublicats !== 1) { return 'esperava 1 exclòs per publicat'; }
        if (sortida.classificacio.nivellB.length !== 0) { return 'no ha de generar cap cas de B'; }
        if (sortida.pla.novesFiles.length !== 0 || sortida.pla.completades.length !== 0) { return 'no s\'ha de planificar res'; }
        return '';
      }
    },
    {
      nom: 'oferta del flux amb l\'id en una fila rebutjat: exclosa de les unitats i es compta',
      comprova: function () {
        var events = [eventDeProva('2026-10-10-ball', 'Ball', '2026-10-10', 'Prada', '20:00')];
        var pendents = [pendentDeProva('x1', 'BAL', '2026-10-10', 'Prada', '20:00', 'rebutjat', 'AAA')];
        var oferta = pendentDeProva('', 'BAL', '2026-10-10', 'Prada', '20:00', 'pendent', 'AAA');
        var sortida = passadaDeProva(events, pendents, {}, [], [oferta]);
        if (sortida.classificacio.exclosos.ofertesBloquejades !== 1) { return 'esperava 1 oferta exclosa'; }
        if (sortida.classificacio.unitats.length !== 0) { return 'no hi ha d\'haver cap unitat'; }
        if (sortida.classificacio.nivellB.length !== 0) { return 'no ha de generar cap cas de B'; }
        return '';
      }
    },
    {
      nom: 'descripció igual i hora diferent: nivell A per descripció, escrit amb --accepta-descripcio',
      comprova: function () {
        var events = [eventAmbDescripcio('2026-10-10-ball', '20:00', DESCRIPCIO_BAL)];
        var pendents = [pendentAmbDescripcio('x1', '21:00', 'AAA', DESCRIPCIO_BAL)];
        var sortida = passadaDeProva(events, pendents, {});
        if (sortida.classificacio.nivellB.length !== 0) { return 'no hauria d\'haver cap cas de B'; }
        if (sortida.pla.protegitsDescripcio !== 1) { return 'esperava 1 protegit per descripció'; }
        if (sortida.pla.novesFiles.length !== 0) { return 'sense --accepta-descripcio no es planifica'; }
        var entrades = { events: events, pendents: pendents, historial: {}, filesFlux: [] };
        var acceptada = executaPassada(entrades, { escriu: false, acceptats: [], acceptaDescripcio: true, avui: AVUI_DE_PROVA });
        if (acceptada.pla.novesFiles.length !== 1 || acceptada.pla.esborrades.length !== 1) { return 'acceptada, esperava 1 nova i 1 esborrada'; }
        return '';
      }
    },
    {
      nom: 'dues unitats per sobre del llindar per al mateix esdeveniment: tot a B amb la similitud',
      comprova: function () {
        var events = [eventAmbDescripcio('2026-10-10-ball', '20:00', DESCRIPCIO_BAL)];
        var pendents = [
          pendentAmbDescripcio('x1', '21:00', 'AAA', DESCRIPCIO_BAL),
          pendentAmbDescripcio('x2', '22:00', 'BBB', DESCRIPCIO_BAL)
        ];
        var sortida = passadaDeProva(events, pendents, {});
        if (sortida.classificacio.nivellB.length !== 2) { return 'esperava 2 casos de B'; }
        if (sortida.pla.protegitsDescripcio !== 0) { return 'cap protegit per descripció'; }
        if (sortida.classificacio.nivellB[0].similitud !== 1) { return 'la similitud hauria de ser 1'; }
        if (sortida.informe.indexOf('desc 1.00') === -1) { return 'l\'informe no mostra la similitud'; }
        return '';
      }
    },
    {
      nom: 'nivell A per descripció amb --escriu però sense --accepta-descripcio: no s\'escriu',
      comprova: function () {
        var events = [eventAmbDescripcio('2026-10-10-ball', '20:00', DESCRIPCIO_BAL)];
        var pendents = [pendentAmbDescripcio('x1', '21:00', 'AAA', DESCRIPCIO_BAL)];
        var entrades = { events: events, pendents: pendents, historial: {}, filesFlux: [] };
        var escrit = null;
        var espia = function (files) { escrit = files; };
        var sortida = executaPassada(entrades, { escriu: true, acceptats: [], avui: AVUI_DE_PROVA, escriuPendents: espia });
        if (sortida.pla.protegitsDescripcio !== 1) { return 's\'havia de comptar 1 protegit per descripció'; }
        if (escrit === null || escrit.length !== 1 || escrit[0].estat !== 'pendent') { return 'la fila pendent s\'havia de quedar igual'; }
        if (escrit[0].nota_curador !== pendents[0].nota_curador) { return 'la nota no ha de canviar'; }
        return '';
      }
    }
  ];
}

// ------------------------------------------------------------
// Passa l'autoprova i en surt amb codi diferent de 0 si en falla algun cas.
// ------------------------------------------------------------
function autoprova() {
  var casos = casosDAutoprova();
  var fallades = 0;

  for (var i = 0; i < casos.length; i++) {
    var problema = casos[i].comprova();
    if (problema === '') {
      console.log('OK     ' + casos[i].nom);
    } else {
      console.log('FALLA  ' + casos[i].nom + ' -> ' + problema);
      fallades += 1;
    }
  }

  console.log('');
  console.log(casos.length - fallades + ' de ' + casos.length + ' casos OK.');
  if (fallades > 0) {
    process.exitCode = 1;
  }
}

// ------------------------------------------------------------
// El punt d'entrada des del terminal.
// ------------------------------------------------------------
async function principal() {
  var args = process.argv.slice(2);

  if (args.indexOf('--autoprova') !== -1) {
    autoprova();
    return;
  }

  try {
    await passadaReal(args);
  } catch (error) {
    console.error('ERROR: ' + error.message);
    process.exitCode = 1;
  }
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    process.argv[1].indexOf('protegeix-publicats') !== -1) {
  principal();
}
