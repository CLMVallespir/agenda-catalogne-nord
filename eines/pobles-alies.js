// ---------------------------------------------------------------------------
// POBLES: ELS NOMS EN LES DUES LLENGÜES
//
// L'origen de veritat, i l'únic, dels noms de poble de Catalunya Nord en
// català i en francès. El fan servir:
//
//   eines/dedup-esdeveniments.js   per muntar una clau de comparació
//   eines/mapeja-recerca.js        per triar la forma que es PUBLICA
//
// Abans la taula vivia copiada als dos fitxers. Una sola còpia amb un avís és
// sostenible; dues ja no, i el dia que se n'afegís un poble a un lloc i no a
// l'altre, els dos fitxers dirien coses diferents del mateix municipi sense
// que res fallés.
//
// Hi ha TOTS els parells, també els que només es diferencien per l'accent
// (Ceret/Céret). Al dedup no li calen —cauen igual en normalitzar— però hi
// són igualment: val més que la taula sigui completa que no pas que cada
// fitxer només hi tingui el que fa servir.
//
// La forma catalana és SEMPRE la primera columna. És la que es publica: el §4
// de CLAUDE.md diu «municipi, en forma catalana quan es coneix».
//
// Per afegir-hi un poble: una línia més a la comarca que toqui, forma catalana
// primer. No cal tocar res més enlloc.
//
// AVÍS DE DESPLEGAMENT: aquest fitxer s'importa amb require(), que és Node pur
// i no necessita cap eina (§3 de CLAUDE.md: cap npm, cap compilació). Però el
// tauler de Cloudflare no sap què fer amb dos mòduls: el dia que aquesta taula
// hagi d'anar dins del Worker, s'hi enganxa a dins, com ja es fa amb
// postal-mime (vegeu NOTES.md, «el fitxer que es desplega no és el que
// s'edita»).
// ---------------------------------------------------------------------------

