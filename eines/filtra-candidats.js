// ---------------------------------------------------------------------------
// FILTRE PREVI DE CANDIDATS
//
// Una sola feina: treure el soroll obvi d'una llista de candidats en brut,
// ABANS que arribin al mapeig i a processaLot(). Res més.
//
//   - Cap crida a Gemini ni a cap API. Codi pur: entra una llista, en surten
//     dues. No llegeix cap fitxer i no n'escriu cap.
//   - Cap detall d'ADT66 ni de cap altra font concreta: treballa sobre els
//     camps de l'esquema de recerca, i qualsevol font futura el crida igual.
//   - NO està connectat a res: ni a sincronitzaADT66(), ni a processaLot().
//     És la peça, no el cablejat.
//
// QUÈ NO ÉS AQUEST FILTRE, i val més tenir-ho clar abans de tocar-hi res: no és
// la classificació editorial. Decidir si un acte és de discurs o no, i si és
// nucli, perifèria, marcat o fora, són les regles R1-R7 de
// **docs/CRITERI-EDITORIAL.md**: feina d'un classificador que encara no
// existeix, i el que en surti serà sempre un SUGGERIMENT per al curador, mai una
// decisió. Això d'aquí és anterior i molt més tosc: mira dues
// coses mecàniques i comptables —si l'acte cau dins la finestra de dates i si
// el títol o l'organitzador porten una paraula de soroll conegut— i prou. La
// seva raó de ser és estalviar crides a Gemini i files que no s'han de mirar.
//
// La conseqüència pràctica d'aquesta ratlla: **a la llista negra no hi ha
// d'entrar mai una categoria editorial.** «Tren turístic» o «visita de pagament»
// són decisions del curador o del classificador; una agència immobiliària no ho
// és. En cas de dubte, la paraula es queda FORA de la llista i es pregunta.
//
// Res no es descarta en silenci: tot el que no passa surt a la segona llista
// amb el motiu concret, perquè quedi rastre del que no arribarà a la cua.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/filtra-candidats.js    -> passa la bateria de proves
// ---------------------------------------------------------------------------


// --- Constants: la finestra de dates ----------------------------------------

// Fins a quants mesos vista s'accepta un acte. Un acte que comença d'aquí a més
// temps no és soroll, però tampoc no és agenda: quan s'acosti tornarà a entrar
// per la mateixa porta, i mentrestant no ha d'ocupar la cua del curador.
var MESOS_DE_FINESTRA = 12;

// La vora de sota NO mira `data_inici` sinó l'últim dia de l'acte: un acte és
// passat només quan ja s'ha acabat.
//
// Sobre les 103 files reals del CSV de recerca, amb l'avui del 29 d'agost de
// 2026, n'hi ha **20** amb la data d'inici passada i la de final futura:
// mercats anuals («GRAND MARCHÉ DE PRADES», 2026-01-01 → 2026-12-31),
// exposicions llargues, festivals d'estiu. Mirant només `data_inici`, aquelles
// vint es descartarien mentre encara són obertes. La vora de dalt, en canvi, sí
// que mira `data_inici`: el que compta és quan comença.


// --- Constants: la llista negra ---------------------------------------------

// Paraules i expressions que, al títol o al nom de l'organitzador, diuen que
// això no és cap acte cultural sinó un anunci. Són quatre famílies i prou, totes
// quatre mecàniques: cap no demana criteri.
//
// Es comparen sobre el text normalitzat (minúscules, sense accents, sense
// apòstrofs ni guions) i com a PARAULA o expressió sencera, no com a tros de
// paraula: així «immobilier» no atrapa res que només s'hi assembli.
//
// Per afegir-n'hi una: una línia més a la família que toqui. Si t'has de pensar
// si hi va o no, NO hi va: vol dir que és criteri editorial, i el criteri
// editorial no viu aquí.
var PARAULES_DE_SOROLL = [
  // --- Immobiliària ---
  'immobilier',
  'immobiliere',
  'immobiliaria',
  'immobiliaries',

  // --- Ofertes de feina ---
  'offre d emploi',
  'offres d emploi',
  'recrutement',
  'job dating',
  'oferta de feina',
  'ofertes de feina',

  // --- Lloguer vacacional i allotjament ---
  'location de vacances',
  'locations de vacances',
  'meuble de tourisme',
  'meubles de tourisme',
  'chambre d hotes',
  'chambres d hotes',
  'lloguer vacacional',

  // --- Actes interns d'empresa ---
  // Cap lectura de docs/CRITERI-EDITORIAL.md els fa entrar: no són teixit
  // associatiu (R6), no són mercat ni fira, i no cauen en cap excepció. No hi
  // ha res a decidir, per això són aquí i no al criteri.
  'seminaire d entreprise',
  'seminaires d entreprise',
  'team building'
];


