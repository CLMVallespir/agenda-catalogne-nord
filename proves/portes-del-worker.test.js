// ---------------------------------------------------------------------------
// PROVES DE LES PORTES DEL WORKER
//
// Les dues portes que escriuen a la cua —el correu (`email()`) i el formulari
// (`fetch()`)— provades de punta a punta en Node, amb el `worker/worker.js` de
// debò i cap servei de debò: GitHub i Claude són falsos i responen el que
// cada prova els diu, i el que el Worker els envia queda apuntat.
//
// COM ES CARREGA EL WORKER. És un mòdul ES que importa './postal-mime.js'. Es
// copien tots dos a una carpeta temporal amb l'extensió .mjs (i l'import
// apuntant a la còpia), i s'importa la còpia. Cap fitxer del repositori no es
// toca. Cada prova carrega un Worker nou.
//
// Ús: node --test proves/portes-del-worker.test.js
// ---------------------------------------------------------------------------

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var os = require('os');
var path = require('path');
var url = require('url');

var CARPETA_WORKER = path.join(__dirname, '..', 'worker');
var SECRET = 'secret-de-prova';


// --- El Worker, a Node ------------------------------------------------------

// Importa una còpia nova del Worker i en torna l'objecte exportat.
async function carregaWorker() {
  var carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'portes-worker-'));
  var postal = fs.readFileSync(path.join(CARPETA_WORKER, 'postal-mime.js'), 'utf8');
  var worker = fs.readFileSync(path.join(CARPETA_WORKER, 'worker.js'), 'utf8')
    .replace("from './postal-mime.js'", "from './postal-mime.mjs'");
  fs.writeFileSync(path.join(carpeta, 'postal-mime.mjs'), postal);
  fs.writeFileSync(path.join(carpeta, 'worker.mjs'), worker);
  var modul = await import(url.pathToFileURL(path.join(carpeta, 'worker.mjs')).href);
  return modul.default;
}

// Les variables del tauler que fan falta a les portes.
function entorn(extres) {
  var env = {
    TYPEBOT_SECRET: SECRET,
    GITHUB_TOKEN: 'token-de-prova',
    ANTHROPIC_API_KEY: 'clau-de-prova',
    ADRECA_ARXIU: 'arxiu@example.org',
    CLOUDINARY_CLOUD_NAME: 'clm-agenda'
  };
  Object.keys(extres || {}).forEach(function (clau) {
    env[clau] = extres[clau];
  });
  return env;
}


// --- Els serveis falsos -----------------------------------------------------

