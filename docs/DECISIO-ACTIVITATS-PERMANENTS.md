# Decisió — Les activitats permanents

*Document de contracte. Fixa un canvi d'esquema **ja decidit** perquè es pugui
implementar en sessions separades sense tornar a discutir-lo.*

*Inventari escrit el **5 de setembre de 2026** sobre `git HEAD` = `041d0e8`.
Nom del camp i les cinc decisions del §6, fixats el **8 de setembre de 2026**.*

> **Estat: res no queda obert.** El nom del camp és `periodicitat` i **no es
> rediscuteix**. Les cinc preguntes del §6 tenen resposta. L'única cosa que
> l'implementador pot tornar a preguntar és el xoc de rutatge del §6, Q2, i
> **només si es troba de debò**: aleshores s'atura i ho diu, no ho resol.

> **Cap fitxer de codi no s'ha tocat en escriure aquest document i cap bateria de
> proves no s'ha executat.** L'inventari del §4 surt de llegir el repositori
> línia a línia, no de memòria. Els recomptes de casos de prova del §4.D estan
> comptats pel marcador d'etiqueta dels fitxers, no executant-los, i el document
> ho diu allà on toca.

---

## 1. Què és una activitat permanent

Una **activitat permanent** és la que es repeteix amb continuïtat. No és un acte
que passa un dia: és una cosa que hi **ha**, setmana rere setmana, i que
continuarà havent-hi la setmana que ve.

Exemples, tots reals i tots de Catalunya Nord:

- el **curs de català** setmanal d'una associació,
- el **curs de ball** de cada dimarts al vespre,
- el **truc als bars**, a l'hivern,
- el **mercat setmanal** d'un poble.

El contrast amb l'acte puntual no és de durada. És **de què demana al lector**:

| | **Acte puntual** | **Activitat permanent** |
|---|---|---|
| Què demana al lector | **descoberta** — «això passa, i si no hi vaig me'l perdo» | **constància** — «això hi és, i m'hi puc apuntar quan vulgui» |
| Quan importa | un dia, i s'acaba | totes les setmanes, mentre duri |
| Com es llegeix a l'agenda | a la llista del dia | en un lloc a part, i una sola vegada |
| Quantes vegades el curador hi pensa | una | una |

Un concert de dissabte és un acte **puntual** encara que el grup toqui cada mes:
el que s'anuncia és *aquell* concert. Un curs de ball de cada dimarts és una
activitat **permanent** encara que el primer dimarts sigui una data concreta: el
que s'anuncia és *el curs*, no el dimarts.

### No és un concepte de l'ADT66

Aquest punt decideix tota la resta del document. La font externa és la que menys
importa aquí: les activitats permanents de debò —el curs de català d'una
associació del Vallespir, el truc als bars a l'hivern— arriben **per correu i per
Typebot**, que són les entrades humanes. Són justament les que una agenda
automatitzada no pot anar a buscar enlloc i que **només existeixen a l'agenda
perquè algú les hi envia**.

Per això el camp entra al **contracte del projecte** i no a la canonada de
l'ADT66, i per això toca les tres portes d'entrada alhora: `email()`, `fetch()`
i el mapeig extern.

### El que això reverteix

`docs/HANDOFF-ADT66.md`, secció «El que això costa, dit clar» (30 d'agost de
2026), parlant de les ofertes periòdiques que es publiquen com un sol dia:

> L'alternativa era afegir un camp a l'esquema o escriure la periodicitat dins
> de `descripcio_ca`, i totes dues coses toquen els setze camps canònics, que no
> es toquen.

**Aquesta decisió tria exactament aquella alternativa descartada**, i per un
motiu que aleshores no hi era: allà el problema era una pèrdua de dades d'una
font externa concreta; aquí el problema és que **una part sencera de la vida
cultural —la que es repeteix— no té on dir-se, vingui d'on vingui**. Aquell
paràgraf queda **superat** i s'ha de marcar com a tal quan s'implementi (§4.E).

---

## 2. El camp: `periodicitat`

**El nom és `periodicitat`. Fixat el 8 de setembre de 2026 i no es rediscuteix.**

