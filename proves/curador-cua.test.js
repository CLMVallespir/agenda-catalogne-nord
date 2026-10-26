// ---------------------------------------------------------------------------
// XARXA DE CARACTERITZACIÓ DE LA CUA DEL CURADOR
//
// Fixa què fa `curador.html` quan el curador publica o rebutja un acte: quines
// escriptures fa, en quin ordre, què hi deixa a `events.json` i a
// `pendents.json`, i què diu en cada fallada. S'executa la pàgina de debò
// (`proves/curador-pagina.js`) contra un GitHub fals.
//
// Una refactorització no en pot canviar la sortida (regla 2 del §6 de
// `docs/COORDINACIO.md`). Escrita i en verd ABANS de moure res de dins de
// l'HTML (ARQ-08): carrega la pàgina tal com és, de manera que val igual
// després.
//
// Ús: node --test proves/curador-cua.test.js
// ---------------------------------------------------------------------------

var test = require('node:test');
var assert = require('node:assert/strict');
var pagina = require('./curador-pagina.js');

var filaPendent = pagina.filaPendent;
var pla = pagina.pla;


// --- Constants --------------------------------------------------------------

var JA_NO_HI_ES = 'La fila ja no era a la cua.';
var JA_PUBLICAT = 'Aquest acte ja estava publicat, no s’ha duplicat.';

// Els disset camps públics: els de la cua menys nota_curador.
var CAMPS_PUBLICS = pagina.CAMPS_DE_CUA.slice(0, 17);


// --- Auxiliars --------------------------------------------------------------

// La fila d'events.json d'un acte: els disset camps, estat «publicat».
function filaEvent(canvis) {
  var fila = filaPendent(canvis);
  var publica = {};
  CAMPS_PUBLICS.forEach(function (nom) {
    publica[nom] = fila[nom];
  });
  publica.estat = 'publicat';
  return publica;
}

// Tres files a la cua: la del mig és la que els tests publiquen o rebutgen.
function tresFiles() {
  return {
    abans: filaPendent({
      id: '2026-11-01-concert-a-ceret', titol: 'Concert a Ceret',
      data_inici: '2026-11-01', data_fi: '2026-11-01'
    }),
    mig: filaPendent({ nota_curador: '[ADT66 id: 42] Municipi que no consta' }),
    despres: filaPendent({
      id: '2026-11-09-mercat-a-arles', titol: 'Mercat a Arles',
      data_inici: '2026-11-09', data_fi: '2026-11-09'
    })
  };
}

// Carrega la pàgina sobre un repositori fals i activa l'escriptura (posa un
// testimoni). Torna { diposit, pag }.
async function preparaPagina(pendents, events) {
  var diposit = pagina.creaDipositFals({ 'pendents.json': pendents, 'events.json': events });
  var pag = await pagina.carregaCurador(diposit);
  pag.ctx.TESTIMONI = 'testimoni-de-prova';
  // Els reintents de conflicte, sense pauses: les proves no han d'esperar.
  pag.ctx.ESPERES_CONFLICTE_MS = [0, 0, 0];
  return { diposit: diposit, pag: pag };
}

// El text exacte que GitHub ha de tenir d'un fitxer JSON.
function textDe(dades) {
  return JSON.stringify(dades, null, 2) + '\n';
}

// Els títols de la cua en pantalla.
function titolsDeLaCua(pag) {
  return pla(pag.ctx.CUA).map(function (fila) {
    return fila.titol;
  });
}


// --- carregaCua: només es pinta el que és pendent ---------------------------

