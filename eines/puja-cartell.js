// ---------------------------------------------------------------------------
// CARTELLS — copiar el cartell d'una font externa a Cloudinary
//
// Una sola feina: donat un candidat que porta l'URL d'un cartell allotjat a
// casa d'un tercer, demanar que se'n faci una còpia a Cloudinary i deixar a
// `imatge_url` la còpia nostra —o buidar el camp i dir al curador per què no
// s'ha pogut. Res més.
//
// PER QUÈ EXISTEIX AQUESTA PEÇA. El CSV de recerca porta el cartell al camp
// `url_cartell`, i eines/mapeja-recerca.js el posa a `imatge_url` **tal qual**
// —docs/HANDOFF-MAPEIG-RECERCA.md ho diu explícitament: «Tal qual. No es puja
// res a Cloudinary aquí: això és una altra tasca». Aquesta és aquella altra
// tasca. Les URL que hi arriben (cdt66.media.tourinsoft.eu,
// cdn.iris-etourism.io, files.appli-intramuros.com, webs d'ajuntament…) no es
// poden enllaçar des de GitHub Pages i no en tenim llicència de reutilització:
// abans de publicar-les cal que la imatge sigui nostra.
//
// D'ON SURT L'URL D'ORIGEN, I LA TENSIÓ QUE HI HA (llegiu-ho abans de tocar-hi).
// L'encàrrec deia «si `fila.imatge_url` ja té contingut, no facis res, perquè
// pot venir del Typebot». Però el candidat de recerca **no porta l'URL del
// cartell enlloc més**: `url_cartell` no arriba a les metadadades, va de dret a
// `imatge_url`. Si la regla fos literalment «camp ple = no toquis», aquesta
// peça no s'activaria mai. La regla que la resol sense inventar cap camp nou és
// mirar ON apunta l'URL, que és el que de debò distingeix els dos casos:
//
//   - Apunta a Cloudinary  -> ja és nostra. Silenci, cap pujada. És exactament
//     el cas del Typebot: el §7 de CLAUDE.md diu que el cartell «ja puja del
//     navegador a Cloudinary dins el flux del Typebot» i que «l'URL arriba
//     fet». O sigui que la fila del formulari queda protegida igual, i per la
//     raó de fons —ja hi ha còpia nostra— i no per la forma.
//   - Apunta a fora       -> és el cartell de recerca que cal copiar.
//   - Buit                -> no hi ha cap cartell. Silenci.
//
// El que aquesta peça NO fa, i no ho ha de fer mai:
//
//   - NO toca `estat`. La fila surt amb l'estat que portava.
//   - NO esborra res de `nota_curador`: l'avís s'hi ajunta al darrere.
//   - NO treu cap fila del sistema. Un cartell que no es pot copiar és una
//     fila sense imatge, no una fila descartada.
//   - NO crida Cloudinary. La pujada arriba injectada des de fora, i per això
//     aquest fitxer es pot provar sencer sense clau i sense xarxa. Aquí dins no
//     hi ha cap `fetch`, ni cap URL d'API, ni cap nom de cloud.
//   - NO baixa la imatge per mirar-se-la. No sap si el que hi ha a l'altra
//     punta és un cartell, un logotip o un 404: això ho dirà `funcioPujada`.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/puja-cartell.js     -> passa la bateria de proves
//
// El cablejat ja hi és: processaLot() la crida com el tercer agent injectat, i
// pipelineOffline() li passa la clau `puja` tal qual. I la `funcioPujada` de
// debò també existeix ja: és eines/cloudinary-adapter.js. El que NO s'ha fet és
// ajuntar les dues coses —vegeu §EL QUE FALTA DECIDIR, al final d'aquesta
// capçalera—, o sigui que avui aquesta peça només s'exercita amb pujadors de
// mentida, a les proves. Res d'això no escriu enlloc: cap escriptura a
// pendents.json ni a events.json no passa per aquí.
//
// Com les altres dues peces amb crida injectada, **no és idempotent**: passar-la
// dues vegades per una fila que ha fallat hi deixa dos avisos. Qui la cridi en
// bucle ha de saber quines files ja hi han passat. (Una fila que ha reeixit sí
// que és estable: la segona passada la veu ja a Cloudinary i calla.)
//
//
// --- EL CRITERI DE SILENCI --------------------------------------------------
//
// Mateix criteri que eines/verifica-esdeveniment.js, i pel mateix motiu: la
// nota groga de curador.html ha de voler dir «atura't i mira això». Aquí escriu
// nota tot el que deixa la fila sense imatge, i només això:
//
//   pujada bona            silenci  la fila té imatge i és nostra
//   ja és de Cloudinary    silenci  no hi havia res a fer
//   cap URL de cartell     silenci  no hi ha res a assenyalar
//   xarxa social           NOTA     descartat sense provar-ho
//   pujada fallida         NOTA     amb el motiu que hagi tornat funcioPujada
//   sense pujador          NOTA     no s'ha intentat, i l'URL forà segueix allà
//
//
// --- ELS DOS MOTIUS DE DESCART, I PER QUÈ NOMÉS N'HI HA UN AQUÍ -------------
//
// Es coneixen dos motius pels quals un cartell de recerca no s'ha de publicar.
// Aquest fitxer només en detecta un, i és a posta:
//
//   1. ENLLAÇ A UNA XARXA SOCIAL. Un enllaç a una publicació d'Instagram (o de
//      Facebook, o d'on sigui) NO és una imatge: és una pàgina web que exigeix
//      sessió, que canvia i que pot desaparèixer. Copiar-la no té sentit i
//      intentar-ho és una crida gastada. Es detecta pel DOMINI —cosa dura i
//      comprovable— i mai per heurística sobre el text de l'URL.
//
//   2. HORARI O LLOC OBSOLET al cartell. Això NO es detecta aquí i no s'ha
//      d'intentar: caldria obrir la font en directe i comparar-la amb la fila,
//      i aquest fitxer no surt a la xarxa. Es va resoldre a mà i es continua
//      resolent a mà, al curador.
//
//
// --- ON VA AQUESTA NOTA DINS LA CADENA -------------------------------------
//
// Ordre, ja fixat al cablejat (regla 5 d'eines/processa-lot.js): procedència
// (mapeig) -> verificació -> classificació -> cartell. Última, i per una raó de
// lectura, no d'implementació: les tres
// primeres parlen de si la fila és CERTA i si HI HA D'ENTRAR —les preguntes que
// poden fer que el curador no publiqui la fila. La del cartell parla de com
// quedarà la fitxa un cop decidit que sí. Qui llegeixi l'avís groc ha de topar
// primer amb el que li pot fer canviar la decisió.
//
// A efectes de codi l'ordre és lliure: ajuntaNotes() només encadena, i cap de
// les quatre peces no llegeix la nota que hi ha escrita. L'ordre és una
// convenció per al lector, i aquest fitxer no el força de cap manera: qui el
// decideix és l'ordre dels tres blocs de passaElsAgents(), a processa-lot.js.
//
//
// --- EL QUE JA ESTÀ COMPROVAT ----------------------------------------------
//
// Cloudinary sol demanar un ajust específic al preset perquè una pujada UNSIGNED
// accepti un URL remot com a `file` en comptes d'un fitxer del navegador. El
// preset `agenda-posters` (docs/pas-3-cloudinary.md) es va configurar per a
// l'altre cas d'ús: el Worker, que hi puja bytes d'un adjunt de correu, i el
// Typebot, que hi puja des del navegador del remitent.
//
// **Comprovat a mà amb curl, contra el compte de debò: funciona sense tocar el
// preset.** Torna 200 amb `secure_url`, i la conversió a WebP i el
// redimensionament s'apliquen sols. Era l'única pregunta oberta que hi havia
// contra l'API, i ja no ho és.
//
//
// --- LA DECISIÓ QUE FALTAVA, PRESA EL 31 D'AGOST DE 2026 --------------------
//
// L'adaptador de debò és eines/cloudinary-adapter.js i compleix el contracte de
// `funcioPujada` sencer. Durant un temps **no va estar connectat a res**, i no
// era cap descuit: cada crida deixa una còpia PERMANENT a Cloudinary per cada
// cartell forà, fila que després es publiqui o no, i això és una decisió del
// propietari sobre l'espai d'un compte gratuït, no un pas que es faci de
// passada.
//
// El propietari la va prendre el 31 d'agost de 2026: sí, s'hi connecta. El lloc
// on es fa és **eines/cartells-a-cloudinary.js**, una comanda que es llança a
// mà sobre pendents.json — mai un pas automàtic. La primera passada va pujar
// 51 cartells de 54 i en va deixar 3 amb nota (dos 404 a la font, un fitxer de
// 16 MB que passa del límit de Cloudinary).
//
// Dins de processaLot(), en canvi, la clau `puja` continua sense passar-se a
// les proves: allà el pujador segueix sent de mentida, perquè processaLot() es
// crida sobre lots que encara no se sap si entraran enlloc. El cablejat és
// inofensiu: una clau `puja` que no es passa no fa absolutament res.
// ---------------------------------------------------------------------------


