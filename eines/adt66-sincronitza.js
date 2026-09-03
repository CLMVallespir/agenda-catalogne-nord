// ---------------------------------------------------------------------------
// ADT66 / TOURINSOFT — SINCRONITZACIÓ DIFERENCIAL
//
// Una sola feina: baixar les ofertes de l'ADT66 que han canviat des de
// l'última vegada que hi vam mirar, senceres. Res més.
//
//   - Cap crida a Gemini.
//   - Cap escriptura: ni a pendents.json, ni enlloc. Aquesta funció LLEGEIX.
//   - Cap deduplicació, cap filtre, cap classificació. Cadascuna és una
//     tasca a part.
//
// Qui la cridi decideix què fa amb les ofertes i on desa la marca de temps
// que retorna. Aquí no es desa res a posta.
//
// IMPORTANT — per què això va canviar el 29 d'agost de 2026. La primera
// versió parlava amb api-v3.tourinsoft.com i en treia només VINT-I-DOS camps,
// sense data d'acte, sense descripció i sense municipi. D'allò se'n va
// concloure que el flux no servia per fer una agenda i que calia demanar a
// l'ADT66 una sindicació més completa. Era una conclusió equivocada:
// l'api-v3 no és el flux, només és el porter que redirigeix cap a ell. El
// destí de la redirecció —el WCF, que és el que fa servir aquest fitxer—
// serveix la MATEIXA sindicació amb TRENTA-CINC camps, dates i descripcions
// incloses. No cal demanar res a ningú.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/adt66-sincronitza.js                        -> importació completa
//   node eines/adt66-sincronitza.js 2026-08-01T00:00:00    -> diferencial
//
// Comportament de l'API confirmat amb curl el 29 d'agost de 2026; el detall
// és a docs/HANDOFF-ADT66.md.
// ---------------------------------------------------------------------------

// --- Coordenades del flux --------------------------------------------------

// El GUID de la sindicació «CDT-INDEPENDANT WEB FMA» de l'ADT66.
var ADT66_GUID = '60a37063-5667-45f8-82e1-a1db2d8375b9';

// L'adreça del flux de debò. No és inventada: és, lletra per lletra, el
// destí que l'api-v3 posava a la capçalera Location quan se li demanava una
// data, i que vam comprovar idèntic amb sis dates diferents. Si algun dia
// deixa de respondre, es torna a treure demanant
// GET https://api-v3.tourinsoft.com/api/syndications/cdt66.tourinsoft.com/{GUID}/{AAAA-MM-DD}
// sense seguir la redirecció i mirant-ne la capçalera Location.
var ADT66_OBJECTES = 'https://wcf.tourinsoft.com/Syndication/3.0/cdt66/' + ADT66_GUID + '/Objects';

// Qui som, per si a l'altra banda algú mira els registres.
var AGENT = 'agenda-catalunya-nord/1.0 (+https://clm.cat; agenda@clm.cat)';

// Quants dies buits seguits tolerem dins d'una sèrie de dates abans de dir que
// l'acte no és continu sinó periòdic. Un buit d'UN dia vol dir dues dates
// separades per DOS dies de calendari: una fira amb un dia de descans encara
// és una fira. Dos dies de buit ja deixaria passar dues projeccions de cinema
// com si fossin una cosa de quatre dies, que és el que volem evitar.
var LLINDAR_BUIT_DIES = 1;

// I, a més, un acte continu no dura més d'un mes. Fa falta aquesta segona
// condició perquè el buit petit i l'abast enorme són compatibles: hi ha
// tallers oberts cada dia menys diumenge que van del maig al desembre —cap
// salt de més de dos dies i set mesos d'abast—, i sense aquest límit
// passarien per acte continu. El valor no és delicat: al flux de l'ADT66 les
// sèries de buit petit van d'1 a 27 dies i després salten a 223, o sigui que
// qualsevol xifra entre 28 i 222 dona el mateix resultat. Un mes és rodó.
var ABAST_MAXIM_DIES = 31;


// --- La funció -------------------------------------------------------------

