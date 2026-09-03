// ============================================================
// STEP 9 (part 1) — Weekly comarca digest: orchestration + Brevo
// sendWeeklyDigest() reads every "publicat" event whose start date
// falls in the next DIES_FINESTRA days, groups them by comarca, and
// for each comarca that has at least one event sends a simple HTML
// digest email to that comarca's Brevo subscriber list.
//
// It runs on its own every Tuesday at HORA_ENVIAMENT (see
// installWeeklyTrigger below). It only READS the sheet; it never
// changes a row and never publishes anything. The events it sends
// were already approved by the curator (estat = publicat).
//
// The email HTML and all date formatting live in digestHtml.gs (the
// pure half); this file is the orchestration and the Brevo calls.
//
// RESILIENCE (audit §4): a script lock and a "sent today" guard stop
// a Google retry or an overlapping run from double-mailing everyone;
// failures that would otherwise vanish into the log also email the
// curator (avisaCurador), and the run warns before it nears Brevo's
// free 300-emails/day ceiling.
//
// SENDING MODEL (decided with Miquel): one TRANSACTIONAL email per
// subscriber (Brevo POST /v3/smtp/email), not a campaign. Consequence
// you must own: Brevo does NOT add an unsubscribe link automatically to
// transactional emails, so digestHtml.gs adds a bilingual "baixa"
// footer and this file a List-Unsubscribe header, and you remove people
// from the Brevo list by hand when they ask. See docs/pas-9-digest-brevo.md.
//
// SHARED HELPERS / CONSTANTS (in utils.gs, one global scope):
//   - getSecret, indexDeColumna, textDeCella
//   - NOM_FULL, COMARCA_VALUES
// HTML + date builders: digestHtml.gs.
//
// SECRETS live in Script Properties (Project Settings -> Script
// properties), NEVER in this file:
//   BREVO_API_KEY        the Brevo API key (header "api-key")
//   BREVO_SENDER_EMAIL   a sender address VERIFIED in your Brevo account
//   BREVO_SENDER_NAME    the display name shown as the sender
//   BREVO_LIST_ROSSELLO  the numeric id of the Rosselló subscriber list
//   BREVO_LIST_CONFLENT  ...Conflent
//   BREVO_LIST_VALLESPIR ...Vallespir
//   BREVO_LIST_CAPCIR    ...Capcir
//   BREVO_LIST_CERDANYA  ...Cerdanya
// A Script Property this file WRITES (not a secret):
//   DIGEST_DARRER_ENVIAMENT  the YYYY-MM-DD of the last send (idempotency)
// ============================================================

// --- Brevo API endpoints ---
var BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
var BREVO_LIST_CONTACTS_URL_BASE = 'https://api.brevo.com/v3/contacts/lists/';

// --- How far ahead the digest looks, in days (today included) ---
var DIES_FINESTRA = 7;

// --- How many contacts to read per page (Brevo's max for this call) ---
var CONTACTES_PER_PAGINA = 500;

// --- Gentle pause between sends so we do not hammer the API (ms) ---
var PAUSA_ENTRE_CORREUS_MS = 150;

// --- When the weekly digest is sent (script timezone). The weekday is
// set in installWeeklyTrigger(); this is the hour, 24h format (15 = 3 pm). ---
var HORA_ENVIAMENT = 15;

// --- Brevo free tier: 300 transactional emails/day. We never cut, but
// we warn the curator once a week's total recipients gets close, so the
// move to Brevo campaigns can be planned before sends start failing. ---
var BREVO_MAX_DIARI = 300;
var BREVO_LLINDAR_AVIS = 280;

