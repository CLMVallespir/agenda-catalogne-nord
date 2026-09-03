# Agenda Catalunya Nord ("Què fas?") — Project Knowledge for Claude Chat

*Last updated: 29 August 2026. Reconciled against the live code and the live
deployment on that date.*

## How to read this document (important context for Claude Chat)

This is the **single source of truth you (Claude Chat) have** about the
`agenda-catalogne-nord` project. **You do not have access to the project's files.**
The actual code, prompts, docs and design live in two places you cannot open from
here:

- **Claude Code** (desktop, in the project folder) — has direct read/write access to
  the repository on the owner's machine. All file and code work happens there, and
  it runs Git, Node and shell commands directly.
- **GitHub** — the repository that hosts the static site, `events.json` and
  `pendents.json`.

So your job in Chat is **planning, drafting, reasoning and discussion**, not
pretending to edit files. When a task needs a file changed, the plan is executed in
Claude Code. Describe *what* should change and *why*; don't claim to have read or
written a file. When you need a fact that isn't in this document, say so rather than
guessing.

**Read §5 before you propose any work.** The project is further along than a first
reading of an old brief would suggest: the curator page, the public site and all
three Worker handlers exist and are deployed. Proposing to "build the curator" or
"set up the Apps Script" is the single most likely way to waste the owner's time.

This document intentionally restates everything in prose (rather than pointing at
files like "see app.js"), because you can't follow those pointers. File names are
given only so you can refer to them precisely when planning work.

---

## 1. What the project is

An automated, almost-zero-cost cultural agenda for **North Catalonia / Catalunya
Nord** — the five comarques **Rosselló, Conflent, Vallespir, Capcir, Cerdanya**. Its
public-facing name is **"Què fas?"**. It is a one-person volunteer project; the owner
(Miquel) is not a professional developer, so **everything is optimised to stay
repairable by one non-expert months from now.**

End-to-end flow:

1. Cultural associations send event information **by email** to `agenda@clm.cat`, or
   through a **Typebot form**.
2. Email goes through **Cloudflare Email Routing** into a **single Cloudflare
   Worker**. The Worker's `email()` handler forwards the original to an archive Gmail
   *first*, then parses the MIME, sends the body text to the **Gemini API** with a
   fixed extraction prompt, uploads the first poster attachment to **Cloudinary**,
   and appends one structured row to **`pendents.json`** in the GitHub repository.
3. The Typebot form posts to the **same Worker**, on its `fetch()` handler. The form
   fields are already structured, so there is **no model call** on this path: a
   deterministic field-by-field map produces the same row shape.
4. A **curator** (Miquel) reviews the queue in **`curador.html`**, a static page on
   GitHub Pages. Each pending row is shown with its poster beside its text, every
   field is editable, and two buttons decide it: **Publica** or **Rebutja**.
5. Publishing writes the row into **`events.json`** and removes it from
   `pendents.json`, both through the **GitHub contents API**.
6. **GitHub Pages** serves a static, vanilla-JS web app that reads `events.json` and
   renders the agenda with comarca, category and date-interval filtering, bilingual
   display.
7. A **weekly per-comarca email digest** goes out via **Brevo**, driven by the same
   Worker's `scheduled()` handler on a Cloudflare cron trigger.

Audience: the general North Catalan public. Tone: open, cultural, welcoming —
**never** activist or political.

**One Worker, three doors.** It is worth holding this shape in mind, because almost
every architectural question resolves against it: `email()`, `fetch()` and
`scheduled()` are three handlers of **one** deployed Worker, not three services. Two
of them (`email()`, `fetch()`) end at the same place — a row in `pendents.json`. The
third writes nothing and only reads `events.json` and sends mail.

---

## 2. Non-negotiable strategic constraints

Set at kickoff; must not be quietly eroded. If a proposal breaks one of these, flag
it and offer the simplest in-spirit alternative:

- **Free tiers only** — Cloudflare (Email Routing + Workers), GitHub Pages,
  Cloudinary, Brevo, the Gemini API. No paid infrastructure, ever. (This is *why* the
  extraction model is Gemini — see §3.)
- **No database.** State lives in exactly two JSON files in the repository:
  `pendents.json` (review queue) and `events.json` (published truth). No Supabase,
  Firebase, Airtable, KV, D1 or third JSON file. If something seems to need a third
  store, check first whether the service doing the work already keeps that record.
