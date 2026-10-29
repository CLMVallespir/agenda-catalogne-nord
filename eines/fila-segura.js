// ---------------------------------------------------------------------------
// FILA-SEGURA — la forma de tota fila que una porta posa a la cua
//
// Una feina i prou: prendre els camps d'una fila tal com els ha muntat una
// porta d'entrada i tornar-ne una que no pugui fer mal a res del que ve
// després. No decideix si l'acte entra a l'agenda —les portes són
// permissives a posta (D-04)—: només en sanitza la forma.
//
// LA FILA QUE TORNA filaSegura():
//   - els divuit camps del §4 de CLAUDE.md, en ordre, tots cadenes, cap més;
//   - cada camp de text tallat al seu sostre (SOSTRES), amb un avís si s'ha
//     hagut de tallar;
//   - el títol en una sola línia: va al missatge del commit que el publica, i
//     un salt de línia hi podria falsificar línies de peu a l'historial;
//   - data_inici i data_fi amb la forma AAAA-MM-DD, o "" amb un avís;
//   - comarca i categoria de la llista, o "" (valorPermes());
//   - imatge_url i font_url http o https (url-segura.js), o "" amb un avís;
//   - id, estat i data_entrada, els del sistema i mai els que arriben:
//     creaId(), «pendent» i l'hora d'ara;
//   - nota_curador sense cap claudàtor, llevat del tag [ADT66 id: …] que el
//     mapeig de l'ADT66 hi posa al davant.
//
// PER QUÈ ELS CLAUDÀTORS. dedup-contra-fitxers.js llegeix TOTS els tags
// [ADT66 id: …] d'una nota, i alguns avisos del mapeig copien text del flux
// (el municipi, la categoria). Un valor del flux amb un tag fals a dins faria
// passar una altra oferta, de debò, per «ja a la cua» o «ja rebutjada», i
// aquella oferta no arribaria mai al curador. Sense claudàtors, cap text no
// pot ser un tag. Es fa aquí i no a cada avís perquè el pròxim avís que copiï
// text del flux ja hi quedi cobert.
//
// ON ES CRIDA: a la porta, abans de cap fusió. Una fila fusionada porta dos
// tags de debò (ajuntaNotes()), i el segon ja no és al davant: aquest mòdul
// l'esborraria.
//   eines/mapeja-adt66.js            filaSegura(), a la sortida de
//                                    mapejaOfertaADT66()
//   eines/sincronitza-programada.js  campSegur(), als tres camps que torna
//                                    la traducció de Claude
// El Worker (correu i formulari) encara no hi passa: hi anirà una còpia
// literal amb el seu verificador quan aquestes regles s'hagin assentat.
//
// ESTATS: no llegeix pendents.json. Tota fila que torna és «pendent».
//
// Les proves són a proves/sanejament-de-files.test.js.
// ---------------------------------------------------------------------------

var urlSegura = require('../url-segura.js');


// --- Constants: l'esquema ---------------------------------------------------

// Els divuit camps de la fila, amb el nom i l'ordre del §4 de CLAUDE.md.
var CAMPS = [
  'id', 'titol', 'data_inici', 'data_fi', 'hora', 'lloc', 'municipi',
  'comarca', 'categoria', 'descripcio_ca', 'descripcio_fr', 'associacio',
  'imatge_url', 'font_url', 'estat', 'data_entrada', 'periodicitat',
  'nota_curador'
];

var COMARQUES = ['Rosselló', 'Conflent', 'Vallespir', 'Capcir', 'Cerdanya'];

var CATEGORIES = [
  'Música', 'Teatre', 'Dansa i ball', 'Conferència', 'Exposició', 'Mercat',
  'Cinema', 'Taller', 'Activitat infantil', 'Patrimoni i tradicions',
  'Concentració', 'Esports', 'Vida associativa'
];


// --- Constants: els sostres -------------------------------------------------