// --- Constants: on es mira -------------------------------------------------

// Els camps de l'esquema de recerca on es busquen les paraules de soroll. El
// títol hi és en les dues llengües perquè la recerca omple ara l'una ara
// l'altra, i l'anunci pot venir escrit en qualsevol de les dues.
var CAMPS_DE_TEXT = ['nom_original', 'nom_altra_llengua', 'organitzador'];


// --- La funció --------------------------------------------------------------

// ------------------------------------------------------------
// Filtra un lot de candidats en brut. Cada element pot ser:
//
//   - un registre de recerca tal qual, o
//   - { registre: <el registre>, font: {...} }, la mateixa forma que accepta
//     processaLot(), perquè el que surti d'aquí s'hi pugui passar sencer.
//
// Els candidats NO es toquen: els que passen surten tal com han entrat, amb el
// seu embolcall si en portaven. Aquesta peça no mapeja res.
//
// `avui` és opcional i s'escriu `AAAA-MM-DD`. Serveix per poder provar el
// filtre amb una data fixa; sense donar-lo, és el dia d'avui.
//
// Torna sempre les mateixes dues llistes, sempre presents:
//
//   passen      [candidat, ...]  tal com han entrat
//   descartats  [{ candidat, titol, motiu }, ...]  amb el motiu concret:
//               'fora de finestra' o 'paraula clau: X'
// ------------------------------------------------------------
function filtraCandidats(candidatsRecerca, avui) {
  var llista = candidatsRecerca || [];
  var dia = diaDeReferencia(avui);
  var final = finalDeFinestra(dia, MESOS_DE_FINESTRA);

  var passen = [];
  var descartats = [];

  for (var i = 0; i < llista.length; i++) {
    var candidat = llista[i];
    var registre = registreDeCandidat(candidat);
    var motiu = motiuDeDescart(registre, dia, final);

    if (motiu === '') {
      passen.push(candidat);
    } else {
      descartats.push({
        candidat: candidat,
        titol: textDeRecerca(registre.nom_original),
        motiu: motiu
      });
    }
  }

  return { passen: passen, descartats: descartats };
}

// ------------------------------------------------------------
// El motiu pel qual un candidat no passa, o '' si passa. Els dos criteris es
// miren en aquest ordre —primer les dates, que és el que en descarta més i el
// que costa menys— i el primer que enganxa és el que dona el motiu.
// ------------------------------------------------------------
function motiuDeDescart(registre, dia, final) {
  if (foraDeFinestra(registre, dia, final)) {
    return 'fora de finestra';
  }

  var paraula = paraulaDeSoroll(registre);
  if (paraula !== '') {
    return 'paraula clau: ' + paraula;
  }

  return '';
}


// --- Les peces: la finestra de dates ----------------------------------------

