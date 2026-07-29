# Agenda Catalunya Nord — Technical Knowledge Base

**Purpose of this document.** A reference for every technology, language, tool, service, methodology, and design decision used to build the Agenda Catalunya Nord project. It is structured for three uses: (1) a human learning roadmap, layer by layer; (2) ingestion into NotebookLM for contextual Q&A; (3) generation of audio overviews and podcasts. Each section names the technology, explains exactly what role it plays in this project, identifies what you need to understand to work on that layer, and points to the best books and resources to learn more.

*Last updated: June 2026.*

---

## How to read this document

The project is a pipeline with seven distinct layers. You do not need to understand all of them at the same time. The layers are ordered from "where information enters the system" to "where the public sees the result":

1. **Ingestion** — Gmail and Typebot collect raw event descriptions from cultural associations.
2. **AI extraction** — Gemini (a large language model) turns free-text emails into structured data.
3. **Human review** — Google Sheets presents that data to a curator who approves or rejects each event.
4. **Image hosting** — Cloudinary stores and serves the poster images.
5. **Publishing** — A script reads the approved rows and writes them to a file on GitHub via the GitHub API.
6. **Web hosting** — GitHub Pages serves a static website.
7. **Email digest** — Brevo sends a weekly summary to subscribers.

The backend automation (layers 1–5 and 7) is written in **Google Apps Script**, a JavaScript dialect. The frontend (layer 6) is plain **HTML, CSS, and JavaScript**. There are no servers, no databases, no build tools, and no frameworks.

---

## Layer 1 — Ingestion: Gmail and Typebot

### 1.1 Gmail (Google Workspace)

**What it is.** Gmail is the email product inside Google Workspace, Google's paid suite of productivity tools. The project uses a Workspace account (on a custom domain) as the inbox where cultural associations send event announcements by email.

**What it does in this project.** Association volunteers write an email describing an upcoming event — in French, Catalan, or a mix — and send it to the project's inbox. Gmail applies a label (`agenda-entrant`) that the Apps Script uses to identify unprocessed messages. After processing, the label is changed to `agenda-traitat` so the same email is never processed twice.

**What you need to understand.**
- The difference between a personal Gmail account and a Google Workspace account. The project uses Workspace because it ties the inbox, the Apps Script, and the Google Sheet to a single professional identity, which matters for permissions and ownership.
- Gmail labels: think of them as tags, not folders. A message can carry multiple labels simultaneously.
- Why the Gmail inbox, the Apps Script, and the Sheet must all belong to the same account: Google Apps Script authorisation is tied to the account that owns the script. If the script and the inbox are in different accounts, the script cannot read emails without a complex OAuth dance. Keeping everything in one Workspace account eliminates that friction.

**Learning resources.**
- *Google Workspace: The Missing Manual* — Matthew MacDonald (O'Reilly). Broad practical introduction.
- Google's own Workspace Learning Centre: https://workspace.google.com/learning-center/
- Gmail API documentation (useful background even though this project uses Apps Script, not the REST API): https://developers.google.com/gmail/api/guides

---

### 1.2 Typebot

**What it is.** Typebot is an open-source, free-tier form and chatbot builder. It lets you create conversational forms that can be embedded in a webpage or shared as a standalone link.

**What it does in this project.** For associations that prefer a guided form over writing a raw email, Typebot provides a structured data-entry experience. The user fills in fields step by step (title, date, venue, etc.), and when they submit, Typebot sends a webhook (an HTTP POST request) with the collected data to a URL handled by the Apps Script.

**What you need to understand.**
- What a webhook is: a way for one web service to notify another by sending an HTTP POST request to a URL when something happens. The Apps Script exposes a `doPost(e)` function that receives these requests.
- The difference between a form (user fills fields) and a webhook (machine sends data). Typebot bridges them: the human fills the form, Typebot fires the webhook.
- Typebot runs on its free cloud tier. No self-hosting is required for this project.

**Learning resources.**
- Typebot documentation: https://docs.typebot.io
- "What is a webhook?" — Zapier explainer: https://zapier.com/blog/what-are-webhooks/
- MDN Web Docs — HTTP (background on requests and responses): https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview

---

## Layer 2 — AI Extraction: Gemini API and the Extraction Prompt

### 2.1 Google Apps Script

**What it is.** Google Apps Script (GAS) is a JavaScript-based scripting environment hosted entirely by Google. It runs in the cloud on Google's servers — you write code in a browser-based editor, and Google executes it. It has built-in bindings to Gmail, Sheets, Drive, Calendar, and other Google products, plus the ability to make HTTP requests to external APIs.

**What it does in this project.** Apps Script is the backbone of all backend automation:
- `processNewEmails()` — reads unprocessed emails from Gmail, sends each body to the Gemini API, and writes the result as a new row in the Sheet.
- `processBotSubmission()` — receives Typebot webhook submissions and does the same.
- `publishToGitHub()` — reads all approved rows from the Sheet and writes them as `events.json` to GitHub via the GitHub API.
- `sendWeeklyDigest()` — calls the Brevo API to send the weekly email digest.
- `setupSheet()` — a one-time setup script that creates the spreadsheet structure.

**Apps Script execution model.** Scripts can be triggered in three ways: manually (from the editor or a custom menu in the Sheet), on a time-based schedule, or by a web request (`doPost`). This project uses all three.

**What you need to understand.**
- Apps Script is JavaScript, but an older dialect (ES5/ES2015, no ES modules, no `import`). It runs synchronously unless you use its built-in async service (`UrlFetchApp.fetchAll`).
- `UrlFetchApp` is the built-in service for making HTTP requests. It is used to call the Gemini API, the Cloudinary API, the GitHub API, and the Brevo API — all four external services.
- `PropertiesService.getScriptProperties()` is how secrets (API keys, tokens) are stored. They are set once in the editor's "Script properties" panel and never appear in code.
- `LockService` prevents two simultaneous runs of the same function. The `processNewEmails()` function acquires a lock at the start; if it can't (because a previous run hasn't finished), it exits cleanly. This matters for time-triggered scripts that could overlap.
- `SpreadsheetApp` and its methods (`getSheetByName`, `getRange`, `getValues`, `appendRow`) are the interface to Google Sheets.
- The `doPost(e)` function signature is the entry point for webhook requests. `e.postData.contents` gives you the raw request body.

