// ============================================================
// WORKER — «Què fas?» · l'únic servidor del projecte
//
// Té dues portes d'entrada, i totes dues acaben al mateix lloc: una
// fila pendent a `pendents.json`, que el curador revisa.
//   `email()`  (Fase 2)  — un correu a agenda@clm.cat. L'original
//                          SEMPRE acaba arxivat al Gmail.
//   `fetch()`  (Fase 3a) — el POST del webhook del formulari
//                          Typebot, amb secret compartit.
//   `scheduled()` (Fase 3b) — el digest setmanal de Brevo. És
//                          l'única porta que no escriu res enlloc:
//                          llegeix `events.json` i envia correu.
//
// EL CAMÍ D'UN CORREU, en ordre:
//   1. reenviament a l'arxiu  ← el primer de tot, i passi el que passi
//   2. postal-mime            → assumpte + cos de text + adjunts
//   3. Gemini                 → els 11 camps que el model pot deduir
//   4. Cloudinary             → el primer cartell adjunt (opcional)
//   5. pendents.json          → una fila de 16 cadenes, estat "pendent"
//
// EL CAMÍ D'UNA TRAMESA DEL FORMULARI, en ordre:
//   1. el secret de la capçalera  ← el primer de tot; si no, 403
//   2. només POST                 → qualsevol altre mètode, 405
//   3. mapa determinista          → camp a camp, CAP crida a Gemini:
//                                   el formulari ja dona els camps
//                                   separats, i el cartell ja ha
//                                   pujat a Cloudinary des del
//                                   navegador de qui l'envia
//   4. pendents.json              → la mateixa fila de 16 cadenes
//
// LA INVARIANT: cap correu no es perd mai. El reenviament a l'arxiu
// es fa ABANS de qualsevol altra cosa i no llança mai. Tot el que ve
// després pot fallar tant com vulgui: l'original ja és a l'arxiu i
// l'error queda al registre. I si no hi ha on arxivar-lo —falta la
// variable ADRECA_ARXIU—, el correu es REBUTJA: el remitent rep un
// avís de no-entrega i el pot tornar a enviar. Empassar-se un correu
// en silenci és l'única cosa que no ens podem permetre.
// Res no arriba mai al web públic sense passar pel curador.
//
// EL CAMÍ DEL DIGEST, en ordre:
//   1. la porta de l'hora     ← el cron de Cloudflare és en UTC i no
//                               sap res de l'horari d'estiu: el
//                               Worker es desperta cada deu minuts
//                               entre les 13.00 i les 14.59 UTC dels
//                               dimarts, i només treballa quan a
//                               París són les 15
//   2. events.json            → per l'API de GitHub, mai de Pages
//   3. la finestra            → els actes «publicat» que comencen
//                               d'avui a d'aquí a set dies, comarca
//                               per comarca
//   4. el registre de Brevo   → a qui ja s'ha enviat el digest d'avui
//   5. un correu per persona  → transaccional, mai cap campanya
//
// LA IDEMPOTÈNCIA DEL DIGEST. No hi ha cap tercer fitxer ni cap base
// de dades on apuntar «ja enviat»: el registre d'enviaments de Brevo
// ÉS l'apunt. Cada correu surt etiquetat `digest-AAAA-MM-DD-comarca`,
// i abans d'enviar res el Worker es llegeix els enviaments d'avui i
// en fa un conjunt. Té dues conseqüències bones: la guarda és per
// PERSONA i no per dia, o sigui que una execució que es mori a mig
// camí no repeteix ningú i la següent continua per on era; i no
// s'inventa cap lloc nou on desar estat (CLAUDE.md §3). I si el
// registre NO es pot llegir, no s'envia res: val més un digest de
// menys que dos digests a tothom.
//
// SECRETS I VARIABLES. Cap valor no viu mai dins d'aquest fitxer.
// Als Secrets del tauler de Cloudflare (Worker > Settings >
// Variables and Secrets):
//   GEMINI_API_KEY         (la clau d'AI Studio)
//   GITHUB_TOKEN           (gra fi, només aquest repositori, permís
//                           únic `contents: write`)
//   ADRECA_ARXIU           (el Gmail d'arxiu; ha de ser una destinació
//                           VERIFICADA a l'Email Routing, si no el
//                           reenviament falla. És Secret perquè el
//                           repositori és públic i és una adreça
//                           personal, no perquè sigui cap contrasenya.
//                           El digest de prova hi envia la mostra)
//   TYPEBOT_SECRET         (el secret compartit del webhook del
//                           formulari; el mateix valor va al bloc
//                           webhook del Typebot, dins la capçalera
//                           X-Typebot-Secret)
//   BREVO_API_KEY          (la clau d'API de Brevo; viatja només a la
//                           capçalera `api-key`, mai al registre)
//   BREVO_LIST_ROSSELLO    (l'id numèric de la llista de subscriptors
//   BREVO_LIST_CONFLENT     de cada comarca a Brevo: cinc Secrets, un
//   BREVO_LIST_VALLESPIR    per llista. No són contrasenyes, però són
//   BREVO_LIST_CAPCIR       dades del compte i el repositori és
//   BREVO_LIST_CERDANYA     públic)
// I una viu a `wrangler.jsonc`, com a `vars`:
//   CLOUDINARY_CLOUD_NAME  (no és secreta de cap manera: surt a l'URL
//                           de cada cartell del web públic. Va a la
//                           configuració i no al tauler perquè
//                           `wrangler deploy` esborra les variables de
//                           text del tauler a cada desplegament; els
//                           Secrets, en canvi, no els toca)
//
// DESPLEGAMENT: vegeu docs/pas-fase2-worker-email.md (el correu),
// docs/pas-fase3a-worker-formulari.md (el formulari) i
// docs/pas-fase3b-worker-digest.md (el digest).
// ============================================================

import PostalMime from './postal-mime.js';

// --- El repositori. Les mateixes coordenades que curador.html ---
var GITHUB_OWNER = 'CLMVallespir';
var GITHUB_REPO = 'agenda-catalogne-nord';
var GITHUB_BRANCH = 'main';
var FITXER_PENDENTS = 'pendents.json';
var FITXER_EVENTS = 'events.json';

// --- L'API de Gemini (nivell gratuït d'AI Studio) ---
// El nom del model viu en UNA constant i prou. Si algun dia torna un
// 404 amb el nom del model a dins, és el cicle de vida normal de
// Google: mira quins Flash / Flash-Lite hi ha vigents i canvia-la.
// Mai la gamma Pro, que és de pagament.
var GEMINI_MODEL = 'gemini-3.5-flash-lite';
var GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';
var GEMINI_MAX_TOKENS = 4096;

// --- Cloudinary: pujada sense signatura (docs/pas-3-cloudinary.md) ---
// El preset ja porta la carpeta (clm-agenda/posters) i la
// transformació d'entrada (w_800,c_limit,q_80,f_webp), que és la que
// converteix un PDF en un WebP de la primera pàgina. Aquí només cal
// el nom del cloud: cap signatura, cap secret.
var CLOUDINARY_PRESET = 'agenda-posters';

// --- El formulari Typebot: el secret compartit ---
// El bloc webhook del Typebot ha d'enviar aquesta capçalera amb el
// valor del Secret TYPEBOT_SECRET. L'URL del Worker és públic: sense
// aquesta comprovació, qualsevol que el trobés podria injectar files
// a la cua del curador.
var CAPCALERA_SECRET = 'X-Typebot-Secret';

// --- El digest setmanal de Brevo (Fase 3b) ---
// L'HORA. El cron de Cloudflare és sempre en UTC i no sap res de
// l'horari d'estiu. Les 15.00 de París són les 13.00 UTC a l'estiu i
// les 14.00 UTC a l'hivern, i no hi ha cap manera d'escriure això en
// una expressió cron. La solució més simple que ho garanteix tot
// l'any: el cron desperta el Worker cada deu minuts durant les DUES
// hores candidates, i el Worker mira quina hora és a París i se'n
// torna a dormir si no són les 15. L'expressió és a wrangler.jsonc,
// i és una de sola: "*/10 13,14 * * 2".
var HORA_DIGEST_PARIS = 15;

// Cada despertada envia com a molt aquests correus, i la següent
// —deu minuts després— continua per on era. El motiu és el límit del
// pla gratuït de Cloudflare: 50 subpeticions per execució, i cada
// correu n'és una (i unes quantes se'n van a llegir el GitHub, el
// registre de Brevo i les llistes). Amb sis despertades dins l'hora
// hi caben uns 240 correus, per sota del sostre diari de Brevo.
// Això només funciona perquè la guarda d'idempotència és per
// persona: si fos per dia, la segona despertada no enviaria res.
var MAX_ENVIAMENTS_PER_EXECUCIO = 40;

// Quants dies endavant mira el digest, avui inclòs.
var DIES_FINESTRA = 7;

// El sostre diari de correus transaccionals del pla gratuït de Brevo
// i el llindar on val la pena deixar-ne un avís al registre. No es
// talla res: només s'avisa, perquè es pugui planificar el pas a
// campanyes abans que els enviaments comencin a fallar.
var BREVO_MAX_DIARI = 300;
var BREVO_LLINDAR_AVIS = 280;

// --- Brevo: els tres punts de l'API que fa servir el digest ---
var BREVO_ENVIA_URL = 'https://api.brevo.com/v3/smtp/email';
var BREVO_CONTACTES_URL = 'https://api.brevo.com/v3/contacts/lists/';
var BREVO_HISTORIAL_URL = 'https://api.brevo.com/v3/smtp/emails';
var BREVO_PER_PAGINA = 500;

// Una pausa curta entre correus, per no atabalar l'API de Brevo.
var PAUSA_ENTRE_CORREUS_MS = 150;

