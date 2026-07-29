# Agenda cultural — Catalunya Nord

> **Per a l'assistent (Claude):** abans de tocar res, carrega l'skill `agenda-nord-core` (a `skill/agenda-nord-core/SKILL.md`). Recull la visió estratègica, l'esquema, la filosofia de codi i el llenguatge de disseny del projecte. Cal mantenir l'esperit: simplicitat per sobre de tot, bilingüe català primer, només nivells gratuïts, sense frameworks ni comptes d'usuari.

Agenda cultural automatitzada per a la Catalunya Nord (Rosselló, Conflent, Vallespir, Capcir, Cerdanya).

Agenda culturelle automatisée pour la Catalogne Nord.

## Com funciona

1. Les associacions envien els esdeveniments per correu electrònic o pel formulari Typebot.
2. Un script de Google Apps Script extreu les dades amb l'API de Gemini (`gemini-2.5-flash`, Google AI Studio) i les escriu a Google Sheets.
3. Una persona curadora revisa els esdeveniments un cop per setmana i marca els aprovats com a `publicat`.
4. El menú «Agenda → Publica els esdeveniments aprovats» del full de càlcul envia els esdeveniments aprovats a `events.json` en aquest dipòsit.
5. GitHub Pages serveix l'aplicació web estàtica (aquest dipòsit) amb filtres per comarca i categoria.
6. Un resum setmanal per comarca s'envia per correu via Brevo.

## Estructura

| Fitxer / carpeta | Funció |
|---|---|
| `index.html`, `style.css`, `app.js` | Aplicació web estàtica (vanilla JS, sense frameworks) |
| `events.json` | Dades publicades — font de veritat dels esdeveniments en línia |
| `events-exemple.json` | Dades fictícies de prova (vegeu `docs/pas-8-frontend.md`, mode `?prova=1`) |
| `prompts/` | Prompt d'extracció per a l'API de Gemini i correus de prova |
| `apps-script/` | Scripts de Google Apps Script (`utils.gs` = helpers i constants compartits; configuració del full, ingestió, publicació, digest, tests) |
| `docs/` | Guies de configuració (Cloudinary, etc.) i el runbook d'operació |

## Principis

- Sense infraestructura de pagament: només nivells gratuïts (Google, GitHub, Cloudinary, Brevo).
- Sense comptes d'usuari, sense backend en temps real.
- Tot el text públic és bilingüe: català primer, francès a sota.
- Simplicitat per sobre de tot: codi explícit, fàcil de llegir i de reparar.

## Operació (runbook)

Guia mínima per operar el sistema (i per a qui l'hereti). El detall pas a pas viu a `docs/`.

### Activadors (triggers)

| Funció | Cadència | Com (re)instal·lar |
|---|---|---|
| `processNewEmails` | cada hora | executa `installHourlyTrigger()` un cop des de l'editor |
| `sendWeeklyDigest` | dimarts a les 15:00 | executa `installWeeklyTrigger()` un cop des de l'editor |

Totes dues funcions són segures de reinstal·lar: esborren el seu activador anterior abans de crear-ne un de nou (mai no en dupliquen).

### Script Properties (Configuració del projecte → Propietats de l'script)

Noms (sense valors) que el codi espera. Els secrets mai no són al codi.

- `GEMINI_API_KEY`
- `CLOUDINARY_CLOUD_NAME` (i, només per a tasques d'administració, `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`)
- `GITHUB_OWNER`, `GITHUB_TOKEN`
- `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`
- `BREVO_LIST_ROSSELLO`, `BREVO_LIST_CONFLENT`, `BREVO_LIST_VALLESPIR`, `BREVO_LIST_CAPCIR`, `BREVO_LIST_CERDANYA`
- `DIGEST_DARRER_ENVIAMENT` — **la fixa el codi, no tu** (guarda d'idempotència del digest: la data AAAA-MM-DD del darrer enviament).

### Desplegar un canvi

El **dipòsit és el mestre; l'editor només rep còpies**. Cap edició directa a l'editor sense replicar-la al dipòsit el mateix dia (si no, les auditories, que llegeixen el dipòsit, deixen de descriure producció).

1. Edita al dipòsit (via la interfície web de GitHub) i enganxa el fitxer canviat a l'editor d'Apps Script.
2. Els **activadors** executen sempre el HEAD de l'editor: enganxar ja n'hi ha prou.
3. El **Web App** (`doPost`, Typebot) **no** canvia fins que crees una versió nova: Desplega → Gestiona desplegaments → edita → «Versió: Nova». Un hotfix del `doPost` enganxat i **no** versionat *sembla* aplicat i no ho està.
4. Abans de promocionar res, executa els tests (menú «Agenda → Executa els tests»); no versionis amb tests en vermell.

### Rollback

- **Codi d'activador:** restaura el fitxer des de l'historial de GitHub i torna'l a enganxar a l'editor.
- **Web App:** Desplega → Gestiona desplegaments → torna a una versió anterior.

### Provar sense tocar producció

Vegeu `docs/pas-proves-i-desplegament.md`: el runner de tests (`tests.gs`), el banc de proves (còpia del full amb propietats de prova) i la seqüència d'aplicació dels canvis.
