// ---------------------------------------------------------------------------
// NETEJA DEL TEXT DE FONT — abans que entri a cap prompt de Gemini
//
// Una sola feina: agafar un camp de text tal com arriba d'una font externa i
// tornar-lo llegible. Res més.
//
//   - Cap crida a Gemini ni a cap API. Codi pur: entra una cadena, en surt
//     una altra. No llegeix res i no escriu enlloc.
//   - Cap decisió editorial: no tradueix, no resumeix, no talla, no jutja si
//     l'acte entra a l'agenda. Això és de docs/CRITERI-EDITORIAL.md i de
//     eines/classifica-editorial.js, no d'aquí.
//   - Cap decisió d'esquema: no coerceix comarques ni categories, no toca
//     `estat` ni `nota_curador`.
//
// PER QUÈ EXISTEIX. El flux de l'ADT66 no serveix text: serveix HTML amb una
// etiqueta de formulari en francès enganxada al davant de cada camp. Mesurat
// sobre les 1 453 ofertes del flux el 31 d'agost de 2026:
//
//   28 540 <strong>   10 230 <br>   5 430 <span>   1 976 <a>   1 448 <font>
//    1 424 <img>         170 <em>
//    7 182 &agrave;   4 041 &eacute;   1 058 &nbsp;   817 &egrave;   126 &bull;
//
// I set etiquetes de camp, sempre al començament del camp que les porta:
//
//   1 442  «Descriptif de la manifestation :»   (DETAILDESCRIPTIF)
//   1 396  «Type :»                             (COMMUNTYPE)
//   1 326  «Catégorie :»                        (COMMUNCATEGORIE)
//   1 262  «Entrée gratuite :»                  (DETAILFETEPAYANTE)
//     817  «Thème :»                            (COMMUNTHEME)
//     287  «Contacter»                          (DETAILCONTACT, sense dos punts)
//     229  «Lieu :»                             (COMMUNLIEU)
//
// Tot això, si arriba sencer a un prompt, es paga en tokens i no diu res de
// l'acte. Pitjor encara: «Descriptif de la manifestation :» al davant d'una
// descripció convida el model a prendre's l'etiqueta per contingut.
//
// LA REGLA QUE NO ES POT TRENCAR: les etiquetes es treuen NOMÉS a principi de
// línia i NOMÉS les set de la llista tancada. No és una precaució teòrica.
// Al flux hi ha descripcions de debò que diuen, dins del text, «Tarif : 5€
// les 2 m», «Horaires : …», «Plein tarif : 5,00€». Això és informació que el
// curador vol i que un patró genèric d'«una paraula en majúscula seguida de
// dos punts» es menjaria. La versió generosa d'aquesta neteja destrueix
// contingut; la tancada, no.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/neteja-text.js          -> passa la bateria de proves
// ---------------------------------------------------------------------------


// --- Constants: les etiquetes de camp ---------------------------------------

// Les set etiquetes que la font enganxa al davant del contingut, escrites ja
// desxifrades: la neteja les busca DESPRÉS de treure les entitats, o sigui
// que aquí hi va «Catégorie», no «Cat&eacute;gorie».
//
// Afegir-n'hi una vol dir haver-la comptat abans en dades de debò. Una
// etiqueta que surti tres cops en mil cinc-centes ofertes no és una etiqueta
// de camp: és una frase que algú ha escrit.
var ETIQUETES_DE_CAMP = [
  'Descriptif de la manifestation :',
  'Entrée gratuite :',
  'Catégorie :',
  'Thème :',
  'Lieu :',
  'Type :',
  'Contacter'
];


// --- La funció --------------------------------------------------------------

