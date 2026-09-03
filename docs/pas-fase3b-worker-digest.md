# Fase 3b — El Worker: el gestor `scheduled()` (digest Brevo)

Com connectar el digest setmanal al Worker i com verificar-lo. És el **mateix
Worker i el mateix fitxer** de les fases 2 i 3a (`worker/worker.js`): no se'n
crea cap de nou. S'hi afegeixen un gestor (`scheduled()`), un activador cron i
sis Secrets de Brevo.

Prerequisit: la **Fase 3a** ha de ser desplegada i verificada (vegeu
`docs/pas-fase3a-worker-formulari.md`).

El digest és **l'única part del sistema que no escriu res enlloc**. Llegeix
`events.json` per l'API de GitHub, mira quins actes publicats comencen els
propers set dies, i envia un correu per subscriptor a cada comarca que en
tingui. No toca `pendents.json`, no toca `events.json`, no fa cap commit.

---

## Les tres decisions que val la pena entendre

### 1. L'hora: dues hores de cron i un porter

El cron de Cloudflare **és sempre en UTC i no sap res de l'horari d'estiu**. Les
15.00 de París són les **13.00 UTC a l'estiu** i les **14.00 UTC a l'hivern**, i
no hi ha cap manera d'escriure això en una expressió cron.

La solució, en dos temps:

- L'expressió `*/10 13,14 * * 2` desperta el Worker **cada deu minuts durant les
  dues hores candidates dels dimarts** — dotze despertades.
- El gestor `scheduled()` mira **quina hora és a París** (`horaDeParis`) i se'n
  torna a dormir immediatament si no són les 15. Només sis despertades passen el
  porter, i sempre són les de l'hora bona, tant al juny com al desembre.

Una despertada que no passa el porter **no fa cap crida a res**: deixa una línia
al registre i prou.

### 2. La idempotència: el registre de Brevo és l'apunt

L'Apps Script guardava la data del darrer enviament a la Script Property
`DIGEST_DARRER_ENVIAMENT`. Aquí no hi ha ni full de càlcul ni propietats, i
`CLAUDE.md` §3 diu que l'estat viu només a `events.json` i `pendents.json`: no hi
ha lloc on apuntar «ja enviat».

No en calia cap de nou. **El registre d'enviaments del mateix Brevo és l'apunt.**
Cada correu surt etiquetat `digest-AAAA-MM-DD-comarca`, i abans d'enviar res el
Worker es llegeix els enviaments d'avui (`GET /v3/smtp/emails`) i en fa un
conjunt de parelles «etiqueta + adreça».

Això surt **millor** que la propietat antiga, no pitjor:

| | Apps Script | Worker |
|---|---|---|
| Granularitat | per dia | **per persona i comarca** |
| Si l'execució mor a mig camí | uns quants es queden sense digest aquella setmana | **la següent despertada continua per on era** |
| Estat nou a mantenir | una Script Property | **cap** |

I si el registre de Brevo **no es pot llegir**, el digest **no s'envia**. És
deliberat, i és la mateixa regla de sempre del projecte: sense poder garantir una
cosa, val més quedar-se curt. Un digest de menys es nota poc; dos digests a
tothom, molt.

### 3. El pressupost de correus per despertada

El pla gratuït de Cloudflare deixa **50 subpeticions per execució**, i cada
correu enviat n'és una. Per això cada despertada envia com a molt **40 correus**
(`MAX_ENVIAMENTS_PER_EXECUCIO`) i s'atura amb una línia al registre.

No es perd res, precisament perquè la guarda és per persona: la despertada de
d'aquí a deu minuts es baixa el registre de Brevo, veu qui ja el té i continua
amb la resta. Amb sis despertades hi caben uns 240 correus per setmana, per sota
del sostre gratuït de Brevo (300 correus transaccionals al dia).

Si algun dia les llistes creixen més, el registre avisa quan el dia s'acosta als
280 correus. L'alternativa neta, aleshores, són les **campanyes** de Brevo, que
no tenen aquest sostre — però són una altra manera d'enviar i s'ha de decidir a
posta.

---

## 1. Les llistes de Brevo (les crees tu, a mà)

A Brevo, **Contacts → Lists**, crea **cinc llistes**, una per comarca. El nom te
l'inventes («Agenda — Rosselló»); el que importa és l'**id numèric**, que surt a
la mateixa pàgina de llistes i a l'URL quan n'obres una.

Les altes i les baixes les gestiones tu des del tauler de Brevo. El Worker només
llegeix les llistes: no hi crea cap contacte ni n'esborra cap.

Els contactes que Brevo té com a `emailBlacklisted` —han demanat la baixa o el
correu els rebota— **no reben res**. Això ho respecta el codi sol.

