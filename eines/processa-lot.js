// ---------------------------------------------------------------------------
// PROCESSA UN LOT DE CANDIDATS DE RECERCA
//
// Una sola feina: agafar un grapat de registres de l'esquema de recerca, passar
// cadascun per mapejaAProduccio(), comparar les files que en surten entre elles
// amb comparaEsdeveniments() per saber què hi ha de duplicat DINS del mateix
// lot, i —només si qui crida hi connecta els agents— fer-hi passar la
// verificació, el suggeriment editorial i la còpia del cartell de les files que
// n'hagin sortit assentades. Res més.
//
//   - Cap crida a cap API des d'aquí dins. Els tres passos que en necessitarien
//     una —la verificació, el suggeriment editorial i la pujada del cartell— la
//     reben INJECTADA pel tercer paràmetre `crides` (vegeu §«Els tres agents
//     injectats»), i si no se'n passa cap el lot es processa igual, sense
//     verificar, sense classificar i sense tocar cap cartell.
//     No llegeix cap fitxer i no n'escriu cap: ni pendents.json, ni events.json,
//     ni res.
//   - Cap detall d'ADT66 ni de cap altra font concreta. Qualsevol font futura
//     la crida igual: registres de recerca a dins, tres llistes a fora.
//   - NO compara contra la cua que ja existeix. Això és una altra tasca; aquí
//     el lot només es mira a ell mateix.
//
// Les tres llistes que en surten no es barregen mai i no comparteixen cap fila:
//
//   llestos      files úniques, o ja fusionades, a punt per a la cua; són les
//                ÚNIQUES que passen per cap agent (regla 4)
//   dubtosos     parelles que ha de mirar el curador, amb les dues files; no
//                passen mai per cap agent (regla 4)
//   metadadades  la procedència de cada fila, indexada PER LA FILA, mai a dins
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/processa-lot.js    -> passa la bateria de proves
//
// Les regles que aquest fitxer NO decideix pel seu compte —les va decidir el
// propietari, perquè cap de les peces d'origen les cobria— són al §«Les regles
// del lot» d'aquí sota.
// ---------------------------------------------------------------------------


// --- El que ve de fora ------------------------------------------------------

// Les cinc peces que aquest fitxer uneix. Cap de les cinc no s'ha tocat: aquí
// només es criden, en l'ordre que toca.
var mapeig = require('./mapeja-recerca.js');
var dedup = require('./dedup-esdeveniments.js');
var criteri = require('./classifica-editorial.js');
var verificacio = require('./verifica-esdeveniment.js');
var cartells = require('./puja-cartell.js');


// --- Les regles del lot -----------------------------------------------------
//
// Comparar de dos en dos és el que sap fer comparaEsdeveniments(). Un lot no és
// una parella, i quatre coses que la funció sola no diu s'han hagut de decidir:
//
// 1. CADENA. A i B són el mateix acte, i la fila fusionada AB encara és el
//    mateix acte que C. La fusió és ACUMULATIVA: es fusiona la primera parella
//    que diu «mateix», la fila resultant es queda el descriptor de font de la
//    candidata que la mateixa funció ha marcat com a guanyadora, i es torna a
//    comparar amb la resta. Es repeteix fins que cap parella no diu «mateix».
//    Cap llindar nou i cap regla de tres en tres: només s'itera la funció que
//    ja hi ha.
//
// 2. SOLAPAMENT. Les tres llistes són exclusives. Una fila que aparegui en una
//    parella dubtosa NO surt a `llestos`, ni que vingui d'una fusió ferma: el
//    curador decideix primer, i així cap acte no pot entrar dues vegades a la
//    cua.
//
// 3. CLAU INCOMPLETA. comparaEsdeveniments() torna «dubtós» sempre que a alguna
//    de les dues files hi falta la data d'inici o el municipi. En un lot, això
//    voldria dir que una sola fila sense data fes parella dubtosa amb totes les
//    altres —amb cent files, noranta-nou— i deixés `llestos` buida. Per això
//    una fila sense clau forta NO es compara amb ningú: va directa a `llestos`
//    amb l'avís que mapejaAProduccio() ja li ha posat a `nota_curador`. No es
//    pot dir si és duplicada, i dir-ho noranta-nou vegades no ho aclareix.
//
// 4. QUÈ PASSA PELS AGENTS. El suggeriment editorial s'aplica NOMÉS a
//    `llestos`, i és una decisió, no un descuit. Una fila de `llestos` ja és
//    una fila assentada: és la que anirà a la cua, i classificar-la és
//    classificar el que hi haurà. Una fila de `dubtosos` encara no ho és —hi
//    ha dues `opcions` i el curador encara ha de dir si són el mateix acte—, o
//    sigui que classificar-les voldria dir gastar dues crides per a una fila
//    que pot acabar sent una de sola, amb dos suggeriments que es poden
//    contradir i que ningú no sabria com fusionar (classificaEditorial() no és
//    idempotent: dues passades hi deixen dues notes). Es classificaran el dia
//    que curador.html sàpiga demanar-ho un cop resolt el dedup a mà; fins
//    llavors surten sense suggeriment, i cap heurística no ho supleix.
//
//    La VERIFICACIÓ segueix aquesta mateixa regla, paraula per paraula i pels
//    mateixos motius —no cal repetir l'anàlisi: verificaEsdeveniment() tampoc
//    no és idempotent i una fila dubtosa tampoc no està assentada—, o sigui
//    que `dubtosos` no en porta cap nota, com no en porta cap de classificació.
//
//    La CÒPIA DEL CARTELL, igual, i pel mateix raonament d'aquest paràgraf:
//    pujaCartell() tampoc no és idempotent i una fila dubtosa tampoc no està
//    assentada. Només hi ha una cosa a afegir-hi, perquè aquest agent no gasta
//    una crida sinó una còpia guardada: les dues `opcions` d'un dubte poden
//    portar dos cartells diferents, i pujar-los tots dos vol dir deixar per
//    sempre a Cloudinary la imatge d'una fila que potser no existirà. Les files
//    dubtoses surten, doncs, amb l'`imatge_url` que els hagi deixat el mapeig
//    —l'URL forà, tal qual— i sense cap nota de cartell.
//
// 5. L'ORDRE DE LES NOTES. Una fila que passi per tot acaba amb quatre
//    seccions a `nota_curador`, sempre en aquest ordre:
//
//        procedència (mapeig i dedup) → verificació → classificació → cartell
//
//    El motiu és editorial, no tècnic: la verificació respon si els FETS de la
//    fila són fiables, i la classificació dona per bons aquests fets per
//    decidir si l'acte entra a l'agenda. El curador ha de veure el dubte sobre
//    els fets ABANS del suggeriment construït al damunt; llegir-ho al revés és
//    llegir una recomanació sense saber encara que la data potser és inventada.
//
//    El cartell va l'últim per la raó que ja diu el §«ON VA AQUESTA NOTA DINS
//    LA CADENA» d'eines/puja-cartell.js: és l'única de les quatre seccions que
//    no pot fer canviar la decisió de publicar, perquè parla de com quedarà la
//    fitxa un cop decidit que sí.
//
//    L'ordre no es fa amb cap manipulació de text: `ajuntaNotes()` sempre posa
//    la nota nova al darrere, de manera que l'ordre de les seccions és
//    exactament l'ordre en què es criden els agents a passaElsAgents(). Canviar
//    l'ordre de les notes vol dir canviar l'ordre d'aquelles crides, i res més.


// --- La funció --------------------------------------------------------------

