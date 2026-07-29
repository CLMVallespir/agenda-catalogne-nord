# Agenda Catalunya Nord — Project Knowledge

A detailed reference for the `agenda-catalogne-nord` project. This document captures the architecture, the exact data contract, the current build status, the coding and language rules, and the design decisions made so far — including the complexity added in the most recent iterations (the move to a black-and-white design, category icons, and the self-hosted font system). Read this before writing or changing any code. *Last updated: 7 July 2026 — the black-and-white redesign is now ported to the canonical files, and the extraction model is Gemini (`gemini-2.5-flash`), not Claude.*

---

## 1. What the project is

An automated, almost-zero-cost cultural agenda for **North Catalonia / Catalunya Nord** — the five comarques **Rosselló, Conflent, Vallespir, Capcir, Cerdanya**.

End-to-end flow:

1. Cultural associations send event information **by email** or via a **Typebot form**.
2. A Google **Apps Script** reads new emails, sends each body to the **Gemini API** with a fixed extraction prompt, and writes one row per event to a **Google Sheet**.
3. A **curator** (the project owner) reviews the sheet for roughly 10 minutes a week and sets each row's `estat` to `publicat` or `rebutjat`.
4. A **menu item** in the Sheet (**"Agenda → Publica els esdeveniments aprovats"**) pushes all `publicat` rows to `events.json` in the **GitHub** repository via the GitHub API.
5. **GitHub Pages** serves a static, vanilla-JS web app that reads `events.json` and renders the agenda with comarca + category filtering and bilingual display.
6. A **weekly per-comarca email digest** is sent via **Brevo**.

Audience: the general North Catalan public. Tone: open, cultural, welcoming — never activist or political.

---

## 2. Non-negotiable strategic constraints

These were set at kickoff and must not be quietly eroded:

- **Free tiers only** — Google, GitHub Pages, Cloudinary, Brevo, Gemini API. No paid infrastructure.
- **No backend, no database** other than Google Sheets, which is *only* the curator's review surface. No Supabase/Firebase/Airtable, no Node/Python server.
- **No user accounts, no self-submission portal, no real-time backend.**
- **GitHub `events.json` is the published source of truth.** Sheets is upstream review; GitHub is the published record.
- **Images live on Cloudinary, never in Git.**
- **Bilingual, Catalan-first** in every user-facing string.
- **No frameworks, build tools, npm, or external JS/CSS libraries.** Vanilla JS on the frontend; Apps Script built-ins plus `fetch` calls to the Gemini API on the backend.

### Explicitly out of scope (confirm before building, even if asked offhandedly)

User authentication/login · association self-submission portal · in-app event editing · comments or social features · analytics/tracking · any non-Sheets database · any server-side runtime · any CSS framework (Tailwind/Bootstrap) · any JS framework (React/Vue/Svelte).

---

## 3. Architecture and components

| Layer | Technology | Role |
|---|---|---|
| Ingestion | Gmail + Typebot form | Associations submit events |
| Extraction | Apps Script → Gemini API (`gemini-2.5-flash`, `maxOutputTokens` 2048, `thinkingBudget` 0, JSON mode) | Turns a free-text email/body into one structured JSON event |
| Review | Google Sheet | Curator sets `estat`; conditional formatting by status |
| Images | Cloudinary (unsigned upload) | Poster hosting + transformation |
| Publish | Apps Script menu "Publica els esdeveniments aprovats" → GitHub API | Writes `events.json` |
| Web app | Static HTML/CSS/JS on GitHub Pages | Reads `events.json`, filters, bilingual display |
| Digest | Brevo | Weekly per-comarca email |

Repository file map (flat and documented):

- `index.html` / `style.css` / `app.js` — the canonical frontend.
- `prova-local.html` — a self-contained **preview mirror** (a copy of the markup, CSS and logic with sample data embedded, no server or network needed). Double-click to inspect the design.
- `events.json` — published events (source of truth); `events-exemple.json` — fictional sample data for `?prova=1` mode.
- `apps-script/setupSheet.gs` — idempotent Sheet setup (rebuilds headers, dropdowns, conditional formatting without deleting rows).
- `prompts/extract-event.txt` — the Gemini extraction prompt; `prompts/exemples-test/` — sample emails.
- `docs/` — step guides (Cloudinary, GitHub, frontend).
- `fonts/` — self-hosted woff2 files + a README recipe.