// ------------------------------------------------------------
// El text d'un camp de font, net: fora l'HTML (però no el que hi havia a
// dins), fora les entitats, fora les etiquetes de camp franceses, i els
// espais normalitzats. Un valor que no sigui text —un número, un `null` de
// debò, un camp absent— torna "" (§4 de CLAUDE.md: mai null, mai omès).
//
// L'ordre dels passos no és casual i no es pot remenar:
//
//   1. fora els blocs que no són text de l'oferta (<script>, <style>)
//   2. les etiquetes que marquen salt de línia, a salt de línia
//   3. la resta d'etiquetes, fora
//   4. les entitats, desxifrades   <- ha d'anar DESPRÉS del 3 i ABANS del 5,
//   5. les etiquetes de camp, fora    perquè «Cat&eacute;gorie :» només es
//   6. els espais, normalitzats       reconeix un cop desxifrada
// ------------------------------------------------------------
function netejaTextFont(text) {
  var net = cadena(text);

  if (net === '') {
    return '';
  }

  net = treuBlocsNoText(net);
  net = etiquetesASaltDeLinia(net);
  net = treuEtiquetesHtml(net);
  net = desxifraEntitats(net);
  net = treuEtiquetesDeCamp(net);
  net = normalitzaEspais(net);

  return net;
}


// --- Les peces: l'HTML ------------------------------------------------------

// ------------------------------------------------------------
// Fora el contingut de <script> i <style>: no és text de l'oferta, és codi.
// Es treu amb l'etiqueta i tot, en un sol pas, perquè si es tragués només
// l'etiqueta quedaria el codi solt enmig de la descripció.
// ------------------------------------------------------------
function treuBlocsNoText(html) {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ');
}

// ------------------------------------------------------------
// Les etiquetes que de debò fan salt de línia, a salt de línia. Cal fer-ho
// abans de treure la resta: un <br /> convertit en espai ajuntaria dues
// frases que a la font eren separades, i al flux de l'ADT66 n'hi ha 10 230.
// ------------------------------------------------------------
function etiquetesASaltDeLinia(html) {
  var text = html.replace(/<br\s*\/?>/gi, '\n');
  return text.replace(/<\/(p|div|li|tr|h1|h2|h3|h4|table)>/gi, '\n');
}

// ------------------------------------------------------------
// La resta d'etiquetes, fora, conservant el text de dins. Funciona igual amb
// HTML aniuat —<em><strong>text</strong></em>— perquè no mira parelles: mira
// etiquetes soltes i cada una se'n va per separat. Se substitueixen per un
// espai i no per res, perquè «<strong>a</strong><em>b</em>» és «a b» i no
// «ab»; els espais de més els recull normalitzaEspais().
// ------------------------------------------------------------
function treuEtiquetesHtml(html) {
  return html.replace(/<[^>]*>/g, ' ');
}

// ------------------------------------------------------------
// Les entitats HTML, desxifrades. Les cinc que surten de debò al flux de
// l'ADT66 hi són, i també la resta d'accentuades del francès, que no costen
// res i que una font nova pot portar perfectament.
//
// `&amp;` va l'ÚLTIMA de les que tenen nom, a posta: si es fes primer, un
// «&amp;eacute;» del text original es convertiria en «&eacute;» i la passada
// següent el desxifraria, que és inventar-se una lletra que no hi era. (La
// mateixa regla i el mateix motiu que a desxifraEntitats() d'eines/
// mapeja-adt66.js.)
// ------------------------------------------------------------
function desxifraEntitats(text) {
  var net = text;

  net = net.replace(/&nbsp;/gi, ' ');
  net = net.replace(/&bull;/gi, '•');
  net = net.replace(/&agrave;/g, 'à');
  net = net.replace(/&acirc;/g, 'â');
  net = net.replace(/&eacute;/g, 'é');
  net = net.replace(/&egrave;/g, 'è');
  net = net.replace(/&ecirc;/g, 'ê');
  net = net.replace(/&euml;/g, 'ë');
  net = net.replace(/&icirc;/g, 'î');
  net = net.replace(/&iuml;/g, 'ï');
  net = net.replace(/&ocirc;/g, 'ô');
  net = net.replace(/&ugrave;/g, 'ù');
  net = net.replace(/&ucirc;/g, 'û');
  net = net.replace(/&ccedil;/g, 'ç');
  net = net.replace(/&oelig;/g, 'œ');
  net = net.replace(/&laquo;/g, '«');
  net = net.replace(/&raquo;/g, '»');
  net = net.replace(/&rsquo;/g, '’');
  net = net.replace(/&quot;/gi, '"');
  net = net.replace(/&#39;/g, "'");
  net = net.replace(/&lt;/gi, '<');
  net = net.replace(/&gt;/gi, '>');
  net = net.replace(/&amp;/gi, '&');

  // Les numèriques, decimals i hexadecimals, que no tenen taula.
  net = net.replace(/&#(\d+);/g, function (tot, numero) {
    return String.fromCharCode(Number(numero));
  });
  net = net.replace(/&#x([0-9a-fA-F]+);/g, function (tot, numero) {
    return String.fromCharCode(parseInt(numero, 16));
  });

  return net;
}


