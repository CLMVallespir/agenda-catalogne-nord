// ---------------------------------------------------------------------------
// MAPEIG ADT66 -> PRODUCCIÓ
//
// Una sola feina: convertir una oferta del flux WCF de l'ADT66 (els 35 camps
// del §2 bis de docs/HANDOFF-ADT66.md) en una fila neta de l'esquema de
// PRODUCCIÓ (els camps del §4 de CLAUDE.md). Res més.
//
//   - Cap crida a la xarxa. Ni al flux de l'ADT66, ni a Gemini, ni a
//     Cloudinary. Codi pur: entra una oferta, surt una fila.
//   - Cap escriptura: ni a pendents.json, ni a events.json, ni enlloc.
//   - Cap deduplicació, cap filtre editorial, cap traducció, cap pujada de
//     cartell. Cadascuna és una tasca a part i ja té el seu fitxer.
//   - No està connectada a res: ni a eines/processa-lot.js, ni a
//     eines/pipeline-offline.js. És la peça de mapeig sola.
//
// LA FORMA DEL RESULTAT ÉS LA MATEIXA que la de mapejaAProduccio() a
// eines/mapeja-recerca.js: { fila, metadadades }. No és cap coincidència i no
// s'ha de trencar. Les dues fonts —el CSV de recerca i el flux de l'ADT66—
// entren pel mateix canal, i el dia que en vingui una tercera ha d'entrar-hi
// igual. La procedència NO entra mai als camps de producció: surt a part.
//
// L'ÚNICA excepció, i és un camp de l'esquema, no una drecera: `nota_curador`.
// Vegeu el §«La nota del curador» d'aquí sota: aquí hi va PRIMER el tag
// d'ancoratge d'eines/adt66-identificador.js, i després els avisos.
//
//
// --- ELS 35 CAMPS: QUINS ES FAN SERVIR I QUINS NO -------------------------
//
// La llista dels 35 és la del §2 bis de docs/HANDOFF-ADT66.md. Aquí es diu
// què se'n fa de cadascun, com fa docs/HANDOFF-MAPEIG-RECERCA.md amb els 31
// del CSV. Si canvies res d'aquí, canvia-ho allà.
//
// ELS QUE ARRIBEN A LA FILA (onze noms del flux, deu camps de la fila: `TRI`
// i `COMMUNDATE` alimenten tots dos la banda de les dates):
//
//   SyndicObjectID    -> `nota_curador`, dins del tag [ADT66 id: …]. MAI a cap
//                        camp públic (§2 quater: l'esquema no creix).
//   SyndicObjectName  -> `titol`, tal qual. Ve en francès i en MAJÚSCULES;
//                        no es tradueix ni es canvia de caixa aquí.
//   TRI               -> `data_inici` i `data_fi`, per classificaDates().
//   COMMUNDATE        -> `hora`, el primer «De HH:MM».
//   COMMUNLIEU        -> `lloc`, net d'HTML i de l'etiqueta «Lieu :».
//   Commune           -> `municipi`, normalitzat amb eines/pobles-alies.js.
//   RechercheTYPE     -> `categoria`, traduïda del francès i coercida.
//   DETAILDESCRIPTIF  -> `descripcio_fr`, net d'HTML i de l'etiqueta francesa.
//   DETAILCONTACT     -> `associacio`, net d'HTML.
//   LISTINGPHOTO      -> `imatge_url`, l'`src` de l'`<img>`.
//   DETAILSITEWEB     -> `font_url`, l'`href` de l'`<a>`.
//
// ELS QUE NO ARRIBEN A LA FILA, i per què. Cap no es perd en silenci: o bé és
// un senyal consumit, o bé va a `metadadades`:
//
//   Updated           -> metadadades.font.actualitzat. És la marca de la
//                        sincronització diferencial, no una dada de l'acte.
//   Published         -> metadadades.font.publicat.
//   ObjectTypeName    -> metadadades.font.tipus_objecte («Fêtes et manifestations»).
//   GmapLatitude      -> metadadades.descartats.latitud. La comarca es treu del
//   GmapLongitude     -> metadadades.descartats.longitud.  municipi, no de les
//                        coordenades (§2 bis del handoff). No es fan servir.
//   Structure         -> metadadades.font.estructura, només el `Name`: és
//                        l'oficina de turisme que ha entrat l'oferta, no
//                        l'organitzador. NO va a `associacio`: posar-hi
//                        l'oficina seria dir que l'acte és seu.
//   DETAILADRESSE     -> metadadades.descartats.adreca. NO es fusiona dins de
//                        `lloc`: mateixa raó que al CSV de recerca (§2 de
//                        docs/HANDOFF-MAPEIG-RECERCA.md) — `lloc` és el nom del
//                        local i una adreça postal no ho és.
//   DETAILCOMMUNE     -> metadadades.descartats.municipi_amb_codi. És `Commune`
//                        amb el codi postal enganxat; el codi no és cap camp.
//   ACCROCHE150       -> metadadades.descartats.resum_curt. Un resum de 150
//                        caràcters. NO es fa servir de recanvi de
//                        `DETAILDESCRIPTIF`, que hi és a totes les ofertes.
//   LISTINGACCROCHE   -> metadadades.descartats.resum_llistat. Ídem.
//   DETAILPROGRAMME   -> metadadades.descartats.programa.
//   DETAILTELEPHONE   -> metadadades.descartats.telefon.
//   DETAILCOURRIEL    -> metadadades.descartats.correu.
//   DETAILFETEPAYANTE -> metadadades.descartats.de_pagament. Producció no té
//                        camp de preu i el §8 de CLAUDE.md no en demana cap.
//   DETAILPHOTO       -> metadadades.descartats.foto_detall. Segona foto.
//   DETAILPHOTO_DIAPO -> metadadades.descartats.foto_detall_diapo.
//   LISTINGPHOTO_DIAPO-> metadadades.descartats.foto_llistat_diapo.
//   COMMUNTHEME       -> metadadades.descartats.tema.      Vocabularis interns de
//   COMMUNCATEGORIE   -> metadadades.descartats.categoria_adt66.  l'ADT66. La
//   COMMUNTYPE        -> metadadades.descartats.tipus_adt66.  categoria bona és
//   COMMUNNOM         -> metadadades.descartats.nom_comun.   `RechercheTYPE`.
//   CHAMPSYSTEME      -> metadadades.descartats.camp_sistema. Camp intern.
//
// **Els dos que falten dels 35.** El handoff n'enumera 25 pel seu nom i diu
// «els deu de sempre» sense llistar-los; d'aquells deu, vuit surten anomenats
// als §1.4, §1.5 i §2 bis i són els vuit d'aquí dalt (SyndicObjectID,
// SyndicObjectName, Updated, Published, ObjectTypeName, GmapLatitude,
// GmapLongitude, Structure). Els altres dos no queden escrits enlloc del
// handoff. Aquest mapeig NO en fa servir cap: si el dia que es mesuri el flux
// resulta que porten alguna cosa útil, s'afegeixen aquí i a la taula.
//
//
// --- QUATRE COSES QUE AQUEST MAPEIG NO RESOL, I ÉS A POSTA ----------------
//
// 1. **`comarca` es deduïx del municipi, i al flux d'avui surt SEMPRE plena.**
//    Cap dels 35 camps no la porta, i el handoff diu que surt «del municipi, no
//    de les coordenades» — o sigui d'una taula municipi -> comarca. Aquesta
//    taula ara existeix: **eines/comarca-per-poble.js**, escrita el 31 d'agost
//    de 2026 justament per això. Al flux d'aquell dia resol **els 125
//    municipis** i **les 1 453 ofertes**, cap exclosa.
//    Que avui no en quedi cap fora no vol dir que el camí de sortida no hi
//    sigui: un municipi que no sigui a la taula continua caient a "" amb avís
//    al curador, perquè una fila sense comarca no surt al filtre per comarca
//    del web públic.
//    ABANS DEL 31 D'AGOST DE 2026 aquest punt deia que la comarca quedava
//    SEMPRE buida perquè la taula no existia. Si trobes aquesta frase en
//    qualsevol document del projecte, és anterior a aquella data.
//
// 2. **El títol no es tradueix ni es passa a caixa normal.** Ve
//    «LES OCCASIONS DU MULTICOQUE & DU REFIT» i surt igual, amb un avís. La
//    traducció és feina del curador a tot el projecte (§7 de CLAUDE.md, la
//    regla del Typebot), i canviar la caixa a màquina espatlla els noms
//    propis i les sigles. Val més un títol lleig i cert que un d'endreçat i
//    inventat.
//
// 3. **L'`imatge_url` surt amb el `?width=150&height=120` que hi posa
//    l'ADT66.** 150 px no serveix per a un cartell, i això ja se sap. Aquí
//    l'`src` es copia tal com ve, sense tocar-lo: qui desfà el retall és
//    variantsDeCartell(), a eines/puja-cartell.js, que prova l'adreça sense
//    paràmetres i, si no hi és, la del retall. Era la pregunta oberta 5 del §5
//    del handoff, resolta el 31 d'agost de 2026.
//
// 4. **Els actes passats no es treuen.** Una oferta d'una sola data ja
//    passada genera fila igualment. Treure-les és el filtre previ
//    (eines/filtra-candidats.js), amb el mateix criteri per a totes les
//    fonts. L'única excepció ja la fa classificaDates(): una sèrie periòdica
//    sense cap ocurrència futura no té data d'inici i, per tant, no té id.
//
//
// --- LA NOTA DEL CURADOR --------------------------------------------------
//
// EL TAG D'ANCORATGE VA SEMPRE PRIMER, també quan és l'única cosa que hi ha.
// És el contracte que demana el §«CONTRACTE PER A QUI ESCRIGUI EL MAPATGE» de
// eines/adt66-identificador.js: el que diu QUI ÉS la fila va davant del que
// en diu la crítica (procedència, verificació, classificació, cartell), que
// s'hi concatenaran darrere amb ajuntaNotes() quan passin.
//
// A efectes de codi l'ordre és lliure —extreuIdentificador() cerca a tot el
// text—, però la convenció és per al lector de l'avís groc de curador.html, i
// aquesta peça la compleix sense excepció.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/mapeja-adt66.js    -> passa la bateria de proves
// ---------------------------------------------------------------------------


// --- El que ve de fora ------------------------------------------------------

// Els noms de poble en les dues llengües, compartits amb el dedup i amb el
// mapeig de recerca.
var pobles = require('./pobles-alies.js');

// I la pertinença comarcal de cada poble, que viu al seu costat. És la peça
// que fa que aquest canal pugui omplir el camp `comarca`: el flux de l'ADT66
// no en porta cap, i el municipi la determina del tot.
var comarques = require('./comarca-per-poble.js');

// La regla de dates del §3 bis del handoff. Es crida, no es copia: el dia que
// es toqui el llindar, s'ha de tocar en un sol lloc.
var sincronitza = require('./adt66-sincronitza.js');

// El tag d'ancoratge [ADT66 id: …] i la regla d'encadenar notes.
var identificador = require('./adt66-identificador.js');
var dedup = require('./dedup-esdeveniments.js');


// --- Constants: els esquemes ------------------------------------------------

// Els disset camps de producció, amb el nom i l'ordre del §4 de CLAUDE.md. La
// fila que surt d'aquí té sempre aquests disset i cap més, en aquest ordre.
var CAMPS_PRODUCCIO = [
  'id', 'titol', 'data_inici', 'data_fi', 'hora', 'lloc', 'municipi',
  'comarca', 'categoria', 'descripcio_ca', 'descripcio_fr', 'associacio',
  'imatge_url', 'font_url', 'estat', 'data_entrada', 'nota_curador'
];

