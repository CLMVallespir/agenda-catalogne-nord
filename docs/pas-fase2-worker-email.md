# Fase 2 — El Worker: el gestor `email()`

Com desplegar i verificar el gestor de correu de l'únic Worker del projecte.
Camí principal: **connectar el Worker al repositori de Git**, i que cada empenta
a `main` el desplegui sola. Al final hi ha el camí de recanvi (enganxar el codi
a mà al tauler), que continua funcionant i no necessita res de tot això.

Prerequisit: la **Fase 0** ha de ser feta (Email Routing viu, `agenda@clm.cat`
creada, destinacions verificades i provades des de fora). Vegeu `FASES.md`.

## Els fitxers

| Fitxer | Què és |
|---|---|
| `worker/worker.js` | El codi del projecte. És el que llegiràs i arreglaràs. |
| `worker/postal-mime.js` | Dependència vendoritzada (parser de MIME). **No l'editis.** Versió, URL d'origen i sha256 són a la seva capçalera. |
| `wrangler.jsonc` | La configuració del desplegament: nom, punt d'entrada, data de compatibilitat, registres. **Cap secret.** |
| `.assetsignore` | Una xarxa de seguretat que avui no fa res. Vegeu l'avís de més avall. |

## 1. Crear el Worker i connectar-lo al repositori

1. Tauler de Cloudflare → **Workers & Pages** → **Create application** →
   **Import a repository**, i tria `CLMVallespir/agenda-catalogne-nord`.
   - Si ja tens el Worker creat d'abans (del camí manual), no cal refer-lo: ves
     al Worker → **Settings** → **Build** i connecta-hi el repositori des d'allà.
2. **El nom del Worker ha de ser `quefas-agenda`**, exactament igual que el
   `name` de `wrangler.jsonc`. Si no coincideixen, la construcció falla i el
   registre t'ho diu amb aquestes paraules.

## 2. Les opcions de construcció

Al Worker → **Settings** → **Build**:

| Camp | Valor |
|---|---|
| Git branch | `main` |
| Root directory | *(buit — l'arrel del repositori)* |
| Build command | *(buit — no hi ha res a compilar)* |
| Deploy command | `npx wrangler deploy` (és el valor per defecte) |
| Non-production branch deploy command | *(deixa el valor per defecte; només fem servir `main`)* |
| Build watch paths → Include | `worker/*` **i** `wrangler.jsonc` |
| Build watch paths → Exclude | *(buit)* |

**Els «build watch paths» no són opcionals.** Aquest repositori és també la base
de dades: cada publicació des de `curador.html` són dos commits a `main`, i el
mateix Worker escriu a `pendents.json` cada vegada que arriba un correu. Amb el
valor per defecte (`*`, o sigui tot), cada una d'aquelles empentes tornaria a
construir i desplegar el Worker — incloses les que el Worker es provoca a ell
mateix escrivint la cua. Al pla gratuït hi ha 3 000 minuts de construcció al mes
i una construcció alhora: els gastaries a redesplegar codi que no ha canviat.
Amb `worker/*` i `wrangler.jsonc` a Include, els commits de dades no construeixen
res, i els canvis de configuració sí.

> **No hi entra `wrangler`, ni a la teva màquina ni al teu cap.** L'empaquetat
> el fa Cloudflare als seus servidors. Tu segueixes editant fitxers i fent
> commits. El que hi guanyes: el codi desplegat és, demostrablement, el codi
> commitat.

## 3. Els secrets i les variables

Al Worker → **Settings** → **Variables and Secrets**. Cap d'aquests valors no
viu mai al codi, ni a `wrangler.jsonc`, ni a Git.

| Nom | Tipus | Valor |
|---|---|---|
| `GEMINI_API_KEY` | Secret | La clau d'AI Studio |
| `GITHUB_TOKEN` | Secret | Token de gra fi, **només** el repositori `agenda-catalogne-nord`, permís únic `Contents: Read and write` |
| `CLOUDINARY_CLOUD_NAME` | Text | El nom del cloud (no és cap secret) |
| `ADRECA_ARXIU` | Text | El Gmail d'arxiu. **Ha de ser una destinació verificada** a l'Email Routing, si no el reenviament falla |

Es podrien posar els dos últims com a `vars` dins `wrangler.jsonc`, però val més
que els quatre visquin al mateix lloc: quan alguna cosa falli, un sol lloc per
mirar.

## 4. Enganxar el Worker a l'adreça

Cloudflare → el domini `clm.cat` → **Email** → **Email Routing** → **Routing
rules** → la regla de `agenda@clm.cat` → **Edit**:

- **Action:** `Send to a Worker`
- **Destination:** `quefas-agenda`

Guarda. A partir d'aquest moment el correu d'`agenda@clm.cat` ja **no** va
directament al Gmail: hi arriba reenviat pel Worker. Aquesta regla viu a l'Email
Routing, no a `wrangler.jsonc`: connectar el Git no la toca.

## 5. Comprovar que el desplegament ha agafat el punt d'entrada bo

Això es mira **una vegada**, just després de la primera construcció, per
descartar que Cloudflare hagi desplegat res més que `worker/worker.js`.

1. **El registre de construcció** (Worker → **Deployments**, o **Settings** →
   **Build**, i obre la construcció). A la sortida del `npx wrangler deploy` hi
   ha d'haver:
   - una línia de pujada del guió amb la seva mida, del tipus
     `Total Upload: … KiB / gzip: … KiB`. Ha de ser d'uns **185 kB**, que és el
     Worker més el parser empaquetats junts: si fos de 27 kB, l'`import` no
     s'hauria resolt;
   - `Uploaded quefas-agenda` i `Deployed quefas-agenda`;
   - i sobretot **cap línia que parli d'actius** (res de «assets», ni de
     «Uploading N files»). Si n'hi ha cap, algú ha afegit una clau `assets`:
     llegeix l'avís de la secció següent.
