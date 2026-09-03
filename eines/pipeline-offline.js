// ---------------------------------------------------------------------------
// LA CANONADA, EN SEC
//
// Una sola feina: encadenar les peces que ja existeixen —el filtre previ, el
// mapeig, la deduplicació de lot i, si qui crida hi connecta els agents, la
// verificació, el suggeriment editorial i la còpia del cartell— i ensenyar què
// sortiria d'un conjunt de candidats en brut. Res més.
//
//   - Cap crida a cap API des d'aquí dins. `crides` és opcional i es passa tal
//     qual a processaLot(), que és qui decideix a quines files s'aplica cada
//     agent i en quin ordre deixen la nota. Sense agents, la canonada fa
//     exactament el que feia abans. No llegeix cap fitxer i **no n'escriu cap**.
//   - NO escriu a pendents.json ni a events.json, i no hi compara res. La
//     deduplicació és només DINS del lot, com ja diu processaLot(). Comparar
//     amb la cua que ja existeix continua sent una altra tasca.
//   - Cap detall d'ADT66 ni de cap altra font concreta: qualsevol font futura
//     la crida igual.
//
// És una simulació de cap a cap, no la connexió real. Serveix per respondre
// «què passaria si aquest lot entrés», i per poder-ho respondre abans de
// construir la part que escriu.
//
// L'ordre de les dues peces no és indiferent: el filtre va PRIMER, perquè la
// seva raó de ser és que el mapeig i la comparació no gastin temps —ni, el dia
// que n'hi hagi, crides a Gemini— en files que ja se sap que no entraran.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/pipeline-offline.js                -> passa la bateria de proves
//   node eines/pipeline-offline.js <fitxer.csv>   -> informe sobre un CSV real
//
// L'informe sobre un CSV real es fa SEMPRE sense agents connectats: no hi ha
// cap crida de debò en tot aquest fitxer —ni a Gemini ni a Cloudinary—, ni amb
// clau ni sense.
// ---------------------------------------------------------------------------


// --- El que ve de fora ------------------------------------------------------

// Les dues peces que aquesta canonada encadena. Cap de les dues no s'ha tocat:
// aquí només es criden, en l'ordre que toca.
var filtre = require('./filtra-candidats.js');
var lots = require('./processa-lot.js');


// --- La funció --------------------------------------------------------------

// ------------------------------------------------------------
// Passa un lot de candidats en brut per tota la canonada de sec: primer el
// filtre previ, i el que en surt viu, pel mapeig i la deduplicació.
//
// `candidatsRecerca` és el que accepten les dues peces: registres de recerca
// tal qual, o { registre, font } quan el lot barreja fonts. `fontDelLot` és el
// descriptor que s'aplica als que no en porten cap de propi, i `avui` (AAAA-MM-DD)
// serveix per provar la finestra de dates amb una data fixa.
//
// `crides` és OPCIONAL: els agents injectats —{ verifica, classifica, puja }—,
// que aquesta funció no fa res més que passar a processaLot(). Qui decideix a
// quines files s'apliquen és aquella funció, no aquesta (regla 4 de
// processa-lot.js: només les `llestos`), i qui decideix l'ordre en què deixen la
// nota també (regla 5: procedència → verificació → classificació → cartell).
// Aquí no s'hi afegeix ni una decisió. L'agent que no es passi no s'executa gens.
//
// Per compatibilitat, una funció tota sola en aquest lloc continua volent dir
// el classificador, exactament com a processaLot().
//
// La funció és `async` perquè processaLot() ho és. Qui la cridi l'ha d'esperar
// sempre, amb agents o sense.
//
// Torna sempre les mateixes quatre coses, sempre presents:
//
//   llestos      [fila, ...]              files a punt per a la cua
//   dubtosos     [{ ..., opcions }, ...]  parelles per al curador
//   descartats   [{ candidat, titol, motiu }, ...]  el que no ha passat el filtre
//   metadadades  Map<fila, [metadada, ...]>  la procedència, per referència
//
// Cap candidat no es perd pel camí: o és a `descartats`, o és darrere d'alguna
// fila de `llestos` o de `dubtosos` —comptable amb `metadadades`, que diu
// quants candidats hi ha darrere de cada fila.
// ------------------------------------------------------------
async function pipelineOffline(candidatsRecerca, fontDelLot, avui, crides) {
  var filtrat = filtre.filtraCandidats(candidatsRecerca, avui);
  var processat = await lots.processaLot(filtrat.passen, fontDelLot, crides);

  return {
    llestos: processat.llestos,
    dubtosos: processat.dubtosos,
    descartats: filtrat.descartats,
    metadadades: processat.metadadades
  };
}


// --- El que surt d'aquest fitxer --------------------------------------------

module.exports = {
  pipelineOffline: pipelineOffline
};


// --- Proves des del terminal ------------------------------------------------
// Tot el que ve a partir d'aquí és per poder exercitar la canonada —sobre un lot
// de mentida o sobre un CSV real. No forma part de la peça i no s'ha de copiar
// enlloc. Les bateries de casos de cada peça són a cada peça: aquí el que es
// mira és què fan totes juntes.

