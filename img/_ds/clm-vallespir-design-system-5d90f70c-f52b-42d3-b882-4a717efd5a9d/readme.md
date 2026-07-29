# CLM Vallespir — Design System

A brand and UI system for **CLM (Cultures, Llengües i Memòries del Vallespir)** and the three projects it runs in the Pyrenean territory of North Catalonia. CLM seeks to preserve, value and develop the Tec valley as a cross-border mountain territory — rich in cultural, historical, linguistic and natural heritage.

This system holds the shared brand DNA, the locked palette and type, the three-member logo family, reusable React components, and high-fidelity recreations of the products.

---

## The organisation & its products

**CLM** is an association (founded October 2025, seat in Prats de Molló, Pyrénées-Orientales) working the Tec valley as a *transfrontier* territory. It works across four axes: the Catalan language as everyday and digital vehicle; the living heritage of the back-country; artistic creation and craft; and editorial/audiovisual production as research and memory. Three projects sit under it:

| Project | What it is | Source |
|---|---|---|
| **TVallespir** | CLM's audiovisual channel — short-form, vertical, bilingual (CA/FR subtitled) reportage for Reels & Stories. The **anchor** brand. | uploaded logos + on-air screenshot |
| **Mar i Muntanya, a Taula!** | A cross-border campaign + website federating four autumn gastronomy events on both sides of the Pyrenees (CLM initiates, Som Turisme partners). | `github.com/CLMVallespir/MM` (private) |
| **Agenda Catalunya Nord** | A bilingual, automated cultural-events agenda for the five comarques of North Catalonia. | `github.com/CLMVallespir/agenda-catalogne-nord` |

### Sources used to build this system
- **GitHub — `CLMVallespir/MM`** (private): the production design system. `src/styles/style.css` (locked tokens), `src/data/i18n.ts` (bilingual copy), `src/data/events.ts` + `categories.ts`, `legacy-static/index.html` (full markup), `CMS_SPEC.md` (editorial rules). The Liana logotype font (`public/fonts/liana-logo.woff2`), favicon mark and EsCaT terrain map were imported from here.
- **GitHub — `CLMVallespir/agenda-catalogne-nord`**: README (principles), `prompts/extract-event.txt` (the five comarques + ten categories), data pipeline. The frontend was a stub, so the Agenda UI kit is *designed* here in the brand register.
- **Uploaded** — the TVallespir wordmark logos (black/white), an on-air screenshot, and the original Mar i Muntanya lockup.

> Explore the two repositories directly for deeper fidelity — they hold the canonical copy, editorial guardrails (`CMS_SPEC.md`) and data models behind these designs.

---

## The logo family

Three marks for three projects. They are **not** variations of one another — they share the territory and the Fraunces/Liana wordmark voice, and the design system accepts that they are not yet visually coherent.

- **TVallespir** *(anchor — original artwork, unchanged)* — the existing mark: a dark disc with a realistic mountain silhouette biting up from below and three tapered broadcast streaks across the upper-left, with the "TVallespir" serif wordmark. Used exactly as supplied (embedded from the uploaded files); **do not redraw.**
- **Mar i Muntanya** *(original geometric mark)* — the sharp **M** mountain above its inverted **M/W** sea reflection, in an ink disc: stone mountain (`#EFEAE1`), Tramontane sea (`#3A5168`). Lockup adds "Mar i Muntanya," in Fraunces + "a Taula!" in the Liana script. Used as supplied; **not** redrawn.
- **Agenda Catalunya Nord** *(purpose-built — the one new mark)* — a lighter, more open member: a fine ring holding an organic ridge with a **rising wine sun**. Welcoming and cultural, not institutional.

> An earlier pass redrew TVallespir and Mar i Muntanya into a single "organic" family; that was reverted at the client's direction. The originals stand. Coherence across the family is an open future question, not something to force now.

Assets in `assets/logos/`: TVallespir as PNG (mark + lockup, black/white) embedded via `components/brand/tvAssets.js`; Mar i Muntanya + Agenda as SVG (dark + white). The `Logo` component renders all three.

---

## CONTENT FUNDAMENTALS

How CLM writes. The voice is **cultural, rooted and quietly confident** — a curator's voice, never a marketer's.

