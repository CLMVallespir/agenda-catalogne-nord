// ---------------------------------------------------------------------------
// sondes-fonts.js
//
// Comprova, una sola vegada i sense escriure res, quins fluxos de dades són
// realment utilitzables per a l'agenda. Es fa des de Claude Code perquè el
// Claude de xat no té sortida de xarxa cap a aquests dominis.
//
//   node sondes-fonts.js            -> ho passa tot
//   node sondes-fonts.js tourinsoft -> només aquest bloc
//
// Quatre blocs: tourinsoft, wordpress, intramuros, cms.
//
// Regla que el guió no es salta: abans de demanar res a un domini, llegeix el
// seu robots.txt. Si no ens deixen, no hi insistim. No és només correcció:
// és que ja sabem que almenys un ajuntament ens exclou explícitament, i un
// projecte que vol demanar dades a les associacions no pot començar
// ignorant qui diu que no.
//
// Node 18 o superior. Cap dependència.
// ---------------------------------------------------------------------------

const AGENT = 'agenda-catalunya-nord/1.0 (+https://clm.cat; agenda@clm.cat)';
const ESPERA_MS = 1500;   // entre peticions al mateix domini
const TEMPS_MAX = 12000;


// --- Utilitats ------------------------------------------------------------

// Espera els mil·lisegons demanats, per no burxar cap servidor.
function dorm(ms) {
  return new Promise(function (resol) { setTimeout(resol, ms); });
}

// Demana un URL i torna estat, tipus de contingut i el principi del cos.
async function demana(url, opcions) {
  const config = opcions || {};
  const control = new AbortController();
  const rellotge = setTimeout(function () { control.abort(); }, TEMPS_MAX);

  try {
    const resposta = await fetch(url, {
      method: config.method || 'GET',
      headers: Object.assign({ 'User-Agent': AGENT }, config.headers || {}),
      body: config.body,
      redirect: 'follow',
      signal: control.signal
    });
    const text = await resposta.text();
    return {
      ok: true,
      estat: resposta.status,
      tipus: resposta.headers.get('content-type') || '',
      cos: text.slice(0, 4000),
      llargada: text.length
    };
  } catch (error) {
    return { ok: false, estat: 0, tipus: '', cos: '', error: String(error.message || error) };
  } finally {
    clearTimeout(rellotge);
  }
}

// Diu si el robots.txt del domini ens deixa demanar aquest camí.
// Lectura deliberadament conservadora: davant del dubte, no.
async function robotsPermet(url) {
  const adreca = new URL(url);
  const resposta = await demana(adreca.origin + '/robots.txt');

  if (!resposta.ok || resposta.estat >= 400) {
    return { permes: true, motiu: 'sense robots.txt llegible' };
  }

  const linies = resposta.cos.split('\n');
  let dinsDelNostreBloc = false;
  const prohibits = [];

  for (const linia of linies) {
    const neta = linia.split('#')[0].trim();
    if (!neta) {
      continue;
    }
    const separador = neta.indexOf(':');
    if (separador === -1) {
      continue;
    }
    const clau = neta.slice(0, separador).trim().toLowerCase();
    const valor = neta.slice(separador + 1).trim();

    if (clau === 'user-agent') {
      dinsDelNostreBloc = (valor === '*');
      continue;
    }
    if (clau === 'disallow' && dinsDelNostreBloc && valor) {
      prohibits.push(valor);
    }
  }

  for (const prohibit of prohibits) {
    if (prohibit === '/' || adreca.pathname.startsWith(prohibit)) {
      return { permes: false, motiu: 'robots.txt prohibeix ' + prohibit };
    }
  }
  return { permes: true, motiu: 'permès' };
}

// Demana un URL només si robots.txt ho permet.
async function demanaAmbPermis(url, opcions) {
  const permis = await robotsPermet(url);
  if (!permis.permes) {
    return { ok: false, estat: -1, bloquejat: true, motiu: permis.motiu };
  }
  await dorm(ESPERA_MS);
  return demana(url, opcions);
}

// Escriu una línia de resultat llegible.
function informa(etiqueta, resposta, nota) {
  if (resposta.bloquejat) {
    console.log('  ⛔ ' + etiqueta + ' — ' + resposta.motiu);
    return;
  }
  if (!resposta.ok) {
    console.log('  ✗  ' + etiqueta + ' — error de xarxa: ' + resposta.error);
    return;
  }
  const marca = resposta.estat === 200 ? '✓ ' : '·  ';
  const tipus = resposta.tipus.split(';')[0];
  console.log('  ' + marca + etiqueta + ' — ' + resposta.estat + ' ' + tipus +
    ' (' + resposta.llargada + ' bytes)' + (nota ? ' — ' + nota : ''));
}