// ------------------------------------------------------------
// Passa un CSV de recerca sencer per la canonada i n'escriu els recomptes. No
// escriu cap fitxer.
// ------------------------------------------------------------
async function informeSobreCsv(cami, avui) {
  var candidats = registresDeCsv(cami);
  var resultat = await pipelineOffline(candidats, null, avui);

  console.log('Fitxer: ' + cami);
  console.log('avui:   ' + avui);
  console.log('');

  console.log('  total candidats   ' + candidats.length);
  console.log('  descartats        ' + resultat.descartats.length);
  console.log('  llestos           ' + resultat.llestos.length);
  console.log('  dubtosos          ' + resultat.dubtosos.length + ' parelles (' +
              filesEnDubte(resultat.dubtosos).length + ' files)');
  console.log('');

  escriuMotius(resultat.descartats);
  escriuFusions(resultat);
  escriuDubtes(resultat.dubtosos);
  escriuComprovacio(resultat, candidats.length);
}

// ------------------------------------------------------------
// El desglossament dels descarts per motiu. Un motiu que no surt mai no
// s'escriu: la llista ha de dir què ha passat, no què podria haver passat.
// ------------------------------------------------------------
function escriuMotius(descartats) {
  if (descartats.length === 0) {
    console.log('  cap descart: tots els candidats han passat el filtre previ.');
    console.log('');
    return;
  }

  var comptes = {};
  for (var i = 0; i < descartats.length; i++) {
    var motiu = descartats[i].motiu;
    comptes[motiu] = (comptes[motiu] || 0) + 1;
  }

  console.log('  descarts per motiu:');
  var motius = Object.keys(comptes).sort(function (a, b) {
    return comptes[b] - comptes[a];
  });
  for (var m = 0; m < motius.length; m++) {
    console.log('    ' + String(comptes[motius[m]]).padStart(4) + '  ' + motius[m]);
  }
  console.log('');
}

// ------------------------------------------------------------
// Les files que han sortit de fusionar-ne més d'una, que és l'única cosa que la
// deduplicació de lot fa de manera irreversible.
// ------------------------------------------------------------
function escriuFusions(resultat) {
  var files = resultat.llestos.concat(filesEnDubte(resultat.dubtosos));
  var fusionades = [];

  for (var i = 0; i < files.length; i++) {
    if (resultat.metadadades.get(files[i]).length > 1) {
      fusionades.push(files[i]);
    }
  }

  console.log('  fusions           ' + fusionades.length + ' files venen de més d\'un candidat');
  for (var f = 0; f < fusionades.length; f++) {
    console.log('    ' + resultat.metadadades.get(fusionades[f]).length + ' candidats -> «' +
                fusionades[f].titol + '»  ' + fusionades[f].data_inici +
                '  ' + fusionades[f].municipi);
  }
  console.log('');
}

// ------------------------------------------------------------
// Les parelles que van al curador, amb els dos títols i el motiu.
// ------------------------------------------------------------
function escriuDubtes(dubtosos) {
  if (dubtosos.length === 0) {
    return;
  }

  console.log('  parelles per al curador:');
  for (var i = 0; i < dubtosos.length; i++) {
    var dubte = dubtosos[i];
    console.log('    · ' + dubte.clau +
                (dubte.similitud === null ? '' : '   similitud ' + dubte.similitud.toFixed(2)));
    console.log('      «' + dubte.opcions[0].titol + '»');
    console.log('      «' + dubte.opcions[1].titol + '»');
  }
  console.log('');
}

// ------------------------------------------------------------
// La comprovació que no s'ha perdut cap candidat: els que ha engolit el filtre,
// més els que hi ha darrere de cada fila que ha sortit, han de ser tots.
// ------------------------------------------------------------
function escriuComprovacio(resultat, total) {
  var files = resultat.llestos.concat(filesEnDubte(resultat.dubtosos));
  var representats = 0;

  for (var i = 0; i < files.length; i++) {
    representats += resultat.metadadades.get(files[i]).length;
  }

  var suma = representats + resultat.descartats.length;

  console.log('  rastre: ' + representats + ' candidats darrere de ' + files.length +
              ' files, més ' + resultat.descartats.length + ' descartats = ' + suma);

  if (suma === total) {
    console.log('  BÉ  cap candidat perdut pel camí.');
  } else {
    console.log('  MAL  n\'esperava ' + total + ': se n\'ha perdut algun.');
    process.exitCode = 1;
  }
}

// ------------------------------------------------------------
// Les files diferents que surten en alguna parella dubtosa. Una mateixa fila
// pot sortir en més d'una parella i s'ha de comptar un sol cop.
// ------------------------------------------------------------
function filesEnDubte(dubtosos) {
  var files = [];

  for (var i = 0; i < dubtosos.length; i++) {
    for (var j = 0; j < dubtosos[i].opcions.length; j++) {
      if (files.indexOf(dubtosos[i].opcions[j]) === -1) {
        files.push(dubtosos[i].opcions[j]);
      }
    }
  }

  return files;
}

