// ---------------------------------------------------------------------------
// PROVES EN SEC DEL PAS 7 BIS — cap crida real a Gemini, cap escriptura.
//
// El flux de l'ADT66 es baixa UN sol cop i es desa en memòria cau al
// directori d'aquest fitxer; totes les passades el llegeixen d'allà, de manera
// que les vuit proves corren de seguida i sempre sobre el mateix lot.
// ---------------------------------------------------------------------------

var fs = require('fs');
var os = require('os');
var path = require('path');

// L'arrel del repositori és el directori de sobre d'aquest fitxer: així les
// proves corren des d'on sigui i no porten cap ruta de ningú a dins.
var ARREL = path.join(__dirname, '..');

// La memòria cau del flux són 4,5 MB de JSON i va FORA del repositori, al
// directori temporal del sistema —mai a eines/, que és codi. Esborra-la per
// tornar a baixar el flux.
var CAU = path.join(os.tmpdir(), 'quefas-flux-adt66.json');

var adt66 = require(path.join(ARREL, 'eines', 'adt66-sincronitza.js'));

var problemes = [];

function comprova(condicio, que) {
  if (condicio) {
    console.log('  OK    ' + que);
  } else {
    console.log('  FALLA ' + que);
    problemes.push(que);
  }
}

// --- La memòria cau del flux ------------------------------------------------

async function preparaFlux() {
  if (fs.existsSync(CAU)) {
    console.log('flux de la memòria cau: ' + CAU);
    return JSON.parse(fs.readFileSync(CAU, 'utf8'));
  }

  console.log('baixant el flux una sola vegada...');
  var resposta = await adt66.sincronitzaADT66('');
  fs.writeFileSync(CAU, JSON.stringify(resposta.ofertes), 'utf8');
  return resposta.ofertes;
}

// --- Les crides simulades ---------------------------------------------------

// Torna sempre les tres claus plenes. Serveix per veure què fa el codi quan el
// model respon bé, i també per comprovar que les descripcions NO s'escriuen
// quan l'oferta no porta text de font.
function cridaBona(fila) {
  return Promise.resolve({
    titol: 'CATALÀ: ' + fila.titol,
    descripcio_ca: 'Descripció catalana simulada, dues frases. I la segona.',
    descripcio_fr: 'Description française simulée, deux phrases. Et la seconde.'
  });
}

// Peta sempre.
function cridaQuePeta() {
  return Promise.reject(new Error('429 RESOURCE_EXHAUSTED simulat'));
}

// --- Les passades -----------------------------------------------------------

function passada(ofertes, opcions) {
  adt66.sincronitzaADT66 = function () {
    return Promise.resolve({ ofertes: ofertes });
  };

  var sync = require(path.join(ARREL, 'eines', 'sincronitza-programada.js'));
  opcions.enSec = true;
  opcions.avui = opcions.avui || '2026-09-04';
  opcions.pausaMs = (opcions.pausaMs === undefined) ? 0 : opcions.pausaMs;
  return sync.sincronitzaProgramada(opcions);
}

// Ordena dates com ho fa comparaPerDataInici() del fitxer que es prova: una
// data buida o mal formada va al FINAL, no al davant com la posa el sort() per
// omissió.
function perImminencia(a, b) {
  var da = /^\d{4}-\d{2}-\d{2}$/.test(a) ? a : '9999-99-99';
  var db = /^\d{4}-\d{2}-\d{2}$/.test(b) ? b : '9999-99-99';
  if (da < db) { return -1; }
  if (da > db) { return 1; }
  return 0;
}

function totesLesNotes(files, tros) {
  var quantes = 0;
  for (var i = 0; i < files.length; i++) {
    if (files[i].nota_curador.indexOf(tros) !== -1) {
      quantes++;
    }
  }
  return quantes;
}

// --- P9 a P12. ELS NOMS PROPIS ---------------------------------------------
// Quatre casos de vora afegits el 5 de setembre de 2026, arran d'una fila real
// del camí de correu on «punt de trobada a La Menera» va sortir en francès com
// a «rendez-vous à Le Tech»: el model havia tractat un topònim com si fos
// vocabulari, i Le Tech és un altre poble.
//
// NO PASSEN PEL FLUX i no criden sincronitzaProgramada(): ataquen tradueixLot()
// amb files fetes a mà, perquè el cas de vora és una FORMA de fila concreta i
// buscar-la dins de les 712 candidates del dia seria deixar la prova a mans del
// que hi hagi al flux aquella setmana.
//
// EL QUE PROVEN, I EL QUE NO. Amb un model simulat no es pot provar que el
// model obeeixi: això només ho diu una crida de debò. Proven l'altra meitat, i
// és la meitat que es podria trencar sense que ningú se n'adonés:
//
//   - que la canonada copia el que diu el model LLETRA PER LLETRA i no li toca
//     cap nom propi pel camí (P9, P10, P11);
//   - que si el model s'equivoca, la canonada no ho tapa ni ho arregla —o
//     sigui que l'única defensa és el text del prompt (P9 bis);
//   - i que aquest text del prompt hi és de debò i al lloc que li toca (P12),
//     que és l'única prova de les cinc que falla si algú esborra la regla.