// ------------------------------------------------------------
// Torna les ofertes noves o canviades des de la marca de temps donada,
// senceres i en JSON. `darreraMarca` és el valor `marca` que va tornar
// l'última execució; una cadena buida vol dir «mai no s'ha sincronitzat» i
// demana el flux sencer. El filtratge el fa el servidor, no nosaltres.
// ------------------------------------------------------------
async function sincronitzaADT66(darreraMarca) {
  var marca = darreraMarca || '';

  var ofertes = await llegeixOfertes(marca);

  if (ofertes.length === 0) {
    return resultat('sense-canvis', [], marca, 0);
  }

  var marcaNova = marcaMesAlta(ofertes);
  var disperses = comptaDisperses(ofertes);

  if (marca === '') {
    return resultat('complet', ofertes, marcaNova, disperses);
  }

  return resultat('diferencial', ofertes, marcaNova, disperses);
}


// --- Les peces -------------------------------------------------------------

// ------------------------------------------------------------
// Baixa les ofertes del flux. Sense marca les baixa totes; amb marca hi posa
// un $filter i el servidor només envia les tocades després. No hi posem cap
// $select a posta: volem tots els camps, i demanar-los explícitament voldria
// dir mantenir una llista de trenta-cinc noms aquí dins.
// ------------------------------------------------------------
async function llegeixOfertes(marca) {
  var url = ADT66_OBJECTES + '?$format=json';

  if (marca !== '') {
    url = url + '&$filter=' + encodeURIComponent('Updated gt datetime\'' + marca + '\'');
  }

  var resposta = await fetch(url, {
    method: 'GET',
    headers: { 'User-Agent': AGENT }
  });

  if (!resposta.ok) {
    throw new Error('no he pogut llegir les ofertes de l\'ADT66 (codi ' + resposta.status + ').');
  }

  var dades = await resposta.json();

  if (dades && dades['odata.error']) {
    throw new Error('l\'ADT66 rebutja la petició: ' + dades['odata.error'].message.value);
  }

  if (!dades || !Array.isArray(dades.value)) {
    throw new Error('la resposta de l\'ADT66 no porta cap camp «value» amb una llista.');
  }

  return dades.value;
}

// ------------------------------------------------------------
// Compara dues marques de temps de l'ADT66. Es comparen com a text a posta:
// totes tenen la forma AAAA-MM-DDTHH:MM:SS amb els números encoixinats de
// zeros, i les que porten fracció de segon només afegeixen cua darrere
// d'aquest tros comú. L'ordre alfabètic és, doncs, l'ordre cronològic. Cap
// no porta zona horària, i com que totes surten de la mateixa font, no cal
// convertir res: convertir-les seria inventar-se una zona.
// ------------------------------------------------------------
function esPosterior(marca, referencia) {
  return marca > referencia;
}

// ------------------------------------------------------------
// La marca de temps més alta de la llista. Es fa servir com a punt de
// partida de la propera sincronització, en comptes de l'hora d'ara: així no
// depenem que el nostre rellotge i el de l'ADT66 vagin iguals.
// ------------------------------------------------------------
function marcaMesAlta(ofertes) {
  var alta = '';
  for (var i = 0; i < ofertes.length; i++) {
    var marca = ofertes[i].Updated || '';
    if (esPosterior(marca, alta)) {
      alta = marca;
    }
  }
  return alta;
}

// ------------------------------------------------------------
// Munta el resultat. Sempre els mateixos quatre camps, sempre presents,
// perquè qui la cridi no hagi de comprovar si hi són.
// ------------------------------------------------------------
function resultat(estat, ofertes, marca, disperses) {
  return {
    estat: estat,
    ofertes: ofertes,
    marca: marca,
    disperses: disperses
  };
}


// --- Les dates de l'acte ---------------------------------------------------
// El camp que les porta és `TRI`: totes les dates en què es fa l'acte, en
// DD/MM/AAAA, separades per espais. N'hi ha a les 1 543 ofertes del flux.
// L'hora, quan n'hi ha, és dins de `COMMUNDATE`, que és HTML.