// ------------------------------------------------------------
// Els registres d'un CSV de recerca: la capçalera dona els noms dels camps i
// cada línia en fa un objecte.
// ------------------------------------------------------------
function registresDeCsv(cami) {
  var fs = require('fs');
  var brut = fs.readFileSync(cami, 'utf8').replace(/^﻿/, '');
  var files = parseCsv(brut).filter(function (fila) { return fila.length > 1; });
  var capcalera = files[0];
  var registres = [];

  for (var i = 1; i < files.length; i++) {
    var registre = {};
    for (var j = 0; j < capcalera.length; j++) {
      registre[capcalera[j]] = files[i][j];
    }
    registres.push(registre);
  }

  return registres;
}

// ------------------------------------------------------------
// Parseja un text CSV. Còpia de la d'importa-csv.js: gestiona cometes dobles,
// cometes escapades ("") i salts de línia dins d'un camp.
// ------------------------------------------------------------
function parseCsv(text) {
  var files = [];
  var fila = [];
  var camp = '';
  var dinsCometes = false;

  for (var i = 0; i < text.length; i++) {
    var caracter = text[i];

    if (dinsCometes) {
      if (caracter === '"') {
        if (text[i + 1] === '"') {
          camp += '"';
          i++;
        } else {
          dinsCometes = false;
        }
      } else {
        camp += caracter;
      }
      continue;
    }

    if (caracter === '"') {
      dinsCometes = true;
    } else if (caracter === ',') {
      fila.push(camp);
      camp = '';
    } else if (caracter === '\r') {
      // Final de línia de Windows: el \n que ve tot seguit ja tanca la fila.
    } else if (caracter === '\n') {
      fila.push(camp);
      files.push(fila);
      fila = [];
      camp = '';
    } else {
      camp += caracter;
    }
  }

  if (camp !== '' || fila.length > 0) {
    fila.push(camp);
    files.push(fila);
  }

  return files;
}

// --- Proves: la canonada sencera, amb agents i sense ------------------------
// La bateria de cada peça és a la peça. Aquí es prova l'única cosa que aquest
// fitxer decideix: que els agents arribin al final de la canonada intactes —i
// en l'ordre que toca— i que el filtre previ continuï davant de tot.
//
// Les branques de cada agent no es tornen a provar aquí: el cas del cartell que
// ja és de Cloudinary —el del Typebot— i el de la xarxa social són a la bateria
// d'eines/puja-cartell.js i a la d'eines/processa-lot.js, que és on viuen.

// El dia de referència de la bateria, fix, perquè la finestra de dates no
// depengui de quan es passi.
var AVUI_DE_PROVA = '2026-08-30';

// La marca amb què comencen totes les notes de classifica-editorial.js.
var MARCA_SUGGERIMENT = '[Suggeriment editorial: ';

// I la de verifica-esdeveniment.js. Com a la bateria de processa-lot.js, el
// verificador de mentida no respon mai «ok»: aquella peça calla quan tot quadra
// i llavors no hi hauria res a comptar.
var MARCA_VERIFICACIO = '[Verificació: ';

// I la de puja-cartell.js. Aquella peça també calla quan la pujada va bé: llavors
// el que es compta és la crida al pujador i el valor d'`imatge_url`.
var MARCA_CARTELL = '[Cartell: ';

// Els dos cartells del lot, tots dos allotjats a casa d'un tercer, i la còpia de
// Cloudinary que hi ha de deixar el pujador de mentida quan diu que sí. Cap
// d'aquests URL no es visita mai.
var URL_CARTELL_FORA = 'https://cdt66.media.tourinsoft.eu/upload/Taller-Elna.jpg';
var URL_CARTELL_NOSTRE = 'https://res.cloudinary.com/agenda-nord/image/upload/' +
  'v1756400000/clm-agenda/posters/taller-elna.webp';
var URL_CARTELL_DUBTE = 'https://files.appli-intramuros.com/img/events/6388/fira-prada.jpg';

// El motiu que dona el pujador quan falla, i la nota que n'ha de sortir.
var MOTIU_PUJADA_FALLIDA = '403 Forbidden';
var NOTA_CARTELL_NO_PUJAT = '[Cartell: no pujat] El cartell no s\'ha pogut copiar ' +
  'a Cloudinary: 403 Forbidden. La fitxa queda sense imatge.';