// ------------------------------------------------------------
// Processa un lot sencer. Cada element de `candidatsRecerca` pot ser:
//
//   - un registre de recerca tal qual, o
//   - { registre: <el registre>, font: { tipus, llengua } } quan el lot barreja
//     fonts i cadascuna té el seu rang.
//
// `fontDelLot` és el descriptor que s'aplica als elements que no en porten cap
// de propi: { tipus: 'agregador' } per a un flux com el de l'ADT66. El `tipus`
// és una clau de la jerarquia de fonts de dedup-esdeveniments.js i decideix qui
// mana en fusionar; una font desconeguda val el mínim i no mana sobre ningú.
// La `llengua` gairebé mai no cal donar-la: es dedueix del mapeig.
//
// --- ELS TRES AGENTS INJECTATS ---
//
// `crides` és OPCIONAL i porta els agents que surten a la xarxa. La forma
// recomanada és un objecte amb els noms escrits:
//
//   processaLot(candidats, font, { verifica: fnV, classifica: fnC, puja: fnP })
//
//   verifica    la crida d'eines/verifica-esdeveniment.js: rep
//               (fila, referenciaOriginal) i torna una promesa de
//               { resultat, camps_afectats, motiu }.
//   classifica  la crida d'eines/classifica-editorial.js: rep (fila, font) i
//               torna una promesa de { nivell, regla, motiu }.
//   puja        la `funcioPujada` d'eines/puja-cartell.js: rep (urlOrigen) i
//               torna una promesa de { url } si la còpia ha anat bé o de
//               { error } si no. És l'única de les tres que no va a Gemini
//               —va a Cloudinary— i l'única que escriu un camp que es veu al
//               web (`imatge_url`), i no només la nota.
//
// És un objecte i no paràmetres posicionals a posta. Des de fora totes tenen la
// mateixa pinta —totes tornen una promesa—, o sigui que si anessin soltes,
// canviar-les d'ordre per error no petaria: el verificador rebria una fitxa per
// classificar i escriuria una nota absurda a cada fila. Amb els noms escrits,
// l'error no es pot cometre en silenci. Per això un agent nou entra SEMPRE com
// una clau més d'aquest objecte, i mai com un paràmetre nou de la funció.
//
// I LA CLAU ÉS SEMPRE UN VERB: què fa l'agent —`verifica`, `classifica`,
// `puja`—, mai el nom de la cosa sobre la qual treballa. La clau del pujador es
// va dir `cartell` un dia i es va canviar per això mateix: llegida de cop,
// `cartell: fnP` sembla un valor de configuració i no una funció injectada. Amb
// la regla escrita, el dia que hi hagi un quart agent ja sap com s'ha de dir
// sense que ningú l'hi hagi de dir.
//
// Per compatibilitat, una FUNCIÓ tota sola en aquest lloc encara vol dir el que
// volia abans que la verificació existís: és el classificador.
//
//   processaLot(candidats, font, fnC)   ==   { classifica: fnC }
//
// Aquí dins no se'n construeix mai cap ni es crida cap API. L'agent que no es
// passi no s'executa gens: ni una crida, ni una nota, ni cap canvi a cap camp.
// Sense cap dels tres, el lot surt exactament igual que abans que aquests
// passos existissin.
//
// AVÍS SOBRE `puja`. El pujador de debò és eines/cloudinary-adapter.js, el
// preset està comprovat i el propietari ja ha decidit (31 d'agost de 2026) que
// s'hi connecta. Però **no es connecta AQUÍ**: cada crida deixa una còpia
// permanent a Cloudinary, també per a files que potser no es publicaran mai, i
// processaLot() es crida sobre lots que encara no se sap si entraran enlloc.
// La connexió de debò viu a eines/cartells-a-cloudinary.js, que treballa sobre
// pendents.json —files que ja són a la cua— i que es llança a mà.
// Aquí, doncs, aquesta clau només es passa amb pujadors de mentida, a les
// proves. No passar-la continua sent el comportament normal.
//
// La funció és `async` perquè els agents ho són. Sense agents no espera res,
// però el resultat continua arribant dins d'una promesa: qui la cridi l'ha
// d'esperar sempre, amb agents o sense.
//
// Torna sempre les mateixes tres llistes, sempre presents:
//
//   llestos      [fila, ...]  els disset camps, a punt per a la cua
//   dubtosos     [{ motiu, clau, similitud, opcions: [filaA, filaB] }, ...]
//   metadadades  Map<fila, [metadada, ...]>  la procedència, per referència de
//                fila; una fila fusionada en porta tantes com candidats l'han
//                format, en l'ordre del lot
// ------------------------------------------------------------
async function processaLot(candidatsRecerca, fontDelLot, crides) {
  var llista = candidatsRecerca || [];
  var agents = agentsDe(crides);
  var comparables = [];
  var incomparables = [];

  // 1. Cada candidat, pel mapeig. D'aquí surten ja les files de disset camps.
  for (var i = 0; i < llista.length; i++) {
    var unitat = unitatDeCandidat(llista[i], fontDelLot, i);

    if (clauFortaCompleta(unitat.fila)) {
      comparables.push(unitat);
    } else {
      incomparables.push(unitat);
    }
  }

  // 2. Les fusions, fins que no en quedi cap per fer (regla 1).
  var grups = fusionaElLot(comparables);

  // 3. El que queda per comparar entre les files ja fusionades: els dubtes.
  var dubtosos = parellesDubtoses(grups);

  // 4. El repartiment: qui va a la cua i qui va al curador.
  var llestes = unitatsLlestes(grups, incomparables, dubtosos);
  var metadadades = mapaDeMetadadades(grups, incomparables);

  // 5. Els agents, i només sobre les que ja estan assentades (regla 4).
  //    Sense agents connectats, aquest pas no fa absolutament res.
  await passaElsAgents(llestes, metadadades, agents);

  return {
    llestos: filesDeUnitats(llestes),
    dubtosos: dubtosos,
    metadadades: metadadades
  };
}


// --- Les peces: preparar cada candidat --------------------------------------

// ------------------------------------------------------------
// Un candidat del lot convertit en la unitat amb què treballa la resta del
// fitxer: la fila de producció, el descriptor de font que demana el dedup, la
// procedència que torna el mapeig, i la posició al lot (per no perdre l'ordre
// quan les files es fusionen o es reparteixen).
// ------------------------------------------------------------
function unitatDeCandidat(candidat, fontDelLot, posicio) {
  var registre = registreDeCandidat(candidat);
  var resultat = mapeig.mapejaAProduccio(registre);
  var declarada = fontDeclarada(candidat, fontDelLot);

  var llengua = declarada.llengua;
  if (llengua === '') {
    llengua = llenguaDelTitol(registre, resultat);
  }

  return {
    fila: resultat.fila,
    font: { tipus: declarada.tipus, llengua: llengua },
    procedencia: [resultat.metadadades],
    ordre: posicio
  };
}

// ------------------------------------------------------------
// El registre de recerca d'un candidat, vingui embolcallat o tal qual. Cap
// camp de l'esquema de recerca no es diu `registre`, o sigui que la forma
// embolcallada no es pot confondre amb un registre de debò.
// ------------------------------------------------------------
function registreDeCandidat(candidat) {
  if (!candidat) {
    return {};
  }
  if (candidat.registre) {
    return candidat.registre;
  }
  return candidat;
}

// ------------------------------------------------------------
// El descriptor de font que ha declarat qui crida: el del candidat si en porta,
// si no el del lot sencer, i si no cap. Un tipus buit és el rang mínim de la
// jerarquia: una procedència que no sabem classificar no mana sobre cap altra.
// ------------------------------------------------------------
function fontDeclarada(candidat, fontDelLot) {
  var propia = null;
  if (candidat && candidat.font) {
    propia = candidat.font;
  } else if (fontDelLot) {
    propia = fontDelLot;
  }

  if (!propia) {
    return { tipus: '', llengua: '' };
  }

  return { tipus: text(propia.tipus), llengua: text(propia.llengua) };
}

// ------------------------------------------------------------
// La llengua en què ha quedat escrit el TÍTOL de la fila, que és l'única cosa
// que el dedup compara i que els disset camps no saben dir.
//
// No és sempre `llengua_nom_original`, i el detall importa: quan l'original és
// francès i la recerca porta `nom_altra_llengua`, el mapeig publica la versió
// catalana (§1 de docs/HANDOFF-MAPEIG-RECERCA.md). Aquí es refà la mateixa
// tria, en el mateix ordre, per no dir una llengua que no és.
//
// Quan no es pot saber, torna '': el dedup ho tracta com a títol no comparable
// i el cas va al curador. Callar val més que endevinar (NOTES.md, «la clau
// forta no funciona sense la taula de noms de poble»).
// ------------------------------------------------------------
function llenguaDelTitol(registre, resultat) {
  var original = resultat.metadadades.llengua.titol;

  if (original === 'ca') {
    return 'ca';
  }

  // El mapeig agafa la versió de l'altra llengua sempre que n'hi hagi una.
  if (textDeRecerca(registre.nom_altra_llengua) !== '') {
    if (original === 'fr') {
      return 'ca';
    }
    // Original en una llengua que no sabem: l'«altra» tampoc no la sabem.
    return '';
  }

  return original;
}

// ------------------------------------------------------------
// Diu si una fila porta la clau forta sencera —data d'inici i municipi—, que és
// el que decideix si entra o no a la comparació (regla 3).
// ------------------------------------------------------------
function clauFortaCompleta(fila) {
  return text(fila.data_inici) !== '' && text(fila.municipi) !== '';
}


// --- Les peces: les fusions -------------------------------------------------

// ------------------------------------------------------------
// Fusiona el lot fins que no hi quedi cap parella que digui «mateix acte»
// (regla 1). Cada volta busca la primera parella fusionable, la fusiona i torna
// a començar: així una fila fusionada es torna a comparar amb totes les altres,
// que és exactament el que la fusió acumulativa demana.
//
// Acaba sempre: cada fusió treu una fila de la llista.
// ------------------------------------------------------------
function fusionaElLot(unitats) {
  var grups = unitats.slice();
  var hiHaHagutFusio = true;

  while (hiHaHagutFusio) {
    hiHaHagutFusio = false;

    for (var i = 0; i < grups.length && !hiHaHagutFusio; i++) {
      for (var j = i + 1; j < grups.length && !hiHaHagutFusio; j++) {
        var resposta = dedup.comparaEsdeveniments(grups[i], grups[j]);

        if (resposta.decisio === 'mateix-esdeveniment') {
          grups[i] = grupFusionat(grups[i], grups[j], resposta);
          grups.splice(j, 1);
          hiHaHagutFusio = true;
        }
      }
    }
  }

  return grups;
}

// ------------------------------------------------------------
// La unitat que surt de fusionar-ne dues. La fila fusionada la fa el dedup —amb
// la seva jerarquia de fonts i les dues notes de curador juntes—; aquí només se
// li posa al davant el descriptor de font de la candidata que ha guanyat, que
// és la que ha escrit el títol que hi ha quedat.
//
// La procedència no es fusiona mai: s'hi acumula. Dues fonts que expliquen el
// mateix acte són dues informacions, no una de sola.
// ------------------------------------------------------------
function grupFusionat(grupA, grupB, resposta) {
  var guanyador = grupA;
  if (resposta.guanyadora === 'B') {
    guanyador = grupB;
  }

  var ordre = grupA.ordre;
  if (grupB.ordre < ordre) {
    ordre = grupB.ordre;
  }

  return {
    fila: resposta.fila,
    font: guanyador.font,
    procedencia: grupA.procedencia.concat(grupB.procedencia),
    ordre: ordre
  };
}


// --- Les peces: els dubtes --------------------------------------------------

// ------------------------------------------------------------
// Totes les parelles de files que, un cop fetes les fusions, el dedup deixa en
// dubte. Es passa la resposta tal com ve —motiu, clau i similitud— més les dues
// files, perquè el curador les pugui veure totes dues, que és el que la funció
// de dedup ja fa quan dubta.
//
// Aquí ja no hi pot haver cap «mateix acte»: fusionaElLot() no s'atura fins que
// no en queda cap.
// ------------------------------------------------------------
function parellesDubtoses(grups) {
  var parelles = [];

  for (var i = 0; i < grups.length; i++) {
    for (var j = i + 1; j < grups.length; j++) {
      var resposta = dedup.comparaEsdeveniments(grups[i], grups[j]);

      if (resposta.decisio === 'dubtos') {
        parelles.push({
          motiu: resposta.motiu,
          clau: resposta.clau,
          similitud: resposta.similitud,
          opcions: [grups[i].fila, grups[j].fila]
        });
      }
    }
  }

  return parelles;
}