// ------------------------------------------------------------
// MAIN. Reads the published events of the coming week, groups them by
// comarca, and sends one digest email per subscriber for each comarca
// that has events. A comarca with no events sends nothing. One comarca
// failing never stops the others. A script lock and a "sent today"
// guard prevent double sends. Logs how many digests went out and to how
// many recipients. Returns nothing.
// ------------------------------------------------------------
function sendWeeklyDigest() {
  // One lock for the whole script. tryLock(0) means: do not wait — if
  // another run already holds it, give up immediately (no overlap).
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    Logger.log('sendWeeklyDigest: ja hi ha una altra execució en marxa. Surto.');
    return;
  }

  try {
    // Read secrets first so we fail fast with a clear message if one is missing.
    var apiKey = getSecret('BREVO_API_KEY');
    var remitent = llegeixRemitent();

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOM_FULL);
    if (sheet === null) {
      throw new Error('No trobo el full "' + NOM_FULL + '". Executa setupSheet() primer.');
    }

    // The window is [today .. today + DIES_FINESTRA], as plain YYYY-MM-DD
    // strings. ISO dates sort the same as text, so we compare as strings.
    var zona = Session.getScriptTimeZone();
    var ara = new Date();
    var avuiText = Utilities.formatDate(ara, zona, 'yyyy-MM-dd');

    // Idempotency guard: if a digest already went out today, do not send
    // again (a Google trigger retry or an overlapping run must never
    // double-mail every subscriber).
    var propietats = PropertiesService.getScriptProperties();
    var darrerEnviament = propietats.getProperty('DIGEST_DARRER_ENVIAMENT');
    if (darrerEnviament === avuiText) {
      Logger.log('sendWeeklyDigest: el digest d\'avui (' + avuiText + ') ja s\'ha enviat. Surto sense reenviar.');
      return;
    }

    var finalText = dataMesDies(ara, DIES_FINESTRA, zona);
    var setmanaText = dataLlegibleCatala(avuiText);

    var esdeveniments = llegeixEsdevenimentsPublicatsAquestaSetmana(sheet, avuiText, finalText);
    if (esdeveniments.length === 0) {
      Logger.log('sendWeeklyDigest: cap esdeveniment publicat dins dels propers ' + DIES_FINESTRA + ' dies. No s\'envia res.');
      return;
    }

    var grups = agrupaPerComarca(esdeveniments);

    // Mark "sent today" BEFORE the send loop. Trade-off (deliberate): if
    // the script dies mid-send, the same-day retry will NOT resend, so a
    // few subscribers may miss one week — preferable to double-mailing
    // everyone.
    propietats.setProperty('DIGEST_DARRER_ENVIAMENT', avuiText);

    var comarquesEnviades = 0;
    var totalDestinataris = 0;
    var totalCorreusEnviats = 0;

    for (var i = 0; i < COMARCA_VALUES.length; i++) {
      var comarca = COMARCA_VALUES[i];
      var esdevenimentsComarca = grups[comarca];
      if (esdevenimentsComarca.length === 0) {
        continue; // a comarca with no upcoming events sends nothing
      }
      // Wrap each comarca on its own: a bad list id or a Brevo error for
      // one comarca must not stop the digests of the others — and it must
      // reach the curator, not just the log.
      try {
        var resultat = enviaDigestComarca(comarca, esdevenimentsComarca, apiKey, remitent, setmanaText);
        comarquesEnviades = comarquesEnviades + 1;
        totalDestinataris = totalDestinataris + resultat.destinataris;
        totalCorreusEnviats = totalCorreusEnviats + resultat.enviats;
      } catch (errorComarca) {
        Logger.log('sendWeeklyDigest: error enviant el digest de ' + comarca + ': ' + errorComarca.message);
        avisaCurador('Agenda: error al digest de ' + comarca,
          'El digest de ' + comarca + ' ha fallat sencer aquesta setmana: ' + errorComarca.message);
      }
    }

    Logger.log('sendWeeklyDigest fet. Comarques amb digest: ' + comarquesEnviades +
      '. Destinataris: ' + totalDestinataris +
      '. Correus enviats: ' + totalCorreusEnviats + '.');

    // Brevo free-tier ceiling awareness (no cut, only a warning).
    if (totalDestinataris >= BREVO_LLINDAR_AVIS) {
      avisaCurador('Agenda: el digest s\'acosta al límit de Brevo',
        'Aquesta setmana el digest ha arribat a ' + totalDestinataris + ' destinataris, a prop del sostre gratuït de Brevo (' +
        BREVO_MAX_DIARI + ' correus transaccionals/dia). Convé planificar el pas a campanyes de Brevo abans que els enviaments comencin a fallar. Vegeu docs/pas-9-digest-brevo.md.');
    }
  } finally {
    // Always release the lock, even if something threw above.
    lock.releaseLock();
  }
}

// ------------------------------------------------------------
// Reads the sender name and address from Script Properties and returns
// them as an object { name: ..., email: ... }. The email MUST be a
// sender verified in your Brevo account or Brevo refuses to send.
// ------------------------------------------------------------
function llegeixRemitent() {
  var nom = getSecret('BREVO_SENDER_NAME');
  var email = getSecret('BREVO_SENDER_EMAIL');
  var remitent = { name: nom, email: email };
  return remitent;
}