// ------------------------------------------------------------
// El lot de la bateria: quatre candidats que cobreixen les tres sortides de la
// canonada.
//
//   1    un acte sol que passa el filtre: anirà a `llestos`. Porta la
//        descripció només en francès —o sigui que el mapeig ja li deixa una
//        nota de procedència— i un cartell forà. És l'única fila del lot que
//        pot arribar a portar les quatre seccions de nota alhora.
//   2-3  la mateixa fira en dues llengües: parella DUBTOSA, perquè els títols
//        no es comparen mai entre llengües. La francesa porta també un cartell
//        forà, que no s'ha de tocar mai (regla 4 de processa-lot.js).
//   4    un acte ja passat: el filtre previ el descarta i no arriba ni al
//        mapeig ni a cap agent.
// ------------------------------------------------------------
function lotDeProva() {
  return [
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
        descripcio_original: 'Atelier de cuisine catalane, ouvert à tous.',
        llengua_descripcio: 'fr',
        citacio_literal: 'Atelier de cuisine catalane a Elne, le 7 novembre.'
      },
      font: { tipus: 'organitzador' }
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
        nom_original: 'Concert de Sant Joan',
        llengua_nom_original: 'ca',
        data_inici: '2026-06-23',
        data_fi: '2026-06-23',
        municipi: 'Ceret',
        comarca: 'Vallespir',
        categoria: 'music'
      },
      font: { tipus: 'organitzador' }
    }
  ];
}

// ------------------------------------------------------------
// Un classificador de mentida que sempre respon el mateix, com el mock canònic
// de la bateria de classifica-editorial.js: ni clau ni xarxa. Compta les crides
// per poder comprovar que només se n'ha fet una per fila llesta.
// ------------------------------------------------------------
function classificadorDeProva() {
  var mentider = function () {
    mentider.crides++;
    return Promise.resolve({
      nivell: 'NUCLI',
      regla: 'R6',
      motiu: 'Teixit associatiu del país'
    });
  };

  mentider.crides = 0;
  return mentider;
}

// ------------------------------------------------------------
// Un verificador de mentida, igual que l'anterior i pels mateixos motius.
// ------------------------------------------------------------
function verificadorDeProva() {
  var mentider = function () {
    mentider.crides++;
    return Promise.resolve({
      resultat: 'dubte',
      camps_afectats: ['hora'],
      motiu: 'La citació no dona cap hora'
    });
  };

  mentider.crides = 0;
  return mentider;
}

// ------------------------------------------------------------
// Un pujador de mentida que sempre diu que sí, i un que sempre diu que no. Cap
// dels dos no surt a la xarxa: en tot aquest fitxer no hi ha cap `fetch`.
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

function pujadorQueFalla() {
  var mentider = function () {
    mentider.crides++;
    return Promise.resolve({ error: MOTIU_PUJADA_FALLIDA });
  };

  mentider.crides = 0;
  return mentider;
}

// Les notes que han de sortir d'aquells models de mentida, i les notes senceres
// de la fila llesta segón quins agents hi hagi connectats. El taller porta la
// descripció només en francès, o sigui que el mapeig ja li deixa la primera
// secció; les altres arriben en l'ordre de la regla 5 de processa-lot.js.
var NOTA_MAPEIG = 'Descripció en francès: falta la traducció catalana.';
var NOTA_VERIFICACIO = '[Verificació: dubte — hora] La citació no dona cap hora.';
var NOTA_CLASSIFICACIO = '[Suggeriment editorial: NUCLI — R6] Teixit associatiu del país.';
var NOTA_SENCERA = NOTA_MAPEIG + ' ' + NOTA_VERIFICACIO + ' ' + NOTA_CLASSIFICACIO;

// I la de les quatre seccions: només hi arriba quan el pujador falla, perquè una
// pujada bona és silenciosa (el §«criteri de silenci» d'eines/puja-cartell.js).
var NOTA_DE_LES_QUATRE = NOTA_SENCERA + ' ' + NOTA_CARTELL_NO_PUJAT;

// ------------------------------------------------------------
// El repartiment que ha de sortir d'aquell lot, passi el que passi amb el
// classificador: un llest, una parella dubtosa i un descartat pel filtre.
// ------------------------------------------------------------
function comprovaElRepartiment(resultat, quan) {
  var problemes = [];

  if (resultat.llestos.length !== 1) {
    problemes.push(quan + ': esperava 1 fila llesta, en tinc ' + resultat.llestos.length);
  }
  if (resultat.dubtosos.length !== 1) {
    problemes.push(quan + ': esperava 1 parella dubtosa, en tinc ' + resultat.dubtosos.length);
  }
  if (resultat.descartats.length !== 1) {
    problemes.push(quan + ': esperava 1 descartat, en tinc ' + resultat.descartats.length);
  } else if (resultat.descartats[0].motiu !== 'fora de finestra') {
    problemes.push(quan + ': el descartat hauria de ser-ho per la finestra de dates, ' +
                   'no per «' + resultat.descartats[0].motiu + '»');
  }

  return problemes;
}

