# Auditoria de seguretat — Secció 5: Integritat de `events.json` (la font de veritat)

> Àmbit: només codi i documentació del repositori `agenda-catalogne-nord`. Revisió defensiva del propi projecte.
> **Cap correcció s'ha aplicat**: aquest document només llista les troballes; en Miquel decideix l'ordre.
> Referència: secció 5 del checklist `docs/auditoria/auditoria-seguretat-agenda-nord.md`.
> Data: 2026-07-04.

**Context que acota la secció:** `events.json` al repositori de GitHub és el registre publicat —
el que serveix GitHub Pages i el que llegeix `app.js`. La secció verifica que només s'hi escriu
pel camí previst, que l'escriptura no trepitja canvis concurrents, i que un error d'escriptura
no passa mai desapercebut. Veredicte global: **el mecanisme és correcte**; l'única troballa és
una conseqüència del model de publicació que convé deixar escrita.

---

## Check 1 · SHA llegit just abans del PUT — **CORRECTE, cap mancança**

La seqüència viu sencera dins d'una mateixa invocació de `publishToGitHub()`:

- `publishToGitHub.gs:67` — `var shaActual = obtenirShaActual(owner, token);` (GET del SHA viu).
- `publishToGitHub.gs:68` — `pujaFitxerAGitHub(..., shaActual, ...)` (el PUT, a la línia següent).

El SHA **no es desa enlloc** entre execucions (cap variable global, cap Script Property, cap
`CacheService`): cada clic del menú rellegeix el SHA de zero. La finestra GET→PUT queda reduïda
a mil·lisegons, i si tot i així dos escriptors coincideixen, GitHub rebutja el segon PUT amb un
409 — que el codi tracta (check 2). El cas «dos editors o doble clic» ja té troballa pròpia a la
secció 1 (**1.3-B**, baixa: `LockService` + `tryLock(0)` a l'inici); res a afegir-hi aquí.

*Cas límit, no aplicable:* si `events.json` no existís al repositori, `obtenirShaActual()`
llançaria error (GET 404, `publishToGitHub.gs:176-177`) i no es podria publicar mai. El fitxer
existeix des del Pas 6 i el flux no el pot esborrar, així que queda com a nota.

## Check 2 · PUT fallit: detectat i avisat — **CORRECTE, cap mancança nova**

Cap camí de fallada és silenciós:

- `pujaFitxerAGitHub()` llança error per **qualsevol** codi que no sigui 200/201
  (`publishToGitHub.gs:208-211`), amb el codi HTTP i la resposta de GitHub al missatge.
- El `catch` del punt d'entrada el mostra **sempre** al curador amb `ui.alert`
  (`publishToGitHub.gs:72-75`), a més del `Logger.log`. El full no queda mai «publicat» amb
  el web desactualitzat sense que en Miquel hagi vist una finestra d'error.
- El conflicte de versions concret està documentat: «Codi 409 → conflicte de versions: torna a
  clicar el botó» (`docs/pas-7-publicar.md:66`). Tornar a clicar funciona perquè el SHA es
  rellegeix a cada publicació (check 1).

*Ampliació recomanada de 4-C (cap troballa nova):* la correcció 4-C (missatge específic per a
401/403) pot cobrir també el 409 amb una línia més — «Conflicte de versions: torna a clicar el
botó» — perquè el curador no hagi d'anar a la documentació a traduir el codi.

## Check 3 · Només `publishToGitHub()` escriu a `events.json` — **CONFIRMAT, cap mancança**

Cerca a tot el repositori (fora `img/`, exclòs per decisió de l'abast):

- **Únic PUT a l'API de GitHub:** `publishToGitHub.gs:201`. Les altres crides sortints dels
  `.gs` són Cloudinary POST (`processNewEmails.gs:267`), Gemini POST (`processNewEmails.gs:309`),
  Brevo GET/POST (`sendWeeklyDigest.gs:418,458`) i el GET del SHA (`publishToGitHub.gs:170`).
  Cap altra funció no coneix `GITHUB_FILE_PATH` ni `api.github.com`.
- **Única via d'invocació:** l'element de menú «Publica els esdeveniments aprovats»
  (`publishToGitHub.gs:33`, dins `onOpen()`). Cap trigger no hi apunta (els dos únics triggers
  del projecte són `processNewEmails`, `processNewEmails.gs:493`, i `sendWeeklyDigest`,
  `sendWeeklyDigest.gs:850`), i cap `doGet`/`doPost` no hi arriba (l'únic `doPost` és el webhook
  de Typebot, `processBotSubmission.gs:45`, que només escriu al full).
- **El frontend només llegeix:** `app.js:70` retorna el nom del fitxer per al `fetch`; les
  mencions a `prova-local.html:546` i `docs/prova-local.html:213` són comentaris (dades
  incrustades, cap escriptura).

*Control positiu que reforça la integritat:* publicar **zero** esdeveniments (que buidaria
l'agenda pública) demana confirmació explícita abans de continuar (`publishToGitHub.gs:50-59`).

---

## Troballa 5-A · Les edicions manuals a GitHub es perden en publicar — **BAIXA**

Conseqüència del model «el full mana»: `publishToGitHub()` **regenera el fitxer sencer** des del
full (`llegeixEsdevenimentsPublicats()` + `JSON.stringify`, `publishToGitHub.gs:61`) i el
substitueix amb un únic PUT. El SHA fresc del check 1 evita trepitjar un canvi **concurrent**,
però no protegeix un canvi manual fet **abans**: si en Miquel corregeix una errata directament a
`events.json` des del web de GitHub i no la corregeix també al full, la següent publicació la
reverteix **en silenci** (amb SHA vàlid i sense cap error). És el comportament dissenyat — el
full és l'upstream de revisió — però enlloc no està escrit, i d'aquí un any pot semblar un
misteri.

**Correcció proposada (només documentació):** una línia d'avís a `docs/pas-7-publicar.md`
(secció «Si alguna cosa falla» o al costat de la verificació): «No editis mai `events.json`
directament a GitHub: qualsevol canvi manual es perd a la següent publicació. Corregeix sempre
al full de càlcul i torna a publicar.»

---

## Resum de la secció 5 (format §8)

| # | Fitxer:línia | Severitat | Mancança (1 frase) | Correcció proposada |
|---|---|---|---|---|
| 5-A | `publishToGitHub.gs:61-68` (comportament) | Baixa | Una edició manual d'`events.json` a GitHub es reverteix en silenci a la següent publicació (el fitxer es regenera sencer des del full). | Avís a `docs/pas-7-publicar.md`: no editar mai `events.json` a mà; corregir al full i republicar. |

**Checks sense mancança:** check 1 (SHA rellegit a cada invocació, línies 67→68 consecutives;
la carrera de doble clic ja és 1.3-B), check 2 (cap fallada silenciosa: error llançat per a tot
codi ≠ 200/201 i mostrat sempre amb `ui.alert`; 409 documentat a pas-7:66), check 3 (únic PUT al
repositori, únic punt d'invocació al menú, cap trigger ni endpoint alternatiu, frontend només de
lectura).

**Notes creuades:** ampliar la correcció 4-C perquè el missatge específic cobreixi també el 409
(«torna a clicar el botó»); la troballa 1.3-B (`LockService` al botó) completa el check 1.

> **Recordatori del protocol:** cap d'aquestes correccions s'ha aplicat. Es revisaran totes
> juntes al final (secció 8) i en Miquel triarà l'ordre d'aplicació.
