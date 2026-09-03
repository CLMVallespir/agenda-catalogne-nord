// ---------------------------------------------------------------------------
// CLASSIFICACIÓ EDITORIAL — R1-R7 com a SUGGERIMENT per al curador
//
// Una sola feina: donada una fila candidata, demanar a un classificador si
// l'acte és NUCLI, PERIFÈRIA, MARCAT o FORA segons les set regles de
// **docs/CRITERI-EDITORIAL.md**, i deixar-ne constància a `nota_curador`.
// Res més.
//
// El que aquesta peça NO fa, i no ho ha de fer mai:
//
//   - NO toca `estat`. La fila surt amb l'estat que portava.
//   - NO esborra res de `nota_curador`: el suggeriment s'hi ajunta al darrere.
//   - NO decideix FORA de debò. «FORA» és el text d'una nota i prou; la fila
//     continua el seu camí cap a la cua exactament igual que les altres. Qui
//     treu una fila del sistema és el curador des de curador.html, ningú més.
//   - NO crida l'API de Gemini. La crida arriba injectada des de fora, i per
//     això aquest fitxer es pot provar sencer sense clau i sense xarxa.
//
// Per què suggeriment i no decisió: el criteri editorial és del propietari, no
// del codi (vegeu la capçalera d'eines/filtra-candidats.js, que marca la
// mateixa ratlla per l'altra banda). Un model que es pensi que un mercat de
// poble és una fira comercial no ha de poder treure res de la cua; el pitjor
// que pot fer és escriure una línia equivocada que el curador llegirà.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/classifica-editorial.js            -> passa la bateria de proves
//   node eines/classifica-editorial.js --prompt   -> escriu el prompt condensat
//
// NO està connectada a res: ni a processaLot(), ni a pipelineOffline(), ni a
// cap escriptura. És la peça, no el cablejat.
//
// Una cosa que val més saber que descobrir: **no és idempotent**. Classificar
// dues vegades la mateixa fila hi deixa dos suggeriments, i si el model canvia
// d'opinió, dos que es contradiuen. És a posta: treure el vell voldria dir
// esborrar contingut de `nota_curador`, i això aquí no es fa mai. Qui la cridi
// en bucle ha de saber quines files ja han passat.
// ---------------------------------------------------------------------------


// --- El que ve de fora ------------------------------------------------------

// L'única importació d'aquest fitxer, i és una funció de dotze línies: la
// regla d'ajuntar dues notes de curador. Es reutilitza en comptes de copiar-la
// perquè és la mateixa regla —les dues notes, mai una— i ha de dir el mateix a
// tot arreu. Vegeu el peu d'eines/dedup-esdeveniments.js.
var dedup = require('./dedup-esdeveniments.js');

// I la neteja del text de font. Cap camp no entra a un prompt sense passar-hi:
// el flux de l'ADT66 serveix HTML amb una etiqueta de formulari en francès al
// davant, i pagar-la en tokens no fa millor cap classificació. Vegeu la
// capçalera d'eines/neteja-text.js.
var neteja = require('./neteja-text.js');


// --- Constants: els quatre nivells i les set regles -------------------------

// Els quatre nivells, escrits exactament com al §«Els quatre nivells» de
// docs/CRITERI-EDITORIAL.md. Cap altre valor no és un nivell.
var NIVELLS = ['NUCLI', 'PERIFÈRIA', 'MARCAT', 'FORA'];

// Les set regles, per poder dir que una citació no existeix. El text de cada
// regla és al document, no aquí: aquest fitxer no és el criteri, només el cita.
var REGLES = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'];

// Com comença tota nota escrita per aquesta peça. Serveix per a dues coses: que
// el curador reconegui d'un cop d'ull que això ho ha escrit una màquina i no
// una persona, i que qui llegeixi la nota sàpiga on acaba el que hi havia
// abans.
var MARCA_SUGGERIMENT = '[Suggeriment editorial: ';

// Fins on s'accepta el raonament del model. És una línia per al curador, no un
// paràgraf: el que passi d'aquí es retalla per la darrera paraula sencera.
var MAX_MOTIU = 160;


// --- Constants: la crida a Gemini (declarada, no executada) -----------------
//
// Aquest fitxer no crida res. Les constants hi són perquè el dia que algú
// cablegi la crida de debò no s'hagi d'inventar la configuració ni tornar a
// llegir el §7 de CLAUDE.md: construeixCosGemini() ja dona el cos exacte que
// espera l'API, i la clau va a la capçalera `x-goog-api-key`, mai a l'URL.