- **Bilingual, Catalan first, French underneath.** This is non-negotiable across every surface. Catalan is the primary voice; French is the faithful secondary, set smaller / italic / muted — present, never dominant. (`Mar i Muntanya, a Taula!` ↔ `Mar i Muntanya, a Taula !` — note the French space before `!`.)
- **Territory as subject.** Copy names places and people: *Vallespir, Rosselló, Alt Empordà, Sant Llorenç de Cerdans, Mariners Cebrianencs.* Specific over generic, always.
- **Sensory, literary register, present tense.** "*la muntanya dona les seves millors collites i el mar, la seva quietud*" ("the mountain gives its finest harvests and the sea, its quiet"). Em-dashes and measured cadence; metaphors drawn from land, table and frontier.
- **No exclamatory ad-speak.** The extraction prompt is explicit: descriptions are "*informatiu i acollidor, sense exclamacions publicitàries*" — informative and welcoming, no promotional exclamation. The one sanctioned exclamation is the brand signature "*a Taula!*".
- **Third person / collective, not "you".** It speaks *of* the territory and *as* a "we" (CLM), rather than addressing "you". Institutional copy stays precise and humble: "*Una iniciativa de CLM, amb Som Turisme*" — initiator and partner, never symmetric.
- **Casing.** Sentence case for prose and titles; UPPERCASE only for UI eyebrows/labels/nav (tracked). Catalan typographic conventions (l·l, accents, apostrophes) are respected.
- **No emoji.** Anywhere. Directional arrows (`↑ ↓ →`) and middots (`·`) are the only "ornaments".
- **Editorial equality.** The four MM events are described with equal weight and a fixed order — language never ranks them.

Voice check — write it the way CLM would: *"Cròniques de taula i de frontera."* / *"Chroniques de table et de frontière."*

---

## VISUAL FOUNDATIONS

**Overall vibe:** warm, editorial, territorial. Paper-coloured grounds, near-black ink, a cool slate-blue structural accent named after the *Tramontana* wind, and earth-toned event hues. Magazine-like, generous whitespace, hairline rules — closer to a printed cultural review than a SaaS site.

- **Color.** Locked palette (no invented swatches, no `--ochre`). Warm **stone** grounds (`#F2EDE0`), **ink** near-black (`#1A1F24`, never pure `#000`), **Tramontane** slate-blue accent (`#3A5168`) for structure/links/focus, and four territorial hues: wine `#7A2C38` (festa/vinya — the one *warm* accent), sea `#3A5168` (mar), forest `#4A5C42` (bosc). Category color is always token-driven, never hard-coded.
- **Type.** **Fraunces** is the serif voice — wordmarks → display → running text (medium weight, natural width, slight negative tracking on large display). **Space Grotesk** is the quiet UI sans for eyebrows, nav, labels and meta (uppercase, `.08–.16em` tracking, light/medium weights). **Liana** is the brand script, used *only* for "a Taula!". *(The MM production build shipped Noto Serif Display; this family standardises on Fraunces per the logo brief — a deliberate change, flag if reverting.)*
- **Backgrounds.** Flat color fields, not gradients — `stone` for light sections, `ink`/`ink-territory` (`#1E2E3A`)/`ink-deep` (`#16222B`) for dark ones. The one decorative motif is the **organic Pyrenean ridge** (line / silhouette), appearing as a hero scene, a "frontier strip" between Nord and Sud, section dividers, and duotone photo placeholders. Imagery is warm and naturalistic (autumn mountain light); until real photos arrive, the `Scene` placeholder draws a tinted ridge.
- **Layout.** Centered measure (`--max: 1080px`), `--gutter` clamps `1.5–3rem`. Editorial grids: the MM events are a fixed 2×2 with a 2px seam and a full-width frontier strip; the blog is three columns that **drift** at different speeds on scroll. Sticky top nav.
- **Cards.** Two registers. *Event cards* are **editorial**: sharp corners (radius 0), a flat tinted ground, a 4px territorial **border-left**, and a photo with the place + name overlaid on a darkening gradient. *Blog/photo cards* round only the **photo** (12–14px) and otherwise stay flat. No card has a full border or heavy box.
- **Borders & shadows.** Hairlines do most of the work: `rgba(37,38,40,.08)` on stone, `rgba(239,234,225,.08)` on ink. Shadows are rare — a soft lift on raised cards, and a **halo** glow (`0 0 44px 12px rgba(8,12,16,.5)`) around imagery on dark fields. No inner shadows, no drop-shadow stacks.
- **Corner radii.** `0` (event cards), `8px` (small), `12px` (photos), `14px` (feature imagery), `999px` (pills/tags/switches/avatars). Sharp where structural, round only on imagery and capsules.
- **Hover / press.** Restrained. Links fade to ~`.62–.66` opacity or reveal an underline; photo cards **lift** `-7px`; event cards **deepen their tint** and zoom the photo `1.06`; the section ridge drifts. No bounces, no scale-up on press.
- **Motion.** Gentle and brief. Entrance: fade-up `translateY(24px)` revealed on scroll; hero layers do a slow ambient `drift`. Easing `cubic-bezier(.25,.6,.3,1)`, durations `.2 / .35 / .6s`. **Every animation lives behind `prefers-reduced-motion`** and content is never hidden without JS.
- **Transparency / blur.** Used sparingly — gradient scrims over caption photos and the progressive stone→photo opacity mask; no glassmorphism / backdrop-blur.

