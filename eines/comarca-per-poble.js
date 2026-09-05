// ---------------------------------------------------------------------------
// COMARCA A PARTIR DEL POBLE
//
// Una sola feina: donat un nom de municipi, dir a quina de les cinc comarques
// de Catalunya Nord pertany. Res més.
//
//   - Cap crida a cap API. Codi pur: entra un nom, surt una comarca.
//   - No escriu enlloc i no llegeix res del sistema.
//   - No decideix res d'editorial: si el poble no hi és, torna '' i qui la
//     cridi ja avisarà el curador.
//
// PER QUÈ EXISTEIX. El flux de l'ADT66 (eines/adt66-sincronitza.js) porta el
// municipi al camp `Commune`, sempre, però NO porta la comarca: no és una
// divisió que l'administració francesa faci servir. Sense aquesta taula el
// camp `comarca` arribava buit a pendents.json a totes les files d'aquell
// canal, i és justament el camp amb què el web públic filtra i amb què el
// digest setmanal de Brevo tria la llista. Un municipi buit no es pot deduir;
// una comarca sí, perquè el municipi la determina del tot.
//
// AQUEST FITXER NO SUBSTITUEIX eines/pobles-alies.js, l'acompanya. Allà hi
// viuen els noms —quina és la forma catalana i quina la francesa— i aquí
// només hi viu la pertinença. Per això:
//
//   - el normalitzador és el d'allà (`normalitzaNom`), mai una còpia;
//   - de cada poble aquí només s'escriu UNA forma, i si el poble és a la
//     taula d'àlies, l'altra llengua s'hi enganxa sola en carregar el fitxer.
//
// Per afegir-hi un poble: una línia més a la comarca que toqui, forma
// catalana primer. Si el poble no és a pobles-alies.js, afegeix-hi també la
// forma francesa a la mateixa línia —és la que arriba de l'ADT66— o, millor,
// afegeix el parell a pobles-alies.js i deixa aquí només el català.
//
// D'ON SURTEN LES ASSIGNACIONS. De les llistes de municipis per comarca de
// l'Enciclopèdia Catalana i de la Viquipèdia catalana, no de cap criteri
// nostre. L'ÚNICA excepció, i és deliberada, és la Fenolleda: no és cap de les
// cinc comarques i el criteri editorial la posa sencera a Rosselló. Vegeu-ne
// el bloc dins de la taula i el §«La Fenolleda» de docs/CRITERI-EDITORIAL.md.
//
// Mesurat contra el flux de l'ADT66 el 31 d'agost de 2026: 1 453 ofertes,
// 125 municipis distints, **els 125 resolts**, cap sense assignació.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/comarca-per-poble.js           -> proves de coherència
//   node eines/comarca-per-poble.js --flux    -> cobertura contra l'ADT66 real
//
// AVÍS DE DESPLEGAMENT: com pobles-alies.js, això s'importa amb require(),
// que és Node pur. El dia que hagi d'anar dins del Worker, s'hi enganxa a
// dins (vegeu NOTES.md, «el fitxer que es desplega no és el que s'edita»).
// ---------------------------------------------------------------------------


// --- El que ve de fora ------------------------------------------------------

// L'única importació: el normalitzador de noms i la taula d'àlies. Vegeu la
// capçalera per què els noms viuen allà i la pertinença aquí.
var pobles = require('./pobles-alies.js');


// --- La taula ---------------------------------------------------------------
// Cada entrada és una llista de formes del mateix nom. La primera és la
// catalana. N'hi ha que en porten dues perquè el poble no és a
// pobles-alies.js i el francès s'ha d'escriure aquí; n'hi ha que en porten
// tres perquè la comuna es va reanomenar o fusionar i totes dues formes
// circulen encara.