// ------------------------------------------------------------
// Diu si un acte cau fora de la finestra. Dues vores i dues dates diferents:
//
//   per sota   l'últim dia de l'acte (`data_fi` si en porta, si no `data_inici`)
//              ja és passat: l'acte s'ha acabat
//   per dalt   `data_inici` és més enllà del final de la finestra: encara és
//              massa lluny
//
// Un acte SENSE data d'inici no es descarta mai per aquest criteri. És el
// mateix que ja fa processaLot() amb la clau forta: no sabem situar-lo, i no
// saber-ho no és cap motiu per llençar-lo. Passa, i el curador el veurà amb
// l'avís que el mapeig li posarà a `nota_curador`.
//
// Una data que no tingui la forma AAAA-MM-DD es tracta igual que si no hi fos:
// aquest filtre no endevina formats.
// ------------------------------------------------------------
function foraDeFinestra(registre, dia, final) {
  var inici = dataDeRecerca(registre, 'data_inici');

  if (inici === '') {
    return false;
  }

  if (inici > final) {
    return true;
  }

  var ultimDia = inici;
  var fi = dataDeRecerca(registre, 'data_fi');
  if (fi !== '' && fi > inici) {
    ultimDia = fi;
  }

  return ultimDia < dia;
}

// ------------------------------------------------------------
// El dia de referència, en AAAA-MM-DD. Sense argument, avui. Es fa servir el
// calendari UTC, com a tot arreu del projecte: les dates de l'esquema són dies,
// no instants, i barrejar-hi fus horari només afegeix maneres d'equivocar-se.
// ------------------------------------------------------------
function diaDeReferencia(avui) {
  var donat = textDeRecerca(avui);

  if (esData(donat)) {
    return donat;
  }

  return new Date().toISOString().slice(0, 10);
}

// ------------------------------------------------------------
// L'últim dia que accepta la finestra: el dia de referència més uns quants
// mesos.
//
// Detall que val més dir que amagar: si el dia no existeix al mes de destí
// —el 31 de gener més un mes— JavaScript l'empeny al mes següent. Amb una
// finestra de mesos sencers això és un dia de diferència a la vora, i no
// canvia cap decisió que importi.
// ------------------------------------------------------------
function finalDeFinestra(dia, mesos) {
  var parts = dia.split('-');
  var any = Number(parts[0]);
  var mes = Number(parts[1]) - 1;
  var numero = Number(parts[2]);

  var data = new Date(Date.UTC(any, mes + mesos, numero));
  return data.toISOString().slice(0, 10);
}


// --- Les peces: la llista negra ---------------------------------------------

// ------------------------------------------------------------
// La primera paraula de soroll que apareix al títol o a l'organitzador, o ''
// si no n'hi ha cap. Torna la paraula tal com és a la llista, no com estava
// escrita al candidat: el motiu ha de dir quina regla ha saltat, no com anava
// escrita aquella fila.
// ------------------------------------------------------------
function paraulaDeSoroll(registre) {
  for (var i = 0; i < CAMPS_DE_TEXT.length; i++) {
    var text = normalitzaText(textDeRecerca(registre[CAMPS_DE_TEXT[i]]));

    if (text !== '') {
      for (var j = 0; j < PARAULES_DE_SOROLL.length; j++) {
        if (conteExpressio(text, PARAULES_DE_SOROLL[j])) {
          return PARAULES_DE_SOROLL[j];
        }
      }
    }
  }

  return '';
}

// ------------------------------------------------------------
// Diu si un text ja normalitzat conté una expressió sencera. Es comparen amb
// un espai a cada banda perquè una paraula no enganxi dins d'una altra: sense
// això, qualsevol llista negra acaba descartant coses per casualitat.
// ------------------------------------------------------------
function conteExpressio(text, expressio) {
  return (' ' + text + ' ').indexOf(' ' + expressio + ' ') !== -1;
}

// ------------------------------------------------------------
// Un text reduït a paraules comparables: minúscules, sense accents, i tot el
// que no sigui lletra o xifra convertit en un sol espai —apòstrofs i guions
// inclosos, que és el que fa que «chambre d'hôtes» i «chambre d hotes» siguin
// la mateixa cosa.
// ------------------------------------------------------------
function normalitzaText(text) {
  if (text === '') {
    return '';
  }

  var net = text.toLowerCase();
  net = net.normalize('NFD').replace(/[̀-ͯ]/g, '');
  net = net.replace(/[^a-z0-9]+/g, ' ');

  return net.trim();
}


// --- Les peces: neteja de valors --------------------------------------------

