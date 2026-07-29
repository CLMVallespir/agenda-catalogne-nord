# Auditoria de qualitat del codi — Secció 1: Consistència

> Àmbit: els cinc `.gs` + `app.js`, llegits sencers. Mesurat contra el **patró majoritari** del projecte i la regla de casa (skill §5: català per als noms de domini; anglès per als punts d'entrada), no contra un ideal extern.
> Severitat = deute de manteniment, no risc: **alta** = ja fa mal o en farà aviat; **mitjana** = arregla-ho abans que mossegui; **baixa** = poliment.
> Data: 2026-07-06. Basat en l'inventari `00-inventari-codi.md`.

---

## Veredictes per ítem de la checklist

| Ítem §1 | Veredicte | Resum |
|---|---|---|
| Una sola convenció de format (cometes, punts i coma, indentació, comes finals) | **pass** | Indentació 2 espais sense cap tab; punts i coma pertot (els 6 fitxers passen `node --check`); cometes simples com a norma; cap coma final; `var` al 100 % (0 `const`/`let`). Poliments menors a les troballes 9–11. |
| Nomenclatura de funcions: una convenció, verb primer | **pass** | Dues famílies coherents i llegibles: verb primer per a accions (`construeix*`, `llegeix*`, `envia*`, `puja*`, `process*`, `install*`) i sintagma nominal per a *getters* purs que retornen el que anomenen (`textDeCella`, `indexDeColumna`, `capcaleresGitHub`, `temaActual`). Cap nom que menteixi. |
| Identificadors en una sola llengua | **needs-work** | El patró CA-domini / EN-punts-d'entrada s'aplica bé a 4 de 6 fitxers; els desviats són `setupSheet.gs` (tot en anglès) i petites barreges `row`/`fila`. Troballes 4–6. |
| Accés a secrets per un sol embut (`getSecret`) | **pass** | Únic `getProperty` del projecte dins `getSecret()` (`processNewEmails.gs:461`); GEMINI, Cloudinary, GitHub i els 8 valors de Brevo hi passen tots. Cap `PropertiesService` dispers. |
| Logging consistent | **needs-work** | Mecanisme uniforme (`Logger.log` en exclusiva al backend, 17 crides; 1 `console.error` al frontend) i cada feina té el seu resum final. Però la **llengua** dels missatges balla entre anglès i català fins i tot dins del mateix fitxer, i el prefix `nomFuncio:` és intermitent. Troballes 1–2. |
| `app.js`: patró DOM únic, no barrejar `innerHTML`/`createElement` | **pass** | `createElement` + `textContent` per a **totes** les dades; `innerHTML` només 4 vegades (línies 278, 404, 506, 509) i sempre per injectar constants SVG pròpies, mai contingut d'esdeveniments. `addEventListener` pertot. Exactament el patró que demanava l'auditoria de seguretat. |

---

## Troballes

| # | fitxer:línia | Categoria | Severitat | Troballa | Fix concret |
|---|---|---|---|---|---|
| 1 | `processNewEmails.gs:128,145,497` vs `:169,174` (també `processBotSubmission.gs:53,136`, `setupSheet.gs:61,70`, `sendWeeklyDigest.gs:855` en anglès vs `publishToGitHub.gs:71` i `sendWeeklyDigest.gs:114,138,313,318` en català) | consistency | **mitjana** | La llengua dels `Logger.log` barreja anglès i català **dins del mateix fitxer**, cosa que fa el registre d'execucions més lent de llegir quan una feina desatesa falla. | Una passada única: tots els missatges de log en català (la llengua del curador que els llegirà); mateix criteri per als futurs. |
| 2 | p. ex. `processNewEmails.gs:174` (`processNewEmails fet.`) vs `:169` (`Error amb el correu…` sense prefix); `sendWeeklyDigest.gs:318` sense prefix vs `:114` amb | consistency | baixa | El prefix `nomFuncio:` als logs és intermitent, i és l'única pista de «qui parla» quan el registre barreja les tres feines. | Convenció única `nomFuncio: missatge` a les 17 crides. |
| 3 | `processNewEmails.gs:139`, `sendWeeklyDigest.gs:101`, `processBotSubmission.gs:68` (anglès) vs `publishToGitHub.gs:86` (català) | consistency | **mitjana** | El mateix error («no trobo el full Esdeveniments») existeix en **tres redaccions i dues llengües**, i alguns d'aquests textos arriben al curador via `ui.alert`. | Un sol text català per a l'error de full absent, reutilitzat als quatre llocs; de pas, tots els `throw new Error(...)` en català. |
| 4 | `setupSheet.gs:10–123` (`COLUMN_HEADERS`, `LAST_ROW`, `getOrCreateEventsSheet`, `writeHeaders`, `addDropdown`, `addStatusColours`) | consistency | baixa | `setupSheet.gs` és l'únic fitxer amb **tots** els identificadors en anglès, contra el patró CA-domini de la resta (p. ex. `capcaleres` pertot i `COLUMN_HEADERS` aquí). | Opció barata: documentar l'excepció («fitxers de setup en anglès») a la nota de convenció. Opció neta: catalanitzar només els helpers interns del fitxer; **no** tocar `COMARCA_VALUES`/`CATEGORIA_VALUES`/`COLUMN_HEADERS`, que tenen usos creuats a 2 fitxers més. |
| 5 | `processNewEmails.gs:406` (`var row` dins de `construeixFila`!) i `processBotSubmission.gs:116`; vs `fila` a `publishToGitHub.gs:115`, `sendWeeklyDigest.gs:199` | consistency | baixa | El mateix concepte es diu `row` o `fila` segons el fitxer — i fins i tot `construeixFila` retorna una variable dita `row`. | Reanomenar les dues locals a `fila` (canvi local, cap efecte creuat). |
| 6 | tots els `.gs` (comentaris en anglès) vs `app.js` (comentaris en català) | consistency | baixa | La llengua dels comentaris està partida per runtime: backend comentat en anglès, frontend en català; dins de cada fitxer és uniforme. | Decidir-ho i escriure-ho a la nota de convenció (recomanat: català, pel test dels sis mesos); convergir gradualment quan es toqui cada fitxer, sense passada massiva. |
| 7 | `sendWeeklyDigest.gs:201,206,216–226` (12 × `String(fila[col]).trim()` inline) | consistency | **mitjana** | El digest reimplementa inline, dotze vegades, exactament el que ja fa el helper global `textDeCella()` (`publishToGitHub.gs:153`) — dues maneres de llegir una cel·la conviuen al mateix projecte. | Substituir els 12 inline per `textDeCella(fila[col])` (ja és global, canvi mecànic). En paral·lel, §2 valorarà moure `textDeCella` a un `utils.gs`. |
| 8 | `sendWeeklyDigest.gs:796–804` dins `dataLlegibleCatala()` | consistency | baixa | Reimplementa el parse `split('-')` + validació que ja fa `objecteDataDe()` (`:711`) tres pantalles més amunt. | Reescriure `dataLlegibleCatala` sobre `objecteDataDe` (o deixar-hi un comentari de per què no pot — no s'hi veu cap raó). |
| 9 | `app.js:246–250,439–455,477–479` vs `sendWeeklyDigest.gs:665–698,739–758` | consistency | baixa | Els helpers bessons entre frontend i digest **divergeixen d'estil i de blindatge**: `finsAl`/`etiquetaDiaFr` en ternaris a `app.js` però `if/else` al `.gs`; `majuscula` té guarda de cadena buida al digest i no a `app.js`; `analitzaData` vs `objecteDataDe` validen diferent. Sense mòduls la duplicació és forçada, però la divergència no. | A cada parella, un comentari creuat «bessó de X a Y — si toques això, toca allò» i alinear el cos al mateix estil (recomanat l'`if/else` explícit, regla de casa §5). Cap refactor gros: això és el mínim; §2 hi tornarà. |
| 10 | `sendWeeklyDigest.gs:855` (i capçalera `:8`) | consistency | baixa | El log i el comentari diuen «Tuesdays at 15:00» amb l'hora **picada a mà**, mentre l'hora real surt de `HORA_ENVIAMENT` — si un dia es canvia la constant, el log mentirà. | Construir el missatge amb la constant: `'... (dimarts a les ' + HORA_ENVIAMENT + ':00).'`. |
| 11 | `processNewEmails.gs:263–264` (`'upload_preset'`, `'file'` amb cometes) vs la resta d'objectes literals sense cometes a les claus | consistency | baixa | Claus d'objecte entre cometes sense necessitat, únic lloc del projecte (fora de les claus amb guió, que sí que ho exigeixen). | Treure les cometes d'aquestes dues claus; convenció: cometes només quan el nom ho obliga. |

Cap troballa **alta**: no hi ha inconsistències que provoquin fallada silenciosa. Les tres mitjanes (1, 3, 7) comparteixen tema: *el projecte parla dues llengües i té dues maneres de fer la mateixa cosa en punts que es llegeixen en el pitjor moment (errors i logs)*.

---

## Observacions de línia de base (no són troballes)

- **Dialecte de comprovacions**: els `.gs` comproven explícitament (`=== null`, `!== ''`) i `app.js` usa *truthiness* (`if (e.imatge_url)`) — coherent dins de cada runtime, i segur aquí perquè l'esquema garanteix que tot camp és string (`""` = absent). Es documenta com a dialecte acceptat; no cal tocar res.
- **Les dues famílies de noms** (verb-primer / sintagma-getter) es consideren **una** convenció a partir d'ara: acció = verb primer; getter pur = el nom del que retorna.
- **Concatenació amb `+`** pertot (cap template literal fora del prompt): uniforme, es manté.
- `===` sense excepcions; `addEventListener` sense `onclick`; cap `.then()` fora de l'únic `fetch` lineal del frontend (patró establert per la skill §5).

---

**No apliquis encara cap correcció — aquesta és només la llista; en Miquel decideix l'ordre i l'abast.**

*Seccions següents: §2 Estructura (hi tornen les troballes 4, 7, 8, 9 des de l'angle «on ha de viure cada helper»), §3 Simplicitat, §4 Resiliència.*