// --- El que ve de fora ------------------------------------------------------

// L'única importació d'aquest fitxer: la regla d'ajuntar dues notes de curador.
// Es reutilitza en comptes de copiar-la perquè és la mateixa regla —les dues
// notes, mai una— i ha de dir el mateix a tot arreu. Vegeu el peu
// d'eines/dedup-esdeveniments.js.
var dedup = require('./dedup-esdeveniments.js');


// --- Constants --------------------------------------------------------------

// El camp del CSV de recerca que porta el cartell original. NO es llegeix
// d'aquí —mapejaAProduccio() ja l'ha abocat a `imatge_url` abans que aquesta
// peça vegi res—, però el nom es deixa escrit perquè qui vingui darrere sàpiga
// de quin camp parlem sense haver d'obrir mapeja-recerca.js.
var CAMP_RECERCA_CARTELL = 'url_cartell';

// Com comença tota nota escrita per aquesta peça. Mateixa forma que
// '[Verificació: ' i '[Suggeriment editorial: ': el curador reconeix d'un cop
// d'ull qui ha escrit què, i sap on acaba el que hi havia abans.
var MARCA_CARTELL = '[Cartell: ';

// El domini on viuen les imatges de Cloudinary. Un `imatge_url` que hi apunti
// ja és una còpia nostra i no s'ha de tornar a pujar, vingui del Typebot, del
// Worker o d'una passada anterior d'aquesta mateixa peça.
var DOMINI_CLOUDINARY = 'cloudinary.com';

// El domini on l'ADT66 serveix els seus cartells. El flux hi enganxa sempre un
// `?width=150&height=120`, i 150 px no és cap cartell: la mateixa adreça sense
// paràmetres dona l'original. Era la pregunta oberta 5 del §5 de
// docs/HANDOFF-ADT66.md, que deia que es resoldria aquí i no al mapeig; això
// és fer-ho. Comprovat amb curl sobre les 17 adreces d'ADT66 que hi ha a la
// cua: 4 kB de retall contra 756 kB d'original, en un cas 16 MB.
var DOMINI_MEDIA_ADT66 = 'media.tourinsoft.eu';

// Els dominis on un enllaç és una PUBLICACIÓ, no una imatge. Es compara el
// domini sencer o un subdomini seu (www.instagram.com hi entra, però
// instagram.com.exemple.net no). La llista és curta i explícita a posta: val
// més que se n'escapi una xarxa nova i el curador ho vegi, que no pas que una
// regla llesta descarti un cartell bo.
var XARXES_SOCIALS = [
  'instagram.com',
  'facebook.com',
  'fb.com',
  'fb.watch',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'threads.net',
  'linkedin.com',
  'youtube.com',
  'youtu.be',
  'pinterest.com',
  'bsky.app'
];

// Fins on s'accepta el motiu d'un error de pujada. És una línia per al curador,
// no el bolcat d'una resposta HTTP: el que passi d'aquí es retalla per la
// darrera paraula sencera.
var MAX_MOTIU = 160;


// --- La funció --------------------------------------------------------------

