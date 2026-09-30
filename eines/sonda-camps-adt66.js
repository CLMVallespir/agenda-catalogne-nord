// ---------------------------------------------------------------------------
// ADT66 — SONDA DE CAMPS (hora d'`COMMUNDATE` i lloc buit amb adreça)
//
// Una sola feina: mirar el flux real d'ofertes de l'ADT66 i comptar dues
// coses que el mapeig no resol del tot. Eina de NOMÉS LECTURA.
//
//   - Cap escriptura a pendents.json ni a events.json, que ni tan sols llegeix.
//   - Cap crida a Gemini, cap secret, cap token de GitHub.
//   - L'única sortida és un fitxer de text a `Claude outputs/`.
//
// Què compta:
//
//   (a) Com escriu l'hora el camp `COMMUNDATE` (HTML amb entitats). Es
//       desxifren les entitats i es treuen les etiquetes ABANS de classificar,
//       però els exemples es mostren amb el valor CRU, tal com ve del flux.
//       El camp porta una entrada per data, separades per <br>; es classifica
//       cada entrada i l'oferta cau a la classe comuna de totes (una sèrie de
//       40 dates amb el mateix «De HH:MM à HH:MM» és de la classe del tram).
//       Classes:
//         - «De HH:MM à HH:MM»   un sol tram per entrada, amb «De» (el que
//                                llegeix horaDeLoferta() d'adt66-sincronitza.js)
//         - «à HH:MM» sol        una hora per entrada sense «De»
//                                (horaDeLoferta() no la veu)
//         - «sense hora»         cap hora al text (o camp buit)
//         - «altres»             entrades de classes barrejades, dos trams
//                                dins d'una entrada, formes amb «h», etc.
//
//   (b) Ofertes amb el camp de lloc BUIT on algun camp d'adreça diu més que
//       el nom del poble. Els camps, descoberts als 1 495 registres reals del
//       flux i a eines/mapeja-adt66.js:
//         - camp de lloc:    `COMMUNLIEU`. És el que omple `lloc` a
//                            llocDeProduccio() (HTML sense etiqueta «Lieu :»);
//                            «buit» vol dir que, un cop net, no queda res
//                            (al flux sovint ve com a " ").
//         - camp de municipi: `Commune` (francès, en majúscules). És el que
//                            omple `municipi`.
//         - camps d'adreça:  `DETAILADRESSE` (carrer i número) i
//                            `DETAILCOMMUNE` (codi postal + poble, p. ex.
//                            «66220 SAINT-PAUL-DE-FENOUILLET»).
//       «Diu més que el nom del poble» = el camp d'adreça, un cop net i
//       retallat, no és buit i no és només el nom del municipi (comparat sense
//       accents ni majúscules, contra `Commune` i contra el municipi ja
//       mapejat). A `DETAILCOMMUNE` es treu abans el codi postal de 5 xifres
//       del davant: si no, «66220 X» no seria mai igual a «X» i tots hi
//       comptarien.
//
// La finestra de 30 dies és la del pipeline: es crida filtraCandidats() de
// eines/filtra-candidats.js (DIES_DE_FINESTRA = 30) amb les dates que
// mapejaOfertaADT66() dona a cada oferta i `avui` en UTC, com fa
// sincronitza-programada.js. Una oferta queda DINS si filtraCandidats() no la
// descarta per «fora de finestra»; això inclou les que no porten cap data
// (mai no es descarten per aquest criteri). La sonda NO aplica la
// deduplicació contra pendents.json/events.json, que el pipeline fa abans.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/sonda-camps-adt66.js
// ---------------------------------------------------------------------------

var fs = require('fs');
var path = require('path');

var adt66 = require('./adt66-sincronitza.js');
var mapeig = require('./mapeja-adt66.js');
var filtre = require('./filtra-candidats.js');
var identificador = require('./adt66-identificador.js');


// --- Constants --------------------------------------------------------------

// L'adreça del flux que fa servir sincronitzaADT66(), tal com és a
// eines/adt66-sincronitza.js (allà no s'exporta). Només serveix per escriure-la
// a la capçalera de l'informe; la lectura la fa sincronitzaADT66().
var ENDPOINT_FLUX = 'https://wcf.tourinsoft.com/Syndication/3.0/cdt66/' +
  '60a37063-5667-45f8-82e1-a1db2d8375b9/Objects?$format=json';

// Fins a quants exemples es mostren de cada categoria.
var MAX_EXEMPLES = 10;

