// ---------------------------------------------------------------------------
// SINCRONITZACIÓ PROGRAMADA — EL CABLEJAT DEL CAMÍ ADT66 -> pendents.json
//
// Una sola feina: encadenar les peces que ja existien soltes i escriure el que
// en surti a `pendents.json`. Res més.
//
//   sincronitzaADT66()  ->  mapejaOfertaADT66()  ->  apartaVisitesGuiades()
//                                                ->  dedupDinsDelLot()
//                                                ->  classificaContraFitxers()
//                                                ->  filtraCandidats()
//                                                ->  aplicaLimit()
//                                                ->  tradueixLot()
//
//   Les que vénen d'un altre fitxer són les quatre primeres.
//   apartaVisitesGuiades() viu aquí perquè és l'única regla del §«La visita
//   comentada» d'aquest fitxer i l'única decisió editorial de tot el camí;
//   tradueixLot() també, perquè és l'única crida a un model de tot el camí.
//   Vegeu-hi tots dos el perquè.
//
//   - CRIDA GEMINI, i NOMÉS Gemini. Una crida per fila, al pas 7 bis, per
//     escriure el títol i les dues descripcions en català abans d'encuar-les.
//     Vegeu el §«La traducció a la ingestió» d'aquí sota. RES DE CLOUDINARY:
//     el cartell definitiu el continua fent el curador.
//   - NOMÉS ESCRIU A `pendents.json`. `events.json` es llegeix per a la capa 2
//     de la deduplicació i prou; d'aquí no en surt mai cap escriptura.
//   - CAP `git commit`, CAP `git push`. L'escriptura va per l'API de continguts
//     de GitHub, igual que la del Worker: el curador pot estar publicant al
//     mateix moment i un push del runner li trepitjaria el fitxer sencer.
//
// QUINS ESTATS TRACTA (§4 de CLAUDE.md ho exigeix declarat):
//
//   - Les files que ESCRIU són sempre `pendent`: surten de mapejaOfertaADT66().
//   - Les files que JA HI HA no es toquen mai, amb una excepció comptada: la
//     poda del §«La poda» d'aquí sota, que només mira `estat === 'rebutjat'`
//     —comparació explícita, mai un `!== 'pendent'`— i mai `pendent` ni
//     `publicat`.
//   - La deduplicació de la capa 1 mira els TRES estats sense filtrar-ne cap:
//     ho fa eines/dedup-contra-fitxers.js i aquí no s'hi afegeix res.
//
// L'ORDRE DE LES PECES NO ÉS INDIFERENT. La classificació contra fitxers va
// DESPRÉS del mapeig, sempre: la capa 1 llegeix el tag `[ADT66 id: …]` que hi
// escriu el mapeig, i la capa 2 compara títols, que abans del mapeig encara
// són el camp cru del flux. Abans del mapeig no hi hauria res a comparar.
//
// LA VISITA COMENTADA (R4) va just darrere del mapeig, i no podria anar més
// tard: mira `RechercheTYPE` i tres camps de text del flux, i la fusió del pas
// següent construeix files noves que ja no porten l'oferta crua a sobre.
//
// I la deduplicació DINS DEL LOT va entremig, pel mateix motiu i per un de
// seu: després del mapeig perquè abans no hi ha ni títol ni municipi a
// comparar, i abans de la classificació perquè el que es compara contra el
// que ja tenim ha de ser el lot ja net. Si anés després, dues ofertes bessones
// del mateix lot entrarien totes dues a la cua i el curador les hauria de
// resoldre a mà, una per una.
//
// LA PODA. Abans d'escriure, i dins de la mateixa escriptura, es treuen de la
// cua les files amb `estat === 'rebutjat'` i `data_fi` anterior a avui. És
// segur perquè el flux de l'ADT66 només ofereix actes futurs: una oferta ja
// passada no pot tornar, i per tant no cal recordar-ne el rebuig. Les files
// `pendent` NO es poden mai, sigui quina sigui la data —la cua és del curador
// i ningú més no en treu res—, i les `rebutjat` sense `data_fi` tampoc: no es
// pot dir que hagin passat.
//
// EL LÍMIT `--limit=N` és un interruptor de mà i prou: talla el nombre de
// files candidates després dels filtres i de tota la deduplicació. Ja no hi ha
// cap constant de límit —la de la primera execució s'ha esborrat— i per omissió
// no es retalla res: el sostre d'una passada de debò el posa el pressupost de
// crides a Gemini, que és un altre concepte i una altra constant.
//
// LA TRADUCCIÓ A LA INGESTIÓ (pas 7 bis). El flux arriba en francès i encuar
// una agenda catalana en francès no té sentit, o sigui que abans d'escriure una
// fila se li reescriuen el títol i les dues descripcions en català. Una crida a
// Gemini PER FILA, mai per lot: amb deu fitxes al mateix missatge la descripció
// d'una es contamina de la del costat, i el risc número u d'aquesta feina és
// justament la invenció.
//
// VA DESPRÉS DE TOTA LA DEDUPLICACIÓ, i no pot anar més amunt: la capa 2
// compara títols i FONT_ADT66 declara `llengua: 'fr'`. Traduir abans deixaria
// el lot en català amb una etiqueta que diu francès i la comparació de títols
// no voldria dir res. Conseqüència coneguda i ja escrita a
// docs/HANDOFF-ADT66.md §4: la capa 2 continua inerta per a aquesta font.
// Traduir aquí NO l'activa, i no és cap descuit.
//
// DOS CASOS, I NO ES BARREGEN MAI:
//
//   PRESSUPOST EXHAURIT -> la fila NO s'escriu. Torna sola la propera passada:
//     el flux la torna a oferir, la classificació la torna a dir `nova` i entra
//     a la cua de la vegada següent. Cap tercer fitxer d'estat, cap marca, res
//     a recordar (§3 de CLAUDE.md: l'estat viu en dos JSON i prou).
//   CRIDA FALLIDA (xarxa, 429, JSON il·legible, model que torna buit) -> la
//     fila S'ESCRIU igualment, amb el títol i el text francesos tal com
//     arriben, i amb un avís a `nota_curador`. Un reintent per fila com a
//     màxim; després, s'encua i se segueix. UNA FILA QUE PETA NO ATURA MAI EL
//     RUN. El motiu és el biaix del §4 ter de CLAUDE.md —si dubtes, ENCUA—: si
//     la fallada descartés, una fila que petés sempre no entraria mai a la cua,
//     i un acte que ningú no veu és pitjor que un acte en francès.
//
//   El 429 és, doncs, una crida fallida i no un cas a part. Si la quota del dia
//   és morta, la passada encua el lot sencer en francès amb l'avís posat: és
//   incòmode, es veu de seguida al registre del run i és la direcció bona de
//   l'error.
//
// EL PRESSUPOST són 300 crides per passada, no les 500 del dia: els altres 200,
// marge inclòs, són per al camí de correu del Worker, que comparteix la quota
// del projecte. Vegeu PRESSUPOST_CRIDES_GEMINI.
//
// EL RITME és una pausa entre crides per no passar de 15 RPM. Es tradueix per
// ordre d'IMMINÈNCIA, no per ordre del flux: el que es queda fora del
// pressupost ha de ser el que passa més tard, que encara serà dins la finestra
// de 30 dies la propera vegada.
//
// EN SEC NO ES GASTA QUOTA. `--en-sec` no crida Gemini de debò; la crida es pot
// injectar (`cridaGemini` a les opcions) i és així com es prova el pas sencer
// sense clau i sense xarxa.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/sincronitza-programada.js --en-sec   -> ho fa tot MENYS escriure
//                                                      i sense cridar Gemini
//   node eines/sincronitza-programada.js            -> tradueix i escriu
//   node eines/sincronitza-programada.js --limit=5  -> com a màxim 5 candidates
//   node eines/sincronitza-programada.js --pressupost=5  -> com a màxim 5 crides
//   node eines/sincronitza-programada.js --en-sec --amb-gemini --pressupost=5
//                                                   -> tradueix de debò i no
//                                                      escriu res: és com es
//                                                      jutja el prompt
//
// PER JUTJAR EL PROMPT, doncs, `--en-sec --amb-gemini` amb un pressupost petit.
// `--amb-gemini` no fa res sense `--en-sec` (fora d'en sec ja es tradueix) i és
// l'única manera de veure què escriu el model sense tocar `pendents.json`. Amb
// `--fitxes` a més a més, escriu al terminal els tres camps de cada fila.
//
// Dos secrets a l'entorn, i cadascun fa una cosa:
//
//   GITHUB_TOKEN    sense ell els dos fitxers es llegeixen del disc i
//                   l'escriptura no es pot fer: en sec funciona, i sense
//                   `--en-sec` s'atura amb un error clar. Amb token, tots dos
//                   es llegeixen per l'API —mai de Pages, que serveix còpies de
//                   CDN endarrerides (§7 de CLAUDE.md).
//   GEMINI_API_KEY  sense ella NO es tradueix i la passada NO s'atura: les
//                   files s'encuen en francès, com abans que el pas 7 bis
//                   existís, i el registre del run ho diu amb un ATENCIÓ. Va
//                   als Secrets d'Actions del repositori, que és un magatzem
//                   diferent del de Cloudflare (§7 bis de CLAUDE.md).
// ---------------------------------------------------------------------------


// --- El que ve de fora ------------------------------------------------------

// Les peces que aquest fitxer encadena. Cap no s'ha tocat: aquí només es
// criden, en l'ordre que toca.
var adt66 = require('./adt66-sincronitza.js');
var mapeig = require('./mapeja-adt66.js');
var dedup = require('./dedup-esdeveniments.js');
var contraFitxers = require('./dedup-contra-fitxers.js');
var filtre = require('./filtra-candidats.js');

// I la neteja de text del flux, que la regla de la visita comentada necessita:
// «català» arriba escrit «catal&agrave;» dins de l'HTML del camp, i sense
// desfer l'entitat el senyal textual no s'hi veu.
var neteja = require('./neteja-text.js');

var fs = require('fs');


// --- Coordenades ------------------------------------------------------------

// El repositori on viuen els dos fitxers. A GitHub Actions, `GITHUB_REPOSITORY`
// ve donat pel propi run («propietari/repositori»); fora d'allà valen els
// mateixos valors que el Worker.
var REPOSITORI_PER_OMISSIO = 'CLMVallespir/agenda-catalogne-nord';
var BRANCA = 'main';
var FITXER_PENDENTS = 'pendents.json';
var FITXER_EVENTS = 'events.json';

// El descriptor de font del flux. `tipus` és una clau de JERARQUIA_FONTS
// (eines/dedup-esdeveniments.js): l'ADT66 recull el que hi entren les oficines
// de turisme, no és mai l'organitzador. `llengua` és 'fr' perquè els títols del
// flux arriben en francès, i sense aquesta dada els títols no es comparen mai.
var FONT_ADT66 = { tipus: 'oficina-turisme', llengua: 'fr' };