// ------------------------------------------------------------
// Copia el cartell d'un candidat a Cloudinary i li actualitza `imatge_url`.
//
//   candidat      { fila, font: {...}, metadadades: {...} }, la mateixa forma
//                 que accepten dedup-esdeveniments.js, classifica-editorial.js
//                 i verifica-esdeveniment.js.
//   funcioPujada  funció injectada. Se la crida amb (urlOrigen) i ha de tornar
//                 una promesa de { url } si ha anat bé o de { error } si no.
//
// Torna SEMPRE el candidat, amb la fila copiada. No llança mai: una pujada que
// falla és una fila sense imatge i una nota que ho diu, no una fila perduda.
// ------------------------------------------------------------
async function pujaCartell(candidat, funcioPujada) {
  var entrada = candidat || {};
  var fila = copiaFila(entrada.fila);
  var urlOrigen = fila.imatge_url;

  // Els dos silencis d'entrada: res a copiar, o ja copiat. La fila surt tal com
  // ha entrat i no es gasta cap crida.
  if (urlOrigen === '' || esDeCloudinary(urlOrigen)) {
    return candidatAmbFila(entrada, fila);
  }

  if (esDeXarxaSocial(urlOrigen)) {
    fila.imatge_url = '';
    fila.nota_curador = dedup.ajuntaNotes(fila.nota_curador, notaDescartat(urlOrigen));
    return candidatAmbFila(entrada, fila);
  }

  // Sense pujador no s'inventa res: l'URL forà es queda on és —perquè no és
  // feina d'aquesta peça llençar l'única pista del cartell quan ningú no ha
  // provat res— i la nota avisa que encara no és nostre.
  if (typeof funcioPujada !== 'function') {
    fila.nota_curador = dedup.ajuntaNotes(fila.nota_curador, notaSensePujador());
    return candidatAmbFila(entrada, fila);
  }

  var resultat = await intentaPujada(urlOrigen, funcioPujada);

  if (resultat.url !== '') {
    fila.imatge_url = resultat.url;
    return candidatAmbFila(entrada, fila);
  }

  // Ha fallat: la fila es queda sense imatge. L'URL forà NO es conserva —el web
  // públic el serviria tal qual, que és justament el que aquesta peça existeix
  // per evitar— i el motiu queda escrit a la nota.
  fila.imatge_url = '';
  fila.nota_curador = dedup.ajuntaNotes(fila.nota_curador, notaNoPujat(resultat.motiu));

  return candidatAmbFila(entrada, fila);
}

// ------------------------------------------------------------
// Fa la crida i en treu o bé l'URL de Cloudinary o bé el motiu del fracàs.
// Separada de la funció principal perquè el try/catch no s'hi barregi amb les
// guardes de dalt.
//
// Torna sempre { url, motiu }: si `url` porta text, ha anat bé; si no, `motiu`
// diu per què no.
// ------------------------------------------------------------
async function intentaPujada(urlOrigen, funcioPujada) {
  var variants = variantsDeCartell(urlOrigen);
  var darrer = { url: '', motiu: 'no hi ha cap URL de cartell per copiar.' };

  for (var i = 0; i < variants.length; i++) {
    darrer = await unaPujada(variants[i], funcioPujada);

    if (darrer.url !== '') {
      return darrer;
    }
  }

  return darrer;
}

// ------------------------------------------------------------
// Una sola crida al pujador, amb el try/catch a dins. Separada de la de dalt
// perquè aquella només s'ocupi de l'ordre de les variants.
// ------------------------------------------------------------
async function unaPujada(urlOrigen, funcioPujada) {
  var resposta = null;

  try {
    resposta = await funcioPujada(urlOrigen);
  } catch (error) {
    return { url: '', motiu: missatgeDError(error) };
  }

  return interpretaResposta(resposta);
}

// ------------------------------------------------------------
// Les adreces que val la pena provar per a un mateix cartell, en l'ordre que
// s'han de provar. Per a gairebé tothom n'hi ha una i és la que ha arribat.
//
// L'excepció és l'ADT66: el flux serveix el cartell amb un
// `?width=150&height=120` que el redueix a una miniatura inservible, i la
// mateixa adreça sense paràmetres dona l'original. Es prova primer
// l'original i, si no hi és, la miniatura — perquè hi ha cartells que només
// existeixen retallats (una de les 17 adreces provades dona 404 sense
// paràmetres i 200 amb ells) i val més una imatge petita que cap.
//
// No es toca l'URL de ningú més: retallar paràmetres a cegues trencaria els
// que en necessiten per servir la imatge (`?itok=…` de Drupal, per exemple).
// ------------------------------------------------------------
function variantsDeCartell(urlOrigen) {
  var origen = cadena(urlOrigen);

  if (!dominiCoincideix(dominiDe(origen), DOMINI_MEDIA_ADT66)) {
    return [origen];
  }

  var senseParametres = origen.split('?')[0];

  if (senseParametres === '' || senseParametres === origen) {
    return [origen];
  }

  return [senseParametres, origen];
}

// ------------------------------------------------------------
// Converteix el que hagi tornat el pujador en { url, motiu }. Una resposta que
// no és cap de les dues formes del contracte no es dona mai per bona: val més
// un error clar que un `imatge_url` amb qualsevol cosa a dins.
// ------------------------------------------------------------
function interpretaResposta(resposta) {
  if (resposta === null || typeof resposta !== 'object') {
    return { url: '', motiu: 'el pujador no ha tornat ni cap URL ni cap error' };
  }

  var url = cadena(resposta.url);
  if (url !== '') {
    return { url: url, motiu: '' };
  }

  var motiu = cadena(resposta.error);
  if (motiu !== '') {
    return { url: '', motiu: motiu };
  }

  return { url: '', motiu: 'el pujador no ha tornat ni cap URL ni cap error' };
}


// --- Les peces: les tres menes de nota --------------------------------------

// ------------------------------------------------------------
// La nota d'un cartell descartat sense provar-ho:
//
//   [Cartell: descartat] L'enllaç del cartell va a una publicació de xarxa
//   social (instagram.com), que no és una imatge estable: cal buscar-ne una
//   altra o deixar la fitxa sense cartell.
//
// El domini hi surt perquè el curador pugui decidir si val la pena anar-hi a
// mirar a mà.
// ------------------------------------------------------------
function notaDescartat(urlOrigen) {
  return MARCA_CARTELL + 'descartat] L\'enllaç del cartell va a una publicació de ' +
    'xarxa social (' + dominiDe(urlOrigen) + '), que no és una imatge estable: ' +
    'cal buscar-ne una altra o deixar la fitxa sense cartell.';
}

