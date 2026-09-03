// ---------------------------------------------------------------------------
// L'ADAPTADOR DE CLOUDINARY — la pujada de debò
//
// Una sola feina: donat l'URL d'un cartell allotjat a casa d'un tercer, demanar
// a Cloudinary que se'n faci una còpia i tornar l'URL de la còpia. Res més.
//
// És l'altra meitat d'eines/puja-cartell.js. Aquella peça decideix QUAN s'ha de
// copiar un cartell i què s'escriu a la nota del curador, i no toca la xarxa;
// aquesta només toca la xarxa i no decideix res. La frontera entre les dues és
// el contracte de `funcioPujada`, que és exactament aquest:
//
//   funcioPujada(urlOrigen)  ->  Promise<{ url }>     la còpia ha anat bé
//                            ->  Promise<{ error }>   no ha anat, i per què
//
// LA REGLA QUE NO ES POT TRENCAR MAI: aquesta funció **no llança**. Ni amb la
// xarxa caiguda, ni amb un 500, ni amb una resposta que no s'entén. El motiu és
// concret i no és estètic: pujaCartell() sap gestionar un `{ error }` —hi escriu
// la nota groga i deixa la fila sense imatge—, però una excepció que se li
// escapi puja fins a passaLesLlestesPer() i s'emporta el lot sencer. Un cartell
// que no es pot copiar ha de ser una fila sense imatge, mai un lot perdut.
//
// EL QUE JA ESTÀ COMPROVAT (prova manual amb curl, fora del repositori, contra
// el compte de debò): el preset `agenda-posters` accepta un URL remot al camp
// `file` d'una pujada UNSIGNED i respon 200 amb `secure_url`, sense cap ajust al
// preset. La conversió a WebP i el redimensionament s'apliquen sols, que és el
// que ja fa la transformació d'entrada `w_800,c_limit,q_80,f_webp`. Això és el
// que faltava saber al §«EL QUE FALTA COMPROVAR» d'eines/puja-cartell.js.
//
// CAP SECRET AQUÍ DINS, I NO N'HI POT HAVER. La pujada és unsigned: no demana ni
// clau ni signatura. L'única dada que li cal és el NOM DEL CLOUD, que no és cap
// secret —surt a cada URL d'imatge que serveix el web públic—, però tampoc no
// s'escriu aquí: arriba per la variable d'entorn CLOUDINARY_CLOUD_NAME o per
// paràmetre. Així aquest fitxer es pot llegir, copiar i ensenyar sense mirar-se
// dues vegades què hi ha escrit.
//
// AVÍS, I ÉS EL MÉS IMPORTANT D'AQUESTA CAPÇALERA:
//
//     AQUEST ADAPTADOR NO ESTÀ CONNECTAT A RES.
//
// Ni a processaLot(), ni a pipelineOffline(), ni a cap cosa que corri sola. La
// clau `puja` de l'objecte d'agents continua sense rebre'l: avui només s'hi
// passen pujadors de mentida, a les proves. Connectar-lo vol dir gastar espai
// del compte de Cloudinary de debò per cada fila d'un lot, i això és una decisió
// del propietari, no un pas que es faci de passada. Fins que no la prengui,
// aquesta eina es fa servir a mà.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/cloudinary-adapter.js    -> passa la bateria de proves
//
// La bateria NO surt a la xarxa: el `fetch` es passa injectat, com totes les
// altres crides d'aquest projecte. L'única manera de provar la pujada de debò és
// a mà, amb el nom del cloud a l'entorn.
// ---------------------------------------------------------------------------


// --- Constants --------------------------------------------------------------

// El NOM de la variable d'entorn on viu el nom del cloud. Aquí hi ha el nom de
// la variable, mai el seu valor.
var VARIABLE_DEL_CLOUD = 'CLOUDINARY_CLOUD_NAME';

// El preset de pujada sense signatura (docs/pas-3-cloudinary.md). No és secret:
// és exactament el mateix que porta escrit el Worker. El preset ja hi posa la
// carpeta (clm-agenda/posters) i la transformació d'entrada.
var CLOUDINARY_PRESET = 'agenda-posters';

// El punt d'entrada de l'API de pujada. El nom del cloud s'hi encasta al mig.
var CLOUDINARY_API = 'https://api.cloudinary.com/v1_1/';
var CLOUDINARY_CAMI = '/image/upload';

// Quant s'espera com a màxim una pujada abans de donar-la per morta. Cloudinary
// ha d'anar a buscar la imatge a l'altra punta, o sigui que no és instantani;
// però tampoc no es pot deixar un lot penjat per un servidor que no contesta.
var TEMPS_MAXIM_MS = 30000;