// ------------------------------------------------------------
// Returns the date "dies" days after the given date, formatted as a
// YYYY-MM-DD string in the given timezone. Used for the end of the
// digest window.
// ------------------------------------------------------------
function dataMesDies(data, dies, zona) {
  var milisegonsPerDia = 24 * 60 * 60 * 1000;
  var futur = new Date(data.getTime() + dies * milisegonsPerDia);
  return Utilities.formatDate(futur, zona, 'yyyy-MM-dd');
}

// ------------------------------------------------------------
// Reads the "Esdeveniments" sheet and returns an array of event objects
// whose estat is "publicat" and whose data_inici is between avuiText and
// finalText (both inclusive). Columns are located BY NAME from the header
// row, so the function still works if columns are reordered. Cells are
// read with textDeCella (utils.gs), the one cell reader of the project.
// Returns an array (possibly empty), sorted by date then time.
// ------------------------------------------------------------
function llegeixEsdevenimentsPublicatsAquestaSetmana(sheet, avuiText, finalText) {
  var valors = sheet.getDataRange().getValues();
  if (valors.length < 2) {
    return []; // only the header row, or an empty sheet
  }

  var capcaleres = valors[0];
  var colTitol = indexDeColumna(capcaleres, 'titol');
  var colDataInici = indexDeColumna(capcaleres, 'data_inici');
  var colDataFi = indexDeColumna(capcaleres, 'data_fi');
  var colHora = indexDeColumna(capcaleres, 'hora');
  var colLloc = indexDeColumna(capcaleres, 'lloc');
  var colMunicipi = indexDeColumna(capcaleres, 'municipi');
  var colComarca = indexDeColumna(capcaleres, 'comarca');
  var colCategoria = indexDeColumna(capcaleres, 'categoria');
  var colDescCa = indexDeColumna(capcaleres, 'descripcio_ca');
  var colDescFr = indexDeColumna(capcaleres, 'descripcio_fr');
  var colAssociacio = indexDeColumna(capcaleres, 'associacio');
  var colEstat = indexDeColumna(capcaleres, 'estat');

  var esdeveniments = [];
  for (var i = 1; i < valors.length; i++) {
    var fila = valors[i];

    var estat = textDeCella(fila[colEstat]);
    if (estat !== 'publicat') {
      continue;
    }

    var dataInici = textDeCella(fila[colDataInici]);
    // An empty date is "" which is < avuiText, so undated rows fall out here.
    if (dataInici < avuiText) {
      continue;
    }
    if (dataInici > finalText) {
      continue;
    }

    var esdeveniment = {
      titol: textDeCella(fila[colTitol]),
      data_inici: dataInici,
      data_fi: textDeCella(fila[colDataFi]),
      hora: textDeCella(fila[colHora]),
      lloc: textDeCella(fila[colLloc]),
      municipi: textDeCella(fila[colMunicipi]),
      comarca: textDeCella(fila[colComarca]),
      categoria: textDeCella(fila[colCategoria]),
      descripcio_ca: textDeCella(fila[colDescCa]),
      descripcio_fr: textDeCella(fila[colDescFr]),
      associacio: textDeCella(fila[colAssociacio])
    };
    esdeveniments.push(esdeveniment);
  }

  esdeveniments.sort(comparaPerDataIHora);
  return esdeveniments;
}

// ------------------------------------------------------------
// Comparator for Array.sort: orders events by start date, then by time,
// ascending. Both fields are strings. Returns a negative, zero or
// positive number.
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
// Splits the events into one array per comarca, keyed by comarca name.
// Only the five known comarques are kept; an event with an empty or
// unknown comarca is ignored (it cannot be placed in any digest).
// Returns an object: { "Rosselló": [...], "Conflent": [...], ... }.
// ------------------------------------------------------------
function agrupaPerComarca(esdeveniments) {
  var grups = {};
  for (var i = 0; i < COMARCA_VALUES.length; i++) {
    grups[COMARCA_VALUES[i]] = [];
  }

  for (var j = 0; j < esdeveniments.length; j++) {
    var comarca = esdeveniments[j].comarca;
    if (grups[comarca] !== undefined) {
      grups[comarca].push(esdeveniments[j]);
    }
  }
  return grups;
}