var COMARQUES = ['Rosselló', 'Conflent', 'Vallespir', 'Capcir', 'Cerdanya'];

var CATEGORIES = [
  'Música', 'Teatre', 'Dansa i ball', 'Conferència', 'Exposició', 'Mercat',
  'Cinema', 'Taller', 'Activitat infantil', 'Patrimoni i tradicions',
  'Concentració', 'Esports', 'Vida associativa'
];


// --- Constants: les categories del flux -------------------------------------

// `RechercheTYPE` ve en francès i sovint amb més d'un valor separat per comes
// («Exposition,Foire»). Aquesta taula ja NO és una conjectura: el 3 de
// setembre de 2026 es va baixar el flux sencer —1 463 ofertes, 41 valors
// distints de `RechercheTYPE`— i s'hi va comptar la distribució real. Els 41
// valors hi són tots: cap no queda sense decidir per descuit.
//
// COMPTE AMB EL SEPARADOR. La coma fa dues feines i no es distingeixen bé:
// separa valors («Spectacle,Théâtre») però també viu DINS de dos valors
// («Projection, cinéma» i «Randonnée, balade»). Partir per comes els trenca
// per la meitat. No passa res, i és a posta: totes dues meitats són a la
// taula i porten a la mateixa categoria, o sigui que el resultat és el mateix
// es parteixi com es parteixi. Les formes senceres també hi són, per si algun
// dia es deixa de partir.
var CATEGORIES_ADT66 = {
  // Directes, un a un.
  'exposition': 'Exposició',
  'concert': 'Música',
  'musique': 'Música',
  'theatre': 'Teatre',
  'marche': 'Mercat',
  'debat / conference': 'Conferència',
  'debat': 'Conferència',
  'conference': 'Conferència',
  'projection, cinema': 'Cinema',
  'projection': 'Cinema',
  'cinema': 'Cinema',
  'stage / atelier': 'Taller',
  'stage': 'Taller',
  'atelier': 'Taller',
  'visite guidee': 'Patrimoni i tradicions',
  'visite': 'Patrimoni i tradicions',
  'patrimoine': 'Patrimoni i tradicions',
  'bal': 'Dansa i ball',
  'danse': 'Dansa i ball',

  // Festa i tradició.
  'festa major': 'Patrimoni i tradicions',
  'aplec': 'Patrimoni i tradicions',
  'defile cortege parade': 'Patrimoni i tradicions',
  "feux d'artifice": 'Patrimoni i tradicions',
  'son et lumiere': 'Patrimoni i tradicions',
  'commemoration': 'Patrimoni i tradicions',

  // Tota mena de parada.
  'vide-grenier': 'Mercat',
  'foire': 'Mercat',
  'brocante': 'Mercat',
  'braderie': 'Mercat',

  // Esports. «Randonnée, balade» ve sempre junt i es parteix per la coma.
  'randonnee, balade': 'Esports',
  'randonnee': 'Esports',
  'balade': 'Esports',
  'pratique sportive encadree': 'Esports',
  'manifestation sportive': 'Esports',
  'competition': 'Esports',
  'trail': 'Esports',
  'excursion': 'Esports',
  'rallye': 'Esports',

  // Vida associativa: el que fa una entitat per als seus.
  'the dansants': 'Vida associativa',
  'rifles': 'Vida associativa'
};

// Els vuit valors que NO s'autoclassifiquen MAI. No és que no sabem
// traduir-los: és que la tria és editorial i la fa el propietari, un per un.
// La fila queda amb `categoria: ""` i una nota que diu el valor original.
//
// «Rassemblement / réunion» és aquí i NO va a `Concentració`, tot i que sigui
// la traducció literal. Ho demana l'encàrrec: un forum d'associacions, una
// assemblea general i una manifestació hi surten totes amb la mateixa
// etiqueta, i el codi no les pot distingir.
var TIPUS_SENSE_CALAIX = {
  'salon': 'Salon',
  'portes ouvertes': 'Portes ouvertes',
  'rassemblement / reunion': 'Rassemblement / réunion',
  'action citoyenne': 'Action citoyenne',
  'repas spectacle': 'Repas spectacle',
  "pot d'accueil": "Pot d'accueil",
  'concours': 'Concours',
  'arts de la rue': 'Arts de la rue'
};

// «Spectacle» (167 ofertes) i «Festival» (28) no diuen de què va l'acte:
// diuen la seva forma. Miren els altres valors de la mateixa oferta, i si no
// n'hi ha cap de reconegut cauen a Teatre, que és el calaix menys dolent per
// a un espectacle escènic sense més senyal.
var TIPUS_COETIQUETA = {
  'spectacle': 'Spectacle',
  'festival': 'Festival'
};

// El valor que demana mirar el títol: `RechercheTYPE` sol no distingeix un
// club d'escacs d'un escape game comercial. Són 45 ofertes.
var TIPUS_JEUX = 'jeux';

// Els patrons de joc de taula o de club, al títol ja normalitzat. Surten de
// mirar els 45 títols de `Jeux` del flux del 3 de setembre de 2026.
var PATRONS_JOC_DE_CLUB = [
  'petanque', 'scrabble', 'echecs', 'belote', 'tarot', 'cartes', 'dominos',
  'bitlles', 'quilles', 'rami', 'bridge', 'dames', 'loto',
  'jeu de societe', 'jeux de societe', 'club de jeu',
  'soiree jeux', 'session jeux', 'apres-midi jeux'
];

// Els patrons de negoci comercial. No decideixen cap categoria: només fan que
// la nota digui per què la fila queda buida.
var PATRONS_JOC_COMERCIAL = [
  'escape game', 'laser game', 'paintball', 'karting', 'bowling',
  'accrobranche', 'realite virtuelle'
];

// El forum d'associacions es reconeix pel TÍTOL i no per `RechercheTYPE`: les
// 40 ofertes del flux es reparteixen entre `Salon`, `Portes ouvertes`,
// `Rassemblement / réunion`, `Vide-grenier` i cap valor. Cap no diu què és.
var PATRO_FORUM = 'forum';
// Escurçat a «assoc» a posta i no «associa»: el flux del 3 de setembre de
// 2026 porta una oferta escrita «FORUM DES ASSOCATIONS», amb l'errada de
// l'origen, i «associa» se la deixava. Amb «forum» al davant, «assoc» no
// pot agafar res que no sigui això.
var PATRO_ASSOCIACIONS = 'assoc';


// --- Constants: les etiquetes franceses del flux ----------------------------

// Els camps del flux porten una etiqueta en francès enganxada al davant del
// text de debò («Descriptif de la manifestation : Canet-en-Roussillon
// devient…», «Lieu : au Port»). Si no es treu, acaba dins de `lloc` i de
// `descripcio_fr` com si fos contingut. El patró agafa unes quantes paraules
// seguides de dos punts al començament del text ja net d'HTML, i només si són
// poques: una etiqueta és de tres o quatre paraules, i una frase de debò amb
// dos punts al mig és molt més llarga.
var ETIQUETA_FRANCESA = /^[A-ZÀ-Ý][^:.!?]{0,60}\s*:\s*/;

// El separador de valors de `RechercheTYPE`.
var SEPARADOR_TIPUS = ',';


// --- La funció --------------------------------------------------------------

// ------------------------------------------------------------
// Converteix una oferta del flux WCF de l'ADT66 en una fila de producció.
// Torna dues coses ben separades, la mateixa forma que mapejaAProduccio():
//
//   fila         els camps canònics, tots cadenes, en l'ordre del §4. És
//                l'únic que pot anar a pendents.json.
//   metadadades  tota la resta: d'on surt, quan es va tocar, i el que s'ha
//                descartat pel camí. NO té encara cap lloc definitiu al
//                sistema, igual que la de mapeja-recerca.js.
//
// Una oferta que no porti un camp és igual que una que el porti buit o a
// `null`: tot això és "" (§4 de CLAUDE.md: mai null, mai absent). El flux en
// porta de `null` de debò —898 de 1 504 a `DETAILSITEWEB`—, o sigui que la
// coerció no és teòrica.
// ------------------------------------------------------------
function mapejaOfertaADT66(ofertaWCF) {
  var oferta = ofertaWCF || {};
  var avisos = [];

  var titol = titolDeProduccio(oferta, avisos);
  var quan = datesDeProduccio(oferta, avisos);
  var municipi = municipiDeProduccio(cadena(oferta.Commune), avisos);
  // La descripció es calcula aquí i no dins de la fila perquè els senyals
  // de més avall també l'han de llegir. Cridar-la dues vegades duplicaria
  // els avisos que empeny.
  var descripcio = descripcioDeProduccio(oferta, avisos);

  var fila = {
    // L'id no s'hereta MAI: el SyndicObjectID de l'oferta no hi entra.
    id: creaId(quan.data_inici, titol),
    titol: titol,
    data_inici: quan.data_inici,
    data_fi: quan.data_fi,
    hora: quan.hora,
    lloc: llocDeProduccio(oferta),
    municipi: municipi,
    // El municipi ja normalitzat, no el brut: la deducció de comarca vol el
    // nom en la forma que la taula coneix.
    comarca: comarcaDeProduccio(municipi, avisos),
    categoria: categoriaDeProduccio(cadena(oferta.RechercheTYPE), titol, avisos),
    // El flux és tot en francès: la banda catalana la completa el curador,
    // exactament la regla del Typebot (§7 de CLAUDE.md).
    descripcio_ca: '',
    descripcio_fr: descripcio,
    associacio: textDeCamp(oferta.DETAILCONTACT),
    imatge_url: adrecaDeImatge(oferta.LISTINGPHOTO),
    font_url: adrecaDeEnllac(oferta.DETAILSITEWEB),
    // Els dos camps que omple el sistema i que la font no toca mai.
    estat: 'pendent',
    data_entrada: new Date().toISOString(),
    // S'omple al final, quan ja s'han recollit tots els avisos.
    nota_curador: ''
  };

  if (fila.id === '') {
    avisos.push('Sense data futura: l\'id queda buit i aquesta fila no es pot identificar.');
  }

  // Els dos senyals. NO toquen mai ni la categoria ni l'estat: només
  // afegeixen un avís perquè el curador hi vagi a mirar.
  avisaDeNovaEra(titol, descripcio, avisos);
  avisaDePreuEsportiu(fila.categoria, descripcio, avisos);

  fila.nota_curador = notaCurador(oferta, avisos);

  return {
    fila: ordenaSegonsEsquema(fila),
    metadadades: metadadadesDeProduccio(oferta, quan, avisos)
  };
}


// --- La nota del curador ----------------------------------------------------

// ------------------------------------------------------------
// La `nota_curador` de la fila: el tag d'ancoratge PRIMER, i els avisos
// d'aquest mapeig darrere. S'ajunten amb ajuntaNotes(), que és la regla
// compartida d'encadenar notes (eines/dedup-esdeveniments.js).
//
// L'ordre no és estètic. El tag diu QUI ÉS la fila —de quina oferta ve— i els
// avisos són judicis sobre el seu contingut; el que diu qui és va davant. I
// és el que demana el contracte del §«CONTRACTE» de
// eines/adt66-identificador.js, que compta que els agents de darrere
// (procedència, verificació, classificació, cartell) hi concatenin darrere.
//
// Una oferta sense `SyndicObjectID` no dona cap tag —creaTagIdentificador()
// hi torna ""— i llavors la nota són els avisos i prou. No és cap error de
// forma: és una fila sense ancoratge, que és la veritat.
// ------------------------------------------------------------
function notaCurador(oferta, avisos) {
  var tag = identificador.creaTagIdentificador(oferta.SyndicObjectID);
  return dedup.ajuntaNotes(tag, avisos.join(' '));
}