test('carregaCua pinta només les files amb estat «pendent»', async function () {
  var files = [
    filaPendent({ titol: 'Pendent 1' }),
    filaPendent({ titol: 'Rebutjada', estat: 'rebutjat' }),
    filaPendent({ titol: 'Publicada', estat: 'publicat' }),
    filaPendent({ titol: 'Estat estrany', estat: 'revisant' }),
    filaPendent({ titol: 'Pendent 2' })
  ];
  var diposit = pagina.creaDipositFals({ 'pendents.json': files, 'events.json': [] });
  var pag = await pagina.carregaCurador(diposit);

  assert.deepEqual(titolsDeLaCua(pag), ['Pendent 1', 'Pendent 2']);
  assert.equal(pag.element('llista-pendents').fills.length, 2);
  assert.equal(pag.element('recompte').textContent, '2 actes pendents');
});


// --- Publica ----------------------------------------------------------------

test('publica: events.json primer i després pendents.json, la fila substituïda al seu lloc', async function () {
  var f = tresFiles();
  var antics = [filaEvent({ id: '2026-10-30-altre-acte', titol: 'Altre acte' })];
  var p = await preparaPagina([f.abans, f.mig, f.despres], antics);

  // El curador corregeix l'hora i la comarca abans de publicar.
  var camps = pagina.campsEditables(f.mig);
  camps.hora = '20:30';
  camps.comarca = 'Capcir';
  var fitxa = pagina.creaFitxaFalsa(camps);

  await p.pag.ctx.publica(fitxa, f.mig);

  assert.deepEqual(p.diposit.registre, [
    'GET events.json', 'PUT events.json', 'GET pendents.json', 'PUT pendents.json'
  ]);
  assert.deepEqual(p.diposit.commits, ['Publica Ball a Prats', 'Marca com a publicada Ball a Prats']);

  // events.json: l'acte afegit al final, amb els disset camps i estat «publicat».
  var publicadaAEvents = filaEvent({ hora: '20:30', comarca: 'Capcir' });
  assert.equal(p.diposit.text('events.json'), textDe(antics.concat([publicadaAEvents])));
  assert.deepEqual(Object.keys(p.diposit.dades('events.json')[1]), CAMPS_PUBLICS);

  // pendents.json: la fila del mig, a la mateixa posició, publicada i amb la
  // nota_curador intacta. Ni una fila treta.
  var publicadaAPendents = filaPendent({
    hora: '20:30', comarca: 'Capcir', estat: 'publicat',
    nota_curador: '[ADT66 id: 42] Municipi que no consta'
  });
  assert.equal(p.diposit.text('pendents.json'), textDe([f.abans, publicadaAPendents, f.despres]));
  assert.deepEqual(Object.keys(p.diposit.dades('pendents.json')[1]), pagina.CAMPS_DE_CUA);

  // La pantalla: la fitxa se'n va, la cua perd la fila, l'avís diu què ha passat.
  assert.equal(fitxa.retirat, true);
  assert.deepEqual(titolsDeLaCua(p.pag), ['Concert a Ceret', 'Mercat a Arles']);
  assert.equal(p.pag.element('avis-global').textContent, 'Publicat: Ball a Prats');
  assert.equal(p.pag.element('avis-global').className, 'avis fet');
});

test('publica: un id que ja és a events.json no s’escriu res i la fila es queda a la cua', async function () {
  var f = tresFiles();
  var p = await preparaPagina([f.abans, f.mig, f.despres], [filaEvent({})]);
  var fitxa = pagina.creaFitxaFalsa(pagina.campsEditables(f.mig));

  await p.pag.ctx.publica(fitxa, f.mig);

  assert.deepEqual(p.diposit.registre, ['GET events.json']);
  assert.deepEqual(p.diposit.commits, []);
  assert.equal(fitxa.retirat, false);
  assert.equal(fitxa.avis.textContent,
    JA_PUBLICAT + ' Identificador: 2026-11-07-ball-a-prats. Rebutja la fila si sobra.');
  assert.equal(fitxa.avis.className, 'avis');
  assert.equal(fitxa.botons[0].disabled, false);
  assert.equal(fitxa.botons[1].disabled, false);
  assert.equal(p.pag.element('avis-global').textContent,
    JA_PUBLICAT + ' Identificador: 2026-11-07-ball-a-prats.');
  assert.equal(p.pag.element('avis-global').className, 'avis');
});