// --- Les peces: el repartiment final ----------------------------------------

// ------------------------------------------------------------
// Les unitats que van a la cua sense passar pel curador: les que no surten a
// cap parella dubtosa (regla 2), més les que no s'han pogut comparar (regla 3).
// Surten en l'ordre del lot, que és l'únic ordre que qui ha fet el lot reconeix.
//
// Torna les unitats i no les files perquè el pas de classificació que ve tot
// seguit necessita el descriptor de font de cadascuna, que a la fila no hi és.
// ------------------------------------------------------------
function unitatsLlestes(grups, incomparables, dubtosos) {
  var enDubte = filesEnDubte(dubtosos);
  var llestes = [];

  for (var i = 0; i < grups.length; i++) {
    if (enDubte.indexOf(grups[i].fila) === -1) {
      llestes.push(grups[i]);
    }
  }

  for (var j = 0; j < incomparables.length; j++) {
    llestes.push(incomparables[j]);
  }

  llestes.sort(function (a, b) {
    return a.ordre - b.ordre;
  });

  return llestes;
}

// ------------------------------------------------------------
// Només les files d'una llista d'unitats, en el mateix ordre. És l'últim pas
// abans de tornar: de la unitat, a fora només en surt la fila.
// ------------------------------------------------------------
function filesDeUnitats(unitats) {
  var files = [];

  for (var i = 0; i < unitats.length; i++) {
    files.push(unitats[i].fila);
  }

  return files;
}

// ------------------------------------------------------------
// Les files que apareixen en alguna parella dubtosa. Es comparen per referència
// —són els mateixos objectes— i no per `id`: un id buit no identifica ningú
// (NOTES.md, «publicar no sap distingir 'ja no hi era' de 'ja l'he publicat'»).
// ------------------------------------------------------------
function filesEnDubte(dubtosos) {
  var files = [];

  for (var i = 0; i < dubtosos.length; i++) {
    for (var j = 0; j < dubtosos[i].opcions.length; j++) {
      var fila = dubtosos[i].opcions[j];
      if (files.indexOf(fila) === -1) {
        files.push(fila);
      }
    }
  }

  return files;
}

// ------------------------------------------------------------
// La procedència de cada fila, indexada per la fila mateixa.
//
// És un Map amb la fila com a clau —l'objecte, no cap còpia ni cap id— justament
// perquè no hi hagi cap manera que la procedència acabi dins dels disset camps:
// són dues estructures separades i qui vulgui l'una ha de demanar l'altra a
// posta. Una fila fusionada en porta una per cada candidat que l'ha format.
//
// On acabarà vivint aquesta metadada segueix sense decidir-se (§4 de
// docs/HANDOFF-MAPEIG-RECERCA.md). Aquesta funció no ho resol: només fa que no
// es perdi pel camí.
// ------------------------------------------------------------
function mapaDeMetadadades(grups, incomparables) {
  var mapa = new Map();

  for (var i = 0; i < grups.length; i++) {
    mapa.set(grups[i].fila, grups[i].procedencia);
  }

  for (var j = 0; j < incomparables.length; j++) {
    mapa.set(incomparables[j].fila, incomparables[j].procedencia);
  }

  return mapa;
}


// --- Les peces: els agents --------------------------------------------------

// ------------------------------------------------------------
// Els agents, escrits sempre pels seus noms, vingui `crides` com vingui: un
// objecte { verifica, classifica, puja }, una funció tota sola (la forma
// antiga, que vol dir el classificador) o res.
//
// Existeix perquè la resta del fitxer no hagi de saber res d'aquestes tres
// formes: a partir d'aquí sempre hi ha un objecte amb les mateixes claus, i
// cada clau o és una funció o és null. Un agent nou s'afegeix en dos llocs
// —aquí i a passaElsAgents()—, es diu amb un verb, i enlloc més.
// ------------------------------------------------------------
function agentsDe(crides) {
  if (typeof crides === 'function') {
    return { verifica: null, classifica: crides, puja: null };
  }

  if (!crides) {
    return { verifica: null, classifica: null, puja: null };
  }

  return {
    verifica: funcioOCap(crides.verifica),
    classifica: funcioOCap(crides.classifica),
    puja: funcioOCap(crides.puja)
  };
}

// ------------------------------------------------------------
// El valor si és una funció, i null si no ho és. Serveix perquè un agent
// mal escrit —una cadena, un objecte, un `undefined`— es tracti igual que un
// agent absent i no es cridi mai.
// ------------------------------------------------------------
function funcioOCap(valor) {
  if (typeof valor === 'function') {
    return valor;
  }
  return null;
}

// ------------------------------------------------------------
// Fa passar les files llestes pels agents connectats. Les de `dubtosos` no hi
// entren mai: aquesta funció només rep les llestes (regla 4).
//
// AQUEST ÉS EL LLOC ON ES DECIDEIX L'ORDRE DE LES NOTES (regla 5): verificació,
// classificació i cartell, en aquest ordre, perquè ajuntaNotes() posa cada nota
// nova al darrere. Si mai s'ha de canviar l'ordre, es canvia aquí: són tres
// blocs seguits, i no hi ha cap altre lloc que hi digui res.
//
// L'agent que no s'hagi passat no fa res de res —ni una nota, ni un canvi de
// camp, ni una còpia de fila—, perquè un lot processat sense connectar-hi res
// ha de sortir idèntic al que sortia abans que el pas existís. Cridar les peces
// sense funció escriuria «no hi ha cap classificador connectat», «no hi ha cap
// verificador connectat» o «el cartell encara no és nostre» a cada fila, i això
// no és el mateix que no classificar, no verificar i no tocar cap cartell.
// ------------------------------------------------------------
async function passaElsAgents(unitats, metadadades, agents) {
  if (agents.verifica !== null) {
    await passaLesLlestesPer(unitats, metadadades, function (candidat) {
      return verificacio.verificaEsdeveniment(candidat, agents.verifica);
    });
  }

  if (agents.classifica !== null) {
    await passaLesLlestesPer(unitats, metadadades, function (candidat) {
      return criteri.classificaEditorial(candidat, agents.classifica);
    });
  }

  if (agents.puja !== null) {
    await passaLesLlestesPer(unitats, metadadades, function (candidat) {
      return cartells.pujaCartell(candidat, agents.puja);
    });
  }
}

// ------------------------------------------------------------
// La mecànica de fer passar cada unitat llesta per un agent. És compartida
// perquè la part delicada —la reindexació— és idèntica per als dos i és
// exactament la mena de codi que no s'ha de tenir escrit dues vegades.
//
// Les crides van d'una en una, no totes alhora: un lot de cent files són cent
// peticions per agent, i engegar-les de cop és la manera més ràpida que hi ha
// de fer enfadar una quota gratuïta. Aquí el temps no és el problema.
//
// Cap de les tres peces —classificaEditorial(), verificaEsdeveniment() i
// pujaCartell()— no toca mai la fila que li donen: en tornen una de nova. Per
// això aquí es canvia la fila de la
// unitat I es reindexen les metadadades, que van per referència d'objecte: si
// no, la procedència es quedaria penjada de la fila vella i la nova no en
// tindria cap (NOTES.md, «quan connectis una funció que torna còpies a una
// estructura indexada per referència»).
//
// El candidat que rep l'agent porta també la `procedencia`, i no és decoració:
// és d'on verificaEsdeveniment() treu la citació literal de la font per poder
// contrastar-hi la fila. classificaEditorial() i pujaCartell() no la miren i la
// deixen passar.
// ------------------------------------------------------------
async function passaLesLlestesPer(unitats, metadadades, agent) {
  for (var i = 0; i < unitats.length; i++) {
    var unitat = unitats[i];

    var passat = await agent({
      fila: unitat.fila,
      font: unitat.font,
      procedencia: unitat.procedencia
    });

    var procedencia = metadadades.get(unitat.fila);
    metadadades.delete(unitat.fila);
    metadadades.set(passat.fila, procedencia);

    unitat.fila = passat.fila;
  }
}


// --- Les peces: neteja de valors --------------------------------------------

// ------------------------------------------------------------
// Qualsevol valor convertit a la cadena retallada que demana el §4 de
// CLAUDE.md: desconegut és sempre '', mai null ni undefined.
// ------------------------------------------------------------
function text(valor) {
  if (typeof valor !== 'string') {
    return '';
  }
  return valor.trim();
}

// ------------------------------------------------------------
// El mateix, però sobre un camp que ve de la recerca: allà els buits són la
// cadena literal "null" (§3 de docs/HANDOFF-MAPEIG-RECERCA.md), i s'han de
// tractar com el camp absent.
// ------------------------------------------------------------
function textDeRecerca(valor) {
  var net = text(valor);

  if (net === 'null' || net === 'n/a' || net === 'N/A') {
    return '';
  }

  return net;
}


// --- El que surt d'aquest fitxer --------------------------------------------

module.exports = {
  processaLot: processaLot
};


// --- Proves des del terminal ------------------------------------------------
// Tot el que ve a partir d'aquí és per poder exercitar la funció a mà. No forma
// part de la peça i no s'ha de copiar enlloc.

// Els cartells que porta el lot de prova, i el que n'ha de sortir. Cap d'aquests
// URL no es visita mai: el pujador d'aquestes proves és de mentida.
//
//   FORA       un cartell allotjat a casa d'un tercer, com els del CSV de
//              recerca: és el cas que l'agent ha de copiar.
//   NOSTRE     la còpia de Cloudinary que hi ha de deixar el pujador quan va bé.
//   XARXA      un enllaç a una publicació d'Instagram: es descarta sense
//              provar-ho i sense gastar cap crida.
//   JA_NOSTRE  un cartell que ja apunta a Cloudinary. És el cas del Typebot
//              (§7 de CLAUDE.md, «l'URL arriba fet»): no s'ha de tocar.
//   DUBTE      un altre cartell forà, però penjat d'una fila que anirà a
//              `dubtosos`: no s'ha de tocar mai (regla 4).
var URL_CARTELL_FORA = 'https://cdt66.media.tourinsoft.eu/upload/Taller-Elna.jpg';
var URL_CARTELL_NOSTRE = 'https://res.cloudinary.com/agenda-nord/image/upload/' +
  'v1756400000/clm-agenda/posters/taller-elna.webp';