// ------------------------------------------------------------
// Totes les dates de l'oferta en AAAA-MM-DD, ordenades i sense repeticions.
// Una llista buida vol dir que l'oferta no en porta cap de llegible.
// ------------------------------------------------------------
function datesDeLoferta(oferta) {
  var tri = String(oferta.TRI || '').trim();
  if (tri === '') {
    return [];
  }

  var trobades = {};
  var trossos = tri.split(/\s+/);

  for (var i = 0; i < trossos.length; i++) {
    var iso = aIso(trossos[i]);
    if (iso !== '') {
      trobades[iso] = true;
    }
  }

  return Object.keys(trobades).sort();
}

// ------------------------------------------------------------
// Passa una data DD/MM/AAAA a AAAA-MM-DD. Torna cadena buida si no té
// aquesta forma exacta: val més cap data que una data inventada.
// ------------------------------------------------------------
function aIso(data) {
  var parts = String(data).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (parts === null) {
    return '';
  }
  return parts[3] + '-' + parts[2] + '-' + parts[1];
}

// ------------------------------------------------------------
// L'hora d'inici, HH:MM, treta del primer «De HH:MM» de COMMUNDATE. Torna
// cadena buida si l'oferta no en diu cap, que és el cas de més d'un terç:
// l'esquema del projecte vol una cadena buida, mai una hora suposada.
// ------------------------------------------------------------
function horaDeLoferta(oferta) {
  var trobada = String(oferta.COMMUNDATE || '').match(/\bDe (\d{2}:\d{2})\b/);
  if (trobada === null) {
    return '';
  }
  return trobada[1];
}

// ------------------------------------------------------------
// Els dies de calendari que hi ha entre dues dates AAAA-MM-DD. Es compten en
// UTC a posta: totes dues dates són dies solts, sense hora, i barrejar-hi el
// fus horari del qui executa el codi faria variar el resultat en un dia.
// ------------------------------------------------------------
function diesEntre(dataA, dataB) {
  var UN_DIA = 86400000;
  var milisegons = Date.parse(dataB + 'T00:00:00Z') - Date.parse(dataA + 'T00:00:00Z');
  return Math.round(milisegons / UN_DIA);
}

// ------------------------------------------------------------
// La data d'avui a París, en AAAA-MM-DD. Ha de ser París i no UTC perquè a
// l'estiu França va dues hores per davant: un Worker que s'executi a les
// 00:30 de París encara és ahir en UTC, i «la propera ocurrència» sortiria un
// dia enrere. Es munta peça a peça perquè es vegi què fa.
// ------------------------------------------------------------
function dataDavuiAParis() {
  var format = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  var trossos = {};
  var parts = format.formatToParts(new Date());
  for (var i = 0; i < parts.length; i++) {
    trossos[parts[i].type] = parts[i].value;
  }

  return trossos.year + '-' + trossos.month + '-' + trossos.day;
}

// ------------------------------------------------------------
// La primera data de la llista que sigui d'avui en endavant. Cadena buida si
// totes són passades. La llista ha d'arribar ordenada.
// ------------------------------------------------------------
function properaOcurrencia(dates, avui) {
  for (var i = 0; i < dates.length; i++) {
    if (dates[i] >= avui) {
      return dates[i];
    }
  }
  return '';
}

// ------------------------------------------------------------
// Diu si una sèrie de dates descriu un acte continu o un de periòdic, i quin
// parell de dates li correspon. Continu: dies seguits (amb el buit tolerat) i
// dins d'un mes — llavors el primer i l'últim dia el descriuen bé. Periòdic:
// un mercat setmanal, un taller, un cicle de cinema — llavors el primer i
// l'últim dia serien una mentida de mesos, i el que val és la propera
// ocurrència. Torna { tipus, dataInici, dataFi }, sempre cadenes.
//
// Un `dataInici` buit amb tipus `dispers` vol dir que totes les ocurrències
// són passades: aquella oferta no ha de generar cap fila.
// ------------------------------------------------------------
function classificaDates(dates) {
  if (dates.length === 0) {
    return { tipus: 'contigu', dataInici: '', dataFi: '' };
  }

  var primera = dates[0];
  var ultima = dates[dates.length - 1];
  var abast = diesEntre(primera, ultima) + 1;

  // Un buit d'un dia són dues dates a dos dies de distància, d'aquí el +1.
  var saltTolerat = LLINDAR_BUIT_DIES + 1;
  var saltMaxim = 0;
  for (var i = 1; i < dates.length; i++) {
    var salt = diesEntre(dates[i - 1], dates[i]);
    if (salt > saltMaxim) {
      saltMaxim = salt;
    }
  }

  if (saltMaxim <= saltTolerat && abast <= ABAST_MAXIM_DIES) {
    return { tipus: 'contigu', dataInici: primera, dataFi: ultima };
  }

  var propera = properaOcurrencia(dates, dataDavuiAParis());
  return { tipus: 'dispers', dataInici: propera, dataFi: propera };
}