// --- El límit de mà `--limit=N`: cap constant -------------------------------
// AQUÍ HI HAVIA `LIMIT_FILES_PRIMERA_EXECUCIO = 40`, temporal, per exercitar el
// camí d'escriptura amb poques files. S'ha esborrat: per omissió no es retalla
// cap candidata. El que queda és l'interruptor `--limit=N` de la línia
// d'ordres, per a proves acotades, i aplicaLimit() que el fa.
//
// EL SOSTRE D'UNA PASSADA DE DEBÒ ÉS UN ALTRE: el pressupost de crides a Gemini
// d'aquí sota. Són dos conceptes diferents, amb dues constants diferents i a
// posta —un limita files candidates, l'altre limita crides a un servei extern
// amb quota compartida— i mai no s'han de fondre en un sol nombre.
//
// EL LÍMIT S'APLICA AL FINAL, mai al principi. Va després del mapeig, de la
// regla de la visita comentada, de la deduplicació dins del lot, de la
// classificació contra els dos fitxers i del filtre previ: és l'últim pas abans
// de traduir. Si retallés abans, les files que quedessin no serien
// representatives del que el camí produeix de debò —serien les primeres del
// flux, filtres inclosos o no, i no se'n podria dir res.
//
// Es queda les de `data_inici` MÉS IMMINENT, no les primeres que arribin, i pel
// mateix criteri amb què tradueixLot() gasta el pressupost.

// La data amb què s'ordena una fila sense `data_inici` utilitzable. No és cap
// data: és un valor que compara més gran que qualsevol AAAA-MM-DD de debò, per
// deixar aquestes files al final quan el criteri d'ordre és la imminència.
var DATA_AL_FINAL = '9999-99-99';


// --- Constants: la traducció a la ingestió (pas 7 bis) ----------------------

// EL MODEL D'AQUEST CAMÍ ÉS SEU I NO ES MOU AMB EL DEL WORKER, i per això la
// constant porta sufix. Són dues feines diferents: el Worker treu setze camps
// d'un correu que ningú no tornarà a enviar, aquí es reescriuen tres camps
// d'una fila que, si surt malament, torna la setmana que ve. Provar un model
// nou aquí no ha de tocar el camí de correu, que funciona.
//
// Des del 5 de setembre de 2026 és `gemini-3.1-flash-lite` i abans era
// `gemini-3.5-flash-lite`, el mateix que el Worker. El canvi és per qualitat de
// llengua, no per quota: segons la consola, tots dos donen 500 RPD i 250K TPM
// al pla gratuït, o sigui que el pressupost de 300 crides no es toca.
//
// Mai la gamma Pro, que és de pagament. Un 404 amb el nom del model a dins és
// cicle de vida normal de Google: mira quins Flash / Flash-Lite hi ha vigents i
// canvia la constant (§7 de CLAUDE.md).
var GEMINI_MODEL_TRADUCCIO = 'gemini-3.1-flash-lite';
var GEMINI_URL_TRADUCCIO = 'https://generativelanguage.googleapis.com/v1beta/models/' +
  GEMINI_MODEL_TRADUCCIO + ':generateContent';

// Tres camps curts en dues llengües. 512 podrien quedar justos amb una
// descripció llarga; 1024 hi caben de sobres i no es paguen si no s'usen.
var GEMINI_MAX_TOKENS = 1024;

// Igual que al Worker: JSON garantit, sense `temperature` (els models 3.x la
// ignoren) i sense `thinkingBudget` (llegat, incompatible amb thinkingLevel).
// Aquí `minimal` i no `low`: això és redacció, no la decisió que demana
// eines/classifica-editorial.js.
var CONFIGURACIO_GEMINI = {
  maxOutputTokens: GEMINI_MAX_TOKENS,
  responseMimeType: 'application/json',
  thinkingConfig: { thinkingLevel: 'minimal' }
};

// EL PRESSUPOST DE CRIDES D'UNA PASSADA, i és 300 a posta i no 500.
//
// El pla gratuït de Gemini 3.5 Flash-Lite dona 15 RPM · 250K TPM · 500 RPD, i
// els límits són PER PROJECTE, no per clau: el camí de correu del Worker
// comparteix aquesta mateixa quota. Els 200 que queden, marge inclòs, són per a
// ell. Una extracció de correu perduda per quota exhaurida és una pèrdua real
// —el remitent ja ha enviat el correu i ningú no el tornarà a enviar—; una fila
// d'ADT66 que espera la propera passada, no.
//
// NO ÉS EL LÍMIT DE FILES. Vegeu el §«El límit de mà» de dalt: són dos
// conceptes. Aquest nombre no es toca sense tornar a mirar la quota del
// projecte a https://aistudio.google.com/rate-limit.
var PRESSUPOST_CRIDES_GEMINI = 300;

// Els intents que té una fila: un, i un reintent. Prou per a un tall de xarxa i
// per a una resposta mal formada; el que peti dues vegades s'encua en francès i
// la passada continua.
var INTENTS_PER_FILA = 2;

// La pausa ENTRE crides, per no passar de 15 RPM. Quinze per minut són 4 000 ms
// justos; 4 500 hi deixa marge, i amb la latència de la crida a sobre la
// passada va a uns 10 per minut.
//
// D'AQUÍ SURT EL `timeout-minutes` DEL WORKFLOW: 300 crides a 4,5 s de pausa
// són 22 minuts i mig, més la latència de cada crida, i el `.yml` en demana 40
// per tenir marge. Si es canvia aquesta xifra o el pressupost, s'ha de canviar
// allà també.
var PAUSA_ENTRE_CRIDES_MS = 4500;

// Fins on s'ensenya el motiu d'una crida fallida al registre del run. Els
// missatges d'error de Gemini porten el cos sencer de la resposta a dins i
// poden fer centenars de línies; el que cal per saber què passa són les
// primeres. Es retalla per caràcters, no per paraules: aquí no hi ha res a
// llegir bonic, hi ha un codi d'error a trobar.
var MAX_MOTIU_FALLADA = 300;

// Els tres avisos que la traducció enganxa darrere del tag [ADT66 id: …].
// SÓN EXCLOENTS: una fila en porta un i mai dos. El curador ha de poder
// distingir «hi ha text català i el va escriure una màquina» de «només hi ha el
// títol» i de «no hi ha text català».
var AVIS_TRADUIT =
  'Títol i descripcions escrits per un model a partir del text francès de l\'ADT66. Comprova\'ls abans de publicar.';
var AVIS_NOMES_TITOL =
  'Títol escrit per un model a partir del francès de l\'ADT66. L\'oferta no porta cap text descriptiu i no se n\'ha inventat cap: les dues descripcions queden buides.';
var AVIS_NO_TRADUIT =
  'No s\'ha pogut escriure la versió catalana: la fila entra amb el títol i el text en francès tal com els dona l\'ADT66.';