// El nom del model viu en UNA constant, com al Worker. Mai la gamma Pro, que és
// de pagament. Un 404 amb el nom del model a dins és cicle de vida normal de
// Google: mira quins Flash / Flash-Lite hi ha vigents i canvia-la.
var GEMINI_MODEL = 'gemini-3.5-flash-lite';
var GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';

// La resposta d'aquesta tasca són tres camps curts: 512 tokens hi caben de
// sobres i eviten pagar una resposta llarga si el model s'allarga.
var GEMINI_MAX_TOKENS = 512;

// Igual que al Worker: JSON garantit, sense `temperature` (els models 3.x la
// ignoren) i sense `thinkingBudget` (llegat, incompatible amb thinkingLevel).
// Aquí sí que es demana `low` i no `minimal`: distingir un mercat de poble
// d'una fira comercial és una decisió, no una extracció.
var CONFIGURACIO_GEMINI = {
  maxOutputTokens: GEMINI_MAX_TOKENS,
  responseMimeType: 'application/json',
  thinkingConfig: { thinkingLevel: 'low' }
};


// --- El prompt condensat ----------------------------------------------------
//
// docs/CRITERI-EDITORIAL.md reduït al que un model necessita per triar: el
// principi, les set regles i els quatre nivells. El document és el mestre; això
// n'és el resum operatiu. Si el criteri canvia allà, aquest text s'ha de tornar
// a escriure —no s'hi afegeix una excepció, com diu la capçalera del document.
//
// El que s'hi ha deixat fora a posta: la taula de casos i els tres discutibles.
// Són història de com es va fixar el criteri, i posar-los al prompt convidaria
// el model a fer d'advocat («això s'assembla al cas del tren roig») en comptes
// d'aplicar les regles. Els casos serveixen per PROVAR el prompt, que és el que
// fa la bateria d'aquest fitxer.
var PROMPT_CLASSIFICACIO = [
  'Ets el classificador editorial de l\'agenda cultural «Què fas?» de Catalunya',
  'Nord. Suggereixes; no decideixes mai. La decisió és sempre del curador.',
  '',
  'PRINCIPI: entra el que FA el país; queda fora el que el CONSUMEIX. Un mercat',
  'setmanal fa el país; un tren turístic de pagament el consumeix. Tots dos es',
  'fan en francès. La llengua només decideix quan la llengua és el contingut.',
  '',
  'LES SET REGLES:',
  'R1. Dues famílies. Mira primer si l\'activitat és DISCURS (la substància són',
  '    paraules: conferència, xerrada, conte, visita comentada, film, teatre,',
  '    presentació de llibre) o NO-DISCURS (la substància no són paraules:',
  '    mercat, concert, exposició, festa, sardanes, taller, fira, esport).',
  'R2. La llengua decideix només al discurs. Discurs en català o bilingüe: entra.',
  '    Discurs en francès: entra només si el subjecte és el país mateix (la seva',
  '    terra, història, memòria, llengua, els seus artistes); si no, MARCAT.',
  '    No s\'exclou d\'ofici i no es publica d\'ofici.',
  'R3. Preferència associativa. Associació, comitè de festes, parròquia, casal,',
  '    mediateca i comuna per damunt d\'institució pública, per damunt d\'oficina',
  '    de turisme, i molt per damunt d\'operador comercial. Una iniciativa',
  '    comercial que ven una experiència a visitants és FORA sigui quin sigui el',
  '    tema: trens turístics, tastos empaquetats, esport de franquícia, concerts',
  '    de gran sala.',
  'R4. Una visita guiada és discurs: FORA si no es fa en català, perquè el que es',
  '    ven és el relat. EXCEPCIÓ: una OBERTURA de patrimoni no és discurs —visita',
  '    lliure, muralles obertes gratuïtament, un taller que es pot recórrer sol—',
  '    i queda.',
  'R5. Clàusula de mèrit. La música clàssica i antiga i les exposicions de museu',
  '    entren pel seu valor propi, encara que no tinguin cap dimensió catalana.',
  'R6. Clàusula de teixit. Mercats, fires de productors i fòrums d\'associacions',
  '    entren perquè reprodueixen la base material i social del país. Passa per',
  '    damunt de l\'objecció «això no és cultura».',
  'R7. Davant d\'un dubte, mana l\'organitzador. Un gest cap al català —subtítols,',
  '    secció catalana, comunicació bilingüe, domini .cat— converteix un cas',
  '    dubtós en una referència.',
  '',
  'ELS QUATRE NIVELLS:',
  'NUCLI: el país fent-se; és el que dona el registre català a l\'agenda.',
  'PERIFÈRIA: legítim i publicable, però no és el que caracteritza l\'agenda.',
  'MARCAT: discurs en francès sense relació amb la cultura catalana; el curador',
  '  decidirà.',
  'FORA: no entra.',
  '',
  'NUCLI O PERIFÈRIA quan el cas entra: és NUCLI el que entra per R2, R3, R4 o R6',
  '—dimensió catalana explícita al discurs, preferència associativa, obertura de',
  'patrimoni, o teixit associatiu i productiu—, que és el que dona el registre',
  'català. R6 ja porta en si mateix la reproducció del país i no necessita cap',
  'lligam addicional: un mercat o un fòrum d\'associacions és NUCLI directament.',
  'És PERIFÈRIA només el que entra per R5 —mèrit— sense cap altre lligam català',
  'explícit, perquè R5 admet expressament casos «encara que no tinguin cap',
  'dimensió catalana». Un cas de R5 que a MÉS tingui un lligam català explícit',
  'per R7 puja a NUCLI, i llavors la regla que cites és R7, que és la que',
  'decideix la pujada.',
  '',
  'Cita SEMPRE la regla que ha pesat més. Si en pesen dues, cita la que decideix',
  'el nivell. El motiu ha de ser UNA sola frase curta en català, sense repetir el',
  'títol de l\'acte.',
  '',
  'Respon NOMÉS amb aquest JSON, sense preàmbul i sense tanques markdown:',
  '{"nivell":"NUCLI|PERIFÈRIA|MARCAT|FORA","regla":"R1..R7","motiu":"..."}',
  '',
  'ESDEVENIMENT:'
].join('\n');


