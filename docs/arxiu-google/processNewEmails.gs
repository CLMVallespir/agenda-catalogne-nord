// ============================================================
// STEP 4 — Gmail ingestion
// processNewEmails() reads new association emails, sends each one
// to the Gemini API for extraction, optionally uploads the first
// image attachment to Cloudinary, and writes ONE row per email to
// the "Esdeveniments" sheet with estat = pendent, ready for the
// weekly curator review.
//
// It runs on its own every hour (see installHourlyTrigger below).
// Nothing here publishes anything online: every row lands as
// "pendent" and waits for the human review. That review is also
// the safety net against a malicious or malformed email — no email
// content ever reaches the public site without the curator's OK.
//
// Gmail state is driven by labels:
//   agenda-entrant  -> incoming, waiting to be processed (you create
//                      this label by hand, or with a Gmail filter)
//   agenda-traitat  -> done, a row was written
//   agenda-error    -> something failed; left for you to look at
// The script creates agenda-traitat and agenda-error if missing.
//
// SHARED HELPERS / CONSTANTS (in utils.gs, one global scope):
//   - getSecret, readField, creaId, valorPermes, escriuFila
//   - NOM_FULL, COMARCA_VALUES, CATEGORIA_VALUES
//
// SECRETS live in Script Properties (Project Settings -> Script
// properties), NEVER in this file:
//   GEMINI_API_KEY          (used here)
//   CLOUDINARY_CLOUD_NAME   (used here)
//   CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET  (not used here:
//       the upload preset is unsigned; kept only for admin tasks)
//   GITHUB_TOKEN            (not used here: that is Step 7)
// ============================================================

// --- Gmail labels (created by hand or by the script, see above) ---
var LABEL_ENTRANT = 'agenda-entrant';
var LABEL_TRAITAT = 'agenda-traitat';
var LABEL_ERROR = 'agenda-error';

// --- How many email threads to handle in one run ---
// Each email costs one Gemini call plus maybe one image upload.
// Apps Script stops a run after ~6 minutes, so we cap the batch and
// let the rest wait for the next hourly run.
var MAX_THREADS_PER_RUN = 10;

// --- How many emails from the SAME sender to handle in one run ---
// Beyond this, the sender's remaining emails wait for the next run,
// so one source cannot fill the whole batch and starve the others.
var MAX_PER_REMITENT = 3;

// --- Gemini API (the extraction call, Google AI Studio free tier) ---
var GEMINI_MODEL = 'gemini-2.5-flash';
var GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';
var GEMINI_MAX_TOKENS = 2048;

// --- Cloudinary (unsigned upload preset, see docs/pas-3-cloudinary.md) ---
var CLOUDINARY_PRESET = 'agenda-posters';

// The extraction prompt. This is a VERBATIM copy of
// prompts/extract-event.txt (the human-readable, testable master).
// If you change one, change the other so they stay identical.
// It ends on the "CORREU:" line; the email text is appended after it.
// (The only character escaped below is the markdown code-fence ```,
// written \`\`\` because this text lives inside back-tick quotes.)
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