// Fins on s'accepta el text d'error que torni Cloudinary. El que ve del servidor
// pot ser una pàgina sencera, i això acaba dins la nota groga del curador.
var MAX_DETALL = 200;


// --- La funció --------------------------------------------------------------

// ------------------------------------------------------------
// El pujador que fa servir el nom del cloud de l'entorn. És la forma còmoda:
//
//   var adaptador = require('./cloudinary-adapter.js');
//   var resultat = await adaptador.funcioPujada(urlDelCartell);
//
// Torna { url } o { error }, i no llança mai.
// ------------------------------------------------------------
async function funcioPujada(urlOrigen) {
  var pujador = creaPujador(nomDelCloudDeLEntorn());
  return pujador(urlOrigen);
}

// ------------------------------------------------------------
// Fabrica un pujador amb un nom de cloud concret. És la forma explícita, i la
// que cal quan el nom no ve de l'entorn.
//
//   nomDelCloud  el nom del compte de Cloudinary. Si falta, el pujador que en
//                surt torna { error } a la primera crida: no peta.
//   funcioFetch  NOMÉS PER A LES PROVES. Si no es passa, es fa servir el `fetch`
//                del sistema, que és l'únic camí de xarxa d'aquest fitxer.
//
// Torna una funció amb el contracte de `funcioPujada`.
// ------------------------------------------------------------
function creaPujador(nomDelCloud, funcioFetch) {
  var cloud = cadena(nomDelCloud);
  var demana = funcioFetch;

  if (typeof demana !== 'function') {
    demana = fetch;
  }

  return async function (urlOrigen) {
    var origen = cadena(urlOrigen);

    // Les dues coses que es poden dir sense gastar cap petició.
    if (cloud === '') {
      return { error: 'falta la variable ' + VARIABLE_DEL_CLOUD +
        ': no se sap a quin compte de Cloudinary s\'ha de pujar.' };
    }
    if (origen === '') {
      return { error: 'no hi ha cap URL de cartell per copiar.' };
    }

    return intentaPujada(origen, cloud, demana);
  };
}

// ------------------------------------------------------------
// La crida, i prou. Separada perquè el try/catch no es barregi amb les guardes
// de dalt i perquè quedi a la vista que aquest és l'ÚNIC lloc del fitxer que
// surt a la xarxa.
//
// Torna sempre { url } o { error }: tot el que pugui petar peta aquí dins.
// ------------------------------------------------------------
async function intentaPujada(urlOrigen, nomDelCloud, demana) {
  var url = CLOUDINARY_API + nomDelCloud + CLOUDINARY_CAMI;
  var formulari = new FormData();

  // El camp `file` amb un URL a dins és el que fa que Cloudinary vagi a buscar
  // la imatge ell mateix, en comptes d'esperar-ne els bytes.
  formulari.append('file', urlOrigen);
  formulari.append('upload_preset', CLOUDINARY_PRESET);

  var resposta = null;

  try {
    resposta = await demana(url, {
      method: 'POST',
      body: formulari,
      signal: AbortSignal.timeout(TEMPS_MAXIM_MS)
    });
  } catch (error) {
    return { error: motiuDeLExcepcio(error) };
  }

  return llegeixResposta(resposta);
}

// ------------------------------------------------------------
// Converteix la resposta HTTP en { url } o { error }. Una resposta que no sigui
// exactament la que s'espera no es dona mai per bona: val més un error clar que
// un `imatge_url` amb qualsevol cosa a dins.
// ------------------------------------------------------------
async function llegeixResposta(resposta) {
  if (!resposta || typeof resposta.status !== 'number') {
    return { error: 'Cloudinary no ha tornat cap resposta que es pugui llegir.' };
  }

  if (!resposta.ok) {
    var detall = await textDeLaResposta(resposta);
    return { error: 'Cloudinary ha respost amb el codi ' + resposta.status +
      escurcaDetall(detall) };
  }

  var dades = null;

  try {
    dades = await resposta.json();
  } catch (error) {
    return { error: 'Cloudinary ha respost 200 però el cos no és JSON.' };
  }

  // Es demana `secure_url` i no `url` a posta: la segona és http, i el web
  // públic es serveix per https. Una imatge http en una pàgina https no es veu.
  var segura = cadena(dades && dades.secure_url);

  if (segura === '') {
    return { error: 'Cloudinary ha respost 200 però sense cap secure_url.' };
  }

  return { url: segura };
}


// --- Les peces --------------------------------------------------------------