// --- La funció --------------------------------------------------------------

// ------------------------------------------------------------
// Classifica un candidat i li escriu el suggeriment a `nota_curador`.
//
//   candidat     { fila, font: { tipus, llengua } }, la mateixa forma que
//                accepta eines/dedup-esdeveniments.js.
//   cridaGemini  funció injectada. Se la crida amb (fila, font) i ha de tornar
//                una promesa de { nivell, regla, motiu }. Una funció que només
//                declari (fila) també serveix: el segon argument és informació
//                de més per al prompt, no un requisit.
//
// Torna SEMPRE el candidat, amb la fila copiada i la nota actualitzada. No
// llança mai: una classificació que falla és una nota que ho diu, no una fila
// perduda. Que el candidat surti sempre és el que fa que aquesta peça no pugui
// decidir res —ni quan el model diu FORA, ni quan el model no respon.
// ------------------------------------------------------------
async function classificaEditorial(candidat, cridaGemini) {
  var entrada = candidat || {};
  var fila = copiaFila(entrada.fila);
  var nota = '';

  if (typeof cridaGemini !== 'function') {
    nota = notaNoDisponible('no hi ha cap classificador connectat');
  } else if (textPerClassificar(fila) === '') {
    nota = notaNoDisponible('la fila no porta text per classificar');
  } else {
    nota = await notaDelClassificador(fila, entrada.font, cridaGemini);
  }

  // L'ÚNIC camp que aquesta peça toca. La nota que hi havia va davant: és més
  // antiga i sovint és la que diu què s'ha d'anar a mirar de debò.
  fila.nota_curador = dedup.ajuntaNotes(fila.nota_curador, nota);

  return candidatAmbFila(entrada, fila);
}

// ------------------------------------------------------------
// Fa la crida i en treu la nota. Separada de la funció principal perquè el
// try/catch no s'hi barregi amb les dues guardes de dalt.
// ------------------------------------------------------------
async function notaDelClassificador(fila, font, cridaGemini) {
  var resposta = null;

  try {
    resposta = await cridaGemini(fila, font || {});
  } catch (error) {
    return notaNoDisponible('el classificador no ha respost (' + missatgeDError(error) + ')');
  }

  var suggeriment = interpretaResposta(resposta);
  if (suggeriment === null) {
    return notaNoDisponible('el classificador ha respost una cosa que no és cap dels quatre nivells');
  }

  return notaDeSuggeriment(suggeriment);
}


// --- Les peces: les dues menes de nota --------------------------------------