// --- El remitent del digest ---
// Cap dels tres no és secret: totes dues adreces són públiques i el
// nom també. L'adreça de RESPOSTA no és agenda@clm.cat a posta:
// agenda@ va a parar al gestor email() d'aquest mateix Worker, i una
// resposta demanant la baixa hi entraria com una fila nova a la cua
// del curador. Les baixes, doncs, van a contacte@clm.cat.
var DIGEST_REMITENT_EMAIL = 'agenda@clm.cat';
var DIGEST_REMITENT_NOM = 'Agenda cultural de la Catalunya Nord';
var DIGEST_ADRECA_BAIXA = 'contacte@clm.cat';
var AGENDA_URL = 'https://agenda.clm.cat';

// --- Les cinc comarques i el que Brevo en necessita ---
// Una sola taula explícita, sense cap truc de transliteració: el nom
// de la comarca tal com surt a l'esquema, el nom del Secret que en
// guarda l'id de llista, i el tros d'etiqueta (sense accents) que
// marca els correus ja enviats.
var COMARQUES_BREVO = [
  { comarca: 'Rosselló', secret: 'BREVO_LIST_ROSSELLO', etiqueta: 'rossello' },
  { comarca: 'Conflent', secret: 'BREVO_LIST_CONFLENT', etiqueta: 'conflent' },
  { comarca: 'Vallespir', secret: 'BREVO_LIST_VALLESPIR', etiqueta: 'vallespir' },
  { comarca: 'Capcir', secret: 'BREVO_LIST_CAPCIR', etiqueta: 'capcir' },
  { comarca: 'Cerdanya', secret: 'BREVO_LIST_CERDANYA', etiqueta: 'cerdanya' }
];

// --- Els valors permesos dels dos camps d'enumeració (CLAUDE.md §4) ---
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

// El prompt d'extracció. És una còpia LITERAL de
// prompts/extract-event.txt, que n'és el mestre llegible i provable.
// Si en canvies un, canvia l'altre: han de dir exactament el mateix.
// Acaba amb la línia "CORREU:"; el text del correu s'afegeix després.
// (L'únic caràcter escapat aquí baix és la tanca markdown ```, que
// s'escriu \`\`\` perquè aquest text viu entre cometes invertides.)
var EXTRACTION_PROMPT = `Ets un extractor de dades per a l'agenda cultural de la Catalunya Nord. Llegeixes el correu electrònic que hi ha al final d'aquest missatge, després de la línia "CORREU:", i en retreus la informació d'un esdeveniment cultural.

DATA DE REFERÈNCIA
Avui és: {{AVUI}}
Fes servir aquesta data únicament per deduir l'any quan el correu esmenta una data sense any: tria la pròxima ocurrència futura d'aquesta data.

FORMAT DE RESPOSTA — REGLES ABSOLUTES
1. Respon NOMÉS amb un objecte JSON vàlid. Cap text abans ni després. Cap explicació. Cap bloc de codi markdown (res de \`\`\`).
2. L'objecte conté exactament aquestes 16 claus, totes presents sempre, en aquest ordre:
   id, titol, data_inici, data_fi, hora, lloc, municipi, comarca, categoria, descripcio_ca, descripcio_fr, associacio, imatge_url, font_url, estat, data_entrada
3. Tots els valors són cadenes de text (strings).
4. Si no pots determinar un camp amb certesa a partir del correu, el seu valor és una cadena buida "". No facis servir mai null. No ometis mai cap clau. No inventis mai cap dada.
5. Si el correu anuncia més d'un esdeveniment, extreu només el principal (el primer, si cap no destaca).

CAMPS QUE HAS D'EXTREURE
- titol: títol de l'esdeveniment, en català. Si el correu el dona en francès, escriu-lo en català, però conserva els noms propis (grups, obres, llocs) tal com apareixen.
- data_inici: format AAAA-MM-DD.
- data_fi: format AAAA-MM-DD. Si l'esdeveniment dura un sol dia, el mateix valor que data_inici.
- hora: format HH:MM (24 hores). Cadena buida si dura tot el dia o si el correu no ho indica.
- lloc: nom del local o de l'espai (per exemple: "Sala polivalent", "Església de Sant Pere", "Plaça de la República").
- municipi: nom del municipi, en la forma catalana si la coneixes (per exemple: "Perpinyà", "Prada", "Ceret").
- comarca: NOMÉS una d'aquestes cinc, escrita exactament així: Rosselló, Conflent, Vallespir, Capcir, Cerdanya. Dedueix-la del municipi només si la correspondència és clara i segura. Si tens cap dubte, cadena buida.
- categoria: NOMÉS una d'aquestes tretze, escrita exactament així: Música, Teatre, Dansa i ball, Conferència, Exposició, Mercat, Cinema, Taller, Activitat infantil, Patrimoni i tradicions, Concentració, Esports, Vida associativa. Si cap no encaixa clarament, cadena buida.
- descripcio_ca: de 2 a 4 frases en català. Redacta-la tu directament en català natural i correcte a partir de la informació del correu; no facis una traducció literal del francès. To informatiu i acollidor, sense exclamacions publicitàries. No hi afegeixis informació que el correu no doni.
- descripcio_fr: traducció francesa fidel de descripcio_ca, també de 2 a 4 frases.
- associacio: nom de l'entitat o associació organitzadora.

CAMPS QUE NO HAS D'OMPLIR MAI
- id, imatge_url, font_url, estat, data_entrada: retorna sempre cadena buida "". Aquests camps els omple el sistema, no tu.

EXEMPLE DE RESPOSTA (només per il·lustrar el format; no copiïs aquestes dades)
{
  "id": "",
  "titol": "Ball de la festa major",
  "data_inici": "2026-09-14",
  "data_fi": "2026-09-14",
  "hora": "18:30",
  "lloc": "Plaça del Firal",
  "municipi": "Prats de Molló",
  "comarca": "Vallespir",
  "categoria": "Dansa i ball",
  "descripcio_ca": "La festa major de Prats de Molló es tanca amb un ball obert a tothom a la plaça del Firal. L'orquestra local farà ballar petits i grans fins a mitjanit. L'entrada és gratuïta.",
  "descripcio_fr": "La fête patronale de Prats-de-Mollo se termine par un bal ouvert à tous sur la place du Firal. L'orchestre local fera danser petits et grands jusqu'à minuit. L'entrée est gratuite.",
  "associacio": "Comitè de festes de Prats de Molló",
  "imatge_url": "",
  "font_url": "",
  "estat": "",
  "data_entrada": ""
}

CORREU:
`;

// ============================================================
// EL GESTOR
// ============================================================

export default {
  // ------------------------------------------------------------
  // Un correu rebut a agenda@clm.cat. Arxiva primer, analitza
  // després. No torna res i no llança mai: si alguna cosa peta,
  // queda al registre i el correu ja és a l'arxiu.
  // ------------------------------------------------------------
  async email(message, env, ctx) {
    // Sense adreça d'arxiu no hi ha manera de desar l'original, i
    // empassar-se un correu en silenci és l'única cosa que no ens
    // podem permetre. Val més rebutjar-lo: el remitent rep un avís de
    // no-entrega amb el text de sota i el pot tornar a enviar quan la
    // configuració estigui posada. És un rebuig PERMANENT (un 5xx):
    // el servidor del remitent no ho reintentarà sol, ho ha de fer la
    // persona — per això el text li diu què fer.
    if (!env.ADRECA_ARXIU) {
      console.log('email(): falta la variable ADRECA_ARXIU. Rebutjo el correu en comptes d\'empassar-me\'l.');
      message.setReject('L\'agenda no ha pogut acceptar aquest correu; torna a enviar-lo més tard. · L\'agenda n\'a pas pu accepter ce message ; merci de le renvoyer plus tard.');
      return;
    }

    // PRIMER de tot, l'arxiu. Aquest ordre és la invariant de la
    // Fase 2: si reenviéssim al final, un error a mig camí (o un
    // límit de CPU) deixaria el correu sense cap còpia enlloc.
    await reenviaAArxiu(message, env);

    // A partir d'aquí res no és crític: l'original ja està desat.
    try {
      await processaCorreu(message, env);
    } catch (error) {
      console.log('email(): no he pogut fer la fila d\'aquest correu: ' + error.message);
    }
  },

  // ------------------------------------------------------------
  // Una petició HTTP. L'única que s'accepta és el POST del webhook
  // del formulari Typebot, amb el secret compartit a la capçalera.
  // Torna sempre una Response, també quan rebutja.
  // ------------------------------------------------------------
  async fetch(request, env, ctx) {
    // EL SECRET PRIMER, abans de mirar res més: ni el mètode, ni el
    // cos, ni res. L'URL del Worker és públic, i qui no porta el
    // secret no ha de saber ni què hi ha darrere ni per què l'hem
    // rebutjat: rep un 403 pelat. El motiu real va al registre, que
    // és on el mira el propietari.
    if (!secretCorrecte(request, env)) {
      return respostaJson(403, { ok: false, error: 'no autoritzat' });
    }

    // Només POST (FASES.md, Fase 3a). Aquí ja sabem que qui pregunta
    // porta el secret, o sigui que sí que li podem dir la veritat:
    // un 405 li estalvia mitja tarda de buscar on és l'error.
    if (request.method !== 'POST') {
      console.log('fetch(): mètode ' + request.method + ' rebutjat; només POST.');
      return respostaJson(405, { ok: false, error: 'només POST' });
    }

    // LA PORTA DE PROVA DEL DIGEST (Fase 3b). Mateix secret i mateix
    // POST que el formulari; només hi ha una marca a l'URL. Envia el
    // digest d'avui NOMÉS a l'adreça d'arxiu, amb una etiqueta de
    // prova que no toca ni consulta la guarda del digest de debò.
    // Existeix perquè, si no, l'única manera de provar la Fase 3b
    // seria esperar el dimarts a les tres de la tarda.
    var url = new URL(request.url);
    if (url.searchParams.get('digest') === 'prova') {
      return await respostaDigestDeProva(request, env);
    }

    return await respostaDelFormulari(request, env);
  },

  // ------------------------------------------------------------
  // El despertador setmanal del digest. El cron de Cloudflare és en
  // UTC, així que el Worker es desperta cada deu minuts durant les
  // dues hores que poden ser les 15.00 de París (13.00 UTC a l'estiu,
  // 14.00 a l'hivern) i només treballa quan de debò ho són. No torna
  // res i no llança mai: el que falli queda al registre.
  // ------------------------------------------------------------
  async scheduled(event, env, ctx) {
    var ara = new Date(event.scheduledTime);
    var hora = horaDeParis(ara);
    if (hora !== HORA_DIGEST_PARIS) {
      console.log('scheduled(): a París són les ' + hora + ', no les ' + HORA_DIGEST_PARIS + '. Cap digest.');
      return;
    }

    try {
      await enviaDigestSetmanal(env, ara);
    } catch (error) {
      console.log('scheduled(): el digest d\'aquesta setmana ha fallat: ' + error.message);
    }
  }
};