var POBLES_PER_COMARCA = {

  // --- Rosselló ------------------------------------------------------------
  // La plana, la Salanca, el Riberal, els Aspres, la Marenda i l'Albera.
  'Rosselló': [
    // La plana i el Perpinyanès
    ['Perpinyà'],
    ['Cabestany'],
    ['Bompàs'],
    ['Sant Esteve del Monestir'],
    ['Toluges'],
    ['Canoes', 'Canohès'],
    ['Pollestres'],
    ['Vilanova de Raò'],
    ['Bao'],
    ['El Soler'],
    ['Sant Feliu d\'Avall'],
    ['Sant Feliu d\'Amunt'],
    ['Pesillà de la Ribera'],
    ['Vilanova de la Ribera'],

    // L'Aglí i les Corberes
    ['Baixàs', 'Baixas'],
    ['Peirestortes', 'Peyrestortes'],
    ['Ribesaltes'],
    ['Salses'],
    ['Òpol i Perellós', 'Opoul-Périllos'],
    ['Vingrau'],
    ['Talteüll', 'Tautavel'],
    ['Cases de Pena', 'Cases-de-Pène'],
    ['Espirà de l\'Aglí', 'Espira-de-l\'Agly'],
    ['Calce'],
    ['Estagell', 'Estagel'],
    ['Montner'],
    ['Cassanyes', 'Cassagnes'],

    // La Salanca
    ['Sant Llorenç de la Salanca'],
    ['Sant Hipòlit de la Salanca'],
    ['Vilallonga de la Salanca'],
    ['Torrelles de la Salanca'],
    ['Clairà'],
    ['El Barcarès', 'Le Barcarès'],
    ['Santa Maria la Mar', 'Sainte-Marie-la-Mer'],
    ['Canet de Rosselló'],
    ['Sant Nazari de Rosselló'],

    // El Riberal de la Tet
    ['Illa'],
    ['Nefiac', 'Néfiach'],
    ['Cornellà de la Ribera', 'Corneilla-la-Rivière'],
    ['Corbera'],
    ['Corbera les Cabanes', 'Corbère-les-Cabanes'],
    ['Bulaternera', 'Bouleternère'],
    ['Sant Miquel de Llotes', 'Saint-Michel-de-Llotes'],
    ['Millars'],

    // Els Aspres
    ['Casafabre', 'Casefabre'],
    ['Prunet i Bellpuig', 'Prunet-et-Belpuig'],
    ['Bula d\'Amunt', 'Boule-d\'Amont'],
    ['Camèlies', 'Camélas'],
    ['Castellnou dels Aspres', 'Castelnou'],
    ['Santa Coloma de Tuïr', 'Sainte-Colombe-de-la-Commanderie'],
    ['Tuïr'],
    ['Llupià', 'Llupia'],
    ['Pontellà', 'Ponteilla', 'Ponteilla-Nyls'],
    ['Vilamulaca'],
    ['Trullars'],
    ['Terrats'],
    ['Forques', 'Fourques'],
    ['Sant Joan la Cella', 'Saint-Jean-Lasseille'],
    ['Trasserra', 'Tresserre'],
    ['Banyuls dels Aspres', 'Banyuls-dels-Aspres'],
    ['Brullà', 'Brouilla'],
    ['Passà', 'Passa'],
    ['Llauró', 'Llauro'],
    ['Oms'],
    ['Torderes', 'Tordères'],
    ['Queixàs', 'Caixas'],
    ['Montoriol', 'Montauriol'],

    // El pla de l'Illiberis i la Marenda
    ['Elna'],
    ['Ortafà'],
    ['Alenyà'],
    ['Teulís'],
    ['Cornellà del Bercol'],
    ['Montescot'],
    ['Bages de Rosselló'],
    ['Palau del Vidre'],
    ['Sant Cebrià de Rosselló'],
    ['Argelers'],
    ['Cotlliure'],
    ['Portvendres'],
    ['Banyuls de la Marenda'],
    ['Cervera de la Marenda'],

    // L'Albera i el Rosselló de ponent
    ['Sant Andreu de Sureda'],
    ['Sant Genís de Fontanes'],
    ['Vilallonga dels Monts'],
    ['Sureda'],
    ['La Roca d\'Albera', 'Laroque-des-Albères'],
    ['Les Cluses'],
    ['El Voló'],

    // --- LA FENOLLEDA SENCERA, QUE HI VA PER DECISIÓ -----------------------
    // Administrativament aquests pobles NO són Rosselló: són Fenolleda, que no
    // és cap de les cinc comarques de l'agenda. Hi van perquè el criteri
    // editorial ho decideix: vegeu el §«La Fenolleda» de
    // docs/CRITERI-EDITORIAL.md. La regla és de comarca sencera, no de poble a
    // poble —«la Fenolleda» vol dir tota la comarca històrica—, o sigui que un
    // poble fenolledenc que encara no sigui a la llista s'hi afegeix aquí i no
    // cal tornar a decidir res.
    //
    // El motiu: sense comarca una fila no surt a cap filtre del web ni entra a
    // cap digest de Brevo, i deixar-hi la Fenolleda buida volia dir tenir-hi
    // actes que no arribaven a ningú. No és cap error de la taula i no s'ha
    // d'«arreglar» tornant-los a buidar.
    //
    // Fins al 31 d'agost de 2026 aquí només hi havia Bellestar i Sant Pau de
    // Fenollet, i els altres sis quedaven a "" esperant la decisió. Ja no
    // esperen res.
    ['Bellestar'],
    ['Sant Pau de Fenollet'],
    ['Maurí', 'Maury'],
    ['Ansinyà', 'Ansignan'],
    ['Caudiers de Fenolleda', 'Caudiès-de-Fenouillèdes'],
    ['Sant Martí de Fenollet', 'Saint-Martin-de-Fenouillet'],
    ['El Viver', 'Le Vivier'],
    ['La Tor de França', 'Latour-de-France']
  ],

  // --- Conflent ------------------------------------------------------------
  'Conflent': [
    ['Prada'],
    ['Vilafranca de Conflent'],
    ['Cornellà de Conflent'],
    ['Rià i Cirac'],
    ['Fullà'],
    ['Vernet'],
    ['Molig'],
    ['Marqueixanes'],
    ['Oleta', 'Olette', 'Olette-Évol'],
    ['Fontpedrosa'],
    ['Jóc'],
    ['Montlluís'],
    ['Sornià'],
    ['Vinçà'],
    ['Arboçols'],
    ['Finestret'],
    ['Eus'],
    ['Codalet'],
    ['Catllar'],
    ['Serdinyà'],
    ['Campome', 'Campôme'],
    ['Castell de Vernet', 'Casteil'],
    ['Clarà i Vilarach', 'Clara-Villerach', 'Clara'],
    ['Escaró', 'Escaro'],
    ['Estoer', 'Estoher'],
    ['Fillols'],
    ['Jujols'],
    ['Els Masos', 'Los Masos'],
    ['Mentet', 'Mantet'],
    ['Mosset'],
    ['Noedes', 'Nohèdes'],
    ['Nyer'],
    ['Pi de Conflent', 'Py'],
    ['Rigardà', 'Rigarda'],
    ['Rodès'],
    ['Saorra', 'Sahorre'],
    ['Soanyes', 'Souanyas'],
    ['Tarerac', 'Tarerach'],
    ['Taurinyà', 'Taurinya'],
    ['Trevillac', 'Trévillach'],
    ['Urbanyà', 'Urbanya'],
    ['Valmanya'],
    ['Vallestàvia', 'Baillestavy'],
    ['Espirà de Conflent', 'Espira-de-Conflent'],
    ['Aiguatèbia i Talau', 'Ayguatébia-Talau'],
    ['Canavelles', 'Canaveilles'],
    ['Caudiers de Conflent', 'Caudiès-de-Conflent'],
    ['Rellà', 'Railleu'],
    ['Sansa'],
    ['Orellà', 'Oreilla'],
    ['Toès i Entrevalls', 'Thuès-Entre-Valls'],
    ['La Fossa', 'Fosse'],
    ['Campussí', 'Campoussy'],
    ['Conat'],
    ['Glorianes']
  ],

  // --- Vallespir -----------------------------------------------------------
  'Vallespir': [
    ['Ceret'],
    ['Prats de Molló'],
    ['Arles de Tec'],
    ['Amèlia les Banys'],
    ['Sant Llorenç de Cerdans'],
    ['El Tec'],
    ['Costoja'],
    ['Serrallonga'],
    ['Reiners'],
    ['Montboló'],
    ['Maurellàs'],
    ['Sant Joan de Pladecorts'],
    ['El Portús'],
    ['Vivers'],
    ['Les Illes'],
    ['La Menera', 'Lamanère'],
    ['Corsaví', 'Corsavy'],
    ['Montferrer'],
    ['Sant Marçal', 'Saint-Marsal'],
    ['Tellet', 'Taillet'],
    ['Calmella', 'Calmeilles']
  ],

  // --- Capcir --------------------------------------------------------------
  'Capcir': [
    ['Els Angles'],
    ['Formiguera'],
    ['Matamala'],
    ['Puigbalador'],
    ['La Llaguna'],
    ['Real'],
    ['Fontrabiosa', 'Fontrabiouse']
  ],

  // --- Cerdanya ------------------------------------------------------------
  // L'Alta Cerdanya. Llívia hi és: és un enclavament administrat des del sud,
  // però és Cerdanya i l'agenda hi arriba.
  'Cerdanya': [
    ['Sallagosa'],
    ['La Guingueta d\'Ix'],
    ['Font-romeu'],
    ['Er'],
    ['Naüja'],
    ['Palau de Cerdanya'],
    ['Enveig'],
    ['Èguet'],
    ['La Tor de Querol'],
    ['Angostrina'],
    // Dues esses a pobles-alies.js i una de sola al flux de l'ADT66, que
    // l'escriu «TARGASONNE». Les dues grafies circulen i normalitzaNom()
    // no plega lletres doblades —ni ha de fer-ho—, o sigui que la variant
    // s'escriu aquí. La parella ['Targasona', 'Targassonne'] d'allà no es
    // toca.
    ['Targasona', 'Targasonne'],
    ['Vilanova de les Escaldes'],
    // La comuna fusionada: l'ADT66 la dona amb el nom llarg, i cap de les
    // dues meitats de dalt no l'atrapa.
    ['Angostrina i Vilanova de les Escaldes', 'Angoustrine-Villeneuve-des-Escaldes'],
    ['Osseja'],
    ['Santa Llocaia'],
    ['Estavar'],
    ['Dorres'],
    ['Ur'],
    ['Llívia'],
    ['Eina', 'Eyne'],
    ['Llo'],
    ['Portè', 'Porté-Puymorens'],
    ['Porta'],
    ['Vallcebollera', 'Valcebollère'],
    ['Bolquera', 'Bolquère'],
    ['La Cabanassa', 'La Cabanasse'],
    ['Sant Pere dels Forcats', 'Saint-Pierre-dels-Forcats'],
    ['Càldegues', 'Caldégas']
  ]
};