---

## 4. The event schema — canonical and exact

Sixteen fields. The **exact names and order** are used identically in the Sheet columns, the extraction prompt, `events.json`, and the frontend. Never rename, reorder or add fields without updating all four places together.

| # | field | type | notes |
|---|---|---|---|
| 1 | `id` | string | `YYYY-MM-DD-slug`, e.g. `2026-09-14-ball-prats`. Empty if no date. |
| 2 | `titol` | string | Title in Catalan |
| 3 | `data_inici` | string | `YYYY-MM-DD` |
| 4 | `data_fi` | string | `YYYY-MM-DD`; equals `data_inici` for a single day |
| 5 | `hora` | string | `HH:MM` 24h; empty if all-day/unknown |
| 6 | `lloc` | string | Venue name |
| 7 | `municipi` | string | Town, Catalan form when known (Perpinyà, Prada, Ceret) |
| 8 | `comarca` | enum | one of the 5, exactly; else `""` |
| 9 | `categoria` | enum | one of the 10, exactly; else `""` |
| 10 | `descripcio_ca` | string | 2–4 sentences, natural Catalan |
| 11 | `descripcio_fr` | string | faithful French translation of `descripcio_ca` |
| 12 | `associacio` | string | organising association |
| 13 | `imatge_url` | string | Cloudinary URL; `""` if none |
| 14 | `font_url` | string | link to the original source; `""` if none |
| 15 | `estat` | enum | `pendent` · `publicat` · `rebutjat` |
| 16 | `data_entrada` | string | ISO timestamp when the row was created |

**Comarca enum:** `Rosselló` · `Conflent` · `Vallespir` · `Capcir` · `Cerdanya`

**Categoria enum:** `Música` · `Teatre` · `Dansa i ball` · `Conferència` · `Exposició` · `Mercat` · `Cinema` · `Taller` · `Activitat infantil` · `Patrimoni i tradicions`

Rules the code relies on:

- **Every field is a string.** Unknown values are `""` — never `null`, never omitted. The extraction prompt enforces this; the frontend assumes it.
- `imatge_url`, `font_url`, `estat`, `data_entrada` are filled **by the system, never by the extraction model** — the extraction prompt returns them empty on purpose.
- Date/time columns in the Sheet are forced to **plain-text format (`@`)** so values like `2026-09-14` and `18:30` are never auto-converted to date/time objects.

---

## 5. Build plan and current status

The project is built **sequentially — verify each step before the next.**

1. **Sheets setup** (`apps-script/setupSheet.gs`) — written; ON HOLD.
2. **Extraction prompt** (`prompts/extract-event.txt`) — DONE.
3. **Cloudinary** (`docs/pas-3-cloudinary.md`) — guide done; preset is **unsigned**.
4. **Gmail ingestion** `processNewEmails()` — blocked on the Workspace account.
5. **Typebot webhook** `processBotSubmission()` — blocked on Workspace.
6. **GitHub repo + Pages** — DONE.
7. **"Publica els esdeveniments aprovats" menu item** `publishToGitHub()` — code done and verified; live wiring blocked on Workspace.
8. **Frontend** (`index.html` / `style.css` / `app.js`) — DONE (see §8 for the current design state).
9. **Weekly Brevo digest** `sendWeeklyDigest()` — blocked on Workspace.

**Why steps 1, 4, 5, 7, 9 are on hold (the Workspace dependency):** the owner is creating a Google Workspace account on a verified domain. The Sheet must be created in that *final* account, because the Gmail inbox, the Apps Script owner and the Sheet owner must all be the **same account**. Google does not allow ownership transfer from a personal `@gmail.com` to a Workspace domain, and copying a Sheet loses its Script Properties, triggers and authorizations. So the plan is to **recreate** the Sheet via `setupSheet.gs` (which is intentionally idempotent / safe to re-run), not to move it. Before any Google-dependent step, confirm whether the Workspace account is ready.

