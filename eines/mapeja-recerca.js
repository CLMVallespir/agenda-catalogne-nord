// ---------------------------------------------------------------------------
// MAPEIG RECERCA -> PRODUCCIÓ
//
// Una sola feina: convertir un registre de l'esquema de RECERCA (31 camps, amb
// procedència i notes de qui l'ha investigat) en una fila neta de l'esquema de
// PRODUCCIÓ (els 16 camps canònics del §4 de CLAUDE.md). Res més.
//
//   - Cap crida a Gemini ni a cap API. Codi pur: entra un registre, surt una
//     fila. No llegeix res del sistema i no escriu enlloc.
//   - No està connectada a res: ni a sincronitzaADT66(), ni a
//     comparaEsdeveniments(). És la peça de mapeig sola, perquè totes dues
//     —i qualsevol recerca futura— la puguin cridar igual.
//
// La procedència NO entra mai als camps de producció. Surt a part, al segon
// valor del resultat: { fila, metadadades }. On acabarà vivint aquesta
// metadada encara NO està decidit (§4 de docs/HANDOFF-MAPEIG-RECERCA.md).
//
// L'ÚNICA excepció, i és un camp de l'esquema, no una drecera: `nota_curador`.
// Els avisos que genera aquest mapeig —títol per traduir, categoria sense
// calaix, municipi desconegut— sí que viatgen dins de la fila fins a
// pendents.json, perquè el seu destinatari és el curador i el curador llegeix
// files. El frontend públic no el mira mai (§4 de CLAUDE.md).
//
// La taula camp a camp dels 31 —quins 13 porten contingut, quins 18 no i què
// se'n fa de cadascun— és a **docs/HANDOFF-MAPEIG-RECERCA.md**. Si canvies
// res d'aquí, canvia-la allà: és el document que explica per què.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/mapeja-recerca.js                    -> bateria de proves
//   node eines/mapeja-recerca.js <fitxer.csv>       -> informe sobre un CSV real
// ---------------------------------------------------------------------------


// --- El que ve de fora ------------------------------------------------------

// Els noms de poble en les dues llengües.
// Vegeu eines/pobles-alies.js per què viuen allà i no aquí.
var pobles = require('./pobles-alies.js');

// I la pertinença comarcal de cada poble, que viu al seu costat i que serveix
// per deduir la comarca quan el registre no en porta cap: és el cas de tot el
// que ve del flux de l'ADT66, que dona el municipi sempre i la comarca mai.
var comarques = require('./comarca-per-poble.js');


// --- Constants: els dos esquemes --------------------------------------------

// Els disset camps de producció, amb el nom i l'ordre del §4 de CLAUDE.md. La
// fila que surt d'aquí té sempre aquests disset i cap més, en aquest ordre.
var CAMPS_PRODUCCIO = [
  'id', 'titol', 'data_inici', 'data_fi', 'hora', 'lloc', 'municipi',
  'comarca', 'categoria', 'descripcio_ca', 'descripcio_fr', 'associacio',
  'imatge_url', 'font_url', 'estat', 'data_entrada', 'nota_curador'
];

// Els trenta-un camps de l'esquema de recerca, en l'ordre de la capçalera del
// CSV. Serveixen per comprovar que un registre és del que ens pensem i per
// saber què hi ha per repartir.
var CAMPS_RECERCA = [
  'id', 'nom_original', 'llengua_nom_original', 'nom_altra_llengua',
  'data_inici', 'dia_setmana_inici', 'data_fi', 'hora_inici', 'hora_fi',
  'lloc', 'adreca', 'municipi', 'zona_cerca', 'comarca', 'categoria',
  'llengua_esdeveniment', 'descripcio_original', 'llengua_descripcio',
  'url_cartell', 'organitzador', 'preu', 'url_reserva', 'url_font',
  'data_publicacio_font', 'data_acces', 'citacio_literal', 'confirmacio_2026',
  'estat_vitalitat', 'nivell_confianca', 'clau_dedup', 'motiu_null'
];

var COMARQUES = ['Rosselló', 'Conflent', 'Vallespir', 'Capcir', 'Cerdanya'];

var CATEGORIES = [
  'Música', 'Teatre', 'Dansa i ball', 'Conferència', 'Exposició', 'Mercat',
  'Cinema', 'Taller', 'Activitat infantil', 'Patrimoni i tradicions',
  'Concentració', 'Esports', 'Vida associativa'
];


// --- Constants: les categories de la recerca --------------------------------