- **No server beyond the single Worker.** No Node/Python host, no second Worker.
- **No user accounts, no login, no self-submission portal.**
- **`events.json` is the published source of truth**; `pendents.json` is the review
  queue upstream of it.
- **Images live on Cloudinary, never in Git.**
- **Bilingual, Catalan-first** in every user-facing string (see §7). Sole exception:
  `curador.html` is Catalan-only, because its only user is the curator.
- **No frameworks, build tools, npm, or external JS/CSS libraries.** Vanilla JS
  everywhere. Fonts are self-hosted; no CDN at runtime. **One agreed exception:**
  `postal-mime`, *vendored* — a single pinned file committed to the repository with
  its version and origin URL in the header comment. No `package.json`, no
  `node_modules`.
- **Deployment without a toolchain.** The Worker is deployed by **pasting code into
  the Cloudflare dashboard editor**. `wrangler` is never a requirement. See §3 for
  what this costs and §10 for the trap it creates.

**Explicitly out of scope** (confirm before even sketching): user auth/login;
association self-submission portal; in-app event editing on the public site; comments
or social features; analytics/tracking; any database; any server beyond the one
Worker; any CSS framework (Tailwind/Bootstrap); any JS framework (React/Vue/Svelte).

**Deferred with an agreed path** (documented, not to be built now): per-comarca
curation tokens (a fine-grained token plus `curador.html?comarca=Vallespir`, no user
table — the commit history records who approved what); first-time-sender
confirmation (the natural equivalent is a `remitents.json` list managed by the
Worker — don't design it until it's needed); "send mail as" so replies can come from
`agenda@clm.cat`; a catch-all `*@clm.cat` address.

---

## 3. Architecture and components

| Layer | Technology | Role |
|---|---|---|
| Ingestion (email) | Cloudflare Email Routing → Worker `email()` | `agenda@clm.cat` becomes a queue row |
| Ingestion (form) | Typebot → Worker `fetch()` | Structured submission becomes a queue row |
| Extraction | **Gemini API** (`gemini-3.5-flash-lite`) | Turns a free-text email into one structured JSON event. **Email path only** — the form path never calls it |
| Images | Cloudinary (unsigned upload) | Poster hosting + transformation |
| Archive | A Gmail account | Receives every original message, forwarded by the Worker. **No script runs there** — it is a permanent record, nothing more |
| Review | `curador.html` on GitHub Pages | Curator edits any field, then Publica or Rebutja |
| Storage | `pendents.json` + `events.json` via GitHub contents API | Queue and published truth |
| Web app | Static HTML/CSS/JS on GitHub Pages | Reads `events.json`, filters, bilingual display |
| Digest | Worker `scheduled()` → Brevo | Weekly per-comarca email, one transactional message per subscriber |

**Extraction model.** The extraction model is **Google Gemini, not Claude.** The
project originally planned to use the Anthropic API, but that is a separate paid
product, which conflicts with the "no paid infra ever" rule; the decision was made to
switch to the Gemini free tier. The model name lives in **one constant**,
`GEMINI_MODEL`, currently **`gemini-3.5-flash-lite`** (never the Pro range — that is
paid). The key travels in the `x-goog-api-key` header. The call uses
`responseMimeType: 'application/json'`, `maxOutputTokens: 4096`, and
`thinkingConfig: { thinkingLevel: 'minimal' }` — with **no `temperature`** (ignored
by 3.x models) and **no `thinkingBudget`** (legacy, incompatible with
`thinkingLevel`). If you see an older note citing `gemini-2.5-flash`, `temperature:
0`, `maxOutputTokens: 2048` or `thinkingBudget: 0`, it is out of date. If the API
ever returns 404 on the model name, that is normal Google lifecycle: look up the
current Flash/Flash-Lite models and change the constant.

**The email path, in order.** Forward the original to the archive Gmail **first, and
whatever happens** — this is the one irreversible step, so it is protected by
ordering rather than by error handling. Then parse the MIME with vendored
`postal-mime`; then Gemini; then Cloudinary; then the row into `pendents.json`. Any
of the later steps may fail without losing the message. The single case where nothing
can be archived — a missing `ADRECA_ARXIU` — makes the Worker **reject** the mail
outright with a bilingual permanent-failure notice, so the sender learns it did not
arrive, and no row is written.

