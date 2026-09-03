# AUDITORIA-CURADOR.md — mapa de `curador.html` i `importa-csv.js`

*Lectura d'auditoria, no de redisseny. Cap canvi de codi. Feta el **29 d'agost de
2026** sobre `curador.html` (998 línies), `importa-csv.js` (279 línies) i
`worker/worker.js` (per comparar el patró d'escriptura). Estat de les dades en el
moment de l'auditoria: `pendents.json` 84 files, `events.json` 8 files.*

---

## 1. Pantalles i estats de la interfície

No hi ha navegació: una sola pàgina, una sola llista. El que canvia és l'estat.

### 1.1 Estats globals de la pàgina

| Estat | Com s'hi arriba | Què es veu |
|---|---|---|
| **Carregant** | `inicia()` → `carregaCua()` (`curador.html:929`) | «Carregant la cua…», llista buida, recompte amagat |
| **Només lectura** | per defecte, sense testimoni | tots els `input`/`select`/`textarea` `disabled`, els dos botons `disabled`, avís gris: «Només lectura: sense testimoni no es pot publicar ni rebutjar res.» |
| **Escriptura activa** | `activaTestimoni()` (`:959`) amb un valor no buit | avís en negre: «Escriptura activada…», camps i botons vius, el camp de contrasenya s'ha buidat i el marcador passa a «Testimoni actiu en aquesta sessió» |
| **Cua buida** | `CUA.length === 0` a `actualitzaRecompte()` (`:904`) | «La cua és buida.», recompte amagat |
| **Error de càrrega** | `llegeixFitxer` llança dins de `carregaCua()` | «No he pogut carregar la cua.» + el missatge cru de GitHub a l'avís global, en vermell |

L'avís global el reescriu sempre `mostraAvis()` (`:534`), mai només el marcatge —
comentat expressament a `inicia()` (`:981`) perquè la pàgina no pugui dir una cosa
mentre en fa una altra. Tres menes: `''` (gris), `error` (vermell), `fet` (negre).

**Cap validació del testimoni en el moment d'enganxar-lo.** `activaTestimoni()`
només comprova que la cadena no sigui buida. Un testimoni caducat, mal copiat o
sense permís `contents: write` deixa la pàgina en estat «Escriptura activada» i no
falla fins al primer `PUT`, dins de `publica()` o `rebutja()`.

### 1.2 Estats d'una fitxa

Cada fila pendent és un `<article class="fitxa">` construït per `creaFitxa()`
(`:659`). Els seus estats els posa `avisaFitxa()` (`:804`):

| Estat | Marca visual | On es posa |
|---|---|---|
| Repòs | cap avís (`hidden`) | en construir la fitxa |
| Ocupada | classe `ocupada` (opacitat 0.5) + «Publicant…» / «Rebutjant…» | `publica()` `:832`, `rebutja()` `:883` |
| Error | avís vermell dins la fitxa, `ocupada` retirada | als `catch` de totes dues accions |
| Resolta | `fitxa.remove()`, la fitxa desapareix del DOM | final de `publica()` `:860` i `rebutja()` `:889` |

**`ocupada` és només opacitat.** El CSS (`:216`) no posa `pointer-events: none` i
el codi no desactiva els botons mentre l'operació vola. Vegeu §4.1.

---

## 2. Accions disponibles per fila

### 2.1 Editar — cap crida, viu només al DOM

Tretze camps són editables, tots marcats amb `data-camp`:

- **text** (`creaCamp`, `:547`): `titol`, `data_inici`, `data_fi`, `hora`, `lloc`,
  `municipi`, `associacio`, `imatge_url`, `font_url`
- **desplegable** (`creaDesplegable`, `:572`): `comarca`, `categoria` — amb una
  opció buida «— sense triar —» i **només** els valors de `COMARCA_VALUES` i
  `CATEGORIA_VALUES` (`:344`, `:345`), còpies literals del §4 de `CLAUDE.md`
- **àrea de text** (`creaArea`, `:605`): `descripcio_ca`, `descripcio_fr`

Els tres camps restants de l'esquema **no** són editables: `id` es recalcula sol,
i `estat` i `data_entrada` passen tal com eren (`recullFitxa`, `:738`).

Un escoltador d'`input` a l'arrel de la fitxa (`:724`) recalcula i repinta la línia
«Identificador en publicar: …» a cada tecla, amb la mateixa `creaId()` que farà
servir la publicació. És l'única retroacció en viu.

**No hi ha cap acció de «desa l'edició».** Una correcció només arriba al
repositori si es prem **Publica**. Rebutjar-la o recarregar la pàgina la perd.

### 2.2 Publica — `publica(fitxa, esdeveniment)` (`:824`)

1. `recullFitxa()` munta els 16 camps: llegeix tots els `[data-camp]` amb `.trim()`,
   reconstrueix `id` amb `creaId(data_inici, titol)`, passa `comarca` i `categoria`
   per `valorPermes()`, i arrossega `estat` i `data_entrada` de l'original.
2. `editat.estat = 'publicat'`.
3. `desaAmbReintent(FITXER_EVENTS, events => events.concat([editat]), 'Publica …')`
   — **afegeix al final** d'`events.json`.
4. Si això falla: avís a la fitxa + avís global, la fila **es queda a la cua**,
   `return`. Res no s'ha perdut.
5. `desaAmbReintent(FITXER_PENDENTS, treuDeLaCua(original), 'Treu de la cua …')`.
6. Si això falla amb un error que **no** és `JA_NO_HI_ES`: avís «Publicat a
   events.json, però no l'he pogut treure de la cua… Torna a carregar la cua i
   rebutja aquesta fila.» — duplicat visible, tal com mana `NOTES.md`.
7. Si falla amb `JA_NO_HI_ES` («La fila ja no era a la cua.»): **s'empassa en
   silenci** i es considera publicat. Vegeu §4.2.
8. `fitxa.remove()`, es treu de `CUA` comparant `JSON.stringify`, recompte,
   «Publicat: …».

L'ordre de les dues escriptures és el de `NOTES.md` («Publicar escriu
`events.json` ABANS que `pendents.json`») i el codi el comenta a `:818`.