// --- Els senyals: avisos que no canvien mai la fila -------------------------
// Tots dos NOMÉS empenyen text a `avisos`, que acabarà a `nota_curador`. No
// toquen ni `categoria` ni `estat`: cap fila no es descarta ni es reclassifica
// per un senyal. La decisió és sempre del curador.

// El vocabulari de nova era, en dues llistes i no una. La de sota és de
// termes que sols no volen dir res —una conferència sobre «l'énergie» pot ser
// d'plaques solars— i per això en calen DOS perquè el senyal salti. La de
// dalt són termes que en un cartell cultural no surten per casualitat.
//
// La llista és OBERTA a posta i no pretén ser cap taxonomia: si el curador
// veu que se li escapa alguna cosa, hi afegeix la paraula i ja està.
var NOVA_ERA_FORTS = [
  'chakra', 'chakras', 'gourou', 'guru', 'holistique', 'holistiques',
  'reiki', 'channeling', 'chamanisme', 'chamanique', 'lithotherapie',
  'sonotherapie', 'guerisseur', 'guerisseuse', 'magnetisme', 'radiesthesie',
  'geobiologie', 'kundalini', 'karma', 'akashiques',
  'eveil spirituel', 'nouvel age', 'new age', 'fleurs de bach',
  'soin energetique', 'soins energetiques', 'medecine douce',
  'medecines douces'
];

var NOVA_ERA_FEBLES = [
  'spiritualite', 'spirituel', 'spirituelle', 'energie', 'energies',
  'energetique', 'vibration', 'vibratoire', 'meditation', 'bien-etre',
  'sophrologie', 'yoga', 'ressourcement', 'harmonisation', 'lacher-prise',
  'developpement personnel', 'transformation interieure'
];

// Quants euros fan que una activitat esportiva mereixi una ullada.
//
// D'ON SURT EL 25. El flux de l'ADT66 NO PORTA CAP CAMP DE PREU:
// `DETAILFETEPAYANTE` sembla que n'hagi de ser un pel nom, però és un booleà
// —«Entrée gratuite : oui» (637 ofertes) o «non» (634)— i no diu mai quant
// costa res. L'únic import que hi ha en tot el flux és el que algú hagi
// escrit dins de la descripció, en text corrent.
//
// El 25 és un número TRIAT, no mesurat: a la comarca, una sortida d'entitat
// va de 5 a 15 €, i per damunt de 25 ja acostuma a ser una prova comercial
// amb cronometratge. Amb aquest llindar, el 3 de setembre de 2026 el senyal
// salta a 3 ofertes de les 1 463: una balada en caiac de 60 € i la Ronde
// Céretana de 28 €, que hi surt dos cops. Si es demostra que va curt o
// llarg, es canvia aquesta constant i prou.
var EUROS_QUE_FAN_MIRAR = 25;

// Els imports en euros escrits dins d'un text. Accepta «12 €», «12&euro;»,
// «12 euros» i «12 EUR», amb decimals o sense.
var PATRO_EUROS = /(\d{1,4})(?:[.,]\d{1,2})?\s*(?:€|&euro;|euros?|eur)(?![a-z])/gi;

// ------------------------------------------------------------
// Marca una fila que fa olor de nova era o de guia espiritual. Mira el títol
// i la descripció alhora, perquè el títol sol sovint no ho diu.
// ------------------------------------------------------------
function avisaDeNovaEra(titol, descripcio, avisos) {
  var text = normalitzaText(titol + ' ' + descripcio);

  if (text === '') {
    return;
  }

  var trobats = paraulesTrobades(text, NOVA_ERA_FORTS);

  if (trobats.length === 0) {
    var febles = paraulesTrobades(text, NOVA_ERA_FEBLES);
    // Un terme feble tot sol no diu res; dos ja fan un patró.
    if (febles.length < 2) {
      return;
    }
    trobats = febles;
  }

  avisos.push('Possible nova era o guia espiritual («' + trobats.join('», «') +
    '»): comproveu de qui és l\'acte i si hi entra.');
}

// ------------------------------------------------------------
// Marca una activitat esportiva que demani un import alt. Només mira les
// files que han quedat a Esports: a la resta, el preu no és aquest senyal.
// ------------------------------------------------------------
function avisaDePreuEsportiu(categoria, descripcio, avisos) {
  if (categoria !== 'Esports') {
    return;
  }

  var maxim = euroMesAlt(descripcio);

  if (maxim < EUROS_QUE_FAN_MIRAR) {
    return;
  }

  avisos.push('Possible activitat esportiva de pagament elevat (' + maxim +
    ' €): comproveu si és una entitat o un negoci.');
}

// ------------------------------------------------------------
// L'import en euros més alt que hi hagi dins d'un text, o 0 si no n'hi ha
// cap. Els cèntims s'ignoren: per decidir si un preu és alt no fan res.
// ------------------------------------------------------------
function euroMesAlt(text) {
  var net = cadena(text);

  if (net === '') {
    return 0;
  }

  var maxim = 0;
  // El patró és global i guarda la posició entre crides: es reinicia sempre.
  PATRO_EUROS.lastIndex = 0;
  var trobat = PATRO_EUROS.exec(net);

  while (trobat !== null) {
    var import_ = Number(trobat[1]);
    if (import_ > maxim) {
      maxim = import_;
    }
    trobat = PATRO_EUROS.exec(net);
  }

  return maxim;
}

// ------------------------------------------------------------
// Quines paraules d'una llista surten dins d'un text ja normalitzat, com a
// paraula sencera. Sense això, «karma» sortiria dins de «karmapolice».
//
// I ATENCIÓ AMB LES HOMOGRAFIES, que la comprovació de paraula sencera no
// resol: «aura» era a la llista forta i es va haver de treure, perquè en
// francès és el futur d'«avoir» —«la fête aura lieu»— i marcava 27 de les
// 45 ofertes. Abans d'afegir un terme curt, comproveu que no sigui també
// una paraula corrent en francès.
// ------------------------------------------------------------
function paraulesTrobades(text, paraules) {
  var trobades = [];

  for (var i = 0; i < paraules.length; i++) {
    if (teParaulaSencera(text, paraules[i])) {
      trobades.push(paraules[i]);
    }
  }

  return trobades;
}

// ------------------------------------------------------------
// Si una paraula surt dins d'un text sense cap lletra enganxada ni davant ni
// darrere. El text ja ve en minúscules i sense accents, o sigui que amb l'a-z
// n'hi ha prou.
// ------------------------------------------------------------
function teParaulaSencera(text, paraula) {
  var des = text.indexOf(paraula);

  while (des !== -1) {
    var abans = des === 0 ? ' ' : text.charAt(des - 1);
    var despres = text.charAt(des + paraula.length) || ' ';

    if (!esLletra(abans) && !esLletra(despres)) {
      return true;
    }

    des = text.indexOf(paraula, des + 1);
  }

  return false;
}

// ------------------------------------------------------------
// Si un caràcter és una lletra de l'a a la z. Prou per a un text normalitzat.
// ------------------------------------------------------------
function esLletra(caracter) {
  return caracter >= 'a' && caracter <= 'z';
}

// --- Les peces: els camps que necessiten una decisió ------------------------

// ------------------------------------------------------------
// El títol que va a producció. Ve de `SyndicObjectName`, en francès i en
// majúscules, i surt tal qual amb un avís: la traducció i la caixa són feina
// del curador (vegeu el §«QUATRE COSES» de la capçalera).
// ------------------------------------------------------------
// Es neteja amb textDeHtml() i NO amb textDeCamp(): `SyndicObjectName` és un
// camp de text pla, no en porta cap etiqueta francesa al davant, i passar-hi
// el patró d'etiquetes escapçaria qualsevol títol que dugui dos punts
// («FESTIVAL : LES NUITS DE…» es quedaria en «LES NUITS DE…»).
function titolDeProduccio(oferta, avisos) {
  var titol = textDeHtml(cadena(oferta.SyndicObjectName));

  if (titol !== '') {
    avisos.push('El títol ve del flux de l\'ADT66 en francès i en majúscules: cal traduir-lo i posar-lo en caixa normal.');
  }

  return titol;
}

// ------------------------------------------------------------
// Les tres dates de l'esquema. La classificació contigu/periòdic la fa
// classificaDates() d'eines/adt66-sincronitza.js, que és qui té la regla del
// §3 bis del handoff: aquí NO es reimplementa res, només es crida i s'hi
// afegeix l'avís que li toca al curador.
//
// Un acte periòdic es publica com un sol dia —la propera ocurrència— i els
// altres dies es perden: és una pèrdua real, deliberada i documentada. El
// curador ha de saber que aquella fila no diu tots els dies de l'acte.
// ------------------------------------------------------------
function datesDeProduccio(oferta, avisos) {
  var dates = sincronitza.datesDeLoferta(oferta);

  if (dates.length === 0) {
    avisos.push('L\'oferta de l\'ADT66 no porta cap data llegible al camp TRI.');
    return { data_inici: '', data_fi: '', hora: '', tipus: 'contigu', quantes: 0 };
  }

  var classificacio = sincronitza.classificaDates(dates);

  if (classificacio.tipus === 'dispers' && classificacio.dataInici !== '') {
    avisos.push('L\'acte es fa ' + dates.length + ' dies escampats: només se\'n publica la propera ocurrència, i els altres dies no hi surten.');
  }

  if (classificacio.tipus === 'dispers' && classificacio.dataInici === '') {
    avisos.push('Totes les ' + dates.length + ' dates de l\'acte són passades.');
  }

  return {
    data_inici: classificacio.dataInici,
    data_fi: classificacio.dataFi,
    hora: sincronitza.horaDeLoferta(oferta),
    tipus: classificacio.tipus,
    quantes: dates.length
  };
}

// ------------------------------------------------------------
// El nom del local, de `COMMUNLIEU`. Ve amb HTML i amb l'etiqueta «Lieu :»
// al davant; totes dues coses fora. L'adreça postal de `DETAILADRESSE` NO
// s'hi fusiona: `lloc` és el nom del local i una adreça no ho és.
// ------------------------------------------------------------
function llocDeProduccio(oferta) {
  return textDeCamp(oferta.COMMUNLIEU);
}

// ------------------------------------------------------------
// La descripció francesa, de `DETAILDESCRIPTIF`. Ve amb HTML i amb
// «Descriptif de la manifestation :» al davant; totes dues coses fora. La
// banda catalana queda buida i s'avisa, com al mapeig de recerca.
// ------------------------------------------------------------
function descripcioDeProduccio(oferta, avisos) {
  var text = textDeCamp(oferta.DETAILDESCRIPTIF);

  if (text !== '') {
    avisos.push('Descripció en francès: falta la traducció catalana.');
  }

  return text;
}