// La recerca escriu la categoria en anglès i en text lliure; producció només
// admet les tretze del §4. Aquesta taula tradueix el que sabem traduir.
//
// El que NO hi és no és cap error d'aquesta taula: és que **les tretze
// categories no tenen calaix per a allò**. «gastronomy», «nature & outdoors»
// o «community» no són cap de les tretze, i inventar-los un calaix seria
// decidir política editorial des del codi.
//
// PENDENT, I NO ES FA AQUÍ A POSTA: des del 3 de setembre de 2026 l'enum té
// `Esports` i `Vida associativa`, o sigui que «sports» i «community» ja
// tindrien calaix. NO s'hi han posat: aquesta taula decideix les files que
// entren pel CSV de recerca, i canviar-la ara canviaria la classificació
// d'una via que no era la d'aquella tasca. És una decisió del propietari,
// d'una línia, el dia que la vulgui. Cauen a "" i el curador decideix — que és
// exactament el que fa valorPermes amb qualsevol valor desconegut.
var CATEGORIES_RECERCA = {
  'music': 'Música',
  'concert': 'Música',
  'theatre': 'Teatre',
  'theater': 'Teatre',
  'dance': 'Dansa i ball',
  'ball': 'Dansa i ball',
  'conference': 'Conferència',
  'conference/talk': 'Conferència',
  'talk': 'Conferència',
  'talk/lecture': 'Conferència',
  'lecture': 'Conferència',
  'exhibition': 'Exposició',
  'market': 'Mercat',
  'market/fair': 'Mercat',
  'fair': 'Mercat',
  'cinema': 'Cinema',
  'film': 'Cinema',
  'workshop': 'Taller',
  'children\'s activity': 'Activitat infantil',
  'children activity': 'Activitat infantil',
  'heritage': 'Patrimoni i tradicions',
  'heritage & tradition': 'Patrimoni i tradicions',
  'heritage open days': 'Patrimoni i tradicions',
  'tradition': 'Patrimoni i tradicions',
  'guided tour': 'Patrimoni i tradicions',
  'sport-as-tradition': 'Patrimoni i tradicions'
};


// --- Constants: els municipis amb dos noms ----------------------------------

// La taula viu a eines/pobles-alies.js, que és l'origen de veritat compartit
// amb eines/dedup-esdeveniments.js. La forma catalana és sempre la primera
// columna, i és la que va a producció: el §4 de CLAUDE.md diu «municipi, en
// forma catalana quan es coneix».
var MUNICIPIS_EQUIVALENTS = pobles.POBLES_ALIES;

// El separador que la recerca fa servir quan dona el nom d'un poble en les
// dues llengües: «Prades / Prada», «Perpinyà / Perpignan». L'ordre no és
// constant —hi ha files amb el català davant i files amb el francès davant—,
// o sigui que la banda bona s'ha de decidir amb la taula, no per posició.
var SEPARADOR_BILINGUE = ' / ';


// --- La funció --------------------------------------------------------------

// ------------------------------------------------------------
// Converteix un registre de recerca en una fila de producció. Torna dues
// coses ben separades:
//
//   fila         els 16 camps canònics, tots cadenes, en l'ordre del §4.
//                És l'únic que pot anar a pendents.json o a events.json.
//   metadadades  tota la resta: d'on surt, qui ho ha comprovat, amb quina
//                confiança, en quina llengua, i el que s'ha descartat pel
//                camí. NO té encara cap lloc definitiu al sistema.
//
// Un registre que no porti un camp és igual que un que el porti buit o amb la
// cadena "null" que escriu la recerca: tot això és "" (§4: mai null, mai
// absent).
// ------------------------------------------------------------
function mapejaAProduccio(candidatRecerca) {
  var brut = candidatRecerca || {};
  var avisos = [];

  var titol = titolDeProduccio(brut, avisos);
  var dataInici = valorRecerca(brut, 'data_inici');
  var municipi = municipiDeProduccio(valorRecerca(brut, 'municipi'), avisos);
  var descripcions = descripcionsDeProduccio(brut, avisos);

  var fila = {
    // L'id no s'hereta MAI: la recerca en porta un de fet i es llença.
    id: creaId(dataInici, titol),
    titol: titol,
    data_inici: dataInici,
    data_fi: valorRecerca(brut, 'data_fi'),
    // Producció té una sola hora: la d'inici. hora_fi es descarta.
    hora: valorRecerca(brut, 'hora_inici'),
    lloc: valorRecerca(brut, 'lloc'),
    municipi: municipi,
    // El municipi ja calculat, no el brut: la deducció de comarca necessita el
    // nom en la forma que la taula coneix.
    comarca: comarcaDeProduccio(valorRecerca(brut, 'comarca'), municipi, avisos),
    categoria: categoriaDeProduccio(valorRecerca(brut, 'categoria'), avisos),
    descripcio_ca: descripcions.ca,
    descripcio_fr: descripcions.fr,
    associacio: valorRecerca(brut, 'organitzador'),
    imatge_url: valorRecerca(brut, 'url_cartell'),
    font_url: valorRecerca(brut, 'url_font'),
    // Els dos camps que omple el sistema i que la recerca no toca mai.
    estat: 'pendent',
    data_entrada: new Date().toISOString(),
    // S'omple al final, quan ja s'han recollit tots els avisos.
    nota_curador: ''
  };

  if (fila.id === '' ) {
    avisos.push('Sense data d\'inici: l\'id queda buit i aquesta fila no es pot identificar.');
  }

  fila.nota_curador = notaCurador(avisos);

  return {
    fila: ordenaSegonsEsquema(fila),
    metadadades: metadadadesDeProduccio(brut, avisos)
  };
}