// ------------------------------------------------------------
// El registre de recerca d'un candidat, vingui embolcallat o tal qual. Cap
// camp de l'esquema de recerca no es diu `registre`, o sigui que la forma
// embolcallada no es pot confondre amb un registre de debò. És la mateixa
// regla que a eines/processa-lot.js.
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
// El valor net d'un camp de recerca: el camp absent, el buit i la cadena
// literal "null" que escriu la recerca es tracten igual (§3 de
// docs/HANDOFF-MAPEIG-RECERCA.md).
// ------------------------------------------------------------
function textDeRecerca(valor) {
  if (typeof valor !== 'string') {
    return '';
  }

  var net = valor.trim();
  if (net === 'null' || net === 'n/a' || net === 'N/A') {
    return '';
  }

  return net;
}

// ------------------------------------------------------------
// Una data de recerca, només si té la forma AAAA-MM-DD. Qualsevol altra cosa
// —un any sol, un text, una data amb hora— és '' i es tracta com si no hi fos.
// ------------------------------------------------------------
function dataDeRecerca(registre, camp) {
  var valor = textDeRecerca(registre[camp]);

  if (!esData(valor)) {
    return '';
  }

  return valor;
}

// ------------------------------------------------------------
// Diu si un text és una data AAAA-MM-DD. Les dates de l'esquema es comparen
// com a text, i per fer-ho han de tenir totes la mateixa forma.
// ------------------------------------------------------------
function esData(text) {
  return /^\d{4}-\d{2}-\d{2}$/.test(text);
}


// --- El que surt d'aquest fitxer --------------------------------------------

module.exports = {
  filtraCandidats: filtraCandidats
};


// --- Proves des del terminal ------------------------------------------------
// Tot el que ve a partir d'aquí és per poder exercitar la funció a mà. No forma
// part de la peça i no s'ha de copiar enlloc.

// El dia de referència de la bateria. Fix a posta: una prova que depengui de
// quin dia s'executi deixa de provar res.
var AVUI_DE_PROVA = '2026-08-29';

// ------------------------------------------------------------
// El lot de prova: vuit candidats fets a mà. Els sis que demana la tasca, més
// dos que exerciten les dues decisions que aquest filtre ha hagut de prendre.
// ------------------------------------------------------------
function lotDeProva() {
  return [
    {
      nom: 'Abans de la finestra: acabat fa mesos',
      espera: 'fora de finestra',
      candidat: {
        nom_original: 'Festa major de primavera',
        llengua_nom_original: 'ca',
        data_inici: '2026-04-11',
        data_fi: '2026-04-12',
        municipi: 'Ceret'
      }
    },
    {
      nom: 'Després de la finestra: comença d\'aquí a dos anys',
      espera: 'fora de finestra',
      candidat: {
        nom_original: 'Centenari del casal',
        llengua_nom_original: 'ca',
        data_inici: '2028-06-01',
        data_fi: '2028-06-03',
        municipi: 'Prada'
      }
    },
    {
      nom: 'Sense data d\'inici: passa igualment',
      espera: '',
      candidat: {
        nom_original: 'Exposició permanent del museu',
        llengua_nom_original: 'ca',
        data_inici: 'null',
        data_fi: 'null',
        municipi: 'Perpinyà'
      }
    },
    {
      nom: 'Paraula de soroll al títol',
      espera: 'paraula clau: immobiliere',
      candidat: {
        nom_original: 'PORTES OUVERTES AGENCE IMMOBILIÈRE DU VALLESPIR',
        llengua_nom_original: 'fr',
        data_inici: '2026-09-19',
        data_fi: '2026-09-19',
        municipi: 'Ceret'
      }
    },
    {
      nom: 'Paraula de soroll a l\'organitzador, no al títol',
      espera: 'paraula clau: chambres d hotes',
      candidat: {
        nom_original: 'Soirée découverte',
        llengua_nom_original: 'fr',
        data_inici: '2026-10-10',
        data_fi: '2026-10-10',
        municipi: 'Elna',
        organitzador: 'Chambres d\'hôtes Le Mas Vell'
      }
    },
    {
      nom: 'En curs: va començar al gener i dura fins al desembre',
      espera: '',
      candidat: {
        nom_original: 'GRAND MARCHÉ DE PRADES — tous les mardis matin',
        llengua_nom_original: 'fr',
        data_inici: '2026-01-01',
        data_fi: '2026-12-31',
        municipi: 'Prades / Prada'
      }
    },
    {
      nom: 'Normal: dins la finestra i sense cap paraula',
      espera: '',
      candidat: {
        nom_original: 'Concert de Goulamas\'k',
        llengua_nom_original: 'ca',
        data_inici: '2026-09-12',
        data_fi: '2026-09-12',
        municipi: 'Ceret'
      }
    },
    {
      nom: 'Normal, embolcallat amb la seva font',
      espera: '',
      candidat: {
        registre: {
          nom_original: 'Fira del bestiar',
          llengua_nom_original: 'ca',
          data_inici: '2027-03-06',
          data_fi: '2027-03-06',
          municipi: 'Prada'
        },
        font: { tipus: 'organitzador' }
      }
    }
  ];
}