### 2.3 Rebutja — `rebutja(fitxa, esdeveniment)` (`:872`)

1. `window.confirm()` amb el títol de l'acte i el recordatori que no es desa
   enlloc més.
2. `desaAmbReintent(FITXER_PENDENTS, treuDeLaCua(original), 'Rebutja …')`.
3. En èxit: `fitxa.remove()`, es treu de `CUA`, recompte, «Rebutjat: …».
4. En error: el missatge cru a la fitxa; la fitxa **es queda** al DOM.

Una sola escriptura, per tant sense finestra de dues fases. És l'única acció amb
confirmació.

### 2.4 Recarregar — `carregaCua()`

El botó «Torna a carregar la cua» crida directament `carregaCua()`, que fa
`llista.innerHTML = ''` **sense preguntar res**. Totes les edicions en curs de
totes les fitxes es perden. `activaTestimoni()` també crida `carregaCua()` (cal:
és el que treu el `disabled` dels camps), amb el mateix efecte.

---

## 3. El patró de lectura/escriptura contra l'API de GitHub

### 3.1 Les tres funcions de `curador.html`

- **`llegeixFitxer(nomFitxer)`** (`:422`) — `GET /repos/{owner}/{repo}/contents/{f}?ref=main`,
  `cache: 'no-store'`, capçaleres de `capcaleresGitHub()` (`:407`), que hi posa
  `Authorization` **només si hi ha testimoni** (el repositori és públic: la lectura
  funciona sense). Torna `{ dades, sha }` descodificant base64 per UTF-8.
- **`escriuFitxer(nomFitxer, dades, sha, missatgeCommit)`** (`:449`) — un sol `PUT`
  amb `{ message, content: base64(JSON.stringify(dades, null, 2) + '\n'), sha, branch }`.
  En error llança amb el codi HTTP dins del text del missatge.