// ------------------------------------------------------------
// Sense cap agent: la canonada ha de fer exactament el que feia abans que
// aquests passos existissin, i cap fila no ha de portar cap de les dues notes.
// ------------------------------------------------------------
async function bateriaSenseAgents() {
  var resultat = await pipelineOffline(lotDeProva(), null, AVUI_DE_PROVA);
  var problemes = comprovaElRepartiment(resultat, 'sense agents');

  var totes = resultat.llestos.concat(filesEnDubte(resultat.dubtosos));
  for (var i = 0; i < totes.length; i++) {
    if (totes[i].nota_curador.indexOf(MARCA_SUGGERIMENT) !== -1) {
      problemes.push('sense agents, «' + totes[i].titol +
                     '» porta una nota de classificació');
    }
    if (totes[i].nota_curador.indexOf(MARCA_VERIFICACIO) !== -1) {
      problemes.push('sense agents, «' + totes[i].titol +
                     '» porta una nota de verificació');
    }
    if (totes[i].nota_curador.indexOf(MARCA_CARTELL) !== -1) {
      problemes.push('sense agents, «' + totes[i].titol +
                     '» porta una nota de cartell');
    }
  }

  // I cap `imatge_url` no s'ha mogut: els dos cartells del lot són els forans
  // que hi ha deixat el mapeig.
  if (resultat.llestos[0].imatge_url !== URL_CARTELL_FORA) {
    problemes.push('sense agents, el cartell de la fila llesta hauria de ser ' +
                   'l\'URL forà: «' + resultat.llestos[0].imatge_url + '»');
  }

  return problemes;
}

// ------------------------------------------------------------
// Amb classificador: la fila llesta porta el suggeriment darrere de la nota que
// ja tenia, les dues dubtoses no en porten cap (regla 4 de processa-lot.js), i
// el descartat no ha arribat ni a mirar-se'l.
//
// El classificador es passa amb la FORMA ANTIGA —una funció tota sola—, i és a
// posta: aquí és on es comprova que les crides escrites abans que la
// verificació existís continuïn fent el mateix des de la canonada.
// ------------------------------------------------------------
async function bateriaAmbClassificador() {
  var mentider = classificadorDeProva();
  var resultat = await pipelineOffline(lotDeProva(), null, AVUI_DE_PROVA, mentider);
  var problemes = comprovaElRepartiment(resultat, 'amb classificador');

  if (problemes.length > 0) {
    return problemes;
  }

  // Una crida per fila llesta: ni la dubtosa ni la descartada no en gasten cap.
  if (mentider.crides !== 1) {
    problemes.push('esperava 1 crida al classificador, se n\'han fet ' + mentider.crides);
  }

  if (resultat.llestos[0].nota_curador.indexOf(MARCA_SUGGERIMENT) === -1) {
    problemes.push('la fila llesta no porta el suggeriment: «' +
                   resultat.llestos[0].nota_curador + '»');
  }

  var enDubte = filesEnDubte(resultat.dubtosos);
  for (var i = 0; i < enDubte.length; i++) {
    if (enDubte[i].nota_curador.indexOf(MARCA_SUGGERIMENT) !== -1) {
      problemes.push('la fila dubtosa «' + enDubte[i].titol +
                     '» s\'ha classificat, i no ho havia de fer');
    }
  }

  // El rastre no s'ha trencat: les metadadades segueixen indexades per les
  // files que han sortit, que amb classificador són objectes nous.
  var totes = resultat.llestos.concat(enDubte);
  for (var t = 0; t < totes.length; t++) {
    if (!resultat.metadadades.has(totes[t])) {
      problemes.push('la fila «' + totes[t].titol + '» ha perdut la metadada');
    }
  }

  // Cap verificador connectat, cap nota de verificació enlloc.
  for (var v = 0; v < totes.length; v++) {
    if (totes[v].nota_curador.indexOf(MARCA_VERIFICACIO) !== -1) {
      problemes.push('sense verificador, «' + totes[v].titol +
                     '» porta una nota de verificació');
    }
  }

  return problemes;
}

// ------------------------------------------------------------
// Amb el verificador i el classificador, i el pujador NO: la fila llesta ha de
// portar les tres seccions, i en l'ordre de la regla 5 de processa-lot.js. La
// canonada no decideix aquest ordre, però és la que ha de demostrar que hi
// arriba sencer. Aquí també es comprova que un pujador absent no fa res de res.
// ------------------------------------------------------------
async function bateriaAmbTotsDosAgents() {
  var verificador = verificadorDeProva();
  var classificador = classificadorDeProva();
  var resultat = await pipelineOffline(lotDeProva(), null, AVUI_DE_PROVA,
    { verifica: verificador, classifica: classificador });
  var problemes = comprovaElRepartiment(resultat, 'amb els dos agents');

  if (problemes.length > 0) {
    return problemes;
  }

  // La nota sencera de la fila llesta: mapeig, verificació i classificació, en
  // ordre, i cap secció de cartell perquè el pujador no hi és.
  if (resultat.llestos[0].nota_curador !== NOTA_SENCERA) {
    problemes.push('la nota de la fila llesta no és mapeig, verificació i ' +
                   'classificació:\n       tinc     «' + resultat.llestos[0].nota_curador +
                   '»\n       esperava «' + NOTA_SENCERA + '»');
  }

  // Sense pujador: cap nota de cartell i l'URL forà encara al seu lloc.
  if (resultat.llestos[0].nota_curador.indexOf(MARCA_CARTELL) !== -1) {
    problemes.push('sense pujador, la fila llesta porta una nota de cartell');
  }
  if (resultat.llestos[0].imatge_url !== URL_CARTELL_FORA) {
    problemes.push('sense pujador, el cartell de la fila llesta s\'ha mogut: «' +
                   resultat.llestos[0].imatge_url + '»');
  }

  // Una crida per agent i per fila llesta, i cap per la dubtosa ni la descartada.
  if (verificador.crides !== 1) {
    problemes.push('esperava 1 crida al verificador, se n\'han fet ' + verificador.crides);
  }
  if (classificador.crides !== 1) {
    problemes.push('esperava 1 crida al classificador, se n\'han fet ' + classificador.crides);
  }

  // Regla 4: cap fila dubtosa no ha passat per cap dels dos.
  var enDubte = filesEnDubte(resultat.dubtosos);
  for (var i = 0; i < enDubte.length; i++) {
    if (enDubte[i].nota_curador.indexOf(MARCA_SUGGERIMENT) !== -1 ||
        enDubte[i].nota_curador.indexOf(MARCA_VERIFICACIO) !== -1) {
      problemes.push('la fila dubtosa «' + enDubte[i].titol +
                     '» ha passat per algun agent, i no ho havia de fer');
    }
  }

  // El rastre aguanta DUES substitucions de fila seguides, no només una.
  var totes = resultat.llestos.concat(enDubte);
  for (var t = 0; t < totes.length; t++) {
    if (!resultat.metadadades.has(totes[t])) {
      problemes.push('la fila «' + totes[t].titol + '» ha perdut la metadada');
    }
  }

  return problemes;
}

