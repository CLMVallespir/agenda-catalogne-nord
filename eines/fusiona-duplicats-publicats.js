// ---------------------------------------------------------------------------
// FUSIONA DUPLICATS PUBLICATS — TREU LA FILA REPETIDA I EN PROTEGEIX LA CONSERVADA
//
// Eina d'UN SOL ÚS (1 d'octubre de 2026). Una sola feina: per a cada parella de
// `Claude outputs/parelles-duplicats-20261001.json`
// (`[{ "conserva": "<id>", "elimina": "<id>", "motiu": "fixada" | "més antiga" }]`),
// treure la fila `elimina` d'`events.json` i fer que la fila `conserva` quedi
// protegida a `pendents.json` amb TOTS els `[ADT66 id: …]` de les dues files,
// perquè la capa 1 de `eines/dedup-contra-fitxers.js` no torni a encuar l'oferta
// de cap de les dues.
//
// LA REGLA DE QUI ES CONSERVA (ja decidida a les parelles, no es torna a decidir
// aquí): es conserva el títol en català; si els dos títols són en català, la
// fila amb la `data_entrada` més antiga.
//
//   - PER DEFECTE NOMÉS INFORMA (execució en sec). Escriu l'informe a
//     `Claude outputs/fusiona-duplicats-sec-20261001.txt` i l'imprimeix.
//   - ESCRIU NOMÉS AMB `--escriu`: `events.json` i `pendents.json`, cadascun
//     d'una sola escriptura (`JSON.stringify(dades, null, 2)`, amb els mateixos
//     finals de línia i el mateix salt de línia final que el fitxer actual, perquè
//     el diff de git només mostri els canvis reals). Primer es calculen tots dos
//     resultats en memòria, es comprova l'invariant, i només llavors s'escriu.
//   - UN COP ESCRITS, els rellegeix del disc i torna a comprovar l'invariant i
//     els comptatges, i ho imprimeix.
//   - La fila `conserva` d'`events.json` NO CANVIA: no se'n copia cap camp.
//   - Els identificadors «d'abans» es guarden a
//     `Claude outputs/ids-fusio-abans-20261001.json` (en sec i amb `--escriu`).
//     És un fitxer d'evidència, no un fitxer d'estat del projecte.
//
// QUINS ESTATS DE `pendents.json` TRACTA (§4 de CLAUDE.md ho exigeix declarat):
//
//   - `publicat`: l'únic estat que es llegeix i es toca. Les files `publicat`
//     amb l'`id` de `conserva` o d'`elimina` es llegeixen per reunir-ne els
//     identificadors; la de `conserva` es completa o es crea; la d'`elimina`
//     s'esborra. El filtre és literalment `=== 'publicat'`.
//   - `rebutjat`: NO ES TOCA MAI, encara que tingui el mateix `id`.
//   - `pendent`: NO ES TOCA MAI.
//   - Qualsevol altre estat: no es toca ni es llegeix.
//
// L'INVARIANT: tot identificador ADT66 present abans a les files `publicat` de
// les dues files d'una parella ha de ser present després a la fila `publicat` de
// la `conserva` d'aquella parella. Es comprova sobre l'estat resultant calculat
// en memòria, ABANS d'escriure; si no es compleix, no s'escriu res i el codi de
// sortida és 1.
//
// CAS LÍMIT: si algun dels 26 `id` té MÉS D'UNA fila `publicat` a
// `pendents.json` (o més d'una fila a `events.json`, o no en té cap), l'eina
// avisa i NO escriu. No endevina quina és la bona.
//
// Ús des del terminal (Node 18 o superior, cap dependència):
//
//   node eines/fusiona-duplicats-publicats.js             -> execució en sec
//   node eines/fusiona-duplicats-publicats.js --escriu    -> escriu els dos fitxers
//   node eines/fusiona-duplicats-publicats.js --autoprova -> proves sintètiques
// ---------------------------------------------------------------------------


// --- El que ve de fora ------------------------------------------------------

var fs = require('fs');
var os = require('os');
var path = require('path');

var dedup = require('./dedup-esdeveniments.js');
var identificador = require('./adt66-identificador.js');


// --- Constants --------------------------------------------------------------

var ARREL = path.join(__dirname, '..');
var RUTES_REALS = {
  events: path.join(ARREL, 'events.json'),
  pendents: path.join(ARREL, 'pendents.json'),
  parelles: path.join(ARREL, 'Claude outputs', 'parelles-duplicats-20261001.json'),
  abans: path.join(ARREL, 'Claude outputs', 'ids-fusio-abans-20261001.json'),
  informe: path.join(ARREL, 'Claude outputs', 'fusiona-duplicats-sec-20261001.txt')
};