- **`desaAmbReintent(nomFitxer, transforma, missatgeCommit)`** (`:480`) — el bucle:
  llegeix fresc → aplica `transforma` → escriu; si l'escriptura falla i el text de
  l'error conté `codi 409` o `codi 422`, torna a llegir i ho intenta **un sol cop
  més**; qualsevol altre error surt de seguida.

Punt important i correcte: **la transformació es torna a aplicar sobre el fitxer
acabat de llegir** a cada intent. Per això un reintent de `publica()` no pot
afegir l'acte dues vegades a `events.json`, i un reintent de `rebutja()` no
esborra la fila equivocada quan la Worker n'ha inserit una de nova al davant.

### 3.2 Comparació amb `afegeixAPendents()` del Worker

| | `curador.html` | `worker/worker.js` |
|---|---|---|
| Lectura | `llegeixFitxer` `:422` | `llegeixFitxerGitHub` `:961` |
| Escriptura | `escriuFitxer` `:449` | `escriuFitxerGitHub` `:987` |
| Reintent | `desaAmbReintent` `:480`, genèric | bucle **en línia** dins `afegeixAPendents` `:907` |
| URL, cos, base64, `null, 2` + `\n` | idèntics | idèntics |
| Detecció de conflicte | `codi 409` o `codi 422` al text de l'error | **exactament igual** |
| Pressupost d'intents | 2 (1 original + 1 reintent) | **exactament igual** |
| `Authorization` | només si hi ha testimoni | sempre |
| `User-Agent` | absent (el posa el navegador) | `'quefas-worker'` — l'API el reclama |
| `cache: 'no-store'` | **sí** | **no** |
| `Array.isArray(dades)` abans de tocar | **no** | **sí**, `:922`, llança si no |
| On es col·loca la fila | al final (`concat`) a `events.json` | **al davant** (`unshift`) a `pendents.json` |
| Valor de retorn de l'escriptura | torna el JSON de GitHub, **mai s'utilitza** | no torna res |

**Les dues divergències que compten:**

1. **Cap comprovació que el fitxer sigui una llista.** Si `events.json` o
   `pendents.json` quedessin malformats (un objecte, un `null`, un fitxer truncat),
   el Worker s'atura amb un missatge clar i el curador no: `events.concat` o
   `trobaIndex` petarien amb un `TypeError` genèric enmig d'una publicació, amb
   `events.json` potser ja escrit.
2. **`cache: 'no-store'` només al navegador.** El Worker no el passa. A la
   pràctica GitHub respon `Cache-Control: private` a les peticions autenticades i
   la memòria cau de Cloudflare no la desa, o sigui que avui no és un problema
   observat — però és l'única asimetria del patró que podria fer llegir un `sha`
   vell sense que ho digués res. Val la pena tenir-ho present si mai apareix un
   `409` inexplicable al costat del Worker.

La resta són diferències de forma, no de comportament.

---

## 4. Dos curadors alhora — on es perd una edició, on es duplica una publicació