// Una resposta JSON com les de fetch().
function respostaJson(codi, objecte) {
  return new Response(JSON.stringify(objecte), {
    status: codi,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Base64 d'un text UTF-8, com el camp `content` de l'API de GitHub.
function base64(text) {
  return Buffer.from(text, 'utf8').toString('base64');
}

// Substitueix el fetch global. `cua` és el pendents.json que serveix GitHub i
// `extraccio` els camps que torna Claude. Torna el registre de crides.
function simulaServeis(t, opcions) {
  var registre = { lectures: 0, escriptures: [], claude: 0 };
  var cua = opcions.cua || [];

  t.mock.method(globalThis, 'fetch', async function (adreca, init) {
    var metode = (init && init.method) || 'GET';
    if (adreca.indexOf('https://api.github.com/') === 0 && metode === 'GET') {
      registre.lectures++;
      return respostaJson(200, { content: base64(JSON.stringify(cua)), sha: 'sha-' + registre.lectures });
    }
    if (adreca.indexOf('https://api.github.com/') === 0 && metode === 'PUT') {
      var cos = JSON.parse(init.body);
      registre.escriptures.push({
        missatge: cos.message,
        dades: JSON.parse(Buffer.from(cos.content, 'base64').toString('utf8'))
      });
      return respostaJson(200, {});
    }
    if (adreca.indexOf('https://api.anthropic.com/') === 0) {
      registre.claude++;
      registre.textAClaude = JSON.parse(init.body).messages[0].content;
      return respostaJson(200, {
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: JSON.stringify(opcions.extraccio || {}) }]
      });
    }
    throw new Error('crida inesperada a ' + adreca);
  });

  return registre;
}

// Un POST del formulari amb el secret.
function postFormulari(cos) {
  return new Request('https://worker.example/', {
    method: 'POST',
    headers: { 'X-Typebot-Secret': SECRET, 'Content-Type': 'application/json' },
    body: JSON.stringify(cos)
  });
}

// Un correu de Cloudflare: el MIME cru i les dues accions que fa servir email().
function correu(assumpte, cos) {
  var missatge = {
    reenviat: false,
    rebutjat: '',
    raw: 'From: associacio@example.org\r\nTo: agenda@clm.cat\r\nSubject: ' + assumpte +
      '\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n' + cos + '\r\n',
    forward: async function () { missatge.reenviat = true; },
    setReject: function (motiu) { missatge.rebutjat = motiu; }
  };
  return missatge;
}

// Els camps que torna el model, amb els que se li passin a sobre.
function extraccio(extres) {
  var camps = {
    id: '', titol: 'Concert de la cobla', data_inici: '2026-11-21', data_fi: '',
    hora: '18:00', lloc: 'Sala', municipi: 'Ceret', comarca: 'Vallespir',
    categoria: 'Música', descripcio_ca: 'Concert.', descripcio_fr: 'Concert.',
    associacio: 'Cobla', imatge_url: '', font_url: '', estat: '', data_entrada: '',
    periodicitat: ''
  };
  Object.keys(extres || {}).forEach(function (clau) {
    camps[clau] = extres[clau];
  });
  return camps;
}

var CAMPS = require('../eines/fila-segura.js').CAMPS;


// --- La forma de la fila (filaSegura) ---------------------------------------

test('formulari: la fila escrita té els divuit camps i el títol d’una línia', async function (t) {
  var registre = simulaServeis(t, { cua: [] });
  var worker = await carregaWorker();

  var resposta = await worker.fetch(postFormulari({
    titol: 'Ball\nCo-Authored-By: algú <a@b.c>',
    data_inici: '2026-11-14',
    descripcio: 'Ball de plaça.'
  }), entorn());

  assert.equal(resposta.status, 200);
  assert.equal(registre.escriptures.length, 1);
  var escrita = registre.escriptures[0];
  var fila = escrita.dades[0];
  assert.deepEqual(Object.keys(fila), CAMPS);
  assert.equal(fila.titol, 'Ball Co-Authored-By: algú <a@b.c>');
  assert.equal(fila.nota_curador, '');
  assert.equal(escrita.missatge.indexOf('\n'), -1);
});

test('formulari: una data malformada queda buida amb avís, i la tramesa entra', async function (t) {
  var registre = simulaServeis(t, { cua: [] });
  var worker = await carregaWorker();

  var resposta = await worker.fetch(postFormulari({ titol: 'Taller', data_inici: '14/11/2026' }), entorn());

  assert.equal(resposta.status, 200);
  var fila = registre.escriptures[0].dades[0];
  assert.equal(fila.data_inici, '');
  assert.match(fila.nota_curador, /La data d'inici no tenia la forma AAAA-MM-DD/);
});

test('formulari: sense títol ni data continua sent un 400, com abans (D-04)', async function (t) {
  var registre = simulaServeis(t, { cua: [] });
  var worker = await carregaWorker();

  var resposta = await worker.fetch(postFormulari({ lloc: 'Plaça' }), entorn());

  assert.equal(resposta.status, 400);
  assert.equal(registre.escriptures.length, 0);
});

test('correu: la fila escrita té els divuit camps i els sostres', async function (t) {
  var registre = simulaServeis(t, {
    cua: [],
    extraccio: extraccio({ titol: 'Concert\nde la cobla', descripcio_ca: new Array(7001).join('a') })
  });
  var worker = await carregaWorker();
  var missatge = correu('Concert', 'Concert de la cobla el 21 de novembre a Ceret.');

  await worker.email(missatge, entorn(), {});

  assert.equal(missatge.reenviat, true);
  assert.equal(registre.escriptures.length, 1);
  var fila = registre.escriptures[0].dades[0];
  assert.deepEqual(Object.keys(fila), CAMPS);
  assert.equal(fila.titol, 'Concert de la cobla');
  assert.equal(fila.descripcio_ca.length, 6000);
  assert.match(fila.nota_curador, /El camp descripcio_ca passava de 6000 caràcters/);
  assert.equal(fila.estat, 'pendent');
});