// ------------------------------------------------------------
// La nota de quan la pujada s'ha intentat i no ha anat:
//
//   [Cartell: no pujat] El cartell no s'ha pogut copiar a Cloudinary: 403
//   Forbidden. La fitxa queda sense imatge.
// ------------------------------------------------------------
function notaNoPujat(motiu) {
  return MARCA_CARTELL + 'no pujat] El cartell no s\'ha pogut copiar a Cloudinary: ' +
    netejaMotiu(motiu) + ' La fitxa queda sense imatge.';
}

// ------------------------------------------------------------
// La nota de quan no s'ha intentat res perquè no hi ha pujador. Diferent de la
// d'abans a posta: aquí la fila conserva l'URL forà, i el curador ha de saber
// que allò que hi ha a `imatge_url` NO és una còpia nostra i no es pot publicar
// tal com està.
// ------------------------------------------------------------
function notaSensePujador() {
  return MARCA_CARTELL + 'no pujat] No hi ha cap pujador connectat: el cartell ' +
    'encara apunta a la font original i no es pot publicar així.';
}

// ------------------------------------------------------------
// El motiu, reduït a una línia llegible: salts de línia i espais dobles fora,
// retallat a MAX_MOTIU per la darrera paraula sencera, i acabat en punt perquè
// s'ajunti bé amb la resta de la frase.
// ------------------------------------------------------------
function netejaMotiu(valor) {
  var text = cadena(valor).replace(/\s+/g, ' ').trim();

  if (text === '') {
    return 'sense motiu.';
  }

  if (text.length > MAX_MOTIU) {
    var retallat = text.slice(0, MAX_MOTIU);
    var darrerEspai = retallat.lastIndexOf(' ');
    if (darrerEspai > 0) {
      retallat = retallat.slice(0, darrerEspai);
    }
    return retallat + '…';
  }

  var darrer = text.slice(-1);
  if (darrer !== '.' && darrer !== '!' && darrer !== '?' && darrer !== '…') {
    return text + '.';
  }

  return text;
}


// --- Les peces: llegir el domini d'un URL -----------------------------------

// ------------------------------------------------------------
// El domini d'un URL, en minúscules i sense el «www.». Si el text no és cap URL
// que es pugui llegir, torna "": llavors no és ni de Cloudinary ni de cap xarxa
// social, i el pujador ja dirà què en pensa.
// ------------------------------------------------------------
function dominiDe(url) {
  var adreca = null;

  try {
    adreca = new URL(cadena(url));
  } catch (error) {
    return '';
  }

  var domini = adreca.hostname.toLowerCase();

  if (domini.indexOf('www.') === 0) {
    return domini.slice(4);
  }

  return domini;
}

// ------------------------------------------------------------
// Diu si l'URL ja apunta a Cloudinary, o sigui si la imatge ja és nostra. És el
// cas del Typebot, el del Worker i el d'una passada anterior d'aquesta peça.
// ------------------------------------------------------------
function esDeCloudinary(url) {
  return dominiCoincideix(dominiDe(url), DOMINI_CLOUDINARY);
}

// ------------------------------------------------------------
// Diu si l'URL apunta a una publicació de xarxa social. Es mira la llista
// XARXES_SOCIALS i prou: cap heurística sobre el camí de l'URL.
// ------------------------------------------------------------
function esDeXarxaSocial(url) {
  var domini = dominiDe(url);

  if (domini === '') {
    return false;
  }

  for (var i = 0; i < XARXES_SOCIALS.length; i++) {
    if (dominiCoincideix(domini, XARXES_SOCIALS[i])) {
      return true;
    }
  }

  return false;
}

// ------------------------------------------------------------
// Diu si un domini és exactament el buscat o un subdomini seu. Es compara el
// tros final PRECEDIT D'UN PUNT a posta: així «instagram.com» i
// «www.instagram.com» hi entren, i «instagram.com.exemple.net» o
// «falsinstagram.com» no.
// ------------------------------------------------------------
function dominiCoincideix(domini, buscat) {
  if (domini === buscat) {
    return true;
  }

  return domini.length > buscat.length &&
    domini.slice(-(buscat.length + 1)) === '.' + buscat;
}


// --- Les peces: la fila -----------------------------------------------------

// ------------------------------------------------------------
// Una còpia de la fila, per no tocar mai la que ens han donat. Es copien les
// claus que porti, en el seu ordre: reordenar-la o completar-la als disset
// camps no és feina d'aquesta peça, que només n'escriu dos.
// ------------------------------------------------------------
function copiaFila(fila) {
  var original = fila || {};
  var copia = {};
  var claus = Object.keys(original);

  for (var i = 0; i < claus.length; i++) {
    copia[claus[i]] = cadena(original[claus[i]]);
  }

  // Si la fila venia sense algun dels dos camps que aquesta peça escriu, hi
  // entren ara. `nota_curador` queda l'últim, que és on li toca ser a l'esquema
  // del §4 de CLAUDE.md.
  if (copia.imatge_url === undefined) {
    copia.imatge_url = '';
  }
  if (copia.nota_curador === undefined) {
    copia.nota_curador = '';
  }

  return copia;
}

// ------------------------------------------------------------
// El candidat de sortida: el mateix que ha entrat, amb la fila nova. Es copien
// totes les claus, no només `fila` i `font`, perquè les metadadades, la
// procedència i qualsevol altra cosa que hi hagi penjada no es perdin pel camí.
// ------------------------------------------------------------
function candidatAmbFila(entrada, fila) {
  var sortida = {};
  var claus = Object.keys(entrada);

  for (var i = 0; i < claus.length; i++) {
    sortida[claus[i]] = entrada[claus[i]];
  }

  sortida.fila = fila;
  return sortida;
}


// --- Les peces: neteja de valors --------------------------------------------

// ------------------------------------------------------------
// Qualsevol valor convertit a cadena retallada. Un valor absent, nul o que no
// sigui text és "" (§4 de CLAUDE.md: mai null, mai omès).
// ------------------------------------------------------------
function cadena(valor) {
  if (valor === undefined || valor === null) {
    return '';
  }
  if (typeof valor !== 'string') {
    return String(valor).trim();
  }
  return valor.trim();
}

// ------------------------------------------------------------
// El text d'un error, vingui com vingui. Un `throw` pot dur qualsevol cosa, i
// aquesta nota l'ha de llegir el curador.
// ------------------------------------------------------------
function missatgeDError(error) {
  if (error && error.message) {
    return cadena(error.message);
  }
  return cadena(error);
}