test('publica: un id buit no identifica ningú, i no bloqueja un acte sense data', async function () {
  var sensePata = filaPendent({ id: '', titol: 'Sense data', data_inici: '', data_fi: '' });
  var jaHiEra = filaEvent({ id: '', titol: 'Un altre sense data', data_inici: '', data_fi: '' });
  var p = await preparaPagina([sensePata], [jaHiEra]);
  var fitxa = pagina.creaFitxaFalsa(pagina.campsEditables(sensePata));

  await p.pag.ctx.publica(fitxa, sensePata);

  assert.deepEqual(p.diposit.registre, [
    'GET events.json', 'PUT events.json', 'GET pendents.json', 'PUT pendents.json'
  ]);
  assert.equal(p.diposit.dades('events.json').length, 2);
  assert.equal(fitxa.retirat, true);
});

test('publica: si algú publica el mateix id enmig d’un conflicte de sha, el reintent no escriu res', async function () {
  var f = tresFiles();
  var p = await preparaPagina([f.mig], []);
  var fitxa = pagina.creaFitxaFalsa(pagina.campsEditables(f.mig));

  // L'altre curador publica l'acte just després que aquesta pàgina hagi llegit events.json.
  p.diposit.alLlegir = function (nom, vegada) {
    if (nom === 'events.json' && vegada === 1) {
      p.diposit.canvia('events.json', [filaEvent({})]);
    }
  };

  await p.pag.ctx.publica(fitxa, f.mig);

  assert.deepEqual(p.diposit.registre, ['GET events.json', 'PUT events.json', 'GET events.json']);
  assert.deepEqual(p.diposit.commits, []);
  assert.equal(p.diposit.dades('events.json').length, 1);
  assert.equal(fitxa.retirat, false);
  assert.equal(fitxa.avis.textContent.indexOf(JA_PUBLICAT), 0);
});

test('publica: un conflicte de sha es reintenta un cop i l’acte s’afegeix al fitxer fresc', async function () {
  var f = tresFiles();
  var p = await preparaPagina([f.mig], []);
  var fitxa = pagina.creaFitxaFalsa(pagina.campsEditables(f.mig));
  var altre = filaEvent({ id: '2026-11-20-altre-acte', titol: 'Altre acte' });

  p.diposit.alLlegir = function (nom, vegada) {
    if (nom === 'events.json' && vegada === 1) {
      p.diposit.canvia('events.json', [altre]);
    }
  };

  await p.pag.ctx.publica(fitxa, f.mig);

  assert.deepEqual(p.diposit.registre, [
    'GET events.json', 'PUT events.json', 'GET events.json', 'PUT events.json',
    'GET pendents.json', 'PUT pendents.json'
  ]);
  assert.equal(p.diposit.text('events.json'), textDe([altre, filaEvent({})]));
  assert.equal(fitxa.retirat, true);
});

test('publica: si events.json no es pot escriure, no es toca pendents.json i l’acte segueix a la cua', async function () {
  var f = tresFiles();
  var p = await preparaPagina([f.abans, f.mig, f.despres], []);
  var fitxa = pagina.creaFitxaFalsa(pagina.campsEditables(f.mig));
  var abans = p.diposit.text('pendents.json');

  p.diposit.fallaPut = function (nom) {
    return nom === 'events.json' ? 500 : null;
  };

  await p.pag.ctx.publica(fitxa, f.mig);

  assert.deepEqual(p.diposit.registre, ['GET events.json', 'PUT events.json']);
  assert.equal(p.diposit.text('pendents.json'), abans);
  assert.equal(fitxa.retirat, false);
  assert.equal(fitxa.avis.textContent,
    'No s’ha publicat. GitHub ha rebutjat l\'escriptura de events.json (codi 500). error simulat');
  assert.equal(fitxa.avis.className, 'avis error');
  assert.equal(p.pag.element('avis-global').textContent,
    'La publicació ha fallat. L’acte segueix a la cua.');
  assert.equal(p.pag.element('avis-global').className, 'avis error');
  assert.equal(p.pag.ctx.CUA.length, 3);
});

