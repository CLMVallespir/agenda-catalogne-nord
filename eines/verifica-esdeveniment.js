// ---------------------------------------------------------------------------
// VERIFICACIÓ — contrastar la fila amb la font d'on ha sortit
//
// Una sola feina: donada una fila candidata i la referència textual a l'origen
// que porta el candidat, preguntar si el que diu la fila és COMPATIBLE amb el
// que diu la font, i deixar constància a `nota_curador` de només allò que no
// hi quadra. Res més.
//
// Això NO és una segona extracció: no torna a llegir la font per treure'n una
// fila nova, i no proposa cap valor de recanvi. És una CONTRASTACIÓ: mira la
// fila que ja tenim i la referència que ja tenim, i diu si la fila afirma
// coses que la font no diu —una data inventada, un local que no surt enlloc a
// l'origen, una descripció que hi afegeix contingut.
//
// Això TAMPOC no és criteri editorial. Si l'acte hi ha d'entrar o no ho decideix
// eines/classifica-editorial.js amb les regles R1-R7 de docs/CRITERI-EDITORIAL.md.
// Les dues peces són independents a posta: una fila pot ser NUCLI perfecte i
// tenir la data mal copiada, i una fila FORA pot estar copiada impecablement.
// No s'han de barrejar.
//
// El que aquesta peça NO fa, i no ho ha de fer mai:
//
//   - NO toca `estat`. La fila surt amb l'estat que portava.
//   - NO esborra res de `nota_curador`: l'avís s'hi ajunta al darrere.
//   - NO treu cap fila del sistema. «sospitós» és el text d'una nota i prou.
//   - NO crida l'API de Gemini. La crida arriba injectada des de fora, i per
//     això aquest fitxer es pot provar sencer sense clau i sense xarxa.
//   - NO va a buscar la font a internet. Contrasta amb el text que el candidat
//     ja porta a dins; si no en porta, ho diu i s'atura (vegeu §LIMITACIÓ).
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/verifica-esdeveniment.js            -> passa la bateria de proves
//   node eines/verifica-esdeveniment.js --prompt   -> escriu el prompt
//
// NO està connectada a res: ni a processaLot(), ni a pipelineOffline(), ni a
// cap escriptura. És la peça, no el cablejat. El cablejat es farà a part, quan
// s'hagi decidit en quin ordre van les tres notes (mapeig, classificació,
// verificació).
//
// Com classificaEditorial(), **no és idempotent**: verificar dues vegades la
// mateixa fila hi pot deixar dos avisos. Qui la cridi en bucle ha de saber
// quines files ja han passat.
//
//
// --- EL CRITERI DE SILENCI (decisió de disseny, no detall d'implementació) ---
//
// Quan el resultat és 'ok', aquesta peça **no escriu res**. És l'única
// diferència de fons amb classifica-editorial.js, que escriu sempre, i és
// deliberada: les dues peces responen preguntes de naturalesa diferent.
//
//   - La classificació respon «a quin calaix va això?». Tota fila en té
//     resposta, i el silenci hi és ambigu: una fila sense línia de
//     classificació tant pot ser una fila NUCLI com una fila que ningú no ha
//     mirat mai. Per això allà fins i tot el fracàs escriu una línia.
//
//   - La verificació respon «hi ha res que no quadri?». És un detector
//     d'excepcions. Una nota a cada fila voldria dir un avís groc a cada fitxa
//     de curador.html, i un avís que hi surt sempre és un avís que ningú no
//     llegeix. El requadre groc ha de voler dir «atura't i mira això»; si també
//     vol dir «tot bé», ja no vol dir res.
//
// El perill del silenci —no distingir «verificat i net» de «no verificat mai»—
// es limita així: **el silenci és NOMÉS per a 'ok'**. Escriuen nota el 'dubte',
// el 'sospitós', el verificador que no respon, el verificador que no hi és, la
// resposta que no s'entén i el candidat sense referència a l'origen. O sigui
// que l'única fila silenciosa que aquesta peça produeix és una fila
// contrastada i neta. Que una fila que no ha passat mai per aquí també sigui
// silenciosa és cert, i no ho pot arreglar cap nota: això depèn de qui cablegi
// la peça, i es resol al pipeline, no aquí.
//
//
// --- LIMITACIÓ CONEGUDA: candidats sense referència a l'origen --------------
//
// La referència es llegeix del bloc `metadadades.font` que ja produeix
// eines/mapeja-recerca.js —`citacio_literal`, `url`, `data_publicacio`,
// `data_acces`—, i `citacio_literal` és l'únic camp que hi porta text de debò:
// és, en paraules de docs/HANDOFF-MAPEIG-RECERCA.md, «la prova textual que
// l'acte existeix i quan». Sense aquell text no hi ha res a contrastar. Un URL
// tot sol no serveix: aquest fitxer no surt a la xarxa i no el pot obrir.
//
// Hi ha, doncs, files que aquesta peça no pot verificar i no ho intenta:
//
//   - Les que arriben ja passades per dedup si qui les passa no arrossega la
//     procedència. eines/processa-lot.js sí que la conserva —al Map de
//     metadadades, indexat per referència de fila—, però una fila que viatgi
//     sola, fora d'aquella estructura, ha perdut l'origen pel camí.
//   - Les que vénen del Worker (correu i formulari): avui no porten cap bloc
//     de metadadades.
//   - Les de recerca amb `citacio_literal` buida.
//
// En tots aquests casos s'escriu «no verificable» i s'acaba. NO s'inventa cap
// manera de recuperar l'origen: ni tornar a baixar l'URL, ni deduir-lo del
// `font_url` de la fila, ni donar per bo el text de la fila com a referència de
// si mateixa —això darrer seria demanar al model que comprovi una cosa amb ella
// mateixa, que sempre diu que sí.
// ---------------------------------------------------------------------------


// --- El que ve de fora ------------------------------------------------------