// --- El que surt d'aquest fitxer --------------------------------------------
// La funció, el nom del camp de recerca d'on ve el cartell, i les dues proves
// de domini, que qui cablegi això voldrà poder consultar sense duplicar-les.
// Cap d'elles no toca la xarxa.

module.exports = {
  pujaCartell: pujaCartell,
  esDeCloudinary: esDeCloudinary,
  esDeXarxaSocial: esDeXarxaSocial,
  CAMP_RECERCA_CARTELL: CAMP_RECERCA_CARTELL
};


// --- Proves des del terminal ------------------------------------------------
// Tot el que ve a partir d'aquí és per poder exercitar la funció a mà. No forma
// part de la peça i no s'ha de copiar enlloc. Cap prova no toca la xarxa:
// `funcioPujada` sempre és una funció de mentida.

// Els disset camps, per muntar files de prova senceres.
var CAMPS = [
  'id', 'titol', 'data_inici', 'data_fi', 'hora', 'lloc', 'municipi',
  'comarca', 'categoria', 'descripcio_ca', 'descripcio_fr', 'associacio',
  'imatge_url', 'font_url', 'estat', 'data_entrada', 'nota_curador'
];

// Una URL de Cloudinary tal com queda després d'una pujada bona, amb el preset
// `agenda-posters` i la carpeta `clm-agenda/posters`.
var URL_CLOUDINARY = 'https://res.cloudinary.com/agenda-nord/image/upload/v1756400000/clm-agenda/posters/mercat-prada.webp';

// Tres URL de cartell reals del CSV de recerca, de les tres fonts de tercers
// que hi surten més.
var URL_TOURINSOFT = 'https://cdt66.media.tourinsoft.eu/upload/Octubre-Festa.jpg';
var URL_INTRAMUROS = 'https://files.appli-intramuros.com/img/events/6388/ff08de1a950a50cf828e36b724a0018b_exposition.jpg';
var URL_INSTAGRAM = 'https://www.instagram.com/p/DZ_94qCIblJ/';

// El cartell de l'ADT66 tal com surt del mapeig: amb el `?width=150&height=120`
// que hi enganxa el flux, i el mateix sense paràmetres, que és l'original.
var URL_ADT66_RETALL = 'https://cdt66.media.tourinsoft.eu/upload/JEP-2026.jpg?width=150&height=120';
var URL_ADT66_ORIGINAL = 'https://cdt66.media.tourinsoft.eu/upload/JEP-2026.jpg';

// Un cartell d'una altra font amb paràmetres que SÍ que fan falta: el `?itok=`
// de Drupal, sense el qual la mairie de Perpinyà torna 404. Serveix per
// comprovar que la neteja de paràmetres no s'aplica a ningú més.
var URL_DRUPAL_AMB_ITOK = 'https://www.mairie-perpignan.fr/sites/default/files/styles/originale/public/images/musee-puig-3.jpg?itok=hUbp1msg';

// Una nota de mapeig, una de verificació i una de classificació, tal com les
// escriuen de debò mapejaAProduccio(), verificaEsdeveniment() i
// classificaEditorial(). Serveixen per provar que les quatre notes s'apilen en
// ordre i que cap no s'esborra.
var NOTA_MAPEIG = 'El títol ve en «fr» i no hi ha versió catalana: cal traduir-lo.';
var NOTA_VERIFICACIO = '[Verificació: dubte — hora] La citació no dona cap hora concreta.';
var NOTA_CLASSIFICACIO = '[Suggeriment editorial: NUCLI — R6] Mercat setmanal que sosté els petits productors.';

// ------------------------------------------------------------
// Una fila de prova: els disset camps, buits, amb els que interessin a sobre.
// ------------------------------------------------------------
function filaDeProva(extres) {
  var fila = {};

  for (var i = 0; i < CAMPS.length; i++) {
    fila[CAMPS[i]] = '';
  }

  fila.titol = 'Mercat de Prada';
  fila.data_inici = '2026-09-15';
  fila.municipi = 'Prada';
  fila.estat = 'pendent';
  fila.data_entrada = '2026-08-30T10:00:00.000Z';

  if (extres) {
    var claus = Object.keys(extres);
    for (var j = 0; j < claus.length; j++) {
      fila[claus[j]] = extres[claus[j]];
    }
  }

  return fila;
}

// ------------------------------------------------------------
// Un bloc de metadadades de prova, amb la mateixa forma que el que torna
// mapejaAProduccio(). Aquesta peça no el mira, però hi és per comprovar que
// sobreviu el pas.
// ------------------------------------------------------------
function metadadadesDeProva() {
  return {
    font: {
      url: 'https://exemple.cat/agenda',
      data_publicacio: '2026-07-01',
      data_acces: '2026-08-20',
      citacio_literal: 'Le marché de Prades, tous les mardis matin.'
    },
    confianca: { nivell: 'A', confirmacio: '', vitalitat: '', motiu_null: '' },
    llengua: { titol: 'fr', descripcio: 'fr', esdeveniment: '' },
    descartats: {},
    avisos: []
  };
}

// ------------------------------------------------------------
// Un pujador de mentida que sempre respon el mateix. És el que fa que la
// bateria no necessiti ni clau ni xarxa.
// ------------------------------------------------------------
function respostaFixa(resposta) {
  return function () {
    return Promise.resolve(resposta);
  };
}

// ------------------------------------------------------------
// Un pujador de mentida que peta, per provar el camí de l'excepció.
// ------------------------------------------------------------
function pujadorQuePeta(missatge) {
  return function () {
    return Promise.reject(new Error(missatge));
  };
}