// ------------------------------------------------------------
// Reenvia el correu original al Gmail d'arxiu. NO LLANÇA MAI: un
// arxiu que falla es registra i prou, perquè el gestor ha de
// continuar igualment. Torna cert si s'ha reenviat.
// ------------------------------------------------------------
async function reenviaAArxiu(message, env) {
  // Que l'adreça hi sigui, ja ho ha comprovat email(): si faltés, el
  // correu s'hauria rebutjat i aquí no hi arribaríem.
  var adreca = env.ADRECA_ARXIU;

  try {
    await message.forward(adreca);
    return true;
  } catch (error) {
    // Causa més probable: l'adreça no és una destinació verificada
    // a l'Email Routing de Cloudflare.
    console.log('reenviaAArxiu(): el reenviament ha fallat: ' + error.message);
    return false;
  }
}

// ------------------------------------------------------------
// El correu, de MIME cru a fila a la cua. Llança si res del camí
// falla; qui el crida ja ho recull. No torna res.
// ------------------------------------------------------------
async function processaCorreu(message, env) {
  var correu = await PostalMime.parse(message.raw);
  var textCorreu = textDelCorreu(correu);

  // Un correu sense gens de text no es pot analitzar: seria una
  // crida a Gemini llençada i una fila buida a la cua. L'original
  // ja és a l'arxiu, que és l'únic que importa.
  if (textCorreu === '') {
    console.log('processaCorreu(): correu sense text. Arxivat, sense fila.');
    return;
  }

  // Gemini PRIMER, el cartell després: si l'extracció falla, no
  // haurem deixat cap imatge òrfena a Cloudinary.
  var avui = new Date().toISOString().slice(0, 10);
  var dadesExtretes = await demanaExtraccioGemini(textCorreu, env.GEMINI_API_KEY, avui);

  // El cartell és opcional, i que falli no ha de costar la fila:
  // sense imatge la fila encara és bona i el curador pot afegir-la.
  var imatgeUrl = '';
  var cartell = primerCartellAdjunt(correu);
  if (cartell !== null) {
    try {
      imatgeUrl = await pujaCartellCloudinary(cartell, env.CLOUDINARY_CLOUD_NAME);
    } catch (error) {
      console.log('processaCorreu(): el cartell no s\'ha pogut pujar: ' + error.message);
    }
  }

  var fila = construeixFila(dadesExtretes, imatgeUrl);
  await afegeixAPendents(fila, env.GITHUB_TOKEN, 'correu');
  console.log('processaCorreu(): fila afegida a la cua. id: "' + fila.id + '".');
}

// ============================================================
// EL FORMULARI (TYPEBOT)
// ============================================================

// ------------------------------------------------------------
// El secret compartit de la capçalera. Torna cert només si el
// Worker té el secret configurat I la petició porta el mateix
// valor. No registra mai el valor de cap dels dos.
// ------------------------------------------------------------
function secretCorrecte(request, env) {
  var esperat = env.TYPEBOT_SECRET;

  // Sense secret configurat, la porta queda tancada per a tothom.
  // Sembla exagerat i no ho és: l'alternativa —acceptar-ho tot
  // mentre falti el secret— obriria la cua al primer que trobés
  // l'URL, i justament el dia que la configuració no és a lloc.
  if (!esperat) {
    console.log('secretCorrecte(): falta el Secret TYPEBOT_SECRET. Rebutjo tota petició fins que hi sigui.');
    return false;
  }

  var rebut = request.headers.get(CAPCALERA_SECRET);
  if (rebut === null) {
    console.log('secretCorrecte(): petició sense la capçalera ' + CAPCALERA_SECRET + '.');
    return false;
  }

  if (rebut !== esperat) {
    console.log('secretCorrecte(): la capçalera ' + CAPCALERA_SECRET + ' no coincideix.');
    return false;
  }

  return true;
}

// ------------------------------------------------------------
// El POST del formulari, de JSON a fila a la cua. Qui la crida ja
// ha comprovat el secret i el mètode. No llança: torna sempre la
// Response que toca, i registra el detall de tot el que falla.
// ------------------------------------------------------------
async function respostaDelFormulari(request, env) {
  var cos = null;
  try {
    cos = await request.json();
  } catch (error) {
    console.log('respostaDelFormulari(): el cos no és JSON vàlid: ' + error.message);
    return respostaJson(400, { ok: false, error: 'el cos ha de ser un objecte JSON' });
  }

  // Un JSON vàlid també pot ser una llista, un número o null, i
  // d'aquests campText() en trauria bestieses. Només un objecte val.
  if (cos === null || typeof cos !== 'object' || Array.isArray(cos)) {
    console.log('respostaDelFormulari(): el cos és JSON, però no és un objecte.');
    return respostaJson(400, { ok: false, error: 'el cos ha de ser un objecte JSON' });
  }

  var fila = construeixFilaFormulari(cos);

  // Una tramesa sense títol ni data no és cap esdeveniment: seria
  // una fila buida per revisar. És el mateix criteri del camí del
  // correu, que tampoc no fa fila d'un correu sense text.
  if (fila.titol === '' && fila.data_inici === '') {
    console.log('respostaDelFormulari(): tramesa sense títol ni data. Cap fila.');
    return respostaJson(400, { ok: false, error: 'cal com a mínim un títol o una data' });
  }

  try {
    await afegeixAPendents(fila, env.GITHUB_TOKEN, 'formulari');
  } catch (error) {
    console.log('respostaDelFormulari(): no he pogut escriure la fila: ' + error.message);
    return respostaJson(500, { ok: false, error: 'no he pogut desar la tramesa' });
  }

  console.log('respostaDelFormulari(): fila afegida a la cua. id: "' + fila.id + '".');
  return respostaJson(200, { ok: true, id: fila.id });
}

// ------------------------------------------------------------
// Munta la fila de 16 camps a partir del cos del formulari. Mapa
// determinista, camp a camp, sense cap crida a Gemini: el formulari
// ja dona la informació separada. Torna l'objecte de la fila.
// ------------------------------------------------------------
function construeixFilaFormulari(cos) {
  var titol = campText(cos, 'titol');
  var dataInici = campText(cos, 'data_inici');
  var dataFi = campText(cos, 'data_fi');

  // El formulari no demana data_fi si l'acte és d'un sol dia, i
  // l'esquema diu que en aquest cas data_fi és igual a data_inici.
  if (dataFi === '') {
    dataFi = dataInici;
  }

  // El formulari recull UNA descripció i un senyal de quina llengua
  // és (CLAUDE.md §7): el text va a la banda que toca i l'altra
  // queda buida. La traducció que falta la fa el curador en revisar.
  // Es compara en minúscules per si el Typebot envia "FR" o "Fr".
  var descripcio = campText(cos, 'descripcio');
  var idioma = campText(cos, 'idioma_descripcio').toLowerCase();
  var descripcioCa = '';
  var descripcioFr = '';
  if (idioma === 'fr') {
    descripcioFr = descripcio;
  } else {
    descripcioCa = descripcio;
  }

  return {
    // --- L'id el reconstrueix sempre el sistema, mai el formulari ---
    id: creaId(dataInici, titol),
    // --- Els camps que omple l'associació al formulari ---
    titol: titol,
    data_inici: dataInici,
    data_fi: dataFi,
    hora: campText(cos, 'hora'),
    lloc: campText(cos, 'lloc'),
    municipi: campText(cos, 'municipi'),
    // La interfície del formulari ja constreny aquests dos a la
    // llista, però l'endpoint accepta qualsevol POST que porti el
    // secret: es filtren igual, com al camí del correu.
    comarca: valorPermes(campText(cos, 'comarca'), COMARCA_VALUES),
    categoria: valorPermes(campText(cos, 'categoria'), CATEGORIA_VALUES),
    descripcio_ca: descripcioCa,
    descripcio_fr: descripcioFr,
    associacio: campText(cos, 'associacio'),
    // El cartell ja ha pujat del navegador a Cloudinary dins el flux
    // del Typebot: l'URL arriba fet i es desa tal qual (o "" si
    // l'associació s'ha saltat el pas).
    imatge_url: campText(cos, 'imatge_url'),
    // --- Els camps que omple el sistema, mai el formulari ---
    font_url: '',                             // el formulari no demana cap enllaç d'origen
    estat: 'pendent',                         // sempre: espera el curador
    data_entrada: new Date().toISOString()    // quan s'ha creat la fila
  };
}