// ------------------------------------------------------------
// Només el verificador: la nota ha de portar la secció de verificació i cap de
// classificació. És l'altra meitat de «l'agent que no es passa no fa res».
// ------------------------------------------------------------
async function bateriaNomesVerificacio() {
  var verificador = verificadorDeProva();
  var resultat = await pipelineOffline(lotDeProva(), null, AVUI_DE_PROVA,
    { verifica: verificador });
  var problemes = comprovaElRepartiment(resultat, 'només amb verificador');

  if (problemes.length > 0) {
    return problemes;
  }

  if (resultat.llestos[0].nota_curador !== NOTA_MAPEIG + ' ' + NOTA_VERIFICACIO) {
    problemes.push('només amb verificador, la nota de la fila llesta hauria de ser ' +
                   'la de mapeig seguida de la de verificació: «' +
                   resultat.llestos[0].nota_curador + '»');
  }
  if (verificador.crides !== 1) {
    problemes.push('esperava 1 crida al verificador, se n\'han fet ' + verificador.crides);
  }

  var totes = resultat.llestos.concat(filesEnDubte(resultat.dubtosos));
  for (var i = 0; i < totes.length; i++) {
    if (totes[i].nota_curador.indexOf(MARCA_SUGGERIMENT) !== -1) {
      problemes.push('sense classificador, «' + totes[i].titol +
                     '» porta una nota de classificació');
    }
  }

  return problemes;
}

// ------------------------------------------------------------
// ELS TRES AGENTS ALHORA, amb el pujador dient que sí. La fila llesta ha de
// sortir amb el cartell copiat a Cloudinary i sense cap secció nova de nota:
// una pujada bona és silenciosa. La fila dubtosa conserva el seu cartell forà.
// ------------------------------------------------------------
async function bateriaAmbTotsTresAgents() {
  var verificador = verificadorDeProva();
  var classificador = classificadorDeProva();
  var pujador = pujadorDeProva();
  var resultat = await pipelineOffline(lotDeProva(), null, AVUI_DE_PROVA,
    { verifica: verificador, classifica: classificador, puja: pujador });
  var problemes = comprovaElRepartiment(resultat, 'amb els tres agents');

  if (problemes.length > 0) {
    return problemes;
  }

  var llesta = resultat.llestos[0];

  // El cartell forà ha estat substituït per la còpia nostra.
  if (llesta.imatge_url !== URL_CARTELL_NOSTRE) {
    problemes.push('el cartell de la fila llesta no s\'ha copiat a Cloudinary: «' +
                   llesta.imatge_url + '»');
  }
  if (llesta.nota_curador !== NOTA_SENCERA) {
    problemes.push('una pujada bona no ha d\'afegir cap secció a la nota:\n' +
                   '       tinc     «' + llesta.nota_curador + '»\n' +
                   '       esperava «' + NOTA_SENCERA + '»');
  }

  // Una crida per agent i per fila llesta, ni una més.
  if (pujador.crides !== 1) {
    problemes.push('esperava 1 crida al pujador, se n\'han fet ' + pujador.crides);
  }
  if (pujador.origens.length > 0 && pujador.origens[0] !== URL_CARTELL_FORA) {
    problemes.push('el pujador no ha rebut l\'URL forà: «' + pujador.origens[0] + '»');
  }
  if (verificador.crides !== 1 || classificador.crides !== 1) {
    problemes.push('el tercer agent ha canviat el compte dels altres dos: ' +
                   verificador.crides + ' verificacions i ' +
                   classificador.crides + ' classificacions');
  }

  // Regla 4: la fila dubtosa no ha passat per cap dels tres, i conserva el seu
  // cartell forà tal com el va deixar el mapeig.
  var enDubte = filesEnDubte(resultat.dubtosos);
  for (var i = 0; i < enDubte.length; i++) {
    if (enDubte[i].nota_curador.indexOf(MARCA_CARTELL) !== -1) {
      problemes.push('la fila dubtosa «' + enDubte[i].titol +
                     '» ha passat pel pujador, i no ho havia de fer');
    }
  }
  if (enDubte[1].imatge_url !== URL_CARTELL_DUBTE) {
    problemes.push('el cartell de la fila dubtosa s\'ha mogut: «' +
                   enDubte[1].imatge_url + '»');
  }

  // El rastre aguanta TRES substitucions de fila seguides.
  var totes = resultat.llestos.concat(enDubte);
  for (var t = 0; t < totes.length; t++) {
    if (!resultat.metadadades.has(totes[t])) {
      problemes.push('la fila «' + totes[t].titol + '» ha perdut la metadada');
    }
  }

  return problemes;
}