// ------------------------------------------------------------
// Una fila de la cua com la que deixa mapejaOfertaADT66(): els disset camps,
// tots cadena. `canvis` en sobreescriu els que interessin al cas.
// ------------------------------------------------------------
function filaDeProva(canvis) {
  var fila = {
    id: '2026-09-20-prova',
    titol: '',
    data_inici: '2026-09-20',
    data_fi: '2026-09-20',
    hora: '',
    lloc: '',
    municipi: '',
    comarca: 'Vallespir',
    categoria: 'Vida associativa',
    descripcio_ca: '',
    descripcio_fr: '',
    associacio: '',
    imatge_url: '',
    font_url: '',
    estat: 'pendent',
    data_entrada: '2026-09-05T08:00:00.000Z',
    nota_curador: '[ADT66 id: PROVA0001]'
  };

  var noms = Object.keys(canvis);
  for (var i = 0; i < noms.length; i++) {
    fila[noms[i]] = canvis[noms[i]];
  }

  return fila;
}

// ------------------------------------------------------------
// Passa una sola fila per tradueixLot() amb un model simulat que respon sempre
// el mateix. Torna { fila, informe }.
// ------------------------------------------------------------
async function traduccioDUnaFila(fila, resposta) {
  var sync = require(path.join(ARREL, 'eines', 'sincronitza-programada.js'));

  var resultat = await sync.tradueixLot([fila], {
    cridaGemini: function () { return Promise.resolve(resposta); },
    motiuSenseTraduccio: '',
    pressupost: 10,
    pausaMs: 0
  });

  return { fila: resultat.files[0], informe: resultat.informe };
}

