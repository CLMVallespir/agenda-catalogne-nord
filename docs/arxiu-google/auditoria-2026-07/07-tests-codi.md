# Auditoria de qualitat del codi — Secció 7: Tests

> Àmbit: l'estat de la verificació del projecte contra la checklist §7 de `code-audit-agenda-nord.md` (patró A: runner dins de GAS; patró B: lògica pura en local), i el pla concret de tests que en surt. Mesurat contra les restriccions declarades (cap toolchain, cap npm, edició via web UI — recalibratge de `clasp` ja fet a §5).
> Severitat = deute de manteniment. Data: 2026-07-06. Basat en `00`–`06`. Aquesta secció no jutja el codi (ja ho han fet §§1–6): jutja **la xarxa de seguretat que no hi és** — i n'especifica una que Miquel pugui executar amb un clic.

---

## Estat de partida (verificat avui)

**Cap test automatitzat enlloc**: cap `runAllTests`, cap assert, cap full `TestResults`, cap `.claspignore` en tot el repositori. El que sí que existeix és verificació **manual i per sessió**:

- `prompts/exemples-test/` — 3 correus de prova (estructurat, desordenat, Facebook) per validar el prompt a mà.
- `?prova=1` + `events-exemple.json` — 10 esdeveniments ficticis, tots amb les 16 claus, amb bona cobertura de casos límit *benignes* (esdeveniment passat, `hora` buida ×2, multi-dia ×2, imatge ×1, `font_url` ×1, les 5 comarques) — però **cap cas hostil**: cap comarca/categoria fora d'enum, cap `data_fi` malformada.
- Les comprovacions jsdom i «25 checks» fetes per Claude a les sessions de treball — valuoses però no repetibles per Miquel sense Claude.

---

## Recalibratge dels patrons (contra les restriccions declarades)

**Patró A (runner dins de GAS): adoptat, i amplia el seu paper.** És l'únic patró executable per Miquel amb el flux real (cap Node, cap npm — §2 del projecte; `clasp` ja descartat a §5). Com que totes les funcions `.gs` són globals, **la lògica pura també es testeja dins del runner A**: mateix entorn real, zero infraestructura nova.

**Patró B (Vitest/clasp en local): recalibrat — no s'adopta.** Exigiria exactament el toolchain que el projecte rebutja. El seu esperit sobreviu en dues formes: (a) els asserts de lògica pura viuen al runner A; (b) les comprovacions de sessió amb Claude (jsdom sobre `app.js`) es mantenen com a capa complementària **documentada com a tal** — pràctica establerta, no substitut del runner.

**Full `TestResults`: recalibrat a mínim.** El runner s'executa manualment des del menú: n'hi ha prou amb `Logger.log` per al detall i un `ui.alert` amb el resum PASS/FAIL. Un full de resultats només si el log es queda curt algun dia.

---

## Veredictes per ítem de la checklist

