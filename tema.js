// ---------------------------------------------------------------------------
// TEMA — aplica el tema desat ABANS de pintar, per evitar el parpelleig
//
// Es carrega al <head> d'index.html sense `defer` ni `async`, a posta: ha de
// córrer abans que el navegador pinti res. El botó que canvia el tema és a
// app.js; aquí només es llegeix el que hi ha desat.
//
// Fins al 30 d'octubre de 2026 era un <script> en línia d'index.html. Fora,
// la pàgina pot tenir una CSP que no deixa executar cap codi en línia
// (script-src 'self'), i un enllaç javascript: tampoc.
// ---------------------------------------------------------------------------

(function () {
  var tema = 'clar';
  try {
    var desat = localStorage.getItem('tema');
    if (desat === 'fosc' || desat === 'clar') {
      tema = desat;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      tema = 'fosc';
    }
  } catch (e) { /* sense localStorage: es queda en tema clar */ }
  document.documentElement.setAttribute('data-tema', tema);
})();