// ------------------------------------------------------------
// Els cinc casos, un darrere l'altre.
// ------------------------------------------------------------
async function casosDeNomsPropis() {

  // --- P9. Un topònim al mig d'una frase ----------------------------------
  console.log('');
  console.log('P9. topònim al mig d\'una frase: el model el copia bé');
  var p9 = await traduccioDUnaFila(
    filaDeProva({
      titol: 'RANDONNÉE ACCOMPAGNÉE',
      municipi: 'La Menera',
      descripcio_fr: 'Randonnée accompagnée en montagne. Le point de rendez-vous est fixé à La Menera, devant la mairie.'
    }),
    {
      titol: 'Excursió acompanyada',
      descripcio_ca: 'Una excursió acompanyada per la muntanya. El punt de trobada és a La Menera, davant de l\'ajuntament.',
      descripcio_fr: 'Une randonnée accompagnée en montagne. Le point de rendez-vous est à La Menera, devant la mairie.'
    }
  );
  console.log('    ca: ' + p9.fila.descripcio_ca);
  console.log('    fr: ' + p9.fila.descripcio_fr);
  comprova(p9.informe.traduides === 1, 'la fila compta com a traduïda');
  comprova(p9.fila.descripcio_ca.indexOf('La Menera') !== -1,
    'el topònim es manté a la descripció catalana');
  comprova(p9.fila.descripcio_fr.indexOf('La Menera') !== -1,
    'i també a la francesa, que és on es va perdre a la fila real');
  comprova(p9.fila.descripcio_fr.indexOf('Le Tech') === -1,
    'i enlloc no hi surt «Le Tech»');
  comprova(p9.fila.municipi === 'La Menera',
    'el camp municipi es queda com era: el model no el veu ni el toca');

  // --- P9 bis. Si el model s'equivoca, la canonada no ho arregla ----------
  console.log('');
  console.log('P9 bis. el model tradueix el topònim: la canonada no ho tapa');
  var p9b = await traduccioDUnaFila(
    filaDeProva({
      titol: 'RANDONNÉE ACCOMPAGNÉE',
      municipi: 'La Menera',
      descripcio_fr: 'Le point de rendez-vous est fixé à La Menera.'
    }),
    {
      titol: 'Excursió acompanyada',
      descripcio_ca: 'El punt de trobada és a Le Tech.',
      descripcio_fr: 'Le point de rendez-vous est fixé à Le Tech.'
    }
  );
  comprova(p9b.fila.descripcio_fr.indexOf('Le Tech') !== -1,
    'l\'error passa sencer: aquí no hi ha cap xarxa de seguretat de codi');
  comprova(p9b.informe.traduides === 1,
    'i la fila compta com a traduïda igualment, amb l\'error a dins');
  comprova(p9b.fila.nota_curador.indexOf('Comprova\'ls abans de publicar') !== -1,
    'l\'única cosa que hi posa el codi és l\'avís al curador');

  // --- P10. Un títol que és un nom propi ----------------------------------
  console.log('');
  console.log('P10. títol que és nom propi: passa lletra per lletra');
  var p10 = await traduccioDUnaFila(
    filaDeProva({
      titol: 'RIPAILLES SONORES',
      municipi: 'Ceret',
      descripcio_fr: 'Le festival revient pour une nouvelle édition avec des concerts en plein air.'
    }),
    {
      titol: 'Ripailles Sonores',
      descripcio_ca: 'El festival Ripailles Sonores torna amb una nova edició. Hi haurà concerts a l\'aire lliure.',
      descripcio_fr: 'Le festival Ripailles Sonores revient pour une nouvelle édition. Il y aura des concerts en plein air.'
    }
  );
  console.log('    titol: ' + p10.fila.titol);
  comprova(p10.fila.titol === 'Ripailles Sonores',
    'el títol s\'escriu exactament com l\'ha dit el model, caixa inclosa');
  comprova(p10.fila.descripcio_ca.indexOf('Ripailles Sonores') !== -1,
    'i el nom del festival es manté dins de la frase catalana');
  comprova(p10.informe.traduides === 1, 'compta com a traduïda');

  // --- P11. Un títol que és una frase descriptiva -------------------------
  console.log('');
  console.log('P11. títol que és frase descriptiva: sí que es tradueix');
  var p11 = await traduccioDUnaFila(
    filaDeProva({
      titol: 'MARCHÉ DE PRODUCTEURS DE PAYS',
      municipi: 'Prada',
      descripcio_fr: 'Les producteurs du canton proposent leurs légumes, fromages et charcuteries sur la place.'
    }),
    {
      titol: 'Mercat de productors del país',
      descripcio_ca: 'Els productors del cantó porten verdures, formatges i embotits a la plaça. El mercat és obert a tothom.',
      descripcio_fr: 'Les producteurs du canton apportent légumes, fromages et charcuteries sur la place. Le marché est ouvert à tous.'
    }
  );
  console.log('    titol: ' + p11.fila.titol);
  comprova(p11.fila.titol === 'Mercat de productors del país',
    'el títol traduït s\'escriu tal com arriba, sense retocs');
  comprova(p11.fila.titol.indexOf('MARCHÉ') === -1,
    'i el francès de sortida no hi queda enganxat');
  comprova(p11.informe.traduides === 1, 'compta com a traduïda');

  // --- P12. La regla és al prompt, i al lloc que li toca ------------------
  // L'única de les cinc que falla si algú esborra la regla: les altres quatre
  // proven la canonada, que de noms propis no en sap res.
  console.log('');
  console.log('P12. la regla dels noms propis és dins del prompt');
  var codi = fs.readFileSync(
    path.join(ARREL, 'eines', 'sincronitza-programada.js'), 'utf8');
  var inici = codi.indexOf('var PROMPT_TRADUCCIO');
  var tallDelPrompt = codi.slice(inici, codi.indexOf('FITXA:', inici));

  comprova(inici !== -1, 'PROMPT_TRADUCCIO existeix');
  comprova(tallDelPrompt.indexOf('ELS NOMS PROPIS NO ES TRADUEIXEN MAI') !== -1,
    'el bloc de la regla hi és');
  comprova(tallDelPrompt.indexOf('«La Menera» NO és «Le Tech»') !== -1,
    'amb l\'exemple negatiu explícit de La Menera i Le Tech');
  comprova(tallDelPrompt.indexOf('Ripailles Sonores') !== -1,
    'i amb l\'exemple del nom d\'esdeveniment que sembla descriptiu');
  comprova(tallDelPrompt.toLowerCase().indexOf('topònims') !== -1 &&
    tallDelPrompt.indexOf('festival') !== -1 &&
    tallDelPrompt.indexOf('entitat') !== -1,
    'la regla nomena topònims, festivals i entitats');
  comprova(tallDelPrompt.indexOf('EL CAMP MUNICIPI MANA') !== -1 &&
    tallDelPrompt.indexOf('«Tuïr»') !== -1,
    'i que la forma del camp MUNICIPI mana sobre la del text');
  comprova(tallDelPrompt.indexOf('«saveurs del terroir»') !== -1 &&
    tallDelPrompt.indexOf('«banyulenques»') !== -1,
    'les dues correccions de llengua hi són amb els exemples del run');
  comprova(
    tallDelPrompt.indexOf('ELS NOMS PROPIS NO ES TRADUEIXEN MAI') <
      tallDelPrompt.indexOf('QUAN NO HI HA PROU MATÈRIA'),
    'i va abans de la regla de no inventar, que continua sent l\'última'
  );
}