**The form path** has **no archive of last resort**: Typebot keeps nothing and the
Worker has nowhere to put it. A GitHub write failure there returns an explicit `500`
rather than a lying `200`, so the sender is told. This asymmetry matters when
chasing a lost submission: an email can be reprocessed from Gmail, a form submission
cannot and must be re-entered.

**GitHub reads and writes** always go through the **contents API**, never by fetching
from Pages (which serves stale CDN copies): a GET for content plus SHA, then a single
PUT with base64 and `JSON.stringify(dades, null, 2)`. On a SHA conflict (a concurrent
writer) the code re-reads and retries **once**.

**Cloudinary** uses an unsigned upload: preset `agenda-posters`, folder
`clm-agenda/posters`, incoming transformation `w_800,c_limit,q_80,f_webp`. Only the
cloud name is needed, no signature. The preset already turns a PDF into a WebP of its
first page, so a PDF is uploaded as-is. The email path takes the first image or PDF
attachment and ignores inline images; the Typebot path uploads the poster from the
submitter's browser and stores the returned URL verbatim.

**Brevo** sends **one transactional email per subscriber** — never a campaign — with
a bilingual unsubscribe line in every message. There are five lists, one per comarca,
whose numeric IDs live in Secrets. Replies go to `contacte@clm.cat`, deliberately
**not** `agenda@clm.cat`: the latter is read by this same Worker's `email()` handler,
so an unsubscribe reply would come back as a new row in the curator's queue.

**Deployment.** The Worker is deployed by **pasting a single file into the Cloudflare
dashboard**. The dashboard's Quick Edit view has no way to add a second module, so
the two-file source layout (`worker/worker.js` importing `worker/postal-mime.js`)
cannot be deployed from there. The paste artefact is therefore **generated**:
`worker/worker-concatenat.js`, which is `postal-mime.js` minus its `export default`
line, a marked banner, then `worker.js` minus its `import` line — 6,962 lines, no
`import` at all, one `export default` (the Worker entry point). **The source of truth
stays `worker/worker.js`**; a patch applied straight to the generated file is lost
the next time it is regenerated.

The Git Build ("Connect to Git") was **deliberately disconnected**, because having it
active at the same time as manual dashboard edits meant the two kept silently
overwriting each other. One consequence catches people out: `wrangler.jsonc` is now
read by nobody, so everything declared in it is decoration — the cron trigger and
`CLOUDINARY_CLOUD_NAME` must both be set **by hand in the dashboard**.

**Repository files** (named so you can refer to them precisely — you cannot open
them): the public frontend is `index.html` / `style.css` / `app.js`; the curator page
is `curador.html`; published data is `events.json` and the review queue is
`pendents.json`, both at the repository root; `events-exemple.json` plus `?prova=1`
is a sample-data preview mode and `prova-local.html` is a standalone offline mirror;
the Worker source is `worker/worker.js` with `worker/postal-mime.js` vendored beside
it, and `worker/worker-concatenat.js` generated from both; the extraction prompt
master is `prompts/extract-event.txt`; `importa-csv.js` was the one-off importer that
seeded `pendents.json` from the old spreadsheet; step guides and reports live under
`docs/`, including `docs/CRITERI-EDITORIAL.md` (what belongs in the agenda — a
curator's judgement, not code) and `docs/FONTS-I-FLUXOS-CATALUNYA-NORD.md` (which
external event sources are usable); self-hosted fonts under `fonts/`; the logo SVGs
under `img/logo/`. The project constitution is `CLAUDE.md`, the phase plan is
`FASES.md`, and the lessons file is `NOTES.md`.

---

## 4. The event schema — canonical and exact

Sixteen fields. The **exact names and order** are used identically in the extraction
prompt, `pendents.json`, `events.json`, and the frontend. Never propose renaming,
reordering, or adding a field without updating all four places together.

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
Mercat · Cinema · Taller · Activitat infantil · Patrimoni i tradicions ·
Concentració · Esports · Vida associativa

Rules the code relies on:

- **Every field is a string.** Unknown values are `""` — never `null`, never
  omitted. The extraction prompt enforces this; the frontend assumes it.
- `imatge_url`, `font_url`, `estat`, `data_entrada` are filled **by the system,
  never by the extraction model** — the prompt returns them empty on purpose.
- **Never trust the `id` the model returns.** Always rebuild it with
  `creaId(dataInici, titol)`. Coerce `comarca` and `categoria` to the allowed lists
  with `valorPermes(...)`, falling back to `""`.