test('publica: quatre conflictes de sha seguits són una fallada, no un cinquè intent', async function () {
  var f = tresFiles();
  var p = await preparaPagina([f.mig], []);
  var fitxa = pagina.creaFitxaFalsa(pagina.campsEditables(f.mig));

  p.diposit.fallaPut = function (nom) {
    return nom === 'events.json' ? 409 : null;
  };

  await p.pag.ctx.publica(fitxa, f.mig);

  assert.deepEqual(p.diposit.registre, [
    'GET events.json', 'PUT events.json', 'GET events.json', 'PUT events.json',
    'GET events.json', 'PUT events.json', 'GET events.json', 'PUT events.json'
  ]);
  assert.equal(fitxa.retirat, false);
  assert.equal(fitxa.avis.textContent.indexOf('No s’ha publicat.'), 0);
  assert.equal(fitxa.avis.textContent.indexOf('(codi 409)') > -1, true);
});

test('publica: publicat a events.json però la marca a pendents.json falla, s’avisa a mitges', async function () {
  var f = tresFiles();
  var p = await preparaPagina([f.abans, f.mig, f.despres], []);
  var fitxa = pagina.creaFitxaFalsa(pagina.campsEditables(f.mig));
  var abans = p.diposit.text('pendents.json');

  p.diposit.fallaPut = function (nom) {
    return nom === 'pendents.json' ? 500 : null;
  };

  await p.pag.ctx.publica(fitxa, f.mig);

  assert.deepEqual(p.diposit.registre, [
    'GET events.json', 'PUT events.json', 'GET pendents.json', 'PUT pendents.json'
  ]);
  assert.equal(p.diposit.dades('events.json').length, 1);
  assert.equal(p.diposit.text('pendents.json'), abans);
  assert.equal(fitxa.retirat, false);
  assert.equal(fitxa.avis.textContent,
    'Publicat a events.json, però no l’he pogut marcar com a publicada a la cua: ' +
    'GitHub ha rebutjat l\'escriptura de pendents.json (codi 500). error simulat ' +
    'Torna a carregar la cua i rebutja aquesta fila.');
  assert.equal(fitxa.avis.className, 'avis error');
  assert.equal(p.pag.element('avis-global').textContent,
    'Publicat a mitges: mira el missatge de la fitxa.');
  assert.equal(p.pag.ctx.CUA.length, 3);
});

test('publica: si la fila ja no és a pendents.json, l’acte queda publicat i es diu en veu alta', async function () {
  var f = tresFiles();
  var p = await preparaPagina([f.abans, f.mig, f.despres], []);
  var fitxa = pagina.creaFitxaFalsa(pagina.campsEditables(f.mig));

  // Algú altre ha tocat la fila entre la càrrega de la cua i el clic.
  var tocada = filaPendent({ nota_curador: 'Un altre agent hi ha escrit' });
  p.diposit.canvia('pendents.json', [f.abans, tocada, f.despres]);
  var abans = p.diposit.text('pendents.json');

  await p.pag.ctx.publica(fitxa, f.mig);

  assert.deepEqual(p.diposit.registre, ['GET events.json', 'PUT events.json', 'GET pendents.json']);
  assert.equal(p.diposit.text('pendents.json'), abans);
  assert.equal(p.diposit.dades('events.json').length, 1);
  assert.equal(fitxa.retirat, true);
  assert.equal(p.pag.element('avis-global').textContent,
    'Publicat: Ball a Prats (2026-11-07-ball-a-prats). La fila ja no era a la cua: ' +
    'algú altre l’ha tocada mentre es publicava. Torna a carregar la cua.');
  assert.equal(p.pag.element('avis-global').className, 'avis');
});