// ------------------------------------------------------------
// La comarca. Cap dels 35 camps del flux no la porta —no és una divisió que
// l'administració francesa faci servir—, o sigui que es deduïx del municipi
// amb eines/comarca-per-poble.js. Deduir-la no és cap suposició: el municipi
// determina la comarca del tot.
//
// FINS AL 31 D'AGOST DE 2026 AQUÍ NO ES DEDUÏA RES: no hi havia taula, el
// camp quedava "" a TOTES les files d'aquest canal i s'avisava el curador
// perquè la posés a mà. Ara la taula existeix i l'avís només surt quan el
// poble no hi és, que al flux d'aquell dia no és cap municipi de 125.
//
// Passa igualment per valorPermes() perquè totes les vies d'entrada coerceixin
// l'enum de la mateixa manera: obtenComarca() ja torna un dels cinc valors o
// "", però la coerció és la mateixa a tot arreu i no s'ha de saltar aquí.
// ------------------------------------------------------------
function comarcaDeProduccio(municipi, avisos) {
  var comarca = valorPermes(comarques.obtenComarca(municipi), COMARQUES);

  if (comarca === '') {
    avisos.push('El municipi «' + municipi + '» no és a la taula de comarques: cal posar la comarca a mà, o la fila no sortirà al filtre per comarca.');
  }

  return comarca;
}

// ------------------------------------------------------------
// La categoria. Sis passos, en aquest ordre exacte, i l'ordre és tot:
//
//   1. El títol, quan diu una cosa que `RechercheTYPE` no pot dir: el forum
//      d'associacions, i el joc de club quan l'oferta porta `Jeux`.
//   2. La taula directa, valor per valor; mana el primer que tingui calaix.
//   3. `Jeux` sense patró reconegut al títol -> buida, amb nota.
//   4. Un dels vuit valors que no s'autoclassifiquen -> buida, amb nota.
//   5. `Spectacle` o `Festival` tots sols -> Teatre, amb nota.
//   6. Res de tot això -> buida, amb nota.
//
// PER QUÈ EL TÍTOL VA PRIMER. Dels 45 casos de `Jeux`, uns quants porten
// també un valor de la taula directa: «CONCOURS DE PÉTANQUE À RIGARDA» ve
// amb `Jeux,Pratique sportive encadrée`. Si la taula manés, la petanca
// acabaria a Esports, i l'encàrrec diu que la petanca és Vida associativa.
// Per als 40 forums d'associacions és el mateix: cap dels seus valors
// (`Salon`, `Portes ouvertes`, `Rassemblement / réunion`, `Vide-grenier`) no
// diu què és, i un d'ells el faria Mercat.
//
// PER QUÈ EL PAS 3 VA DESPRÉS DE LA TAULA I NO ABANS. Hi ha ofertes com
// «Concert,Jeux,Spectacle» on `Jeux` és una etiqueta secundària d'un
// concert. Si `Jeux` decidís abans que la taula, un concert quedaria buit.
//
// PER QUÈ EL PAS 4 VA ABANS DEL 5. «Salon,Spectacle» existeix al flux (2
// ofertes). La lletra de l'encàrrec diu que `Spectacle` tot sol, «sense cap
// altre valor reconegut», cau a Teatre; i `Salon` no és cap valor reconegut.
// Però un saló amb espectacle és un saló, i posar-lo a Teatre seria just la
// endevinalla que la llista dels vuit vol evitar. Mana la llista dels vuit i
// la fila va a revisió. ÉS UNA INTERPRETACIÓ, no la lletra: si es vol l'altra,
// s'intercanvien els dos blocs i prou.
//
// La categoria de producció és UNA, no una llista.
// ------------------------------------------------------------
function categoriaDeProduccio(valor, titol, avisos) {
  var clauTitol = normalitzaText(titol);
  var tipus = tipusReconeguts(valor);

  // 1. El títol, per damunt de tot.
  if (clauTitol.indexOf(PATRO_FORUM) !== -1 &&
      clauTitol.indexOf(PATRO_ASSOCIACIONS) !== -1) {
    return 'Vida associativa';
  }
  if (tipus.teJeux && tePatro(clauTitol, PATRONS_JOC_DE_CLUB)) {
    return 'Vida associativa';
  }

  // 2. La taula directa.
  if (tipus.categoria !== '') {
    return tipus.categoria;
  }

  // 3. `Jeux` que no és cap joc de club.
  if (tipus.teJeux) {
    if (tePatro(clauTitol, PATRONS_JOC_COMERCIAL)) {
      avisos.push('Ve marcada «Jeux» i el títol sembla una activitat comercial: la categoria queda buida a posta. Decidiu-la a mà, o deixeu la fila fora.');
    } else {
      avisos.push('Ve marcada «Jeux» sense cap patró de joc de club al títol: la categoria queda buida. Si és un joc d\'entitat, és Vida associativa; si és un negoci, la fila no hi entra.');
    }
    return '';
  }

  // 4. Els vuit que no s'autoclassifiquen mai.
  if (tipus.senseCalaix.length > 0) {
    avisos.push('La categoria queda buida a posta: «' + tipus.senseCalaix.join('», «') + '» no s\'autoclassifica i l\'ha de decidir el curador.');
    return '';
  }

  // 5. La co-etiqueta tota sola.
  if (tipus.coetiqueta !== '') {
    avisos.push('Ve marcada només «' + tipus.coetiqueta + '», que no diu de què va: es posa Teatre per defecte. Comproveu-ho.');
    return 'Teatre';
  }

  // 6. Res.
  if (cadena(valor) !== '') {
    avisos.push('La categoria «' + cadena(valor) + '» no té equivalent entre les tretze: queda buida.');
  }
  return '';
}

// ------------------------------------------------------------
// Llegeix el `RechercheTYPE` sencer d'una oferta i en torna els quatre
// senyals que el pas de decisió necessita, tots alhora:
//
//   categoria    la primera de la taula directa, o "" si no n'hi ha cap
//   senseCalaix  els valors dels vuit que no s'autoclassifiquen, pel seu nom
//   coetiqueta   «Spectacle» o «Festival» si n'hi ha, o ""
//   teJeux       si l'oferta ve marcada «Jeux»
//
// Es fa en una passada perquè els quatre surten de la mateixa llista i
// recórrer-la quatre vegades no diria res més.
// ------------------------------------------------------------
function tipusReconeguts(valor) {
  var senyals = {
    categoria: '',
    senseCalaix: [],
    coetiqueta: '',
    teJeux: false
  };

  var text = cadena(valor);
  if (text === '') {
    return senyals;
  }

  var trossos = text.split(SEPARADOR_TIPUS);

  for (var i = 0; i < trossos.length; i++) {
    var clau = normalitzaText(trossos[i]);
    if (clau === '') {
      continue;
    }

    if (clau === TIPUS_JEUX) {
      senyals.teJeux = true;
      continue;
    }
    if (TIPUS_SENSE_CALAIX[clau] !== undefined) {
      senyals.senseCalaix.push(TIPUS_SENSE_CALAIX[clau]);
      continue;
    }
    if (TIPUS_COETIQUETA[clau] !== undefined) {
      if (senyals.coetiqueta === '') {
        senyals.coetiqueta = TIPUS_COETIQUETA[clau];
      }
      continue;
    }
    // Una font que ja escrigui el vocabulari bo ha de poder passar directa.
    if (senyals.categoria === '') {
      senyals.categoria = categoriaDunTros(trossos[i]);
    }
  }

  return senyals;
}

// ------------------------------------------------------------
// Un sol valor de `RechercheTYPE` traduït a una de les tretze, o "" si no en
// té cap. Primer es prova el vocabulari bo, després la taula del francès.
// ------------------------------------------------------------
function categoriaDunTros(tros) {
  var net = cadena(tros);

  if (net === '') {
    return '';
  }

  var directa = valorPermes(net, CATEGORIES);
  if (directa !== '') {
    return directa;
  }

  var traduida = CATEGORIES_ADT66[normalitzaText(net)] || '';

  return valorPermes(traduida, CATEGORIES);
}

// ------------------------------------------------------------
// Si un text ja normalitzat conté algun dels patrons de la llista.
// ------------------------------------------------------------
function tePatro(text, patrons) {
  if (text === '') {
    return false;
  }
  for (var i = 0; i < patrons.length; i++) {
    if (text.indexOf(patrons[i]) !== -1) {
      return true;
    }
  }
  return false;
}

// ------------------------------------------------------------
// La clau de cerca de tot el que es compara amb un patró: minúscules, sense
// accents, amb els apòstrofs corbats passats a rectes i els espais repetits a
// un. El francès del flux escriu «Visite guidée» i «VISITE GUIDEE» segons
// l'oferta, i el títol ve sencer en majúscules.
// ------------------------------------------------------------
function normalitzaText(valor) {
  var net = cadena(valor).toLowerCase();
  net = net.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  net = net.replace(/[\u2018\u2019]/g, "'");
  return net.replace(/\s+/g, ' ').trim();
}


// ------------------------------------------------------------
// El municipi en la forma que es publica. `Commune` ve sempre en francès i
// en majúscules («CANET-EN-ROUSSILLON»); normalitzaNom() ja treu la caixa i
// els accents, o sigui que la taula el troba igual.
//
// Si el poble no és a la taula, es passa tal com ve i s'avisa: val més
// publicar «SAINTE-MARIE» i que el curador ho corregeixi, que no pas
// inventar-se una forma catalana. És la mateixa regla que al mapeig de
// recerca.
// ------------------------------------------------------------
function municipiDeProduccio(valor, avisos) {
  if (valor === '') {
    return '';
  }

  var catalana = formaCatalana(valor);
  if (catalana !== '') {
    return catalana;
  }

  avisos.push('El municipi «' + valor + '» no és a la taula de pobles: el deixo tal com ve.');
  return valor;
}

// ------------------------------------------------------------
// La forma catalana d'un nom de poble, vingui en la llengua que vingui.
// Torna '' si el poble no és a la taula.
// ------------------------------------------------------------
function formaCatalana(nom) {
  var clau = pobles.normalitzaNom(nom);
  if (clau === '') {
    return '';
  }
  return MAPA_MUNICIPIS[clau] || '';
}

// ------------------------------------------------------------
// Munta el diccionari «forma normalitzada -> forma catalana que es publica».
// Les dues llengües hi apunten, i totes dues porten a la primera columna de
// la taula, que és la catalana.
// ------------------------------------------------------------
function construeixMapaDeMunicipis() {
  var mapa = {};

  for (var i = 0; i < pobles.POBLES_ALIES.length; i++) {
    var parell = pobles.POBLES_ALIES[i];
    mapa[pobles.normalitzaNom(parell[0])] = parell[0];
    mapa[pobles.normalitzaNom(parell[1])] = parell[0];
  }

  return mapa;
}

// El diccionari es munta un sol cop, en carregar el fitxer.
var MAPA_MUNICIPIS = construeixMapaDeMunicipis();


// --- Les peces: treure l'adreça d'un camp HTML ------------------------------

// ------------------------------------------------------------
// L'`href` del primer `<a>` d'un camp, o "" si no n'hi ha cap. `DETAILSITEWEB`
// arriba com `<a href='https://…' target='_blank'>…</a>`, amb cometes simples,
// i a 898 de 1 504 ofertes arriba a `null` de debò.
//
// DECISIÓ TANCADA (§2 ter de docs/HANDOFF-ADT66.md): `font_url` és això i
// prou. És el web de l'ORGANITZADOR, no cap fitxa de l'ADT66 —no n'hi ha cap
// de construïble des del SyndicObjectID—, i no hi ha cap altra `font_url`
// disponible en tot el flux.
// ------------------------------------------------------------
function adrecaDeEnllac(camp) {
  var html = cadena(camp);

  if (html === '') {
    return '';
  }

  var trobat = html.match(/<a\b[^>]*\bhref\s*=\s*("([^"]*)"|'([^']*)')/i);

  if (trobat === null) {
    return adrecaNua(html);
  }

  return cadena(trobat[2] === undefined ? trobat[3] : trobat[2]);
}