// ------------------------------------------------------------
// El nom del cloud, tal com el porti l'entorn. Si no hi és, torna "" i qui el
// crida ja en dirà alguna cosa: aquí no es llança res.
// ------------------------------------------------------------
function nomDelCloudDeLEntorn() {
  if (typeof process === 'undefined' || !process.env) {
    return '';
  }
  return cadena(process.env[VARIABLE_DEL_CLOUD]);
}

// ------------------------------------------------------------
// El cos d'una resposta, en text, sense que llegir-lo pugui petar. Un servidor
// que ja ha fallat pot fallar també quan se li llegeix el cos.
// ------------------------------------------------------------
async function textDeLaResposta(resposta) {
  try {
    return cadena(await resposta.text());
  } catch (error) {
    return '';
  }
}

// ------------------------------------------------------------
// El motiu d'una excepció, en una línia llegible. Es distingeix el temps
// exhaurit de la resta perquè és l'error que més es repetirà i el que el curador
// ha de poder reconèixer d'un cop d'ull.
// ------------------------------------------------------------
function motiuDeLExcepcio(error) {
  var nom = '';
  var missatge = '';

  if (error) {
    nom = cadena(error.name);
    missatge = cadena(error.message);
  }

  if (nom === 'TimeoutError' || nom === 'AbortError') {
    return 'Cloudinary no ha contestat en ' + Math.round(TEMPS_MAXIM_MS / 1000) +
      ' segons.';
  }

  if (missatge === '') {
    return 'no s\'ha pogut arribar a Cloudinary.';
  }

  return 'no s\'ha pogut arribar a Cloudinary: ' + missatge;
}

// ------------------------------------------------------------
// El detall que torna el servidor, retallat i amb el punt posat, o res si no
// n'ha dit cap. Va enganxat darrere del codi HTTP.
// ------------------------------------------------------------
function escurcaDetall(detall) {
  var net = cadena(detall).replace(/\s+/g, ' ').trim();

  if (net === '') {
    return '.';
  }

  if (net.length > MAX_DETALL) {
    net = net.slice(0, MAX_DETALL);
    var darrerEspai = net.lastIndexOf(' ');
    if (darrerEspai > 0) {
      net = net.slice(0, darrerEspai);
    }
    return ': ' + net + '…';
  }

  return ': ' + net;
}

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


// --- El que surt d'aquest fitxer --------------------------------------------
// La forma còmoda (el nom del cloud de l'entorn) i la explícita (el nom per
// paràmetre). Les dues tornen { url } o { error } i cap de les dues no llança.

module.exports = {
  funcioPujada: funcioPujada,
  creaPujador: creaPujador,
  CLOUDINARY_PRESET: CLOUDINARY_PRESET,
  VARIABLE_DEL_CLOUD: VARIABLE_DEL_CLOUD
};


// --- Proves des del terminal ------------------------------------------------
// Tot el que ve a partir d'aquí és per poder exercitar l'adaptador a mà. No
// forma part de la peça i no s'ha de copiar enlloc. CAP PROVA NO SURT A LA
// XARXA: el `fetch` sempre és de mentida, i per això es pot injectar.
//
// El que aquestes proves NO poden dir és si Cloudinary accepta de debò un URL
// remot amb aquest preset. Això es va comprovar a mà, amb curl, i el resultat és
// al §«EL QUE JA ESTÀ COMPROVAT» de la capçalera.

var CLOUD_DE_PROVA = 'un-cloud-qualsevol';
var URL_ORIGEN = 'https://cdt66.media.tourinsoft.eu/upload/Octubre-Festa.jpg';
var URL_SEGURA = 'https://res.cloudinary.com/un-cloud-qualsevol/image/upload/' +
  'v1756400000/clm-agenda/posters/octubre-festa.webp';

// ------------------------------------------------------------
// Un `fetch` de mentida que respon el que se li digui i es queda la petició
// sencera, perquè les comprovacions puguin mirar com s'ha muntat el formulari.
// ------------------------------------------------------------
function fetchDeProva(resposta) {
  var mentider = function (url, opcions) {
    mentider.crides++;
    mentider.url = url;
    mentider.opcions = opcions;
    return Promise.resolve(resposta);
  };

  mentider.crides = 0;
  mentider.url = '';
  mentider.opcions = null;
  return mentider;
}

// ------------------------------------------------------------
// Una resposta de mentida amb la mateixa pinta que la de `fetch`.
// ------------------------------------------------------------
function respostaDeProva(estat, cos) {
  return {
    ok: estat >= 200 && estat < 300,
    status: estat,
    json: function () {
      if (typeof cos === 'string') {
        return Promise.reject(new Error('no és JSON'));
      }
      return Promise.resolve(cos);
    },
    text: function () {
      if (typeof cos === 'string') {
        return Promise.resolve(cos);
      }
      return Promise.resolve(JSON.stringify(cos));
    }
  };
}