test('publica: sense testimoni no fa res', async function () {
  var f = tresFiles();
  var diposit = pagina.creaDipositFals({ 'pendents.json': [f.mig], 'events.json': [] });
  var pag = await pagina.carregaCurador(diposit);
  var fitxa = pagina.creaFitxaFalsa(pagina.campsEditables(f.mig));

  await pag.ctx.publica(fitxa, f.mig);

  assert.deepEqual(diposit.registre, []);
  assert.equal(fitxa.retirat, false);
});


// --- Rebutja ----------------------------------------------------------------

test('rebutja: una sola escriptura, la fila es queda al seu lloc amb estat «rebutjat»', async function () {
  var f = tresFiles();
  var p = await preparaPagina([f.abans, f.mig, f.despres], []);
  var fitxa = pagina.creaFitxaFalsa(pagina.campsEditables(f.mig));
  var eventsAbans = p.diposit.text('events.json');

  await p.pag.ctx.rebutja(fitxa, f.mig);

  assert.deepEqual(p.diposit.registre, ['GET pendents.json', 'PUT pendents.json']);
  assert.deepEqual(p.diposit.commits, ['Rebutja Ball a Prats']);
  assert.equal(p.diposit.text('pendents.json'), textDe([
    f.abans,
    filaPendent({ estat: 'rebutjat', nota_curador: '[ADT66 id: 42] Municipi que no consta' }),
    f.despres
  ]));
  assert.equal(p.diposit.text('events.json'), eventsAbans);

  assert.equal(p.pag.confirmacions.length, 1);
  assert.equal(p.pag.confirmacions[0].indexOf('Rebutjar «Ball a Prats»?'), 0);
  assert.equal(fitxa.retirat, true);
  assert.deepEqual(titolsDeLaCua(p.pag), ['Concert a Ceret', 'Mercat a Arles']);
  assert.equal(p.pag.element('recompte').textContent, '2 actes pendents');
  assert.equal(p.pag.element('avis-global').textContent, 'Rebutjat: Ball a Prats');
  assert.equal(p.pag.element('avis-global').className, 'avis fet');
});

test('rebutja: si el curador no confirma, no s’escriu res', async function () {
  var f = tresFiles();
  var p = await preparaPagina([f.mig], []);
  var fitxa = pagina.creaFitxaFalsa(pagina.campsEditables(f.mig));
  p.pag.respostaConfirm = false;

  await p.pag.ctx.rebutja(fitxa, f.mig);

  assert.deepEqual(p.diposit.registre, []);
  assert.equal(fitxa.retirat, false);
  assert.equal(p.pag.ctx.CUA.length, 1);
});

test('rebutja: si la fila ja no és a pendents.json, es diu a la fitxa i no s’escriu res', async function () {
  var f = tresFiles();
  var p = await preparaPagina([f.abans, f.mig, f.despres], []);
  var fitxa = pagina.creaFitxaFalsa(pagina.campsEditables(f.mig));

  p.diposit.canvia('pendents.json', [f.abans, f.despres]);
  var abans = p.diposit.text('pendents.json');

  await p.pag.ctx.rebutja(fitxa, f.mig);

  assert.deepEqual(p.diposit.registre, ['GET pendents.json']);
  assert.equal(p.diposit.text('pendents.json'), abans);
  assert.equal(fitxa.retirat, false);
  assert.equal(fitxa.avis.textContent, JA_NO_HI_ES);
  assert.equal(fitxa.avis.className, 'avis error');
  assert.equal(p.pag.element('avis-global').textContent,
    'El rebuig ha fallat. Mira el missatge de la fitxa.');
});