// Les entitats amb nom que pot portar un camp del flux.
var ENTITATS = {
  nbsp: ' ', agrave: 'à', aacute: 'á', acirc: 'â', auml: 'ä',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  iacute: 'í', icirc: 'î', iuml: 'ï', oacute: 'ó', ocirc: 'ô', ouml: 'ö',
  uacute: 'ú', ugrave: 'ù', ucirc: 'û', uuml: 'ü', ccedil: 'ç', ntilde: 'ñ',
  oelig: 'œ', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘',
  quot: '"', apos: '\'', lt: '<', gt: '>', euro: '€', hellip: '…',
  ndash: '–', mdash: '—', amp: '&'
};

// Les quatre classes d'hora de COMMUNDATE, en l'ordre en què es mostren.
var CLASSE_TRAM = 'De HH:MM à HH:MM';
var CLASSE_SOLA = 'à HH:MM sol (sense De)';
var CLASSE_CAP = 'sense hora';
var CLASSE_ALTRES = 'altres';


// --- Les peces: text net ----------------------------------------------------

// ------------------------------------------------------------
// Desxifra les entitats HTML, amb nom i numèriques (decimals i hexadecimals).
// `&amp;` va l'última a posta, per no desxifrar dues vegades.
// ------------------------------------------------------------
function desxifraEntitats(text) {
  var net = text;

  net = net.replace(/&#x([0-9a-f]+);/gi, function (tot, codi) {
    return String.fromCodePoint(parseInt(codi, 16));
  });
  net = net.replace(/&#(\d+);/g, function (tot, codi) {
    return String.fromCodePoint(Number(codi));
  });
  net = net.replace(/&([a-z]+);/gi, function (tot, nom) {
    var clau = nom.toLowerCase();
    if (clau === 'amp') {
      return tot;
    }
    if (Object.prototype.hasOwnProperty.call(ENTITATS, clau)) {
      return ENTITATS[clau];
    }
    return tot;
  });
  net = net.replace(/&amp;/gi, '&');

  return net;
}

// ------------------------------------------------------------
// Un camp HTML a text pla: treu les etiquetes, desxifra les entitats i
// redueix els espais (els NBSP inclosos) a un de sol.
// ------------------------------------------------------------
function textNet(valor) {
  if (valor === undefined || valor === null) {
    return '';
  }

  var text = String(valor);
  text = text.replace(/<[^>]*>/g, ' ');
  text = desxifraEntitats(text);
  text = text.replace(/[\s ]+/g, ' ');

  return text.trim();
}

// ------------------------------------------------------------
// La clau de comparació d'un nom: minúscules, sense accents i amb tot el que
// no és lletra ni xifra fet un espai.
// ------------------------------------------------------------
function normalitza(text) {
  var net = String(text).toLowerCase();
  net = net.normalize('NFD').replace(/[̀-ͯ]/g, '');
  net = net.replace(/[^a-z0-9]+/g, ' ');

  return net.trim();
}


// --- Les peces: l'hora de COMMUNDATE ----------------------------------------

// ------------------------------------------------------------
// Classifica UNA entrada de COMMUNDATE (un text net, sense etiquetes). Primer
// es treuen els trams «De HH:MM à HH:MM», després les «à HH:MM» soltes, i si
// encara queda cap altra hora, és «altres». El «à» no porta \b perquè JS només
// el reconeix per a lletres ASCII: es mira que vagi darrere d'un espai.
// ------------------------------------------------------------
function classificaEntrada(text) {
  var patroTram = /\bde\s+\d{1,2}:\d{2}\s+à\s+\d{1,2}:\d{2}/gi;
  var patroSola = /(?:^|\s)à\s+\d{1,2}:\d{2}/gi;
  var patroHora = /\b\d{1,2}(?:[:hH]\d{2}|[hH])(?!\d)/g;

  var trams = text.match(patroTram) || [];
  var senseTrams = text.replace(patroTram, ' ');

  var soles = senseTrams.match(patroSola) || [];
  var senseSoles = senseTrams.replace(patroSola, ' ');

  var restants = senseSoles.match(patroHora) || [];

  if (restants.length > 0) {
    return CLASSE_ALTRES;
  }
  if (trams.length === 1 && soles.length === 0) {
    return CLASSE_TRAM;
  }
  if (trams.length === 0 && soles.length === 1) {
    return CLASSE_SOLA;
  }
  if (trams.length === 0 && soles.length === 0) {
    return CLASSE_CAP;
  }

  return CLASSE_ALTRES;
}