- The Typebot form collects **one** `descripcio` plus an `idioma_descripcio` signal
  (`"ca"`/`"fr"`): the text goes to the matching side and the other stays empty. The
  curator completes the missing translation during review.

---

## 5. Build status — as of 29 August 2026

The phase plan lives in `FASES.md`. Each phase has a **gate**: the evidence that must
be demonstrated before moving on. "Deployed" and "gate passed" are **not** the same
thing, and the difference matters below.

**Phase 0 — Email Routing (owner's manual work): DONE.** MX records migrated to
Cloudflare, DKIM and SPF in place, addresses `agenda@`, `contacte@`, `tv@` created and
their destinations verified, each tested from an outside account.

**Phase 1 — `curador.html`: DONE and in production.** The page reads `pendents.json`,
shows each pending row with its poster beside its text, makes **every field editable
before approval**, and decides with **Publica** / **Rebutja**. The GitHub token is
never in the code: a password field at the top of the page holds it in a JavaScript
variable for the session only, and it dies when the tab closes — no storage, no
session, no login. Without a token pasted, the page is read-only and says so.
`pendents.json` currently holds **84 rows, all `pendent`**, seeded from the old
spreadsheet by the one-off `importa-csv.js`. **Do not propose building this page.**

**Phase 2 — the Worker's `email()` handler: DEPLOYED.** Parses the MIME, calls
Gemini, uploads the poster, writes the row, and forwards the original to the archive
Gmail before doing any of that.

**Phase 3a — the Worker's `fetch()` handler (Typebot): DEPLOYED 29 August 2026**, by
manual paste. A shared secret in the `X-Typebot-Secret` header is mandatory: without
it the Worker returns a bare `403`, and it also returns `403` to everyone if the
secret is not configured at all — a missing key closes the door rather than opening
it. Gates (1) and (3) passed before this deployment: a real Typebot submission
returned `200` with a valid `id` and the row appeared in `pendents.json`. Gate (2),
the `403` for a request with no secret, is **still to be reconfirmed** against the
new deployment.

**Phase 3b — the Worker's `scheduled()` handler (Brevo digest): DEPLOYED 29 August
2026**, by manual paste. **The gate has NOT been passed** — no test run has been made.
It could not usefully be made on 29 August, because `events.json` held no published
event inside the seven-day window (the nearest future event is 12 September), so a
test would have returned `enviats: 0` without exercising either the HTML or the Brevo
send path. **The test becomes possible from 5 September 2026.**

**Phase 4 — cut-over: the repository half is DONE (29 August 2026); the Google half
is not.** Done in the repo: the nine `.gs` files and the five obsolete build guides
were moved to `docs/arxiu-google/` with a README explaining what each one did and what
replaced it (the `apps-script/` folder no longer exists); `README.md` was rewritten
around the Worker; `agenda@clm.cat` is now named as one of the two submission routes
in the site footer and on `qui-som.html`; the Brevo subscribe URL was checked and was
**already the real one**, not a placeholder. **Still open, and only doable by hand
inside Google's editor:** disabling the Apps Script triggers (`processNewEmails`
hourly, `sendWeeklyDigest` on Tuesdays) and retiring the `doPost` Web App deployment.
Until those triggers are off, the old system keeps writing to the sheet and **sends a
second digest in parallel with the Worker**. Its gate is a full week of real running —
submissions by mail and by form, curation, publication and a digest — without touching
anything Google except the Gemini key and the archive Gmail.

**The honest "not done yet" list:**

- The **`403` smoke test** — done 29 August 2026: `403` with body
  `{"ok":false,"error":"no autoritzat"}`. Phase 3a's three gates have all passed.
- The **digest test run**, from 5 September. The smoke-test command is written out in
  `FASES.md` under Phase 3b, ready to run.
- **Disabling the Apps Script triggers** inside Google's editor.
- The **cron trigger** must be added by hand in the dashboard
  (`*/10 13,14 * * 2`), since `wrangler.jsonc` is not read under manual deployment.
- **`CLOUDINARY_CLOUD_NAME`** must likewise be set as a dashboard text variable, or
  poster uploads silently fail and rows arrive with no image.
- **Brevo domain authentication** for `clm.cat`. The SPF record must be **edited, not
  duplicated** — a domain may have only one, and two break both:
  `v=spf1 include:_spf.mx.cloudflare.net include:spf.brevo.com ~all`.