Per què: és la paraula que el projecte **ja fa servir** per a aquest fenomen
—`docs/HANDOFF-ADT66.md` parla de «sèrie periòdica» i de «230 periòdiques», i
`classificaDates()` d'`eines/adt66-sincronitza.js` ja en diu `tipus`—, és un
substantiu com tots els altres noms de camp, i **no promet cap estructura de
calendari**, que és justament el que `recurrencia` (calc del francès i de
l'anglès) sí que promet.

> **Descartats, i queda escrit perquè és la pregunta que tornarà:** `cada_quan`
> —bo, perquè el valor respon literalment la pregunta del nom («Cada quan? —
> Cada dissabte al matí»), però cap altre camp de l'esquema no és una pregunta i
> trencaria l'única convenció de nomenclatura que hi ha—, `recurrencia` (promet
> el motor que no farem), `repeticio` (no és com se'n parla en català corrent) i
> `ritme` (massa vague).

### Les regles del camp

1. **Text lliure, llegible per una persona.** «cada dissabte al matí», «els
   dijous a les 18h», «tots els dimarts de 20 a 22 h, fora vacances escolars».
   Ni ISO, ni RRULE, ni cap gramàtica. Es mostra tal com s'escriu.
2. **Cap estructura de calendari, cap motor de recurrència.** No es genera cap
   ocurrència, no es calcula cap propera data, no es parseja res. El projecte no
   té base de dades (§3 de `CLAUDE.md`) i això no n'obre cap per la porta del
   darrere.
3. **`""` = activitat puntual.** El buit no vol dir «no ho sabem»: **és la
   resposta**. Mateix mecanisme que ja governa `imatge_url` i `font_url`. La
   conseqüència pràctica és gran: **les 135 files que hi ha avui als dos fitxers
   són totes correctes sense tocar-les** (§4.F).
4. **És una cadena, com tots** (§4 de `CLAUDE.md`): mai `null`, mai omès.
5. **Aplica a `pendents.json` i a `events.json` per igual.** **No és cap segon
   `nota_curador`.** `nota_curador` descriu **la fila** i mor en publicar (§4 de
   `CLAUDE.md`, decidit el 29 d'agost de 2026); `periodicitat` descriu **l'acte**
   i ha d'arribar al web públic i al digest, o el camp no serveix de res. Aquesta
   diferència és la que fa que `recullFitxa()` de `curador.html` l'hagi
   d'incloure i que el 17è actual no hi sigui.
6. **L'esquema passa a divuit camps**: setze públics + `periodicitat` (públic) +
   `nota_curador` (només de cua). El recompte honest passa a ser **17 camps
   públics, 18 al total de la cua**, i substitueix el «16 públics, 17 al total»
   de `docs/HANDOFF-ADT66.md` §4.

### La vigència: `data_fi`, i cap camp nou

`data_fi` és **el final de la vigència de la recurrència**. Un curs que para al
juny porta `data_fi` de juny. Un mercat setmanal sense final previsible porta la
`data_fi` que el curador consideri que aguanta — i quan caduqui, l'acte tornarà a
entrar per la porta que sigui.

Això no és cap reinterpretació forçada: és el que `data_fi` ja vol dir a tot
arreu del codi. Té tres conseqüències que **ja funcionen soles i no s'han de
programar**:

- `preparaEsdeveniments()` (`app.js:112`) amaga el que ja s'ha acabat mirant
  `data_fi >= avui`. Un curs vigent hi passa; un de caducat desapareix sol.
- `podaRebutjatsCaducats()` (`eines/sincronitza-programada.js:1311`) poda les
  files rebutjades amb `data_fi < avui`. Una permanent rebutjada s'esborra de la
  cua quan la seva vigència s'acaba, no abans.
- `passaFiltreDates()` (`app.js:260`) ja fa **tocar** el període
  `[data_inici, data_fi]` amb l'interval triat, que és exactament el
  comportament que la decisió demana del filtre de dates.

I és, també, el criteri que tria què entra al bloc del digest (§6, Q4).

### Curació: s'aprova la recurrència, no les ocurrències

El curador aprova **la recurrència una vegada**. Les ocurrències no són decisions
noves i no tornen a la cua.

Això **no toca** la regla de «cap auto-acceptació». Aquella regla és sobre **què
es publica** —cap fila no arriba a `events.json` sense que una persona hi hagi
dit que sí— i aquesta és sobre **quantes vegades es repinta** el que ja s'ha
aprovat. Un curs aprovat el setembre que surt cada setmana fins al juny ha passat
pel filtre humà exactament un cop, que és un cop més que zero.

---

## 3. Frontend i digest — el comportament pactat

### Web públic

- Les permanents es mostren **en una secció a part**, identificades com a tals.
- **Obeeixen els filtres exactament com la resta**: comarca, categoria i interval
  de dates. Cap immunitat, cap excepció.
- **Si el filtratge no en deixa cap, la secció no es dibuixa.** El patró exacte
  que ja fan `buidaFranjaLlarga()` (`app.js:351`) i `pintaFranjaLlarga()`
  (`app.js:363`), amb l'atribut `hidden` de la `<section>`.
- **Cap excepció a `preparaEsdeveniments()` més enllà de la vigència.** Una
  permanent caducada s'amaga com qualsevol altra fila caducada, i pel mateix
  camí.
- **La franja de llarga durada no es toca** (§6, Q2).

### Digest de Brevo

- **Bloc de resum compacte.** Sense cartell i sense una línia per ocurrència.
- **No es repeteixen a cada edició com un esdeveniment normal**: no entren a la
  llista per dies ni generen capçalera de dia.
- **El bloc no depèn de la finestra de 7 dies**: es fa amb les permanents
  vigents, tinguin o no ocurrència aquella setmana (§6, Q4).

---

## 4. Inventari exacte dels llocs a canviar

Comptat sobre el repositori del **5 de setembre de 2026**, fitxer per fitxer i
funció per funció.

### Els números, primer

| | Quants |
|---|---|
| Fitxers de codi i d'actius a tocar | **19** |
| Punts d'edició dins d'aquests fitxers | **44**, dels quals **6 són codi o marcatge nou** |
| Llocs on el joc de camps s'escriu **literalment** | **23**, en **14 fitxers** — 10 llistes constants, 10 constructors de fila en línia, 3 còpies del prompt |
| Bateries de proves offline que existeixen avui | **16** (més 2 que surten a la xarxa) |
| Bateries que **fallen de seguida** en afegir el camp | **3** |
| Llocs que **construeixen files incompletes en silenci** | **7** — i **ja falla avui**: §5 |
| Fitxers de dades a reomplir | **2** — i **0 files a tocar** (§4.F) |
| Documents que queden desfasats | **14** |
| Verificador que enxampi un camp que falti | **cap** (§4.G) |

> **La comparació que importa.** L'enum de `categoria` viu a **14 còpies en 9
> fitxers**, i el §4 bis de `CLAUDE.md` existeix perquè una vegada se'n van tocar
> 2 de 14 i hi va haver dies amb una fila publicada amb la categoria buidada en
> silenci. El **joc de camps** viu a **23 llocs en 14 fitxers** i **no té cap
> `verifica-*.js` que el vigili**. Per això el §7 posa el verificador primer de
> tot i no l'últim.

### 4.A — El prompt d'extracció (3 còpies literals)

El camp **sí que l'ha d'omplir el model**, a diferència d'`imatge_url`,
`font_url`, `estat` i `data_entrada`: un correu que diu «tous les jeudis à 18h»
ja porta la informació, i el correu és la porta d'entrada que més importa (§1).

| # | Fitxer | Línia | Què |
|---|---|---|---|
| **1** | `prompts/extract-event.txt` | 9–10 | «exactament aquestes **16** claus» → 17, i la llista de claus |
| | | 15–26 | secció `CAMPS QUE HAS D'EXTREURE`: hi falta la descripció del camp nou |
| | | 31–49 | l'exemple de resposta, que ha de portar la clau nova |
| **2** | `worker/worker.js` | 221 (`EXTRACTION_PROMPT`), «16 claus» a la 229 | còpia **literal, byte a byte** (§7 de `CLAUDE.md`) |
| **3** | `worker/worker-concatenat.js` | 5194, «16 claus» a la 5202 | la mateixa còpia |

`docs/arxiu-google/processNewEmails.gs` en té una **quarta** còpia: és **codi
mort i no s'ha de tocar** (§9 de `CLAUDE.md`). `prompts/README.md` en descriu la
llista de verificació i va al §4.E.

### 4.B — Els constructors de fila (les portes d'entrada)

| # | Fitxer:línia | Funció | Nota |
|---|---|---|---|
| **4** | `worker/worker.js:806` | `construeixFila()` | camí del **correu** |
| **5** | `worker/worker.js:512` | `construeixFilaFormulari()` | camí del **Typebot** |
| **6** | `worker/worker-concatenat.js:5779` | `construeixFila()` | bessó |
| **7** | `worker/worker-concatenat.js:5485` | `construeixFilaFormulari()` | bessó |
| **8** | `curador.html:825` | `recullFitxa()` | **el que decideix el contracte d'`events.json`.** Avui construeix 16 camps i n'exclou `nota_curador` a posta. **`periodicitat` hi ha d'entrar** |
| **9** | `curador.html:734` | `creaFitxa()` | hi falta el camp editable: `creaCamp('periodicitat', …, true)`, **amb `data-camp`** — al contrari de la nota groga, que en va sense |
| **10** | `importa-csv.js:31` | `ESQUEMA` (16 noms) | i la capçalera que valida a la 223 |
| **11** | `importa-csv.js:180` | `construeixFila()` | |
| **12** | `eines/mapeja-adt66.js:184` | `CAMPS_PRODUCCIO` (17) | el fan servir `ordenaSegonsEsquema()` (1289) i l'assercció de la 2293 |
| **13** | `eines/mapeja-adt66.js:388` | `mapejaOfertaADT66()` | el literal de fila, línies 400–425. **Aquí hi va la regla conservadora del §6, Q1** |
| **14** | `eines/mapeja-recerca.js:51` | `CAMPS_PRODUCCIO` (17) | `ordenaSegonsEsquema()` a la 514, assercció a la 823 |
| **15** | `eines/mapeja-recerca.js:165` | el literal de fila | |

> **El Typebot no és un fitxer del repositori.** El formulari viu al servei i
> s'edita allà; el que hi ha aquí és la seva especificació,
> `docs/pas-5-typebot-questionari.md` (§4.E i sessió 8 del §7).

### 4.C — Els consumidors: fusió, digest, frontend

| # | Fitxer:línia | Funció | Què cal fer-hi |
|---|---|---|---|
| **16** | `eines/dedup-esdeveniments.js:80` | `CAMPS` (17) | |
| **17** | `eines/dedup-esdeveniments.js:433` | `fusionaFiles()` | la regla genèrica del bucle de la 455 ja fa el que el §6, Q3 demana; **el que hi falta és l'avís a `nota_curador`** quan totes dues són plenes i diferents |
| **18** | `eines/processa-lot.js:836` | `CAMPS_PRODUCCIO` (17) | el comparen **quatre** asserccions: 935, 1172, 1342, 1481 |
| **19** | `worker/worker.js:1173` | `llegeixEsdevenimentsDeLaSetmana()` | **passa a tornar DUES llistes d'una sola lectura** (§6, Q4): els actes de la setmana per `data_inici`, com ara, i les permanents vigents per `data_fi >= avui`. Cap segona crida a l'API de continguts |
| **20** | `worker/worker.js:1646` | `construeixHtmlDigest()` | el bloc de resum hi ha d'entrar **fora** del bucle de capçaleres de dia |
| **21** | *nova*, al costat de `worker/worker.js:1719` | germana compacta de `construeixBlocEsdeveniment()` | sense cartell, sense línia per ocurrència |
| **22** | `worker/worker-concatenat.js:6146` | `llegeixEsdevenimentsDeLaSetmana()` | bessó |
| **23** | `worker/worker-concatenat.js:6619` | `construeixHtmlDigest()` | bessó |
| **24** | *nova*, al costat de `worker/worker-concatenat.js:6692` | la germana compacta | bessó |
| **25** | `app.js:112` | `preparaEsdeveniments()` | **cap excepció**: només hi passa el que ja hi passa per vigència |
| **26** | `app.js:286` | `pintaTot()` | avui reparteix en `curts` / `llargs`. **És l'únic lloc on el xoc del §6, Q2 pot aparèixer de debò: si apareix, ATURA'T i digue-ho** |
| **27** | `app.js:321` | `esLlargaDurada()` | **NO ES TOCA**, i `DIES_LLARGA_DURADA = 5` tampoc (§6, Q2) |
| **28** | *nova*, al costat d'`app.js:363` | `pintaFranjaPermanents()` + el seu buidatge | mateix patró que `pintaFranjaLlarga()` i `buidaFranjaLlarga()` (351) |
| **29** | `app.js:589` o `app.js:542` | `creaMeta()` / `creaDetalls()` | on es pinta el text del camp dins la targeta |
| **30** | *nova*, `index.html:111–119` | germana de `<section id="franja-llarga-durada" … hidden>` | el patró del `hidden` ja hi és |
| **31** | *nova*, `style.css:392` | germana de `.franja-llarga` / `.titol-franja` (401) | |
| **32** | *nova*, `prova-local.html:755` | la secció, al mirall | |
| **33** | `prova-local.html:957` | `preparaEsdeveniments()` | mirall |
| **34** | `prova-local.html:~1122` | `pintaTot()` | mirall |
| **35** | `prova-local.html:1145` | `esLlargaDurada()` | mirall — **tampoc no es toca** |
| **36** | `prova-local.html:1185` | `pintaFranjaLlarga()` + la germana nova | mirall |
| **37** | `prova-local.html:807–889` | les **10 files de prova en línia** | cap no és permanent avui |

### 4.D — Les proves i els ajudants de prova

Cap fitxer del projecte no té `require.main === module` fora d'
`eines/sincronitza-programada.js:1744`: les bateries s'executen amb
`node eines/<fitxer>.js` i s'aturen amb `process.exitCode = 1`.

**Les 16 bateries offline que existeixen avui:** `adt66-identificador`,
`classifica-editorial`, `cloudinary-adapter`, `comarca-per-poble`,
`dedup-contra-fitxers`, `dedup-esdeveniments`, `deteccio-retirades`,
`filtra-candidats`, `mapeja-adt66`, `mapeja-recerca`, `neteja-text`,
`pipeline-offline`, `processa-lot`, `puja-cartell`, `verifica-esdeveniment`,
`verifica-enum`. (Més `sondes-fonts` i `proves-7bis`, que surten a la xarxa.)

> **Precisió del 16 de setembre de 2026, comprovada llegint el fitxer.**
> `proves-7bis` és **bateria de xarxa** i no compta entre les offline, tot i que
> el seu bàner comença dient «proves en sec»: el «en sec» vol dir que no fa cap
> crida a Gemini i que no escriu res, no que no toqui la xarxa. Es baixa el flux
> sencer de l'ADT66 i el desa en memòria cau al directori temporal del sistema
> (`quefas-flux-adt66.json`, uns 4,5 MB), de manera que **surt a la xarxa la
> primera vegada i les següents no**, fins que algú esborri la cau. Aquesta
> classificació ja era la bona en aquesta taula; el que s'hi afegeix és el
> perquè, perquè el nom del bàner convida a col·locar-la a l'altra llista.

**Les 3 que fallen de seguida**, perquè comparen les claus de la fila amb la
llista de camps i s'aturen si no coincideixen exactament i en ordre:

| Fitxer | Assercció | Missatge d'avui |
|---|---|---|
| `eines/mapeja-adt66.js` | 2293 | «els camps no són els disset de l'esquema, en ordre» |
| `eines/mapeja-recerca.js` | 823 | ídem |
| `eines/processa-lot.js` | 935, 1172, 1342, 1481 | ídem, **quatre vegades** |

**Les que no fallen però construeixen files incompletes**: són **set** i estan
inventariades al **§5**, perquè no són cost d'aquest canvi — **ja fallen avui**.
Els punts d'edició **38 a 44** de l'inventari són exactament aquells set.

**Recompte de casos declarats per bateria** — comptats pel marcador d'etiqueta
`nom: '` dels fitxers, **no executant-les**; cap sessió de document no n'ha
executat cap:

`mapeja-adt66` 51 · `verifica-enum` 28 · `puja-cartell` 26 ·
`verifica-esdeveniment` 22 · `classifica-editorial` 21 · `dedup-contra-fitxers`
20 · `mapeja-recerca` 17 · `dedup-esdeveniments` 16 · `neteja-text` 16 ·
`adt66-identificador` 13 · `deteccio-retirades` 10 · `filtra-candidats` 10.

Les altres quatre (`cloudinary-adapter`, `comarca-per-poble`, `pipeline-offline`,
`processa-lot`) declaren els casos d'una altra manera i **no s'han comptat**: qui
implementi ho ha de mirar sobre el terreny.

### 4.E — Els 14 documents que queden desfasats

Cap no és executable, però tots diuen una xifra que deixarà de ser certa:

| Document | On |
|---|---|
| `CLAUDE.md` | §4 sencer (la llista numerada, «Disset camps», i la nota d'obertura del §4 bis) |
| `docs/HANDOFF-ADT66.md` | **450–456** («16 camps públics, 17 al total») i **630–640**, «El que això costa, dit clar» — **el paràgraf que aquesta decisió reverteix** (§1) |
| `PROJECT-KNOWLEDGE.md` | la taula de camps, línia 102, i la 111 |
| `PROJECT-KNOWLEDGE-CHAT.md` | 235, 246 |
| `skill/agenda-nord-core/SKILL.md` | 164, 175 |
| `FASES.md` | 61–63 (la decisió del 29 d'agost sobre `nota_curador`), 96, 383 |
| `TECH-KNOWLEDGE-BASE.md` | 139 |
| `prompts/README.md` | 5, 27, 32 — inclosa la llista de verificació manual del prompt |
| `docs/pas-5-typebot-questionari.md` | la taula de camps: **hi falta la pregunta nova** |
| `docs/pas-fase3a-worker-formulari.md` | el contracte del POST |
| `docs/pas-fase3b-worker-digest.md` | el comportament del digest |
| `docs/pas-8-frontend.md` | la secció «Comportament» |
| `docs/HANDOFF-MAPEIG-RECERCA.md` | els seus «disset camps» |
| `docs/HANDOFF-CLASSIFICACIO.md` | ídem |

Més una entrada nova a `NOTES.md`. **`docs/arxiu-google/` i
`img/_ds/…/_ds_bundle.js` no es toquen mai** (§4 bis de `CLAUDE.md`).

### 4.F — Els dos fitxers de dades: cap fila a tocar

Comptat sobre els fitxers d'avui:

- **`events.json`** — 7 files, **totes de 16 camps**.
- **`pendents.json`** — 128 files: **89 de 16 camps i 39 de 17** (les de l'ADT66,
  que porten `nota_curador`).

**No cal reomplir-ne cap.** El §4 de `CLAUDE.md` diu que un camp desconegut és
`""`, i tot el codi del projecte llegeix els camps **pel nom**, amb funcions que
tornen `""` per al que falta (`campText()`, `cadena()`, `valorNet()`,
`valorCsv()`). Una fila sense `periodicitat` es comporta exactament com una
activitat puntual, **que és el que és** (regla 3 del §2). Les files es
completaran soles quan tornin a passar per un constructor.

L'única raó per tocar-los seria voler que `git diff` ensenyi l'esquema nou de
seguida, i no la val: 135 files remenades per res, i un conflicte de SHA amb el
curador que estigui publicant en aquell moment.

### 4.G — El forat: no hi ha cap verificador de camps

`eines/verifica-enum.js` comprova **només** les llistes de `comarca` i de
`categoria`, a les 14 còpies del §4 bis, llegint-ne la bona de
`prompts/extract-event.txt`. **No mira els noms de camp.**

Res, avui, no enxamparia una fila que hagi perdut el camp nou en un dels 23 llocs
del §4. I un camp que falta és **més silenciós** que una categoria dolenta: no hi
ha cap `valorPermes()` que el buidi amb un rastre — simplement no hi és.

**Un `eines/verifica-camps.js`, germà de `verifica-enum.js`, és la primera cosa
que s'ha d'escriure.** El §7 el posa a la sessió 1 precisament per això.

---

## 5. Deute tècnic detectat i no corregit

**Aquest apartat no és cost d'aquest canvi.** Són set llocs on el projecte **ja
avui** construeix files que no tenen tots els camps de l'esquema, i **ho fa en
silenci**: cap no llança cap error, cap no escriu res al registre, cap no atura
cap bateria. Es van trobar mentre s'inventariava el camp nou, i s'escriuen aquí
perquè quedin escrits.

**Res d'això no s'ha de corregir ara.** Ni en aquesta sessió, ni com a part de la
implementació de `periodicitat` més enllà de la línia que li toqui a cadascun.
Corregir-los de debò —fer que un ajudant de prova no pugui muntar una fila
incompleta— és una tasca a part que ningú no ha demanat.

### Els set llocs

| Fitxer:línia | Funció o constant | Què construeix | Per què no es veu |
|---|---|---|---|
| `eines/adt66-identificador.js:209` | dins de `filaDeProva()` | una llista de 17 noms de camp, en línia | és una llista literal dins d'un ajudant: si l'esquema creix, la fila de prova es queda curta i cap comprovació no la compara amb res |
| `eines/classifica-editorial.js:532` | `CAMPS`, secció «Proves des del terminal» | ídem, com a constant | ídem |
| `eines/deteccio-retirades.js:342` | dins de `filaDeProva()` | ídem, en línia | ídem |
| `eines/puja-cartell.js:590` | `CAMPS`, secció de proves | ídem, com a constant | ídem |
| `eines/verifica-esdeveniment.js:698` | `CAMPS`, secció de proves | ídem, com a constant | ídem |
| `eines/dedup-contra-fitxers.js:562–570` | la fila mínima de prova, en línia | els camps escrits un per un dins d'un objecte | el bàner de la 186 ja diu «els disset camps», però res no ho comprova |
| `eines/dedup-esdeveniments.js:433` | `fusionaFiles()` — **en producció, no en proves** | la fila fusionada, recorrent `CAMPS` | si `CAMPS` es queda curt, **la fila fusionada perd el camp i ningú no ho sap**. És l'únic dels set que toca dades de debò |

### Un cas a part, que és una decisió i no un descuit

`eines/verifica-esdeveniment.js:130`, `CAMPS_CONTRASTABLES` (9 camps). Aquesta
llista **és curta a posta**: el comentari de les 125–129 explica que `comarca` i
`categoria` no hi són perquè són taxonomia nostra i no surten mai a la font
original, i que `estat`, `data_entrada`, `id`, `nota_curador` i `imatge_url` els
omple el sistema. **No és deute: és una tria.**

El que sí que caldrà decidir, quan s'implementi, és **de quina banda cau
`periodicitat`**: la font original sovint la diu («chaque samedi matin»), o sigui
que sembla contrastable — però la regla del §6, Q1 fa que sovint arribi buida per
un motiu nostre i no de la font, i preguntar-ho donaria «sospitós» a moltes
files. És el punt **43** de l'inventari i la sessió **4** del §7.

### El forat que els cobriria tots

Els sis primers són **la mateixa cosa sis vegades**: un ajudant de prova amb la
llista de camps escrita a mà i sense ningú que la compari amb la mestra. És
exactament el problema que el §4.G descriu per al codi de producció, i el
`eines/verifica-camps.js` de la sessió 1 **també els cobriria**, si se li diu que
miri els ajudants de prova i no només els constructors. Val la pena que ho faci.

---

## 6. Les cinc decisions — respostes del 8 de setembre de 2026

Les cinc preguntes que el document va obrir el 5 de setembre. **Totes cinc tenen
resposta i cap no queda oberta.** Es conserven amb l'etiqueta original (Q1–Q5)
perquè les referències de la resta del document continuïn sent vàlides.

### Q1 — L'ADT66 omple el camp de manera conservadora · **RESOLTA**

**La decisió.** El mapeig de l'ADT66 omple `periodicitat` **només** quan
`COMMUNTHEME` **diu explícitament** «hebdomadaire», «mensuel» o un equivalent.
Text lliure derivat d'aquell valor. **`""` en tots els altres casos.**

**El que NO es fa, i és el nucli de la decisió: no s'infereix res del salt mitjà
de `TRI`.** El senyal de dates **menteix**. La prova és una fila que hi ha ara
mateix a `pendents.json`: la **ZUMBA de Santa Maria la Mar**
(`[ADT66 id: FMALAR066V52E25F]`), on la mateixa `nota_curador` de la fila ja diu
«L'acte es fa **22 dies escampats**». És una classe **setmanal**, i el salt mitjà
—mesurat pel propietari sobre la fitxa real: **3 dies**— no ho diu enlloc. Una
heurística de salts hauria escrit una periodicitat falsa amb tota la confiança
del món, i una periodicitat falsa és pitjor que cap: el lector s'hi presenta i no
hi ha ningú.

**Un camp buit és correcte, i l'omple el curador.** Això no és una mancança que
calgui compensar: és la regla 3 del §2 funcionant. Una permanent de l'ADT66 que
arribi amb el camp buit entra a la cua com un acte puntual, el curador hi
reconeix el curs de zumba i hi escriu «cada dimarts i dijous al vespre» amb un
clic. La informació que hi posa una persona és la bona.

**On es programa:** punt **13** de l'inventari,
`eines/mapeja-adt66.js:388`, dins de `mapejaOfertaADT66()`, al costat de
`categoriaPerTemaInfantil()`, que ja és l'única regla que llegeix `COMMUNTHEME`.

> **Un fet del repositori que l'implementador ha de comprovar primer.**
> `COMMUNTHEME` és, tal com el repositori el documenta, un vocabulari de **tema**
> i no de freqüència: el flux sencer es va comptar el 4 de setembre de 2026
> —1 513 ofertes, **33 temes distints**— i els valors que el codi anomena són
> «Artisanat», «Pour enfant», «Conte», «Cirque», «Bande dessinée»
> (`eines/mapeja-adt66.js:325–346`). **Cap dels documentats no és una paraula de
> freqüència**, i el repositori no enumera els 33.
> **Primer pas de la sessió que ho implementi: llistar els 33 valors i veure si
> cap diu «hebdomadaire», «mensuel» o equivalent.** Si cap no ho diu, la regla és
> correcta igualment i simplement no s'activa mai: l'ADT66 deixa el camp buit
> sempre, que és el costat que aquesta decisió ja ha triat. El que **no** s'ha de
> fer, si això passa, és anar a buscar el senyal a `TRI`, a `COMMUNDATE` o a la
> descripció — perquè és exactament el que Q1 prohibeix.

### Q2 — La franja de llarga durada es queda tal com és · **RESOLTA**

**La decisió.** `DIES_LLARGA_DURADA = 5` **no es toca**. `esLlargaDurada()` **no
es toca**. La franja de llarga durada es queda **exactament com és avui**, i la
secció de permanents s'hi afegeix al costat.

**Són capes diferents i no es barregen.** El **col·lapse de dates** del mapeig
ADT66 —una sèrie dispersa es publica com un sol dia— i el camp `periodicitat` són
dues coses de nivells diferents: una és què fa el mapeig amb un calendari que no
hi cap, l'altra és què diu la fila sobre si l'acte es repeteix. **Una fila pot
tenir tots dos**: una data col·lapsada *i* una periodicitat escrita. No s'han de
reconciliar.

**Si a la implementació xoquen de debò, atura't i digue-ho.** El lloc on això
podria aparèixer és el punt **26**, `pintaTot()` (`app.js:286`), que avui
reparteix les files filtrades en dos cubells amb un `if`/`else`. Si en fer-hi el
tercer cubell resulta que una fila real hauria d'anar als dos llocs i no hi ha
manera neta de decidir-ho, **la sessió s'atura i ho reporta al propietari**. No
ho resol pel seu compte, i molt especialment **no toca `DIES_LLARGA_DURADA` per
sortir-ne**.

*(El document del 5 de setembre deia que aquesta era «l'única pregunta que trenca
si no es respon», i mostrava que una permanent de setembre a juny dura 278 dies i
que per tant `esLlargaDurada()` ja diu que sí. **Aquell càlcul continua sent
cert.** El que canvia és què se'n fa: no es resol per endavant amb una regla de
precedència, es deixa que aparegui —si apareix— i s'atura allà.)*

### Q3 — Regla de fusió: la plena guanya la buida, i el rang decideix els empats · **RESOLTA**

**La decisió**, en dues línies:

1. Una `periodicitat` **no buida guanya sempre sobre una buida.**
2. Si **totes dues són plenes i diferents**, es queda la de la **font de més
   rang** segons la jerarquia del projecte —**organitzador/mairie >
   oficina de turisme > agregador**— i **s'escriu un avís a `nota_curador`**.

**Això no és cap règim nou: és la regla genèrica que `fusionaFiles()` ja fa.** El
bucle de `eines/dedup-esdeveniments.js:455` agafa el valor de la fila guanyadora
i, **només si és buit**, el de l'altra — que és exactament el punt 1 i el punt 2
sense l'avís. I la jerarquia que la decisió anomena és, paraula per paraula, la
taula `JERARQUIA_FONTS` que ja hi ha a `eines/dedup-esdeveniments.js:68`:
`organitzador` 3, `oficina-turisme` 2, `agregador` 1, i `RANG_DESCONEGUT` 0 per a
tota font que no hi sigui.

**El que hi falta, doncs, és una sola cosa: l'avís.** `periodicitat` no va a cap
dels tres règims d'excepció que la funció ja té —ni el de `data_entrada` (mana la
fila més antiga), ni el de `nota_curador` (**es queden totes dues**), ni el
d'`estat` (`resolEstat()`, per precedència)—: va a la regla genèrica, i hi
afegeix un avís quan la fusió ha hagut de triar entre dues frases plenes que no
deien el mateix. El motiu és el mateix que fa que `nota_curador` es conservi
sencera en fusionar: **el curador ha de poder saber que se n'ha perdut una**, i
que «cada dijous» i «els dijous de 18 a 20 h» no són la mateixa informació.

L'avís s'escriu amb `ajuntaNotes()` (`eines/dedup-esdeveniments.js:492`), que és
la regla compartida d'encadenar notes del projecte. **És el punt 17** de
l'inventari.

### Q4 — El bloc del digest no depèn de la finestra de 7 dies · **RESOLTA**

**La decisió.** El bloc de resum es construeix a partir de **les permanents
vigents** —`data_fi >= avui`—, **tinguin o no ocurrència dins de la setmana**. La
finestra de `DIES_FINESTRA = 7` (`worker/worker.js:155`) governa la llista
d'actes de la setmana i **no governa el bloc**.

**Per què, i per què això explica la forma del bloc.** El bloc **no és una llista
d'esdeveniments: és un recordatori del que hi ha sempre.** Per això és compacte,
per això no porta cartell i per això no porta una línia per ocurrència. Un curs de
català que ha començat al setembre no és menys cert la tercera setmana d'octubre
que la primera de setembre; el que canvia és que ja no és una novetat, i un
recordatori compacte és exactament el registre que li toca.

**Conseqüència directa al codi.** Tal com és avui,
`llegeixEsdevenimentsDeLaSetmana()` (`worker/worker.js:1173`) tria per
`data_inici` dins de la finestra, o sigui que **una permanent sortiria al digest
de la setmana en què comença i mai més**. Amb aquesta decisió la funció **passa a
tornar dues llistes d'una sola lectura d'`events.json`**: els actes de la setmana,
com ara, i les permanents vigents. **Cap segona crida a l'API de continguts** —el
§7 de `CLAUDE.md` diu que `events.json` es llegeix sempre per l'API i mai de
Pages, i llegir-lo dues vegades per un mateix digest seria gastar una petició per
res. **És el punt 19** (i el **22**, al concatenat).

Dues coses que **no canvien**, i val més dir-les:

- El digest és **per comarca**. El bloc de permanents també: passa per
  `actesDeLaComarca()` (`worker/worker.js:1247`) com tot la resta, i una permanent
  amb la comarca buida **no surt a cap digest**, igual que avui no hi surt cap
  acte sense comarca. No és un cas nou.
- Una permanent **caducada** no hi surt, perquè `data_fi >= avui` ja l'exclou. És
  el mateix criteri de vigència del §2, aplicat aquí.

*(De passada, i és un fet actual i no una conseqüència d'aquesta decisió: la
finestra de 7 dies ja té avui aquest mateix efecte sobre les exposicions llargues
d'`events.json`. Aquesta decisió no l'arregla ni pretén arreglar-lo: només diu
que el bloc de permanents no en depèn.)*

### Q5 — Sí, el pas 7 bis tradueix `periodicitat` · **RESOLTA**

**La decisió.** El pas 7 bis tradueix `periodicitat` **dins de la mateixa crida a
Gemini i sense cap crida extra**. La **regla dels noms propis hi val igual**. **Si
el camp arriba buit, no es tradueix res.**

**Per què cap crida extra.** El pressupost del camí de l'Action és de **300
crides per passada**, i el §7 bis de `CLAUDE.md` explica que la xifra és 300 i no
500 justament per deixar quota al Worker. Una crida per camp en lloc d'una per
fila doblaria el cost d'una passada sense afegir cap informació: el model ja té la
fila sencera davant. `demanaTraduccioGemini()`
(`eines/sincronitza-programada.js:1216`) ja envia `MUNICIPI`, `COMARCA`, `TÍTOL` i
`TEXT` en un sol missatge; `periodicitat` hi entra com una línia més i en surt
com una clau més.

**La regla dels noms propis hi val igual**, i no és teòrica: el prompt del 7 bis
ja porta com a exemple «le marché du front de mer de Sainte Marie la Mer vous
accueille **chaque samedi matin**» → «el mercat del front de mar de Santa Maria la
Mar obre **cada dissabte al matí**» (`eines/sincronitza-programada.js:357`). O
sigui que el text que ha d'anar a `periodicitat` és **exactament la mena de frase
que aquell prompt ja sap traduir bé**, amb el `MUNICIPI` manant sobre la forma del
nom del poble.

**Si el camp arriba buit, no es tradueix res**, i amb la regla del §6, Q1 això
serà el cas de gairebé totes les files de l'ADT66. No hi ha res a fer: el camp
buit passa endavant tal com és i el curador l'omple en revisar, exactament com ja
passa avui amb la banda catalana de les descripcions.

> **Aquesta decisió obre una tasca que aquest document NO fa.** Tocar el prompt
> del pas 7 bis és **fora d'abast** aquí i ho continua sent (§8). El que la Q5 fa
> és **decidir la direcció**, no escriure-la. La sessió que hi vagi ha de tocar
> tres coses del mateix fitxer, i totes tres a la vegada: `PROMPT_TRADUCCIO`, la
> fitxa que munta `demanaTraduccioGemini()` (1216) i `aplicaTraduccio()` (1110),
> que és qui reparteix la sortida del model als camps de la fila. **No és cap de
> les nou sessions del §7.**

---

## 7. Ordre d'implementació — una tasca per sessió

**Aquest document no executa res.** El que segueix és l'ordre proposat, amb la
condició de sortida de cada sessió. Cap sessió no comença fins que l'anterior no
l'ha complerta.

| Sessió | Tasca | Condició de sortida |
|---|---|---|
| ~~**0**~~ | ~~Decidir el nom del camp i les 5 preguntes obertes.~~ | **FETA el 8 de setembre de 2026.** El nom és `periodicitat` (§2) i les cinc respostes són al §6. |
| **1** | Escriure `eines/verifica-camps.js`, germà de `verifica-enum.js`: llegeix la llista bona de `prompts/extract-event.txt` i la compara amb els 23 llocs del §4 **i amb els ajudants de prova del §5**. **Encara amb 17 camps**, abans de tocar res més. | `node eines/verifica-camps.js` torna **0** sobre el repositori intacte, i torna **1** si se li treu un camp a mà d'un sol dels llocs. **Les dues sortides, mostrades.** |
| **2** | El prompt: les 3 còpies del §4.A. | `node eines/verifica-camps.js` torna **1** i assenyala **exactament els llocs restants**, ni un més ni un menys. |
| **3** | Els constructors del §4.B (punts 4–15) i els consumidors de dades (16–18). Inclou la **regla conservadora de la Q1** al punt 13 —amb la comprovació dels 33 valors de `COMMUNTHEME` **primer de tot**— i **l'avís de la Q3** al punt 17. | `node eines/verifica-camps.js` torna **0**. Les 3 bateries del §4.D que fallen —`mapeja-adt66`, `mapeja-recerca`, `processa-lot`— passen, amb el recompte de casos i de fallades mostrat. **Si els 33 temes no porten cap paraula de freqüència, es diu i la regla es deixa inactiva** (§6, Q1). |
| **4** | Els 7 ajudants de prova (punts 38–44 = els set del §5), i la **decisió sobre `CAMPS_CONTRASTABLES`** (§5, «Un cas a part»). | **Les 16 bateries offline passen.** Sortida de cadascuna, mostrada. |
| **5** | El frontend: punts 25–31 (`app.js`, `index.html`, `style.css`). **`esLlargaDurada()` i `DIES_LLARGA_DURADA` no es toquen** (§6, Q2). | Amb `prova-local.html`: una permanent surt a la secció nova; els 3 filtres l'amaguen; amb la secció buida, la `<section>` queda `hidden`. Verificat a ull, amb descripció o captura. **Si el rutatge de `pintaTot()` xoca de debò: la sessió s'atura i ho reporta** (§6, Q2) — i això compta com a sortida vàlida. |
| **6** | El mirall offline: `prova-local.html` (punts 32–37), amb files de prova permanents. | `prova-local.html` i `app.js` fan **el mateix**. La diferència entre els dos, mostrada i buida. |
| **7** | El digest: punts 19–24. `llegeixEsdevenimentsDeLaSetmana()` passa a tornar **dues llistes d'una sola lectura** (§6, Q4). | `respostaDigestDeProva()` (`worker/worker.js:1526`) genera un digest amb el bloc de resum, **sense cartell i sense línia per ocurrència**, i que **hi surt també quan cap permanent no té ocurrència aquella setmana**. Una sola crida a l'API de continguts al registre. **Cap desplegament**: el Worker es desplega quan el propietari ho digui. |
| **8** | El Typebot: la pregunta nova al servei + `docs/pas-5-typebot-questionari.md`. | Una tramesa de prova arriba a `pendents.json` **amb el camp omplert**. |
| **9** | Els 14 documents del §4.E, inclosa la **marca de superació** al paràgraf de `docs/HANDOFF-ADT66.md`, i l'entrada a `NOTES.md`. | Cap document no diu ja «16 camps» ni «disset camps» sense la data i el context. `grep` que ho demostri, mostrat. |

**Fora d'aquestes nou sessions**, i cadascuna és una tasca a part que ningú no ha
demanat encara:

- **La traducció del camp al pas 7 bis.** La direcció està decidida (§6, Q5),
  però toca `PROMPT_TRADUCCIO`, `demanaTraduccioGemini()` i `aplicaTraduccio()`,
  i **tocar el prompt de traducció és fora d'abast d'aquest document**.
- **Corregir el deute tècnic del §5** més enllà de la línia que li toqui a cada
  fitxer per aquest camp.
- **El drenatge de l'endarreriment de la cua.**

---

## 8. Què NO decideix aquest document

Perquè quedi dit i no s'hi torni: **el prompt de traducció del pas 7 bis, el
model de Gemini, els 4 ids duplicats, la categoria `Concentració`, la
deduplicació, el drenatge de l'endarreriment de la cua i qualsevol
desplegament** queden fora.

Aquest document fixa un canvi de contracte, n'inventaria el cost i registra el
deute tècnic que s'ha trobat pel camí. Res més.