// --- Constants: el prompt de traducció --------------------------------------
// Aquest text NO és el prompt d'extracció de prompts/extract-event.txt i no
// n'ha de ser cap còpia: aquell treu setze camps d'un correu, aquest reescriu
// tres camps d'una fila que ja té tota la resta decidida. Són dues feines i dos
// prompts.
//
// L'ORDRE DELS BLOCS ÉS UNA DECISIÓ, no l'ordre en què es van escriure. Els
// que hi són, i per què són on són:
//
//   - NOMÉS TRES CLAUS. Dates, hores, lloc, categoria i organitzador no li
//     passen ni pel davant: ja els ha decidit el mapeig.
//   - EL TO VA CURT I VA AVIAT, just després del bloc de llengua. El model
//     anterior no en necessitava cap; el 3.1 hi torna sol («Vine a conèixer…»,
//     «descobreix…»), i és un vici que es corregeix amb dues línies i dos
//     exemples, no amb un paràgraf.
//   - EL MUNICIPI TÉ BLOC PROPI des del 5 de setembre de 2026, i abans era un
//     pic dins del bloc dels noms propis. El canvi de model el va convertir de
//     dada en instrucció: la fila de Tuïr va sortir amb el títol «Fòrum de les
//     associacions de Tuïr» i la de Sureda amb «les entitats locals de Sureda»
//     dins d'una descripció que sortia d'un text de font on Sureda no surt
//     enlloc. El bloc diu ara les DUES cares —quina forma s'escriu si el poble
//     surt al text, i que no s'hi posa si no hi surt— i porta els dos casos com
//     a exemples negatius literals. La comarca hi va al costat, i la categoria
//     continua sense passar-hi.
//   - ELS NOMS PROPIS TENEN BLOC PROPI, i va penúltim. El forat original és
//     mesurat: en una fila real del camí de correu, «punt de trobada a La
//     Menera» va sortir en francès com a «rendez-vous à Le Tech» —un altre
//     poble. La FRONTERA del que és nom propi hi és des del 5 de setembre de
//     2026, quan el model va copiar «Forum des Associations Thuir» sencer dins
//     d'una frase catalana: una descripció genèrica en francès amb majúscules
//     no és cap nom batejat, i es tradueix.
//   - LA REGLA DE NO INVENTAR VA L'ÚLTIMA, que és la posició que els models
//     retenen millor, i porta títol propi. Els forats són dos i són diferents:
//     8 de les 712 ofertes d'una passada sencera no porten cap
//     `DETAILDESCRIPTIF` —cap matèria—, i les que en porten poca conviden a
//     parafrasejar el títol, que és el que va passar amb la fila de Sureda. Per
//     això la regla diu ara, en primer lloc, que el títol NO és matèria.
//
// La fitxa s'enganxa darrere de la línia `FITXA:`, com el prompt d'extracció
// fa amb `CORREU:`.
var PROMPT_TRADUCCIO = [
  'Ets el redactor en català de l\'agenda cultural «Què fas?» de la Catalunya Nord.',
  'Reps la fitxa d\'un acte tal com arriba del flux de l\'agència de turisme dels Pirineus Orientals: el títol en francès i sovint tot en majúscules, i un text descriptiu en francès, cru, que pot portar preus, horaris, adreces i línies enganxades. La teva feina és escriure el títol i la descripció en català, i després la versió francesa d\'aquesta descripció catalana. Res més.',
  '',
  'FORMAT DE RESPOSTA — REGLES ABSOLUTES',
  '1. Respon NOMÉS amb un objecte JSON vàlid. Cap text abans ni després. Cap explicació. Cap bloc de codi markdown.',
  '2. L\'objecte conté exactament aquestes 3 claus, totes presents sempre, en aquest ordre: titol, descripcio_ca, descripcio_fr.',
  '3. Tots els valors són cadenes de text. Cap altra clau, mai.',
  '4. No et demano cap altre camp. La data, l\'hora, el lloc, la categoria i l\'organitzador ja són decidits: no els toquis ni els esmentis. El MUNICIPI i la COMARCA te\'ls dono només com a context, i el bloc «EL MUNICIPI ÉS CONTEXT, NO MATÈRIA» diu exactament per a què serveixen i per a què no.',
  '',
  'ELS TRES CAMPS',
  '- titol: el títol de l\'acte en català, en caixa normal —majúscula inicial i prou, mai tot en majúscules. Sense preus, sense hores, sense dates i sense el nom del poble. Amb els noms propis, fes el que digui la regla de sota: n\'hi ha molts, als títols d\'aquest flux.',
  '- descripcio_ca: de 2 a 4 frases en català natural i correcte. Digues de què va l\'acte, per a qui és i què s\'hi farà, amb la informació del text original: ni res més, ni res menys. Traduir no és resumir. Redacta-la directament en català; no facis una traducció literal del francès. No hi posis preus, ni horaris, ni dates, ni adreces, ni telèfons, ni webs: o tenen el seu camp o no van enlloc.',
  '- descripcio_fr: traducció francesa fidel de la descripcio_ca que acabes d\'escriure —de la teva, no del text original—, també de 2 a 4 frases. La mateixa informació, ni més ni menys, i els mateixos noms propis lletra per lletra: passar del català al francès no és cap ocasió de canviar-ne cap.',
  '',
  'EL CATALÀ HA DE SER CATALÀ',
  '- Cap paraula ni cap expressió francesa sense traduir dins d\'una frase catalana. Que soni bé no la fa bona: «saveurs del terroir» és un error, i s\'escriu «sabors de la terra».',
  '- Els gentilicis i els adjectius han de ser formes catalanes de debò, no calcs del francès: «banyulencques» no existeix, la forma és «banyulenques».',
  '',
  'EL TO ÉS INFORMATIU, MAI PUBLICITARI',
  'Escrius per a una agenda, no per a un cartell: explica què passa, no convidis ningú a venir-hi. Cap exclamació, i cap imperatiu dirigit al lector.',
  '- EXEMPLES DEL QUE NO HAS DE FER: «Vine a conèixer les associacions banyulenques» i «descobreix les activitats que proposen per al nou curs». S\'escriuen «L\'acte permet conèixer les associacions banyulenques» i «s\'hi presenten les activitats que proposen per al nou curs».',
  '',
  'EL MUNICIPI ÉS CONTEXT, NO MATÈRIA',
  'La fitxa comença amb un camp MUNICIPI que porta la forma bona del nom del poble, ja resolta. Te\'l dono per una sola cosa: perquè escriguis bé el topònim SI el text original ja el diu. No és informació que hagis d\'afegir enlloc —ja té el seu camp a la fitxa, i qui la llegeixi el veurà igualment.',
  '- SI EL TEXT ORIGINAL ESMENTA EL POBLE, ES MANTÉ, i EL CAMP MUNICIPI MANA SOBRE LA FORMA —no sobre si hi surt o no. Escriu-lo EXACTAMENT com te\'l dono a MUNICIPI i mai com surt al text: si MUNICIPI diu «Tuïr» i el text diu «Thuir», tu escrius «Tuïr». El camp serveix per triar-ne la forma, mai per justificar que te\'l saltis: treure de la descripció un poble que la font diu és perdre informació. EXEMPLE DEL QUE SÍ QUE HAS DE FER: amb MUNICIPI «Santa Maria la Mar» i el text «le marché du front de mer de Sainte Marie la Mer vous accueille chaque samedi matin», s\'escriu «el mercat del front de mar de Santa Maria la Mar obre cada dissabte al matí», i NO «el mercat del front marítim», que perd el poble. Si MUNICIPI arriba buit, copia la forma del text i no te\'n inventis cap.',
  '- SI EL TEXT ORIGINAL NO ESMENTA EL POBLE, LA DESCRIPCIÓ CATALANA TAMPOC NO L\'HA D\'ESMENTAR. Afegir-l\'hi és inventar. EXEMPLE DEL QUE NO HAS DE FER: amb MUNICIPI «Sureda» i un text que no diu Sureda enlloc, escriure «permet descobrir les entitats locals de Sureda».',
  '- AL TÍTOL EL MUNICIPI NO HI SURT MAI, ni en forma catalana ni en cap altra, i tant se val si el títol francès que reps el porta: se\'n treu. EXEMPLE DEL QUE NO HAS DE FER: amb MUNICIPI «Tuïr», el títol «Fòrum de les associacions de Tuïr». El títol bo és «Fòrum de les associacions».',
  '',
  'ELS NOMS PROPIS NO ES TRADUEIXEN MAI — REGLA DURA',
  'Un nom propi es COPIA. No es tradueix, no s\'adapta i no se\'n busca cap equivalència en l\'altra llengua. Val per als tres camps alhora, i molt especialment DINS de les frases de la descripció, que és on és fàcil que se t\'escapi.',
  '- ELS TOPÒNIMS que no siguin el de MUNICIPI —masos, serres, rius, barris, i qualsevol altre poble—: copia\'ls tal com surten al text que reps. Si el text els porta en català, en català es queden; si els porta en francès, en francès. Mai no canviïs un nom de lloc per un altre.',
  '- EXEMPLE DEL QUE NO HAS DE FER, MAI: «La Menera» NO és «Le Tech». Són dos pobles diferents, i canviar-ne un per l\'altre trasllada l\'acte a un altre poble. Que un topònim s\'assembli a una paraula corrent no el fa traduïble.',
  '- ÉS NOM PROPI, I ES COPIA, el que identifica una entitat concreta i té nom batejat: els noms d\'esdeveniment i de festival, els noms de grup, de companyia i d\'artista, els noms de sala i d\'equipament, els noms d\'associació i d\'entitat, i els títols d\'obra —llibres, pel·lícules, espectacles, exposicions. Encara que semblin descriptius: «Ripailles Sonores» es queda «Ripailles Sonores», i «Festival Lyrique des Pays Catalans» també.',
  '- NO ÉS NOM PROPI una descripció genèrica en francès, encara que porti majúscules: «Forum des Associations», «Marché Hebdomadaire», «Exposition». Aquestes diuen QUÈ és l\'acte, no COM es diu l\'acte, i per tant es TRADUEIXEN.',
  '- EXEMPLE DEL QUE NO HAS DE FER: escriure «El Fòrum des Associations Thuir és una oportunitat per descobrir el teixit associatiu» dins d\'una frase catalana. Allà «Forum des Associations» és genèric i el poble ja és el de MUNICIPI: s\'escriu «El fòrum de les associacions permet conèixer el teixit associatiu de la localitat».',
  '- EN CAS DE DUBTE ENTRE LES DUES, TRADUEIX. Un títol genèric traduït per error encara es recupera; un nom propi traduït, menys; però un tros de francès sense traduir dins d\'una frase catalana és el pitjor dels tres.',
  '- AL TÍTOL, la tria és aquesta i només aquesta. Si el títol de l\'acte és un nom propi, deixa\'l com és i normalitza\'n només la caixa. Si el títol és una frase descriptiva —diu què s\'hi farà, no com es diu l\'acte—, aleshores sí que el tradueixes al català.',
  '- Un nom propi copiat dins d\'una frase catalana no s\'ha de marcar de cap manera: ni cursiva, ni cometes, ni cap aclariment al costat.',
  '',
  'QUAN NO HI HA PROU MATÈRIA — LA REGLA MÉS IMPORTANT',
  'LA DESCRIPCIÓ CATALANA S\'ESCRIU NOMÉS A PARTIR DEL CAMP TEXT. EL TÍTOL NO ÉS MATÈRIA: parafrasejar-lo, allargar-lo o explicar-lo no és descriure l\'acte, és inventar-se\'l amb altres paraules.',
  'No inventis mai res. No completis amb el que sol passar als actes d\'aquesta mena, ni amb el que sàpigues del poble, de l\'entitat o del festival. Si el TEXT no dona prou matèria per escriure dues frases honestes, torna descripcio_ca i descripcio_fr com a cadenes buides. Val més una fitxa sense descripció que una descripció deduïda: la fitxa la revisarà una persona, i un camp buit es veu de seguida mentre que una invenció ben escrita no.',
  '- EXEMPLE DEL QUE NO HAS DE FER: TÍTOL «FORUM DES ASSOCIATIONS ET ACCUEIL DES NOUVEAUX ARRIVANTS», TEXT «Repli au gymnase en cas de mauvais temps». Aquest text diu una sola cosa —que si fa mal temps es fa al gimnàs— i res més: no diu qui hi ha, ni què s\'hi fa, ni per a qui és. Escriure-hi «Aquest esdeveniment permet descobrir les entitats locals i dona la benvinguda a les persones nouvingudes» és parafrasejar el títol, i està PROHIBIT. La resposta bona té descripcio_ca i descripcio_fr totes dues buides.',
  'SI EL CAMP TEXT ARRIBA BUIT, no hi ha matèria de cap mena: torna descripcio_ca i descripcio_fr totes dues com a cadenes buides i limita\'t a escriure el titol. Un títol sol no és informació sobre l\'acte, i escriure-hi dues frases al damunt seria inventar-les.',
  'Si el títol tampoc no es pot escriure —no n\'hi ha cap, o és il·legible—, torna també titol com a cadena buida.',
  '',
  'EXEMPLE DE RESPOSTA (només per il·lustrar el format; no copiïs aquestes dades)',
  '{"titol":"Festa de la carbassa","descripcio_ca":"El comitè de festes organitza una diada al voltant de la carbassa a la plaça del poble. Hi haurà parades de productors, tallers de cuina i jocs per a la mainada. L\'activitat s\'adreça a tothom.","descripcio_fr":"Le comité des fêtes organise une journée autour de la courge sur la place du village. Il y aura des stands de producteurs, des ateliers de cuisine et des jeux pour les enfants. L\'activité s\'adresse à tous."}',
  '',
  'FITXA:',
].join('\n');


// --- Constants: la visita comentada (R4) ------------------------------------

// Els dos valors de `RechercheTYPE` que mou la regla d'aquí sota. Es comparen
// sobre el valor ja normalitzat —minúscules i sense accents—, perquè al flux
// venen «Visite guidée» i «Portes ouvertes» amb l'accent posat.
var TIPUS_VISITA_GUIADA = 'visite guidee';
var TIPUS_PORTES_OBERTES = 'portes ouvertes';

// Els tres camps del flux on es busca la menció del català. Són els que porten
// text lliure escrit per qui va entrar l'oferta; la resta o són codis interns o
// són el títol, que ve sempre en francès i en majúscules.
var CAMPS_DE_LLENGUA = ['DETAILDESCRIPTIF', 'COMMUNNOM', 'ACCROCHE150'];

// El senyal textual, un i prou. Sobre el text ja normalitzat, «catala» surt
// igualment de «català», de «catalan», de «catalane» i de «catalanes»: totes
// quatre comencen igual un cop tret l'accent. No enganxa «Catalogne», que
// segueix per o.
var SENYAL_CATALA = 'catala';

// Els dos avisos que s'enganxen darrere del tag [ADT66 id: …] quan una visita
// comentada es rescata. Diuen per quin dels dos motius s'ha quedat, perquè el
// curador pugui comprovar-ho: cap dels dos senyals no és una prova.
var AVIS_RESCAT_CATALA =
  'Visita comentada (R4): es queda perquè el text esmenta el català. Comprova que la visita es faci de debò en català.';
var AVIS_RESCAT_PORTES_OBERTES =
  'Visita comentada (R4): es queda perquè hi consta també «Portes ouvertes», que és obertura de patrimoni i no discurs. Comprova-ho.';


