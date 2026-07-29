# Auditoria de qualitat del codi — Secció 2: Estructura

> Àmbit: els cinc `.gs` + `app.js` + `index.html`, més els candidats a codi mort del repositori. GAS no té mòduls: «estructura» vol dir **disciplina dins d'un únic espai global compartit**.
> Severitat = deute de manteniment, no risc. Mesurat contra el patró majoritari i les restriccions declarades (simplicitat radical, cap dependència).
> Data: 2026-07-06. Basat en `00-inventari-codi.md` i `01-consistencia-codi.md`.

---

## Veredictes per ítem de la checklist

| Ítem §2 | Veredicte | Resum |
|---|---|---|
| Una responsabilitat per fitxer `.gs` | **needs-work** | Cap funció fa la feina d'un altre fitxer — les fronteres de *feina* són netes. Però la **infraestructura compartida viu escampada dins de fitxers de feina** (troballes 1–2) i el digest arrossega dues responsabilitats en un sol fitxer de 856 línies (troballa 4). |
| Cap col·lisió de noms global | **pass** | Verificat a l'inventari: 63 funcions top-level úniques i totes les constants globals úniques. No cal cap convenció de prefixos. |
| Helpers compartits agrupats, no redefinits | **needs-work** | No existeix `utils.gs`; 5 helpers de càrrega creuada viuen en 4 fitxers diferents (troballa 1); l'ordre canònic de columnes existeix **dues vegades** (troballa 3); el digest reimplementa `textDeCella` inline (ja llistat: §1-7). La forma d'`events.json` sí que existeix un sol cop ✓. |
| Frontera frontend/backend neta | **pass** | `app.js` fa **un únic** `fetch` a `events.json` (línia 76) i res més; l'script inline d'`index.html` (:10–23) només gestiona el tema amb `localStorage`; cap crida a Gemini/Cloudinary/GitHub/Brevo des del client. Els únics enllaços sortints són el formulari Typebot (:91) i el placeholder pendent de Brevo (:56). El client és un lector pur. |
| Cap codi mort | **needs-work** | Les 93 funcions tenen crida verificada (viu tot). Però: `docs/prova-local.html` és una còpia antiga i divergent que cap document referencia (troballa 6) i `BOT_COLUMN_HEADERS` no es llegeix mai en temps d'execució (troballa 3). |

---

## Troballes