// ------------------------------------------------------------
// La nota d'un suggeriment: el nivell, la regla citada i una línia de raonament.
//
//   [Suggeriment editorial: MARCAT — R2] Discurs en francès sense cap lligam
//   amb el país.
// ------------------------------------------------------------
function notaDeSuggeriment(suggeriment) {
  return MARCA_SUGGERIMENT + suggeriment.nivell + ' — ' + suggeriment.regla + '] ' +
    suggeriment.motiu;
}

// ------------------------------------------------------------
// La nota de quan no hi ha suggeriment. Existeix perquè el silenci enganya: una
// fila sense cap línia de classificació sembla una fila que ha passat el
// criteri, i pot ser una fila que ningú no ha mirat mai.
// ------------------------------------------------------------
function notaNoDisponible(motiu) {
  return MARCA_SUGGERIMENT + 'no disponible] Sense classificar: ' + motiu + '.';
}


// --- Les peces: llegir el que torna el model --------------------------------

// ------------------------------------------------------------
// Converteix el que hagi respost el classificador en un suggeriment bo, o en
// null si no ho és. Es comprova tot: un model pot tornar un nivell inventat, una
// regla que no existeix o un motiu de tres paràgrafs, i cap de les tres coses no
// ha d'arribar mai a la nota del curador.
// ------------------------------------------------------------
function interpretaResposta(resposta) {
  if (resposta === null || typeof resposta !== 'object') {
    return null;
  }

  var nivell = normalitzaNivell(resposta.nivell);
  if (nivell === '') {
    return null;
  }

  var regla = normalitzaRegla(resposta.regla);
  if (regla === '') {
    return null;
  }

  return {
    nivell: nivell,
    regla: regla,
    motiu: netejaMotiu(resposta.motiu)
  };
}

// ------------------------------------------------------------
// El nivell, coercit als quatre permesos. Es compara sense accents i en
// majúscules a posta: un model que escrigui «PERIFERIA» vol dir «PERIFÈRIA», i
// llençar la resposta per un accent seria perdre una classificació bona.
// ------------------------------------------------------------
function normalitzaNivell(valor) {
  var text = senseAccents(cadena(valor).toUpperCase());

  for (var i = 0; i < NIVELLS.length; i++) {
    if (text === senseAccents(NIVELLS[i].toUpperCase())) {
      return NIVELLS[i];
    }
  }

  return '';
}

// ------------------------------------------------------------
// La regla citada. S'accepta que vingui amb brossa al voltant («regla R2»,
// «R2/R6») i se'n pren la primera de vàlida: el que interessa és que el curador
// vegi quina regla s'ha aplicat, no castigar el format.
// ------------------------------------------------------------
function normalitzaRegla(valor) {
  var text = cadena(valor).toUpperCase();

  for (var i = 0; i < REGLES.length; i++) {
    if (text.indexOf(REGLES[i]) !== -1) {
      return REGLES[i];
    }
  }

  return '';
}

// ------------------------------------------------------------
// El motiu, reduït a una línia llegible: salts de línia i espais dobles fora,
// retallat a MAX_MOTIU per la darrera paraula sencera, i acabat en punt perquè
// s'ajunti bé amb les altres notes de la fila.
//
// Un motiu buit no invalida la resposta: el nivell i la regla ja diuen prou.
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

  if (text.slice(-1) !== '.' && text.slice(-1) !== '!' &&
      text.slice(-1) !== '?' && text.slice(-1) !== '…') {
    return text + '.';
  }

  return text;
}


// --- Les peces: la fila -----------------------------------------------------

// ------------------------------------------------------------
// El text de la fitxa tal com se li ensenya al model. Els camps que porten una
// decisió editorial a dins i cap més: què és, on és, qui ho fa, com s'explica i
// d'on surt. Les dates i l'hora no hi són perquè no decideixen res del criteri.
//
// La font del registre va marcada com el que és —d'on surt la fitxa, no qui fa
// l'acte— justament perquè el model no la confongui amb l'organitzador: un
// agregador pot portar perfectament el mercat d'un poble.
// ------------------------------------------------------------
function fitxaPerAlModel(fila, font) {
  var descriptor = font || {};

  var linies = [
    'Títol: ' + textNet(fila.titol),
    'Categoria: ' + textNet(fila.categoria),
    'Municipi: ' + textNet(fila.municipi),
    'Lloc: ' + textNet(fila.lloc),
    'Organitzador: ' + textNet(fila.associacio),
    'Descripció (ca): ' + textNet(fila.descripcio_ca),
    'Descripció (fr): ' + textNet(fila.descripcio_fr),
    'Enllaç a la font: ' + cadena(fila.font_url),
    'Font del registre (d\'on surt la fitxa, NO qui organitza l\'acte): ' +
      cadena(descriptor.tipus)
  ];

  return linies.join('\n');
}

