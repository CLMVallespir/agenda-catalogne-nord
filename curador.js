// ---------------------------------------------------------------------------
// CURADOR — el codi de la cua de revisió
//
// Tot el que fa curador.html: carregar la cua, pintar les fitxes, i publicar
// o rebutjar amb el testimoni de GitHub. Les peces que canvien l'estat de la
// cua són a curador-cua.js, i la regla de les adreces a url-segura.js; la
// pàgina carrega els tres en aquest ordre.
//
// PER QUÈ VIU FORA DE L'HTML. Fins al 30 d'octubre de 2026 era un <script>
// en línia de curador.html. Fora, la pàgina pot tenir una CSP que només deixa
// executar fitxers del mateix lloc (script-src 'self'): cap codi injectat
// a la pàgina no s'hi executa, ni cap enllaç javascript:. És la pàgina que
// té el testimoni amb permís d'escriptura, i és al mateix origen que el web
// públic. Per la mateixa raó, NO s'hi pot tornar a posar codi en línia: la
// CSP de curador.html el bloquejaria.
//
// Node la prova sencera a través de proves/curador-pagina.js, que carrega els
// <script src> de la pàgina en l'ordre del document.
// ---------------------------------------------------------------------------

// ============================================================
// Coordenades fixes del repositori. Si el repositori es mou o es
// canvia de branca, es canvia aquí i enlloc més.
// ============================================================
var GITHUB_OWNER = 'CLMVallespir';
var GITHUB_REPO = 'agenda-catalogne-nord';
var GITHUB_BRANCH = 'main';
var FITXER_PENDENTS = 'pendents.json';
var FITXER_EVENTS = 'events.json';

// Els valors permesos dels dos camps d'enumeració (§4 de CLAUDE.md).
var COMARCA_VALUES = ['Rosselló', 'Conflent', 'Vallespir', 'Capcir', 'Cerdanya'];
var CATEGORIA_VALUES = [
  'Música',
  'Teatre',
  'Dansa i ball',
  'Conferència',
  'Exposició',
  'Mercat',
  'Cinema',
  'Taller',
  'Activitat infantil',
  'Patrimoni i tradicions',
  'Concentració',
  'Esports',
  'Vida associativa'
];

// Icona de reserva quan un acte no porta cartell, presa del web públic.
var ICONA_SENSE_CARTELL = '<svg viewBox="0 0 24 24" focusable="false"><rect x="4" y="5" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 9h16M8.5 3v4M15.5 3v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

// El testimoni viu només aquí, en memòria, mentre la pestanya és oberta.
var TESTIMONI = '';

// La cua tal com s'ha llegit l'últim cop. Serveix per retrobar una fila
// al fitxer fresc abans d'escriure-hi.
var CUA = [];

// Les decisions (publicar, rebutjar) que esperen torn per desar-se, i si
// la pàgina està escrivint ara mateix. Les escriptures van D'UNA EN UNA:
// cada una és un commit a main, i dues alhora topen entre elles (409).
// Vegeu encuaDecisio().
var DECISIONS_EN_ESPERA = [];
var DESANT = false;

// L'última versió que aquesta pàgina ha escrit de cada fitxer, amb el sha
// que GitHub hi ha tornat: { 'pendents.json': { dades, sha }, ... }. La
// següent escriptura del mateix fitxer en parteix sense tornar-lo a
// llegir: l'API de lectura pot servir una còpia de fa fins a 60 segons.
var DARRERA_ESCRIPTURA = {};

// Les pauses abans de cada reintent quan GitHub diu que el fitxer ha
// canviat (409 o 422): quatre intents en total, uns set segons com a
// màxim. Prou perquè acabi l'escriptura de l'Action o d'una altra
// pestanya que se'ns hagi avançat.
var ESPERES_CONFLICTE_MS = [1000, 2000, 4000];

// La pujada de cartells a Cloudinary en publicar (D-07 de NOTES.md):
// unsigned, amb el mateix preset que el Worker. Res d'això no és secret:
// el nom del cloud surt a cada imatge del web públic.
var CLOUDINARY_CLOUD = 'clm-agenda';
var CLOUDINARY_PRESET = 'agenda-posters';

// Quant s'espera una pujada abans de donar-la per perduda. Cloudinary ha
// d'anar a buscar la imatge a casa d'un tercer, i no és instantani.
var TEMPS_MAXIM_PUJADA_MS = 30000;

// ------------------------------------------------------------
// Còpia literal de creaId (worker/worker.js). El sistema sempre
// reconstrueix l'id, mai es refia del que porti la fila.
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

// ------------------------------------------------------------
// Còpia literal de valorPermes (worker/worker.js).
// Torna el valor si és a la llista permesa, si no "".
// ------------------------------------------------------------
function valorPermes(valor, llistaPermesa) {
  if (llistaPermesa.indexOf(valor) === -1) {
    return '';
  }
  return valor;
}

// ------------------------------------------------------------
// Les capçaleres de cada crida a l'API de GitHub. Sense testimoni
// s'hi va igualment: el repositori és públic i la lectura funciona.
// ------------------------------------------------------------
function capcaleresGitHub() {
  var capcaleres = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (TESTIMONI !== '') {
    capcaleres['Authorization'] = 'Bearer ' + TESTIMONI;
  }
  return capcaleres;
}

