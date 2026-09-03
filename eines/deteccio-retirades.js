// ---------------------------------------------------------------------------
// DETECCIÓ DE RETIRADES DEL FLUX DE L'ADT66
//
// Una sola feina: dir quines ofertes hi havia a una lectura anterior del flux
// complet i ja no hi són a la lectura d'ara. Res més.
//
//   - Cap crida a cap API. Codi pur: entren dos instantanis, en surt una
//     llista. Aquesta funció NO crida mai el flux ella mateixa.
//   - Cap escriptura: ni a pendents.json, ni enlloc.
//   - NO està connectada a res: ni a sincronitzaADT66(), ni a processaLot(),
//     ni a cap cron. És la peça, no el cablejat. Cada quan es fa una passada
//     completa del flux és una decisió del propietari, no d'aquest fitxer.
//
// AQUESTA FUNCIÓ NOMÉS MARCA. MAI ESBORRA CAP FILA I MAI TOCA `estat`.
// Retirar un acte del públic és sempre decisió del curador: aquí només se li
// diu, amb una `nota_curador`, què ha d'anar a mirar. Una fila que desapareix
// sola és una decisió presa per ell sense dir-l'hi.
//
// NOMÉS SERVEIX ENTRE DUES PASSADES COMPLETES. Una lectura diferencial
// (`sincronitzaADT66` amb marca) no distingeix «ha desaparegut» de «no s'ha
// tocat»: totes dues coses són absència del resultat. Passar-hi un instantani
// diferencial donaria centenars de retirades falses.
//
// QUI GUARDA L'INSTANTANI ANTERIOR NO ÉS AQUESTA PEÇA. Rep els dos ja fets i
// prou. On acaba vivint l'instantani anterior encara NO està decidit: el §3
// de CLAUDE.md diu que l'estat viu en dos fitxers JSON, i un tercer fitxer
// trencaria aquella restricció. Vegeu docs/HANDOFF-ADT66.md §6.
//
// L'ANCORATGE FILA ↔ OFERTA NO ESTÀ RESOLT, i és la limitació que val més
// saber abans de cablejar res. Cap fila de `pendents.json` no porta el
// `SyndicObjectID` de l'oferta que la va originar, i comprovat amb curl el 30
// d'agost de 2026 **no hi ha cap adreça pública i llegible de la fitxa de
// l'ADT66 construïda a partir del `SyndicObjectID`** que el pogués portar
// dins de `font_url` (docs/HANDOFF-ADT66.md §2 ter). Per això
// `filesAncorades` és un argument: qui cridi la funció ha de saber, ell, quina
// fila ve de quina oferta. Sense ancoratge, la funció torna la llista de
// retirades amb `fila_afectada: null` i la nota ja escrita, que continua sent
// útil per mirar-s'ho a mà.
//
// ON ÉS L'ANCORATGE, DES DEL 30 D'AGOST DE 2026: eines/adt66-identificador.js
// el resol sense cap camp nou, escrivint el `SyndicObjectID` dins de
// `nota_curador`. `construeixAncoratge(files)` en fa un mapa i el seu resultat
// entra aquí tal qual. El que encara NO existeix és el mapatge ADT66 -> fila
// que hi escriu el tag en néixer la fila: fins que hi sigui, les files de
// `pendents.json` no en porten cap i l'ancoratge surt buit.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/deteccio-retirades.js    -> passa la bateria de proves
// ---------------------------------------------------------------------------


// --- El que ve de fora ------------------------------------------------------

// La regla d'ajuntar dues notes de curador —totes dues, mai una— viu en un sol
// lloc a posta. Vegeu el comentari de l'export a dedup-esdeveniments.js.
var dedup = require('./dedup-esdeveniments.js');


// --- Constants --------------------------------------------------------------

// L'etiqueta de la nota, amb el mateix patró que les altres peces:
// [Suggeriment editorial: …], [Verificació: …], [Cartell: …].
var MARCA_RETIRADA = '[ADT66: retirat — ja no apareix al flux complet de ';


// --- La funció --------------------------------------------------------------

