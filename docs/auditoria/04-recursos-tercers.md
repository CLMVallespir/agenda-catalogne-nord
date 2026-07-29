# Auditoria de seguretat — Secció 4: Ús responsable de recursos de tercers

> Àmbit: només codi i documentació del repositori `agenda-catalogne-nord`. Revisió defensiva del propi projecte.
> **Cap correcció s'ha aplicat**: aquest document només llista les troballes; en Miquel decideix l'ordre.
> Referència: secció 4 del checklist `docs/auditoria/auditoria-seguretat-agenda-nord.md`.
> Data: 2026-07-04.

**Context que acota la secció:** aquí no es protegeixen dades d'usuaris sinó **els quatre comptes
gratuïts de tercers** (Cloudinary, Gemini, GitHub, Brevo): que ningú no pugui consumir-ne la quota,
fer-los despesa o fer-los servir en nom del projecte. Una part de les comprovacions és **de consola**
(configuració que viu als taulers dels serveis, no al repositori): aquestes queden marcades com a
*acció de consola* per a la llista final d'en Miquel, perquè des del codi només se'n pot verificar la
documentació.

---

## 4.1 Cloudinary (preset *unsigned*)

### Check 1 · Límits de mida i format al preset — **MANCANÇA 4-A (mitjana)**

El preset `agenda-posters` és *unsigned* per disseny (decisió 2026-06-12), i el `cloud_name` +
nom del preset són públics: viatgen al codi client del widget de Typebot
(`docs/pas-5-typebot-cartell-cloudinary.md:68`). Això és acceptat — però vol dir que **l'única
defensa del compte és la configuració del preset mateix**, i enlloc no consta que tingui límits:

- `docs/pas-3-cloudinary.md:28-45` (§3, creació del preset): només configura nom, mode
  *Unsigned*, carpeta i *incoming transformation* (`w_800,c_limit,q_80,f_webp`). **Cap «Max file
  size», cap «Allowed formats».**
- La llista de verificació del mateix document (`docs/pas-3-cloudinary.md:62-69`) tampoc no els
  comprova.
- `docs/pas-5-typebot-cartell-cloudinary.md:13-19` (requisits previs) repeteix els mateixos tres
  punts, sense límits.
- L'únic límit existent, `maxFileSize: 8000000`, és **al client** (widget de Typebot,
  `docs/pas-5-typebot-cartell-cloudinary.md:149`): no protegeix el compte, perquè la crida
  directa a `https://api.cloudinary.com/v1_1/CLOUD_NAME/image/upload` amb el preset no hi passa.

La *incoming transformation* redueix el que **es desa**, però processar un fitxer enorme o un
format inesperat també consumeix crèdits del pla gratuït (25/mes).

**Correcció proposada (acció de consola + docs):** al preset `agenda-posters` de la consola de
Cloudinary, fixar **Max file size ≈ 10 MB** i **Allowed formats: `jpg, png, webp, gif, pdf`**
(el `pdf` és necessari: la ruta de correu puja cartells PDF que el preset converteix a WebP,
`apps-script/processNewEmails.gs:237` i `:255-276`). Després, afegir aquests dos camps a la taula
de `docs/pas-3-cloudinary.md` §3 i dues línies a la llista de verificació, i el mateix als
requisits previs de `docs/pas-5-typebot-cartell-cloudinary.md`.

### Check 2 · Alerta d'ús — **MANCANÇA 4-B (baixa)**

Cap document del projecte no menciona activar (ni verificar) una **notificació d'ús** al compte
de Cloudinary; `docs/pas-3-cloudinary.md:14` només diu que 25 crèdits/mes són suficients. Si algú
abusa del preset públic, en Miquel no se n'assabentaria fins a trobar el compte esgotat.

**Correcció proposada (acció de consola + docs):** verificar al tauler de Cloudinary que les
notificacions d'ús per correu són actives (i a quina adreça arriben), i afegir-ho com a punt de
la llista de verificació de `docs/pas-3-cloudinary.md`.

---

## 4.2 Clau de l'API de Gemini

