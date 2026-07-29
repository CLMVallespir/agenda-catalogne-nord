# Agenda Catalunya Nord — Project Instructions

This project builds and maintains an automated, almost-zero-cost **cultural agenda for North Catalonia (Catalunya Nord)** — the five comarques Rosselló, Conflent, Vallespir, Capcir and Cerdanya. Cultural associations send events by email or via a Typebot form; a Google Apps Script sends each to the Gemini API (`gemini-2.5-flash`, Google AI Studio) for structured extraction and writes one row per event to a Google Sheet; a single curator reviews the sheet ~10 min/week and marks each row `publicat` or `rebutjat`; a menu item ("Agenda → Publica els esdeveniments aprovats") pushes published rows to `events.json` in GitHub; a static GitHub Pages site reads that file and shows the agenda with comarca + category filtering and bilingual Catalan/French display; a weekly per-comarca digest goes out via Brevo.

When working in this project, always follow these rules.

**Simplicity beats everything.** This is a one-person volunteer project that must stay repairable by a non-developer months later. Prefer longer, obvious code over clever code. One function = one job; explicit over implicit (`if (estat === 'publicat')`, never `if (row[14])`); a one-line comment on every function; clear Catalan domain names (`carregaEsdeveniments`, `creaTargeta`). A good self-test: could the owner reopen this file in six months and fix a bug without help?

**No dependencies, free tiers only.** No frameworks, build tools, npm, or external JS/CSS libraries. Vanilla JS on the frontend; Apps Script built-ins plus a single `fetch` to the Gemini API on the backend. Infrastructure is Google, GitHub Pages, Cloudinary, Brevo and the Gemini API (Google AI Studio) — all free tiers, no paid infra, no second database (Google Sheets is only the curator's review surface; GitHub `events.json` is the published source of truth). Images live on Cloudinary, never in Git.

**Respect the data contract.** Sixteen string fields with exact names and order, identical across the extraction prompt, the Sheet columns, `events.json` and the frontend. Every field is a string; unknown values are `""`, never `null` and never omitted. Never rename, reorder or add a field without updating all four places together.

**Catalan-first and bilingual, everywhere user-facing.** Catalan is primary; French sits immediately below, smaller and in Georgia italic. Use curly apostrophes and correct contractions (`l'agenda`, `d'agost`, `Fins al…`). Tone is open, cultural and welcoming — never activist or political.

**Honour the design language.** Black-and-white-dominant chrome in both a light and a dark theme; the event posters carry the colour; the senyera palette ("sang i or" — red `#b5121b` + gold `#fcdd09`) appears only as a small accent (the date/time, the day-dot, the icon tile). Fonts: Fraunces (Catalan titles) + Montserrat (Catalan body/UI) + Georgia italic (French), self-hosted. The two languages never share a font.

**Confirm before scope creep.** Out of scope unless explicitly agreed: user accounts/login, an association self-submission portal, in-app event editing, comments/social features, analytics/tracking, any non-Sheets database, any server runtime, any CSS or JS framework. If a request would break a constraint above, surface the tension and propose the simplest in-spirit alternative rather than silently breaking the pattern.

Before writing or changing anything, read the **Project Knowledge** document ("Agenda Catalunya Nord — Project Knowledge") for the full architecture, the exact schema, the current build status, and the design decisions made so far (including the recent move to a black-and-white design).
