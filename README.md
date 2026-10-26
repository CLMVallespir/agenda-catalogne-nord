# «Què fas?» — Agenda cultural de la Catalunya Nord

> **Per a l'assistent (Claude):** abans de tocar res, llegeix `CLAUDE.md` (la
> constitució: arquitectura, esquema, restriccions, estil) i `NOTES.md` (la
> història, les decisions que no es reobren i les lliçons). Cal mantenir
> l'esperit: simplicitat per sobre de tot, bilingüe català primer, només
> nivells gratuïts, sense frameworks ni comptes d'usuari.

Agenda cultural automatitzada per a la Catalunya Nord (Rosselló, Conflent,
Vallespir, Capcir, Cerdanya).

Agenda culturelle automatisée pour la Catalogne Nord.

## Com funciona

```
associació ──correu──► agenda@clm.cat ──► Cloudflare Email Routing
                                                │
associació ──formulari Typebot──► POST ──►  UN SOL WORKER (Cloudflare)
                                            ├─ email():     parseja → Claude → Cloudinary → pendents.json → reenvia l'original al Gmail d'arxiu
                                            ├─ fetch():     mapa determinista del formulari → pendents.json
                                            └─ scheduled(): digest setmanal per comarca via Brevo
                                                │
flux ADT66 ──────────────────────────────►  UNA SOLA ACTION (GitHub Actions)
                                            └─ sincronitza → mapeja → filtra → tradueix (Claude) → pendents.json
                                                │
                              curador.html (GitHub Pages) ──valida──► events.json
                                                │
                              web públic estàtic (GitHub Pages) llegeix events.json
```

1. Les associacions envien els actes **per correu a `agenda@clm.cat`** o **pel
   formulari Typebot**. No hi ha cap altra via.
2. Un **únic Worker de Cloudflare** els converteix en files pendents. Pel camí
   del correu, en treu les dades amb l'API de Claude i puja el cartell a
   Cloudinary; pel camí del formulari, els camps ja arriben estructurats i no
   cal cap model. Passi el que passi, el correu original es reenvia al Gmail
   d'arxiu.
3. A més, una **Action de GitHub** baixa el flux d'actes de l'ADT66 (l'agència
   de turisme del departament), en treu el que és nou i dins el criteri
   editorial, ho tradueix al català amb Claude i ho afegeix a la cua.
   S'engega a mà des de la pestanya Actions.
4. La cua de revisió és **`pendents.json`**, a l'arrel del repositori.
5. La persona curadora revisa la cua a **`curador.html`**, corregeix el que
   calgui i valida amb dos botons: **Publica** o **Rebutja**.
6. Publicar afegeix l'acte a **`events.json`**, que és la font de veritat del
   que és públic. **GitHub Pages** serveix el web estàtic que el llegeix.
7. Cada dimarts a les 15.00 (hora de París), el mateix Worker envia un **digest
   setmanal per comarca** via Brevo.

**Cap base de dades i cap servidor** més enllà d'aquest Worker: tot l'estat viu
en dos fitxers JSON del repositori. L'Action no és cap servidor: és un guió que
s'executa i para.

## Estructura