| Ítem | Veredicte | Resum |
|---|---|---|
| §7.1 Validació de la resposta de Gemini | **needs-work** | El codi a protegir és bo i ja auditat (§4 pass: `analitzaJsonResposta` `processNewEmails.gs:355–368`, `extreuTextResposta` `:335–347`) — però cap test el protegeix, i és exactament la lògica que un retoc de prompt o de model pot trencar en silenci. Troballa 1. |
| §7.1 Validació d'enums als dos camins | **needs-work** | `valorPermes` (`:439–444`) només actua al camí del correu; el test dels dos camins **fallaria avui** al camí del bot (§3-1, encara no aplicat). Primera oportunitat de cicle vermell→verd del projecte — vegeu observacions. Troballes 1 i 2. |
| §7.1 `estat` sempre `pendent` als dos camins | **needs-work** | La propietat es compleix (verificat: `processNewEmails.gs:402`, `processBotSubmission.gs:112`; §3 va confirmar que cap camí escriu `publicat`) però és **el contracte central del disseny i no té cap guarda**: un despiste en un refactor futur no el detectaria res. Troballes 1 (unitari via `construeixFila`) i 2 (integració via full de proves). |
| §7.1 Forma d'`events.json` | **needs-work** | La garantia és estructural (construcció explícita de les 16 claus via `textDeCella`, `publishToGitHub.gs:95–140`) — l'assert que la fixa és barat i pertoca al runner. Troballa 1. |
| §7.1 Unicitat de slug/id | **recalibrat: N/A** | Al sistema real **res no sobreescriu res**: les files s'afegeixen, `events.json` és un array, i `app.js` no llegeix mai `id` (verificat: cap ús). Dos esdeveniments idèntics = dues files visibles al curador (finestra ja fitxada, §4 obs.). Afegir sufixos seria complexitat sense necessitat funcional — decidit: cap acció. |
| §7.1 Fum de render del frontend | **needs-work** (parcial) | `?prova=1` cobreix els casos benignes; falten els hostils (enum desconegut, `data_fi` malformada — el separador orfe de §4-6 n'és justament un). Troballa 3. |
| §7.2 Idempotència del digest | **needs-work** (seqüenciat) | No es pot testar una guarda que encara no existeix: el test neix **amb** el fix §4-1, com la seva prova d'acceptació. Troballa 2. |
| §7.2 Comportament del lock | **needs-work** (seqüenciat) | Ingesta: testable ja (forçar error dins del `try`, verificar que el `finally` allibera — `processNewEmails.gs:175–178`). Digest: amb §4-1. Troballa 2. |
| §7.2 Camí de publicació en full+repo de proves | **needs-work** (seqüenciat) | Depèn del banc de proves de §5-4 — que resol el problema de configuració **sense tocar codi**: la còpia del full duu l'script lligat, i les Script Properties (que no es copien) s'hi posen a mà apuntant a un repo GitHub de proves. Troballa 2. |
| §7.2 `runAllTests()` com a porta abans de versionar | **needs-work** | No existeix ni el runner ni la regla; s'ha d'escriure al runbook de §5-2. Troballes 1 i 2. |
| §7.3 Què NO testar | **pass** (per disseny del pla) | El pla de sota no testa el comportament de Gemini ni els serveis de Google, no munta cap emulador i no compta cobertura — només les regressions que farien mal en silenci. |

---

## Troballes

| # | fitxer:línia | Categoria | Severitat | Troballa | Fix concret |
|---|---|---|---|---|---|
| 1 | tot el projecte (cap fitxer de tests) | tests | **alta** | Zero tests automatitzats amb ~20 fixos de §§1–6 a la cua — inclosos refactors que mouen codi de lloc (`utils.gs` §2-1/2, partició del digest §2-4) — en un entorn on **cap anàlisi estàtica no existeix**: un nom mal escrit només peta en temps d'execució, potser dimarts a les 15:00 sense ningú mirant. La porta «suite verda primer, refactor després» (§6/§7) avui és impossible. | Crear **`tests.gs`** (patró A, ~200 línies, mateix estil de casa): `executaTotsElsTests()` que crida proves per àrea i acaba amb `ui.alert` resum + `Logger.log` detall; entrada de menú «Executa els tests» afegida al menú Agenda existent (`publishToGitHub.gs:30–35`). Asserts de lògica pura (cap servei de Google): **`analitzaJsonResposta`** — JSON net, amb fences/preàmbul, sense claus (throw), truncat (throw); **`extreuTextResposta`** — resposta normal, buida (throw), `MAX_TOKENS` (throw), amb objectes de resposta falsos; **`valorPermes`** — dins/fora d'enum; **`creaId`** — accents i apòstrofs, títol només puntuació, data buida, retall a 3 paraules; **`construeixFila`** — un objecte d'extracció maliciós amb `estat:'publicat'` acaba igualment en fila amb posició 15 = `pendent` i 16 posicions exactes; enums forasters buidats; **bessons del digest** — `finsAl` (a l'1/l'11, d' davant vocal, 1er francès), `objecteDataDe` (malformada → null), `dataLlegibleCatala`, `escapaHtml` (les 5 entitats). |
| 2 | `sendWeeklyDigest.gs` (guardes §4-1 inexistents) · full de proves §5-4 inexistent · runbook §5-2 inexistent | tests | mitjana | Els quatre tests d'integració de §7.2 estan **bloquejats per prerequisits d'altres seccions**, i sense seqüència explícita el risc és fer els refactors abans que la xarxa existeixi — exactament el que §6 prohibeix. | Seqüència canònica (escriure-la al runbook §5-2): **(1)** `tests.gs` amb els asserts purs de la troballa 1 — no depèn de res, es pot fer demà; **(2)** fix §3-1 (enums al bot) amb el seu test primer en vermell; **(3)** banc de proves §5-4 (còpia del full + properties de prova a mà: repo GitHub de proves, llistes Brevo fictícies) → hi corren els tests d'integració: `processBotSubmission` amb body fals → última fila `pendent` + enums buidats (esborrar la fila en acabar); lock alliberat després d'error forçat; publicació contra el repo de proves amb 409 visible; **(4)** fixos §4-1/§4-2 al digest, cadascun amb el seu test d'acceptació (idempotència: segona crida el mateix dia surt sense enviar); **(5)** només llavors, els refactors grossos (§2-1/2/4) amb la suite com a xarxa. |
| 3 | `events-exemple.json` (10 esdeveniments, tots vàlids) | tests | baixa | El fum de render de `?prova=1` només veu casos benignes: cap esdeveniment amb `comarca`/`categoria` fora d'enum ni `data_fi` malformada — justament els camins que §4.2 va auditar en codi però que ningú no ha vist mai renderitzats (el separador orfe §4-6 hi viu). | Afegir 2 esdeveniments hostils al final del fitxer (un amb `comarca:"Occitània"` i `categoria:"Circ"`, un amb `data_fi:"2026-13-99"`) i una **checklist de 6 punts** a `docs/` per a la ullada de 2 minuts amb `?prova=1`: es carrega · passat amagat · hostils visibles només a «Totes» sense trencar filtres · cap «undefined» · meta sense separador orfe · missatge d'estat buit en filtrar sense resultats. |
| 4 | `processNewEmails.gs:57–59` + `prompts/extract-event.txt` | tests | baixa | La sincronia de les dues còpies del prompt només la protegeix un comentari; §2-7 ho va deixar explícitament «per si mai es munta el runner de §7» — que ara es munta. | Un assert opcional al runner: `UrlFetchApp.fetch` del raw d'`extract-event.txt` a GitHub i comparació amb `EXTRACTION_PROMPT` (avís, no fallada, si difereixen — la xarxa pot fallar). Si es prefereix no fer crides de xarxa als tests: mantenir la verificació manual datada de §2-7. |