// Els 17 camps públics, en l'ordre canònic del §4 de CLAUDE.md.
var CAMPS_PUBLICS = [
  'id', 'titol', 'data_inici', 'data_fi', 'hora', 'lloc', 'municipi', 'comarca',
  'categoria', 'descripcio_ca', 'descripcio_fr', 'associacio', 'imatge_url',
  'font_url', 'estat', 'data_entrada', 'periodicitat'
];

// Els 18 camps d'una fila de pendents.json: els 17 públics i `nota_curador`.
var CAMPS_FILA = CAMPS_PUBLICS.concat(['nota_curador']);

// El text que tanca la nota de les files creades.
var NOTA_FUSIO = 'Fusió de duplicat 2026-10-01';

// Els tres estats de pendents.json, per als comptatges de l'informe.
var ESTATS = ['pendent', 'publicat', 'rebutjat'];


// --- Les peces: valors i cerques --------------------------------------------

// ------------------------------------------------------------
// Un valor com a cadena retallada. Un camp desconegut és '' (§4 de CLAUDE.md).
// ------------------------------------------------------------
function cadena(valor) {
  if (valor === null || valor === undefined) {
    return '';
  }
  return String(valor).trim();
}

// ------------------------------------------------------------
// Un valor com a cadena SENSE retallar, per copiar camps d'events.json tal qual.
// ------------------------------------------------------------
function copiaCadena(valor) {
  if (valor === null || valor === undefined) {
    return '';
  }
  return String(valor);
}

// ------------------------------------------------------------
// Una còpia profunda de dades JSON, per no mutar mai l'entrada.
// ------------------------------------------------------------
function copiaProfunda(dades) {
  return JSON.parse(JSON.stringify(dades));
}

// ------------------------------------------------------------
// Afegeix a una llista els ids que encara no hi són.
// ------------------------------------------------------------
function uneixIds(llista, ids) {
  for (var i = 0; i < ids.length; i++) {
    if (llista.indexOf(ids[i]) === -1) {
      llista.push(ids[i]);
    }
  }
}

// ------------------------------------------------------------
// Les posicions de les files d'events.json amb aquest id.
// ------------------------------------------------------------
function posicionsEvents(events, id) {
  var posicions = [];

  for (var i = 0; i < events.length; i++) {
    if (cadena(events[i].id) === id) {
      posicions.push(i);
    }
  }
  return posicions;
}

// ------------------------------------------------------------
// Les posicions de les files `publicat` de pendents.json amb aquest id.
// ------------------------------------------------------------
function posicionsPublicades(pendents, id) {
  var posicions = [];

  for (var i = 0; i < pendents.length; i++) {
    if (pendents[i].estat === 'publicat' && cadena(pendents[i].id) === id) {
      posicions.push(i);
    }
  }
  return posicions;
}

// ------------------------------------------------------------
// Els identificadors ADT66 de les files `publicat` d'un id, tots units.
// ------------------------------------------------------------
function idsPublicats(pendents, id) {
  var posicions = posicionsPublicades(pendents, id);
  var ids = [];

  for (var i = 0; i < posicions.length; i++) {
    uneixIds(ids, identificador.extreuIdentificadors(pendents[posicions[i]].nota_curador));
  }
  return ids;
}

// ------------------------------------------------------------
// Els tags d'una llista d'ids, separats per un espai.
// ------------------------------------------------------------
function tagsDe(ids) {
  var tags = [];

  for (var i = 0; i < ids.length; i++) {
    var tag = identificador.creaTagIdentificador(ids[i]);
    if (tag !== '') {
      tags.push(tag);
    }
  }
  return tags.join(' ');
}

// ------------------------------------------------------------
// Comptatge de files de pendents.json per estat (més «altres»).
// ------------------------------------------------------------
function comptaPerEstat(pendents) {
  var comptes = { pendent: 0, publicat: 0, rebutjat: 0, altres: 0 };

  for (var i = 0; i < pendents.length; i++) {
    if (ESTATS.indexOf(pendents[i].estat) === -1) {
      comptes.altres += 1;
    } else {
      comptes[pendents[i].estat] += 1;
    }
  }
  return comptes;
}

// ------------------------------------------------------------
// Els comptatges d'estat en una línia llegible.
// ------------------------------------------------------------
function textDeComptes(comptes) {
  return 'pendent ' + comptes.pendent + ' · publicat ' + comptes.publicat +
         ' · rebutjat ' + comptes.rebutjat + ' · altres ' + comptes.altres;
}


// --- Les peces: validació ---------------------------------------------------