// L'única importació d'aquest fitxer: la regla d'ajuntar dues notes de curador.
// Es reutilitza en comptes de copiar-la perquè és la mateixa regla —les dues
// notes, mai una— i ha de dir el mateix a tot arreu. Vegeu el peu
// d'eines/dedup-esdeveniments.js i la capçalera d'eines/classifica-editorial.js.
var dedup = require('./dedup-esdeveniments.js');

// I la neteja del text de font. Cap camp no entra a un prompt sense passar-hi,
// ni els de la fila ni la citació de la referència: totes dues bandes poden
// venir d'una font que serveix HTML. Vegeu la capçalera d'eines/neteja-text.js.
var neteja = require('./neteja-text.js');


// --- Constants: els tres resultats i els camps que es contrasten ------------

// Els tres resultats possibles. Cap altre valor no és un resultat.
//
//   ok         tot el que diu la fila té suport a la referència.
//   dubte      hi ha alguna cosa que la referència no confirma ni desmenteix.
//   sospitós   la fila afirma alguna cosa que la referència contradiu o que no
//              apareix enlloc a l'origen.
var RESULTATS = ['ok', 'dubte', 'sospitós'];

// Els camps que tenen sentit contrastar amb la font: els que descriuen l'acte i
// que la font havia de dir. `comarca` i `categoria` NO hi són a posta —són
// taxonomia nostra, decidida per mapejaAProduccio() amb valorPermes(), i no
// surten mai a la font original: preguntar-ho donaria «sospitós» a totes les
// files. `estat`, `data_entrada`, `id` i `nota_curador` els omple el sistema, i
// `imatge_url` és una pujada nostra a Cloudinary.
var CAMPS_CONTRASTABLES = [
  'titol', 'data_inici', 'data_fi', 'hora', 'lloc', 'municipi',
  'descripcio_ca', 'descripcio_fr', 'associacio'
];

// Com comença tota nota escrita per aquesta peça. Serveix per a dues coses: que
// el curador reconegui d'un cop d'ull que això ho ha escrit una màquina, i que
// qui llegeixi la nota sàpiga on acaba el que hi havia abans.
var MARCA_VERIFICACIO = '[Verificació: ';

// Fins on s'accepta el raonament del model. És una línia per al curador, no un
// paràgraf: el que passi d'aquí es retalla per la darrera paraula sencera.
var MAX_MOTIU = 160;

// Quants camps afectats caben a la nota. Si el model n'assenyala més, la fila
// té un problema de fons i la llista llarga no hi afegeix res.
var MAX_CAMPS = 4;

// El separador de dues citacions quan la fila ve d'una fusió i porta més d'una
// procedència. Es contrasten totes: la fila fusionada afirma coses que poden
// venir de qualsevol de les fonts que l'han format.
var SEPARADOR_CITACIONS = ' | ';


// --- Constants: la crida a Gemini (declarada, no executada) -----------------
//
// Aquest fitxer no crida res. Les constants hi són perquè el dia que algú
// cablegi la crida de debò no s'hagi d'inventar la configuració ni tornar a
// llegir el §7 de CLAUDE.md.

// El nom del model viu en UNA constant, com al Worker. Mai la gamma Pro, que és
// de pagament. Un 404 amb el nom del model a dins és cicle de vida normal de
// Google: mira quins Flash / Flash-Lite hi ha vigents i canvia-la.
var GEMINI_MODEL = 'gemini-3.5-flash-lite';
var GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';

// La resposta són tres camps curts: 512 tokens hi caben de sobres.
var GEMINI_MAX_TOKENS = 512;

// Igual que al Worker: JSON garantit, sense `temperature` (els models 3.x la
// ignoren) i sense `thinkingBudget` (llegat, incompatible amb thinkingLevel).
// `low` i no `minimal`: comparar dos textos i dir què hi falta és una feina de
// raonament curt, no una extracció.
var CONFIGURACIO_GEMINI = {
  maxOutputTokens: GEMINI_MAX_TOKENS,
  responseMimeType: 'application/json',
  thinkingConfig: { thinkingLevel: 'low' }
};


// --- El prompt --------------------------------------------------------------
//
// Tot el prompt està escrit per evitar l'error car d'aquesta tasca: que el
// model faci de segon extractor i «millori» la fila. No se li demana cap valor,
// només un veredicte. I se li diu explícitament que la referència és parcial:
// una citació literal és un fragment de la font, no la font sencera, i el que
// no hi surt és «dubte», no «sospitós».
var PROMPT_VERIFICACIO = [
  'Ets el verificador de l\'agenda cultural «Què fas?» de Catalunya Nord. La',
  'teva única feina és dir si una fitxa d\'esdeveniment és COMPATIBLE amb la',
  'referència textual de la font d\'on s\'ha tret.',
  '',
  'NO extreguis res. NO proposis valors nous. NO corregeixis la fitxa. NO jutgis',
  'si l\'acte mereix sortir a l\'agenda: això ho decideix una altra peça.',
  '',
  'La referència és un FRAGMENT de la font, no la font sencera. Per tant:',
  '- Una dada de la fitxa que la referència CONTRADIU és un problema greu.',
  '- Una dada que la referència no diu enlloc i que no es pot deduir de res del',
  '  que diu és un problema: pot ser inventada.',
  '- Una dada que la referència no diu però que és plausible perquè el fragment',
  '  és curt NO és un problema greu: és un dubte.',
  '- Una traducció fidel al català o al francès del que diu la referència NO és',
  '  cap problema. Els noms de poble en forma catalana (Perpinyà per Perpignan,',
  '  Prada per Prades, Ceret per Céret) tampoc.',
  '',
  'RESULTAT:',
  'ok        tot el que afirma la fitxa té suport a la referència.',
  'dubte     hi ha alguna cosa que la referència no confirma ni desmenteix.',
  'sospitós  la fitxa afirma alguna cosa que la referència contradiu, o que no',
  '          apareix enlloc a l\'origen i no se\'n dedueix.',
  '',
  'CAMPS_AFECTATS: només noms de camp d\'aquesta llista, i només els que tinguin',
  'problema. Si el resultat és ok, la llista va buida.',
  'titol, data_inici, data_fi, hora, lloc, municipi, descripcio_ca,',
  'descripcio_fr, associacio',
  '',
  'MOTIU: UNA sola frase curta en català, dient què no quadra i prou. Si el',
  'resultat és ok, una frase curta que ho digui.',
  '',
  'Respon NOMÉS amb aquest JSON, sense preàmbul i sense tanques markdown:',
  '{"resultat":"ok|dubte|sospitós","camps_afectats":["..."],"motiu":"..."}',
  ''
].join('\n');