// --- Els pobles coneguts que a posta no tenen comarca -----------------------
// Ara mateix: cap. La llista hi és, buida, perquè el dia que aparegui un poble
// que el criteri editorial no sàpiga on posar, aquest és el seu lloc: escrit i
// apuntant a '', per tal que es vegi que el '' és una decisió i no un descuit.
//
// Fins al 31 d'agost de 2026 hi havia els sis pobles de la Fenolleda que
// esperaven decisió. El §«La Fenolleda» de docs/CRITERI-EDITORIAL.md la va
// donar —tota la comarca històrica va a Rosselló— i van pujar a la taula de
// Rosselló. Per tant hi ha una cosa que ja NO cal tornar a preguntar-se: què
// fer amb un poble fenolledenc. La resposta és Rosselló.
var FENOLLEDA_SENSE_DECISIO = [];


// --- La funció --------------------------------------------------------------

// ------------------------------------------------------------
// La comarca d'un poble, vingui el nom en la llengua que vingui i escrit com
// sigui: l'ADT66 el dona tot en majúscules i sense accents («ILLE-SUR-TET»,
// «VINCA») i el normalitzador ho aplana igual.
//
// Torna una de les cinc comarques exactes del §4 de CLAUDE.md, o '' si el
// poble no és a la taula o hi és sense assignació. Mai res més: qui la cridi
// pot posar el resultat directament al camp `comarca` sense comprovar-lo.
// ------------------------------------------------------------
function obtenComarca(nomPoble) {
  var clau = pobles.normalitzaNom(nomPoble);

  if (clau === '') {
    return '';
  }

  return INDEX_COMARQUES[clau] || '';
}