// ------------------------------------------------------------
// Els casos. Primer els cinc de l'encàrrec, després l'apilament de notes, la
// detecció de dominis i el que ha de passar quan el pujador respon coses rares.
// ------------------------------------------------------------
function casosDeProva() {
  return [
    // --- Èxit ---
    {
      nom: 'Èxit simple: imatge_url passa a ser la de Cloudinary, cap nota',
      fila: filaDeProva({ imatge_url: URL_TOURINSOFT }),
      resposta: { url: URL_CLOUDINARY },
      esperaImatge: URL_CLOUDINARY,
      esperaNota: '',
      esperaUrlRebut: URL_TOURINSOFT
    },

    // --- Error de pujada ---
    {
      nom: 'Error de pujada: imatge_url es buida i el motiu va a la nota',
      fila: filaDeProva({ imatge_url: URL_TOURINSOFT }),
      resposta: { error: '403 Forbidden' },
      esperaImatge: '',
      esperaNota: '[Cartell: no pujat] El cartell no s\'ha pogut copiar a Cloudinary: 403 Forbidden. La fitxa queda sense imatge.'
    },

    // --- Descart mecànic d'una xarxa social ---
    {
      nom: 'Instagram: descartat sense arribar a cridar el pujador',
      fila: filaDeProva({ imatge_url: URL_INSTAGRAM }),
      resposta: { url: URL_CLOUDINARY },
      esperaImatge: '',
      esperaNota: '[Cartell: descartat] L\'enllaç del cartell va a una publicació de xarxa social (instagram.com), que no és una imatge estable: cal buscar-ne una altra o deixar la fitxa sense cartell.',
      esperaSenseCrida: true
    },
    {
      nom: 'Facebook: mateix descart, i el domini surt a la nota',
      fila: filaDeProva({ imatge_url: 'https://www.facebook.com/events/123456789/' }),
      resposta: { url: URL_CLOUDINARY },
      esperaImatge: '',
      esperaConte: '(facebook.com)',
      esperaSenseCrida: true
    },

    // --- Cartell que ja és nostre ---
    {
      nom: 'Cartell del Typebot, ja a Cloudinary: no es toca ni es crida el pujador',
      fila: filaDeProva({ imatge_url: URL_CLOUDINARY }),
      resposta: { url: 'https://res.cloudinary.com/agenda-nord/image/upload/ALTRA.webp' },
      esperaImatge: URL_CLOUDINARY,
      esperaNota: '',
      esperaSenseCrida: true
    },

    // --- Cap cartell ---
    {
      nom: 'Sense cap URL de cartell: silenci, cap nota, cap crida',
      fila: filaDeProva({ imatge_url: '' }),
      resposta: { url: URL_CLOUDINARY },
      esperaImatge: '',
      esperaNota: '',
      esperaSenseCrida: true
    },
    {
      nom: 'Fila sense el camp imatge_url: se li afegeix buit i tot calla',
      fila: { titol: 'Concert de Nadal', data_inici: '2026-12-20', estat: 'pendent' },
      resposta: { url: URL_CLOUDINARY },
      esperaImatge: '',
      esperaNota: '',
      esperaSenseCrida: true,
      esperaDarrerCamp: 'nota_curador'
    },

    // --- L'apilament de les quatre notes ---
    {
      nom: 'Quatre notes seguides: mapeig, verificació, classificació i cartell',
      fila: filaDeProva({
        imatge_url: URL_INTRAMUROS,
        nota_curador: NOTA_MAPEIG + ' ' + NOTA_VERIFICACIO + ' ' + NOTA_CLASSIFICACIO
      }),
      resposta: { error: 'la font no respon (timeout)' },
      esperaImatge: '',
      esperaNota: NOTA_MAPEIG + ' ' + NOTA_VERIFICACIO + ' ' + NOTA_CLASSIFICACIO + ' ' +
        '[Cartell: no pujat] El cartell no s\'ha pogut copiar a Cloudinary: la font no respon (timeout). La fitxa queda sense imatge.'
    },
    {
      nom: 'Pujada bona amb notes prèvies: no s\'hi toca res',
      fila: filaDeProva({
        imatge_url: URL_INTRAMUROS,
        nota_curador: NOTA_MAPEIG + ' ' + NOTA_CLASSIFICACIO
      }),
      resposta: { url: URL_CLOUDINARY },
      esperaImatge: URL_CLOUDINARY,
      esperaNota: NOTA_MAPEIG + ' ' + NOTA_CLASSIFICACIO
    },
    {
      nom: 'Instagram amb notes prèvies: la de cartell va al darrere',
      fila: filaDeProva({
        imatge_url: URL_INSTAGRAM,
        nota_curador: NOTA_MAPEIG + ' ' + NOTA_VERIFICACIO
      }),
      resposta: { url: URL_CLOUDINARY },
      esperaImatge: '',
      esperaConte: NOTA_VERIFICACIO + ' [Cartell: descartat]',
      esperaSenseCrida: true
    },

    // --- El pujador no hi és, o respon coses rares ---
    {
      nom: 'Sense pujador connectat: l\'URL forà es conserva i la nota ho diu',
      fila: filaDeProva({ imatge_url: URL_TOURINSOFT }),
      sensePujador: true,
      esperaImatge: URL_TOURINSOFT,
      esperaNota: '[Cartell: no pujat] No hi ha cap pujador connectat: el cartell encara apunta a la font original i no es pot publicar així.'
    },
    {
      nom: 'El pujador peta: la fila surt igualment, amb el missatge de l\'excepció',
      fila: filaDeProva({ imatge_url: URL_TOURINSOFT }),
      pujador: pujadorQuePeta('ENOTFOUND cdt66.media.tourinsoft.eu'),
      esperaImatge: '',
      esperaConte: 'ENOTFOUND cdt66.media.tourinsoft.eu'
    },
    {
      nom: 'El pujador peta enmig d\'un lot: les altres files continuen',
      esLot: true
    },
    {
      nom: 'El pujador respon un objecte buit: es tracta com un error',
      fila: filaDeProva({ imatge_url: URL_TOURINSOFT }),
      resposta: {},
      esperaImatge: '',
      esperaConte: 'ni cap URL ni cap error'
    },
    {
      nom: 'El pujador respon null: es tracta com un error',
      fila: filaDeProva({ imatge_url: URL_TOURINSOFT }),
      resposta: null,
      esperaImatge: '',
      esperaConte: 'ni cap URL ni cap error'
    },
    {
      nom: 'Un error de tres paràgrafs es retalla a una línia',
      fila: filaDeProva({ imatge_url: URL_TOURINSOFT }),
      resposta: {
        error: 'Cloudinary ha respost 400 Bad Request amb el cos següent, que diu que ' +
          'el preset unsigned no accepta un fitxer remot i que cal activar l\'opció ' +
          'corresponent al tauler abans de tornar-ho a provar,\ni a sota hi ha la ' +
          'traça sencera de la petició amb totes les capçaleres.'
      },
      esperaImatge: '',
      esperaConte: '…',
      esperaMaxLlargada: MAX_MOTIU + 120
    },

    // --- La detecció de dominis, als límits ---
    {
      nom: 'Un domini que només s\'assembla a Instagram no es descarta',
      fila: filaDeProva({ imatge_url: 'https://falsinstagram.com/cartell.jpg' }),
      resposta: { url: URL_CLOUDINARY },
      esperaImatge: URL_CLOUDINARY,
      esperaNota: '',
      esperaUrlRebut: 'https://falsinstagram.com/cartell.jpg'
    },
    {
      nom: 'Instagram com a prefix d\'un altre domini tampoc no es descarta',
      fila: filaDeProva({ imatge_url: 'https://instagram.com.exemple.net/cartell.jpg' }),
      resposta: { url: URL_CLOUDINARY },
      esperaImatge: URL_CLOUDINARY,
      esperaNota: ''
    },
    {
      nom: 'Un PDF de cartell es puja com qualsevol altra cosa: el preset ja el converteix',
      fila: filaDeProva({ imatge_url: 'https://www.argeles-sur-mer.com/app/uploads/Depliant-Les-Medievales-2026-web.pdf' }),
      resposta: { url: URL_CLOUDINARY },
      esperaImatge: URL_CLOUDINARY,
      esperaNota: '',
      esperaUrlRebut: 'https://www.argeles-sur-mer.com/app/uploads/Depliant-Les-Medievales-2026-web.pdf'
    },

    // --- L'ADT66 i la seva miniatura de 150 px ---
    {
      nom: 'ADT66: es puja l\'original, no la miniatura de 150 px',
      fila: filaDeProva({ imatge_url: URL_ADT66_RETALL }),
      resposta: { url: URL_CLOUDINARY },
      esperaImatge: URL_CLOUDINARY,
      esperaNota: '',
      esperaUrlsRebuts: [URL_ADT66_ORIGINAL]
    },
    {
      nom: 'ADT66: si l\'original no hi és, es prova la miniatura',
      fila: filaDeProva({ imatge_url: URL_ADT66_RETALL }),
      pujador: function (url) {
        if (url === URL_ADT66_ORIGINAL) {
          return Promise.resolve({ error: '404 Not Found' });
        }
        return Promise.resolve({ url: URL_CLOUDINARY });
      },
      esperaImatge: URL_CLOUDINARY,
      esperaNota: '',
      esperaUrlsRebuts: [URL_ADT66_ORIGINAL, URL_ADT66_RETALL]
    },
    {
      nom: 'ADT66: si fallen totes dues, imatge_url queda buit amb el darrer motiu',
      fila: filaDeProva({ imatge_url: URL_ADT66_RETALL }),
      resposta: { error: '404 Not Found' },
      esperaImatge: '',
      esperaUrlsRebuts: [URL_ADT66_ORIGINAL, URL_ADT66_RETALL],
      esperaConte: '404 Not Found'
    },
    {
      nom: 'ADT66 sense paràmetres: una sola crida, no se n\'inventa cap segona',
      fila: filaDeProva({ imatge_url: URL_ADT66_ORIGINAL }),
      resposta: { url: URL_CLOUDINARY },
      esperaImatge: URL_CLOUDINARY,
      esperaUrlsRebuts: [URL_ADT66_ORIGINAL]
    },
    {
      nom: 'Els paràmetres d\'una altra font no es toquen mai (?itok= de Drupal)',
      fila: filaDeProva({ imatge_url: URL_DRUPAL_AMB_ITOK }),
      resposta: { url: URL_CLOUDINARY },
      esperaImatge: URL_CLOUDINARY,
      esperaUrlsRebuts: [URL_DRUPAL_AMB_ITOK]
    },
    {
      nom: 'Un cartell ja pujat a Cloudinary no es torna a pujar mai',
      fila: filaDeProva({ imatge_url: URL_CLOUDINARY }),
      resposta: { url: 'https://res.cloudinary.com/clm-agenda/image/upload/altra.webp' },
      esperaImatge: URL_CLOUDINARY,
      esperaNota: '',
      esperaSenseCrida: true
    },
    {
      nom: 'Un imatge_url que no és cap URL llegible va al pujador, que ja dirà què hi troba',
      fila: filaDeProva({ imatge_url: 'no és cap adreça' }),
      resposta: { error: 'no és cap URL' },
      esperaImatge: '',
      esperaConte: 'no és cap URL'
    }
  ];
}

