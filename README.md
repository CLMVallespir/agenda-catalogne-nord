# Agenda cultural — Catalunya Nord

Agenda cultural automatitzada per a la Catalunya Nord (Rosselló, Conflent, Vallespir, Capcir, Cerdanya).

Agenda culturelle automatisée pour la Catalogne Nord.

## Com funciona

1. Les associacions envien els esdeveniments per correu electrònic o pel formulari Typebot.
2. Un script de Google Apps Script extreu les dades amb l'API de Claude i les escriu a Google Sheets.
3. Una persona curadora revisa els esdeveniments un cop per setmana i marca els aprovats com a `publicat`.
4. El botó «Publier» envia els esdeveniments aprovats a `events.json` en aquest dipòsit.
5. GitHub Pages serveix l'aplicació web estàtica (aquest dipòsit) amb filtres per comarca i categoria.
6. Un resum setmanal per comarca s'envia per correu via Brevo.

## Estructura

| Fitxer / carpeta | Funció |
|---|---|
| `index.html`, `style.css`, `app.js` | Aplicació web estàtica (vanilla JS, sense frameworks) |
| `events.json` | Dades publicades — font de veritat dels esdeveniments en línia |
| `prompts/` | Prompt d'extracció per a l'API de Claude i correus de prova |
| `apps-script/` | Scripts de Google Apps Script (configuració del full de càlcul, ingestió) |
| `docs/` | Guies de configuració (Cloudinary, etc.) |

## Principis

- Sense infraestructura de pagament: només nivells gratuïts (Google, GitHub, Cloudinary, Brevo).
- Sense comptes d'usuari, sense backend en temps real.
- Tot el text públic és bilingüe: català primer, francès a sota.
- Simplicitat per sobre de tot: codi explícit, fàcil de llegir i de reparar.
