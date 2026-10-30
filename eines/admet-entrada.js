// ---------------------------------------------------------------------------
// ADMET-ENTRADA — quant pot entrar per les portes manuals
//
// Una feina i prou: dir si una tramesa del correu o del formulari pot entrar a
// la cua, i quant del text d'un correu pot anar al model. És un sostre
// numèric, no cap criteri: no mira qui envia ni què diu (D-04 continua
// valent). Existeix perquè cada correu a agenda@ costa una crida a Claude i un
// commit públic, i sense cap sostre una riuada de correus gastaria el crèdit,
// colgaria la cua i faria créixer pendents.json cap al límit d'1 MB de l'API
// de GitHub (D-08). Vegeu D-09 a NOTES.md.
//
// LES DUES REGLES:
//   - Com a molt MAX_FILES_PORTES_PER_DIA files per dia entre les dues portes.
//     Les compta filesDeLesPortesDAvui() a pendents.json: les que tenen la
//     data_entrada d'avui i no porten el tag [ADT66 id: …] al davant (aquelles
//     les escriu l'Action, que té el seu propi sostre).
//   - Del text d'un correu, només els primers MAX_CARACTERS_CORREU caràcters
//     van al model. El correu sencer és igualment a l'arxiu de Gmail.
//
// ON ES CRIDA: worker/worker.js, a les dues portes, DESPRÉS de llegir la cua i
// ABANS de cridar Claude. El Worker en porta una còpia literal, vigilada per
// `node eines/verifica-copies-worker.js`: es toca aquí i es copia allà.
//
// ESTATS: llegeix pendents.json només per comptar, i compta les files dels
// tres estats. Una fila rebutjada avui també ha entrat avui.
//
// Les proves són a proves/sostre-de-les-portes.test.js.
// ---------------------------------------------------------------------------


// --- Constants --------------------------------------------------------------

// Les files que poden entrar en un dia per les dues portes manuals juntes.
// Mesurat el 29 d'octubre de 2026 a l'historial de git: des del 28 d'agost hi
// han entrat 4 files (1 per correu, 3 pel formulari), com a molt 3 en un dia,
// i totes de prova. Vint és molt per sobre de l'ús d'avui i encara para una
// riuada el mateix dia.
var MAX_FILES_PORTES_PER_DIA = 20;

// Els caràcters d'un correu que van al model, assumpte inclòs. Un anunci
// d'associació en fa uns quants centenars; vint mil ja és un butlletí sencer.
var MAX_CARACTERS_CORREU = 20000;

// El començament del tag que posa el mapeig de l'ADT66 al davant de la nota.
var MARCA_ADT66 = '[ADT66 id: ';


// --- Les funcions -----------------------------------------------------------

// ------------------------------------------------------------
// La decisió d'una tramesa: { admesa, text, avis, motiu }. `text` és el que
// pot anar al model (tallat si calia), `avis` el que s'ha de dir al curador si
// s'ha tallat, i `motiu` el que va al registre si no s'admet.
// ------------------------------------------------------------
function admetEntrada(text, filesAvui) {
  if (filesAvui >= MAX_FILES_PORTES_PER_DIA) {
    return {
      admesa: false,
      text: '',
      avis: '',
      motiu: 'avui ja han entrat ' + filesAvui + ' files per les portes manuals (sostre: ' +
        MAX_FILES_PORTES_PER_DIA + '). No s\'admet res més fins demà.'
    };
  }

  var caracters = Array.from(text);
  if (caracters.length <= MAX_CARACTERS_CORREU) {
    return { admesa: true, text: text, avis: '', motiu: '' };
  }

  return {
    admesa: true,
    text: caracters.slice(0, MAX_CARACTERS_CORREU).join(''),
    avis: 'El correu passava de ' + MAX_CARACTERS_CORREU + ' caràcters i el model només n\'ha llegit el principi: l\'original és a l\'arxiu.',
    motiu: ''
  };
}

// ------------------------------------------------------------
// Quantes files de la cua han entrat avui per les portes manuals: data_entrada
// d'avui (AAAA-MM-DD en UTC, com la marca ISO) i cap tag de l'ADT66 al davant.
// ------------------------------------------------------------
function filesDeLesPortesDAvui(cua, avui) {
  var quantes = 0;

  for (var i = 0; i < cua.length; i++) {
    var fila = cua[i] || {};
    var entrada = typeof fila.data_entrada === 'string' ? fila.data_entrada : '';
    var nota = typeof fila.nota_curador === 'string' ? fila.nota_curador : '';
    if (entrada.slice(0, 10) === avui && nota.indexOf(MARCA_ADT66) !== 0) {
      quantes++;
    }
  }

  return quantes;
}


// --- Per a Node -------------------------------------------------------------

module.exports = {
  admetEntrada: admetEntrada,
  filesDeLesPortesDAvui: filesDeLesPortesDAvui,
  MAX_FILES_PORTES_PER_DIA: MAX_FILES_PORTES_PER_DIA,
  MAX_CARACTERS_CORREU: MAX_CARACTERS_CORREU
};