// ------------------------------------------------------------
// Llegeix un fitxer JSON del repositori per l'API de continguts (mai
// de Pages, que serveix còpies endarrerides). Torna { dades, sha }.
//
// El paràmetre `t` no el llegeix GitHub: fa que cada URL sigui nova i
// cap memòria cau entremig no torni la resposta d'una lectura anterior.
// ------------------------------------------------------------
async function llegeixFitxer(nomFitxer) {
  var url = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO +
    '/contents/' + nomFitxer + '?ref=' + GITHUB_BRANCH + '&t=' + Date.now();

  var resposta = await fetch(url, {
    method: 'GET',
    headers: capcaleresGitHub(),
    cache: 'no-store'
  });

  if (!resposta.ok) {
    var detall = await resposta.text();
    throw new Error('No he pogut llegir ' + nomFitxer + ' (codi ' + resposta.status + '). ' + detall);
  }

  var fitxer = await resposta.json();
  return {
    dades: JSON.parse(descodificaBase64(fitxer.content)),
    sha: fitxer.sha
  };
}

// ------------------------------------------------------------
// Escriu un fitxer JSON al repositori amb un sol PUT. Cal el sha
// actual: l'API el demana per acceptar la substitució.
// Torna la resposta ja parsejada, o llança un error clar.
// ------------------------------------------------------------
async function escriuFitxer(nomFitxer, dades, sha, missatgeCommit) {
  var url = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO +
    '/contents/' + nomFitxer;

  var cos = {
    message: missatgeCommit,
    content: codificaBase64(JSON.stringify(dades, null, 2) + '\n'),
    sha: sha,
    branch: GITHUB_BRANCH
  };

  var resposta = await fetch(url, {
    method: 'PUT',
    headers: capcaleresGitHub(),
    body: JSON.stringify(cos)
  });

  if (!resposta.ok) {
    var detall = await resposta.text();
    throw new Error('GitHub ha rebutjat l\'escriptura de ' + nomFitxer +
      ' (codi ' + resposta.status + '). ' + detall);
  }

  return await resposta.json();
}

// ------------------------------------------------------------
// Aplica una transformació a un fitxer i el torna a escriure. Parteix
// de l'última versió que aquesta pàgina hi ha escrit, si n'hi ha, i si
// no, el llegeix.
//
// Si un altre escriptor s'hi ha avançat (conflicte de sha), espera, el
// torna a llegir i ho reintenta, fins a ESPERES_CONFLICTE_MS.length
// vegades. La transformació es torna a fer cada cop sobre el fitxer
// fresc: per això no ha de tocar mai la llista que rep.
//
// `missatgeCommit` pot ser un text o una funció que el torni; la funció
// es crida DESPRÉS de la transformació, perquè el missatge d'un lot
// només nomeni les decisions que s'escriuen de debò.
// ------------------------------------------------------------
async function desaAmbReintent(nomFitxer, transforma, missatgeCommit) {
  var reintents = 0;

  while (true) {
    var actual = DARRERA_ESCRIPTURA[nomFitxer];
    if (!actual) {
      actual = await llegeixFitxer(nomFitxer);
    }

    var nouContingut = transforma(actual.dades);
    var missatge = missatgeCommit;
    if (typeof missatgeCommit === 'function') {
      missatge = missatgeCommit();
    }

    try {
      var resposta = await escriuFitxer(nomFitxer, nouContingut, actual.sha, missatge);
      recordaEscriptura(nomFitxer, nouContingut, resposta);
      return nouContingut;
    } catch (error) {
      // La versió recordada ja no és la de GitHub: la propera vegada es llegeix.
      delete DARRERA_ESCRIPTURA[nomFitxer];

      // Un conflicte de sha és l'únic error que val la pena reintentar.
      var esConflicte = error.message.indexOf('codi 409') !== -1 ||
        error.message.indexOf('codi 422') !== -1;
      if (!esConflicte || reintents >= ESPERES_CONFLICTE_MS.length) {
        throw error;
      }

      await espera(ESPERES_CONFLICTE_MS[reintents]);
      reintents++;
    }
  }
}

// ------------------------------------------------------------
// Recorda el que s'acaba d'escriure i el sha nou que GitHub hi ha
// tornat, perquè la propera escriptura del mateix fitxer no l'hagi de
// tornar a llegir. Si la resposta no porta sha, no recorda res.
// ------------------------------------------------------------
function recordaEscriptura(nomFitxer, dades, resposta) {
  if (resposta && resposta.content && typeof resposta.content.sha === 'string') {
    DARRERA_ESCRIPTURA[nomFitxer] = { dades: dades, sha: resposta.content.sha };
    return;
  }
  delete DARRERA_ESCRIPTURA[nomFitxer];
}

// ------------------------------------------------------------
// Espera els mil·lisegons que se li diguin. Amb 0 no espera gens.
// ------------------------------------------------------------
function espera(ms) {
  if (!(ms > 0)) {
    return Promise.resolve();
  }
  return new Promise(function (resol) { setTimeout(resol, ms); });
}

// ------------------------------------------------------------
// Base64 <-> text, passant per UTF-8. btoa i atob sols trenquen amb
// els accents i les cometes tipogràfiques, que aquí n'hi ha a dojo.
// ------------------------------------------------------------
function codificaBase64(text) {
  var bytes = new TextEncoder().encode(text);
  var binari = '';
  for (var i = 0; i < bytes.length; i++) {
    binari += String.fromCharCode(bytes[i]);
  }
  return btoa(binari);
}

