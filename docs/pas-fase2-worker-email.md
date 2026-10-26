# El Worker: desplegament i gestor `email()`

Com desplegar l'únic Worker del projecte i verificar-ne el gestor de correu. El
desplegament és **només manual**: s'enganxa `worker/worker-concatenat.js` al
tauler de Cloudflare. El Git Build és desconnectat a posta (vegeu `NOTES.md`,
«Dues vies de desplegament alhora es trepitgen en silenci»).

Prerequisit: Email Routing viu a `clm.cat`, amb `agenda@clm.cat` creada i la
destinació de l'arxiu verificada i provada des d'un compte de fora.

## Els fitxers

| Fitxer | Què és |
|---|---|
| `worker/worker.js` | El codi del projecte. És el que llegiràs i arreglaràs. |
| `worker/postal-mime.js` | Dependència vendoritzada (parser de MIME). **No l'editis.** Versió, URL d'origen i sha256 són a la seva capçalera. |
| `worker/worker-concatenat.js` | **Generat.** Els dos fitxers de dalt en un de sol: `postal-mime.js` sense la línia `export default PostalMime;`, un bàner, i `worker.js` sense la línia de l'`import`. És el que s'enganxa. |

## 1. Desplegar

1. Comprova que el concatenat és al dia i que els enums quadren:
   ```
   node eines/verifica-worker-concatenat.js
   node eines/verifica-enum.js
   ```
   Tots dos han de sortir en verd. Si el primer falla, el concatenat no
   correspon al `worker.js` d'ara: torna'l a generar abans de res.
2. Tauler de Cloudflare → **Workers & Pages** → `agenda-catalogne-nord` →
   **Edit code**.
3. Esborra tot el que hi ha a l'editor i enganxa-hi **sencer**
   `worker/worker-concatenat.js`. Surten unes 7 100 línies: és normal.
4. **Deploy**.

Mai no editis el codi al tauler: un pedaç fet allà, o al concatenat, es perd la
propera vegada que es regeneri. Es toca `worker.js`, es regenera el concatenat
al mateix commit i s'enganxa.

## 2. La configuració, al tauler

Tota la configuració viu al tauler del Worker (**Settings**), perquè és allà on
la llegeix el desplegament manual. Cap valor al codi ni a Git.

**Secrets** (Settings → **Variables and Secrets**, tipus **Secret**):

| Nom | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | La clau de l'API d'Anthropic (platform.claude.com → API keys), creada al workspace que té el límit de despesa (§3 de `CLAUDE.md`) |
| `GITHUB_TOKEN` | Token de gra fi, **només** el repositori `agenda-catalogne-nord`, permís únic `Contents: Read and write` (vegeu `README.md`) |
| `ADRECA_ARXIU` | El Gmail d'arxiu. **Ha de ser una destinació verificada** a l'Email Routing, si no el reenviament falla |
| `TYPEBOT_SECRET` | El secret compartit del webhook del formulari (`docs/pas-fase3a-worker-formulari.md`) |
| `BREVO_API_KEY`, `BREVO_LIST_*` | El digest (`docs/pas-fase3b-worker-digest.md`) |

`ADRECA_ARXIU` és Secret tot i que una adreça de correu no és cap contrasenya:
aquest repositori és públic, i l'adreça personal del propietari no hi ha de
sortir.

**Una variable de text** (mateixa pantalla, tipus **Text**):
`CLOUDINARY_CLOUD_NAME` = `clm-agenda`. No és secreta: el nom del cloud surt a
l'URL de cada cartell del web públic. Si falta, la pujada del cartell falla i la
fila entra sense imatge, sense cap error que ho relacioni.

**L'activador cron** del digest (Settings → **Trigger Events** → **Cron
Triggers**): `*/10 13,14 * * 2`, i **un de sol**.

**Els registres** (Settings → **Observability**): Workers Logs engegat, perquè
es guardin els dels últims **3 dies** i no només el flux en directe.

Quan afegeixes o canvies un Secret, **el canvi no és viu fins que desplegues**:
els valors formen part de la versió del Worker. Si el registre diu que falta una
variable que has posat, mira primer Worker → **Deployments**.

## 3. Enganxar el Worker a l'adreça

Cloudflare → el domini `clm.cat` → **Email** → **Email Routing** → **Routing
rules** → la regla d'`agenda@clm.cat` → **Edit**:

- **Action:** `Send to a Worker`
- **Destination:** `agenda-catalogne-nord`

A partir d'aquí el correu d'`agenda@clm.cat` ja **no** va directament al Gmail:
hi arriba reenviat pel Worker.

## 4. Verificar el gestor de correu

Envia els correus **des d'un compte de fora** (no des del Gmail d'arxiu). Els
registres són al Worker → **Logs**.

1. **Correu real amb cartell.** Un correu amb dates, lloc i un cartell adjunt
   (imatge o PDF). Comprova:
   - una fila nova a `pendents.json` al GitHub, amb `imatge_url` apuntant a
     `res.cloudinary.com`;
   - un commit nou que diu «Correu nou a la cua: …»;
   - l'original al Gmail d'arxiu.
2. **Correu escombraria o buit.** Comprova que **arriba igualment al Gmail** i
   que als registres no hi ha cap error no controlat. Un correu sense gens de
   text no crea cap fila i el registre ho diu: «correu sense text. Arxivat,
   sense fila.»
3. **De punta a punta.** Obre `curador.html`, enganxa-hi el token, i publica la
   fila del punt 1. Ha d'aparèixer a `events.json` i, un minut després, al web
   públic.

Per jutjar el prompt sense enviar res, hi ha tres correus de prova a
`prompts/exemples-test/`.

## Si alguna cosa falla

Tot passa pels registres del Worker, i tots els missatges comencen pel nom de la
funció. Les claus no s'hi escriuen mai.

| Al registre hi diu | Què vol dir |
|---|---|
| `falta la variable ADRECA_ARXIU` | El Secret no hi és. És l'únic cas en què el Worker **rebutja** el correu en comptes de processar-lo: sense adreça d'arxiu no hi ha manera de desar l'original, i val més que el remitent rebi un avís de no-entrega. Posa el Secret, desplega i demana-li que el torni a enviar. |
| «falta la variable…» i jures que la vas posar | Tres causes, per ordre de probabilitat. **(1)** El canvi al tauler no s'ha desplegat: mira Worker → **Deployments**. **(2)** És al Worker equivocat, o el nom no és exacte — cap accent, cap espai al final. **(3)** L'entrada del registre és d'abans que ho arreglessis: se'n guarden 3 dies, mira l'hora. |
| `el reenviament ha fallat` | L'adreça d'arxiu no és una destinació verificada a l'Email Routing. |
| `Claude ha respost amb codi 404` | Anthropic ha retirat el model. Cicle de vida normal: mira quin Haiku hi ha vigent i canvia la constant `CLAUDE_MODEL`. Haiku i prou: els altres models costen vint vegades més. |
| `Claude ha respost amb codi 401` | La clau `ANTHROPIC_API_KEY` no és bona: mal copiada, revocada o caducada. |
| `Claude ha respost amb codi 429`, `402`, o `400` amb «API usage limits» o «credit balance» | S'ha acabat el crèdit del mes o s'ha arribat al límit de despesa; un 429 també pot ser el límit per minut. El missatge diu quan torna l'accés. El correu és a l'arxiu i es pot reenviar llavors. |
| `el cartell no s'ha pogut pujar` | Cloudinary ha dit no (mida, format, preset) o falta `CLOUDINARY_CLOUD_NAME`. La fila hi és igualment, sense imatge: el curador la pot afegir a mà. Si és un PDF que no es veu, a Cloudinary: Settings → Security → «Allow delivery of PDF and ZIP files». |
| `GitHub ha rebutjat l'escriptura` | Token caducat, mal abastat, o sense `Contents: write`. |

**La invariant:** passi el que passi, l'original acaba al Gmail d'arxiu. El
reenviament és la primera cosa que fa el gestor, abans de tocar cap servei. Si
un correu no s'ha pogut convertir en fila, no s'ha perdut: és a l'arxiu i
l'error és al registre.

I si no hi ha on arxivar-lo, perquè falta `ADRECA_ARXIU`, el correu es rebutja
amb un avís bilingüe en comptes d'arxivar-se: el remitent sap que no ha arribat
i el pot tornar a enviar. És un rebuig permanent, o sigui que el seu servidor no
ho reintentarà sol — ho ha de fer la persona, i per això el text del rebuig li
diu què fer. Un correu empassat en silenci és l'única cosa que aquest disseny no
es permet.
