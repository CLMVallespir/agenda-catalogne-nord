# Auditoria de seguretat — Secció 6: Comprovacions de la lògica del flux

> Àmbit: només codi i documentació del repositori `agenda-catalogne-nord`. Revisió defensiva del propi projecte.
> **Cap correcció s'ha aplicat**: aquest document només llista les troballes; en Miquel decideix l'ordre.
> Referència: secció 6 del checklist `docs/auditoria/auditoria-seguretat-agenda-nord.md`.
> Data: 2026-07-04.

**Context que acota la secció:** aquí es verifica que la lògica del flux no té dreceres — que
res no pot saltar-se el curador, que els camps de sistema són sempre del sistema, i que un valor
inesperat degrada bé (desapareix o queda buit) en lloc de trencar res. S'hi incorpora també
l'observació que la secció 2 va deixar diferida aquí: el format de `data_*`/`hora` no es valida
mai al codi.

---

## Check 1 · Cap fila pot néixer `publicat` — **CORRECTE, cap mancança**

Les dues rutes d'entrada forcen l'estat, amb un literal, al bloc de «camps que omple el sistema»:

- Ruta Typebot: `processBotSubmission.gs:112` — `var estat = 'pendent';` amb el comentari
  «always pending: waiting for the curator». El valor mai no es llegeix del `body`.
- Ruta correu: `processNewEmails.gs:402` — idèntic; la resposta del model no hi pot influir
  (el bloc :398-403 reconstrueix tots els camps de sistema després del parse).

L'únic camí cap a `publicat` és el curador editant la cel·la al full. `publishToGitHub()` només
llegeix (`estat !== 'publicat'` → `continue`, secció 5). Cap trigger ni endpoint no escriu
aquest camp.

## Check 2 · `data_entrada` sempre del sistema — **CORRECTE, cap mancança**

- `processBotSubmission.gs:113` i `processNewEmails.gs:403`: `new Date().toISOString()` en el
  moment d'escriure la fila. Cap de les dues rutes no accepta un valor extern per a aquest camp
  (no hi ha cap `readField(..., 'data_entrada')` enlloc), i el model tampoc: el bloc de sistema
  es reconstrueix sempre.

## Check 3 · Duplicats d'`id` — **MANCANÇA 6-A (baixa)**

Resposta a la pregunta del checklist («sobreescriptura silenciosa a `events.json`?»): **no hi ha
sobreescriptura**. `events.json` és un *array*, no un objecte indexat per `id`: dues files amb el
mateix `id` hi apareixen totes dues (`publishToGitHub.gs:114-143`, bucle sense cap comprovació de
duplicats). I el frontend **no fa servir mai `e.id`** (cap referència a `app.js`), així que el
pitjor efecte visible avui són **targetes duplicades** al web.

El risc real és doble:

1. **Col·lisió fàcil:** `creaId()` retalla el slug a les **tres primeres paraules** del títol
   (`processBotSubmission.gs:178-181`). Dos esdeveniments el mateix dia amb títols que comencen
   igual (dos «Concert de Nadal» en pobles diferents) comparteixen `id` sent esdeveniments
   legítims i distints.
2. **Trampa latent:** si mai l'`id` esdevé clau de res (enllaços permanents, deduplicació del
   digest, futur mode de detall), la col·lisió es tornarà un error real i difícil de rastrejar.

