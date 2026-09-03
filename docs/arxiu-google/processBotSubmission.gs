// ============================================================
// STEP 5 — Typebot webhook submission
// Receives one event from the Typebot form (sent as a webhook /
// HTTP POST) and writes a single row to the "Esdeveniments" sheet
// with estat = pendent, ready for the weekly curator review.
//
// This file does NOT run any email or Gemini logic. Email
// ingestion (Step 4) is a separate, time-triggered function.
// Here there is no AI step: the human filled a structured form,
// so the fields arrive already separated.
//
// The connection between Typebot and this script (deploying the
// web app, getting the URL, wiring the Typebot webhook block) is
// documented apart, in docs/pas-5-typebot-connexio.md. This file
// is only the code that receives and stores the submission.
//
// SHARED HELPERS / CONSTANTS (in utils.gs, one global scope):
//   - readField, creaId, valorPermes, escriuFila
//   - NOM_FULL, COMARCA_VALUES, CATEGORIA_VALUES
// ============================================================

// ------------------------------------------------------------
// Web app entry point. Typebot sends its POST request here.
// Parses the JSON body, hands it to processBotSubmission(), and
// answers with a small JSON object so Typebot knows it worked.
// Returns a ContentService JSON response.
// ------------------------------------------------------------
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    processBotSubmission(body);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('doPost: error processant la petició: ' + error.message);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ------------------------------------------------------------
// Takes the parsed Typebot body (a plain object) and writes one
// row to the "Esdeveniments" sheet. Maps every field by name,
// one at a time — no loops, no dynamic mapping. Returns nothing.
// ------------------------------------------------------------
function processBotSubmission(body) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOM_FULL);
  if (sheet === null) {
    throw new Error('No trobo el full "' + NOM_FULL + '".');
  }

  // --- Fields the association filled in the form ---
  // readField() returns "" for anything missing or blank, so every
  // schema value is always a string (never null, never undefined).
  var titol = readField(body, 'titol');
  var dataInici = readField(body, 'data_inici');
  var dataFi = readField(body, 'data_fi');
  var hora = readField(body, 'hora');
  var lloc = readField(body, 'lloc');
  var municipi = readField(body, 'municipi');
  // The form UI constrains these to the enum values, but the endpoint
  // accepts any POST, so we still filter here — exactly as the email
  // path does. Keeps out-of-enum values out of the sheet on BOTH doors.
  var comarca = valorPermes(readField(body, 'comarca'), COMARCA_VALUES);
  var categoria = valorPermes(readField(body, 'categoria'), CATEGORIA_VALUES);
  var associacio = readField(body, 'associacio');

  // The poster is uploaded straight from the browser to Cloudinary by the
  // Typebot upload step, which sends back the final Cloudinary URL in this
  // field (or "" if the association skipped the upload). We store it as-is.
  var imatgeUrl = readField(body, 'imatge_url');

  // The form collects ONE description plus a flag saying which
  // language it is in ("ca" or "fr"). We put the text on that side
  // and leave the other side empty; the curator fills the missing
  // translation during the weekly review.
  var idiomaDescripcio = readField(body, 'idioma_descripcio');
  var descripcio = readField(body, 'descripcio');
  var descripcioCa = '';
  var descripcioFr = '';
  if (idiomaDescripcio === 'fr') {
    descripcioFr = descripcio;
  } else {
    descripcioCa = descripcio;
  }

  // A single-day event may arrive with an empty data_fi. The schema
  // says data_fi equals data_inici in that case, so fill it in.
  if (dataFi === '') {
    dataFi = dataInici;
  }

  // --- Fields the system fills, never the form ---
  var id = creaId(dataInici, titol);     // YYYY-MM-DD-slug, or "" if no date
  var fontUrl = '';                       // the form has no original-source field
  var estat = 'pendent';                  // always pending: waiting for the curator
  var dataEntrada = new Date().toISOString(); // when this row was created

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
    imatgeUrl,
    fontUrl,
    estat,
    dataEntrada
  ];

  // escriuFila (utils.gs) is the single seam both ingestion paths use.
  escriuFila(sheet, fila);
  Logger.log('processBotSubmission: fila afegida per a "' + titol + '" (estat=pendent).');
}