// --- La funció --------------------------------------------------------------

// ------------------------------------------------------------
// Verifica un candidat i li escriu l'avís a `nota_curador` si n'hi ha cap.
//
//   candidat     { fila, font: { tipus, llengua } }, la mateixa forma que
//                accepten dedup-esdeveniments.js i classifica-editorial.js,
//                MÉS la referència a l'origen, que ha de venir en un d'aquests
//                dos camps, tots dos ja existents al sistema:
//                  metadadades  el que torna mapejaAProduccio()
//                  procedencia  la llista de metadadades que munta processaLot()
//   cridaGemini  funció injectada. Se la crida amb (fila, referenciaOriginal) i
//                ha de tornar una promesa de
//                { resultat, camps_afectats, motiu }.
//
// Torna SEMPRE el candidat, amb la fila copiada. No llança mai: una verificació
// que falla és una nota que ho diu, no una fila perduda. Si el resultat és
// 'ok', la fila surt amb la nota que ja portava, sense afegir-hi res (vegeu el
// §EL CRITERI DE SILENCI de la capçalera).
// ------------------------------------------------------------
async function verificaEsdeveniment(candidat, cridaGemini) {
  var entrada = candidat || {};
  var fila = copiaFila(entrada.fila);
  var referencia = referenciaOriginalDe(entrada);
  var nota = '';

  if (typeof cridaGemini !== 'function') {
    nota = notaNoVerificable('no hi ha cap verificador connectat');
  } else if (referencia === null) {
    nota = notaNoVerificable('el candidat no porta cap referència a l\'origen');
  } else if (textPerVerificar(fila) === '') {
    nota = notaNoVerificable('la fila no porta cap dada per contrastar');
  } else {
    nota = await notaDelVerificador(fila, referencia, cridaGemini);
  }

  // L'ÚNIC camp que aquesta peça toca, i només quan hi ha alguna cosa a dir. La
  // nota que hi havia va davant: és més antiga i ajuntaNotes() ja sap que una
  // nota buida no afegeix res.
  fila.nota_curador = dedup.ajuntaNotes(fila.nota_curador, nota);

  return candidatAmbFila(entrada, fila);
}

// ------------------------------------------------------------
// Fa la crida i en treu la nota. Separada de la funció principal perquè el
// try/catch no s'hi barregi amb les tres guardes de dalt.
//
// Torna '' quan el veredicte és 'ok': és aquí, i només aquí, on es decideix el
// silenci.
// ------------------------------------------------------------
async function notaDelVerificador(fila, referencia, cridaGemini) {
  var resposta = null;

  try {
    resposta = await cridaGemini(fila, referencia);
  } catch (error) {
    return notaNoVerificable('el verificador no ha respost (' + missatgeDError(error) + ')');
  }

  var veredicte = interpretaResposta(resposta);
  if (veredicte === null) {
    return notaNoVerificable('el verificador ha respost una cosa que no és cap dels tres resultats');
  }

  if (veredicte.resultat === 'ok') {
    return '';
  }

  return notaDeVeredicte(veredicte);
}


// --- Les peces: les dues menes de nota --------------------------------------

// ------------------------------------------------------------
// La nota d'un veredicte amb problema: el resultat, els camps assenyalats i una
// línia de raonament.
//
//   [Verificació: sospitós — data_inici] La font parla d'octubre i la fila diu
//   setembre.
//
// Si el model no ha sabut dir quin camp falla, la nota surt igualment sense la
// llista: el curador ha de saber que hi ha un problema encara que no se
// n'assenyali el lloc exacte.
// ------------------------------------------------------------
function notaDeVeredicte(veredicte) {
  if (veredicte.camps.length === 0) {
    return MARCA_VERIFICACIO + veredicte.resultat + '] ' + veredicte.motiu;
  }

  return MARCA_VERIFICACIO + veredicte.resultat + ' — ' +
    veredicte.camps.join(', ') + '] ' + veredicte.motiu;
}

// ------------------------------------------------------------
// La nota de quan no s'ha pogut verificar. Aquesta SÍ que s'escriu sempre, i és
// el que fa que el silenci del cas 'ok' es pugui llegir: si no hi ha cap línia
// de verificació, o bé la fila és neta o bé ningú no ha passat aquesta peça pel
// lot. El que no pot passar mai és que una verificació hagi fallat en silenci.
// ------------------------------------------------------------
function notaNoVerificable(motiu) {
  return MARCA_VERIFICACIO + 'no disponible] Sense verificar: ' + motiu + '.';
}


// --- Les peces: llegir el que torna el model --------------------------------

// ------------------------------------------------------------
// Converteix el que hagi respost el verificador en un veredicte bo, o en null
// si no ho és. Un model pot tornar un resultat inventat, camps que no existeixen
// o un motiu de tres paràgrafs, i cap de les tres coses no ha d'arribar mai a la
// nota del curador.
// ------------------------------------------------------------
function interpretaResposta(resposta) {
  if (resposta === null || typeof resposta !== 'object') {
    return null;
  }

  var resultat = normalitzaResultat(resposta.resultat);
  if (resultat === '') {
    return null;
  }

  return {
    resultat: resultat,
    camps: normalitzaCamps(resposta.camps_afectats),
    motiu: netejaMotiu(resposta.motiu)
  };
}

// ------------------------------------------------------------
// El resultat, coercit als tres permesos. Es compara sense accents i en
// minúscules a posta: un model que escrigui «sospitos» vol dir «sospitós», i
// llençar la resposta per un accent seria perdre un avís bo.
// ------------------------------------------------------------
function normalitzaResultat(valor) {
  var text = senseAccents(cadena(valor).toLowerCase());

  for (var i = 0; i < RESULTATS.length; i++) {
    if (text === senseAccents(RESULTATS[i].toLowerCase())) {
      return RESULTATS[i];
    }
  }

  return '';
}