test('rebutja: si l’escriptura falla, la fila es queda a la cua', async function () {
  var f = tresFiles();
  var p = await preparaPagina([f.mig], []);
  var fitxa = pagina.creaFitxaFalsa(pagina.campsEditables(f.mig));
  p.diposit.fallaPut = function () {
    return 500;
  };

  await p.pag.ctx.rebutja(fitxa, f.mig);

  assert.equal(fitxa.retirat, false);
  assert.equal(p.pag.ctx.CUA.length, 1);
  assert.equal(fitxa.avis.className, 'avis error');
  assert.equal(p.pag.element('avis-global').className, 'avis error');
});

test('rebutja: sense testimoni no demana confirmació ni escriu res', async function () {
  var f = tresFiles();
  var diposit = pagina.creaDipositFals({ 'pendents.json': [f.mig], 'events.json': [] });
  var pag = await pagina.carregaCurador(diposit);
  var fitxa = pagina.creaFitxaFalsa(pagina.campsEditables(f.mig));

  await pag.ctx.rebutja(fitxa, f.mig);

  assert.deepEqual(diposit.registre, []);
  assert.deepEqual(pag.confirmacions, []);
  assert.equal(fitxa.retirat, false);
});


// --- La cua d'escriptura ----------------------------------------------------

// Una fitxa i la fila que porta, per als tests de diverses decisions.
function fitxaDe(fila) {
  return pagina.creaFitxaFalsa(pagina.campsEditables(fila));
}

test('cua d’escriptura: tres clics seguits fan un commit per fitxer i decisió i després un de sol per al lot', async function () {
  var f = tresFiles();
  var p = await preparaPagina([f.abans, f.mig, f.despres], []);
  var fitxes = [fitxaDe(f.abans), fitxaDe(f.mig), fitxaDe(f.despres)];

  // El primer clic engega l'escriptura; els altres dos arriben mentre vola.
  var fetes = [
    p.pag.ctx.publica(fitxes[0], f.abans),
    p.pag.ctx.publica(fitxes[1], f.mig),
    p.pag.ctx.rebutja(fitxes[2], f.despres)
  ];
  assert.equal(fitxes[1].avis.textContent, 'En cua per publicar…');
  assert.equal(fitxes[2].avis.textContent, 'En cua per rebutjar…');
  assert.equal(fitxes[1].botons[0].disabled, true);
  await Promise.all(fetes);

  // El segon lot parteix de l'última versió escrita: cap lectura més.
  assert.deepEqual(p.diposit.registre, [
    'GET events.json', 'PUT events.json', 'GET pendents.json', 'PUT pendents.json',
    'PUT events.json', 'PUT pendents.json'
  ]);
  assert.deepEqual(p.diposit.commits, [
    'Publica Concert a Ceret',
    'Marca com a publicada Concert a Ceret',
    'Publica Ball a Prats',
    'Cua del curador: 2 decisions\n\nMarca com a publicada Ball a Prats\nRebutja Mercat a Arles'
  ]);

  assert.deepEqual(p.diposit.dades('events.json').map(function (fila) {
    return fila.titol;
  }), ['Concert a Ceret', 'Ball a Prats']);
  assert.deepEqual(p.diposit.dades('pendents.json').map(function (fila) {
    return fila.estat;
  }), ['publicat', 'publicat', 'rebutjat']);
  assert.equal(fitxes[0].retirat && fitxes[1].retirat && fitxes[2].retirat, true);
  assert.equal(p.pag.ctx.CUA.length, 0);
  assert.equal(p.pag.ctx.DESANT, false);
});