// ------------------------------------------------------------
// Els avisos d'aquest mapeig, en un sol text per al camp `nota_curador`. Són
// frases senceres i acabades en punt: s'ajunten amb un espai i prou, sense cap
// separador inventat.
//
// Van dins de la fila, no a la metadada, perquè el seu destinatari és el
// curador i el curador llegeix files. La metadada en guarda la llista
// estructurada, que és la mateixa cosa comptable per a les eines.
// ------------------------------------------------------------
function notaCurador(avisos) {
  if (avisos.length === 0) {
    return '';
  }
  return avisos.join(' ');
}


// --- Les peces: els camps que necessiten una decisió ------------------------

// ------------------------------------------------------------
// El títol que va a producció. Producció té UN sol títol i el §4 diu que és
// en català, però 96 de les 103 files de recerca el porten en francès. Per
// això mirem primer si la recerca ens dona la versió en l'altra llengua.
//
// L'ordre és: si el títol original ja és català, aquell; si no, el de l'altra
// llengua quan hi és; si no, el francès tal qual, amb un avís perquè el
// curador sàpiga que li toca traduir-lo.
// ------------------------------------------------------------
function titolDeProduccio(brut, avisos) {
  var original = valorRecerca(brut, 'nom_original');
  var llengua = valorRecerca(brut, 'llengua_nom_original');
  var altra = valorRecerca(brut, 'nom_altra_llengua');

  if (llengua === 'ca') {
    return original;
  }

  if (altra !== '') {
    return altra;
  }

  if (original !== '' && llengua !== '') {
    avisos.push('El títol ve en «' + llengua + '» i no hi ha versió catalana: cal traduir-lo.');
  }

  return original;
}

// ------------------------------------------------------------
// Reparteix la descripció única de la recerca cap a la banda que li toca. És
// exactament la regla del Typebot (§7 de CLAUDE.md): el text va a la seva
// llengua i l'altra banda queda buida perquè el curador la completi.
//
// Amb una llengua que no és ni ca ni fr —o sense llengua— el text no es pot
// col·locar sense mentir: es deixa a la banda francesa, que és el que és el
// 94 % del material d'origen, i s'avisa.
// ------------------------------------------------------------
function descripcionsDeProduccio(brut, avisos) {
  var text = valorRecerca(brut, 'descripcio_original');
  var llengua = valorRecerca(brut, 'llengua_descripcio');

  if (text === '') {
    return { ca: '', fr: '' };
  }

  if (llengua === 'ca') {
    avisos.push('Descripció en català: falta la traducció francesa.');
    return { ca: text, fr: '' };
  }

  if (llengua === 'fr') {
    avisos.push('Descripció en francès: falta la traducció catalana.');
    return { ca: '', fr: text };
  }

  avisos.push('Descripció en llengua desconeguda («' + llengua + '»): la poso a la banda francesa; comprova-ho.');
  return { ca: '', fr: text };
}

// ------------------------------------------------------------
// La comarca, coercida a les cinc permeses. Tres passos, en aquest ordre:
//
//   1. El que digui el registre, si és una de les cinc. Manà sempre: si la
//      font ha dit la comarca, no la discutim.
//   2. Si no —perquè el camp arriba buit, o perquè diu una cosa que no és cap
//      de les cinc, com l'«Alta Cerdanya» que escriu la recerca—, es deduïx
//      del municipi amb eines/comarca-per-poble.js. Deduir-la és segur: el
//      municipi determina la comarca del tot, no és cap suposició.
//   3. I si el poble tampoc no és a la taula, "" i s'avisa el curador.
//
// El pas 2 hi és per l'ADT66: aquell flux dona el municipi a totes les
// ofertes i la comarca a cap, perquè no és una divisió que l'administració
// francesa faci servir. Sense el pas 2, tot aquell canal arribava a
// pendents.json amb el camp buit —i és el camp amb què filtra el web i amb
// què el digest tria la llista de Brevo.
// ------------------------------------------------------------
function comarcaDeProduccio(valor, municipi, avisos) {
  var declarada = valorPermes(valor, COMARQUES);
  if (declarada !== '') {
    return declarada;
  }

  var deduida = comarques.obtenComarca(municipi);
  if (deduida !== '') {
    if (valor !== '') {
      avisos.push('La comarca «' + valor + '» no és cap de les cinc: la deduïxo del municipi («' + deduida + '»).');
    }
    return deduida;
  }

  if (valor !== '') {
    avisos.push('La comarca «' + valor + '» no és cap de les cinc i el municipi no és a la taula de comarques: queda buida.');
  } else if (municipi !== '') {
    avisos.push('Sense comarca, i el municipi «' + municipi + '» no és a la taula de comarques: queda buida.');
  }

  return '';
}