| # | fitxer:línia | Categoria | Severitat | Troballa | Fix concret |
|---|---|---|---|---|---|
| 1 | `processNewEmails.gs:460` (`getSecret`), `sendWeeklyDigest.gs:240` (`indexDeColumna`), `publishToGitHub.gs:153` (`textDeCella`), `processBotSubmission.gs:144,158` (`readField`, `creaId`) | structure | **mitjana** | Els cinc helpers de càrrega creuada viuen dins de fitxers que porten nom d'una altra feina: esborrar o reanomenar «el fitxer del webhook» trencaria la ingestió de correu en temps d'execució, sense cap avís (GAS no fa anàlisi estàtica). Els banners ho documenten — bona disciplina — però la documentació no protegeix. | Crear **`utils.gs`** amb aquests 5 helpers (tal qual, sense generalitzar-los) i actualitzar els banners. Canvi mecànic, cap efecte de comportament: l'espai global és el mateix. |
| 2 | `setupSheet.gs:10–51` (`COLUMN_HEADERS`, `COMARCA_VALUES`, `CATEGORIA_VALUES`, `ESTAT_VALUES`) | structure | **mitjana** | El fitxer de setup — pensat per executar-se **un sol cop** — és alhora el propietari de les constants d'esquema que la ingestió i el digest llegeixen **cada hora i cada setmana**; l'instint natural «el setup ja està fet, aquest fitxer sobra» trencaria dues feines desateses. | Moure les 4 constants d'esquema a `utils.gs` (amb la troballa 1); `setupSheet.gs` queda purament procedimental i llavors sí que és inert un cop executat. |
| 3 | `processBotSubmission.gs:20–37` (`BOT_COLUMN_HEADERS`) | structure | baixa | Constant mai llegida per cap codi (només citada en un comentari) que **duplica** `COLUMN_HEADERS`: una segona còpia de l'ordre canònic de columnes que pot derivar en silenci si l'esquema canvia. | Esborrar-la i fer que el comentari de la línia 115 apunti a `COLUMN_HEADERS` (que amb la troballa 2 ja viurà a `utils.gs`, visible per a tothom). |
| 4 | `sendWeeklyDigest.gs` (856 línies; plantilla HTML a `:480–785` + colors `:67–85`) | structure | **mitjana** | El fitxer barreja dues responsabilitats: l'orquestració (llegir full, agrupar, paginar Brevo, enviar) i ~300 línies de **plantilla HTML** amb les seves constants de color i de noms de mes — és el vermell més gros del llindar §6 (> 350). | Partir-lo en dos fitxers del mateix projecte: `sendWeeklyDigest.gs` (orquestració + Brevo) i `digestHtml.gs` (els `construeix*` purs + colors + mesos/dies). Zero canvi de comportament, i la meitat pura esdevé testable en local (§7, patró B). |
| 5 | `processNewEmails.gs:63–115` (`EXTRACTION_PROMPT`, 53 línies de text) | structure | baixa | El fitxer (498 línies, vermell §6) és un pipeline cohesionat, però barreja «text que s'edita» (el prompt) amb «codi que no es toca»; treure el prompt a un `extractionPrompt.gs` el deixaria sota el llindar ambre. | Opcional: moure només la constant a `extractionPrompt.gs`. Si es fa, actualitzar el comentari de sincronització amb `prompts/extract-event.txt`. Si no es fa, cap dany: el fitxer es llegeix linealment. |
| 6 | `docs/prova-local.html` (617 línies) | structure | baixa | Còpia **antiga i divergent** de la previsualització (l'actual és la de l'arrel, 1.124 línies, amb el disseny B&N); cap document ni codi hi apunta (verificat: totes les referències van a l'arrel). | Esborrar `docs/prova-local.html`. |
| 7 | `processNewEmails.gs:57–59` + `prompts/extract-event.txt` | structure | baixa | Dues fonts de veritat per al prompt, protegides només per un comentari («si en canvies una, canvia l'altra»). **Verificat avui: idèntiques byte a byte** — la disciplina ha funcionat, però res no la vigila. | Mantenir totes dues (el `.txt` té valor real per a proves manuals) i escriure a `prompts/README.md` quina és la mestra (recomanat: la del `.gs`, que és la que s'executa) + la data de l'última verificació. Si mai es munta el runner de §7, un test que les compari. |
| 8 | `PROJECT-KNOWLEDGE.md:149,214` | structure | baixa | El document encara diu que el redisseny B&N viu només a `prova-local.html` i «està per portar» als fitxers canònics — però `index.html`/`style.css`/`app.js` ja el porten (hero, logo, tema; portat el 2026-06-29). Un lector podria refer una feina ja feta. | Actualitzar les dues línies. (S'afegeix a la llista d'alineació de docs de §0-§6; es tractarà en bloc a §5.) |

Cap troballa **alta**. Les tres mitjanes (1, 2, 4) són el mateix problema de fons vist des de tres angles: *en un espai global sense mòduls, l'única estructura real és a quin fitxer viu cada cosa — i ara mateix el mapa de «qui és imprescindible per a què» no coincideix amb el que els noms dels fitxers prometen.* El fix de les tres és el mateix moviment: un `utils.gs` petit i literal.

---

## Observacions (no són troballes)

- **La duplicació entre runtimes** (`app.js` ↔ `sendWeeklyDigest.gs`: `finsAl`, `textLloc`, mesos/dies…) **no es pot agrupar**: no hi ha build ni mòduls compartits entre navegador i GAS, i afegir-ne violaria les restriccions fundacionals. El mínim viable són els comentaris creuats de §1-9. `utils.gs` és només per al costat `.gs`.
- `app.js` (533 línies) supera el llindar vermell §6 per 33 línies, però és **una sola responsabilitat** (pintar l'agenda) més el tema (~50 línies), amb ~30 % de comentaris: es recalibra a **ambre, sense acció**. Partir-lo en dos `<script>` afegiria un fitxer sense guany real.
- `escriuFila()` (embolcall d'una línia sobre `appendRow`) i `AGENDA_URL = ''` (placeholder dorment) es reserven per a §3 Simplicitat.
- Positiu remarcable: cada fitxer `.gs` declara al banner **què manlleva i d'on** — aquesta disciplina és el que ha fet trivial el mapa de dependències d'aquesta auditoria. Amb `utils.gs`, la mateixa informació passa de documental a estructural.

---

**No apliquis encara cap correcció — aquesta és només la llista; en Miquel decideix l'ordre i l'abast.**

*Secció següent: §3 Simplicitat (hi entren `escriuFila`, `AGENDA_URL`, i la revisió d'abstraccions prematures i del flux únic de dades).*
