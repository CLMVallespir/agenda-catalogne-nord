// =========================================================================
// Agenda cultural — Catalunya Nord
// Carrega events.json, filtra per comarca, categoria i interval de dates,
// i pinta la llista cronològica agrupada per dia. Vanilla JS, sense dependències.
//
// Mode de prova: afegiu ?prova=1 a l'URL per carregar events-exemple.json
// en lloc de events.json (útil per veure l'aspecte abans de publicar res).
//
// El tema (clar/fosc) s'aplica abans de pintar amb un petit script a l'<head>
// de l'index.html; aquí només es gestiona el botó que el canvia.
// =========================================================================

var COMARQUES = ['Rosselló', 'Conflent', 'Vallespir', 'Capcir', 'Cerdanya'];

// Categoria en català (com al full de càlcul) i traducció francesa per al selector.
var CATEGORIES = [
  { ca: 'Música', fr: 'Musique' },
  { ca: 'Teatre', fr: 'Théâtre' },
  { ca: 'Dansa i ball', fr: 'Danse et bal' },
  { ca: 'Conferència', fr: 'Conférence' },
  { ca: 'Exposició', fr: 'Exposition' },
  { ca: 'Mercat', fr: 'Marché' },
  { ca: 'Cinema', fr: 'Cinéma' },
  { ca: 'Taller', fr: 'Atelier' },
  { ca: 'Activitat infantil', fr: 'Jeune public' },
  { ca: 'Patrimoni i tradicions', fr: 'Patrimoine et traditions' }
];

var MESOS_CA = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny',
  'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