// ------------------------------------------------------------
// Els problemes de la llista de parelles (forma, ids repetits). Llista buida si va bé.
// ------------------------------------------------------------
function validaParelles(parelles) {
  var problemes = [];
  var vistos = [];

  if (!Array.isArray(parelles) || parelles.length === 0) {
    problemes.push('la llista de parelles és buida o no és una llista');
    return problemes;
  }

  for (var i = 0; i < parelles.length; i++) {
    var conserva = cadena(parelles[i].conserva);
    var elimina = cadena(parelles[i].elimina);

    if (conserva === '' || elimina === '' || conserva === elimina) {
      problemes.push('parella ' + (i + 1) + ': conserva i elimina han de ser dos ids no buits i diferents');
      continue;
    }
    if (vistos.indexOf(conserva) !== -1) {
      problemes.push('parella ' + (i + 1) + ': l\'id ' + conserva + ' ja surt en una altra parella');
    }
    vistos.push(conserva);
    if (vistos.indexOf(elimina) !== -1) {
      problemes.push('parella ' + (i + 1) + ': l\'id ' + elimina + ' ja surt en una altra parella');
    }
    vistos.push(elimina);
  }
  return problemes;
}

// ------------------------------------------------------------
// Els avisos de les dades: id sense fila a events.json, o repetit, o amb més
// d'una fila `publicat` a pendents.json. Llista buida si va bé.
// ------------------------------------------------------------
function avisosDeLesDades(events, pendents, parelles) {
  var avisos = [];

  for (var i = 0; i < parelles.length; i++) {
    var idsParella = [parelles[i].conserva, parelles[i].elimina];

    for (var j = 0; j < idsParella.length; j++) {
      var id = idsParella[j];
      var nEvents = posicionsEvents(events, id).length;
      var nPublicades = posicionsPublicades(pendents, id).length;

      if (nEvents !== 1) {
        avisos.push('l\'id ' + id + ' té ' + nEvents + ' files a events.json (n\'hi hauria d\'haver exactament 1)');
      }
      if (nPublicades > 1) {
        avisos.push('l\'id ' + id + ' té ' + nPublicades + ' files publicat a pendents.json (n\'hi hauria d\'haver com a molt 1)');
      }
    }
  }
  return avisos;
}


// --- Les peces: la fusió ----------------------------------------------------

// ------------------------------------------------------------
// La fila nova de pendents.json: els 17 camps públics de la fila d'events.json
// (els que hi falten, buits) més nota_curador, amb estat «publicat».
// ------------------------------------------------------------
function construeixFilaNova(filaEvents, tags) {
  var fila = {};

  for (var i = 0; i < CAMPS_FILA.length; i++) {
    fila[CAMPS_FILA[i]] = copiaCadena(filaEvents[CAMPS_FILA[i]]);
  }
  fila.estat = 'publicat';
  fila.nota_curador = dedup.ajuntaNotes(tags, NOTA_FUSIO);
  return fila;
}

// ------------------------------------------------------------
// Fusiona UNA parella sobre l'estat de treball (còpies) i en torna el detall per
// a l'informe. `estat` és { events, pendents, esborrar: [posicions], noves: [files] };
// les posicions són les de pendents.json ORIGINAL.
// ------------------------------------------------------------
function fusionaParella(estat, parella, afegeixTags) {
  var detall = { reunits: [], accioConserva: '', accioElimina: '' };
  var idsConserva = idsPublicats(estat.pendents, parella.conserva);
  var idsElimina = idsPublicats(estat.pendents, parella.elimina);
  var posConserva = posicionsPublicades(estat.pendents, parella.conserva);
  var posElimina = posicionsPublicades(estat.pendents, parella.elimina);
  var faltants = [];
  var i;

  uneixIds(detall.reunits, idsConserva);
  uneixIds(detall.reunits, idsElimina);

  for (i = 0; i < detall.reunits.length; i++) {
    if (idsConserva.indexOf(detall.reunits[i]) === -1) {
      faltants.push(detall.reunits[i]);
    }
  }

  if (posConserva.length === 1 && faltants.length > 0) {
    var fila = estat.pendents[posConserva[0]];
    fila.nota_curador = dedup.ajuntaNotes(fila.nota_curador, afegeixTags(faltants));
    detall.accioConserva = 'completada amb ' + faltants.join(', ');
  } else if (posConserva.length === 1) {
    detall.accioConserva = 'ja té tots els identificadors (res a fer)';
  } else if (detall.reunits.length > 0) {
    var filaEvents = estat.events[posicionsEvents(estat.events, parella.conserva)[0]];
    estat.noves.push(construeixFilaNova(filaEvents, afegeixTags(detall.reunits)));
    detall.accioConserva = 'creada amb ' + detall.reunits.join(', ');
  } else {
    detall.accioConserva = 'no cal cap fila (cap identificador per reunir)';
  }

  if (posElimina.length === 1) {
    estat.esborrar.push(posElimina[0]);
    detall.accioElimina = 'esborrada';
  } else {
    detall.accioElimina = 'no n\'hi havia';
  }

  estat.events.splice(posicionsEvents(estat.events, parella.elimina)[0], 1);
  return detall;
}