// --- La funció --------------------------------------------------------------

// ------------------------------------------------------------
// Fa una passada sencera. `opcions` és { enSec, token, clauGemini, repositori,
// avui, limit, pressupost, pausaMs, cridaGemini }:
//
//   enSec        a cert ho fa tot menys escriure, i tampoc no crida Gemini
//   token        el GITHUB_TOKEN; sense ell els fitxers es llegeixen del disc
//   clauGemini   la GEMINI_API_KEY; sense ella no es tradueix
//   avui         AAAA-MM-DD, per fixar la data a les proves
//   limit        talla les candidates (0, per omissió, no en talla cap)
//   pressupost   les crides a Gemini de la passada (per omissió,
//                PRESSUPOST_CRIDES_GEMINI)
//   pausaMs      la pausa entre crides (per omissió, PAUSA_ENTRE_CRIDES_MS; 0
//                la treu, i és com les proves corren de seguida)
//   ambGemini    a cert, en sec TAMBÉ tradueix de debò. És per jutjar el
//                prompt: crides reals, cap escriptura
//   cridaGemini  la crida injectada, per provar el pas 7 bis sencer sense clau
//                i sense xarxa. Se la crida amb (fila) i ha de tornar una
//                promesa de { titol, descripcio_ca, descripcio_fr }
//
// Torna l'informe sencer, que és el que s'ensenya al registre del run:
//
//   ofertes      quantes n'ha donat el flux
//   visitesDescartades  les visites comentades tretes per R4, amb el títol
//   visitesRescatades   [{ titol, motiu }, ...] les que s'han quedat, i per què
//   fusionades   quantes ofertes del lot eren duplicats d'una altra del lot
//   recompte     { ja_publicat, ja_a_la_cua, ja_rebutjat, nova, total }
//   descartats   [{ motiu, quantes }, ...]  el que ha tret el filtre previ
//   candidates   quantes files han passat TOTS els filtres i tota la
//                deduplicació, abans del límit i del pressupost
//   limit        el límit que s'ha aplicat (0 vol dir cap)
//   retalladesPerLimit  quantes candidates s'han quedat fora només pel límit.
//                Es compta a part de `descartats` a posta: són dos motius que
//                no s'han de barrejar mai —el filtre diu «aquest acte no hi
//                entra», el límit diu «aquest acte hi entrarà a la propera
//                passada»
//   traducio     l'informe del pas 7 bis (vegeu tradueixLot())
//   noves        les files que s'escriuen (o s'escriurien, en sec). No és el
//                mateix que `candidates`: el pressupost de crides n'hi pot
//                haver deixat fora
//   podades      les files rebutjades i caducades que s'han tret de la cua
//   escrit       cert si s'ha escrit de debò a pendents.json
//   reintents    quants cops ha calgut reintentar el PUT per conflicte de sha
//                (0 = ha entrat de primera)
// ------------------------------------------------------------
async function sincronitzaProgramada(opcions) {
  var config = configuracio(opcions);

  // 1. El flux sencer. Sense marca de temps: no hi ha on desar-la (§3 de
  //    CLAUDE.md: cap base de dades) i no cal, perquè la capa 1 de la
  //    deduplicació ja reconeix per identificador tot el que ja tenim.
  var resposta = await adt66.sincronitzaADT66('');

  // 2. El mapeig. Ha d'anar davant de la classificació: és qui escriu el tag.
  var mapejades = mapejaOfertes(resposta.ofertes);

  // 3. La regla de la visita comentada (R4). Va aquí, just darrere del mapeig,
  //    perquè és l'ÚNIC lloc del camí on encara es té l'oferta crua: la fusió
  //    del pas següent construeix una fila nova i deixa caure l'oferta, i de
  //    `RechercheTYPE` i dels tres camps de text ja no en quedaria res.
  var visites = apartaVisitesGuiades(mapejades);

  // 4. La deduplicació dins del mateix lot, abans de comparar-lo amb res.
  var intern = dedupDinsDelLot(visites.passen);
  var entrants = intern.lot;

  // 5. La classificació contra els dos fitxers.
  var cua = await llegeixFitxer(FITXER_PENDENTS, config);
  var publicats = await llegeixFitxer(FITXER_EVENTS, config);
  var classificat = contraFitxers.classificaContraFitxers(
    entrants, cua.dades, publicats.dades, FONT_ADT66
  );
  var novesDelFlux = nomesLesNoves(entrants, classificat.classificacions);

  // 6. El filtre previ: finestra de dates i llista negra.
  var filtrat = filtre.filtraCandidats(novesDelFlux, config.avui);
  var candidates = filesDeCandidats(filtrat.passen);

  // 7. El límit temporal de la primera execució, i és l'ÚLTIM pas abans
  //    d'escriure: tot el que arriba aquí ja ha passat tots els filtres i
  //    tota la deduplicació, o sigui que el que es retalla són files bones
  //    que tornaran a entrar a la propera passada.
  var limitat = aplicaLimit(candidates, config.limit);

  // 7 bis. La traducció, i és l'ÚNICA crida a un model de tot el camí. Va aquí
  //        i no més amunt: la capa 2 de la deduplicació compara títols i el lot
  //        hi ha d'arribar en francès, que és el que declara FONT_ADT66. El
  //        §«La traducció a la ingestió» de dalt del fitxer hi té el perquè i
  //        els dos casos —pressupost exhaurit i crida fallida— separats.
  var traduit = await tradueixLot(limitat.files, config);
  var noves = traduit.files;

  // 8. La poda i l'escriptura, que són una sola operació sobre el fitxer.
  var podat = podaRebutjatsCaducats(cua.dades, config.avui);
  var escrit = false;
  var reintents = 0;

  if (!config.enSec && (noves.length > 0 || podat.podades.length > 0)) {
    reintents = await escriuCua(noves, podat.podades.length, config);
    escrit = true;
  }

  return {
    ofertes: resposta.ofertes.length,
    visitesDescartades: visites.descartades,
    visitesRescatades: visites.rescatades,
    fusionades: intern.fusionades,
    recompte: classificat.recompte,
    descartats: motiusDeDescart(filtrat.descartats),
    candidates: candidates.length,
    limit: config.limit,
    retalladesPerLimit: limitat.retallades,
    traducio: traduit.informe,
    noves: noves,
    podades: podat.podades,
    escrit: escrit,
    reintents: reintents
  };
}


// --- Les peces: el mapeig ---------------------------------------------------

// ------------------------------------------------------------
// Passa cada oferta del flux per mapejaOfertaADT66() i en torna els candidats
// en la forma que volen les peces següents: { fila, font, oferta }. Les
// metadadades del mapeig es deixen caure a posta —no tenen encara cap lloc al
// sistema (vegeu el bàner de eines/mapeja-adt66.js) i cap camp d'aquestes no
// va mai a la cua.
// ------------------------------------------------------------
function mapejaOfertes(ofertes) {
  var llista = Array.isArray(ofertes) ? ofertes : [];
  var entrants = [];

  for (var i = 0; i < llista.length; i++) {
    var mapejada = mapeig.mapejaOfertaADT66(llista[i]);
    // `oferta` viatja només fins a apartaVisitesGuiades(), que és l'única peça
    // que ha de mirar camps del flux. De la fusió endavant ja no hi és.
    entrants.push({ fila: mapejada.fila, font: FONT_ADT66, oferta: llista[i] });
  }

  return entrants;
}


// --- Les peces: la visita comentada (R4) ------------------------------------
// Aquesta secció fa UNA regla editorial i prou, i és l'única del fitxer. No és
// el filtre previ: filtraCandidats() mira dates i soroll mecànic i no sap res
// de criteri. Això és R4 de docs/CRITERI-EDITORIAL.md, aplicada de la manera
// més estreta possible —només al valor «Visite guidée» de `RechercheTYPE`— i
// escrita a part perquè es vegi que hi és i es pugui treure d'una peça.
//
// R4 diu: una visita comentada és DISCURS, i per tant queda fora si no es fa
// en català. El problema pràctic és que el flux de l'ADT66 no declara enlloc la
// llengua de l'acte: no hi ha cap camp que ho digui. Per tant no es pot
// comprovar, i la regla s'aplica al revés —una visita que no esmenta enlloc el
// català es dona per francesa i queda fora.
//
// I es rescata per dos motius, tots dos de la mateixa R4:
//
//   (a) el text esmenta el català. És el senyal que hi ha, i és feble: dir
//       «catalane» dins d'una descripció no vol dir que la visita es faci en
//       català. Per això la fila rescatada entra amb un avís que demana al
//       curador que ho comprovi.
//   (b) l'oferta porta TAMBÉ «Portes ouvertes». És l'excepció literal d'R4:
//       una OBERTURA de patrimoni no és discurs.
//
// PER QUÈ AQUESTA REGLA SÍ QUE DESCARTA, quan a tot arreu el biaix del projecte
// és encuar. El §4 ter de CLAUDE.md diu «si dubtes, ENCUA», i és per a la
// deduplicació: allà el dubte és sobre si un acte JA HI ÉS, i equivocar-se vol
// dir perdre un acte que ningú no ha vist mai. Aquí el dubte no hi és: R4 és una
// decisió ja presa pel propietari sobre una classe sencera d'actes, i el que es
// descarta no és un acte desconegut sinó una visita comentada en francès, que el
// criteri diu que no ha d'entrar. La memòria de rebuig del §4 no hi perd res:
// aquestes ofertes no arriben mai a `pendents.json`, o sigui que no hi ha cap
// rebuig a recordar —el flux les tornarà a oferir cada setmana i cada setmana
// cauran igual, que és exactament el que ha de passar.

// ------------------------------------------------------------
// Aparta del lot les visites comentades que R4 deixa fora, i deixa passar les
// que rescata. Torna tres coses:
//
//   passen       [{ fila, font, oferta }, ...]  el lot que continua el camí
//   descartades  [{ titol }, ...]               les que no hi entren
//   rescatades   [{ titol, motiu }, ...]        les que s'hi queden, i per què
//
// `motiu` és 'menció del català' o 'portes obertes'. Es miren en aquest ordre i
// el primer que enganxa és el que es diu: una oferta que compleixi els dos surt
// com a 'menció del català', que és el senyal més fort dels dos.
//
// La fila rescatada surt amb un avís enganxat DARRERE del que ja portés, que és
// sempre el tag [ADT66 id: …] del mapeig (§«La nota del curador» de
// eines/mapeja-adt66.js: el tag va primer). S'ajunta amb la regla compartida
// d'encadenar notes, no amb una concatenació a mà.
// ------------------------------------------------------------
function apartaVisitesGuiades(entrants) {
  var llista = Array.isArray(entrants) ? entrants : [];
  var passen = [];
  var descartades = [];
  var rescatades = [];

  for (var i = 0; i < llista.length; i++) {
    var candidat = llista[i];

    if (!esVisitaGuiada(candidat.oferta)) {
      passen.push(candidat);
      continue;
    }

    var motiu = motiuDeRescat(candidat.oferta);

    if (motiu === '') {
      descartades.push({ titol: candidat.fila.titol });
      continue;
    }

    candidat.fila.nota_curador = dedup.ajuntaNotes(
      candidat.fila.nota_curador, avisDeRescat(motiu)
    );
    rescatades.push({ titol: candidat.fila.titol, motiu: motiu });
    passen.push(candidat);
  }

  return { passen: passen, descartades: descartades, rescatades: rescatades };
}