- The **Brevo subscribe form URL** is still a placeholder in the site's hero button.
- **External source ingestion** is researched but not built: a probe on 29 August
  confirmed the Tourinsoft/ADT66 feed is usable by plain code with no model; closed
  the WordPress REST route as negative (14 of 19 municipal sites are live WordPress,
  none declares an event content type); left the `.htm` CMS route inconclusive; and
  found IntraMuros needs an API key, requested by email. None of this is scheduled
  work yet.

---

## 6. What is dead — do not propose it again

The project ran on a **Google Apps Script + Google Sheet** design until August 2026.
That architecture is gone. If an older brief, note or memory describes any of the
following, it is obsolete:

- **Google Sheets as the review surface.** There is no sheet in the live flow. The
  curator works in `curador.html` against `pendents.json`.
- **Apps Script** of any kind — `setupSheet.gs`, `processNewEmails()`,
  `processBotSubmission()`, `publishToGitHub()`, `sendWeeklyDigest()`, time-driven
  triggers, the **"Publier" menu button**, Script Properties as a secret store, and
  the `DIGEST_DARRER_ENVIAMENT` script property that tracked the last digest.
- **A Google Workspace account as a blocker.** The old design needed the Gmail
  inbox, the script owner and the sheet owner to be one Workspace account. Nothing in
  the current design depends on that. Gmail is now only a dumb archive.
- **`gemini-2.5-flash`, `temperature: 0`, `maxOutputTokens: 2048`,
  `thinkingBudget: 0`.** All four are superseded — see §3.
- **First-time-sender confirmation via Gmail labels** (`agenda-espera`,
  `agenda-entrant`, `SENDERS_CONFIRMED` / `SENDERS_PENDING`). That design died with
  Apps Script. The feature is deferred, and if it is ever built the agreed shape is a
  `remitents.json` list managed by the Worker.
- **"Git must not be run against the project folder."** That was an old Cowork
  limitation. Claude Code runs Git in the repository normally.
- **Building `curador.html`.** It exists, it is in production, and it holds a live
  84-row queue.

---

## 7. Coding philosophy

- **One function = one job.** No giant do-everything function.
- **Explicit over implicit.** `if (estat === 'publicat')`, never `if (fila[14])`.
  Map fields by name, one at a time — no index magic, no dynamic loop mapping.
- **Name everything clearly, in Catalan** for domain terms
  (`carregaEsdeveniments`, `esdevenimentsFiltrats`, `creaTargeta`, `analitzaCorreu`,
  `construeixFila`, `pintaTot`). Only accepted abbreviations: `url`, `id`, `ca`, `fr`.
- **No clever tricks** — no deeply nested ternaries, no destructuring in function
  args, no chained one-liners in logic-critical code.
- **`async/await` with explicit `try/catch`**, explicit error handling on every API
  call; never log a key. The frontend shows a bilingual fallback message on failure.
- **A one-line comment on every function**, a banner comment block at the top of each
  file, dashed section separators.
- **When two writes cannot be atomic, order them so a mid-way failure duplicates,
  never deletes.** Publishing writes `events.json` *before* removing the row from
  `pendents.json`, precisely so a failure between them leaves a visible duplicate in
  the queue rather than a silently lost event.
- **What cannot be undone goes first.** The archive forward happens before any
  parsing, because a `finally` block is for cleanup, not for guarantees.

Self-test for any code: *could a non-professional developer open this in six months
and fix a bug without asking anyone?* If not, simplify.

---

## 8. Linguistic protocol — bilingual, Catalan first

- **Catalan is always primary; French sits immediately below, smaller and lighter**
  (rendered in Georgia italic, muted colour). Applies to nav, filters, labels,
  buttons, and empty/loading/error states — everything user-facing. The sole
  exception is `curador.html`, which is Catalan-only.
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

## 9. Design language — black-and-white, two themes

The look is **black-and-white-dominant: the event posters carry the colour, and the
senyera palette (red/gold) appears only as a restrained accent.** This replaced an
earlier cream "sang i or" approach and a rejected bordeaux-background experiment.
**This design is live in the canonical files and is finished — don't redesign it.**

**Two themes, `clar` (light) and `fosc` (dark)**, switched by a header toggle. A small
script applies the saved theme *before paint* (reading a stored preference, else the
OS `prefers-color-scheme`) so there is no flash. Brand colours are invariable; only
the light/dark environment changes.