// ------------------------------------------------------------
// Els identificadors «d'abans»: { "<id>": [ids ADT66 de les seves files publicat] }
// per als ids de totes les parelles.
// ------------------------------------------------------------
function recullIdsAbans(pendents, parelles) {
  var abans = {};

  for (var i = 0; i < parelles.length; i++) {
    abans[parelles[i].conserva] = idsPublicats(pendents, parelles[i].conserva);
    abans[parelles[i].elimina] = idsPublicats(pendents, parelles[i].elimina);
  }
  return abans;
}

// ------------------------------------------------------------
// L'invariant: tot id d'abans de les dues files d'una parella és, després, a la
// fila publicat de la conserva. Torna { ok, faltants: ["<id fila>: <id ADT66>"] }.
// ------------------------------------------------------------
function comprovaInvariant(abans, parelles, pendentsDespres) {
  var faltants = [];

  for (var i = 0; i < parelles.length; i++) {
    var presents = idsPublicats(pendentsDespres, parelles[i].conserva);
    var requerits = [];

    uneixIds(requerits, abans[parelles[i].conserva] || []);
    uneixIds(requerits, abans[parelles[i].elimina] || []);

    for (var j = 0; j < requerits.length; j++) {
      if (presents.indexOf(requerits[j]) === -1) {
        faltants.push(parelles[i].conserva + ': ' + requerits[j]);
      }
    }
  }
  return { ok: faltants.length === 0, faltants: faltants };
}

// ------------------------------------------------------------
// Els comptatges abans/després d'una passada, per a l'informe i la verificació.
// ------------------------------------------------------------
function construeixComptatges(eventsAbans, pendentsAbans, eventsDespres, pendentsDespres) {
  return {
    eventsAbans: eventsAbans.length,
    eventsDespres: eventsDespres.length,
    pendentsAbans: comptaPerEstat(pendentsAbans),
    pendentsDespres: comptaPerEstat(pendentsDespres)
  };
}

// ------------------------------------------------------------
// L'informe en text d'una passada.
// ------------------------------------------------------------
function construeixInforme(parelles, detalls, avisos, invariant, comptatges, escriu) {
  var linies = [];
  var i;

  linies.push('FUSIONA DUPLICATS PUBLICATS — ' + (escriu ? 'ESCRIPTURA' : 'EXECUCIÓ EN SEC'));
  linies.push('');

  if (avisos.length > 0) {
    linies.push('ATENCIÓ — NO S\'ESCRIURÀ RES:');
    for (i = 0; i < avisos.length; i++) {
      linies.push('  ' + avisos[i]);
    }
    linies.push('');
  }

  for (i = 0; i < detalls.length; i++) {
    linies.push('Parella ' + (i + 1) + ' (' + parelles[i].motiu + ')');
    linies.push('  Es conserva:  ' + parelles[i].conserva);
    linies.push('  S\'elimina:    ' + parelles[i].elimina);
    linies.push('  Identificadors reunits: ' + (detalls[i].reunits.length === 0 ? 'cap' : detalls[i].reunits.join(', ')));
    linies.push('  Fila publicat de la conservada: ' + detalls[i].accioConserva);
    linies.push('  Fila publicat de l\'eliminada:   ' + detalls[i].accioElimina);
  }

  linies.push('');
  linies.push('INVARIANT: ' + (invariant.ok ? 'OK' : 'FALLA'));
  for (i = 0; i < invariant.faltants.length; i++) {
    linies.push('  falta ' + invariant.faltants[i]);
  }
  linies.push('');
  linies.push('COMPTATGES (abans -> després)');
  linies.push('  Files d\'events.json: ' + comptatges.eventsAbans + ' -> ' + comptatges.eventsDespres);
  linies.push('  Files de pendents.json: ' + textDeComptes(comptatges.pendentsAbans));
  linies.push('                       -> ' + textDeComptes(comptatges.pendentsDespres));

  return linies.join('\n') + '\n';
}

// ------------------------------------------------------------
// La passada pura, sobre dades ja llegides. `entrades` és { events, pendents,
// parelles }; `opcions.afegeixTags(ids)` (per defecte tagsDe) es pot canviar a
// les proves. No toca cap fitxer ni muta l'entrada. Torna { events, pendents,
// avisos, invariant, comptatges, abans, informe, escriurePermes }.
// ------------------------------------------------------------
function calculaFusio(entrades, opcions) {
  var afegeixTags = tagsDe;
  if (opcions && opcions.afegeixTags) {
    afegeixTags = opcions.afegeixTags;
  }
  var escriu = false;
  if (opcions && opcions.escriu === true) {
    escriu = true;
  }

  var parelles = entrades.parelles;
  var avisos = validaParelles(parelles);
  if (avisos.length === 0) {
    avisos = avisosDeLesDades(entrades.events, entrades.pendents, parelles);
  }

  var estat = {
    events: copiaProfunda(entrades.events), pendents: copiaProfunda(entrades.pendents),
    esborrar: [], noves: []
  };
  var detalls = [];
  var abans = {};
  var i;

  if (avisos.length === 0) {
    abans = recullIdsAbans(entrades.pendents, parelles);
    for (i = 0; i < parelles.length; i++) {
      detalls.push(fusionaParella(estat, parelles[i], afegeixTags));
    }
  }

  var pendentsDespres = [];
  for (i = 0; i < estat.pendents.length; i++) {
    if (estat.esborrar.indexOf(i) === -1) {
      pendentsDespres.push(estat.pendents[i]);
    }
  }
  pendentsDespres = pendentsDespres.concat(estat.noves);

  var invariant = { ok: false, faltants: ['no calculat (hi ha avisos)'] };
  if (avisos.length === 0) {
    invariant = comprovaInvariant(abans, parelles, pendentsDespres);
  }

  var comptatges = construeixComptatges(entrades.events, entrades.pendents, estat.events, pendentsDespres);
  var informe = construeixInforme(parelles, detalls, avisos, invariant, comptatges, escriu);

  return {
    events: estat.events, pendents: pendentsDespres, avisos: avisos, invariant: invariant,
    comptatges: comptatges, abans: abans, informe: informe,
    escriurePermes: avisos.length === 0 && invariant.ok
  };
}


