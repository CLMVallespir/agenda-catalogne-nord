# CLAUDE.md — «Què fas?» · Agenda de Catalunya Nord

*Constitució del projecte per a l'agent de codi. Sempre en context. Les fases de
treball són a `FASES.md`. Última revisió: 27 d'agost de 2026.*

---

## 1. Què és

Una agenda cultural automatitzada i de cost gairebé zero per a **Catalunya Nord**
(les cinc comarques: Rosselló, Conflent, Vallespir, Capcir, Cerdanya). Nom públic:
**«Què fas?»**. Projecte d'una sola persona voluntària (Miquel, el propietari), que
**no és desenvolupador professional**: tot ha de continuar sent reparable per ell,
sol, al cap de sis mesos.

L'arquitectura — tota, i l'única:

```
associació ──correu──► agenda@clm.cat ──► Cloudflare Email Routing
                                                │
associació ──formulari Typebot──► POST ──►  UN SOL WORKER (Cloudflare)
                                            ├─ email():     parseja → Gemini → Cloudinary → pendents.json → reenvia l'original a Gmail (arxiu)
                                            ├─ fetch():     mapa determinista del formulari → pendents.json
                                            └─ scheduled(): digest setmanal per comarca via Brevo
                                                │
                              curador.html (GitHub Pages) ──valida──► events.json
                                                │
                              web públic estàtic (GitHub Pages) llegeix events.json
```

- **`events.json`** (arrel del repositori) és la font de veritat del que és públic.
- **`pendents.json`** (arrel del repositori) és la cua de revisió del curador
  **i la memòria de rebuig del projecte**: rebutjar una fila no la suprimeix, li
  posa `estat = "rebutjat"` i la deixa on és. Per això la cua del curador filtra
  explícitament `estat === 'pendent'` en pintar.
- El **Gmail d'arxiu** només rep correu reenviat pel Worker. Cap script no hi viu.
  És el registre permanent de cada tramesa original.

Públic: la ciutadania nord-catalana en general. To: obert, cultural, acollidor —
**mai activista ni polític**.

## 2. Com treballar

- **Fes la cosa més simple que funcioni.** Cap funcionalitat, abstracció ni
  refactorització més enllà del que la tasca demana. No dissenyis per a necessitats
  hipotètiques.
- **Quan tinguis prou informació, actua.** Si hi ha una tria oberta, proposa una
  recomanació, no un menú.
- **Abans d'informar de progrés, audita cada afirmació contra un resultat real
  d'aquesta sessió.** Si una prova falla, digues-ho amb la sortida; si un pas s'ha
  saltat, digues-ho. Cap porta de fase (vegeu `FASES.md`) no es declara passada
  sense l'evidència mostrada.
- **Atura't només quan calgui de debò:** una acció destructiva, un canvi real
  d'abast, o una dada que només el propietari pot donar (claus, DNS, comptes).
- **Mantén `NOTES.md`** a l'arrel: una lliçó per entrada, amb resum d'una línia.
  Correccions i enfocaments confirmats, amb el perquè. Esborra les notes que
  resultin errònies. No hi dupliquis el que el repositori ja registra.
- Si una petició xoca amb una restricció del §3, **fes aflorar la tensió** i
  proposa l'alternativa més simple dins l'esperit — no trenquis el patró en silenci.

## 3. Restriccions innegociables

- **Només capes gratuïtes:** Cloudflare (Email Routing + Workers), GitHub Pages,
  Cloudinary, Brevo, API de Gemini. Cap infraestructura de pagament, mai.
- **Cap framework, cap eina de compilació, cap npm.** JavaScript vanilla pertot.
  **Única excepció, ja decidida:** `postal-mime`, *vendoritzat* — un sol fitxer
  fixat, copiat al repositori amb la versió i l'URL d'origen al comentari de
  capçalera. Cap `package.json`, cap `node_modules`.
- **Desplegament sense cadena d'eines:** el Worker es desplega enganxant el codi a
  l'editor del tauler de Cloudflare. Si el tauler fa difícil un Worker de dos
  mòduls, la sortida acceptada és concatenar el fitxer vendoritzat dins el Worker,
  un sol cop, dins d'un bloc marcat amb bàner clar. Mai `wrangler` com a requisit.
- **Cap base de dades.** L'estat viu en dos fitxers JSON al repositori
  (`events.json`, `pendents.json`) i prou.