// ------------------------------------------------------------
// Sends the digest for ONE comarca: builds the subject and the HTML,
// looks up the comarca's Brevo list, fetches its contacts, and sends one
// transactional email per contact. Returns an object
// { destinataris: <int>, enviats: <int> }. Throws on a configuration
// error (missing or invalid list id) so the caller can skip this comarca.
// ------------------------------------------------------------
function enviaDigestComarca(comarca, esdeveniments, apiKey, remitent, setmanaText) {
  var llistaId = idDeLlistaPerComarca(comarca);
  var assumpte = construeixAssumpte(comarca, setmanaText);
  var html = construeixHtmlDigest(comarca, esdeveniments, setmanaText);

  var destinataris = obteContactesDeLlista(llistaId, apiKey);

  var enviats = 0;
  for (var i = 0; i < destinataris.length; i++) {
    var email = destinataris[i];
    // One bad recipient must not stop the rest of the list.
    try {
      enviaCorreuTransaccional(apiKey, remitent, email, assumpte, html);
      enviats = enviats + 1;
    } catch (errorCorreu) {
      Logger.log('enviaDigestComarca: no s\'ha pogut enviar a ' + email + ' (' + comarca + '): ' + errorCorreu.message);
    }
    Utilities.sleep(PAUSA_ENTRE_CORREUS_MS);
  }

  Logger.log('Digest de ' + comarca + ': ' + destinataris.length + ' destinataris, ' + enviats + ' correus enviats.');

  // A list with people in it but zero sends means the whole list failed
  // (bad id, Brevo down): surface it to the curator, not only the log.
  if (enviats === 0 && destinataris.length > 0) {
    avisaCurador('Agenda: 0 enviaments al digest de ' + comarca,
      'La llista de ' + comarca + ' té ' + destinataris.length + ' destinataris però no s\'ha pogut enviar cap correu. Revisa la configuració de Brevo.');
  }

  var resultat = { destinataris: destinataris.length, enviats: enviats };
  return resultat;
}

// ------------------------------------------------------------
// Reads the Brevo list id for this comarca from Script Properties and
// returns it as a string. Throws if the property is missing or is not a
// plain number, so a misconfiguration fails with a clear message.
// ------------------------------------------------------------
function idDeLlistaPerComarca(comarca) {
  var propietat = propietatLlistaPerComarca(comarca);
  var valor = getSecret(propietat);
  if (!/^[0-9]+$/.test(valor)) {
    throw new Error('La Script Property "' + propietat + '" ha de ser un nombre (l’id de la llista de Brevo). Valor actual: "' + valor + '".');
  }
  return valor;
}

// ------------------------------------------------------------
// Returns the Script Property name that holds the Brevo list id for this
// comarca. Explicit one-by-one mapping, no transliteration tricks.
// Throws on an unknown comarca. Returns the property name (a string).
// ------------------------------------------------------------
function propietatLlistaPerComarca(comarca) {
  if (comarca === 'Rosselló') {
    return 'BREVO_LIST_ROSSELLO';
  }
  if (comarca === 'Conflent') {
    return 'BREVO_LIST_CONFLENT';
  }
  if (comarca === 'Vallespir') {
    return 'BREVO_LIST_VALLESPIR';
  }
  if (comarca === 'Capcir') {
    return 'BREVO_LIST_CAPCIR';
  }
  if (comarca === 'Cerdanya') {
    return 'BREVO_LIST_CERDANYA';
  }
  throw new Error('Comarca desconeguda: "' + comarca + '".');
}

// ------------------------------------------------------------
// Returns the email subject line for a comarca's digest, in the agreed
// format: "Agenda cultural — [Comarca] — setmana del [data]".
// ------------------------------------------------------------
function construeixAssumpte(comarca, setmanaText) {
  return 'Agenda cultural — ' + comarca + ' — setmana del ' + setmanaText;
}

// ------------------------------------------------------------
// Fetches every non-blacklisted contact email of a Brevo list, paging
// through the results CONTACTES_PER_PAGINA at a time. Skips contacts that
// Brevo has blacklisted (they unsubscribed or bounced). Returns an array
// of email strings (possibly empty). Throws on an API error.
// ------------------------------------------------------------
function obteContactesDeLlista(llistaId, apiKey) {
  var emails = [];
  var offset = 0;

  // Early-break loop: the normal case (a full page) stays at the top
  // level, and each stop condition is its own explicit break.
  while (true) {
    var pagina = obtePaginaContactes(llistaId, apiKey, offset);
    var contactes = pagina.contacts;

    if (contactes === undefined || contactes === null || contactes.length === 0) {
      break; // no (more) contacts
    }

    for (var i = 0; i < contactes.length; i++) {
      var contacte = contactes[i];
      if (contacte.emailBlacklisted === true) {
        continue; // respect unsubscribes and bounces
      }
      if (contacte.email !== undefined && contacte.email !== null && contacte.email !== '') {
        emails.push(contacte.email);
      }
    }

    // A page smaller than the page size means there are no more contacts.
    if (contactes.length < CONTACTES_PER_PAGINA) {
      break;
    }
    offset = offset + CONTACTES_PER_PAGINA;
  }

  return emails;
}