// ------------------------------------------------------------
// Un camp de la fila tal com se li ha d'ensenyar al model: net. La fila NO es
// toca —el que arriba a pendents.json és cosa del mapeig, no d'aquesta peça—;
// el que es neteja és la còpia que viatja dins del prompt.
//
// `font_url` en queda fora a posta: és una adreça, no text, i passar-la per
// una neteja pensada per a prosa no la millora en res.
// ------------------------------------------------------------
function textNet(valor) {
  return neteja.netejaTextFont(valor);
}

// ------------------------------------------------------------
// El prompt sencer d'una fila: el criteri condensat més la seva fitxa. Surt a
// fora del fitxer perquè el dia que es cablegi la crida de debò, el prompt
// surti d'aquí i no d'una còpia.
// ------------------------------------------------------------
function construeixPrompt(fila, font) {
  return PROMPT_CLASSIFICACIO + '\n' + fitxaPerAlModel(fila || {}, font);
}

// ------------------------------------------------------------
// El cos exacte d'una petició a Gemini per a aquesta tasca. Aquest fitxer no
// l'envia: el munta i prou, perquè es pugui llegir i provar sense clau.
// ------------------------------------------------------------
function construeixCosGemini(fila, font) {
  return {
    contents: [
      { parts: [ { text: construeixPrompt(fila, font) } ] }
    ],
    generationConfig: CONFIGURACIO_GEMINI
  };
}

