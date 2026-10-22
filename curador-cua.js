// ---------------------------------------------------------------------------
// CURADOR-CUA — com canvia l'estat de la cua
//
// Les peces que decideixen què passa amb una fila quan el curador la publica
// o la rebutja, i res més: cap DOM, cap xarxa, cap variable global de la
// pàgina. Cada peça rep dades i en torna de noves; les que canvien un fitxer
// tornen una TRANSFORMACIÓ (una funció que rep la llista llegida i en torna la
// llista nova), que és el que `desaAmbReintent()` de `curador.html` espera.
//
// PER QUÈ VIU AQUÍ I NO DINS DE `curador.html`. Perquè Node no pot obrir un
// HTML. Dins de l'HTML aquest codi només es podia provar carregant la pàgina
// sencera amb un document fals; aquí es prova per la seva interfície
// (`proves/curador-cua.test.js`). Els dos camins de càrrega són el mateix
// fitxer, sense còpies:
//
//   navegador   <script src="curador-cua.js"> abans del <script> de la pàgina;
//               les funcions i les constants queden com a globals
//   Node        require('./curador-cua.js'), per `module.exports` del final
//
// QUÈ NO HI ÉS, a posta: l'ordre de les dues escriptures de `publica()`
// (events.json primer, pendents.json després), els missatges a la pantalla i
// `recullFitxa()`, que llegeix els camps del DOM. Tot això és de la pàgina.
//
// Les regles del §4 de CLAUDE.md que aquest fitxer fa complir:
//   - Rebutjar no suprimeix la fila: li canvia l'estat i la deixa on és.
//   - Publicar tampoc: la fila de pendents.json es SUBSTITUEIX a la mateixa
//     posició per la publicada (estat «publicat», nota_curador intacta).
//   - La cua només pinta `estat === 'pendent'`, literalment això.
//   - Una fila de pendents.json en porta divuit camps; una d'events.json, disset.
// ---------------------------------------------------------------------------


// --- Constants --------------------------------------------------------------

// El text exacte de l'error quan una fila ja no és a la cua. Es compara
// literalment a publica(), que és l'únic cas on això no és greu.
var JA_NO_HI_ES = 'La fila ja no era a la cua.';

// El començament del text de l'error quan l'id que es vol publicar ja
// és a events.json. Porta l'id enganxat al final, i publica() el
// reconeix per aquest començament.
var JA_PUBLICAT = 'Aquest acte ja estava publicat, no s’ha duplicat.';


// --- La cua en pantalla -----------------------------------------------------

// ------------------------------------------------------------
// Tria de pendents.json les files que van a la cua. Explícitament només
// 'pendent', no «tot menys rebutjat»: les files rebutjades i les publicades
// continuen al fitxer (memòria de rebuig, tag [ADT66 id: …]) i no han de
// tornar a la cua, ni tampoc cap estat que no coneguem.
// ------------------------------------------------------------
function filesPendents(dades) {
  return dades.filter(function (fila) {
    return fila.estat === 'pendent';
  });
}

// ------------------------------------------------------------
// Torna la cua sense la fila donada, comparant-la sencera. Treu TOTES les
// coincidències exactes, no només la primera: és la cua en pantalla, no el
// fitxer, i una fila idèntica repetida surt de la pantalla amb la mateixa.
// ------------------------------------------------------------
function treuDeLaCua(cua, original) {
  var agulla = JSON.stringify(original);
  return cua.filter(function (fila) {
    return JSON.stringify(fila) !== agulla;
  });
}


// --- Retrobar una fila al fitxer fresc --------------------------------------

// ------------------------------------------------------------
// Retroba una fila dins d'una cua acabada de llegir, comparant-la
// sencera. Torna la posició, o -1 si ja no hi és (algú altre l'ha
// tocada mentrestant).
// ------------------------------------------------------------
function trobaIndex(cua, original) {
  var agulla = JSON.stringify(original);
  for (var i = 0; i < cua.length; i++) {
    if (JSON.stringify(cua[i]) === agulla) {
      return i;
    }
  }
  return -1;
}

// ------------------------------------------------------------
// Diu si un identificador ja és a la llista d'actes publicats. Un id
// buit (un acte sense data d'inici) no compta: no identifica ningú, i
// tots els actes sense data el compartirien.
// ------------------------------------------------------------
function idJaPublicat(events, id) {
  if (id === '') {
    return false;
  }

  for (var i = 0; i < events.length; i++) {
    if (events[i].id === id) {
      return true;
    }
  }
  return false;
}


// --- Publicar ---------------------------------------------------------------