// --- Les peces: les etiquetes de camp ---------------------------------------

// ------------------------------------------------------------
// Fora les set etiquetes de camp de la llista tancada, i només a principi de
// línia. Dues coses que en depenen:
//
//   - A PRINCIPI DE LÍNIA i no a qualsevol lloc: «Tarif : 5€ les 2 m» dins
//     d'una descripció és contingut, no etiqueta. Vegeu el §«LA REGLA» de la
//     capçalera.
//   - TOTES les aparicions a principi de línia, no només la primera: quan
//     algú ajunta quatre camps de la font en un sol text —el tipus, la
//     categoria, el tema i l'entrada gratuïta—, en surten quatre etiquetes,
//     cadascuna a la seva línia, i s'han de treure totes quatre.
//
// El salt de línia es conserva: el que se'n va és l'etiqueta, no la
// separació entre dos valors.
// ------------------------------------------------------------
function treuEtiquetesDeCamp(text) {
  var net = text;

  for (var i = 0; i < ETIQUETES_DE_CAMP.length; i++) {
    net = net.replace(patroDetiqueta(ETIQUETES_DE_CAMP[i]), '$1');
  }

  return net;
}

// ------------------------------------------------------------
// El patró d'una etiqueta a principi de línia, amb els espais que pugui
// portar davant i darrere. L'etiqueta s'escapa perquè en porta, de caràcters
// que una expressió regular es prendria per seus.
// ------------------------------------------------------------
function patroDetiqueta(etiqueta) {
  return new RegExp('(^|\\n)[ \\t]*' + escapaPatro(etiqueta) + '[ \\t]*', 'g');
}

