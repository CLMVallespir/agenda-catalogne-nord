# Agenda Catalunya Nord ("Què fas?") — Project Knowledge for Claude Chat

*Last updated: 7 July 2026.*

## How to read this document (important context for Claude Chat)

This is the **single source of truth you (Claude Chat) have** about the
`agenda-catalogne-nord` project. **You do not have access to the project's files.**
The actual code, prompts, docs and design live in two places you cannot open from
here:

- **Claude Cowork** — a desktop workspace that *does* have direct read/write access
  to the project folder on the owner's computer. All file and code work (Apps
  Script, frontend, prompts, the Brevo digest, docs) is done there.
- **GitHub** — the repository that hosts the static web app and `events.json`.

So your job in Chat is **planning, drafting, reasoning and discussion**, not
pretending to edit files. When a task needs a file changed, the plan is executed in
Cowork. Describe *what* should change and *why*; don't claim to have read or written
a file. When you need a fact that isn't in this document, say so rather than
guessing — the details in this file were reconciled against the live code on
7 July 2026, but implementation keeps moving.

This document intentionally restates everything in prose (rather than pointing at
files like "see app.js"), because you can't follow those pointers. File names are
given only so you can refer to them precisely when planning work for Cowork.

---

## 1. What the project is

An automated, almost-zero-cost cultural agenda for **North Catalonia / Catalunya
Nord** — the five comarques **Rosselló, Conflent, Vallespir, Capcir, Cerdanya**.
Its public-facing name is **"Què fas?"**. It is a one-person volunteer project; the
owner (Miquel) is not a professional developer, so **everything is optimised to
stay repairable by one non-expert months from now.**

End-to-end flow:

1. Cultural associations send event information **by email** or via a **Typebot
   form**.
2. A Google **Apps Script** reads new emails, sends each body to the **Gemini API**
   with a fixed extraction prompt, and writes one structured row per event to a
   **Google Sheet**.
3. A **curator** (Miquel) reviews the sheet ~10 minutes a week and sets each row's
   status (`estat`) to `publicat` or `rebutjat`.
4. A **"Publier" menu button** in the Sheet pushes all `publicat` rows to
   `events.json` in the **GitHub** repository via the GitHub API.
5. **GitHub Pages** serves a static, vanilla-JS web app that reads `events.json` and
   renders the agenda with comarca + category filtering and bilingual display.
6. A **weekly per-comarca email digest** is sent via **Brevo**.

Audience: the general North Catalan public. Tone: open, cultural, welcoming —
**never** activist or political.

---

## 2. Non-negotiable strategic constraints

Set at kickoff; must not be quietly eroded. If a proposal breaks one of these, flag
it and offer the simplest in-spirit alternative:

- **Free tiers only** — Google, GitHub Pages, Cloudinary, Brevo, Gemini API. No paid
  infrastructure, ever. (This is *why* the extraction model is Gemini — see the note
  in §3.)
- **No backend, no database** other than Google Sheets, which is *only* the
  curator's review surface. No Supabase/Firebase/Airtable, no Node/Python server.
- **No user accounts, no self-submission portal, no real-time backend.**
- **GitHub `events.json` is the published source of truth.** Sheets is upstream
  review; GitHub is the published record.
- **Images live on Cloudinary, never in Git.**
- **Bilingual, Catalan-first** in every user-facing string (see §6).
- **No frameworks, build tools, npm, or external JS/CSS libraries.** Vanilla JS on
  the frontend; Apps Script built-ins plus `fetch` calls to APIs on the backend.
  Fonts are self-hosted; no CDN at runtime.

**Explicitly out of scope** (confirm before even sketching): user auth/login;
association self-submission portal; in-app event editing; comments or social
features; analytics/tracking; any non-Sheets database; any server-side runtime; any
CSS framework (Tailwind/Bootstrap); any JS framework (React/Vue/Svelte).

---

## 3. Architecture and components

| Layer | Technology | Role |
|---|---|---|
| Ingestion | Gmail + Typebot form | Associations submit events |
| Extraction | Apps Script → **Gemini API** (`gemini-2.5-flash`) | Turns a free-text email into one structured JSON event |
| Review | Google Sheet | Curator sets `estat`; conditional formatting by status |
| Images | Cloudinary (unsigned upload) | Poster hosting + transformation |
| Publish | Apps Script "Publier" button → GitHub API | Writes `events.json` |
| Web app | Static HTML/CSS/JS on GitHub Pages | Reads `events.json`, filters, bilingual display |
| Digest | Brevo | Weekly per-comarca email |

