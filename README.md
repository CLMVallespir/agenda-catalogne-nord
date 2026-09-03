# «Què fas?» — Agenda cultural de la Catalunya Nord

> **Per a l'assistent (Claude):** abans de tocar res, llegeix `CLAUDE.md` (la
> constitució: arquitectura, esquema, restriccions, estil) i `FASES.md` (el pla
> de construcció i l'estat de cada fase). Cal mantenir l'esperit: simplicitat
> per sobre de tot, bilingüe català primer, només nivells gratuïts, sense
> frameworks ni comptes d'usuari.

Agenda cultural automatitzada per a la Catalunya Nord (Rosselló, Conflent,
Vallespir, Capcir, Cerdanya).

Agenda culturelle automatisée pour la Catalogne Nord.

## Com funciona

```
associació ──correu──► agenda@clm.cat ──► Cloudflare Email Routing
                                                │
associació ──formulari Typebot──► POST ──►  UN SOL WORKER (Cloudflare)
                                            ├─ email():     parseja → Gemini → Cloudinary → pendents.json → reenvia l'original al Gmail d'arxiu
                                            ├─ fetch():     mapa determinista del formulari → pendents.json
                                            └─ scheduled(): digest setmanal per comarca via Brevo
                                                │
                              curador.html (GitHub Pages) ──valida──► events.json
                                                │
                              web públic estàtic (GitHub Pages) llegeix events.json
```

1. Les associacions envien els actes **per correu a `agenda@clm.cat`** o **pel
   formulari Typebot**. No hi ha cap altra via.
2. Un **únic Worker de Cloudflare** els converteix en files pendents. Pel camí
   del correu, en treu les dades amb l'API de Gemini i puja el cartell a
   Cloudinary; pel camí del formulari, els camps ja arriben estructurats i no
   cal cap model. Passi el que passi, el correu original es reenvia al Gmail
   d'arxiu.
3. La cua de revisió és **`pendents.json`**, a l'arrel del repositori.
4. La persona curadora revisa la cua a **`curador.html`**, corregeix el que
   calgui i valida amb dos botons: **Publica** o **Rebutja**.
5. Publicar afegeix l'acte a **`events.json`**, que és la font de veritat del
   que és públic. **GitHub Pages** serveix el web estàtic que el llegeix.
6. Cada dimarts a les 15.00 (hora de París), el mateix Worker envia un **digest
   setmanal per comarca** via Brevo.

**Cap base de dades i cap servidor** més enllà d'aquest Worker: tot l'estat viu
en dos fitxers JSON del repositori.

## Estructura

| Fitxer / carpeta | Funció |
|---|---|
| `index.html`, `style.css`, `app.js` | Web públic estàtic (vanilla JS, sense frameworks) |
| `curador.html` | La cua de revisió. Pàgina autònoma; el testimoni de GitHub s'hi enganxa i mor amb la pestanya |
| `events.json` | Dades publicades — font de veritat del que és en línia |
| `pendents.json` | La cua de revisió — el que espera validació |
| `events-exemple.json` | Dades fictícies de prova (mode `?prova=1`) |
| `prova-local.html` | Mirall offline del web públic |
| `worker/worker.js` | **La font de veritat del Worker.** Els tres gestors: `email()`, `fetch()`, `scheduled()` |
| `worker/postal-mime.js` | Analitzador MIME vendoritzat (l'única dependència del projecte) |
| `worker/worker-concatenat.js` | **Generat.** Els dos fitxers de dalt en un de sol: és el que s'enganxa al tauler |
| `prompts/extract-event.txt` | El prompt d'extracció mestre per a Gemini |
| `importa-csv.js` | Eina d'un sol ús que va sembrar `pendents.json` des del CSV del full antic |
| `docs/` | Guies de configuració i informes |
| `docs/arxiu-google/` | **Codi mort.** El sistema anterior (full de càlcul + Apps Script), conservat com a registre històric |

## Principis

- Sense infraestructura de pagament: només nivells gratuïts (Cloudflare, GitHub
  Pages, Cloudinary, Brevo, API de Gemini).
- Sense comptes d'usuari, sense login, sense base de dades.
- Sense framework, sense eina de compilació, sense npm.
- Tot el text públic és bilingüe: català primer, francès a sota.
- Simplicitat per sobre de tot: codi explícit, fàcil de llegir i de reparar per
  una sola persona no professional, sis mesos després.

## Operació (runbook)

Guia mínima per operar el sistema (i per a qui l'hereti). El detall pas a pas
viu a `docs/`.

### Desplegar un canvi al Worker

**El fitxer que s'edita no és el fitxer que es desplega.** Es toca
`worker/worker.js`, es torna a generar `worker/worker-concatenat.js` i s'enganxa
sencer al tauler de Cloudflare (Worker → Edit code → Deploy). Mai al revés: un
pedaç fet directament al fitxer concatenat es perd la propera vegada que es
generi.

El Git Build està **desconnectat** a posta. Amb ell connectat hi hauria dues
vies de desplegament trepitjant-se en silenci (vegeu `NOTES.md`). Mentre el
desplegament sigui manual, **`wrangler.jsonc` no el llegeix ningú**: el que hi
ha declarat és decoració.

### Configuració (tauler de Cloudflare)

| Nom | On va | Què és |
|---|---|---|
| `CLOUDINARY_CLOUD_NAME` | Variable de text | surt a l'URL de cada cartell públic; no té res a amagar |
| `GEMINI_API_KEY` | Secret | API de Gemini |
| `GITHUB_TOKEN` | Secret | gra fi, només aquest repositori, només `contents: write` |
| `BREVO_API_KEY` | Secret | enviament del digest |
| `BREVO_LIST_ROSSELLO` … `_CERDANYA` | Secrets | els cinc IDs de llista per comarca |
| `TYPEBOT_SECRET` | Secret | el secret compartit del webhook del formulari |
| `ADRECA_ARXIU` | Secret | on es reenvia cada correu original |

**Un Secret canviat al tauler no és viu fins que es desplega.** L'activador cron
(`*/10 13,14 * * 2`) també s'afegeix a mà: Worker → Settings → Trigger Events →
Cron Triggers.

### Publicar i rebutjar actes

`curador.html` es publica sol per GitHub Pages: **no cal desplegar-lo**. S'obre,
s'hi enganxa el testimoni de GitHub de gra fi i es treballa. Sense testimoni, la
pàgina és només de lectura.

Publicar escriu `events.json` **abans** de treure la fila de `pendents.json`.
L'ordre no és casual: si falla enmig, deixa un duplicat visible a la cua i no un
acte perdut.

### Rollback

Tot l'estat és a Git. Un `events.json` o un `pendents.json` que hagi quedat
malament es restaura des de l'historial de commits del repositori. El Worker es
torna enrere des de la pestanya **Deployments** del tauler de Cloudflare.

### Quan alguna cosa no surt

El registre del Worker (Cloudflare → Worker → Logs) guarda **tres dies**. Cap
clau no s'hi escriu mai. Els símptomes que enganyen més estan documentats a
`NOTES.md`, una lliçó per entrada.
