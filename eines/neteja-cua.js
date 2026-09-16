// ---------------------------------------------------------------------------
// NETEJA DE LA CUA — EINA D'UN SOL ÚS
//
// Una sola feina: treure de `pendents.json` les files que el curador no ha de
// veure mai més, i prou. No marca res com a rebutjat, no toca cap camp de cap
// fila que es quedi, i no escriu enlloc més.
//
// PER QUÈ NO ES MARQUEN «rebutjat»: la memòria de rebuig del §4 de CLAUDE.md
// serveix perquè una oferta que el curador ha dit que no, no torni a entrar.
// Cap de les dues famílies que aquesta eina treu ho necessita:
//
//   passades  la vora inferior de la finestra —foraDeFinestra() a
//             eines/filtra-candidats.js— ja les descarta a l'origen: un acte
//             acabat no torna a passar el filtre, o sigui que marcar-lo seria
//             guardar una decisió que ningú no tornarà a preguntar
//   brossa    files de prova del formulari. No venen de cap font que les pugui
//             tornar a oferir
//
// LES DE LA FAMÍLIA «passades» SÍ QUE TORNARAN, i és el que es vol: les 39 de
// l'ADT66 es van encuar el 4 de setembre de 2026, abans que existís el pas
// 7 bis, i per això no porten català. La propera passada de la sincronització
// les tornarà a oferir ja traduïdes.
//
// EL QUE AQUESTA EINA NO FA, I ÉS DELIBERAT: no toca cap `id`. Hi ha quatre
// grups de files que comparteixen `id` sense ser còpies —creaId() escapça el
// slug i fa xocar actes diferents del mateix dia—, i el defecte és de la
// funció, no de les files. Vegeu NOTES.md. Per això la verificació d'unicitat
// d'aquesta eina no mira l'`id` tot sol sinó la CÒPIA REAL: mateix `id` i
// mateix `titol` i mateix `municipi`.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/neteja-cua.js                  -> en sec: ensenya el que faria
//   node eines/neteja-cua.js --escriu --copia=CAMI   -> escriu, amb còpia
//
// EN SEC ÉS EL DEFECTE. Sense `--escriu` no es toca cap fitxer, i amb
// `--escriu` però sense `--copia=` tampoc: la còpia de seguretat no és opcional.
// ---------------------------------------------------------------------------

var fs = require('fs');
var path = require('path');


// --- Constants --------------------------------------------------------------

// El fitxer de la cua, a l'arrel del repositori. L'eina no en coneix cap altre:
// `events.json` queda expressament fora d'abast.
var FITXER_CUA = 'pendents.json';

// Les files de brossa, per `id` i no per cap patró sobre el títol: una regla
// com «el títol conté prova» podria enganxar un acte real el dia que n'entri un
// que parli d'una prova esportiva. Són tres files de dues proves del formulari:
//
//   2028-12-05-2sdf               títol «2sdf», descripció «idsfjisdjfisjdfi»
//   2026-12-01-prova-amb-secret   «Prova amb secret», dues còpies idèntiques
//
var IDS_DE_BROSSA = [
  '2028-12-05-2sdf',
  '2026-12-01-prova-amb-secret'
];

// Els camps canònics del §4 de CLAUDE.md. Serveixen només per verificar que no
// n'ha aparegut ni desaparegut cap: aquesta eina no construeix cap fila.
var CAMPS_CANONICS = [
  'id', 'titol', 'data_inici', 'data_fi', 'hora', 'lloc', 'municipi',
  'comarca', 'categoria', 'descripcio_ca', 'descripcio_fr', 'associacio',
  'imatge_url', 'font_url', 'estat', 'data_entrada', 'nota_curador'
];

// El principi del tag que `mapejaOfertaADT66()` deixa a `nota_curador`. La
// verificació exigeix que hi sigui al davant de tot, no enmig.
var PRINCIPI_DEL_TAG = '[ADT66 id: ';


// --- La decisió: qui se'n va i per què --------------------------------------

// ------------------------------------------------------------
// El motiu pel qual una fila se'n va de la cua, o '' si es queda. Els dos
// motius es miren en aquest ordre i el primer que enganxa és el que mana, de
// manera que una fila de brossa que a més sigui passada sortiria com a
// 'passada'. Per al recompte tant li fa: el que importa és que surti un sol
// cop i amb un sol motiu.
// ------------------------------------------------------------
function motiuDeSortida(fila, avui) {
  if (esPassada(fila, avui)) {
    return 'passada';
  }

  if (esBrossa(fila)) {
    return 'brossa';
  }

  return '';
}