| Fitxer / carpeta | Funció |
|---|---|
| `index.html`, `style.css`, `app.js` | Web públic estàtic (vanilla JS, sense frameworks) |
| `curador.html`, `curador-cua.js` | La cua de revisió i les peces que en canvien l'estat (publicar, rebutjar), que Node prova. El testimoni de GitHub s'hi enganxa i mor amb la pestanya |
| `events.json` | Dades publicades — font de veritat del que és en línia |
| `pendents.json` | La cua de revisió — el que espera validació |
| `events-exemple.json` | Dades fictícies de prova (mode `?prova=1`) |
| `prova-local.html` | Mirall offline del web públic |
| `worker/worker.js` | **La font de veritat del Worker.** Els tres gestors: `email()`, `fetch()`, `scheduled()` |
| `worker/postal-mime.js` | Analitzador MIME vendoritzat (l'única dependència del projecte) |
| `worker/worker-concatenat.js` | **Generat.** Els dos fitxers de dalt en un de sol: és el que s'enganxa al tauler |
| `prompts/extract-event.txt` | El prompt d'extracció mestre per a Claude |
| `.github/workflows/sincronitza-adt66.yml`, `eines/sincronitza-programada.js` | L'Action: la sincronització del flux de l'ADT66 |
| `eines/` | Els mòduls que crida l'Action, els verificadors (`verifica-*.js`) i `cartells-a-cloudinary.js`, que puja a mà els cartells de la cua |
| `proves/` | Les proves amb `node:test`, una per fitxer |
| `docs/` | El criteri editorial, el protocol amb Claude Chat i les guies de configuració dels serveis |
| `CLAUDE.md` | La descripció del sistema tal com és avui |
| `NOTES.md` | La història del projecte, les decisions i les lliçons |

## Principis

- Sense infraestructura de pagament: només nivells gratuïts (Cloudflare, GitHub
  Pages, Cloudinary, Brevo). L'única excepció és l'API de Claude, pagada amb el
  crèdit mensual gratuït de l'organització i amb un límit de despesa que la fa
  fallar abans de cobrar res (§3 de `CLAUDE.md`).
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
generi. Abans d'enganxar, `node eines/verifica-enum.js` i
`node eines/verifica-worker-concatenat.js` en verd.

El Git Build està **desconnectat** a posta, i no n'hi ha cap fitxer de
configuració al repositori: amb dues vies de desplegament actives alhora es
trepitgen en silenci (vegeu `NOTES.md`). Tota la configuració del Worker viu al
tauler.

### Configuració (tauler de Cloudflare)

| Nom | On va | Què és |
|---|---|---|
| `CLOUDINARY_CLOUD_NAME` | Variable de text | surt a l'URL de cada cartell públic; no té res a amagar |
| `ANTHROPIC_API_KEY` | Secret | API de Claude (Anthropic) |
| `GITHUB_TOKEN` | Secret | gra fi, només aquest repositori, només `contents: write` |
| `BREVO_API_KEY` | Secret | enviament del digest |
| `BREVO_LIST_ROSSELLO` … `_CERDANYA` | Secrets | els cinc IDs de llista per comarca |
| `TYPEBOT_SECRET` | Secret | el secret compartit del webhook del formulari |
| `ADRECA_ARXIU` | Secret | on es reenvia cada correu original |

**Un Secret canviat al tauler no és viu fins que es desplega.** L'activador cron
(`*/10 13,14 * * 2`) també s'afegeix a mà: Worker → Settings → Trigger Events →
Cron Triggers. Els registres (Worker → Logs) han de tenir Workers Logs engegat.

A l'Email Routing de `clm.cat`, la regla d'`agenda@clm.cat` té l'acció **Send
to a Worker** cap al Worker `agenda-catalogne-nord`. L'adreça d'`ADRECA_ARXIU`
ha de ser una destinació verificada, o el reenviament falla.

L'Action té el seu propi secret, `ANTHROPIC_API_KEY`, a GitHub → Settings →
Secrets and variables → Actions. És un magatzem diferent del de Cloudflare; la
clau pot ser la mateixa.

**El token de GitHub de gra fi** (el del Worker i el que s'enganxa al curador):
GitHub → Settings → Developer settings → Personal access tokens →
Fine-grained tokens → Generate new token. Només el repositori
`agenda-catalogne-nord`, permís únic **Contents: Read and write**, caducitat
d'un any. Apunta't la data: quan caduca, el Worker i el curador fallen amb un
401. Guarda'l al gestor de contrasenyes, mai al repositori.

### Publicar i rebutjar actes

`curador.html` es publica sol per GitHub Pages: **no cal desplegar-lo**. S'obre,
s'hi enganxa el testimoni de GitHub de gra fi i es treballa. Sense testimoni, la
pàgina és només de lectura.

Publicar escriu `events.json` **abans** de marcar la fila de `pendents.json`
com a `publicat` (no la treu: així la sincronització reconeix l'oferta). L'ordre
no és casual: si falla enmig, deixa un duplicat visible a la cua i no un acte
perdut.

### Sincronitzar l'ADT66

Pestanya **Actions** → «Sincronitza ADT66» → **Run workflow**. Per omissió
s'executa en sec (no escriu res); desmarca-ho per encuar de debò. El cron
setmanal és escrit al `.yml` però comentat. Els cartells de les files noves es
pugen a Cloudinary a mà: `node eines/cartells-a-cloudinary.js --prova` primer,
i sense `--prova` per escriure.

### Rollback

Tot l'estat és a Git. Un `events.json` o un `pendents.json` que hagi quedat
malament es restaura des de l'historial de commits del repositori. El Worker es
torna enrere des de la pestanya **Deployments** del tauler de Cloudflare.

### Quan alguna cosa no surt

El registre del Worker (Cloudflare → Worker → Logs) guarda **tres dies**. Cap
clau no s'hi escriu mai. Els símptomes que enganyen més estan documentats a
`NOTES.md`, una lliçó per entrada.