test('cua d’escriptura: en un lot, l’acte ja publicat es queda a la cua i els altres s’escriuen', async function () {
  var f = tresFiles();
  var jaHiEra = filaEvent({ id: f.despres.id, titol: f.despres.titol,
    data_inici: f.despres.data_inici, data_fi: f.despres.data_fi });
  var p = await preparaPagina([f.abans, f.mig, f.despres], [jaHiEra]);
  var fitxes = [fitxaDe(f.abans), fitxaDe(f.mig), fitxaDe(f.despres)];

  var fetes = [
    p.pag.ctx.rebutja(fitxes[0], f.abans),
    p.pag.ctx.publica(fitxes[1], f.mig),
    p.pag.ctx.publica(fitxes[2], f.despres)
  ];
  await Promise.all(fetes);

  // El commit del lot només nomena el que s'ha escrit.
  assert.deepEqual(p.diposit.commits, [
    'Rebutja Concert a Ceret',
    'Publica Ball a Prats',
    'Marca com a publicada Ball a Prats'
  ]);
  assert.equal(p.diposit.dades('events.json').length, 2);
  assert.deepEqual(p.diposit.dades('pendents.json').map(function (fila) {
    return fila.estat;
  }), ['rebutjat', 'publicat', 'pendent']);
  assert.equal(fitxes[1].retirat, true);
  assert.equal(fitxes[2].retirat, false);
  assert.equal(fitxes[2].avis.textContent.indexOf(JA_PUBLICAT), 0);
  assert.equal(fitxes[2].botons[0].disabled, false);
  assert.deepEqual(titolsDeLaCua(p.pag), ['Mercat a Arles']);
});

test('cua d’escriptura: dos conflictes i a la tercera va bé, sobre el fitxer fresc', async function () {
  var f = tresFiles();
  var p = await preparaPagina([f.abans, f.mig, f.despres], []);
  var fitxa = fitxaDe(f.mig);

  p.diposit.fallaPut = function (nom, vegada) {
    return nom === 'pendents.json' && vegada <= 2 ? 409 : null;
  };

  await p.pag.ctx.rebutja(fitxa, f.mig);

  assert.deepEqual(p.diposit.registre, [
    'GET pendents.json', 'PUT pendents.json', 'GET pendents.json', 'PUT pendents.json',
    'GET pendents.json', 'PUT pendents.json'
  ]);
  assert.deepEqual(p.diposit.commits, ['Rebutja Ball a Prats']);
  assert.equal(fitxa.retirat, true);
});

test('cua d’escriptura: si un altre escriptor s’hi ha avançat, la versió recordada no val i es torna a llegir', async function () {
  var f = tresFiles();
  var p = await preparaPagina([f.abans, f.mig, f.despres], []);

  await p.pag.ctx.rebutja(fitxaDe(f.abans), f.abans);

  // L'Action escriu pendents.json entre dos clics.
  var actual = p.diposit.dades('pendents.json');
  p.diposit.canvia('pendents.json', actual.concat([filaPendent({ id: 'nova', titol: 'Nova' })]));
  p.diposit.registre.length = 0;

  await p.pag.ctx.rebutja(fitxaDe(f.mig), f.mig);

  assert.deepEqual(p.diposit.registre, ['PUT pendents.json', 'GET pendents.json', 'PUT pendents.json']);
  assert.deepEqual(p.diposit.dades('pendents.json').map(function (fila) {
    return fila.estat;
  }), ['rebutjat', 'rebutjat', 'pendent', 'pendent']);
});

test('cua d’escriptura: mentre es desa, la cua no es pot tornar a carregar', async function () {
  var f = tresFiles();
  var p = await preparaPagina([f.mig], []);

  var feta = p.pag.ctx.rebutja(fitxaDe(f.mig), f.mig);
  p.pag.ctx.recarregaLaCua();

  assert.equal(p.pag.element('avis-global').textContent,
    'Encara s’estan desant decisions. Espera que acabin i torna-ho a provar.');
  await feta;
  assert.deepEqual(p.diposit.registre, ['GET pendents.json', 'PUT pendents.json']);
});


// --- Les peces que canvien l'estat de la cua --------------------------------

test('trobaIndex: la primera coincidència exacta, o -1 si la fila ha canviat', async function () {
  var f = tresFiles();
  var p = await preparaPagina([], []);
  var cua = [f.abans, f.mig, f.despres, f.mig];

  assert.equal(p.pag.ctx.trobaIndex(cua, f.mig), 1);
  assert.equal(p.pag.ctx.trobaIndex(cua, filaPendent({ hora: '22:00', nota_curador: f.mig.nota_curador })), -1);
  assert.equal(p.pag.ctx.trobaIndex([], f.mig), -1);
});

