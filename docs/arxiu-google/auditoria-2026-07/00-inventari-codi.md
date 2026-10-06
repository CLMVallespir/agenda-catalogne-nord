# Auditoria de qualitat del codi — Secció 0: Inventari i línia de base

> Àmbit: només codi del repositori `agenda-catalogne-nord`. Auditoria de qualitat (consistència, estructura, simplicitat, resiliència, fiabilitat, tests) — **no** de seguretat (vegeu `auditoria-seguretat-agenda-nord.md`).
> Aquesta secció **no jutja** res: només dibuixa el mapa i la línia de base abans de les seccions 1–7.
> Exclosos de l'àmbit (mateixa decisió que l'auditoria de seguretat): l'utillatge d'`img/` (`support.js`, `_ds/`, `_build/`).
> Data: 2026-07-06.

---

## 1. Mapa de fitxers — línies i funcions

Tots els `.gs` viuen al mateix projecte Apps Script *bound* al full, amb **un únic espai global compartit**. `app.js` corre al navegador (runtime separat).

| Fitxer | Línies | Funcions | Semàfor §6 (provisional) |
|---|---|---|---|
| `apps-script/processBotSubmission.gs` | 184 | 4 | verd |
| `apps-script/processNewEmails.gs` | 498 | 16 | **vermell** (> 350) |
| `apps-script/publishToGitHub.gs` | 223 | 7 | ambre (200–350) |
| `apps-script/sendWeeklyDigest.gs` | 856 | 31 | **vermell** (> 350) |
| `apps-script/setupSheet.gs` | 123 | 5 | verd |
| `app.js` | 533 | 30 | **vermell** just (> 500) |
| **Total** | **2.417** | **93** | |

Matís per calibrar els llindars: l'estil de casa porta **banner de capçalera + separador i comentari d'una línia per funció**; una part substancial de les línies són comentaris deliberats, no lògica. El semàfor és un senyal per mirar-ho a la Secció 2 (partició per responsabilitat), no una troballa.

Fitxers companys del camí de lectura: `index.html` (101 línies, amb petit script de tema inline al `<head>`), `style.css` (436).

Candidats a codi mort detectats de passada (per a la Secció 2): `prova-local.html` existeix **duplicat i divergent** a l'arrel (1.124 línies) i a `docs/` (617 línies).

---

## 2. Mapa de l'espai de noms global (`.gs`)

**63 funcions top-level** als cinc `.gs` — **cap col·lisió de noms**. Les variables top-level (constants de configuració, en MAJÚSCULES) també són totes úniques.

Funcions per fitxer:

| Fitxer | Funcions top-level |
|---|---|
| `processBotSubmission.gs` | `doPost`, `processBotSubmission`, `readField`, `creaId` |
| `processNewEmails.gs` | `processNewEmails`, `processaThread`, `findIncomingThreads`, `extreuTextCorreu`, `primerCartellAdjunt`, `pujaImatgeCloudinary`, `demanaExtraccioGemini`, `extreuTextResposta`, `analitzaJsonResposta`, `construeixFila`, `escriuFila`, `valorPermes`, `marcaThreadAmbEtiqueta`, `getSecret`, `getOrCreateLabel`, `installHourlyTrigger` |
| `publishToGitHub.gs` | `onOpen`, `publishToGitHub`, `llegeixEsdevenimentsPublicats`, `textDeCella`, `obtenirShaActual`, `pujaFitxerAGitHub`, `capcaleresGitHub` |
| `sendWeeklyDigest.gs` | `sendWeeklyDigest`, `llegeixRemitent`, `dataMesDies`, `llegeixEsdevenimentsPublicatsAquestaSetmana`, `indexDeColumna`, `comparaPerDataIHora`, `agrupaPerComarca`, `enviaDigestComarca`, `idDeLlistaPerComarca`, `propietatLlistaPerComarca`, `construeixAssumpte`, `obteContactesDeLlista`, `obtePaginaContactes`, `enviaCorreuTransaccional`, `construeixHtmlDigest`, `construeixCapcaleraDia`, `construeixBlocEsdeveniment`, `construeixXipCategoria`, `construeixMeta`, `spanAccent`, `textLloc`, `finsAl`, `comencaAmbVocal`, `objecteDataDe`, `etiquetaDiaCatala`, `etiquetaDiaFrances`, `majuscula`, `construeixPeuBaixa`, `dataLlegibleCatala`, `escapaHtml`, `installWeeklyTrigger` |
| `setupSheet.gs` | `setupSheet`, `getOrCreateEventsSheet`, `writeHeaders`, `addDropdown`, `addStatusColours` |