// --- Les peces: el disc -----------------------------------------------------

// ------------------------------------------------------------
// Llegeix un fitxer de text.
// ------------------------------------------------------------
function llegeixText(cami) {
  try {
    return fs.readFileSync(cami, 'utf8');
  } catch (error) {
    throw new Error('no he pogut llegir ' + cami + ': ' + error.message);
  }
}

// ------------------------------------------------------------
// Llegeix un fitxer JSON.
// ------------------------------------------------------------
function llegeixJson(cami) {
  try {
    return JSON.parse(llegeixText(cami));
  } catch (error) {
    throw new Error('no he pogut analitzar ' + cami + ': ' + error.message);
  }
}

// ------------------------------------------------------------
// El text a escriure: JSON amb dos espais, amb els finals de línia i el salt de
// línia final del text original (si no n'hi ha, LF i salt final).
// ------------------------------------------------------------
function serialitzaCom(dades, textOriginal) {
  var text = JSON.stringify(dades, null, 2);
  var eol = '\n';
  var saltFinal = true;

  if (textOriginal.indexOf('\r\n') !== -1) {
    eol = '\r\n';
    text = text.replace(/\n/g, eol);
  }
  if (textOriginal !== '' && textOriginal.slice(-1) !== '\n') {
    saltFinal = false;
  }
  if (saltFinal) {
    text = text + eol;
  }
  return text;
}

// ------------------------------------------------------------
// Escriu un fitxer de text d'una sola escriptura.
// ------------------------------------------------------------
function escriuText(cami, text) {
  try {
    fs.writeFileSync(cami, text, 'utf8');
  } catch (error) {
    throw new Error('no he pogut escriure ' + cami + ': ' + error.message);
  }
}

// ------------------------------------------------------------
// Rellegeix els fitxers escrits i torna a comprovar l'invariant i els comptatges.
// Torna { ok, linies }.
// ------------------------------------------------------------
function verificaDisc(rutes, resultat, parelles) {
  var eventsDisc = llegeixJson(rutes.events);
  var pendentsDisc = llegeixJson(rutes.pendents);
  var invariant = comprovaInvariant(resultat.abans, parelles, pendentsDisc);
  var comptes = comptaPerEstat(pendentsDisc);
  var esperats = resultat.comptatges.pendentsDespres;
  var linies = [];
  var ok = invariant.ok;

  linies.push('VERIFICACIÓ DESPRÉS D\'ESCRIURE (fitxers rellegits del disc)');
  linies.push('  Invariant: ' + (invariant.ok ? 'OK' : 'FALLA ' + invariant.faltants.join('; ')));

  var eventsOk = eventsDisc.length === resultat.comptatges.eventsDespres;
  for (var i = 0; i < parelles.length; i++) {
    if (posicionsEvents(eventsDisc, parelles[i].elimina).length !== 0) {
      eventsOk = false;
    }
    if (posicionsEvents(eventsDisc, parelles[i].conserva).length !== 1) {
      eventsOk = false;
    }
  }
  linies.push('  events.json: ' + eventsDisc.length + ' files — ' + (eventsOk ? 'OK' : 'FALLA'));

  var comptesOk = textDeComptes(comptes) === textDeComptes(esperats);
  linies.push('  pendents.json: ' + textDeComptes(comptes) + ' — ' + (comptesOk ? 'OK' : 'FALLA'));

  if (!eventsOk || !comptesOk) {
    ok = false;
  }
  return { ok: ok, linies: linies };
}