### Check 1 · Cap clau fora de Script Properties — **CORRECTE, cap mancança**

Cerca a tot el repositori (documentació i exemples inclosos):

- Patró `AIza`: **cap coincidència real** (només les dues mencions del patró als documents
  d'auditoria mateixos).
- Cadena `GEMINI_API_KEY`: només el comentari de capçalera (`processNewEmails.gs:31`), la
  lectura via `getSecret('GEMINI_API_KEY')` (`processNewEmails.gs:134`) i les taules de
  propietats de la documentació (`docs/pas-4-ingestio-correu.md:51,107`). Coherent amb
  l'inventari (§0).

### Check 2 · Cap crida a Gemini des del client — **CORRECTE, amb una acció manual**

`gemini`, `generativelanguage` i `x-goog-api-key` no apareixen a `app.js`, `index.html`,
`prova-local.html` ni `docs/prova-local.html`. Tota crida a Gemini passa per Apps Script.

*Acció manual (risc residual mínim):* la comprovació de l'**historial de commits** no s'ha fet
des d'aquí (no s'executa `git` sobre la carpeta muntada per no corrompre'n la configuració). Com
que el frontend no ha tingut mai integració amb Gemini, n'hi ha prou amb una cerca ràpida de
`AIza` a l'historial des del web de GitHub quan es vulgui tancar el punt del tot.

---

## 4.3 Token de GitHub

### Check 1 · Abast mínim — **CORRECTE al codi i als docs; verificació de consola pendent**

- `apps-script/publishToGitHub.gs:15-17`: el comentari de capçalera exigeix *fine-grained token*,
  limitat a aquest repositori, permís «Contents: Read and write».
- `docs/pas-7-publicar.md:21-30`: les instruccions de creació ho compleixen exactament —
  *Repository access: Only select repositories → agenda-catalogne-nord* (línia 27) i *Contents:
  Read and write. Res més.* (línies 28-29).

*Acció de consola:* el que no es pot verificar des del repositori és el **token real** desat a
`GITHUB_TOKEN`: cal confirmar a GitHub (Settings → Developer settings → Fine-grained tokens) que
el token viu és el creat amb aquestes instruccions i no un token clàssic antic.

### Check 2 · Caducitat del token — **MANCANÇA 4-C (baixa)**

El flux actual no falla en silenci: `obtenirShaActual()` i `pujaFitxerAGitHub()` llancen error
amb el codi HTTP (`publishToGitHub.gs:176-177` i `:208-211`) i el `catch` del punt d'entrada el
mostra al curador amb `ui.alert` (`publishToGitHub.gs:72-75`). A més, `docs/pas-7-publicar.md:62`
documenta «Codi 401 → el token és incorrecte o ha caducat».

La mancança és de **claredat, no de detecció**: el curador veu «No he pogut llegir events.json de
GitHub (codi 401)» seguit del JSON cru de GitHub, i ha d'anar a la documentació a traduir-ho. El
token caduca al cap d'un any i l'únic recordatori és «apunta't la data»
(`docs/pas-7-publicar.md:26`).

**Correcció proposada:** a `obtenirShaActual()` i `pujaFitxerAGitHub()`, si el codi és `401` o
`403`, llançar un missatge específic: «El token de GitHub ha caducat o s'ha revocat. Renova
GITHUB_TOKEN seguint docs/pas-7-publicar.md §1.» (la resta de codis queden com ara). I a
`docs/pas-7-publicar.md` §1.3, afegir «posa't un recordatori al calendari un parell de setmanes
abans» al costat d'«apunta't la data».

---

## 4.4 Brevo

### Check 1 · Secrets a Script Properties — **CORRECTE, cap mancança**

Les vuit propietats (clau, remitent i nom, i els cinc ids de llista) es documenten al comentari
de capçalera (`sendWeeklyDigest.gs:33-42`) i es llegeixen només via `getSecret()`
(`sendWeeklyDigest.gs:96,153-154,331`). La clau només viatja a la capçalera `api-key`
(`sendWeeklyDigest.gs:420,461`) i mai no s'escriu al registre. L'id de llista es valida com a
nombre abans d'anar a l'URL (`idDeLlistaPerComarca`, `sendWeeklyDigest.gs:329-336`). Coherent amb
l'inventari (§0).

### Check 2 · Guarda contra el doble enviament — **MANCANÇA 4-D (mitjana)**

`sendWeeklyDigest()` (`sendWeeklyDigest.gs:94-145`) **no té cap guarda d'idempotència**: ni
registre de «darrer enviament» ni `LockService` (a diferència de `processNewEmails()`). Si el
*trigger* setmanal s'executa dues vegades (reintent de Google, o una execució manual el mateix
dimarts per fer una prova), **tots els subscriptors reben el digest per duplicat** — i, en model
transaccional, això són centenars de crides a l'API de Brevo repetides.