function descodificaBase64(base64) {
  var binari = atob(base64.replace(/\n/g, ''));
  var bytes = new Uint8Array(binari.length);
  for (var i = 0; i < binari.length; i++) {
    bytes[i] = binari.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// ------------------------------------------------------------
// Diu si la pàgina pot escriure. Sense testimoni és només de lectura.
// ------------------------------------------------------------
function potEscriure() {
  return TESTIMONI !== '';
}

// ------------------------------------------------------------
// Escriu el missatge de dalt de tot. La mena és '', 'error' o 'fet'.
// ------------------------------------------------------------
function mostraAvis(text, mena) {
  var avis = document.getElementById('avis-global');
  avis.textContent = text;
  avis.className = 'avis';
  if (mena) {
    avis.classList.add(mena);
  }
}

// ------------------------------------------------------------
// Construeix un camp de text amb la seva etiqueta. Torna l'element
// embolcall, amb l'<input> accessible per data-camp.
// ------------------------------------------------------------
function creaCamp(nomCamp, etiqueta, valor, ample) {
  var embolcall = document.createElement('div');
  embolcall.className = 'camp camp-' + nomCamp;
  if (ample) {
    embolcall.classList.add('ample');
  }

  var etiquetaEl = document.createElement('label');
  etiquetaEl.textContent = etiqueta;
  embolcall.appendChild(etiquetaEl);

  var entrada = document.createElement('input');
  entrada.type = 'text';
  entrada.value = valor;
  entrada.setAttribute('data-camp', nomCamp);
  entrada.disabled = !potEscriure();
  etiquetaEl.appendChild(entrada);

  return embolcall;
}

// ------------------------------------------------------------
// Construeix un desplegable amb la llista de valors permesa, més una
// opció buida per als casos que el curador encara no ha decidit.
// ------------------------------------------------------------
function creaDesplegable(nomCamp, etiqueta, valor, opcions) {
  var embolcall = document.createElement('div');
  embolcall.className = 'camp camp-' + nomCamp;

  var etiquetaEl = document.createElement('label');
  etiquetaEl.textContent = etiqueta;
  embolcall.appendChild(etiquetaEl);

  var selector = document.createElement('select');
  selector.setAttribute('data-camp', nomCamp);
  selector.disabled = !potEscriure();

  var buida = document.createElement('option');
  buida.value = '';
  buida.textContent = '— sense triar —';
  selector.appendChild(buida);

  for (var i = 0; i < opcions.length; i++) {
    var opcio = document.createElement('option');
    opcio.value = opcions[i];
    opcio.textContent = opcions[i];
    selector.appendChild(opcio);
  }

  selector.value = valor;
  etiquetaEl.appendChild(selector);

  return embolcall;
}

// ------------------------------------------------------------
// Construeix una àrea de text (les dues descripcions), sempre ampla.
// ------------------------------------------------------------
function creaArea(nomCamp, etiqueta, valor) {
  var embolcall = document.createElement('div');
  embolcall.className = 'camp camp-' + nomCamp + ' ample';

  var etiquetaEl = document.createElement('label');
  etiquetaEl.textContent = etiqueta;
  embolcall.appendChild(etiquetaEl);

  var area = document.createElement('textarea');
  area.value = valor;
  area.setAttribute('data-camp', nomCamp);
  area.disabled = !potEscriure();
  etiquetaEl.appendChild(area);

  return embolcall;
}

// ------------------------------------------------------------
// Construeix l'avís de nota_curador, si la fila en porta. És el que un
// agent de darrere ha deixat dit sobre AQUESTA fila (títol per
// traduir, municipi que no consta...), no una dada de l'acte: per això
// només es mostra, no s'edita, i no porta data-camp.
//
// Torna null quan no hi ha nota: cap requadre buit a la fitxa.
// ------------------------------------------------------------
function creaNotaCurador(esdeveniment) {
  var nota = '';
  if (typeof esdeveniment.nota_curador === 'string') {
    nota = esdeveniment.nota_curador.trim();
  }

  if (nota === '') {
    return null;
  }

  var avis = document.createElement('div');
  avis.className = 'nota-curador';
  avis.setAttribute('role', 'note');

  var etiqueta = document.createElement('span');
  etiqueta.className = 'etiqueta';
  etiqueta.textContent = 'Avís sobre aquesta fila';
  avis.appendChild(etiqueta);

  var text = document.createElement('span');
  text.className = 'text';
  text.textContent = nota;
  avis.appendChild(text);

  return avis;
}

// ------------------------------------------------------------
// Construeix el bloc del cartell: la imatge que s'obre a mida
// sencera, o el quadre de reserva amb la icona quan no n'hi ha.
// Una adreça que no és http(s) (url-segura.js) no fa cap enllaç:
// surt el quadre de reserva, com si no n'hi hagués.
// ------------------------------------------------------------
function creaCartell(esdeveniment) {
  var marc = document.createElement('div');
  marc.className = 'cartell';

  if (!esUrlSegura(esdeveniment.imatge_url)) {
    marc.classList.add('sense-cartell');
    var icona = document.createElement('span');
    icona.className = 'icona';
    icona.setAttribute('aria-hidden', 'true');
    icona.innerHTML = ICONA_SENSE_CARTELL;
    marc.appendChild(icona);
    return marc;
  }

  var enllac = document.createElement('a');
  enllac.href = esdeveniment.imatge_url;
  enllac.target = '_blank';
  enllac.rel = 'noopener';

  var imatge = document.createElement('img');
  imatge.src = esdeveniment.imatge_url;
  imatge.alt = 'Cartell: ' + esdeveniment.titol;
  imatge.loading = 'lazy';

  enllac.appendChild(imatge);
  marc.appendChild(enllac);
  return marc;
}

// ------------------------------------------------------------
// Construeix la fitxa sencera d'un esdeveniment pendent: cartell,
// camps editables i els dos botons. Torna l'element <article>.
// ------------------------------------------------------------
function creaFitxa(esdeveniment) {
  var fitxa = document.createElement('article');
  fitxa.className = 'fitxa';

  fitxa.appendChild(creaCartell(esdeveniment));

  var cos = document.createElement('div');
  cos.className = 'cos';

  // L'avís va abans dels camps: es llegeix abans de decidir res.
  var notaCurador = creaNotaCurador(esdeveniment);
  if (notaCurador !== null) {
    cos.appendChild(notaCurador);
  }

  var graella = document.createElement('div');
  graella.className = 'graella';
  graella.appendChild(creaCamp('titol', 'Títol', esdeveniment.titol, true));
  graella.appendChild(creaCamp('data_inici', 'Data d’inici', esdeveniment.data_inici));
  graella.appendChild(creaCamp('data_fi', 'Data de fi', esdeveniment.data_fi));
  graella.appendChild(creaCamp('hora', 'Hora', esdeveniment.hora));
  graella.appendChild(creaCamp('lloc', 'Lloc', esdeveniment.lloc));
  graella.appendChild(creaCamp('municipi', 'Municipi', esdeveniment.municipi));
  graella.appendChild(creaDesplegable('comarca', 'Comarca', esdeveniment.comarca, COMARCA_VALUES));
  graella.appendChild(creaDesplegable('categoria', 'Categoria', esdeveniment.categoria, CATEGORIA_VALUES));
  graella.appendChild(creaArea('descripcio_ca', 'Descripció en català', esdeveniment.descripcio_ca));
  graella.appendChild(creaArea('descripcio_fr', 'Descripció en francès', esdeveniment.descripcio_fr));
  graella.appendChild(creaCamp('associacio', 'Associació', esdeveniment.associacio, true));
  graella.appendChild(creaCamp('imatge_url', 'URL del cartell', esdeveniment.imatge_url, true));
  graella.appendChild(creaCamp('font_url', 'URL de la font', esdeveniment.font_url, true));
  graella.appendChild(creaCamp('periodicitat', 'Periodicitat', esdeveniment.periodicitat, true));
  cos.appendChild(graella);

  var identificador = document.createElement('p');
  identificador.className = 'identificador';
  identificador.textContent = 'Identificador en publicar: ' +
    creaId(esdeveniment.data_inici, esdeveniment.titol);
  cos.appendChild(identificador);

  var accions = document.createElement('div');
  accions.className = 'accions';

  var botoPublica = document.createElement('button');
  botoPublica.type = 'button';
  botoPublica.className = 'boto boto-publica';
  botoPublica.textContent = 'Publica';
  botoPublica.disabled = !potEscriure();
  botoPublica.addEventListener('click', function () {
    publica(fitxa, esdeveniment);
  });
  accions.appendChild(botoPublica);

  var botoRebutja = document.createElement('button');
  botoRebutja.type = 'button';
  botoRebutja.className = 'boto boto-rebutja';
  botoRebutja.textContent = 'Rebutja';
  botoRebutja.disabled = !potEscriure();
  botoRebutja.addEventListener('click', function () {
    rebutja(fitxa, esdeveniment);
  });
  accions.appendChild(botoRebutja);

  var avisFitxa = document.createElement('span');
  avisFitxa.className = 'avis';
  avisFitxa.hidden = true;
  avisFitxa.setAttribute('data-avis-fitxa', '');
  accions.appendChild(avisFitxa);

  cos.appendChild(accions);
  fitxa.appendChild(cos);

  // Cada tecla o cada tria refà l'identificador i marca la fitxa com a
  // editada. S'escolten els dos esdeveniments a posta: els camps de text
  // van per 'input' i els desplegables per 'change'.
  function apuntaEdicio() {
    marcaEditada(fitxa);
    var editat = recullFitxa(fitxa, esdeveniment);
    identificador.textContent = 'Identificador en publicar: ' +
      creaId(editat.data_inici, editat.titol);
  }

  fitxa.addEventListener('input', apuntaEdicio);
  fitxa.addEventListener('change', apuntaEdicio);

  return fitxa;
}

// ------------------------------------------------------------
// Llegeix els camps editats d'una fitxa i els torna com un
// esdeveniment complet de 17 camps. Els camps que el sistema omple
// (estat, data_entrada) es queden com eren; l'id es reconstrueix.
// ------------------------------------------------------------
function recullFitxa(fitxa, original) {
  var editat = {};
  var entrades = fitxa.querySelectorAll('[data-camp]');

  for (var i = 0; i < entrades.length; i++) {
    editat[entrades[i].getAttribute('data-camp')] = entrades[i].value.trim();
  }

  return {
    id: creaId(editat.data_inici, editat.titol),
    titol: editat.titol,
    data_inici: editat.data_inici,
    data_fi: editat.data_fi,
    hora: editat.hora,
    lloc: editat.lloc,
    municipi: editat.municipi,
    comarca: valorPermes(editat.comarca, COMARCA_VALUES),
    categoria: valorPermes(editat.categoria, CATEGORIA_VALUES),
    descripcio_ca: editat.descripcio_ca,
    descripcio_fr: editat.descripcio_fr,
    associacio: editat.associacio,
    imatge_url: editat.imatge_url,
    font_url: editat.font_url,
    estat: original.estat,
    data_entrada: original.data_entrada,
    periodicitat: editat.periodicitat
  };
}

// ------------------------------------------------------------
// Escriu un missatge dins d'una fitxa concreta i, si cal, la deixa
// mig apagada i amb els botons bloquejats mentre s'hi treballa. Les
// dues coses van sempre juntes a posta: una fitxa apagada que encara
// es pogués clicar és exactament el forat que això tanca.
// ------------------------------------------------------------
function avisaFitxa(fitxa, text, mena, ocupada) {
  var avis = fitxa.querySelector('[data-avis-fitxa]');
  avis.hidden = (text === '');
  avis.textContent = text;
  avis.className = 'avis';
  if (mena) {
    avis.classList.add(mena);
  }
  fitxa.classList.toggle('ocupada', ocupada === true);
  bloquejaAccions(fitxa, ocupada === true);
}

// ------------------------------------------------------------
// Bloqueja (o desbloqueja) els dos botons d'una fitxa. Es crida abans
// de qualsevol await, perquè un segon clic no pugui engegar una
// segona escriptura mentre la primera encara vola.
//
// Desbloquejar sempre és segur: aquí només s'hi arriba des de
// publica() i rebutja(), que surten abans si no hi ha testimoni.
// ------------------------------------------------------------
function bloquejaAccions(fitxa, bloquejada) {
  var botons = fitxa.querySelectorAll('.accions .boto');
  for (var i = 0; i < botons.length; i++) {
    botons[i].disabled = bloquejada;
  }
}

// ------------------------------------------------------------
// Marca una fitxa com a editada. La marca viu al mateix element: quan
// la fitxa es publica o es rebutja, fitxa.remove() se l'emporta, i per
// això no hi ha cap comptador a part que es pugui desincronitzar.
// ------------------------------------------------------------
function marcaEditada(fitxa) {
  fitxa.setAttribute('data-editada', '');
}

// ------------------------------------------------------------
// Compta les fitxes amb edicions que encara no s'han desat.
// ------------------------------------------------------------
function comptaEdicionsPendents() {
  return document.querySelectorAll('[data-editada]').length;
}

// ------------------------------------------------------------
// Demana permís abans de repintar la cua, perquè repintar-la llença
// les edicions que no s'hagin publicat. Torna cert si es pot
// continuar; sense edicions pendents no pregunta res.
// ------------------------------------------------------------
function potLlencarEdicions() {
  // Repintar mentre es desa tornaria a ensenyar com a pendents les files
  // que la cua d'escriptura encara no ha acabat de desar.
  if (DESANT) {
    mostraAvis('Encara s’estan desant decisions. Espera que acabin i torna-ho a provar.', 'error');
    return false;
  }

  var quantes = comptaEdicionsPendents();
  if (quantes === 0) {
    return true;
  }

  var quines = quantes + ' fitxes tenen';
  if (quantes === 1) {
    quines = '1 fitxa té';
  }

  return window.confirm('Atenció: ' + quines + ' canvis sense desar.\n\n' +
    'La cua es tornarà a carregar i els perdrà. Les correccions només es ' +
    'desen en publicar l’acte.\n\nVols continuar igualment?');
}

// ------------------------------------------------------------
// Publica un acte: l'afegeix a events.json amb estat "publicat" i
// després marca la fila de pendents.json com a publicada (la substitueix
// a la mateixa posició, amb la nota_curador intacta; no la treu).
//
// No escriu res tot sola: posa la decisió a la cua d'escriptura
// (encuaDecisio) i torna quan s'ha desat o ha fallat. Mentrestant el
// curador pot seguir amb la fitxa següent.
// ------------------------------------------------------------
async function publica(fitxa, original) {
  if (!potEscriure()) {
    return;
  }

  var editat = recullFitxa(fitxa, original);

  await encuaDecisio({
    mena: 'publica',
    fitxa: fitxa,
    original: original,
    editat: editat,
    errorEvents: null,
    errorPendents: null
  }, 'Publicant…', 'En cua per publicar…');
}

// ------------------------------------------------------------
// Rebutja un acte amb UNA sola escriptura: li posa estat = 'rebutjat' i
// el deixa a pendents.json. La fila no se suprimeix mai; desapareix de
// la pantalla perquè la cua només pinta les files pendents.
//
// Publicar tampoc no treu la fila: la marca com a publicada (dues
// escriptures, events.json primer). Cap de les dues no suprimeix res.
// ------------------------------------------------------------
async function rebutja(fitxa, original) {
  if (!potEscriure()) {
    return;
  }

  var confirmat = window.confirm('Rebutjar «' + original.titol + '»?\n\n' +
    'Se’n va de la cua però es queda a pendents.json amb estat «rebutjat», ' +
    'perquè no torni a entrar mai més.');
  if (!confirmat) {
    return;
  }

  await encuaDecisio({
    mena: 'rebutja',
    fitxa: fitxa,
    original: original,
    errorPendents: null
  }, 'Rebutjant…', 'En cua per rebutjar…');
}


// --- La cua d'escriptura ------------------------------------------------------
// Cada decisió és un commit a main, i GitHub rebutja (409) un commit fet
// sobre una branca que s'ha mogut mentrestant. Per això les escriptures no
// van mai alhora: una decisió que arriba mentre la pàgina escriu s'espera,
// i quan li toca surt amb TOTES les que s'han acumulat, en un sol commit
// per fitxer (un lot). Amb una sola decisió, les escriptures i els
// missatges de commit són els de sempre.

// ------------------------------------------------------------
// Posa una decisió a la cua d'escriptura i bloqueja la seva fitxa. Si no
// s'està escrivint res, la cua s'engega de seguida. Torna una promesa
// que es resol quan la decisió s'ha desat o ha fallat; no falla mai.
// ------------------------------------------------------------
function encuaDecisio(decisio, textAra, textEnCua) {
  if (DESANT) {
    avisaFitxa(decisio.fitxa, textEnCua, '', true);
  } else {
    avisaFitxa(decisio.fitxa, textAra, '', true);
  }

  var feta = new Promise(function (resol) {
    decisio.acaba = resol;
  });
  DECISIONS_EN_ESPERA.push(decisio);

  if (!DESANT) {
    buidaDecisions();
  }
  return feta;
}

// ------------------------------------------------------------
// Desa lot rere lot fins que no queda cap decisió en espera. Cada lot
// són totes les decisions que s'han acumulat mentre es desava l'anterior.
// ------------------------------------------------------------
async function buidaDecisions() {
  DESANT = true;

  while (DECISIONS_EN_ESPERA.length > 0) {
    var lot = DECISIONS_EN_ESPERA.splice(0, DECISIONS_EN_ESPERA.length);

    try {
      await desaLot(lot);
    } catch (error) {
      // desaLot() ja recull els errors de cada decisió; això només pot ser
      // un error de programa, i no ha de deixar la cua encallada.
      mostraAvis('Error inesperat en desar: ' + error.message, 'error');
    }

    for (var i = 0; i < lot.length; i++) {
      lot[i].acaba();
    }
  }

  DESANT = false;
}

// ------------------------------------------------------------
// Desa un lot de decisions i diu a cada fitxa com ha anat.
//
// L'ordre de les dues escriptures importa i no és casual: primer
// events.json amb totes les publicacions del lot, després pendents.json
// amb totes les marques i tots els rebuigs. Si es marqués la fila abans
// i després fallés events.json, l'acte no seria enlloc; fent-ho al
// revés, una fallada deixa la fila encara pendent a la cua, que és
// recuperable.
// ------------------------------------------------------------
async function desaLot(lot) {
  var publicacions = lot.filter(function (decisio) {
    return decisio.mena === 'publica';
  });

  // Els cartells, abans de cap escriptura: una publicació el cartell de la
  // qual no s'ha pogut copiar surt del lot amb el seu error i no s'escriu.
  await copiaCartells(publicacions);
  var publicables = publicacions.filter(function (decisio) {
    return decisio.errorEvents === null;
  });

  if (publicables.length > 0) {
    await desaPublicacions(publicables);
  }

  // A pendents.json hi van els rebuigs i les publicacions que ja són a
  // events.json; una publicació que hi ha fallat no s'hi marca.
  var aLaCua = lot.filter(function (decisio) {
    return decisio.mena === 'rebutja' || decisio.errorEvents === null;
  });

  if (aLaCua.length > 0) {
    await desaALaCua(aLaCua);
  }

  for (var i = 0; i < lot.length; i++) {
    if (lot[i].mena === 'publica') {
      acabaPublicacio(lot[i]);
    } else {
      acabaRebuig(lot[i]);
    }
  }
}

// ------------------------------------------------------------
// Copia a Cloudinary el cartell de cada publicació del lot que encara no
// hi és. Si va bé, l'acte es publica amb la còpia; si no, la decisió es
// queda amb `errorEvents` i no s'escriu: el curador ho torna a provar o
// buida el camp i publica sense cartell. Mai no es publica un cartell
// d'un tercer (la miniatura de 150 px de l'ADT66, per exemple).
// ------------------------------------------------------------
async function copiaCartells(publicacions) {
  for (var i = 0; i < publicacions.length; i++) {
    var decisio = publicacions[i];
    var cartell = decisio.editat.imatge_url;

    if (cartell === '' || esDelNostreCloudinary(cartell, CLOUDINARY_CLOUD)) {
      continue;
    }

    avisaFitxa(decisio.fitxa, 'Copiant el cartell a Cloudinary…', '', true);
    var resultat = await copiaCartell(cartell);

    if (resultat.url !== '') {
      decisio.editat.imatge_url = resultat.url;
      avisaFitxa(decisio.fitxa, 'Publicant…', '', true);
    } else {
      decisio.errorEvents = new Error('No s’ha pogut copiar el cartell a Cloudinary (' +
        resultat.motiu + '). Torna-ho a provar, o buida «URL del cartell» per publicar sense cartell.');
    }
  }
}

// ------------------------------------------------------------
// Prova les adreces del cartell en ordre (variantsDeCartell, a
// curador-cua.js) i torna { url, motiu } de la primera que va bé, o el
// motiu de l'última que ha fallat.
// ------------------------------------------------------------
async function copiaCartell(urlOrigen) {
  var variants = variantsDeCartell(urlOrigen);
  var resultat = { url: '', motiu: 'no hi ha cap adreça per provar' };

  for (var i = 0; i < variants.length; i++) {
    resultat = await pujaACloudinary(variants[i]);
    if (resultat.url !== '') {
      return resultat;
    }
  }
  return resultat;
}

// ------------------------------------------------------------
// Una pujada unsigned: Cloudinary va a buscar la imatge a l'adreça i en
// torna la còpia. Es demana `secure_url` (https), no `url` (http). No
// llança mai: torna { url, motiu }.
// ------------------------------------------------------------
async function pujaACloudinary(urlOrigen) {
  var formulari = new FormData();
  formulari.append('file', urlOrigen);
  formulari.append('upload_preset', CLOUDINARY_PRESET);

  var resposta = null;
  try {
    resposta = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/image/upload', {
      method: 'POST',
      body: formulari,
      signal: AbortSignal.timeout(TEMPS_MAXIM_PUJADA_MS)
    });
  } catch (error) {
    return { url: '', motiu: 'Cloudinary no respon: ' + error.message };
  }

  var dades = null;
  try {
    dades = await resposta.json();
  } catch (error) {
    return { url: '', motiu: 'Cloudinary ha respost ' + resposta.status + ' sense JSON' };
  }

  if (!resposta.ok) {
    var detall = '';
    if (dades && dades.error && typeof dades.error.message === 'string') {
      detall = ': ' + dades.error.message;
    }
    return { url: '', motiu: 'Cloudinary ha respost ' + resposta.status + detall };
  }

  if (!dades || typeof dades.secure_url !== 'string' || dades.secure_url === '') {
    return { url: '', motiu: 'Cloudinary no ha tornat cap adreça' };
  }
  return { url: dades.secure_url, motiu: '' };
}