var URL_CARTELL_XARXA = 'https://www.instagram.com/p/DZ_94qCIblJ/';
var URL_CARTELL_JA_NOSTRE = 'https://res.cloudinary.com/exemple/goulamask.webp';
var URL_CARTELL_DUBTE = 'https://files.appli-intramuros.com/img/events/6388/fira-prada.jpg';

// ------------------------------------------------------------
// El lot de prova: set candidats fets a mà que cobreixen tot el que el lot pot
// trobar-se. Els camps de recerca que no hi són es tracten com a buits, que és
// justament el que ha de passar.
//
//   1-3  el mateix concert, tres fonts. La 1 i la 2 es fusionen; la 3 NO lliga
//        amb la 1 tota sola (0,40: zona dubtosa) i sí amb la fila fusionada
//        (0,60), perquè la fusió es queda el títol de l'organitzador. És el cas
//        de la cadena: sense fusió acumulativa, aquest lot faria dues files.
//   4-5  la mateixa fira en dues llengües: parella DUBTOSA, perquè els títols
//        no es comparen mai entre llengües.
//   6    un acte sol, sense parella enlloc. Porta un cartell FORÀ: és l'única
//        fila del lot que fa gastar una crida al pujador.
//   7    els buits de la recerca: "null" a la data i al municipi, i camps que
//        directament no hi són. Sense clau forta: no es compara amb ningú.
//        Porta un cartell d'INSTAGRAM: es descarta sense crida.
//
// Els cartells del lot, que és el que fa treballar el tercer agent: el concert
// n'hereta un de Cloudinary (candidat 3), el taller en porta un de forà, el
// mercat un d'Instagram, i la fila francesa de la fira —que acabarà a
// `dubtosos`— un altre de forà que no s'ha de tocar mai.
// ------------------------------------------------------------
function lotDeProva() {
  return [
    {
      registre: {
        nom_original: 'Concert de Goulamas\'k',
        llengua_nom_original: 'ca',
        data_inici: '2026-09-12',
        data_fi: '2026-09-12',
        municipi: 'Ceret',
        comarca: 'Vallespir',
        categoria: 'concert',
        url_font: 'https://agregador.example/concert-goulamask',
        citacio_literal: 'Concert de Goulamas\'k le 12 septembre a Ceret.'
      },
      font: { tipus: 'agregador' }
    },
    {
      registre: {
        nom_original: 'Goulamas\'k en concert a Ceret',
        llengua_nom_original: 'ca',
        data_inici: '2026-09-12',
        data_fi: '2026-09-12',
        hora_inici: '21:00',
        lloc: 'Sala Novetats',
        municipi: 'Céret',
        comarca: 'Vallespir',
        categoria: 'music',
        organitzador: 'Casal Cultural del Vallespir',
        descripcio_original: 'Le groupe occitan revient à Céret.',
        llengua_descripcio: 'fr',
        citacio_literal: 'Le groupe occitan revient a Ceret le 12 septembre, salle Novetats.'
      },
      font: { tipus: 'organitzador' }
    },
    {
      registre: {
        nom_original: 'Concert de Goulamas\'k a Ceret, plaça de la República',
        llengua_nom_original: 'ca',
        data_inici: '2026-09-12',
        data_fi: '2026-09-12',
        municipi: 'Ceret',
        url_cartell: URL_CARTELL_JA_NOSTRE,
        citacio_literal: 'Concert place de la Republique, Ceret, 12/09/2026.'
      },
      font: { tipus: 'oficina-turisme' }
    },
    {
      registre: {
        nom_original: 'Fira del bestiar',
        llengua_nom_original: 'ca',
        data_inici: '2026-10-03',
        data_fi: '2026-10-03',
        municipi: 'Prades / Prada',
        comarca: 'Conflent',
        categoria: 'fair'
      },
      font: { tipus: 'organitzador' }
    },
    {
      registre: {
        nom_original: 'Foire au bétail',
        llengua_nom_original: 'fr',
        data_inici: '2026-10-03',
        data_fi: '2026-10-03',
        municipi: 'Prades',
        comarca: 'Conflent',
        categoria: 'fair',
        url_cartell: URL_CARTELL_DUBTE
      },
      font: { tipus: 'agregador' }
    },
    {
      registre: {
        nom_original: 'Taller de cuina catalana',
        llengua_nom_original: 'ca',
        data_inici: '2026-11-07',
        data_fi: '2026-11-07',
        municipi: 'Elna',
        comarca: 'Rosselló',
        categoria: 'workshop',
        url_cartell: URL_CARTELL_FORA,
        citacio_literal: 'Atelier de cuisine catalane a Elne, le 7 novembre.'
      },
      font: { tipus: 'organitzador' }
    },
    {
      registre: {
        nom_original: 'Mercat de Nadal',
        llengua_nom_original: 'ca',
        data_inici: 'null',
        data_fi: 'null',
        municipi: 'null',
        categoria: 'null',
        url_cartell: URL_CARTELL_XARXA,
        organitzador: 'null'
      },
      font: { tipus: 'agregador' }
    }
  ];
}

// ------------------------------------------------------------
// Els disset camps, per comprovar que cap fila del resultat no se n'ha inventat
// cap ni n'ha perdut cap.
// ------------------------------------------------------------
var CAMPS_PRODUCCIO = [
  'id', 'titol', 'data_inici', 'data_fi', 'hora', 'lloc', 'municipi',
  'comarca', 'categoria', 'descripcio_ca', 'descripcio_fr', 'associacio',
  'imatge_url', 'font_url', 'estat', 'data_entrada', 'nota_curador'
];

// ------------------------------------------------------------
// El que ha de sortir d'aquell lot, escrit com una taula del comportament
// pactat. Cada comprovació torna un problema o cap.
// ------------------------------------------------------------
function comprovacions(resultat) {
  var problemes = [];
  var concert = resultat.llestos[0];
  var taller = resultat.llestos[1];
  var mercat = resultat.llestos[2];

  if (resultat.llestos.length !== 3) {
    problemes.push('esperava 3 files llestes, en tinc ' + resultat.llestos.length);
    return problemes;
  }
  if (resultat.dubtosos.length !== 1) {
    problemes.push('esperava 1 parella dubtosa, en tinc ' + resultat.dubtosos.length);
  }

  // La cadena: les tres files del concert han acabat en una de sola.
  if (concert.titol !== 'Goulamas\'k en concert a Ceret') {
    problemes.push('el títol fusionat hauria de ser el de l\'organitzador, tinc «' + concert.titol + '»');
  }
  if (resultat.metadadades.get(concert).length !== 3) {
    problemes.push('la fila fusionada hauria de portar 3 procedències, en porta ' +
                   resultat.metadadades.get(concert).length);
  }
  // La fusió omple els buits de la que mana amb el que porten les altres.
  if (concert.imatge_url === '' || concert.hora !== '21:00') {
    problemes.push('la fusió no ha completat els buits (hora «' + concert.hora +
                   '», imatge «' + concert.imatge_url + '»)');
  }

  // Sense pujador connectat, cada `imatge_url` és exactament el que hi ha deixat
  // el mapeig: cap dels tres cartells del lot no s'ha mogut.
  if (concert.imatge_url !== URL_CARTELL_JA_NOSTRE) {
    problemes.push('sense pujador, el cartell del concert hauria de ser el de ' +
                   'Cloudinary: «' + concert.imatge_url + '»');
  }
  if (taller.imatge_url !== URL_CARTELL_FORA) {
    problemes.push('sense pujador, el cartell del taller hauria de ser l\'URL forà: ' +
                   '«' + taller.imatge_url + '»');
  }
  if (mercat.imatge_url !== URL_CARTELL_XARXA) {
    problemes.push('sense pujador, el cartell del mercat hauria de ser el ' +
                   'd\'Instagram: «' + mercat.imatge_url + '»');
  }
  // La nota del curador travessa la fusió sencera.
  if (concert.nota_curador !== 'Descripció en francès: falta la traducció catalana.') {
    problemes.push('la nota del curador s\'ha perdut a la fusió: «' + concert.nota_curador + '»');
  }

  // El dubte: la fira en dues llengües, amb les dues files visibles.
  var dubte = resultat.dubtosos[0];
  if (dubte.opcions.length !== 2 ||
      dubte.opcions[0].titol !== 'Fira del bestiar' ||
      dubte.opcions[1].titol !== 'Foire au bétail') {
    problemes.push('la parella dubtosa no porta les dues files de la fira');
  }
  if (dubte.opcions[1].nota_curador === '') {
    problemes.push('la fila francesa hauria de portar l\'avís de traduir el títol');
  }

  // Regla 2: cap fila dubtosa no surt també a llestos.
  for (var i = 0; i < resultat.llestos.length; i++) {
    for (var j = 0; j < dubte.opcions.length; j++) {
      if (resultat.llestos[i] === dubte.opcions[j]) {
        problemes.push('la fila «' + resultat.llestos[i].titol + '» surt a les dues llistes');
      }
    }
  }

  // L'acte sol passa tal qual.
  if (taller.titol !== 'Taller de cuina catalana' || taller.categoria !== 'Taller') {
    problemes.push('l\'acte sol no ha passat intacte: «' + taller.titol + '»');
  }

  // Regla 3: sense clau forta no es compara, però arriba igual amb el seu avís.
  if (mercat.titol !== 'Mercat de Nadal') {
    problemes.push('la fila sense clau forta no ha arribat a llestos');
  }
  if (mercat.id !== '' || mercat.data_inici !== '' || mercat.municipi !== '') {
    problemes.push('la fila sense clau forta hauria de tenir l\'id, la data i el municipi buits');
  }
  if (mercat.nota_curador === '') {
    problemes.push('la fila sense clau forta hauria de portar l\'avís de l\'id buit');
  }

  // Les garanties que valen per a totes les files de totes dues llistes.
  var totes = resultat.llestos.concat(dubte.opcions);
  for (var t = 0; t < totes.length; t++) {
    var fila = totes[t];
    var claus = Object.keys(fila);

    if (claus.join('|') !== CAMPS_PRODUCCIO.join('|')) {
      problemes.push('una fila no porta els disset camps en ordre');
    }
    for (var c = 0; c < claus.length; c++) {
      if (typeof fila[claus[c]] !== 'string') {
        problemes.push(claus[c] + ' no és una cadena');
      }
      if (fila[claus[c]] === 'null' || fila[claus[c]] === 'n/a') {
        problemes.push(claus[c] + ' ha arribat amb el text «' + fila[claus[c]] + '»');
      }
    }
    if (!resultat.metadadades.has(fila)) {
      problemes.push('la fila «' + fila.titol + '» no té metadada indexada');
    }
    if (fila.procedencia !== undefined || fila.metadadades !== undefined) {
      problemes.push('la procedència s\'ha colat dins dels disset camps');
    }
    // Sense classificador connectat, ni suggeriment ni excusa de suggeriment.
    if (fila.nota_curador.indexOf(MARCA_SUGGERIMENT) !== -1) {
      problemes.push('sense classificador, la fila «' + fila.titol +
                     '» porta una nota de classificació: «' + fila.nota_curador + '»');
    }
    // I sense pujador, ni nota de cartell ni excusa de nota de cartell.
    if (fila.nota_curador.indexOf(MARCA_CARTELL) !== -1) {
      problemes.push('sense pujador, la fila «' + fila.titol +
                     '» porta una nota de cartell: «' + fila.nota_curador + '»');
    }
  }

  return problemes;
}