// ------------------------------------------------------------
// La categoria: primer es tradueix de l'anglès de la recerca, i el que en
// surti es passa igualment per valorPermes. Dos passos i no un, perquè una
// font que ja escrigui en català ha de poder passar directament.
// ------------------------------------------------------------
function categoriaDeProduccio(valor, avisos) {
  if (valor === '') {
    return '';
  }

  // Una font que ja fa servir el vocabulari bo passa tal com ve.
  var directa = valorPermes(valor, CATEGORIES);
  if (directa !== '') {
    return directa;
  }

  var clau = valor.toLowerCase().replace(/[’]/g, '\'').trim();
  var traduida = CATEGORIES_RECERCA[clau] || '';
  var categoria = valorPermes(traduida, CATEGORIES);

  if (categoria === '') {
    avisos.push('La categoria «' + valor + '» no té equivalent entre les tretze: queda buida.');
  }

  return categoria;
}

// ------------------------------------------------------------
// El municipi en la forma que es publica. La recerca el dona de tres maneres:
// bilingüe («Prades / Prada»), en francès sol («Sainte-Léocadie») o en català
// sol. Sempre en surt la forma catalana quan el poble és a la taula.
//
// Si no hi és, es passa tal com ve i s'avisa: val més publicar «Sainte-Marie»
// i que el curador ho corregeixi, que no pas inventar-se una forma catalana.
// ------------------------------------------------------------
function municipiDeProduccio(valor, avisos) {
  if (valor === '') {
    return '';
  }

  if (valor.indexOf(SEPARADOR_BILINGUE) !== -1) {
    var bandes = valor.split(SEPARADOR_BILINGUE);
    var primera = formaCatalana(bandes[0]);
    var segona = formaCatalana(bandes[1]);

    if (primera !== '') {
      return primera;
    }
    if (segona !== '') {
      return segona;
    }

    avisos.push('El municipi «' + valor + '» no és a la taula: em quedo la primera banda.');
    return bandes[0].trim();
  }

  var catalana = formaCatalana(valor);
  if (catalana !== '') {
    return catalana;
  }

  avisos.push('El municipi «' + valor + '» no és a la taula: el deixo tal com ve.');
  return valor;
}

// ------------------------------------------------------------
// La forma catalana d'un nom de poble, vingui en la llengua que vingui.
// Torna '' si el poble no és a la taula.
// ------------------------------------------------------------
function formaCatalana(nom) {
  var clau = pobles.normalitzaNom(nom);
  if (clau === '') {
    return '';
  }
  return MAPA_MUNICIPIS[clau] || '';
}

// ------------------------------------------------------------
// Munta el diccionari «forma normalitzada -> forma catalana que es publica».
// Les dues llengües hi apunten, i totes dues porten a la primera columna de
// la taula, que és la catalana.
// ------------------------------------------------------------
function construeixMapaDeMunicipis() {
  var mapa = {};

  for (var i = 0; i < MUNICIPIS_EQUIVALENTS.length; i++) {
    var parell = MUNICIPIS_EQUIVALENTS[i];
    mapa[pobles.normalitzaNom(parell[0])] = parell[0];
    mapa[pobles.normalitzaNom(parell[1])] = parell[0];
  }

  return mapa;
}

// El diccionari es munta un sol cop, en carregar el fitxer.
var MAPA_MUNICIPIS = construeixMapaDeMunicipis();


// --- Les peces: la metadada -------------------------------------------------

// ------------------------------------------------------------
// Tot el que NO pot anar als setze camps, agrupat per què és. Quatre blocs:
//
//   font        d'on surt i quan s'hi va mirar
//   confianca   què en diu qui ho ha investigat
//   llengua     en quina llengua venia cada cosa (senyals ja consumits, però
//               val la pena conservar-los: expliquen per què el títol o la
//               descripció han anat on han anat)
//   descartats  valors reals que producció no té on posar. NO són brossa:
//               són el preu, l'adreça, l'hora de final i l'enllaç de reserva,
//               que algun dia podrien fer falta i que aquí no es perden.
//   avisos      les notes que ha generat aquest mateix mapeig, per al curador
//
// ON VIU AIXÒ: encara no està decidit. Vegeu el §4 de
// docs/HANDOFF-MAPEIG-RECERCA.md. Aquesta funció no ho resol a posta.
// ------------------------------------------------------------
function metadadadesDeProduccio(brut, avisos) {
  return {
    font: {
      url: valorRecerca(brut, 'url_font'),
      data_publicacio: valorRecerca(brut, 'data_publicacio_font'),
      data_acces: valorRecerca(brut, 'data_acces'),
      citacio_literal: valorRecerca(brut, 'citacio_literal')
    },
    confianca: {
      nivell: valorRecerca(brut, 'nivell_confianca'),
      confirmacio: valorRecerca(brut, 'confirmacio_2026'),
      vitalitat: valorRecerca(brut, 'estat_vitalitat'),
      motiu_null: valorRecerca(brut, 'motiu_null')
    },
    llengua: {
      titol: valorRecerca(brut, 'llengua_nom_original'),
      descripcio: valorRecerca(brut, 'llengua_descripcio'),
      esdeveniment: valorRecerca(brut, 'llengua_esdeveniment')
    },
    descartats: {
      id_original: valorRecerca(brut, 'id'),
      dia_setmana_inici: valorRecerca(brut, 'dia_setmana_inici'),
      hora_fi: valorRecerca(brut, 'hora_fi'),
      adreca: valorRecerca(brut, 'adreca'),
      zona_cerca: valorRecerca(brut, 'zona_cerca'),
      preu: valorRecerca(brut, 'preu'),
      url_reserva: valorRecerca(brut, 'url_reserva'),
      clau_dedup: valorRecerca(brut, 'clau_dedup')
    },
    avisos: avisos
  };
}