// ------------------------------------------------------------
// Torna una transformació que afegeix l'acte al final d'events.json amb
// estat «publicat». Si l'id ja hi és, peta amb JA_PUBLICAT + l'id: val més
// aturar-se que duplicar. La comprovació va DINS de la transformació, sobre
// la llista acabada de llegir, perquè el reintent de conflicte de sha la
// torna a fer sobre el fitxer fresc i no s'escriu res si algú altre ha
// publicat l'acte mentrestant.
//
// L'acte s'escriu com a còpia: l'objecte editat de la pàgina no es toca.
// ------------------------------------------------------------
function afegeixAPublicats(editat) {
  return function (events) {
    if (idJaPublicat(events, editat.id)) {
      throw new Error(JA_PUBLICAT + ' Identificador: ' + editat.id + '.');
    }

    var publicat = JSON.parse(JSON.stringify(editat));
    publicat.estat = 'publicat';
    return events.concat([publicat]);
  };
}

// ------------------------------------------------------------
// Construeix la fila de pendents.json d'un acte publicat: els 17 camps
// editats més la nota_curador de l'original, intacta (no és editable i
// no passa per recullFitxa). Divuit camps, tots cadenes, en l'ordre del §4.
// ------------------------------------------------------------
function creaFilaPublicada(editat, original) {
  var nota = '';
  if (typeof original.nota_curador === 'string') {
    nota = original.nota_curador;
  }

  return {
    id: editat.id,
    titol: editat.titol,
    data_inici: editat.data_inici,
    data_fi: editat.data_fi,
    hora: editat.hora,
    lloc: editat.lloc,
    municipi: editat.municipi,
    comarca: editat.comarca,
    categoria: editat.categoria,
    descripcio_ca: editat.descripcio_ca,
    descripcio_fr: editat.descripcio_fr,
    associacio: editat.associacio,
    imatge_url: editat.imatge_url,
    font_url: editat.font_url,
    estat: 'publicat',
    data_entrada: editat.data_entrada,
    periodicitat: editat.periodicitat,
    nota_curador: nota
  };
}

// ------------------------------------------------------------
// Torna una transformació que substitueix una fila de la cua, a la
// mateixa posició, per la fila publicada. Si la fila ja no hi és, peta:
// val més aturar-se que dir que s'ha fet una cosa que no s'ha fet.
// ------------------------------------------------------------
function substitueixPerPublicada(original, publicada) {
  return function (pendents) {
    var posicio = trobaIndex(pendents, original);
    if (posicio === -1) {
      throw new Error(JA_NO_HI_ES);
    }

    var nova = pendents.slice();
    nova[posicio] = publicada;
    return nova;
  };
}


// --- Rebutjar ---------------------------------------------------------------

// ------------------------------------------------------------
// Torna una transformació que marca una fila de la cua com a rebutjada.
// La fila NO se'n va del fitxer: només li canvia l'estat. Això és la
// memòria de rebuig del projecte —posició al fitxer, no un tercer
// magatzem—, i és el que evita que una sincronització automàtica torni
// a oferir un acte que el curador ja ha dit que no.
//
// Es copia la fila en comptes de tocar-la: l'objecte de la cua acabada
// de llegir no s'ha de modificar mai a mitja escriptura, perquè un
// reintent el torna a llegir de zero.
//
// Si la fila ja no hi és, peta, igual que substitueixPerPublicada().
// ------------------------------------------------------------
function marcaRebutjadaALaCua(original) {
  return function (pendents) {
    var posicio = trobaIndex(pendents, original);
    if (posicio === -1) {
      throw new Error(JA_NO_HI_ES);
    }

    var rebutjada = JSON.parse(JSON.stringify(pendents[posicio]));
    rebutjada.estat = 'rebutjat';

    var nova = pendents.slice();
    nova[posicio] = rebutjada;
    return nova;
  };
}


// --- Per a Node -------------------------------------------------------------

// Al navegador `module` no existeix i les funcions de dalt ja són globals;
// a Node, `require()` rep aquesta llista. Només hi ha el que la pàgina i les
// proves fan servir.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    JA_NO_HI_ES: JA_NO_HI_ES,
    JA_PUBLICAT: JA_PUBLICAT,
    filesPendents: filesPendents,
    treuDeLaCua: treuDeLaCua,
    trobaIndex: trobaIndex,
    idJaPublicat: idJaPublicat,
    afegeixAPublicats: afegeixAPublicats,
    creaFilaPublicada: creaFilaPublicada,
    substitueixPerPublicada: substitueixPerPublicada,
    marcaRebutjadaALaCua: marcaRebutjadaALaCua
  };
}