// ------------------------------------------------------------
// Les entrades d'un COMMUNDATE cru: n'hi ha una per data, separades per <br>
// (una oferta d'un taller setmanal en porta desenes). Només les que no són
// buides un cop netes.
// ------------------------------------------------------------
function entradesDeComundate(comundate) {
  var trossos = String(comundate || '').split(/<br\s*\/?>/i);
  var entrades = [];

  for (var i = 0; i < trossos.length; i++) {
    var text = textNet(trossos[i]);
    if (text !== '') {
      entrades.push(text);
    }
  }

  return entrades;
}

// ------------------------------------------------------------
// Classifica el COMMUNDATE cru d'una oferta. Es classifica cada entrada; si
// totes cauen a la mateixa classe, l'oferta hi cau (una sèrie de 40 dates amb
// el mateix «De HH:MM à HH:MM» és de la classe del tram); si no, «altres».
// Sense cap entrada, «sense hora».
// ------------------------------------------------------------
function classificaHora(comundate) {
  var entrades = entradesDeComundate(comundate);

  if (entrades.length === 0) {
    return CLASSE_CAP;
  }

  var primera = classificaEntrada(entrades[0]);
  for (var i = 1; i < entrades.length; i++) {
    if (classificaEntrada(entrades[i]) !== primera) {
      return CLASSE_ALTRES;
    }
  }

  return primera;
}

// ------------------------------------------------------------
// Compta les classes d'hora d'una llista d'ofertes i recull els exemples
// crus d'«altres». Torna { comptes, exemplesAltres, buits }.
// ------------------------------------------------------------
function comptaHores(ofertes) {
  var comptes = {};
  comptes[CLASSE_TRAM] = 0;
  comptes[CLASSE_SOLA] = 0;
  comptes[CLASSE_CAP] = 0;
  comptes[CLASSE_ALTRES] = 0;

  var exemplesAltres = [];
  var buits = 0;

  for (var i = 0; i < ofertes.length; i++) {
    var cru = ofertes[i].COMMUNDATE;
    var classe = classificaHora(cru);
    comptes[classe] = comptes[classe] + 1;

    if (textNet(cru) === '') {
      buits = buits + 1;
    }
    if (classe === CLASSE_ALTRES && exemplesAltres.length < MAX_EXEMPLES) {
      exemplesAltres.push(cru);
    }
  }

  return { comptes: comptes, exemplesAltres: exemplesAltres, buits: buits };
}


// --- Les peces: lloc buit i adreça ------------------------------------------

// ------------------------------------------------------------
// Diu si un camp d'adreça, net, diu més que el nom del poble: no és buit i no
// és només el municipi (ni el `Commune` cru ni el municipi ja mapejat).
// `treuCodiPostal` és cert per a DETAILCOMMUNE, que comença pel codi postal.
// ------------------------------------------------------------
function adrecaDiuMes(valor, noms, treuCodiPostal) {
  var text = textNet(valor);

  if (treuCodiPostal) {
    text = text.replace(/^\d{5}\s*/, '');
  }

  var clau = normalitza(text);
  if (clau === '') {
    return false;
  }

  for (var i = 0; i < noms.length; i++) {
    if (clau === normalitza(noms[i])) {
      return false;
    }
  }

  return true;
}

// ------------------------------------------------------------
// Analitza una oferta per al recompte (b). Torna { llocBuit, diuMes }:
// `llocBuit` segons el `lloc` que dona el mapeig real, i `diuMes` si algun
// dels dos camps d'adreça diu més que el poble.
// ------------------------------------------------------------
function analitzaLloc(oferta) {
  var mapejada = mapeig.mapejaOfertaADT66(oferta);
  var fila = mapejada.fila;

  var noms = [oferta.Commune, fila.municipi];
  var adreca = adrecaDiuMes(oferta.DETAILADRESSE, noms, false);
  var poble = adrecaDiuMes(oferta.DETAILCOMMUNE, noms, true);

  return {
    llocBuit: fila.lloc === '',
    diuMes: adreca || poble
  };
}