// ------------------------------------------------------------
// L'`src` de la primera `<img>` d'un camp, o "" si no n'hi ha cap.
// `LISTINGPHOTO` arriba com `<img src="http://cdt66.media.tourinsoft.eu/…" />`.
//
// L'adreça es copia TAL COM VE, amb el `?width=150&height=120` inclòs. No
// s'hi toca res a posta: qui desfà el retall és variantsDeCartell(), a
// eines/puja-cartell.js, que sap que l'adreça sense paràmetres dona
// l'original. Aquí no es decideix res sobre imatges.
// ------------------------------------------------------------
function adrecaDeImatge(camp) {
  var html = cadena(camp);

  if (html === '') {
    return '';
  }

  var trobat = html.match(/<img\b[^>]*\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i);

  if (trobat === null) {
    return adrecaNua(html);
  }

  return cadena(trobat[2] === undefined ? trobat[3] : trobat[2]);
}

// ------------------------------------------------------------
// L'adreça d'un camp que porta l'URL sense cap etiqueta al voltant. És el
// recanvi de les dues funcions de dalt: si algun dia el flux deixés de posar
// l'HTML, el valor continuaria servint. Torna "" si no sembla cap adreça.
// ------------------------------------------------------------
function adrecaNua(text) {
  if (text.indexOf('<') !== -1) {
    return '';
  }
  if (text.indexOf('http') !== 0) {
    return '';
  }
  return text;
}


// --- Les peces: neteja de valors --------------------------------------------

// ------------------------------------------------------------
// El text net d'un camp del flux: fora l'HTML, fora les entitats, i fora
// l'etiqueta francesa que l'ADT66 enganxa al davant («Lieu : », «Descriptif
// de la manifestation : »).
//
// Treure-la és obligatori i no és cosmètic: si es quedés, `lloc` diria
// «Lieu : au Port» i la descripció que se n'anirà a traduir començaria per
// una etiqueta de formulari que el traductor es prendria per contingut.
// ------------------------------------------------------------
function textDeCamp(camp) {
  var text = textDeHtml(cadena(camp));

  if (text === '') {
    return '';
  }

  return text.replace(ETIQUETA_FRANCESA, '').trim();
}

// ------------------------------------------------------------
// Un HTML a text pla, de la manera més tosca que serveix. És germana de la
// textDeHtml() de worker/worker.js —mateixa idea, mateixa tosquedat— amb les
// entitats accentuades del francès afegides, que al flux de l'ADT66 surten a
// cada camp (`&agrave;`, `&eacute;`, `&ecirc;`…).
//
// No pretén ser un navegador: només ha de deixar el text llegible.
// ------------------------------------------------------------
function textDeHtml(html) {
  var text = html;

  // El contingut de <script> i <style> no és text de l'oferta.
  text = text.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ');
  // Les etiquetes que de debò fan salt de línia.
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(p|div|li|tr|h1|h2|h3|h4|table)>/gi, '\n');
  // La resta d'etiquetes, fora.
  text = text.replace(/<[^>]*>/g, ' ');
  // Les entitats amb nom que surten de debò en aquest flux.
  text = desxifraEntitats(text);
  // Les entitats numèriques, que també n'hi ha.
  text = text.replace(/&#(\d+);/g, function (tot, numero) {
    return String.fromCharCode(Number(numero));
  });
  // Espais i línies buides repetides, a un.
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n[ \t]*\n[\s]*\n+/g, '\n\n');

  return text.trim();
}

// ------------------------------------------------------------
// Les entitats HTML amb nom, desxifrades. `&amp;` va l'ÚLTIMA a posta: si es
// fes primer, un `&amp;eacute;` del text original es convertiria en
// `&eacute;` i la passada següent el desxifraria, que és inventar-se una
// lletra que no hi era.
// ------------------------------------------------------------
function desxifraEntitats(text) {
  var net = text;

  net = net.replace(/&nbsp;/gi, ' ');
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
  net = net.replace(/&lt;/gi, '<');
  net = net.replace(/&gt;/gi, '>');
  net = net.replace(/&amp;/gi, '&');

  return net;
}

// ------------------------------------------------------------
// Qualsevol valor convertit a cadena retallada. Un valor que no sigui text
// —un número, un `null` de debò, un camp absent— és "" (§4 de CLAUDE.md).
// El flux en porta de `null` de debò a `DETAILSITEWEB`, 898 de 1 504.
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

// ------------------------------------------------------------
// Torna la fila amb els camps en l'ordre exacte de l'esquema i cap més. Que
// l'ordre de les claus d'un objecte no importi al codi no vol dir que no
// importi: pendents.json es llegeix a ull i es compara amb git diff.
// ------------------------------------------------------------
function ordenaSegonsEsquema(fila) {
  var ordenada = {};

  for (var i = 0; i < CAMPS_PRODUCCIO.length; i++) {
    var camp = CAMPS_PRODUCCIO[i];
    ordenada[camp] = cadena(fila[camp]);
  }

  return ordenada;
}


// --- Les peces: la metadada -------------------------------------------------

// ------------------------------------------------------------
// Tot el que NO pot anar als camps de producció, agrupat per què és. La
// mateixa forma que la de mapeja-recerca.js —`font`, `descartats`, `avisos`—,
// amb un bloc `dates` que allà no cal perquè el CSV no porta sèries.
//
//   font        d'on surt l'oferta i quan la va tocar l'ADT66
//   dates       què n'ha dit classificaDates(): quantes n'hi havia i si
//               l'acte és continu o periòdic. És la traça de per què
//               `data_inici` i `data_fi` han sortit com han sortit.
//   descartats  valors reals que producció no té on posar. NO són brossa:
//               el telèfon, el correu, l'adreça, el programa i les altres
//               fotos algun dia podrien fer falta i aquí no es perden.
//   avisos      les notes que ha generat aquest mateix mapeig
//
// ON VIU AIXÒ: encara no està decidit, igual que la de mapeja-recerca.js
// (§4 de docs/HANDOFF-MAPEIG-RECERCA.md). Aquesta funció no ho resol a posta.
// ------------------------------------------------------------
function metadadadesDeProduccio(oferta, quan, avisos) {
  return {
    font: {
      proveidor: 'ADT66',
      syndic_object_id: cadena(oferta.SyndicObjectID),
      actualitzat: cadena(oferta.Updated),
      publicat: cadena(oferta.Published),
      tipus_objecte: cadena(oferta.ObjectTypeName),
      estructura: nomDeLestructura(oferta.Structure)
    },
    dates: {
      quantes: quan.quantes,
      tipus: quan.tipus
    },
    descartats: {
      latitud: cadena(oferta.GmapLatitude),
      longitud: cadena(oferta.GmapLongitude),
      adreca: textDeCamp(oferta.DETAILADRESSE),
      municipi_amb_codi: textDeCamp(oferta.DETAILCOMMUNE),
      resum_curt: textDeCamp(oferta.ACCROCHE150),
      resum_llistat: textDeCamp(oferta.LISTINGACCROCHE),
      programa: textDeCamp(oferta.DETAILPROGRAMME),
      telefon: textDeCamp(oferta.DETAILTELEPHONE),
      correu: textDeCamp(oferta.DETAILCOURRIEL),
      de_pagament: textDeCamp(oferta.DETAILFETEPAYANTE),
      foto_detall: adrecaDeImatge(oferta.DETAILPHOTO),
      foto_detall_diapo: adrecaDeImatge(oferta.DETAILPHOTO_DIAPO),
      foto_llistat_diapo: adrecaDeImatge(oferta.LISTINGPHOTO_DIAPO),
      tema: cadena(oferta.COMMUNTHEME),
      categoria_adt66: cadena(oferta.COMMUNCATEGORIE),
      tipus_adt66: cadena(oferta.COMMUNTYPE),
      nom_comun: cadena(oferta.COMMUNNOM),
      camp_sistema: cadena(oferta.CHAMPSYSTEME)
    },
    avisos: avisos
  };
}

// ------------------------------------------------------------
// El nom de l'oficina de turisme que ha entrat l'oferta. NO va a
// `associacio`: l'oficina no és qui organitza l'acte, i posar-l'hi seria dir
// que l'acte és seu.
// ------------------------------------------------------------
function nomDeLestructura(estructura) {
  if (!estructura) {
    return '';
  }
  return cadena(estructura.Name);
}


// --- Còpies literals de les funcions compartides ----------------------------
// Són les mateixes de docs/arxiu-google/utils.gs, worker/worker.js,
// curador.html, eines/dedup-esdeveniments.js i eines/mapeja-recerca.js. Es
// copien, no s'importen: el projecte no té cap sistema de mòduls i totes les
// vies d'entrada han de donar l'id idèntic.

// ------------------------------------------------------------
// Còpia literal de valorPermes: torna el valor només si és a la llista
// permesa, i '' si no hi és.
// ------------------------------------------------------------
function valorPermes(valor, llistaPermesa) {
  if (llistaPermesa.indexOf(valor) === -1) {
    return '';
  }
  return valor;
}

// ------------------------------------------------------------
// Còpia literal de creaId: la data d'inici, un guió, i les tres primeres
// paraules del títol en minúscules i sense accents. Torna '' si no hi ha data.
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


// --- El que surt d'aquest fitxer --------------------------------------------
// Només la funció: les peces de dins són seves i no les ha de cridar ningú.
// L'exportació NO connecta res: aquest fitxer continua sense llegir ni
// escriure enlloc, i ni processa-lot.js ni pipeline-offline.js el criden
// encara.

module.exports = {
  mapejaOfertaADT66: mapejaOfertaADT66
};


// --- Proves des del terminal ------------------------------------------------
// Tot el que ve a partir d'aquí és per poder exercitar la funció a mà. No
// forma part de la peça i no s'ha de copiar enlloc.
//
// CAP PROVA NO TOCA LA XARXA. Les ofertes d'aquí sota estan fetes a mà a
// partir dels casos que docs/HANDOFF-ADT66.md documenta de debò —el registre
// retallat del §2 bis, els dos contraexemples de la taula del §3 bis, les
// xifres de cobertura del §2 ter—, no descarregades. La forma és la del flux;
// el contingut és curt a posta perquè es pugui llegir.

// ------------------------------------------------------------
// Una data DD/MM/AAAA a uns quants dies vista, per als casos que han de
// dependre d'«avui» sense quedar caducats el mes que ve. Es fa amb UTC perquè
// només serveix per fabricar una entrada, no per decidir res.
// ------------------------------------------------------------
function dataRelativa(diesEndavant) {
  var quan = new Date(Date.now() + diesEndavant * 86400000);
  var dia = String(quan.getUTCDate()).padStart(2, '0');
  var mes = String(quan.getUTCMonth() + 1).padStart(2, '0');
  return dia + '/' + mes + '/' + quan.getUTCFullYear();
}

// ------------------------------------------------------------
// Una sèrie de dates DD/MM/AAAA separades per espais, com les escriu el camp
// `TRI`: `quantes` dates a `cadaQuants` dies de distància, començant d'aquí a
// `comenca` dies. Serveix per fabricar els casos periòdics sense haver
// d'escriure 192 dates a mà.
// ------------------------------------------------------------
function serieDeDates(comenca, cadaQuants, quantes) {
  var dates = [];
  for (var i = 0; i < quantes; i++) {
    dates.push(dataRelativa(comenca + i * cadaQuants));
  }
  return dates.join(' ');
}

