// ============================================================
// WORKER — «Què fas?» · l'únic servidor del projecte
//
// Aquesta FASE 2 només implementa el gestor `email()`: cada correu
// que arriba a agenda@clm.cat es converteix en una fila pendent de
// `pendents.json`, i l'original SEMPRE acaba arxivat al Gmail.
// Els gestors `fetch()` (formulari Typebot) i `scheduled()` (digest
// Brevo) són les fases 3a i 3b: encara no hi són.
//
// EL CAMÍ D'UN CORREU, en ordre:
//   1. reenviament a l'arxiu  ← el primer de tot, i passi el que passi
//   2. postal-mime            → assumpte + cos de text + adjunts
//   3. Gemini                 → els 11 camps que el model pot deduir
//   4. Cloudinary             → el primer cartell adjunt (opcional)
//   5. pendents.json          → una fila de 16 cadenes, estat "pendent"
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
// SECRETS I VARIABLES. Cap valor no viu mai dins d'aquest fitxer.
// Tres són Secrets al tauler de Cloudflare (el Worker > Settings >
// Variables and Secrets):
//   GEMINI_API_KEY         (la clau d'AI Studio)
//   GITHUB_TOKEN           (gra fi, només aquest repositori, permís
//                           únic `contents: write`)
//   ADRECA_ARXIU           (el Gmail d'arxiu; ha de ser una destinació
//                           VERIFICADA a l'Email Routing, si no el
//                           reenviament falla. És Secret perquè el
//                           repositori és públic i és una adreça
//                           personal, no perquè sigui cap contrasenya)
// I una viu a `wrangler.jsonc`, com a `vars`:
//   CLOUDINARY_CLOUD_NAME  (no és secreta de cap manera: surt a l'URL
//                           de cada cartell del web públic. Va a la
//                           configuració i no al tauler perquè
//                           `wrangler deploy` esborra les variables de
//                           text del tauler a cada desplegament; els
//                           Secrets, en canvi, no els toca)
//
// DESPLEGAMENT: vegeu docs/pas-fase2-worker-email.md.
// ============================================================

import PostalMime from './postal-mime.js';

// --- El repositori. Les mateixes coordenades que curador.html ---
var GITHUB_OWNER = 'CLMVallespir';
var GITHUB_REPO = 'agenda-catalogne-nord';
var GITHUB_BRANCH = 'main';
var FITXER_PENDENTS = 'pendents.json';

// --- L'API de Gemini (nivell gratuït d'AI Studio) ---
// El nom del model viu en UNA constant i prou. Si algun dia torna un
// 404 amb el nom del model a dins, és el cicle de vida normal de
// Google: mira quins Flash / Flash-Lite hi ha vigents i canvia-la.
// Mai la gamma Pro, que és de pagament.
var GEMINI_MODEL = 'gemini-3.5-flash-lite';
var GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';
var GEMINI_MAX_TOKENS = 4096;

// --- Cloudinary: pujada sense signatura (docs/pas-3-cloudinary.md) ---
// El preset ja porta la carpeta (agenda-nord/posters) i la
// transformació d'entrada (w_800,c_limit,q_80,f_webp), que és la que
// converteix un PDF en un WebP de la primera pàgina. Aquí només cal
// el nom del cloud: cap signatura, cap secret.
var CLOUDINARY_PRESET = 'agenda-posters';

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
  'Patrimoni i tradicions'
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
- categoria: NOMÉS una d'aquestes deu, escrita exactament així: Música, Teatre, Dansa i ball, Conferència, Exposició, Mercat, Cinema, Taller, Activitat infantil, Patrimoni i tradicions. Si cap no encaixa clarament, cadena buida.
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
  await afegeixAPendents(fila, env.GITHUB_TOKEN);
  console.log('processaCorreu(): fila afegida a la cua. id: "' + fila.id + '".');
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
// Còpia literal de creaId (apps-script/utils.gs, curador.html). Fa
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
// Còpia literal de valorPermes (apps-script/utils.gs, curador.html).
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
// ------------------------------------------------------------
async function afegeixAPendents(fila, token) {
  if (!token) {
    throw new Error('falta el secret GITHUB_TOKEN.');
  }

  var titol = fila.titol;
  if (titol === '') {
    titol = '(sense títol)';
  }
  var missatgeCommit = 'Correu nou a la cua: ' + titol;

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
