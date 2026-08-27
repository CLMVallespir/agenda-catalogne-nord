# Fase 2 — El Worker: el gestor `email()`

Com desplegar i verificar el gestor de correu de l'únic Worker del projecte.
Tot es fa al navegador, al tauler de Cloudflare: **cap `wrangler`, cap npm, cap
eina de compilació**. Temps estimat: 20 minuts, més les proves.

Prerequisit: la **Fase 0** ha de ser feta (Email Routing viu, `agenda@clm.cat`
creada, destinacions verificades i provades des de fora). Vegeu `FASES.md`.

## Els fitxers

| Fitxer | Què és |
|---|---|
| `worker/worker.js` | El codi del projecte. És el que llegiràs i arreglaràs. |
| `worker/postal-mime.js` | Dependència vendoritzada (parser de MIME). **No l'editis.** Versió, URL d'origen i sha256 són a la seva capçalera. |

## 1. Crear el Worker

1. Tauler de Cloudflare → **Workers & Pages** → **Create application** →
   **Create Worker**.
2. Nom: `quefas-agenda`. Clica **Deploy** (desplega el codi d'exemple; el
   canviarem tot seguit).
3. Clica **Edit code**.

## 2. Enganxar el codi

L'editor del tauler accepta més d'un fitxer. Si el teu el permet, és el camí bo:

1. Esborra tot el que hi ha a `worker.js` i enganxa-hi el contingut de
   `worker/worker.js`.
2. Amb el botó **+** de la llista de fitxers, crea `postal-mime.js` i
   enganxa-hi el contingut de `worker/postal-mime.js`.
3. **Deploy**.

**Si l'editor només et deixa un fitxer**, fes-ho en un de sol:

1. Enganxa primer tot `worker/postal-mime.js`.
2. **Esborra'n l'última línia**, `export default PostalMime;` (hi ha un
   comentari just a sobre que ho recorda).
3. Enganxa a continuació tot `worker/worker.js`, i **esborra'n la línia**
   `import PostalMime from './postal-mime.js';`.
4. **Deploy**. Surten unes 5 600 línies i uns 185 kB: és normal.

Les dues maneres s'han provat i donen el mateix resultat.

## 3. Els secrets i les variables

Al Worker → **Settings** → **Variables and Secrets**. Cap d'aquests valors no
viu mai al codi ni a Git.

| Nom | Tipus | Valor |
|---|---|---|
| `GEMINI_API_KEY` | Secret | La clau d'AI Studio |
| `GITHUB_TOKEN` | Secret | Token de gra fi, **només** el repositori `agenda-catalogne-nord`, permís únic `Contents: Read and write` |
| `CLOUDINARY_CLOUD_NAME` | Text | El nom del cloud (no és cap secret) |
| `ADRECA_ARXIU` | Text | El Gmail d'arxiu. **Ha de ser una destinació verificada** a l'Email Routing, si no el reenviament falla |

## 4. Enganxar el Worker a l'adreça

Cloudflare → el domini `clm.cat` → **Email** → **Email Routing** → **Routing
rules** → la regla de `agenda@clm.cat` → **Edit**:

- **Action:** `Send to a Worker`
- **Destination:** `quefas-agenda`

Guarda. A partir d'aquest moment el correu d'`agenda@clm.cat` ja **no** va
directament al Gmail: hi arriba reenviat pel Worker.

## 5. Verificar (la porta de la Fase 2)

Envia els correus **des d'un compte de fora** (no des del Gmail d'arxiu). Els
registres es veuen al Worker → **Logs** → **Begin log stream**, obert abans
d'enviar.

1. **Correu real amb cartell.** Un correu amb dates, lloc i un cartell adjunt
   (imatge o PDF). Comprova:
   - una fila nova a dalt de `pendents.json` al GitHub, amb `imatge_url`
     apuntant a `res.cloudinary.com`;
   - un commit nou que diu «Correu nou a la cua: …»;
   - l'original al Gmail d'arxiu.
2. **Correu escombraria o buit.** Comprova que **arriba igualment al Gmail** i
   que als registres no hi ha cap error no controlat. Un correu sense gens de
   text no crea cap fila i el registre ho diu: «correu sense text. Arxivat,
   sense fila.»
3. **De punta a punta.** Obre `curador.html`, enganxa-hi el token, i publica la
   fila del punt 1. Ha d'aparèixer a `events.json` i, un minut després, al web
   públic.

## Si alguna cosa falla

Tot passa pels registres del Worker, i tots els missatges comencen pel nom de
la funció. Les claus no s'hi escriuen mai.

| Al registre hi diu | Què vol dir |
|---|---|
| `falta la variable ADRECA_ARXIU` | El pas 3 no s'ha fet. |
| `el reenviament ha fallat` | L'adreça d'arxiu no és una destinació verificada a l'Email Routing. |
| `Gemini ha respost amb codi 404` | Google ha retirat el model. Cicle de vida normal: mira quins Flash / Flash-Lite hi ha vigents i canvia la constant `GEMINI_MODEL`. Mai la gamma Pro, que és de pagament. |
| `Gemini ha respost amb codi 429` | Quota diària del nivell gratuït esgotada. El correu és a l'arxiu; es pot reenviar demà. |
| `el cartell no s'ha pogut pujar` | Cloudinary ha dit no (mida, format, preset). La fila hi és igualment, sense imatge: el curador la pot afegir a mà. |
| `GitHub ha rebutjat l'escriptura` | Token caducat, mal abastat, o sense `Contents: write`. |

**La invariant:** passi el que passi, l'original acaba al Gmail d'arxiu. El
reenviament és la primera cosa que fa el gestor, abans de tocar cap servei. Si
un correu no s'ha pogut convertir en fila, no s'ha perdut: és a l'arxiu i
l'error és al registre.