// ------------------------------------------------------------
// Les ofertes que hi havia a `fluxAnterior` i ja no són a `fluxActual`.
//
//   fluxAnterior    array d'ofertes ja parsejades (l'instantani vell)
//   fluxActual      array d'ofertes ja parsejades (l'instantani d'ara)
//   filesAncorades  opcional: què diu quina fila ve de quina oferta. Hi va
//                   directament el resultat de `construeixAncoratge()`
//                   (eines/adt66-identificador.js); també s'hi accepta un
//                   `Map` sol o un array de { syndicObjectID, fila }. Si no
//                   n'hi ha, `fila_afectada` surt `null` i la nota surt
//                   igualment.
//   dataComparacio  opcional: 'AAAA-MM-DD' de la comparació. Per defecte,
//                   avui a París. És la data de la comparació, no la de
//                   l'esdeveniment.
//
// Torna una llista de { syndicObjectID, fila_afectada, dataDeteccio, nota },
// en l'ordre en què les ofertes surten a `fluxAnterior`. Llista buida vol dir
// que no s'ha retirat res.
// ------------------------------------------------------------
function detectaRetirades(fluxAnterior, fluxActual, filesAncorades, dataComparacio) {
  var anterior = llistaDOfertes(fluxAnterior);
  var actual = llistaDOfertes(fluxActual);
  var data = cadena(dataComparacio) === '' ? dataDavuiAParis() : cadena(dataComparacio);

  var hiSonAra = conjuntDIdentificadors(actual);
  var ancoratges = mapaDAncoratges(filesAncorades);
  var jaVistos = {};
  var retirades = [];

  for (var i = 0; i < anterior.length; i++) {
    var identificador = identificadorDeLoferta(anterior[i]);

    // Una oferta sense identificador no es pot seguir d'una passada a l'altra.
    if (identificador === '') {
      continue;
    }

    // Un mateix identificador repetit a l'instantani vell és una retirada, no
    // dues.
    if (jaVistos[identificador] === true) {
      continue;
    }
    jaVistos[identificador] = true;

    if (hiSonAra[identificador] === true) {
      continue;
    }

    retirades.push(retirada(identificador, ancoratges[identificador], data));
  }

  return retirades;
}


// --- Les peces --------------------------------------------------------------

// ------------------------------------------------------------
// Munta una entrada del resultat. Sempre els mateixos quatre camps, sempre
// presents, perquè qui la cridi no hagi de comprovar si hi són.
// ------------------------------------------------------------
function retirada(identificador, fila, data) {
  var nota = notaDeRetirada(data);

  return {
    syndicObjectID: identificador,
    fila_afectada: fila === undefined ? null : filaAmbNota(fila, nota),
    dataDeteccio: data,
    nota: nota
  };
}

// ------------------------------------------------------------
// El text de la nota per al curador. La data va en DD/MM/AAAA perquè és la
// forma que ell llegeix a la fitxa, i és la data de la COMPARACIÓ.
// ------------------------------------------------------------
function notaDeRetirada(data) {
  return MARCA_RETIRADA + aFormaCurta(data) + ']';
}

// ------------------------------------------------------------
// Una còpia de la fila amb la nota afegida. L'ÚNIC camp que aquesta peça
// toca. La nota que ja hi hagués va davant: és més antiga i sovint és la que
// diu què s'ha d'anar a mirar de debò. `estat` no es toca mai.
// ------------------------------------------------------------
function filaAmbNota(fila, nota) {
  var copia = {};

  for (var camp in fila) {
    if (Object.prototype.hasOwnProperty.call(fila, camp)) {
      copia[camp] = fila[camp];
    }
  }

  copia.nota_curador = dedup.ajuntaNotes(copia.nota_curador, nota);

  return copia;
}

// ------------------------------------------------------------
// Els identificadors d'una llista d'ofertes, com a conjunt. Es fa servir per
// preguntar «hi és?» sense recórrer la llista sencera cada vegada.
// ------------------------------------------------------------
function conjuntDIdentificadors(ofertes) {
  var conjunt = {};

  for (var i = 0; i < ofertes.length; i++) {
    var identificador = identificadorDeLoferta(ofertes[i]);
    if (identificador !== '') {
      conjunt[identificador] = true;
    }
  }

  return conjunt;
}