// ------------------------------------------------------------
// Compta (b) sobre una llista d'ofertes. Torna { llocBuit, diuMes,
// exemples } on els exemples són fins a MAX_EXEMPLES ofertes amb els camps
// d'adreça crus.
// ------------------------------------------------------------
function comptaLlocs(ofertes) {
  var llocBuit = 0;
  var diuMes = 0;
  var exemples = [];

  for (var i = 0; i < ofertes.length; i++) {
    var oferta = ofertes[i];
    var analisi = analitzaLloc(oferta);

    if (!analisi.llocBuit) {
      continue;
    }

    llocBuit = llocBuit + 1;

    if (analisi.diuMes) {
      diuMes = diuMes + 1;
      if (exemples.length < MAX_EXEMPLES) {
        exemples.push({
          id: idDeLoferta(oferta),
          commune: oferta.Commune,
          adresse: oferta.DETAILADRESSE,
          detailCommune: oferta.DETAILCOMMUNE,
          communLieu: oferta.COMMUNLIEU
        });
      }
    }
  }

  return { llocBuit: llocBuit, diuMes: diuMes, exemples: exemples };
}

// ------------------------------------------------------------
// L'identificador ADT66 d'una oferta, el mateix del tag `[ADT66 id: …]` que
// posa mapeja-adt66.js: es munta el tag i se'n rellegeix l'ID.
// ------------------------------------------------------------
function idDeLoferta(oferta) {
  var tag = identificador.creaTagIdentificador(oferta.SyndicObjectID);
  if (tag === '') {
    return '(sense SyndicObjectID)';
  }
  return identificador.extreuIdentificador(tag);
}


// --- Les peces: la finestra de 30 dies --------------------------------------

// ------------------------------------------------------------
// Les ofertes que queden DINS la finestra, amb el criteri del pipeline:
// les dates surten de mapejaOfertaADT66() i les jutja filtraCandidats(). Un
// candidat només amb dates no pot caure per soroll, o sigui que tot descart
// és «fora de finestra».
// ------------------------------------------------------------
function ofertesDinsDeFinestra(ofertes, avui) {
  var candidats = [];

  for (var i = 0; i < ofertes.length; i++) {
    var fila = mapeig.mapejaOfertaADT66(ofertes[i]).fila;
    candidats.push({
      oferta: ofertes[i],
      registre: {
        nom_original: '',
        nom_altra_llengua: '',
        organitzador: '',
        data_inici: fila.data_inici,
        data_fi: fila.data_fi
      }
    });
  }

  var resultat = filtre.filtraCandidats(candidats, avui);

  var dins = [];
  for (var j = 0; j < resultat.passen.length; j++) {
    dins.push(resultat.passen[j].oferta);
  }

  return { dins: dins, fora: resultat.descartats.length };
}


// --- L'informe --------------------------------------------------------------

// ------------------------------------------------------------
// Munta les línies del bloc de recomptes d'hora d'un conjunt d'ofertes.
// ------------------------------------------------------------
function liniesHores(titol, recompte) {
  var linies = [];
  linies.push(titol);
  linies.push('  ' + CLASSE_TRAM + ': ' + recompte.comptes[CLASSE_TRAM]);
  linies.push('  ' + CLASSE_SOLA + ': ' + recompte.comptes[CLASSE_SOLA]);
  linies.push('  ' + CLASSE_CAP + ': ' + recompte.comptes[CLASSE_CAP]);
  linies.push('  ' + CLASSE_ALTRES + ': ' + recompte.comptes[CLASSE_ALTRES]);
  linies.push('  (COMMUNDATE buit o només espais: ' + recompte.buits + ')');
  return linies;
}