// ------------------------------------------------------------
// Els camps assenyalats, reduïts als contrastables i sense repeticions. Un nom
// que no sigui d'aquesta llista es descarta en silenci: si el model diu que el
// problema és a `estat` o a `nota_curador` és que s'ha perdut, i posar-ho a la
// nota faria anar el curador a mirar un camp que no li ha tocat ningú.
// ------------------------------------------------------------
function normalitzaCamps(valor) {
  if (!Array.isArray(valor)) {
    return [];
  }

  var bons = [];

  for (var i = 0; i < valor.length; i++) {
    var nom = cadena(valor[i]).toLowerCase();

    if (CAMPS_CONTRASTABLES.indexOf(nom) !== -1 && bons.indexOf(nom) === -1) {
      bons.push(nom);
    }

    if (bons.length === MAX_CAMPS) {
      return bons;
    }
  }

  return bons;
}

// ------------------------------------------------------------
// El motiu, reduït a una línia llegible: salts de línia i espais dobles fora,
// retallat a MAX_MOTIU per la darrera paraula sencera, i acabat en punt perquè
// s'ajunti bé amb les altres notes de la fila.
//
// Un motiu buit no invalida la resposta: el resultat i els camps ja diuen prou.
// ------------------------------------------------------------
function netejaMotiu(valor) {
  var text = cadena(valor).replace(/\s+/g, ' ').trim();

  if (text === '') {
    return 'Sense motiu.';
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


// --- Les peces: la referència a l'origen ------------------------------------

// ------------------------------------------------------------
// La referència textual a l'origen que porta el candidat, o null si no en porta
// cap d'aprofitable.
//
// No s'inventa cap camp nou: es llegeix el bloc `font` de les metadadades que ja
// produeix mapejaAProduccio() —el mateix que processaLot() guarda a
// `procedencia`— i que docs/HANDOFF-MAPEIG-RECERCA.md descriu com la provenença
// de la fila. Els noms de dins es conserven tal com són allà.
//
// S'accepten les dues formes en què el sistema ja transporta això:
//   candidat.metadadades   un sol bloc, tal com surt de mapejaAProduccio()
//   candidat.procedencia   una llista de blocs, tal com la munta processaLot()
//                          (una fila fusionada en porta un per candidat)
//
// Una fila fusionada es contrasta amb TOTES les seves citacions juntes, no
// només amb la de la font guanyadora: la fila afirma coses que poden venir de
// qualsevol de les fonts que l'han format.
//
// Sense `citacio_literal` no hi ha referència, encara que hi hagi URL: aquest
// fitxer no surt a la xarxa i un URL que no pot obrir no és cap prova.
// ------------------------------------------------------------
function referenciaOriginalDe(candidat) {
  var blocs = blocsDeFont(candidat);
  var citacions = [];
  var referencia = {
    citacio_literal: '',
    url: '',
    data_publicacio: '',
    data_acces: ''
  };

  for (var i = 0; i < blocs.length; i++) {
    var bloc = blocs[i];
    var citacio = cadena(bloc.citacio_literal);

    if (citacio !== '' && citacions.indexOf(citacio) === -1) {
      citacions.push(citacio);
    }

    // Dels camps curts, el primer que en porti. Serveixen de context al model
    // («això és d'un butlletí de març»), no de prova.
    referencia.url = primerNoBuit(referencia.url, bloc.url);
    referencia.data_publicacio = primerNoBuit(referencia.data_publicacio, bloc.data_publicacio);
    referencia.data_acces = primerNoBuit(referencia.data_acces, bloc.data_acces);
  }

  if (citacions.length === 0) {
    return null;
  }

  referencia.citacio_literal = citacions.join(SEPARADOR_CITACIONS);
  return referencia;
}

// ------------------------------------------------------------
// Els blocs `font` que porti el candidat, vinguin d'on vinguin, en una llista.
// Si no en porta cap, la llista és buida i qui crida ja decidirà què fer-ne.
// ------------------------------------------------------------
function blocsDeFont(candidat) {
  var blocs = [];

  if (candidat.metadadades && candidat.metadadades.font) {
    blocs.push(candidat.metadadades.font);
  }

  if (Array.isArray(candidat.procedencia)) {
    for (var i = 0; i < candidat.procedencia.length; i++) {
      var metadada = candidat.procedencia[i];
      if (metadada && metadada.font) {
        blocs.push(metadada.font);
      }
    }
  }

  return blocs;
}

// ------------------------------------------------------------
// El primer dels dos valors que porti text. Serveix per anar omplint la
// referència amb el primer bloc que digui alguna cosa.
// ------------------------------------------------------------
function primerNoBuit(actual, candidat) {
  if (cadena(actual) !== '') {
    return cadena(actual);
  }
  return cadena(candidat);
}


// --- Les peces: la fila -----------------------------------------------------

// ------------------------------------------------------------
// La fitxa tal com se li ensenya al model: els camps contrastables i prou. La
// taxonomia nostra (`comarca`, `categoria`) i els camps del sistema no hi són,
// pel mateix motiu que no surten a CAMPS_CONTRASTABLES.
// ------------------------------------------------------------
function fitxaPerAlModel(fila) {
  var linies = [];

  for (var i = 0; i < CAMPS_CONTRASTABLES.length; i++) {
    var camp = CAMPS_CONTRASTABLES[i];
    linies.push(camp + ': ' + textNet(fila[camp]));
  }

  return linies.join('\n');
}

// ------------------------------------------------------------
// Un camp tal com se li ha d'ensenyar al model: net. La fila NO es toca —el
// que arriba a pendents.json és cosa del mapeig, no d'aquesta peça—; el que
// es neteja és la còpia que viatja dins del prompt.
// ------------------------------------------------------------
function textNet(valor) {
  return neteja.netejaTextFont(valor);
}

// ------------------------------------------------------------
// La referència tal com se li ensenya al model, amb els noms de camp explicats:
// la citació és la prova, l'URL i les dates són context.
// ------------------------------------------------------------
function referenciaPerAlModel(referencia) {
  return [
    'Citació literal de la font (això és la prova): ' + textNet(referencia.citacio_literal),
    'Enllaç de la font: ' + cadena(referencia.url),
    'Data de publicació de la font: ' + cadena(referencia.data_publicacio),
    'Data en què s\'hi va accedir: ' + cadena(referencia.data_acces)
  ].join('\n');
}

// ------------------------------------------------------------
// El prompt sencer d'una fila: les instruccions, la referència i la fitxa. La
// referència va DAVANT de la fitxa a posta: es llegeix primer la prova i
// després el que s'hi ha de contrastar, no al revés.
// ------------------------------------------------------------
function construeixPrompt(fila, referencia) {
  return PROMPT_VERIFICACIO +
    '\nREFERÈNCIA DE LA FONT:\n' + referenciaPerAlModel(referencia || {}) +
    '\n\nFITXA A VERIFICAR:\n' + fitxaPerAlModel(fila || {});
}

// ------------------------------------------------------------
// El cos exacte d'una petició a Gemini per a aquesta tasca. Aquest fitxer no
// l'envia: el munta i prou, perquè es pugui llegir i provar sense clau.
// ------------------------------------------------------------
function construeixCosGemini(fila, referencia) {
  return {
    contents: [
      { parts: [ { text: construeixPrompt(fila, referencia) } ] }
    ],
    generationConfig: CONFIGURACIO_GEMINI
  };
}

// ------------------------------------------------------------
// Diu si la fila porta cap dada contrastable. Una fila sense títol, ni dates, ni
// lloc, ni descripcions no es pot verificar, i preguntar-ho igualment és gastar
// una crida a Gemini per rebre una endevinalla.
// ------------------------------------------------------------
function textPerVerificar(fila) {
  var text = '';

  for (var i = 0; i < CAMPS_CONTRASTABLES.length; i++) {
    text += textNet(fila[CAMPS_CONTRASTABLES[i]]);
  }

  return text.trim();
}

// ------------------------------------------------------------
// Una còpia de la fila, per no tocar mai la que ens han donat. Es copien les
// claus que porti, en el seu ordre: reordenar-la o completar-la als disset
// camps no és feina d'aquesta peça, que només n'escriu un.
// ------------------------------------------------------------
function copiaFila(fila) {
  var original = fila || {};
  var copia = {};
  var claus = Object.keys(original);

  for (var i = 0; i < claus.length; i++) {
    copia[claus[i]] = cadena(original[claus[i]]);
  }

  // Si la fila venia sense el camp, hi entra ara i queda l'últim, que és on li
  // toca ser a l'esquema del §4 de CLAUDE.md.
  if (copia.nota_curador === undefined) {
    copia.nota_curador = '';
  }

  return copia;
}

// ------------------------------------------------------------
// El candidat de sortida: el mateix que ha entrat, amb la fila nova. Es copien
// totes les claus, no només `fila` i `font`, perquè la procedència i qualsevol
// altra cosa que hi hagi penjada no es perdi pel camí.
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
// Un text sense accents ni dièresis, per poder comparar «sospitos» amb
// «sospitós». El rang ̀-ͯ són les marques diacrítiques que la
// descomposició NFD deixa separades de la lletra.
// ------------------------------------------------------------
function senseAccents(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
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
// La funció, i les tres peces que necessita qui cablegi la crida de debò: el
// prompt, el prompt d'una fila i el cos de la petició. Cap d'elles no envia res.

module.exports = {
  verificaEsdeveniment: verificaEsdeveniment,
  PROMPT_VERIFICACIO: PROMPT_VERIFICACIO,
  construeixPrompt: construeixPrompt,
  construeixCosGemini: construeixCosGemini
};


// --- Proves des del terminal ------------------------------------------------
// Tot el que ve a partir d'aquí és per poder exercitar la funció a mà. No forma
// part de la peça i no s'ha de copiar enlloc.

// Els disset camps, per muntar files de prova senceres.
var CAMPS = [
  'id', 'titol', 'data_inici', 'data_fi', 'hora', 'lloc', 'municipi',
  'comarca', 'categoria', 'descripcio_ca', 'descripcio_fr', 'associacio',
  'imatge_url', 'font_url', 'estat', 'data_entrada', 'nota_curador'
];

// ------------------------------------------------------------
// Una fila de prova: els disset camps, buits, amb els que interessin a sobre.
// ------------------------------------------------------------
function filaDeProva(extres) {
  var fila = {};

  for (var i = 0; i < CAMPS.length; i++) {
    fila[CAMPS[i]] = '';
  }

  fila.estat = 'pendent';
  fila.data_entrada = '2026-08-29T10:00:00.000Z';

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
// mapejaAProduccio(). Només s'hi omple el bloc `font`, que és l'únic que
// aquesta peça mira.
// ------------------------------------------------------------
function metadadadesDeProva(citacio, url) {
  return {
    font: {
      url: url || 'https://exemple.cat/agenda',
      data_publicacio: '2026-07-01',
      data_acces: '2026-08-20',
      citacio_literal: citacio
    },
    confianca: { nivell: 'A', confirmacio: '', vitalitat: '', motiu_null: '' },
    llengua: { titol: 'fr', descripcio: 'fr', esdeveniment: '' },
    descartats: {},
    avisos: []
  };
}

// ------------------------------------------------------------
// Un verificador de mentida que sempre respon el mateix. És el que fa que la
// bateria no necessiti ni clau ni xarxa: el que es prova aquí és el que la peça
// fa amb la resposta, no si el model encerta.
// ------------------------------------------------------------
function respostaFixa(resposta) {
  return function () {
    return Promise.resolve(resposta);
  };
}

// ------------------------------------------------------------
// Un verificador de mentida que peta, per provar el camí de l'error.
// ------------------------------------------------------------
function verificadorQuePeta(missatge) {
  return function () {
    return Promise.reject(new Error(missatge));
  };
}

// Una nota de mapeig i una de classificació, tal com les escriuen de debò
// mapejaAProduccio() i classificaEditorial(). Serveixen per provar que les tres
// notes s'apilen en ordre i que cap no s'esborra.
var NOTA_MAPEIG = 'El títol ve en «fr» i no hi ha versió catalana: cal traduir-lo.';
var NOTA_CLASSIFICACIO = '[Suggeriment editorial: NUCLI — R6] Mercat setmanal que sosté els petits productors.';

// ------------------------------------------------------------
// Els casos. Els primers proven els tres resultats per separat; després,
// l'apilament de notes, la neteja del que respon el model, d'on surt la
// referència, i finalment tot el que ha de passar quan res no va bé.
// ------------------------------------------------------------
function casosDeProva() {
  return [
    // --- Els tres resultats, un per un ---
    {
      nom: 'Resultat ok: no s\'escriu cap nota (criteri de silenci)',
      fila: filaDeProva({
        titol: 'Mercat de Prada', data_inici: '2026-09-15', municipi: 'Prada'
      }),
      citacio: 'Tous les mardis matin, le marché de Prades.',
      resposta: { resultat: 'ok', camps_afectats: [], motiu: 'Tot quadra amb la citació.' },
      esperaNota: ''
    },
    {
      nom: 'Resultat dubte: nota amb el camp que no es pot confirmar',
      fila: filaDeProva({
        titol: 'Mercat de Prada', data_inici: '2026-09-15', hora: '08:00',
        municipi: 'Prada'
      }),
      citacio: 'Tous les mardis matin, le marché de Prades.',
      resposta: {
        resultat: 'dubte', camps_afectats: ['hora'],
        motiu: 'La citació no dona cap hora concreta'
      },
      esperaNota: '[Verificació: dubte — hora] La citació no dona cap hora concreta.'
    },
    {
      nom: 'Resultat sospitós: nota amb el camp que no surt a la font',
      fila: filaDeProva({
        titol: 'Concert de tardor', data_inici: '2026-09-14',
        lloc: 'Església de Sant Pere', municipi: 'Prada'
      }),
      citacio: 'Concert d\'automne, en octobre, à Prades.',
      resposta: {
        resultat: 'sospitós', camps_afectats: ['data_inici'],
        motiu: 'La font parla d\'octubre i la fila diu setembre'
      },
      esperaNota: '[Verificació: sospitós — data_inici] La font parla d\'octubre i la fila diu setembre.'
    },
    {
      nom: 'Sospitós amb dos camps: tots dos surten a la nota',
      fila: filaDeProva({
        titol: 'Ball a Prats', data_inici: '2026-09-14', lloc: 'Sala polivalent',
        municipi: 'Prats de Molló'
      }),
      citacio: 'Bal à Prats-de-Mollo, date à confirmer.',
      resposta: {
        resultat: 'sospitós', camps_afectats: ['data_inici', 'lloc'],
        motiu: 'Ni la data ni la sala no apareixen a la font'
      },
      esperaNota: '[Verificació: sospitós — data_inici, lloc] Ni la data ni la sala no apareixen a la font.'
    },
    {
      nom: 'Sospitós sense cap camp assenyalat: la nota surt igualment',
      fila: filaDeProva({ titol: 'Festa major', data_inici: '2026-09-14', municipi: 'Elna' }),
      citacio: 'Rien de tel n\'est annoncé.',
      resposta: { resultat: 'sospitós', camps_afectats: [], motiu: 'La fitxa no s\'assembla gens a la font' },
      esperaNota: '[Verificació: sospitós] La fitxa no s\'assembla gens a la font.'
    },

    // --- L'apilament de les tres notes ---
    {
      nom: 'Tres notes seguides: mapeig, classificació i verificació, en ordre',
      fila: filaDeProva({
        titol: 'Grand marché de Prades', data_inici: '2026-09-15', municipi: 'Prada',
        nota_curador: NOTA_MAPEIG + ' ' + NOTA_CLASSIFICACIO
      }),
      citacio: 'Tous les mardis matin.',
      resposta: {
        resultat: 'dubte', camps_afectats: ['data_inici'],
        motiu: 'La citació diu «cada dimarts» però no dona cap data concreta'
      },
      esperaNota: NOTA_MAPEIG + ' ' + NOTA_CLASSIFICACIO + ' ' +
        '[Verificació: dubte — data_inici] La citació diu «cada dimarts» però no dona cap data concreta.'
    },
    {
      nom: 'Resultat ok amb notes prèvies: no s\'hi toca res',
      fila: filaDeProva({
        titol: 'Grand marché de Prades', data_inici: '2026-09-15', municipi: 'Prada',
        nota_curador: NOTA_MAPEIG + ' ' + NOTA_CLASSIFICACIO
      }),
      citacio: 'Le marché de Prades, le 15 septembre 2026.',
      resposta: { resultat: 'ok', camps_afectats: [], motiu: 'Tot quadra.' },
      esperaNota: NOTA_MAPEIG + ' ' + NOTA_CLASSIFICACIO
    },
    {
      nom: 'Una fila sense nota_curador el rep, i queda l\'últim camp',
      fila: { titol: 'Concert de Nadal', data_inici: '2026-12-20', municipi: 'Elna', estat: 'pendent' },
      citacio: 'Concert de Noël à Elne, le 21 décembre.',
      resposta: { resultat: 'sospitós', camps_afectats: ['data_inici'], motiu: 'La font diu el 21' },
      esperaNota: '[Verificació: sospitós — data_inici] La font diu el 21.',
      esperaDarrerCamp: 'nota_curador'
    },

    // --- La neteja del que respon el model ---
    {
      nom: '«sospitos» sense accent és «sospitós»',
      fila: filaDeProva({ titol: 'Exposició', data_inici: '2026-09-14', municipi: 'Ceret' }),
      citacio: 'Exposition à Céret.',
      resposta: { resultat: 'SOSPITOS', camps_afectats: ['DATA_INICI'], motiu: 'Cap data a la font' },
      esperaNota: '[Verificació: sospitós — data_inici] Cap data a la font.'
    },
    {
      nom: 'Camps inventats o del sistema: es descarten i no arriben a la nota',
      fila: filaDeProva({ titol: 'Exposició', data_inici: '2026-09-14', municipi: 'Ceret' }),
      citacio: 'Exposition à Céret.',
      resposta: {
        resultat: 'dubte',
        camps_afectats: ['estat', 'nota_curador', 'categoria', 'inventat', 'lloc'],
        motiu: 'Només el lloc és dubtós'
      },
      esperaNota: '[Verificació: dubte — lloc] Només el lloc és dubtós.'
    },
    {
      nom: 'Camps repetits o massa nombrosos: la llista es retalla',
      fila: filaDeProva({ titol: 'Exposició', data_inici: '2026-09-14', municipi: 'Ceret' }),
      citacio: 'Exposition à Céret.',
      resposta: {
        resultat: 'sospitós',
        camps_afectats: ['titol', 'titol', 'data_inici', 'data_fi', 'hora', 'lloc', 'municipi'],
        motiu: 'La fitxa no té res a veure amb la font'
      },
      esperaNota: '[Verificació: sospitós — titol, data_inici, data_fi, hora] La fitxa no té res a veure amb la font.'
    },
    {
      nom: 'Un motiu de tres paràgrafs es retalla a una línia',
      fila: filaDeProva({ titol: 'Fira del llibre', data_inici: '2026-09-14', municipi: 'Perpinyà' }),
      citacio: 'Salon du livre, Perpignan.',
      resposta: {
        resultat: 'dubte', camps_afectats: ['descripcio_ca'],
        motiu: 'La descripció catalana afegeix que hi haurà taules rodones amb editors ' +
          'de tot el Principat i una secció infantil,\ni cap d\'aquestes dues coses no ' +
          'apareix enlloc a la citació literal de la font, que només anuncia el saló ' +
          'amb la data i el lloc.'
      },
      esperaConte: '…',
      esperaMaxLlargada: MAX_MOTIU + 80
    },
    {
      nom: 'Un motiu buit no invalida el veredicte',
      fila: filaDeProva({ titol: 'Fira del llibre', data_inici: '2026-09-14', municipi: 'Perpinyà' }),
      citacio: 'Salon du livre, Perpignan.',
      resposta: { resultat: 'dubte', camps_afectats: ['hora'], motiu: '' },
      esperaNota: '[Verificació: dubte — hora] Sense motiu.'
    },

    // --- D'on surt la referència a l'origen ---
    {
      nom: 'La referència surt de «procedencia», la forma que munta processaLot()',
      fila: filaDeProva({ titol: 'Mercat de Prada', data_inici: '2026-09-15', municipi: 'Prada' }),
      procedencia: [metadadadesDeProva('Tous les mardis matin, le marché de Prades.')],
      resposta: { resultat: 'dubte', camps_afectats: ['data_inici'], motiu: 'Sense data concreta' },
      esperaNota: '[Verificació: dubte — data_inici] Sense data concreta.',
      esperaCitacio: 'Tous les mardis matin, le marché de Prades.'
    },
    {
      nom: 'Fila fusionada: es contrasta amb les citacions de totes dues fonts',
      fila: filaDeProva({ titol: 'Mercat de Prada', data_inici: '2026-09-15', municipi: 'Prada' }),
      procedencia: [
        metadadadesDeProva('Tous les mardis matin.'),
        metadadadesDeProva('Le 15 septembre, marché de Prades.')
      ],
      resposta: { resultat: 'ok', camps_afectats: [], motiu: 'Tot quadra.' },
      esperaNota: '',
      esperaCitacio: 'Tous les mardis matin. | Le 15 septembre, marché de Prades.'
    },

    // --- El que ha de passar quan res no va bé ---
    {
      nom: 'Resultat inventat pel model: no s\'escriu cap veredicte fals',
      fila: filaDeProva({ titol: 'Concert de tardor', data_inici: '2026-09-14', municipi: 'Elna' }),
      citacio: 'Concert d\'automne à Elne.',
      resposta: { resultat: 'potser', camps_afectats: [], motiu: 'No ho sé' },
      esperaNota: '[Verificació: no disponible] Sense verificar: el verificador ha respost una cosa que no és cap dels tres resultats.'
    },
    {
      nom: 'El verificador peta: la fila surt igualment, amb la nota que ho diu',
      fila: filaDeProva({ titol: 'Concert de tardor', data_inici: '2026-09-14', municipi: 'Elna' }),
      citacio: 'Concert d\'automne à Elne.',
      verificador: verificadorQuePeta('429 Too Many Requests'),
      esperaNota: '[Verificació: no disponible] Sense verificar: el verificador no ha respost (429 Too Many Requests).'
    },
    {
      nom: 'El verificador peta enmig d\'un lot: les altres files continuen',
      esLot: true
    },
    {
      nom: 'Sense verificador connectat: la fila surt igualment',
      fila: filaDeProva({ titol: 'Concert de tardor', data_inici: '2026-09-14', municipi: 'Elna' }),
      citacio: 'Concert d\'automne à Elne.',
      senseVerificador: true,
      esperaNota: '[Verificació: no disponible] Sense verificar: no hi ha cap verificador connectat.'
    },
    {
      nom: 'Candidat sense cap metadada: no verificable, i no es gasta cap crida',
      fila: filaDeProva({ titol: 'Concert de tardor', data_inici: '2026-09-14', municipi: 'Elna' }),
      senseReferencia: true,
      resposta: { resultat: 'ok', camps_afectats: [], motiu: 'No hauria de sortir mai' },
      esperaNota: '[Verificació: no disponible] Sense verificar: el candidat no porta cap referència a l\'origen.',
      esperaSenseCrida: true
    },
    {
      nom: 'Metadada amb citació buida: un URL tot sol no és cap referència',
      fila: filaDeProva({ titol: 'Concert de tardor', data_inici: '2026-09-14', municipi: 'Elna' }),
      citacio: '',
      resposta: { resultat: 'ok', camps_afectats: [], motiu: 'No hauria de sortir mai' },
      esperaNota: '[Verificació: no disponible] Sense verificar: el candidat no porta cap referència a l\'origen.',
      esperaSenseCrida: true
    },
    {
      nom: 'Fila sense cap dada contrastable: no es gasta cap crida',
      fila: filaDeProva({ comarca: 'Conflent', categoria: 'Mercat' }),
      citacio: 'Le marché de Prades.',
      resposta: { resultat: 'ok', camps_afectats: [], motiu: 'No hauria de sortir mai' },
      esperaNota: '[Verificació: no disponible] Sense verificar: la fila no porta cap dada per contrastar.',
      esperaSenseCrida: true
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
// Un cas: es verifica i es comprova el que vigila, més el que han de complir
// tots sense excepció.
// ------------------------------------------------------------
async function provaUnCas(cas) {
  var problemes = [];
  var crides = 0;
  var referenciaRebuda = null;

  var verificador = null;
  if (cas.verificador) {
    verificador = cas.verificador;
  } else if (!cas.senseVerificador) {
    verificador = function (fila, referencia) {
      crides += 1;
      referenciaRebuda = referencia;
      return respostaFixa(cas.resposta)(fila, referencia);
    };
  }

  var candidat = { fila: cas.fila, font: { tipus: 'agregador', llengua: 'fr' } };

  if (cas.procedencia) {
    candidat.procedencia = cas.procedencia;
  } else if (cas.senseReferencia !== true) {
    candidat.metadadades = metadadadesDeProva(cas.citacio);
  }

  var resultat = await verificaEsdeveniment(candidat, verificador);
  var nota = resultat.fila.nota_curador;

  // El que vigila aquest cas.
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
    problemes.push('s\'ha cridat el verificador ' + crides + ' vegada(es) i no calia');
  }
  if (cas.esperaCitacio !== undefined) {
    var citacio = referenciaRebuda ? referenciaRebuda.citacio_literal : '(cap crida)';
    if (citacio !== cas.esperaCitacio) {
      problemes.push('citació rebuda: esperava «' + cas.esperaCitacio + '», tinc «' + citacio + '»');
    }
  }
  if (cas.esperaDarrerCamp !== undefined) {
    var claus = Object.keys(resultat.fila);
    if (claus[claus.length - 1] !== cas.esperaDarrerCamp) {
      problemes.push('l\'últim camp de la fila és «' + claus[claus.length - 1] + '», esperava «' + cas.esperaDarrerCamp + '»');
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
    if (camp === 'nota_curador') {
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
  if (cas.procedencia && resultat.procedencia !== candidat.procedencia) {
    problemes.push('la procedència no ha sobreviscut');
  }

  return problemes;
}

// ------------------------------------------------------------
// Un lot de tres files amb un verificador que peta a la segona. És el mateix
// patró que ja garanteix eines/processa-lot.js amb el classificador: una crida
// que falla no atura el lot ni perd cap fila.
// ------------------------------------------------------------
async function provaLotAmbUnaFallada() {
  var problemes = [];
  var titols = ['Primera', 'Segona', 'Tercera'];
  var crides = 0;

  var verificador = function (fila) {
    crides += 1;
    if (fila.titol === 'Segona') {
      return Promise.reject(new Error('503 Service Unavailable'));
    }
    return Promise.resolve({ resultat: 'ok', camps_afectats: [], motiu: 'Tot quadra.' });
  };

  var sortida = [];

  for (var i = 0; i < titols.length; i++) {
    var candidat = {
      fila: filaDeProva({ titol: titols[i], data_inici: '2026-09-14', municipi: 'Elna' }),
      font: { tipus: 'agregador', llengua: 'fr' },
      metadadades: metadadadesDeProva('Trois concerts à Elne en septembre.')
    };
    sortida.push(await verificaEsdeveniment(candidat, verificador));
  }

  if (sortida.length !== 3) {
    problemes.push('el lot ha perdut files: ' + sortida.length + ' de 3');
  }
  if (crides !== 3) {
    problemes.push('s\'han fet ' + crides + ' crides de 3: el lot s\'ha aturat');
  }
  if (sortida[0].fila.nota_curador !== '') {
    problemes.push('la primera fila hauria de sortir muda: «' + sortida[0].fila.nota_curador + '»');
  }
  if (sortida[1].fila.nota_curador.indexOf('503 Service Unavailable') === -1) {
    problemes.push('la segona fila no diu que el verificador ha petat: «' + sortida[1].fila.nota_curador + '»');
  }
  if (sortida[2].fila.nota_curador !== '') {
    problemes.push('la tercera fila hauria de sortir muda: «' + sortida[2].fila.nota_curador + '»');
  }
  for (var j = 0; j < sortida.length; j++) {
    if (sortida[j].fila.estat !== 'pendent') {
      problemes.push('la fila ' + j + ' ha canviat d\'estat');
    }
  }

  return problemes;
}

// ------------------------------------------------------------
// Escriu al terminal el prompt amb una fitxa i una referència d'exemple, per
// poder-lo llegir sencer abans de cablegar cap crida.
// ------------------------------------------------------------
function mostraPrompt() {
  var fila = filaDeProva({
    titol: 'Mercat de Prada',
    data_inici: '2026-09-15',
    hora: '08:00',
    lloc: 'Plaça de la República',
    municipi: 'Prada',
    descripcio_ca: 'Cada dimarts al matí, el mercat de Prada omple el centre del poble.',
    associacio: 'Ajuntament de Prada'
  });

  var referencia = metadadadesDeProva('Tous les mardis matin, le célèbre marché de Prades.').font;

  console.log(construeixPrompt(fila, referencia));
}

// ------------------------------------------------------------
// Punt d'entrada del terminal: sense arguments, la bateria; amb --prompt, el
// prompt sencer.
// ------------------------------------------------------------
function principal() {
  if (process.argv[2] === '--prompt') {
    mostraPrompt();
    return;
  }

  provaBateria();
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    process.argv[1].indexOf('verifica-esdeveniment') !== -1) {
  principal();
}