// --- Les peces: neteja de valors --------------------------------------------

// ------------------------------------------------------------
// El valor net d'un camp de recerca. Tres coses es tracten igual, i és el
// detall que fa que aquest mapeig funcioni sobre les dades de debò: el camp
// que falta, el camp buit i el camp que porta la cadena literal "null".
//
// La recerca escriu "null" com a text —no és cap valor nul de JSON— i n'hi ha
// a onze camps dels trenta-un. Si no es tractés, producció acabaria amb
// municipis que diuen «null» i cartells amb l'URL «null».
// ------------------------------------------------------------
function valorRecerca(brut, camp) {
  var valor = valorNet(brut[camp]);

  if (valor === 'null' || valor === 'n/a' || valor === 'N/A') {
    return '';
  }

  return valor;
}

// ------------------------------------------------------------
// Qualsevol valor convertit a cadena retallada. Un valor que no sigui text
// —un número, un null de debò, un camp absent— és "".
// ------------------------------------------------------------
function valorNet(valor) {
  if (valor === undefined || valor === null) {
    return '';
  }
  if (typeof valor !== 'string') {
    return String(valor).trim();
  }
  return valor.trim();
}

// ------------------------------------------------------------
// Torna la fila amb els setze camps en l'ordre exacte de l'esquema i cap més.
// Que l'ordre de les claus d'un objecte no importi al codi no vol dir que no
// importi: pendents.json i events.json es llegeixen a ull i es comparen amb
// git diff, i una fila desordenada embruta totes dues coses.
// ------------------------------------------------------------
function ordenaSegonsEsquema(fila) {
  var ordenada = {};

  for (var i = 0; i < CAMPS_PRODUCCIO.length; i++) {
    var camp = CAMPS_PRODUCCIO[i];
    ordenada[camp] = valorNet(fila[camp]);
  }

  return ordenada;
}


// --- Còpies literals de les funcions compartides ----------------------------
// Són les mateixes de docs/arxiu-google/utils.gs, worker/worker.js,
// curador.html i eines/dedup-esdeveniments.js. Es copien, no s'importen: el
// projecte no té cap sistema de mòduls i totes les vies d'entrada han de
// donar l'id idèntic.

// ------------------------------------------------------------
// Còpia literal de valorPermes: torna el valor només si és a la llista
// permesa, i '' si no hi és.
// ------------------------------------------------------------
function valorPermes(valor, llistaPermesa) {
  if (llistaPermesa.indexOf(valor) === -1) {
    return '';
  }
  return valor;
}