---

## 6. Coding philosophy (enforced on every file)

- **One function = one job.** If a function does two things, split it. No giant do-everything function.
- **Explicit over implicit.** Map Sheet columns to fields by name, one at a time — no index magic, no dynamic/loop mapping (this matters especially in `publishToGitHub` and `processBotSubmission`).
- **Name everything clearly.** Variables say what they hold; functions say what they do. Domain names are in **Catalan** (`carregaEsdeveniments`, `esdevenimentsFiltrats`, `creaTargeta`, `analitzaData`, `pintaTot`). Only accepted abbreviations: `url`, `id`, `ca`, `fr`.
- **No clever tricks.** No deeply nested ternaries, no destructuring in function args, no spread in logic-critical code, no chained one-liners.
- **No nested callbacks.** Sequential steps. New async backend code uses `async/await` with explicit `try/catch`; the existing linear frontend `fetch` uses a simple `.then()` chain.
- **A one-line comment on every function**, plus a banner comment block at the top of each file and dashed section separators (match the existing house style).
- **Explicit error handling.** Every API call wrapped; errors logged with enough detail. The frontend `fetch` shows a bilingual fallback message.
- **No dependencies** (load-bearing — repeated for emphasis).

Self-test before committing: *could the owner, who is not a professional developer, open this file in six months and fix a bug without asking anyone?* If not, simplify.

---

## 7. Linguistic protocol — bilingual, Catalan first

- **Catalan is always primary; French sits immediately below, smaller and lighter** (Georgia italic, muted colour). This applies to nav, filters, labels, buttons, and empty/loading/error states — everything user-facing.
- **Event titles: Catalan only**, as provided. **Descriptions: `descripcio_ca` first, `descripcio_fr` below** in italic.
- Descriptions are **written natively in natural Catalan**, not literal translations from French; `descripcio_fr` is then a faithful translation of the Catalan. Informative, welcoming tone — no advertising exclamations.
- Catalan typography is done properly: curly apostrophes (`l'agenda`, `d'agost`), correct contractions in date phrases. The established pattern lives in `finsAl()` in `app.js` (`a l'1`, `al 20`, `de`/`d'` before vowels; French `1er`, `Jusqu'au`). Don't regress to straight quotes or naive concatenation.
- Bilingual separator in running text is ` · ` (e.g. `Totes · Toutes`, `Organitza · Organise :`).
- Place names use the **Catalan form** when known (Perpinyà, Prada, Ceret, Prats de Molló), while keeping proper nouns of groups/works as given.

---

## 8. Design language — current state (after the latest iterations)

The frontend has evolved through several iterations. The current direction is **black-and-white-dominant, with the senyera palette used only as a restrained accent and the event posters carrying the colour.** This deliberately replaced an earlier "sang i or" approach (red/gold as a near-ground) and a briefly-explored bordeaux-background experiment (see §10).

**Status note (updated 7 July 2026):** this black-and-white design is now **ported and live in the canonical `index.html` / `style.css` / `app.js`** (along with the "Què fas?" logo, the hero and the footer). `prova-local.html` remains as a standalone offline preview mirror to keep roughly in sync; it is no longer the sole home of the real design.

### Themes

Two themes, switched by a header toggle. The theme is applied by a small pre-paint script in the `<head>` that reads `localStorage('tema')` (else `prefers-color-scheme`) and sets `data-tema` before paint, so there is no flash. The toggle persists the choice. Brand colours stay invariable; only the environment ("clar"/"fosc") changes via CSS variables.

- **Clar (light):** white ground and cards; ink `#1a1a1a`; muted `#6f6862`; hairline borders `#e7e4df`.
- **Fosc (dark):** ground `#121110`; cards `#1b1917`; ink `#f2efe9`; muted `#9b938c`; borders `#2c2825`.
- **Brand accent ("sang i or"):** red `#b5121b` and gold `#fcdd09`. The accent appears in only three restrained places — the **date/time** (red in clar, gold in fosc), the **gold day-dot** on each day header, and the **soft-gold tile** behind a missing-poster icon. Everything else is monochrome; the posters supply the real colour.

