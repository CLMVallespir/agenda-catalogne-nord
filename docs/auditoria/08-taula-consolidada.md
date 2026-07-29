# Auditoria de seguretat — Secció 8: Taula final consolidada

> Àmbit: només codi i documentació del repositori `agenda-catalogne-nord`. Revisió defensiva del propi projecte.
> **Cap correcció s'ha aplicat.** Aquest document només llista i ordena les troballes de tot l'audit; **en Miquel decideix l'ordre d'aplicació**.
> Referència: secció 8 del checklist `docs/auditoria/auditoria-seguretat-agenda-nord.md`, consolidant les seccions 1–6 (`01-`…`06-`).
> Data: 2026-07-04.

---

## Resum executiu

L'audit ha recorregut sis seccions (punts d'entrada, entrada cap a Gemini, frontend, recursos de tercers, integritat d'`events.json`, lògica del flux) i ha produït **22 troballes**. Cap no s'ha corregit: el protocol acordat és revisar-les totes juntes aquí i triar quines entren abans del llançament.

| Severitat | Nombre | Troballes |
|---|---|---|
| **Crítica** | 1 | 1.1-A |
| **Alta** | 1 | 1.1-C |
| **Mitjana** | 9 | 1.1-B1, 1.1-B2, 1.1-B3, 1.1-D, 1.2-A, 2.1-A, 3-A, 4-A, 4-D |
| **Baixa** | 11 | 1.2-B, 1.2-D, 1.3-B, 2.2-D, 3-B, 3-C, 4-B, 4-C, 5-A, 6-A, 6-B |

Lectura de conjunt: **una sola porta oberta de debò** (el webhook públic sense secret, 1.1-A) i **un sol risc de consum** clar (allau de POST repetits, 1.1-C). La resta és enduriment de validació, degradació segura de valors inesperats i claredat d'errors — feina de baix risc, majoritàriament barata, i bona part encadenable amb el cablejat encara pendent dels passos 4/5/7/9.

---

## Taula consolidada (ordenada per severitat)