// ------------------------------------------------------------
// Passa la bateria i n'escriu el resultat al terminal.
// ------------------------------------------------------------
async function provaBateria() {
  var casos = casosDeProva();
  var fallades = 0;

  for (var i = 0; i < casos.length; i++) {
    var cas = casos[i];
    var problemes = [];

    if (cas.esLot === true) {
      problemes = await provaLotAmbUnaFallada();
    } else {
      problemes = await provaUnCas(cas);
    }

    if (problemes.length > 0) {
      fallades += 1;
    }

    console.log((problemes.length === 0 ? 'BÉ  ' : 'MAL ') + cas.nom);
    for (var p = 0; p < problemes.length; p++) {
      console.log('     ! ' + problemes[p]);
    }
  }

  console.log('');
  console.log(casos.length + ' casos, ' + fallades + ' fallades.');
  if (fallades > 0) {
    process.exitCode = 1;
  }
}

// ------------------------------------------------------------
// Un cas: es puja i es comprova el que vigila, més el que han de complir tots
// sense excepció.
// ------------------------------------------------------------
async function provaUnCas(cas) {
  var problemes = [];
  var crides = 0;
  var urlRebut = null;
  var urlsRebuts = [];

  var pujador = null;
  if (cas.pujador) {
    pujador = function (url) {
      crides += 1;
      urlRebut = url;
      urlsRebuts.push(url);
      return cas.pujador(url);
    };
  } else if (!cas.sensePujador) {
    pujador = function (url) {
      crides += 1;
      urlRebut = url;
      urlsRebuts.push(url);
      return respostaFixa(cas.resposta)(url);
    };
  }

  var candidat = {
    fila: cas.fila,
    font: { tipus: 'agregador', llengua: 'fr' },
    metadadades: metadadadesDeProva()
  };

  var resultat = await pujaCartell(candidat, pujador);
  var nota = resultat.fila.nota_curador;

  // El que vigila aquest cas.
  if (cas.esperaImatge !== undefined && resultat.fila.imatge_url !== cas.esperaImatge) {
    problemes.push('imatge_url: esperava «' + cas.esperaImatge + '», tinc «' + resultat.fila.imatge_url + '»');
  }
  if (cas.esperaNota !== undefined && nota !== cas.esperaNota) {
    problemes.push('nota: esperava «' + cas.esperaNota + '», tinc «' + nota + '»');
  }
  if (cas.esperaConte !== undefined && nota.indexOf(cas.esperaConte) === -1) {
    problemes.push('la nota no conté «' + cas.esperaConte + '»: «' + nota + '»');
  }
  if (cas.esperaMaxLlargada !== undefined && nota.length > cas.esperaMaxLlargada) {
    problemes.push('la nota fa ' + nota.length + ' caràcters, més dels ' + cas.esperaMaxLlargada + ' acceptats');
  }
  if (cas.esperaSenseCrida === true && crides !== 0) {
    problemes.push('s\'ha cridat el pujador ' + crides + ' vegada(es) i no calia');
  }
  if (cas.esperaUrlRebut !== undefined && urlRebut !== cas.esperaUrlRebut) {
    problemes.push('el pujador ha rebut «' + urlRebut + '», esperava «' + cas.esperaUrlRebut + '»');
  }
  if (cas.esperaUrlsRebuts !== undefined &&
      urlsRebuts.join(' | ') !== cas.esperaUrlsRebuts.join(' | ')) {
    problemes.push('el pujador ha rebut [' + urlsRebuts.join(' | ') +
      '], esperava [' + cas.esperaUrlsRebuts.join(' | ') + ']');
  }
  if (cas.esperaDarrerCamp !== undefined) {
    var clausFila = Object.keys(resultat.fila);
    if (clausFila[clausFila.length - 1] !== cas.esperaDarrerCamp) {
      problemes.push('l\'últim camp de la fila és «' + clausFila[clausFila.length - 1] + '», esperava «' + cas.esperaDarrerCamp + '»');
    }
  }

  // El que val per a tots els casos, i és el que aquesta peça promet.
  if (resultat.fila.estat !== cadena(cas.fila.estat)) {
    problemes.push('estat tocat: «' + cadena(cas.fila.estat) + '» -> «' + resultat.fila.estat + '»');
  }

  var notaPrevia = cadena(cas.fila.nota_curador);
  if (notaPrevia !== '' && nota.indexOf(notaPrevia) !== 0) {
    problemes.push('la nota prèvia s\'ha perdut o s\'ha mogut: «' + nota + '»');
  }

  var camps = Object.keys(resultat.fila);
  for (var c = 0; c < camps.length; c++) {
    var camp = camps[c];
    if (camp === 'nota_curador' || camp === 'imatge_url') {
      continue;
    }
    if (resultat.fila[camp] !== cadena(cas.fila[camp])) {
      problemes.push(camp + ' ha canviat: «' + cadena(cas.fila[camp]) + '» -> «' + resultat.fila[camp] + '»');
    }
    if (typeof resultat.fila[camp] !== 'string') {
      problemes.push(camp + ' no és una cadena');
    }
  }

  if (resultat.font !== candidat.font) {
    problemes.push('el descriptor de font no ha sobreviscut');
  }
  if (resultat.metadadades !== candidat.metadadades) {
    problemes.push('les metadadades no han sobreviscut');
  }
  if (cas.fila.imatge_url !== undefined && candidat.fila.imatge_url !== cadena(cas.fila.imatge_url)) {
    problemes.push('la fila d\'entrada s\'ha modificat');
  }

  return problemes;
}