// ------------------------------------------------------------
// La data d'avui al rellotge del navegador, AAAA-MM-DD: la mateixa
// vora amb què app.js amaga els actes passats al web.
// ------------------------------------------------------------
function avuiLocal() {
  var ara = new Date();
  var mes = String(ara.getMonth() + 1).padStart(2, '0');
  var dia = String(ara.getDate()).padStart(2, '0');
  return ara.getFullYear() + '-' + mes + '-' + dia;
}

// ------------------------------------------------------------
// Afegeix a events.json, en un sol commit, tots els actes publicats del
// lot. Deixa a cada decisió el seu `errorEvents` (null si s'ha escrit).
//
// afegeixAPublicats() (curador-cua.js) no escriu un id que ja hi sigui, i
// ho comprova dins la transformació perquè el reintent la torni a fer.
//
// Al mateix commit treu d'events.json els actes que ja han passat (D-08,
// podaEventsPassats() a curador-cua.js), i el missatge diu quants. Si
// no es pot publicar cap acte del lot, no s'escriu res, ni la poda.
// ------------------------------------------------------------
async function desaPublicacions(publicacions) {
  var combinada = combinaTransformacions(publicacions.map(function (decisio) {
    return afegeixAPublicats(decisio.editat);
  }));

  var avui = avuiLocal();
  var passats = [];
  var transforma = function (events) {
    var poda = podaEventsPassats(events, avui);
    passats = poda.passats;
    return combinada.transforma(poda.vius);
  };

  var missatge = function () {
    var text = missatgeDeLot('Publica ' + publicacions.length + ' actes',
      liniesBones(publicacions, combinada.errors, function (decisio) {
        return 'Publica ' + decisio.editat.titol;
      }));
    if (passats.length === 1) {
      text = text + '\n\nTreu d’events.json 1 acte que ja ha passat (D-08).';
    } else if (passats.length > 1) {
      text = text + '\n\nTreu d’events.json ' + passats.length + ' actes que ja han passat (D-08).';
    }
    return text;
  };

  var errorDelFitxer = null;
  try {
    await desaAmbReintent(FITXER_EVENTS, transforma, missatge);
  } catch (error) {
    errorDelFitxer = error;
  }

  for (var i = 0; i < publicacions.length; i++) {
    publicacions[i].errorEvents = errorDeLaDecisio(combinada.errors[i], errorDelFitxer);
  }
}