Balanç: **4 troballes — 1 alta, 1 mitjana, 2 baixes.** L'alta no és cap sorpresa: és la secció sencera. El valor del report és el **pla executable**: la troballa 1 dona la suite que es pot escriure demà sense tocar res més, i la troballa 2 dona l'ordre que evita refactorar sense xarxa.

---

## Observacions (no són troballes)

- **El projecte és inusualment testable per a GAS**: la disciplina de §5 (funcions petites, pures, globals, camps sempre string) fa que ~15 funcions es puguin testar amb literals, sense cap mock de `SpreadsheetApp`. El cost del runner és baix precisament perquè el codi ja està ben tallat.
- **El primer vermell ja té nom**: el test d'enums del camí del bot fallaria avui (§3-1). Escriure'l abans del fix i veure'l passar de vermell a verd amb les dues línies de §3-1 és el cicle test-first sencer en miniatura — i la millor manera de comprovar que el runner funciona de debò (un runner que mai no ha vist un vermell no se sap si detecta res).
- **`construeixFila` com a costura única**: si s'aplica §3-3 (el bot també crida `escriuFila`), el test «cap camí pot escriure `publicat`» queda cobert per un sol punt en lloc de dos — sinergia ja anticipada per §3.
- **Els tests d'integració esborren el que creen**: la fila de prova del bot es treu en acabar; al banc de proves de §5-4 ni això cal (dades fictícies per disseny). Cap test toca mai el full de producció — la regla es escriu al runbook.
- **La capa Claude-sessió es manté**: les verificacions jsdom per sessió (skill §9) continuen sent la manera de validar canvis d'`app.js` en profunditat; el runner A no hi arriba (corre a GAS, no al navegador) i la checklist de la troballa 3 en cobreix el mínim visual repetible per Miquel.
- **Cost total estimat del pla sencer**: 1 fitxer nou (`tests.gs`), ~2 esdeveniments de mostra, ~15 línies de checklist, 1 còpia de full. Cap dependència, cap servei nou, cap despesa — dins de les restriccions fundacionals per construcció.

---

**No apliquis encara cap correcció — aquesta és només la llista; en Miquel decideix l'ordre i l'abast.**

*Secció següent i última: la **taula final consolidada** (§9 de la checklist) — totes les troballes de §§1–7 en una sola taula ordenada per severitat, amb la seqüència d'aplicació recomanada (la troballa 2 d'aquí en dona l'esquelet).*