// --- Les peces --------------------------------------------------------------

// ------------------------------------------------------------
// Munta el diccionari «forma normalitzada -> comarca». Hi entren les formes
// escrites a la taula i, per a cada una que sigui a pobles-alies.js, també
// l'altra llengua: així el francès de setanta pobles no s'ha de repetir aquí.
//
// Es munta un sol cop, en carregar el fitxer.
// ------------------------------------------------------------
function construeixIndex() {
  var index = {};
  var altraLlengua = mapaDeLaltraLlengua();
  var comarques = Object.keys(POBLES_PER_COMARCA);

  for (var i = 0; i < comarques.length; i++) {
    var comarca = comarques[i];
    var entrades = POBLES_PER_COMARCA[comarca];

    for (var j = 0; j < entrades.length; j++) {
      registraEntrada(index, entrades[j], comarca, altraLlengua);
    }
  }

  // Els pobles coneguts sense assignació: hi consten apuntant a '', que és el
  // mateix que tornaria obtenComarca() si no hi fossin. Hi són perquè les
  // proves puguin comprovar que la llista de dalt i aquesta no es trepitgen.
  for (var k = 0; k < FENOLLEDA_SENSE_DECISIO.length; k++) {
    registraEntrada(index, FENOLLEDA_SENSE_DECISIO[k], '', altraLlengua);
  }

  return index;
}