// ------------------------------------------------------------
// Una Response de JSON amb el codi que se li digui. Un sol lloc on
// es decideix la forma de la resposta, perquè totes siguin iguals.
// ------------------------------------------------------------
function respostaJson(codi, objecte) {
  return new Response(JSON.stringify(objecte), {
    status: codi,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

// ============================================================
// EL CORREU
// ============================================================

// ------------------------------------------------------------
// El text que enviarem al model: l'assumpte, una línia buida i el
// cos. Torna "" si el correu no porta gens de text (ni assumpte ni
// cos): així qui la crida sap que no val la pena cridar Gemini.
// ------------------------------------------------------------
function textDelCorreu(correu) {
  var assumpte = '';
  if (correu.subject) {
    assumpte = correu.subject.trim();
  }

  var cos = '';
  if (correu.text) {
    cos = correu.text.trim();
  } else if (correu.html) {
    // Molts correus d'associació arriben NOMÉS en HTML, i postal-mime
    // no els converteix: el camp `text` hi ve buit. Els desbrossem
    // nosaltres perquè el model rebi text i no desenes de kB
    // d'etiquetes i estils.
    cos = textDeHtml(correu.html);
  }

  if (assumpte === '' && cos === '') {
    return '';
  }
  return 'Assumpte: ' + assumpte + '\n\n' + cos;
}

// ------------------------------------------------------------
// Un HTML a text pla, de la manera més tosca que serveix: fora
// <script> i <style>, un salt de línia allà on l'HTML el marca, fora
// la resta d'etiquetes, i quatre entitats desxifrades. No pretén ser
// un navegador: només ha de deixar el text llegible per al model.
// Torna el text.
// ------------------------------------------------------------
function textDeHtml(html) {
  var text = html;
  // El contingut de <script> i <style> no és text del correu.
  text = text.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ');
  // Les etiquetes que de debò fan salt de línia.
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(p|div|li|tr|h1|h2|h3|h4|table)>/gi, '\n');
  // La resta d'etiquetes, fora.
  text = text.replace(/<[^>]*>/g, ' ');
  // Les entitats que surten de debò en un correu (les altres, si en
  // queda alguna, el model ja les entén pel context).
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/g, '\'');
  // Espais i línies buides repetides, a un.
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n[ \t]*\n[\s]*\n+/g, '\n\n');
  return text.trim();
}

// ------------------------------------------------------------
// El primer adjunt que serveixi de cartell (una imatge o un PDF),
// o null si no n'hi ha cap. Les imatges EN LÍNIA s'ignoren
// expressament: són logotips de signatura i icones de xarxes, no
// cartells.
// ------------------------------------------------------------
function primerCartellAdjunt(correu) {
  var adjunts = correu.attachments;
  if (!adjunts) {
    return null;
  }

  for (var i = 0; i < adjunts.length; i++) {
    var adjunt = adjunts[i];
    if (adjunt.related === true || adjunt.disposition === 'inline') {
      continue;
    }
    var tipus = adjunt.mimeType;
    if (!tipus) {
      continue;
    }
    if (tipus.indexOf('image/') === 0 || tipus === 'application/pdf') {
      return adjunt;
    }
  }
  return null;
}

// ============================================================
// CLOUDINARY
// ============================================================

// ------------------------------------------------------------
// Puja un cartell (imatge o PDF) a Cloudinary amb el preset sense
// signatura. Torna l'URL pública (secure_url) o llança un error clar.
// ------------------------------------------------------------
async function pujaCartellCloudinary(adjunt, cloudName) {
  if (!cloudName) {
    throw new Error('falta la variable CLOUDINARY_CLOUD_NAME.');
  }

  var url = 'https://api.cloudinary.com/v1_1/' + cloudName + '/image/upload';
  var nom = adjunt.filename;
  if (!nom) {
    nom = 'cartell';
  }

  var formulari = new FormData();
  formulari.append('upload_preset', CLOUDINARY_PRESET);
  formulari.append('file', new Blob([adjunt.content], { type: adjunt.mimeType }), nom);

  var resposta = await fetch(url, {
    method: 'POST',
    body: formulari
  });

  if (!resposta.ok) {
    var detall = await resposta.text();
    throw new Error('Cloudinary ha respost amb codi ' + resposta.status + '. ' + detall);
  }

  var dades = await resposta.json();
  if (!dades.secure_url) {
    throw new Error('Cloudinary no ha tornat cap secure_url.');
  }
  return dades.secure_url;
}

// ============================================================
// GEMINI
// ============================================================

// ------------------------------------------------------------
// Envia el text del correu a Gemini amb el prompt d'extracció i
// torna la resposta ja convertida en objecte (els 16 camps de
// l'esquema). Llança si la crida falla o la resposta no és JSON.
// La clau només viatja a la capçalera, mai al registre.
// ------------------------------------------------------------
async function demanaExtraccioGemini(textCorreu, apiKey, avui) {
  if (!apiKey) {
    throw new Error('falta el secret GEMINI_API_KEY.');
  }

  var prompt = EXTRACTION_PROMPT.replace('{{AVUI}}', avui);
  var contingut = prompt + textCorreu;

  var cos = {
    contents: [
      { parts: [ { text: contingut } ] }
    ],
    generationConfig: {
      maxOutputTokens: GEMINI_MAX_TOKENS,
      responseMimeType: 'application/json',
      // Els models 3.x "pensen" per defecte, i els tokens de pensar
      // compten dins de maxOutputTokens: poden tallar el JSON abans
      // de tancar-lo. Això és una extracció, no cal rumiar-hi.
      thinkingConfig: { thinkingLevel: 'minimal' }
    }
  };

  var resposta = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(cos)
  });

  if (!resposta.ok) {
    var detall = await resposta.text();
    throw new Error('Gemini ha respost amb codi ' + resposta.status + '. ' + detall);
  }

  var dades = await resposta.json();
  var text = extreuTextResposta(dades);
  return analitzaJsonResposta(text);
}

// ------------------------------------------------------------
// Treu el text de resposta de dins l'objecte que torna Gemini.
// Llança un error clar si la resposta ve buida, bloquejada o
// tallada. Torna el text.
// ------------------------------------------------------------
function extreuTextResposta(dades) {
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
// Converteix el text del model en objecte. Se li demana JSON i prou,
// però per si de cas es talla del primer "{" a l'últim "}" abans de
// parsejar. Llança si no hi ha objecte JSON. Torna l'objecte.
// ------------------------------------------------------------
function analitzaJsonResposta(text) {
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

// ============================================================
// LA FILA
// ============================================================

// ------------------------------------------------------------
// Munta la fila de 16 camps, cadascun pel seu nom i en l'ordre de
// l'esquema (CLAUDE.md §4). Tot són cadenes; cap valor buit no és
// mai null. Torna l'objecte de la fila.
// ------------------------------------------------------------
function construeixFila(dadesExtretes, imatgeUrl) {
  var titol = campText(dadesExtretes, 'titol');
  var dataInici = campText(dadesExtretes, 'data_inici');
  var dataFi = campText(dadesExtretes, 'data_fi');

  // Un acte d'un sol dia pot arribar sense data_fi. L'esquema diu
  // que en aquest cas data_fi és igual a data_inici.
  if (dataFi === '') {
    dataFi = dataInici;
  }

  return {
    // --- L'id el reconstrueix sempre el sistema, mai el model ---
    id: creaId(dataInici, titol),
    // --- Els camps que dedueix el model ---
    titol: titol,
    data_inici: dataInici,
    data_fi: dataFi,
    hora: campText(dadesExtretes, 'hora'),
    lloc: campText(dadesExtretes, 'lloc'),
    municipi: campText(dadesExtretes, 'municipi'),
    comarca: valorPermes(campText(dadesExtretes, 'comarca'), COMARCA_VALUES),
    categoria: valorPermes(campText(dadesExtretes, 'categoria'), CATEGORIA_VALUES),
    descripcio_ca: campText(dadesExtretes, 'descripcio_ca'),
    descripcio_fr: campText(dadesExtretes, 'descripcio_fr'),
    associacio: campText(dadesExtretes, 'associacio'),
    // --- Els camps que omple el sistema, mai el model ---
    imatge_url: imatgeUrl,                    // Cloudinary, o "" si no n'hi ha
    font_url: '',                             // un correu no porta cap enllaç de font
    estat: 'pendent',                         // sempre: espera el curador
    data_entrada: new Date().toISOString()    // quan s'ha creat la fila
  };
}

// ------------------------------------------------------------
// Llegeix un camp d'un objecte i el torna com a cadena neta. Un camp
// que falta, buit o null torna "". Així la resta del codi no ha de
// comprovar mai res.
// ------------------------------------------------------------
function campText(objecte, clau) {
  var valor = objecte[clau];
  if (valor === undefined || valor === null) {
    return '';
  }
  return String(valor).trim();
}

// ------------------------------------------------------------
// Còpia literal de creaId (docs/arxiu-google/utils.gs, curador.html). Fa
// l'id: la data d'inici, un guió, i un pedaç curt fet de les tres
// primeres paraules del títol. El sistema RECONSTRUEIX sempre l'id,
// mai es refia del que hagi tornat el model. Torna "" si no hi ha
// data d'inici.
// ------------------------------------------------------------
function creaId(dataInici, titol) {
  if (dataInici === '') {
    return '';
  }

  var text = titol.toLowerCase();
  // Parteix les lletres accentuades en lletra + accent i llença els
  // accents (à -> a, é -> e, ç -> c...).
  text = text.normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Fora apòstrofs, drets i corbats.
  text = text.replace(/['’]/g, '');
  // Tot el que no sigui lletra, xifra o espai es torna espai.
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
// Còpia literal de valorPermes (docs/arxiu-google/utils.gs, curador.html).
// Torna el valor si és a la llista permesa, si no "".
// ------------------------------------------------------------
function valorPermes(valor, llistaPermesa) {
  if (llistaPermesa.indexOf(valor) === -1) {
    return '';
  }
  return valor;
}

// ============================================================
// GITHUB
// ============================================================

// ------------------------------------------------------------
// Afegeix una fila a pendents.json. Llegeix el fitxer fresc, hi posa
// la fila al DAVANT (el curador vol veure primer el que acaba
// d'arribar, i curador.html pinta la cua en l'ordre del fitxer) i
// l'escriu. Si el sha ha canviat perquè algú altre ha escrit al
// mateix moment, torna a llegir i reintenta un cop. No torna res.
//
// La comparteixen els dos camins d'entrada: `origen` ('correu' o
// 'formulari') només serveix per al missatge del commit, que és
// l'única traça de per quina porta ha entrat cada fila.
// ------------------------------------------------------------
async function afegeixAPendents(fila, token, origen) {
  if (!token) {
    throw new Error('falta el secret GITHUB_TOKEN.');
  }

  var titol = fila.titol;
  if (titol === '') {
    titol = '(sense títol)';
  }
  var missatgeCommit = 'Fila nova a la cua (' + origen + '): ' + titol;

  var intents = 0;
  while (intents < 2) {
    var actual = await llegeixFitxerGitHub(FITXER_PENDENTS, token);
    var cua = actual.dades;
    if (!Array.isArray(cua)) {
      throw new Error(FITXER_PENDENTS + ' no conté una llista.');
    }
    cua.unshift(fila);

    try {
      await escriuFitxerGitHub(FITXER_PENDENTS, cua, actual.sha, missatgeCommit, token);
      return;
    } catch (error) {
      intents++;
      // Un conflicte de sha és l'únic error que val la pena reintentar.
      var esConflicte = error.message.indexOf('codi 409') !== -1 ||
        error.message.indexOf('codi 422') !== -1;
      if (!esConflicte || intents >= 2) {
        throw error;
      }
    }
  }
}

// ------------------------------------------------------------
// Les capçaleres de cada crida a l'API de GitHub. El User-Agent hi
// és perquè l'API el demana sempre: sense ell respon 403 (al
// navegador el posa el navegador, aquí l'hem de posar nosaltres).
// ------------------------------------------------------------
function capcaleresGitHub(token) {
  return {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'quefas-worker',
    'Authorization': 'Bearer ' + token
  };
}

// ------------------------------------------------------------
// Llegeix un fitxer JSON del repositori per l'API de continguts.
// Sempre per l'API, mai de Pages, que serveix còpies de CDN
// endarrerides. Torna { dades, sha } o llança un error clar.
// ------------------------------------------------------------
async function llegeixFitxerGitHub(nomFitxer, token) {
  var url = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO +
    '/contents/' + nomFitxer + '?ref=' + GITHUB_BRANCH;

  var resposta = await fetch(url, {
    method: 'GET',
    headers: capcaleresGitHub(token)
  });

  if (!resposta.ok) {
    var detall = await resposta.text();
    throw new Error('no he pogut llegir ' + nomFitxer + ' (codi ' + resposta.status + '). ' + detall);
  }

  var fitxer = await resposta.json();
  return {
    dades: JSON.parse(descodificaBase64(fitxer.content)),
    sha: fitxer.sha
  };
}

// ------------------------------------------------------------
// Escriu un fitxer JSON al repositori amb un sol PUT. Cal el sha
// actual: l'API el demana per acceptar la substitució. No torna res
// i llança un error amb el codi a dins (el reintent el llegeix).
// ------------------------------------------------------------
async function escriuFitxerGitHub(nomFitxer, dades, sha, missatgeCommit, token) {
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
    headers: capcaleresGitHub(token),
    body: JSON.stringify(cos)
  });

  if (!resposta.ok) {
    var detall = await resposta.text();
    throw new Error('GitHub ha rebutjat l\'escriptura de ' + nomFitxer +
      ' (codi ' + resposta.status + '). ' + detall);
  }
}

// ------------------------------------------------------------
// Text UTF-8 a base64, que és com l'API de GitHub vol el contingut.
// Es passa per bytes perquè btoa sol no sap res dels accents.
// ------------------------------------------------------------
function codificaBase64(text) {
  var bytes = new TextEncoder().encode(text);
  var binari = '';
  for (var i = 0; i < bytes.length; i++) {
    binari += String.fromCharCode(bytes[i]);
  }
  return btoa(binari);
}

// ------------------------------------------------------------
// Base64 a text UTF-8. El contingut que torna GitHub ve amb salts
// de línia cada 60 caràcters: es treuen abans de descodificar.
// ------------------------------------------------------------
function descodificaBase64(base64) {
  var binari = atob(base64.replace(/\n/g, ''));
  var bytes = new Uint8Array(binari.length);
  for (var i = 0; i < binari.length; i++) {
    bytes[i] = binari.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// ============================================================
// EL DIGEST SETMANAL (BREVO)
// ============================================================

// ------------------------------------------------------------
// L'hora que és a París en un moment donat, com a número de 0 a 23.
// El cron és en UTC i no sap res de l'horari d'estiu; aquesta funció
// sí, perquè el fus «Europe/Paris» el resol el motor de JavaScript.
// Torna el número de l'hora.
// ------------------------------------------------------------
function horaDeParis(data) {
  var format = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    hourCycle: 'h23'
  });
  return parseInt(format.format(data), 10);
}

// ------------------------------------------------------------
// La data que és a París en un moment donat, com a "AAAA-MM-DD". Es
// munta per parts, i no amb un format sencer, perquè es vegi que
// l'ordre és any-mes-dia i no cap altre. Torna la cadena.
// ------------------------------------------------------------
function dataDeParis(data) {
  var format = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  var parts = format.formatToParts(data);
  var any = '';
  var mes = '';
  var dia = '';
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].type === 'year') {
      any = parts[i].value;
    }
    if (parts[i].type === 'month') {
      mes = parts[i].value;
    }
    if (parts[i].type === 'day') {
      dia = parts[i].value;
    }
  }
  return any + '-' + mes + '-' + dia;
}