| # | ID | Severitat | Fitxer:línia | Mancança (1 frase) | Correcció proposada | Tipus · esforç |
|---|---|---|---|---|---|---|
| 1 | **1.1-A** | **Crítica** | `processBotSubmission.gs:45-48` | El webhook no comprova cap secret: qualsevol POST a l'URL pública escriu una fila al full. | Camp `secret` al cos JSON + Script Property `WEBHOOK_SECRET`; rebuig genèric si no coincideix (reutilitza `getSecret()`). | Codi · ~10 lín + bloc Typebot |
| 2 | **1.1-C** | **Alta** | `processBotSubmission.gs:45-58` | Cap límit de repetició: N POST = N files, sense fre (també un bucle de reintents de Typebot inundaria). | Comptador horari amb `CacheService`, tall a 20/hora. | Codi · ~8 lín |
| 3 | 1.1-B1 | Mitjana | `processBotSubmission.gs:80-81` | `comarca`/`categoria` s'escriuen sense validar contra els enums (la ruta de correu sí ho fa). | Reutilitzar `valorPermes()` + `COMARCA_VALUES`/`CATEGORIA_VALUES`. | Codi · ~2 lín |
| 4 | 1.1-B2 | Mitjana | `processBotSubmission.gs:87` | `imatge_url` accepta qualsevol cadena, no només una URL Cloudinary `https:`. | Acceptar només el prefix `https://res.cloudinary.com/`, si no `""`. | Codi · ~1 lín |
| 5 | 1.1-B3 | Mitjana | `processBotSubmission.gs:144-150` | Cap límit de longitud per camp (>50k caràcters fa petar `appendRow`). | `slice(0, 2000)` dins `readField()`. | Codi · ~1 lín |
| 6 | 1.1-D | Mitjana | `processBotSubmission.gs:55` | La resposta d'error retorna `error.message` (detall intern) a un emissor no verificat. | Resposta sempre genèrica `{ok:false}`; detall només a `Logger.log` (helper `respostaGenerica`). | Codi · ~8 lín |
| 7 | 1.2-A | Mitjana | `processNewEmails.gs:208-214` | Cap filtre de remitent al codi: qualsevol adreça a `agenda-entrant` consumeix una crida a Gemini. | Filtre de Gmail restrictiu documentat com a requisit, o allowlist opcional que salti la crida IA. | Docs / Codi opcional |
| 8 | 2.1-A | Mitjana | `extract-event.txt:52` + `processNewEmails.gs:114,291` | El bloc del correu no es declara «només dades» ni té delimitador de tancament (instruccions incrustades). | Regla 6 anti-instruccions + línia `FI DEL CORREU`, **als dos fitxers alhora**. | Prompt+Codi · 2 fitxers |
| 9 | 3-A | Mitjana | `app.js:311` (+ `prova-local.html:908`, `docs/prova-local.html:492`) | `font_url` va a `href` sense validar l'esquema: un esquema no segur s'executaria en clicar. | Helper `esUrlHttp()` (`/^https?:\/\//i`); si no passa, títol en text pla. | Codi (frontend) · 3 còpies |
| 10 | 4-A | Mitjana | `docs/pas-3-cloudinary.md:28-45` (+ consola Cloudinary) | El preset *unsigned* públic no té límits de mida ni format; l'únic límit (8 MB) és al client i no protegeix el compte. | Al preset: *Max file size* ≈ 10 MB i *Allowed formats* `jpg,png,webp,gif,pdf`; reflectir-ho a pas-3 i pas-5. | Consola + Docs |
| 11 | 4-D | Mitjana | `sendWeeklyDigest.gs:94-145` | Cap guarda d'idempotència: un trigger repetit o una execució manual el mateix dia duplica el digest a tots els subscriptors. | Script Property `DIGEST_DARRER_ENVIAMENT` (`yyyy-MM-dd`): sortir si ja s'ha enviat avui; escriure-la en acabar. | Codi · ~10 lín |
| 12 | 1.2-B | Baixa | `processNewEmails.gs:47,154` | Un sol remitent pot acaparar el lot de 10 fils de cada cicle (desplaça els altres). | Màxim 3 fils/remitent/execució; els excedents queden a la cua per al cicle següent. | Codi · petit |
| 13 | 1.2-D | Baixa | `processNewEmails.gs:165-166` | Tall dur entre escriure la fila i etiquetar → el cicle següent reprocessa: fila duplicada amb el mateix `id`. | Guarda de duplicats per `id` dins `escriuFila()` amb `TextFinder`. | Codi · ~10 lín |
| 14 | 1.3-B | Baixa | `publishToGitHub.gs:43-76` | Dos PUT simultanis (doble clic / dos editors): el segon rep un 409 amb un missatge poc clar. | `LockService` + `tryLock(0)` a l'inici, avís «publicació en curs». | Codi · ~8 lín |
| 15 | 2.2-D | Baixa | `processNewEmails.gs:221-231` | El correu s'envia sencer a Gemini, sense límit de mida (un PDF enganxat malgasta quota). | `slice(0, 20000)` dins `extreuTextCorreu()`. | Codi · 1 lín |
| 16 | 3-B | Baixa | `app.js:269` (+ `prova-local.html:866`, `docs/prova-local.html:542`) | `imatge_url` va a `src` sense comprovació d'esquema ni d'origen. | `esUrlHttp()` o, millor, prefix estricte `https://res.cloudinary.com/` (coherent amb 1.1-B2). | Codi (frontend) · 3 còpies |
| 17 | 3-C | Baixa | `app.js:298-300` | Cerca de propietat amb clau de dades que alimenta `innerHTML` (propietats heretades → brossa inerta, no executable). | `hasOwnProperty.call()` abans de llegir la icona. | Codi (frontend) · petit |
| 18 | 4-B | Baixa | `docs/pas-3-cloudinary.md` (checklist) | Cap alerta d'ús configurada ni documentada: un abús del preset es descobriria amb la quota ja esgotada. | Verificar les notificacions d'ús al tauler i afegir-ho a la checklist de pas-3. | Consola + Docs |
| 19 | 4-C | Baixa | `publishToGitHub.gs:176-177,208-211` | Un 401/403 (token caducat o revocat) es mostra com a error genèric amb JSON cru, sense dir què fer. | Missatge específic per a 401/403 («renova `GITHUB_TOKEN`, pas-7 §1») + recordatori de calendari. **Extensió:** cobrir també el 409 («torna a clicar el botó», vegeu 5-A). | Codi + Docs |
| 20 | 5-A | Baixa | `publishToGitHub.gs:61-68` (comportament) | Una edició manual d'`events.json` a GitHub es reverteix en silenci a la següent publicació (el fitxer es regenera sencer des del full). | Avís a `docs/pas-7-publicar.md`: no editar mai `events.json` a mà; corregir al full i republicar. | Docs |
| 21 | 6-A | Baixa | `publishToGitHub.gs:114-143` (+ `creaId`, `processBotSubmission.gs:178-181`) | Dos esdeveniments poden compartir `id` (slug de 3 paraules): targetes duplicades avui, col·lisió de clau latent demà. | Comprovació de duplicats a `publishToGitHub()`: `ui.alert` amb la llista d'`id` repetits + SÍ/NO (com la confirmació de llista buida). | Codi · ~15 lín |
| 22 | 6-B | Baixa | `processNewEmails.gs:381-383` i `processBotSubmission.gs:75-77` | `data_inici`/`data_fi`/`hora` s'escriuen sense validar el format: una data malmesa i publicada desapareix del web en silenci. | Helpers `dataValida()`/`horaValida()` a les dues rutes; si no compleix, `""` (visible com a incomplet a la revisió). | Codi · ~12 lín · 2 rutes |

