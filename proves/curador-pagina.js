// ---------------------------------------------------------------------------
// AJUDANT DE PROVA: LA PÀGINA DEL CURADOR, DINS DE NODE
//
// Carrega els <script> de `curador.html` —els inline i els que porten `src`,
// en l'ordre del document— dins d'un context de `vm`, amb un document fals i
// un GitHub fals. Així `publica()` i `rebutja()` s'executen de debò, sense
// navegador, i el que escriuen es llegeix al GitHub fals.
//
// Carrega la pàgina tal com és, no un fitxer concret: per això la mateixa
// xarxa de proves val abans i després de moure codi de dins de l'HTML a un
// fitxer `curador-*.js` (ARQ-08).
//
// Cap prova no toca xarxa ni fitxers reals: `fetch` és el del GitHub fals.
//
// Compte: tot el que torna el context de `vm` és d'un altre món (els seus
// `Array` i `Error` no són els de Node). Per comparar-ho amb `assert`, passa-ho
// per `pla()`.
// ---------------------------------------------------------------------------

var fs = require('fs');
var path = require('path');
var vm = require('vm');


// --- Constants --------------------------------------------------------------

var ARREL = path.join(__dirname, '..');
var PAGINA = path.join(ARREL, 'curador.html');

// Els divuit camps d'una fila de pendents.json, en l'ordre del §4 de CLAUDE.md.
var CAMPS_DE_CUA = [
  'id', 'titol', 'data_inici', 'data_fi', 'hora', 'lloc', 'municipi', 'comarca',
  'categoria', 'descripcio_ca', 'descripcio_fr', 'associacio', 'imatge_url',
  'font_url', 'estat', 'data_entrada', 'periodicitat', 'nota_curador'
];


// --- Dades ------------------------------------------------------------------

// Una fila de pendents.json amb els divuit camps; `canvis` en sobreescriu alguns.
function filaPendent(canvis) {
  var fila = {
    id: '2026-11-07-ball-a-prats',
    titol: 'Ball a Prats',
    data_inici: '2026-11-07',
    data_fi: '2026-11-07',
    hora: '21:00',
    lloc: 'Sala de festes',
    municipi: 'Prats de Molló',
    comarca: 'Vallespir',
    categoria: 'Dansa i ball',
    descripcio_ca: 'Ball amb orquestra.',
    descripcio_fr: 'Bal avec orchestre.',
    associacio: 'Foment',
    imatge_url: '',
    font_url: '',
    estat: 'pendent',
    data_entrada: '2026-10-20T10:00:00.000Z',
    periodicitat: '',
    nota_curador: ''
  };
  Object.keys(canvis || {}).forEach(function (nom) {
    fila[nom] = canvis[nom];
  });
  return fila;
}

// El que el curador veu als camps editables d'una fila: els catorze camps
// que es poden tocar, tal com els porta la fila.
function campsEditables(fila) {
  var noms = [
    'titol', 'data_inici', 'data_fi', 'hora', 'lloc', 'municipi', 'comarca',
    'categoria', 'descripcio_ca', 'descripcio_fr', 'associacio', 'imatge_url',
    'font_url', 'periodicitat'
  ];
  var camps = {};
  noms.forEach(function (nom) {
    camps[nom] = fila[nom];
  });
  return camps;
}

// Passa un valor del món de `vm` al de Node, per poder-lo comparar.
function pla(valor) {
  return JSON.parse(JSON.stringify(valor));
}


// --- El document fals -------------------------------------------------------

// Un element amb només el que la pàgina fa servir: classes, atributs, fills.
function ElementFals(etiqueta) {
  this.etiqueta = etiqueta;
  this.fills = [];
  this.atributs = {};
  this.classes = [];
  this.textContent = '';
  this.innerHTML = '';
  this.value = '';
  this.hidden = false;
  this.disabled = false;
  this.retirat = false;

  var element = this;
  this.classList = {
    add: function (nom) {
      if (element.classes.indexOf(nom) === -1) {
        element.classes.push(nom);
      }
    },
    toggle: function (nom, activa) {
      var hiEs = element.classes.indexOf(nom) !== -1;
      if (activa === undefined) {
        activa = !hiEs;
      }
      if (activa && !hiEs) {
        element.classes.push(nom);
      }
      if (!activa && hiEs) {
        element.classes.splice(element.classes.indexOf(nom), 1);
      }
    },
    contains: function (nom) {
      return element.classes.indexOf(nom) !== -1;
    }
  };
}

// className i classList són el mateix, com al navegador.
Object.defineProperty(ElementFals.prototype, 'className', {
  get: function () {
    return this.classes.join(' ');
  },
  set: function (text) {
    this.classes = text.split(' ').filter(function (nom) {
      return nom !== '';
    });
  }
});