// --- P13 a P16. LES QUATRE REGLES DEL 5 DE SETEMBRE DE 2026 -----------------
// El canvi de model (3.5 -> 3.1) va guanyar llengua i va perdre compliment de
// regles. El run de 5 va ensenyar quatre vicis, i els quatre es corregeixen des
// del prompt: municipi enganxat al títol i a la descripció, francès genèric pres
// per nom propi, descripció parafrasejada del títol, i to de cartell.
//
// EL QUE PROVEN, I EL QUE NO. Igual que P12: amb un model simulat no es pot
// provar que el model obeeixi —això només ho diu una crida de debò, i per això
// hi ha els runs de 5 al costat d'aquest fitxer. El que proven és que la regla
// és escrita, amb els seus exemples reals, i al lloc que li toca; i, on hi ha
// alguna cosa de codi a trencar, que el codi la sosté.

// ------------------------------------------------------------
// El tros del fitxer que va de `var PROMPT_TRADUCCIO` fins a la línia `FITXA:`.
// És el text que veurà el model, comentaris de damunt exclosos.
// ------------------------------------------------------------
function trosDelPrompt() {
  var codi = fs.readFileSync(
    path.join(ARREL, 'eines', 'sincronitza-programada.js'), 'utf8');
  var inici = codi.indexOf('var PROMPT_TRADUCCIO');
  return codi.slice(inici, codi.indexOf('FITXA:', inici));
}

// ------------------------------------------------------------
// El tros del fitxer que construeix la fitxa que s'envia al model. Sense
// MUNICIPI a la fitxa, la regla «EL CAMP MUNICIPI MANA» no mana res.
// ------------------------------------------------------------
function trosDeLaFitxa() {
  var codi = fs.readFileSync(
    path.join(ARREL, 'eines', 'sincronitza-programada.js'), 'utf8');
  var inici = codi.indexOf('async function demanaTraduccioGemini');
  return codi.slice(inici, codi.indexOf('var cos = {', inici));
}