2. **Bindings** (Worker → **Settings** → **Bindings**): no hi ha d'haver cap
   binding d'`Assets`. La llista ha de ser buida.
3. **Deployments**: el desplegament de dalt ha de dir que ve de Workers Builds i
   portar el hash del commit que acabes d'empènyer. Compara'l amb
   `git log --oneline -1`.
4. **La prova de debò**, que val més que les tres anteriors: envia un correu i
   mira els registres (secció 6). Si hi surt una línia de `processaCorreu()`, el
   punt d'entrada és el bo — el gestor `email()` només existeix a `worker.js`.

## Avís — cap clau `assets`, mai

`wrangler.jsonc` no declara cap directori d'actius, i no n'ha de declarar cap.
El web públic de «Què fas?» es serveix des de GitHub Pages; el Worker no serveix
pàgines (CLAUDE.md §8).

Importa perquè la temptació és clara: el web estàtic viu a l'arrel d'aquest
mateix repositori, i afegir `"assets": { "directory": "." }` sembla la manera
de servir-lo des del Worker. No ho és. Amb aquella línia, Cloudflare pujaria com
a pàgina web pública tot el que hi ha a l'arrel: l'historial de Git sencer, els
documents interns del projecte, el CSV d'importació. Si algun dia et cal servir
el web des del Worker, és una decisió d'arquitectura, no una línia de
configuració: parla'n abans.

La segona barrera és el `.assetsignore` de l'arrel del repositori. Avui no fa
res — no hi ha cap directori d'actius que ignorar — i està bé així: existeix per
si aquella línia s'hi arriba a posar, i llavors deixa fora la brossa. La seva
capçalera explica què hi ha i què no.

## 6. Verificar la Fase 2 (la porta)

Envia els correus **des d'un compte de fora** (no des del Gmail d'arxiu). Els
registres es veuen al Worker → **Logs**: hi ha el flux en directe
(**Begin log stream**) i, com que `wrangler.jsonc` té `observability` engegada,
també les entrades desades dels últims **3 dies** — que és el que cal per a un
correu que falla de matinada.

1. **Correu real amb cartell.** Un correu amb dates, lloc i un cartell adjunt
   (imatge o PDF). Comprova:
   - una fila nova a dalt de `pendents.json` al GitHub, amb `imatge_url`
     apuntant a `res.cloudinary.com`;
   - un commit nou que diu «Correu nou a la cua: …»;
   - l'original al Gmail d'arxiu;
   - i que aquell commit **no** ha engegat cap construcció (és la prova que els
     «build watch paths» estan bé).
2. **Correu escombraria o buit.** Comprova que **arriba igualment al Gmail** i
   que als registres no hi ha cap error no controlat. Un correu sense gens de
   text no crea cap fila i el registre ho diu: «correu sense text. Arxivat,
   sense fila.»
3. **De punta a punta.** Obre `curador.html`, enganxa-hi el token, i publica la
   fila del punt 1. Ha d'aparèixer a `events.json` i, un minut després, al web
   públic.

## Si alguna cosa falla

Tot passa pels registres del Worker, i tots els missatges comencen pel nom de la
funció. Les claus no s'hi escriuen mai.

| Al registre hi diu | Què vol dir |
|---|---|
| el nom del Worker no coincideix | El `name` de `wrangler.jsonc` i el nom al tauler han de ser el mateix: `quefas-agenda`. |
| `falta la variable ADRECA_ARXIU` | La secció 3 no s'ha fet. |
| `el reenviament ha fallat` | L'adreça d'arxiu no és una destinació verificada a l'Email Routing. |
| `Gemini ha respost amb codi 404` | Google ha retirat el model. Cicle de vida normal: mira quins Flash / Flash-Lite hi ha vigents i canvia la constant `GEMINI_MODEL`. Mai la gamma Pro, que és de pagament. |
| `Gemini ha respost amb codi 429` | Quota diària del nivell gratuït esgotada. El correu és a l'arxiu; es pot reenviar demà. |
| `el cartell no s'ha pogut pujar` | Cloudinary ha dit no (mida, format, preset). La fila hi és igualment, sense imatge: el curador la pot afegir a mà. |
| `GitHub ha rebutjat l'escriptura` | Token caducat, mal abastat, o sense `Contents: write`. |

**La invariant:** passi el que passi, l'original acaba al Gmail d'arxiu. El
reenviament és la primera cosa que fa el gestor, abans de tocar cap servei. Si
un correu no s'ha pogut convertir en fila, no s'ha perdut: és a l'arxiu i
l'error és al registre.

## Camí de recanvi — desplegament manual

Segueix funcionant, i no depèn de res de les seccions 1, 2 i 5. Serveix si la
connexió amb Git fa nosa, si vols provar un canvi sense commitar-lo, o si un dia
el camí de Git s'espatlla i el correu no pot esperar. En aquest camí,
`wrangler.jsonc` no el llegeix ningú: el nom, els registres i la resta els
configures al tauler.

Al Worker → **Edit code**. L'editor accepta més d'un fitxer, i si el teu ho
permet és el camí bo:

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

Les dues maneres s'han provat i donen el mateix resultat que el camí de Git.

> Mentre el Worker estigui connectat a Git, l'editor del tauler **no és la font
> de veritat**: la propera empenta que toqui `worker/*` o `wrangler.jsonc`
> substituirà el que hi hagis editat. Els canvis que hagin de durar es fan al
> repositori.