// ------------------------------------------------------------
// La data "AAAA-MM-DD" que hi haurà d'aquí a tants dies. Tanca la
// finestra del digest. Es compta a partir de mitjanit UTC perquè el
// resultat només serveix per comparar-lo amb altres cadenes ISO, i
// les cadenes ISO s'ordenen igual que les dates. Torna la cadena.
// ------------------------------------------------------------
function dataMesDies(dataText, dies) {
  var milisegonsPerDia = 24 * 60 * 60 * 1000;
  var inici = new Date(dataText + 'T00:00:00Z');
  var futur = new Date(inici.getTime() + dies * milisegonsPerDia);
  return futur.toISOString().slice(0, 10);
}

// ------------------------------------------------------------
// El digest de la setmana, de cap a cap: llegeix els actes publicats
// dels propers dies i, per cada comarca que en tingui, envia un
// correu a cada subscriptor que encara no l'hagi rebut avui. Llança
// si no pot llegir events.json o el registre de Brevo; una comarca
// que falla, en canvi, no atura les altres. No torna res.
// ------------------------------------------------------------
async function enviaDigestSetmanal(env, ara) {
  var apiKey = env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('falta el secret BREVO_API_KEY.');
  }

  var avui = dataDeParis(ara);
  var final = dataMesDies(avui, DIES_FINESTRA);
  var setmanaText = dataLlegibleCatala(avui);

  var esdeveniments = await llegeixEsdevenimentsDeLaSetmana(env.GITHUB_TOKEN, avui, final);
  if (esdeveniments.length === 0) {
    console.log('enviaDigestSetmanal(): cap acte publicat entre ' + avui + ' i ' + final + '. No s\'envia res.');
    return;
  }

  // LA GUARDA, abans de tocar cap llista i abans d'enviar res. Si
  // aquesta lectura peta, la funció sencera peta i no s'envia res:
  // sense saber a qui ja s'ha enviat, val més quedar-se curt.
  var jaEnviats = await adrecesJaEnviadesAvui(apiKey, avui);

  var pressupost = MAX_ENVIAMENTS_PER_EXECUCIO;
  var totalEnviats = 0;

  for (var i = 0; i < COMARQUES_BREVO.length; i++) {
    var fila = COMARQUES_BREVO[i];
    var actes = actesDeLaComarca(esdeveniments, fila.comarca);
    if (actes.length === 0) {
      continue; // una comarca sense actes aquesta setmana no envia res
    }
    if (pressupost <= 0) {
      console.log('enviaDigestSetmanal(): pressupost exhaurit. La propera despertada continuarà per ' + fila.comarca + '.');
      break;
    }

    // Una comarca que peta —un id de llista dolent, Brevo caigut— no
    // ha d'endur-se el digest de les altres quatre.
    try {
      var enviats = await enviaDigestComarca(fila, actes, env, apiKey, jaEnviats, avui, setmanaText, pressupost);
      pressupost = pressupost - enviats;
      totalEnviats = totalEnviats + enviats;
    } catch (error) {
      console.log('enviaDigestSetmanal(): el digest de ' + fila.comarca + ' ha fallat sencer: ' + error.message);
    }
  }

  var totalAvui = jaEnviats.size + totalEnviats;
  console.log('enviaDigestSetmanal(): ' + totalEnviats + ' correus en aquesta despertada, ' + totalAvui + ' en tot el dia.');

  if (totalAvui >= BREVO_LLINDAR_AVIS) {
    console.log('enviaDigestSetmanal(): AVÍS — ' + totalAvui + ' correus avui, a prop del sostre gratuït de Brevo (' +
      BREVO_MAX_DIARI + ' al dia). Convé planificar el pas a campanyes.');
  }
}

// ------------------------------------------------------------
// Els actes d'events.json que ja són publicats i que comencen entre
// dues dates, totes dues incloses, ordenats per data i hora. Es
// llegeix SEMPRE per l'API de continguts de GitHub, mai de Pages, que
// serveix còpies de CDN endarrerides. Cada acte es torna a muntar
// camp a camp perquè tots els valors siguin cadenes. Torna una
// llista, potser buida.
// ------------------------------------------------------------
async function llegeixEsdevenimentsDeLaSetmana(token, avui, final) {
  if (!token) {
    throw new Error('falta el secret GITHUB_TOKEN.');
  }

  var actual = await llegeixFitxerGitHub(FITXER_EVENTS, token);
  var tots = actual.dades;
  if (!Array.isArray(tots)) {
    throw new Error(FITXER_EVENTS + ' no conté una llista.');
  }

  var triats = [];
  for (var i = 0; i < tots.length; i++) {
    var acte = tots[i];

    if (campText(acte, 'estat') !== 'publicat') {
      continue;
    }

    var dataInici = campText(acte, 'data_inici');
    // Una data buida és "" i queda per sota d'avui: els actes sense
    // data cauen aquí, que és exactament on han de caure.
    if (dataInici < avui) {
      continue;
    }
    if (dataInici > final) {
      continue;
    }

    triats.push({
      titol: campText(acte, 'titol'),
      data_inici: dataInici,
      data_fi: campText(acte, 'data_fi'),
      hora: campText(acte, 'hora'),
      lloc: campText(acte, 'lloc'),
      municipi: campText(acte, 'municipi'),
      comarca: campText(acte, 'comarca'),
      categoria: campText(acte, 'categoria'),
      descripcio_ca: campText(acte, 'descripcio_ca'),
      descripcio_fr: campText(acte, 'descripcio_fr'),
      associacio: campText(acte, 'associacio')
    });
  }

  triats.sort(comparaPerDataIHora);
  return triats;
}