test('idJaPublicat: troba l’id, i un id buit mai no compta', async function () {
  var p = await preparaPagina([], []);
  var events = [filaEvent({ id: '2026-11-07-ball-a-prats' }), filaEvent({ id: '' })];

  assert.equal(p.pag.ctx.idJaPublicat(events, '2026-11-07-ball-a-prats'), true);
  assert.equal(p.pag.ctx.idJaPublicat(events, '2026-11-08-altre'), false);
  assert.equal(p.pag.ctx.idJaPublicat(events, ''), false);
});

test('creaFilaPublicada: divuit camps en ordre, estat «publicat», nota_curador de l’original', async function () {
  var p = await preparaPagina([], []);
  var editat = filaEvent({ hora: '20:30' });
  editat.estat = 'pendent';

  var ambNota = pla(p.pag.ctx.creaFilaPublicada(editat, filaPendent({ nota_curador: 'una nota' })));
  assert.deepEqual(Object.keys(ambNota), pagina.CAMPS_DE_CUA);
  assert.equal(ambNota.estat, 'publicat');
  assert.equal(ambNota.hora, '20:30');
  assert.equal(ambNota.nota_curador, 'una nota');

  // Una fila antiga sense el camp, o amb un valor que no és cadena: cadena buida.
  var senseNota = filaPendent({});
  delete senseNota.nota_curador;
  assert.equal(pla(p.pag.ctx.creaFilaPublicada(editat, senseNota)).nota_curador, '');
  assert.equal(pla(p.pag.ctx.creaFilaPublicada(editat, filaPendent({ nota_curador: null }))).nota_curador, '');
});

test('substitueixPerPublicada: canvia la fila al seu lloc sense tocar la llista original', async function () {
  var f = tresFiles();
  var p = await preparaPagina([], []);
  var pendents = [f.abans, f.mig, f.despres];
  var abans = JSON.stringify(pendents);
  var publicada = filaPendent({ estat: 'publicat', nota_curador: f.mig.nota_curador });

  var nova = pla(p.pag.ctx.substitueixPerPublicada(f.mig, publicada)(pendents));

  assert.deepEqual(nova, pla([f.abans, publicada, f.despres]));
  assert.equal(JSON.stringify(pendents), abans);
});

test('substitueixPerPublicada: si la fila ja no hi és, peta amb el text de sempre', async function () {
  var f = tresFiles();
  var p = await preparaPagina([], []);

  assert.throws(function () {
    p.pag.ctx.substitueixPerPublicada(f.mig, f.mig)([f.abans, f.despres]);
  }, { message: JA_NO_HI_ES });
});

test('marcaRebutjadaALaCua: copia la fila amb estat «rebutjat» sense tocar l’original', async function () {
  var f = tresFiles();
  var p = await preparaPagina([], []);
  var pendents = [f.abans, f.mig, f.despres];
  var abans = JSON.stringify(pendents);

  var nova = pla(p.pag.ctx.marcaRebutjadaALaCua(f.mig)(pendents));

  assert.equal(nova.length, 3);
  assert.deepEqual(nova[1], pla(filaPendent({ estat: 'rebutjat', nota_curador: f.mig.nota_curador })));
  assert.deepEqual([nova[0], nova[2]], pla([f.abans, f.despres]));
  assert.equal(JSON.stringify(pendents), abans);
});

test('marcaRebutjadaALaCua: si la fila ja no hi és, peta amb el text de sempre', async function () {
  var f = tresFiles();
  var p = await preparaPagina([], []);

  assert.throws(function () {
    p.pag.ctx.marcaRebutjadaALaCua(f.mig)([f.abans, f.despres]);
  }, { message: JA_NO_HI_ES });
});