// ------------------------------------------------------------
// MAIN. Reads every new "agenda-entrant" email and turns each one
// into a pending row. Takes a lock so two runs never overlap, caps
// the batch, labels each thread done or error, logs a summary.
// Returns nothing.
// ------------------------------------------------------------
function processNewEmails() {
  // One lock for the whole script. tryLock(0) means: do not wait —
  // if another run already holds it, give up immediately.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    Logger.log('processNewEmails: ja hi ha una altra execució en marxa. Surto.');
    return;
  }

  try {
    // Read secrets first so we fail fast with a clear message if one is missing.
    var apiKey = getSecret('GEMINI_API_KEY');
    var cloudName = getSecret('CLOUDINARY_CLOUD_NAME');

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOM_FULL);
    if (sheet === null) {
      throw new Error('No trobo el full "' + NOM_FULL + '". Executa setupSheet() primer.');
    }

    // The incoming label must already exist (you create it, or a filter does).
    var labelEntrant = GmailApp.getUserLabelByName(LABEL_ENTRANT);
    if (labelEntrant === null) {
      Logger.log('processNewEmails: l\'etiqueta "' + LABEL_ENTRANT + '" encara no existeix. Crea-la a Gmail. Surto.');
      return;
    }
    var labelTraitat = getOrCreateLabel(LABEL_TRAITAT);
    var labelError = getOrCreateLabel(LABEL_ERROR);

    // Today's date (script timezone) for the prompt's {{AVUI}} placeholder.
    var avui = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

    // GmailApp.search returns the newest threads first. Reverse to a
    // FIFO queue so the OLDEST legitimate email is handled first and a
    // recent flood cannot bury it run after run.
    var threads = findIncomingThreads();
    threads.reverse();

    // Per-sender cap WITHIN this run: after MAX_PER_REMITENT emails from
    // the same sender, leave the rest unread so they defer to the next
    // cycle. Stops one source from eating the whole batch and starving
    // the shared Gemini quota.
    var comptePerRemitent = {};
    var correusMirats = 0;
    var filesAfegides = 0;
    var correusAjornats = 0;

    for (var i = 0; i < threads.length; i++) {
      var thread = threads[i];
      var remitent = remitentDelThread(thread);
      var vistosDaquestRemitent = comptePerRemitent[remitent] || 0;
      if (vistosDaquestRemitent >= MAX_PER_REMITENT) {
        // Leave it unread and unlabelled: the next run picks it up.
        correusAjornats++;
        continue;
      }
      comptePerRemitent[remitent] = vistosDaquestRemitent + 1;

      correusMirats++;
      // Each email is independent: if one fails, log it, label it as
      // error, and carry on with the rest. One bad email never stops
      // the batch and never leaves the lock held.
      try {
        processaThread(thread, sheet, apiKey, cloudName, avui);
        marcaThreadAmbEtiqueta(thread, labelTraitat);
        filesAfegides++;
      } catch (errorCorreu) {
        Logger.log('processNewEmails: error amb el correu "' + thread.getFirstMessageSubject() + '": ' + errorCorreu.message);
        marcaThreadAmbEtiqueta(thread, labelError);
      }
    }

    Logger.log('processNewEmails fet. Correus mirats: ' + correusMirats +
      '. Files afegides: ' + filesAfegides +
      '. Correus ajornats (límit per remitent): ' + correusAjornats + '.');
  } finally {
    // Always release the lock, even if something threw above.
    lock.releaseLock();
  }
}

// ------------------------------------------------------------
// Handles ONE email thread end to end: read text, upload the first
// image or PDF (if any), ask Gemini, build the row, write it. Throws on any
// failure so the caller can label the thread as error. Returns nothing.
// ------------------------------------------------------------
function processaThread(thread, sheet, apiKey, cloudName, avui) {
  // One thread = one event. We read the first message of the thread.
  var message = thread.getMessages()[0];
  var textCorreu = extreuTextCorreu(message);

  // Ask Gemini FIRST. If the extraction fails, we throw here and the
  // only state touched is the thread's error label — no poster is
  // uploaded, so a failed email never leaves an orphan asset on
  // Cloudinary (and a manual retry never duplicates it).
  var dadesExtretes = demanaExtraccioGemini(textCorreu, apiKey, avui);

  // Poster is optional: only now, with a valid extraction in hand,
  // upload the first image or PDF attachment, if any.
  var imatgeUrl = '';
  var cartell = primerCartellAdjunt(message);
  if (cartell !== null) {
    imatgeUrl = pujaImatgeCloudinary(cartell, cloudName);
  }

  var fila = construeixFila(dadesExtretes, imatgeUrl);
  escriuFila(sheet, fila);
}

// ------------------------------------------------------------
// Searches Gmail for threads that are labelled agenda-entrant, still
// unread, and not yet marked done or error. Returns up to
// MAX_THREADS_PER_RUN threads (an array, possibly empty).
// ------------------------------------------------------------
function findIncomingThreads() {
  var query = 'label:' + LABEL_ENTRANT +
    ' is:unread' +
    ' -label:' + LABEL_TRAITAT +
    ' -label:' + LABEL_ERROR;
  return GmailApp.search(query, 0, MAX_THREADS_PER_RUN);
}

// ------------------------------------------------------------
// Builds the text we send to the model: the subject line, a blank line,
// then the plain-text body. The prompt itself is added separately.
// Returns the combined string.
// ------------------------------------------------------------
function extreuTextCorreu(message) {
  var assumpte = message.getSubject();
  var cos = message.getPlainBody();
  if (assumpte === null) {
    assumpte = '';
  }
  if (cos === null) {
    cos = '';
  }
  return 'Assumpte: ' + assumpte + '\n\n' + cos;
}