// ------------------------------------------------------------
// Còpia literal de creaId: la data d'inici, un guió, i les tres primeres
// paraules del títol en minúscules i sense accents. Torna '' si no hi ha data.
// ------------------------------------------------------------
function creaId(dataInici, titol) {
  if (dataInici === '') {
    return '';
  }

  var text = titol.toLowerCase();
  text = text.normalize('NFD').replace(/[̀-ͯ]/g, '');
  text = text.replace(/['’]/g, '');
  text = text.replace(/[^a-z0-9]+/g, ' ');
  text = text.trim();

  if (text === '') {
    return dataInici;
  }

  var paraules = text.split(/\s+/);
  var paraulesCurtes = paraules.slice(0, 3);
  return dataInici + '-' + paraulesCurtes.join('-');
}


// --- El que surt d'aquest fitxer --------------------------------------------
// Només la funció: les peces de dins són seves i no les ha de cridar ningú.
// L'exportació és per a Node (eines/processa-lot.js), i no connecta res: el
// fitxer continua sense llegir ni escriure enlloc.

module.exports = {
  mapejaAProduccio: mapejaAProduccio
};


// --- Proves des del terminal ------------------------------------------------
// Tot el que ve a partir d'aquí és per poder exercitar la funció a mà. No
// forma part de la peça i no s'ha de copiar enlloc.

// ------------------------------------------------------------
// Un registre de recerca de prova: els trenta-un camps, tots amb la cadena
// "null" que escriu la recerca, i a sobre els que interessin al cas.
// ------------------------------------------------------------
function registreDeProva(extres) {
  var registre = {};

  for (var i = 0; i < CAMPS_RECERCA.length; i++) {
    registre[CAMPS_RECERCA[i]] = 'null';
  }

  if (extres) {
    var claus = Object.keys(extres);
    for (var j = 0; j < claus.length; j++) {
      registre[claus[j]] = extres[claus[j]];
    }
  }

  return registre;
}

// ------------------------------------------------------------
// Els casos. Cadascun comprova uns quants camps concrets del resultat, de
// manera que la bateria es pugui llegir com una taula del comportament pactat.
// ------------------------------------------------------------
function casosDeProva() {
  return [
    {
      nom: 'Els trenta-un camps plens (fila real del CSV de recerca)',
      entrada: registreDeProva({
        id: '2026-01-01-prades-grand-marche',
        nom_original: 'GRAND MARCHÉ DE PRADES — tous les mardis matin',
        llengua_nom_original: 'fr',
        nom_altra_llengua: 'El gran mercat de Prada',
        data_inici: '2026-01-01',
        dia_setmana_inici: 'jeudi',
        data_fi: '2026-12-31',
        hora_inici: '08:00',
        hora_fi: '13:00',
        lloc: 'Place de la République',
        adreca: 'Place de la République, 66500 Prades',
        municipi: 'Prades / Prada',
        zona_cerca: 'Conflent',
        comarca: 'Conflent',
        categoria: 'market',
        llengua_esdeveniment: 'fr',
        descripcio_original: 'Tous les mardis matin, le célèbre marché de Prades.',
        llengua_descripcio: 'fr',
        url_cartell: 'https://cdt66.media.tourinsoft.eu/upload/Marche-de-Prades.png',
        organitzador: 'Mairie de Prades',
        preu: 'gratuit',
        url_reserva: 'https://exemple.cat/reserva',
        url_font: 'https://www.tourisme-canigo.com/agenda/grand-marche-de-prades/',
        data_publicacio_font: '2026-07-01',
        data_acces: '2026-08-19',
        citacio_literal: 'Du 01/01/26 au 31/12/26',
        confirmacio_2026: 'Official page explicitly dates the 2026 edition.',
        estat_vitalitat: 'confirmat — liveness checked 2026-08-19',
        nivell_confianca: 'A',
        clau_dedup: 'prades-2026-01-01-marche',
        motiu_null: 'cap'
      }),
      espera: {
        id: '2026-01-01-el-gran-mercat',
        titol: 'El gran mercat de Prada',
        municipi: 'Prada',
        comarca: 'Conflent',
        categoria: 'Mercat',
        hora: '08:00',
        descripcio_ca: '',
        estat: 'pendent'
      }
    },
    {
      nom: 'Tot buit: els setze camps hi són igualment, tots ""',
      entrada: registreDeProva({}),
      espera: {
        id: '', titol: '', data_inici: '', municipi: '', comarca: '',
        categoria: '', descripcio_ca: '', descripcio_fr: '', imatge_url: '',
        estat: 'pendent'
      }
    },
    {
      nom: 'Registre buit del tot (ni tan sols els trenta-un camps)',
      entrada: {},
      espera: { id: '', titol: '', municipi: '', estat: 'pendent' }
    },
    {
      nom: 'Comarca fora de l\'enum: «Alta Cerdanya» -> es deduïx del municipi',
      entrada: registreDeProva({
        nom_original: 'Fira de Sallagosa', llengua_nom_original: 'ca',
        data_inici: '2026-05-10', comarca: 'Alta Cerdanya', municipi: 'Saillagouse'
      }),
      espera: { comarca: 'Cerdanya', municipi: 'Sallagosa', titol: 'Fira de Sallagosa' }
    },
    {
      nom: 'Sense comarca i amb municipi conegut: es deduïx (el cas de l\'ADT66)',
      entrada: registreDeProva({
        nom_original: 'Festa major', llengua_nom_original: 'ca',
        data_inici: '2026-07-20', comarca: '', municipi: 'ARLES-SUR-TECH'
      }),
      espera: { comarca: 'Vallespir', municipi: 'Arles de Tec', nota_curador: '' }
    },
    {
      nom: 'Sense comarca i amb municipi de fora de la taula: queda buida i avisa',
      // Narbona no és a cap de les cinc comarques i no hi serà mai. Aquest cas
      // feia servir MAURY fins al 31 d'agost de 2026, quan la Fenolleda va
      // passar sencera a Rosselló i el poble va deixar de valer com a exemple.
      entrada: registreDeProva({
        nom_original: 'Concert', llengua_nom_original: 'ca',
        data_inici: '2026-07-20', comarca: '', municipi: 'NARBONNE'
      }),
      espera: {
        comarca: '',
        municipi: 'NARBONNE',
        nota_curador: 'El municipi «NARBONNE» no és a la taula: el deixo tal com ve. ' +
          'Sense comarca, i el municipi «NARBONNE» no és a la taula de comarques: queda buida.'
      }
    },
    {
      nom: 'Categoria sense calaix entre les tretze: «sports» -> ""',
      entrada: registreDeProva({
        nom_original: 'Course de la Tour', llengua_nom_original: 'fr',
        data_inici: '2026-06-14', categoria: 'sports'
      }),
      espera: { categoria: '' }
    },
    {
      nom: 'Categoria traduïble: «exhibition» -> «Exposició»',
      entrada: registreDeProva({
        nom_original: 'Exposició de tardor', llengua_nom_original: 'ca',
        data_inici: '2026-10-02', categoria: 'exhibition'
      }),
      espera: { categoria: 'Exposició' }
    },
    {
      nom: 'Categoria ja en català: passa directament',
      entrada: registreDeProva({
        nom_original: 'Concert de tardor', llengua_nom_original: 'ca',
        data_inici: '2026-10-02', categoria: 'Música'
      }),
      espera: { categoria: 'Música' }
    },
    {
      nom: 'L\'id que porta el candidat es descarta i es reconstrueix',
      entrada: registreDeProva({
        id: 'ID-INVENTAT-PER-LA-RECERCA-9999',
        nom_original: 'Ball de gitanes', llengua_nom_original: 'ca',
        data_inici: '2026-09-14', municipi: 'Prats-de-Mollo-la-Preste'
      }),
      espera: { id: '2026-09-14-ball-de-gitanes', municipi: 'Prats de Molló' }
    },
    {
      nom: 'Descripció en francès: va a descripcio_fr i el català queda buit',
      entrada: registreDeProva({
        nom_original: 'Marché de Noël', llengua_nom_original: 'fr',
        data_inici: '2026-12-05',
        descripcio_original: 'Le marché de Noël du village.',
        llengua_descripcio: 'fr'
      }),
      espera: { descripcio_ca: '', descripcio_fr: 'Le marché de Noël du village.' }
    },
    {
      nom: 'Descripció en català: va a descripcio_ca i el francès queda buit',
      entrada: registreDeProva({
        nom_original: 'Mercat de Nadal', llengua_nom_original: 'ca',
        data_inici: '2026-12-05',
        descripcio_original: 'El mercat de Nadal del poble.',
        llengua_descripcio: 'ca'
      }),
      espera: { descripcio_ca: 'El mercat de Nadal del poble.', descripcio_fr: '' }
    },
    {
      nom: 'Títol francès sense versió catalana: passa tal qual i avisa',
      entrada: registreDeProva({
        nom_original: 'Fête de l\'ours', llengua_nom_original: 'fr',
        data_inici: '2026-02-14', municipi: 'Céret'
      }),
      espera: { titol: 'Fête de l\'ours', municipi: 'Ceret' }
    },
    {
      nom: 'Sense data d\'inici: l\'id queda buit i la resta passa igual',
      entrada: registreDeProva({
        nom_original: 'Exposició permanent', llengua_nom_original: 'ca',
        municipi: 'Perpinyà / Perpignan', categoria: 'exhibition'
      }),
      espera: { id: '', titol: 'Exposició permanent', municipi: 'Perpinyà', categoria: 'Exposició' }
    },
    {
      nom: 'La cadena "null" de la recerca no arriba mai a producció',
      entrada: registreDeProva({
        nom_original: 'Concert', llengua_nom_original: 'ca',
        data_inici: '2026-07-04', url_cartell: 'null', organitzador: 'null',
        lloc: 'null', hora_inici: 'null'
      }),
      espera: { imatge_url: '', associacio: '', lloc: '', hora: '' }
    },
    {
      nom: 'Una fila sense cap problema deixa nota_curador buida',
      entrada: registreDeProva({
        nom_original: 'Mercat de Nadal', llengua_nom_original: 'ca',
        data_inici: '2026-12-05', municipi: 'Ceret', comarca: 'Vallespir',
        categoria: 'market'
      }),
      espera: { nota_curador: '', municipi: 'Ceret', categoria: 'Mercat' }
    },
    {
      nom: 'Els avisos del mapeig viatgen dins de la fila, a nota_curador',
      entrada: registreDeProva({
        nom_original: 'Trail des Cimes', llengua_nom_original: 'fr',
        data_inici: '2026-06-14', municipi: 'Sainte-Léocadie',
        categoria: 'obstacle race', comarca: 'Alta Cerdanya',
        descripcio_original: 'Course en montagne.', llengua_descripcio: 'fr'
      }),
      espera: {
        municipi: 'Santa Llocaia',
        comarca: 'Cerdanya',
        categoria: '',
        nota_curador: 'El títol ve en «fr» i no hi ha versió catalana: cal traduir-lo. ' +
          'Descripció en francès: falta la traducció catalana. ' +
          'La comarca «Alta Cerdanya» no és cap de les cinc: la deduïxo del municipi («Cerdanya»). ' +
          'La categoria «obstacle race» no té equivalent entre les tretze: queda buida.'
      }
    }
  ];
}

// ------------------------------------------------------------
// Passa la bateria i n'escriu el resultat al terminal.
// ------------------------------------------------------------
function provaBateria() {
  var casos = casosDeProva();
  var fallades = 0;

  for (var i = 0; i < casos.length; i++) {
    var cas = casos[i];
    var resultat = mapejaAProduccio(cas.entrada);
    var problemes = comparaEsperat(resultat.fila, cas.espera);

    // Comprovacions que valen per a tots els casos, no només per als seus.
    var claus = Object.keys(resultat.fila);
    if (claus.join('|') !== CAMPS_PRODUCCIO.join('|')) {
      problemes.push('els camps no són els setze de l\'esquema, en ordre');
    }
    for (var k = 0; k < claus.length; k++) {
      if (typeof resultat.fila[claus[k]] !== 'string') {
        problemes.push(claus[k] + ' no és una cadena');
      }
      // La cadena literal "null" de la recerca no ha d'arribar MAI a
      // producció, vingui del camp que vingui. registreDeProva() omple els 31
      // camps amb "null", o sigui que aquesta comprovació els cobreix tots.
      if (resultat.fila[claus[k]] === 'null' || resultat.fila[claus[k]] === 'n/a') {
        problemes.push(claus[k] + ' ha arribat a producció amb el text «' + resultat.fila[claus[k]] + '»');
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}T/.test(resultat.fila.data_entrada)) {
      problemes.push('data_entrada no és una marca ISO');
    }
    if (resultat.metadadades.descartats.id_original !== '' &&
        resultat.fila.id === resultat.metadadades.descartats.id_original) {
      problemes.push('l\'id de la recerca ha sobreviscut a producció');
    }

    if (problemes.length > 0) {
      fallades += 1;
    }

    console.log((problemes.length === 0 ? 'BÉ  ' : 'MAL ') + cas.nom);
    for (var p = 0; p < problemes.length; p++) {
      console.log('     ! ' + problemes[p]);
    }
    if (resultat.metadadades.avisos.length > 0) {
      for (var a = 0; a < resultat.metadadades.avisos.length; a++) {
        console.log('     · ' + resultat.metadadades.avisos[a]);
      }
    }
  }

  console.log('');
  console.log(casos.length + ' casos, ' + fallades + ' fallades.');
  if (fallades > 0) {
    process.exitCode = 1;
  }
}

// ------------------------------------------------------------
// Compara els camps que un cas vigila amb el que ha sortit de debò.
// ------------------------------------------------------------
function comparaEsperat(fila, espera) {
  var problemes = [];
  var claus = Object.keys(espera);

  for (var i = 0; i < claus.length; i++) {
    var camp = claus[i];
    if (fila[camp] !== espera[camp]) {
      problemes.push(camp + ': esperava «' + espera[camp] + '», tinc «' + fila[camp] + '»');
    }
  }

  return problemes;
}

// ------------------------------------------------------------
// Passa un CSV de recerca sencer pel mapeig i n'escriu un informe. No escriu
// cap fitxer: només serveix per veure què faria amb dades de debò.
// ------------------------------------------------------------
function informeSobreCsv(cami) {
  var fs = require('fs');
  var brut = fs.readFileSync(cami, 'utf8').replace(/^﻿/, '');
  var files = parseCsv(brut).filter(function (fila) { return fila.length > 1; });
  var capcalera = files[0];

  console.log('Fitxer: ' + cami);
  console.log('  columnes  ' + capcalera.length + (capcalera.length === CAMPS_RECERCA.length ? '' : '  (!! no són els ' + CAMPS_RECERCA.length + ' de l\'esquema de recerca)'));
  console.log('  files     ' + (files.length - 1));
  console.log('');

  var buits = {};
  for (var c = 0; c < CAMPS_PRODUCCIO.length; c++) {
    buits[CAMPS_PRODUCCIO[c]] = 0;
  }
  var avisos = {};
  var idRepetits = {};

  for (var i = 1; i < files.length; i++) {
    var registre = {};
    for (var j = 0; j < capcalera.length; j++) {
      registre[capcalera[j]] = files[i][j];
    }

    var resultat = mapejaAProduccio(registre);

    for (var k = 0; k < CAMPS_PRODUCCIO.length; k++) {
      if (resultat.fila[CAMPS_PRODUCCIO[k]] === '') {
        buits[CAMPS_PRODUCCIO[k]] += 1;
      }
    }

    idRepetits[resultat.fila.id] = (idRepetits[resultat.fila.id] || 0) + 1;

    for (var a = 0; a < resultat.metadadades.avisos.length; a++) {
      var tipus = resultat.metadadades.avisos[a].split(':')[0];
      avisos[tipus] = (avisos[tipus] || 0) + 1;
    }
  }

  console.log('  camps de producció que queden buits:');
  for (var b = 0; b < CAMPS_PRODUCCIO.length; b++) {
    console.log('    ' + String(buits[CAMPS_PRODUCCIO[b]]).padStart(4) + '  ' + CAMPS_PRODUCCIO[b]);
  }

  console.log('');
  console.log('  avisos per al curador:');
  var tipusAvisos = Object.keys(avisos).sort(function (x, y) { return avisos[y] - avisos[x]; });
  for (var t = 0; t < tipusAvisos.length; t++) {
    console.log('    ' + String(avisos[tipusAvisos[t]]).padStart(4) + '  ' + tipusAvisos[t]);
  }

  var repetits = Object.keys(idRepetits).filter(function (id) {
    return id !== '' && idRepetits[id] > 1;
  });
  console.log('');
  console.log('  id repetits  ' + repetits.length + ' (regla de 3 paraules de creaId, ja sabuda)');
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

// ------------------------------------------------------------
// Punt d'entrada del terminal: sense arguments, la bateria; amb un camí de
// CSV, l'informe sobre aquell fitxer.
// ------------------------------------------------------------
function principal() {
  var cami = process.argv[2];

  if (cami) {
    informeSobreCsv(cami);
    return;
  }

  provaBateria();
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    process.argv[1].indexOf('mapeja-recerca') !== -1) {
  principal();
}
