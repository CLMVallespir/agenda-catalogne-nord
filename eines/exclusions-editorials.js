// ---------------------------------------------------------------------------
// EXCLUSIONS EDITORIALS — OFERTES DE L'ADT66 QUE NO ENTREN MAI A LA CUA
//
// Una sola feina: dir si una oferta CRUA del flux de l'ADT66 cau en una
// exclusió editorial ja decidida pel propietari. Res més.
//
//   - Codi pur i sense estat: entra una oferta, en surt l'entrada de la llista
//     que l'atrapa o `null`. No crida cap API, no llegeix ni escriu cap fitxer.
//   - NO posa cap `estat` a res. Una oferta exclosa simplement no entra a
//     `pendents.json` (ni, per tant, gasta cap crida a Gemini): és el que fa
//     eines/sincronitza-programada.js amb el que torna trobaExclusio().
//   - Mira camps del flux TAL COM ARRIBEN (`Commune`, `DETAILADRESSE`,
//     `RechercheTYPE`). Per això s'ha d'aplicar mentre es té l'oferta a
//     sobre, i no sobre la fila ja mapejada.
//
// QUÈ NO ÉS AQUEST FITXER: no és el filtre previ (eines/filtra-candidats.js,
// que mira dates i soroll mecànic) ni la regla de la visita comentada (R4).
// És una llista de decisions editorials concretes, cadascuna amb el seu nom,
// el seu motiu i la data en què es va prendre, perquè qui obri el registre
// d'un run sàpiga per què una oferta no hi és.
//
// PER AFEGIR-N'HI UNA: un objecte més a EXCLUSIONS_EDITORIALS, amb `nom`,
// `motiu`, `data` i `coincideix(oferta)`. La funció rep l'oferta crua i torna
// cert o fals; res més.
//
// Les comparacions de text són insensibles a majúscules, accents i puntuació
// (vegeu normalitzaPerExclusio()), perquè el flux escriu la mateixa adreça de
// maneres diferents («13, Bd Voltaire», «13 boulevard Voltaire»).
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node -e "console.log(require('./eines/exclusions-editorials.js').EXCLUSIONS_EDITORIALS.length)"
// ---------------------------------------------------------------------------


// --- El que ve de fora ------------------------------------------------------

// Desfà l'HTML i les entitats d'un camp del flux («Lieu :», «&eacute;»…). Cap
// decisió editorial: només deixa el text llegible abans de comparar-lo.
var neteja = require('./neteja-text.js');


// --- Constants: la llista ---------------------------------------------------

// Les exclusions vigents. Una línia de comentari per entrada diu què fa.
var EXCLUSIONS_EDITORIALS = [
  {
    // Cinema d'Elna: l'oferta és d'Elna i l'adreça és la del cinema, o bé el
    // tipus diu «cinéma». Les dues vies són independents; n'hi ha prou amb una.
    nom: 'Cinema d\'Elna',
    motiu: 'criteri polític: exclusió per lloc (CRITERI-EDITORIAL.md)',
    data: '2026-10-01',
    coincideix: function (oferta) {
      if (normalitzaPerExclusio(valorDelFlux(oferta, 'Commune')) !== 'elne') {
        return false;
      }
      return adrecaDelCinemaDElna(oferta) || tipusCinema(oferta);
    }
  }
];


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


// --- Les peces: les dues vies del Cinema d'Elna -----------------------------

// ------------------------------------------------------------
// Diu si `DETAILADRESSE` porta l'adreça del cinema: «13 boulevard Voltaire». El
// «bd» es llegeix com a «boulevard» (vegeu normalitzaPerExclusio()), de manera
// que «13, Bd Voltaire» també coincideix.
// ------------------------------------------------------------
function adrecaDelCinemaDElna(oferta) {
  var adreca = normalitzaPerExclusio(valorDelFlux(oferta, 'DETAILADRESSE'));
  return conteExpressio(adreca, '13 boulevard voltaire');
}

// ------------------------------------------------------------
// Diu si `RechercheTYPE` esmenta «cinéma», dins de qualsevol dels seus valors
// («Projection, cinéma», «Cinéma», …). Sense accents ni majúscules.
// ------------------------------------------------------------
function tipusCinema(oferta) {
  var tipus = normalitzaPerExclusio(valorDelFlux(oferta, 'RechercheTYPE'));
  return conteExpressio(tipus, 'cinema');
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
// a «boulevard». És la mateixa normalització que fan filtra-candidats.js i
// sincronitza-programada.js, amb aquest afegit per a les adreces.
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


// --- El que surt d'aquest fitxer --------------------------------------------

module.exports = {
  EXCLUSIONS_EDITORIALS: EXCLUSIONS_EDITORIALS,
  trobaExclusio: trobaExclusio,
  normalitzaPerExclusio: normalitzaPerExclusio
};