// ------------------------------------------------------------
// Diu si una oferta del flux és una visita comentada, mirant `RechercheTYPE`.
// ------------------------------------------------------------
function esVisitaGuiada(oferta) {
  return tipusDeLoferta(oferta).indexOf(TIPUS_VISITA_GUIADA) !== -1;
}

// ------------------------------------------------------------
// El motiu pel qual una visita comentada es rescata, o '' si no se'n rescata
// cap. Els dos motius es miren en ordre i el primer que enganxa mana.
// ------------------------------------------------------------
function motiuDeRescat(oferta) {
  if (esmentaElCatala(oferta)) {
    return 'menció del català';
  }

  if (tipusDeLoferta(oferta).indexOf(TIPUS_PORTES_OBERTES) !== -1) {
    return 'portes obertes';
  }

  return '';
}

// ------------------------------------------------------------
// L'avís que li toca a cada motiu de rescat. Una sola feina: triar el text.
// ------------------------------------------------------------
function avisDeRescat(motiu) {
  if (motiu === 'menció del català') {
    return AVIS_RESCAT_CATALA;
  }

  return AVIS_RESCAT_PORTES_OBERTES;
}

// ------------------------------------------------------------
// Els valors de `RechercheTYPE` d'una oferta, normalitzats i un per un. Es
// parteix per comes, igual que fa eines/mapeja-adt66.js, i amb el mateix efecte
// lateral conegut: dos valors del vocabulari de l'ADT66 porten una coma a dins
// («Projection, cinéma» i «Randonnée, balade») i es parteixen per la meitat. No
// molesta aquí: cap dels dos valors que aquesta regla mira no en porta.
// ------------------------------------------------------------
function tipusDeLoferta(oferta) {
  var brut = '';
  if (oferta && typeof oferta.RechercheTYPE === 'string') {
    brut = oferta.RechercheTYPE;
  }

  var trossos = brut.split(',');
  var tipus = [];

  for (var i = 0; i < trossos.length; i++) {
    var net = normalitzaText(trossos[i]);
    if (net !== '') {
      tipus.push(net);
    }
  }

  return tipus;
}

// ------------------------------------------------------------
// Diu si algun dels tres camps de text lliure de l'oferta esmenta el català. El
// text es passa primer per netejaTextFont(), que desfà l'HTML i les entitats: al
// flux «català» arriba escrit «catal&agrave;», i sense desfer l'entitat el
// senyal no s'hi veuria.
// ------------------------------------------------------------
function esmentaElCatala(oferta) {
  if (!oferta) {
    return false;
  }

  for (var i = 0; i < CAMPS_DE_LLENGUA.length; i++) {
    var brut = oferta[CAMPS_DE_LLENGUA[i]];

    if (typeof brut === 'string' && brut !== '') {
      var text = normalitzaText(neteja.netejaTextFont(brut));
      if (text.indexOf(SENYAL_CATALA) !== -1) {
        return true;
      }
    }
  }

  return false;
}

// ------------------------------------------------------------
// Un text reduït a lletres comparables: minúscules, sense accents, i tot el que
// no sigui lletra o xifra convertit en un sol espai. És la mateixa normalització
// que fa eines/filtra-candidats.js, i a posta: dues peces que comparen text del
// mateix flux l'han de comparar igual.
// ------------------------------------------------------------
function normalitzaText(text) {
  if (typeof text !== 'string' || text === '') {
    return '';
  }

  var net = text.toLowerCase();
  net = net.normalize('NFD').replace(/[̀-ͯ]/g, '');
  net = net.replace(/[^a-z0-9]+/g, ' ');

  return net.trim();
}


// --- Les peces: la deduplicació dins del lot --------------------------------

// ------------------------------------------------------------
// Fusiona entre elles les ofertes del lot que són el mateix acte. Cada oferta
// es compara amb les que ja s'han conservat; la primera que doni
// 'mateix-esdeveniment' se l'absorbeix i la fusionada la substitueix al lloc
// que ja ocupava, de manera que l'ordre d'arribada del lot no canvia.
//
// NOMÉS fusiona amb 'mateix-esdeveniment'. Un veredicte 'dubtos' NO fusiona i
// les dues files es queden: és el mateix biaix del §4 ter de CLAUDE.md —un
// duplicat que arriba a la cua es veu al costat del seu bessó i el curador el
// resol en un clic; un acte que desapareix no el veu mai ningú.
//
// La fusió la fa comparaEsdeveniments() sencera, amb la seva jerarquia de
// fonts i la seva precedència d'estats; aquí no s'hi decideix res. Com que les
// dues files vénen del mateix flux tenen el mateix rang de font, i el que
// mana és el que ja diu aquella peça.
//
// Torna { lot, fusionades }: el lot ja net i quantes ofertes s'han absorbit.
// ------------------------------------------------------------
function dedupDinsDelLot(entrants) {
  var llista = Array.isArray(entrants) ? entrants : [];
  var conservats = [];
  var fusionades = 0;

  for (var i = 0; i < llista.length; i++) {
    var nou = llista[i];
    var absorbit = false;

    for (var j = 0; j < conservats.length; j++) {
      var veredicte = dedup.comparaEsdeveniments(conservats[j], nou);

      if (veredicte.decisio === 'mateix-esdeveniment') {
        conservats[j] = { fila: veredicte.fila, font: FONT_ADT66 };
        fusionades++;
        absorbit = true;
        break;
      }
    }

    if (!absorbit) {
      conservats.push(nou);
    }
  }

  return { lot: conservats, fusionades: fusionades };
}


// --- Les peces: la tria de les noves ----------------------------------------

// ------------------------------------------------------------
// Es queda només els candidats que la classificació ha dit 'nova', i hi
// enganxa el registre que vol el filtre previ. Els dos recorreguts van a la
// una: classificaContraFitxers() torna una classificació per oferta entrant i
// EN EL MATEIX ORDRE, i és d'això que depèn aquesta funció.
// ------------------------------------------------------------
function nomesLesNoves(entrants, classificacions) {
  var noves = [];

  for (var i = 0; i < entrants.length; i++) {
    if (classificacions[i].classificacio === 'nova') {
      noves.push({
        fila: entrants[i].fila,
        font: entrants[i].font,
        registre: registreDeFila(entrants[i].fila)
      });
    }
  }

  return noves;
}

// ------------------------------------------------------------
// La fila de producció vista com un registre de l'esquema de recerca, que és
// l'únic que sap llegir filtraCandidats(). No és cap conversió de dades: són
// els quatre camps que aquell filtre mira, i prou —les dates per a la finestra,
// el títol i l'organitzador per a la llista negra.
//
// `nom_altra_llengua` es queda buit perquè la fila del flux només porta el
// títol en francès; la banda catalana l'omple el curador.
// ------------------------------------------------------------
function registreDeFila(fila) {
  return {
    nom_original: fila.titol,
    nom_altra_llengua: '',
    organitzador: fila.associacio,
    data_inici: fila.data_inici,
    data_fi: fila.data_fi
  };
}

// ------------------------------------------------------------
// Les files nues dels candidats que han passat el filtre. filtraCandidats()
// torna els candidats tal com els hi hem donat, embolcall inclòs; a la cua
// només hi va la fila.
// ------------------------------------------------------------
function filesDeCandidats(candidats) {
  var files = [];

  for (var i = 0; i < candidats.length; i++) {
    files.push(candidats[i].fila);
  }

  return files;
}

// ------------------------------------------------------------
// El recompte de motius de descart, per ensenyar-lo al registre sense abocar-hi
// mil línies. Torna [{ motiu, quantes }, ...], de més a menys.
// ------------------------------------------------------------
function motiusDeDescart(descartats) {
  var comptes = {};

  for (var i = 0; i < descartats.length; i++) {
    var motiu = descartats[i].motiu;
    comptes[motiu] = (comptes[motiu] || 0) + 1;
  }

  var llista = [];
  var noms = Object.keys(comptes);
  for (var j = 0; j < noms.length; j++) {
    llista.push({ motiu: noms[j], quantes: comptes[noms[j]] });
  }

  llista.sort(function (a, b) { return b.quantes - a.quantes; });
  return llista;
}


// --- Les peces: el límit de mà `--limit=N` ----------------------------------
// La constant que hi havia darrere d'aquesta secció ja no hi és; l'interruptor
// sí. Vegeu el §«El límit de mà» de dalt del fitxer per al perquè.

// ------------------------------------------------------------
// Retalla la llista de files noves al límit donat. Ordena per `data_inici`
// ascendent i es queda les primeres: les més imminents són les que aporten
// valor si el digest s'engega aquesta setmana.
//
// Torna { files, retallades }. `retallades` no és cap descart del filtre: són
// files bones que el flux tornarà a oferir i que entraran a la propera passada.
// Amb `limit` a 0 o negatiu no retalla res, que és com es treu el límit.
// ------------------------------------------------------------
function aplicaLimit(files, limit) {
  if (limit <= 0 || files.length <= limit) {
    return { files: files, retallades: 0 };
  }

  // Còpia abans d'ordenar: la llista que arriba és la que ha construït el
  // filtre previ i no és d'aquesta funció per capgirar-la.
  var ordenades = files.slice();
  ordenades.sort(comparaPerDataInici);

  return { files: ordenades.slice(0, limit), retallades: ordenades.length - limit };
}

// ------------------------------------------------------------
// Compara dues files per `data_inici` ascendent. Una data buida o mal formada
// va sempre al final: quan el criteri és la imminència, una fila de la qual no
// se sap quan passa no pot anar davant de cap que sí que se sàpiga.
// ------------------------------------------------------------
function comparaPerDataInici(a, b) {
  var dataA = esData(a.data_inici) ? a.data_inici : DATA_AL_FINAL;
  var dataB = esData(b.data_inici) ? b.data_inici : DATA_AL_FINAL;

  if (dataA < dataB) {
    return -1;
  }

  if (dataA > dataB) {
    return 1;
  }

  return 0;
}


// --- Les peces: la traducció a la ingestió (pas 7 bis) ----------------------
// L'ÚNICA secció del fitxer que crida un model. Escriu tres camps de la fila
// —`titol`, `descripcio_ca` i `descripcio_fr`— i un avís a `nota_curador`. No
// en toca cap altre: ni l'`id`, ni l'estat, ni les dates, ni la categoria.
//
// L'`ID` NO ES RECONSTRUEIX, i no és cap descuit. El títol canvia de francès a
// català després que mapejaOfertaADT66() ja hagi fet l'`id`, o sigui que la
// fila entra a la cua amb un tros de títol francès al slug. Tant se val:
// recullFitxa() de curador.html el torna a fer amb el títol editat en publicar,
// i reconstruir-lo aquí voldria dir una quinzena còpia literal de creaId() —que
// no s'exporta enlloc— per no guanyar res.
//
// ELS DOS CASOS DEL BÀNER DE DALT ES VEUEN A LA VISTA, i estan repartits entre
// dues funcions a posta: el PRESSUPOST decideix si es fa la crida, i una fila
// sense crida no s'escriu (tradueixLot()); el RESULTAT de la crida decideix què
// s'escriu, i una crida fallida s'encua igualment (aplicaTraduccio()).