**Correcció proposada (~15 línies, cap dependència):** comprovació de duplicats **en publicar**,
a `publishToGitHub()` — recollir els `id` no buits de les files `publicat`; si n'hi ha de
repetits, `ui.alert` amb la llista i pregunta SÍ/NO per continuar (mateix patró que la
confirmació de llista buida, `publishToGitHub.gs:50-59`). Això detecta alhora el cas «mateix
esdeveniment enviat dos cops» (correu + formulari), que és el duplicat més probable a la
pràctica. L'alternativa del sufix (`-2`) es descarta: complica la estabilitat dels `id` sense
resoldre el cas dels dos enviaments duplicats, que el curador ha de veure igualment.
*(Referència creuada: la secció 1 ja proposa una guarda de reprocessament a la ingesta de
correu; aquesta comprovació en publicar és l'última xarxa.)*

## Check 4 · Frontend amb `comarca` fora d'enum o buida — **CORRECTE, cap mancança**

Els filtres **no es construeixen mai a partir de les dades**:

- Els botons de comarca surten de la constant `COMARQUES` (`app.js:13`) via
  `['Totes'].concat(COMARQUES)` (`app.js:131`); el selector de categoria, de la constant
  `CATEGORIES` (`app.js:16`, bucle a :154-158). Un valor inesperat a `events.json` no pot
  injectar cap botó ni cap opció, ni trencar el `<select>`.
- Al filtratge (`app.js:177-182`), un esdeveniment amb `comarca` buida o desconeguda es veu sota
  «Totes» i desapareix de qualsevol comarca concreta — degradació segura, cap error.
- A la targeta, la comarca només es pinta si no és buida (`app.js:319-323`), i la icona de
  categoria té valor per defecte (`app.js:299`; el matís del *lookup* ja és 3-C).

A més, la ruta de correu buida els valors fora d'enum abans d'escriure
(`valorPermes`, `processNewEmails.gs:386-387` i :439-444). La ruta Typebot no ho fa — però això
ja és la troballa **1.1-B** de la secció 1, no una mancança nova d'aquesta.

## Check 5 (diferit de §2) · Format de `data_*` i `hora` mai validat — **MANCANÇA 6-B (baixa)**

Cap de les dues rutes no valida que `data_inici`/`data_fi` siguin `YYYY-MM-DD` ni que `hora`
sigui `HH:MM`: `construeixFila()` (`processNewEmails.gs:381-383`) i `processBotSubmission()`
(`processBotSubmission.gs:75-77`) escriuen el que arriba, tal qual (les columnes del full són
text pla sense validació, per disseny del Pas 1).

La conseqüència concreta d'una data mal formatada («14/09/2026», «dissabte 14») que el curador
no repari i publiqui: **l'esdeveniment desapareix del web sense cap error enlloc** — el frontend
el descarta en silenci (`analitzaData()` exigeix `^\d{4}-\d{2}-\d{2}$` i el filtre el treu,
`app.js:98-105`). El digest setmanal també el deixaria fora (comparació de finestres com a text,
`sendWeeklyDigest.gs:206-213`). El full diria «publicat»; el web no el mostraria mai. L'`id`
també neix amb el prefix malmès (`creaId` no valida la data, `processBotSubmission.gs:158-161`).

**Correcció proposada (~12 línies, a les dues rutes):** dos helpers — `dataValida(text)` amb
`/^\d{4}-\d{2}-\d{2}$/` i `horaValida(text)` amb `/^\d{2}:\d{2}$/` — aplicats als tres camps en
construir la fila; si el valor no compleix el format, deixar `""` (el valor desconegut de
l'esquema). Una `data_inici` buida és **visiblement incompleta** a la revisió setmanal (i el
frontend ja no publica res sense data), de manera que la fallada passa de silenciosa a visible al
lloc on hi ha un humà mirant. El text original del correu continua disponible a l'etiqueta
`agenda-traitat` per reparar la fila.

---

## Resum de la secció 6 (format §8)

| # | Fitxer:línia | Severitat | Mancança (1 frase) | Correcció proposada |
|---|---|---|---|---|
| 6-A | `publishToGitHub.gs:114-143` (+ `creaId`, `processBotSubmission.gs:178-181`) | Baixa | Dos esdeveniments poden compartir `id` (slug de 3 paraules) i publicar-se tots dos sense avís: targetes duplicades avui, col·lisió de clau latent demà. | Comprovació de duplicats a `publishToGitHub()`: `ui.alert` amb la llista d'`id` repetits + SÍ/NO, com la confirmació de llista buida. |
| 6-B | `processNewEmails.gs:381-383` i `processBotSubmission.gs:75-77` | Baixa | `data_inici`/`data_fi`/`hora` s'escriuen sense validar el format: una data malmesa i publicada desapareix del web en silenci. | Helpers `dataValida()`/`horaValida()` a les dues rutes; si no compleix, `""` (visible com a incomplet a la revisió). |

**Checks sense mancança:** check 1 (`estat = 'pendent'` literal a les dues rutes; l'únic camí a
`publicat` és el curador), check 2 (`data_entrada` = `new Date().toISOString()` sempre, mai
extern), check 4 (filtres construïts només amb constants; valors inesperats degraden bé; la
manca d'enum a la ruta Typebot ja és 1.1-B).

**Notes creuades:** 6-A complementa la guarda de reprocessament proposada a la secció 1 i no
canvia res del check 3 de la secció 5 (l'única escriptura continua sent `publishToGitHub()`);
6-B tanca l'observació que la secció 2 havia deixat diferida aquí.

> **Recordatori del protocol:** cap d'aquestes correccions s'ha aplicat. Es revisaran totes
> juntes al final (secció 8) i en Miquel triarà l'ordre d'aplicació.