// ------------------------------------------------------------
// Apunta al diccionari totes les formes d'una entrada, i també l'altra
// llengua de cada forma quan pobles-alies.js la coneix.
// ------------------------------------------------------------
function registraEntrada(index, formes, comarca, altraLlengua) {
  for (var i = 0; i < formes.length; i++) {
    var clau = pobles.normalitzaNom(formes[i]);
    if (clau === '') {
      continue;
    }

    index[clau] = comarca;

    var altra = altraLlengua[clau];
    if (altra) {
      index[pobles.normalitzaNom(altra)] = comarca;
    }
  }
}

// ------------------------------------------------------------
// El diccionari «forma normalitzada -> la mateixa forma en l'altra llengua»,
// tret de la taula d'àlies. És el pont que estalvia repetir aquí els noms
// francesos que ja viuen a pobles-alies.js.
// ------------------------------------------------------------
function mapaDeLaltraLlengua() {
  var mapa = {};

  for (var i = 0; i < pobles.POBLES_ALIES.length; i++) {
    var parell = pobles.POBLES_ALIES[i];
    mapa[pobles.normalitzaNom(parell[0])] = parell[1];
    mapa[pobles.normalitzaNom(parell[1])] = parell[0];
  }

  return mapa;
}

// El diccionari es munta un sol cop, en carregar el fitxer.
var INDEX_COMARQUES = construeixIndex();


// --- El que surt d'aquest fitxer -------------------------------------------
// Una sola funció. Les dues taules surten a fora només perquè les proves les
// puguin comptar; ningú més no les ha de llegir directament.

module.exports = {
  obtenComarca: obtenComarca,
  POBLES_PER_COMARCA: POBLES_PER_COMARCA,
  FENOLLEDA_SENSE_DECISIO: FENOLLEDA_SENSE_DECISIO
};


// --- Ús des del terminal ---------------------------------------------------
// Tot el que ve a partir d'aquí és per poder provar la taula a mà. No forma
// part de la peça i no s'ha de copiar enlloc.

