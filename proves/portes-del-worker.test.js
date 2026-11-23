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

// El text d'un missatge a Claude: el contingut mateix, o el bloc de text si
// és una llista de blocs (el correu hi posa els cartells davant).
function textDelMissatge(contingut) {
  if (typeof contingut === 'string') {
    return contingut;
  }
  return contingut.filter(function (bloc) { return bloc.type === 'text'; })[0].text;
}

// Substitueix el fetch global. `cua` és el pendents.json que serveix GitHub,
// `extraccio` la resposta de Claude quan extreu un correu i `traduccio`
// la que torna quan tradueix el formulari (si val 'falla', respon un 500).
// Cloudinary torna una URL numerada per pujada. Torna el registre de crides.
function simulaServeis(t, opcions) {
  var registre = { lectures: 0, escriptures: [], claude: 0, traduccions: 0, pujades: 0, imatgesAClaude: [] };
  var cua = opcions.cua || [];

  t.mock.method(globalThis, 'fetch', async function (adreca, init) {
    var metode = (init && init.method) || 'GET';
    if (adreca.indexOf('https://api.cloudinary.com/') === 0) {
      registre.pujades++;
      return respostaJson(200, { secure_url: 'https://res.cloudinary.com/clm-agenda/image/upload/cartell-' + registre.pujades + '.webp' });
    }
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
      var peticio = JSON.parse(init.body);
      var claus = Object.keys(peticio.output_config.format.schema.properties);
      if (claus.indexOf('traduccio') !== -1) {
        registre.traduccions++;
        registre.textATraduccio = peticio.messages[0].content;
        if (opcions.traduccio === 'falla') {
          return respostaJson(500, { error: { type: 'api_error' } });
        }
        return respostaJson(200, {
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: JSON.stringify(opcions.traduccio || {}) }]
        });
      }
      registre.claude++;
      registre.textAClaude = textDelMissatge(peticio.messages[0].content);
      if (Array.isArray(peticio.messages[0].content)) {
        registre.imatgesAClaude = peticio.messages[0].content
          .filter(function (bloc) { return bloc.type === 'image'; })
          .map(function (bloc) { return bloc.source.url; });
      }
      if (opcions.extraccio === 'falla') {
        return respostaJson(500, { error: { type: 'api_error' } });
      }
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

// Un correu amb adjunts: un text pla i, per cada adjunt, una part amb el seu
// tipus. `enLinia` marca la part com a imatge en línia (un logotip).
function correuAmbAdjunts(assumpte, cos, adjunts) {
  var frontera = 'frontera-de-prova';
  var parts = [
    '--' + frontera + '\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n' + cos + '\r\n'
  ];
  adjunts.forEach(function (adjunt) {
    var disposicio = adjunt.enLinia ? 'inline' : 'attachment';
    parts.push('--' + frontera + '\r\nContent-Type: ' + adjunt.tipus + '; name="' + adjunt.nom +
      '"\r\nContent-Disposition: ' + disposicio + '; filename="' + adjunt.nom +
      '"\r\nContent-Transfer-Encoding: base64\r\n\r\n' + base64('dades de ' + adjunt.nom) + '\r\n');
  });
  var missatge = correu(assumpte, '');
  missatge.raw = 'From: associacio@example.org\r\nTo: agenda@clm.cat\r\nSubject: ' + assumpte +
    '\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="' + frontera + '"\r\n\r\n' +
    parts.join('') + '--' + frontera + '--\r\n';
  return missatge;
}

// La data d'aquí a `dies` dies (negatiu: fa `dies` dies), AAAA-MM-DD en UTC.
function dataDaquiA(dies) {
  return new Date(Date.now() + dies * 86400000).toISOString().slice(0, 10);
}

// Els 17 camps d'un acte tal com els torna el model, amb els que se li passin
// a sobre.
function acte(extres) {
  var camps = {
    id: '', titol: 'Concert de la cobla', data_inici: dataDaquiA(10), data_fi: '',
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

// La resposta d'extracció amb un sol acte, sense cartell (D-13).
function extraccio(extres) {
  return { esdeveniments: [{ cartell: '', acte: acte(extres) }] };
}

// La resposta d'extracció amb diversos elements: cada un és { cartell, acte }.
function esdeveniments(elements) {
  return { esdeveniments: elements };
}

var CAMPS = require('../eines/fila-segura.js').CAMPS;


// --- La forma de la fila (filaSegura) ---------------------------------------

test('formulari: la fila escrita té els divuit camps i el títol d’una línia', async function (t) {
  var registre = simulaServeis(t, { cua: [] });
  var worker = await carregaWorker();

  var resposta = await worker.fetch(postFormulari({
    titol: 'Ball\nCo-Authored-By: algú <a@b.c>',
    data_inici: '2026-11-14'
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


// --- La traducció del formulari (D-12) --------------------------------------

test('formulari: una descripció en francès entra amb el català i el títol traduïts', async function (t) {
  var registre = simulaServeis(t, {
    cua: [],
    traduccio: { titol: 'Rifle de l\'escola', traduccio: 'Gran rifle anual de l\'escola.' }
  });
  var worker = await carregaWorker();

  var resposta = await worker.fetch(postFormulari({
    titol: 'Rifle de l\'école',
    data_inici: '2026-11-29',
    municipi: 'Sant Genís de Fontanes',
    idioma_descripcio: 'fr',
    descripcio: 'Grande rifle annuelle de l\'école.'
  }), entorn());

  assert.equal(resposta.status, 200);
  assert.equal(registre.traduccions, 1);
  assert.match(registre.textATraduccio, /LLENGUA ORIGINAL: francès\nLLENGUA DE DESTINACIÓ: català/);
  var fila = registre.escriptures[0].dades[0];
  assert.equal(fila.descripcio_fr, 'Grande rifle annuelle de l\'école.');
  assert.equal(fila.descripcio_ca, 'Gran rifle anual de l\'escola.');
  assert.equal(fila.titol, 'Rifle de l\'escola');
  assert.equal(fila.id, '2026-11-29-rifle-de-lescola');
  assert.match(fila.nota_curador, /Descripció catalana traduïda per un model/);
  assert.match(fila.nota_curador, /l'original era «Rifle de l'école»/);
});

test('formulari: una descripció en català entra amb el francès, i el títol intacte', async function (t) {
  var registre = simulaServeis(t, {
    cua: [],
    traduccio: { titol: 'Concert de la coral', traduccio: 'Concert de la chorale.' }
  });
  var worker = await carregaWorker();

  await worker.fetch(postFormulari({
    titol: 'Concert de la coral',
    data_inici: '2026-11-22',
    idioma_descripcio: 'ca',
    descripcio: 'Concert de la coral.'
  }), entorn());

  var fila = registre.escriptures[0].dades[0];
  assert.equal(fila.descripcio_ca, 'Concert de la coral.');
  assert.equal(fila.descripcio_fr, 'Concert de la chorale.');
  assert.equal(fila.titol, 'Concert de la coral');
  assert.equal(fila.nota_curador, 'Descripció francesa traduïda per un model a partir del català de l\'associació. Comprova-la abans de publicar.');
});

test('formulari: si la traducció falla, la tramesa entra igual amb l’avís', async function (t) {
  var registre = simulaServeis(t, { cua: [], traduccio: 'falla' });
  var worker = await carregaWorker();

  var resposta = await worker.fetch(postFormulari({
    titol: 'Rifle',
    data_inici: '2026-11-29',
    idioma_descripcio: 'fr',
    descripcio: 'Grande rifle.'
  }), entorn());

  assert.equal(resposta.status, 200);
  assert.equal(registre.traduccions, 1);
  var fila = registre.escriptures[0].dades[0];
  assert.equal(fila.descripcio_fr, 'Grande rifle.');
  assert.equal(fila.descripcio_ca, '');
  assert.equal(fila.titol, 'Rifle');
  assert.match(fila.nota_curador, /La traducció automàtica de la descripció ha fallat/);
});

test('formulari: si el model no torna traducció, no toca ni el títol', async function (t) {
  var registre = simulaServeis(t, { cua: [], traduccio: { titol: 'Una altra cosa', traduccio: '' } });
  var worker = await carregaWorker();

  await worker.fetch(postFormulari({
    titol: 'Rifle',
    data_inici: '2026-11-29',
    idioma_descripcio: 'fr',
    descripcio: 'Grande rifle.'
  }), entorn());

  var fila = registre.escriptures[0].dades[0];
  assert.equal(fila.titol, 'Rifle');
  assert.equal(fila.descripcio_ca, '');
  assert.match(fila.nota_curador, /La traducció automàtica de la descripció ha fallat/);
});

test('formulari: al sostre del dia no es paga cap traducció', async function (t) {
  var registre = simulaServeis(t, { cua: filesManualsDAvui(MAX_FILES), traduccio: { titol: 'X', traduccio: 'Y' } });
  var worker = await carregaWorker();

  var resposta = await worker.fetch(postFormulari({
    titol: 'Rifle',
    data_inici: '2026-11-29',
    idioma_descripcio: 'fr',
    descripcio: 'Grande rifle.'
  }), entorn());

  assert.equal(resposta.status, 429);
  assert.equal(registre.traduccions, 0);
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


// --- La porta d'entrada (admetEntrada, D-09) --------------------------------

// `quantes` files del correu o del formulari entrades avui (UTC).
function filesManualsDAvui(quantes) {
  var avui = new Date().toISOString().slice(0, 10);
  var llista = [];
  for (var i = 0; i < quantes; i++) {
    llista.push({ titol: 'Fila ' + i, estat: 'pendent', data_entrada: avui + 'T08:00:00.000Z', nota_curador: '' });
  }
  return llista;
}

var MAX_FILES = require('../eines/admet-entrada.js').MAX_FILES_PORTES_PER_DIA;

test('correu: al sostre del dia no es crida Claude ni s’escriu res, i és arxivat', async function (t) {
  var registre = simulaServeis(t, { cua: filesManualsDAvui(MAX_FILES), extraccio: extraccio() });
  var worker = await carregaWorker();
  var missatge = correu('Concert', 'Concert de la cobla.');

  await worker.email(missatge, entorn(), {});

  assert.equal(missatge.reenviat, true);
  assert.equal(registre.lectures, 1);
  assert.equal(registre.claude, 0);
  assert.equal(registre.escriptures.length, 0);
});

test('correu: les files de l’ADT66 d’avui no compten al sostre', async function (t) {
  var cua = filesManualsDAvui(MAX_FILES).map(function (fila) {
    fila.nota_curador = '[ADT66 id: 1] Traduïda.';
    return fila;
  });
  var registre = simulaServeis(t, { cua: cua, extraccio: extraccio() });
  var worker = await carregaWorker();

  await worker.email(correu('Concert', 'Concert de la cobla.'), entorn(), {});

  assert.equal(registre.claude, 1);
  assert.equal(registre.escriptures.length, 1);
});

test('correu: un text llarg arriba tallat al model, i la nota ho diu', async function (t) {
  var registre = simulaServeis(t, { cua: [], extraccio: extraccio() });
  var worker = await carregaWorker();

  await worker.email(correu('Butlletí', new Array(30001).join('b')), entorn(), {});

  // El text del correu va darrere de la línia «CORREU:» del prompt (i el
  // seu salt de línia): no n'hi ha d'haver més de 20 000 caràcters.
  var textEnviat = registre.textAClaude.slice(registre.textAClaude.lastIndexOf('CORREU:') + 'CORREU:'.length);
  assert.ok(textEnviat.length <= 20001, 'al model hi han anat ' + textEnviat.length + ' caràcters');
  var fila = registre.escriptures[0].dades[0];
  assert.match(fila.nota_curador, /El correu passava de 20000 caràcters/);
});

test('correu: sense GITHUB_TOKEN no es paga cap crida a Claude', async function (t) {
  var registre = simulaServeis(t, { cua: [], extraccio: extraccio() });
  var worker = await carregaWorker();
  var missatge = correu('Concert', 'Concert de la cobla.');

  await worker.email(missatge, entorn({ GITHUB_TOKEN: '' }), {});

  assert.equal(missatge.reenviat, true);
  assert.equal(registre.claude, 0);
  assert.equal(registre.escriptures.length, 0);
});

test('formulari: al sostre del dia respon 429 i no escriu res', async function (t) {
  var registre = simulaServeis(t, { cua: filesManualsDAvui(MAX_FILES) });
  var worker = await carregaWorker();

  var resposta = await worker.fetch(postFormulari({ titol: 'Taller', data_inici: '2026-11-14' }), entorn());

  assert.equal(resposta.status, 429);
  assert.equal(registre.escriptures.length, 0);
});

test('formulari: per sota del sostre entra, i llegeix la cua dues vegades', async function (t) {
  var registre = simulaServeis(t, { cua: filesManualsDAvui(MAX_FILES - 1) });
  var worker = await carregaWorker();

  var resposta = await worker.fetch(postFormulari({ titol: 'Taller', data_inici: '2026-11-14' }), entorn());

  assert.equal(resposta.status, 200);
  assert.equal(registre.lectures, 2);
  assert.equal(registre.escriptures.length, 1);
});


// --- Un correu, diversos actes (D-13) ---------------------------------------

test('correu: tres actes fan tres files en un sol commit, per ordre de data', async function (t) {
  var registre = simulaServeis(t, {
    cua: [{ titol: 'Vella', estat: 'pendent', nota_curador: '' }],
    extraccio: esdeveniments([
      { cartell: '', acte: acte({ titol: 'Conferència', data_inici: dataDaquiA(20) }) },
      { cartell: '', acte: acte({ titol: 'Ball', data_inici: dataDaquiA(5) }) },
      { cartell: '', acte: acte({ titol: 'Taller', data_inici: dataDaquiA(12) }) }
    ])
  });
  var worker = await carregaWorker();

  await worker.email(correu('Programa de desembre', 'Tres actes.'), entorn(), {});

  assert.equal(registre.claude, 1);
  assert.equal(registre.escriptures.length, 1);
  var escrita = registre.escriptures[0];
  assert.deepEqual(escrita.dades.map(function (f) { return f.titol; }), ['Ball', 'Taller', 'Conferència', 'Vella']);
  assert.equal(escrita.missatge, '3 files noves a la cua (correu): Ball · Taller · Conferència');
  assert.deepEqual(Object.keys(escrita.dades[0]), CAMPS);
  assert.match(escrita.dades[0].nota_curador, /Correu amb 3 actes \(1 de 3 encuats\)/);
  assert.match(escrita.dades[2].nota_curador, /Correu amb 3 actes \(3 de 3 encuats\)/);
});

test('correu: els actes passats i els que ja són a la cua no entren, i la nota ho diu', async function (t) {
  var dataRepetida = dataDaquiA(8);
  var registre = simulaServeis(t, {
    cua: [{
      id: dataRepetida + '-ball-de-gala', titol: 'Ball de gala', municipi: 'Ceret',
      estat: 'rebutjat', nota_curador: ''
    }],
    extraccio: esdeveniments([
      { cartell: '', acte: acte({ titol: 'Ball de gala', data_inici: dataRepetida }) },
      { cartell: '', acte: acte({ titol: 'Repàs del mes passat', data_inici: dataDaquiA(-15) }) },
      { cartell: '', acte: acte({ titol: 'Concert nou', data_inici: dataDaquiA(9) }) },
      { cartell: '', acte: acte({ titol: 'Concert nou', data_inici: dataDaquiA(9) }) }
    ])
  });
  var worker = await carregaWorker();

  await worker.email(correu('Butlletí', 'Quatre actes.'), entorn(), {});

  var dades = registre.escriptures[0].dades;
  assert.equal(dades.length, 2);
  assert.equal(dades[0].titol, 'Concert nou');
  assert.equal(dades[1].estat, 'rebutjat');
  assert.match(dades[0].nota_curador, /1 ja havien passat, 2 ja eren a la cua/);
});

test('correu: si tots els actes ja hi són, no escriu res', async function (t) {
  var registre = simulaServeis(t, {
    cua: [],
    extraccio: esdeveniments([
      { cartell: '', acte: acte({ titol: 'Repàs', data_inici: dataDaquiA(-3) }) }
    ])
  });
  var worker = await carregaWorker();

  await worker.email(correu('Repàs', 'El mes passat.'), entorn(), {});

  assert.equal(registre.claude, 1);
  assert.equal(registre.escriptures.length, 0);
});

test('correu: cap acte trobat fa una fila buida amb l’avís i l’assumpte', async function (t) {
  var registre = simulaServeis(t, { cua: [], extraccio: esdeveniments([]) });
  var worker = await carregaWorker();

  await worker.email(correu('Confirmeu [la] subscripció', 'Cliqueu aquí.'), entorn(), {});

  var dades = registre.escriptures[0].dades;
  assert.equal(dades.length, 1);
  assert.deepEqual(Object.keys(dades[0]), CAMPS);
  assert.equal(dades[0].titol, '');
  assert.equal(dades[0].estat, 'pendent');
  assert.equal(dades[0].nota_curador, 'El model no hi ha trobat cap acte. Mira l\'original a l\'arxiu: «Confirmeu la subscripció».');
});

test('correu: si Claude falla no s’escriu res, i el correu és arxivat', async function (t) {
  var registre = simulaServeis(t, { cua: [], extraccio: 'falla' });
  var worker = await carregaWorker();
  var missatge = correu('Concert', 'Concert.');

  await worker.email(missatge, entorn(), {});

  assert.equal(missatge.reenviat, true);
  assert.equal(registre.escriptures.length, 0);
});

test('correu: els cartells pugen abans de Claude, el model els veu i cada acte rep el seu', async function (t) {
  var registre = simulaServeis(t, {
    cua: [],
    extraccio: esdeveniments([
      { cartell: '2', acte: acte({ titol: 'Ball', data_inici: dataDaquiA(5) }) },
      { cartell: '9', acte: acte({ titol: 'Taller', data_inici: dataDaquiA(6) }) }
    ])
  });
  var worker = await carregaWorker();
  var missatge = correuAmbAdjunts('Dos actes', 'El ball, i el cartell del taller.', [
    { nom: 'logo.png', tipus: 'image/png', enLinia: true },
    { nom: 'taller.jpg', tipus: 'image/jpeg' },
    { nom: 'ball.pdf', tipus: 'application/pdf' }
  ]);

  await worker.email(missatge, entorn(), {});

  assert.equal(registre.pujades, 2);
  var url1 = 'https://res.cloudinary.com/clm-agenda/image/upload/cartell-1.webp';
  var url2 = 'https://res.cloudinary.com/clm-agenda/image/upload/cartell-2.webp';
  assert.deepEqual(registre.imatgesAClaude, [url1, url2]);
  assert.match(registre.textAClaude, /Cartells adjunts a aquest correu: 2, les imatges que van abans d'aquest text, en aquest ordre: cartell 1, cartell 2\./);
  var dades = registre.escriptures[0].dades;
  assert.equal(dades[0].titol, 'Ball');
  assert.equal(dades[0].imatge_url, url2);
  assert.match(dades[0].nota_curador, /El model hi ha posat el cartell 2 del correu/);
  assert.match(dades[0].nota_curador, new RegExp('El cartell 1 del correu no s\'ha posat a cap acte: ' + url1));
  assert.equal(dades[1].imatge_url, '');
  assert.doesNotMatch(dades[1].nota_curador, /cartell 1 del correu/);
});

test('correu: sense adjunts, el prompt diu que no hi ha cap cartell', async function (t) {
  var registre = simulaServeis(t, { cua: [], extraccio: extraccio() });
  var worker = await carregaWorker();

  await worker.email(correu('Concert', 'Concert.'), entorn(), {});

  assert.equal(registre.pujades, 0);
  assert.deepEqual(registre.imatgesAClaude, []);
  assert.match(registre.textAClaude, /Cartells adjunts a aquest correu: cap\./);
  assert.equal(registre.escriptures[0].dades[0].nota_curador, '');
});

test('correu: al límit del sostre entren els actes més propers, i la nota ho diu', async function (t) {
  var registre = simulaServeis(t, {
    cua: filesManualsDAvui(MAX_FILES - 2),
    extraccio: esdeveniments([
      { cartell: '', acte: acte({ titol: 'Lluny', data_inici: dataDaquiA(30) }) },
      { cartell: '', acte: acte({ titol: 'Aviat', data_inici: dataDaquiA(2) }) },
      { cartell: '', acte: acte({ titol: 'Després', data_inici: dataDaquiA(4) }) }
    ])
  });
  var worker = await carregaWorker();

  await worker.email(correu('Programa', 'Tres actes.'), entorn(), {});

  var noves = registre.escriptures[0].dades.slice(0, 2);
  assert.deepEqual(noves.map(function (f) { return f.titol; }), ['Aviat', 'Després']);
  assert.equal(registre.escriptures[0].dades.length, MAX_FILES);
  assert.match(noves[0].nota_curador, /1 no hi cabien pel sostre del dia/);
});

test('correu: més de deu actes, se n’encuen deu', async function (t) {
  var elements = [];
  for (var i = 0; i < 12; i++) {
    elements.push({ cartell: '', acte: acte({ titol: 'Acte ' + i, data_inici: dataDaquiA(3 + i) }) });
  }
  var registre = simulaServeis(t, { cua: [], extraccio: esdeveniments(elements) });
  var worker = await carregaWorker();

  await worker.email(correu('Programa', 'Dotze actes.'), entorn(), {});

  assert.equal(registre.escriptures[0].dades.length, 10);
});