---

## Ordre d'aplicació suggerit (proposta — tu decideixes)

La taula de dalt va **per severitat**. Però per a un projecte d'una sola persona, aplicar-les **agrupades per fitxer i alineades amb els passos de cablejat que encara falten** (4/5/7/9) estalvia obrir i tancar els mateixos fitxers diverses vegades. Aquesta és la proposta; canvia-la lliurement.

**Tanda 1 — Abans d'obrir el webhook Typebot al públic (pas 5).** `1.1-A` (crítica) i `1.1-C` (alta) viuen totes dues a `doPost()`: són la porta d'entrada i s'han de tancar abans que l'URL `.../exec` sigui pública. Aprofita la mateixa sessió al fitxer per fer també `1.1-B1`, `1.1-B2`, `1.1-B3` i `1.1-D` (totes a `processBotSubmission.gs`, molt barates). → **6 troballes, un sol fitxer.**

**Tanda 2 — Abans d'activar la ingesta de correu (pas 4).** `2.1-A` (prompt + còpia al codi, els dos alhora), `2.2-D` (límit de mida), `1.2-A` (filtre de remitent), `1.2-B` (acaparament), `1.2-D` (guarda de duplicats). Totes al camí del correu (`processNewEmails.gs` + prompt). → **5 troballes.**

**Tanda 3 — Frontend, en una sola sessió.** `3-A`, `3-B`, `3-C`. L'helper `esUrlHttp()` serveix per a 3-A i 3-B alhora. **Atenció:** 3-A i 3-B s'han de replicar a les **tres còpies** (`app.js`, `prova-local.html`, `docs/prova-local.html`) o assumir que les previsualitzacions queden sense endurir. → **3 troballes, 3 fitxers.**