// ------------------------------------------------------------
// Els tres camps de data de l'esquema, tal com els vol el §4 de CLAUDE.md:
// cadenes sempre, buides quan no se sap. `data_fi` és igual a `data_inici`
// quan l'acte és d'un sol dia, i també quan és periòdic.
// ------------------------------------------------------------
function extreuDates(oferta) {
  var dates = datesDeLoferta(oferta);

  if (dates.length === 0) {
    return { data_inici: '', data_fi: '', hora: '' };
  }

  var quan = classificaDates(dates);

  return {
    data_inici: quan.dataInici,
    data_fi: quan.dataFi,
    hora: horaDeLoferta(oferta)
  };
}

// ------------------------------------------------------------
// Quantes ofertes d'una llista tenen dates periòdiques. Serveix només per
// mirar-ho d'un cop d'ull: si el número puja molt, val la pena tornar a
// mesurar el llindar amb dades noves.
// ------------------------------------------------------------
function comptaDisperses(ofertes) {
  var disperses = 0;
  for (var i = 0; i < ofertes.length; i++) {
    var quan = classificaDates(datesDeLoferta(ofertes[i]));
    if (quan.tipus === 'dispers') {
      disperses = disperses + 1;
    }
  }
  return disperses;
}


// --- El que surt d'aquest fitxer -------------------------------------------
// La funció pública, i les tres peces de dates. Aquestes tres surten a fora
// perquè eines/mapeja-adt66.js les ha de fer servir tal com són: la regla del
// §3 bis de docs/HANDOFF-ADT66.md —què és un acte continu i què un de
// periòdic— no pot viure copiada a dos fitxers, o el dia que es toqui el
// llindar en un lloc i no a l'altre, dues peces del mateix canal classificarien
// la mateixa oferta de maneres diferents sense que res fallés.

module.exports = {
  sincronitzaADT66: sincronitzaADT66,
  datesDeLoferta: datesDeLoferta,
  horaDeLoferta: horaDeLoferta,
  classificaDates: classificaDates
};


// --- Ús des del terminal ---------------------------------------------------
// Tot el que ve a partir d'aquí és per poder provar la funció a mà. No forma
// part de la peça i no s'ha de copiar enlloc.

// ------------------------------------------------------------
// Executa una sincronització i n'escriu el resum al terminal.
// ------------------------------------------------------------
async function principal() {
  var marca = process.argv[2] || '';

  console.log('Marca de partida: ' + (marca === '' ? '(cap: importació completa)' : marca));

  try {
    var resposta = await sincronitzaADT66(marca);

    console.log('estat            ' + resposta.estat);
    console.log('ofertes rebudes  ' + resposta.ofertes.length);
    console.log('de periodiques   ' + resposta.disperses);
    console.log('marca nova       ' + resposta.marca);

    for (var i = 0; i < Math.min(3, resposta.ofertes.length); i++) {
      var oferta = resposta.ofertes[i];
      var dates = extreuDates(oferta);
      var quan = classificaDates(datesDeLoferta(oferta));
      console.log('');
      console.log('  ' + oferta.SyndicObjectName);
      console.log('  ' + (dates.data_inici === '' ? '(cap data futura: no fa fila)'
                            : dates.data_inici + ' -> ' + dates.data_fi) +
                  (dates.hora === '' ? '' : ' a les ' + dates.hora) +
                  '  ·  ' + quan.tipus + '  ·  ' + oferta.Commune);
    }
  } catch (error) {
    console.error('Ha fallat: ' + error.message);
    process.exitCode = 1;
  }
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    process.argv[1].indexOf('adt66-sincronitza') !== -1) {
  principal();
}