// ------------------------------------------------------------
// Escriu a pendents.json, en un sol commit, les marques de publicada i
// els rebuigs del lot. Deixa a cada decisió el seu `errorPendents`.
// ------------------------------------------------------------
async function desaALaCua(decisions) {
  var combinada = combinaTransformacions(decisions.map(function (decisio) {
    if (decisio.mena === 'publica') {
      return substitueixPerPublicada(decisio.original,
        creaFilaPublicada(decisio.editat, decisio.original));
    }
    return marcaRebutjadaALaCua(decisio.original);
  }));

  var missatge = function () {
    return missatgeDeLot('Cua del curador: ' + decisions.length + ' decisions',
      liniesBones(decisions, combinada.errors, function (decisio) {
        if (decisio.mena === 'publica') {
          return 'Marca com a publicada ' + decisio.editat.titol;
        }
        return 'Rebutja ' + decisio.original.titol;
      }));
  };

  var errorDelFitxer = null;
  try {
    await desaAmbReintent(FITXER_PENDENTS, combinada.transforma, missatge);
  } catch (error) {
    errorDelFitxer = error;
  }

  for (var i = 0; i < decisions.length; i++) {
    decisions[i].errorPendents = errorDeLaDecisio(combinada.errors[i], errorDelFitxer);
  }
}