- **Cap compte d'usuari, cap login, cap servidor més enllà de l'únic Worker.**
- **Les imatges viuen a Cloudinary, mai a Git.**
- **Bilingüe, català primer,** a tot el que veu el públic (§6). Excepció única:
  `curador.html` és només en català — l'únic usuari n'és el curador.
- **Els secrets viuen als Secrets del Worker** (`GEMINI_API_KEY`, `GITHUB_TOKEN`,
  `BREVO_API_KEY`, `TYPEBOT_SECRET` + IDs de llistes Brevo). El
  `CLOUDINARY_CLOUD_NAME` no és secret. Mai al codi, mai als registres, mai a Git.
- El token de GitHub és **de gra fi, limitat a aquest repositori, només
  `contents: write`**.

## 4. L'esquema — canònic i exacte

**Disset camps** — el recompte real des del 29 d'agost de 2026 —, amb aquests
noms i aquest ordre, idèntics a tot arreu. No en canviïs mai cap sense tocar
**tots** els llocs de la llista del §4 bis alhora.

> **CORRECCIÓ DEL 3 DE SETEMBRE DE 2026.** Aquest paràgraf deia «els quatre
> llocs alhora», i la xifra era falsa. Els enums viuen a **catorze còpies dins
> de nou fitxers de codi**, més cinc documents. La conseqüència no va ser
> teòrica: quan es va afegir `Concentració` a l'enum, es va posar només al
> filtre i a les icones d'`app.js` —dos llocs de catorze—, i durant dies hi va
> haver una fila publicada a `events.json` amb una categoria que
> `curador.html` i `worker/worker.js` no reconeixien i **buidaven en silenci**
> via `valorPermes()`. La llista del §4 bis existeix perquè això no torni a
> passar.

*Per què disset i no setze:* els setze primers són els de sempre i no n'ha
canviat cap. El dissetè, `nota_curador`, és nou i és de naturalesa diferent: no
descriu l'acte, sinó que diu al curador què ha d'anar a mirar abans d'aprovar la
fila. Es va afegir quan la canonada d'ingestió externa va començar a produir
files amb problemes coneguts —títol per traduir, categoria sense calaix, municipi
que no consta— que fins llavors no tenien on dir-se. Si algun document del
projecte encara diu «setze camps», és anterior a aquesta data.

1. `id` — `YYYY-MM-DD-slug` (ex.: `2026-09-14-ball-prats`); buit si no hi ha data
2. `titol` — títol, en català
3. `data_inici` — `YYYY-MM-DD`
4. `data_fi` — `YYYY-MM-DD`; igual a `data_inici` si és d'un sol dia
5. `hora` — `HH:MM` 24 h; buit si tot el dia o desconegut
6. `lloc` — nom del local
7. `municipi` — poble, en forma catalana quan es coneix (Perpinyà, Prada, Ceret)
8. `comarca` — una de les 5 exactes, si no `""`
9. `categoria` — una de les 13 exactes, si no `""`
10. `descripcio_ca` — 2–4 frases, català natural
11. `descripcio_fr` — traducció francesa fidel de `descripcio_ca`
12. `associacio` — entitat organitzadora
13. `imatge_url` — URL de Cloudinary; `""` si no n'hi ha
14. `font_url` — enllaç a la font original; `""` si no n'hi ha
15. `estat` — `pendent` · `publicat` · `rebutjat`
16. `data_entrada` — marca de temps ISO de creació de la fila
17. `nota_curador` — avisos per a qui revisa la fila; `""` per defecte

**Comarques:** Rosselló · Conflent · Vallespir · Capcir · Cerdanya
**Categories (13):** Música · Teatre · Dansa i ball · Conferència · Exposició ·
Mercat · Cinema · Taller · Activitat infantil · Patrimoni i tradicions ·
Concentració · Esports · Vida associativa

Regles de què depèn el codi:

- **Tot camp és una cadena.** Valor desconegut = `""` — mai `null`, mai omès.
- `imatge_url`, `font_url`, `estat` i `data_entrada` **els omple el sistema, mai el
  model d'extracció** (el prompt els retorna buits expressament).
- **No et refiïs mai de l'`id` que retorni el model:** reconstrueix-lo sempre amb
  `creaId(dataInici, titol)`. Coerceix `comarca` i `categoria` a la llista permesa
  amb `valorPermes(...)`, si no `""`.

**Regles pròpies d'`estat` a `pendents.json`** — `rebutjat` hi és **persistent**:

- **Rebutjar no suprimeix la fila.** `rebutja()` a `curador.html` fa **una sola
  escriptura**: llegeix `pendents.json`, posa `estat = "rebutjat"` a la fila i
  torna a escriure el fitxer sencer. Cap `splice`, cap fila treta.
- **Per això `pendents.json` és la memòria de rebuig del projecte.** Un acte que
  el curador ha dit que no ha de deixar rastre en algun lloc, o la
  sincronització automàtica de l'ADT66 el tornarà a oferir cada setmana. Aquest
  lloc és el mateix fitxer —posició al fitxer, no un tercer magatzem—, perquè el
  §3 diu que l'estat viu en dos fitxers JSON i prou.
- **La cua només pinta `estat === 'pendent'`**, i el filtre és literalment això,
  no `!== 'rebutjat'`: qualsevol estat nou o inesperat queda fora de la cua per
  defecte, que és el costat segur.
- **Publicar no ha canviat:** dues escriptures, `events.json` primer i **treure**
  la fila de `pendents.json` després (vegeu `NOTES.md`). Publicar treu, rebutjar
  marca. Decidit el 3 de setembre de 2026.

**Regles pròpies de `nota_curador`** — és un camp de servei, no de contingut:

- **L'escriuen només els agents de darrere** (ara mateix, `mapejaAProduccio()`).
  Ni el model d'extracció, ni el Typebot, ni cap persona hi escriuen: el prompt
  no el coneix i el formulari no el demana.
- **El frontend públic no el llegeix mai.** `index.html` i `app.js` l'han
  d'ignorar si hi és. Avui ho fan sols, perquè llegeixen els camps pel nom i mai
  no itineren les claus d'un esdeveniment; qui hi toqui ha de mantenir-ho així.
- **Només es mostra a `curador.html`**, com un avís groc a dalt de la fitxa, i
  **no és editable**: no porta `data-camp`, de manera que `recullFitxa()` ni el
  veu. El curador el llegeix, no el toca.
- **Es descarta en publicar, i és deliberat.** És el camp 17è: viu a
  `pendents.json` i a `curador.html` i s'atura allà. `recullFitxa()` construeix
  els **16 camps canònics exactes** i la nota no hi entra, o sigui que
  `events.json` no en porta mai cap. El motiu: `events.json` és l'arxiu públic i
  es serveix sencer a qualsevol navegador, i una nota de treball intern
  («municipi que no consta», «títol per traduir») no hi pinta res; si mai cal
  consultar-la, la traça queda a l'historial de git de `pendents.json`.
  **Decidit el 29 d'agost de 2026: no és cap descuit i no s'ha d'«arreglar».**
- És l'única excepció a «cada camp descriu l'acte»: aquest descriu **la fila**.
  Per això, quan es fusionen dues files duplicades, no mana la jerarquia de fonts
  sinó que es queden **totes dues notes** (`eines/dedup-esdeveniments.js`).

*Qui l'escriu avui i qui encara no:* `mapejaAProduccio()` sí. El Worker
(`email()` i `fetch()`) encara **no**: les files que hi entren no porten el camp
fins que el Worker es torni a desplegar. Com que un camp desconegut és `""`,
això no trenca res ni al curador ni al web, però val més saber-ho que
descobrir-ho.

## 4 bis. On viu l'enum — la llista completa

Comprovat amb `grep` sobre tot el repositori el 3 de setembre de 2026. **Un
valor nou de `comarca` o de `categoria` s'ha d'afegir als catorze llocs de la
primera taula el mateix dia**, o el sistema el buida sol: `valorPermes()`
retorna `""` per a tot el que no és a la seva llista, i tant `curador.html` com
el Worker el criden en desar.

**No ho comprovis a mà —hi ha un guió que ho fa:**

```
node eines/verifica-enum.js
```