// ------------------------------------------------------------
// Diu si un acte ja s'ha acabat. Mira `data_fi` i no `data_inici`, igual que
// la vora inferior de la finestra: un acte és passat quan ja s'ha acabat, no
// quan ja ha començat. Una `data_fi` que no sigui una data de debò no es pot
// dir que hagi passat, i la fila es queda.
// ------------------------------------------------------------
function esPassada(fila, avui) {
  if (!esData(fila.data_fi)) {
    return false;
  }

  return fila.data_fi < avui;
}

// ------------------------------------------------------------
// Diu si una fila és de les proves del formulari, per `id` exacte.
// ------------------------------------------------------------
function esBrossa(fila) {
  return IDS_DE_BROSSA.indexOf(fila.id) !== -1;
}

// ------------------------------------------------------------
// Diu si a una fila li falta el català. Les dues úniques files no passades que
// hi cauen són les dues proves, que ja surten per brossa; la funció existeix
// perquè la verificació final la pugui fer servir tal com és.
// ------------------------------------------------------------
function senseCatala(fila) {
  return String(fila.descripcio_ca || '').trim() === '';
}

// ------------------------------------------------------------
// Parteix la cua en dues llistes. Les files que es queden surten TAL COM HAN
// ENTRAT —el mateix objecte, cap camp tocat, cap camp afegit—, que és tota la
// garantia que aquesta eina no reescriu dades.
// ------------------------------------------------------------
function separaLaCua(files, avui) {
  var queden = [];
  var fora = [];

  for (var i = 0; i < files.length; i++) {
    var motiu = motiuDeSortida(files[i], avui);

    if (motiu === '') {
      queden.push(files[i]);
    } else {
      fora.push({ fila: files[i], motiu: motiu });
    }
  }

  return { queden: queden, fora: fora };
}


// --- Les verificacions ------------------------------------------------------

// ------------------------------------------------------------
// Totes les comprovacions sobre el que quedarà, en una sola llista de
// problemes. Llista buida vol dir que tot quadra. Es fa servir dos cops: en sec
// sobre el que sortiria, i després d'escriure sobre el que hi ha al disc.
// ------------------------------------------------------------
function verificaCua(files, avui, esperades, tagsOriginals) {
  var problemes = [];

  afegeix(problemes, verificaRecompte(files, esperades));
  afegeix(problemes, verificaDates(files, avui));
  afegeix(problemes, verificaCatala(files));
  afegeix(problemes, verificaCopiesReals(files));
  afegeix(problemes, verificaCamps(files));
  afegeix(problemes, verificaTags(files, tagsOriginals));

  return problemes;
}

// ------------------------------------------------------------
// El nombre de files és el que s'havia anunciat.
// ------------------------------------------------------------
function verificaRecompte(files, esperades) {
  if (files.length !== esperades) {
    return ['hi ha ' + files.length + ' files i n\'hi hauria d\'haver ' + esperades];
  }

  return [];
}

// ------------------------------------------------------------
// Cap fila amb `data_fi` anterior a avui.
// ------------------------------------------------------------
function verificaDates(files, avui) {
  var dolentes = files.filter(function (fila) {
    return esPassada(fila, avui);
  });

  return dolentes.map(function (fila) {
    return 'fila passada que no s\'ha tret: ' + fila.data_fi + '  ' + fila.titol;
  });
}

// ------------------------------------------------------------
// Cap fila amb `descripcio_ca` buida.
// ------------------------------------------------------------
function verificaCatala(files) {
  var dolentes = files.filter(senseCatala);

  return dolentes.map(function (fila) {
    return 'fila sense descripcio_ca: ' + fila.id + '  ' + fila.titol;
  });
}

// ------------------------------------------------------------
// Cap còpia real: dues files amb el mateix `id` I el mateix `titol` I el mateix
// `municipi`. Compartir només l'`id` no és cap problema —és el defecte de
// creaId(), documentat a NOTES.md— i aquí no es compta com a error.
//
// La clau es fa amb JSON.stringify d'una llista i no enganxant els tres valors
// amb un separador: així no hi ha cap caràcter que un títol pugui portar a dins
// i que faria confondre dues files diferents.
// ------------------------------------------------------------
function verificaCopiesReals(files) {
  var vistes = {};
  var problemes = [];

  for (var i = 0; i < files.length; i++) {
    var clau = JSON.stringify([files[i].id, files[i].titol, files[i].municipi]);

    if (vistes[clau] === true) {
      problemes.push('còpia real: ' + files[i].id + '  ' + files[i].titol +
        '  (' + files[i].municipi + ')');
    }

    vistes[clau] = true;
  }

  return problemes;
}