**Correcció proposada (~10 línies, cap dependència nova):** una Script Property
`DIGEST_DARRER_ENVIAMENT` amb la data `yyyy-MM-dd`. A l'inici de `sendWeeklyDigest()` (després de
llegir els secrets, `sendWeeklyDigest.gs:97`), si el valor és la data d'avui, `Logger.log` i
`return`; en acabar el bucle de comarques (`sendWeeklyDigest.gs:141`), escriure-hi la data d'avui.
*Límit conegut i acceptat:* si l'script petés a mig bucle, un reintent tornaria a enviar a les
comarques ja servides; la protecció per comarca seria més fina però més complexa, i el registre
per data cobreix els dos casos reals (reintent del trigger i doble execució manual).

---

## Resum de la secció 4 (format §8)

| # | Fitxer:línia | Severitat | Mancança (1 frase) | Correcció proposada |
|---|---|---|---|---|
| 4-A | `docs/pas-3-cloudinary.md:28-45` (+ consola Cloudinary) | Mitjana | El preset *unsigned* públic no té límits de mida ni de format; l'únic límit (8 MB) és al client i no protegeix el compte. | Al preset: *Max file size* ≈ 10 MB i *Allowed formats* `jpg,png,webp,gif,pdf`; reflectir-ho a pas-3 i pas-5. |
| 4-B | `docs/pas-3-cloudinary.md` (checklist §4) | Baixa | Cap alerta d'ús configurada ni documentada: un abús del preset es descobriria amb la quota esgotada. | Verificar les notificacions d'ús al tauler i afegir-ho a la checklist de pas-3. |
| 4-C | `apps-script/publishToGitHub.gs:176-177,208-211` | Baixa | Un 401/403 (token caducat o revocat) es mostra com a error genèric amb JSON cru, sense dir què fer. | Missatge específic per a 401/403 («renova GITHUB_TOKEN, pas-7 §1») + recordatori de calendari a pas-7. |
| 4-D | `apps-script/sendWeeklyDigest.gs:94-145` | Mitjana | Cap guarda d'idempotència: un trigger repetit o una execució manual el mateix dia duplica el digest a tots els subscriptors. | Script Property `DIGEST_DARRER_ENVIAMENT` (data `yyyy-MM-dd`): sortir si ja s'ha enviat avui, escriure-la en acabar. |

**Checks sense mancança:** 4.2 sencer (cap rastre de clau al repositori; cap crida Gemini al
client), 4.3 check 1 (token documentat amb abast mínim) i 4.4 check 1 (secrets de Brevo tots a
Script Properties, clau mai al registre).

**Accions de consola per a en Miquel (no verificables des del repositori):**

1. Cloudinary → Settings → Upload presets → `agenda-posters`: fixar mida màxima i formats (4-A).
2. Cloudinary → notificacions d'ús actives i a l'adreça correcta (4-B).
3. GitHub → Fine-grained tokens: confirmar que el token viu és el de pas-7 §1 (abast mínim).
4. GitHub (web) → cerca de `AIza` a l'historial de commits per tancar 4.2 del tot.

> **Recordatori del protocol:** cap d'aquestes correccions s'ha aplicat. Es revisaran totes
> juntes al final (secció 8) i en Miquel triarà l'ordre d'aplicació.
