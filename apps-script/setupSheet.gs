// ============================================================
// STEP 1 — Google Sheets setup
// Run setupSheet() ONCE from the Apps Script editor.
// It creates the "Esdeveniments" tab with headers, dropdowns
// and conditional formatting. Safe to re-run: it rebuilds the
// validations and formatting without deleting existing rows.
// ============================================================

// The schema field names, in the exact order of the columns.
var COLUMN_HEADERS = [
  'id',
  'titol',
  'data_inici',
  'data_fi',
  'hora',
  'lloc',
  'municipi',
  'comarca',
  'categoria',
  'descripcio_ca',
  'descripcio_fr',
  'associacio',
  'imatge_url',
  'font_url',
  'estat',
  'data_entrada'
];

// Allowed values for the dropdown columns.
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
var ESTAT_VALUES = ['pendent', 'publicat', 'rebutjat'];

// How many data rows the dropdowns and colours should cover.
var LAST_ROW = 1000;

// Column positions (1 = A). Derived from COLUMN_HEADERS order.
var COMARCA_COLUMN = 8;   // column H
var CATEGORIA_COLUMN = 9; // column I
var ESTAT_COLUMN = 15;    // column O

// Main entry point. Builds the whole sheet. Returns nothing.
function setupSheet() {
  var sheet = getOrCreateEventsSheet();
  writeHeaders(sheet);
  addDropdown(sheet, COMARCA_COLUMN, COMARCA_VALUES);
  addDropdown(sheet, CATEGORIA_COLUMN, CATEGORIA_VALUES);
  addDropdown(sheet, ESTAT_COLUMN, ESTAT_VALUES);
  addStatusColours(sheet);
  Logger.log('Setup complete. Sheet "Esdeveniments" is ready.');
}

// Finds the "Esdeveniments" tab, or creates it if missing. Returns the sheet.
function getOrCreateEventsSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName('Esdeveniments');
  if (sheet === null) {
    sheet = spreadsheet.insertSheet('Esdeveniments');
    Logger.log('Created new tab "Esdeveniments".');
  }
  return sheet;
}

// Writes the schema headers into row 1 and freezes that row. Returns nothing.
function writeHeaders(sheet) {
  var headerRange = sheet.getRange(1, 1, 1, COLUMN_HEADERS.length);
  headerRange.setValues([COLUMN_HEADERS]);
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);
  // Force the date/hour/id columns to plain text so Sheets does not
  // reformat "2025-09-14" into a date object or "18:30" into a time.
  var textColumns = sheet.getRange(2, 1, LAST_ROW - 1, COLUMN_HEADERS.length);
  textColumns.setNumberFormat('@');
}

// Adds a dropdown (data validation) to one column, rows 2 to LAST_ROW.
// Rejects any value that is not in allowedValues. Returns nothing.
function addDropdown(sheet, columnNumber, allowedValues) {
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(allowedValues, true)
    .setAllowInvalid(false)
    .build();
  var range = sheet.getRange(2, columnNumber, LAST_ROW - 1, 1);
  range.setDataValidation(rule);
}

// Colours each row by its estat value:
// publicat = light green, pendent = light yellow, rebutjat = light red.
// Replaces all existing conditional formatting rules on the sheet. Returns nothing.
function addStatusColours(sheet) {
  var fullRange = sheet.getRange(2, 1, LAST_ROW - 1, COLUMN_HEADERS.length);

  var publishedRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$O2="publicat"')
    .setBackground('#D9EAD3')
    .setRanges([fullRange])
    .build();

  var pendingRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$O2="pendent"')
    .setBackground('#FFF2CC')
    .setRanges([fullRange])
    .build();

  var rejectedRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$O2="rebutjat"')
    .setBackground('#F4CCCC')
    .setRanges([fullRange])
    .build();

  sheet.setConditionalFormatRules([publishedRule, pendingRule, rejectedRule]);
}