// El sostre de cada camp de text, en caràcters. No són cap regla editorial:
// impedeixen que una sola fila faci créixer la cua sense límit (l'API de
// continguts de GitHub no torna res per damunt d'1 MB, D-08) i que es pagui
// la traducció d'un text desmesurat.
//
// Mesurats el 29 d'octubre de 2026 sobre el flux sencer de l'ADT66 (1 367
// ofertes, ja mapejades) i les 1 225 files de pendents.json i events.json: el
// valor més llarg de cada camp hi cap amb marge. El que més s'hi acosta és
// una descripció de l'ADT66 de 5 610 caràcters; la segona en fa 3 872.
var SOSTRES = {
  titol: 200,
  hora: 20,
  lloc: 300,
  municipi: 100,
  descripcio_ca: 6000,
  descripcio_fr: 6000,
  associacio: 300,
  periodicitat: 200,
  nota_curador: 2000
};

// Una adreça més llarga no és de cap cartell ni de cap web de debò (la més
// llarga del 29 d'octubre en fa 199). Es buida i no es talla: una adreça
// tallada ja no porta enlloc.
var SOSTRE_ADRECA = 2000;


// --- Constants: les formes --------------------------------------------------

var PATRO_DATA = /^\d{4}-\d{2}-\d{2}$/;

// El tag d'ancoratge al davant de la nota, amb la forma que li dona
// creaTagIdentificador() a eines/adt66-identificador.js.
var PATRO_TAG_AL_DAVANT = /^\[ADT66 id: [^\s\]]+\]/;


// --- La fila ----------------------------------------------------------------

// ------------------------------------------------------------
// La fila neta que pot entrar a la cua, feta dels camps que dona una porta.
// `origen` és 'adt66', 'correu' o 'formulari': només l'ADT66 pot dur el tag
// d'ancoratge al davant de la nota. Torna una fila nova; la d'entrada no es
// toca.
// ------------------------------------------------------------
function filaSegura(campsBruts, origen) {
  var bruts = campsBruts || {};
  var avisos = [];
  var fila = {};

  for (var i = 0; i < CAMPS.length; i++) {
    fila[CAMPS[i]] = textDelCamp(CAMPS[i], bruts[CAMPS[i]]);
  }

  tallaAlsSostres(fila, avisos);

  fila.data_inici = dataSegura(fila.data_inici, 'La data d\'inici', avisos);
  fila.data_fi = dataSegura(fila.data_fi, 'La data de fi', avisos);
  fila.comarca = valorPermes(fila.comarca, COMARQUES);
  fila.categoria = valorPermes(fila.categoria, CATEGORIES);
  fila.imatge_url = adrecaSegura(fila.imatge_url, 'El cartell', avisos);
  fila.font_url = adrecaSegura(fila.font_url, 'L\'enllaç de la font', avisos);

  // Els tres camps del sistema: mai els que arriben.
  fila.id = creaId(fila.data_inici, fila.titol);
  fila.estat = 'pendent';
  fila.data_entrada = new Date().toISOString();

  fila.nota_curador = ajuntaAvisos(notaSenseTagsFalsos(fila.nota_curador, origen), avisos);

  return fila;
}

// ------------------------------------------------------------
// Un sol camp de text amb les regles de la fila: cadena, el títol en una
// línia, i el sostre del camp. No avisa de res: és per a qui reescriu un camp
// d'una fila que ja ha passat per filaSegura(), com la traducció de l'Action.
// ------------------------------------------------------------
function campSegur(camp, valor) {
  return talla(textDelCamp(camp, valor), SOSTRES[camp]);
}


// --- Les peces --------------------------------------------------------------

// ------------------------------------------------------------
// Un valor qualsevol com a cadena retallada; el títol, a més, en una sola
// línia. Un valor desconegut és "" (§4 de CLAUDE.md: mai null, mai omès).
// ------------------------------------------------------------
function textDelCamp(camp, valor) {
  var text = '';
  if (valor !== undefined && valor !== null) {
    text = String(valor).trim();
  }

  if (camp === 'titol') {
    text = text.replace(/\s+/g, ' ');
  }

  return text;
}