// ------------------------------------------------------------
// Diu si la fila porta prou text per valer una crida. Una fila sense títol, ni
// descripcions, ni organitzador no es pot classificar, i preguntar-ho igualment
// és gastar una crida a Gemini per rebre una endevinalla.
// ------------------------------------------------------------
function textPerClassificar(fila) {
  var text = textNet(fila.titol) + textNet(fila.descripcio_ca) +
    textNet(fila.descripcio_fr) + textNet(fila.associacio);

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
// totes les claus, no només `fila` i `font`, perquè qui hi hagi penjat res més
// no ho perdi pel camí.
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
// Un text sense accents ni dièresis, per poder comparar «PERIFÈRIA» amb
// «PERIFERIA». El rang ̀-ͯ són les marques diacrítiques que la
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
// prompt condensat, el prompt d'una fila i el cos de la petició. Cap d'elles no
// envia res.

module.exports = {
  classificaEditorial: classificaEditorial,
  PROMPT_CLASSIFICACIO: PROMPT_CLASSIFICACIO,
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
// Un classificador de mentida que sempre respon el mateix. És el que fa que la
// bateria no necessiti ni clau ni xarxa: el que es prova aquí és el que la peça
// fa amb la resposta, no si el model encerta.
// ------------------------------------------------------------
function respostaFixa(resposta) {
  return function () {
    return Promise.resolve(resposta);
  };
}

// ------------------------------------------------------------
// Un classificador de mentida que peta, per provar el camí de l'error.
// ------------------------------------------------------------
function classificadorQuePeta(missatge) {
  return function () {
    return Promise.reject(new Error(missatge));
  };
}

// ------------------------------------------------------------
// Els casos. Els onze primers són els de docs/CRITERI-EDITORIAL.md —els vuit
// que van fixar el criteri i els tres discutibles—, amb la resposta canònica
// que el criteri ja dona per a cadascun. La resta prova el que la peça ha de
// garantir passi el que passi.
// ------------------------------------------------------------
function casosDeProva() {
  return [
    // --- Els vuit casos de la taula ---
    {
      nom: 'Mercat de Prada: teixit, entra (R6)',
      fila: filaDeProva({
        titol: 'El gran mercat de Prada', categoria: 'Mercat', municipi: 'Prada',
        associacio: 'Mairie de Prades',
        descripcio_fr: 'Tous les mardis matin, le marché de Prades.'
      }),
      resposta: { nivell: 'NUCLI', regla: 'R6', motiu: 'Mercat setmanal que sosté els petits productors del Conflent' },
      esperaConte: '[Suggeriment editorial: NUCLI — R6]'
    },
    {
      nom: 'Orgue d\'Arles de Tec: mèrit (R5) que puja a NUCLI pel lligam català (R7)',
      fila: filaDeProva({
        titol: 'Concert d\'orgue a Arles de Tec', categoria: 'Música',
        municipi: 'Arles de Tec', associacio: 'Els Amics de l\'Orgue d\'Arles de Tec',
        descripcio_fr: 'Récital d\'orgue baroque.'
      }),
      resposta: { nivell: 'NUCLI', regla: 'R7', motiu: 'Entra per mèrit (R5), i «Els Amics de l\'Orgue» té el nom declarat en català' },
      esperaConte: '[Suggeriment editorial: NUCLI — R7]'
    },
    {
      nom: 'Visita guiada de Reiners: discurs en francès de pagament (R4)',
      fila: filaDeProva({
        titol: 'Visite guidée de Reiners', categoria: 'Patrimoni i tradicions',
        municipi: 'Reiners', associacio: 'Office de tourisme du Vallespir',
        descripcio_fr: 'Visite commentée du village, 6 €, sur réservation.'
      }),
      resposta: { nivell: 'FORA', regla: 'R4', motiu: 'Visita comentada de pagament en francès: el que es ven és el relat' },
      esperaConte: '[Suggeriment editorial: FORA — R4]'
    },
    {
      nom: 'Tren Roig: atracció turística (R3)',
      fila: filaDeProva({
        titol: 'Le Train Rouge', categoria: '', municipi: 'Ribesaltes',
        associacio: 'Train du Pays Cathare et du Fenouillèdes',
        descripcio_fr: 'Voyage en train touristique, 124 € par personne.'
      }),
      resposta: { nivell: 'FORA', regla: 'R3', motiu: 'Operador comercial que ven una experiència a visitants; el país hi fa de decorat' },
      esperaConte: '[Suggeriment editorial: FORA — R3]'
    },
    {
      nom: 'Fòrum de les associacions: teixit associatiu (R6)',
      fila: filaDeProva({
        titol: 'Fòrum de les associacions', categoria: '', municipi: 'Ceret',
        associacio: 'Mairie de Céret',
        descripcio_fr: 'Les associations du village se présentent.'
      }),
      resposta: { nivell: 'NUCLI', regla: 'R6', motiu: 'És el teixit associatiu presentant-se, no cap tràmit administratiu' },
      esperaConte: '[Suggeriment editorial: NUCLI — R6]'
    },
    {
      nom: 'Courts Circuit 66: l\'organitzador fa el gest (R7)',
      fila: filaDeProva({
        titol: 'Festival Courts Circuit 66', categoria: 'Cinema',
        municipi: 'Perpinyà', associacio: 'Courts Circuit',
        descripcio_fr: 'Festival de courts métrages, section «Curts cat».',
        font_url: 'https://courtscircuit.cat/'
      }),
      resposta: { nivell: 'NUCLI', regla: 'R7', motiu: 'Subtitula en català, té secció «Curts cat» i jurat de la federació catalana de cineclubs' },
      esperaConte: '[Suggeriment editorial: NUCLI — R7]'
    },
    {
      nom: 'Cinema a la fresca «Dragons»: discurs en francès sense lligam (R2)',
      fila: filaDeProva({
        titol: 'Cinéma en plein air : Dragons', categoria: 'Cinema',
        municipi: 'Elna', associacio: 'Mairie d\'Elne',
        descripcio_fr: 'Projection en plein air du film d\'animation.'
      }),
      resposta: { nivell: 'MARCAT', regla: 'R2', motiu: 'Discurs en francès sense cap lligam amb el país' },
      esperaConte: '[Suggeriment editorial: MARCAT — R2]'
    },
    {
      nom: 'El Llibre Vivent: bilingüe comprovat (R7)',
      fila: filaDeProva({
        titol: 'El Llibre Vivent de passejada', categoria: 'Activitat infantil',
        municipi: 'Perpinyà', associacio: 'Département des Pyrénées-Orientales',
        descripcio_fr: 'Lectures en français et en catalan. Entrée gratuite.'
      }),
      resposta: { nivell: 'NUCLI', regla: 'R7', motiu: 'El Departament publica que és en francès i en català, amb títols bilingües' },
      esperaConte: '[Suggeriment editorial: NUCLI — R7]'
    },

    // --- Els tres discutibles ---
    {
      nom: 'Discutible 1 — Aperitius amb els vinyaters: tast empaquetat (R3)',
      fila: filaDeProva({
        titol: 'Apéritifs chez les vignerons', categoria: '', municipi: 'Banyuls',
        associacio: 'Office de tourisme de Banyuls-sur-Mer',
        descripcio_fr: 'Dégustation, 10 €, sur inscription.'
      }),
      resposta: { nivell: 'FORA', regla: 'R3', motiu: 'No és el productor venent al seu poble sinó l\'oficina de turisme venent un tast' },
      esperaConte: '[Suggeriment editorial: FORA — R3]'
    },
    {
      nom: 'Discutible 2 — Semàfor del cap Béar: visita gratuïta i municipal (R4)',
      fila: filaDeProva({
        titol: 'Visite du sémaphore du cap Béar', categoria: 'Patrimoni i tradicions',
        municipi: 'Portvendres', associacio: 'Mairie de Port-Vendres',
        descripcio_fr: 'Visite gratuite dans le cadre des Journées du Patrimoine.'
      }),
      resposta: { nivell: 'MARCAT', regla: 'R4', motiu: 'Visita guiada en francès, però gratuïta, municipal i dins les Jornades del Patrimoni' },
      esperaConte: '[Suggeriment editorial: MARCAT — R4]'
    },
    {
      nom: 'Discutible 3 — Ceret, Llibres i Editors en Festa: programa en francès (R2)',
      fila: filaDeProva({
        titol: 'Ceret, Llibres i Editors en Festa', categoria: 'Conferència',
        municipi: 'Ceret', associacio: 'Llibreria associativa',
        descripcio_fr: 'Rencontres autour d\'Orson Welles.'
      }),
      resposta: { nivell: 'MARCAT', regla: 'R2', motiu: 'Llibreria associativa molt arrelada, però el programa és en francès i gira al voltant d\'Orson Welles' },
      esperaConte: '[Suggeriment editorial: MARCAT — R2]'
    },

    // --- La concatenació de la nota ---
    {
      nom: 'La nota d\'un altre agent no es perd: el suggeriment s\'hi ajunta',
      fila: filaDeProva({
        titol: 'Trail des Cimes', municipi: 'Santa Llocaia',
        associacio: 'Club sportif',
        nota_curador: 'El títol ve en «fr» i no hi ha versió catalana: cal traduir-lo. ' +
          'La categoria «obstacle race» no té equivalent entre les tretze: queda buida.'
      }),
      resposta: { nivell: 'FORA', regla: 'R3', motiu: 'Cursa esportiva de franquícia' },
      esperaNota: 'El títol ve en «fr» i no hi ha versió catalana: cal traduir-lo. ' +
        'La categoria «obstacle race» no té equivalent entre les tretze: queda buida. ' +
        '[Suggeriment editorial: FORA — R3] Cursa esportiva de franquícia.'
    },
    {
      nom: 'Sense nota prèvia: el camp queda ben format des de zero',
      fila: filaDeProva({ titol: 'Sardanes a la plaça', municipi: 'Ceret' }),
      resposta: { nivell: 'NUCLI', regla: 'R1', motiu: 'Sardanes: no-discurs, el país fent-se' },
      esperaNota: '[Suggeriment editorial: NUCLI — R1] Sardanes: no-discurs, el país fent-se.'
    },
    {
      nom: 'Una fila sense nota_curador el rep, i queda l\'últim camp',
      fila: { titol: 'Concert de Nadal', municipi: 'Elna', estat: 'pendent' },
      resposta: { nivell: 'PERIFÈRIA', regla: 'R5', motiu: 'Música clàssica' },
      esperaNota: '[Suggeriment editorial: PERIFÈRIA — R5] Música clàssica.',
      esperaDarrerCamp: 'nota_curador'
    },

    // --- El que ha de passar quan res no va bé ---
    {
      nom: 'Nivell inventat pel model: no s\'escriu cap suggeriment fals',
      fila: filaDeProva({ titol: 'Concert de tardor', municipi: 'Elna' }),
      resposta: { nivell: 'POTSER', regla: 'R5', motiu: 'No ho sé' },
      esperaNota: '[Suggeriment editorial: no disponible] Sense classificar: el classificador ha respost una cosa que no és cap dels quatre nivells.'
    },
    {
      nom: 'Regla inventada pel model: tampoc no s\'escriu res',
      fila: filaDeProva({ titol: 'Concert de tardor', municipi: 'Elna' }),
      resposta: { nivell: 'NUCLI', regla: 'R9', motiu: 'Cap regla' },
      esperaNota: '[Suggeriment editorial: no disponible] Sense classificar: el classificador ha respost una cosa que no és cap dels quatre nivells.'
    },
    {
      nom: '«PERIFERIA» sense accent és «PERIFÈRIA»',
      fila: filaDeProva({ titol: 'Exposició del museu', municipi: 'Ceret' }),
      resposta: { nivell: 'periferia', regla: 'regla R5', motiu: 'Exposició de museu' },
      esperaNota: '[Suggeriment editorial: PERIFÈRIA — R5] Exposició de museu.'
    },
    {
      nom: 'Un motiu de tres paràgrafs es retalla a una línia',
      fila: filaDeProva({ titol: 'Fira del llibre', municipi: 'Perpinyà' }),
      resposta: {
        nivell: 'NUCLI', regla: 'R6',
        motiu: 'Aquesta fira reprodueix la base material i social del país perquè hi ' +
          'participen editors, llibreters i associacions de la comarca,\ni a més ' +
          'obre la porta a públics que no acostumen a trobar-se enlloc més durant ' +
          'tot l\'any, cosa que la fa doblement valuosa.'
      },
      esperaConte: '…',
      esperaMaxLlargada: MAX_MOTIU + 60
    },
    {
      nom: 'El classificador peta: la fila surt igualment, amb la nota que ho diu',
      fila: filaDeProva({ titol: 'Concert de tardor', municipi: 'Elna' }),
      classificador: classificadorQuePeta('429 Too Many Requests'),
      esperaNota: '[Suggeriment editorial: no disponible] Sense classificar: el classificador no ha respost (429 Too Many Requests).'
    },
    {
      nom: 'Sense classificador connectat: la fila surt igualment',
      fila: filaDeProva({ titol: 'Concert de tardor', municipi: 'Elna' }),
      senseClassificador: true,
      esperaNota: '[Suggeriment editorial: no disponible] Sense classificar: no hi ha cap classificador connectat.'
    },
    {
      nom: 'Fila sense text: no es gasta cap crida',
      fila: filaDeProva({ municipi: 'Elna', data_inici: '2026-09-14' }),
      resposta: { nivell: 'NUCLI', regla: 'R1', motiu: 'No hauria de sortir mai' },
      esperaNota: '[Suggeriment editorial: no disponible] Sense classificar: la fila no porta text per classificar.',
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
    var problemes = await provaUnCas(cas);

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
// Un cas: es classifica i es comprova el que vigila, més el que han de complir
// tots sense excepció.
// ------------------------------------------------------------
async function provaUnCas(cas) {
  var problemes = [];
  var crides = 0;

  var classificador = null;
  if (cas.classificador) {
    classificador = cas.classificador;
  } else if (!cas.senseClassificador) {
    classificador = function (fila, font) {
      crides += 1;
      return respostaFixa(cas.resposta)(fila, font);
    };
  }

  var candidat = { fila: cas.fila, font: { tipus: 'agregador', llengua: 'fr' } };
  var resultat = await classificaEditorial(candidat, classificador);
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
    problemes.push('s\'ha cridat el classificador ' + crides + ' vegada(es) i no calia');
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

  if (nota.indexOf(MARCA_SUGGERIMENT) === -1) {
    problemes.push('la nota no porta cap marca de suggeriment: «' + nota + '»');
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

  return problemes;
}

// ------------------------------------------------------------
// Escriu al terminal el prompt condensat amb una fitxa d'exemple, per poder-lo
// llegir sencer abans de cablegar cap crida.
// ------------------------------------------------------------
function mostraPrompt() {
  var fila = filaDeProva({
    titol: 'Le Train Rouge',
    municipi: 'Ribesaltes',
    associacio: 'Train du Pays Cathare et du Fenouillèdes',
    descripcio_fr: 'Voyage en train touristique, 124 € par personne.'
  });

  console.log(construeixPrompt(fila, { tipus: 'agregador', llengua: 'fr' }));
}

// ------------------------------------------------------------
// Punt d'entrada del terminal: sense arguments, la bateria; amb --prompt, el
// prompt condensat.
// ------------------------------------------------------------
function principal() {
  if (process.argv[2] === '--prompt') {
    mostraPrompt();
    return;
  }

  provaBateria();
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    process.argv[1].indexOf('classifica-editorial') !== -1) {
  principal();
}
