// ---------------------------------------------------------------------------
// URL-SEGURA — quines adreces poden anar a un enllaç
//
// Una sola regla per a tot el projecte: una adreça només va a un `href` si és
// absoluta i el seu esquema és `http:` o `https:`. Qualsevol altra cosa
// (`javascript:`, `data:`, una adreça relativa, text que no és cap adreça) no.
//
// PER QUÈ. Un `href = 'javascript:…'` executa codi quan algú hi clica, i el
// web públic i `curador.html` són al mateix origen (agenda.clm.cat): un enllaç
// així al web podria arribar al testimoni de GitHub del curador. Els valors
// d'`imatge_url` i `font_url` de l'ADT66 són del flux, és a dir, de tercers.
//
// ON ES FA SERVIR, a les dues bandes:
//   a l'entrada   eines/mapeja-adt66.js buida l'adreça que no passa, amb un
//                 avís a nota_curador
//   a la sortida  app.js, prova-local.html i curador.html no fan cap enllaç
//                 amb una adreça que no passa, vingui d'on vingui
//
// El Worker no la fa servir: no posa mai cap `font_url`, i la seva
// `imatge_url` ja ha de començar per https://res.cloudinary.com/<cloud>/.
//
// Els dos camins de càrrega són el mateix fitxer, com a `curador-cua.js`:
//   navegador   <script src="url-segura.js"> abans del codi que la crida
//   Node        require('../url-segura.js'), per `module.exports` del final
// ---------------------------------------------------------------------------


// --- Constants --------------------------------------------------------------

// Els únics esquemes que poden anar a un enllaç. `http:` hi és a posta:
// encara hi ha webs d'organitzadors que no tenen `https:`.
var ESQUEMES_SEGURS = ['http:', 'https:'];


// --- La regla ---------------------------------------------------------------

// ------------------------------------------------------------
// Diu si una adreça es pot posar a un `href`: absoluta, i amb esquema
// `http:` o `https:`. Una cadena buida, o qualsevol cosa que no sigui una
// cadena, no. L'analitza `new URL()`, el mateix analitzador del navegador:
// els espais i tabuladors que el navegador ignoraria dins `java script:`
// també els ignora aquí, i l'esquema surt igual que el veuria el navegador.
// ------------------------------------------------------------
function esUrlSegura(url) {
  if (typeof url !== 'string' || url === '') {
    return false;
  }

  var analitzada;
  try {
    analitzada = new URL(url);
  } catch (error) {
    return false;
  }

  return ESQUEMES_SEGURS.indexOf(analitzada.protocol) !== -1;
}


// --- Per a Node -------------------------------------------------------------

// Al navegador `module` no existeix i la funció de dalt ja és global; a
// Node, `require()` rep aquesta llista.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    esUrlSegura: esUrlSegura
  };
}
