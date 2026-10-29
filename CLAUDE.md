# CLAUDE.md — «Què fas?» · Agenda de Catalunya Nord

*Constitució del projecte per a l'agent de codi. Sempre en context. Descriu el
sistema tal com és avui; la història, les decisions tancades i les lliçons són
a `NOTES.md`. Última revisió: 23 d'octubre de 2026.*

---

## 1. Què és

Una agenda cultural automatitzada i de cost gairebé zero per a **Catalunya Nord**
(les cinc comarques: Rosselló, Conflent, Vallespir, Capcir, Cerdanya). Nom públic:
**«Què fas?»**. Projecte d'una sola persona voluntària (Miquel, el propietari), que
**no és desenvolupador professional**: tot ha de continuar sent reparable per ell,
sol, al cap de sis mesos.

L'arquitectura — tota, i l'única. Són **dos contextos d'execució**, no un: el
Worker, que treballa **per esdeveniment** i en directe, i l'Action, que treballa
**per lot** i periòdicament. Els dos escriuen al mateix `pendents.json` i cap
dels dos no toca mai `events.json`.

```
associació ──correu──► agenda@clm.cat ──► Cloudflare Email Routing
                                                │
associació ──formulari Typebot──► POST ──►  UN SOL WORKER (Cloudflare)
                                            ├─ email():     reenvia l'original a Gmail (arxiu) → parseja → Claude → Cloudinary → pendents.json
                                            ├─ fetch():     mapa determinista del formulari → pendents.json
                                            └─ scheduled(): digest setmanal per comarca via Brevo
                                                │
flux ADT66 ──────────────────────────────►  UNA SOLA ACTION (GitHub Actions)
                                            └─ .github/workflows/sincronitza-adt66.yml
                                                 └─ eines/sincronitza-programada.js
                                                      sincronitza → mapeja → classifica → filtra → tradueix (Claude) → pendents.json
                                                      (Claude sí, fins a dos intents per fila; Cloudinary no)
                                                │
                              curador.html (GitHub Pages) ──valida──► events.json
                                                │
                              web públic estàtic (GitHub Pages) llegeix events.json
```

- **`events.json`** (arrel del repositori) és la font de veritat del que és públic,
  i només hi ha actes que no han passat: cada publicació en treu els passats (D-08).
- **`pendents.json`** (arrel del repositori) és la cua de revisió del curador
  **i la memòria de rebuig del projecte**: rebutjar una fila no la suprimeix, li
  posa `estat = "rebutjat"` i la deixa on és; publicar tampoc no la suprimeix, hi
  posa `estat = "publicat"`. Per això la cua del curador filtra explícitament
  `estat === 'pendent'` en pintar.
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
  saltat, digues-ho.
- **Atura't només quan calgui de debò:** una acció destructiva, un canvi real
  d'abast, o una dada que només el propietari pot donar (claus, DNS, comptes).
- **`NOTES.md` és l'única història del projecte.** Abans de tocar una part,
  llegeix-ne les entrades: hi ha les decisions que no es reobren (§2), el que se
  sap de les fonts i els errors que no s'han de repetir. Una lliçó per entrada,
  amb resum i el perquè; les que resultin errònies s'esborren. Una decisió nova
  hi entra amb el número següent (D-07…). No hi dupliquis el que el repositori ja
  registra.
- **Cap carpeta d'arxiu, cap document de feina que sobrevisqui a la feina.** Una
  eina d'un sol ús s'esborra quan el seu resultat és commitat; un handoff, un
  sondeig o un informe, quan el que ensenya ha passat a `NOTES.md` o aquí. El
  passat el guarda git.
- Si una petició xoca amb una restricció del §3, **fes aflorar la tensió** i
  proposa l'alternativa més simple dins l'esperit — no trenquis el patró en silenci.