// ------------------------------------------------------------
// Les línies del missatge de commit, només de les decisions que la
// transformació ha pogut aplicar.
// ------------------------------------------------------------
function liniesBones(decisions, errors, linia) {
  var linies = [];
  for (var i = 0; i < decisions.length; i++) {
    if (errors[i] === null) {
      linies.push(linia(decisions[i]));
    }
  }
  return linies;
}

// ------------------------------------------------------------
// L'error que toca a una decisió del lot: el seu propi, si la seva peça
// ha petat; si no, el del fitxer, si l'escriptura ha fallat; si no, null.
// Si el fitxer no s'ha arribat a llegir, la peça no té error propi
// (undefined) i val el del fitxer.
// ------------------------------------------------------------
function errorDeLaDecisio(errorPropi, errorDelFitxer) {
  if (errorPropi) {
    return errorPropi;
  }
  return errorDelFitxer;
}

// ------------------------------------------------------------
// Diu a la fitxa i a dalt de tot com ha anat una publicació, i la treu
// de la pantalla si l'acte ja és a events.json.
// ------------------------------------------------------------
function acabaPublicacio(decisio) {
  var fitxa = decisio.fitxa;
  var editat = decisio.editat;
  var error = decisio.errorEvents;

  if (error) {
    // No s'ha escrit res i la fila segueix a la cua, tant si l'id ja hi
    // era com si l'escriptura ha fallat. El que canvia és què cal fer-hi.
    if (error.message.indexOf(JA_PUBLICAT) === 0) {
      // La fila es queda a la cua perquè el curador decideixi: rebutjar-la,
      // o canviar-li la data o el títol si de debò és un acte diferent que
      // ha topat amb el mateix id.
      avisaFitxa(fitxa, error.message + ' Rebutja la fila si sobra.', '', false);
      mostraAvis(error.message, '');
      return;
    }
    avisaFitxa(fitxa, 'No s’ha publicat. ' + error.message, 'error', false);
    mostraAvis('La publicació ha fallat. L’acte segueix a la cua.', 'error');
    return;
  }

  // A partir d'aquí l'acte JA és a events.json. Si la marca ha fallat, el
  // que queda és un duplicat a la cua, i cal dir-ho tal com és.
  var errorCua = decisio.errorPendents;
  if (errorCua && errorCua.message !== JA_NO_HI_ES) {
    avisaFitxa(fitxa, 'Publicat a events.json, però no l’he pogut marcar com a publicada a la cua: ' +
      errorCua.message + ' Torna a carregar la cua i rebutja aquesta fila.', 'error', false);
    mostraAvis('Publicat a mitges: mira el missatge de la fitxa.', 'error');
    return;
  }

  fitxa.remove();
  CUA = treuDeLaCua(CUA, decisio.original);
  actualitzaRecompte();

  // Algú altre l'ha tocat a la cua mentre es publicava. L'acte s'ha
  // publicat igualment, però això no es pot dir en silenci: la cua ha
  // canviat sota els peus i val més que el curador ho sàpiga.
  if (errorCua) {
    mostraAvis('Publicat: ' + editat.titol + ' (' + editat.id + '). La fila ja no era ' +
      'a la cua: algú altre l’ha tocada mentre es publicava. Torna a carregar la cua.', '');
    return;
  }

  mostraAvis('Publicat: ' + editat.titol, 'fet');
}