// ------------------------------------------------------------
// Un `fetch` de mentida que llança, per provar els camins d'excepció.
// ------------------------------------------------------------
function fetchQuePeta(error) {
  return function () {
    return Promise.reject(error);
  };
}

// ------------------------------------------------------------
// Els casos, escrits com una taula del comportament pactat.
// ------------------------------------------------------------
async function passaLaBateria() {
  var problemes = [];

  // 1. El cas bo: 200 amb secure_url.
  var xarxa = fetchDeProva(respostaDeProva(200, {
    secure_url: URL_SEGURA,
    url: 'http://res.cloudinary.com/insegura.webp'
  }));
  var resultat = await creaPujador(CLOUD_DE_PROVA, xarxa)(URL_ORIGEN);

  if (resultat.url !== URL_SEGURA) {
    problemes.push('una pujada bona hauria de tornar el secure_url, i torna «' +
                   JSON.stringify(resultat) + '»');
  }
  if (resultat.error !== undefined) {
    problemes.push('una pujada bona no ha de portar cap error');
  }

  // 2. La petició: el punt d'entrada, el mètode i els dos camps del formulari.
  if (xarxa.url !== 'https://api.cloudinary.com/v1_1/' + CLOUD_DE_PROVA + '/image/upload') {
    problemes.push('el punt d\'entrada no és el que toca: «' + xarxa.url + '»');
  }
  if (!xarxa.opcions || xarxa.opcions.method !== 'POST') {
    problemes.push('la pujada s\'ha de fer amb POST');
  }
  if (!xarxa.opcions || !(xarxa.opcions.body instanceof FormData)) {
    problemes.push('el cos ha de ser un FormData (multipart/form-data)');
  } else {
    if (xarxa.opcions.body.get('file') !== URL_ORIGEN) {
      problemes.push('el camp `file` ha de portar l\'URL d\'origen tal qual, i porta «' +
                     xarxa.opcions.body.get('file') + '»');
    }
    if (xarxa.opcions.body.get('upload_preset') !== CLOUDINARY_PRESET) {
      problemes.push('el camp `upload_preset` ha de ser «' + CLOUDINARY_PRESET + '»');
    }
  }
  if (xarxa.crides !== 1) {
    problemes.push('esperava 1 crida a la xarxa, se n\'han fet ' + xarxa.crides);
  }

  // 3. 200 sense secure_url: no es dona per bo.
  resultat = await creaPujador(CLOUD_DE_PROVA,
    fetchDeProva(respostaDeProva(200, { public_id: 'sense-url' })))(URL_ORIGEN);
  if (resultat.url !== undefined || resultat.error.indexOf('secure_url') === -1) {
    problemes.push('un 200 sense secure_url ha de ser un error clar: «' +
                   JSON.stringify(resultat) + '»');
  }

  // 4. 200 amb un cos que no és JSON.
  resultat = await creaPujador(CLOUD_DE_PROVA,
    fetchDeProva(respostaDeProva(200, '<html>vaja</html>')))(URL_ORIGEN);
  if (resultat.url !== undefined || resultat.error.indexOf('JSON') === -1) {
    problemes.push('un 200 que no és JSON ha de ser un error clar: «' +
                   JSON.stringify(resultat) + '»');
  }

  // 5. Un 400 amb el motiu del servidor a dins.
  resultat = await creaPujador(CLOUD_DE_PROVA,
    fetchDeProva(respostaDeProva(400, 'Upload preset not found')))(URL_ORIGEN);
  if (resultat.error.indexOf('400') === -1 ||
      resultat.error.indexOf('Upload preset not found') === -1) {
    problemes.push('un 400 ha de dir el codi i el motiu: «' + resultat.error + '»');
  }

  // 6. Un 500 sense cos: el codi sol ja és una frase acabada.
  resultat = await creaPujador(CLOUD_DE_PROVA,
    fetchDeProva(respostaDeProva(500, '')))(URL_ORIGEN);
  if (resultat.error !== 'Cloudinary ha respost amb el codi 500.') {
    problemes.push('un 500 sense cos hauria de dir només el codi: «' + resultat.error + '»');
  }

  // 7. Un detall llarguíssim es retalla per la darrera paraula sencera.
  var llarg = 'Motiu ';
  while (llarg.length < 400) {
    llarg = llarg + 'molt llarg ';
  }
  resultat = await creaPujador(CLOUD_DE_PROVA,
    fetchDeProva(respostaDeProva(400, llarg)))(URL_ORIGEN);
  if (resultat.error.length > MAX_DETALL + 60 || resultat.error.slice(-1) !== '…') {
    problemes.push('un detall llarg s\'ha de retallar: «' + resultat.error + '»');
  }

  // 8. La xarxa que peta: error net, mai excepció.
  resultat = await creaPujador(CLOUD_DE_PROVA,
    fetchQuePeta(new Error('getaddrinfo ENOTFOUND')))(URL_ORIGEN);
  if (resultat.url !== undefined || resultat.error.indexOf('ENOTFOUND') === -1) {
    problemes.push('una xarxa caiguda ha de tornar { error }: «' +
                   JSON.stringify(resultat) + '»');
  }

  // 9. El temps exhaurit es reconeix i es diu en segons.
  var expirat = new Error('The operation was aborted due to timeout');
  expirat.name = 'TimeoutError';
  resultat = await creaPujador(CLOUD_DE_PROVA, fetchQuePeta(expirat))(URL_ORIGEN);
  if (resultat.error !== 'Cloudinary no ha contestat en 30 segons.') {
    problemes.push('el temps exhaurit no es reconeix: «' + resultat.error + '»');
  }

  // 10. Sense nom de cloud: error, i sense gastar cap petició.
  var senseXarxa = fetchDeProva(respostaDeProva(200, { secure_url: URL_SEGURA }));
  resultat = await creaPujador('', senseXarxa)(URL_ORIGEN);
  if (resultat.error.indexOf(VARIABLE_DEL_CLOUD) === -1) {
    problemes.push('sense nom de cloud, l\'error ha de dir quina variable falta: «' +
                   resultat.error + '»');
  }
  if (senseXarxa.crides !== 0) {
    problemes.push('sense nom de cloud no s\'ha de gastar cap petició');
  }

  // 11. Sense URL d'origen: el mateix.
  var senseOrigen = fetchDeProva(respostaDeProva(200, { secure_url: URL_SEGURA }));
  resultat = await creaPujador(CLOUD_DE_PROVA, senseOrigen)('');
  if (resultat.error === undefined || senseOrigen.crides !== 0) {
    problemes.push('sense URL d\'origen no s\'ha de gastar cap petició');
  }

  // 12. La regla que no es pot trencar: cap dels casos no ha llançat, i tots han
  //     tornat una de les dues formes del contracte i mai les dues alhora.
  var formes = [
    await creaPujador(CLOUD_DE_PROVA, fetchDeProva(respostaDeProva(200, { secure_url: URL_SEGURA })))(URL_ORIGEN),
    await creaPujador(CLOUD_DE_PROVA, fetchDeProva(respostaDeProva(403, 'no')))(URL_ORIGEN),
    await creaPujador(CLOUD_DE_PROVA, fetchQuePeta(new Error('res')))(URL_ORIGEN),
    await creaPujador(CLOUD_DE_PROVA, fetchDeProva(null))(URL_ORIGEN)
  ];
  for (var i = 0; i < formes.length; i++) {
    var te = formes[i];
    var teUrl = typeof te.url === 'string' && te.url !== '';
    var teError = typeof te.error === 'string' && te.error !== '';

    if (teUrl === teError) {
      problemes.push('el cas ' + (i + 1) + ' no torna ni { url } ni { error }, o torna ' +
                     'totes dues: «' + JSON.stringify(te) + '»');
    }
  }

  console.log('ADAPTADOR DE CLOUDINARY — 12 grups de casos, cap crida real');
  console.log('');
  console.log('  preset             ' + CLOUDINARY_PRESET);
  console.log('  variable del cloud ' + VARIABLE_DEL_CLOUD +
              (nomDelCloudDeLEntorn() === '' ? '   (no és a l\'entorn ara mateix)' : '   (hi és)'));
  console.log('  temps màxim        ' + Math.round(TEMPS_MAXIM_MS / 1000) + ' s');
  console.log('');
  console.log('  NO està connectat a cap pipeline: la clau `puja` de l\'objecte');
  console.log('  d\'agents continua rebent només pujadors de mentida.');
  console.log('');

  for (var p = 0; p < problemes.length; p++) {
    console.log('MAL  ' + problemes[p]);
  }

  if (problemes.length === 0) {
    console.log('BÉ   totes les comprovacions passen.');
  } else {
    console.log(problemes.length + ' comprovacions fallades.');
    process.exitCode = 1;
  }
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    process.argv[1].indexOf('cloudinary-adapter') !== -1) {
  passaLaBateria();
}