// ------------------------------------------------------------
// Una passada sobre fitxers: llegeix, calcula, guarda l'evidència d'«abans» i, amb
// `escriu` i només si tot va bé, escriu els dos fitxers i els verifica.
// Torna { resultat, escrit, verificacio }.
// ------------------------------------------------------------
function passadaSobreFitxers(rutes, escriu, opcions) {
  var textEvents = llegeixText(rutes.events);
  var textPendents = llegeixText(rutes.pendents);
  var parelles = llegeixJson(rutes.parelles);
  var opcionsCalcul = { escriu: escriu };

  if (opcions && opcions.afegeixTags) {
    opcionsCalcul.afegeixTags = opcions.afegeixTags;
  }

  var resultat = calculaFusio(
    { events: JSON.parse(textEvents), pendents: JSON.parse(textPendents), parelles: parelles },
    opcionsCalcul
  );

  if (resultat.avisos.length === 0) {
    escriuText(rutes.abans, JSON.stringify(resultat.abans, null, 2) + '\n');
  }

  var passada = { resultat: resultat, escrit: false, verificacio: null };
  if (escriu !== true || !resultat.escriurePermes) {
    return passada;
  }

  escriuText(rutes.events, serialitzaCom(resultat.events, textEvents));
  escriuText(rutes.pendents, serialitzaCom(resultat.pendents, textPendents));
  passada.escrit = true;
  passada.verificacio = verificaDisc(rutes, resultat, parelles);
  return passada;
}


// --- El que s'exporta -------------------------------------------------------

module.exports = {
  calculaFusio: calculaFusio,
  comprovaInvariant: comprovaInvariant,
  passadaSobreFitxers: passadaSobreFitxers
};


// --- Terminal: arguments i passada real -------------------------------------

// ------------------------------------------------------------
// La passada real sobre els fitxers del repositori: informa o escriu.
// ------------------------------------------------------------
function passadaReal(args) {
  var escriu = args.indexOf('--escriu') !== -1;
  var passada = passadaSobreFitxers(RUTES_REALS, escriu, null);
  var resultat = passada.resultat;

  console.log(resultat.informe);

  if (!escriu) {
    escriuText(RUTES_REALS.informe, resultat.informe);
    console.log('Informe escrit a ' + RUTES_REALS.informe);
  }
  if (!resultat.escriurePermes) {
    console.log('NO S\'HA ESCRIT RES: hi ha avisos o l\'invariant falla.');
    process.exitCode = 1;
    return;
  }
  if (passada.escrit) {
    console.log('events.json i pendents.json escrits.');
    console.log(passada.verificacio.linies.join('\n'));
    if (!passada.verificacio.ok) {
      process.exitCode = 1;
    }
  }
}


// --- Autoprova (dades sintètiques; fitxers només a un directori temporal) ----

// ------------------------------------------------------------
// Una fila d'events.json sintètica, amb els 17 camps públics.
// ------------------------------------------------------------
function eventDeProva(id, titol) {
  return {
    id: id, titol: titol, data_inici: '2026-10-10', data_fi: '2026-10-10', hora: '20:00',
    lloc: 'Sala', municipi: 'Prada', comarca: 'Conflent', categoria: 'Música',
    descripcio_ca: 'Descripció.', descripcio_fr: 'Description.', associacio: 'Entitat',
    imatge_url: '', font_url: '', estat: 'publicat', data_entrada: '2026-09-01T10:00:00Z',
    periodicitat: ''
  };
}

// ------------------------------------------------------------
// Una fila de pendents.json sintètica (18 camps) amb l'estat i la nota donats.
// ------------------------------------------------------------
function pendentDeProva(id, estat, nota) {
  var fila = eventDeProva(id, 'Títol ' + id);
  fila.estat = estat;
  fila.nota_curador = nota;
  return fila;
}

// ------------------------------------------------------------
// Les dades sintètiques d'una prova: una parella C/E i les files que se li donen.
// ------------------------------------------------------------
function dadesDeProva(filesPendents) {
  return {
    events: [eventDeProva('C', 'Títol C'), eventDeProva('E', 'Títol E'), eventDeProva('ALTRA', 'Altra')],
    pendents: filesPendents,
    parelles: [{ conserva: 'C', elimina: 'E', motiu: 'fixada' }]
  };
}

// ------------------------------------------------------------
// Crea un directori temporal amb les dades de prova escrites (events.json en
// CRLF, pendents.json en LF, com els reals) i en torna les rutes.
// ------------------------------------------------------------
function creaEscenariTemporal(dades) {
  var directori = fs.mkdtempSync(path.join(os.tmpdir(), 'fusiona-prova-'));
  var rutes = {
    directori: directori,
    events: path.join(directori, 'events.json'),
    pendents: path.join(directori, 'pendents.json'),
    parelles: path.join(directori, 'parelles.json'),
    abans: path.join(directori, 'abans.json')
  };

  fs.writeFileSync(rutes.events, JSON.stringify(dades.events, null, 2).replace(/\n/g, '\r\n') + '\r\n', 'utf8');
  fs.writeFileSync(rutes.pendents, JSON.stringify(dades.pendents, null, 2) + '\n', 'utf8');
  fs.writeFileSync(rutes.parelles, JSON.stringify(dades.parelles, null, 2) + '\n', 'utf8');
  return rutes;
}