// ------------------------------------------------------------
// Returns the first attachment usable as a poster (an image OR a PDF),
// or null. Inline images (signature logos, social icons) are skipped on
// purpose so they are not mistaken for the poster. PDFs are accepted:
// Cloudinary's agenda-posters preset converts them to a WebP image (of
// the first page) via its f_webp incoming transformation.
// ------------------------------------------------------------
function primerCartellAdjunt(message) {
  var adjunts = message.getAttachments({ includeInlineImages: false, includeAttachments: true });
  for (var i = 0; i < adjunts.length; i++) {
    var tipus = adjunts[i].getContentType();
    if (tipus === null) {
      continue;
    }
    if (tipus.indexOf('image/') === 0 || tipus === 'application/pdf') {
      return adjunts[i];
    }
  }
  return null;
}

// ------------------------------------------------------------
// Uploads one poster (image or PDF) to Cloudinary with the unsigned
// agenda-posters preset (no signature, no secret needed). The preset
// resizes and converts to WebP (a PDF becomes a WebP of its first
// page). Returns the public secure URL. Throws on a non-200 response.
// ------------------------------------------------------------
function pujaImatgeCloudinary(imatgeBlob, cloudName) {
  var url = 'https://api.cloudinary.com/v1_1/' + cloudName + '/image/upload';
  var payload = {
    upload_preset: CLOUDINARY_PRESET,
    file: imatgeBlob
  };
  var options = {
    method: 'post',
    payload: payload,
    muteHttpExceptions: true
  };

  var resposta = UrlFetchApp.fetch(url, options);
  var codi = resposta.getResponseCode();
  if (codi !== 200) {
    throw new Error('Cloudinary ha respost amb codi ' + codi + ': ' + resposta.getContentText());
  }

  var dades = JSON.parse(resposta.getContentText());
  return dades.secure_url;
}

// ------------------------------------------------------------
// Sends the email text to the Gemini API with the extraction prompt
// and returns Gemini's answer parsed into a plain object (the 16
// schema fields). Uses JSON mode (responseMimeType) so the answer is
// valid JSON. Throws on a non-200 response or an empty/blocked answer.
// The API key is only used in a header, never logged.
// ------------------------------------------------------------
function demanaExtraccioGemini(textCorreu, apiKey, avui) {
  var prompt = EXTRACTION_PROMPT.replace('{{AVUI}}', avui);
  var contingut = prompt + textCorreu;

  var cos = {
    contents: [
      { parts: [ { text: contingut } ] }
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: GEMINI_MAX_TOKENS,
      responseMimeType: 'application/json',
      // gemini-2.5-flash "thinks" by default, and those thinking tokens
      // count against maxOutputTokens — which can cut off the JSON before
      // it closes. This is a plain extraction task, so we turn thinking off.
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-goog-api-key': apiKey
    },
    payload: JSON.stringify(cos),
    muteHttpExceptions: true
  };

  var resposta = UrlFetchApp.fetch(GEMINI_URL, options);
  var codi = resposta.getResponseCode();
  if (codi !== 200) {
    throw new Error('Gemini ha respost amb codi ' + codi + ': ' + resposta.getContentText());
  }

  var dades = JSON.parse(resposta.getContentText());
  var text = extreuTextResposta(dades);
  return analitzaJsonResposta(text);
}

// ------------------------------------------------------------
// Digs the answer text out of Gemini's response object. Throws a clear
// error if there is no candidate or the answer was blocked/empty (so
// the email goes to agenda-error instead of a broken row). Returns the
// answer text.
// ------------------------------------------------------------
function extreuTextResposta(dades) {
  if (!dades.candidates || dades.candidates.length === 0) {
    throw new Error('Gemini no ha tornat cap resposta (potser bloquejada): ' + JSON.stringify(dades));
  }
  var candidat = dades.candidates[0];
  if (candidat.finishReason === 'MAX_TOKENS') {
    throw new Error('La resposta de Gemini s\'ha tallat (MAX_TOKENS): apuja GEMINI_MAX_TOKENS.');
  }
  if (!candidat.content || !candidat.content.parts || candidat.content.parts.length === 0) {
    throw new Error('La resposta de Gemini no conté text (finishReason: ' + candidat.finishReason + ').');
  }
  return candidat.content.parts[0].text;
}