- **Perfils de sub-agent a `.claude/agents/`:** `agenda-lector` (només lectura:
  anàlisi i verificacions, sense git ni escriptures), `agenda-auditor` (només
  lectura: evidències d'arquitectura, sense judici) i `agenda-implementador`
  (canvis de codi amb una especificació completa, sense git ni fitxers d'estat).
  Git i l'escriptura de `pendents.json`/`events.json` són només del coordinador.
- **Coordinació amb Claude Chat:** encàrrecs (`ENC`) i informes (`INF`) segons
  `docs/COORDINACIO.md`, que diu també quin criteri guanya quan *Clean Code* i els
  mòduls profunds no diuen el mateix.
- **Proves:** amb `node:test` i `node:assert`, que venen amb Node (zero
  dependències). Viuen a `proves/` i s'executen una per una:
  `node --test proves/<nom>.test.js`. La majoria de mòduls d'`eines/` porten
  també una bateria pròpia (`node eines/<nom>.js`), però **no executis mai la
  carpeta sencera**: `eines/cartells-a-cloudinary.js` reescriu `pendents.json`
  si no se li passa `--prova`, i `eines/adt66-sincronitza.js` baixa el flux.
  Un fitxer de `proves/` que fa `require` d'un mòdul d'`eines/` no pot dur al nom
  el nom de cap mòdul d'`eines/`: les guardes de les bateries miren
  `process.argv[1]` per subcadena i s'engegarien. `proves/passada-action.test.js`
  és la xarxa de la passada de l'Action: una refactorització no en pot canviar la
  sortida.

## 3. Restriccions innegociables

- **Només capes gratuïtes:** Cloudflare (Email Routing + Workers), GitHub Pages,
  Cloudinary, Brevo. Cap infraestructura de pagament, mai.
  **Única excepció, decidida pel propietari el 23 d'octubre de 2026:** l'API de
  Claude (Anthropic). No és cap capa gratuïta: és un servei de pagament que
  cobreix el crèdit mensual gratuït de l'organització. Per això l'excepció només
  val amb **un límit de despesa a la consola d'Anthropic que no passi del
  crèdit**, i sense cap targeta amb recàrrega automàtica: quan el crèdit
  s'acaba, les crides han de fallar, no cobrar. El compte del cost és a
  `NOTES.md`.
- **Cap framework, cap eina de compilació, cap npm.** JavaScript vanilla pertot.
  **Única excepció:** `postal-mime`, *vendoritzat* — un sol fitxer fixat, copiat
  al repositori amb la versió i l'URL d'origen al comentari de capçalera. Cap
  `package.json`, cap `node_modules`.
- **Desplegament sense cadena d'eines:** el Worker es desplega **només** enganxant
  `worker/worker-concatenat.js` a l'editor del tauler de Cloudflare. És un fitxer
  generat: `postal-mime.js` sense el seu `export`, un bàner, i `worker/worker.js`
  sense l'`import`. Es toca `worker.js`, es regenera el concatenat al mateix
  commit i s'enganxa sencer; mai al revés. Abans d'enganxar-lo,
  `node eines/verifica-worker-concatenat.js` ha de sortir en verd. El Git Build
  de Cloudflare és desconnectat a posta, i cap `wrangler` ni cap fitxer de
  configuració de desplegament: dues vies alhora es trepitgen en silenci.
- **Cap base de dades.** L'estat viu en dos fitxers JSON al repositori
  (`events.json`, `pendents.json`) i prou.
- **Cap compte d'usuari, cap login, cap servidor més enllà de l'únic Worker.**
- **Les imatges viuen a Cloudinary, mai a Git.**
- **Bilingüe, català primer,** a tot el que veu el públic (§6). Excepció única:
  `curador.html` és només en català — l'únic usuari n'és el curador.
- **Els secrets viuen als Secrets del Worker** (`ANTHROPIC_API_KEY`,
  `GITHUB_TOKEN`, `BREVO_API_KEY`, `TYPEBOT_SECRET`, `ADRECA_ARXIU` + IDs de
  llistes Brevo). El `CLOUDINARY_CLOUD_NAME` no és secret i és una variable de
  text del tauler. Mai al codi, mai als registres, mai a Git.
- El token de GitHub és **de gra fi, limitat a aquest repositori, només
  `contents: write`**.

## 4. L'esquema — canònic i exacte

**Divuit camps**, amb aquests noms i aquest ordre, idèntics a tot arreu. No en
canviïs mai cap sense tocar **tots** els llocs de la llista del §4 bis alhora.
Els disset primers descriuen l'acte i són públics; el 18è, `nota_curador`,
descriu la fila i no surt mai de la cua.

1. `id` — `YYYY-MM-DD-slug` (ex.: `2026-09-14-ball-prats`); buit si no hi ha data
2. `titol` — títol, en català
3. `data_inici` — `YYYY-MM-DD`
4. `data_fi` — `YYYY-MM-DD`; igual a `data_inici` si és d'un sol dia.
    Mai anterior a `data_inici` (D-05): a l'ADT66 no es pot produir; a les portes
    manuals el Worker ho avisa a `nota_curador`.
5. `hora` — `HH:MM` 24 h; buit si tot el dia o desconegut
6. `lloc` — nom del local
7. `municipi` — poble, en forma catalana quan es coneix (Perpinyà, Prada, Ceret)
8. `comarca` — una de les 5 exactes, si no `""`
9. `categoria` — una de les 13 exactes, si no `""`
10. `descripcio_ca` — 2–4 frases, català natural
11. `descripcio_fr` — traducció francesa fidel de `descripcio_ca`
12. `associacio` — entitat organitzadora
13. `imatge_url` — URL de Cloudinary; `""` si no n'hi ha.
    La del formulari només s'accepta si és del Cloudinary de l'agenda.
14. `font_url` — enllaç a la font original; `""` si no n'hi ha.
    Només `http:` o `https:` (`esUrlSegura()` de `url-segura.js`), com tota
    adreça que va a un enllaç.
15. `estat` — `pendent` · `publicat` · `rebutjat`
16. `data_entrada` — marca de temps ISO de creació de la fila
17. `periodicitat` — activitat permanent: frase lliure en català («cada
    dissabte al matí»); `""` vol dir «acte puntual», no «no ho sabem». Les
    regles (Q1–Q5) són a `NOTES.md`, «Activitats permanents».
18. `nota_curador` — avisos per a qui revisa la fila; `""` per defecte, i
    l'únic dels divuit que **no** arriba a `events.json` (vegeu més avall)

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
  amb `valorPermes(...)`, si no `""`. L'`id` no és únic (tres paraules del
  títol): per identificar una fila, `id` + `titol` + `municipi`.
- **La fila d'una porta surt per `filaSegura(campsBruts, origen)`**
  (`eines/fila-segura.js`): els divuit camps en ordre i tots cadenes, un sostre
  de caràcters per camp de text (amb avís si talla), el títol en una sola línia
  (va al missatge dels commits), dates `AAAA-MM-DD` o `""` amb avís, les dues
  llistes, adreces http(s), `id`/`estat`/`data_entrada` del sistema, i cap
  claudàtor a `nota_curador` fora del tag `[ADT66 id: …]` del davant. Només
  sanitza: no decideix res d'entrar (D-04). Es crida a la porta, **abans de cap
  fusió**. Avui hi passa l'ADT66 (`mapejaOfertaADT66()`, i la traducció de
  l'Action per `campSegur()`); el Worker encara no.

**Regles pròpies d'`estat` a `pendents.json`** — `rebutjat` hi és **persistent**:

- **Rebutjar no suprimeix la fila.** `rebutja()` a `curador.html` llegeix
  `pendents.json`, posa `estat = "rebutjat"` a la fila i torna a escriure el
  fitxer sencer. Cap `splice`, cap fila treta.
- **Per això `pendents.json` és la memòria de rebuig del projecte.** Un acte que
  el curador ha dit que no ha de deixar rastre en algun lloc, o la
  sincronització automàtica de l'ADT66 el tornarà a oferir cada setmana. Aquest
  lloc és el mateix fitxer, perquè el §3 diu que l'estat viu en dos fitxers JSON
  i prou.
- **La cua només pinta `estat === 'pendent'`**, i el filtre és literalment això,
  no `!== 'rebutjat'`: qualsevol estat nou o inesperat queda fora de la cua per
  defecte, que és el costat segur.
- **Publicar marca, igual que rebutjar:** dues escriptures, `events.json` primer
  i després **substituir**, a la mateixa posició de `pendents.json`, la fila per
  la publicada (`estat = "publicat"`, `nota_curador` intacta, els 18 camps).
  `events.json` no conserva `nota_curador`, on viu el tag `[ADT66 id: …]`: sense
  la fila, la passada següent no reconeixeria l'oferta publicada.
- **La poda de l'Action treu les `pendent`, les `rebutjat` i les `publicat` que
  ja han passat.** Ho fa `podaCaducades()` a `eines/sincronitza-programada.js`,
  dins de cada escriptura: l'últim dia de l'acte —`data_fi`, o `data_inici` si
  `data_fi` és buida— anterior a avui. Qualsevol estat inesperat i qualsevol
  fila sense cap data utilitzable no es poden mai. El registre del run compta
  les tres per separat. No es perd cap memòria: la vora és la mateixa de la
  finestra de `filtraCandidats()`, o sigui que una oferta caducada el filtre ja
  la llença abans d'arribar enlloc, i la fila podada queda a l'historial de git.
- **El curador poda `events.json` a cada publicació (D-08)**, al mateix commit
  i amb la mateixa regla: `podaEventsPassats()` a `curador-cua.js`, amb l'avui
  del rellotge del navegador. La regla de «ja ha passat» és una de sola,
  `esCaducada()` a `curador-cua.js`, i `podaCaducades()` la hi va a buscar. Si no
  es pot publicar cap acte del lot, no s'escriu res, ni la poda.
- **En fusionar dues files duplicades, l'estat es resol per precedència i mai
  per posició.** L'ordre, de més fort a més fluix, és
  **`publicat` > `rebutjat` > `pendent`** (i, si cap dels dos no és cap dels
  tres, el primer que digui alguna cosa). Ho decideix
  `resolEstat(estatA, estatB)` a `eines/dedup-esdeveniments.js`. `publicat`
  primer perquè ja ha passat el filtre humà; `rebutjat` abans que `pendent`
  perquè un rebuig és una decisió sobre l'**esdeveniment**, no sobre la fila.
- **Tot mòdul nou que llegeixi `pendents.json` ha de declarar quins estats
  tracta**, al bàner de dalt del fitxer, i filtrar-los explícitament amb
  `=== 'pendent'` —mai `!== 'rebutjat'`. Els mòduls d'avui:
  `curador.html` només pinta `pendent` i hi marca com a `publicat` la fila que
  publica; `eines/cartells-a-cloudinary.js` només puja cartells de files
  `pendent` i torna la resta intacta, perquè qui la crida hi reescriu el fitxer
  sencer; `eines/dedup-esdeveniments.js` tracta els tres estats i els resol per
  precedència; `eines/dedup-contra-fitxers.js` tracta els tres estats i en
  torna una etiqueta cadascun (§4 ter); `eines/sincronitza-programada.js`
  escriu només files `pendent` i en poda les caducades dels tres estats.
- **L'Action no reescriu mai una fila que ja és a la cua.** `curador-cua.js`
  troba la fila comparant-la sencera (`JSON.stringify`); si canviés mentre el
  curador la té oberta, la seva decisió fallaria amb «ja no era a la cua».

## 4 ter. Ancoratge contra el que ja tenim — dues capes, i el biaix cap a encuar

Quan una font externa torna a oferir el mateix acte cada setmana, cal saber si
ja el tenim. `eines/dedup-contra-fitxers.js` ho resol en **dues capes de força
diferent**, i **no escriu res**: torna una etiqueta per oferta
—`ja_publicat` · `ja_a_la_cua` · `ja_rebutjat` · `nova`— i qui la crida decideix.
**`events.json` només es llegeix; d'aquesta capa no en surt mai cap escriptura.**

- **Capa 1, exacta, contra `pendents.json`.** El tag `[ADT66 id: …]` que
  `mapejaOfertaADT66()` deixa a `nota_curador` es torna a llegir amb
  `extreuIdentificadors()` d'`eines/adt66-identificador.js`, que en llegeix
  **tots** els tags d'una nota; l'oferta entrant en porta un de sol i el llegeix
  amb `extreuIdentificador()`. Igualtat d'identificador, cap llindar. Mira
  **totes** les files del fitxer, sense filtrar-ne cap per estat: filtrar-hi
  «només les pendents» faria tornar cada setmana l'oferta rebutjada, i l'oferta
  publicada la protegeix la seva fila `publicat` (`ja_publicat`).
- **Capa 2, difusa, contra `events.json`.** Les files d'`events.json` no porten
  identificador i no en portaran mai (`recullFitxa()` deixa `nota_curador`
  fora), i `font_url` no el pot portar (`NOTES.md`, «El flux de l'ADT66»). Es
  reutilitza `comparaEsdeveniments()` sencer —municipi normalitzat +
  `data_inici` com a clau dura, Jaccard dels títols com a desempat— i s'hi posa
  un llindar **més exigent** al damunt.

**La regla que mana el disseny: si dubtes, ENCUA.** Un duplicat a
`pendents.json` és visible i el curador el resol en un clic; un acte descartat
per error no el veurà mai ningú. Tot el que no sigui una coincidència clara
surt com a `nova`.

**El llindar de la capa 2 és 0,75, no el 0,55 del mòdul de dedup**, i són dos
números perquè són dues decisions: allà fusionar deixa una fila a la cua, aquí
passar el llindar vol dir que l'acte no arriba enlloc. Mesurat sobre 92 títols
reals: «El Taller de les Barques de Paulilles» i «El Taller de les Descobertes
de Paulilles», mateix poble i mateix dia, fan 0,500 i són dos tallers
diferents; la franja [0,55–0,75) és la de «una paraula distintiva canviada»;
una substitució entre títols de n paraules dona (n−1)/(n+1), que no arriba a
0,75 fins a n = 7, i 88 dels 92 títols en tenen sis o menys. Per damunt de
0,75 gairebé només hi ha títols que **afegeixen** paraules a un altre, que és la
forma d'un duplicat de debò. El cost acceptat: un acte publicat i la seva versió
llarga a la cua poden quedar per sota (0,444) i s'encuen. És la direcció bona
de l'error.

Un `estat` de `pendents.json` que no sigui cap dels tres **no s'endevina**: la
capa 1 no diu res i l'oferta acaba a `nova`. El costat segur d'aquest mòdul és
deixar-la ENTRAR, al contrari que a `curador.html`, on és deixar-la FORA de la
cua. Als dos llocs el costat segur és el que no fa desaparèixer informació
sense que ningú ho vegi.

**Regles pròpies de `nota_curador`** — és un camp de servei, no de contingut:

- **L'escriuen només els agents de darrere:** `mapejaOfertaADT66()` (el tag
  `[ADT66 id: …]`, sempre el primer, i els avisos del mapeig), la passada de
  l'Action, `pujaCartell()`, la fusió de `eines/dedup-esdeveniments.js` i el
  Worker (`afegeixNota()`). Ni el model d'extracció, ni el Typebot, ni cap
  persona hi escriuen: el prompt no el coneix i el formulari no el demana.
- **El frontend públic no el llegeix mai.** `index.html` i `app.js` llegeixen
  els camps pel nom i mai no itineren les claus d'un esdeveniment; qui hi toqui
  ha de mantenir-ho així.
- **Només es mostra a `curador.html`**, com un avís groc a dalt de la fitxa, i
  **no és editable**: no porta `data-camp`, de manera que `recullFitxa()` ni el
  veu.
- **No arriba mai a `events.json`, i és deliberat** (decidit el 29 d'agost de
  2026; no és cap descuit i no s'ha d'«arreglar»). `recullFitxa()` construeix
  els **17 camps públics exactes**. `events.json` es serveix sencer a qualsevol
  navegador, i una nota de treball intern no hi pinta res; si mai cal
  consultar-la, la traça queda a l'historial de git de `pendents.json`.
- És l'única excepció a «cada camp descriu l'acte»: aquest descriu **la fila**.
  Per això, quan es fusionen dues files duplicades, es queden **totes dues
  notes** (`ajuntaNotes()`).

*El Worker desplegat encara no l'escriu:* els avisos d'`afegeixNota()` són al
codi del repositori però no al tauler fins que es torni a enganxar el Worker.
Com que un camp desconegut és `""`, això no trenca res ni al curador ni al web.

## 4 bis. On viu l'enum — la llista completa

**Un valor nou de `comarca` o de `categoria` s'ha d'afegir als dotze llocs de la
taula el mateix dia**, o el sistema el buida sol: `valorPermes()` retorna `""`
per a tot el que no és a la seva llista, i tant `curador.html` com el Worker el
criden en desar.

**No ho comprovis a mà —hi ha un guió que ho fa:**

```
node eines/verifica-enum.js
```

Llegeix les dues llistes bones de `prompts/extract-event.txt` (el mestre, §7),
les compara amb totes les còpies, i torna 1 si res no quadra. Enxampa un valor
que falti, un que sobri, l'ordre canviat, el numeral del prompt que es queda
enrere («una d'aquestes **deu**» amb tretze valors a la llista) i una còpia del
prompt del Worker que hagi deixat de ser literal. **Executa'l sempre que toquis
un enum, i abans de desplegar el Worker.** El germà per al joc de camps és
`node eines/verifica-camps.js`.

**Les dotze còpies vives, en vuit fitxers:**

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
| 9 | `eines/dedup-esdeveniments.js` | `CATEGORIES` |
| 10 | `eines/fila-segura.js` | `CATEGORIES` (el mapeig de l'ADT66 la llegeix d'aquí) |
| 11 | `prova-local.html` | `CATEGORIES` (mirall offline d'`app.js`) |
| 12 | `prova-local.html` | `CATEGORIA_ICONES` (ídem) |

**Els dos documents que també l'escriuen** i que queden desfasats si no es
toquen: aquest fitxer (§4) i `docs/pas-5-typebot-questionari.md`.

**Una còpia congelada que NO s'ha de sincronitzar mai:**
`img/_ds/clm-vallespir-design-system-*/_ds_bundle.js`, export d'una eina de
disseny del 27 d'agost de 2026, amb una còpia fossilitzada de `CATEGORIES` a
dins. **Cap pàgina no el carrega**: els dos `.dc.html` d'`img/` només en fan
servir `tokens/colors.css`. És una fotografia, no codi.

*La resta d'ocurrències del repositori són **dades o casos de prova**, no
enums: `events.json`, `pendents.json`, `events-exemple.json` i `proves/dades/`.
No es toquen quan creix l'enum.*

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
- Als documents, cita una funció o un bloc pel nom, mai per `fitxer:línia`:
  les línies es mouen.

## 6. Protocol lingüístic (tot el que veu el públic)

Català sempre primer; el francès just a sota, més petit, en Georgia itàlica i
apagat. Separador bilingüe: ` · `. Apòstrofs corbats (`l'agenda`, `d'agost`) i
contraccions correctes (`a l'1`, `al 20`, `Fins al…`; francès `1er`, `Jusqu'au`).
Les dues llengües no comparteixen mai tipografia: Fraunces (títols catalans),
Montserrat (cos català i UI), Georgia itàlica (francès). Cap exclamació
publicitària.

## 7. Mecànica dels serveis (fets, no decisions)

- **Claude (Anthropic)** — **Dues constants de model, una per context, que no
  es mouen juntes**: al Worker, `CLAUDE_MODEL` = `claude-haiku-5-5`; a l'Action,
  `CLAUDE_MODEL_TRADUCCIO` = `claude-haiku-5-5`. Tots dos amb
  `CLAUDE_MAX_TOKENS` = 8192, perquè el pensament hi compta. Haiku i prou: el
  model següent costa vint vegades més i el pitjor mes ja no cap en el crèdit.
  Un `fetch` a `https://api.anthropic.com/v1/messages` i cap SDK (§3: cap npm).
  Capçaleres `x-api-key` (la clau; mai a l'URL, mai al registre),
  `anthropic-version` = `CLAUDE_VERSIO_API` (`2026-10-21`, fixa a posta) i
  `content-type`. Cos idèntic als dos contextos llevat de l'esquema: `model`,
  `max_tokens`, `thinking: { type: 'adaptive' }` amb
  `output_config.effort: 'high'` (sense pensar, Haiku saltava les regles del
  prompt; la prova és a `NOTES.md`), `messages` amb un sol missatge `user`, i
  `output_config.format` amb l'esquema JSON de les claus que demana el prompt
  —les 17 de la regla 2 del prompt d'extracció al Worker (`CLAUS_EXTRACCIO`),
  les 3 de la traducció a l'Action (`ESQUEMA_TRADUCCIO`)—, que és el que
  garanteix el JSON. **Cap `temperature`**: la versió `2026-10-21` la rebutja.
  El text es busca pel **tipus de bloc** (`type === 'text'`), mai per la
  posició, i un `stop_reason` `max_tokens` o `refusal` és un error. Resposta
  parsejada defensivament del primer `{` a l'últim `}`. Si mai retorna 404 amb
  el nom del model, és cicle de vida normal d'Anthropic: mira quin Haiku hi ha
  vigent i canvia la constant.
- **Prompt d'extracció** — `prompts/extract-event.txt` és el mestre; la còpia dins
  el Worker ha de ser-hi **idèntica, al peu de la lletra**. `{{AVUI}}` se
  substitueix per la data d'avui (`YYYY-MM-DD`), serveix només per inferir un any
  absent; el text del correu s'afegeix després de la línia `CORREU:`. El prompt
  exigeix només JSON, sense preàmbul ni tanques markdown, amb les 17 claus
  públiques (§4) sempre presents com a cadenes.
- **Cloudinary** — pujada *unsigned*: preset `agenda-posters`, carpeta
  `clm-agenda/posters`, transformació d'entrada `w_800,c_limit,q_80,f_webp`. Només
  cal el nom del cloud, cap signatura. El preset ja converteix un PDF en WebP de la
  primera pàgina: puja el PDF tal qual. Accepta la primera imatge o PDF adjunt;
  ignora les imatges en línia. **En publicar, `curador.html` copia a
  Cloudinary el cartell que encara no hi és** (`copiaCartells()`; per a
  l'ADT66, l'original abans que la miniatura de 150 px) i, si no pot, no
  publica: mai no surt al web el cartell d'un tercer (D-07). Mai des de
  l'Action. `node eines/cartells-a-cloudinary.js` encara copia a mà els de
  tota la cua, però ja no cal després de cada passada.
- **GitHub** — lectura i escriptura de `pendents.json` i `events.json` **sempre
  via l'API de continguts** (mai llegint de Pages, que serveix còpies de CDN
  endarrerides): GET per obtenir contingut + SHA, un sol PUT amb base64 i
  `JSON.stringify(dades, null, 2)`. En conflicte de SHA (escriptor concurrent),
  torna a llegir i reintenta un cop. **Excepció: `curador.html`**: les decisions
  passen per una cua d'escriptura, d'una en una, i les que s'hi acumulen surten
  en un sol commit per fitxer; la pàgina recorda el SHA que torna cada PUT i en
  conflicte reintenta fins a tres cops, amb pauses d'1, 2 i 4 s
  (`ESPERES_CONFLICTE_MS`).
- **Brevo** — un correu **transaccional per subscriptor** (mai campanya), amb línia
  de baixa bilingüe a cada missatge. Llistes per comarca (IDs als Secrets).
- **Typebot** — el formulari no és cap fitxer del repositori: s'edita al servei, i
  la seva especificació és `docs/pas-5-typebot-questionari.md`. Recull **una
  sola** `descripcio` més un senyal `idioma_descripcio` (`"ca"`/`"fr"`): posa el
  text a la banda que toca i deixa l'altra buida (el curador completa la
  traducció en revisar). El cartell ja puja del navegador a Cloudinary dins el
  flux del Typebot: l'URL arriba fet, guarda'l tal qual.

## 7 bis. Els dos contextos d'execució, i quina configuració viu a cadascun

Hi ha **dos** llocs on s'executa codi sol, i no es poden configurar al mateix
lloc.

| | **El Worker** (Cloudflare) | **L'Action** (GitHub Actions) |
|---|---|---|
| Unitat de treball | un esdeveniment, en directe | un lot sencer, periòdicament |
| Què el dispara | un correu, un POST del Typebot, el cron del digest | el botó «Run workflow» (el cron setmanal hi és escrit però comentat) |
| Crida models? | **sí** — Claude i Cloudinary | **sí, Claude i prou** — fins a dos intents per fila (`INTENTS_PER_FILA`), i cada intent gasta pressupost, per traduir-la al català abans d'encuar-la (pas 7 bis). Cloudinary, mai |
| Escriu | `pendents.json` | `pendents.json`, i res més |
| Es desplega | enganxant `worker/worker-concatenat.js` al tauler de Cloudflare | fent commit del `.yml`; no hi ha res a desplegar |
| Fitxers | `worker/worker.js`, `worker/worker-concatenat.js` | `.github/workflows/sincronitza-adt66.yml` + `eines/sincronitza-programada.js` |

**On viu cada configuració — i no es comparteixen mai:**

- **Al tauler del Worker** (Cloudflare → Worker → Settings): els Secrets
  `ANTHROPIC_API_KEY`, `GITHUB_TOKEN` (el de gra fi, §3), `BREVO_API_KEY`,
  `TYPEBOT_SECRET`, `ADRECA_ARXIU` i els IDs de llistes de Brevo; la variable de
  text `CLOUDINARY_CLOUD_NAME`; i l'activador cron `*/10 13,14 * * 2` (Trigger
  Events → Cron Triggers). **Un Secret canviat no és viu fins que es desplega.**
- **Secrets de l'Action** (GitHub → Settings → Secrets and variables →
  Actions del repositori), i n'hi ha dos, de naturalesa ben diferent:
    - `GITHUB_TOKEN` **no s'hi ha de posar**: és el token efímer que GitHub posa
      sol a cada run, amb `permissions: contents: write` declarat al `.yml`;
      neix i mor amb el run.
    - `ANTHROPIC_API_KEY` **sí que s'hi ha de posar a mà, un sol cop**. Aquest
      magatzem és **diferent** del dels Secrets de Cloudflare: posar-la en un
      lloc no la posa a l'altre. La mateixa clau serveix per als dos: el límit
      que compta —la despesa del mes— és de l'organització o del workspace, no
      de la clau. El pressupost de 300 crides de l'Action és un sostre de
      despesa (`PRESSUPOST_CRIDES_CLAUDE`).
    - **Si `ANTHROPIC_API_KEY` no hi és, el run NO s'atura**: les files s'encuen
      en francès i el registre del run ho diu amb un ATENCIÓ. És una
      configuració incompleta que es veu, no una fallada silenciosa.
