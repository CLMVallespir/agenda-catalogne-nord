# Auditoria de seguretat — Secció 1: Punts d'entrada oberts

> Àmbit: només codi del repositori `agenda-catalogne-nord`. Revisió defensiva del propi projecte.
> **Cap correcció s'ha aplicat**: aquest document només llista les troballes; en Miquel decideix l'ordre.
> Referència: secció 1 del checklist `docs/auditoria/auditoria-seguretat-agenda-nord.md`.
> Data: 2026-07-04.

**Nota d'entorn (afecta la troballa 1.1-A):** perquè Typebot pugui fer-hi POST, el Web App
d'Apps Script s'ha de desplegar amb «Executa com: jo» + «Qui hi té accés: Qualsevol».
Per tant l'URL `.../exec` és, per disseny, oberta a tothom: **l'única porta possible és un
secret dins la petició**. A més, `doPost(e)` d'Apps Script **no pot llegir capçaleres HTTP**:
el secret ha d'anar al cos JSON o com a paràmetre d'URL, mai en una capçalera.

---

## 1.1 Webhook Typebot → `processBotSubmission()`

### 1.1-A · Cap secret compartit al webhook — **CRÍTICA**

- **Fitxer:línia:** `apps-script/processBotSubmission.gs:45-48`
- **Mancança (1 frase):** `doPost()` parseja el cos i escriu la fila directament, sense comprovar
  cap secret, de manera que qualsevol POST a l'URL pública del Web App afegeix files al full.
- **Correcció concreta:** afegir una Script Property `WEBHOOK_SECRET` (cadena llarga aleatòria),
  fer que el bloc webhook de Typebot l'enviï com a camp `secret` del cos JSON, i comprovar-la a
  `doPost()` abans de processar res, reutilitzant `getSecret()` (ja global, `processNewEmails.gs:460`):

  ```js
  var body = JSON.parse(e.postData.contents);
  var secretRebut = readField(body, 'secret');
  if (secretRebut === '' || secretRebut !== getSecret('WEBHOOK_SECRET')) {
    Logger.log('doPost: petició rebutjada (secret absent o incorrecte).');
    return respostaGenerica(false);   // {ok:false}, sense cap detall
  }
  ```

  El camp `secret` no s'escriu mai al full (el mapatge per nom ja l'ignora) ni al log.

### 1.1-B · Validació d'estructura incompleta — **MITJANA**

El mapatge explícit per nom amb `readField()` (`processBotSubmission.gs:74-93,144-150`) ja compleix
la meitat del check: tot valor esdevé string retallat, `""` si falta, i **les claus no previstes
s'ignoren** (mai arriben a la fila). Queden tres forats:

| | Fitxer:línia | Mancança (1 frase) | Correcció concreta |
|---|---|---|---|
| B1 | `processBotSubmission.gs:80-81` | `comarca` i `categoria` s'escriuen tal com arriben, sense validar contra els enums (la ruta de correu sí que ho fa amb `valorPermes()`, `processNewEmails.gs:386-387`). | Reutilitzar els globals existents: `var comarca = valorPermes(readField(body,'comarca'), COMARCA_VALUES);` i igual per a `categoria` amb `CATEGORIA_VALUES` (definits a `setupSheet.gs:30-31`). |
| B2 | `processBotSubmission.gs:87` | `imatge_url` s'emmagatzema «as-is», acceptant qualsevol cadena encara que no sigui una URL Cloudinary ni `https:`. | Acceptar només el prefix esperat: `if (imatgeUrl.indexOf('https://res.cloudinary.com/') !== 0) { imatgeUrl = ''; }` (el frontend en fa `src`; vegeu també §3). |
| B3 | `processBotSubmission.gs:144-150` | Cap límit de longitud per camp: un POST amb un text enorme s'escriu sencer (i >50.000 caràcters fa petar `appendRow`). | Tallar dins `readField()`: `return String(value).trim().slice(0, 2000);` (2000 cobreix folgadament qualsevol descripció legítima). |

### 1.1-C · Cap límit de repetició — **ALTA**

- **Fitxer:línia:** `apps-script/processBotSubmission.gs:45-58` (cap ús de `CacheService` a tot el repo — verificat)
- **Mancança (1 frase):** el mateix payload repetit N vegades escriu N files: el full pot créixer
  sense fre (encara que hi hagi secret, un bucle de reintents de Typebot també inundaria).
- **Correcció concreta:** comptador per finestra horària amb `CacheService` a `doPost()`, després
  de la comprovació del secret:

  ```js
  var cache = CacheService.getScriptCache();
  var clau = 'webhook-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHH');
  var comptador = Number(cache.get(clau) || 0);
  if (comptador >= 20) {                        // màxim 20 enviaments/hora
    Logger.log('doPost: límit horari assolit (' + comptador + ').');
    return respostaGenerica(false);
  }
  cache.put(clau, String(comptador + 1), 3600);
  ```

  20/hora és folgat per a un formulari d'associacions i talla qualsevol allau.