**Learning resources.**
- *Google Apps Script: Web Application Development Essentials* — James Ferreira (Packt). Good practical coverage.
- Official Apps Script documentation (comprehensive, example-rich): https://developers.google.com/apps-script
- Apps Script reference for SpreadsheetApp: https://developers.google.com/apps-script/reference/spreadsheet
- Apps Script reference for UrlFetchApp: https://developers.google.com/apps-script/reference/url-fetch

---

### 2.2 The Gemini API (Google AI Studio)

**What it is.** The Gemini API is a REST API provided by Google (via Google AI Studio) that lets you send text (a "prompt") to a large language model (Gemini) and receive a text response. It is used here with the model `gemini-2.5-flash`, on the free tier.

**What it does in this project.** The Apps Script sends a POST request to `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` with the extraction prompt plus the raw email body. Gemini reads the email, identifies the event details, and returns a single JSON object with exactly 16 fields — no prose, no explanation. This turns an unstructured human-written text into a structured database row in a couple of seconds.

**What you need to understand.**
- **Large Language Models (LLMs).** Gemini is a neural network trained on text. It doesn't execute rules — it predicts the most likely completion of the prompt. This makes it powerful for understanding natural language but also means it can occasionally produce wrong output. The verification loop (human curator review in the Sheet) exists precisely to catch LLM errors.
- **The prompt is a contract.** The extraction prompt (`prompts/extract-event.txt`) is written as a precise instruction set. Every rule in it was added to fix a class of failure: "respond only with JSON" (because LLMs sometimes add prose), "never use null" (because the frontend assumes all fields are strings), "if uncertain, use empty string" (because a wrong value is worse than an empty one). Understanding the prompt means understanding why each rule exists.
- **JSON mode, temperature and `maxOutputTokens`.** The call sets `responseMimeType: 'application/json'` (JSON mode), `temperature: 0` (deterministic), and `maxOutputTokens: 2048`. It also sets `thinkingConfig: { thinkingBudget: 0 }` — `gemini-2.5-flash` "thinks" by default and those thinking tokens count against `maxOutputTokens`, which could cut off the JSON before it closes; this is a plain extraction task, so thinking is turned off. Even so, the code parses the answer defensively (`analitzaJsonResposta` takes the substring from the first `{` to the last `}`) and throws on a truncated or empty/blocked answer, routing that email to the `agenda-error` label instead of writing a broken row.
- **API authentication.** Every request includes the header `x-goog-api-key: YOUR_KEY`. The key (`GEMINI_API_KEY`) is stored in Apps Script Script Properties, never in code.
- **Cost.** The Google AI Studio free tier covers the volume expected here (a few dozen emails per week) for the foreseeable future.