// ------------------------------------------------------------
// Les quatre regles, una darrere l'altra.
// ------------------------------------------------------------
async function casosDeLesQuatreRegles() {
  var p = trosDelPrompt();

  // --- P13. El municipi és context, no matèria ----------------------------
  console.log('');
  console.log('P13. el municipi: bloc propi, les dues cares i els dos exemples reals');
  comprova(p.indexOf('EL MUNICIPI ÉS CONTEXT, NO MATÈRIA') !== -1,
    'el bloc del municipi hi és, amb títol propi');
  comprova(p.indexOf('EL CAMP MUNICIPI MANA') !== -1 && p.indexOf('«Tuïr»') !== -1,
    'CARA 1: la forma del camp mana sobre la del text');
  comprova(p.indexOf('SI EL TEXT ORIGINAL NO ESMENTA EL POBLE') !== -1,
    'CARA 2: si el text no diu el poble, la descripció tampoc');
  comprova(p.indexOf('les entitats locals de Sureda') !== -1,
    'amb l\'exemple negatiu literal de Sureda, del run del 5 de setembre');
  comprova(p.indexOf('AL TÍTOL EL MUNICIPI NO HI SURT MAI') !== -1,
    'CARA 3: al títol el municipi no hi surt mai');
  comprova(p.indexOf('«Fòrum de les associacions de Tuïr»') !== -1,
    'amb l\'exemple negatiu literal de Tuïr, del mateix run');
  comprova(
    p.indexOf('EL MUNICIPI ÉS CONTEXT, NO MATÈRIA') <
      p.indexOf('ELS NOMS PROPIS NO ES TRADUEIXEN MAI'),
    'i va abans del bloc dels noms propis, que hi remet'
  );

  var fitxa = trosDeLaFitxa();
  comprova(fitxa.indexOf('MUNICIPI: ') !== -1 && fitxa.indexOf('COMARCA: ') !== -1,
    'i la fitxa que s\'envia porta MUNICIPI i COMARCA de debò: la regla té què manar');

  // --- P14. La frontera del que és nom propi ------------------------------
  console.log('');
  console.log('P14. nom propi: les dues bandes de la frontera');
  comprova(p.indexOf('ÉS NOM PROPI, I ES COPIA') !== -1 &&
    p.indexOf('identifica una entitat concreta i té nom batejat') !== -1,
    'BANDA 1: el criteri del que sí que és nom propi hi és escrit');
  comprova(p.indexOf('«Festival Lyrique des Pays Catalans»') !== -1 &&
    p.indexOf('«Ripailles Sonores»') !== -1,
    'amb els dos exemples de nom batejat');
  comprova(p.indexOf('NO ÉS NOM PROPI') !== -1 &&
    p.indexOf('«Forum des Associations»') !== -1 &&
    p.indexOf('«Marché Hebdomadaire»') !== -1,
    'BANDA 2: el francès genèric amb majúscules no ho és, amb els seus exemples');
  comprova(p.indexOf('El Fòrum des Associations Thuir') !== -1,
    'i l\'exemple negatiu literal, tal com va sortir al run');
  comprova(p.indexOf('EN CAS DE DUBTE ENTRE LES DUES, TRADUEIX') !== -1,
    'i la regla de desempat: en cas de dubte, tradueix');

  // El codi no arregla res d'això, igual que a P9 bis: la defensa és el prompt.
  var p14 = await traduccioDUnaFila(
    filaDeProva({
      titol: 'FORUM DES ASSOCIATIONS',
      municipi: 'Tuïr',
      descripcio_fr: 'Les clubs sportifs et culturels présentent leurs activités.'
    }),
    {
      titol: 'Fòrum de les associacions',
      descripcio_ca: 'El Fòrum des Associations Thuir permet conèixer els clubs.',
      descripcio_fr: 'Le Forum des Associations Thuir permet de connaître les clubs.'
    }
  );
  comprova(p14.fila.descripcio_ca.indexOf('des Associations Thuir') !== -1,
    'el francès sense traduir passa sencer: aquí tampoc no hi ha xarxa de codi');
  comprova(p14.informe.traduides === 1,
    'i la fila compta com a traduïda igualment, amb el francès a dins');

  // --- P15. No inventar: el títol no és matèria ---------------------------
  console.log('');
  console.log('P15. no inventar: el títol no és matèria');
  comprova(p.indexOf('EL TÍTOL NO ÉS MATÈRIA') !== -1,
    'la regla diu que el títol NO és matèria per a la descripció');
  comprova(p.indexOf('Repli au gymnase en cas de mauvais temps') !== -1 &&
    p.indexOf('FORUM DES ASSOCIATIONS ET ACCUEIL DES NOUVEAUX ARRIVANTS') !== -1,
    'amb el cas de Sureda sencer, títol i text, com a exemple negatiu literal');
  comprova(p.indexOf('La resposta bona té descripcio_ca i descripcio_fr totes dues buides') !== -1,
    'i diu quina és la resposta bona: les dues descripcions buides');
  comprova(
    p.indexOf('QUAN NO HI HA PROU MATÈRIA') > p.indexOf('ELS NOMS PROPIS NO ES TRADUEIXEN MAI') &&
    p.indexOf('QUAN NO HI HA PROU MATÈRIA') > p.indexOf('EL TO ÉS INFORMATIU'),
    'i continua sent l\'última regla del prompt'
  );

  // La fila de Sureda tal qual: si el model declina, la canonada l'encua crua.
  var p15 = await traduccioDUnaFila(
    filaDeProva({
      titol: 'FORUM DES ASSOCIATIONS ET ACCUEIL DES NOUVEAUX ARRIVANTS',
      municipi: 'Sureda',
      descripcio_fr: 'Repli au gymnase en cas de mauvais temps'
    }),
    {
      titol: 'Fòrum d\'associacions i benvinguda als nouvinguts',
      descripcio_ca: '',
      descripcio_fr: ''
    }
  );
  comprova(p15.informe.senseMateria === 1 && p15.informe.traduides === 0,
    'declinar-la compta com a DECLINADA pel model, no com a traducció');
  comprova(p15.fila.descripcio_ca === '',
    'la descripció catalana es queda buida: no se n\'inventa cap');
  comprova(p15.fila.descripcio_fr === 'Repli au gymnase en cas de mauvais temps',
    'i la francesa es queda amb el text de font sencer, que és entrar crua');
  comprova(p15.fila.titol === 'FORUM DES ASSOCIATIONS ET ACCUEIL DES NOUVEAUX ARRIVANTS',
    'la fila entra crua, títol francès inclòs: mitja fitxa no s\'escriu');

  // --- P16. El to -----------------------------------------------------------
  console.log('');
  console.log('P16. el to: informatiu, mai publicitari');
  comprova(p.indexOf('EL TO ÉS INFORMATIU, MAI PUBLICITARI') !== -1,
    'el bloc del to hi és, amb títol propi');
  comprova(p.indexOf('Cap exclamació, i cap imperatiu dirigit al lector') !== -1,
    'i diu les dues coses: cap exclamació i cap imperatiu al lector');
  comprova(p.indexOf('«Vine a conèixer les associacions banyulenques»') !== -1 &&
    p.indexOf('«descobreix les activitats que proposen per al nou curs»') !== -1,
    'amb les dues frases literals del run com a exemples negatius');
  comprova(
    p.indexOf('EL CATALÀ HA DE SER CATALÀ') < p.indexOf('EL TO ÉS INFORMATIU') &&
      p.indexOf('EL TO ÉS INFORMATIU') <
        p.indexOf('ELS NOMS PROPIS NO ES TRADUEIXEN MAI'),
    'i va aviat: darrere el bloc de llengua i abans del dels noms propis'
  );
  // Del to no se n'hi pot provar res més: cap línia de codi no el mira, i la
  // comprovació de debò és llegir el run de 5 que hi ha al costat.
}