### 1.1-D · La resposta d'error revela informació interna — **MITJANA**

- **Fitxer:línia:** `apps-script/processBotSubmission.gs:55`
- **Mancança (1 frase):** el `catch` retorna `error.message` al peticionari (p. ex. «Sheet
  "Esdeveniments" not found.»), revelant estructura interna a un emissor no verificat i
  facilitant el sondeig del punt d'entrada.
- **Correcció concreta:** mantenir el detall només a `Logger.log` (línia 53, ja hi és) i
  respondre sempre genèric: `return respostaGenerica(false);` — un helper únic:

  ```js
  // Resposta JSON mínima del webhook: {ok:true} o {ok:false}, res més.
  function respostaGenerica(ok) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: ok }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  ```

---

## 1.2 Ingestió Gmail → `processNewEmails()`

### 1.2-A · Cap filtre de remitent al codi — **MITJANA**

- **Fitxer:línia:** `apps-script/processNewEmails.gs:208-214` (`findIncomingThreads()`; cap crida a `getFrom()` al repo — verificat)
- **Mancança (1 frase):** tot fil amb l'etiqueta `agenda-entrant` es processa igual, vingui de qui
  vingui: el filtre real viu a la configuració de Gmail (fora del codi), i si aquell filtre és ampli,
  qualsevol adreça consumeix una crida a Gemini.
- **Mitigació existent:** tota fila neix `pendent` (`processNewEmails.gs:402`) i passa pel curador;
  el cost és quota de Gemini i temps de revisió, mai publicació directa.
- **Correcció concreta (dues opcions, de menys a més codi):**
  1. *Operativa:* fer el filtre de Gmail restrictiu (p. ex. només `to: adreça-agenda`) i deixar-ho
     documentat a `docs/pas-4-ingestio-correu.md` com a requisit, no com a opció.
  2. *Al codi:* Script Property opcional `REMITENTS_CONFIANCA` (llista separada per comes d'adreces
     o dominis); dins el bucle, si `message.getFrom()` no hi encaixa, etiquetar el fil amb una nova
     etiqueta `agenda-revisar` i **saltar la crida a Gemini**. Atenció: les associacions noves són
     imprevisibles — una llista blanca estricta pot bloquejar remitents legítims, per això l'opció 2
     només té sentit com a «processa igualment però sense IA fins que el curador l'aprovi».

### 1.2-B · Cap límit per remitent — **BAIXA**

- **Fitxer:línia:** `apps-script/processNewEmails.gs:47,154`
- **Mancança (1 frase):** una sola adreça pot omplir el lot sencer de cada cicle i acaparar la quota
  diària de Gemini, tot i que `MAX_THREADS_PER_RUN = 10` ja limita el total a ~240 correus/dia.
- **Mitigació existent:** el tall global de 10 fils/execució (línia 47) ja impedeix l'esgotament
  sobtat; el problema restant és d'*acaparament* (un remitent desplaça els altres), no de desbordament.