// ------------------------------------------------------------
// Fetches ONE page of a Brevo list's contacts. Returns the parsed
// response object (which has a .contacts array). Throws on a non-200
// response. The API key is only used in the header, never logged.
// ------------------------------------------------------------
function obtePaginaContactes(llistaId, apiKey, offset) {
  var url = BREVO_LIST_CONTACTS_URL_BASE + llistaId + '/contacts' +
    '?limit=' + CONTACTES_PER_PAGINA + '&offset=' + offset;

  var options = {
    method: 'get',
    headers: {
      'api-key': apiKey,
      'accept': 'application/json'
    },
    muteHttpExceptions: true
  };

  var resposta = UrlFetchApp.fetch(url, options);
  var codi = resposta.getResponseCode();
  if (codi !== 200) {
    throw new Error('Brevo (contactes de la llista ' + llistaId + ') ha respost amb codi ' + codi + ': ' + resposta.getContentText());
  }

  var dades = JSON.parse(resposta.getContentText());
  return dades;
}

// ------------------------------------------------------------
// Sends ONE transactional email through Brevo to a single recipient.
// Adds a List-Unsubscribe header pointing to the sender address so email
// clients can offer an unsubscribe option. Sending one message per
// recipient (not one with many addresses) keeps each subscriber's email
// private. Returns nothing. Throws on any response that is not 201/202.
// ------------------------------------------------------------
function enviaCorreuTransaccional(apiKey, remitent, emailDestinatari, assumpte, html) {
  var destinatari = { email: emailDestinatari };
  var capcaleraBaixa = '<mailto:' + remitent.email + '?subject=baixa>';

  var cos = {
    sender: remitent,
    to: [destinatari],
    subject: assumpte,
    htmlContent: html,
    headers: {
      'List-Unsubscribe': capcaleraBaixa
    }
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'api-key': apiKey,
      'accept': 'application/json'
    },
    payload: JSON.stringify(cos),
    muteHttpExceptions: true
  };

  var resposta = UrlFetchApp.fetch(BREVO_SEND_URL, options);
  var codi = resposta.getResponseCode();
  if (codi !== 201 && codi !== 202) {
    throw new Error('Brevo (enviament) ha respost amb codi ' + codi + ': ' + resposta.getContentText());
  }
}

// ------------------------------------------------------------
// Sends a short warning email to the curator (the script's effective
// user). Used for silent-failure paths: a whole comarca failing, or the
// weekly total nearing Brevo's ceiling. Wrapped in try/catch so a notify
// failure never breaks the digest itself. Returns nothing.
// ------------------------------------------------------------
function avisaCurador(assumpte, detall) {
  try {
    var email = Session.getEffectiveUser().getEmail();
    if (email === null || email === '') {
      Logger.log('avisaCurador: no hi ha adreça de curador on avisar.');
      return;
    }
    MailApp.sendEmail(email, assumpte, detall);
  } catch (errorAvis) {
    Logger.log('avisaCurador: no s\'ha pogut enviar l\'avís al curador: ' + errorAvis.message);
  }
}

// ------------------------------------------------------------
// SETUP — run installWeeklyTrigger() ONCE by hand from the editor to make
// sendWeeklyDigest() run every Tuesday at HORA_ENVIAMENT (script
// timezone). Safe to re-run: it removes any existing trigger for
// sendWeeklyDigest first, so you never end up with duplicates. Returns
// nothing.
// ------------------------------------------------------------
function installWeeklyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendWeeklyDigest') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('sendWeeklyDigest')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.TUESDAY)
    .atHour(HORA_ENVIAMENT)
    .create();
  Logger.log('installWeeklyTrigger: activador setmanal de sendWeeklyDigest instal·lat (dimarts a les ' + HORA_ENVIAMENT + ':00).');
}