**Tanda 4 — Publicació i integritat (pas 7).** `1.3-B` (lock al botó), `4-C` (missatge 401/403 **+ 409**), `6-A` (duplicats d'`id` en publicar), `6-B` (format de dates), `5-A` (avís als docs). Girem al voltant de `publishToGitHub.gs` + `docs/pas-7-publicar.md`; `4-C` i `5-A` toquen tots dos aquell doc, fes-los junts. → **5 troballes.**

**Tanda 5 — Consola i digest (independent, pot anar en paral·lel).** `4-A` i `4-B` són accions a la consola de Cloudinary + docs, no toquen codi: es poden fer avui mateix. `4-D` (idempotència del digest) és codi, però lligat al pas 9 (Brevo), encara bloquejat. → **3 troballes.**

---

## Dependències i agrupacions a no perdre de vista

Quan triïs l'ordre, aquests lligams eviten feina repetida o oblits:

- **Mateixa validació, dos extrems del tub:** `1.1-B2` (entrada Typebot) i `3-B` (sortida frontend) validen el mateix `imatge_url`. Decideix **una** regla canònica (prefix `https://res.cloudinary.com/`) i aplica-la als dos punts.
- **Correccions que toquen més d'un fitxer:** `2.1-A` s'ha d'aplicar al `.txt` **i** a la còpia incrustada `EXTRACTION_PROMPT` (idèntiques paraula per paraula). `3-A` i `3-B` s'han de replicar a les **tres** còpies de pintat del frontend. `6-B` va a les **dues** rutes d'entrada.
- **Un sol missatge d'error, tres codis:** `4-C` (401/403) i la nota creuada de `5-A` (409) es resolen millor amb el mateix bloc de missatges clars a `publishToGitHub`.
- **Dues xarxes contra duplicats:** `1.2-D` (guarda a la ingesta de correu) i `6-A` (comprovació en publicar) es complementen; la segona atrapa també el cas «mateix esdeveniment per correu + formulari».

---

## Accions de consola per a en Miquel (no verificables des del repositori)

1. Cloudinary → Settings → Upload presets → `agenda-posters`: fixar mida màxima i formats permesos (**4-A**).
2. Cloudinary → notificacions d'ús actives i a l'adreça correcta (**4-B**).
3. GitHub → Fine-grained tokens: confirmar que el token viu de `GITHUB_TOKEN` és el de pas-7 §1 (abast mínim, només aquest repositori, `Contents: Read and write`).
4. GitHub (web) → cerca de `AIza` a l'historial de commits per tancar del tot §4.2.

---

## Què s'ha verificat i és correcte (context)

L'audit també ha confirmat proteccions ja ben resoltes, útils per no tocar el que ja funciona: `LockService` a la ingesta de correu (1.2-C), `publishToGitHub` només cridable des del menú sense cap `doGet`/`doPost` extra (1.3-A), camps de sistema (`estat`, `font_url`, `imatge_url`, `data_entrada`, `id`) sempre fixats al codi i mai pel model (2.1-B, check 1 i 2 de §6), `JSON.parse` protegit amb desviament a `agenda-error` (2.2-A), enums via `valorPermes()` a la ruta de correu (2.2-B), tots els camps de text al DOM via `textContent`/`createTextNode` (§3 check 1), `?prova=1` estricte (§3 check 4), cap secret fora de Script Properties (§4.2, §4.4 check 1), i `events.json` amb un únic escriptor i cap fallada silenciosa (§5 checks 1–3). Fora d'abast per decisió pròpia: gestió de sessions/CSRF/SQL (no apliquen), i les eines de `img/` (design-system, no forma part del pipeline).

---

> **Recordatori del protocol:** cap d'aquestes 22 correccions s'ha aplicat. Aquesta és la vista de conjunt perquè triïs quines entren abans del llançament i en quin ordre; digues-me per quina tanda (o quines troballes soltes) vols començar i les aplico una per una, verificant cada canvi.