// --- Proves: el lot amb els agents connectats -------------------------------

// La marca amb què classifica-editorial.js comença totes les seves notes, sigui
// un suggeriment o un «no disponible». És l'única cosa que cal buscar per saber
// si una fila ha passat o no pel classificador.
var MARCA_SUGGERIMENT = '[Suggeriment editorial: ';

// El mateix per a verifica-esdeveniment.js. Compte: aquella peça CALLA quan tot
// quadra (el seu §«criteri de silenci»), o sigui que no trobar aquesta marca no
// vol dir que la fila no s'hagi verificat. Per això el verificador de mentida
// d'aquesta bateria no respon mai «ok»: així cada fila verificada deixa rastre i
// es pot comptar.
var MARCA_VERIFICACIO = '[Verificació: ';

// La resposta que dona el classificador de mentida, i la nota que n'ha de
// sortir. Escrites a part perquè les comprovacions puguin comparar el text
// sencer i no només un tros.
var RESPOSTA_DE_PROVA = {
  nivell: 'NUCLI',
  regla: 'R6',
  motiu: 'Teixit associatiu del país'
};
// El punt final el posa netejaMotiu(): el motiu del model sempre acaba en punt.
var NOTA_DE_PROVA = '[Suggeriment editorial: NUCLI — R6] Teixit associatiu del país.';

// El mateix per al verificador: la resposta del model de mentida i la nota que
// n'ha de sortir. Mai «ok», pel motiu que diu MARCA_VERIFICACIO.
var RESPOSTA_VERIFICACIO = {
  resultat: 'dubte',
  camps_afectats: ['hora'],
  motiu: 'La citació no dona cap hora'
};
var NOTA_VERIFICACIO = '[Verificació: dubte — hora] La citació no dona cap hora.';

// La nota que rep una fila llesta que no porta cap citació literal a la seva
// procedència: la del «Mercat de Nadal», que és el candidat 7 del lot.
var NOTA_NO_VERIFICABLE = '[Verificació: no disponible] Sense verificar: ' +
  'el candidat no porta cap referència a l\'origen.';

// La marca amb què puja-cartell.js comença totes les seves notes. Compte, com
// amb la verificació: aquella peça CALLA quan la pujada va bé, o sigui que no
// trobar aquesta marca no vol dir que la fila no hagi passat per l'agent. El que
// es compta llavors són les crides al pujador i el valor d'`imatge_url`.
var MARCA_CARTELL = '[Cartell: ';

// Les dues notes que pot escriure l'agent del cartell amb aquest lot, senceres,
// tal com les escriuen notaDescartat() i notaNoPujat().
var NOTA_CARTELL_DESCARTAT = '[Cartell: descartat] L\'enllaç del cartell va a una ' +
  'publicació de xarxa social (instagram.com), que no és una imatge estable: ' +
  'cal buscar-ne una altra o deixar la fitxa sense cartell.';
var MOTIU_PUJADA_FALLIDA = '403 Forbidden';
var NOTA_CARTELL_NO_PUJAT = '[Cartell: no pujat] El cartell no s\'ha pogut copiar ' +
  'a Cloudinary: 403 Forbidden. La fitxa queda sense imatge.';

// ------------------------------------------------------------
// Un classificador de mentida que sempre respon el mateix, com el mock canònic
// de la bateria de classifica-editorial.js. És el que fa que aquestes proves no
// necessitin ni clau ni xarxa: el que es prova aquí és el cablejat, no si el
// model encerta.
//
// Va comptant les crides, perquè una de les comprovacions és justament que se
// n'hagi fet una per fila llesta i cap més.
// ------------------------------------------------------------
function classificadorDeProva() {
  var mentider = function () {
    mentider.crides++;
    return Promise.resolve(RESPOSTA_DE_PROVA);
  };

  mentider.crides = 0;
  return mentider;
}

// ------------------------------------------------------------
// Un verificador de mentida, igual que l'anterior i pels mateixos motius. Es
// queda la darrera referència que ha rebut, perquè una de les comprovacions és
// que la citació literal de la font arribi fins aquí passant per la
// `procedencia` de la unitat.
// ------------------------------------------------------------
function verificadorDeProva() {
  var mentider = function (fila, referencia) {
    mentider.crides++;
    mentider.referencies.push(referencia);
    return Promise.resolve(RESPOSTA_VERIFICACIO);
  };

  mentider.crides = 0;
  mentider.referencies = [];
  return mentider;
}

// ------------------------------------------------------------
// Un pujador de mentida que sempre diu que sí. No surt a la xarxa: no hi ha cap
// `fetch` ni cap nom de cloud enlloc d'aquesta bateria. Es queda els URL que ha
// rebut, perquè una de les comprovacions és justament que només se'l cridi per
// als cartells forans i no per als que ja són nostres.
// ------------------------------------------------------------
function pujadorDeProva() {
  var mentider = function (urlOrigen) {
    mentider.crides++;
    mentider.origens.push(urlOrigen);
    return Promise.resolve({ url: URL_CARTELL_NOSTRE });
  };

  mentider.crides = 0;
  mentider.origens = [];
  return mentider;
}

// ------------------------------------------------------------
// El mateix pujador, però que sempre diu que no. No llança: torna { error },
// que és l'altra meitat del contracte de `funcioPujada`.
// ------------------------------------------------------------
function pujadorQueFalla() {
  var mentider = function () {
    mentider.crides++;
    return Promise.resolve({ error: MOTIU_PUJADA_FALLIDA });
  };

  mentider.crides = 0;
  return mentider;
}

// ------------------------------------------------------------
// El que ha de sortir del mateix lot quan hi ha classificador connectat. El
// dedup i el mapeig han de fer exactament el mateix que sense: l'única cosa que
// canvia és la nota de cada fila llesta.
//
// Aquesta comprovació passa el classificador amb la FORMA ANTIGA —una funció
// tota sola al tercer paràmetre—, i és a posta: és el que garanteix que les
// crides escrites abans que la verificació existís continuïn volent dir el
// mateix.
// ------------------------------------------------------------
async function comprovacionsAmbClassificador() {
  var problemes = [];
  var mentider = classificadorDeProva();
  var resultat = await processaLot(lotDeProva(), null, mentider);

  // El repartiment no s'ha mogut: classificar no fusiona ni desfusiona res.
  if (resultat.llestos.length !== 3 || resultat.dubtosos.length !== 1) {
    problemes.push('amb classificador el repartiment ha canviat: ' +
                   resultat.llestos.length + ' llestos i ' +
                   resultat.dubtosos.length + ' dubtosos');
    return problemes;
  }

  // Una crida per fila llesta, i cap per les dues files dubtoses.
  if (mentider.crides !== 3) {
    problemes.push('esperava 3 crides al classificador, se n\'han fet ' + mentider.crides);
  }

  // Cada fila llesta porta el suggeriment.
  for (var i = 0; i < resultat.llestos.length; i++) {
    if (resultat.llestos[i].nota_curador.indexOf(NOTA_DE_PROVA) === -1) {
      problemes.push('la fila llesta «' + resultat.llestos[i].titol +
                     '» no porta el suggeriment: «' + resultat.llestos[i].nota_curador + '»');
    }
  }

  // L'ordre de les dues notes: primer la de mapeig i dedup, després la nova.
  // És el mateix ordre que ja fa ajuntaNotes(), i el concert és el cas que en
  // porta una de cada.
  var concert = resultat.llestos[0];
  var esperada = 'Descripció en francès: falta la traducció catalana. ' + NOTA_DE_PROVA;
  if (concert.nota_curador !== esperada) {
    problemes.push('la nota del concert no és la de mapeig seguida de la de ' +
                   'classificació: «' + concert.nota_curador + '»');
  }

  // Regla 4: cap fila de dubtosos no en porta cap.
  var dubte = resultat.dubtosos[0];
  for (var o = 0; o < dubte.opcions.length; o++) {
    if (dubte.opcions[o].nota_curador.indexOf(MARCA_SUGGERIMENT) !== -1) {
      problemes.push('la fila dubtosa «' + dubte.opcions[o].titol +
                     '» s\'ha classificat, i no ho havia de fer');
    }
  }

  // Amb la forma antiga no hi ha verificador, i cap fila no n'ha de portar nota.
  for (var v = 0; v < resultat.llestos.length; v++) {
    if (resultat.llestos[v].nota_curador.indexOf(MARCA_VERIFICACIO) !== -1) {
      problemes.push('sense verificador, «' + resultat.llestos[v].titol +
                     '» porta una nota de verificació');
    }
  }

  // Les metadadades continuen indexades per la fila que surt, no per la vella.
  var totes = resultat.llestos.concat(dubte.opcions);
  if (resultat.metadadades.size !== totes.length) {
    problemes.push('les metadadades han quedat descompassades: ' +
                   resultat.metadadades.size + ' entrades per ' + totes.length + ' files');
  }
  for (var t = 0; t < totes.length; t++) {
    if (!resultat.metadadades.has(totes[t])) {
      problemes.push('la fila «' + totes[t].titol + '» ha perdut la metadada en classificar-se');
    }
  }
  if (resultat.metadadades.get(concert).length !== 3) {
    problemes.push('la fila fusionada hauria de conservar les 3 procedències');
  }

  // Els disset camps, intactes: la classificació n'escriu un i prou.
  for (var f = 0; f < resultat.llestos.length; f++) {
    var claus = Object.keys(resultat.llestos[f]);
    if (claus.join('|') !== CAMPS_PRODUCCIO.join('|')) {
      problemes.push('després de classificar, una fila no porta els disset camps en ordre');
    }
    for (var c = 0; c < claus.length; c++) {
      if (typeof resultat.llestos[f][claus[c]] !== 'string') {
        problemes.push('després de classificar, ' + claus[c] + ' no és una cadena');
      }
    }
  }

  return problemes;
}