- **Correcció concreta:** dins el bucle (línia 158), comptar fils per remitent en aquesta execució
  amb un objecte local (`comptadorPerRemitent[adreca]`); a partir del 3r fil del mateix remitent,
  saltar-lo **sense etiquetar-lo ni marcar-lo llegit**, de manera que quedi a la cua i es processi
  al cicle següent (els excedents s'ajornen sols, sense codi extra).

### 1.2-C · `LockService` — **CORRECTE, cap mancança**

- **Fitxer:línia:** `apps-script/processNewEmails.gs:126-130` (adquisició) i `175-178` (alliberament)
- El lock s'agafa amb `tryLock(0)` **abans** de llegir cap correu, la sortida primerenca si el lock
  és ocupat no toca Gmail, i `releaseLock()` és dins un `finally` que cobreix també el `return`
  anticipat de la línia 146. Exactament el que demana el check.

### 1.2-D · Finestra de reprocessament entre escriure la fila i etiquetar — **BAIXA**

- **Fitxer:línia:** `apps-script/processNewEmails.gs:165-166` (i `escriuFila` a `430-432`)
- **Mancança (1 frase):** si l'execució mor entre `escriuFila()` i `marcaThreadAmbEtiqueta()`
  (p. ex. tall dur als ~6 minuts), el fil queda sense etiqueta ni marca de lectura i el cicle
  següent el reprocessa: fila duplicada amb el mateix `id`.
- **Context:** el disseny és *at-least-once* i és el correcte aquí — invertir l'ordre (etiquetar
  abans d'escriure) perdria correus, que és pitjor que duplicar-ne. Amb 10 fils/execució i feina
  lleugera, la probabilitat de tall a mig lot és molt baixa.
- **Correcció concreta:** guarda de duplicats abans d'escriure, dins `escriuFila()`:

  ```js
  // Si ja existeix una fila amb aquest id (columna A), no la dupliquis.
  var id = fila[0];
  if (id !== '') {
    var trobat = sheet.getRange('A:A').createTextFinder(id).matchEntireCell(true).findNext();
    if (trobat !== null) {
      Logger.log('escriuFila: id duplicat "' + id + '", fila no afegida.');
      return;
    }
  }
  sheet.appendRow(fila);
  ```

  Això també protegeix la ruta Typebot si s'hi reutilitza, i complementa el check de duplicats
  de §6.3 (que mira `events.json` en publicar).

---

## 1.3 Botó «Publica» → `publishToGitHub()`

### 1.3-A · Només cridable des del menú — **CONFIRMAT, cap mancança**

- **Fitxer:línia:** `apps-script/publishToGitHub.gs:30-35` (menú a `onOpen`) i `43` (funció)
- Revalidat avui amb cerca a tot `apps-script/`: l'únic `doPost` del repositori és
  `processBotSubmission.gs:45` i **no existeix cap `doGet`**. `publishToGitHub()` només s'invoca
  des de l'element de menú «Agenda → Publica els esdeveniments aprovats».

### 1.3-B · Doble clic / dos editors alhora — **BAIXA**

- **Fitxer:línia:** `apps-script/publishToGitHub.gs:43-76` (cap lock) i `67-68` (seqüència SHA→PUT)
- **Mancança (1 frase):** dues execucions simultànies poden llegir el mateix SHA i fer dos PUT;
  el segon rep un 409 de GitHub — que **no és silenciós** (el `catch` de les línies 72-75 el mostra
  amb `ui.alert`), però el missatge no explica què ha passat ni què fer.
- **Mitigació existent:** el perdedor veu un error per pantalla; i com que totes dues execucions
  publiquen la mateixa instantània del full, el contingut final és correcte igualment.
- **Correcció concreta:** lock a l'inici de `publishToGitHub()`, seguint el patró ja usat a
  `processNewEmails.gs:126-130`:

  ```js
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    ui.alert('Ja hi ha una publicació en curs. Espera que acabi i torna-ho a provar.');
    return;
  }
  try {
    // ... cos actual de la funció ...
  } finally {
    lock.releaseLock();
  }
  ```

  El tractament explícit del conflicte de SHA (reintent amb SHA fresc) queda per a §5, com indica el checklist.

---

## Resum de la secció 1 (format §8)

| # | Fitxer:línia | Severitat | Mancança (1 frase) | Correcció proposada |
|---|---|---|---|---|
| 1.1-A | `processBotSubmission.gs:45-48` | **Crítica** | El webhook no comprova cap secret: qualsevol POST escriu una fila. | Camp `secret` al cos + Script Property `WEBHOOK_SECRET`, rebuig genèric si no coincideix. |
| 1.1-C | `processBotSubmission.gs:45-58` | **Alta** | Cap límit de repetició: N POST = N files, sense fre. | Comptador horari amb `CacheService`, tall a 20/hora. |
| 1.1-B1 | `processBotSubmission.gs:80-81` | Mitjana | `comarca`/`categoria` sense validar contra els enums. | Reutilitzar `valorPermes()` + `COMARCA_VALUES`/`CATEGORIA_VALUES`. |
| 1.1-B2 | `processBotSubmission.gs:87` | Mitjana | `imatge_url` accepta qualsevol cadena, no només Cloudinary/`https:`. | Acceptar només el prefix `https://res.cloudinary.com/`, si no `""`. |
| 1.1-B3 | `processBotSubmission.gs:144-150` | Mitjana | Cap límit de longitud per camp (>50k caràcters trenca `appendRow`). | `slice(0, 2000)` dins `readField()`. |
| 1.1-D | `processBotSubmission.gs:55` | Mitjana | La resposta d'error retorna `error.message` (detall intern) al peticionari. | Resposta sempre genèrica `{ok:false}`; detall només a `Logger.log`. |
| 1.2-A | `processNewEmails.gs:208-214` | Mitjana | Cap filtre de remitent al codi: el filtre viu (potser) a Gmail. | Filtre de Gmail restrictiu documentat com a requisit, o allowlist opcional que salti la crida IA. |
| 1.2-B | `processNewEmails.gs:47,154` | Baixa | Un sol remitent pot acaparar el lot de 10 fils de cada cicle. | Màxim 3 fils/remitent/execució; els excedents queden a la cua. |
| 1.2-D | `processNewEmails.gs:165-166` | Baixa | Tall dur entre escriure fila i etiquetar → fila duplicada al cicle següent. | Guarda de duplicats per `id` dins `escriuFila()` amb `TextFinder`. |
| 1.3-B | `publishToGitHub.gs:43-76` | Baixa | Dos PUT simultanis: el segon rep un 409 amb un missatge poc clar. | `LockService` + `tryLock(0)` a l'inici, avís «publicació en curs». |

**Checks sense mancança:** 1.2-C (`LockService` correcte: adquisició prèvia + `finally`) i
1.3-A (cap `doGet`/`doPost` extra; `publishToGitHub` només al menú).

> **Recordatori del protocol:** cap d'aquestes correccions s'ha aplicat. Es revisaran totes
> juntes al final (secció 8) i en Miquel triarà l'ordre d'aplicació.