// ------------------------------------------------------------
// Talla cada camp de text al seu sostre i avisa de cada camp tallat.
// ------------------------------------------------------------
function tallaAlsSostres(fila, avisos) {
  var camps = Object.keys(SOSTRES);

  for (var i = 0; i < camps.length; i++) {
    var camp = camps[i];
    var tallat = talla(fila[camp], SOSTRES[camp]);
    if (tallat !== fila[camp]) {
      fila[camp] = tallat;
      avisos.push('El camp ' + camp + ' passava de ' + SOSTRES[camp] + ' caràcters i s\'ha tallat: reviseu-ne el final.');
    }
  }
}

// ------------------------------------------------------------
// El text tallat a `sostre` caràcters. Compta caràcters de debò i no unitats
// UTF-16, perquè el tall no parteixi mai un emoji per la meitat. Sense
// sostre, o si ja hi cap, el torna igual.
// ------------------------------------------------------------
function talla(text, sostre) {
  if (sostre === undefined || text.length <= sostre) {
    return text;
  }

  var caracters = Array.from(text);
  if (caracters.length <= sostre) {
    return text;
  }

  return caracters.slice(0, sostre).join('').trim();
}

// ------------------------------------------------------------
// La data si té la forma AAAA-MM-DD, o "" amb un avís. L'avís no copia el
// valor: cap text de fora no ha d'anar a parar a la nota.
// ------------------------------------------------------------
function dataSegura(valor, quina, avisos) {
  if (valor === '' || PATRO_DATA.test(valor)) {
    return valor;
  }

  avisos.push(quina + ' no tenia la forma AAAA-MM-DD i queda buida: poseu-la a mà.');
  return '';
}

// ------------------------------------------------------------
// L'adreça si pot anar a un enllaç (http o https, url-segura.js) i no és
// desmesurada, o "" amb un avís. Com a la data, l'avís no la copia.
// ------------------------------------------------------------
function adrecaSegura(adreca, quina, avisos) {
  if (adreca === '') {
    return '';
  }
  if (adreca.length <= SOSTRE_ADRECA && urlSegura.esUrlSegura(adreca)) {
    return adreca;
  }

  avisos.push(quina + ' no era cap adreça web (http o https) o era massa llarga: queda buit.');
  return '';
}

// ------------------------------------------------------------
// La nota sense cap claudàtor, llevat del tag d'ancoratge que una fila de
// l'ADT66 porta al davant. Així cap text de dins la nota no pot ser un tag
// [ADT66 id: …] que dedup-contra-fitxers.js llegiria com a bo.
// ------------------------------------------------------------
function notaSenseTagsFalsos(nota, origen) {
  var tag = '';
  var resta = nota;

  if (origen === 'adt66') {
    var trobat = nota.match(PATRO_TAG_AL_DAVANT);
    if (trobat !== null) {
      tag = trobat[0];
      resta = nota.slice(tag.length);
    }
  }

  return tag + resta.replace(/[\[\]]/g, '');
}

// ------------------------------------------------------------
// Els avisos d'aquest mòdul darrere de la nota, separats per un espai: la
// mateixa regla que ajuntaNotes() (eines/dedup-esdeveniments.js).
// ------------------------------------------------------------
function ajuntaAvisos(nota, avisos) {
  var parts = [];
  if (nota !== '') {
    parts.push(nota);
  }
  return parts.concat(avisos).join(' ');
}

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
// Les dues funcions de la fila, i les peces que el mapeig de l'ADT66 fa
// servir per classificar abans d'arribar-hi: les llistes, l'esquema,
// valorPermes() i creaId().

module.exports = {
  filaSegura: filaSegura,
  campSegur: campSegur,
  valorPermes: valorPermes,
  creaId: creaId,
  CAMPS: CAMPS,
  COMARQUES: COMARQUES,
  CATEGORIES: CATEGORIES
};