## 2. El remitent (i el parany del SPF)

El digest surt de **`agenda@clm.cat`** amb el nom «Agenda cultural de la
Catalunya Nord». Per poder-hi enviar, Brevo demana que el domini estigui
autenticat: **Senders, Domains & Dedicated IPs → Domains → `clm.cat`**, i afegir
els registres DKIM que et doni.

> **Compte amb l'SPF.** `clm.cat` ja té un registre TXT d'SPF que l'Email Routing
> de Cloudflare va posar a la Fase 0. **No en creïs un segon**: un domini només
> pot tenir un registre SPF, i posar-ne dos els trenca tots dos — i amb ells, la
> recepció d'`agenda@clm.cat`. El que has de fer és **editar el que ja hi ha** i
> afegir-hi l'`include` de Brevo:
>
> ```
> v=spf1 include:_spf.mx.cloudflare.net include:spf.brevo.com ~all
> ```
>
> Abans de tocar-lo, copia el valor actual en un fitxer de text. Després de
> tocar-lo, torna a fer la prova de la Fase 0: envia un correu a
> `agenda@clm.cat` des d'un compte de fora i comprova que arriba al Gmail
> d'arxiu.

**L'adreça de resposta del digest NO és `agenda@clm.cat`, i és a posta.** Les
respostes van a **`contacte@clm.cat`**. El motiu és mecànic: `agenda@` el
llegeix el gestor `email()` d'aquest mateix Worker, o sigui que una persona
demanant la baixa acabaria convertida en una fila nova a la cua del curador.

## 3. Els sis Secrets

Worker `agenda-catalogne-nord` → **Settings** → **Variables and Secrets** →
**Add** → tipus **Secret**, sis vegades:

| Nom | Valor |
|---|---|
| `BREVO_API_KEY` | La clau d'API de Brevo (Brevo → SMTP & API → API Keys) |
| `BREVO_LIST_ROSSELLO` | L'id numèric de la llista del Rosselló |
| `BREVO_LIST_CONFLENT` | L'id numèric de la llista del Conflent |
| `BREVO_LIST_VALLESPIR` | L'id numèric de la llista del Vallespir |
| `BREVO_LIST_CAPCIR` | L'id numèric de la llista del Capcir |
| `BREVO_LIST_CERDANYA` | L'id numèric de la llista de la Cerdanya |

Els noms dels Secrets són **sense accents i en majúscules** (`BREVO_LIST_ROSSELLO`)
encara que la comarca es digui «Rosselló». La correspondència la fa el codi, una
per una, a la taula `COMARQUES_BREVO`.

Els ids de llista no són contrasenyes, però van als Secrets i no a
`wrangler.jsonc` perquè **aquest repositori és públic** i són dades del compte.

Recorda el detall de sempre: **un Secret nou no és viu fins que desplegues.** La
pantalla acaba amb un botó **Deploy**.

## 4. L'activador cron

Worker → **Settings** → **Trigger Events** → **Cron Triggers** → **Add Cron
Trigger**:

```
*/10 13,14 * * 2
```

Un de sol. No en posis dos (un per a cada hora UTC): compten per separat contra
el límit de **5 activadors cron per compte** del pla gratuït, i aquesta expressió
ja cobreix les dues hores.

L'expressió també és a `wrangler.jsonc`, sota `triggers.crons`, però **ara mateix
aquell fitxer no el llegeix ningú**: el camí «Connect to Git» està desconnectat a
posta (vegeu `NOTES.md`). Mentre el desplegament es faci a mà des del tauler, el
cron s'ha de posar **al tauler**. Hi és a `wrangler.jsonc` perquè el dia que es
torni a connectar el Git no calgui recordar-se'n.

---

## 5. Verificar la Fase 3b (la porta)

### La prova sense esperar el dimarts

Esperar dimarts a les tres de la tarda per saber si una cosa funciona no és
manera de treballar. Per això el Worker té una **porta de prova**: el mateix
endpoint del formulari, el mateix secret, amb `?digest=prova` a l'URL. Envia el
digest de debò **només a l'adreça d'`ADRECA_ARXIU`** —la teva— i amb una etiqueta
de prova que no toca ni consulta la guarda del digest real.

Des del PowerShell:

```powershell
$url = 'https://agenda-catalogne-nord.<el-teu-subdomini>.workers.dev/?digest=prova'
$caps = @{ 'X-Typebot-Secret' = '<el valor de TYPEBOT_SECRET>' }
Invoke-RestMethod -Uri $url -Method Post -Headers $caps -ContentType 'application/json' -Body '{"comarca":"Vallespir"}'
```