// ------------------------------------------------------------
// La comprovació de la vora: un classificador que peta no atura el lot. La fila
// surt igual, amb la nota que ho diu, perquè classificaEditorial() no llança
// mai.
// ------------------------------------------------------------
async function comprovacionsAmbClassificadorQuePeta() {
  var problemes = [];
  var quePeta = function () {
    return Promise.reject(new Error('sense clau'));
  };
  var resultat = await processaLot(lotDeProva(), null, quePeta);

  if (resultat.llestos.length !== 3) {
    problemes.push('un classificador que peta ha canviat el repartiment: ' +
                   resultat.llestos.length + ' llestos');
    return problemes;
  }

  for (var i = 0; i < resultat.llestos.length; i++) {
    if (resultat.llestos[i].nota_curador.indexOf('Sense classificar:') === -1) {
      problemes.push('la fila «' + resultat.llestos[i].titol +
                     '» hauria de dir que no s\'ha pogut classificar');
    }
  }

  return problemes;
}

// --- Proves: els dos agents junts, i l'ordre de les notes -------------------

// La nota sencera que ha de portar el concert quan passa per tot: la de mapeig,
// la de verificació i la de classificació, en aquest ordre (regla 5). Escrita
// aquí sencera i no per trossos: l'ordre és justament el que es prova.
var NOTA_CONCERT_SENCERA = 'Descripció en francès: falta la traducció catalana. ' +
  NOTA_VERIFICACIO + ' ' + NOTA_DE_PROVA;

// La nota sencera del «Mercat de Nadal» quan hi ha els TRES agents connectats.
// És l'única fila del lot que rep una secció de cadascuna de les quatre menes,
// i per això és la que prova l'ordre de la regla 5 sencer.
var NOTA_MAPEIG_DEL_MERCAT = 'Sense data d\'inici: l\'id queda buit i aquesta ' +
  'fila no es pot identificar.';
var NOTA_MERCAT_SENCERA = NOTA_MAPEIG_DEL_MERCAT + ' ' + NOTA_NO_VERIFICABLE +
  ' ' + NOTA_DE_PROVA + ' ' + NOTA_CARTELL_DESCARTAT;

// Les tres citacions del concert, tal com les ha d'ajuntar
// referenciaOriginalDe() quan la fila ve de tres candidats fusionats.
var CITACIONS_DEL_CONCERT = 'Concert de Goulamas\'k le 12 septembre a Ceret.' +
  ' | Le groupe occitan revient a Ceret le 12 septembre, salle Novetats.' +
  ' | Concert place de la Republique, Ceret, 12/09/2026.';

// ------------------------------------------------------------
// El verificador i el classificador connectats, i el pujador NO: l'ordre exacte
// de les tres primeres seccions de la nota, i la comprovació que un agent del
// cartell absent no fa absolutament res —ni nota, ni cap canvi a `imatge_url`.
// ------------------------------------------------------------
async function comprovacionsAmbTotsDosAgents() {
  var problemes = [];
  var verificador = verificadorDeProva();
  var classificador = classificadorDeProva();
  var resultat = await processaLot(lotDeProva(), null,
    { verifica: verificador, classifica: classificador });

  if (resultat.llestos.length !== 3 || resultat.dubtosos.length !== 1) {
    problemes.push('amb els dos agents el repartiment ha canviat: ' +
                   resultat.llestos.length + ' llestos i ' +
                   resultat.dubtosos.length + ' dubtosos');
    return problemes;
  }

  var concert = resultat.llestos[0];
  var mercat = resultat.llestos[2];

  // L'ORDRE. Procedència, verificació, classificació, i el text sencer.
  if (concert.nota_curador !== NOTA_CONCERT_SENCERA) {
    problemes.push('la nota del concert no és procedència → verificació → ' +
                   'classificació:\n       tinc     «' + concert.nota_curador +
                   '»\n       esperava «' + NOTA_CONCERT_SENCERA + '»');
  }

  // El mateix, dit d'una altra manera, per si algun dia la nota de mapeig canvia
  // de text: el que no pot canviar mai és quina secció va davant de quina.
  var posicioVerificacio = concert.nota_curador.indexOf(MARCA_VERIFICACIO);
  var posicioSuggeriment = concert.nota_curador.indexOf(MARCA_SUGGERIMENT);
  if (posicioVerificacio === -1 || posicioSuggeriment === -1) {
    problemes.push('al concert li falta alguna de les dues seccions noves');
  } else if (posicioVerificacio > posicioSuggeriment) {
    problemes.push('la classificació surt abans que la verificació, i ha de ser al revés');
  }

  // Les crides: tres classificacions (una per fila llesta) i només dues
  // verificacions, perquè el «Mercat de Nadal» no porta cap citació i
  // verificaEsdeveniment() no gasta cap crida quan no té amb què contrastar.
  if (classificador.crides !== 3) {
    problemes.push('esperava 3 crides al classificador, se n\'han fet ' + classificador.crides);
  }
  if (verificador.crides !== 2) {
    problemes.push('esperava 2 crides al verificador, se n\'han fet ' + verificador.crides);
  }

  // La fila sense citació ho diu, i la classificació hi va igualment al darrere.
  if (mercat.nota_curador.indexOf(NOTA_NO_VERIFICABLE) === -1) {
    problemes.push('el mercat hauria de dir que no s\'ha pogut verificar: «' +
                   mercat.nota_curador + '»');
  }
  if (mercat.nota_curador.indexOf(NOTA_DE_PROVA) === -1) {
    problemes.push('el mercat no s\'ha classificat tot i no ser verificable');
  }

  // La citació arriba al verificador per la `procedencia` de la unitat, i una
  // fila fusionada hi porta les tres.
  if (verificador.referencies.length > 0 &&
      verificador.referencies[0].citacio_literal !== CITACIONS_DEL_CONCERT) {
    problemes.push('el verificador no ha rebut les tres citacions del concert: «' +
                   verificador.referencies[0].citacio_literal + '»');
  }

  // Regla 4: cap fila dubtosa no porta cap de les dues notes.
  var opcions = resultat.dubtosos[0].opcions;
  for (var o = 0; o < opcions.length; o++) {
    if (opcions[o].nota_curador.indexOf(MARCA_SUGGERIMENT) !== -1 ||
        opcions[o].nota_curador.indexOf(MARCA_VERIFICACIO) !== -1) {
      problemes.push('la fila dubtosa «' + opcions[o].titol +
                     '» ha passat per algun agent, i no ho havia de fer');
    }
  }

  // El rastre no s'ha trencat després de DUES substitucions de fila seguides.
  var totes = resultat.llestos.concat(opcions);
  if (resultat.metadadades.size !== totes.length) {
    problemes.push('les metadadades han quedat descompassades: ' +
                   resultat.metadadades.size + ' entrades per ' + totes.length + ' files');
  }
  for (var t = 0; t < totes.length; t++) {
    if (!resultat.metadadades.has(totes[t])) {
      problemes.push('la fila «' + totes[t].titol + '» ha perdut la metadada');
    }
  }
  if (resultat.metadadades.get(concert).length !== 3) {
    problemes.push('la fila fusionada hauria de conservar les 3 procedències');
  }

  // Sense pujador connectat: cap nota de cartell i cap `imatge_url` moguda.
  for (var g = 0; g < resultat.llestos.length; g++) {
    if (resultat.llestos[g].nota_curador.indexOf(MARCA_CARTELL) !== -1) {
      problemes.push('sense pujador, «' + resultat.llestos[g].titol +
                     '» porta una nota de cartell');
    }
  }
  if (concert.imatge_url !== URL_CARTELL_JA_NOSTRE ||
      resultat.llestos[1].imatge_url !== URL_CARTELL_FORA ||
      mercat.imatge_url !== URL_CARTELL_XARXA) {
    problemes.push('sense pujador, alguna `imatge_url` s\'ha mogut');
  }

  // Els disset camps, intactes: entre tots dos agents n'escriuen un i prou.
  for (var f = 0; f < resultat.llestos.length; f++) {
    var claus = Object.keys(resultat.llestos[f]);
    if (claus.join('|') !== CAMPS_PRODUCCIO.join('|')) {
      problemes.push('després dels agents, una fila no porta els disset camps en ordre');
    }
    for (var c = 0; c < claus.length; c++) {
      if (typeof resultat.llestos[f][claus[c]] !== 'string') {
        problemes.push('després dels agents, ' + claus[c] + ' no és una cadena');
      }
    }
  }

  return problemes;
}