// ------------------------------------------------------------
// Els casos. Cadascun comprova uns quants camps concrets del resultat, de
// manera que la bateria es pugui llegir com una taula del comportament pactat.
// ------------------------------------------------------------
function casosDeProva() {
  return [
    {
      nom: 'Dates contigües: el registre real del §2 bis del handoff',
      entrada: {
        SyndicObjectID: 'FMALAR066FS0009D',
        SyndicObjectName: 'LES OCCASIONS DU MULTICOQUE & DU REFIT',
        TRI: '16/10/2026 17/10/2026 18/10/2026',
        COMMUNDATE: '<strong>Le 16/10/2026 De 10:00 &agrave; 19:00</strong><br />',
        Commune: 'CANET-EN-ROUSSILLON',
        COMMUNLIEU: '<strong>Lieu :</strong> au Port',
        DETAILDESCRIPTIF: '<strong>Descriptif de la manifestation :</strong> Canet-en-Roussillon devient la capitale du multicoque.',
        LISTINGPHOTO: '<img src="http://cdt66.media.tourinsoft.eu/upload/nautipole-1.jpg?width=150&height=120" />',
        DETAILSITEWEB: '<a href=\'https://www.lesoccasionsdumulticoque.com/\' target=\'_blank\'>site</a>',
        RechercheTYPE: 'Exposition,Foire',
        Updated: '2026-06-26T16:14:18'
      },
      espera: {
        id: '2026-10-16-les-occasions-du',
        titol: 'LES OCCASIONS DU MULTICOQUE & DU REFIT',
        data_inici: '2026-10-16',
        data_fi: '2026-10-18',
        hora: '10:00',
        lloc: 'au Port',
        municipi: 'Canet de Rosselló',
        categoria: 'Exposició',
        descripcio_ca: '',
        descripcio_fr: 'Canet-en-Roussillon devient la capitale du multicoque.',
        font_url: 'https://www.lesoccasionsdumulticoque.com/',
        imatge_url: 'http://cdt66.media.tourinsoft.eu/upload/nautipole-1.jpg?width=150&height=120',
        estat: 'pendent'
      },
      esperaDates: { tipus: 'contigu', quantes: 3 }
    },
    {
      nom: 'Dates contigües d\'un sol dia: data_fi igual a data_inici',
      entrada: {
        SyndicObjectID: 'FMALAR066V50MJYW',
        SyndicObjectName: 'CONCERT DE LA SAINT-JEAN',
        TRI: '24/06/2026',
        Commune: 'PRATS-DE-MOLLO-LA-PRESTE',
        RechercheTYPE: 'Concert'
      },
      espera: {
        data_inici: '2026-06-24',
        data_fi: '2026-06-24',
        municipi: 'Prats de Molló',
        categoria: 'Música',
        hora: ''
      },
      esperaDates: { tipus: 'contigu', quantes: 1 }
    },
    {
      nom: 'Dates disperses del tipus «470 dates»: mercat setmanal, 60 ocurrències',
      entrada: {
        SyndicObjectID: 'FMALAR066MARCHE01',
        SyndicObjectName: 'GRAND MARCHE HEBDOMADAIRE',
        TRI: serieDeDates(3, 7, 60),
        Commune: 'PRADES',
        RechercheTYPE: 'Marche'
      },
      espera: {
        municipi: 'Prada',
        categoria: 'Mercat'
      },
      esperaDates: { tipus: 'dispers', quantes: 60 },
      comprova: function (fila, problemes) {
        // La propera ocurrència i prou: un sol dia, i data_fi igual.
        if (fila.data_inici === '') {
          problemes.push('esperava una propera ocurrència futura i no n\'hi ha cap');
        }
        if (fila.data_fi !== fila.data_inici) {
          problemes.push('una fila periòdica ha de ser d\'un sol dia: data_fi hauria de ser data_inici');
        }
        if (fila.nota_curador.indexOf('60 dies escampats') === -1) {
          problemes.push('la nota no diu al curador que els altres dies no hi surten');
        }
      }
    },
    {
      nom: 'Dates disperses pel contraexemple del §3 bis: salt de 2, abast de 223',
      entrada: {
        SyndicObjectID: 'FMALAR066ATELIER1',
        SyndicObjectName: 'ATELIER DE MODELAGE EN INDIVIDUEL',
        // Cada dos dies durant 112 ocurrències: salt màxim 2, abast 223 dies.
        // És el cas que demostra que el salt màxim sol no serveix.
        TRI: serieDeDates(2, 2, 112),
        Commune: 'CERET',
        RechercheTYPE: 'Atelier'
      },
      espera: {
        municipi: 'Ceret',
        categoria: 'Taller'
      },
      esperaDates: { tipus: 'dispers', quantes: 112 },
      comprova: function (fila, problemes) {
        if (fila.data_fi !== fila.data_inici) {
          problemes.push('l\'abast de 223 dies havia de fer la fila d\'un sol dia');
        }
      }
    },
    {
      nom: 'Dates disperses totes passades: no hi ha data, ni id',
      entrada: {
        SyndicObjectID: 'FMALAR066PATRIMO1',
        SyndicObjectName: 'LE PATRIMOINE D\'ARGELES-SUR-MER',
        TRI: '06/03/2025 13/03/2025 20/03/2025 27/03/2025',
        Commune: 'ARGELES-SUR-MER',
        RechercheTYPE: 'Visite guidee'
      },
      espera: {
        id: '',
        data_inici: '',
        data_fi: '',
        municipi: 'Argelers',
        categoria: 'Patrimoni i tradicions'
      },
      esperaDates: { tipus: 'dispers', quantes: 4 },
      comprova: function (fila, problemes) {
        if (fila.nota_curador.indexOf('són passades') === -1) {
          problemes.push('la nota no diu que totes les dates són passades');
        }
        if (fila.nota_curador.indexOf('l\'id queda buit') === -1) {
          problemes.push('la nota no diu que la fila no es pot identificar');
        }
      }
    },
    {
      nom: 'DETAILSITEWEB present: font_url és l\'href de l\'organitzador',
      entrada: {
        SyndicObjectID: 'FMALAR066ARCHIP01',
        SyndicObjectName: 'SAISON DE L\'ARCHIPEL',
        TRI: '12/11/2026',
        Commune: 'PERPIGNAN',
        DETAILSITEWEB: '<a href=\'https://www.theatredelarchipel.org/\' target=\'_blank\' rel=\'noopener\'>www.theatredelarchipel.org</a>',
        RechercheTYPE: 'Theatre'
      },
      espera: {
        font_url: 'https://www.theatredelarchipel.org/',
        municipi: 'Perpinyà',
        categoria: 'Teatre'
      }
    },
    {
      nom: 'DETAILSITEWEB a null (898 de 1 504): font_url coercit a ""',
      entrada: {
        SyndicObjectID: 'FMALAR066SENSEWEB',
        SyndicObjectName: 'FETE DU VILLAGE',
        TRI: '15/08/2026',
        Commune: 'ILLE-SUR-TET',
        DETAILSITEWEB: null,
        LISTINGPHOTO: null,
        DETAILCONTACT: null,
        COMMUNLIEU: null,
        DETAILDESCRIPTIF: null,
        RechercheTYPE: null
      },
      espera: {
        font_url: '',
        imatge_url: '',
        associacio: '',
        lloc: '',
        descripcio_fr: '',
        categoria: '',
        municipi: 'Illa'
      }
    },
    {
      nom: 'DETAILSITEWEB absent del tot: font_url també ""',
      entrada: {
        SyndicObjectID: 'FMALAR066SENSECAMP',
        SyndicObjectName: 'VIDE-GRENIER',
        TRI: '20/09/2026',
        Commune: 'THUIR',
        RechercheTYPE: 'Vide-grenier'
      },
      espera: { font_url: '', municipi: 'Tuïr', categoria: 'Mercat' }
    },
    {
      nom: 'El tag va primer, davant de tots els avisos',
      entrada: {
        SyndicObjectID: 'FMALAR066NOMES1',
        SyndicObjectName: 'CONCERT DE PRIMAVERA',
        TRI: '01/07/2026',
        Commune: 'ELNE',
        RechercheTYPE: 'Concert'
      },
      comprova: function (fila, problemes) {
        if (fila.nota_curador.indexOf('[ADT66 id: FMALAR066NOMES1] El títol ve') !== 0) {
          problemes.push('el tag no és al davant de tot: «' + fila.nota_curador + '»');
        }
      },
      espera: { municipi: 'Elna', categoria: 'Música' }
    },
    {
      nom: 'Oferta amb SyndicObjectID i quasi res més: el tag obre la nota igual',
      entrada: { SyndicObjectID: 'FMALAR066SOL1', TRI: '01/07/2026', Commune: 'ELNE' },
      comprova: function (fila, problemes) {
        // El que aquest cas vigila és que el tag obri la cadena, també quan
        // darrere no hi ha absolutament res. Elna és a la taula de comarques,
        // o sigui que aquesta oferta no genera cap avís i la nota és el tag
        // sol. Abans de tenir la taula sempre hi havia l'avís de la comarca
        // darrere, i el cas comprovava el tag amb l'espai.
        if (fila.nota_curador.indexOf('[ADT66 id: FMALAR066SOL1]') !== 0) {
          problemes.push('el tag no obre la nota: «' + fila.nota_curador + '»');
        }
      },
      espera: { titol: '', municipi: 'Elna' }
    },
    {
      nom: 'La comarca es deduïx del municipi: ELNE -> Rosselló, sense cap avís',
      entrada: {
        SyndicObjectName: 'CONCERT A ELNA', TRI: '01/07/2026', Commune: 'ELNE',
        RechercheTYPE: 'Concert'
      },
      espera: { municipi: 'Elna', comarca: 'Rosselló', categoria: 'Música' }
    },
    {
      nom: 'Cada comarca per una mostra del flux real',
      entrada: { SyndicObjectName: 'FIRA', TRI: '01/07/2026', Commune: 'PRADES' },
      comprova: function (fila, problemes) {
        var mostres = [
          ['ARLES-SUR-TECH', 'Vallespir'],
          ['LES ANGLES', 'Capcir'],
          ['SAINTE-LEOCADIE', 'Cerdanya'],
          ['CANET-EN-ROUSSILLON', 'Rosselló'],
          ['MOLITG-LES-BAINS', 'Conflent']
        ];
        for (var i = 0; i < mostres.length; i++) {
          var resultat = mapejaOfertaADT66({
            SyndicObjectName: 'FIRA', TRI: '01/07/2026', Commune: mostres[i][0]
          });
          if (resultat.fila.comarca !== mostres[i][1]) {
            problemes.push(mostres[i][0] + ' -> «' + resultat.fila.comarca +
                           '», esperava «' + mostres[i][1] + '»');
          }
        }
      },
      espera: { comarca: 'Conflent' }
    },
    {
      nom: 'Municipi de fora de la taula de comarques: queda "" i avisa',
      // Narbona no és a cap de les cinc comarques i no hi serà mai: serveix
      // per vigilar el camí de sortida sense dependre de cap poble nostre que
      // el criteri editorial pugui acabar assignant. Aquest cas feia servir
      // MAURY fins al 31 d'agost de 2026, quan la Fenolleda va passar a
      // Rosselló i el poble va deixar de valer com a exemple.
      entrada: { SyndicObjectName: 'FIRA A NARBONA', TRI: '01/07/2026', Commune: 'NARBONNE' },
      comprova: function (fila, problemes) {
        if (fila.nota_curador.indexOf('no és a la taula de comarques') === -1) {
          problemes.push('falta l\'avís de la comarca: «' + fila.nota_curador + '»');
        }
      },
      espera: { comarca: '', municipi: 'NARBONNE' }
    },
    {
      nom: 'Tota la Fenolleda va a Rosselló, no només els dos pobles d\'exemple',
      entrada: { SyndicObjectName: 'FIRA A MAURI', TRI: '01/07/2026', Commune: 'MAURY' },
      comprova: function (fila, problemes) {
        var fenolleda = ['ANSIGNAN', 'CAUDIES-DE-FENOUILLEDES', 'LE VIVIER',
                         'SAINT-MARTIN-DE-FENOUILLET', 'LATOUR-DE-FRANCE',
                         'SAINT-PAUL-DE-FENOUILLET', 'BELESTA'];
        for (var i = 0; i < fenolleda.length; i++) {
          var resultat = mapejaOfertaADT66({
            SyndicObjectName: 'FIRA', TRI: '01/07/2026', Commune: fenolleda[i]
          });
          if (resultat.fila.comarca !== 'Rosselló') {
            problemes.push(fenolleda[i] + ' -> «' + resultat.fila.comarca +
                           '», esperava «Rosselló»');
          }
        }
      },
      espera: { comarca: 'Rosselló' }
    },
    {
      nom: 'Sense SyndicObjectID: cap tag, i no és cap error de forma',
      entrada: { SyndicObjectName: 'CONCERT SENSE ID', TRI: '01/07/2026', Commune: 'ELNE' },
      comprova: function (fila, problemes) {
        if (fila.nota_curador.indexOf('[ADT66 id:') !== -1) {
          problemes.push('hi ha un tag i l\'oferta no porta cap identificador');
        }
        if (fila.nota_curador === '') {
          problemes.push('els avisos del mapeig han de sortir igualment');
        }
      }
    },
    {
      nom: 'Municipi amb àlies coneguda: es normalitza a la forma catalana',
      entrada: {
        SyndicObjectID: 'FMALAR066ALIES1',
        SyndicObjectName: 'MARCHE DE NOEL',
        TRI: '05/12/2026',
        Commune: 'SAINT-LAURENT-DE-LA-SALANQUE',
        RechercheTYPE: 'Marche'
      },
      espera: { municipi: 'Sant Llorenç de la Salanca' }
    },
    {
      nom: 'Municipi fora de la taula: passa tal qual i avisa',
      entrada: {
        SyndicObjectID: 'FMALAR066DESCONE1',
        SyndicObjectName: 'FETE LOCALE',
        TRI: '05/12/2026',
        Commune: 'QUELQUE-PART-EN-FRANCE'
      },
      espera: { municipi: 'QUELQUE-PART-EN-FRANCE' },
      comprova: function (fila, problemes) {
        if (fila.nota_curador.indexOf('no és a la taula de pobles') === -1) {
          problemes.push('la nota no avisa que el municipi no es coneix');
        }
      }
    },
    {
      nom: 'Randonnée ja no cau a "": des del mapeig mesurat és Esports',
      entrada: {
        SyndicObjectID: 'FMALAR066SPORT1',
        SyndicObjectName: 'RANDONNEE DES CRETES',
        TRI: '10/05/2026',
        Commune: 'PRADES',
        RechercheTYPE: 'Randonnee,Sport'
      },
      espera: { categoria: 'Esports' }
    },
    {
      nom: 'Categoria del tot desconeguda: cau a "" amb avís',
      entrada: {
        SyndicObjectID: 'FMALAR066RAR1',
        SyndicObjectName: 'GASTRONOMIE DU CONFLENT',
        TRI: '10/05/2026',
        Commune: 'PRADES',
        RechercheTYPE: 'Gastronomie'
      },
      espera: { categoria: '' },
      comprova: function (fila, problemes) {
        if (fila.nota_curador.indexOf('no té equivalent entre les tretze') === -1) {
          problemes.push('la nota no avisa de la categoria sense calaix');
        }
      }
    },
    {
      nom: 'La coma parteix «Projection, cinéma»: les dues meitats van a Cinema',
      entrada: {
        SyndicObjectID: 'FMALAR066CINE1',
        SyndicObjectName: 'CINE PLEIN AIR',
        TRI: '10/05/2026', Commune: 'PRADES',
        RechercheTYPE: 'Projection, cinéma'
      },
      espera: { categoria: 'Cinema' }
    },
    {
      nom: 'La coma parteix «Randonnée, balade»: les dues meitats van a Esports',
      entrada: {
        SyndicObjectID: 'FMALAR066RAND1',
        SyndicObjectName: 'BALADE AU CANIGO',
        TRI: '10/05/2026', Commune: 'PRADES',
        RechercheTYPE: 'Pratique sportive encadrée,Randonnée, balade'
      },
      espera: { categoria: 'Esports' }
    },
    {
      nom: 'Co-etiqueta: «Spectacle,Théâtre» mana el Teatre de la taula',
      entrada: {
        SyndicObjectID: 'FMALAR066SP1',
        SyndicObjectName: 'LA CANTATRICE CHAUVE',
        TRI: '10/05/2026', Commune: 'PRADES',
        RechercheTYPE: 'Spectacle,Théâtre'
      },
      espera: { categoria: 'Teatre' }
    },
    {
      nom: 'Co-etiqueta: «Concert,Spectacle» va a Música, no a Teatre',
      entrada: {
        SyndicObjectID: 'FMALAR066SP2',
        SyndicObjectName: 'NIT DE JAZZ',
        TRI: '10/05/2026', Commune: 'PRADES',
        RechercheTYPE: 'Concert,Spectacle'
      },
      espera: { categoria: 'Música' }
    },
    {
      nom: 'Co-etiqueta: «Festival,Projection, cinéma» va a Cinema',
      entrada: {
        SyndicObjectID: 'FMALAR066SP3',
        SyndicObjectName: 'FESTIVAL DU FILM',
        TRI: '10/05/2026', Commune: 'PRADES',
        RechercheTYPE: 'Festival,Projection, cinéma'
      },
      espera: { categoria: 'Cinema' }
    },
    {
      nom: 'Co-etiqueta tota sola: «Spectacle» cau a Teatre i ho diu a la nota',
      entrada: {
        SyndicObjectID: 'FMALAR066SP4',
        SyndicObjectName: 'GRAND SPECTACLE DE NOEL',
        TRI: '10/05/2026', Commune: 'PRADES',
        RechercheTYPE: 'Spectacle'
      },
      espera: { categoria: 'Teatre' },
      comprova: function (fila, problemes) {
        if (fila.nota_curador.indexOf('Teatre per defecte') === -1) {
          problemes.push('la nota no diu que el Teatre és per defecte');
        }
      }
    },
    {
      nom: 'Els vuit sense calaix manen sobre la co-etiqueta: «Salon,Spectacle»',
      entrada: {
        SyndicObjectID: 'FMALAR066SAL1',
        SyndicObjectName: 'SALON DU LIVRE',
        TRI: '10/05/2026', Commune: 'PRADES',
        RechercheTYPE: 'Salon,Spectacle'
      },
      espera: { categoria: '' },
      comprova: function (fila, problemes) {
        if (fila.nota_curador.indexOf('Salon') === -1) {
          problemes.push('la nota no diu quin valor ha deixat la fila sense categoria');
        }
      }
    },
    {
      nom: 'Jeux amb joc de club al títol: Vida associativa, per damunt de la taula',
      entrada: {
        SyndicObjectID: 'FMALAR066JEU1',
        SyndicObjectName: 'CONCOURS DE PETANQUE A RIGARDA',
        TRI: '10/05/2026', Commune: 'PRADES',
        RechercheTYPE: 'Jeux,Pratique sportive encadrée'
      },
      espera: { categoria: 'Vida associativa' }
    },
    {
      nom: 'Jeux amb escape game: buida amb nota, mai Vida associativa',
      entrada: {
        SyndicObjectID: 'FMALAR066JEU2',
        SyndicObjectName: 'ESCAPE GAME DANS LES VIGNES PAR VINO ENIGMA',
        TRI: '10/05/2026', Commune: 'PRADES',
        RechercheTYPE: 'Jeux'
      },
      espera: { categoria: '' },
      comprova: function (fila, problemes) {
        if (fila.nota_curador.indexOf('comercial') === -1) {
          problemes.push('la nota no diu que sembla una activitat comercial');
        }
      }
    },
    {
      nom: 'Jeux dins d\'un concert: la taula mana i la fila no queda buida',
      entrada: {
        SyndicObjectID: 'FMALAR066JEU3',
        SyndicObjectName: 'LES 19E JOURNEES BRASSENS A CANET',
        TRI: '10/05/2026', Commune: 'PRADES',
        RechercheTYPE: 'Concert,Jeux,Spectacle'
      },
      espera: { categoria: 'Música' }
    },
    {
      nom: 'Forum d\'associacions: el títol mana sobre «Vide-grenier»',
      entrada: {
        SyndicObjectID: 'FMALAR066FOR1',
        SyndicObjectName: 'FORUM DES ASSOCIATIONS ET VIDE GRENIER',
        TRI: '10/05/2026', Commune: 'PRADES',
        RechercheTYPE: 'Vide-grenier'
      },
      espera: { categoria: 'Vida associativa' }
    },
    {
      nom: 'Forum d\'associacions sense cap RechercheTYPE: igualment reconegut',
      entrada: {
        SyndicObjectID: 'FMALAR066FOR2',
        SyndicObjectName: 'FORUM DES ASSOCIATIONS THUIR 2026',
        TRI: '10/05/2026', Commune: 'PRADES',
        RechercheTYPE: null
      },
      espera: { categoria: 'Vida associativa' }
    },
    {
      nom: 'Rifles: Vida associativa',
      entrada: {
        SyndicObjectID: 'FMALAR066RIF1',
        SyndicObjectName: 'GRAN RIFA DE NADAL',
        TRI: '10/05/2026', Commune: 'PRADES',
        RechercheTYPE: 'Rifles'
      },
      espera: { categoria: 'Vida associativa' }
    },
    {
      nom: 'Festa Major i Aplec van a Patrimoni i tradicions',
      entrada: {
        SyndicObjectID: 'FMALAR066FES1',
        SyndicObjectName: 'FESTA MAJOR DE PRATS',
        TRI: '10/05/2026', Commune: 'PRATS-DE-MOLLO-LA-PRESTE',
        RechercheTYPE: 'Festa Major,Aplec'
      },
      espera: { categoria: 'Patrimoni i tradicions' }
    },
    {
      nom: 'Senyal de nova era: un terme fort tot sol ja avisa',
      entrada: {
        SyndicObjectID: 'FMALAR066NE1',
        SyndicObjectName: 'STAGE DE REIKI ET SOINS ENERGETIQUES',
        TRI: '10/05/2026', Commune: 'PRADES',
        RechercheTYPE: 'Stage / Atelier'
      },
      espera: { categoria: 'Taller' },
      comprova: function (fila, problemes) {
        if (fila.nota_curador.indexOf('nova era') === -1) {
          problemes.push('no ha saltat el senyal de nova era');
        }
      }
    },
    {
      nom: 'Senyal de nova era: un sol terme feble NO avisa',
      entrada: {
        SyndicObjectID: 'FMALAR066NE2',
        SyndicObjectName: 'CONFERENCE SUR LA TRANSITION ENERGETIQUE',
        TRI: '10/05/2026', Commune: 'PRADES',
        RechercheTYPE: 'Débat / Conférence'
      },
      espera: { categoria: 'Conferència' },
      comprova: function (fila, problemes) {
        if (fila.nota_curador.indexOf('nova era') !== -1) {
          problemes.push('ha saltat el senyal amb un sol terme feble');
        }
      }
    },
    {
      nom: 'Senyal de nova era: «aura» dins de «restaurant» no compta',
      entrada: {
        SyndicObjectID: 'FMALAR066NE3',
        SyndicObjectName: 'REPAS AU RESTAURANT DU VILLAGE',
        TRI: '10/05/2026', Commune: 'PRADES',
        RechercheTYPE: 'Marché'
      },
      espera: { categoria: 'Mercat' },
      comprova: function (fila, problemes) {
        if (fila.nota_curador.indexOf('nova era') !== -1) {
          problemes.push('«aura» ha saltat dins de «restaurant»');
        }
      }
    },
    {
      nom: 'Senyal de preu: un trail de 40 euros avisa',
      entrada: {
        SyndicObjectID: 'FMALAR066PR1',
        SyndicObjectName: 'TRAIL DU CANIGO',
        TRI: '10/05/2026', Commune: 'PRADES',
        RechercheTYPE: 'Trail',
        DETAILDESCRIPTIF: 'Inscription 40 euros par coureur.'
      },
      espera: { categoria: 'Esports' },
      comprova: function (fila, problemes) {
        if (fila.nota_curador.indexOf('pagament elevat') === -1) {
          problemes.push('no ha saltat el senyal de preu');
        }
      }
    },
    {
      nom: 'Senyal de preu: una balada de 5 euros no avisa',
      entrada: {
        SyndicObjectID: 'FMALAR066PR2',
        SyndicObjectName: 'BALADE DU CONFLENT',
        TRI: '10/05/2026', Commune: 'PRADES',
        RechercheTYPE: 'Randonnée, balade',
        DETAILDESCRIPTIF: 'Tarif 5 &euro; par personne.'
      },
      espera: { categoria: 'Esports' },
      comprova: function (fila, problemes) {
        if (fila.nota_curador.indexOf('pagament elevat') !== -1) {
          problemes.push('ha saltat el senyal amb un import baix');
        }
      }
    },
    {
      nom: 'Senyal de preu: no toca cap fila que no sigui Esports',
      entrada: {
        SyndicObjectID: 'FMALAR066PR3',
        SyndicObjectName: 'CONCERT DE GALA',
        TRI: '10/05/2026', Commune: 'PRADES',
        RechercheTYPE: 'Concert',
        DETAILDESCRIPTIF: 'Places a 60 euros.'
      },
      espera: { categoria: 'Música' },
      comprova: function (fila, problemes) {
        if (fila.nota_curador.indexOf('pagament elevat') !== -1) {
          problemes.push('el senyal de preu ha saltat fora d\'Esports');
        }
      }
    },
    {
      nom: 'Categoria múltiple: mana el primer valor que té calaix',
      entrada: {
        SyndicObjectID: 'FMALAR066MULTI1',
        SyndicObjectName: 'FETE DU LIVRE',
        TRI: '10/05/2026',
        Commune: 'PRADES',
        RechercheTYPE: 'Loto,Conference'
      },
      espera: { categoria: 'Conferència' }
    },
    {
      nom: 'L\'id no s\'hereta: el SyndicObjectID no hi entra mai',
      entrada: {
        SyndicObjectID: 'FMALAR066V52X1AO',
        SyndicObjectName: 'BALL DE GITANES',
        TRI: '14/09/2026',
        Commune: 'PRATS-DE-MOLLO-LA-PRESTE',
        RechercheTYPE: 'Bal'
      },
      espera: { id: '2026-09-14-ball-de-gitanes', categoria: 'Dansa i ball' }
    },
    {
      nom: 'Les entitats i l\'etiqueta francesa surten del text',
      entrada: {
        SyndicObjectID: 'FMALAR066HTML1',
        SyndicObjectName: 'SOIREE CONTES',
        TRI: '03/10/2026',
        Commune: 'CERET',
        COMMUNLIEU: '<strong>Lieu :</strong> &agrave; la m&eacute;diath&egrave;que',
        DETAILDESCRIPTIF: '<strong>Descriptif de la manifestation :</strong> Une soir&eacute;e de contes.<br />Entr&eacute;e libre.',
        DETAILCONTACT: '<strong>Contact :</strong> Association Les Amis du Conte'
      },
      espera: {
        lloc: 'à la médiathèque',
        associacio: 'Association Les Amis du Conte'
      },
      comprova: function (fila, problemes) {
        if (fila.descripcio_fr.indexOf('Descriptif') !== -1) {
          problemes.push('l\'etiqueta francesa s\'ha quedat dins de la descripció');
        }
        if (fila.descripcio_fr.indexOf('&') !== -1) {
          problemes.push('hi ha entitats sense desxifrar a la descripció');
        }
      }
    },
    {
      nom: 'Títol amb dos punts: no s\'escapça com si fos una etiqueta',
      entrada: {
        SyndicObjectID: 'FMALAR066TITOL1',
        SyndicObjectName: 'FESTIVAL : LES NUITS DE LA GUITARE',
        TRI: '18/07/2026',
        Commune: 'CERET'
      },
      espera: { titol: 'FESTIVAL : LES NUITS DE LA GUITARE' }
    },
    {
      nom: 'Oferta buida del tot: els disset camps hi són igualment, tots ""',
      entrada: {},
      espera: {
        id: '', titol: '', data_inici: '', data_fi: '', hora: '', lloc: '',
        municipi: '', comarca: '', categoria: '', descripcio_ca: '',
        descripcio_fr: '', associacio: '', imatge_url: '', font_url: '',
        estat: 'pendent'
      }
    },
    {
      nom: 'Structure no va a associacio: l\'oficina no organitza l\'acte',
      entrada: {
        SyndicObjectID: 'FMALAR066STRUCT1',
        SyndicObjectName: 'FOIRE AUX VINS',
        TRI: '11/11/2026',
        Commune: 'RIVESALTES',
        Structure: { Name: 'Office de Tourisme Rivesaltes' },
        RechercheTYPE: 'Foire'
      },
      espera: { associacio: '', municipi: 'Ribesaltes', categoria: 'Mercat' },
      comprova: function (fila, problemes, metadadades) {
        if (metadadades.font.estructura !== 'Office de Tourisme Rivesaltes') {
          problemes.push('l\'estructura no s\'ha conservat a la metadada');
        }
      }
    }
  ];
}