- **Clar:** white ground and cards; near-black ink; muted grey; hairline borders.
- **Fosc:** near-black ground; dark cards; off-white ink; muted grey; dark borders.
- **Senyera accent (red `#b5121b`, gold `#fcdd09`)** appears in **only three places:**
  the date/time text (red in light, gold in dark), a small gold dot on each day
  header, and a soft-gold tile behind a missing-poster icon. Everything else is
  monochrome.

**Typography (self-hosted, no runtime CDN). The two languages never share a font —
font contrast encodes the Catalan-first hierarchy:** Catalan uses **Fraunces**
(titles, wordmark, day headers) and **Montserrat** (Catalan body and all UI); all
French secondary text uses **Georgia italic**, muted.

**Layout:** mobile-first, single column, ~760px max width, one responsive step,
sticky filter bar. The agenda is a **chronological list grouped by day** (not a grid
and not by month), each day introduced by a bilingual header with a gold dot. Each
event is a card with a **square poster on the left**, slightly tilted (alternating by
row, straightening on hover, disabled for reduced-motion), with a **black angular
category banner** at its top-left. When an event has no poster, the card shows a
**per-category icon** on a soft-gold tile (each of the 13 categories has its own icon,
plus a calendar default). The card body has the title (which links out only if a
source URL exists), a muted uppercase comarca label (plain text, not a clickable
pill), a meta line (time and any multi-day "Fins al…" carry the colour accent, with a
pin icon before the venue), and a **"Veure més · Voir plus"** expander revealing the
descriptions and organiser.

**Filters:** comarca chip buttons (Totes + the 5), a bilingual category dropdown, and
a **date interval** (two native `<input type="date">` fields, "Del · Du / al · au",
with an "Esborra · Effacer" button; overlap semantics, empty field = no limit — a
decision revised on 2026-07-15 that replaced an earlier "no date-range picker" rule,
and it is shipped and live). All filters combine, in a sticky bar. Past events are
auto-hidden; events with no valid start date are not shown; multi-day events show
"Fins al … · Jusqu'au …".

**The digest email has its own, separate rendering.** It reuses the same colours, day
grouping, gold dot and bilingual pattern, but it is built from tables with inline
styles and **no external fonts or images**, so it survives every mail client — which
is why Fraunces and Montserrat do not appear there, and Georgia/Arial do.

**Header, hero and footer:** a clean ink header carries the **"Què fas?" logo** (two
SVGs, one per theme) plus a French subtitle and the theme toggle. A **hero** invites
the public to subscribe (button → the Brevo form, URL still a placeholder). The
**footer** invites organisers to submit an event (button → the live Typebot form).

**Decisions kept so they aren't re-litigated:** per-event pages / click-to-modal /
outbound per-event share URLs were rejected in favour of expand-in-place (if a
single-event deep link is ever needed, the agreed path is a same-page `?event=id`
view, not generated files); the bordeaux background was rejected because a wall of
red+gold reads as a political banner and kills the accents' contrast; month-grouping
became day-grouping; the gold category chip became the black banner; the mini-senyera
placeholder became per-category icons; the comarca pill became a plain label; the red
senyera header band became the clean ink header.

**Brand-family note:** the Agenda's restrained senyera-red / gold / ink-on-B&W palette
is **specific to "Què fas?"** and is not to be replicated across the wider brand
family (CLM, TVallespir, Mar i Muntanya).

---

## 10. Established mechanisms worth knowing when planning

- **The digest's timing problem, and its solution.** Cloudflare cron is always UTC and
  knows nothing about summer time, but the digest must go out at **15:00 Paris all
  year** — 13:00 UTC in summer, 14:00 UTC in winter, which no cron expression can
  say. The fix splits the decision: **one** trigger, `*/10 13,14 * * 2`, wakes the
  Worker twelve times each Tuesday, and the code checks what time it actually is in
  Paris (`Intl.DateTimeFormat` with `timeZone: 'Europe/Paris'`), so the six wake-ups
  in the wrong hour go straight back to sleep. It must stay a single expression: the
  free plan allows five cron triggers **per account**, not per Worker.