// ------------------------------------------------------------
// Diu a la fitxa i a dalt de tot com ha anat un rebuig, i la treu de la
// pantalla si s'ha desat.
// ------------------------------------------------------------
function acabaRebuig(decisio) {
  var fitxa = decisio.fitxa;
  var error = decisio.errorPendents;

  if (error) {
    avisaFitxa(fitxa, error.message, 'error', false);
    mostraAvis('El rebuig ha fallat. Mira el missatge de la fitxa.', 'error');
    return;
  }

  fitxa.remove();
  CUA = treuDeLaCua(CUA, decisio.original);
  actualitzaRecompte();
  mostraAvis('Rebutjat: ' + decisio.original.titol, 'fet');
}

// ------------------------------------------------------------
// Refà la línia del recompte a partir de la cua que hi ha en pantalla.
// ------------------------------------------------------------
function actualitzaRecompte() {
  var recompte = document.getElementById('recompte');
  var missatge = document.getElementById('missatge-estat');

  if (CUA.length === 0) {
    recompte.hidden = true;
    missatge.hidden = false;
    missatge.textContent = 'La cua és buida.';
    return;
  }

  recompte.hidden = false;
  missatge.hidden = true;
  if (CUA.length === 1) {
    recompte.textContent = '1 acte pendent';
  } else {
    recompte.textContent = CUA.length + ' actes pendents';
  }
}

