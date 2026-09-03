---
name: agenda-nord-core
description: >
  Strategic vision, architecture, data schema, coding philosophy and the
  black-and-white two-theme design language of the "agenda-catalogne-nord"
  project — an automated, free-tier cultural agenda for North Catalonia
  (Catalunya Nord). Load this in EVERY working session on this project,
  whatever the task (the Cloudflare Worker, frontend, extraction prompt, digest,
  docs), BEFORE writing or changing any code. It carries the settled decisions
  so new work stays in the project's spirit: radical simplicity, bilingual
  Catalan-first display, no paid infra, no accounts, no frameworks — plus a
  dated "current state" block for the few facts that go stale. NOT a
  CLM/Casa Macià grant dossier; NOT the North Catalonia settlement-research
  toolkit — this is the "Què fas?" events agenda web app.
metadata:
  type: project
  project: agenda-catalogne-nord
---

> **⚠ Anterior al tall de cinta — no descriu el sistema viu.**
> Aquest document explica l'arquitectura de Google Sheets + Apps Script, retirada
> el **29 d'agost de 2026** (Fase 4). Es conserva com a registre històric.
>
> **L'arquitectura vigent és un únic Worker de Cloudflare** (`email()`,
> `fetch()`, `scheduled()`) amb `pendents.json`, `events.json` i
> `curador.html`. La font de veritat és `CLAUDE.md` (la constitució),
> `FASES.md` (l'estat de cada fase) i `README.md` (el runbook). El codi
> `.gs` mort és a `docs/arxiu-google/`.
>
> No et refiïs de res del que ve a sota sense contrastar-ho amb `CLAUDE.md`.
>
> Aquesta skill **encara no s'ha reescrit** per al Worker: és la peça de documentació més gran que queda pendent del tall.


# Agenda Catalunya Nord — project core ("Què fas?")

This skill carries the **essence** of the agenda-catalogne-nord project. Concrete
changes will keep happening; the point of this file is that they stay faithful to
the line set so far. When a request conflicts with something here, surface the
tension to Miquel rather than silently breaking the pattern.

The single most important rule, repeated everywhere below: **simplicity beats
everything**. This is a one-person volunteer project that must remain repairable
by its owner months from now. Prefer longer, obvious code over shorter clever
code, every time.

**How this file is layered.** The dated *Current state* block just below is the
**volatile layer** — it is expected to go stale, so keep it fresh and put
time-bound status there and *only* there. Everything after §1 is the **settled
layer**: decisions and patterns that rarely change. Don't re-litigate the settled
sections; do keep the current-state block up to date. A single stale line here is
what caused past drift, so this block is the obvious home for "as of now" facts.

---

## Current state — VOLATILE (keep fresh)

**Last verified against the live files: 2026-07-07.**

- **The black-and-white two-theme redesign is LIVE in the canonical files.** The
  port from the preview is **done**: `index.html`, `style.css` and `app.js` all
  carry the B&W design, the two themes, the "Què fas?" logo, the hero and the
  footer. (Both this skill and `PROJECT-KNOWLEDGE.md` were reconciled to this on
  2026-07-07; if you meet any older note describing the retired cream "sang i or"
  look or calling the port "pending", trust the live files.)
- **`prova-local.html` is a standalone offline preview mirror** (embedded sample
  data, no fetch). Now that the design is ported, treat it as a scratch/preview
  copy to keep roughly in sync — it is no longer the sole home of the real design.
- **Extraction model is Gemini, not Claude.** `processNewEmails.gs` calls
  **`gemini-2.5-flash`** (Google AI Studio free tier) via `GEMINI_API_KEY`. Both
  Claude was replaced by Gemini; older docs that said `claude-sonnet-4-6` were
  corrected on 2026-07-07. If any lingering reference says Claude, the live code is
  the ground truth.
- **Backend code for the blocked steps is now written**, waiting to be *wired
  live*, not written. `processNewEmails.gs`, `processBotSubmission.gs`,
  `publishToGitHub.gs`, `sendWeeklyDigest.gs` all exist and have been reviewed.
  They stay blocked only on the Google Workspace account (see §4).
- **Pending external wiring:** the **Brevo subscribe form URL** is still a
  placeholder in `index.html` (`REEMPLACA-AMB-URL-DEL-FORMULARI-BREVO`) and the
  Brevo account/lists are not set up. The **Typebot submit link is live**
  (`https://typebot.co/lead-generation-64b0gcq`).
- **First-time-sender email confirmation is designed but NOT built.** The current
  `processNewEmails.gs` uses only the `agenda-entrant` / `agenda-traitat` /
  `agenda-error` labels — it has no sender-consent step yet. The agreed design for
  it, when built, is in §8; don't assume it already exists.

---

## 1. What the project is

An automated, almost-zero-cost cultural agenda for **North Catalonia / Catalunya
Nord** — the five comarques **Rosselló, Conflent, Vallespir, Capcir, Cerdanya**.
Public-facing name: **"Què fas?"**.

The flow, end to end:

1. Cultural associations send event info **by email** or via a **Typebot form**.
2. A Google **Apps Script** reads new emails, sends each body to the **Gemini API**
   with a fixed extraction prompt, and writes one row per event to a **Google
   Sheet**.
3. A **curator** (Miquel) reviews the sheet ~10 min/week and sets each row's
   `estat` to `publicat` or `rebutjat`.
4. A **"Publier" menu button** in the Sheet pushes all `publicat` rows to
   `events.json` in the **GitHub** repo via the GitHub API.
5. **GitHub Pages** serves a static vanilla-JS web app that reads `events.json`,
   with comarca + category filtering and bilingual display.
6. A **weekly per-comarca email digest** goes out via **Brevo**.

Audience: the general North Catalan public. Tone: open, cultural, welcoming —
**never** activist/political (the reference site bcn.convoca.la was used only for
layout inspiration, explicitly not for its tone).

---

## 2. Non-negotiable strategic constraints — SETTLED

Set at project kickoff; must not be quietly eroded:

- **Free tiers only.** Google, GitHub Pages, Cloudinary, Brevo, Gemini API. No
  paid infrastructure, ever.
- **No backend, no database** other than Google Sheets (Sheets is *only* the
  curator review surface). No Supabase/Firebase/Airtable, no Node/Python server.
- **No user accounts, no self-submission portal, no real-time backend.**
- **GitHub `events.json` is the source of truth** for what is published online.
  Sheets is upstream review; GitHub is the published record.
- **Images live on Cloudinary, never in Git.**
- **Bilingual, Catalan-first** in every user-facing string (see §6).
- **No frameworks, no build tools, no npm, no external JS/CSS libraries.** Vanilla
  JS on the frontend; Apps Script built-ins + `fetch` calls on the backend. Fonts
  are self-hosted woff2 — no CDN at runtime (see §7).

### Explicitly out of scope (don't build, even if asked offhandedly — confirm first)

User auth/login · association self-submission portal · in-app event editing ·
comments or social features · analytics/tracking · any non-Sheets database · any
server-side runtime · any CSS framework (Tailwind/Bootstrap) · any JS framework
(React/Vue/Svelte).

---

## 3. The event schema — canonical, exact — SETTLED

Sixteen fields. The **exact names and order** are used identically in the Sheet
columns, the extraction prompt, `events.json`, and the frontend. Never rename,
reorder, or add fields without updating all four places together.

| # | field | type | notes |
|---|---|---|---|
| 1 | `id` | string | `YYYY-MM-DD-slug`, e.g. `2026-09-14-ball-prats`. Empty if no date. |
| 2 | `titol` | string | Title in Catalan |
| 3 | `data_inici` | string | `YYYY-MM-DD` |
| 4 | `data_fi` | string | `YYYY-MM-DD`; equals `data_inici` for single-day |
| 5 | `hora` | string | `HH:MM` 24h; empty if all-day/unknown |
| 6 | `lloc` | string | Venue name |
| 7 | `municipi` | string | Town, Catalan form when known (Perpinyà, Prada, Ceret) |
| 8 | `comarca` | enum | one of the 5, exactly; else `""` |
| 9 | `categoria` | enum | one of the 10, exactly; else `""` |
| 10 | `descripcio_ca` | string | 2–4 sentences, natural Catalan |
| 11 | `descripcio_fr` | string | faithful French translation of `descripcio_ca` |
| 12 | `associacio` | string | organising association |
| 13 | `imatge_url` | string | Cloudinary URL; `""` if none |
| 14 | `font_url` | string | link to original source; `""` if none |
| 15 | `estat` | enum | `pendent` · `publicat` · `rebutjat` |
| 16 | `data_entrada` | string | ISO timestamp when the row was created |

**Comarca enum:** `Rosselló` · `Conflent` · `Vallespir` · `Capcir` · `Cerdanya`
**Categoria enum (13):** `Música` · `Teatre` · `Dansa i ball` · `Conferència` ·
`Exposició` · `Mercat` · `Cinema` · `Taller` · `Activitat infantil` ·
`Patrimoni i tradicions` · `Concentració` · `Esports` · `Vida associativa`

Schema rules the code relies on:

- **Every field is a string.** Unknown values are `""` — never `null`, never
  omitted. The extraction prompt enforces this; the frontend assumes it.
- `imatge_url`, `font_url`, `estat`, `data_entrada` are **filled by the system,
  never by the extraction model** — the prompt returns them empty on purpose.
- Date/time columns in Sheets are forced to **plain-text format (`@`)** so
  `2026-09-14` and `18:30` are never auto-converted to date/time objects. This
  matters for the clean JSON export.

---

## 4. Architecture and the 9-step build plan — SETTLED (status lives above)

Built **sequentially — verify each step before the next.** For live status of
what is blocked or pending, see the current-state block; this section is the
stable map.

1. **Sheets setup** (`apps-script/setupSheet.gs`) — idempotent; recreate in final account.
2. **Extraction prompt** (`prompts/extract-event.txt`) — the human-readable master.
3. **Cloudinary** (`docs/pas-3-cloudinary.md`) — unsigned upload preset.
4. **Gmail ingestion** `processNewEmails()` — Gemini extraction + optional poster upload.
5. **Typebot webhook** `processBotSubmission()` — `doPost` endpoint, structured form.
6. **GitHub repo + Pages** — hosts `events.json` and the static app.
7. **"Publier" button** `publishToGitHub()` — Sheet menu → GitHub API.
8. **Frontend** (`index.html` / `style.css` / `app.js`) — the B&W agenda (see §7).
9. **Weekly Brevo digest** `sendWeeklyDigest()` — per-comarca transactional email.

**The Workspace dependency (why steps 1/4/5/7/9 can't go live yet):** Miquel is
creating a Google Workspace account on a verified domain. The Sheet must be
created in that *final* account because the Gmail inbox, the Apps Script owner and
the Sheet owner must all be the **same account**. Google does not allow ownership
transfer from a personal `@gmail.com` to a Workspace domain, and copying a Sheet
loses its Script Properties, triggers and authorizations — so the plan is to
**recreate** via `setupSheet.gs`, not move. Before doing any Google-dependent
step, check whether the Workspace account is ready.

`setupSheet.gs` is intentionally **idempotent / safe to re-run**: it rebuilds
headers, dropdowns and conditional formatting without deleting existing rows.

Repository map (flat and documented): `index.html` / `style.css` / `app.js` (the
canonical frontend) · `prova-local.html` (standalone preview mirror) ·
`events.json` (published) / `events-exemple.json` (sample data for `?prova=1`) ·
`apps-script/*.gs` · `prompts/extract-event.txt` + `prompts/exemples-test/` ·
`docs/` (step guides + `docs/auditoria/` audit reports) · `fonts/` (self-hosted
woff2) · `img/logo/` (the "Què fas?" logo SVGs).

---

## 5. Coding philosophy — enforced on every file — SETTLED

The heart of what to preserve; came directly from Miquel:

- **One function = one job.** If a function does two things, split it. No giant
  do-everything function.
- **Explicit over implicit.** `if (estat === 'publicat')`, never `if (row[14])`.
  Map Sheet columns to fields **by name, one at a time** — no index magic, no
  dynamic/loop mapping (this applies to `publishToGitHub`, `processBotSubmission`
  and `construeixFila` in `processNewEmails` especially).
- **Name everything clearly.** Domain names are in **Catalan**
  (`carregaEsdeveniments`, `esdevenimentsFiltrats`, `creaTargeta`, `analitzaData`,
  `pintaTot`, `construeixFila`). Keep that. Only accepted abbreviations: `url`,
  `id`, `ca`, `fr`.
- **No clever tricks.** No deeply nested ternaries, no destructuring in function
  args, no spread in logic-critical code, no chained one-liners.
- **No nested callbacks.** For async backend code, `async/await` with explicit
  `try/catch` — not `.then()` chains. (The existing frontend `fetch` in `app.js`
  uses a simple linear `.then()` chain for one load; keep that as-is and keep new
  backend async on `await` + `try/catch`.)
- **A comment on every function** — one line saying what it does and returns. Match
  the house style: a banner comment block at the top of each file, dashed section
  separators, terse one-line function headers.
- **Explicit error handling.** Every API call wrapped; errors logged with enough
  detail to know what failed (never log the API key). Frontend fetch shows a
  bilingual fallback message.
- **No dependencies.** Reiterated because it is load-bearing.

Self-test before committing: *could Miquel, who is not a professional developer,
open this file in six months and fix a bug without asking anyone?* If not, simplify.

---

## 6. Linguistic protocol — bilingual, Catalan first — SETTLED

Non-negotiable and pervasive:

- **Catalan is always primary; French sits immediately below, smaller and
  lighter** (Georgia italic, muted colour). Applies to nav, filters, labels,
  buttons, empty/loading/error states — everything user-facing.
- **Event titles: Catalan only**, as provided. **Descriptions: `descripcio_ca`
  first, `descripcio_fr` below** in italic.
- Descriptions are **written natively in natural Catalan**, not literal
  translations from French; `descripcio_fr` is then a faithful translation of the
  Catalan. Informative, welcoming tone — **no advertising exclamations**.
- Catalan typography is done properly: curly apostrophes (`l'agenda`, `d'agost`),
  correct contractions in date phrases. The established pattern lives in `finsAl()`
  in `app.js` (`a l'1`, `al 20`, `de`/`d'` before vowels; French `1er`,
  `Jusqu'au`). Preserve this care; don't regress to straight quotes or naive
  concatenation.
- Bilingual separator in running UI text is ` · ` (e.g. `Totes · Toutes`,
  `Organitza · Organise :`).
- Place names use the **Catalan form** when known (Perpinyà, Prada, Ceret, Prats
  de Molló), while keeping proper nouns of groups/works as given.
- French UI wording note: the comarca filter is labelled "région" in French
  ("comarca" has no everyday French equivalent for a general audience).

---

## 7. Design language — black-and-white, two themes — SETTLED

The look is deliberate and coherent. **Monochrome dominates; the event posters
carry the colour; the senyera palette appears only as a restrained accent.** This
replaced an earlier cream "sang i or" approach and a rejected bordeaux experiment
(see §9). Colours live in `:root` / `[data-tema="fosc"]` CSS variables — reuse
them, never hardcode new hex.

**Two themes (`clar` / `fosc`).** A small pre-paint script in the `<head>` reads
`localStorage('tema')`, else `prefers-color-scheme`, and sets `data-tema` before
paint so there is no flash. A header toggle switches and persists the choice. The
brand colours are invariable; only the environment (light/dark) changes.

- **Clar:** white ground/cards; ink `#1a1a1a`; muted `#6f6862`; hairline `#e7e4df`.
- **Fosc:** ground `#121110`; cards `#1b1917`; ink `#f2efe9`; muted `#9b938c`;
  borders `#2c2825`.
- **Senyera accent:** red `#b5121b` and gold `#fcdd09`, in **only three places** —
  the **date/time** (`--accent`: red in clar, gold in fosc), the **gold day-dot**
  before each day header, and the **soft-gold tile** behind a missing-poster icon.
  Everything else is monochrome. Text pairs meet WCAG AA in both themes.

**Fonts (self-hosted woff2 in `/fonts/`, no CDN at runtime).** The two languages
**never share a font** — font contrast encodes the Catalan-first hierarchy:

- **Fraunces (700, 900)** — Catalan identity layer: wordmark, day-header Catalan
  text, event titles.
- **Montserrat (400, 600)** — labels/UI and Catalan body: category banner, comarca
  label, filters, meta, `descripcio_ca`, footer.
- **Georgia italic** (system serif) — all French secondary text: `descripcio_fr`,
  the masthead subtitle, the French half of day headers, status messages.
- `font-display: swap` with Georgia/system fallbacks — the site degrades
  gracefully if a woff2 file is missing.

**Layout — mobile-first, single column, max-width ~760px, one `@media (min-width:
600px)` step. Sticky filter bar.** The agenda is a **chronological list grouped by
day**, not a grid and not by month:

- **Day header:** bilingual, gold dot then e.g. "21 Juny, Dimarts · 21 Juin,
  Mardi" (Catalan Fraunces, French Georgia italic).
- **Card:** a **square poster on the left**, slightly tilted (alternating ±3° by
  row via `gir-esquerra`/`gir-dreta`, straightening on hover; disabled under
  `prefers-reduced-motion`). A **black angular clip-path "banner"** at the poster's
  top-left shows the **category** (inverts to a light banner in `fosc`).
- **Missing poster:** when `imatge_url` is empty, the poster area shows a
  **per-category inline-SVG icon** on the soft-gold tile — each of the 10
  categories has its own icon (`CATEGORIA_ICONES` in `app.js`) plus a calendar
  default (`ICONA_DEFECTE`). When `imatge_url` is set, the real image shows.
- **Card body:** title in Fraunces (links out only if `font_url` is set); a
  **muted uppercase comarca label** (plain text, not a clickable-looking pill —
  filtering is done in the filter bar); a **meta line** where `hora` and any
  multi-day "Fins al…" carry the colour accent and a pin icon precedes the venue;
  a **"Veure més · Voir plus"** expander revealing the descriptions and organiser.
- **Filters:** comarca **chip buttons** (Totes + the 5; ink outline, ink-fill when
  active) plus a **bilingual category `<select>`**. Combinable. **No date-range
  picker.**
- **Header:** clean ink header (no red band, no senyera border) — the "Què fas?"
  **logo** (two SVGs, `img/logo/que-fas_clar.svg` / `que-fas_fosc.svg`, the CSS
  hides the inactive one), a French subtitle, and the theme toggle. Kept minimal
  on purpose.
- **Hero + footer:** a **hero** invites the public to subscribe (button → Brevo
  form) and the **footer** invites organisers to submit an event (button →
  Typebot). Both buttons stack Catalan (Fraunces, accent dot) over French (Georgia
  italic), rounded rectangle (10px) to distinguish them from the pill filters.

Behaviour kept throughout: past events auto-hidden (`data_fi` before today);
events with no valid `data_inici` are not shown; multi-day events show `Fins al …
· Jusqu'au …`; images and title-links appear only when their field is non-empty.

**Icons are inline SVG string constants** in `app.js` (`currentColor`) — the pin,
sun/moon, category icons and calendar default. No icon font, no library.

---

## 8. Concrete patterns already established (reuse these) — SETTLED

- **`?prova=1` test mode:** `app.js` (`fitxerDeDades()`) loads
  `events-exemple.json` instead of `events.json` when the URL has `?prova=1`.
  `events-exemple.json` is fictional sample data — it includes a deliberately
  **past** event to prove the auto-hide works, and one entry uses a
  `picsum.photos` sample image. It is safe to keep in the repo. Distinct from
  `prova-local.html`, which is the fully standalone offline mirror (embedded data,
  no fetch).
- **Extraction prompt is the master; the `.gs` copy must match it.**
  `prompts/extract-event.txt` is the human-readable, testable master. Its text is
  copied **verbatim** into the `EXTRACTION_PROMPT` constant in
  `processNewEmails.gs`. If you change one, change the other so they stay
  identical. `{{AVUI}}` is replaced by today's date (`YYYY-MM-DD`) and used only to
  infer a missing year (next future occurrence). The email text is appended after
  the `CORREU:` line. The prompt demands JSON only — no preamble, no markdown
  fences — with all 16 keys always present as strings.
- **Gemini extraction call mechanics** (`demanaExtraccioGemini`): model
  `gemini-2.5-flash`; key in the `x-goog-api-key` header (never logged);
  `generationConfig` uses `temperature: 0`, `maxOutputTokens: 2048`,
  `responseMimeType: 'application/json'`, and **`thinkingConfig.thinkingBudget:
  0`** — thinking tokens count against the output budget and can truncate the JSON,
  so they are turned off for this plain extraction task. The reply is defensively
  parsed from the first `{` to the last `}` (`analitzaJsonResposta`).
- **Cloudinary upload is unsigned:** preset `agenda-posters`, folder
  `clm-agenda/posters`, incoming transformation `w_800,c_limit,q_80,f_webp`. The
  upload call needs **only** `CLOUDINARY_CLOUD_NAME` — no signature, no secret.
  (Key/secret kept only for possible admin/delete.) The email path
  (`pujaImatgeCloudinary`) accepts the first image **or PDF** attachment (a PDF
  becomes a WebP of its first page via the preset); inline images are skipped.
- **How `imatge_url` is produced, per source:** email path → uploaded by
  `processNewEmails.gs` to Cloudinary, URL stored. Typebot path → the poster is
  uploaded **browser → Cloudinary** by the Typebot upload step, which returns the
  final Cloudinary URL in the `imatge_url` field (or `""` if skipped);
  `processBotSubmission.gs` stores it **as-is**.
- **Typebot description handling:** the form collects **one** `descripcio` plus an
  `idioma_descripcio` flag (`"ca"`/`"fr"`); the code puts the text on that side and
  leaves the other empty — the curator fills the missing translation during review.
- **Shared Apps Script helpers** (all `.gs` files share one global scope):
  `readField(objecte, clau)` → trimmed string or `""`; `creaId(dataInici, titol)`
  → `YYYY-MM-DD-slug` or `""` — both in `processBotSubmission.gs`. `COMARCA_VALUES`
  / `CATEGORIA_VALUES` in `setupSheet.gs`; use `valorPermes` to coerce
  comarca/categoria to the allowed list or `""`. Never trust the model's own `id` —
  always rebuild it with `creaId`.
- **The only web endpoint is `doPost` in `processBotSubmission.gs`.** There is no
  `doGet`. Keep it that way unless a step genuinely needs it.
- **Secrets** go in Apps Script **Script Properties** — `GEMINI_API_KEY`,
  `CLOUDINARY_CLOUD_NAME` (+ key/secret), `GITHUB_TOKEN`, Brevo key + per-comarca
  list IDs. Read via `getSecret()` (throws a clear error if missing). Never
  hardcoded, never committed.
- **Backend robustness:** `processNewEmails()` takes a `LockService` lock first
  (`tryLock(0)`, exit if not acquired — prevents overlapping hourly runs); caps the
  batch (`MAX_THREADS_PER_RUN`); one bad email is labelled `agenda-error` and never
  stops the batch. Gmail labels drive state: `agenda-entrant` → `agenda-traitat`.
  `publishToGitHub()` fetches the current `events.json` SHA, then does one PUT with
  base64 content and `JSON.stringify(data, null, 2)`.
- **Weekly digest** (`sendWeeklyDigest`): the agreed sending model is **one
  transactional email per subscriber** (not a Brevo campaign), sent **Tuesdays at
  15:00** (script timezone; `installWeeklyTrigger`). Each email carries a bilingual
  unsubscribe line because transactional sends don't add one. Day headers reuse the
  website's format.
- **Sheet conditional formatting:** `publicat` → light green `#D9EAD3`; `pendent` →
  light yellow `#FFF2CC`; `rebutjat` → light red `#F4CCCC`.

### Design rule for future work — first-time-sender confirmation (NOT yet built)

When email-sender consent is eventually added, use **this** scheme (don't invent
another): a first-time sender's mail is held under an `agenda-espera` Gmail label;
Script Properties `SENDERS_CONFIRMED` / `SENDERS_PENDING` track state; the sender's
`"ACCEPTO"` / `"J'ACCEPTE"` reply is the permanent audit record; ingestion triggers
only on `agenda-entrant`-labelled mail. (Current status: not implemented — see the
current-state block.)

### Brand-family constraint

The Agenda's restrained senyera-red / gold / ink-on-B&W palette is **specific to
"Què fas?"** and is **not** to be replicated across the wider brand family (CLM,
TVallespir, Mar i Muntanya). The TVallespir anchor mark is not to be redesigned,
only minorly refined. Keep Agenda design decisions inside the Agenda.

---

## 9. Decision records — don't re-litigate — SETTLED

- **Per-event pages, click-to-modal and outbound per-event share URLs were
  rejected** — they would break or send people off-site. Expand-in-place ("Veure
  més") was chosen. If a single-event deep link is ever needed (e.g. for the Brevo
  digest), the agreed path is a same-page `?event=id` view, not generated files.
- **A bordeaux (dark-red) background was explored and rejected.** On a saturated
  red ground the accents lose contrast and a wall of red + gold reads as a
  political banner, against the welcoming, non-activist tone. The lesson — neutral
  ground, brand colours as accents only — led to the current B&W design.
- **Superseded design choices (kept so they aren't revived):** month-grouping →
  **day-grouping**; gold category chip → **black category banner**; mini-senyera
  placeholder → **per-category icons**; comarca pill → **plain muted label**; red
  senyera header band → **clean ink header**.

---

## 10. Environment gotchas — SETTLED

- **Do not run `git` against the mounted project folder** — it has corrupted the
  `.git` config before. Let Miquel handle Git via the GitHub web UI (the
  established workflow), or work in a copy.
- **The bash mount can serve stale, truncated content** for files overwritten via
  the Write tool (newly created files sync fine). For sandbox testing, write
  **fresh copies to the outputs dir** rather than re-reading an overwritten file
  through bash.
- **Verify frontend changes** with jsdom (load the page, assert the rendered DOM)
  and/or the `?prova=1` page before declaring them done.

---

## 11. How to use this skill

- Load it at the **start of any agenda-catalogne-nord session**, before writing or
  changing code, alongside whatever output-format skills you actually need.
- **First, read the current-state block** to see what is live vs blocked vs
  pending, then work against the settled sections.
- When implementing a Workspace-blocked step, confirm the account status first,
  then follow §4 + the §8 patterns, keeping §5 coding standards and §6 language
  rules.
- When the user proposes a change, check it against §2 (constraints), §7 (design)
  and §9 (rejected paths). If it would add a dependency, a framework, an account
  system, a second database, or break Catalan-first display, flag it and propose
  the simplest in-spirit alternative before proceeding.
- **Keep the current-state block fresh.** When you verify or change something
  time-bound, update that block and its `Last verified` date — that is what keeps
  this file from drifting again.
        