// ------------------------------------------------------------
// Passa el lot de prova i n'escriu el resultat al terminal.
// ------------------------------------------------------------
function principal() {
  var casos = lotDeProva();
  var candidats = [];
  for (var i = 0; i < casos.length; i++) {
    candidats.push(casos[i].candidat);
  }

  var resultat = filtraCandidats(candidats, AVUI_DE_PROVA);
  var problemes = [];

  console.log('LOT DE PROVA: ' + casos.length + ' candidats, avui = ' + AVUI_DE_PROVA);
  console.log('finestra: ' + AVUI_DE_PROVA + ' … ' +
              finalDeFinestra(AVUI_DE_PROVA, MESOS_DE_FINESTRA) +
              '  (' + MESOS_DE_FINESTRA + ' mesos)');
  console.log('');

  for (var c = 0; c < casos.length; c++) {
    var cas = casos[c];
    var motiu = motiuDelResultat(resultat, cas.candidat);

    if (motiu !== cas.espera) {
      problemes.push(cas.nom + ': esperava «' + cas.espera + '», tinc «' + motiu + '»');
    }

    console.log((motiu === cas.espera ? 'BÉ  ' : 'MAL ') + cas.nom);
    console.log('     ' + (motiu === '' ? 'passa' : 'descartat — ' + motiu));
  }

  // El rastre ha de ser sencer: cap candidat no pot desaparèixer pel camí.
  if (resultat.passen.length + resultat.descartats.length !== casos.length) {
    problemes.push('el rastre no quadra: ' + resultat.passen.length + ' + ' +
                   resultat.descartats.length + ' no fan ' + casos.length);
  }

  // Els candidats que passen han de sortir tal com han entrat, sense tocar.
  for (var p = 0; p < resultat.passen.length; p++) {
    if (candidats.indexOf(resultat.passen[p]) === -1) {
      problemes.push('un candidat que passa no és el mateix objecte que va entrar');
    }
  }

  console.log('');
  console.log('passen ' + resultat.passen.length + ' · descartats ' + resultat.descartats.length);
  for (var d = 0; d < resultat.descartats.length; d++) {
    console.log('  · ' + resultat.descartats[d].motiu + '   «' +
                resultat.descartats[d].titol + '»');
  }
  console.log('');

  for (var q = 0; q < problemes.length; q++) {
    console.log('MAL  ' + problemes[q]);
  }

  if (problemes.length === 0) {
    console.log('BÉ   totes les comprovacions passen.');
  } else {
    console.log(problemes.length + ' comprovacions fallades.');
    process.exitCode = 1;
  }
}

// ------------------------------------------------------------
// El motiu que ha tocat a un candidat concret dins del resultat, o '' si ha
// passat. Es busca per referència: són els mateixos objectes que van entrar.
// ------------------------------------------------------------
function motiuDelResultat(resultat, candidat) {
  for (var i = 0; i < resultat.descartats.length; i++) {
    if (resultat.descartats[i].candidat === candidat) {
      return resultat.descartats[i].motiu;
    }
  }

  return '';
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    process.argv[1].indexOf('filtra-candidats') !== -1) {
  principal();
}