- **The digest's idempotency guard is Brevo's own send log** — there is no third file
  and no database. Every digest mail is tagged `digest-YYYY-MM-DD-comarca`, and before
  sending anything the Worker reads today's sends and builds a set of
  "tag + address" pairs. This is better than the flag it replaced, not merely
  cheaper: the guard is **per person** rather than per day, so a run that dies
  half-way resumes without repeating anyone. That is what makes the whole digest
  possible under the free plan's **50 subrequests per invocation**: each wake-up
  sends at most 40 mails and the next one continues where it stopped. If the log
  **cannot** be read, nothing is sent — one missing digest beats two digests to
  everyone.
- **The deployment trap, in both directions.** With the Git Build connected,
  `wrangler deploy` wiped any plain-text variable set in the dashboard, so
  configuration had to live in `wrangler.jsonc`. With the Git Build **disconnected**
  (the current state), `wrangler.jsonc` is read by nobody, so configuration must live
  **in the dashboard**. The invariant: configuration belongs wherever the deployment
  route you actually use will read it — and when the route changes, the configuration
  must move with it. Secrets are unaffected either way; only an explicit
  `wrangler secret delete` removes them. Note also that **a secret changed in the
  dashboard is not live until the Worker is deployed again.**
- **Never run two deployment routes at once.** Having the Git Build and manual
  dashboard edits both active meant each silently overwrote the other, and produced a
  `Handler does not export a fetch() function` error that looked like a code bug and
  was not. Either disconnect the Git Build or stop touching the dashboard — never
  both.
- **Preview modes.** Adding `?prova=1` to the site URL loads fictional sample data
  instead of the real data. `prova-local.html` is a fully standalone offline copy
  (embedded data, no network) for inspecting the design by double-clicking. Opening
  the real `index.html` from disk shows an empty state because `file://` blocks the
  fetch — expected, not a bug.
- **The extraction prompt is a master file copied verbatim into the Worker.** If the
  prompt changes, both copies change together. `{{AVUI}}` is replaced with today's
  date and exists only so the model can infer a missing year. The prompt demands JSON
  only — no preamble, no markdown fences — with all 16 keys always present as strings,
  and the response is parsed defensively from the first `{` to the last `}`.
- **`postal-mime` does not convert HTML to plain text.** In an HTML-only email
  `email.text` comes back `undefined`, not empty and not converted — and many
  association emails are HTML-only. The Worker therefore carries its own deliberately
  crude `textDeHtml()`. Relatedly, the "empty email" check must look at the content,
  not at the assembled string, or a wholly empty message slips through and spends a
  Gemini call.
- **A digest test door exists.** A `POST` to the Worker with `?digest=prova` and the
  same shared secret builds the real digest from `events.json` but sends it **only to
  the archive address**, with a test tag that neither reads nor writes the real
  idempotency guard. It needs `ADRECA_ARXIU`, `BREVO_API_KEY` and `GITHUB_TOKEN` — but
  none of the five list IDs, since it opens no list.

---

## 11. Environment notes

- The owner works on **Windows 11**, in **Claude Code** with the repository at
  `C:\Users\samsu\Claude\Projects\Quefas2`. Git, Node and shell commands run
  normally against the project folder.
- The repository is **public**. Nothing secret may ever be committed — that includes
  the archive Gmail address, which is a Secret because it is a personal address, not
  because it is a password.
- The Worker is named **`agenda-catalogne-nord`** in the Cloudflare dashboard, and
  logs are retained for **three days** (`observability` enabled). If a log says a
  variable is missing, check whether that version was actually deployed before
  looking for anything else.
- `curador.html` and `pendents.json` are **public**, because GitHub Pages is. This is
  accepted: pending events are public events, and seeing one early is harmless.
  *Writing*, by contrast, requires the token.

---

## 12. How to help in Chat (summary)

- You are the **planning and drafting partner.** Reason about architecture, write
  prompt text, draft copy, sketch code, weigh trade-offs against §2 constraints and
  §9 design decisions — but remember the files are edited in Claude Code, not here.
- **Check §5 and §6 before proposing work.** The most common failure mode is
  proposing something already built, or something belonging to the dead Apps Script
  architecture.
- **Guard the constraints.** If an idea would add a dependency, a framework, an
  account system, a second database, a third state file, a paid service, or break
  Catalan-first display, say so and propose the simplest in-spirit alternative.
- **Don't invent specifics you can't see.** If a decision depends on the exact
  current contents of a file, say it should be verified in Claude Code rather than
  asserting it.
- **Keep it simple.** Simplicity beats everything here; the whole project must stay
  repairable by one non-expert owner.
