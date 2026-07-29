// ============================================================
// UTILS — shared helpers and schema constants
// Home of everything used across more than one Step. In Apps
// Script all .gs files share one global scope, so moving these
// here changes nothing at runtime — but it makes the dependency
// STRUCTURAL instead of documental: the ingestion, publish and
// digest jobs no longer borrow helpers that live inside a file
// named after another job (deleting "the webhook file" used to
// break email ingestion silently — GAS does no static analysis).
//
// Contents:
//   - Schema constants: NOM_FULL, COLUMN_HEADERS, the enum lists.
//   - Cell/field readers: textDeCella, readField.
//   - Secret + column lookups: getSecret, indexDeColumna.
//   - Row helpers: creaId, valorPermes, escriuFila.
//
// Nothing here is generalised beyond its single real use: these
// are the same functions that used to live in the Step files,
// moved verbatim.
// ============================================================

// The one tab name, used by every job that touches the sheet.
// A single constant so a tab rename is a one-line change, not a
// five-file hunt.
var NOM_FULL = 'Esdeveniments';

// The schema field names, in the exact order of the sheet columns.
// Read by setupSheet (to build the header row), and the canonical
// order the ingestion paths assemble their rows in.
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

// Allowed values for the two enum columns. Read by setupSheet (the
// dropdowns), by the ingestion paths (valorPermes) and by the digest
// (agrupaPerComarca / the comarca loop).
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

// ------------------------------------------------------------
// Reads one secret from Script Properties. Throws a clear, actionable
// error if it is missing or empty, so a misconfiguration is obvious.
// Returns the property value (a string).
// ------------------------------------------------------------
function getSecret(nom) {
  var valor = PropertiesService.getScriptProperties().getProperty(nom);
  if (valor === null || valor === '') {
    throw new Error('Falta la Script Property "' + nom + '". Afegeix-la a Configuració del projecte > Propietats de l\'script.');
  }
  return valor;
}

// ------------------------------------------------------------
// Returns the 0-based position of the column whose header equals nom.
// Throws a clear error if that column is missing, so a schema change
// fails loudly instead of silently reading the wrong column.
// ------------------------------------------------------------
function indexDeColumna(capcaleres, nom) {
  for (var i = 0; i < capcaleres.length; i++) {
    if (String(capcaleres[i]).trim() === nom) {
      return i;
    }
  }
  throw new Error('Falta la columna "' + nom + '" al full ' + NOM_FULL + '.');
}

// ------------------------------------------------------------
// Turns one sheet cell into a clean string: "" for empty cells,
// trimmed text for everything else. The date/hour columns are
// plain text in the sheet, so no date conversion is needed here.
// ------------------------------------------------------------
function textDeCella(valor) {
  if (valor === undefined || valor === null) {
    return '';
  }
  return String(valor).trim();
}

// ------------------------------------------------------------
// Reads one field from a plain object (a Typebot body or a parsed
// Gemini answer). Returns the trimmed string value, or "" if the
// field is missing, null or blank. Keeps the rest of the code free
// of null/undefined checks.
// ------------------------------------------------------------
function readField(objecte, clau) {
  var valor = objecte[clau];
  if (valor === undefined || valor === null) {
    return '';
  }
  return String(valor).trim();
}

// ------------------------------------------------------------
// Returns the value if it is in the allowed list, otherwise "".
// Keeps comarca and categoria clean on BOTH ingestion paths, even
// though appendRow bypasses the sheet's dropdown validation.
// ------------------------------------------------------------
function valorPermes(valor, llistaPermesa) {
  if (llistaPermesa.indexOf(valor) === -1) {
    return '';
  }
  return valor;
}

// ------------------------------------------------------------
// Builds the event id: the start date, a hyphen, and a short
// slug made from the first words of the title (lowercase, no
// accents, no apostrophes). Example: "2026-09-14-ball-de-la".
// Returns "" when there is no start date, matching the schema.
// The system ALWAYS rebuilds id with this function, so both
// ingestion paths produce identical ids and the model's own id
// (if any) is never trusted.
// ------------------------------------------------------------
function creaId(dataInici, titol) {
  if (dataInici === '') {
    return '';
  }

  var text = titol.toLowerCase();
  // Split accented letters into base letter + accent mark, then drop
  // the marks (a-grave -> a, e-acute -> e, c-cedilla -> c, ...).
  // ̀-ͯ is the Unicode "combining diacritical marks" block.
  text = text.normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Remove apostrophes (straight ' and curly ').
  text = text.replace(/['’]/g, '');
  // Replace anything that is not a letter, number or space with a space.
  text = text.replace(/[^a-z0-9]+/g, ' ');
  text = text.trim();

  if (text === '') {
    return dataInici;
  }

  // Keep the first three words and join them with hyphens.
  var words = text.split(/\s+/);
  var shortWords = words.slice(0, 3);
  var slug = shortWords.join('-');

  return dataInici + '-' + slug;
}

// ------------------------------------------------------------
// Appends one already-built 16-field row to the sheet. The single
// seam both ingestion paths (email and Typebot) go through to write
// a row, so "estat is always pendent" can be guarded in one place.
// Returns nothing.
// ------------------------------------------------------------
function escriuFila(sheet, fila) {
  sheet.appendRow(fila);
}