- **Les coordenades del repositori** (`propietari/repositori`, branca, noms dels
  dos fitxers) són constants dins de cada fitxer de codi. A l'Action, el
  repositori el dona `GITHUB_REPOSITORY`, que ve del propi run.

**Per què això no trenca el §3** («cap servidor més enllà de l'únic Worker»): un
runner d'Actions no és cap servidor. No escolta res, no té adreça, no és
accessible des de fora i no existeix entre execucions. La restricció era contra
tenir una màquina engegada a mantenir; això és un guió que s'executa i para.

## 8. Fora d'abast — no ho construeixis, ni si t'ho demanen de passada (confirma primer)

Comptes d'usuari o login · portal d'autosubmissió · edició d'esdeveniments al web
públic · comentaris o funcions socials · analítica o seguiment · cap base de dades ·
cap servidor més enllà de l'únic Worker · cap framework CSS o JS · cap selector
d'interval de dates al web públic.

**Ajornat amb camí ja acordat** (no per construir ara):

- **Tokens de curació per comarca.** Quan una associació vulgui curar la seva
  comarca: un token de gra fi propi + `curador.html?comarca=Vallespir` que filtra
  la cua. Cap taula d'usuaris; l'historial de commits diu qui ha aprovat què.
  Només després d'una temporada d'ús en solitari.
- **Confirmació del primer remitent.** Quan calgui, una llista `remitents.json`
  al repositori gestionada pel Worker. No dissenyar-ho fins que faci falta.
- **Respondre des de `agenda@clm.cat`** («send mail as» amb relay SMTP): només
  quan la recepció porti temps rodant.
- **Adreça atrapa-ho-tot `*@clm.cat`:** xarxa contra errates, a canvi de brossa.
  Decisió del propietari, cap codi.

## 9. Actius existents — NO els reconstrueixis

Ja fets, en producció, al mateix repositori:

- **`index.html` / `style.css` / `app.js`** — el web públic, amb el disseny
  blanc-i-negre de dos temes (clar/fosc), el logotip «Què fas?», filtres per
  comarca i categoria, llista cronològica per dies. No en toquis el disseny.
  **`qui-som.html`** i **`mencions-legals.html`**.
- **`events.json`** — dades publicades. **`events-exemple.json`** + `?prova=1` —
  mode de prova amb dades fictícies. **`prova-local.html`** — mirall offline.
- **`curador.html`** + **`curador-cua.js`** — la cua de revisió i les peces
  d'estat que Node prova.
- **`url-segura.js`** — la regla única de quines adreces poden anar a un
  enllaç: `http:` o `https:` i prou. La carreguen `index.html`, `curador.html`
  i `prova-local.html` (`<script src>`) i `eines/mapeja-adt66.js` (`require`);
  el Worker no la necessita (no posa cap `font_url`).
- **`prompts/extract-event.txt`** — el prompt d'extracció mestre, amb tres
  correus de prova a `prompts/exemples-test/`.
- **`fonts/`** (woff2 autoallotjats) i **`img/logo/`**. Les fonts editables del
  logotip són els `.dc.html` d'`img/`.
- **`docs/`** — `CRITERI-EDITORIAL.md` (el criteri de què entra a l'agenda i què
  no: és del curador, no del codi; les exclusions per criteri polític i la regla
  «Tast comercial» les aplica `eines/exclusions-editorials.js`),
  `COORDINACIO.md` (el protocol amb Claude Chat) i les guies de configuració
  dels serveis (`pas-*.md`).
- **`NOTES.md`** — la història, les decisions i les lliçons.