// ------------------------------------------------------------
// Un text convertit en un tros d'expressió regular que es busca a si mateix.
// ------------------------------------------------------------
function escapaPatro(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


// --- Les peces: els espais --------------------------------------------------

// ------------------------------------------------------------
// Els espais, normalitzats: els espais i tabuladors seguits a un de sol,
// cada línia sense espais als extrems, i tres línies buides o més a una de
// sola.
//
// El salt de paràgraf (una línia buida) es CONSERVA a posta. No és cosmètic:
// les descripcions de la font separen el que és l'acte del que són les
// inscripcions i els preus amb una línia buida, i ajuntar-ho tot en un bloc
// li fa perdre l'estructura al model.
// ------------------------------------------------------------
function normalitzaEspais(text) {
  var net = text;

  net = net.replace(/\r\n?/g, '\n');
  net = net.replace(/[ \t ]+/g, ' ');
  net = net.replace(/[ \t]*\n[ \t]*/g, '\n');
  net = net.replace(/\n{3,}/g, '\n\n');

  return net.trim();
}

// ------------------------------------------------------------
// Qualsevol valor convertit a cadena retallada. Un valor que no sigui text
// —un número, un `null` de debò, un camp absent— és "".
// ------------------------------------------------------------
function cadena(valor) {
  if (valor === undefined || valor === null) {
    return '';
  }
  if (typeof valor !== 'string') {
    return String(valor).trim();
  }
  return valor.trim();
}


// --- El que surt d'aquest fitxer --------------------------------------------
// Només la funció. Les peces són seves i no les ha de fer servir ningú de
// fora: qui necessiti netejar text, que netegi text.

module.exports = {
  netejaTextFont: netejaTextFont
};


// --- Ús des del terminal ----------------------------------------------------
// Tot el que ve a partir d'aquí és la bateria de proves. No forma part de la
// peça i no s'ha de copiar enlloc.
//
// TOTS els casos «real» d'aquesta bateria són cadenes copiades literalment
// del flux de l'ADT66 baixat el 31 d'agost de 2026 (1 453 ofertes). No n'hi
// ha cap d'inventat: una neteja provada contra brossa imaginada neteja
// brossa imaginada.

var CASOS = [
  {
    nom: 'real · DETAILDESCRIPTIF (FMALAR066FS0009D): l\'etiqueta del davant se\'n va',
    entrada: '<strong>Descriptif de la manifestation :</strong> Canet-en-Roussillon devient, le temps de sa 11ᵉ édition, la capitale mondiale du catamaran d’occasion !',
    esperat: 'Canet-en-Roussillon devient, le temps de sa 11ᵉ édition, la capitale mondiale du catamaran d’occasion !'
  },
  {
    nom: 'real · COMMUNLIEU (FMALAR066FS0009D): «Lieu :» fora, el local queda',
    entrada: '<strong>Lieu :</strong> au Port',
    esperat: 'au Port'
  },
  {
    nom: 'real · COMMUNCATEGORIE: el <br /> de dins de l\'etiqueta no deixa rastre',
    entrada: '<strong><br />Cat&eacute;gorie :</strong> Exposition, Foire',
    esperat: 'Exposition, Foire'
  },
  {
    nom: 'real · COMMUNTHEME: entitat &egrave; dins de l\'etiqueta',
    entrada: '<strong><br />Th&egrave;me :</strong> Nautisme',
    esperat: 'Nautisme'
  },
  {
    nom: 'real · DETAILFETEPAYANTE: el <span> buit amb atributs no deixa res',
    entrada: '<strong><br />Entr&eacute;e gratuite :</strong> oui<span data-champcoderef=" " id="b1242ae7-295e-e111-a3da-000c29d07f29" type="champSimple"></span>',
    esperat: 'oui'
  },
  {
    nom: 'real · DETAILCONTACT: «Contacter» és etiqueta encara que no porti dos punts',
    entrada: '<br /><strong>Contacter</strong> Monsieur CHATILLON Benoit',
    esperat: 'Monsieur CHATILLON Benoit'
  },
  {
    nom: 'real · SyndicObjectName: un títol sense HTML surt igual que ha entrat',
    entrada: 'LES OCCASIONS DU MULTICOQUE & DU REFIT',
    esperat: 'LES OCCASIONS DU MULTICOQUE & DU REFIT'
  },
  {
    nom: 'real · DETAILDESCRIPTIF (<font></font>): un camp que només porta etiquetes buides queda buit',
    entrada: '<font></font>',
    esperat: ''
  },
  {
    nom: 'ETIQUETES REPETIDES · els quatre camps de taxonomia d\'una mateixa oferta, ajuntats',
    entrada: '<strong>Type :</strong> Sports\n' +
      '<strong><br />Cat&eacute;gorie :</strong> Exposition, Foire\n' +
      '<strong><br />Th&egrave;me :</strong> Nautisme\n' +
      '<strong><br />Entr&eacute;e gratuite :</strong> oui',
    // La línia buida entre valors hi és perquè hi és a la font: el salt de la
    // concatenació més el <br /> que cada camp porta dins de la seva etiqueta.
    // Se'n conserva una —no tres—, que és el que fa normalitzaEspais().
    esperat: 'Sports\n\nExposition, Foire\n\nNautisme\n\noui'
  },
  {
    nom: 'HTML ANIUAT · DETAILPROGRAMME (FMALAR066V529E8T): <em><strong>…</strong></em>, &bull; i &nbsp; en cadena',
    entrada: '&bull;&nbsp;<strong>Vinohrando - Du&nbsp;10/10/2024 au&nbsp;10/10/2024 De&nbsp;09:00 &agrave;&nbsp;13:00</strong><br /><em><strong>&nbsp; &nbsp;Office de tourisme</strong></em><br />&nbsp; &nbsp;Balade dans les vignes',
    esperat: '• Vinohrando - Du 10/10/2024 au 10/10/2024 De 09:00 à 13:00\nOffice de tourisme\nBalade dans les vignes'
  },
  {
    nom: 'CONTINGUT QUE NO ES POT TOCAR · «Tarif :» enmig d\'una descripció de debò es queda',
    entrada: '<strong>Descriptif de la manifestation :</strong> Organisé par l\'association Sport Boules St André - Albères. \n\nInscriptions en mairie à partir du 17 août : \nTarif : 5€ les 2 m (stand de 4 à 10 m) \nPièce d’identité obligatoire',
    esperat: 'Organisé par l\'association Sport Boules St André - Albères.\n\nInscriptions en mairie à partir du 17 août :\nTarif : 5€ les 2 m (stand de 4 à 10 m)\nPièce d’identité obligatoire'
  },
  {
    nom: 'CONTINGUT QUE NO ES POT TOCAR · «Plein tarif :» i el salt de paràgraf d\'una descripció real',
    entrada: '<strong>Descriptif de la manifestation :</strong> Balade familiale proposée par Banyuls Rando\nPlein tarif : 5,00€ - Gratuit pour les enfants de moins de 16 ans\nDépart 8h30 Maison de la Randonnée (Office de Tourisme)',
    esperat: 'Balade familiale proposée par Banyuls Rando\nPlein tarif : 5,00€ - Gratuit pour les enfants de moins de 16 ans\nDépart 8h30 Maison de la Randonnée (Office de Tourisme)'
  },
  {
    nom: 'real · DETAILSITEWEB a null: un valor nul és cadena buida, mai «null»',
    entrada: null,
    esperat: ''
  },
  {
    nom: 'un camp absent és cadena buida',
    entrada: undefined,
    esperat: ''
  },
  {
    nom: 'una etiqueta que NO és de la llista tancada es queda encara que sigui a principi de línia',
    entrada: 'Horaires : de 9h à 18h',
    esperat: 'Horaires : de 9h à 18h'
  },
  {
    nom: 'idempotent: netejar dues vegades dona el mateix',
    entrada: netejaTextFont('<strong>Lieu :</strong> &agrave; la m&eacute;diath&egrave;que'),
    esperat: 'à la médiathèque'
  }
];

// ------------------------------------------------------------
// Passa la bateria i n'escriu el resultat al terminal.
// ------------------------------------------------------------
function passaProves() {
  var fallades = 0;

  for (var i = 0; i < CASOS.length; i++) {
    var cas = CASOS[i];
    var obtingut = netejaTextFont(cas.entrada);

    if (obtingut === cas.esperat) {
      console.log('  ok   ' + cas.nom);
    } else {
      fallades = fallades + 1;
      console.log('  FALLA ' + cas.nom);
      console.log('        esperat  ' + JSON.stringify(cas.esperat));
      console.log('        obtingut ' + JSON.stringify(obtingut));
    }
  }

  console.log('');
  console.log(CASOS.length + ' casos, ' + fallades + ' fallades.');

  if (fallades > 0) {
    process.exitCode = 1;
  }
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    process.argv[1].indexOf('neteja-text') !== -1) {
  passaProves();
}