### Dependències creuades entre fitxers (verificades al codi, i declarades a les capçaleres)

| Qui | Usa | Definit a |
|---|---|---|
| `processNewEmails.gs` | `creaId()`, `readField()` | `processBotSubmission.gs` |
| `processNewEmails.gs` | `COMARCA_VALUES`, `CATEGORIA_VALUES` | `setupSheet.gs` |
| `publishToGitHub.gs` | `getSecret()` | `processNewEmails.gs` |
| `publishToGitHub.gs` | `indexDeColumna()` | `sendWeeklyDigest.gs` |
| `sendWeeklyDigest.gs` | `getSecret()`, `COMARCA_VALUES` | `processNewEmails.gs` / `setupSheet.gs` |

Conseqüència de fet: **els cinc `.gs` s'han de desplegar junts**; esborrar-ne o reanomenar-ne un trenca els altres en temps d'execució (GAS no fa cap anàlisi estàtica). Punt positiu ja existent: cada fitxer declara al banner què manlleva i d'on.

### Quasi-duplicats entre runtimes (no són col·lisions: navegador vs servidor)

`app.js` i `sendWeeklyDigest.gs` reimplementen la mateixa lògica de presentació: `textLloc`, `finsAl`, `comencaAmbVocal`, `majuscula`, els arrays de mesos/dies CA-FR, i `etiquetaDiaCa/Fr` vs `etiquetaDiaCatala/Frances`. Sense sistema de mòduls ni build és una duplicació estructuralment forçada — es registra aquí com a fet; la Secció 2 decidirà si cal cap mitigació (p. ex. comentari creuat «si toques això, toca també…»).

---

## 3. Inventari de triggers i punts d'execució

| Funció | Tipus | Planificació | Si es perd una execució | Si es dispara dues vegades |
|---|---|---|---|---|
| `processNewEmails` | Trigger horari (`installHourlyTrigger`, `processNewEmails.gs:486`) | Cada hora; màx. `MAX_THREADS_PER_RUN = 10` fils/execució | Els correus queden amb l'etiqueta `agenda-entrant` i es recullen a la següent | `LockService` (`:126`) impedeix el solapament; els fils processats passen a `agenda-traitat`, no es reingesten |
| `sendWeeklyDigest` | Trigger setmanal (`installWeeklyTrigger`, `sendWeeklyDigest.gs:843`) | Dimarts `atHour(15)` — GAS el dispara dins la franja 15:00–16:00 | Setmana sense digest; no hi ha recuperació | **Sense guarda d'idempotència**: no hi ha cap `setProperty`/`CacheService` en tot el projecte; una repetició del trigger reenviaria tots els correus (fet per a §4.1) |
| `doPost` | Endpoint web app (únic; cap `doGet`) | Per cada POST del Typebot | — | Cada POST escriu una fila; no hi ha deduplicació — un reenviament del formulari crea files duplicades (fet per a §4.1/§7) |
| `onOpen` | Trigger simple | En obrir el full | — | Innocu (només reconstrueix el menú «Agenda») |
| `publishToGitHub` | **Manual** (menú «Agenda → Publica…») | A demanda del curador | — | Rellegeix el SHA abans de cada PUT |
| `setupSheet`, `installHourlyTrigger`, `installWeeklyTrigger` | Manuals, d'un sol ús | — | — | Idempotents per disseny (els installers esborren el trigger previ abans de crear-lo) |

