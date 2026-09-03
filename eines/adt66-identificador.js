// ---------------------------------------------------------------------------
// IDENTIFICADOR D'ADT66 DINS LA NOTA DEL CURADOR
//
// Una sola feina: escriure el `SyndicObjectID` d'una oferta de l'ADT66 dins
// de `nota_curador`, i tornar-lo a treure d'allà quan calgui. Res més.
//
// PER QUÈ EXISTEIX. eines/deteccio-retirades.js ja sap dir quines ofertes han
// caigut del flux, però necessita que qui la cridi li passi `filesAncorades`:
// quina fila ve de quina oferta. I avui no ho sap ningú, perquè el
// `SyndicObjectID` no viatja enlloc. El §2 quater de docs/HANDOFF-ADT66.md
// tanca la porta a resoldre-ho amb un camp nou —l'esquema del §4 de CLAUDE.md
// són 16 camps públics + `nota_curador`, i no en creix cap divuitè— i el §2
// ter demostra que `font_url` tampoc no el pot portar de manera útil.
//
// Queda `nota_curador`, i hi encaixa per disseny, no per manca de lloc millor.
// El §4 de CLAUDE.md diu que és un camp de servei: **l'escriuen només els
// agents de darrere, el frontend públic no el llegeix mai, i es descarta en
// publicar**. Un identificador intern de proveïdor vol exactament aquestes
// tres coses: que hi sigui mentre la fila és a la cua, que no arribi mai a
// `events.json`, i que ningú de fora no el vegi.
//
// AQUEST FITXER NO CONSTRUEIX CAP FILA. No sap què és una oferta de l'ADT66,
// no llegeix el flux WCF i no crida cap API. Entra text, en surt text. El
// mapatge ADT66 -> fila de producció ENCARA NO EXISTEIX: vegeu el contracte
// de sota, escrit per a qui l'escrigui.
//
//
// --- CONTRACTE PER A QUI ESCRIGUI EL MAPATGE ADT66 -> FILA -----------------
//
// EN EL MOMENT DE CREAR LA FILA, ABANS QUE CAP ALTRE AGENT TOQUI
// `nota_curador`, CAL CRIDAR `creaTagIdentificador(syndicObjectID)` I
// PREPENDRE'L AMB `ajuntaNotes()`:
//
//   fila.nota_curador = dedup.ajuntaNotes(
//     identificador.creaTagIdentificador(oferta.SyndicObjectID),
//     fila.nota_curador
//   );
//
// EL TAG VA PRIMER A LA CADENA DE NOTES, DAVANT DE PROCEDÈNCIA, VERIFICACIÓ,
// CLASSIFICACIÓ I CARTELL. La raó no és estètica: aquelles quatre són judicis
// sobre el CONTINGUT de la fila —si és certa, si hi ha d'entrar, com quedarà
// la fitxa—, i aquest tag és la IDENTITAT de la fila, d'on ve. El que diu qui
// és una cosa va davant del que en diu la crítica.
//
// L'ORDRE, A EFECTES DE CODI, ÉS LLIURE: `ajuntaNotes()` només encadena i
// `extreuIdentificador()` cerca dins de tot el text, en qualsevol posició. Si
// el tag acaba al mig, res no es trenca. L'ordre és una convenció per al
// lector de l'avís groc de `curador.html`.
//
// ES DESCARTA EN PUBLICAR, I ÉS DELIBERAT. `recullFitxa()` construeix els 16
// camps canònics i `nota_curador` no hi entra: `events.json` no porta mai
// aquest tag. És exactament el que ha de passar —un identificador de
// proveïdor no és informació pública— i no s'ha d'«arreglar».
//
// UNA FILA POT NO PORTAR-NE CAP, I NO ÉS CAP ERROR. Les files que vénen del
// correu, del Typebot o del CSV de recerca no tenen cap oferta ADT66 darrere.
// `extreuIdentificador()` hi torna `null` i `construeixAncoratge()` les
// ignora en silenci.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/adt66-identificador.js    -> passa la bateria de proves
// ---------------------------------------------------------------------------


// --- Constants --------------------------------------------------------------