// ------------------------------------------------------------
// Les files que ens han passat, indexades pel `SyndicObjectID` de l'oferta que
// les va originar. Sense ancoratges, un mapa buit.
//
// Accepta les tres formes en què l'ancoratge arriba avui, perquè qui la cridi
// no hagi de convertir res:
//
//   - el resultat sencer de `construeixAncoratge()`, o sigui
//     { ancoratge: Map, duplicats: [] } — la forma normal, i la que ve
//     d'eines/adt66-identificador.js
//   - un `Map` de syndicObjectID -> fila, si algú ja només en porta el mapa
//   - un array de { syndicObjectID, fila }, la forma de sempre
// ------------------------------------------------------------
function mapaDAncoratges(filesAncorades) {
  var mapa = {};

  if (!filesAncorades) {
    return mapa;
  }

  // El resultat de construeixAncoratge(): el mapa és a dins, els duplicats no
  // són cosa d'aquesta peça.
  if (filesAncorades.ancoratge) {
    return mapaDAncoratges(filesAncorades.ancoratge);
  }

  if (filesAncorades instanceof Map) {
    filesAncorades.forEach(function (fila, identificador) {
      if (cadena(identificador) !== '' && fila) {
        mapa[cadena(identificador)] = fila;
      }
    });
    return mapa;
  }

  if (!Array.isArray(filesAncorades)) {
    return mapa;
  }

  for (var i = 0; i < filesAncorades.length; i++) {
    var parell = filesAncorades[i] || {};
    var identificador = cadena(parell.syndicObjectID);

    if (identificador !== '' && parell.fila) {
      mapa[identificador] = parell.fila;
    }
  }

  return mapa;
}

// ------------------------------------------------------------
// L'identificador d'una oferta del flux, o cadena buida si no en porta.
// ------------------------------------------------------------
function identificadorDeLoferta(oferta) {
  if (!oferta) {
    return '';
  }
  return cadena(oferta.SyndicObjectID);
}

// ------------------------------------------------------------
// Una llista, sempre. Qualsevol cosa que no sigui un array és cap oferta.
// ------------------------------------------------------------
function llistaDOfertes(flux) {
  if (!Array.isArray(flux)) {
    return [];
  }
  return flux;
}

// ------------------------------------------------------------
// Un valor com a cadena retallada. Un camp desconegut és '' (§4 de CLAUDE.md).
// ------------------------------------------------------------
function cadena(valor) {
  if (valor === null || valor === undefined) {
    return '';
  }
  return String(valor).trim();
}

// ------------------------------------------------------------
// Passa una data AAAA-MM-DD a DD/MM/AAAA. Si no té aquesta forma exacta, es
// torna tal com ha vingut: val més una data rara a la nota que una
// d'inventada.
// ------------------------------------------------------------
function aFormaCurta(data) {
  var parts = String(data).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (parts === null) {
    return String(data);
  }
  return parts[3] + '/' + parts[2] + '/' + parts[1];
}

// ------------------------------------------------------------
// La data d'avui a París, en AAAA-MM-DD. Ha de ser París i no UTC perquè a
// l'estiu França va dues hores per davant. És la mateixa regla que a
// eines/adt66-sincronitza.js; hi és copiada perquè aquell fitxer és un guió de
// terminal i no exporta res.
// ------------------------------------------------------------
function dataDavuiAParis() {
  var format = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  var trossos = {};
  var parts = format.formatToParts(new Date());
  for (var i = 0; i < parts.length; i++) {
    trossos[parts[i].type] = parts[i].value;
  }

  return trossos.year + '-' + trossos.month + '-' + trossos.day;
}


module.exports = {
  detectaRetirades: detectaRetirades
};