**Learning resources.**
- *Understanding Deep Learning* — Simon Prince (MIT Press, freely available online): https://udlbook.github.io/udlbook/ — excellent for understanding what LLMs actually are.
- *Hands-On Large Language Models* — Jay Alammar and Maarten Grootendorst (O'Reilly). Practical, no heavy maths.
- Google's prompting guide for Gemini: https://ai.google.dev/gemini-api/docs/prompting-strategies
- Gemini API reference (generateContent): https://ai.google.dev/api/generate-content

---

### 2.3 The Extraction Prompt

**What it is.** A text file (`prompts/extract-event.txt`) that instructs the model (Gemini) exactly how to read an email and what JSON to return. It is not code — it is written language addressed directly to the model.

**What it does in this project.** The prompt defines the entire data contract for the AI extraction step. Before the email body is appended (after the `CORREU:` line), the prompt:
- Identifies the model's role ("you are a data extractor for the North Catalonia cultural agenda").
- Provides the reference date (`{{AVUI}}`, replaced at runtime) for inferring missing years.
- Lists the exact 16 JSON keys in the exact required order.
- Specifies value constraints (enum values for `comarca` and `categoria`, date formats, string-only types, the `""` convention for unknowns).
- Instructs the model on which fields to leave empty (the system-filled ones: `imatge_url`, `font_url`, `estat`, `data_entrada`).
- Gives a worked example (format only — the data is fictional).
- States absolute formatting rules (JSON only, no markdown fences, no preamble).

**What you need to understand.**
- **Prompt engineering** is the practice of writing instructions that reliably guide LLM behaviour. It is part writing, part debugging: you run the prompt on sample inputs, observe failures, and refine the instructions to prevent those failures.
- **Why the example is important.** Including a worked example in a prompt (called "few-shot prompting") dramatically improves the consistency of the output format. The model imitates the structure of the example.
- **Why the enum lists are written out explicitly.** If you write "pick the appropriate comarca", the model will sometimes invent values. If you write "ONLY one of these five, written exactly this way: Rosselló, Conflent, Vallespir, Capcir, Cerdanya", the constraint is much harder to violate.
- **The `{{AVUI}}` placeholder.** This is not a programming language feature — it is a simple string substitution done by the Apps Script before sending the prompt. `AVUI` is Catalan for "today". Its only purpose is to let the model infer "this event announced for the 15th of June must be in 2026, not 2025" by comparing the date to today's.

**Learning resources.**
- *The Prompt Report* (white paper): https://trigaten.github.io/Prompt_Survey_Site/ — academic survey of prompting techniques.
- Google's prompt design strategies for Gemini: https://ai.google.dev/gemini-api/docs/prompting-strategies
- *AI Engineering* — Chip Huyen (O'Reilly, 2025). Covers prompt design, LLM pipelines, and evaluation.

---

## Layer 3 — Human Review: Google Sheets

### 3.1 Google Sheets as a Review Interface

**What it is.** Google Sheets is a cloud spreadsheet. In this project it is not used for calculations — it is used exclusively as a human-readable, structured list of events where the curator can read and approve or reject each row.

**What it does in this project.** After the Apps Script writes a new event row, the curator opens the Sheet and sees a colour-coded table:
- Yellow rows = `pendent` (pending review).
- Green rows = `publicat` (approved for publication).
- Red rows = `rebutjat` (rejected).

The curator changes the `estat` dropdown of each pending row to either `publicat` or `rebutjat`. That is the entirety of the weekly curation task (~10 minutes). The Sheet is the human checkpoint between raw AI output and public publication.

**What you need to understand.**
- **Data validation (dropdowns).** Apps Script creates dropdown constraints on the `comarca`, `categoria`, and `estat` columns. This prevents typos that would break the frontend (which compares values by exact string match).
- **Conditional formatting.** Three rules colour entire rows based on the value in column O (`estat`). This is set up by `addStatusColours()` in `setupSheet.gs`. The rule formula `=$O2="publicat"` reads: "if the value in column O of this row equals 'publicat', apply this background colour".
- **Plain text cell format.** All cells in the data range are forced to `@` (plain text) format so that a value like `2026-09-14` is stored as the string `"2026-09-14"`, not as a date serial number. This is critical — if Sheets auto-converts dates, the `publishToGitHub()` script would read a number instead of a formatted string, and the JSON would be wrong.
- **The Sheet is not a database.** There is no relational linking, no transactions, no indexes. It is a flat list. This is intentional — simplicity is the whole point. The constraint is that the schema must remain flat (no nested structures), which is why all 16 event fields are strings.

**Learning resources.**
- *Google Sheets: The Missing Manual* — Matthew MacDonald (O'Reilly).
- Google Sheets function reference (for understanding formulas like the conditional formatting ones): https://support.google.com/docs/table/25273
- Apps Script Spreadsheet reference: https://developers.google.com/apps-script/reference/spreadsheet

---

## Layer 4 — Image Hosting: Cloudinary

### 4.1 Cloudinary

**What it is.** Cloudinary is a cloud media management service. It stores images, applies transformations (resize, format conversion, compression) automatically on upload or on-the-fly, and serves them via a global CDN (content delivery network).

**What it does in this project.** When a poster image exists for an event, the Apps Script uploads it to Cloudinary using an HTTP POST request. Cloudinary returns a public URL, which is stored in the `imatge_url` field of the event row. The frontend reads this URL and displays the image in the event card.

**Key technical decisions.**
- **Unsigned upload preset.** The upload preset (`agenda-posters`) is configured as "unsigned". This means the upload API call requires no secret signature — just the cloud name and the preset name. This simplifies the Apps Script code (no HMAC signature computation) and means the `CLOUDINARY_API_SECRET` is never needed at upload time.
- **Incoming transformation.** The preset applies `w_800,c_limit,q_80,f_webp` on upload. Every poster is automatically converted to WebP format, capped at 800px wide, and compressed to 80% quality before being stored. This means lightweight, fast-loading images regardless of what the original file looks like.
- **Folder structure.** All posters land in `agenda-nord/posters/` in the Cloudinary account.
- **Images are never in Git.** Storing binary files in Git would bloat the repository. Cloudinary separates media storage from code storage cleanly.

**What you need to understand.**
- **CDN (Content Delivery Network).** Cloudinary serves images from servers geographically close to each visitor, making load times faster than serving from a single location.
- **WebP.** A modern image format developed by Google that typically achieves 25–35% smaller file sizes than JPEG at equivalent visual quality. Using `f_webp` in the transformation ensures the frontend always receives lightweight images.
- **Unsigned vs. signed uploads.** Signed uploads require computing an HMAC-SHA1 signature from the request parameters using the API secret. Unsigned uploads skip this. Unsigned is safe for this project because the upload preset restricts the destination folder and transformation — the preset acts as the access control.
- **The `c_limit` crop mode.** This means "resize to fit within 800px, but never upscale a smaller image". A 400px poster remains 400px; a 2000px poster becomes 800px.

**Learning resources.**
- Cloudinary documentation — Upload: https://cloudinary.com/documentation/image_upload_api_reference
- Cloudinary documentation — Transformations: https://cloudinary.com/documentation/transformation_reference
- *High Performance Images* — Colin Bendell, Tim Kadlec et al. (O'Reilly). Covers WebP, CDN concepts, responsive images.
- MDN — Image formats guide: https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types

---

## Layer 5 — Publishing: GitHub and the GitHub API

### 5.1 Git and GitHub

**What it is.** Git is a version control system that tracks changes to files over time. GitHub is a hosting service for Git repositories. Together they provide a history of every change to the project's code, a public URL for the repository, and — via GitHub Pages — free static website hosting.

**What it does in this project.** The `agenda-catalogne-nord` repository on GitHub holds all the source code (`index.html`, `style.css`, `app.js`), the documentation, the Apps Script files, the font files, and the data file (`events.json`). GitHub Pages reads this repository and serves it as a website.

**What you need to understand.**
- **Repository.** A Git repository is a folder whose entire history is tracked. Every saved change is a "commit". The project's repository lives at `github.com/[username]/agenda-catalogne-nord`.
- **Branch.** The project uses a single branch (`main`). All changes go directly to `main`.
- **GitHub Pages.** A GitHub feature that turns a public repository into a static website. For a repository named `agenda-catalogne-nord` owned by user `X`, the website is automatically served at `https://X.github.io/agenda-catalogne-nord/`. No server, no deployment pipeline, no cost.
- **Why images are not in Git.** Binary files like JPEG or PNG make repositories large and git operations slow. Cloudinary handles media; Git handles text files only.
- **Why Git is managed via the GitHub web UI in this project.** Running `git` commands against the mounted project folder has historically corrupted the `.git` configuration in the development environment. The workaround is to use GitHub's browser interface for all commits.

**Learning resources.**
- *Pro Git* — Scott Chacon and Ben Straub (freely available): https://git-scm.com/book/en/v2 — the authoritative Git book.
- GitHub Skills (interactive tutorials): https://skills.github.com/
- *GitHub Actions: The Missing Manual* — Matthew MacDonald (O'Reilly). Useful context even though this project does not use Actions.

---

### 5.2 The GitHub REST API

**What it is.** GitHub exposes a REST API that allows programmes to do everything you can do in the browser: create commits, read files, update files, manage repositories. This project uses it programmatically from Apps Script to write `events.json`.

**What it does in this project.** The `publishToGitHub()` function in Apps Script:
1. Fetches the current `events.json` from the repository to obtain its `sha` (a unique hash of the file's current content — required by GitHub's API to prevent conflicting writes).
2. Encodes the new JSON content in Base64.
3. Sends a PUT request to the GitHub Contents API endpoint with the new content, the old `sha`, and a commit message.

GitHub responds with a new commit hash, and the file is updated atomically (in one operation). The public website serves the new content within seconds.

**What you need to understand.**
- **REST API.** A REST API communicates over HTTP. You send a request (GET, PUT, POST, DELETE) to a URL with a JSON body and headers; the server responds with a JSON body. The GitHub Contents API endpoint is `https://api.github.com/repos/OWNER/REPO/contents/PATH`.
- **SHA (Secure Hash Algorithm).** GitHub requires you to send the current file's SHA when updating it. This is a fingerprint of the file's current content. If two people try to update the same file simultaneously, GitHub uses the SHA to detect the conflict and reject the second write. For this project there is only one writer (the Apps Script), but the pattern must still be followed.
- **Base64 encoding.** The GitHub API requires file content to be sent as a Base64-encoded string. Apps Script has `Utilities.base64Encode(content)` for this.
- **Fine-grained personal access tokens.** The Apps Script authenticates with a GitHub personal access token stored in Script Properties. The token is scoped to only the `agenda-catalogne-nord` repository with only "Contents: Read and write" permission. Minimal permissions = minimal blast radius if the token is ever leaked.
- **The `Authorization: Bearer TOKEN` header.** This is how the Apps Script authenticates with the GitHub API.

**Learning resources.**
- GitHub REST API documentation (Contents endpoint): https://docs.github.com/en/rest/repos/contents
- *Learning REST APIs* — Kirsten Hunter (O'Reilly).
- MDN — Fetch API (for understanding HTTP requests in JavaScript): https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch

---

## Layer 6 — The Frontend Web Application

The frontend is three files: `index.html` (markup structure), `style.css` (visual design), and `app.js` (behaviour and data). They use no frameworks, no build tools, and no external libraries. Every line of code is readable as written — there is no compilation step.

### 6.1 HTML5

**What it is.** HTML (HyperText Markup Language) is the language that describes the structure of a web page. The browser reads an HTML file and builds a tree of elements (the DOM — Document Object Model) that it then renders visually.

**What it does in this project.** `index.html` defines the skeleton of the page: a `<header>` with the title and theme toggle button, a `<nav>` with the filter bar, a `<main>` section where the event list appears, and a `<footer>`. The actual events are not written in the HTML — they are injected dynamically by `app.js` after the page loads. The HTML also contains a small inline `<script>` in the `<head>` that reads the user's theme preference before the page paints (to prevent a flash of the wrong theme).

**Key concepts used.**
- **Semantic HTML.** Using `<header>`, `<nav>`, `<main>`, `<footer>`, `<article>`, `<h1>`–`<h3>` for their meaning, not just their appearance. This matters for accessibility and search engines.
- **`lang` attribute.** The root `<html>` element has `lang="ca"` (Catalan). French-language elements have `lang="fr"`. This tells screen readers and translation tools what language each piece of text is in.
- **`aria-*` attributes.** Several elements have `aria-label`, `aria-hidden`, `aria-expanded` attributes. These are accessibility annotations for screen readers.
- **`loading="lazy"` on images.** Event poster images have `loading="lazy"`, which tells the browser not to download them until the user is about to scroll to them. This improves initial page load speed.
- **`hidden` attribute.** The status message paragraph (`<p id="missatge-estat">`) is shown or hidden using the HTML `hidden` attribute, toggled by JavaScript.

**Learning resources.**
- *HTML and CSS: Design and Build Websites* — Jon Duckett. Visually clear introduction.
- MDN HTML reference: https://developer.mozilla.org/en-US/docs/Web/HTML
- *Accessibility for Everyone* — Laura Kalbag (A Book Apart). Essential for understanding `aria-*` and semantic HTML.
- W3C HTML specification: https://html.spec.whatwg.org/

---

### 6.2 CSS3

**What it is.** CSS (Cascading Style Sheets) is the language that describes how HTML elements should look: colours, fonts, spacing, layout, animations. The browser reads the CSS and applies the visual rules to the DOM.

**What it does in this project.** `style.css` implements the entire visual design: the "sang i or" palette, the two themes (light and dark), the typography system, the sticky filter bar, the event card layout, the tilted poster effect, and the responsive adaptation for wider screens.

**Key CSS concepts used in this project.**

**CSS custom properties (variables).**
All colours are defined in `:root { --vermell: #b5121b; ... }` and referenced as `var(--vermell)`. The dark theme is implemented by redefining the environment variables inside `[data-tema="fosc"] { ... }` — only the contextual colours (background, text, borders) change; the brand colours (red, gold) remain invariant. This architecture means you can redesign the colour scheme by editing one block, not hunting through every selector.

**The `[data-tema="fosc"]` attribute selector.**
The JavaScript sets `document.documentElement.setAttribute('data-tema', 'fosc')` to activate dark mode. The CSS then applies `[data-tema="fosc"]` rules to override the light-theme variables. No class toggling, no JavaScript injection of style rules — the logic lives entirely in CSS.

**`@font-face`.**
The four custom fonts (Fraunces 700, Fraunces 900, Montserrat 400, Montserrat 600) are declared with `@font-face` rules pointing to `.woff2` files in the `/fonts/` directory. This means the fonts load from the same server as the rest of the site — no Google Fonts CDN call at runtime. `font-display: swap` means the browser shows a fallback font (Georgia or system sans-serif) immediately while the custom font downloads, so text is never invisible.

**Flexbox.**
The event card layout (poster on the left, text block on the right) is implemented with `display: flex`. The filter bar uses `flex-wrap: wrap` so comarca buttons wrap to a new line on narrow screens. The sticky filter bar uses `position: sticky; top: 0`.

**`border-image` with `repeating-linear-gradient`.**
The four-bar senyera motif at the top of the header is a pure CSS trick: `border-image: repeating-linear-gradient(to right, var(--or) 0 25%, var(--vermell-fosc) 25% 50%) 12`. This creates a 12px-tall border that repeats a gold+red pattern, simulating the Catalan flag's four bars.

**`transform: rotate()`.**
Each event card's poster is slightly tilted — odd-indexed cards tilt left (`rotate(-3deg)`), even-indexed ones tilt right (`rotate(3deg)`). The tilt straightens on hover (`rotate(0deg)`) with a `transition`. This is disabled under `@media (prefers-reduced-motion: reduce)` for users who have enabled that accessibility preference.

**`@media (prefers-reduced-motion: reduce)`.**
An accessibility media query that turns off animations for users who have indicated they prefer less motion (often people with vestibular disorders or motion sensitivity).

**`clip-path` (referenced in PROJECT-KNOWLEDGE.md for the category banner).**
Used in the evolved design to cut the corner of the poster image and create an angular "banner" showing the event category.

**Mobile-first design.**
The default CSS styles are written for narrow screens. One breakpoint at `@media (min-width: 600px)` adds styles for wider screens. This ensures the site is usable on phones without a separate mobile version.

**Learning resources.**
- *CSS: The Definitive Guide* — Eric Meyer and Estelle Weyl (O'Reilly). Comprehensive reference.
- *Every Layout* — Andy Bell and Heydon Pickering: https://every-layout.dev/. Modern layout patterns without frameworks.
- MDN CSS reference: https://developer.mozilla.org/en-US/docs/Web/CSS
- *Designing with Web Standards* — Jeffrey Zeldman (New Riders). Historical but foundational.
- CSS Custom Properties guide: https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties
- *Inclusive Design Patterns* — Heydon Pickering (Smashing Magazine). For the accessibility aspects.

---

### 6.3 Vanilla JavaScript (ES5/ES2015)

**What it is.** JavaScript is the programming language of the web browser. "Vanilla" means no frameworks or libraries — just the language itself and the browser's built-in APIs.

**What it does in this project.** `app.js` is responsible for everything that happens after the page loads: fetching the data, filtering it, building the DOM elements for each event, handling user interactions (filter clicks, theme toggle, expand/collapse), and showing error or loading states.

**Key JavaScript concepts used in this project.**

**`fetch()` and Promises.**
`carregaEsdeveniments()` calls `fetch('events.json', { cache: 'no-store' })` to load the event data over HTTP. `fetch` returns a Promise — an object that represents a value that will be available in the future. The `.then(function(resposta) {...}).catch(function(error) {...})` chain handles the success and failure cases. `cache: 'no-store'` ensures the browser never serves a cached version — always the live file.

**DOM manipulation.**
Every event card is built by creating individual DOM elements (`document.createElement('article')`), setting their properties and class names, and appending them to the page (`parent.appendChild(child)`). This is explicit and verbose but completely transparent — you can trace exactly what HTML is being created.

**`localStorage`.**
The user's chosen theme (`'clar'` or `'fosc'`) is persisted in `localStorage.setItem('tema', tema)` so it is remembered across page reloads and browser sessions. The code is wrapped in `try/catch` because `localStorage` throws an error in certain private browsing modes.

**Event listeners.**
`button.addEventListener('click', function() {...})` attaches a function to run when the user clicks a button. This is how comarca filter buttons and the theme toggle work. The `<select>` for categories uses `'change'` instead of `'click'`.

**`URLSearchParams`.**
`new URLSearchParams(window.location.search)` parses the URL query string. `fitxerDeDades()` uses it to detect `?prova=1` and switch to sample data. No framework or library needed for this — it is a native browser API.

**`dataset`.**
Each comarca button has `button.dataset.comarca = nom` set, storing the comarca name in a `data-comarca` HTML attribute. The click handler reads it back with `boto.dataset.comarca`. This avoids closures over loop variables, a common JavaScript pitfall.

**`aria-expanded` on the expand/collapse button.**
The "Veure més · Voir plus" button manages its own state: when the user clicks, it adds/removes the `.obert` class on the parent card (which CSS uses to show/hide the `.detalls` block) and updates `aria-expanded` to communicate the state to screen readers.

**`/^\d{4}-\d{2}-\d{2}$/.test(text)`.**
The `analitzaData()` function validates date strings with a regular expression before parsing them. This prevents JavaScript's `new Date()` from creating unexpected dates from malformed strings.

**`new Date(year, month - 1, day)` constructor form.**
Dates are parsed by extracting year, month, and day as integers and passing them to the Date constructor. This avoids timezone surprises: `new Date('2026-09-14')` in some environments is interpreted as UTC midnight and then shifted to local time, potentially landing on the 13th. The explicit constructor form (`new Date(2026, 8, 14)`) is always in local time.

**`currentColor` in SVG.**
The inline SVGs (pin icon, sun, moon) use `fill="currentColor"`, meaning they inherit the text colour of their parent element. This makes them theme-aware for free.

**Learning resources.**
- *Eloquent JavaScript* — Marijn Haverbeke (freely available): https://eloquentjavascript.net/ — the best free JavaScript book.
- *JavaScript: The Good Parts* — Douglas Crockford (O'Reilly). Short, essential.
- *JavaScript: The Definitive Guide* — David Flanagan (O'Reilly). The comprehensive reference.
- MDN JavaScript reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript
- MDN Fetch API: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
- MDN DOM introduction: https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Introduction
- *DOM Scripting* — Jeremy Keith and Jeffrey Sambells (Apress). Practical, pattern-oriented.

---

### 6.4 JSON (the data format)

**What it is.** JSON (JavaScript Object Notation) is a text format for representing structured data. It is human-readable, machine-parseable, and the universal language of web APIs.

**What it does in this project.** `events.json` is the published data file that the frontend reads on every page load. It is an array of event objects, each with exactly 16 string fields. The Apps Script writes it; the JavaScript reads it. Nothing else touches it.

**Key principles.**
- Every value in `events.json` is a string (`""`), never `null`, never a number, never a boolean. This is enforced by the extraction prompt and simplifies all client-side code (no type checks needed).
- The file is formatted with `JSON.stringify(data, null, 2)` — two-space indentation — so it is readable in the GitHub web interface and in diffs.
- The empty array `[]` is a valid `events.json` — the frontend handles it gracefully.

**Learning resources.**
- JSON specification: https://www.json.org/json-en.html
- MDN JSON guide: https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Objects/JSON
- *JavaScript: The Definitive Guide* (above) covers JSON thoroughly.

---

### 6.5 Typography: Fraunces and Montserrat

**What it is.** The project uses two custom typefaces loaded from self-hosted `.woff2` files, plus Georgia (system serif) for French text.

**What it does in this project.** Typography is not decorative here — it encodes the bilingual hierarchy. Catalan text uses Fraunces (a variable serif with optical size variation, used for titles and day headers) and Montserrat (a geometric sans-serif, used for UI labels, metadata, and body text). French text uses Georgia italic exclusively, in a muted colour. The rule is: the two languages never share a font. The visual difference between them reinforces the Catalan-first information architecture.

**Font formats: woff2.** The Web Open Font Format 2 is the most compressed font format supported by all modern browsers. Serving `.woff2` rather than `.ttf` or `.otf` reduces font file sizes by 20–40%.

**`font-display: swap`.** This instruction tells the browser to show a fallback font immediately while the custom font loads, then swap when ready. The alternative (`font-display: block`) would leave invisible text until the font loads.

**Why not Google Fonts CDN.** Loading fonts from Google's CDN at runtime would (a) add a network dependency, (b) violate the no-external-dependency constraint, and (c) potentially trigger GDPR compliance considerations (Google's servers receive the user's IP address on font requests). Self-hosting eliminates all three concerns.

**Learning resources.**
- Google Fonts knowledge (useful even for self-hosting): https://fonts.google.com/knowledge
- *Web Typography* — Richard Rutter (Five Simple Steps). The book on typography for the web.
- *The Elements of Typographic Style* — Robert Bringhurst. The canonical reference on typography.
- MDN — `@font-face`: https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face
- `font-display` explainer: https://css-tricks.com/font-display-masses/

---

### 6.6 Inline SVG Icons

**What it is.** SVG (Scalable Vector Graphics) is an XML-based format for vector graphics. "Inline SVG" means the SVG code is embedded directly in the HTML or JavaScript, not loaded as a separate file.

**What it does in this project.** All icons (pin, sun/moon theme toggle, mini-senyera placeholder, per-category icons in the evolved design) are inline SVGs defined as string constants in `app.js`. They are injected into the DOM with `element.innerHTML = ICONA_PIN`. Using `fill="currentColor"` makes them automatically inherit the parent element's text colour, so they work in both light and dark themes without any extra code.

**Why not an icon font or icon library.** Icon fonts require loading an external file. Icon libraries (like Font Awesome) add a JavaScript dependency. Both violate the no-dependency constraint. Inline SVGs are self-contained, theme-aware, and zero-dependency.

**Learning resources.**
- *SVG on the Web* — Jake Giltsoff (practical guide): https://svgontheweb.com/
- MDN SVG reference: https://developer.mozilla.org/en-US/docs/Web/SVG
- *Practical SVG* — Chris Coyier (A Book Apart).

---

## Layer 7 — Email Digest: Brevo

### 7.1 Brevo (email sending API)

**What it is.** Brevo (formerly Sendinblue) is an email marketing and transactional email service with a free tier that includes up to 300 emails/day. It provides both a web interface and a REST API.

**What it does in this project.** The `sendWeeklyDigest()` Apps Script function calls the Brevo API once per week (triggered automatically) to send a digest email to each comarca's subscriber list. Each list (one per comarca) receives only the events happening in that comarca that week. The email is formatted in HTML.

**What you need to understand.**
- **Transactional vs. marketing email.** Transactional email is triggered by a system event (a password reset, an order confirmation). Marketing email is sent to a list on a schedule. The weekly digest is marketing email. Brevo handles the legal requirements (unsubscribe links, sender identity verification) automatically.
- **Contact lists.** Brevo organises subscribers into lists. This project has five lists, one per comarca. When a new subscriber signs up, they are added to the list(s) of their comarca(s). The list IDs are stored as Script Properties.
- **The Brevo API key.** Authentication works via the header `api-key: YOUR_KEY`. Stored in Script Properties.
- **HTML email rendering.** HTML emails do not render like web pages — each email client (Gmail, Outlook, Apple Mail) has its own HTML/CSS engine, many of which are years behind the web standard. Email HTML must be kept extremely simple: table-based layouts, inline CSS, no external stylesheets, no JavaScript.

**Learning resources.**
- Brevo API documentation: https://developers.brevo.com/
- *Designing HTML Emails* — Jason Rodriguez (O'Reilly). Essential for understanding email HTML constraints.
- Email on Acid (email client compatibility reference): https://www.emailonacid.com/blog/
- Campaign Monitor's CSS guide for email: https://www.campaignmonitor.com/css/

---

## Cross-cutting Concerns

### 8.1 Secret Management

**The pattern.** Every API key, token, and credential in this project is stored in Google Apps Script's **Script Properties** (Settings → Script properties in the Apps Script editor). In code, they are accessed with `PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')` (via the single `getSecret()` funnel in `utils.gs`). They never appear in any committed file.

**The secrets this project manages:**
- `GEMINI_API_KEY` — Google Gemini API key (Google AI Studio)
- `CLOUDINARY_CLOUD_NAME` — Cloudinary cloud name (not secret, but kept consistent)
- `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` — for admin/delete operations
- `GITHUB_TOKEN` — fine-grained personal access token
- `BREVO_API_KEY` — Brevo API key
- `BREVO_LIST_[COMARCA]` — one list ID per comarca

**Why this matters.** If a secret is committed to a public GitHub repository even once, it is effectively compromised — GitHub's history is permanent, and automated scrapers collect exposed secrets within seconds. Script Properties are encrypted at rest and never appear in version control.

**Learning resources.**
- *The Web Application Hacker's Handbook* — Stuttard and Pinto (Wiley). For understanding what happens when secrets leak.
- OWASP's Secret Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html

---

### 8.2 The Event Schema as a Shared Contract

The 16-field event schema is not just a data structure — it is a contract between four components that must stay synchronised: the Gemini extraction prompt, the Google Sheet columns, the JSON file format, and the frontend rendering code. Any change to the schema (rename a field, add a field, change an enum value) must be made in all four places simultaneously, or the pipeline breaks.

This is the most fragile architectural point in the project. The fragility is managed through explicitness: the prompt lists all 16 fields by name, the Sheet has dropdown validation for enum fields, the JSON is generated by name-based mapping (not positional), and the frontend references fields by name (`e.comarca`, not `e[7]`).

**Learning resources.**
- *Designing Data-Intensive Applications* — Martin Kleppmann (O'Reilly). The best book on data schema design and evolution.
- JSON Schema specification (for future validation): https://json-schema.org/

---

### 8.3 Coding Philosophy: Maintainability Over Cleverness

The guiding principle of all code in this project is: **could a non-professional developer open this file in six months and fix a bug without asking anyone?** Every style decision follows from this question.

**One function, one job.** Each function is named for exactly what it does and does only that. `carregaEsdeveniments()` loads the data. `preparaEsdeveniments()` filters and sorts it. `pintaTot()` renders it. No function does two things. This makes the code navigable by function name alone.

**Explicit over implicit.** Column 8 in the Sheet is `comarca`. Rather than `row[7]` (zero-indexed), the code maps each field by name: `var comarca = row[COLUMN_HEADERS.indexOf('comarca')]`. A reader doesn't need to count columns. (In the frontend, `e.comarca` is already named in the JSON, so no mapping is needed.)

**No "clever" code.** No nested ternaries, no destructuring in function arguments, no chained one-liners, no spread operator in logic-critical paths. Longer, explicit code is preferred over shorter, opaque code.

**Comments on every function.** Each function has a one-line comment saying what it does and what it returns. Each file has a banner comment at the top stating its purpose, dependencies, and usage.

**Explicit error handling.** Every `fetch`, every API call, every `JSON.parse` is wrapped in error handling that tells you specifically what failed. The frontend shows a bilingual fallback message rather than a blank page.

**Catalan domain language.** All variable and function names in the domain layer are in Catalan (`carregaEsdeveniments`, `gebeurtenis` is not used — it would be `esdeveniment`). Only technical abbreviations (`url`, `id`, `ca`, `fr`) are in English. This reflects the project's identity and makes the code consistent with the data fields it manipulates.

**Learning resources.**
- *Clean Code* — Robert C. Martin (Prentice Hall). The classic on writing readable code.
- *A Philosophy of Software Design* — John Ousterhout (Yaknyam Press). Excellent on managing complexity.
- *The Pragmatic Programmer* — David Thomas and Andrew Hunt (Addison-Wesley).
- *Working Effectively with Legacy Code* — Michael Feathers (Prentice Hall). Useful for understanding why maintainability patterns matter.

---

### 8.4 Verification Loops and Quality Methodology

The project uses three verification strategies, one at each major decision point.

**1. Prompt verification with sample emails.**
The `prompts/exemples-test/` directory contains three sample emails at different levels of structure: a well-structured one (`correu-1-estructurat.txt`), a disorganised one (`correu-2-desordenat.txt`), and a Facebook-post-style one (`correu-3-facebook.txt`). Before finalising the extraction prompt, it was tested against all three to ensure the output JSON was correct in each case. This is the equivalent of unit testing the prompt.

**2. The curator as a human verification loop.**
The most important quality gate is not automated — it is the curator's weekly review. The Sheet is deliberately simple (colour-coding, dropdowns) so that reviewing 10–20 events takes about 10 minutes. The curator can catch:
- Factual errors (wrong date, wrong venue, wrong association name).
- AI hallucinations (details that are not in the original email).
- Ambiguous categorisation (an event that could be Conferència or Taller).
- Events that are not appropriate for the agenda (off-topic, inappropriate tone).
No automated system can replace this judgment.

**3. Frontend verification with `?prova=1` and `prova-local.html`.**
Before any frontend change is committed, it is verified against sample data using two mechanisms:
- `?prova=1` in the production URL loads `events-exemple.json` (fictional sample events) instead of `events.json`. This lets you see the real rendering with realistic data without publishing any real events.
- `prova-local.html` is a fully self-contained HTML file with the sample data embedded. It can be opened by double-clicking, with no server or network needed. This is used for rapid design iteration and for verifying layout changes before porting them to the canonical files.

Additionally, for automated DOM verification, `jsdom` (a Node.js library that simulates a browser DOM) can be used to load the page and assert that specific elements exist and contain expected content. This catches regressions that visual inspection might miss.

**The sequential build philosophy.**
The 9-step build plan is not a schedule — it is a verification strategy. Each step has a specific "done" criterion (a checklist of observable outcomes). Step N is not started until step N−1 has been verified. This prevents the accumulation of unverified assumptions that later become difficult-to-diagnose bugs.

**Learning resources.**
- *The Art of Software Testing* — Glenford Myers (Wiley). Classic introduction to verification thinking.
- *Unit Testing: Principles, Practices, and Patterns* — Vladimir Khorikov (Manning). Applicable to the prompt-testing and DOM-testing work.
- jsdom documentation: https://github.com/jsdom/jsdom
- *Site Reliability Engineering* — Google (O'Reilly, freely available): https://sre.google/sre-book/table-of-contents/ — for understanding how systems fail and how to verify they don't.

---

### 8.5 The Bilingual Content Model

This is not a translation system — it is a bilingual publishing model. The distinction matters because it affects every layer:

- **Catalan is original; French is secondary.** Descriptions are written first in natural Catalan by the AI, then translated into French. The French is never generated from French source text — it is always derived from Catalan. This ensures the Catalan text is of writing quality, not translation quality.
- **The font system encodes the hierarchy.** Catalan uses Fraunces and Montserrat (primary, designed for screen reading). French uses Georgia italic (warm, secondary, clearly different). A reader can identify which language they are reading without reading it.
- **The separator ` · `** is used consistently to join bilingual labels (e.g. `Totes · Toutes`, `Organitza · Organise :`).
- **`lang` attributes** on French elements (`lang="fr"`) ensure correct hyphenation, screen-reader pronunciation, and browser translation handling.
- **Catalan typography care.** The `finsAl()` function in `app.js` implements correct Catalan typographic conventions: `a l'1` and `a l'11` (elision before vowel sounds), `al 2`, `d'agost` (contraction before vowel), `de setembre` (no contraction before consonant). French has its own convention: `1er`, then ordinal numbers without suffix.

**Learning resources.**
- *El català en cas de dubte* — Institut d'Estudis Catalans. Reference for Catalan grammar and typography.
- Optimot — Consultes lingüístiques en català: https://optimot.gencat.cat/ — the official Catalan language query service.
- *Le bon usage* — Maurice Grevisse (De Boeck). The reference for French grammar.
- Unicode Standard — general punctuation: https://unicode.org/charts/PDF/U2000.pdf (for the middle dot `·` U+00B7 and curly apostrophe U+2019).

---

### 8.6 Free-Tier Architecture and Its Constraints

A deliberate design constraint of this project is that it must run entirely on free tiers. This shapes every technical decision:

| Service | Free tier limit | How the project stays within it |
|---|---|---|
| Gemini API (Google AI Studio) | Free tier | Low event volume; `maxOutputTokens: 2048` per call |
| Google Workspace | Free trial / paid | One account only, no redundancy |
| Cloudinary | 25 credits/month | Unsigned preset, WebP compression; no transformations at serve time |
| GitHub Pages | Unlimited (public repos) | Repository is public |
| Brevo | 300 emails/day | Weekly digest; small subscriber lists |
| Apps Script | 6 min/execution, 90 min/day | Each function runs in seconds; no long operations |

Apps Script quotas in particular shape the code:
- The 6-minute execution limit means no long loops over large datasets. `processNewEmails()` processes a batch of emails and exits; the next run handles the next batch.
- The lock acquired by `LockService` prevents two simultaneous runs that together would exceed quota.

**Learning resources.**
- Google Apps Script quotas: https://developers.google.com/apps-script/guides/services/quotas
- Cloudinary pricing (free tier details): https://cloudinary.com/pricing
- Brevo pricing: https://www.brevo.com/pricing/

---

## Technology Summary Table

| Layer | Technology | Language/Format | Hosted by | Free tier |
|---|---|---|---|---|
| Ingestion — email | Gmail (Google Workspace) | n/a | Google | No (Workspace paid) |
| Ingestion — form | Typebot | n/a | Typebot cloud | Yes |
| Automation | Google Apps Script | JavaScript (ES5) | Google | Yes |
| AI extraction | Google Gemini API | REST + JSON | Google (AI Studio) | Free tier |
| Extraction prompt | `extract-event.txt` | Natural language | n/a (file in repo) | n/a |
| Review interface | Google Sheets | n/a | Google | Yes |
| Image hosting | Cloudinary | REST API | Cloudinary | Yes |
| Version control | Git / GitHub | n/a | GitHub | Yes |
| Data publishing | GitHub REST API | REST + JSON | GitHub | Yes |
| Static web hosting | GitHub Pages | n/a | GitHub | Yes |
| Frontend markup | HTML5 | HTML | — | — |
| Frontend styles | CSS3 | CSS | — | — |
| Frontend behaviour | Vanilla JavaScript | JavaScript (ES2015) | — | — |
| Data file | `events.json` | JSON | GitHub | Yes |
| Fonts | Fraunces, Montserrat | woff2 | GitHub (self-hosted) | Yes |
| Icons | Inline SVG | SVG | — | — |
| Email digest | Brevo | REST API | Brevo | Yes (300/day) |

---

## Suggested Learning Sequence

If you want to understand this project progressively, follow this order:

**Week 1 — The data and the web.**
Read *HTML and CSS: Design and Build Websites* (Duckett). Open `index.html` and `style.css` and identify each element mentioned in section 6.1 and 6.2. Use your browser's developer tools (F12) to inspect how the page renders.

**Week 2 — JavaScript and the DOM.**
Read the first 12 chapters of *Eloquent JavaScript*. Then read `app.js` from top to bottom, matching each function to its description in section 6.3.

**Week 3 — Data and APIs.**
Read the MDN JSON guide, the Fetch API docs, and the GitHub REST API docs (Contents endpoint). Trace the path a single event takes from `events.json` on GitHub to the rendered card on screen.

**Week 4 — The backend.**
Read the Apps Script documentation for `SpreadsheetApp` and `UrlFetchApp`. Read `setupSheet.gs` and trace what each function does to the Sheet. Read section 2.3 (the extraction prompt) and compare it to the three sample emails in `prompts/exemples-test/`.

**Week 5 — The AI layer.**
Read *Hands-On Large Language Models* (Alammar and Grootendorst). Read Google's Gemini prompting guide. Then re-read `extract-event.txt` and ask: what failure does each rule prevent?

**Week 6 — The services.**
Read the Cloudinary upload documentation and the Brevo API documentation. Trace what happens when an image is uploaded and when the weekly digest is sent.

**Throughout — Coding philosophy.**
Dip into *Clean Code* (Martin) and *A Philosophy of Software Design* (Ousterhout) in parallel with the above. Every time you look at a function in this project, ask: does it pass the six-months test? If not, how would you improve it?

---

*This document covers the project as built through June 2026. Steps 4, 5, 7, and 9 (Gmail ingestion, Typebot webhook, publishing button, and weekly digest) are designed and documented but awaiting execution pending the Google Workspace account setup.*