// ------------------------------------------------------------
// Passa la bateria i n'escriu el resultat al terminal.
// ------------------------------------------------------------
function provaBateria() {
  var casos = casosDeProva();
  var fallades = 0;

  for (var i = 0; i < casos.length; i++) {
    var cas = casos[i];
    var resultat = mapejaOfertaADT66(cas.entrada);
    var problemes = comparaEsperat(resultat.fila, cas.espera);

    if (cas.esperaDates) {
      if (resultat.metadadades.dates.tipus !== cas.esperaDates.tipus) {
        problemes.push('dates.tipus: esperava «' + cas.esperaDates.tipus +
          '», tinc «' + resultat.metadadades.dates.tipus + '»');
      }
      if (resultat.metadadades.dates.quantes !== cas.esperaDates.quantes) {
        problemes.push('dates.quantes: esperava ' + cas.esperaDates.quantes +
          ', tinc ' + resultat.metadadades.dates.quantes);
      }
    }

    if (cas.comprova) {
      cas.comprova(resultat.fila, problemes, resultat.metadadades);
    }

    // Comprovacions que valen per a tots els casos, no només per als seus.
    problemes = problemes.concat(comprovacionsDeSempre(resultat, cas));

    if (problemes.length > 0) {
      fallades += 1;
    }

    console.log((problemes.length === 0 ? 'BÉ  ' : 'MAL ') + cas.nom);
    for (var p = 0; p < problemes.length; p++) {
      console.log('     ! ' + problemes[p]);
    }
  }

  console.log('');
  console.log(casos.length + ' casos, ' + fallades + ' fallades.');
  if (fallades > 0) {
    process.exitCode = 1;
  }
}