Sense el camp `comarca`, envia una mostra de **cada** comarca que tingui actes
aquesta setmana. La resposta et diu la finestra de dates, quants actes hi ha
entrat i quants correus han sortit:

```json
{ "ok": true, "finestra": "2026-09-01 … 2026-09-08", "actes": 4, "enviats": 1, "comarques": ["Vallespir"] }
```

### La llista de comprovació

- [ ] La prova amb `?digest=prova` arriba al Gmail d'arxiu, amb l'assumpte
      `[PROVA] Agenda cultural — [Comarca] — setmana del [data]`.
- [ ] Al correu, els actes surten **agrupats per dia** sota una capçalera amb un
      punt daurat («2 Setembre, Dimecres · 2 Septembre, Mercredi»), amb l'hora i
      el «Fins al… · Jusqu'au…» en vermell i la categoria com una etiqueta negra.
- [ ] Cada acte porta la descripció catalana i, a sota i en cursiva, la francesa.
- [ ] El peu porta la línia de baixa **en les dues llengües** i l'enllaç a
      `https://agenda.clm.cat`.
- [ ] Si respons al correu, la resposta va a **`contacte@clm.cat`** i no a
      `agenda@clm.cat` (mira el camp «Per a» del teu client de correu).
- [ ] Una comarca **sense actes** aquesta setmana no envia res: no en reps cap
      correu.
- [ ] Amb una llista de prova amb **la teva adreça i prou**, espera el dimarts a
      les 15.00 i comprova que reps **un sol** correu, no sis. (El registre ho
      confirma: cinc línies «a París són les 13/14/16…, no les 15. Cap digest.» i
      una amb els enviaments de debò.)
- [ ] Torna a executar la prova el mateix dia: al registre hi ha de sortir
      «X ja el tenien» i cap correu nou.

### Què hi ha d'haver al registre (Worker → Logs)

Una despertada que no toca:

```
scheduled(): a París són les 14, no les 15. Cap digest.
```

Una despertada bona:

```
enviaDigestComarca(): Vallespir — 12 contactes, 12 enviats, 0 ja el tenien.
enviaDigestSetmanal(): 12 correus en aquesta despertada, 12 en tot el dia.
```

La següent, deu minuts després:

```
enviaDigestComarca(): Vallespir — 12 contactes, 0 enviats, 12 ja el tenien.
enviaDigestSetmanal(): 0 correus en aquesta despertada, 12 en tot el dia.
```

---

## Si alguna cosa falla

| El registre diu | Què passa |
|---|---|
| `falta el secret BREVO_API_KEY.` | El Secret no hi és, o la versió amb el Secret no s'ha desplegat. |
| `falta el secret BREVO_LIST_VALLESPIR` | Aquella comarca no té l'id de llista posat. Les altres quatre s'envien igualment. |
| `el secret BREVO_LIST_… ha de ser un número` | Hi has enganxat el nom de la llista i no l'id. |
| `Brevo (registre d'enviaments) ha respost amb codi 401` | La clau d'API és dolenta o s'ha revocat. **No s'envia res**, a posta. |
| `Brevo (enviament) ha respost amb codi 400` | Sol ser el remitent no verificat, o una adreça de contacte mal formada. Mira el detall que ve després del codi. |
| `no he pogut llegir events.json` | El `GITHUB_TOKEN` ha caducat o ha perdut el permís `contents`. |
| `cap acte publicat entre … i …` | No és cap error: aquella setmana no hi ha res a dir. |
| Cap línia de `scheduled()` en tot el dimarts | L'activador cron no és al tauler, o no s'ha desplegat cap versió després d'afegir-lo. |

---

## El que aquesta fase NO fa

- **No dona d'alta ni de baixa ningú.** Les llistes les portes tu des del tauler
  de Brevo. Quan algú demana la baixa, la treus a mà. Els correus transaccionals
  no porten enllaç de baixa automàtic: per això el peu bilingüe i la capçalera
  `List-Unsubscribe` hi són a tots els missatges.
- **No envia cap campanya.** Un correu transaccional per persona, sempre, perquè
  ningú no vegi l'adreça de ningú.
- **No mira `pendents.json`.** Només surt al digest el que el curador ja ha
  publicat.
- **No mira `data_fi`.** La finestra es decideix amb `data_inici`: una exposició
  que va començar abans d'aquesta setmana i que encara dura **no** hi surt. Era
  així a l'Apps Script i s'ha mantingut. Si algun dia es vol canviar, és una sola
  condició a `llegeixEsdevenimentsDeLaSetmana`.
- **No escriu res enlloc.** Cap commit, cap fila, cap fitxer.