ElementFals.prototype.appendChild = function (fill) {
  this.fills.push(fill);
  return fill;
};
ElementFals.prototype.setAttribute = function (nom, valor) {
  this.atributs[nom] = valor;
};
ElementFals.prototype.getAttribute = function (nom) {
  if (nom in this.atributs) {
    return this.atributs[nom];
  }
  return null;
};
ElementFals.prototype.addEventListener = function () {};
ElementFals.prototype.remove = function () {
  this.retirat = true;
};
ElementFals.prototype.querySelectorAll = function () {
  return [];
};
ElementFals.prototype.querySelector = function () {
  return null;
};

// Una fitxa feta a mà, amb el que `publica()` i `rebutja()` li demanen:
// els camps editables per `[data-camp]`, els dos botons i l'avís de la fitxa.
function creaFitxaFalsa(camps) {
  var fitxa = new ElementFals('article');
  var avis = new ElementFals('span');
  var botons = [new ElementFals('button'), new ElementFals('button')];
  var entrades = Object.keys(camps).map(function (nom) {
    var entrada = new ElementFals('input');
    entrada.setAttribute('data-camp', nom);
    entrada.value = camps[nom];
    return entrada;
  });

  fitxa.avis = avis;
  fitxa.botons = botons;
  fitxa.querySelectorAll = function (selector) {
    if (selector === '[data-camp]') {
      return entrades;
    }
    if (selector === '.accions .boto') {
      return botons;
    }
    throw new Error('Selector no previst a la fitxa falsa: ' + selector);
  };
  fitxa.querySelector = function (selector) {
    if (selector === '[data-avis-fitxa]') {
      return avis;
    }
    throw new Error('Selector no previst a la fitxa falsa: ' + selector);
  };
  return fitxa;
}


// --- El GitHub fals ---------------------------------------------------------

// Un repositori amb pendents.json i events.json en memòria, que respon com
// l'API de continguts: GET torna contingut + sha; PUT demana el sha actual i
// torna 409 si no coincideix. `fitxers` és { 'events.json': [...], ... }.
//
// Ganxos per provar les carreres i les fallades:
//   alLlegir(nom, vegada)  — després de servir un GET; pot cridar canvia()
//   fallaPut(nom, vegada)  — torna un codi HTTP per fer fallar aquell PUT
//
// També fa de Cloudinary fals per a la pujada de cartells: `cartells` és
// { 'adreça d'origen': 'secure_url' }; una adreça que no hi és respon 400,
// com quan Cloudinary no la pot carregar. Cada pujada queda al registre
// com a 'POST cloudinary <adreça>'.
function creaDipositFals(fitxers) {
  var estat = {};
  var lectures = {};
  var escriptures = {};

  function desa(nom, dades) {
    var versio = 1;
    if (estat[nom]) {
      versio = estat[nom].versio + 1;
    }
    estat[nom] = { text: JSON.stringify(dades, null, 2) + '\n', versio: versio };
  }

  Object.keys(fitxers).forEach(function (nom) {
    desa(nom, fitxers[nom]);
    lectures[nom] = 0;
    escriptures[nom] = 0;
  });

  var diposit = {
    registre: [],
    commits: [],
    alLlegir: null,
    fallaPut: null,
    cartells: {},

    // El text exacte del fitxer, tal com GitHub el tindria.
    text: function (nom) {
      return estat[nom].text;
    },
    dades: function (nom) {
      return JSON.parse(estat[nom].text);
    },
    // Un altre escriptor canvia el fitxer: el sha avança.
    canvia: function (nom, dades) {
      desa(nom, dades);
    }
  };

  diposit.fetch = async function (url, opcions) {
    if (url.indexOf('https://api.cloudinary.com/') === 0) {
      return respostaDeCloudinary(diposit, opcions.body.get('file'));
    }

    var nom = /\/contents\/([^?]+)/.exec(url)[1];
    var metode = opcions.method;
    diposit.registre.push(metode + ' ' + nom);

    if (metode === 'GET') {
      lectures[nom]++;
      var contingut = Buffer.from(estat[nom].text, 'utf8').toString('base64')
        .replace(/(.{60})/g, '$1\n');
      var resposta = resposta200({ content: contingut, sha: 'sha-' + estat[nom].versio });
      if (diposit.alLlegir) {
        diposit.alLlegir(nom, lectures[nom]);
      }
      return resposta;
    }

    escriptures[nom]++;
    var cos = JSON.parse(opcions.body);

    if (diposit.fallaPut) {
      var codi = diposit.fallaPut(nom, escriptures[nom]);
      if (codi) {
        return respostaError(codi, 'error simulat');
      }
    }
    if (cos.sha !== 'sha-' + estat[nom].versio) {
      return respostaError(409, 'el sha no coincideix');
    }

    estat[nom] = {
      text: Buffer.from(cos.content, 'base64').toString('utf8'),
      versio: estat[nom].versio + 1
    };
    diposit.commits.push(cos.message);
    // Com GitHub: la resposta porta el sha nou del fitxer.
    return resposta200({ content: { sha: 'sha-' + estat[nom].versio } });
  };

  return diposit;
}