var POBLES_ALIES = [
  // --- Rosselló ---
  ['Perpinyà', 'Perpignan'],
  ['Elna', 'Elne'],
  ['Argelers', 'Argelès-sur-Mer'],
  ['Cotlliure', 'Collioure'],
  ['Portvendres', 'Port-Vendres'],
  ['Banyuls de la Marenda', 'Banyuls-sur-Mer'],
  ['Cervera de la Marenda', 'Cerbère'],
  ['Ribesaltes', 'Rivesaltes'],
  ['Sant Cebrià de Rosselló', 'Saint-Cyprien'],
  ['Sant Llorenç de la Salanca', 'Saint-Laurent-de-la-Salanque'],
  ['Sant Hipòlit de la Salanca', 'Saint-Hippolyte'],
  ['Vilallonga de la Salanca', 'Villelongue-de-la-Salanque'],
  ['Torrelles de la Salanca', 'Torreilles'],
  ['Salses', 'Salses-le-Château'],
  ['Canet de Rosselló', 'Canet-en-Roussillon'],
  ['Sant Nazari de Rosselló', 'Saint-Nazaire'],
  ['Toluges', 'Toulouges'],
  ['Sant Esteve del Monestir', 'Saint-Estève'],
  ['El Soler', 'Le Soler'],
  ['Sant Feliu d\'Avall', 'Saint-Féliu-d\'Avall'],
  ['Sant Feliu d\'Amunt', 'Saint-Féliu-d\'Amont'],
  ['Illa', 'Ille-sur-Têt'],
  ['Millars', 'Millas'],
  ['Tuïr', 'Thuir'],
  ['Trullars', 'Trouillas'],
  ['Vilamulaca', 'Villemolaque'],
  ['Pesillà de la Ribera', 'Pézilla-la-Rivière'],
  ['Corbera', 'Corbère'],
  ['Cornellà del Bercol', 'Corneilla-del-Vercol'],
  ['Teulís', 'Théza'],
  ['Ortafà', 'Ortaffa'],
  ['Alenyà', 'Alénya'],
  ['Vilanova de Raò', 'Villeneuve-de-la-Raho'],
  ['Vilanova de la Ribera', 'Villeneuve-de-la-Rivière'],
  ['El Voló', 'Le Boulou'],
  ['Sant Andreu de Sureda', 'Saint-André'],
  ['Sant Genís de Fontanes', 'Saint-Génis-des-Fontaines'],
  ['Vilallonga dels Monts', 'Villelongue-dels-Monts'],
  ['Sureda', 'Sorède'],
  ['Bages de Rosselló', 'Bages'],
  ['Bao', 'Baho'],
  ['Cabestany', 'Cabestany'],
  ['Pollestres', 'Pollestres'],
  ['Bompàs', 'Bompas'],
  ['Clairà', 'Claira'],
  ['Palau del Vidre', 'Palau-del-Vidre'],
  ['Montescot', 'Montescot'],

  // --- Conflent ---
  ['Prada', 'Prades'],
  ['Vilafranca de Conflent', 'Villefranche-de-Conflent'],
  ['Cornellà de Conflent', 'Corneilla-de-Conflent'],
  ['Rià i Cirac', 'Ria-Sirach'],
  ['Fullà', 'Fuilla'],
  ['Vernet', 'Vernet-les-Bains'],
  ['Molig', 'Molitg-les-Bains'],
  ['Marqueixanes', 'Marquixanes'],
  ['Oleta', 'Olette'],
  ['Fontpedrosa', 'Fontpédrouse'],
  ['Jóc', 'Joch'],
  ['Montlluís', 'Mont-Louis'],
  ['Sornià', 'Sournia'],
  ['Vinçà', 'Vinça'],
  ['Arboçols', 'Arboussols'],
  ['Finestret', 'Finestret'],
  ['Eus', 'Eus'],
  ['Codalet', 'Codalet'],
  ['Catllar', 'Catllar'],
  ['Serdinyà', 'Serdinya'],

  // --- Vallespir ---
  ['Ceret', 'Céret'],
  ['Prats de Molló', 'Prats-de-Mollo-la-Preste'],
  ['Arles de Tec', 'Arles-sur-Tech'],
  ['Amèlia les Banys', 'Amélie-les-Bains-Palalda'],
  ['Sant Llorenç de Cerdans', 'Saint-Laurent-de-Cerdans'],
  ['El Tec', 'Le Tech'],
  ['Costoja', 'Coustouges'],
  ['Serrallonga', 'Serralongue'],
  ['Reiners', 'Reynès'],
  ['Montboló', 'Montbolo'],
  ['Maurellàs', 'Maureillas-las-Illas'],
  ['Sant Joan de Pladecorts', 'Saint-Jean-Pla-de-Corts'],
  ['El Portús', 'Le Perthus'],
  ['Vivers', 'Vivès'],
  ['Les Illes', 'Les Illes'],

  // --- Capcir ---
  ['Els Angles', 'Les Angles'],
  ['Formiguera', 'Formiguères'],
  ['Matamala', 'Matemale'],
  ['Puigbalador', 'Puyvalador'],
  ['La Llaguna', 'La Llagonne'],
  ['Real', 'Réal'],

  // --- Cerdanya ---
  ['Sallagosa', 'Saillagouse'],
  ['La Guingueta d\'Ix', 'Bourg-Madame'],
  ['Font-romeu', 'Font-Romeu-Odeillo-Via'],
  ['Er', 'Err'],
  ['Naüja', 'Nahuja'],
  ['Palau de Cerdanya', 'Palau-de-Cerdagne'],
  ['Enveig', 'Enveitg'],
  ['Èguet', 'Égat'],
  ['La Tor de Querol', 'Latour-de-Carol'],
  ['Angostrina', 'Angoustrine'],
  ['Targasona', 'Targassonne'],
  ['Vilanova de les Escaldes', 'Villeneuve-des-Escaldes'],
  ['Osseja', 'Osséja'],
  ['Santa Llocaia', 'Sainte-Léocadie'],
  ['Estavar', 'Estavar'],
  ['Dorres', 'Dorres'],
  ['Ur', 'Ur'],
  ['Llívia', 'Llivia'],

  // --- Fenolleda ---
  // No és cap de les cinc comarques, però la recerca hi arriba i el nom s'ha
  // de saber escriure igualment.
  ['Bellestar', 'Bélesta'],
  ['Sant Pau de Fenollet', 'Saint-Paul-de-Fenouillet']
];

// ------------------------------------------------------------
// Un nom de poble reduït a lletres i xifres: minúscules, sense accents, sense
// apòstrofs, guions ni espais. Serveix per COMPARAR noms, mai per publicar-los.
// Un valor que no sigui text és ''.
// ------------------------------------------------------------
function normalitzaNom(text) {
  if (typeof text !== 'string') {
    return '';
  }

  var net = text.trim().toLowerCase();
  // Parteix les lletres accentuades en lletra + accent i llença els accents.
  net = net.normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Fora tot el que no sigui lletra o xifra: apòstrofs, guions, espais, punts.
  return net.replace(/[^a-z0-9]+/g, '');
}

module.exports = {
  POBLES_ALIES: POBLES_ALIES,
  normalitzaNom: normalitzaNom
};