**Extraction model — the important correction.** The extraction model is **Google
Gemini (`gemini-2.5-flash`), not Claude.** The project originally planned to use the
Claude/Anthropic API, but the Anthropic API is a separate paid product (not covered
by a Pro/Max subscription), which conflicts with the "no paid infra ever" rule. So
the decision was made to switch to the **Gemini free tier** (generous limits, no
card, no expiry). If you ever see an older note that says "Claude API" or
`claude-sonnet-4-6` for extraction, it is out of date — the live code uses Gemini.
The extraction call uses JSON mode (`responseMimeType: application/json`),
`temperature: 0`, `maxOutputTokens: 2048`, and **`thinkingBudget: 0`** (Gemini's
default "thinking" tokens would otherwise eat the output budget and truncate the
JSON mid-object).

Repository files (named so you can refer to them precisely — you cannot open them):
the canonical frontend is `index.html` / `style.css` / `app.js`; `prova-local.html`
is a standalone offline preview mirror; `events.json` is the published data and
`events-exemple.json` is fictional sample data used by a `?prova=1` preview mode;
the Apps Script functions live in `apps-script/*.gs`; the extraction prompt is
`prompts/extract-event.txt`; step guides and audit reports are under `docs/`;
self-hosted fonts under `fonts/`; the logo SVGs under `img/logo/`.

---

## 4. The event schema — canonical and exact

Sixteen fields. The **exact names and order** are used identically in the Sheet
columns, the extraction prompt, `events.json`, and the frontend. Never propose
renaming, reordering, or adding a field without updating all four places together.

1. `id` — string, `YYYY-MM-DD-slug` (e.g. `2026-09-14-ball-prats`); empty if no date
2. `titol` — title, in Catalan
3. `data_inici` — `YYYY-MM-DD`
4. `data_fi` — `YYYY-MM-DD`; equals `data_inici` for a single-day event
5. `hora` — `HH:MM` 24h; empty if all-day/unknown
6. `lloc` — venue name
7. `municipi` — town, in Catalan form when known (Perpinyà, Prada, Ceret)
8. `comarca` — one of the 5 exactly, else `""`
9. `categoria` — one of the 10 exactly, else `""`
10. `descripcio_ca` — 2–4 sentences, natural Catalan
11. `descripcio_fr` — faithful French translation of `descripcio_ca`
12. `associacio` — organising association
13. `imatge_url` — Cloudinary URL; `""` if none
14. `font_url` — link to the original source; `""` if none
15. `estat` — `pendent` · `publicat` · `rebutjat`
16. `data_entrada` — ISO timestamp when the row was created

**Comarca enum:** Rosselló · Conflent · Vallespir · Capcir · Cerdanya
**Categoria enum:** Música · Teatre · Dansa i ball · Conferència · Exposició ·
Mercat · Cinema · Taller · Activitat infantil · Patrimoni i tradicions

Rules the code relies on:

- **Every field is a string.** Unknown values are `""` — never `null`, never
  omitted. The extraction prompt enforces this; the frontend assumes it.
- `imatge_url`, `font_url`, `estat`, `data_entrada` are filled **by the system,
  never by the extraction model** — the prompt returns them empty on purpose.
- Sheet date/time columns are forced to plain-text format so values like
  `2026-09-14` and `18:30` are never auto-converted to date/time objects.

---

## 5. Build plan and current status (as of 7 July 2026)

Built **sequentially — verify each step before the next.**

1. **Sheets setup** (`setupSheet.gs`) — **DONE** in the final Workspace account
   (idempotent: rebuilds headers, dropdowns, conditional formatting without deleting
   rows).
2. **Extraction prompt** — **DONE**.
3. **Cloudinary** — guide done; unsigned upload preset.
4. **Gmail ingestion** (`processNewEmails()`) — **code written and reviewed**;
   awaiting live wiring (Gmail filter + trigger) in the Workspace account.
5. **Typebot webhook** (`processBotSubmission()`) — **code written and reviewed**;
   awaiting live webhook wiring. The Typebot form link is live.
6. **GitHub repo + Pages** — **DONE**.
7. **"Publier" button** (`publishToGitHub()`) — **code written and reviewed**;
   awaiting the owner's live click-test with a GitHub token.
8. **Frontend** (`index.html` / `style.css` / `app.js`) — **DONE**, including the
   black-and-white redesign, the "Què fas?" logo, the hero and the footer (see §7).
9. **Weekly Brevo digest** (`sendWeeklyDigest()`) — **code written and reviewed**;
   awaiting a Brevo account with the 5 comarca lists.

**The Google Workspace dependency (background):** the backend steps had to wait
until the owner had a Google Workspace account on a verified domain, because the
Gmail inbox, the Apps Script owner and the Sheet owner must all be the **same
account**, and Google can't transfer a Sheet's ownership from a personal
`@gmail.com` to a Workspace domain. That account is now ready and the Sheet was
recreated in it, so the remaining work is **wiring and external accounts, not
writing code.**

**What is still pending (the honest "not done yet" list):**