All text pairs meet WCAG AA contrast in both themes (verified; lowest ≈ 5.1:1).

### List and card anatomy

- The list is **grouped by day**, with a bilingual day header — e.g. "21 Juny, Dimarts · 21 Juin, Mardi" — preceded by a small **gold dot**. Catalan in Fraunces, French in Georgia italic.
- Each event is a card: a **square poster on the left**, slightly tilted (alternating ±3° by row, straightening on hover; disabled under `prefers-reduced-motion`), with a **black angular "banner"** (clip-path) at the top-left corner showing the **category** name (this replaced the old gold category chip; it inverts to a light banner in the dark theme).
- **Missing-poster fallback:** when `imatge_url` is empty, the poster area shows a **per-category inline-SVG icon** on a soft-gold tile (each of the 10 categories has its own icon: a note for Música, masks for Teatre, a dancer for Dansa i ball, a mic for Conferència, a frame for Exposició, a basket for Mercat, a clapperboard for Cinema, a tool for Taller, a balloon for Activitat infantil, a monument for Patrimoni i tradicions; plus a calendar default). This **retired the earlier mini-senyera placeholder.** When `imatge_url` is set, the real image shows.
- Card body: **title** in Fraunces (links out only if `font_url` is set), a **muted uppercase comarca label** (a plain text label, not a clickable-looking pill — filtering is done in the filter bar), a **meta line** (`hora` and any multi-day "Fins al…" carry the colour accent; a pin icon precedes the venue), and a **"Veure més · Voir plus"** expander that reveals the Catalan + French descriptions and the organiser.
- Behaviour kept from earlier: past events auto-hidden (`data_fi` before today); events with no valid `data_inici` are not shown; multi-day events show `Fins al … · Jusqu'au …`.

### Filters and header

