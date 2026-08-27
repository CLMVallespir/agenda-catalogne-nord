// ============================================================
// IMPORTA-CSV — conversió d'un sol ús: CSV filtrat -> pendents.json
//
// Converteix `esdeveniments-importacio-filtrat.csv` en el
// `pendents.json` inicial. El CSV ja ve amb l'esquema canònic de 16
// camps del §4 de CLAUDE.md — mateixos noms, mateix ordre — i ja ve
// curat: títols i descripcions en català i francès, categories de la
// llista bona i topònims en forma catalana. Aquí no es reinterpreta
// res: els camps passen tal com són.
//
// Les úniques tres coses que el sistema imposa:
//   - l'`id` es reconstrueix sempre amb `creaId` (§4), mai es fa
//     servir el que porti el CSV;
//   - `comarca` i `categoria` es passen per `valorPermes`;
//   - `estat` és sempre "pendent".
//
// Es fa servir UN SOL COP, per sembrar la cua del curador. Quan la
// Fase 2 (el Worker) estigui en marxa, les files noves hi entraran
// soles i aquest fitxer es pot esborrar.
//
// Ús:   node importa-csv.js esdeveniments-importacio-filtrat.csv pendents.json
//
// No fa cap crida de xarxa i no toca res més que el fitxer de sortida.
// `creaId` i `valorPermes` són còpies literals d'apps-script/utils.gs.
// ============================================================

var fs = require('fs');