// --- Proves: els tres agents junts ------------------------------------------

// ------------------------------------------------------------
// EL CAS COMPLET: els tres agents connectats. És la comprovació que dona sentit
// al cablejat sencer, i mira quatre coses alhora:
//
//   - l'ordre de les QUATRE seccions de la nota (regla 5), sobre el mercat, que
//     és l'única fila del lot que en rep una de cada mena;
//   - la pujada bona: el taller entra amb un cartell forà i surt amb el nostre,
//     i en silenci, perquè no hi ha res a assenyalar;
//   - la fila que ja porta una imatge de Cloudinary —el cas del Typebot—, que
//     no es toca i no gasta cap crida;
//   - i que el rastre de les metadadades aguanti TRES substitucions de fila
//     seguides, no dues.
// ------------------------------------------------------------
async function comprovacionsAmbTotsTresAgents() {
  var problemes = [];
  var verificador = verificadorDeProva();
  var classificador = classificadorDeProva();
  var pujador = pujadorDeProva();
  var resultat = await processaLot(lotDeProva(), null,
    { verifica: verificador, classifica: classificador, puja: pujador });

  if (resultat.llestos.length !== 3 || resultat.dubtosos.length !== 1) {
    problemes.push('amb els tres agents el repartiment ha canviat: ' +
                   resultat.llestos.length + ' llestos i ' +
                   resultat.dubtosos.length + ' dubtosos');
    return problemes;
  }

  var concert = resultat.llestos[0];
  var taller = resultat.llestos[1];
  var mercat = resultat.llestos[2];

  // L'ORDRE. Procedència, verificació, classificació, cartell, i el text sencer.
  if (mercat.nota_curador !== NOTA_MERCAT_SENCERA) {
    problemes.push('la nota del mercat no és procedència → verificació → ' +
                   'classificació → cartell:\n       tinc     «' + mercat.nota_curador +
                   '»\n       esperava «' + NOTA_MERCAT_SENCERA + '»');
  }

  // El mateix, dit per posicions, per si algun dia canvia el text d'alguna
  // secció: el que no pot canviar mai és quina va davant de quina.
  var ordre = [MARCA_VERIFICACIO, MARCA_SUGGERIMENT, MARCA_CARTELL];
  for (var m = 0; m < ordre.length; m++) {
    var posicio = mercat.nota_curador.indexOf(ordre[m]);
    if (posicio === -1) {
      problemes.push('al mercat li falta la secció «' + ordre[m] + '»');
    } else if (m > 0 && posicio < mercat.nota_curador.indexOf(ordre[m - 1])) {
      problemes.push('la secció «' + ordre[m] + '» surt abans que «' +
                     ordre[m - 1] + '», i ha de ser al revés');
    }
  }

  // El descartat: sense imatge, perquè l'URL d'Instagram no es pot publicar.
  if (mercat.imatge_url !== '') {
    problemes.push('el cartell d\'Instagram no s\'ha buidat: «' + mercat.imatge_url + '»');
  }

  // La pujada bona: cartell nostre i cap nota, que és el criteri de silenci.
  if (taller.imatge_url !== URL_CARTELL_NOSTRE) {
    problemes.push('el cartell del taller no s\'ha copiat a Cloudinary: «' +
                   taller.imatge_url + '»');
  }
  if (taller.nota_curador.indexOf(MARCA_CARTELL) !== -1) {
    problemes.push('una pujada bona no ha de deixar cap nota: «' +
                   taller.nota_curador + '»');
  }

  // El cas del Typebot: la imatge ja és nostra, no es toca i no gasta crida.
  if (concert.imatge_url !== URL_CARTELL_JA_NOSTRE) {
    problemes.push('el cartell que ja era de Cloudinary s\'ha mogut: «' +
                   concert.imatge_url + '»');
  }
  if (concert.nota_curador.indexOf(MARCA_CARTELL) !== -1) {
    problemes.push('la fila que ja tenia imatge nostra porta una nota de cartell');
  }

  // Una sola crida al pujador, i per l'únic cartell forà de `llestos`.
  if (pujador.crides !== 1) {
    problemes.push('esperava 1 crida al pujador, se n\'han fet ' + pujador.crides);
  }
  if (pujador.origens.length > 0 && pujador.origens[0] !== URL_CARTELL_FORA) {
    problemes.push('el pujador no ha rebut l\'URL forà del taller: «' +
                   pujador.origens[0] + '»');
  }

  // Els altres dos agents no han canviat de compte perquè n'hi hagi un de nou.
  if (classificador.crides !== 3) {
    problemes.push('esperava 3 crides al classificador, se n\'han fet ' + classificador.crides);
  }
  if (verificador.crides !== 2) {
    problemes.push('esperava 2 crides al verificador, se n\'han fet ' + verificador.crides);
  }

  // Regla 4: la fila dubtosa conserva el seu cartell forà i no en porta cap nota.
  var opcions = resultat.dubtosos[0].opcions;
  for (var o = 0; o < opcions.length; o++) {
    if (opcions[o].nota_curador.indexOf(MARCA_CARTELL) !== -1) {
      problemes.push('la fila dubtosa «' + opcions[o].titol +
                     '» ha passat pel pujador, i no ho havia de fer');
    }
  }
  if (opcions[1].imatge_url !== URL_CARTELL_DUBTE) {
    problemes.push('el cartell de la fila dubtosa s\'ha mogut: «' +
                   opcions[1].imatge_url + '»');
  }

  // El rastre no s'ha trencat després de TRES substitucions de fila seguides.
  var totes = resultat.llestos.concat(opcions);
  if (resultat.metadadades.size !== totes.length) {
    problemes.push('les metadadades han quedat descompassades: ' +
                   resultat.metadadades.size + ' entrades per ' + totes.length + ' files');
  }
  for (var t = 0; t < totes.length; t++) {
    if (!resultat.metadadades.has(totes[t])) {
      problemes.push('la fila «' + totes[t].titol + '» ha perdut la metadada');
    }
  }
  if (resultat.metadadades.get(concert).length !== 3) {
    problemes.push('la fila fusionada hauria de conservar les 3 procedències');
  }

  // Els disset camps, intactes: entre els tres agents n'escriuen dos i prou.
  for (var f = 0; f < resultat.llestos.length; f++) {
    var claus = Object.keys(resultat.llestos[f]);
    if (claus.join('|') !== CAMPS_PRODUCCIO.join('|')) {
      problemes.push('després dels tres agents, una fila no porta els disset camps en ordre');
    }
    for (var c = 0; c < claus.length; c++) {
      if (typeof resultat.llestos[f][claus[c]] !== 'string') {
        problemes.push('després dels tres agents, ' + claus[c] + ' no és una cadena');
      }
    }
  }

  return problemes;
}

// ------------------------------------------------------------
// Sense verificador, però amb classificador i pujador: cap nota de verificació
// enlloc, i les altres dues seccions al seu ordre. És la meitat que faltava de
// «l'agent que no es passa no fa res de res», ara amb tres agents a triar.
// ------------------------------------------------------------
async function comprovacionsSenseVerificador() {
  var problemes = [];
  var classificador = classificadorDeProva();
  var pujador = pujadorDeProva();
  var resultat = await processaLot(lotDeProva(), null,
    { classifica: classificador, puja: pujador });

  if (resultat.llestos.length !== 3) {
    problemes.push('sense verificador el repartiment ha canviat: ' +
                   resultat.llestos.length + ' llestos');
    return problemes;
  }

  var mercat = resultat.llestos[2];
  var esperada = NOTA_MAPEIG_DEL_MERCAT + ' ' + NOTA_DE_PROVA + ' ' + NOTA_CARTELL_DESCARTAT;

  if (mercat.nota_curador !== esperada) {
    problemes.push('sense verificador, la nota del mercat hauria de ser mapeig, ' +
                   'classificació i cartell: «' + mercat.nota_curador + '»');
  }
  for (var i = 0; i < resultat.llestos.length; i++) {
    if (resultat.llestos[i].nota_curador.indexOf(MARCA_VERIFICACIO) !== -1) {
      problemes.push('sense verificador, «' + resultat.llestos[i].titol +
                     '» porta una nota de verificació');
    }
  }
  if (resultat.llestos[1].imatge_url !== URL_CARTELL_NOSTRE) {
    problemes.push('sense verificador, el cartell del taller no s\'ha copiat igualment');
  }
  if (pujador.crides !== 1) {
    problemes.push('esperava 1 crida al pujador, se n\'han fet ' + pujador.crides);
  }

  return problemes;
}

// ------------------------------------------------------------
// Sense classificador, però amb verificador i pujador: el mateix per l'altra
// banda. Amb aquesta i l'anterior, cadascun dels tres agents ja s'ha provat
// absent mentre els altres dos hi eren.
// ------------------------------------------------------------
async function comprovacionsSenseClassificador() {
  var problemes = [];
  var verificador = verificadorDeProva();
  var pujador = pujadorDeProva();
  var resultat = await processaLot(lotDeProva(), null,
    { verifica: verificador, puja: pujador });

  if (resultat.llestos.length !== 3) {
    problemes.push('sense classificador el repartiment ha canviat: ' +
                   resultat.llestos.length + ' llestos');
    return problemes;
  }

  var mercat = resultat.llestos[2];
  var esperada = NOTA_MAPEIG_DEL_MERCAT + ' ' + NOTA_NO_VERIFICABLE + ' ' +
    NOTA_CARTELL_DESCARTAT;

  if (mercat.nota_curador !== esperada) {
    problemes.push('sense classificador, la nota del mercat hauria de ser mapeig, ' +
                   'verificació i cartell: «' + mercat.nota_curador + '»');
  }
  for (var i = 0; i < resultat.llestos.length; i++) {
    if (resultat.llestos[i].nota_curador.indexOf(MARCA_SUGGERIMENT) !== -1) {
      problemes.push('sense classificador, «' + resultat.llestos[i].titol +
                     '» porta una nota de classificació');
    }
  }
  if (pujador.crides !== 1) {
    problemes.push('esperava 1 crida al pujador, se n\'han fet ' + pujador.crides);
  }

  return problemes;
}