// --- Bloc 1: Tourinsoft / ADT66 ------------------------------------------

// La incògnita real no és si l'API v3 és oberta (ho és), sinó si l'ADT66 té
// una sindicació AGREGADA v3 i quin identificador té. El GUID que coneixem
// és d'una sindicació V1, i les v3 es configuren a part.
const GUID_V1 = '60a37063-5667-45f8-82e1-a1db2d8375b9';

async function sondaTourinsoft() {
  console.log('\n=== Tourinsoft / ADT66 ===');

  const clients = ['cdt66.tourinsoft.com', 'cdt66'];
  const base = 'https://api-v3.tourinsoft.com/api/syndications/';

  for (const client of clients) {
    const metadata = await demana(base + client + '/' + GUID_V1 + '/metadata');
    informa('metadata amb client «' + client + '»', metadata,
      metadata.estat === 200 ? 'ESTRUCTURA DISPONIBLE' : '');

    if (metadata.estat === 200) {
      console.log('     primers camps: ' + metadata.cos.slice(0, 400));
    }
  }

  // Flux diferencial: 404 = res nou, 401 = reimporta-ho tot, 302 = diferencial.
  const ahir = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const diferencial = await demana(base + 'cdt66.tourinsoft.com/' + GUID_V1 + '/' + ahir);
  informa('flux diferencial des de ' + ahir, diferencial,
    diferencial.estat === 302 ? 'DIFERENCIAL POSSIBLE' :
    diferencial.estat === 404 ? 'res nou' :
    diferencial.estat === 401 ? 'cal reimportació completa' : '');

  console.log('\n  Si els dos clients fallen amb 404, vol dir que l’ADT66 no té');
  console.log('  cap sindicació v3 amb aquest identificador. Aleshores la via');
  console.log('  no és tècnica: és demanar-la a l’ADT66 per correu.');
}


// --- Bloc 2: WordPress REST ----------------------------------------------

// Dominis municipals i d'organitzador que van aparèixer a la recerca.
const DOMINIS = [
  'https://thuir.fr',
  'https://www.ceret.fr',
  'https://www.ville-elne.fr',
  'https://www.mairie-perpignan.fr',
  'https://www.reynes.fr',
  'https://stjeanpladecorts.fr',
  'https://www.saintlaurentdecerdans.fr',
  'https://www.maureillaslasillas.fr',
  'https://www.rivesaltes.fr',
  'https://www.formigueres.fr',
  'https://www.mairie-matemale.fr',
  'https://www.ille-sur-tet.com',
  'https://www.ville-arles-sur-tech.fr',
  'https://www.mairie-amelie.com',
  'https://www.corsavy.fr',
  'https://www.serralongue.com',
  'https://lamanere.fr',
  'https://www.vallespirbarroc.fr',
  'https://www.casamacia.cat'
];

// Noms de tipus de contingut que solen dur els events a WordPress.
const TIPUS_PROBABLES = [
  'tsc_evenement', 'evenement', 'event', 'events', 'tribe_events',
  'mec-events', 'agenda', 'manifestation'
];

async function sondaWordpress() {
  console.log('\n=== WordPress REST ===');

  for (const domini of DOMINIS) {
    const tipus = await demanaAmbPermis(domini + '/wp-json/wp/v2/types');

    if (tipus.bloquejat || !tipus.ok || tipus.estat !== 200) {
      informa(domini, tipus);
      continue;
    }

    const trobats = [];
    for (const candidat of TIPUS_PROBABLES) {
      if (tipus.cos.includes('"' + candidat + '"')) {
        trobats.push(candidat);
      }
    }
    informa(domini, tipus,
      trobats.length ? 'TIPUS D’EVENT: ' + trobats.join(', ') : 'WordPress, cap tipus d’event reconegut');

    for (const trobat of trobats) {
      const mostra = await demanaAmbPermis(domini + '/wp-json/wp/v2/' + trobat + '?per_page=1');
      informa('   └ ' + trobat, mostra, mostra.estat === 200 ? 'JSON D’EVENTS DISPONIBLE' : '');
    }
  }

  console.log('\n  Un 200 a /wp-json/wp/v2/types amb un tipus d’event és una font');
  console.log('  de nivell 1: JSON, sense model, i amb camp de data de modificació.');
}


// --- Bloc 3: IntraMuros --------------------------------------------------

// Punt final real, trobat al tràfec del widget. Torna JSON sense clau.
// Els dos paràmetres són obligatoris: si es treu «city-id», un tallafoc
// respon «Public API blocked by WAF». Vol dir que hi ha algú vigilant, i
// que aquesta font s'ha de fer servir amb mesura: una crida per comuna i
// dia com a màxim, amb el nostre nom a la capçalera i la resposta desada.
const API_INTRAMUROS = 'https://api.appli-intramuros.com/_public/events/';