Llegeix les dues llistes bones de `prompts/extract-event.txt` (el mestre, §7),
les compara amb totes les còpies, i torna 1 si res no quadra. Enxampa un valor
que falti, un que sobri, l'ordre canviat, el numeral del prompt que es queda
enrere («una d'aquestes **deu**» amb tretze valors a la llista) i una còpia del
prompt del Worker que hagi deixat de ser literal. **Executa'l sempre que toquis
un enum, i abans de desplegar el Worker.**

**Les catorze còpies vives, en nou fitxers:**

| # | Fitxer | Què hi ha |
|---|---|---|
| 1 | `prompts/extract-event.txt` | la línia `- categoria:` del prompt mestre |
| 2 | `worker/worker.js` | `CATEGORIA_VALUES` |
| 3 | `worker/worker.js` | la còpia literal del prompt |
| 4 | `worker/worker-concatenat.js` | `CATEGORIA_VALUES` |
| 5 | `worker/worker-concatenat.js` | la còpia literal del prompt |
| 6 | `app.js` | `CATEGORIES` (filtre del web públic, amb el francès) |
| 7 | `app.js` | `CATEGORIA_ICONES` (**una icona SVG per categoria**) |
| 8 | `curador.html` | `CATEGORIA_VALUES` (desplegable **i** `valorPermes()` en desar) |
| 9 | `importa-csv.js` | `CATEGORIA_VALUES` |
| 10 | `eines/dedup-esdeveniments.js` | `CATEGORIES` |
| 11 | `eines/mapeja-adt66.js` | `CATEGORIES` |
| 12 | `eines/mapeja-recerca.js` | `CATEGORIES` |
| 13 | `prova-local.html` | `CATEGORIES` (mirall offline d'`app.js`) |
| 14 | `prova-local.html` | `CATEGORIA_ICONES` (ídem) |

**Els cinc documents que també l'escriuen** i que queden desfasats si no es
toquen: aquest fitxer (§4), `skill/agenda-nord-core/SKILL.md`,
`PROJECT-KNOWLEDGE.md` (l'enum **i** el recompte d'icones),
`PROJECT-KNOWLEDGE-CHAT.md` i `docs/pas-5-typebot-questionari.md`.

**Dues còpies congelades que NO s'han de sincronitzar mai**, i per què:

- `docs/arxiu-google/utils.gs` i `docs/arxiu-google/processNewEmails.gs` — codi
  mort del sistema anterior (§9). Actualitzar-les seria fer veure que
  s'executen.
- `img/_ds/clm-vallespir-design-system-*/_ds_bundle.js` — export d'una eina de
  disseny del 27 d'agost de 2026, amb una còpia fossilitzada de `CATEGORIES` a
  dins. **Cap pàgina no el carrega**: els dos `.dc.html` d'`img/` només en fan
  servir `tokens/colors.css`. És una fotografia, no codi.

*La resta d'ocurrències del repositori són **dades o casos de prova**, no
enums: `events.json`, `pendents.json`, `events-exemple.json`,
`esdeveniments-importacio-filtrat.csv` i les files de prova d'
`eines/classifica-editorial.js`. No es toquen quan creix l'enum.*

## 5. Estil de codi

- **Una funció = una feina.** Explícit per damunt d'implícit:
  `if (estat === 'publicat')`, mai `if (fila[14])`.
- **Noms de domini en català:** `carregaEsdeveniments`, `creaTargeta`,
  `analitzaCorreu`, `construeixFila`. Abreviatures acceptades: `url`, `id`, `ca`,
  `fr`.
- Un comentari d'una línia a cada funció; un bloc bàner a dalt de cada fitxer;
  separadors de secció amb guions.
- `async/await` amb `try/catch` explícit; gestió d'errors explícita a cada crida
  d'API; mai registrar cap clau.
- Cap truc: ni ternaris niats, ni desestructuració als arguments, ni one-liners
  encadenats en codi crític.
- **Autoprova de tot fitxer:** podria el propietari, no professional, obrir-lo al
  cap de sis mesos i arreglar-hi un error sense demanar ajuda? Si no, simplifica.

## 6. Protocol lingüístic (tot el que veu el públic)

Català sempre primer; el francès just a sota, més petit, en Georgia itàlica i
apagat. Separador bilingüe: ` · `. Apòstrofs corbats (`l'agenda`, `d'agost`) i
contraccions correctes (`a l'1`, `al 20`, `Fins al…`; francès `1er`, `Jusqu'au`).
Les dues llengües no comparteixen mai tipografia: Fraunces (títols catalans),
Montserrat (cos català i UI), Georgia itàlica (francès). Cap exclamació
publicitària.

## 7. Mecànica dels serveis (fets, no decisions)

- **Gemini** — model a una única constant `GEMINI_MODEL`, ara
  `gemini-3.5-flash-lite` (mai la gamma Pro: és de pagament). Clau a la capçalera
  `x-goog-api-key`. `generationConfig`: `responseMimeType: 'application/json'`,
  `maxOutputTokens: 4096`, `thinkingConfig: { thinkingLevel: 'minimal' }` — **cap
  `temperature`** (ignorada als models 3.x) i **cap `thinkingBudget`** (llegat,
  incompatible amb `thinkingLevel`). Resposta parsejada defensivament del primer
  `{` a l'últim `}`. Si mai retorna 404 amb el nom del model, és cicle de vida
  normal de Google: consulta els models Flash/Flash-Lite vigents i canvia la
  constant.
- **Prompt d'extracció** — `prompts/extract-event.txt` és el mestre; la còpia dins
  el Worker ha de ser-hi **idèntica, al peu de la lletra**. `{{AVUI}}` se
  substitueix per la data d'avui (`YYYY-MM-DD`), serveix només per inferir un any
  absent; el text del correu s'afegeix després de la línia `CORREU:`. El prompt
  exigeix només JSON, sense preàmbul ni tanques markdown, amb les 16 claus sempre
  presents com a cadenes.
- **Cloudinary** — pujada *unsigned*: preset `agenda-posters`, carpeta
  `clm-agenda/posters`, transformació d'entrada `w_800,c_limit,q_80,f_webp`. Només
  cal el nom del cloud, cap signatura. El preset ja converteix un PDF en WebP de la
  primera pàgina: puja el PDF tal qual. Accepta la primera imatge o PDF adjunt;
  ignora les imatges en línia.
- **GitHub** — lectura i escriptura de `pendents.json` i `events.json` **sempre
  via l'API de continguts** (mai llegint de Pages, que serveix còpies de CDN
  endarrerides): GET per obtenir contingut + SHA, un sol PUT amb base64 i
  `JSON.stringify(dades, null, 2)`. En conflicte de SHA (escriptor concurrent),
  torna a llegir i reintenta un cop.
- **Brevo** — un correu **transaccional per subscriptor** (mai campanya), amb línia
  de baixa bilingüe a cada missatge. Llistes per comarca (IDs als Secrets).
- **Typebot** — el formulari recull **una sola** `descripcio` més un senyal
  `idioma_descripcio` (`"ca"`/`"fr"`): posa el text a la banda que toca i deixa
  l'altra buida (el curador completa la traducció en revisar). El cartell ja puja
  del navegador a Cloudinary dins el flux del Typebot: l'URL arriba fet, guarda'l
  tal qual.

## 8. Fora d'abast — no ho construeixis, ni si t'ho demanen de passada (confirma primer)

Comptes d'usuari o login · portal d'autosubmissió · edició d'esdeveniments al web
públic · comentaris o funcions socials · analítica o seguiment · cap base de dades ·
cap servidor més enllà de l'únic Worker · cap framework CSS o JS · cap selector
d'interval de dates al web públic.

Ajornat amb camí ja acordat (documentat a `FASES.md` §Ajornats, no per construir
ara): tokens de curació per comarca; confirmació del primer remitent; «send mail
as» per respondre des de `agenda@clm.cat`.

## 9. Actius existents — NO els reconstrueixis

Ja fets, en producció, al mateix repositori:

- **`index.html` / `style.css` / `app.js`** — el web públic, amb el disseny
  blanc-i-negre de dos temes (clar/fosc), el logotip «Què fas?», filtres per
  comarca i categoria, llista cronològica per dies. No en toquis el disseny.
- **`events.json`** — dades publicades. **`events-exemple.json`** + `?prova=1` —
  mode de prova amb dades fictícies. **`prova-local.html`** — mirall offline.
- **`prompts/extract-event.txt`** — el prompt d'extracció mestre.
- **`fonts/`** (woff2 autoallotjats) i **`img/logo/`**.
- **`docs/`** — guies i informes, inclòs `CRITERI-EDITORIAL.md` (el criteri de què
  entra a l'agenda i què no: és del curador, no del codi).
- **`docs/arxiu-google/`** — **codi mort, no el toquis.** El sistema anterior
  (full de càlcul + Apps Script), retirat de l'ús viu el 29 d'agost de 2026 amb
  la Fase 4, i les guies que el descrivien. Es conserva perquè diverses notes de
  `NOTES.md` s'hi refereixen per explicar per què el Worker fa les coses com les
  fa. Res d'allà dins no s'executa i res no s'ha de mantenir al dia. Les còpies
  originals de `creaId()` i `valorPermes()` són a `docs/arxiu-google/utils.gs`.

La teva feina és **la canonada nova i `curador.html`** — res més. Els detalls, fase
a fase, a `FASES.md`.