// ------------------------------------------------------------
// Comparador per a sort: ordena els actes per data d'inici i, dins
// del mateix dia, per hora. Tots dos camps són cadenes. Torna un
// número negatiu, zero o positiu.
// ------------------------------------------------------------
function comparaPerDataIHora(a, b) {
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
}

// ------------------------------------------------------------
// Els actes d'una comarca i prou. Un acte amb la comarca buida o
// desconeguda no surt en cap digest: no hi ha cap llista on posar-lo.
// Torna una llista, potser buida.
// ------------------------------------------------------------
function actesDeLaComarca(esdeveniments, comarca) {
  var triats = [];
  for (var i = 0; i < esdeveniments.length; i++) {
    if (esdeveniments[i].comarca === comarca) {
      triats.push(esdeveniments[i]);
    }
  }
  return triats;
}

// ------------------------------------------------------------
// A qui ja s'ha enviat el digest d'avui, segons el registre
// d'enviaments del mateix Brevo. Torna un conjunt de claus
// "etiqueta|adreça": per comarca I per persona, no només per dia.
// Això és tot el sistema d'idempotència del digest — no hi ha cap
// altre lloc on es desi estat. LLANÇA si el registre no es pot
// llegir, i és a posta: qui la crida no ha d'enviar res.
// ------------------------------------------------------------
async function adrecesJaEnviadesAvui(apiKey, avui) {
  var prefix = 'digest-' + avui + '-';
  var jaEnviats = new Set();
  var desplacament = 0;

  while (true) {
    var pagina = await paginaHistorialBrevo(apiKey, avui, desplacament);
    var correus = pagina.transactionalEmails;

    if (!Array.isArray(correus) || correus.length === 0) {
      break; // cap enviament més
    }

    for (var i = 0; i < correus.length; i++) {
      var correu = correus[i];
      var etiquetes = correu.tags;
      if (!Array.isArray(etiquetes)) {
        continue; // un correu sense etiquetes no és cap digest nostre
      }
      for (var j = 0; j < etiquetes.length; j++) {
        if (etiquetes[j].indexOf(prefix) === 0) {
          jaEnviats.add(etiquetes[j] + '|' + correu.email);
        }
      }
    }

    // Una pàgina més curta que el màxim vol dir que ja no n'hi ha més.
    if (correus.length < BREVO_PER_PAGINA) {
      break;
    }
    desplacament = desplacament + BREVO_PER_PAGINA;
  }

  return jaEnviats;
}

// ------------------------------------------------------------
// UNA pàgina del registre d'enviaments d'avui. Un 204 vol dir «cap
// enviament» i Brevo el respon amb el cos buit: es tracta com una
// pàgina buida i prou. Llança en qualsevol altre error. Torna
// l'objecte de la resposta, que porta .transactionalEmails.
// ------------------------------------------------------------
async function paginaHistorialBrevo(apiKey, avui, desplacament) {
  var url = BREVO_HISTORIAL_URL +
    '?startDate=' + avui +
    '&endDate=' + avui +
    '&limit=' + BREVO_PER_PAGINA +
    '&offset=' + desplacament;

  var resposta = await fetch(url, {
    method: 'GET',
    headers: {
      'api-key': apiKey,
      'accept': 'application/json'
    }
  });

  if (resposta.status === 204) {
    return { transactionalEmails: [] };
  }
  if (!resposta.ok) {
    var detall = await resposta.text();
    throw new Error('Brevo (registre d\'enviaments) ha respost amb codi ' + resposta.status + '. ' + detall);
  }

  var text = await resposta.text();
  if (text.trim() === '') {
    return { transactionalEmails: [] };
  }
  return JSON.parse(text);
}

// ------------------------------------------------------------
// El digest d'UNA comarca: busca l'id de la llista, es baixa els
// contactes, munta el correu UN SOL COP i l'envia a qui encara no
// l'ha rebut avui. Torna quants correus ha enviat. Llança si la
// configuració de la comarca és dolenta o si no pot llegir la
// llista; un destinatari que falla, en canvi, només es registra.
// ------------------------------------------------------------
async function enviaDigestComarca(fila, actes, env, apiKey, jaEnviats, avui, setmanaText, pressupost) {
  var llistaId = idDeLlistaBrevo(env, fila);
  var etiqueta = 'digest-' + avui + '-' + fila.etiqueta;
  var assumpte = construeixAssumpte(fila.comarca, setmanaText);
  var html = construeixHtmlDigest(fila.comarca, actes, setmanaText);

  var destinataris = await contactesDeLlista(llistaId, apiKey);
  var enviats = 0;
  var saltats = 0;

  for (var i = 0; i < destinataris.length; i++) {
    var adreca = destinataris[i];

    // La guarda: aquesta persona ja té el digest d'avui d'aquesta
    // comarca. Se salta sense gastar cap subpetició.
    if (jaEnviats.has(etiqueta + '|' + adreca)) {
      saltats = saltats + 1;
      continue;
    }

    if (enviats >= pressupost) {
      console.log('enviaDigestComarca(): ' + fila.comarca + ' s\'atura al pressupost d\'aquesta despertada; la següent continuarà.');
      break;
    }

    // Un destinatari que falla no ha d'aturar la resta de la llista.
    try {
      await enviaCorreuTransaccional(apiKey, adreca, assumpte, html, etiqueta);
      enviats = enviats + 1;
    } catch (error) {
      console.log('enviaDigestComarca(): un contacte de ' + fila.comarca + ' no ha rebut el digest: ' + error.message);
    }
    await dorm(PAUSA_ENTRE_CORREUS_MS);
  }

  console.log('enviaDigestComarca(): ' + fila.comarca + ' — ' + destinataris.length + ' contactes, ' +
    enviats + ' enviats, ' + saltats + ' ja el tenien.');
  return enviats;
}

// ------------------------------------------------------------
// L'id de la llista de Brevo d'una comarca, llegit del seu Secret.
// Llança amb un missatge clar si el Secret falta o no és un número:
// una configuració dolenta ha de petar aquí, i no més endins, dins
// d'una URL estranya. El valor no surt mai al missatge d'error.
// Torna l'id com a cadena.
// ------------------------------------------------------------
function idDeLlistaBrevo(env, fila) {
  var valor = env[fila.secret];
  if (!valor) {
    throw new Error('falta el secret ' + fila.secret + ' (l\'id de la llista de ' + fila.comarca + ').');
  }
  if (!/^[0-9]+$/.test(valor)) {
    throw new Error('el secret ' + fila.secret + ' ha de ser un número: és l\'id de la llista de Brevo.');
  }
  return valor;
}

// ------------------------------------------------------------
// Totes les adreces d'una llista de Brevo, pàgina a pàgina. Els
// contactes que Brevo té a la llista negra —baixes i rebots— no hi
// surten. Torna una llista d'adreces, potser buida. Llança si l'API
// falla.
// ------------------------------------------------------------
async function contactesDeLlista(llistaId, apiKey) {
  var adreces = [];
  var desplacament = 0;

  while (true) {
    var pagina = await paginaContactesBrevo(llistaId, apiKey, desplacament);
    var contactes = pagina.contacts;

    if (!Array.isArray(contactes) || contactes.length === 0) {
      break; // cap contacte més
    }

    for (var i = 0; i < contactes.length; i++) {
      var contacte = contactes[i];
      if (contacte.emailBlacklisted === true) {
        continue; // es respecten les baixes i els rebots
      }
      if (contacte.email) {
        adreces.push(contacte.email);
      }
    }

    if (contactes.length < BREVO_PER_PAGINA) {
      break;
    }
    desplacament = desplacament + BREVO_PER_PAGINA;
  }

  return adreces;
}

// ------------------------------------------------------------
// UNA pàgina de contactes d'una llista. Com el registre: un 204 és
// una llista buida, no un error. Llança en qualsevol altre cas.
// Torna l'objecte de la resposta, que porta .contacts.
// ------------------------------------------------------------
async function paginaContactesBrevo(llistaId, apiKey, desplacament) {
  var url = BREVO_CONTACTES_URL + llistaId + '/contacts' +
    '?limit=' + BREVO_PER_PAGINA + '&offset=' + desplacament;

  var resposta = await fetch(url, {
    method: 'GET',
    headers: {
      'api-key': apiKey,
      'accept': 'application/json'
    }
  });

  if (resposta.status === 204) {
    return { contacts: [] };
  }
  if (!resposta.ok) {
    var detall = await resposta.text();
    throw new Error('Brevo (contactes de la llista ' + llistaId + ') ha respost amb codi ' + resposta.status + '. ' + detall);
  }

  var text = await resposta.text();
  if (text.trim() === '') {
    return { contacts: [] };
  }
  return JSON.parse(text);
}

// ------------------------------------------------------------
// UN correu transaccional a UNA adreça. Mai cap campanya, i mai
// diverses adreces al mateix correu: així ningú no veu l'adreça de
// ningú. L'etiqueta és el que després permetrà saber que aquesta
// persona ja té el digest d'avui. La clau només viatja a la
// capçalera. No torna res; llança si Brevo no l'accepta.
// ------------------------------------------------------------
async function enviaCorreuTransaccional(apiKey, adreca, assumpte, html, etiqueta) {
  var cos = {
    sender: { name: DIGEST_REMITENT_NOM, email: DIGEST_REMITENT_EMAIL },
    to: [ { email: adreca } ],
    replyTo: { email: DIGEST_ADRECA_BAIXA },
    subject: assumpte,
    htmlContent: html,
    tags: [ etiqueta ],
    headers: {
      'List-Unsubscribe': '<mailto:' + DIGEST_ADRECA_BAIXA + '?subject=baixa>'
    }
  };

  var resposta = await fetch(BREVO_ENVIA_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(cos)
  });

  if (resposta.status !== 201 && resposta.status !== 202) {
    var detall = await resposta.text();
    throw new Error('Brevo (enviament) ha respost amb codi ' + resposta.status + '. ' + detall);
  }
}