// Identificadors interns d'IntraMuros, que NO són codis INSEE. S'obtenen
// generant un widget per comuna al configurador de widget.intramuros.org.
const COMUNES_INTRAMUROS = [
  { nom: 'Prats de Molló', ciutat: 5299, agglo: 595 }
];

async function sondaIntramuros() {
  console.log('\n=== IntraMuros ===');

  for (const comuna of COMUNES_INTRAMUROS) {
    const url = API_INTRAMUROS + '?city-id=' + comuna.ciutat +
      '&agglo-id=' + comuna.agglo + '&source=widget';
    const resposta = await demanaAmbPermis(url);
    informa(comuna.nom, resposta);

    if (!resposta.ok || resposta.estat !== 200) {
      continue;
    }
    resumeixEventsIntramuros(resposta);
  }

  console.log('\n  La pregunta oberta és si una sola crida cobreix tota la');
  console.log('  intercomunalitat. Si a «pobles coberts» hi surt més d’un nom,');
  console.log('  una crida per vall substitueix una crida per poble.');
}

// Escriu quants events torna la resposta, de quins pobles i amb quins camps.
function resumeixEventsIntramuros(resposta) {
  let dades;
  try {
    dades = JSON.parse(resposta.cos);
  } catch (error) {
    console.log('     (resposta truncada per la sonda; mira-la al navegador)');
    return;
  }

  const events = Array.isArray(dades) ? dades : (dades.results || dades.events || []);
  if (!events.length) {
    console.log('     cap event a la resposta');
    return;
  }

  const pobles = [];
  for (const event of events) {
    const nom = event.city_name || '';
    if (nom && pobles.indexOf(nom) === -1) {
      pobles.push(nom);
    }
  }

  console.log('     events: ' + events.length);
  console.log('     pobles coberts: ' + pobles.join(', '));
  console.log('     camps: ' + Object.keys(events[0]).join(', '));
}


// --- Bloc 4: el CMS de rutes .htm ----------------------------------------

// Sis dominis coneguts que comparteixen la petjada cms_viewFile.php i les
// rutes NNNN-slug.htm. Dos són de Catalunya Nord.
const SOSPITOSOS_CMS = [
  'https://www.ceret.fr',
  'https://www.mairie-leboulou.fr',
  'https://www.meylan.fr',
  'https://www.ville-clichy.fr'
];

// Rastres que identifiquen el proveïdor dins del codi de la pàgina.
const RASTRES = [
  'cms_viewFile', 'generator', 'Réalisation', 'realisation',
  'powered by', 'rss', 'ics', 'ical', '.xml'
];

async function sondaCms() {
  console.log('\n=== CMS de rutes .htm ===');

  for (const domini of SOSPITOSOS_CMS) {
    const portada = await demanaAmbPermis(domini + '/');
    informa(domini, portada);

    if (!portada.ok || portada.estat !== 200) {
      continue;
    }
    const vistos = RASTRES.filter(function (rastre) {
      return portada.cos.toLowerCase().includes(rastre.toLowerCase());
    });
    if (vistos.length) {
      console.log('     rastres: ' + vistos.join(', '));
    }
  }

  console.log('\n  El que busquem no és el nom del proveïdor sinó si el CMS');
  console.log('  publica un flux (RSS, ICS o XML) de l’agenda. Si el publica,');
  console.log('  un sol adaptador cobreix Ceret, el Voló i tots els ajuntaments');
  console.log('  francesos que fan servir el mateix producte.');
  console.log('\n  Vocabulari d’events d’aquest CMS, ja recollit del Voló i que');
  console.log('  només cal mapar una vegada cap al nostre enum de deu:');
  console.log('  Action citoyenne · Débat/Conférence · Exposition · Foire ·');
  console.log('  Jeux · Portes ouvertes · Projection, cinéma ·');
  console.log('  Rassemblement/réunion · Sport · Stage/Atelier · Thé dansants ·');
  console.log('  Visite guidée');
}


// --- Execució ------------------------------------------------------------

const BLOCS = {
  tourinsoft: sondaTourinsoft,
  wordpress: sondaWordpress,
  intramuros: sondaIntramuros,
  cms: sondaCms
};

async function principal() {
  const demanat = process.argv[2];

  if (demanat && !BLOCS[demanat]) {
    console.log('Blocs disponibles: ' + Object.keys(BLOCS).join(', '));
    return;
  }

  const aFer = demanat ? [demanat] : Object.keys(BLOCS);
  for (const nom of aFer) {
    await BLOCS[nom]();
  }
  console.log('\nFet. Cap escriptura: aquesta sonda només llegeix.\n');
}

principal();
