# Auditoria de qualitat del codi — Secció 6: Llindars concrets

> Àmbit: els dotze senyals de la taula §6 de `code-audit-agenda-nord.md`, mesurats **funció a funció** sobre els cinc `.gs` + `app.js` (93 funcions) amb comptatge programàtic (longitud, paràmetres, profunditat, complexitat ciclomàtica, ternaris), verificat contra lectura manual dels casos límit.
> Aquesta secció és la **consolidació** que §5 anticipava: la majoria de senyals ja s'havien exercit a §§1–4 amb recalibratges declarats; aquí es tanca la taula, es fixen els **llindars propis del projecte** per a la feina futura, i es fitxa el poc que quedava per mesurar.
> Severitat = deute de manteniment. Data: 2026-07-06. Basat en `00`–`05`.

---

## La taula, mesurada — senyal per senyal

| Senyal §6 | Mesura real | Veredicte | On es tracta |
|---|---|---|---|
| Longitud de fitxer `.gs` (verd ≤ 200 · ambre 200–350 · vermell > 350) | `setupSheet` 123 ✓ · `processBotSubmission` 184 ✓ · `publishToGitHub` 223 (ambre) · `processNewEmails` 498 (vermell) · `sendWeeklyDigest` 856 (vermell) | **2 vermells ja fitxats; ambre llegit i acceptat** | Vermells: §2-4 (partir el digest en `sendWeeklyDigest.gs` + `digestHtml.gs`) i §2-5 (opcional, treure el prompt). Ambre `publishToGitHub`: **decidit aquí** — una sola responsabilitat, 7 funcions, ~⅓ comentaris deliberats; s'accepta sense acció. |
| Longitud de funció (verd ≤ 40 · ambre 40–70 · vermell > 70) | 1 vermell formal: `processBotSubmission` 73 (`processBotSubmission.gs:65–137`). 6 ambres: `llegeixEsdevenimentsPublicats` 64, `processNewEmails` 57, `llegeixEsdevenimentsPublicatsAquestaSetmana` 57, `sendWeeklyDigest` 52, `construeixFila` 47 — la resta ≤ 40 | **Recalibrat: cap acció** | El vermell és el mapa camp-a-camp que la regla de casa **exigeix** («per nom, un a un, sense bucles»): cc = 4, profunditat 1, ~26 línies són comentaris/blancs — la llargada ve de l'explicitud, no de la complexitat. Els 6 ambres són pipelines lineals (4 ja acceptats a §3; `construeixFila` s'hi afegeix pel mateix motiu — és l'altre mapa camp-a-camp). |
| Paràmetres (verd ≤ 3 · ambre 4 · vermell > 4) | Exactament 4 funcions amb 5: `processaThread`, `pujaFitxerAGitHub`, `enviaDigestComarca`, `enviaCorreuTransaccional`; cap amb 4; la resta ≤ 3 | **Recalibrat a §3: es mantenen** | §3 (llindar local: vermell a partir de 6; l'objecte d'opcions afegiria indirecció contra la regla de casa). Mesura d'avui confirma les mateixes 4, cap de nova. |
| Profunditat de nidificació (verd ≤ 2 · ambre 3 · vermell > 3) | 1 vermell: `obteContactesDeLlista` (4). 3 ambres: `processNewEmails`, `publishToGitHub`, `carregaEsdeveniments` (3) | **Vermell ja fitxat; ambres llegits i acceptats** | Vermell: §3-2 (reestructurar amb sortides primerenques). Els tres ambres són exactament la granularitat de `try/catch` que §4 va elogiar (per correu / dins del lock / al voltant del fetch) — profunditat al servei de la resiliència, cap acció. |
| Complexitat ciclomàtica (verd ≤ 8 · ambre 8–12 · vermell > 12) | Comptador formal: `obteContactesDeLlista` 11, `objecteDataDe` 10, `dataLlegibleCatala` 8; la resta ≤ 7 | **Recalibrat: verd efectiu pertot** | `obteContactesDeLlista`: ja fitxada (§3-2; la reestructura la baixa). Les altres dues són **una sola guarda amb cadena de `||`** (validació de data, lectura lineal): es recalibra que una cadena de `||` dins d'una guarda compta com **una** decisió. `dataLlegibleCatala` a més ja és §1-8 (reescriure-la sobre `objecteDataDe` elimina duplicació i cadena alhora). |
| `try/catch` a cada crida externa (absent = vermell) | 6 de 6 crides `UrlFetchApp.fetch` embolcallades, granularitat correcta | **verd** | §4 (pass amb matís d'ordre — §4-5). |
| Nidificació de ternaris (0 · 1 · ≥ 2) | **1 ternari encadenat** al projecte: `app.js:111` (comparador d'ordenació). La resta (finsAl, creaBotoMes, etiquetaDiaFr…) són simples, no niats | **ambre — troballa 1** | Nova (i corregeix §3, que havia declarat «zero ternaris niats»: el comptatge funció a funció n'ha trobat un). |
| Bloc duplicat ≥ 3× | Només el cas fitxat: 12 × `String().trim()` al digest. El muntatge de fila existeix 2× (ambre, acceptat) | **ja fitxat** | §1-7 (el fix és `textDeCella`); §3 (el 2× és el cost acceptat del mapa explícit). |
| Col·lisions de noms globals | 63 funcions top-level úniques; constants úniques | **verd** | §0/§2. |
| `UrlFetchApp.fetch` al camí de lectura | Cap: el client fa un únic `fetch` a `events.json` i res més | **verd** | §2 (frontera neta). |
| Longitud d'`app.js` (verd ≤ 300 · ambre 300–500 · vermell > 500) | 533 línies (vermell formal per 33) | **Recalibrat a §2: ambre sense acció** | Una sola responsabilitat + tema (~50 línies), ~30 % comentaris. Llindar local: vermell si passa de 600 **o** si hi entra una segona responsabilitat. |
| Valors màgics (quotes, etiquetes) | Tot el que és significatiu té constant amb nom (`MAX_THREADS_PER_RUN`, `CONTACTES_PER_PAGINA`, `PAUSA_ENTRE_CORREUS_MS`, `HORA_ENVIAMENT`, `LAST_ROW`, `ESTAT_COLUMN`, etiquetes Gmail, colors); inline només codis HTTP (idiomàtic), `24*60*60*1000` (autoexplicatiu) i numerals de gramàtica catalana (`dia === 1 || dia === 11`) | **verd** | Els dos residus reals ja són fitxats: `'Esdeveniments'` 6× (§3-5) i el «15:00» picat a mà al log (§1-10). |

---

## Troballes

| # | fitxer:línia | Categoria | Severitat | Troballa | Fix concret |
|---|---|---|---|---|---|
| 1 | `app.js:111` | simplicity | baixa | L'únic ternari encadenat del projecte (`a.hora < b.hora ? -1 : a.hora > b.hora ? 1 : 0`) viu al comparador d'ordenació — nivell 1 de nidificació (ambre §6) — mentre el seu bessó del digest, `comparaPerDataIHora` (`sendWeeklyDigest.gs:254–268`), fa el mateix amb `if/else` pla: una divergència de bessons més, no llistada a §1-9. | Reescriure el comparador amb l'`if/else` del bessó (regla de casa: explícit per sobre de compacte); plegar-ho dins la passada d'alineació de bessons de §1-9. |

Balanç: **1 troballa, baixa.** És el resultat esperat d'una secció transversal executada al final: gairebé tot el que la taula podia trobar ja tenia número de troballa a §§1–5. El valor durador d'aquesta secció no és la troballa sinó la **taula calibrada** de sota.

---

## Llindars calibrats del projecte (la taula que val a partir d'ara)

La taula §6 de la checklist era provisional; després de mesurar-la contra el codi real, aquests són els llindars **propis** del projecte per a codi nou o retocat:

- **Fitxer `.gs`**: verd ≤ 200 · ambre 200–350 · vermell > 350 — *sense canvi*, però la llargada es jutja descomptant l'estil de casa (~⅓ de comentaris deliberats) i mirant si hi ha **més d'una responsabilitat** (el criteri que ha condemnat el digest i absolt `publishToGitHub`).
- **Funció**: verd ≤ 40 · ambre 40–70 · vermell > 70 — amb **una excepció amb nom**: els mapes camp-a-camp de l'esquema (16 camps, un per línia, exigits per la regla «per nom, un a un, sense bucles») poden superar 70 si cc ≤ 5 i profunditat ≤ 2.
- **Paràmetres**: verd ≤ 3 · ambre 4–5 · **vermell ≥ 6** (recalibratge §3 confirmat: mai objecte d'opcions per sota d'això).
- **Nidificació**: verd ≤ 2 · ambre 3 · vermell > 3 — *sense canvi*; el `try/catch` de resiliència compta com a nivell, però un ambre causat només per ell s'accepta.
- **Complexitat**: verd ≤ 8 efectiu, on una cadena de `||`/`&&` dins d'**una** guarda compta com una decisió; vermell > 12 formal es manté com a alarma dura.
- **Ternaris**: 0 niats; un ternari simple és acceptat on el bessó no en tingui (si n'hi ha bessó, mana l'`if/else`).
- **`app.js`**: ambre fins a 600 amb una sola responsabilitat; vermell > 600 o segona responsabilitat.
- **Regles absolutes sense recalibratge**: `try/catch` absent en crida externa desatesa = vermell; qualsevol camí de fallada silenciosa = vermell; col·lisió de noms globals = vermell; `UrlFetchApp` (o equivalent) al client = vermell.

---

## Observacions (no són troballes)

- **Mesura programàtica, no impressió**: longitud, paràmetres, profunditat, cc i ternaris s'han comptat amb script sobre les 93 funcions i s'han verificat a mà els casos límit (`processBotSubmission`, `objecteDataDe`, `dataLlegibleCatala`, `app.js:111`). Els totals quadren amb l'inventari §0 (63 + 30 funcions; línies `wc -l`).
- **Correcció del registre de §3**: «zero ternaris niats» era gairebé cert però no del tot — n'hi ha exactament un (troballa 1). Cap altra afirmació de §§1–5 ha resultat desmentida per la mesura.
- **El perfil del codi és el que el projecte diu ser**: complexitat efectiva ≤ 7 a 92 de 93 funcions, zero funcions il·legibles, tota la llargada excedent explicada per comentaris i explicitud deliberats. Els dos únics vermells estructurals reals (fitxers > 350) ja tenen fix a §2 i són qüestió d'*on viu* el codi, no de *com és*.
- **Per a §7**: la taula calibrada dona el criteri d'acceptació dels refactors que §7 preveu («green suite first, refactor second»): cap fix de §§1–6 hauria de fer passar cap funció de verd a ambre en aquesta taula.

---

**No apliquis encara cap correcció — aquesta és només la llista; en Miquel decideix l'ordre i l'abast.**

*Secció següent: §7 Tests — l'últim bloc gros (patró A: runner dins de GAS per a integració; patró B: lògica pura testable en local). Té la feina preparada: §4-1/§4-2 li donen els casos d'idempotència i lock, §5-4 el full de proves, i aquesta secció el criteri de mesura per validar els refactors.*