// ------------------------------------------------------------
// Cap camp nou i cap valor que no sigui una cadena: el §4 de CLAUDE.md diu que
// tot camp és una cadena i que un valor desconegut és '', mai `null` i mai
// omès. El camp 17è, `nota_curador`, no el porten totes les files —les que va
// escriure el Worker no el tenen— i per això aquí es comprova el que hi ha, no
// el que hi hauria de ser.
// ------------------------------------------------------------
function verificaCamps(files) {
  var problemes = [];

  for (var i = 0; i < files.length; i++) {
    var claus = Object.keys(files[i]);

    for (var j = 0; j < claus.length; j++) {
      if (CAMPS_CANONICS.indexOf(claus[j]) === -1) {
        problemes.push('camp desconegut «' + claus[j] + '» a ' + files[i].id);
      }

      if (typeof files[i][claus[j]] !== 'string') {
        problemes.push('camp «' + claus[j] + '» de ' + files[i].id + ' no és una cadena');
      }
    }
  }

  return problemes;
}

// ------------------------------------------------------------
// Els tags [ADT66 id: …] de les files que en tenen, intactes i al davant de
// tot. `tagsOriginals` és el mapa {id_de_fila: nota} d'abans de tocar res, i
// serveix per comprovar que la nota no ha canviat ni una coma.
// ------------------------------------------------------------
function verificaTags(files, tagsOriginals) {
  var problemes = [];

  for (var i = 0; i < files.length; i++) {
    var nota = String(files[i].nota_curador || '');

    if (nota.indexOf(PRINCIPI_DEL_TAG) === -1) {
      continue;
    }

    if (nota.indexOf(PRINCIPI_DEL_TAG) !== 0) {
      problemes.push('tag ADT66 que no és a la primera posició: ' + files[i].id);
    }

    if (tagsOriginals[files[i].id] !== undefined && tagsOriginals[files[i].id] !== nota) {
      problemes.push('la nota_curador de ' + files[i].id + ' ha canviat');
    }
  }

  return problemes;
}

// ------------------------------------------------------------
// El mapa {id: nota_curador} de les files que porten tag, d'abans de tocar res.
// ------------------------------------------------------------
function tagsDeLaCua(files) {
  var mapa = {};

  for (var i = 0; i < files.length; i++) {
    var nota = String(files[i].nota_curador || '');

    if (nota.indexOf(PRINCIPI_DEL_TAG) !== -1) {
      mapa[files[i].id] = nota;
    }
  }

  return mapa;
}


// --- Els fitxers ------------------------------------------------------------

// ------------------------------------------------------------
// Llegeix la cua i comprova que és una llista. Si el JSON és dolent, peta aquí
// i no s'arriba a tocar res.
// ------------------------------------------------------------
function llegeixCua(cami) {
  var dades = JSON.parse(fs.readFileSync(cami, 'utf8'));

  if (!Array.isArray(dades)) {
    throw new Error(cami + ' no conté cap llista');
  }

  return dades;
}

// ------------------------------------------------------------
// Desa la còpia de seguretat i en torna el camí. Es fa SEMPRE abans d'escriure,
// i si falla no s'escriu.
// ------------------------------------------------------------
function desaCopia(origen, carpeta) {
  var desti = path.join(carpeta, 'pendents.abans-de-la-neteja.json');

  fs.mkdirSync(carpeta, { recursive: true });
  fs.copyFileSync(origen, desti);

  return desti;
}

// ------------------------------------------------------------
// Escriu la cua amb el format del projecte: dos espais d'indentació i un salt
// de línia final. És literalment el que fan els altres dos escriptors del
// fitxer —curador.html:495 i worker/worker.js:996, tots dos
// `JSON.stringify(dades, null, 2) + '\n'`— i sense el salt final l'última
// línia sortiria canviada al diff sense que hi hagi canviat res.
// ------------------------------------------------------------
function escriuCua(cami, dades) {
  fs.writeFileSync(cami, JSON.stringify(dades, null, 2) + '\n', 'utf8');
}


// --- Peces petites ----------------------------------------------------------

// Diu si un valor té la forma AAAA-MM-DD.
function esData(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''));
}

// El dia d'avui en AAAA-MM-DD, en UTC com totes les dates del projecte.
function diaDavui() {
  return new Date().toISOString().slice(0, 10);
}

// Afegeix tots els elements d'una llista a una altra, sense crear-ne cap de nova.
function afegeix(llista, mes) {
  for (var i = 0; i < mes.length; i++) {
    llista.push(mes[i]);
  }
}