// ------------------------------------------------------------
// El que ha de valer per a TOTES les files, surti d'on surti l'oferta. La
// primera d'aquestes comprovacions és la que vigila el contracte del tag: si
// un dia algú afegeix un avís abans del tag, aquí es veurà de seguida, a tots
// els casos alhora i no només als que se'l miren expressament.
// ------------------------------------------------------------
function comprovacionsDeSempre(resultat, cas) {
  var problemes = [];
  var fila = resultat.fila;

  // EL TAG D'ANCORATGE VA SEMPRE PRIMER, sense excepció.
  var syndicObjectID = cadena((cas.entrada || {}).SyndicObjectID);
  if (syndicObjectID !== '') {
    var tag = '[ADT66 id: ' + syndicObjectID + ']';
    if (fila.nota_curador.indexOf(tag) !== 0) {
      problemes.push('el tag d\'ancoratge no obre nota_curador: «' + fila.nota_curador + '»');
    }
    if (identificador.extreuIdentificador(fila.nota_curador) !== syndicObjectID) {
      problemes.push('el tag no es torna a llegir sencer des de la nota');
    }
  }

  var claus = Object.keys(fila);
  if (claus.join('|') !== CAMPS_PRODUCCIO.join('|')) {
    problemes.push('els camps no són els disset de l\'esquema, en ordre');
  }
  for (var k = 0; k < claus.length; k++) {
    if (typeof fila[claus[k]] !== 'string') {
      problemes.push(claus[k] + ' no és una cadena');
    }
    if (fila[claus[k]] === 'null' || fila[claus[k]] === 'undefined') {
      problemes.push(claus[k] + ' ha arribat a producció amb el text «' + fila[claus[k]] + '»');
    }
    if (fila[claus[k]].indexOf('<') !== -1) {
      problemes.push(claus[k] + ' porta HTML sense netejar: «' + fila[claus[k]] + '»');
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(fila.data_entrada)) {
    problemes.push('data_entrada no és una marca ISO');
  }
  if (fila.estat !== 'pendent') {
    problemes.push('estat hauria de ser «pendent»');
  }
  if (fila.descripcio_ca !== '') {
    problemes.push('descripcio_ca ha de sortir buida: el flux és tot en francès');
  }
  // La comarca no es comprova per valor: cap dels 35 camps no la porta, però
  // es deduïx del municipi, o sigui que depèn del poble de cada cas. El que sí
  // que ha de valer sempre és que sigui una de les cinc, o buida.
  if (fila.comarca !== '' && COMARQUES.indexOf(fila.comarca) === -1) {
    problemes.push('comarca «' + fila.comarca + '» no és cap de les cinc');
  }
  if (fila.id !== '' && fila.id === syndicObjectID) {
    problemes.push('el SyndicObjectID ha sobreviscut com a id');
  }
  if (fila.data_inici !== '' && fila.data_fi === '') {
    problemes.push('hi ha data_inici i no hi ha data_fi');
  }

  return problemes;
}

// ------------------------------------------------------------
// Compara els camps que un cas vigila amb el que ha sortit de debò. Un cas
// pot no vigilar-ne cap: llavors només hi valen les comprovacions de sempre.
// ------------------------------------------------------------
function comparaEsperat(fila, espera) {
  var problemes = [];

  if (!espera) {
    return problemes;
  }

  var claus = Object.keys(espera);

  for (var i = 0; i < claus.length; i++) {
    var camp = claus[i];
    if (fila[camp] !== espera[camp]) {
      problemes.push(camp + ': esperava «' + espera[camp] + '», tinc «' + fila[camp] + '»');
    }
  }

  return problemes;
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    process.argv[1].indexOf('mapeja-adt66') !== -1) {
  provaBateria();
}