// ------------------------------------------------------------
// Munta el text sencer de l'informe. Tot cadenes, res al terminal.
// ------------------------------------------------------------
function muntaInforme(dades) {
  var l = [];

  l.push('SONDA DE CAMPS ADT66 — ' + dades.avui);
  l.push('Endpoint: ' + dades.endpoint);
  l.push('');
  l.push('Ofertes llegides del flux: ' + dades.total);
  l.push('Dins la finestra de ' + dades.diesFinestra + ' dies (avui = ' + dades.avui + ', UTC): ' +
         dades.dins.length);
  l.push('Fora de la finestra: ' + dades.fora);
  l.push('Criteri: filtraCandidats() de eines/filtra-candidats.js, amb les dates de');
  l.push('mapejaOfertaADT66(); una oferta sense data no es descarta mai per aquest criteri.');
  l.push('No hi ha deduplicació contra pendents.json / events.json.');
  l.push('');
  l.push('Camps: lloc = COMMUNLIEU; municipi = Commune; adreça = DETAILADRESSE i DETAILCOMMUNE');
  l.push('(a DETAILCOMMUNE es treu el codi postal de 5 xifres abans de comparar).');
  l.push('');
  l.push('=== (a) HORA A COMMUNDATE ===');
  l.push('');

  l = l.concat(liniesHores('Tot el flux (' + dades.total + '):', dades.horesTot));
  l.push('');
  l = l.concat(liniesHores('Dins la finestra (' + dades.dins.length + '):', dades.horesDins));
  l.push('');
  l.push('Exemples literals d\'«altres» (valor cru de COMMUNDATE, tot el flux, fins a ' +
         MAX_EXEMPLES + '):');
  if (dades.horesTot.exemplesAltres.length === 0) {
    l.push('  (cap)');
  }
  for (var i = 0; i < dades.horesTot.exemplesAltres.length; i++) {
    l.push('  ' + (i + 1) + '. ' + JSON.stringify(dades.horesTot.exemplesAltres[i]));
  }

  l.push('');
  l.push('=== (b) LLOC BUIT AMB ADREÇA QUE DIU MÉS QUE EL POBLE ===');
  l.push('');
  l.push('Tot el flux:');
  l.push('  ofertes amb lloc (COMMUNLIEU) buit: ' + dades.llocsTot.llocBuit);
  l.push('  d\'aquestes, amb adreça que diu més que el poble (recompte b): ' + dades.llocsTot.diuMes);
  l.push('Dins la finestra:');
  l.push('  ofertes amb lloc buit: ' + dades.llocsDins.llocBuit);
  l.push('  d\'aquestes, recompte (b): ' + dades.llocsDins.diuMes);
  l.push('');
  l.push('Exemples (tot el flux, fins a ' + MAX_EXEMPLES + '; valors literals entre cometes):');
  if (dades.llocsTot.exemples.length === 0) {
    l.push('  (cap)');
  }
  for (var j = 0; j < dades.llocsTot.exemples.length; j++) {
    var ex = dades.llocsTot.exemples[j];
    l.push('  ' + (j + 1) + '. ID ADT66: ' + ex.id);
    l.push('       Commune: ' + JSON.stringify(ex.commune));
    l.push('       DETAILADRESSE: ' + JSON.stringify(ex.adresse));
    l.push('       DETAILCOMMUNE: ' + JSON.stringify(ex.detailCommune));
    l.push('       COMMUNLIEU: ' + JSON.stringify(ex.communLieu));
  }
  l.push('');

  return l.join('\n');
}

// ------------------------------------------------------------
// La data d'avui en AAAA-MM-DD, en UTC, com fa sincronitza-programada.js.
// ------------------------------------------------------------
function dataDavui() {
  return new Date().toISOString().slice(0, 10);
}


// --- Ús des del terminal ----------------------------------------------------

// ------------------------------------------------------------
// Llegeix el flux, fa els recomptes, escriu l'informe i en ensenya només
// l'últim resum al terminal.
// ------------------------------------------------------------
async function principal() {
  try {
    var resposta = await adt66.sincronitzaADT66('');
    var ofertes = resposta.ofertes;
    var avui = dataDavui();

    var finestra = ofertesDinsDeFinestra(ofertes, avui);

    var dades = {
      avui: avui,
      endpoint: ENDPOINT_FLUX,
      total: ofertes.length,
      diesFinestra: 30,
      dins: finestra.dins,
      fora: finestra.fora,
      horesTot: comptaHores(ofertes),
      horesDins: comptaHores(finestra.dins),
      llocsTot: comptaLlocs(ofertes),
      llocsDins: comptaLlocs(finestra.dins)
    };

    var carpeta = path.join(__dirname, '..', 'Claude outputs');
    fs.mkdirSync(carpeta, { recursive: true });

    var nomFitxer = 'sonda-camps-adt66-' + avui.replace(/-/g, '') + '.txt';
    var ruta = path.join(carpeta, nomFitxer);
    fs.writeFileSync(ruta, muntaInforme(dades), 'utf8');

    console.log('Escrit: ' + ruta);
    console.log('ofertes llegides: ' + dades.total + ' (dins finestra: ' + dades.dins.length + ')');
    console.log('(a) ' + CLASSE_TRAM + ': ' + dades.horesTot.comptes[CLASSE_TRAM] +
                ' | ' + CLASSE_SOLA + ': ' + dades.horesTot.comptes[CLASSE_SOLA] +
                ' | ' + CLASSE_CAP + ': ' + dades.horesTot.comptes[CLASSE_CAP] +
                ' | ' + CLASSE_ALTRES + ': ' + dades.horesTot.comptes[CLASSE_ALTRES]);
    console.log('(b) lloc buit amb adreça que diu més: ' + dades.llocsTot.diuMes +
                ' de ' + dades.llocsTot.llocBuit + ' amb lloc buit');
  } catch (error) {
    console.error('Ha fallat: ' + error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  principal();
}