El model és optimista i sense bloqueig: `CUA` és una foto del fitxer feta en
carregar la pàgina, i la reconciliació la fa `trobaIndex()` (`:771`), que compara
**la fila sencera amb `JSON.stringify`** contra el fitxer acabat de llegir. Això és
robust davant de reordenacions (la fila es retroba encara que la Worker n'hagi
inserit d'altres al davant) i fràgil davant de qualsevol modificació del contingut.

### 4.1 Duplicat per doble clic — el cas més probable

`avisaFitxa(..., true)` només abaixa l'opacitat: **els botons continuen actius**
mentre l'escriptura vola. Dos clics a **Publica** engeguen dues execucions de
`publica()`. La primera encara no ha escrit `events.json` quan la segona el
llegeix, o sí que l'ha escrit i la segona hi torna a afegir la fila igualment:
`events.concat([editat])` no mira mai si l'`id` ja hi és. Resultat: **el mateix
acte dues vegades a `events.json`**, i la segona retirada de la cua falla amb
`JA_NO_HI_ES`, que s'empassa (§4.2). L'usuari veu «Publicat: …» i res més.

No cal cap segon curador: passa amb una sola persona i una connexió lenta.

### 4.2 Duplicat per dos curadors — publica / publica

A i B tenen la mateixa fila oberta.

1. A publica. `events.json` rep la fila d'A; `pendents.json` la perd.
2. B publica. `events.json` es llegeix fresc i s'hi afegeix **la versió de B**
   (amb les edicions de B, que poden ser diferents — fins i tot un `id` diferent
   si B ha canviat la data o el títol).
3. La retirada de la cua de B falla amb `JA_NO_HI_ES` → **empassada en silenci**
   (`:851`–`:857`) → B llegeix «Publicat: …».

Resultat: **dos actes publicats al web públic, cap avís enlloc.** El comentari del
codi («Algú altre ja l'havia tret de la cua. Publicat igualment.») descriu bé la
intenció —evitar un fals error quan la fila ja no hi és— però no distingeix «ja no
hi era perquè jo mateix l'he tret al reintent» de «ja no hi era perquè algú altre
l'ha publicada o rebutjada». És el forat més gros de la pàgina.

Que `app.js` no faci servir mai el camp `id` (no hi ha cap `.id` al fitxer) fa que
el duplicat no trenqui res tècnicament: es pinta com dos actes seguits. Es veu, i
per això és recuperable — però es veu al web públic, no al curador.

### 4.3 Rebuig sobreescrit per una publicació

B rebutja la fila, A la publica després. L'escriptura d'A a `events.json` va bé
—no hi ha res que la lligui a la cua— i la retirada torna `JA_NO_HI_ES`, empassada
igual. **Un acte rebutjat acaba publicat**, i l'únic rastre és l'historial de
commits.

L'ordre invers és benigne: A publica, B rebutja, `rebutja()` **no** empassa
`JA_NO_HI_ES` i mostra «La fila ja no era a la cua.» a la fitxa. B ho veu.

### 4.4 Edicions perdudes

- **Edicions no desades.** L'única manera de desar una correcció és **Publica**.
  «Torna a carregar la cua» i activar el testimoni repinten des del fitxer i
  esborren en silenci tot el que hi hagués escrit. Enganxar el testimoni *després*
  d'editar —la seqüència natural quan s'obre la pàgina, es mira la cua i es decideix
  treballar-hi— perd tota la feina sense dir res.
- **Edicions de l'altre curador.** No es poden perdre, perquè cap camí escriu una
  fila *modificada* de tornada a `pendents.json`: només s'hi afegeix (Worker) o
  se'n treu (curador). L'única manera que `trobaIndex` no retrobi una fila és que
  algú l'hagi tret. És una propietat afortunada del disseny, no una defensa
  explícita: el dia que s'afegís un botó de «desa sense publicar», `trobaIndex`
  deixaria de trobar les files editades per l'altre i les accions fallarien amb
  `JA_NO_HI_ES`.

### 4.5 Files idèntiques a la cua

`trobaIndex` torna **la primera** coincidència exacta. Dues files idèntiques als 16
camps només poden venir de la sembra CSV (per correu i per formulari,
`data_entrada` és una marca de temps que les distingeix). Si n'hi hagués:
publicar-ne una en trauria una qualsevol de les dues —correcte—, però el filtre de
`CUA` de `:861` i `:890` (`JSON.stringify` sobre tota la llista) en treuria **les
dues de la pantalla**, i el recompte quedaria desquadrat fins a la propera
recàrrega. Menor i cosmètic.

### 4.6 Xoc amb la Worker

La Worker escriu a `pendents.json` a cada correu i a cada tramesa del formulari,
amb el mateix pressupost de dos intents. Si el curador i la Worker escriuen alhora,
un dels dos guanya i l'altre reintenta un cop. Si tots dos intents de la Worker
xoquen, el camí del correu és recuperable (l'original és al Gmail d'arxiu) i el
camí del formulari **perd la tramesa** — l'asimetria ja documentada a `NOTES.md`.
Res d'això és nou; només val la pena saber que **una sessió de curació llarga
augmenta la probabilitat de xoc**, perquè cada Publica són dues escriptures.

---

## 5. `importa-csv.js`

Eina d'un sol ús, en Node, sense xarxa. `main()` (`:205`) llegeix el CSV, treu el
BOM, el parseja amb un analitzador propi de 47 línies (`parseCsv`, `:70` — cometes
dobles, `""` escapades i salts de línia dins d'un camp), **exigeix que la capçalera
sigui exactament els 16 noms en l'ordre canònic** i s'atura si no ho és, munta cada
fila amb `construeixFila()` i escriu el JSON amb el mateix format que la resta del
projecte (`JSON.stringify(dades, null, 2) + '\n'`).

Imposa tres coses i només tres: `id` reconstruït amb `creaId`, `comarca` i
`categoria` per `valorPermes`, `estat: 'pendent'`. La resta passa tal com ve.
`informe()` (`:246`) compta camps buits i `id` repetits.

`creaId` i `valorPermes` són **còpies literals** de les de `curador.html`
(comparades caràcter a caràcter: idèntiques, incloent-hi el retall a tres
paraules). La còpia de `worker/worker.js` també ho és per `valorPermes`.

**Perill operatiu, no de codi:** el fitxer viu a l'arrel i la seva pròpia línia
d'ús diu `node importa-csv.js esdeveniments-importacio-filtrat.csv pendents.json`.
Executar-lo avui **sobreescriuria** les 84 files de `pendents.json` amb el contingut
del CSV, esborrant tot el que la Worker hi hagi afegit des de la sembra. El seu
capçal ja preveu que es podrà esborrar quan la Fase 2 estigui en marxa —i ho està.
Retirar-lo és feina de la Fase 4.

---

## 6. Resum dels forats, per gravetat

| # | Forat | On | Conseqüència |
|---|---|---|---|
| 1 | `JA_NO_HI_ES` empassat a `publica()` | `:851`–`:857` | dos curadors publiquen el mateix acte, o un publica el que l'altre ha rebutjat, i tots dos veuen «Publicat» |
| 2 | Els botons no es desactiven mentre l'escriptura vola (`ocupada` és només opacitat) | `:216`, `:832` | un doble clic duplica l'acte a `events.json`; passa amb un sol curador |
| 3 | `events.concat([editat])` no mira si l'`id` ja hi és | `:835`–`:837` | cap xarxa de seguretat contra 1 i 2, ni contra publicar dos cops en sessions diferents |
| 4 | Recarregar i activar el testimoni esborren les edicions sense avisar | `:933`, `:974` | es perd feina de traducció ja escrita, en silenci |
| 5 | El testimoni no es valida en enganxar-lo | `:959` | la pàgina diu «escriptura activada» amb un testimoni mort; l'error surt al primer Publica |
| 6 | Sense `Array.isArray` abans de transformar | `:835`, `:791` | un JSON malformat dona un `TypeError` opac enmig d'una publicació, no un missatge clar |
| 7 | `importa-csv.js` encara pot sobreescriure `pendents.json` | arrel del repositori | pèrdua de tota la cua acumulada si s'executa per error |
| 8 | El filtre de `CUA` treu totes les files idèntiques de la pantalla | `:861`, `:890` | recompte desquadrat fins a recarregar; cosmètic |
| 9 | `cache: 'no-store'` al curador i no a la Worker | `worker.js:965` | asimetria sense efecte observat; possible `sha` vell si GitHub canviés de capçaleres |

Cap d'aquests forats no s'ha tocat en aquesta auditoria: és una lectura, no un
canvi. Els números 1, 2 i 3 són el mateix problema vist des de tres llocs —la
publicació no té cap noció d'«aquest acte ja hi és»— i qualsevol arranjament
futur val més que els resolgui alhora.