// ------------------------------------------------------------
// La comprovació de la vora, per al pujador: un pujador que diu que no deixa la
// fila sense imatge i amb la nota que ho explica —l'URL forà NO es conserva,
// perquè el web públic el serviria tal qual—, i no atura el lot.
// ------------------------------------------------------------
async function comprovacionsAmbPujadorQueFalla() {
  var problemes = [];
  var pujador = pujadorQueFalla();
  var resultat = await processaLot(lotDeProva(), null, { puja: pujador });

  if (resultat.llestos.length !== 3) {
    problemes.push('un pujador que falla ha canviat el repartiment: ' +
                   resultat.llestos.length + ' llestos');
    return problemes;
  }

  var taller = resultat.llestos[1];

  if (taller.imatge_url !== '') {
    problemes.push('una pujada fallida ha de deixar la fila sense imatge, i hi ha ' +
                   '«' + taller.imatge_url + '»');
  }
  if (taller.nota_curador !== NOTA_CARTELL_NO_PUJAT) {
    problemes.push('la nota d\'una pujada fallida no diu el motiu:\n       tinc     «' +
                   taller.nota_curador + '»\n       esperava «' +
                   NOTA_CARTELL_NO_PUJAT + '»');
  }
  if (pujador.crides !== 1) {
    problemes.push('esperava 1 crida al pujador, se n\'han fet ' + pujador.crides);
  }

  return problemes;
}

// ------------------------------------------------------------
// Només el verificador connectat: la nota ha de portar la secció de verificació
// i cap de classificació. És la meitat que faltava provar de «l'agent que no es
// passa no fa res de res».
// ------------------------------------------------------------
async function comprovacionsNomesVerificacio() {
  var problemes = [];
  var verificador = verificadorDeProva();
  var resultat = await processaLot(lotDeProva(), null, { verifica: verificador });

  if (resultat.llestos.length !== 3) {
    problemes.push('només amb verificador el repartiment ha canviat: ' +
                   resultat.llestos.length + ' llestos');
    return problemes;
  }

  var esperada = 'Descripció en francès: falta la traducció catalana. ' + NOTA_VERIFICACIO;
  if (resultat.llestos[0].nota_curador !== esperada) {
    problemes.push('només amb verificador, la nota del concert hauria de ser ' +
                   'la de mapeig seguida de la de verificació: «' +
                   resultat.llestos[0].nota_curador + '»');
  }

  for (var i = 0; i < resultat.llestos.length; i++) {
    if (resultat.llestos[i].nota_curador.indexOf(MARCA_SUGGERIMENT) !== -1) {
      problemes.push('sense classificador, «' + resultat.llestos[i].titol +
                     '» porta una nota de classificació');
    }
  }

  if (verificador.crides !== 2) {
    problemes.push('esperava 2 crides al verificador, se n\'han fet ' + verificador.crides);
  }

  return problemes;
}

// ------------------------------------------------------------
// Només el classificador, però amb la forma d'objecte. La forma antiga ja la
// prova comprovacionsAmbClassificador(); aquí es comprova que la nova diu
// exactament el mateix quan només porta una clau.
// ------------------------------------------------------------
async function comprovacionsNomesClassificacio() {
  var problemes = [];
  var classificador = classificadorDeProva();
  var resultat = await processaLot(lotDeProva(), null, { classifica: classificador });

  if (resultat.llestos.length !== 3) {
    problemes.push('només amb classificador el repartiment ha canviat: ' +
                   resultat.llestos.length + ' llestos');
    return problemes;
  }

  var esperada = 'Descripció en francès: falta la traducció catalana. ' + NOTA_DE_PROVA;
  if (resultat.llestos[0].nota_curador !== esperada) {
    problemes.push('només amb classificador, la nota del concert hauria de ser ' +
                   'la de mapeig seguida de la de classificació: «' +
                   resultat.llestos[0].nota_curador + '»');
  }

  for (var i = 0; i < resultat.llestos.length; i++) {
    if (resultat.llestos[i].nota_curador.indexOf(MARCA_VERIFICACIO) !== -1) {
      problemes.push('sense verificador, «' + resultat.llestos[i].titol +
                     '» porta una nota de verificació');
    }
  }

  if (classificador.crides !== 3) {
    problemes.push('esperava 3 crides al classificador, se n\'han fet ' + classificador.crides);
  }

  return problemes;
}

// ------------------------------------------------------------
// La comprovació de la vora, per al verificador: un verificador que peta no
// atura el lot ni impedeix que la classificació s'hi faci al darrere. És el
// mateix patró que comprovacionsAmbClassificadorQuePeta(), perquè
// verificaEsdeveniment() tampoc no llança mai.
// ------------------------------------------------------------
async function comprovacionsAmbVerificadorQuePeta() {
  var problemes = [];
  var quePeta = function () {
    return Promise.reject(new Error('sense clau'));
  };
  var classificador = classificadorDeProva();
  var resultat = await processaLot(lotDeProva(), null,
    { verifica: quePeta, classifica: classificador });

  if (resultat.llestos.length !== 3) {
    problemes.push('un verificador que peta ha canviat el repartiment: ' +
                   resultat.llestos.length + ' llestos');
    return problemes;
  }

  for (var i = 0; i < resultat.llestos.length; i++) {
    var nota = resultat.llestos[i].nota_curador;

    if (nota.indexOf('Sense verificar:') === -1) {
      problemes.push('la fila «' + resultat.llestos[i].titol +
                     '» hauria de dir que no s\'ha pogut verificar');
    }
    if (nota.indexOf(NOTA_DE_PROVA) === -1) {
      problemes.push('la fila «' + resultat.llestos[i].titol +
                     '» no s\'ha classificat: el verificador que peta ha aturat el lot');
    }
    if (nota.indexOf(MARCA_VERIFICACIO) > nota.indexOf(MARCA_SUGGERIMENT)) {
      problemes.push('a la fila «' + resultat.llestos[i].titol +
                     '» l\'ordre de les notes s\'ha invertit');
    }
  }

  if (classificador.crides !== 3) {
    problemes.push('esperava 3 crides al classificador, se n\'han fet ' + classificador.crides);
  }

  return problemes;
}

// ------------------------------------------------------------
// Passa el lot de prova i n'escriu el resultat al terminal.
// ------------------------------------------------------------
async function principal() {
  var resultat = await processaLot(lotDeProva());
  var problemes = comprovacions(resultat);

  console.log('LOT DE PROVA: 7 candidats de recerca');
  console.log('');

  console.log('llestos (' + resultat.llestos.length + ')');
  for (var i = 0; i < resultat.llestos.length; i++) {
    var fila = resultat.llestos[i];
    console.log('  · ' + (fila.id === '' ? '(sense id)' : fila.id));
    console.log('    títol      ' + fila.titol);
    console.log('    municipi   ' + (fila.municipi === '' ? '(cap)' : fila.municipi) +
                '   fonts: ' + resultat.metadadades.get(fila).length);
    if (fila.nota_curador !== '') {
      console.log('    nota       ' + fila.nota_curador);
    }
  }

  console.log('');
  console.log('dubtosos (' + resultat.dubtosos.length + ')');
  for (var d = 0; d < resultat.dubtosos.length; d++) {
    var dubte = resultat.dubtosos[d];
    console.log('  · ' + dubte.motiu);
    console.log('    clau       ' + dubte.clau +
                (dubte.similitud === null ? '' : '   similitud ' + dubte.similitud.toFixed(2)));
    for (var o = 0; o < dubte.opcions.length; o++) {
      console.log('    opció ' + (o + 1) + '    ' + dubte.opcions[o].titol +
                  '   fonts: ' + resultat.metadadades.get(dubte.opcions[o]).length);
    }
  }

  console.log('');
  console.log('metadadades: ' + resultat.metadadades.size + ' files indexades, ' +
              'cap camp de procedència dins de cap fila');
  console.log('');

  // El mateix lot, ara amb el classificador de mentida connectat.
  problemes = problemes.concat(await comprovacionsAmbClassificador());
  problemes = problemes.concat(await comprovacionsAmbClassificadorQuePeta());
  problemes = problemes.concat(await comprovacionsAmbTotsDosAgents());
  problemes = problemes.concat(await comprovacionsAmbTotsTresAgents());
  problemes = problemes.concat(await comprovacionsSenseVerificador());
  problemes = problemes.concat(await comprovacionsSenseClassificador());
  problemes = problemes.concat(await comprovacionsAmbPujadorQueFalla());
  problemes = problemes.concat(await comprovacionsNomesVerificacio());
  problemes = problemes.concat(await comprovacionsNomesClassificacio());
  problemes = problemes.concat(await comprovacionsAmbVerificadorQuePeta());

  var ambAgents = await processaLot(lotDeProva(), null, {
    verifica: verificadorDeProva(),
    classifica: classificadorDeProva(),
    puja: pujadorDeProva()
  });
  console.log('el mateix lot amb els tres agents connectats');
  console.log('(ordre de la nota: procedència → verificació → classificació → cartell)');
  for (var q = 0; q < ambAgents.llestos.length; q++) {
    console.log('  · ' + ambAgents.llestos[q].titol);
    console.log('    cartell    ' +
                (ambAgents.llestos[q].imatge_url === '' ? '(cap)' : ambAgents.llestos[q].imatge_url));
    console.log('    nota       ' + ambAgents.llestos[q].nota_curador);
  }
  console.log('  dubtosos: cap de les ' + filesEnDubte(ambAgents.dubtosos).length +
              ' files no ha passat per cap agent (regla 4)');
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
    process.argv[1].indexOf('processa-lot') !== -1) {
  principal();
}