// ------------------------------------------------------------
// Esborra el directori temporal d'una prova.
// ------------------------------------------------------------
function netejaEscenari(rutes) {
  fs.rmSync(rutes.directori, { recursive: true, force: true });
}

// ------------------------------------------------------------
// Una funció d'afegir tags que «no pot reunir» cap identificador, per trencar l'invariant.
// ------------------------------------------------------------
function tagsQueFallen() {
  return '';
}

// ------------------------------------------------------------
// Els casos de l'autoprova: cadascun torna '' si va bé o el motiu si falla.
// ------------------------------------------------------------
function casosDAutoprova() {
  return [
    {
      nom: '1. fusió: totes dues tenen fila publicat; la conservada rep els ids i l\'eliminada s\'esborra',
      comprova: function () {
        var dades = dadesDeProva([
          pendentDeProva('C', 'publicat', '[ADT66 id: AAA] Nota existent.'),
          pendentDeProva('E', 'publicat', '[ADT66 id: BBB]')
        ]);
        var r = calculaFusio(dades, {});
        if (!r.escriurePermes) { return 'no hauria de bloquejar: ' + r.avisos.join(';') + r.invariant.faltants.join(';'); }
        if (r.pendents.length !== 1) { return 'esperava 1 fila a pendents, n\'hi ha ' + r.pendents.length; }
        if (r.pendents[0].id !== 'C') { return 'la fila que queda no és la de C'; }
        if (r.pendents[0].nota_curador !== '[ADT66 id: AAA] Nota existent. [ADT66 id: BBB]') { return 'nota inesperada: ' + r.pendents[0].nota_curador; }
        if (r.events.length !== 2 || posicionsEvents(r.events, 'E').length !== 0) { return 'E no ha sortit d\'events.json'; }
        return '';
      }
    },
    {
      nom: '2. creació: només l\'eliminada té fila publicat; es crea la de la conservada amb 18 camps',
      comprova: function () {
        var dades = dadesDeProva([pendentDeProva('E', 'publicat', '[ADT66 id: BBB] [ADT66 id: CCC]')]);
        var r = calculaFusio(dades, {});
        if (!r.escriurePermes) { return 'no hauria de bloquejar: ' + r.avisos.join(';') + r.invariant.faltants.join(';'); }
        if (r.pendents.length !== 1 || r.pendents[0].id !== 'C') { return 'esperava només la fila nova de C'; }
        var fila = r.pendents[0];
        if (JSON.stringify(Object.keys(fila)) !== JSON.stringify(CAMPS_FILA)) { return 'els camps no són els 18 en ordre canònic'; }
        if (fila.estat !== 'publicat') { return 'estat inesperat: ' + fila.estat; }
        if (fila.nota_curador !== '[ADT66 id: BBB] [ADT66 id: CCC] ' + NOTA_FUSIO) { return 'nota inesperada: ' + fila.nota_curador; }
        if (fila.titol !== 'Títol C') { return 'no ha copiat els camps d\'events.json'; }
        return '';
      }
    },
    {
      nom: '3. una fila rebutjat (i una pendent) amb el mateix id que l\'eliminada NO es toquen',
      comprova: function () {
        var rebutjada = pendentDeProva('E', 'rebutjat', '[ADT66 id: RRR] Rebutjada.');
        var pendent = pendentDeProva('E', 'pendent', '[ADT66 id: PPP]');
        var dades = dadesDeProva([rebutjada, pendentDeProva('E', 'publicat', '[ADT66 id: BBB]'), pendent]);
        var r = calculaFusio(dades, {});
        if (!r.escriurePermes) { return 'no hauria de bloquejar'; }
        if (r.pendents.length !== 3) { return 'esperava 3 files (rebutjada, pendent, nova), n\'hi ha ' + r.pendents.length; }
        if (JSON.stringify(r.pendents[0]) !== JSON.stringify(rebutjada)) { return 'la fila rebutjat ha canviat'; }
        if (JSON.stringify(r.pendents[1]) !== JSON.stringify(pendent)) { return 'la fila pendent ha canviat'; }
        if (r.comptatges.pendentsDespres.rebutjat !== 1) { return 'el comptatge de rebutjat ha canviat'; }
        return '';
      }
    },
    {
      nom: '4. sense --escriu no s\'escriu res (els fitxers sintètics no canvien)',
      comprova: function () {
        var dades = dadesDeProva([pendentDeProva('E', 'publicat', '[ADT66 id: BBB]')]);
        var rutes = creaEscenariTemporal(dades);
        try {
          var eventsAbans = fs.readFileSync(rutes.events, 'utf8');
          var pendentsAbans = fs.readFileSync(rutes.pendents, 'utf8');
          var passada = passadaSobreFitxers(rutes, false, null);
          if (passada.escrit) { return 'diu que ha escrit'; }
          if (fs.readFileSync(rutes.events, 'utf8') !== eventsAbans) { return 'events.json ha canviat'; }
          if (fs.readFileSync(rutes.pendents, 'utf8') !== pendentsAbans) { return 'pendents.json ha canviat'; }
          if (!passada.resultat.escriurePermes) { return 'el càlcul en sec hauria de ser vàlid'; }
          return '';
        } finally {
          netejaEscenari(rutes);
        }
      }
    },
    {
      nom: '5. si l\'invariant falla, no s\'escriu res (ni amb --escriu)',
      comprova: function () {
        var dades = dadesDeProva([pendentDeProva('E', 'publicat', '[ADT66 id: BBB]')]);
        var rutes = creaEscenariTemporal(dades);
        try {
          var eventsAbans = fs.readFileSync(rutes.events, 'utf8');
          var pendentsAbans = fs.readFileSync(rutes.pendents, 'utf8');
          var passada = passadaSobreFitxers(rutes, true, { afegeixTags: tagsQueFallen });
          if (passada.resultat.invariant.ok) { return 'l\'invariant hauria de fallar'; }
          if (passada.escrit) { return 'diu que ha escrit amb l\'invariant trencat'; }
          if (fs.readFileSync(rutes.events, 'utf8') !== eventsAbans) { return 'events.json ha canviat'; }
          if (fs.readFileSync(rutes.pendents, 'utf8') !== pendentsAbans) { return 'pendents.json ha canviat'; }
          return '';
        } finally {
          netejaEscenari(rutes);
        }
      }
    },
    {
      nom: '6. amb --escriu escriu, conserva finals de línia i verifica el disc',
      comprova: function () {
        var dades = dadesDeProva([
          pendentDeProva('C', 'publicat', '[ADT66 id: AAA]'),
          pendentDeProva('E', 'publicat', '[ADT66 id: BBB]')
        ]);
        var rutes = creaEscenariTemporal(dades);
        try {
          var passada = passadaSobreFitxers(rutes, true, null);
          if (!passada.escrit) { return 'no ha escrit'; }
          if (!passada.verificacio.ok) { return 'la verificació del disc falla: ' + passada.verificacio.linies.join(' | '); }
          var textEvents = fs.readFileSync(rutes.events, 'utf8');
          var textPendents = fs.readFileSync(rutes.pendents, 'utf8');
          if (textEvents.indexOf('\r\n') === -1 || textEvents.slice(-2) !== '\r\n') { return 'events.json ha perdut el CRLF'; }
          if (textPendents.indexOf('\r') !== -1 || textPendents.slice(-1) !== '\n') { return 'pendents.json ha canviat el format'; }
          return '';
        } finally {
          netejaEscenari(rutes);
        }
      }
    },
    {
      nom: '7. dues files publicat amb el mateix id: avisa i no escriu',
      comprova: function () {
        var dades = dadesDeProva([
          pendentDeProva('E', 'publicat', '[ADT66 id: BBB]'),
          pendentDeProva('E', 'publicat', '[ADT66 id: DDD]')
        ]);
        var r = calculaFusio(dades, { escriu: true });
        if (r.avisos.length !== 1) { return 'esperava 1 avís, n\'hi ha ' + r.avisos.length; }
        if (r.escriurePermes) { return 'no hauria de permetre escriure'; }
        return '';
      }
    }
  ];
}