// ------------------------------------------------------------
// Tradueix el lot. Torna { files, informe }.
//
// `files` són les files que s'han d'escriure: totes les que han arribat a tenir
// crida, tant si ha anat bé com si no. Les que s'han quedat sense pressupost NO
// hi són, i tornaran soles la propera passada.
//
// ES TRADUEIX PER ORDRE D'IMMINÈNCIA, no per l'ordre del flux. El que es queda
// fora del pressupost ha de ser el que passa més tard, que encara serà dins la
// finestra de 30 dies la propera vegada; sense aquest ordre, una fila de demà
// podria esperar-se una setmana mentre se'n tradueix una de dins de tres.
//
// `informe` és:
//
//   feta         cert si s'ha traduït (fals si no hi havia amb què cridar)
//   motiu        per què no s'ha fet, quan `feta` és fals
//   pressupost   les crides que tenia la passada
//   crides       les que ha gastat de debò, reintents inclosos
//   traduides    files amb títol i les dues descripcions escrites pel model
//   nomesTitol   files sense text de font: només el títol, cap descripció
//   fallades     files encuades en francès perquè LA CRIDA HA PETAT
//   senseMateria files encuades en francès perquè EL MODEL HO HA DECLINAT: ha
//                respost bé i ha dit que no hi havia prou matèria per escriure
//                dues frases honestes
//   motiusDeFallada  [{ motiu, quantes }, ...] per què han petat les crides
//   retalladesPerPressupost  files que no s'escriuen perquè no han tingut
//                crida. NO són cap descart: tornen a la propera passada
//
// PER QUÈ `fallades` I `senseMateria` VAN SEPARADES. La fila acaba igual —sense
// text català i amb el mateix avís—, però la causa no té res a veure i el que
// se n'ha de fer, tampoc. Un `senseMateria` alt vol dir que el flux porta
// ofertes primes i que el curador hi haurà de escriure a mà: és una dada sobre
// la font. Un `fallades` alt vol dir que alguna cosa NOSTRA no funciona —la
// clau, el nom del model, la quota, la mida de la resposta— i s'ha d'arreglar
// avui. Barrejar-les feia invisible la segona, que és l'única de les dues que
// és un error.
// ------------------------------------------------------------
async function tradueixLot(files, config) {
  var llista = Array.isArray(files) ? files : [];
  var informe = {
    feta: config.cridaGemini !== null,
    motiu: config.motiuSenseTraduccio,
    pressupost: config.pressupost,
    crides: 0,
    traduides: 0,
    nomesTitol: 0,
    fallades: 0,
    senseMateria: 0,
    motiusDeFallada: {},
    retalladesPerPressupost: 0
  };

  // Sense crida no es tradueix res i les files surten tal com han entrat. No és
  // cap error: en sec és el que ha de passar.
  if (config.cridaGemini === null) {
    return { files: llista, informe: informe };
  }

  // Còpia abans d'ordenar: la llista que arriba l'ha construïda el filtre previ
  // i no és d'aquesta funció per capgirar-la.
  var ordenades = llista.slice();
  ordenades.sort(comparaPerDataInici);

  var escrites = [];

  for (var i = 0; i < ordenades.length; i++) {
    // El pressupost es mira ABANS de la crida. Una fila que no arriba a tenir
    // crida no s'escriu: és l'únic cas de tot el fitxer en què una fila bona es
    // queda fora, i el flux la tornarà a oferir.
    if (informe.crides >= config.pressupost) {
      informe.retalladesPerPressupost++;
      continue;
    }

    var sortida = await tradueixUnaFila(ordenades[i], config, informe);
    aplicaTraduccio(ordenades[i], sortida, informe);
    escrites.push(ordenades[i]);
  }

  informe.motiusDeFallada = motiusOrdenats(informe.motiusDeFallada);
  return { files: escrites, informe: informe };
}

// ------------------------------------------------------------
// Els motius de fallada comptats i ordenats de més a menys, per ensenyar-los al
// registre sense repetir el mateix error tres-centes vegades. Torna
// [{ motiu, quantes }, ...].
// ------------------------------------------------------------
function motiusOrdenats(comptes) {
  var llista = [];
  var noms = Object.keys(comptes);

  for (var i = 0; i < noms.length; i++) {
    llista.push({ motiu: noms[i], quantes: comptes[noms[i]] });
  }

  llista.sort(function (a, b) { return b.quantes - a.quantes; });
  return llista;
}

// ------------------------------------------------------------
// Fa la crida d'una fila i torna { ok, camps, motiu }:
//
//   ok      cert si el model ha respost amb un objecte llegible
//   camps   l'objecte tal com l'ha dit el model, sense mirar-ne cap camp
//   motiu   el missatge de l'últim error, quan `ok` és fals
//
// NO LLANÇA MAI. Una crida que peta és una fila amb avís, no un run aturat.
//
// CADA INTENT GASTA PRESSUPOST, també el reintent: el pressupost compta crides
// a Gemini, no files. Si el reintent no hi cap, no es fa i la fila surt amb el
// motiu del primer error.
// ------------------------------------------------------------
async function tradueixUnaFila(fila, config, informe) {
  var motiu = 'pressupost exhaurit abans del primer intent';

  for (var intent = 0; intent < INTENTS_PER_FILA; intent++) {
    if (informe.crides >= config.pressupost) {
      return { ok: false, camps: null, motiu: motiu };
    }

    // La pausa va ENTRE crides: abans de la primera de la passada no hi ha res
    // a espaiar.
    if (informe.crides > 0) {
      await espera(config.pausaMs);
    }

    informe.crides++;

    try {
      var camps = await config.cridaGemini(fila);
      return { ok: true, camps: camps, motiu: '' };
    } catch (error) {
      motiu = error.message;
    }
  }

  return { ok: false, camps: null, motiu: motiu };
}

// ------------------------------------------------------------
// Escriu a la fila el que hagi tornat la crida i li enganxa l'avís que li toca.
// TRES ESTATS DE FILA, excloents, i cada un amb el seu avís:
//
//   traduïda      el model ha tornat les dues descripcions plenes: s'escriuen
//                 el títol i totes dues
//   només títol   l'oferta arriba sense `descripcio_fr`: s'escriu el títol i
//                 les descripcions es queden buides. NO es fa servir cap
//                 descripció que el model hagi tornat en aquest cas —seria
//                 inventada, perquè no hi havia text d'on treure-la
//   no traduïda   la fila es queda EXACTAMENT com arriba del flux, títol
//                 francès i text francès inclosos
//
// L'ÚLTIM ESTAT TÉ DUES CAUSES I ES COMPTEN A PART, tot i compartir l'avís: la
// crida ha petat (`fallades`, amb el motiu) o el model ho ha declinat perquè no
// hi havia prou matèria (`senseMateria`). Vegeu el §«Per què van separades» de
// tradueixLot().
//
// LES DUES DESCRIPCIONS VAN JUNTES O NO VAN. Si el model només torna una de les
// dues, no s'escriu cap: `descripcio_fr` ha de ser la traducció de la
// `descripcio_ca` que hi ha al costat, i mitja parella no ho és.
//
// L'AVÍS DE «TRADUÏDA» NOMENA ELS TRES CAMPS encara que el model no hagi tornat
// títol i el francès s'hi hagi quedat. No és cap imprecisió: l'avís diu al
// curador quins tres camps ha de comprovar, i en aquest cas també els ha de
// comprovar tots tres.
//
// Modifica la fila que rep i no en fa cap còpia: la fila d'aquest punt del camí
// l'ha construïda mapejaOfertaADT66() per a aquesta passada i no és de ningú
// més.
// ------------------------------------------------------------
function aplicaTraduccio(fila, sortida, informe) {
  if (!sortida.ok) {
    informe.fallades++;
    comptaMotiuDeFallada(informe, sortida.motiu);
    posaAvisDeTraduccio(fila, AVIS_NO_TRADUIT);
    return;
  }

  var camps = sortida.camps || {};
  var titol = cadenaDeModel(camps.titol);
  var descCa = cadenaDeModel(camps.descripcio_ca);
  var descFr = cadenaDeModel(camps.descripcio_fr);

  // L'oferta no porta text descriptiu: només el títol es pot passar al català.
  if (fila.descripcio_fr === '') {
    if (titol === '') {
      informe.senseMateria++;
      posaAvisDeTraduccio(fila, AVIS_NO_TRADUIT);
      return;
    }

    fila.titol = titol;
    informe.nomesTitol++;
    posaAvisDeTraduccio(fila, AVIS_NOMES_TITOL);
    return;
  }

  // Hi havia text i el model no n'ha tret cap descripció completa: ha fet cas
  // de la regla de no inventar. La fila es queda crua, títol inclòs, perquè
  // l'avís diu justament que hi és tot en francès.
  if (descCa === '' || descFr === '') {
    informe.senseMateria++;
    posaAvisDeTraduccio(fila, AVIS_NO_TRADUIT);
    return;
  }

  if (titol !== '') {
    fila.titol = titol;
  }
  fila.descripcio_ca = descCa;
  fila.descripcio_fr = descFr;
  informe.traduides++;
  posaAvisDeTraduccio(fila, AVIS_TRADUIT);
}

// ------------------------------------------------------------
// Suma una unitat al motiu d'aquesta fallada. El motiu es retalla abans de
// comptar-lo, perquè un error de Gemini porta el cos sencer de la resposta a
// dins i dues fallades iguals no s'agruparien mai si es comptessin senceres.
// ------------------------------------------------------------
function comptaMotiuDeFallada(informe, motiu) {
  var text = String(motiu).slice(0, MAX_MOTIU_FALLADA);
  informe.motiusDeFallada[text] = (informe.motiusDeFallada[text] || 0) + 1;
}

// ------------------------------------------------------------
// Enganxa l'avís a `nota_curador` amb la regla compartida d'ajuntar notes, mai
// amb una concatenació a mà: l'avís va DARRERE del que ja hi hagi, que és
// sempre el tag [ADT66 id: …] del mapeig i, si n'hi ha, l'avís del rescat de la
// visita comentada.
// ------------------------------------------------------------
function posaAvisDeTraduccio(fila, avis) {
  fila.nota_curador = dedup.ajuntaNotes(fila.nota_curador, avis);
}

// ------------------------------------------------------------
// El valor d'un camp tal com l'ha dit el model, reduït a cadena utilitzable.
// Tot el que no sigui una cadena —un nombre, un null, una clau que no hi és—
// val ''. §4 de CLAUDE.md: tot camp és una cadena i el desconegut és ''.
// ------------------------------------------------------------
function cadenaDeModel(valor) {
  if (typeof valor !== 'string') {
    return '';
  }

  return valor.trim();
}