// ------------------------------------------------------------
// Llegeix pendents.json i el pinta sencer. És també el que es crida
// per tornar a carregar i quan s'activa el testimoni (perquè els
// camps deixin d'estar bloquejats).
// ------------------------------------------------------------
async function carregaCua() {
  var llista = document.getElementById('llista-pendents');
  var missatge = document.getElementById('missatge-estat');

  llista.innerHTML = '';
  document.getElementById('recompte').hidden = true;
  missatge.hidden = false;
  missatge.textContent = 'Carregant la cua…';

  try {
    var fitxer = await llegeixFitxer(FITXER_PENDENTS);

    // filesPendents() (curador-cua.js): només 'pendent', mai «tot menys
    // rebutjat». Les altres files continuen al fitxer i no tornen a la cua.
    CUA = filesPendents(fitxer.dades);

    for (var i = 0; i < CUA.length; i++) {
      llista.appendChild(creaFitxa(CUA[i]));
    }

    actualitzaRecompte();
  } catch (error) {
    missatge.hidden = false;
    missatge.textContent = 'No he pogut carregar la cua.';
    mostraAvis(error.message, 'error');
  }
}

// ------------------------------------------------------------
// Torna a carregar la cua a petició del curador, però pregunta abans
// si hi ha edicions sense desar: el repintat se les emporta.
// ------------------------------------------------------------
function recarregaLaCua() {
  if (!potLlencarEdicions()) {
    return;
  }

  carregaCua();
}

// ------------------------------------------------------------
// Guarda el testimoni en memòria i repinta la cua perquè els camps
// i els botons quedin actius. No el desa enlloc: en tancar la
// pestanya, desapareix.
// ------------------------------------------------------------
function activaTestimoni() {
  // Activar o canviar el testimoni repinta la cua, i repintar llença les
  // edicions: es demana permís abans de tocar res, també el testimoni.
  if (!potLlencarEdicions()) {
    return;
  }

  var camp = document.getElementById('camp-testimoni');
  var valor = camp.value.trim();

  if (valor === '') {
    TESTIMONI = '';
    mostraAvis('Només lectura: sense testimoni no es pot publicar ni rebutjar res.', '');
    carregaCua();
    return;
  }

  TESTIMONI = valor;
  camp.value = '';
  camp.placeholder = 'Testimoni actiu en aquesta sessió';
  mostraAvis('Escriptura activada. El testimoni viu només en aquesta pestanya.', 'fet');
  carregaCua();
}

// ------------------------------------------------------------
// Diu si la pàgina s'ha obert dins d'un marc (<iframe>) d'una altra.
// ------------------------------------------------------------
function estaDinsDUnMarc() {
  return window.top !== window.self;
}

// ------------------------------------------------------------
// Engega la pàgina: lliga els dos botons de dalt i carrega la cua.
// ------------------------------------------------------------
function inicia() {
  // DINS D'UN MARC, LA PÀGINA NO ARRENCA. Una altra web la podria posar dins
  // un <iframe> invisible i fer-hi clicar «Publica» a cegues (clickjacking).
  // GitHub Pages no pot enviar X-Frame-Options, i la CSP en <meta> no admet
  // frame-ancestors: la defensa és no lligar cap botó ni carregar res.
  if (estaDinsDUnMarc()) {
    mostraAvis('Aquesta pàgina no funciona dins d’un marc: obre-la directament.', 'error');
    document.getElementById('missatge-estat').textContent = '';
    return;
  }

  // L'avís el posa sempre el codi, mai només el marcatge: així no pot dir
  // una cosa mentre la pàgina en fa una altra.
  mostraAvis('Només lectura: sense testimoni no es pot publicar ni rebutjar res.', '');

  document.getElementById('boto-testimoni').addEventListener('click', activaTestimoni);
  document.getElementById('boto-recarrega').addEventListener('click', recarregaLaCua);
  document.getElementById('camp-testimoni').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      activaTestimoni();
    }
  });
  carregaCua();
}

inicia();