function resposta200(cos) {
  return {
    ok: true,
    status: 200,
    json: async function () { return cos; },
    text: async function () { return JSON.stringify(cos); }
  };
}

function respostaError(codi, text) {
  return {
    ok: false,
    status: codi,
    json: async function () { return {}; },
    text: async function () { return text; }
  };
}

// El Cloudinary fals: la còpia si l'adreça és a `diposit.cartells`, si no un
// 400 amb el cos d'error que torna Cloudinary.
function respostaDeCloudinary(diposit, origen) {
  diposit.registre.push('POST cloudinary ' + origen);

  if (diposit.cartells[origen]) {
    return resposta200({ secure_url: diposit.cartells[origen] });
  }
  var cos = { error: { message: 'Error in loading ' + origen } };
  return {
    ok: false,
    status: 400,
    json: async function () { return cos; },
    text: async function () { return JSON.stringify(cos); }
  };
}


// --- La pàgina --------------------------------------------------------------

// Carrega curador.html a un context nou, amb `fetch` del GitHub fals, i espera
// que acabi la primera càrrega de la cua. Torna:
//   ctx            el món de la pàgina (funcions i variables globals)
//   element(id)    l'element fals d'aquell id
//   confirmacions  els textos dels window.confirm demanats
//   respostaConfirm  què contesta window.confirm (cert per defecte)
// Amb `opcions.dinsDUnMarc`, la pàgina es carrega com dins d'un <iframe>.
async function carregaCurador(diposit, opcions) {
  var elements = {};
  var pagina = { confirmacions: [], respostaConfirm: true };

  var document = {
    getElementById: function (id) {
      if (!elements[id]) {
        elements[id] = new ElementFals('element');
      }
      return elements[id];
    },
    createElement: function (etiqueta) {
      return new ElementFals(etiqueta);
    },
    querySelectorAll: function () {
      return [];
    }
  };
  var window = {
    confirm: function (text) {
      pagina.confirmacions.push(text);
      return pagina.respostaConfirm;
    }
  };
  // Dins d'un marc, la finestra de dalt de tot és una altra.
  if (opcions && opcions.dinsDUnMarc === true) {
    window.self = window;
    window.top = {};
  }

  var ctx = vm.createContext({
    document: document,
    window: window,
    fetch: diposit.fetch,
    setTimeout: setTimeout,
    URL: URL,
    FormData: FormData,
    AbortSignal: AbortSignal,
    atob: atob,
    btoa: btoa,
    TextEncoder: TextEncoder,
    TextDecoder: TextDecoder
  });

  llegeixScripts().forEach(function (script) {
    vm.runInContext(script.codi, ctx, { filename: script.nom });
  });

  // La primera càrrega de la cua només fa promeses (el fetch és fals): un sol
  // torn del bucle d'esdeveniments les buida totes.
  await new Promise(function (resolt) { setImmediate(resolt); });
  diposit.registre.length = 0;

  pagina.ctx = ctx;
  pagina.element = document.getElementById;
  return pagina;
}

// Els <script> de curador.html en l'ordre del document, cadascun amb el seu
// codi: el del fitxer si porta `src`, el de dins si és inline.
function llegeixScripts() {
  var html = fs.readFileSync(PAGINA, 'utf8');
  var cerca = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  var scripts = [];
  var trobat;

  while ((trobat = cerca.exec(html)) !== null) {
    var src = /src="([^"]+)"/.exec(trobat[1]);
    if (src) {
      scripts.push({ nom: src[1], codi: fs.readFileSync(path.join(ARREL, src[1]), 'utf8') });
    } else {
      scripts.push({ nom: 'curador.html', codi: trobat[2] });
    }
  }
  return scripts;
}


module.exports = {
  CAMPS_DE_CUA: CAMPS_DE_CUA,
  filaPendent: filaPendent,
  campsEditables: campsEditables,
  pla: pla,
  creaFitxaFalsa: creaFitxaFalsa,
  creaDipositFals: creaDipositFals,
  carregaCurador: carregaCurador
};