// ------------------------------------------------------------
// Els tres agents alhora, però amb el pujador dient que no: és l'única manera
// que la fila llesta acabi amb les QUATRE seccions de nota, i per tant l'únic
// lloc d'aquest fitxer on es pot comprovar l'ordre sencer de la regla 5.
// ------------------------------------------------------------
async function bateriaAmbPujadorQueFalla() {
  var verificador = verificadorDeProva();
  var classificador = classificadorDeProva();
  var pujador = pujadorQueFalla();
  var resultat = await pipelineOffline(lotDeProva(), null, AVUI_DE_PROVA,
    { verifica: verificador, classifica: classificador, puja: pujador });
  var problemes = comprovaElRepartiment(resultat, 'amb el pujador que falla');

  if (problemes.length > 0) {
    return problemes;
  }

  var llesta = resultat.llestos[0];

  if (llesta.nota_curador !== NOTA_DE_LES_QUATRE) {
    problemes.push('la nota de la fila llesta no és procedència → verificació → ' +
                   'classificació → cartell:\n       tinc     «' + llesta.nota_curador +
                   '»\n       esperava «' + NOTA_DE_LES_QUATRE + '»');
  }

  // El mateix per posicions, per si algun dia canvia el text d'alguna secció.
  var ordre = [MARCA_VERIFICACIO, MARCA_SUGGERIMENT, MARCA_CARTELL];
  for (var m = 0; m < ordre.length; m++) {
    var posicio = llesta.nota_curador.indexOf(ordre[m]);
    if (posicio === -1) {
      problemes.push('a la fila llesta li falta la secció «' + ordre[m] + '»');
    } else if (m > 0 && posicio < llesta.nota_curador.indexOf(ordre[m - 1])) {
      problemes.push('la secció «' + ordre[m] + '» surt abans que «' +
                     ordre[m - 1] + '», i ha de ser al revés');
    }
  }

  // Una pujada fallida deixa la fila sense imatge: l'URL forà NO es conserva.
  if (llesta.imatge_url !== '') {
    problemes.push('una pujada fallida ha de deixar la fila sense imatge, i hi ha ' +
                   '«' + llesta.imatge_url + '»');
  }

  return problemes;
}

// ------------------------------------------------------------
// Sense verificador, i sense classificador: les dues meitats que faltaven de
// «l'agent que no es passa no fa res de res», ara amb tres agents a triar. Amb
// bateriaAmbTotsDosAgents(), que és la del pujador absent, cadascun dels tres
// ja s'ha provat absent mentre els altres dos hi eren.
// ------------------------------------------------------------
async function bateriaSenseVerificador() {
  var pujador = pujadorQueFalla();
  var resultat = await pipelineOffline(lotDeProva(), null, AVUI_DE_PROVA,
    { classifica: classificadorDeProva(), puja: pujador });
  var problemes = comprovaElRepartiment(resultat, 'sense verificador');

  if (problemes.length > 0) {
    return problemes;
  }

  var esperada = NOTA_MAPEIG + ' ' + NOTA_CLASSIFICACIO + ' ' + NOTA_CARTELL_NO_PUJAT;

  if (resultat.llestos[0].nota_curador !== esperada) {
    problemes.push('sense verificador, la nota hauria de ser mapeig, classificació ' +
                   'i cartell: «' + resultat.llestos[0].nota_curador + '»');
  }
  if (pujador.crides !== 1) {
    problemes.push('esperava 1 crida al pujador, se n\'han fet ' + pujador.crides);
  }

  return problemes;
}