// El valor d'un argument --nom=valor de la línia d'ordres, o '' si no hi és.
function argument(argv, nom) {
  for (var i = 0; i < argv.length; i++) {
    if (argv[i].indexOf(nom) === 0) {
      return argv[i].slice(nom.length);
    }
  }

  return '';
}

// Quantes files d'una llista tenen la descripció francesa buida.
function senseFrances(files) {
  return files.filter(function (fila) {
    return String(fila.descripcio_fr || '').trim() === '';
  }).length;
}


// --- El registre ------------------------------------------------------------

// ------------------------------------------------------------
// Ensenya què passaria (o què ha passat), amb els títols i no només els
// comptes: qui autoritza l'escriptura ha de poder veure què se'n va.
// ------------------------------------------------------------
function informe(cua, separat, avui, enSec) {
  console.log('Neteja de la cua — ' + (enSec ? 'EN SEC, no s\'escriu res' : 'ESCRIVINT'));
  console.log('avui = ' + avui);
  console.log('');
  console.log('cua d\'entrada          ' + cua.length);

  var perMotiu = comptaPerMotiu(separat.fora);
  var motius = Object.keys(perMotiu).sort();

  for (var i = 0; i < motius.length; i++) {
    console.log('  se\'n van (' + motius[i] + ')   ' + perMotiu[motius[i]]);
  }

  console.log('  se\'n van (total)     ' + separat.fora.length);
  console.log('queden                 ' + separat.queden.length);
  console.log('');
  console.log('Les que se\'n van:');

  for (var j = 0; j < separat.fora.length; j++) {
    var fila = separat.fora[j].fila;
    console.log('  [' + separat.fora[j].motiu + '] ' + fila.data_fi + '  ' +
      fila.titol.slice(0, 60));
  }
}

// Quantes files se'n van per cada motiu.
function comptaPerMotiu(fora) {
  var perMotiu = {};

  for (var i = 0; i < fora.length; i++) {
    perMotiu[fora[i].motiu] = (perMotiu[fora[i].motiu] || 0) + 1;
  }

  return perMotiu;
}

// ------------------------------------------------------------
// Ensenya el resultat de les verificacions i diu si tot ha quadrat.
// ------------------------------------------------------------
function informeDeVerificacio(problemes, titol) {
  console.log('');
  console.log(titol);

  if (problemes.length === 0) {
    console.log('  tot quadra');
    return;
  }

  for (var i = 0; i < problemes.length; i++) {
    console.log('  PROBLEMA: ' + problemes[i]);
  }
}


// --- L'entrada des del terminal ---------------------------------------------

function principal() {
  var enSec = process.argv.indexOf('--escriu') === -1;
  var carpetaCopia = argument(process.argv, '--copia=');
  var avui = diaDavui();

  var cua = llegeixCua(FITXER_CUA);
  var tagsOriginals = tagsDeLaCua(cua);
  var separat = separaLaCua(cua, avui);

  informe(cua, separat, avui, enSec);

  var problemes = verificaCua(separat.queden, avui, separat.queden.length, tagsOriginals);
  informeDeVerificacio(problemes, 'Verificació sobre el que quedaria:');

  console.log('');
  console.log('de les que queden, descripcio_fr buida: ' + senseFrances(separat.queden));
  console.log('de les que queden, amb tag ADT66:       ' +
    Object.keys(tagsDeLaCua(separat.queden)).length);

  if (enSec) {
    console.log('');
    console.log('EN SEC: no s\'ha escrit res. Torna-hi amb --escriu --copia=CAMI per desar.');
    process.exit(problemes.length === 0 ? 0 : 1);
  }

  if (carpetaCopia === '') {
    console.log('');
    console.log('Falta --copia=CAMI: sense carpeta per a la còpia de seguretat no s\'escriu.');
    process.exit(1);
  }

  var copia = desaCopia(FITXER_CUA, carpetaCopia);
  console.log('');
  console.log('còpia de seguretat: ' + copia);

  escriuCua(FITXER_CUA, separat.queden);
  console.log('escrit: ' + FITXER_CUA);

  // Es torna a llegir del disc: verificar la variable de memòria no provaria
  // que el que ha quedat al fitxer és bo.
  var tornat = llegeixCua(FITXER_CUA);
  var problemesFinals = verificaCua(tornat, avui, separat.queden.length, tagsOriginals);
  informeDeVerificacio(problemesFinals, 'Verificació sobre el fitxer escrit:');

  process.exit(problemesFinals.length === 0 ? 0 : 1);
}

principal();