async function principal() {
  var ofertes = await preparaFlux();
  console.log('ofertes al lot: ' + ofertes.length);
  console.log('');

  // --- P1. Tot es tradueix: la línia de base -------------------------------
  console.log('P1. pressupost folgat, crida que va bé sempre');
  var p1 = await passada(ofertes, { pressupost: 100000, cridaGemini: cridaBona });
  var candidates = p1.candidates;
  console.log('    candidates=' + candidates +
    '  crides=' + p1.traducio.crides +
    '  traduides=' + p1.traducio.traduides +
    '  nomesTitol=' + p1.traducio.nomesTitol +
    '  fallades=' + p1.traducio.fallades +
    '  senseMateria=' + p1.traducio.senseMateria +
    '  retallades=' + p1.traducio.retalladesPerPressupost);

  comprova(p1.noves.length === candidates, 'amb pressupost folgat s\'escriuen totes les candidates');
  comprova(p1.traducio.crides === candidates, 'una crida per fila, ni una més');
  comprova(p1.traducio.retalladesPerPressupost === 0, 'cap fila retallada pel pressupost');
  comprova(
    p1.traducio.traduides + p1.traducio.nomesTitol + p1.traducio.fallades +
      p1.traducio.senseMateria === candidates,
    'els quatre recomptes sumen les candidates'
  );
  comprova(p1.escrit === false, 'en sec no s\'ha escrit res');

  // Les files sense text de font: cap descripció, ni la que ha tornat el model.
  var senseText = 0;
  var ambDescripcioIndeguda = 0;
  for (var i = 0; i < p1.noves.length; i++) {
    var fila = p1.noves[i];
    if (fila.nota_curador.indexOf('L\'oferta no porta cap text descriptiu') !== -1) {
      senseText++;
      if (fila.descripcio_ca !== '' || fila.descripcio_fr !== '') {
        ambDescripcioIndeguda++;
      }
      if (fila.titol.indexOf('CATALÀ: ') !== 0) {
        ambDescripcioIndeguda++;
      }
    }
  }
  console.log('    files sense text de font: ' + senseText);
  comprova(senseText === p1.traducio.nomesTitol, 'l\'avís de «només el títol» hi és a totes');
  comprova(senseText === 8, 'són 8, les mesurades al sondeig');
  comprova(ambDescripcioIndeguda === 0, 'cap descripció inventada a les files sense text');

  // Les traduïdes porten l'avís dels tres camps i el text del model.
  comprova(
    totesLesNotes(p1.noves, 'Títol i descripcions escrits per un model') === p1.traducio.traduides,
    'l\'avís de traducció hi és a totes les traduïdes'
  );
  var ambTagDavant = 0;
  for (var j = 0; j < p1.noves.length; j++) {
    if (p1.noves[j].nota_curador.indexOf('[ADT66 id:') === 0) {
      ambTagDavant++;
    }
  }
  comprova(ambTagDavant === candidates, 'el tag [ADT66 id: …] continua al davant de tot');

  var dataInicials = [];
  for (var k = 0; k < p1.noves.length; k++) {
    dataInicials.push(p1.noves[k].data_inici);
  }

  // --- P2. El pressupost talla on toca ------------------------------------
  console.log('');
  console.log('P2. pressupost=25');
  var p2 = await passada(ofertes, { pressupost: 25, cridaGemini: cridaBona });
  console.log('    escrites=' + p2.noves.length +
    '  crides=' + p2.traducio.crides +
    '  retallades=' + p2.traducio.retalladesPerPressupost);
  comprova(p2.noves.length === 25, 'el pressupost talla a 25 files escrites');
  comprova(p2.traducio.crides === 25, 'i a 25 crides');
  comprova(p2.traducio.retalladesPerPressupost === candidates - 25,
    'la resta surt com a retallada pel pressupost, no com a descartada');

  // I són les 25 més imminents.
  var ordenades = dataInicials.slice().sort(perImminencia);
  var esperades = ordenades.slice(0, 25);
  var escrites = [];
  for (var m = 0; m < p2.noves.length; m++) {
    escrites.push(p2.noves[m].data_inici);
  }
  escrites.sort();
  comprova(JSON.stringify(escrites) === JSON.stringify(esperades),
    'les 25 escrites són les de data_inici més imminent');

  // --- P3. Una crida que peta sempre: s'encua tot i no atura --------------
  console.log('');
  console.log('P3. pressupost=30, crida que peta sempre');
  var p3 = await passada(ofertes, { pressupost: 30, cridaGemini: cridaQuePeta });
  console.log('    escrites=' + p3.noves.length +
    '  crides=' + p3.traducio.crides +
    '  fallades=' + p3.traducio.fallades);
  comprova(p3.noves.length === 15, 'amb 30 crides i 2 intents per fila s\'encuen 15 files');
  comprova(p3.traducio.crides === 30, 'el reintent gasta pressupost: 30 crides');
  comprova(p3.traducio.fallades === 15, 'les 15 compten com a fallades');
  comprova(p3.traducio.traduides === 0 && p3.traducio.nomesTitol === 0,
    'cap fila no surt com a traduïda');
  comprova(p3.traducio.senseMateria === 0,
    'i cap no surt com a declinada pel model: la crida no hi ha arribat');
  console.log('    motiusDeFallada: ' + JSON.stringify(p3.traducio.motiusDeFallada));
  comprova(
    p3.traducio.motiusDeFallada.length === 1 &&
    p3.traducio.motiusDeFallada[0].quantes === 15 &&
    p3.traducio.motiusDeFallada[0].motiu.indexOf('429 RESOURCE_EXHAUSTED simulat') !== -1,
    'el motiu de la fallada surt a l\'informe, agrupat i comptat'
  );
  comprova(
    totesLesNotes(p3.noves, 'No s\'ha pogut escriure la versió catalana') === 15,
    'les 15 porten l\'avís de «no traduïda»'
  );
  var crues = 0;
  for (var n = 0; n < p3.noves.length; n++) {
    if (p3.noves[n].descripcio_ca === '' && p3.noves[n].titol.indexOf('CATALÀ: ') !== 0) {
      crues++;
    }
  }
  comprova(crues === 15, 'entren amb el títol i el text tal com arriben del flux');

  // --- P4. Una fila que peta no atura la resta ----------------------------
  console.log('');
  console.log('P4. pressupost=20, peta una fila de cada tres');
  var quantes = 0;
  function cridaIrregular(fila) {
    quantes++;
    if (quantes % 3 === 0) {
      return Promise.reject(new Error('error simulat de xarxa'));
    }
    return cridaBona(fila);
  }
  var p4 = await passada(ofertes, { pressupost: 20, cridaGemini: cridaIrregular });
  console.log('    escrites=' + p4.noves.length +
    '  crides=' + p4.traducio.crides +
    '  traduides=' + p4.traducio.traduides +
    '  nomesTitol=' + p4.traducio.nomesTitol +
    '  fallades=' + p4.traducio.fallades);
  comprova(p4.noves.length > 0, 'la passada acaba i escriu files');
  comprova(p4.traducio.crides <= 20, 'no passa del pressupost');
  comprova(
    p4.traducio.traduides + p4.traducio.nomesTitol > 0 && p4.traducio.fallades === 0,
    'el reintent salva les que peten un sol cop'
  );

  // --- P5. El model diu que no hi ha prou matèria -------------------------
  console.log('');
  console.log('P5. pressupost=10, el model torna les descripcions buides');
  function cridaBuida(fila) {
    return Promise.resolve({ titol: 'CATALÀ: ' + fila.titol, descripcio_ca: '', descripcio_fr: '' });
  }
  var p5 = await passada(ofertes, { pressupost: 10, cridaGemini: cridaBuida });
  console.log('    escrites=' + p5.noves.length +
    '  traduides=' + p5.traducio.traduides +
    '  nomesTitol=' + p5.traducio.nomesTitol +
    '  fallades=' + p5.traducio.fallades +
    '  senseMateria=' + p5.traducio.senseMateria);
  comprova(p5.noves.length === 10, 'les 10 s\'encuen igualment');
  comprova(p5.traducio.traduides === 0, 'cap no compta com a traduïda');
  comprova(p5.traducio.senseMateria === 10 && p5.traducio.fallades === 0,
    'compten com a DECLINADES pel model, no com a crides que peten');
  comprova(p5.traducio.motiusDeFallada.length === 0,
    'i per tant no hi ha cap motiu de fallada a l\'informe');
  var cruesP5 = 0;
  for (var q = 0; q < p5.noves.length; q++) {
    if (p5.noves[q].nota_curador.indexOf('No s\'ha pogut escriure la versió catalana') !== -1 &&
        p5.noves[q].titol.indexOf('CATALÀ: ') !== 0) {
      cruesP5++;
    }
  }
  comprova(cruesP5 === p5.traducio.senseMateria,
    'les que no tenen descripció es queden crues, títol inclòs');

  // --- P6. Mitja parella de descripcions ---------------------------------
  console.log('');
  console.log('P6. pressupost=5, el model només torna la descripció catalana');
  function cridaMitjaParella(fila) {
    return Promise.resolve({
      titol: 'CATALÀ: ' + fila.titol,
      descripcio_ca: 'Només el català, sense el francès al costat.',
      descripcio_fr: ''
    });
  }
  var p6 = await passada(ofertes, { pressupost: 5, cridaGemini: cridaMitjaParella });
  console.log('    traduides=' + p6.traducio.traduides +
    '  fallades=' + p6.traducio.fallades +
    '  senseMateria=' + p6.traducio.senseMateria);
  comprova(p6.traducio.traduides === 0, 'mitja parella no és cap traducció');
  comprova(p6.traducio.senseMateria === 5 && p6.traducio.fallades === 0,
    'i tampoc no és cap crida que peta');
  var senseCa = 0;
  for (var r = 0; r < p6.noves.length; r++) {
    if (p6.noves[r].descripcio_ca === '') {
      senseCa++;
    }
  }
  comprova(senseCa === p6.noves.length, 'cap fila no es queda amb només la banda catalana');

  // --- P7. La pausa va ENTRE crides --------------------------------------
  console.log('');
  console.log('P7. pressupost=4, pausa de 200 ms');
  var abans = Date.now();
  var p7 = await passada(ofertes, { pressupost: 4, cridaGemini: cridaBona, pausaMs: 200 });
  var trigat = Date.now() - abans;
  console.log('    crides=' + p7.traducio.crides + '  trigat=' + trigat + ' ms');
  comprova(p7.traducio.crides === 4, '4 crides');
  comprova(trigat >= 600, 'hi ha 3 pauses de 200 ms, no 4 (la primera crida no espera)');
  comprova(trigat < 1400, 'i no n\'hi ha cap més');

  // --- P8. En sec sense crida injectada: no es tradueix res --------------
  console.log('');
  console.log('P8. en sec, cap crida injectada i cap clau');
  var p8 = await passada(ofertes, {});
  console.log('    feta=' + p8.traducio.feta + '  motiu=«' + p8.traducio.motiu + '»' +
    '  escrites=' + p8.noves.length);
  comprova(p8.traducio.feta === false, 'la traducció no s\'ha fet');
  comprova(p8.traducio.motiu.indexOf('en sec') === 0, 'i el motiu diu que és per ser en sec');
  comprova(p8.traducio.crides === 0, 'cap crida gastada');
  comprova(p8.noves.length === candidates, 'les files s\'encuen igualment, totes');
  comprova(
    totesLesNotes(p8.noves, 'per un model') === 0 &&
    totesLesNotes(p8.noves, 'No s\'ha pogut escriure') === 0,
    'i sense cap avís de traducció: no se n\'ha intentat cap'
  );

  await casosDeNomsPropis();
  await casosDeLesQuatreRegles();

  console.log('');
  if (problemes.length === 0) {
    console.log('TOTES LES PROVES PASSEN.');
  } else {
    console.log('PROVES QUE FALLEN: ' + problemes.length);
    for (var s = 0; s < problemes.length; s++) {
      console.log('  - ' + problemes[s]);
    }
    process.exitCode = 1;
  }
}

principal();