---

## ICONOGRAPHY

CLM is **near-iconless by design** — the system leans on type, the ridge motif and the marks rather than a UI icon set.

- **No icon font, no icon library** in either codebase. The few glyphs present are hand-tuned inline SVG: the brand marks, the hero/territory ridge scenes, the double-chevron scroll hint, and the frontier ridge. These are *brand illustration*, not a reusable icon system.
- **Unicode carries the small stuff.** Directional arrows `↑ ↓ →` (Nord/Sud + "more" links), the middot `·` as the universal separator, and the en-dash `–` in date ranges. Treat these as the icon vocabulary.
- **No emoji, ever.**
- **If you need UI icons** (rare — e.g. a filter or close control), use a thin, single-weight **line** set that matches the editorial restraint — **Lucide** (CDN, `~1.5px` stroke) is the closest match. Keep them ink/Tramontane, never filled, never multicolor. **Flag any such addition** — it's outside what the brand currently uses.
- **Real assets** live in `assets/`: the three marks (`logos/`, dark + white SVG), the original MM favicon and Liana font (`logos/`), the uploaded TVallespir wordmarks (`logos/`), the original MM lockup (`brand/`), and the **EsCaT terrain map** (`imagery/`). Copy these out rather than redrawing.

---

## Index — what's in this folder

**Foundations**
- `styles.css` — global entry point (consumers link this one file; `@import` manifest only).
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `fonts.css` (Fraunces + Space Grotesk via Google Fonts; Liana `@font-face`).
- `guidelines/` — specimen cards for the Design System tab: Colors (grounds, accents, text), Type (display, body, UI, logotype), Spacing (scale, radii & shadows), Brand (the mark family, imagery & territory).

**Components** (`components/`, namespace exported by the compiler)
- `brand/Logo` — the three-member mark family (mark / lockup, dark / light).
- `core/Button`, `core/Eyebrow`, `core/CategoryBadge`.
- `cards/EventCard`, `cards/PostCard`, `cards/Scene` (photo placeholder).

**UI kits** (`ui_kits/`)
- `mar-i-muntanya/` — full bilingual website recreation (CA/FR toggle).
- `agenda-catalunya-nord/` — faithful recreation of the production frontend (provided locally): the "sang i or" senyera palette (red + gold), light/dark theme toggle, Fraunces + Montserrat, tilted poster cards, comarca + category filters. Its own identity, distinct from MM.

**Assets** (`assets/`) — `logos/`, `brand/`, `imagery/`.

**Also** — `SKILL.md` (Agent-Skills wrapper for use in Claude Code).

---

## Using it
Link `styles.css` for tokens and fonts. Mount components from the compiled bundle (`_ds_bundle.js`) under the design-system namespace, e.g. `const { Logo, EventCard } = window.<Namespace>`. Reach for `EventCard`/`PostCard`/`Logo` before re-implementing anything; drive color from the territorial tokens; keep copy bilingual, Catalan first.