// ------------------------------------------------------------
// Espera els mil·lisegons que se li diguin. Serveix per no engegar
// els correus l'un darrere l'altre sense respirar.
// ------------------------------------------------------------
function dorm(milisegons) {
  return new Promise(function (resol) {
    setTimeout(resol, milisegons);
  });
}

// ------------------------------------------------------------
// El digest de PROVA. Munta el digest de debò a partir d'events.json
// però l'envia NOMÉS a l'adreça d'arxiu —la del propietari— i amb
// una etiqueta de prova, de manera que no consulta ni embruta la
// guarda del digest real. Serveix per provar la Fase 3b qualsevol
// dia i a qualsevol hora, sense esperar el dimarts a les tres.
// El cos pot dur { "comarca": "Vallespir" }; si no en duu cap, envia
// una mostra de cada comarca que tingui actes. Torna la Response.
// ------------------------------------------------------------
async function respostaDigestDeProva(request, env) {
  var adreca = env.ADRECA_ARXIU;
  if (!adreca) {
    console.log('respostaDigestDeProva(): falta la variable ADRECA_ARXIU; no sé on enviar la prova.');
    return respostaJson(500, { ok: false, error: 'falta ADRECA_ARXIU' });
  }

  var apiKey = env.BREVO_API_KEY;
  if (!apiKey) {
    console.log('respostaDigestDeProva(): falta el secret BREVO_API_KEY.');
    return respostaJson(500, { ok: false, error: 'falta BREVO_API_KEY' });
  }

  // El cos és opcional: un cos buit vol dir «totes les comarques».
  var comarcaDemanada = '';
  try {
    var cos = await request.json();
    if (cos !== null && typeof cos === 'object' && !Array.isArray(cos)) {
      comarcaDemanada = campText(cos, 'comarca');
    }
  } catch (error) {
    comarcaDemanada = '';
  }

  var ara = new Date();
  var avui = dataDeParis(ara);
  var final = dataMesDies(avui, DIES_FINESTRA);
  var setmanaText = dataLlegibleCatala(avui);

  var esdeveniments = null;
  try {
    esdeveniments = await llegeixEsdevenimentsDeLaSetmana(env.GITHUB_TOKEN, avui, final);
  } catch (error) {
    console.log('respostaDigestDeProva(): no he pogut llegir ' + FITXER_EVENTS + ': ' + error.message);
    return respostaJson(500, { ok: false, error: 'no he pogut llegir ' + FITXER_EVENTS });
  }

  var enviats = 0;
  var comarques = [];

  for (var i = 0; i < COMARQUES_BREVO.length; i++) {
    var fila = COMARQUES_BREVO[i];
    if (comarcaDemanada !== '' && comarcaDemanada !== fila.comarca) {
      continue;
    }

    var actes = actesDeLaComarca(esdeveniments, fila.comarca);
    if (actes.length === 0) {
      continue;
    }

    var assumpte = '[PROVA] ' + construeixAssumpte(fila.comarca, setmanaText);
    var html = construeixHtmlDigest(fila.comarca, actes, setmanaText);

    try {
      await enviaCorreuTransaccional(apiKey, adreca, assumpte, html, 'digest-prova-' + avui);
      enviats = enviats + 1;
      comarques.push(fila.comarca);
    } catch (error) {
      console.log('respostaDigestDeProva(): la prova de ' + fila.comarca + ' ha fallat: ' + error.message);
    }
  }

  console.log('respostaDigestDeProva(): ' + enviats + ' correus de prova a l\'adreça d\'arxiu. Finestra ' + avui + ' … ' + final + '.');
  return respostaJson(200, {
    ok: true,
    finestra: avui + ' … ' + final,
    actes: esdeveniments.length,
    enviats: enviats,
    comarques: comarques
  });
}

// ============================================================
// L'HTML DEL DIGEST
//
// La meitat PURA del digest: només munta text i dates, i no crida
// cap API. És el mateix disseny que ja estava aprovat a l'Apps
// Script (docs/arxiu-google/digestHtml.gs): targeta blanca sobre fons
// clar, actes agrupats per dia sota una capçalera amb un punt
// daurat, el vermell només a l'hora i al «Fins al…», la categoria
// com una etiqueta negra. Taules i estils en línia, sense fonts
// externes ni imatges, perquè es vegi bé a tots els clients de
// correu — que és per què aquí NO hi ha ni Fraunces ni Montserrat.
// ============================================================

// --- Els colors del web («sang i or» només com a accent) ---
var COLOR_TINTA = '#1a1a1a';        // quasi negre: títols i capçaleres de dia
var COLOR_TINTA_SUAU = '#6f6862';   // tinta apagada: francès i text secundari
var COLOR_ACCENT = '#b5121b';       // vermell: només data i hora
var COLOR_OR = '#fcdd09';           // or: només el punt del dia
var COLOR_VORA = '#e7e4df';         // filets i vora de la targeta
var COLOR_VORA_SUAU = '#f0ede7';    // separador entre actes
var COLOR_FONS = '#f2f1ed';         // fons de la pàgina, darrere la targeta

// --- Els noms dels mesos i dels dies, idèntics als del web ---
var MESOS_CATALA = [
  'gener', 'febrer', 'març', 'abril', 'maig', 'juny',
  'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'
];
var MESOS_FRANCES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
];
var DIES_CATALA = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];
var DIES_FRANCES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// ------------------------------------------------------------
// L'assumpte del digest d'una comarca, en el format acordat:
// «Agenda cultural — [Comarca] — setmana del [data]». Torna la línia.
// ------------------------------------------------------------
function construeixAssumpte(comarca, setmanaText) {
  return 'Agenda cultural — ' + comarca + ' — setmana del ' + setmanaText;
}

// ------------------------------------------------------------
// L'HTML sencer del correu d'una comarca: una targeta blanca amb la
// capçalera, els actes agrupats per dia i el peu de baixa. Torna la
// cadena d'HTML.
// ------------------------------------------------------------
function construeixHtmlDigest(comarca, esdeveniments, setmanaText) {
  var contextLinia = escapaHtml(comarca + ' · setmana del ' + setmanaText);

  var cos = '';
  var diaAnterior = '';
  for (var i = 0; i < esdeveniments.length; i++) {
    var esdeveniment = esdeveniments[i];
    if (esdeveniment.data_inici !== diaAnterior) {
      cos = cos + construeixCapcaleraDia(esdeveniment.data_inici);
      diaAnterior = esdeveniment.data_inici;
    }
    cos = cos + construeixBlocEsdeveniment(esdeveniment);
  }

  var peu = construeixPeuBaixa();

  var html =
    '<!DOCTYPE html>' +
    '<html lang="ca"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background-color:' + COLOR_FONS + ';">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:' + COLOR_FONS + ';">' +
    '<tr><td align="center" style="padding:16px;">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid ' + COLOR_VORA + ';">' +
    '<tr><td style="padding:24px 26px 16px;border-bottom:1px solid ' + COLOR_VORA + ';">' +
    '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:15px;color:' + COLOR_TINTA + ';letter-spacing:0.02em;">Agenda cultural</div>' +
    '<div style="font-family:Georgia,\'Times New Roman\',serif;font-weight:bold;font-size:23px;color:' + COLOR_TINTA + ';line-height:1.1;">Catalunya Nord</div>' +
    '<div lang="fr" style="font-family:Georgia,\'Times New Roman\',serif;font-style:italic;font-size:12px;color:' + COLOR_TINTA_SUAU + ';padding-top:4px;">Agenda culturel — Catalogne Nord</div>' +
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:' + COLOR_TINTA_SUAU + ';padding-top:8px;">' + contextLinia + '</div>' +
    '</td></tr>' +
    '<tr><td style="padding:0 26px 6px;">' + cos + '</td></tr>' +
    '<tr><td style="padding:16px 26px 24px;border-top:1px solid ' + COLOR_VORA + ';">' + peu + '</td></tr>' +
    '</table></td></tr></table></body></html>';

  return html;
}

// ------------------------------------------------------------
// La capçalera d'un dia, «30 Juny, Dimarts · 30 Juin, Mardi», amb el
// punt daurat, igual que al web. Català primer, francès en cursiva.
// Torna la cadena d'HTML.
// ------------------------------------------------------------
function construeixCapcaleraDia(dataText) {
  var data = objecteDataDe(dataText);
  var textCa;
  var textFr;
  if (data === null) {
    textCa = dataText;
    textFr = '';
  } else {
    textCa = etiquetaDiaCatala(data);
    textFr = etiquetaDiaFrances(data);
  }

  var punt = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:' + COLOR_OR + ';margin-right:8px;vertical-align:middle;"></span>';

  var html =
    '<div style="border-bottom:1px solid ' + COLOR_VORA + ';padding-bottom:6px;margin:22px 0 10px;">' +
    punt +
    '<span style="font-family:Georgia,\'Times New Roman\',serif;font-weight:bold;font-size:15px;color:' + COLOR_TINTA + ';vertical-align:middle;">' + escapaHtml(textCa) + '</span>';
  if (textFr !== '') {
    html = html + '<span lang="fr" style="font-family:Georgia,\'Times New Roman\',serif;font-style:italic;font-size:13px;color:' + COLOR_TINTA_SUAU + ';vertical-align:middle;"> · ' + escapaHtml(textFr) + '</span>';
  }
  html = html + '</div>';
  return html;
}