// ------------------------------------------------------------
// Turns the model's text answer into an object. The model is told to
// reply with JSON only, but to be safe we take the substring from the
// first "{" to the last "}" before parsing (this tolerates a stray code
// fence or line). Throws if no JSON object is found. Returns the object.
// ------------------------------------------------------------
function analitzaJsonResposta(text) {
  var inici = text.indexOf('{');
  var fi = text.lastIndexOf('}');
  if (inici === -1 || fi === -1 || fi < inici) {
    throw new Error('La resposta del model no conté cap objecte JSON: ' + text);
  }

  var nomesJson = text.substring(inici, fi + 1);
  var objecte = JSON.parse(nomesJson);
  if (typeof objecte !== 'object' || objecte === null || Array.isArray(objecte)) {
    throw new Error('La resposta del model no és un objecte JSON.');
  }
  return objecte;
}

// ------------------------------------------------------------
// Builds the 16-field row in the exact schema order, mapping every
// field by name (no loops, no index magic). The model's text fields are
// read with readField (always a trimmed string). comarca and
// categoria are checked against the allowed lists. id is rebuilt with
// creaId so it is formatted identically to the Typebot path, never
// trusting the model's own id. imatge_url comes from Cloudinary; font_url,
// estat and data_entrada are set by the system. Returns the row array.
// ------------------------------------------------------------
function construeixFila(dadesExtretes, imatgeUrl) {
  var titol = readField(dadesExtretes, 'titol');
  var dataInici = readField(dadesExtretes, 'data_inici');
  var dataFi = readField(dadesExtretes, 'data_fi');
  var hora = readField(dadesExtretes, 'hora');
  var lloc = readField(dadesExtretes, 'lloc');
  var municipi = readField(dadesExtretes, 'municipi');
  var comarca = valorPermes(readField(dadesExtretes, 'comarca'), COMARCA_VALUES);
  var categoria = valorPermes(readField(dadesExtretes, 'categoria'), CATEGORIA_VALUES);
  var descripcioCa = readField(dadesExtretes, 'descripcio_ca');
  var descripcioFr = readField(dadesExtretes, 'descripcio_fr');
  var associacio = readField(dadesExtretes, 'associacio');

  // A single-day event may arrive with an empty data_fi. The schema
  // says data_fi equals data_inici in that case, so fill it in.
  if (dataFi === '') {
    dataFi = dataInici;
  }

  // --- Fields the system fills, never the model ---
  var id = creaId(dataInici, titol);          // YYYY-MM-DD-slug, or "" if no date
  var imatge = imatgeUrl;                      // Cloudinary URL, or "" if no image
  var fontUrl = '';                            // no original source link from an email
  var estat = 'pendent';                       // always pending: waiting for the curator
  var dataEntrada = new Date().toISOString();  // when this row was created

  // Assemble the row in the exact schema order (see COLUMN_HEADERS, utils.gs).
  var fila = [
    id,
    titol,
    dataInici,
    dataFi,
    hora,
    lloc,
    municipi,
    comarca,
    categoria,
    descripcioCa,
    descripcioFr,
    associacio,
    imatge,
    fontUrl,
    estat,
    dataEntrada
  ];
  return fila;
}

// ------------------------------------------------------------
// Returns the sender of a thread's first message (the "From" line,
// e.g. "Nom <adreca@exemple.cat>"), used to count emails per sender
// within one run. Returns "" if it cannot be read, so an unreadable
// sender never breaks the batch (all such threads share one bucket).
// ------------------------------------------------------------
function remitentDelThread(thread) {
  var message = thread.getMessages()[0];
  var remitent = message.getFrom();
  if (remitent === null || remitent === undefined) {
    return '';
  }
  return String(remitent).trim();
}

// ------------------------------------------------------------
// Marks a thread as read and adds one label to it (agenda-traitat for
// success, agenda-error for failure). Returns nothing.
// ------------------------------------------------------------
function marcaThreadAmbEtiqueta(thread, etiqueta) {
  thread.markRead();
  thread.addLabel(etiqueta);
}

// ------------------------------------------------------------
// Returns the Gmail label with this name, creating it if it does not
// exist yet. Used for agenda-traitat and agenda-error.
// ------------------------------------------------------------
function getOrCreateLabel(nom) {
  var label = GmailApp.getUserLabelByName(nom);
  if (label === null) {
    label = GmailApp.createLabel(nom);
  }
  return label;
}

// ------------------------------------------------------------
// SETUP — run installHourlyTrigger() ONCE by hand from the editor to
// make processNewEmails() run every hour. Safe to re-run: it removes
// any existing trigger for processNewEmails first, so you never end up
// with duplicates. Returns nothing.
// ------------------------------------------------------------
function installHourlyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'processNewEmails') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('processNewEmails')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log('installHourlyTrigger: activador horari de processNewEmails instal·lat.');
}