// --- Proves des del terminal ------------------------------------------------
// Tot el que ve a partir d'aquí és per poder exercitar la funció a mà. No forma
// part de la peça i no s'ha de copiar enlloc. Cap prova no toca la xarxa: els
// dos instantanis són fets a mà.

// La data de la comparació a les proves, fixada perquè el resultat no depengui
// del dia que s'executin.
var DATA_DE_PROVA = '2026-08-30';

// ------------------------------------------------------------
// Una oferta de prova amb la forma mínima que la funció mira.
// ------------------------------------------------------------
function ofertaDeProva(identificador, extres) {
  var oferta = {
    SyndicObjectID: identificador,
    SyndicObjectName: 'ACTE ' + identificador,
    Updated: '2026-08-01T10:00:00',
    TRI: '14/09/2026'
  };

  for (var camp in extres) {
    if (Object.prototype.hasOwnProperty.call(extres, camp)) {
      oferta[camp] = extres[camp];
    }
  }

  return oferta;
}

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
  var NOTA = '[ADT66: retirat — ja no apareix al flux complet de 30/08/2026]';

  return [
    {
      nom: 'cap retirada: els mateixos identificadors als dos costats',
      anterior: [ofertaDeProva('FMALAR066AAAAAAA'), ofertaDeProva('FMALAR066BBBBBBB')],
      actual: [ofertaDeProva('FMALAR066AAAAAAA'), ofertaDeProva('FMALAR066BBBBBBB')],
      comprova: function (retirades) {
        return retirades.length === 0 ? '' : 'esperava cap retirada, en tinc ' + retirades.length;
      }
    },

    {
      nom: 'una retirada simple',
      anterior: [ofertaDeProva('FMALAR066AAAAAAA'), ofertaDeProva('FMALAR066BBBBBBB')],
      actual: [ofertaDeProva('FMALAR066AAAAAAA')],
      comprova: function (retirades) {
        if (retirades.length !== 1) {
          return 'esperava 1 retirada, en tinc ' + retirades.length;
        }
        if (retirades[0].syndicObjectID !== 'FMALAR066BBBBBBB') {
          return 'esperava la B retirada, tinc «' + retirades[0].syndicObjectID + '»';
        }
        if (retirades[0].dataDeteccio !== DATA_DE_PROVA) {
          return 'la data de detecció no és la de la comparació: «' + retirades[0].dataDeteccio + '»';
        }
        if (retirades[0].nota !== NOTA) {
          return 'la nota no té la forma acordada: «' + retirades[0].nota + '»';
        }
        if (retirades[0].fila_afectada !== null) {
          return 'sense ancoratge, fila_afectada ha de ser null';
        }
        return '';
      }
    },

    {
      nom: 'present als dos costats amb altres camps canviats: no és cap retirada',
      anterior: [
        ofertaDeProva('FMALAR066AAAAAAA', { SyndicObjectName: 'NOM VELL', TRI: '14/09/2026' })
      ],
      actual: [
        ofertaDeProva('FMALAR066AAAAAAA', {
          SyndicObjectName: 'NOM NOU',
          TRI: '21/09/2026 22/09/2026',
          Updated: '2026-08-29T09:00:00'
        })
      ],
      comprova: function (retirades) {
        return retirades.length === 0 ? '' :
          'un canvi de camps s\'ha comptat com a retirada';
      }
    },

    {
      nom: 'la fila ancorada ja porta la nota d\'un altre agent: totes dues hi són',
      anterior: [ofertaDeProva('FMALAR066BBBBBBB')],
      actual: [],
      ancoratges: [{
        syndicObjectID: 'FMALAR066BBBBBBB',
        fila: filaDeProva({
          titol: 'Ball de Prats',
          nota_curador: '[Suggeriment editorial: NUCLI — R1] Sardanes.'
        })
      }],
      comprova: function (retirades) {
        if (retirades.length !== 1) {
          return 'esperava 1 retirada, en tinc ' + retirades.length;
        }

        var fila = retirades[0].fila_afectada;
        if (fila === null) {
          return 'amb ancoratge, fila_afectada no pot ser null';
        }

        var esperada = '[Suggeriment editorial: NUCLI — R1] Sardanes. ' + NOTA;
        if (fila.nota_curador !== esperada) {
          return 'la concatenació no és la que toca: «' + fila.nota_curador + '»';
        }
        if (fila.estat !== 'pendent') {
          return 'l\'estat s\'ha tocat: «' + fila.estat + '»';
        }
        if (fila.titol !== 'Ball de Prats') {
          return 'la resta de la fila s\'ha tocat';
        }
        return '';
      }
    },

    {
      nom: 'la fila ancorada no porta cap nota: hi queda només la de la retirada',
      anterior: [ofertaDeProva('FMALAR066BBBBBBB')],
      actual: [],
      ancoratges: [{
        syndicObjectID: 'FMALAR066BBBBBBB',
        fila: filaDeProva({ titol: 'Ball de Prats' })
      }],
      comprova: function (retirades) {
        if (retirades[0].fila_afectada.nota_curador !== NOTA) {
          return 'esperava només la nota de retirada, tinc «' +
                 retirades[0].fila_afectada.nota_curador + '»';
        }
        return '';
      }
    },

    {
      nom: 'la fila original no es toca: la nota va a una còpia',
      anterior: [ofertaDeProva('FMALAR066BBBBBBB')],
      actual: [],
      ancoratges: [{
        syndicObjectID: 'FMALAR066BBBBBBB',
        fila: filaDeProva({ titol: 'Ball de Prats' })
      }],
      comprova: function (retirades, cas) {
        var original = cas.ancoratges[0].fila;
        if (original.nota_curador !== '') {
          return 'la fila que ha entrat s\'ha modificat: «' + original.nota_curador + '»';
        }
        if (retirades[0].fila_afectada === original) {
          return 'fila_afectada és el mateix objecte que va entrar, no una còpia';
        }
        return '';
      }
    },

    {
      nom: 'el mateix identificador repetit a l\'instantani vell compta un sol cop',
      anterior: [ofertaDeProva('FMALAR066BBBBBBB'), ofertaDeProva('FMALAR066BBBBBBB')],
      actual: [],
      comprova: function (retirades) {
        return retirades.length === 1 ? '' :
          'esperava 1 retirada, en tinc ' + retirades.length;
      }
    },

    {
      nom: 'una oferta sense identificador no es pot seguir: s\'ignora',
      anterior: [ofertaDeProva(''), ofertaDeProva('FMALAR066BBBBBBB')],
      actual: [],
      comprova: function (retirades) {
        if (retirades.length !== 1) {
          return 'esperava 1 retirada, en tinc ' + retirades.length;
        }
        return retirades[0].syndicObjectID === 'FMALAR066BBBBBBB' ? '' :
          'la retirada no és la que toca';
      }
    },

    {
      nom: 'instantani vell buit: cap retirada',
      anterior: [],
      actual: [ofertaDeProva('FMALAR066AAAAAAA')],
      comprova: function (retirades) {
        return retirades.length === 0 ? '' : 'un instantani vell buit no pot donar retirades';
      }
    },

    {
      nom: 'instantani nou buit: tot el que hi havia surt retirat',
      anterior: [ofertaDeProva('FMALAR066AAAAAAA'), ofertaDeProva('FMALAR066BBBBBBB')],
      actual: [],
      comprova: function (retirades) {
        return retirades.length === 2 ? '' : 'esperava 2 retirades, en tinc ' + retirades.length;
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

  console.log('DETECCIÓ DE RETIRADES — ' + casos.length + ' proves, data de comparació ' +
              DATA_DE_PROVA);
  console.log('');

  for (var i = 0; i < casos.length; i++) {
    var cas = casos[i];
    var retirades = detectaRetirades(cas.anterior, cas.actual, cas.ancoratges, DATA_DE_PROVA);
    var problema = cas.comprova(retirades, cas);

    if (problema === '') {
      console.log('BÉ   ' + cas.nom);
    } else {
      console.log('MAL  ' + cas.nom);
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
    process.argv[1].indexOf('deteccio-retirades') !== -1) {
  principal();
}