// L'etiqueta del tag, amb el mateix patró de claudàtors que les altres peces:
// [Suggeriment editorial: …], [Verificació: …], [Cartell: …],
// [ADT66: retirat — …]. El prefix és «ADT66 id: » i no «ADT66: » a posta: la
// nota de retirada d'eines/deteccio-retirades.js ja ocupa «ADT66: », i dues
// coses diferents no poden compartir marca si després s'han de distingir.
var MARCA_IDENTIFICADOR = '[ADT66 id: ';

// El tag sencer, tal com queda escrit i tal com es torna a llegir. El grup és
// tot el que no sigui un espai ni un claudàtor de tancament: un
// `SyndicObjectID` és una sola paraula (ex.: FMALAR066FS0009D).
var PATRO_IDENTIFICADOR = /\[ADT66 id: ([^\s\]]+)\]/;


// --- Les funcions -----------------------------------------------------------

// ------------------------------------------------------------
// El tag que porta el `SyndicObjectID` dins d'una `nota_curador`.
// Un identificador buit no dona cap tag: val més cap marca que una de falsa.
// ------------------------------------------------------------
function creaTagIdentificador(syndicObjectID) {
  var identificador = cadena(syndicObjectID);

  if (identificador === '') {
    return '';
  }

  var tag = MARCA_IDENTIFICADOR + identificador + ']';

  // La comprovació és l'anada i tornada de debò, no que el patró hi encaixi:
  // un identificador amb un claudàtor a dins («amb]cosa») donaria un tag que
  // el patró sí que troba, però que es rellegiria escapçat. Si el tag no torna
  // exactament el mateix ID, no és cap tag: val més cap marca que una de
  // falsa, i qui el llegeixi ho veurà com una fila sense ancoratge, que és la
  // veritat.
  if (extreuIdentificador(tag) !== identificador) {
    return '';
  }

  return tag;
}

// ------------------------------------------------------------
// El `SyndicObjectID` que hi hagi dins d'una `nota_curador`, o `null` si no
// n'hi ha cap. Cerca dins de tot el text: el tag pot ser al principi, al mig
// o al final, envoltat d'altres seccions de nota.
// ------------------------------------------------------------
function extreuIdentificador(notaCurador) {
  var nota = cadena(notaCurador);

  if (nota === '') {
    return null;
  }

  var trobat = nota.match(PATRO_IDENTIFICADOR);

  if (trobat === null) {
    return null;
  }

  return trobat[1];
}

// ------------------------------------------------------------
// L'ancoratge oferta -> fila d'una llista de files, llegint el tag de cada
// `nota_curador`.
//
//   llistaDeFiles   array de files de producció (les de `pendents.json`)
//
// Torna { ancoratge, duplicats }:
//   ancoratge   Map de syndicObjectID -> fila. Les files sense tag no hi són:
//               no és cap error, és una fila que no ve de l'ADT66.
//   duplicats   array de { syndicObjectID, fila } amb les files repetides.
//               Mana la primera de la llista; les altres queden aquí perquè
//               dues files amb el mateix identificador és una anomalia que
//               algú ha de mirar. No atura res i no es silencia.
// ------------------------------------------------------------
function construeixAncoratge(llistaDeFiles) {
  var ancoratge = new Map();
  var duplicats = [];

  if (!Array.isArray(llistaDeFiles)) {
    return { ancoratge: ancoratge, duplicats: duplicats };
  }

  for (var i = 0; i < llistaDeFiles.length; i++) {
    var fila = llistaDeFiles[i];

    if (!fila) {
      continue;
    }

    var identificador = extreuIdentificador(fila.nota_curador);

    if (identificador === null) {
      continue;
    }

    if (ancoratge.has(identificador) === true) {
      duplicats.push({ syndicObjectID: identificador, fila: fila });
      continue;
    }

    ancoratge.set(identificador, fila);
  }

  return { ancoratge: ancoratge, duplicats: duplicats };
}


// --- Les peces --------------------------------------------------------------

// ------------------------------------------------------------
// Un valor com a cadena retallada. Un camp desconegut és '' (§4 de CLAUDE.md).
// ------------------------------------------------------------
function cadena(valor) {
  if (valor === null || valor === undefined) {
    return '';
  }
  return String(valor).trim();
}


