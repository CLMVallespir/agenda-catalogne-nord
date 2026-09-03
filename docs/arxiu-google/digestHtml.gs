// ============================================================
// STEP 9 (part 2) — Digest HTML + date formatting
// The PURE half of the weekly digest: it builds the email HTML and
// formats dates, and calls NO Google service and NO Brevo API. Split
// out of sendWeeklyDigest.gs (which kept the orchestration + Brevo)
// so each file has one responsibility and this half is testable in
// isolation (tests.gs exercises finsAl, objecteDataDe, escapaHtml…).
//
// DESIGN: the email mirrors the website (white card, ink text, "sang
// i or" only as accent). Events are grouped by day under a
// "30 Juny, Dimarts · 30 Juin, Mardi" header with a small gold dot;
// time and the "Fins al ..." date carry the red/gold accent; category
// shows as a small black tag. No custom fonts, no images, so it
// renders well in every email client. Table-based, inline styles only.
// ============================================================

// --- Public site URL (optional). If set, the footer shows a link to
// the whole agenda; leave "" to omit it. ---
var AGENDA_URL = '';

// --- Brand colours (the website's "sang i or", used only as accents) ---
var COLOR_TINTA = '#1a1a1a';        // near-black, titles and day headers
var COLOR_TINTA_SUAU = '#6f6862';   // muted ink, French + secondary text
var COLOR_ACCENT = '#b5121b';       // red, used only for date and time
var COLOR_OR = '#fcdd09';           // gold, used only for the day dot
var COLOR_VORA = '#e7e4df';         // hairlines and the card border
var COLOR_VORA_SUAU = '#f0ede7';    // divider between events
var COLOR_FONS = '#f2f1ed';         // page background behind the card

// --- Month and weekday names, kept identical to the website ---
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
// Builds the full HTML email for one comarca: a white card on a light
// page, with an ink header (no red band), the events grouped by day, and
// the footer. Table-based, inline styles only. Returns the HTML string.
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
// Builds a day header like "30 Juny, Dimarts · 30 Juin, Mardi" with a
// small gold dot, matching the website. Catalan first, French in italics.
// Returns the HTML as a string.
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

  var dot = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:' + COLOR_OR + ';margin-right:8px;vertical-align:middle;"></span>';

  var html =
    '<div style="border-bottom:1px solid ' + COLOR_VORA + ';padding-bottom:6px;margin:22px 0 10px;">' +
    dot +
    '<span style="font-family:Georgia,\'Times New Roman\',serif;font-weight:bold;font-size:15px;color:' + COLOR_TINTA + ';vertical-align:middle;">' + escapaHtml(textCa) + '</span>';
  if (textFr !== '') {
    html = html + '<span lang="fr" style="font-family:Georgia,\'Times New Roman\',serif;font-style:italic;font-size:13px;color:' + COLOR_TINTA_SUAU + ';vertical-align:middle;"> · ' + escapaHtml(textFr) + '</span>';
  }
  html = html + '</div>';
  return html;
}

// ------------------------------------------------------------
// Builds the HTML for ONE event: a small black category tag, the title
// (near-black), the meta line (time and "Fins al ..." in the red accent,
// plus the venue), the Catalan description, the French one in italics,
// and the organiser. Every dynamic value is HTML-escaped. Returns the
// HTML as a string.
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
// Returns a small black "tag" with the category name, or "" if there is
// no category. The value is HTML-escaped. Returns the HTML string.
// ------------------------------------------------------------
function construeixXipCategoria(categoria) {
  if (categoria === '') {
    return '';
  }
  var text = escapaHtml(categoria);
  return '<span style="display:inline-block;background-color:' + COLOR_TINTA + ';color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;padding:3px 9px;">' + text + '</span>';
}