- **Filters:** comarca chip buttons (Totes + the 5 comarques; ink outline, ink-fill when active) plus a **bilingual category `<select>`** and a **date interval** made of two native `<input type="date">` fields ("Del · Du / al · au") with an "Esborra · Effacer" button that appears only when a date is set. Combinable. Sticky bar. An event shows if its `[data_inici, data_fi]` period **overlaps** the chosen interval; an empty field means no limit; same date in both fields = a single day. *(Decision revised 2026-07-15 at Miquel's request: the earlier "no date-range picker" rule was overturned — native inputs only, no calendar widget, no library. Caveat: the native calendar popup follows the browser locale, so it is usually French; the labels stay bilingual Catalan-first.)*
- **Header:** clean ink (no red band, no senyera border) — a wordmark plus the theme toggle. Kept intentionally minimal so that a **future hero section and a yet-to-be-designed logo** can be added without conflict.

### Typography (self-hosted, no CDN at runtime)

- **Fraunces** (700, 900) — Catalan identity layer: wordmark, day-header Catalan text, event titles.
- **Montserrat** (400, 600) — labels/UI and Catalan body: category banner, comarca label, filters, meta, `descripcio_ca`, footer.
- **Georgia italic** (system serif) — all French secondary text: `descripcio_fr`, the masthead subtitle, the French part of day headers, status messages.
- **The bilingual font rule (key principle):** the two languages never share a font. Catalan uses the clean primary fonts; French uses warm Georgia italic, muted. Font contrast encodes the Catalan-first hierarchy.
- Self-hosted woff2 files live in `/fonts/` (`fraunces-700/900`, `montserrat-400/600`, Latin subset covering French accents and Catalan `l·l`). `font-display: swap` with Georgia/system fallbacks means the site degrades gracefully if a file is missing. Google Fonts CDN is **not** used at runtime (honours the no-dependency constraint).

---

## 9. Established patterns (reuse these)

- **`?prova=1` test mode:** `app.js` loads `events-exemple.json` instead of `events.json` when the URL has `?prova=1`. `prova-local.html` is the fully standalone version (embedded data, no fetch) used to preview layout without publishing.
- **Extraction prompt mechanics:** `prompts/extract-event.txt` is the master; its text is copied **verbatim** into the `EXTRACTION_PROMPT` constant in `processNewEmails.gs` — change one, change the other. A `{{AVUI}}` placeholder is replaced by today's date (`YYYY-MM-DD`) and used only to infer a missing year (pick the next future occurrence). The email body is appended after a `CORREU:` line. The prompt demands JSON only — no preamble, no markdown fences — with all 16 keys always present. The Gemini call uses JSON mode (`responseMimeType: 'application/json'`) with `thinkingBudget: 0` so thinking tokens don't truncate the output.
- **Cloudinary upload is unsigned:** preset `agenda-posters`, folder `agenda-nord/posters`, incoming transformation `w_800,c_limit,q_80,f_webp`. The upload call needs only `CLOUDINARY_CLOUD_NAME` — no signature, no secret. (Key/secret are kept only for possible admin/delete operations.)
- **Secrets** go in Apps Script **Script Properties** — `GEMINI_API_KEY`, Cloudinary cloud name, GitHub token, Brevo key + per-comarca list IDs. Never hardcoded, never committed.
- **Backend robustness:** `processNewEmails()` takes a `LockService` lock first (exit if not acquired, prevents double runs); Gmail labels drive state (`agenda-entrant` → `agenda-traitat`); `publishToGitHub()` fetches the current `events.json` SHA, then does one PUT with base64 content and `JSON.stringify(data, null, 2)`.
- **Sheet conditional formatting:** `publicat` → light green `#D9EAD3`; `pendent` → light yellow `#FFF2CC`; `rebutjat` → light red `#F4CCCC`.
- **Frontend SVG icons are inline** (defined as string constants in the house style, `currentColor`) — no icon font or library. This is how the category icons and the pin/sun/moon icons are implemented.

---

## 10. Decision records (so past choices aren't re-litigated)

- **Per-event pages, click-to-modal and outbound per-event share URLs were rejected** — they would break or send people off-site. Expand-in-place ("Veure més") was chosen for simplicity. If a single-event deep link is ever needed (e.g. for the Brevo digest), the agreed upgrade path is a same-page `?event=id` view, not generated files.
- **A bordeaux (dark-red) background was explored and rejected.** On a saturated red ground the red accents lose all contrast and the senyera identity weakens; a wall of red + yellow also reads as a political banner, against the project's welcoming, non-activist tone. The lesson — keep a neutral ground and use the brand colours only as accents — led directly to the current black-and-white design.
- **Month-grouping was replaced by day-grouping**; the **gold category chip** became the **black category banner**; the **mini-senyera placeholder** became **per-category icons**; the **comarca pill** became a **plain muted label**; the **red header band** became a **clean ink header**. These are all live in the preview.

---

## 11. Environment gotchas

- **Do not run `git` against the working project folder** — it has corrupted the `.git` config before. Handle Git via the GitHub web UI, or work on a copy.
- **A mounted/sandbox view can serve stale or truncated content** for files overwritten in place (newly created files sync fine). For sandbox testing, write a fresh copy elsewhere rather than re-reading the overwritten file.
- **Verify frontend changes with jsdom** (load the page, assert the rendered DOM) and/or the `?prova=1` page before declaring them done.

---

## 12. Open / next decisions

- **Brevo subscribe form wired** — hero button now links to the live Brevo hosted signup form (set 2026-07-29).
- **Build first-time-sender email confirmation** — designed (`agenda-espera` label, `SENDERS_CONFIRMED` / `SENDERS_PENDING`, `ACCEPTO` / `J'ACCEPTE` reply) but not yet implemented in `processNewEmails.gs`.
- **A "Notícies" / news section** is of interest but parked for later; if added, it would be a second nav item, not a structural change.
- **Google account decision changed:** the project no longer waits on a Workspace account — Miquel is running everything on the personal Gmail `agendacatnord@gmail.com` (Sheet, Apps Script, Gmail ingestion all owned by that account). Steps 1/4/5/7/9 are wiring against that account now.