- The **Brevo subscribe form URL** is still a placeholder in the site's hero
  button; the Brevo account and the 5 per-comarca lists are not set up.
- **First-time-sender email confirmation is designed but NOT built.** The intended
  scheme (for whenever it is built): a first-time sender's mail is held under an
  `agenda-espera` Gmail label; Script Properties `SENDERS_CONFIRMED` /
  `SENDERS_PENDING` track state; the sender's "ACCEPTO" / "J'ACCEPTE" reply is the
  permanent consent record; ingestion triggers only on `agenda-entrant` mail. Don't
  describe this as existing.
- Live wiring of steps 4/5/7/9 (Gmail filter, Typebot webhook, GitHub token,
  Brevo account).

---

## 6. Coding philosophy (applies to any code you draft for Cowork to implement)

- **One function = one job.** No giant do-everything function.
- **Explicit over implicit.** Map Sheet columns to fields by name, one at a time —
  no index magic, no dynamic/loop mapping.
- **Name everything clearly, in Catalan** for domain terms
  (`carregaEsdeveniments`, `esdevenimentsFiltrats`, `creaTargeta`, `analitzaData`,
  `pintaTot`, `construeixFila`). Only accepted abbreviations: `url`, `id`, `ca`,
  `fr`.
- **No clever tricks** — no deeply nested ternaries, no destructuring in function
  args, no spread in logic-critical code, no chained one-liners.
- **No nested callbacks.** New backend async code uses `async/await` with explicit
  `try/catch`. The existing frontend uses a simple linear `fetch().then()` chain.
- **A one-line comment on every function**, a banner comment block at the top of
  each file, dashed section separators.
- **Explicit error handling** on every API call; never log the API key. The frontend
  shows a bilingual fallback message on failure.
- **No dependencies.**

Self-test for any code: *could a non-professional developer open this in six months
and fix a bug without asking anyone?* If not, simplify.

---

## 7. Linguistic protocol — bilingual, Catalan first

- **Catalan is always primary; French sits immediately below, smaller and lighter**
  (rendered in Georgia italic, muted colour). Applies to nav, filters, labels,
  buttons, and empty/loading/error states — everything user-facing.
- **Event titles: Catalan only.** **Descriptions: Catalan first, French below** in
  italic. Descriptions are **written natively in natural Catalan** (not literal
  translations from French); the French is then a faithful translation of the
  Catalan. Informative, welcoming tone — **no advertising exclamations.**
- Catalan typography must be correct: curly apostrophes (`l'agenda`, `d'agost`) and
  correct date contractions (`a l'1`, `al 20`, `de`/`d'` before vowels; French
  `1er`, `Jusqu'au`). Don't regress to straight quotes or naive concatenation.
- Bilingual separator in running text is ` · ` (e.g. `Totes · Toutes`,
  `Organitza · Organise :`).
- Place names use the Catalan form when known (Perpinyà, Prada, Ceret, Prats de
  Molló); keep proper nouns of groups/works as given.
- In French UI, the comarca filter is labelled "région" (comarca has no everyday
  French equivalent for a general audience).

---

## 8. Design language — black-and-white, two themes

The current look is **black-and-white-dominant: the event posters carry the colour,
and the senyera palette (red/gold) appears only as a restrained accent.** This
replaced an earlier cream "sang i or" (blood-and-gold) approach and a rejected
bordeaux-background experiment. **This design is now live in the canonical files**
(it used to live only in the preview mirror; the port is done).

**Two themes, `clar` (light) and `fosc` (dark)**, switched by a header toggle. A
small script applies the saved theme *before paint* (reading a stored preference,
else the OS `prefers-color-scheme`) so there is no flash. Brand colours are
invariable; only the light/dark environment changes.

- **Clar:** white ground and cards; near-black ink; muted grey; hairline borders.
- **Fosc:** near-black ground; dark cards; off-white ink; muted grey; dark borders.
- **Senyera accent (red `#b5121b`, gold `#fcdd09`)** appears in **only three
  places:** the date/time text (red in light, gold in dark), a small gold dot on
  each day header, and a soft-gold tile behind a missing-poster icon. Everything
  else is monochrome.

**Typography (self-hosted, no runtime CDN). The two languages never share a font —
font contrast encodes the Catalan-first hierarchy:** Catalan uses **Fraunces**
(titles, wordmark, day headers) and **Montserrat** (Catalan body and all UI); all
French secondary text uses **Georgia italic**, muted.

