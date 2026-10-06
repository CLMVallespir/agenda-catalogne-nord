# Auditoria de qualitat del codi — Secció 3: Simplicitat

> Àmbit: els cinc `.gs` + `app.js` + `index.html`, contra la restricció fundacional del projecte (simplicitat radical: sense comptes, sense servidor propi, sense infra de pagament, sense frameworks) i els llindars §6 de la checklist.
> Severitat = deute de manteniment. On un llindar §6 xoca amb l'estil de casa (explícit per sobre de compacte), es recalibra i es diu obertament.
> Data: 2026-07-06. Basat en `00`–`02`.

---

## Veredictes per ítem de la checklist

| Ítem §3 | Veredicte | Resum |
|---|---|---|
| Cap framework ni dependència pesada a `app.js` | **pass** | Zero imports, zero CDN: `index.html` només carrega `style.css` i `app.js`; tot resolt amb `fetch` + DOM. La restricció fundacional està intacta. |
| Cap abstracció prematura als `.gs` | **pass** | Cap helper sobre-genèric amb flags: `valorPermes`, `readField`, `addDropdown` tenen exactament la generalitat que usen. `propietatLlistaPerComarca` (5 `if` explícits, «no transliteration tricks») és l'anti-abstracció feta bé — el patró a imitar. |
| Condicionals plans i llegibles | **pass** amb 1 troballa | Zero ternaris niats a tot el projecte; profunditat ≤ 3 pertot excepte **una** funció (troballa 2). Els *early returns* són la norma. |
| Un sol flux de dades clar | **needs-work** | El flux gran és net i sense dreceres: **cap camí pot escriure `publicat`** — les dues ingestions forcen `estat = 'pendent'`, publicar és només del curador, el digest només llegeix. Però el pas «valida» només existeix en un dels dos camins d'entrada (troballa 1) i el pas «escriu la fila» té dues formes (troballa 3). |
| Cap fetch redundant al camí de lectura | **pass** | Un únic `fetch` per visita (`app.js:76`); els filtres repinten des de memòria, sense refetch. (L'opció `cache: 'no-store'` i la CDN es tracten a §4.2, que és qui ho té assignat.) |

---

## Troballes

| # | fitxer:línia | Categoria | Severitat | Troballa | Fix concret |
|---|---|---|---|---|---|
| 1 | `processBotSubmission.gs:80–81` | simplicity | **mitjana** | El camí del webhook escriu `comarca` i `categoria` **sense** el contrast `valorPermes` que el camí del correu sí que aplica (`processNewEmails.gs:386–387`): el «flux únic» promès (entrada → **valida** → fila `pendent`) té el pas de validació només a una de les dues portes. El formulari Typebot constreny els valors a la seva UI, però l'endpoint accepta qualsevol POST; el full pot acumular valors fora d'enum que cap filtre ni digest mostrarà mai. | Dues línies a `processBotSubmission`: `var comarca = valorPermes(readField(body, 'comarca'), COMARCA_VALUES);` i l'equivalent amb `CATEGORIA_VALUES` (tots dos són globals). Cross-ref: §7 ja preveu el test «validació d'enum als dos camins». |
| 2 | `sendWeeklyDigest.gs:376–406` (`obteContactesDeLlista`) | simplicity | **mitjana** | Única funció del projecte amb profunditat 4 (`while` + `else` + `for` + `if`), governada pel flag `seguir` que amaga el cas normal dins d'un `else` — vermell §6 (> 3), i és codi de paginació que corre desatès. | Reestructurar amb sortides primerenques: `while (true) { pàgina; if (buida) break; for (...) {...}; offset += …; if (última pàgina) break; }` — mateixa lògica, profunditat 2, el cas normal al nivell superior. |
| 3 | `processNewEmails.gs:430–432` (`escriuFila`) vs `processBotSubmission.gs:135` (`appendRow` directe) | simplicity | baixa | El pas compartit «escriu la fila» existeix en dues formes: un camí el té amb nom i l'altre l'encasta — asimetria petita però al punt exacte on convergeixen els dos fluxos. | Triar-ne una: que el bot també cridi `escriuFila` (ja és global; i dona a §7 una costura única on comprovar `estat = pendent`), o esborrar `escriuFila` i que tots dos cridin `appendRow`. Recomanat el primer, via `utils.gs` (§2-1). |
| 4 | `processNewEmails.gs:89` + `prompts/extract-event.txt` (instruccions d'`id`) | simplicity | baixa | El prompt dedica un bloc a ensenyar el model a construir `id`… que `construeixFila` descarta sempre i reconstrueix amb `creaId` (`:399`, deliberat i documentat). Instruccions que el sistema ignora són pes mort de manteniment i una font de confusió futura. | Moure `id` a la llista «CAMPS QUE NO HAS D'OMPLIR MAI» (retorna `""`), actualitzar l'exemple i **les dues còpies** del prompt (§2-7). Cautela: és un canvi de prompt — revalidar amb els tres correus de `prompts/exemples-test/` abans de donar-lo per bo. |
| 5 | `processBotSubmission.gs:66`, `processNewEmails.gs:137`, `publishToGitHub.gs:84`, `sendWeeklyDigest.gs:99`, `setupSheet.gs:67,69` | simplicity | baixa | El nom del full, `'Esdeveniments'`, és una cadena màgica repetida 6 vegades en 5 fitxers: un canvi de nom de pestanya faria fallar les feines una per una, cadascuna amb el seu missatge. | Constant `NOM_FULL = 'Esdeveniments'` a `utils.gs` (encaixa amb el moviment §2-1/§2-2) i usar-la a les 6 posicions. |

Cap troballa **alta**. Les dues mitjanes són petites de mida però toquen el cor del contracte: la 1 restaura la simetria del flux únic (la propietat que §7 haurà de provar), la 2 és l'únic racó del projecte on la forma amaga el cas normal.

---

## Llindars §6 recalibrats (mirat i decidit, com mana la regla ambre)

- **4 funcions amb 5 paràmetres** (`processaThread`, `enviaDigestComarca`, `enviaCorreuTransaccional`, `pujaFitxerAGitHub`) — vermell §6 (> 4 → objecte d'opcions), **recalibrat a: es mantenen**. Cada una passa exactament el context que necessita, amb noms inequívocs i una sola crida; un objecte d'opcions afegiria indirecció contra la regla de casa («explícit per sobre d'implícit», res de destructuring). Nou llindar local: vermell a partir de 6. |
- **Funcions en franja ambre de llargada** (40–70 línies: `processNewEmails`, `sendWeeklyDigest`, `llegeixEsdevenimentsPublicats`, `llegeixEsdevenimentsPublicatsAquestaSetmana`) — totes són **pipelines lineals** sense branques profundes, amb ~⅓ de comentaris: llegides i acceptades, cap acció.
- **Complexitat ciclomàtica**: cap funció per sobre de ~7 (verd pertot).
- **Duplicació ≥ 3×**: només el cas ja fitxat a §1-7 (12 × `String().trim()` al digest). El muntatge de la fila existeix 2× (ambre: correu i bot) — s'accepta com a cost del «mapa camp a camp, sense bucles» de la regla de casa; les troballes 1 i 3 en redueixen la divergència real.

---

## Observacions (no són troballes)

- **Cap drecera al flux**: verificat explícitament — cap línia del projecte escriu `'publicat'` fora del gest manual del curador; `publishToGitHub` només llegeix `estat === 'publicat'`; el digest només llegeix. El pas més valuós del disseny està intacte.
- `AGENDA_URL = ''` (`sendWeeklyDigest.gs:64`): placeholder dorment **per disseny** (el peu s'omet si és buit) — no és deute; cal omplir-lo quan el web tingui URL pública, com el placeholder de Brevo a `index.html:56`.
- `escapaHtml` fet a mà amb 5 `replace`: correcte i sense dependències — exactament el que toca aquí.
- Literals d'estat (`'publicat'`, `'pendent'`) escrits al codi: **es mantenen** — `if (estat === 'publicat')` és la regla de casa per definició; centralitzar-ho seria abstracció sense guany.

---

**No apliquis encara cap correcció — aquesta és només la llista; en Miquel decideix l'ordre i l'abast.**

*Secció següent: §4 Resiliència — la de més pes: feines desateses (locks, idempotència del digest, quotes) i el camí de lectura d'alt trànsit (fallada d'`events.json`, camps absents, enums desconeguts, estat buit, caché).*