module.exports = {
  creaTagIdentificador: creaTagIdentificador,
  extreuIdentificador: extreuIdentificador,
  construeixAncoratge: construeixAncoratge
};


// --- Proves des del terminal ------------------------------------------------
// Tot el que ve a partir d'aquí és per poder exercitar les funcions a mà. No
// forma part de la peça i no s'ha de copiar enlloc. Cap prova no toca la
// xarxa.

var retirades = require('./deteccio-retirades.js');

// ------------------------------------------------------------
// Una fila de producció de prova, amb els disset camps buits menys els que
// interessen al cas.
// ------------------------------------------------------------
function filaDeProva(extres) {
  var camps = [
    'id', 'titol', 'data_inici', 'data_fi', 'hora', 'lloc', 'municipi',
    'comarca', 'categoria', 'descripcio_ca', 'descripcio_fr', 'associacio',
    'imatge_url', 'font_url', 'estat', 'data_entrada', 'nota_curador'
  ];

  var fila = {};
  for (var i = 0; i < camps.length; i++) {
    fila[camps[i]] = '';
  }
  fila.estat = 'pendent';

  for (var camp in extres) {
    if (Object.prototype.hasOwnProperty.call(extres, camp)) {
      fila[camp] = extres[camp];
    }
  }

  return fila;
}