**Layout:** mobile-first, single column, ~760px max width, one responsive step,
sticky filter bar. The agenda is a **chronological list grouped by day** (not a grid
and not by month), each day introduced by a bilingual header with a gold dot. Each
event is a card with a **square poster on the left**, slightly tilted (alternating
by row, straightening on hover, disabled for reduced-motion), with a **black angular
category banner** at its top-left. When an event has no poster, the card shows a
**per-category icon** on a soft-gold tile (each of the 10 categories has its own
icon, plus a calendar default). The card body has the title (which links out only if
a source URL exists), a muted uppercase comarca label (plain text, not a clickable
pill), a meta line (time and any multi-day "Fins al…" carry the colour accent, with
a pin icon before the venue), and a **"Veure més · Voir plus"** expander revealing
the descriptions and organiser.

**Filters:** comarca chip buttons (Totes + the 5) plus a bilingual category
dropdown and a **date interval** (two native `<input type="date">` fields,
"Del · Du / al · au", with an "Esborra · Effacer" button; overlap semantics,
empty field = no limit — decision revised 2026-07-15, replacing the earlier
"no date-range picker" rule; native inputs only, no widget, no library),
all combinable, in a sticky bar. Past events are
auto-hidden; events with no valid start date are not shown; multi-day events show
"Fins al … · Jusqu'au …".

**Header, hero and footer:** a clean ink header carries the **"Què fas?" logo**
(two SVGs, one per theme) plus a French subtitle and the theme toggle. A **hero**
invites the public to subscribe (button → the Brevo form, URL still pending). The
**footer** invites organisers to submit an event (button → the live Typebot form).

**Decisions kept so they aren't re-litigated:** per-event pages / click-to-modal /
outbound per-event share URLs were rejected in favour of expand-in-place (if a
single-event deep link is ever needed, the agreed path is a same-page `?event=id`
view, not generated files); the bordeaux background was rejected because a wall of
red+gold reads as a political banner and kills the accents' contrast; month-grouping
became day-grouping; the gold category chip became the black banner; the mini-
senyera placeholder became per-category icons; the comarca pill became a plain
label; the red senyera header band became the clean ink header.

**Brand-family note:** the Agenda's restrained senyera-red / gold / ink-on-B&W
palette is **specific to "Què fas?"** and is not to be replicated across the wider
brand family (CLM, TVallespir, Mar i Muntanya).

---

## 9. Established mechanisms worth knowing when planning

- **Preview modes.** Adding `?prova=1` to the site URL loads the fictional sample
  data instead of the real data (handy for previewing layout without publishing).
  Separately, `prova-local.html` is a fully standalone offline copy (embedded data,
  no network) for inspecting the design by double-clicking. Note: opening the real
  `index.html` directly from disk shows an empty/error state because `file://`
  blocks the data fetch — that is expected, not a bug; preview via `prova-local.html`
  or GitHub Pages.
- **The extraction prompt is a master file copied verbatim into the Apps Script.**
  If the prompt changes, both copies must change together. The prompt demands JSON
  only (no preamble, no markdown fences) with all 16 keys always present as strings.
- **Poster uploads use an unsigned Cloudinary preset**, so the upload needs only the
  Cloudinary cloud name (no secret). The email path uploads the first image or PDF
  attachment (a PDF is converted to a WebP of its first page); the Typebot path
  uploads the poster from the browser and stores the returned URL as-is.
- **Secrets** live in Apps Script Script Properties (Gemini key, Cloudinary cloud
  name, GitHub token, Brevo key + list IDs) — never hardcoded, never committed.
- **Backend robustness:** ingestion takes a lock so runs never overlap, caps the
  batch size, and sends one bad email to an error label without stopping the rest;
  publishing fetches the current file SHA and does a single update.
- **The weekly digest** is sent as **one transactional email per subscriber** (not a
  bulk campaign), on **Tuesdays at 15:00**, each carrying a bilingual unsubscribe
  line.

---

## 10. Environment notes (relevant when directing Cowork work)

- **Git must not be run against the mounted project folder** — it has corrupted the
  repository config before. The owner handles Git via the GitHub web UI, or work is
  done on a copy.
- Frontend changes are verified with a headless DOM check and/or the `?prova=1`
  preview before being declared done.
- There is a companion **skill** in Cowork (`agenda-nord-core`) that carries this
  same knowledge for the file-editing sessions, plus a dated "current state" block.
  This document and that skill were reconciled to the live code on 7 July 2026.

---

## 11. How to help in Chat (summary)

- You are the **planning and drafting partner.** Reason about architecture, write
  prompt text, draft copy, sketch code, weigh trade-offs against §2 constraints and
  §8 design decisions — but remember the files are edited in Cowork, not here.
- **Guard the constraints.** If an idea would add a dependency, a framework, an
  account system, a second database, a paid service, or break Catalan-first display,
  say so and propose the simplest in-spirit alternative.
- **Don't invent specifics you can't see.** If a decision depends on the exact
  current contents of a file, note that it should be verified in Cowork rather than
  asserting it.
- **Keep it simple.** Simplicity beats everything here; the whole project must stay
  repairable by one non-expert owner.