var MESOS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
var DIES_CA = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];
var DIES_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// Icones SVG d'interfície (constants).
var ICONA_PIN = '<svg viewBox="0 0 24 24" width="13" height="13" focusable="false"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="currentColor"/></svg>';
var ICONA_LLUNA = '<svg viewBox="0 0 24 24" width="14" height="14" focusable="false"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor"/></svg>';
var ICONA_SOL = '<svg viewBox="0 0 24 24" width="14" height="14" focusable="false"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
// Icones de categoria (substitueixen el cartell quan no n'hi ha).
var CATEGORIA_ICONES = {
  'Música': '<svg viewBox="0 0 24 24" focusable="false"><path d="M9 18V6l10-2v12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="16.5" cy="16" r="2.5" fill="currentColor"/></svg>',
  'Teatre': '<svg viewBox="0 0 24 24" focusable="false"><path d="M5 4h14v6a7 7 0 0 1-14 0z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="9.5" cy="9" r="1" fill="currentColor"/><circle cx="14.5" cy="9" r="1" fill="currentColor"/><path d="M9 13c1.2 1.2 4.8 1.2 6 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  'Dansa i ball': '<svg viewBox="0 0 24 24" focusable="false"><circle cx="14" cy="4.5" r="2" fill="currentColor"/><path d="M14 6.5l-2.5 5.5 3.5 2.5-2 5.5M11.5 12L6 9.5M14 8.5l5 1.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'Conferència': '<svg viewBox="0 0 24 24" focusable="false"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  'Exposició': '<svg viewBox="0 0 24 24" focusable="false"><rect x="3" y="4" width="18" height="16" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8.5" cy="9.5" r="1.5" fill="currentColor"/><path d="M4 17l5-5 4 4 3-3 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  'Mercat': '<svg viewBox="0 0 24 24" focusable="false"><path d="M4 8h16l-1.5 11.5H5.5L4 8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.5 8l3-4.5M15.5 8l-3-4.5M9 12v4M15 12v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  'Cinema': '<svg viewBox="0 0 24 24" focusable="false"><rect x="3" y="8" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 8l3.5-3.5 3 3M10 4.2l3 3M16 4l3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  'Taller': '<svg viewBox="0 0 24 24" focusable="false"><path d="M14 6l4 4M16 4l4 4-2 2-4-4zM14 8l-9 9 1.5 1.5 9-9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  'Activitat infantil': '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 3c3 0 5 2.5 5 6s-2 6-5 6-5-2.5-5-6 2-6 5-6z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 15v3M10.5 21c0-1.5 3-1.5 3-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  'Patrimoni i tradicions': '<svg viewBox="0 0 24 24" focusable="false"><path d="M4 9l8-5 8 5zM6 9v8M10 9v8M14 9v8M18 9v8M4 20h16M5 17h14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
var ICONA_DEFECTE = '<svg viewBox="0 0 24 24" focusable="false"><rect x="4" y="5" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 9h16M8.5 3v4M15.5 3v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

// Estat dels filtres.
var comarcaActiva = 'Totes';
var categoriaActiva = 'Totes';
var dataDesActiva = '';   // 'AAAA-MM-DD' o '' (sense límit inferior)
var dataFinsActiva = '';  // 'AAAA-MM-DD' o '' (sense límit superior)

// Tots els esdeveniments carregats (ja ordenats).
var esdeveniments = [];

// ------------------------------------------------------------------ dades

// Tria el fitxer de dades segons l'URL (mode de prova o producció).
function fitxerDeDades() {
  var params = new URLSearchParams(window.location.search);
  if (params.get('prova') === '1') {
    return 'events-exemple.json';
  }
  return 'events.json';
}

// Carrega el fitxer de dades i pinta la llista; mostra error si falla.
function carregaEsdeveniments() {
  mostraMissatge('S’està carregant l’agenda… · Chargement de l’agenda…');
  fetch(fitxerDeDades(), { cache: 'no-store' })
    .then(function (resposta) {
      if (!resposta.ok) {
        throw new Error('HTTP ' + resposta.status);
      }
      return resposta.json();
    })
    .then(function (dades) {
      esdeveniments = preparaEsdeveniments(dades);
      pintaTot();
    })
    .catch(function (error) {
      console.error('Error carregant les dades:', error);
      mostraMissatge('No s’ha pogut carregar l’agenda. · Impossible de charger l’agenda.');
    });
}

// Filtra els esdeveniments vàlids i futurs, i els ordena cronològicament.
function preparaEsdeveniments(dades) {
  var avui = new Date();
  avui.setHours(0, 0, 0, 0);

  var valids = dades.filter(function (e) {
    var inici = analitzaData(e.data_inici);
    if (inici === null) {
      return false; // sense data no es pot situar a la llista
    }
    var fi = analitzaData(e.data_fi) || inici;
    return fi >= avui; // amaga els esdeveniments ja passats
  });

  // Ordena per data i, a igualtat de data, per hora. Explícit amb if
  // (regla de casa: gens de ternaris encadenats). Bessó de
  // comparaPerDataIHora a sendWeeklyDigest.gs — si toques un, toca l'altre.
  valids.sort(function (a, b) {
    if (a.data_inici < b.data_inici) {
      return -1;
    }
    if (a.data_inici > b.data_inici) {
      return 1;
    }
    if (a.hora < b.hora) {
      return -1;
    }
    if (a.hora > b.hora) {
      return 1;
    }
    return 0;
  });

  return valids;
}

// 'AAAA-MM-DD' → Date (hora local), o null si no és vàlida.
function analitzaData(text) {
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }
  var parts = text.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

// ----------------------------------------------------------------- filtres

// Construeix els botons de comarca i el selector de categoria.
function construeixFiltres() {
  var grup = document.getElementById('filtre-comarques');
  var noms = ['Totes'].concat(COMARQUES);
  noms.forEach(function (nom) {
    var boto = document.createElement('button');
    boto.type = 'button';
    boto.className = 'boto-comarca';
    boto.textContent = nom === 'Totes' ? 'Totes · Toutes' : nom;
    boto.dataset.comarca = nom;
    if (nom === comarcaActiva) {
      boto.classList.add('actiu');
    }
    boto.addEventListener('click', function () {
      comarcaActiva = nom;
      marcaBotoActiu();
      pintaTot();
    });
    grup.appendChild(boto);
  });

  var selector = document.getElementById('selector-categoria');
  var opcioTotes = document.createElement('option');
  opcioTotes.value = 'Totes';
  opcioTotes.textContent = 'Totes les categories · Toutes les catégories';
  selector.appendChild(opcioTotes);
  CATEGORIES.forEach(function (cat) {
    var opcio = document.createElement('option');
    opcio.value = cat.ca;
    opcio.textContent = cat.ca + ' · ' + cat.fr;
    selector.appendChild(opcio);
  });
  selector.addEventListener('change', function () {
    categoriaActiva = selector.value;
    pintaTot();
  });
}

// Prepara els dos camps de data (Del · Du / al · au) i el botó d'esborrar-los.
function construeixFiltreDates() {
  var campDes = document.getElementById('data-des');
  var campFins = document.getElementById('data-fins');
  var botoEsborra = document.getElementById('boto-esborra-dates');

  campDes.addEventListener('change', function () {
    dataDesActiva = campDes.value;
    actualitzaBotoEsborraDates();
    pintaTot();
  });

  campFins.addEventListener('change', function () {
    dataFinsActiva = campFins.value;
    actualitzaBotoEsborraDates();
    pintaTot();
  });

  botoEsborra.addEventListener('click', function () {
    campDes.value = '';
    campFins.value = '';
    dataDesActiva = '';
    dataFinsActiva = '';
    actualitzaBotoEsborraDates();
    pintaTot();
  });
}

// Mostra el botó d'esborrar només quan hi ha alguna data triada.
function actualitzaBotoEsborraDates() {
  var botoEsborra = document.getElementById('boto-esborra-dates');
  botoEsborra.hidden = (dataDesActiva === '' && dataFinsActiva === '');
}

// Marca visualment el botó de comarca actiu.
function marcaBotoActiu() {
  var botons = document.querySelectorAll('.boto-comarca');
  botons.forEach(function (boto) {
    boto.classList.toggle('actiu', boto.dataset.comarca === comarcaActiva);
  });
}

// Torna els esdeveniments que passen els filtres actius.
function esdevenimentsFiltrats() {
  return esdeveniments.filter(function (e) {
    if (comarcaActiva !== 'Totes' && e.comarca !== comarcaActiva) {
      return false;
    }
    if (categoriaActiva !== 'Totes' && e.categoria !== categoriaActiva) {
      return false;
    }
    if (!passaFiltreDates(e)) {
      return false;
    }
    return true;
  });
}

// Diu si un esdeveniment cau dins de l'interval de dates triat.
// Es mostra si el seu període [data_inici, data_fi] TOCA l'interval
// [dataDesActiva, dataFinsActiva]: així una exposició llarga surt també
// quan l'interval només n'agafa un tros. Un camp buit no limita.
// Si l'interval és impossible (Del > al), no hi passa res: llista buida
// i el missatge «Cap esdeveniment no coincideix…» ja ho explica.
function passaFiltreDates(e) {
  var inici = analitzaData(e.data_inici);
  if (inici === null) {
    return false; // sense data d'inici no es pot situar (mai no arriba aquí: preparaEsdeveniments ja els treu)
  }
  var fi = analitzaData(e.data_fi);
  if (fi === null) {
    fi = inici; // data_fi buida o malformada: es tracta com un sol dia
  }

  var des = analitzaData(dataDesActiva);
  if (des !== null && fi < des) {
    return false; // s'acaba abans de l'inici de l'interval
  }

  var fins = analitzaData(dataFinsActiva);
  if (fins !== null && inici > fins) {
    return false; // comença després del final de l'interval
  }

  return true;
}

// ------------------------------------------------------------------ pintat

// Pinta la llista sencera, agrupada per dia.
function pintaTot() {
  var llista = document.getElementById('llista-esdeveniments');
  llista.textContent = '';

  if (esdeveniments.length === 0) {
    mostraMissatge('Encara no hi ha esdeveniments publicats. · Aucun événement publié pour le moment.');
    return;
  }

  var filtrats = esdevenimentsFiltrats();
  if (filtrats.length === 0) {
    mostraMissatge('Cap esdeveniment no coincideix amb els filtres. · Aucun événement ne correspond aux filtres.');
    return;
  }

  amagaMissatge();

  var diaAnterior = '';
  var comptador = 0;
  filtrats.forEach(function (e) {
    var dia = e.data_inici;
    if (dia !== diaAnterior) {
      llista.appendChild(creaTitolDia(dia));
      diaAnterior = dia;
    }
    llista.appendChild(creaTargeta(e, comptador));
    comptador++;
  });
}

// Crea la capçalera d'un dia: "23 Juny, Dimarts · 23 Juin, Mardi".
function creaTitolDia(textData) {
  var data = analitzaData(textData);
  var titol = document.createElement('h2');
  titol.className = 'titol-dia';

  var ca = document.createElement('span');
  ca.className = 'dia-ca';
  ca.textContent = etiquetaDiaCa(data);
  titol.appendChild(ca);

  var fr = document.createElement('span');
  fr.className = 'dia-fr';
  fr.lang = 'fr';
  fr.textContent = '· ' + etiquetaDiaFr(data);
  titol.appendChild(fr);

  return titol;
}

// Torna l'etiqueta catalana del dia: "23 Juny, Dimarts".
function etiquetaDiaCa(data) {
  return data.getDate() + ' ' + majuscula(MESOS_CA[data.getMonth()]) + ', ' + DIES_CA[data.getDay()];
}

// Torna l'etiqueta francesa del dia: "23 Juin, Mardi" (1er per al dia 1).
// Bessó d'etiquetaDiaFrances a sendWeeklyDigest.gs (digestHtml.gs).
function etiquetaDiaFr(data) {
  var dia = data.getDate();
  var diaFr;
  if (dia === 1) {
    diaFr = '1er';
  } else {
    diaFr = String(dia);
  }
  return diaFr + ' ' + majuscula(MESOS_FR[data.getMonth()]) + ', ' + DIES_FR[data.getDay()];
}

// Crea la targeta d'un esdeveniment (cartell + cos); l'índex alterna la inclinació.
function creaTargeta(e, index) {
  var article = document.createElement('article');
  article.className = 'esdeveniment ' + (index % 2 === 0 ? 'gir-esquerra' : 'gir-dreta');
  article.appendChild(creaCartell(e));
  article.appendChild(creaCos(e));
  return article;
}

// Crea la columna del cartell amb la banderola de categoria a dalt.
// Si no hi ha imatge, mostra la icona de la categoria com a substitut.
function creaCartell(e) {
  var marc = document.createElement('div');
  marc.className = 'imatge-esdeveniment';

  if (e.imatge_url) {
    var imatge = document.createElement('img');
    imatge.src = e.imatge_url;
    imatge.alt = 'Cartell: ' + e.titol;
    imatge.loading = 'lazy';
    marc.appendChild(imatge);
  } else {
    marc.classList.add('sense-imatge');
    var icona = document.createElement('span');
    icona.className = 'icona-categoria';
    icona.setAttribute('aria-hidden', 'true');
    icona.innerHTML = iconaCategoria(e.categoria);
    marc.appendChild(icona);
  }

  if (e.categoria) {
    marc.appendChild(creaBanderola(e.categoria));
  }

  return marc;
}

// Crea la banderola amb el nom de la categoria (a dalt del cartell).
function creaBanderola(categoria) {
  var banderola = document.createElement('span');
  banderola.className = 'banderola-categoria';
  banderola.textContent = categoria;
  return banderola;
}

// Torna l'SVG de la icona d'una categoria (o una icona per defecte).
function iconaCategoria(categoria) {
  return CATEGORIA_ICONES[categoria] || ICONA_DEFECTE;
}

// Crea el cos visible: títol, comarca, meta i el botó "Veure més".
function creaCos(e) {
  var cos = document.createElement('div');
  cos.className = 'cos-esdeveniment';

  var titol = document.createElement('h3');
  titol.className = 'titol-esdeveniment';
  if (e.font_url) {
    var enllac = document.createElement('a');
    enllac.href = e.font_url;
    enllac.textContent = e.titol;
    titol.appendChild(enllac);
  } else {
    titol.textContent = e.titol;
  }
  cos.appendChild(titol);

  if (e.comarca) {
    var comarca = document.createElement('p');
    comarca.className = 'comarca';
    comarca.textContent = e.comarca;
    cos.appendChild(comarca);
  }

  cos.appendChild(creaMeta(e));

  var detalls = creaDetalls(e);
  if (detalls) {
    cos.appendChild(detalls);
    cos.appendChild(creaBotoMes(cos));
  }

  return cos;
}

// Crea el bloc amagat amb les descripcions i l'associació; null si no n'hi ha.
function creaDetalls(e) {
  if (!e.descripcio_ca && !e.descripcio_fr && !e.associacio) {
    return null;
  }
  var detalls = document.createElement('div');
  detalls.className = 'detalls';

  if (e.descripcio_ca) {
    var ca = document.createElement('p');
    ca.className = 'descripcio-ca';
    ca.textContent = e.descripcio_ca;
    detalls.appendChild(ca);
  }
  if (e.descripcio_fr) {
    var fr = document.createElement('p');
    fr.className = 'descripcio-fr';
    fr.lang = 'fr';
    fr.textContent = e.descripcio_fr;
    detalls.appendChild(fr);
  }
  if (e.associacio) {
    var assoc = document.createElement('p');
    assoc.className = 'associacio';
    assoc.textContent = 'Organitza · Organise : ' + e.associacio;
    detalls.appendChild(assoc);
  }

  return detalls;
}

// Crea el botó que desplega o plega els detalls del cos indicat.
function creaBotoMes(cos) {
  var boto = document.createElement('button');
  boto.type = 'button';
  boto.className = 'boto-mes';
  boto.setAttribute('aria-expanded', 'false');
  boto.textContent = 'Veure més · Voir plus';
  boto.addEventListener('click', function () {
    var obert = cos.classList.toggle('obert');
    boto.setAttribute('aria-expanded', obert ? 'true' : 'false');
    boto.textContent = obert ? 'Veure menys · Voir moins' : 'Veure més · Voir plus';
  });
  return boto;
}

// Crea la línia meta: hora · (pin) lloc, municipi · fins al ...
// La data i l'hora porten l'accent de color (classe "quan").
function creaMeta(e) {
  var meta = document.createElement('p');
  meta.className = 'meta';

  if (e.hora) {
    var hora = document.createElement('span');
    hora.className = 'quan';
    hora.textContent = e.hora + ' h';
    meta.appendChild(hora);
  }

  var lloc = textLloc(e);
  if (lloc) {
    if (meta.childNodes.length > 0) {
      meta.appendChild(document.createTextNode(' · '));
    }
    var pin = document.createElement('span');
    pin.className = 'icona-pin';
    pin.setAttribute('aria-hidden', 'true');
    pin.innerHTML = ICONA_PIN;
    meta.appendChild(pin);
    var nomLloc = document.createElement('span');
    nomLloc.textContent = lloc;
    meta.appendChild(nomLloc);
  }

  // Calcula "Fins al ..." ABANS d'afegir el separador: si finsAl torna ''
  // (data_fi malformada en un JSON editat a mà), no volem un separador orfe
  // al final de la meta. Bessó de construeixMeta a sendWeeklyDigest.gs.
  if (e.data_fi && e.data_fi !== e.data_inici) {
    var textFins = finsAl(e.data_fi);
    if (textFins) {
      if (meta.childNodes.length > 0) {
        meta.appendChild(document.createTextNode(' · '));
      }
      var fins = document.createElement('span');
      fins.className = 'quan';
      fins.textContent = textFins;
      meta.appendChild(fins);
    }
  }

  return meta;
}

// Torna el text del lloc combinant lloc i municipi.
function textLloc(e) {
  if (e.lloc && e.municipi) {
    return e.lloc + ', ' + e.municipi;
  }
  if (e.lloc) {
    return e.lloc;
  }
  if (e.municipi) {
    return e.municipi;
  }
  return '';
}

// 'Fins al 20 de setembre · Jusqu’au 20 septembre' (amb apòstrofs catalans correctes).
// Bessó de finsAl a sendWeeklyDigest.gs (digestHtml.gs) — mateixa lògica,
// mateix estil if/else; si toques un, toca l'altre.
function finsAl(textData) {
  var data = analitzaData(textData);
  if (data === null) {
    return '';
  }
  var dia = data.getDate();
  var mesCa = MESOS_CA[data.getMonth()];
  var mesFr = MESOS_FR[data.getMonth()];

  var diaCa;
  if (dia === 1 || dia === 11) {
    diaCa = 'a l’' + dia;
  } else {
    diaCa = 'al ' + dia;
  }

  var prepMes;
  if (comencaAmbVocal(mesCa)) {
    prepMes = 'd’';
  } else {
    prepMes = 'de ';
  }
  var ca = 'Fins ' + diaCa + ' ' + prepMes + mesCa;

  var diaFr;
  if (dia === 1) {
    diaFr = '1er';
  } else {
    diaFr = String(dia);
  }
  return ca + ' · Jusqu’au ' + diaFr + ' ' + mesFr;
}

// Diu si una paraula comença amb vocal (per a la contracció de/d').
function comencaAmbVocal(paraula) {
  return 'aeiouàéèíòóú'.indexOf(paraula.charAt(0)) !== -1;
}

// --------------------------------------------------------------- utilitats

// Mostra el missatge d'estat (càrrega, buit, error, sense resultats).
function mostraMissatge(text) {
  var missatge = document.getElementById('missatge-estat');
  missatge.textContent = text;
  missatge.hidden = false;
}

// Amaga el missatge d'estat.
function amagaMissatge() {
  document.getElementById('missatge-estat').hidden = true;
}

// Posa la primera lletra en majúscula.
function majuscula(paraula) {
  return paraula.charAt(0).toUpperCase() + paraula.slice(1);
}

// ------------------------------------------------------------------- tema

// Torna el tema actiu ('fosc' o 'clar').
function temaActual() {
  return document.documentElement.getAttribute('data-tema') === 'fosc' ? 'fosc' : 'clar';
}

// Aplica un tema, el desa i actualitza el botó.
function aplicaTema(tema) {
  document.documentElement.setAttribute('data-tema', tema);
  try {
    localStorage.setItem('tema', tema);
  } catch (e) { /* sense localStorage: no es desa, però funciona igual */ }
  sincronitzaBotoTema();
}

// Posa la icona i el text del botó segons el tema actiu.
function sincronitzaBotoTema() {
  var boto = document.getElementById('boto-tema');
  if (!boto) {
    return;
  }
  var icona = boto.querySelector('.icona-tema');
  var text = boto.querySelector('.text-tema');
  if (temaActual() === 'fosc') {
    icona.innerHTML = ICONA_SOL;
    text.textContent = 'Clar · Clair';
  } else {
    icona.innerHTML = ICONA_LLUNA;
    text.textContent = 'Fosc · Sombre';
  }
}

// Canvia de tema (clar <-> fosc).
function alternaTema() {
  aplicaTema(temaActual() === 'fosc' ? 'clar' : 'fosc');
}

// Prepara el botó de tema i el seu clic.
function configuraTema() {
  var boto = document.getElementById('boto-tema');
  if (!boto) {
    return;
  }
  sincronitzaBotoTema();
  boto.addEventListener('click', alternaTema);
}

// -------------------------------------------------------------------- inici

configuraTema();
construeixFiltres();
construeixFiltreDates();
carregaEsdeveniments();