// ------------------------------------------------------------
// El bloc d'UN acte: l'etiqueta negra de categoria, el títol, la
// línia de dades (hora i «Fins al…» en vermell, més el lloc), la
// descripció catalana, la francesa en cursiva i qui l'organitza.
// Tot valor dinàmic passa per escapaHtml. Torna la cadena d'HTML.
// ------------------------------------------------------------
function construeixBlocEsdeveniment(esdeveniment) {
  var xipCategoria = construeixXipCategoria(esdeveniment.categoria);
  var titol = escapaHtml(esdeveniment.titol);
  var meta = construeixMeta(esdeveniment);
  var descCa = escapaHtml(esdeveniment.descripcio_ca);
  var descFr = escapaHtml(esdeveniment.descripcio_fr);
  var associacio = esdeveniment.associacio;

  var bloc =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid ' + COLOR_VORA_SUAU + ';">' +
    '<tr><td style="padding:14px 0;">';

  if (xipCategoria !== '') {
    bloc = bloc + '<div style="padding-bottom:8px;">' + xipCategoria + '</div>';
  }

  bloc = bloc + '<div style="font-family:Georgia,\'Times New Roman\',serif;font-weight:bold;font-size:17px;line-height:1.25;color:' + COLOR_TINTA + ';">' + titol + '</div>';

  if (meta !== '') {
    bloc = bloc + '<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:' + COLOR_TINTA_SUAU + ';padding-top:6px;">' + meta + '</div>';
  }
  if (descCa !== '') {
    bloc = bloc + '<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:' + COLOR_TINTA + ';padding-top:8px;line-height:1.5;">' + descCa + '</div>';
  }
  if (descFr !== '') {
    bloc = bloc + '<div lang="fr" style="font-family:Georgia,\'Times New Roman\',serif;font-style:italic;font-size:13px;color:' + COLOR_TINTA_SUAU + ';padding-top:4px;line-height:1.5;">' + descFr + '</div>';
  }
  if (associacio !== '') {
    bloc = bloc + '<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:' + COLOR_TINTA_SUAU + ';padding-top:6px;">Organitza · Organise : ' + escapaHtml(associacio) + '</div>';
  }

  bloc = bloc + '</td></tr></table>';
  return bloc;
}

// ------------------------------------------------------------
// L'etiqueta negra amb el nom de la categoria, o "" si l'acte no en
// té cap. Torna la cadena d'HTML.
// ------------------------------------------------------------
function construeixXipCategoria(categoria) {
  if (categoria === '') {
    return '';
  }
  var text = escapaHtml(categoria);
  return '<span style="display:inline-block;background-color:' + COLOR_TINTA + ';color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;padding:3px 9px;">' + text + '</span>';
}

// ------------------------------------------------------------
// La línia de dades d'un acte: l'hora («18:30 h», en vermell), el
// lloc i el municipi, i per als actes de més d'un dia el «Fins al…
// · Jusqu'au…» (també en vermell). Les parts s'uneixen amb « · ».
// Torna la línia, o "" si no hi ha res a dir.
// ------------------------------------------------------------
function construeixMeta(esdeveniment) {
  var parts = [];

  if (esdeveniment.hora !== '') {
    parts.push(spanAccent(esdeveniment.hora + ' h'));
  }

  var lloc = textLloc(esdeveniment);
  if (lloc !== '') {
    parts.push(escapaHtml(lloc));
  }

  if (esdeveniment.data_fi !== '' && esdeveniment.data_fi !== esdeveniment.data_inici) {
    var fins = finsAl(esdeveniment.data_fi);
    if (fins !== '') {
      parts.push(spanAccent(fins));
    }
  }

  if (parts.length === 0) {
    return '';
  }
  return parts.join(' · ');
}

// ------------------------------------------------------------
// Embolcalla un tros de text amb el vermell d'accent, en negreta.
// El text s'escapa aquí dins. Torna la cadena d'HTML.
// ------------------------------------------------------------
function spanAccent(text) {
  return '<span style="color:' + COLOR_ACCENT + ';font-weight:bold;">' + escapaHtml(text) + '</span>';
}

// ------------------------------------------------------------
// El lloc de l'acte com a text: «lloc, municipi», només un dels dos,
// o "" si no se'n sap cap. Torna text CRU, sense escapar: qui la
// crida ja l'escapa.
// ------------------------------------------------------------
function textLloc(esdeveniment) {
  var lloc = esdeveniment.lloc;
  var municipi = esdeveniment.municipi;
  if (lloc !== '' && municipi !== '') {
    return lloc + ', ' + municipi;
  }
  if (lloc !== '') {
    return lloc;
  }
  if (municipi !== '') {
    return municipi;
  }
  return '';
}

// ------------------------------------------------------------
// El «Fins al … · Jusqu'au …» d'una data de fi, amb les
// contraccions catalanes correctes (a l'1, al 20, d'agost) i el
// «1er» francès, com al web. Torna "" si la data no és bona.
// ------------------------------------------------------------
function finsAl(dataText) {
  var data = objecteDataDe(dataText);
  if (data === null) {
    return '';
  }
  var dia = data.getDate();
  var mesCa = MESOS_CATALA[data.getMonth()];
  var mesFr = MESOS_FRANCES[data.getMonth()];

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

// ------------------------------------------------------------
// Cert si una paraula comença per vocal, per triar entre «de» i «d'».
// ------------------------------------------------------------
function comencaAmbVocal(paraula) {
  return 'aeiouàéèíòóú'.indexOf(paraula.charAt(0)) !== -1;
}

// ------------------------------------------------------------
// Converteix "AAAA-MM-DD" en un objecte Date, només per llegir-ne el
// dia del mes i el dia de la setmana. Torna null si el format no és
// bo.
// ------------------------------------------------------------
function objecteDataDe(dataText) {
  if (dataText === '') {
    return null;
  }
  var parts = dataText.split('-');
  if (parts.length !== 3) {
    return null;
  }
  var any = parseInt(parts[0], 10);
  var mes = parseInt(parts[1], 10);
  var dia = parseInt(parts[2], 10);
  if (isNaN(any) || isNaN(mes) || isNaN(dia) || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return null;
  }
  return new Date(any, mes - 1, dia);
}

// ------------------------------------------------------------
// L'etiqueta catalana d'un dia: «30 Juny, Dimarts».
// ------------------------------------------------------------
function etiquetaDiaCatala(data) {
  return data.getDate() + ' ' + majuscula(MESOS_CATALA[data.getMonth()]) + ', ' + DIES_CATALA[data.getDay()];
}

// ------------------------------------------------------------
// L'etiqueta francesa d'un dia: «30 Juin, Mardi» («1er» el dia u).
// ------------------------------------------------------------
function etiquetaDiaFrances(data) {
  var dia = data.getDate();
  var diaFr;
  if (dia === 1) {
    diaFr = '1er';
  } else {
    diaFr = String(dia);
  }
  return diaFr + ' ' + majuscula(MESOS_FRANCES[data.getMonth()]) + ', ' + DIES_FRANCES[data.getDay()];
}

// ------------------------------------------------------------
// La paraula amb la primera lletra en majúscula.
// ------------------------------------------------------------
function majuscula(paraula) {
  if (paraula === '') {
    return '';
  }
  return paraula.charAt(0).toUpperCase() + paraula.slice(1);
}

// ------------------------------------------------------------
// El peu del correu: l'enllaç al web i la nota de baixa bilingüe.
// Brevo NO afegeix cap enllaç de baixa als correus transaccionals,
// així que la nota hi ha de ser sempre, a tots els missatges. Les
// baixes van a contacte@clm.cat i no a agenda@clm.cat: agenda@ el
// llegeix el gestor email() d'aquest mateix Worker, i una petició de
// baixa hi entraria com una fila nova a la cua del curador.
// Torna la cadena d'HTML.
// ------------------------------------------------------------
function construeixPeuBaixa() {
  var enllac =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;padding-bottom:10px;">' +
    '<a href="' + escapaHtml(AGENDA_URL) + '" style="color:' + COLOR_ACCENT + ';font-weight:bold;text-decoration:none;">Veure tota l’agenda · Voir tout l’agenda</a>' +
    '</div>';

  var text =
    'Reps aquest correu perquè estàs subscrit/a a l’agenda cultural de la Catalunya Nord. ' +
    'Per donar-te de baixa, respon a aquest correu amb la paraula «baixa» o escriu a ' +
    escapaHtml(DIGEST_ADRECA_BAIXA) + '.' +
    '<br><span style="font-style:italic;">' +
    'Vous recevez ce message car vous êtes abonné·e à l’agenda culturel de Catalogne Nord. ' +
    'Pour vous désabonner, répondez « baixa » à ce courriel ou écrivez à ' +
    escapaHtml(DIGEST_ADRECA_BAIXA) + '.' +
    '</span>';

  return enllac + '<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:' + COLOR_TINTA_SUAU + ';line-height:1.5;">' + text + '</div>';
}

// ------------------------------------------------------------
// Converteix "2026-09-14" en «14 de setembre de 2026». Serveix per
// a la línia d'assumpte. Torna "" si la data és buida o dolenta.
// ------------------------------------------------------------
function dataLlegibleCatala(dataText) {
  var data = objecteDataDe(dataText);
  if (data === null) {
    return '';
  }
  var dia = data.getDate();
  var mesNom = MESOS_CATALA[data.getMonth()];
  var any = data.getFullYear();

  var preposicio;
  if (comencaAmbVocal(mesNom)) {
    preposicio = 'd’';
  } else {
    preposicio = 'de ';
  }
  return dia + ' ' + preposicio + mesNom + ' de ' + any;
}

// ------------------------------------------------------------
// El text amb els caràcters especials de l'HTML convertits en
// entitats. El contingut dels actes ve de fora —correus
// d'associacions, formularis— i no pot injectar mai marcatge dins
// del correu. Torna "" si no hi ha res.
// ------------------------------------------------------------
function escapaHtml(text) {
  if (text === null || text === undefined) {
    return '';
  }
  var resultat = String(text);
  resultat = resultat.replace(/&/g, '&amp;');
  resultat = resultat.replace(/</g, '&lt;');
  resultat = resultat.replace(/>/g, '&gt;');
  resultat = resultat.replace(/"/g, '&quot;');
  resultat = resultat.replace(/'/g, '&#39;');
  return resultat;
}