// ------------------------------------------------------------
// Passa l'autoprova i escriu OK/FALLA per cas; surt amb codi 1 si en falla algun.
// ------------------------------------------------------------
function autoprova() {
  var casos = casosDAutoprova();
  var fallades = 0;

  console.log('FUSIONA DUPLICATS PUBLICATS — autoprova (' + casos.length + ' casos)');
  console.log('');

  for (var i = 0; i < casos.length; i++) {
    var problema = '';
    try {
      problema = casos[i].comprova();
    } catch (error) {
      problema = 'excepció: ' + error.message;
    }
    if (problema === '') {
      console.log('OK     ' + casos[i].nom);
    } else {
      console.log('FALLA  ' + casos[i].nom);
      console.log('       ' + problema);
      fallades += 1;
    }
  }

  console.log('');
  if (fallades === 0) {
    console.log('OK     els ' + casos.length + ' casos passen.');
  } else {
    console.log(fallades + ' de ' + casos.length + ' casos fallats.');
    process.exitCode = 1;
  }
}


// --- Punt d'entrada ---------------------------------------------------------

if (require.main === module) {
  var args = process.argv.slice(2);
  try {
    if (args.indexOf('--autoprova') !== -1) {
      autoprova();
    } else {
      passadaReal(args);
    }
  } catch (error) {
    console.error('ERROR: ' + error.message);
    process.exitCode = 1;
  }
}