// ------------------------------------------------------------
// Espera els mil·lisegons que se li diguin. Amb 0 o menys no espera gens, que
// és com les proves treuen el ritme i corren de seguida.
// ------------------------------------------------------------
function espera(ms) {
  if (!(ms > 0)) {
    return Promise.resolve();
  }

  return new Promise(function (resol) { setTimeout(resol, ms); });
}


// --- Les peces: la crida a Gemini -------------------------------------------
// El mateix patró que worker/worker.js, i a posta: la clau només a la capçalera
// `x-goog-api-key` —mai a l'URL, mai al registre—, JSON garantit per
// `responseMimeType`, i la resposta tallada del primer «{» a l'últim «}» abans
// de parsejar-la.

// ------------------------------------------------------------
// Demana a Gemini el títol i les dues descripcions d'una fila, i torna
// l'objecte que hagi respost el model. NO en mira cap camp: qui decideix què
// se n'escriu és aplicaTraduccio().
//
// Llança si la crida falla o si la resposta no és un objecte JSON llegible.
// Llançar és el que toca: qui la crida és tradueixUnaFila(), que ho recull i
// encua la fila amb l'avís.
// ------------------------------------------------------------
async function demanaTraduccioGemini(fila, clau) {
  // El municipi i la comarca hi van com a CONTEXT, no com a camps que hagi
  // d'escriure: el prompt li diu que la forma bona del nom del poble és la
  // d'aquest camp i no la del text original, que ve en francès. Vegeu la regla
  // dels noms propis a PROMPT_TRADUCCIO.
  var fitxa = 'MUNICIPI: ' + fila.municipi +
    '\nCOMARCA: ' + fila.comarca +
    '\nTÍTOL: ' + fila.titol +
    '\nTEXT: ' + fila.descripcio_fr;

  var cos = {
    contents: [
      { parts: [ { text: PROMPT_TRADUCCIO + '\n' + fitxa } ] }
    ],
    generationConfig: CONFIGURACIO_GEMINI
  };

  var resposta = await fetch(GEMINI_URL_TRADUCCIO, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': clau
    },
    body: JSON.stringify(cos)
  });

  if (!resposta.ok) {
    var detall = await resposta.text();
    throw new Error('Gemini ha respost amb codi ' + resposta.status + '. ' + detall);
  }

  var dades = await resposta.json();
  return analitzaJsonDeGemini(textDeGemini(dades));
}

// ------------------------------------------------------------
// Treu el text de resposta de dins l'objecte que torna Gemini. Llança un error
// clar si ve buida, bloquejada o tallada.
// ------------------------------------------------------------
function textDeGemini(dades) {
  if (!dades.candidates || dades.candidates.length === 0) {
    throw new Error('Gemini no ha tornat cap resposta (potser bloquejada).');
  }

  var candidat = dades.candidates[0];

  if (candidat.finishReason === 'MAX_TOKENS') {
    throw new Error('la resposta de Gemini s\'ha tallat (MAX_TOKENS): apuja GEMINI_MAX_TOKENS.');
  }

  if (!candidat.content || !candidat.content.parts || candidat.content.parts.length === 0) {
    throw new Error('la resposta de Gemini no conté text (finishReason: ' + candidat.finishReason + ').');
  }

  return candidat.content.parts[0].text;
}

// ------------------------------------------------------------
// Converteix el text del model en objecte. Se li demana JSON i prou, però per
// si de cas es talla del primer «{» a l'últim «}» abans de parsejar. Llança si
// no hi ha objecte JSON.
// ------------------------------------------------------------
function analitzaJsonDeGemini(text) {
  var inici = text.indexOf('{');
  var fi = text.lastIndexOf('}');

  if (inici === -1 || fi === -1 || fi < inici) {
    throw new Error('la resposta del model no conté cap objecte JSON.');
  }

  var objecte = JSON.parse(text.substring(inici, fi + 1));

  if (typeof objecte !== 'object' || objecte === null || Array.isArray(objecte)) {
    throw new Error('la resposta del model no és un objecte JSON.');
  }

  return objecte;
}


// --- Les peces: la poda -----------------------------------------------------

// ------------------------------------------------------------
// Treu de la cua les files rebutjades que ja han passat. Les dues condicions
// són explícites i totes dues han de ser certes:
//
//   estat === 'rebutjat'   mai un `!== 'pendent'`: una fila amb un estat nou o
//                          inesperat s'ha de poder veure, no desaparèixer
//   data_fi < avui         i `data_fi` ha de ser una data de debò: la fila
//                          rebutjada sense data no es pot dir que hagi passat,
//                          i es queda
//
// Torna { cua, podades } amb les files senceres, mai només els comptes: el
// registre del run n'ha de poder dir els títols.
// ------------------------------------------------------------
function podaRebutjatsCaducats(files, avui) {
  var llista = Array.isArray(files) ? files : [];
  var cua = [];
  var podades = [];

  for (var i = 0; i < llista.length; i++) {
    var fila = llista[i];

    if (fila.estat === 'rebutjat' && esData(fila.data_fi) && fila.data_fi < avui) {
      podades.push(fila);
    } else {
      cua.push(fila);
    }
  }

  return { cua: cua, podades: podades };
}

// ------------------------------------------------------------
// Diu si un valor té la forma AAAA-MM-DD. No comprova que el dia existeixi:
// aquí només cal saber si es pot comparar com a data.
// ------------------------------------------------------------
function esData(valor) {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);
}


// --- Les peces: GitHub ------------------------------------------------------
// El mateix patró que worker/worker.js, i a posta: GET per obtenir contingut i
// sha, un sol PUT amb base64 i JSON.stringify(dades, null, 2), i un reintent
// quan el sha ha canviat perquè algú altre —el Worker, o el curador— ha escrit
// al mateix moment.

// ------------------------------------------------------------
// La configuració sencera d'una passada, amb tot allò que hi falti resolt un
// sol cop: així cap peça de sota no ha de mirar mai `process.env`.
// ------------------------------------------------------------
function configuracio(opcions) {
  var donades = opcions || {};
  var enSec = donades.enSec === true;
  var traduccio = decideixCrida(donades, enSec);

  return {
    enSec: enSec,
    token: donades.token || '',
    repositori: donades.repositori || REPOSITORI_PER_OMISSIO,
    avui: esData(donades.avui) ? donades.avui : new Date().toISOString().slice(0, 10),
    // Per omissió no es retalla cap candidata: el sostre d'una passada el posa
    // el pressupost de crides, no aquest nombre. El 0 hi val i vol dir «cap
    // límit», i per això només un nombre de debò el sobreescriu.
    limit: esNombre(donades.limit) ? donades.limit : 0,
    pressupost: esNombre(donades.pressupost) ? donades.pressupost : PRESSUPOST_CRIDES_GEMINI,
    pausaMs: esNombre(donades.pausaMs) ? donades.pausaMs : PAUSA_ENTRE_CRIDES_MS,
    cridaGemini: traduccio.crida,
    motiuSenseTraduccio: traduccio.motiu
  };
}

// ------------------------------------------------------------
// Decideix amb què es tradueix aquesta passada, o amb res. Torna
// { crida, motiu }: `crida` a null vol dir que el pas 7 bis no es fa, i `motiu`
// diu per què, per poder-ho escriure al registre del run.
//
// TRES CAMINS, i l'ordre importa:
//
//   1. Una crida injectada mana sempre. És així com es prova el pas sencer
//      sense clau i sense xarxa, en sec inclòs.
//   2. En sec no es gasta quota de debò, si no es demana expressament. Una
//      passada que no escriu res no ha de pagar tres-centes crides a un servei
//      amb quota compartida amb el Worker, i el `.yml` fa les execucions
//      manuals en sec per omissió. L'excepció és `ambGemini`
//      (`--amb-gemini`), que és com es jutja el prompt: crides de debò i cap
//      escriptura. Va amb pressupost petit, sempre.
//   3. Sense clau no hi ha traducció, i la passada NO s'atura: les files
//      s'encuen en francès, com abans que el pas 7 bis existís. Però el motiu
//      ho diu amb un ATENCIÓ, perquè això és una configuració incompleta i no
//      una decisió: el secret GEMINI_API_KEY no s'hi ha posat.
// ------------------------------------------------------------
function decideixCrida(donades, enSec) {
  if (typeof donades.cridaGemini === 'function') {
    return { crida: donades.cridaGemini, motiu: '' };
  }

  if (enSec && donades.ambGemini !== true) {
    return { crida: null, motiu: 'en sec: no es gasta quota de Gemini' };
  }

  var clau = donades.clauGemini || '';

  if (clau === '') {
    return {
      crida: null,
      motiu: 'ATENCIÓ: falta el secret GEMINI_API_KEY. Les files s\'encuen en francès.'
    };
  }

  // La clau es queda tancada aquí dins i no viatja enlloc més: tradueixLot()
  // rep una funció, no un secret.
  return {
    crida: function (fila) { return demanaTraduccioGemini(fila, clau); },
    motiu: ''
  };
}

// ------------------------------------------------------------
// Diu si un valor és un nombre utilitzable.
// ------------------------------------------------------------
function esNombre(valor) {
  return typeof valor === 'number' && isFinite(valor);
}

// ------------------------------------------------------------
// Llegeix un dels dos fitxers JSON. Amb token, per l'API de continguts; sense,
// del disc de treball. Torna { dades, sha }, amb el sha a '' quan ve del disc:
// sense sha no es pot escriure, i és justament el que ha de passar.
// ------------------------------------------------------------
async function llegeixFitxer(nomFitxer, config) {
  if (config.token === '') {
    var text = fs.readFileSync(nomFitxer, 'utf8');
    return { dades: JSON.parse(text), sha: '' };
  }

  var url = 'https://api.github.com/repos/' + config.repositori +
    '/contents/' + nomFitxer + '?ref=' + BRANCA;

  var resposta = await fetch(url, { method: 'GET', headers: capcaleresGitHub(config.token) });

  if (!resposta.ok) {
    var detall = await resposta.text();
    throw new Error('no he pogut llegir ' + nomFitxer + ' (codi ' + resposta.status + '). ' + detall);
  }

  var fitxer = await resposta.json();
  return {
    dades: JSON.parse(Buffer.from(fitxer.content, 'base64').toString('utf8')),
    sha: fitxer.sha
  };
}