// ------------------------------------------------------------
// Un lot de tres files amb un pujador que peta a la segona. És el mateix patró
// que ja garanteix eines/verifica-esdeveniment.js amb el verificador: una crida
// que falla no atura el lot ni perd cap fila.
// ------------------------------------------------------------
async function provaLotAmbUnaFallada() {
  var problemes = [];
  var titols = ['Primera', 'Segona', 'Tercera'];
  var crides = 0;

  var pujador = function (url) {
    crides += 1;
    if (url.indexOf('Segona') !== -1) {
      return Promise.reject(new Error('503 Service Unavailable'));
    }
    return Promise.resolve({ url: URL_CLOUDINARY });
  };

  var sortida = [];

  for (var i = 0; i < titols.length; i++) {
    var candidat = {
      fila: filaDeProva({
        titol: titols[i],
        imatge_url: 'https://cdt66.media.tourinsoft.eu/upload/' + titols[i] + '.jpg'
      }),
      font: { tipus: 'agregador', llengua: 'fr' }
    };
    sortida.push(await pujaCartell(candidat, pujador));
  }

  if (sortida.length !== 3) {
    problemes.push('el lot ha perdut files: ' + sortida.length + ' de 3');
  }
  if (crides !== 3) {
    problemes.push('s\'han fet ' + crides + ' crides de 3: el lot s\'ha aturat');
  }
  if (sortida[0].fila.imatge_url !== URL_CLOUDINARY || sortida[0].fila.nota_curador !== '') {
    problemes.push('la primera fila hauria de tenir la imatge i sortir muda');
  }
  if (sortida[1].fila.imatge_url !== '') {
    problemes.push('la segona fila hauria de quedar sense imatge: «' + sortida[1].fila.imatge_url + '»');
  }
  if (sortida[1].fila.nota_curador.indexOf('503 Service Unavailable') === -1) {
    problemes.push('la segona fila no diu que el pujador ha petat: «' + sortida[1].fila.nota_curador + '»');
  }
  if (sortida[2].fila.imatge_url !== URL_CLOUDINARY || sortida[2].fila.nota_curador !== '') {
    problemes.push('la tercera fila hauria de tenir la imatge i sortir muda');
  }
  for (var j = 0; j < sortida.length; j++) {
    if (sortida[j].fila.estat !== 'pendent') {
      problemes.push('la fila ' + j + ' ha canviat d\'estat');
    }
  }

  return problemes;
}

// ------------------------------------------------------------
// Punt d'entrada del terminal: sense arguments, la bateria.
// ------------------------------------------------------------
function principal() {
  provaBateria();
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    process.argv[1].indexOf('puja-cartell') !== -1) {
  principal();
}