// L'esquema canònic: els 16 noms, en l'ordre exacte. El CSV ha de
// portar aquesta capçalera i prou; si no, val més aturar-se.
var ESQUEMA = [
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

// Els valors permesos dels dos camps d'enumeració (apps-script/utils.gs).
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

// ------------------------------------------------------------
// Parseja un text CSV complet i torna una taula de files (arrays de
// cadenes). Fet a mà perquè no hi ha npm: gestiona cometes dobles,
// cometes escapades ("") i salts de línia dins d'un camp.
// ------------------------------------------------------------
function parseCsv(text) {
  var files = [];
  var fila = [];
  var camp = '';
  var dinsCometes = false;

  for (var i = 0; i < text.length; i++) {
    var caracter = text[i];

    if (dinsCometes) {
      if (caracter === '"') {
        if (text[i + 1] === '"') {
          camp += '"';
          i++;
        } else {
          dinsCometes = false;
        }
      } else {
        camp += caracter;
      }
      continue;
    }

    if (caracter === '"') {
      dinsCometes = true;
    } else if (caracter === ',') {
      fila.push(camp);
      camp = '';
    } else if (caracter === '\r') {
      // Final de línia de Windows: el \n que ve tot seguit ja tanca la fila.
    } else if (caracter === '\n') {
      fila.push(camp);
      files.push(fila);
      fila = [];
      camp = '';
    } else {
      camp += caracter;
    }
  }

  // L'última fila, si el fitxer no acaba amb salt de línia.
  if (camp !== '' || fila.length > 0) {
    fila.push(camp);
    files.push(fila);
  }

  return files;
}

// ------------------------------------------------------------
// Torna el valor net d'un camp. Un camp que falta és "", mai null:
// l'esquema diu que tot camp és una cadena.
// ------------------------------------------------------------
function valorCsv(objecte, clau) {
  var valor = objecte[clau];
  if (valor === undefined || valor === null) {
    return '';
  }
  return String(valor).trim();
}

// ------------------------------------------------------------
// Còpia literal de valorPermes (apps-script/utils.gs).
// Torna el valor si és a la llista permesa, si no "".
// ------------------------------------------------------------
function valorPermes(valor, llistaPermesa) {
  if (llistaPermesa.indexOf(valor) === -1) {
    return '';
  }
  return valor;
}

// ------------------------------------------------------------
// Còpia literal de creaId (apps-script/utils.gs). El sistema sempre
// reconstrueix l'id amb aquesta funció, mai es refia del que porti
// la font, perquè totes les vies d'entrada donin l'id idèntic.
// ------------------------------------------------------------
function creaId(dataInici, titol) {
  if (dataInici === '') {
    return '';
  }

  var text = titol.toLowerCase();
  // Separa les lletres accentuades en lletra base + accent i treu els
  // accents (à -> a, é -> e, ç -> c, ...).
  text = text.normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Treu els apòstrofs (recte ' i corb ').
  text = text.replace(/['’]/g, '');
  // Tot allò que no sigui lletra, xifra o espai passa a ser un espai.
  text = text.replace(/[^a-z0-9]+/g, ' ');
  text = text.trim();

  if (text === '') {
    return dataInici;
  }

  // Es queda amb les tres primeres paraules, unides amb guions.
  var paraules = text.split(/\s+/);
  var paraulesCurtes = paraules.slice(0, 3);
  return dataInici + '-' + paraulesCurtes.join('-');
}

// ------------------------------------------------------------
// Converteix una fila del CSV en un esdeveniment de 16 camps. Tot
// passa tal com ve, llevat de l'id (reconstruït), els dos enums
// (coercits) i l'estat (sempre pendent).
// ------------------------------------------------------------
function construeixFila(filaCsv) {
  var titol = valorCsv(filaCsv, 'titol');
  var dataInici = valorCsv(filaCsv, 'data_inici');

  return {
    id: creaId(dataInici, titol),
    titol: titol,
    data_inici: dataInici,
    data_fi: valorCsv(filaCsv, 'data_fi'),
    hora: valorCsv(filaCsv, 'hora'),
    lloc: valorCsv(filaCsv, 'lloc'),
    municipi: valorCsv(filaCsv, 'municipi'),
    comarca: valorPermes(valorCsv(filaCsv, 'comarca'), COMARCA_VALUES),
    categoria: valorPermes(valorCsv(filaCsv, 'categoria'), CATEGORIA_VALUES),
    descripcio_ca: valorCsv(filaCsv, 'descripcio_ca'),
    descripcio_fr: valorCsv(filaCsv, 'descripcio_fr'),
    associacio: valorCsv(filaCsv, 'associacio'),
    imatge_url: valorCsv(filaCsv, 'imatge_url'),
    font_url: valorCsv(filaCsv, 'font_url'),
    estat: 'pendent',
    data_entrada: valorCsv(filaCsv, 'data_entrada')
  };
}

// ------------------------------------------------------------
// Punt d'entrada: llegeix el CSV, comprova la capçalera, construeix
// les files i escriu el JSON.
// ------------------------------------------------------------
function main() {
  var camiEntrada = process.argv[2];
  var camiSortida = process.argv[3];

  if (!camiEntrada || !camiSortida) {
    console.error('Ús: node importa-csv.js <entrada.csv> <sortida.json>');
    process.exit(1);
  }

  var brut = fs.readFileSync(camiEntrada, 'utf8').replace(/^﻿/, '');
  var files = parseCsv(brut).filter(function (fila) { return fila.length > 1; });
  var capcalera = files[0];

  // Si la capçalera no és exactament l'esquema, res del que ve
  // després és de fiar. Val més aturar-se que endevinar.
  if (capcalera.join('|') !== ESQUEMA.join('|')) {
    console.error('La capçalera del CSV no és l\'esquema canònic de 16 camps.');
    console.error('  esperada: ' + ESQUEMA.join(','));
    console.error('  trobada:  ' + capcalera.join(','));
    process.exit(1);
  }

  var esdeveniments = [];
  for (var i = 1; i < files.length; i++) {
    var filaCsv = {};
    for (var j = 0; j < capcalera.length; j++) {
      filaCsv[capcalera[j]] = files[i][j];
    }
    esdeveniments.push(construeixFila(filaCsv));
  }

  fs.writeFileSync(camiSortida, JSON.stringify(esdeveniments, null, 2) + '\n', 'utf8');

  informe(esdeveniments, camiSortida);
}

// ------------------------------------------------------------
// Escriu al terminal què ha passat: quantes files, quants camps
// buits, i quins id es repeteixen (la regla de tres paraules de
// creaId en pot generar; és sabut i acceptat).
// ------------------------------------------------------------
function informe(esdeveniments, camiSortida) {
  var senseCategoria = 0;
  var senseComarca = 0;
  var senseCartell = 0;
  var senseDescripcioCa = 0;
  var comptadorId = {};

  for (var i = 0; i < esdeveniments.length; i++) {
    var e = esdeveniments[i];
    if (e.categoria === '') { senseCategoria++; }
    if (e.comarca === '') { senseComarca++; }
    if (e.imatge_url === '') { senseCartell++; }
    if (e.descripcio_ca === '') { senseDescripcioCa++; }
    comptadorId[e.id] = (comptadorId[e.id] || 0) + 1;
  }

  var idRepetits = Object.keys(comptadorId).filter(function (id) {
    return comptadorId[id] > 1;
  });

  console.log('Escrit: ' + camiSortida);
  console.log('  files                     ' + esdeveniments.length);
  console.log('  sense categoria           ' + senseCategoria);
  console.log('  sense comarca             ' + senseComarca);
  console.log('  sense descripcio_ca       ' + senseDescripcioCa);
  console.log('  sense cartell             ' + senseCartell);
  console.log('  id repetits               ' + idRepetits.length + ' (regla de 3 paraules de creaId)');
  for (var k = 0; k < idRepetits.length; k++) {
    console.log('    ' + idRepetits[k] + ' (x' + comptadorId[idRepetits[k]] + ')');
  }
}

main();