// ------------------------------------------------------------
// Builds the meta line of one event: the time ("HH:MM h", in the accent
// colour), the venue and town, and for a multi-day event the "Fins al ...
// · Jusqu'au ..." end date (also accent). Parts are joined with " · ".
// Every value is HTML-escaped. Returns the line, or "" if empty.
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
// Wraps a piece of text in a red, bold accent span (used for the date and
// time). The text is HTML-escaped. Returns the HTML string.
// ------------------------------------------------------------
function spanAccent(text) {
  return '<span style="color:' + COLOR_ACCENT + ';font-weight:bold;">' + escapaHtml(text) + '</span>';
}

// ------------------------------------------------------------
// Returns the venue text combining lloc and municipi: "lloc, municipi",
// just one of them, or "" if neither is known. Returns RAW text (not
// escaped); the caller escapes it.
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
// Returns the bilingual "Fins al ... · Jusqu'au ..." phrase for an end
// date, with correct Catalan contractions (a l'1, al 20, d'agost), to
// match the website. Returns "" if the date is invalid.
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
// Returns true if a word starts with a vowel (for the de/d' contraction).
// ------------------------------------------------------------
function comencaAmbVocal(paraula) {
  return 'aeiouàéèíòóú'.indexOf(paraula.charAt(0)) !== -1;
}

// ------------------------------------------------------------
// Parses "YYYY-MM-DD" into a Date in the script timezone (used only to
// read the weekday and day number). Returns null if the format is wrong.
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
// Returns the Catalan day label "30 Juny, Dimarts" for a Date.
// ------------------------------------------------------------
function etiquetaDiaCatala(data) {
  return data.getDate() + ' ' + majuscula(MESOS_CATALA[data.getMonth()]) + ', ' + DIES_CATALA[data.getDay()];
}

// ------------------------------------------------------------
// Returns the French day label "30 Juin, Mardi" for a Date ("1er" for
// the first of the month).
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
// Returns the word with its first letter in upper case.
// ------------------------------------------------------------
function majuscula(paraula) {
  if (paraula === '') {
    return '';
  }
  return paraula.charAt(0).toUpperCase() + paraula.slice(1);
}

// ------------------------------------------------------------
// Builds the email footer: an optional link to the public site (only if
// AGENDA_URL is set) plus a short bilingual note on how to unsubscribe
// (by replying to the sender). Brevo transactional emails do not add an
// unsubscribe link by themselves, so we provide this note. Returns the
// HTML as a string.
// ------------------------------------------------------------
function construeixPeuBaixa() {
  var enllac = '';
  if (AGENDA_URL !== '') {
    enllac =
      '<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;padding-bottom:10px;">' +
      '<a href="' + escapaHtml(AGENDA_URL) + '" style="color:' + COLOR_ACCENT + ';font-weight:bold;text-decoration:none;">Veure tota l’agenda · Voir tout l’agenda</a>' +
      '</div>';
  }

  var text =
    'Reps aquest correu perquè estàs subscrit/a a l’agenda cultural de la Catalunya Nord. ' +
    'Per donar-te de baixa, respon a aquest correu amb la paraula «baixa».' +
    '<br><span style="font-style:italic;">' +
    'Vous recevez ce message car vous êtes abonné·e à l’agenda culturel de Catalogne Nord. ' +
    'Pour vous désabonner, répondez « baixa » à ce courriel.' +
    '</span>';

  return enllac + '<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:' + COLOR_TINTA_SUAU + ';line-height:1.5;">' + text + '</div>';
}

// ------------------------------------------------------------
// Turns "2026-09-14" into "14 de setembre de 2026" (Catalan, with the
// "d'" contraction before months that start with a vowel). Used for the
// subject line. Built on objecteDataDe so the date parse/validation
// lives in one place. Returns "" if the date is empty or malformed.
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
// Returns the text with HTML-special characters replaced by entities,
// so untrusted event content (which originally came from association
// emails) can never inject markup or scripts into the email. Returns ""
// for null/undefined.
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