// ------------------------------------------------------------
// Comprova que la taula és coherent amb ella mateixa: que cap poble no consta
// a dues comarques, i que un grapat de noms de mostra —escrits com els escriu
// l'ADT66, en majúscules i sense accents— resolen on han de resoldre.
// ------------------------------------------------------------
function provesDeCoherencia() {
  var comarques = Object.keys(POBLES_PER_COMARCA);
  var vistos = {};
  var duplicats = [];
  var pobles_totals = 0;

  for (var i = 0; i < comarques.length; i++) {
    var entrades = POBLES_PER_COMARCA[comarques[i]];
    pobles_totals = pobles_totals + entrades.length;

    for (var j = 0; j < entrades.length; j++) {
      var clau = pobles.normalitzaNom(entrades[j][0]);
      if (vistos[clau] && vistos[clau] !== comarques[i]) {
        duplicats.push(entrades[j][0] + ': ' + vistos[clau] + ' i ' + comarques[i]);
      }
      vistos[clau] = comarques[i];
    }

    console.log(comarques[i] + ': ' + entrades.length + ' pobles');
  }

  console.log('TOTAL a la taula: ' + pobles_totals + ' pobles');
  console.log('Coneguts sense assignació a posta: ' + FENOLLEDA_SENSE_DECISIO.length + ' pobles');
  console.log('Claus de cerca al diccionari: ' + Object.keys(INDEX_COMARQUES).length);

  if (duplicats.length === 0) {
    console.log('Cap poble a dues comarques: bé.');
  } else {
    console.log('POBLES A DUES COMARQUES: ' + duplicats.join(' · '));
  }

  console.log('');

  var mostres = [
    ['CERET', 'Vallespir'],
    ['PERPIGNAN', 'Rosselló'],
    ['ILLE-SUR-TET', 'Rosselló'],
    ['VINCA', 'Conflent'],
    ['PRADES', 'Conflent'],
    ['Prada', 'Conflent'],
    ['LES ANGLES', 'Capcir'],
    ['SAINTE-LEOCADIE', 'Cerdanya'],
    ['ANGOUSTRINE-VILLENEUVE-DES-ESCALDES', 'Cerdanya'],
    // Tota la Fenolleda va a Rosselló, no només els dos pobles que el criteri
    // editorial dona d'exemple: aquestes quatre mostres ho vigilen.
    ['SAINT-PAUL-DE-FENOUILLET', 'Rosselló'],
    ['BELESTA', 'Rosselló'],
    ['MAURY', 'Rosselló'],
    ['LATOUR-DE-FRANCE', 'Rosselló'],
    // I un poble de fora de Catalunya Nord continua caient a "".
    ['Vilassar de Mar', ''],
    ['', '']
  ];

  var fallades = 0;
  for (var k = 0; k < mostres.length; k++) {
    var obtinguda = obtenComarca(mostres[k][0]);
    var bo = obtinguda === mostres[k][1];
    if (!bo) {
      fallades = fallades + 1;
    }
    console.log((bo ? '  ok  ' : '  MAL ') +
                (mostres[k][0] === '' ? '(cadena buida)' : mostres[k][0]) +
                ' -> ' + (obtinguda === '' ? '(buit)' : obtinguda) +
                (bo ? '' : ' (esperava ' + (mostres[k][1] === '' ? '(buit)' : mostres[k][1]) + ')'));
  }

  console.log('');
  console.log(fallades === 0 ? 'Les ' + mostres.length + ' mostres passen.'
                             : fallades + ' mostres de ' + mostres.length + ' falles.');
  return fallades;
}

// ------------------------------------------------------------
// Cobertura contra el flux de debò: baixa les ofertes de l'ADT66 i diu quants
// municipis distints porten i quants en resol la taula. Els que no en resol
// els llista, un per un, amb quantes ofertes hi ha darrere.
// ------------------------------------------------------------
async function coberturaContraElFlux() {
  var adt66 = require('./adt66-sincronitza.js');
  var resposta = await adt66.sincronitzaADT66('');

  var comptes = {};
  var mostrats = {};

  for (var i = 0; i < resposta.ofertes.length; i++) {
    var nom = String(resposta.ofertes[i].Commune || '').trim();
    if (nom === '') {
      continue;
    }
    var clau = pobles.normalitzaNom(nom);
    comptes[clau] = (comptes[clau] || 0) + 1;
    mostrats[clau] = nom;
  }

  var claus = Object.keys(comptes);
  var resolts = 0;
  var ofertesResoltes = 0;
  var sensa = [];

  for (var j = 0; j < claus.length; j++) {
    if (obtenComarca(mostrats[claus[j]]) !== '') {
      resolts = resolts + 1;
      ofertesResoltes = ofertesResoltes + comptes[claus[j]];
    } else {
      sensa.push(mostrats[claus[j]] + ' (' + comptes[claus[j]] + ' ofertes)');
    }
  }

  console.log('ofertes al flux           ' + resposta.ofertes.length);
  console.log('municipis distints        ' + claus.length);
  console.log('municipis resolts         ' + resolts);
  console.log('municipis sense comarca   ' + sensa.length);
  console.log('ofertes amb comarca       ' + ofertesResoltes +
              ' de ' + resposta.ofertes.length);

  if (sensa.length > 0) {
    console.log('');
    console.log('Sense comarca:');
    for (var k = 0; k < sensa.length; k++) {
      console.log('  ' + sensa[k]);
    }
  }
}

// ------------------------------------------------------------
// Tria què s'executa segons l'argument del terminal.
// ------------------------------------------------------------
async function principal() {
  if (process.argv[2] === '--flux') {
    try {
      await coberturaContraElFlux();
    } catch (error) {
      console.error('No he pogut llegir el flux de l\'ADT66: ' + error.message);
      process.exitCode = 1;
    }
    return;
  }

  if (provesDeCoherencia() > 0) {
    process.exitCode = 1;
  }
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    process.argv[1].indexOf('comarca-per-poble') !== -1) {
  principal();
}
