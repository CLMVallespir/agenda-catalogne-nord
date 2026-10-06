# Auditoria de seguretat — Secció 0: Inventari previ (mapa d'atac)

> Àmbit: només codi del repositori `agenda-catalogne-nord`. Cap cerca ni explotació fora del projecte.
> Aquesta secció **no jutja** cap punt: només dibuixa el mapa abans de les seccions 1–8.
> Data: 2026-07-04.

---

## 1. Fitxers `.gs` (Apps Script) — ruta exacta

Tots viuen al mateix projecte Apps Script *bound* al full de càlcul, i **comparteixen un únic espai global** (per això `getSecret()` i `indexDeColumna()` es criden des d'altres fitxers).

| Ruta | Línies | Rol | Helpers globals que hi defineix |
|---|---|---|---|
| `apps-script/processBotSubmission.gs` | 184 | Webhook Typebot → escriu 1 fila `pendent` | `doPost`, `processBotSubmission`, `readField`, `creaId` |
| `apps-script/processNewEmails.gs` | 498 | Ingestió Gmail → Gemini → Cloudinary → 1 fila | `getSecret`, `getOrCreateLabel`, `installHourlyTrigger`, `pujaImatgeCloudinary`, `demanaExtraccioGemini` |
| `apps-script/publishToGitHub.gs` | 223 | Menú «Agenda → Publica…» → escriu `events.json` a GitHub | `onOpen`, `publishToGitHub`, `obtenirShaActual`, `pujaFitxerAGitHub`, `capcaleresGitHub` |
| `apps-script/sendWeeklyDigest.gs` | 856 | Digest setmanal transaccional per Brevo | `enviaCorreuTransaccional`, `obtePaginaContactes`, `indexDeColumna` |
| `apps-script/setupSheet.gs` | 123 | Crea el full «Esdeveniments» i les validacions de columna | `setupSheet`, validacions d'enum |

---

## 2. `doGet` / `doPost` / Web App endpoints exposats

| Endpoint | Ruta:línia | Què fa |
|---|---|---|
| `doPost(e)` | `apps-script/processBotSubmission.gs:45` | **ÚNIC punt d'entrada web.** `JSON.parse(e.postData.contents)` → `processBotSubmission(body)` → resposta JSON `{ok:true}`. |

- **Cap `doGet` a tot el repositori.**
- `publishToGitHub()` (`publishToGitHub.gs:43`) **no és un endpoint**: només s'invoca des del menú creat a `onOpen()` (`publishToGitHub.gs:30-34`). Confirmat: no exposat com a web app. *(Respon per avançat el check 1.3; no es jutja aquí.)*

---

## 3. `fetch()` / `UrlFetchApp.fetch()` — origen → destí

### Pipeline real (servidor, Apps Script)

| Ruta:línia | Funció | Destí | Mètode | Autenticació |
|---|---|---|---|---|
| `processNewEmails.gs:272` | `pujaImatgeCloudinary()` | `https://api.cloudinary.com/v1_1/{cloudName}/image/upload` | POST | **cap** — unsigned preset `agenda-posters` |
| `processNewEmails.gs:318` | `demanaExtraccioGemini()` | `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` | POST | header `x-goog-api-key` |
| `publishToGitHub.gs:169` | `obtenirShaActual()` | `https://api.github.com/repos/{owner}/agenda-catalogne-nord/contents/events.json?ref=main` | GET | `Authorization: Bearer {token}` |
| `publishToGitHub.gs:200` | `pujaFitxerAGitHub()` | `https://api.github.com/repos/{owner}/agenda-catalogne-nord/contents/events.json` | PUT | `Authorization: Bearer {token}` |
| `sendWeeklyDigest.gs:426` | `obtePaginaContactes()` | `https://api.brevo.com/v3/contacts/lists/{llistaId}/contacts?limit=…&offset=…` | GET | header `api-key` |
| `sendWeeklyDigest.gs:468` | `enviaCorreuTransaccional()` | `https://api.brevo.com/v3/smtp/email` | POST | header `api-key` |

### Frontend (navegador)

| Ruta:línia | Funció | Destí | Notes |
|---|---|---|---|
| `app.js:76` | `carregaEsdeveniments()` | `events.json` **o** `events-exemple.json` (mateix origen, GitHub Pages) | `cache:'no-store'`; el fitxer el tria `fitxerDeDades()` (`app.js:65`) segons `?prova=1` amb comparació **estricta** (`=== '1'`), només dos noms fixos, cap path arbitrari |

### Fora del pipeline (eines de logo / design-system — es despleguen a Pages però no toquen esdeveniments)

- `img/support.js:158, 1081, 1427` — `fetch()` a `location.href` i a URLs de mòdul
- `img/support.js:1048, 1568, 1570` — carrega Babel/React des de `unpkg.com`
- `img/_build/generate.html:27` — `fetch(url)` (generador SVG del logo)
- `@import` de Google Fonts a `img/*.dc.html` i `img/_ds/**/fonts.css`

*(Es llisten pel mapa. Vegeu la pregunta d'àmbit al final.)*

---

## 4. Lectures de Script Properties

- **Punt d'accés únic:** `getSecret(nom)` → `PropertiesService.getScriptProperties().getProperty(nom)` (`processNewEmails.gs:460-461`). Llança un error clar si la propietat falta o és buida.
- **Cap** `getProperties()` massiu; **cap** lectura fora de `getSecret()`.

| Propietat llegida | On es demana (ruta:línia) |
|---|---|
| `GEMINI_API_KEY` | `processNewEmails.gs:134` |
| `CLOUDINARY_CLOUD_NAME` | `processNewEmails.gs:135` |
| `GITHUB_OWNER` | `publishToGitHub.gs:64` |
| `GITHUB_TOKEN` | `publishToGitHub.gs:65` |
| `BREVO_API_KEY` | `sendWeeklyDigest.gs:96` |
| `BREVO_SENDER_NAME` | `sendWeeklyDigest.gs:153` |
| `BREVO_SENDER_EMAIL` | `sendWeeklyDigest.gs:154` |
| `BREVO_LIST_*` (per comarca) | `sendWeeklyDigest.gs:331` via `getSecret(propietat)` |

---

## 5. Claus/tokens/URLs de tercers **literals** al codi (mapa, no secrets)

**Cap secret real hardcodejat.** Verificat: cap coincidència de `AIza…`, `ghp_`, `github_pat_`, `xkeysib-`, `sk-ant`, ni `-----BEGIN` a tot el repositori.

Constants literals (no sensibles):

| Servei | Valor literal | Ruta:línia |
|---|---|---|
| Cloudinary | preset `agenda-posters` | `processNewEmails.gs:55` |
| Cloudinary | endpoint `api.cloudinary.com/v1_1/{cloudName}/image/upload` (cloud name → Script Property) | `processNewEmails.gs:261` |
| Gemini | model `gemini-2.5-flash`; màx. tokens `2048` | `processNewEmails.gs:50, 52` |
| Gemini | URL `generativelanguage.googleapis.com/v1beta/...` | `processNewEmails.gs:51` |
| GitHub | repo `agenda-catalogne-nord`, branch `main`, fitxer `events.json` | `publishToGitHub.gs:22-24` |
| GitHub | endpoints `api.github.com/repos/...` | `publishToGitHub.gs:166, 190` |
| Brevo | `BREVO_SEND_URL`, `BREVO_LIST_CONTACTS_URL_BASE`; `AGENDA_URL=''` (buit) | `sendWeeklyDigest.gs:46-47, 64` |
| Brevo | IDs de llista per comarca → **Script Properties**, no literals | — |
| Typebot | URL pública del formulari `https://typebot.co/lead-generation-64b0gcq` | `index.html:91` (i `prova-local.html:536`) |
| Brevo (hero) | placeholder `REEMPLACA-AMB-URL-DEL-FORMULARI-BREVO` (encara sense configurar) | `index.html:56` |

---

## Notes per a les seccions següents (nivell Fable)

**A. Discrepància auditoria ↔ codi: no és Claude, és Gemini.** El document d'auditoria (§2.1, §2.2, §4.2) parla de «Claude API / `sk-ant`». El codi real d'ingestió usa **Google Gemini** (`gemini-2.5-flash`, header `x-goog-api-key`, propietat `GEMINI_API_KEY`). El vector de *prompt injection cap amunt* i la clau a protegir són de **Gemini**. Cal reorientar-hi les seccions 2 i 4.2. *(A més, `TECH-KNOWLEDGE-BASE.md` encara documenta «Claude API, claude-sonnet-4-6» — desalineat amb el codi.)*

**B. Duplicats a tenir presents:** `prova-local.html` (arrel) i `docs/prova-local.html`; `events.json` i `events-exemple.json` (aquest darrer és el que carrega `?prova=1`).

**C. Àmbit `img/`:** el repo inclou un design-system i eines de generació de logo (`img/_ds/**`, `img/support.js`, `img/_build/generate.html`) amb `fetch()` a CDNs externs (unpkg, jsdelivr, Google Fonts). No formen part del pipeline d'esdeveniments però es despleguen a GitHub Pages.