---

## 4. Mapa del camí de lectura (frontend, la superfície d'alt trànsit)

Seqüència d'inici (`app.js:531–533`): `configuraTema()` → `construeixFiltres()` → `carregaEsdeveniments()`.

- **Un sol `fetch` per visita** (`app.js:76`): `events.json` — o `events-exemple.json` si l'URL porta `?prova=1` (`fitxerDeDades()`, `:65`). Cap *polling*, cap refetch: els clics de filtre (comarca, categoria) només tornen a pintar des de memòria (`pintaTot()` a `:144`, `:162`).
- **Opció de caché**: el `fetch` porta `{ cache: 'no-store' }` — es salta la caché HTTP del navegador a cada visita; la CDN de GitHub Pages continua servint amb el seu `Cache-Control` propi. Fet rellevant per al check de caché de §4.2.
- **Pipeline de render**: `preparaEsdeveniments()` (descarta esdeveniments sense `data_inici` vàlida, amaga els passats, ordena per data+hora) → `pintaTot()` (llista cronològica agrupada per dia).
- **Errors**: HTTP no-ok o JSON invàlid → `console.error` + missatge bilingüe via `mostraMissatge()` («No s'ha pogut carregar l'agenda. · Impossible de charger l'agenda.»). Estat de càrrega bilingüe mentre arriba la resposta.

---

## 5. Crides externes — cada `UrlFetchApp.fetch` (+ el `fetch` del navegador)

| Ruta:línia | Funció | Destí | Freqüència | Exposició de quota |
|---|---|---|---|---|
| `processNewEmails.gs:272` | `pujaImatgeCloudinary()` | Cloudinary `image/upload` (preset unsigned) | 1 per correu amb imatge/PDF adjunt | Nivell gratuït Cloudinary; volum lligat al correu entrant |
| `processNewEmails.gs:318` | `demanaExtraccioGemini()` | Gemini `generateContent` (`gemini-2.5-flash`, `maxOutputTokens` 2048) | 1 per fil; ≤ 10/execució; horari ⇒ ≤ 240 fils/dia | Nivell gratuït Google AI Studio — **la quota compartida és el coll d'ampolla si un remitent inunda la bústia** (check §4.1) |
| `publishToGitHub.gs:169` | `obtenirShaActual()` | GitHub GET `contents` | 1 per publicació manual | Negligible (5.000 crides/h autenticades) |
| `publishToGitHub.gs:200` | `pujaFitxerAGitHub()` | GitHub PUT `contents` | 1 per publicació manual | Negligible |
| `sendWeeklyDigest.gs:426` | `obtePaginaContactes()` | Brevo GET contactes de llista (paginat, 500/pàgina) | 1+ per comarca amb esdeveniments, setmanal | Negligible |
| `sendWeeklyDigest.gs:468` | `enviaCorreuTransaccional()` | Brevo POST `smtp/email` (transaccional) | **1 per subscriptor** i comarca, setmanal; pausa `PAUSA_ENTRE_CORREUS_MS = 150` | **Brevo gratuït = 300 correus/dia ⇒ sostre dur de subscriptors**; a més, límit de 6 min d'execució GAS amb 150 ms/enviament (fets per a §4.1) |
| `app.js:76` | `carregaEsdeveniments()` | `events.json` a GitHub Pages | 1 per visita | Sense quota (CDN) |

Quota diària d'`UrlFetchApp` (20.000 crides/dia en compte estàndard): ús actual molt per sota.

---

## 6. Docs vs codi — l'IA real és Gemini, no Claude

Realitat del codi: `GEMINI_MODEL = 'gemini-2.5-flash'`, secret `GEMINI_API_KEY`, `maxOutputTokens 2048`, prompt d'extracció **incrustat** com a `EXTRACTION_PROMPT` a `processNewEmails.gs:63`. L'únic document ja alineat és `docs/pas-4-ingestio-correu.md`.

Referències caduques (diuen Claude/Anthropic on el codi fa Gemini):

| Fitxer | On | Què diu de caduc |
|---|---|---|
| `TECH-KNOWLEDGE-BASE.md` | línies 14, 63–132 (tota la «Layer 2»), 441, 444, 461, 552, 577 | API de Claude, `claude-sonnet-4-6`, endpoint d'Anthropic, secret `CLAUDE_API_KEY`; **cap menció de Gemini en tot el fitxer** |
| `PROJECT-KNOWLEDGE.md` | 14, 28, 34, 47, 60, 96, 189 | «Claude API», `claude-sonnet-4-6`, `max_tokens` 1000 (el codi fa 2048) |
| `PROJECT-INSTRUCTIONS.md` | 3, 9 | «Claude API» al flux i a les restriccions |
| `README.md` | 12, 25 | «API de Claude» |
| `prompts/README.md` | 5, 11, 15 | «API de Claude (claude-sonnet-4-6)» |
| `skill/agenda-nord-core/SKILL.md` | §1, §2, §8 | «Claude API», `claude-sonnet-4-6`, `max_tokens` 1000 |
| `processBotSubmission.gs` | comentaris a les línies 7 i 91 | «Claude logic», «or Claude later» — el mateix codi arrossega el nom antic |

Fet connex: **el prompt existeix duplicat** — `prompts/extract-event.txt` (fitxer) i `EXTRACTION_PROMPT` (incrustat al `.gs`, que és el que s'executa). Cal declarar quin és el canònic (fet per a §1/§2 i per a l'alineació de docs).

Cap secret fora del embut: totes les credencials passen per `getSecret()` (únic `getProperty` del projecte, a `processNewEmails.gs:461`). `doPost` no llegeix cap secret. Valor pendent detectat: `AGENDA_URL = ''` (`sendWeeklyDigest.gs:64`), placeholder buit.

---

## 7. Línia de base — el patró majoritari observat

Contra això es mesuraran les seccions 1–7 (no contra un ideal extern):

- **Declaracions**: `var` pertot (0 `const`, 0 `let` — verificat; l'única coincidència de «let» és la paraula anglesa dins d'un comentari). Estil ES5 deliberadament pla, amb excepcions puntuals modernes (template literal per al prompt, `normalize('NFD')`).
- **Cometes**: simples com a norma; dobles gairebé només dins d'strings HTML/SVG.
- **Logging**: `Logger.log` en exclusiva al backend (17 crides); al frontend, 1 `console.error`.
- **Nomenclatura**: patró mixt però regular — anglès per als punts d'entrada i noms imposats per GAS (`doPost`, `onOpen`, `setupSheet`, `processNewEmails`, `publishToGitHub`, `sendWeeklyDigest`, `installHourlyTrigger`, `getSecret`, `readField`); **català per als helpers de domini** (`demanaExtraccioGemini`, `construeixFila`, `escriuFila`, `analitzaJsonResposta`…), coherent amb la regla de casa (skill §5).
- **Comentaris**: banner de capçalera a cada fitxer + separadors de guions + capçalera d'una línia per funció — uniforme als 6 fitxers.
- **Configuració**: constants top-level en MAJÚSCULES per fitxer (etiquetes Gmail, model, URLs d'API, colors del digest, finestra de 7 dies…) — els valors màgics ja estan majoritàriament centralitzats.
- **Accés a secrets**: embut únic `getSecret()` — cap `PropertiesService` dispers.

---

*Inventari fet amb el codi real del repositori (comptatges `wc -l` i `grep` verificats el 2026-07-06). Les seccions 1–7 de `code-audit-agenda-nord.md` es mesuraran contra aquesta línia de base; els semàfors del §1 són provisionals tal com preveu el §6 de la checklist.*