// ------------------------------------------------------------
// La bateria de proves. Cada cas diu què comprova i què n'espera.
// ------------------------------------------------------------
function bateria() {
  return [
    {
      nom: 'anada i tornada simple: el tag creat es torna a llegir igual',
      comprova: function () {
        var tag = creaTagIdentificador('FMALAR066FS0009D');
        if (tag !== '[ADT66 id: FMALAR066FS0009D]') {
          return 'el tag no té la forma acordada: «' + tag + '»';
        }
        var tornada = extreuIdentificador(tag);
        if (tornada !== 'FMALAR066FS0009D') {
          return 'l\'anada i tornada no dona el mateix ID: «' + tornada + '»';
        }
        return '';
      }
    },

    {
      nom: 'el tag al mig, entre procedència i classificació',
      comprova: function () {
        var nota = '[Procedència: ADT66] ' +
                   creaTagIdentificador('FMALAR066V50MJYW') +
                   ' [Suggeriment editorial: NUCLI — R1] Sardanes.';
        var tornada = extreuIdentificador(nota);
        return tornada === 'FMALAR066V50MJYW' ? '' :
          'esperava FMALAR066V50MJYW, tinc «' + tornada + '»';
      }
    },

    {
      nom: 'el tag al principi, amb tres seccions al darrere',
      comprova: function () {
        var nota = creaTagIdentificador('FMALAR066AAAAAAA') +
                   ' [Verificació: dubte — hora] Sense hora concreta.' +
                   ' [Suggeriment editorial: PERIFÈRIA — R5] Música clàssica.' +
                   ' [Cartell: no pujat] Cloudinary ha dit que no.';
        var tornada = extreuIdentificador(nota);
        return tornada === 'FMALAR066AAAAAAA' ? '' :
          'esperava FMALAR066AAAAAAA, tinc «' + tornada + '»';
      }
    },

    {
      nom: 'el tag al final, darrere de dues seccions',
      comprova: function () {
        var nota = '[Verificació: sospitós — data_inici] La font diu el 21. ' +
                   '[Cartell: descartat] L\'enllaç va a Facebook. ' +
                   creaTagIdentificador('FMALAR066ZZZZZZZ');
        var tornada = extreuIdentificador(nota);
        return tornada === 'FMALAR066ZZZZZZZ' ? '' :
          'esperava FMALAR066ZZZZZZZ, tinc «' + tornada + '»';
      }
    },

    {
      nom: 'una nota sense tag: null',
      comprova: function () {
        var nota = '[Suggeriment editorial: NUCLI — R1] Sardanes.';
        var tornada = extreuIdentificador(nota);
        return tornada === null ? '' : 'esperava null, tinc «' + tornada + '»';
      }
    },

    {
      nom: 'una nota buida, nul·la o absent: null',
      comprova: function () {
        if (extreuIdentificador('') !== null) {
          return 'una nota buida ha de donar null';
        }
        if (extreuIdentificador(null) !== null) {
          return 'una nota nul·la ha de donar null';
        }
        if (extreuIdentificador(undefined) !== null) {
          return 'una nota absent ha de donar null';
        }
        return '';
      }
    },

    {
      nom: 'la nota de retirada no es confon amb un tag d\'identificador',
      comprova: function () {
        var nota = '[ADT66: retirat — ja no apareix al flux complet de 30/08/2026]';
        var tornada = extreuIdentificador(nota);
        return tornada === null ? '' :
          'la nota de retirada s\'ha llegit com un ID: «' + tornada + '»';
      }
    },

    {
      nom: 'un identificador buit o irrecuperable no dona cap tag',
      comprova: function () {
        if (creaTagIdentificador('') !== '') {
          return 'un ID buit ha de donar cap tag';
        }
        if (creaTagIdentificador(null) !== '') {
          return 'un ID nul ha de donar cap tag';
        }
        if (creaTagIdentificador('amb espai') !== '') {
          return 'un ID amb espai no es podria rellegir: ha de donar cap tag';
        }
        if (creaTagIdentificador('amb]claudator') !== '') {
          return 'un ID amb claudàtor no es podria rellegir: ha de donar cap tag';
        }
        return '';
      }
    },

    {
      nom: 'construeixAncoratge amb llista mixta: amb tag, sense tag i dos duplicats',
      comprova: function () {
        var primeraA = filaDeProva({
          titol: 'Ball de Prats',
          nota_curador: creaTagIdentificador('FMALAR066AAAAAAA')
        });
        var segonaA = filaDeProva({
          titol: 'Ball de Prats (repetit)',
          nota_curador: creaTagIdentificador('FMALAR066AAAAAAA') +
                        ' [Cartell: descartat] Facebook.'
        });
        var primeraB = filaDeProva({
          titol: 'Concert a Ceret',
          nota_curador: '[Procedència: ADT66] ' + creaTagIdentificador('FMALAR066BBBBBBB')
        });
        var segonaB = filaDeProva({
          titol: 'Concert a Ceret (repetit)',
          nota_curador: creaTagIdentificador('FMALAR066BBBBBBB')
        });

        var llista = [
          primeraA,
          filaDeProva({ titol: 'Mercat de Prada (del Typebot, sense tag)' }),
          primeraB,
          segonaA,
          filaDeProva({
            titol: 'Conferència (del correu)',
            nota_curador: '[Verificació: dubte — lloc] Sense sala.'
          }),
          segonaB,
          filaDeProva({
            titol: 'Exposició',
            nota_curador: creaTagIdentificador('FMALAR066CCCCCCC')
          })
        ];

        var resultat = construeixAncoratge(llista);

        if (resultat.ancoratge.size !== 3) {
          return 'esperava 3 ancoratges, en tinc ' + resultat.ancoratge.size;
        }
        if (resultat.ancoratge.get('FMALAR066AAAAAAA') !== primeraA) {
          return 'de dues files amb el mateix ID ha de manar la primera (A)';
        }
        if (resultat.ancoratge.get('FMALAR066BBBBBBB') !== primeraB) {
          return 'de dues files amb el mateix ID ha de manar la primera (B)';
        }
        if (resultat.ancoratge.has('FMALAR066CCCCCCC') === false) {
          return 'falta l\'ancoratge de la C';
        }

        if (resultat.duplicats.length !== 2) {
          return 'esperava 2 duplicats, en tinc ' + resultat.duplicats.length;
        }
        if (resultat.duplicats[0].syndicObjectID !== 'FMALAR066AAAAAAA' ||
            resultat.duplicats[0].fila !== segonaA) {
          return 'el primer duplicat no és la segona fila de la A';
        }
        if (resultat.duplicats[1].syndicObjectID !== 'FMALAR066BBBBBBB' ||
            resultat.duplicats[1].fila !== segonaB) {
          return 'el segon duplicat no és la segona fila de la B';
        }
        return '';
      }
    },

    {
      nom: 'construeixAncoratge sense cap fila amb tag: mapa buit, cap error',
      comprova: function () {
        var resultat = construeixAncoratge([
          filaDeProva({ titol: 'Del Typebot' }),
          filaDeProva({ titol: 'Del correu', nota_curador: '[Cartell: no pujat] Cap pujador.' })
        ]);

        if (resultat.ancoratge.size !== 0) {
          return 'esperava un mapa buit, en tinc ' + resultat.ancoratge.size;
        }
        return resultat.duplicats.length === 0 ? '' : 'no hi pot haver cap duplicat';
      }
    },

    {
      nom: 'construeixAncoratge amb una llista que no és cap llista: mapa buit',
      comprova: function () {
        var resultat = construeixAncoratge(null);
        if (resultat.ancoratge.size !== 0 || resultat.duplicats.length !== 0) {
          return 'una llista absent ha de donar un ancoratge buit';
        }
        return '';
      }
    },

    {
      nom: 'el resultat de construeixAncoratge encaixa a detectaRetirades() tal com surt',
      comprova: function () {
        var fila = filaDeProva({
          titol: 'Ball de Prats',
          nota_curador: creaTagIdentificador('FMALAR066BBBBBBB') +
                        ' [Suggeriment editorial: NUCLI — R1] Sardanes.'
        });

        var resultat = construeixAncoratge([fila]);

        var llista = retirades.detectaRetirades(
          [{ SyndicObjectID: 'FMALAR066BBBBBBB' }],
          [],
          resultat,
          '2026-08-30'
        );

        if (llista.length !== 1) {
          return 'esperava 1 retirada, en tinc ' + llista.length;
        }
        if (llista[0].fila_afectada === null) {
          return 'amb ancoratge, fila_afectada no pot ser null';
        }
        if (llista[0].fila_afectada.titol !== 'Ball de Prats') {
          return 'la fila ancorada no és la que toca';
        }

        var esperada = '[ADT66 id: FMALAR066BBBBBBB] ' +
                       '[Suggeriment editorial: NUCLI — R1] Sardanes. ' +
                       '[ADT66: retirat — ja no apareix al flux complet de 30/08/2026]';
        if (llista[0].fila_afectada.nota_curador !== esperada) {
          return 'la nota final no és la que toca: «' +
                 llista[0].fila_afectada.nota_curador + '»';
        }
        return '';
      }
    },

    {
      nom: 'el Map sol també encaixa a detectaRetirades()',
      comprova: function () {
        var fila = filaDeProva({ titol: 'Concert a Ceret' });
        var mapa = new Map();
        mapa.set('FMALAR066BBBBBBB', fila);

        var llista = retirades.detectaRetirades(
          [{ SyndicObjectID: 'FMALAR066BBBBBBB' }],
          [],
          mapa,
          '2026-08-30'
        );

        if (llista.length !== 1 || llista[0].fila_afectada === null) {
          return 'un Map sol ha de donar la fila ancorada';
        }
        return llista[0].fila_afectada.titol === 'Concert a Ceret' ? '' :
          'la fila ancorada no és la que toca';
      }
    }
  ];
}

// ------------------------------------------------------------
// Passa la bateria i n'escriu el resultat al terminal.
// ------------------------------------------------------------
function principal() {
  var casos = bateria();
  var fallades = 0;

  console.log('IDENTIFICADOR D\'ADT66 — ' + casos.length + ' proves');
  console.log('');

  for (var i = 0; i < casos.length; i++) {
    var problema = casos[i].comprova();

    if (problema === '') {
      console.log('BÉ   ' + casos[i].nom);
    } else {
      console.log('MAL  ' + casos[i].nom);
      console.log('     ' + problema);
      fallades = fallades + 1;
    }
  }

  console.log('');
  if (fallades === 0) {
    console.log('BÉ   les ' + casos.length + ' proves passen.');
  } else {
    console.log(fallades + ' de ' + casos.length + ' proves fallades.');
    process.exitCode = 1;
  }
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    process.argv[1].indexOf('adt66-identificador') !== -1) {
  principal();
}