// ------------------------------------------------------------
// Escriu la cua sencera a pendents.json: les files noves al davant —el curador
// vol veure primer el que acaba d'arribar— i darrere la cua d'ara ja podada.
//
// Torna a llegir el fitxer just abans d'escriure, perquè entre la classificació
// i ara hi ha hagut una descàrrega sencera del flux i el fitxer s'ha pogut
// moure; la poda es torna a aplicar sobre el que hi ha de debò. Si el PUT xoca
// per sha, ho torna a provar un sol cop.
//
// `quantesPodades` serveix només per al missatge del commit, que és l'única
// traça permanent de què va fer cada passada.
//
// Torna quants REINTENTS ha calgut: 0 si el PUT ha entrat de primera, 1 si el
// sha havia canviat i s'ha hagut de tornar a llegir. El registre del run ho ha
// de poder dir —si no, no hi ha manera de saber si aquell camí s'ha exercitat.
// ------------------------------------------------------------
async function escriuCua(novesFiles, quantesPodades, config) {
  if (config.token === '') {
    throw new Error('falta GITHUB_TOKEN: sense token no es pot escriure a ' + FITXER_PENDENTS + '.');
  }

  var missatge = 'Sincronització ADT66: ' + novesFiles.length + ' files noves, ' +
    quantesPodades + ' rebutjades caducades podades';

  var intents = 0;
  while (intents < 2) {
    var actual = await llegeixFitxer(FITXER_PENDENTS, config);
    var podat = podaRebutjatsCaducats(actual.dades, config.avui);

    try {
      await posaFitxer(novesFiles.concat(podat.cua), actual.sha, missatge, config);
      return intents;
    } catch (error) {
      intents++;
      var esConflicte = error.message.indexOf('codi 409') !== -1 ||
        error.message.indexOf('codi 422') !== -1;
      if (!esConflicte || intents >= 2) {
        throw error;
      }
    }
  }
}

// ------------------------------------------------------------
// El PUT sol. No torna res i llança un error amb el codi a dins, que és el que
// llegeix el reintent d'escriuCua().
// ------------------------------------------------------------
async function posaFitxer(dades, sha, missatge, config) {
  var url = 'https://api.github.com/repos/' + config.repositori + '/contents/' + FITXER_PENDENTS;

  var cos = {
    message: missatge,
    content: Buffer.from(JSON.stringify(dades, null, 2) + '\n', 'utf8').toString('base64'),
    sha: sha,
    branch: BRANCA
  };

  var resposta = await fetch(url, {
    method: 'PUT',
    headers: capcaleresGitHub(config.token),
    body: JSON.stringify(cos)
  });

  if (!resposta.ok) {
    var detall = await resposta.text();
    throw new Error('GitHub ha rebutjat l\'escriptura de ' + FITXER_PENDENTS +
      ' (codi ' + resposta.status + '). ' + detall);
  }
}

// ------------------------------------------------------------
// Les capçaleres de cada crida a l'API de GitHub. El User-Agent hi és perquè
// l'API el demana sempre: sense ell respon 403.
// ------------------------------------------------------------
function capcaleresGitHub(token) {
  return {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'quefas-sincronitza-programada',
    'Authorization': 'Bearer ' + token
  };
}


// --- El que surt d'aquest fitxer --------------------------------------------

module.exports = {
  sincronitzaProgramada: sincronitzaProgramada,
  apartaVisitesGuiades: apartaVisitesGuiades,
  dedupDinsDelLot: dedupDinsDelLot,
  aplicaLimit: aplicaLimit,
  tradueixLot: tradueixLot,
  podaRebutjatsCaducats: podaRebutjatsCaducats
};


// --- Ús des del terminal ----------------------------------------------------
// Tot el que ve a partir d'aquí és l'informe del registre del run. Res en
// silenci: cada xifra que surt d'aquí és comptable contra el total.

// ------------------------------------------------------------
// Escriu l'informe sencer al terminal.
// ------------------------------------------------------------
function informe(resultat, enSec) {
  console.log('');
  console.log('--- SINCRONITZACIÓ ADT66 ' + (enSec ? '(EN SEC: no s\'escriu res)' : '') + ' ---');
  console.log('');
  console.log('  ofertes rebudes del flux     ' + resultat.ofertes);
  console.log('');
  console.log('  visita comentada (R4):');
  console.log('    descartades                ' + resultat.visitesDescartades.length);
  console.log('    rescatades                 ' + resultat.visitesRescatades.length);
  var motius = comptaMotius(resultat.visitesRescatades);
  for (var m = 0; m < motius.length; m++) {
    console.log('      per ' + motius[m].motiu + ': ' + motius[m].quantes);
  }
  console.log('');
  console.log('  duplicats dins del mateix lot' + ' ' + resultat.fusionades);
  console.log('  lot després de fusionar-los  ' +
    (resultat.ofertes - resultat.visitesDescartades.length - resultat.fusionades));
  console.log('');
  console.log('  classificació contra els dos fitxers:');
  console.log('    ja publicades              ' + resultat.recompte.ja_publicat);
  console.log('    ja a la cua                ' + resultat.recompte.ja_a_la_cua);
  console.log('    ja rebutjades              ' + resultat.recompte.ja_rebutjat);
  console.log('    noves                      ' + resultat.recompte.nova);
  console.log('    total classificat          ' + resultat.recompte.total);
  console.log('');
  console.log('  filtre previ sobre les noves:');
  for (var i = 0; i < resultat.descartats.length; i++) {
    console.log('    descartades, ' + resultat.descartats[i].motiu +
      ': ' + resultat.descartats[i].quantes);
  }
  if (resultat.descartats.length === 0) {
    console.log('    cap descartada');
  }
  console.log('');
  console.log('  candidates després del filtre' + ' ' + resultat.candidates);
  if (resultat.limit > 0) {
    console.log('  límit --limit aplicat        ' + resultat.limit);
    console.log('    retallades pel límit       ' + resultat.retalladesPerLimit +
      '   (no descartades: tornaran a la propera passada)');
  }
  console.log('');
  informeDeTraduccio(resultat.traducio);
  console.log('');
  console.log('  files noves a la cua         ' + resultat.noves.length);
  console.log('  rebutjades caducades podades ' + resultat.podades.length);
  for (var j = 0; j < resultat.podades.length; j++) {
    console.log('    - ' + resultat.podades[j].data_fi + '  ' + resultat.podades[j].titol);
  }
  console.log('');
  console.log('  escrit a pendents.json       ' + (resultat.escrit ? 'sí' : 'no'));
  console.log('  reintents per conflicte sha  ' + resultat.reintents);
  console.log('');
}

// ------------------------------------------------------------
// El bloc del pas 7 bis al registre del run. Cada xifra és comptable contra les
// candidates: traduïdes + només títol + fallades + retallades pel pressupost.
// ------------------------------------------------------------
function informeDeTraduccio(traducio) {
  console.log('  traducció a la ingestió (pas 7 bis):');

  if (!traducio.feta) {
    console.log('    NO S\'HA FET — ' + traducio.motiu);
    console.log('    files encuades en francès, sense avís de traducció');
    return;
  }

  console.log('    pressupost de crides       ' + traducio.pressupost);
  console.log('    crides consumides          ' + traducio.crides +
    '   (reintents inclosos)');
  console.log('    traduïdes                  ' + traducio.traduides);
  console.log('    només el títol             ' + traducio.nomesTitol +
    '   (sense text de font: cap descripció inventada)');
  console.log('    declinades pel model       ' + traducio.senseMateria +
    '   (ha respost que no hi ha prou matèria: entren en francès)');
  console.log('    CRIDES QUE HAN PETAT       ' + traducio.fallades +
    '   (entren en francès, amb avís al curador)');

  // El motiu, sempre que n'hi hagi cap. Sense això una fallada és un número i
  // no es pot arreglar res.
  for (var i = 0; i < traducio.motiusDeFallada.length; i++) {
    console.log('      x' + traducio.motiusDeFallada[i].quantes + '  ' +
      traducio.motiusDeFallada[i].motiu);
  }

  console.log('    retallades pel pressupost  ' + traducio.retalladesPerPressupost +
    '   (no descartades: tornaran a la propera passada)');
}

// ------------------------------------------------------------
// Els motius de rescat comptats, per ensenyar-los sense abocar cap títol al
// registre. Torna [{ motiu, quantes }, ...].
// ------------------------------------------------------------
function comptaMotius(rescatades) {
  var comptes = {};

  for (var i = 0; i < rescatades.length; i++) {
    var motiu = rescatades[i].motiu;
    comptes[motiu] = (comptes[motiu] || 0) + 1;
  }

  var llista = [];
  var noms = Object.keys(comptes);
  for (var j = 0; j < noms.length; j++) {
    llista.push({ motiu: noms[j], quantes: comptes[noms[j]] });
  }

  llista.sort(function (a, b) { return b.quantes - a.quantes; });
  return llista;
}

// ------------------------------------------------------------
// Escriu al terminal els tres camps que ha tocat la traducció, fila per fila.
// Serveix per a una cosa i prou: jutjar el que escriu el model amb
// `--en-sec --amb-gemini --fitxes` i un pressupost petit. No surt mai per
// omissió —amb 300 files ompliria el registre del run de dalt a baix.
// ------------------------------------------------------------
function escriuFitxes(files) {
  console.log('--- LES FITXES, CAMP PER CAMP ---');
  console.log('');

  for (var i = 0; i < files.length; i++) {
    var fila = files[i];
    console.log((i + 1) + '. ' + fila.data_inici + '  ' + fila.municipi +
      '  [' + fila.categoria + ']');
    console.log('   titol:         ' + fila.titol);
    console.log('   descripcio_ca: ' + fila.descripcio_ca);
    console.log('   descripcio_fr: ' + fila.descripcio_fr);
    console.log('   nota_curador:  ' + fila.nota_curador);
    console.log('');
  }
}

// ------------------------------------------------------------
// El valor d'un interruptor `--nom=N` de la línia d'ordres, o null si no s'hi
// ha posat. Serveix per a `--limit=` i per a `--pressupost=`, que són els dos.
// Un valor que no sigui un nombre es tracta com si l'interruptor no hi fos:
// val més fer la passada amb el valor per omissió que endevinar-lo.
// ------------------------------------------------------------
function nombreDeLaLiniaDOrdres(argv, prefix) {
  for (var i = 0; i < argv.length; i++) {
    if (argv[i].indexOf(prefix) === 0) {
      var valor = parseInt(argv[i].slice(prefix.length), 10);
      if (isNaN(valor)) {
        return null;
      }
      return valor;
    }
  }

  return null;
}

// ------------------------------------------------------------
// El punt d'entrada del terminal i del workflow.
// ------------------------------------------------------------
async function principal() {
  var enSec = process.argv.indexOf('--en-sec') !== -1;

  var opcions = {
    enSec: enSec,
    ambGemini: process.argv.indexOf('--amb-gemini') !== -1,
    token: process.env.GITHUB_TOKEN || '',
    clauGemini: process.env.GEMINI_API_KEY || '',
    repositori: process.env.GITHUB_REPOSITORY || ''
  };

  // Els dos interruptors: només s'hi posa la clau si l'interruptor hi és, i
  // així configuracio() pot distingir «no s'ha dit res» de «--limit=0».
  var limit = nombreDeLaLiniaDOrdres(process.argv, '--limit=');
  if (limit !== null) {
    opcions.limit = limit;
  }

  var pressupost = nombreDeLaLiniaDOrdres(process.argv, '--pressupost=');
  if (pressupost !== null) {
    opcions.pressupost = pressupost;
  }

  try {
    var resultat = await sincronitzaProgramada(opcions);
    informe(resultat, enSec);
    if (process.argv.indexOf('--fitxes') !== -1) {
      escriuFitxes(resultat.noves);
    }
  } catch (error) {
    console.error('Ha fallat: ' + error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  principal();
}