async function bateriaSenseClassificador() {
  var pujador = pujadorQueFalla();
  var resultat = await pipelineOffline(lotDeProva(), null, AVUI_DE_PROVA,
    { verifica: verificadorDeProva(), puja: pujador });
  var problemes = comprovaElRepartiment(resultat, 'sense classificador');

  if (problemes.length > 0) {
    return problemes;
  }

  var esperada = NOTA_MAPEIG + ' ' + NOTA_VERIFICACIO + ' ' + NOTA_CARTELL_NO_PUJAT;

  if (resultat.llestos[0].nota_curador !== esperada) {
    problemes.push('sense classificador, la nota hauria de ser mapeig, verificació ' +
                   'i cartell: «' + resultat.llestos[0].nota_curador + '»');
  }
  if (pujador.crides !== 1) {
    problemes.push('esperava 1 crida al pujador, se n\'han fet ' + pujador.crides);
  }

  return problemes;
}

// ------------------------------------------------------------
// La vora: un verificador que peta no atura la canonada ni impedeix que la
// classificació s'hi faci al darrere.
// ------------------------------------------------------------
async function bateriaAmbVerificadorQuePeta() {
  var quePeta = function () {
    return Promise.reject(new Error('sense clau'));
  };
  var classificador = classificadorDeProva();
  var resultat = await pipelineOffline(lotDeProva(), null, AVUI_DE_PROVA,
    { verifica: quePeta, classifica: classificador });
  var problemes = comprovaElRepartiment(resultat, 'amb verificador que peta');

  if (problemes.length > 0) {
    return problemes;
  }

  var nota = resultat.llestos[0].nota_curador;

  if (nota.indexOf('Sense verificar:') === -1) {
    problemes.push('la fila llesta hauria de dir que no s\'ha pogut verificar: «' + nota + '»');
  }
  if (nota.indexOf(MARCA_SUGGERIMENT) === -1) {
    problemes.push('la fila llesta no s\'ha classificat: el verificador que peta ' +
                   'ha aturat la canonada');
  }
  if (nota.indexOf(MARCA_VERIFICACIO) > nota.indexOf(MARCA_SUGGERIMENT)) {
    problemes.push('l\'ordre de les notes s\'ha invertit: «' + nota + '»');
  }
  if (classificador.crides !== 1) {
    problemes.push('esperava 1 crida al classificador, se n\'han fet ' + classificador.crides);
  }

  return problemes;
}

// ------------------------------------------------------------
// Passa totes les bateries i n'escriu el resultat al terminal.
// ------------------------------------------------------------
async function passaLaBateria() {
  var problemes = [];
  problemes = problemes.concat(await bateriaSenseAgents());
  problemes = problemes.concat(await bateriaAmbClassificador());
  problemes = problemes.concat(await bateriaAmbTotsDosAgents());
  problemes = problemes.concat(await bateriaAmbTotsTresAgents());
  problemes = problemes.concat(await bateriaAmbPujadorQueFalla());
  problemes = problemes.concat(await bateriaSenseVerificador());
  problemes = problemes.concat(await bateriaSenseClassificador());
  problemes = problemes.concat(await bateriaNomesVerificacio());
  problemes = problemes.concat(await bateriaAmbVerificadorQuePeta());

  var resultat = await pipelineOffline(lotDeProva(), null, AVUI_DE_PROVA, {
    verifica: verificadorDeProva(),
    classifica: classificadorDeProva(),
    puja: pujadorDeProva()
  });

  console.log('LOT DE PROVA: 4 candidats en brut, avui ' + AVUI_DE_PROVA);
  console.log('');
  console.log('llestos (' + resultat.llestos.length + ') — amb els tres agents');
  console.log('(ordre de la nota: procedència → verificació → classificació → cartell)');
  for (var i = 0; i < resultat.llestos.length; i++) {
    console.log('  · ' + resultat.llestos[i].titol);
    console.log('    cartell    ' +
                (resultat.llestos[i].imatge_url === '' ? '(cap)' : resultat.llestos[i].imatge_url));
    console.log('    nota       ' + resultat.llestos[i].nota_curador);
  }

  console.log('');
  var enDubte = filesEnDubte(resultat.dubtosos);
  console.log('dubtosos (' + resultat.dubtosos.length + ' parelles, ' + enDubte.length +
              ' files) — cap no ha passat per cap agent (regla 4)');
  for (var d = 0; d < enDubte.length; d++) {
    console.log('  · ' + enDubte[d].titol +
                (enDubte[d].nota_curador === '' ? '' : '   nota: ' + enDubte[d].nota_curador));
  }

  console.log('');
  console.log('descartats (' + resultat.descartats.length + ') — abans del mapeig');
  for (var e = 0; e < resultat.descartats.length; e++) {
    console.log('  · ' + resultat.descartats[e].titol + '   ' + resultat.descartats[e].motiu);
  }
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

// ------------------------------------------------------------
// Punt d'entrada del terminal: amb un camí de CSV, l'informe; sense, la
// bateria. El segon argument, opcional, és el dia de referència de la finestra
// de dates.
// ------------------------------------------------------------
async function principal() {
  var cami = process.argv[2];

  if (!cami) {
    await passaLaBateria();
    return;
  }

  var avui = process.argv[3];
  if (!avui) {
    avui = new Date().toISOString().slice(0, 10);
  }

  await informeSobreCsv(cami, avui);
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    process.argv[1].indexOf('pipeline-offline') !== -1) {
  principal();
}
