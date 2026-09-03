# HANDOFF-CLASSIFICACIO.md — la classificació editorial R1–R7

*29 d'agost de 2026, ampliat el 30. Peça del canal d'ingestió: **només**
suggerir un nivell editorial per a una fila. Cap crida real a Gemini i cap
escriptura. **Cablejada a `processa-lot.js` i a `pipeline-offline.js` el 30
d'agost de 2026** (§7). Font de veritat per a la sessió següent.*

---

## 1. Què s'ha escrit

**`eines/classifica-editorial.js`** — una funció, `classificaEditorial(candidat,
cridaGemini)`, més el prompt condensat i les seves peces. Cap dependència fora
d'`eines/dedup-esdeveniments.js`. Node 18 o superior.

```
node eines/classifica-editorial.js            -> bateria de proves (21 casos)
node eines/classifica-editorial.js --prompt   -> escriu el prompt condensat
```

El candidat entra i surt amb la mateixa forma que a `dedup-esdeveniments.js`
—`{ fila, font: { tipus, llengua } }`— i l'únic que canvia és `nota_curador`:

```
[Suggeriment editorial: MARCAT — R2] Discurs en francès sense cap lligam amb el país.
```

Quatre coses que la peça **no** fa, i que són el seu disseny sencer: no toca
`estat`, no esborra res de `nota_curador`, no treu cap fila del camí —«FORA» és
text d'una nota i prou— i no crida cap API. La crida arriba injectada des de
fora, i per això la bateria passa sense clau i sense xarxa.

---

## 2. La sorpresa que hi havia, i com s'ha tancat

**RESOLTA el 29 d'agost de 2026, al vespre, pel propietari.**

El problema era aquest: les set regles donen TRES sortides —entra, marcat,
fora— i els nivells són QUATRE. R1–R7 no deien enlloc quan un «entra» és NUCLI
i quan és PERIFÈRIA; la distinció només vivia al §«Els quatre nivells», en dues
línies. Que el criteri sí que la sabia fer ho demostrava el recompte del mateix
document —**40 nucli i 37 perifèria** sobre 102 files—, però la regla que havia
partit aquelles 77 en dues meitats no era escrita enlloc.

Ara sí que ho és. `docs/CRITERI-EDITORIAL.md` tanca el §«Els quatre nivells»
amb el paràgraf que ho diu:

- **NUCLI** — el que entra per **R2, R3, R4 o R6**: dimensió catalana explícita
  al discurs, preferència associativa, obertura de patrimoni, o teixit
  associatiu i productiu. És el que dona el registre català. R6 ja porta en si
  mateix la reproducció del país i no necessita cap lligam addicional.
- **PERIFÈRIA** — el que **només** entra per **R5** (mèrit), sense cap altre
  lligam català explícit, perquè R5 admet expressament casos «encara que no
  tinguin cap dimensió catalana».
- **La pujada** — un cas de R5 que a més tingui un lligam català explícit per
  **R7** puja a NUCLI, i llavors la regla que es cita és R7, que és la que
  decideix la pujada.

**La primera redacció d'aquest paràgraf era errònia i es va corregir el 30
d'agost de 2026.** Tractava R5 i R6 com a simètrics («només entra per R5 o R6 =
PERIFÈRIA»), i no ho són: R5 admet explícitament casos «encara que no tinguin
cap dimensió catalana» —és una excepció de mèrit—, mentre que R6 diu que
mercats, fires i fòrums «reprodueixen la base material i social del país», que
és la definició de NUCLI que dona el mateix document. R6 és NUCLI directe i no
necessita cap pujada per R7.

El cas que ho ensenya és l'orgue d'Arles de Tec: entra per R5, i «Els Amics de
l'Orgue» amb el nom declarat en català el fa NUCLI. La bateria d'aquest fitxer
el porta ara com a **NUCLI — R7**; era l'únic cas que calia canviar-hi.

El prompt condensat porta la mateixa distinció, en instrucció breu, dins del
bloc dels quatre nivells. No es calcula res al codi: és text per al model, com
la resta del criteri.

**La segona sorpresa NO era una sorpresa, i no hi ha res a tancar.** El semàfor
del cap Béar és una visita guiada en francès —R4 diu «fora»— i el document
n'arxiva MARCAT. Un model que llegeixi el prompt condensat i apliqui R4 al peu
de la lletra suggerirà FORA, i **això és el comportament correcte**: aquell cas
és un dels tres que el document marca expressament com a **discutibles**, i la
seva gratuïtat és circumstancial (les Jornades del Patrimoni financen l'entrada
qualsevol any), no un tret del contingut. Convertir-la en criteri general seria
justament l'excepció silenciosa que el document prohibeix. La classificació és
sempre suggeriment i el curador té la darrera paraula: que el model digui FORA i
Miquel deixi MARCAT és el sistema funcionant, no un forat. **Cap acció de codi,
ni ara ni després.**

---

## 3. Les decisions de disseny, i per què

1. **`ajuntaNotes()` es reutilitza, no es copia.** Viu a
   `eines/dedup-esdeveniments.js` i ara està exportada. La regla d'ajuntar dues
   notes de curador —totes dues, mai una— ha de dir el mateix a tot arreu; és el
   mateix motiu pel qual la taula de pobles va acabar a `pobles-alies.js`
   (vegeu `NOTES.md`). L'única línia tocada d'aquell fitxer és el
   `module.exports`.

2. **La crida rep `(fila, font)`, no només `(fila)`.** El segon argument és
   opcional i una funció d'un sol argument continua servint. Hi és perquè R3 i
   R7 parlen de qui organitza, i al prompt la font va etiquetada com el que és:
   *d'on surt la fitxa, NO qui organitza l'acte*. Un agregador pot portar
   perfectament el mercat d'un poble, i confondre les dues coses seria aplicar
   R3 al revés.

3. **La taula de casos NO és al prompt.** Els vuit casos i els tres discutibles
   són història de com es va fixar el criteri. Posats al prompt, convidarien el
   model a fer d'advocat («això s'assembla al tren roig») en comptes d'aplicar
   les regles. Serveixen per **provar** el prompt, que és exactament el que fa
   la bateria.

4. **Una classificació que falla escriu una nota que ho diu.** Si el model peta,
   respon un nivell inventat, o no hi ha classificador connectat, la fila surt
   igualment amb `[Suggeriment editorial: no disponible] Sense classificar: …`.
   El silenci enganyaria: una fila sense línia de classificació sembla una fila
   que ha passat el criteri, i podria ser una fila que ningú no ha mirat mai.

5. **`thinkingLevel: 'low'`, no `'minimal'`.** És l'única desviació respecte del
   Worker, i és a posta: allà és una extracció i aquí és una decisió. Si el cost
   o la latència molesten, es baixa a `'minimal'` i es torna a passar la bateria
   —que no ho detectarà, perquè no crida el model: caldrà mirar-ho amb files
   reals.

6. **No és idempotent.** Classificar dues vegades la mateixa fila hi deixa dos
   suggeriments, i si el model canvia d'opinió, dos que es contradiuen. Treure
   el vell voldria dir esborrar contingut de `nota_curador`, i això no es fa
   mai. Qui la cablegi ha de saber quines files ja han passat.

---

## 4. Provat el 29 d'agost de 2026

`node eines/classifica-editorial.js` → **21 casos, 0 fallades**, sense xarxa:

| Bloc | Casos | Què comprova |
|---|---|---|
| Els vuit de la taula de `CRITERI-EDITORIAL.md` | 8 | la nota porta el nivell i la regla canònics (l'orgue d'Arles de Tec és NUCLI — R7 des de la regla del §2) |
| Els tres discutibles | 3 | igual, amb la decisió que el document va deixar escrita — el cap Béar hi segueix com a MARCAT — R4 |
| Concatenació de la nota | 3 | la nota d'un altre agent es conserva sencera i davant; una fila sense el camp el rep, i queda l'últim |
| Respostes dolentes del model | 4 | nivell inventat, regla inventada, «PERIFERIA» sense accent, motiu de tres paràgrafs |
| Res no va bé | 3 | el model peta, no hi ha classificador, la fila no té text (i llavors no es gasta cap crida) |

A més, **a cada un dels 21 casos** es comprova que `estat` no s'ha tocat, que
cap dels altres camps no ha canviat, que tots són cadenes, que la nota prèvia
segueix al començament de la nota final i que el descriptor de font ha
sobreviscut.

Les bateries de les altres eines s'han tornat a passar després de tocar
l'exportació de `dedup-esdeveniments.js`: dedup 9/0, `mapeja-recerca` 15/0,
`processa-lot` i `filtra-candidats` tots verds.

---

## 5. Fora d'abast en aquesta tasca

No s'ha fet i **no s'ha de suposar fet**: la crida real a Gemini, qualsevol
escriptura a `pendents.json`, i pintar el suggeriment de cap manera especial a
`curador.html` (hi surt com qualsevol altra nota, dins l'avís groc).

El cablejat a `processa-lot.js` i a `pipeline-offline.js` **sí** que s'ha fet,
el 30 d'agost de 2026: és al §7.

## 6. Preguntes obertes per a la sessió següent

1. ~~**Dos casos de la bateria que la regla nova posa en dubte**~~ — **TANCADA
   el 30 d'agost de 2026.** La pregunta era si **el mercat de Prada** i **els
   fòrums de les associacions**, que entren per R6 sense cap lligam català
   explícit, havien de baixar a PERIFÈRIA (com deia la primera redacció del
   paràgraf) o quedar-se a NUCLI (com deia la bateria). **Val la segona: R6 fa
   NUCLI per ell mateix i no li cal cap pujada per R7.** Qui s'havia d'afinar
   era el paràgraf, no les proves. El motiu és al §2: R6 diu «reprodueixen la
   base material i social del país», que és la definició mateixa de NUCLI. La
   bateria no s'ha tocat i els dos casos continuen sent **NUCLI — R6**.
2. ~~**Quan es classifica**~~ — **TANCADA el 30 d'agost de 2026 amb el
   cablejat.** El filtre previ i la deduplicació van sempre abans, i la
   classificació és l'últim pas de `processaLot()`. Un candidat descartat pel
   filtre no gasta cap crida, i tres candidats que es fusionen en gasten una,
   no tres. Queda oberta la segona meitat de la pregunta: si el nivell FORA
   d'una font ja coneguda es pot decidir sense preguntar res. **No s'ha fet
   cap heurística d'aquestes**, i mentre no hi hagi dades de crides reals no
   se n'ha de fer cap.
3. **Què en fa el curador.** El suggeriment arriba com a text dins de
   `nota_curador` i s'atura a `pendents.json`, com tot el camp (§4 de
   `CLAUDE.md`). Si algun dia s'hi vol filtrar o ordenar la cua, això demana un
   camp propi, i un camp propi demana tocar l'esquema dels disset.

---

## 7. El cablejat al pipeline — 30 d'agost de 2026

`eines/classifica-editorial.js` no s'ha tocat. El que ha canviat són els dos
fitxers que l'envolten:

- **`processaLot(candidatsRecerca, fontDelLot, cridaGemini)`** — tercer
  paràmetre, opcional, injectat igual que a la peça: mai una crida de debò
  construïda aquí dins. La classificació és el pas **5**, després del mapeig i
  del dedup. La funció ara és `async`.
- **`pipelineOffline(candidatsRecerca, fontDelLot, avui, cridaGemini)`** —
  quart paràmetre, que no fa res més que passar avall. La resta del flux
  —filtre → mapeig+dedup— no ha canviat gens. També és `async`.

Dues conseqüències que val més saber que descobrir:

1. **Totes dues funcions tornen una promesa, amb classificador o sense.** Sense
   `cridaGemini` no es classifica res i no s'espera res, però qui les cridi les
   ha d'esperar igualment. És l'únic canvi de forma respecte d'abans.
2. **Sense `cridaGemini` no es crida `classificaEditorial()` en absolut.** No és
   una optimització: cridar-la sense funció escriuria «Sense classificar: no hi
   ha cap classificador connectat» a cada fila, i això no és el mateix que no
   classificar. Un lot processat sense classificador surt idèntic al que sortia
   abans que aquest pas existís, nota per nota.

### Per què `dubtosos` no es classifica

**Decidit el 30 d'agost de 2026. És una decisió, no un descuit.** El
suggeriment editorial s'aplica NOMÉS a `llestos` —és la regla 4 de
`eines/processa-lot.js`, escrita allà mateix perquè qui obri el fitxer la
trobi.

Una fila de `llestos` ja està assentada: és la que anirà a la cua, i
classificar-la és classificar el que hi haurà de debò. Una fila de `dubtosos`
encara no ho és —n'hi ha dues, a `opcions`, i el curador encara ha de dir si
són el mateix acte. Classificar-les voldria dir:

- gastar **dues** crides per a una fila que pot acabar sent una de sola;
- acabar amb **dos suggeriments contradictoris** si el model no diu el mateix
  de totes dues, i ningú no sabria com fusionar-los —`classificaEditorial()`
  **no és idempotent** (§3.6): tornar a classificar la fila fusionada hi
  deixaria un tercer suggeriment al costat dels dos vells;
- classificar dades que encara es poden fusionar **o descartar**.

**Quan es reconsiderarà:** el dia que `curador.html` sàpiga demanar la
classificació *després* que el curador hagi resolt el dedup a mà. Llavors la
fila que en surti serà una fila assentada com qualsevol altra i es classificarà
una sola vegada. Fins llavors, les files de `dubtosos` arriben al curador amb
la seva nota de mapeig i prou, i **cap heurística no supleix el suggeriment**:
posar-n'hi una de provisional seria l'excepció silenciosa que
`docs/CRITERI-EDITORIAL.md` prohibeix.

### Provat el 30 d'agost de 2026

Sense clau i sense xarxa, amb el mateix mock canònic de la bateria de la peça
(una funció que sempre respon `{ NUCLI, R6, … }` i es compta les crides):

| Bateria | Comprovacions noves | Què comprova |
|---|---|---|
| `processa-lot.js`, sense classificador | 1 | cap fila no porta cap nota de classificació: el lot surt idèntic al d'abans |
| `processa-lot.js`, amb classificador | 10 | el repartiment no es mou; 3 crides per 3 files llestes; totes en porten el suggeriment; l'ordre de les dues notes és el d'`ajuntaNotes()`; cap fila de `dubtosos` no en porta; les metadadades segueixen indexades per la fila nova i la fusionada conserva les 3 procedències; els disset camps, intactes |
| `processa-lot.js`, classificador que peta | 2 | el lot no s'atura i les tres files surten amb la nota que ho diu |
| `pipeline-offline.js`, sense classificador | 5 | el repartiment (1 llest, 1 parella dubtosa, 1 descartat per la finestra) i cap nota de classificació enlloc |
| `pipeline-offline.js`, amb classificador | 8 | el mateix repartiment; 1 sola crida —ni la dubtosa ni la descartada no en gasten cap—; la fila llesta porta el suggeriment; les dues dubtoses no; el rastre de metadadades no s'ha trencat |

**26 comprovacions noves, totes verdes.** I les bateries que ja hi havia,
tornades a passar després del cablejat:

```
node eines/dedup-esdeveniments.js    ->  9 casos, 0 fallades
node eines/mapeja-recerca.js         -> 15 casos, 0 fallades
node eines/filtra-candidats.js       -> totes les comprovacions passen
node eines/classifica-editorial.js   -> 21 casos, 0 fallades
node eines/processa-lot.js           -> totes les comprovacions passen
node eines/pipeline-offline.js       -> totes les comprovacions passen
```

`node eines/pipeline-offline.js <fitxer.csv>` continua fent l'informe sobre un
CSV real i el fa **sempre sense classificador**: no hi ha cap crida de debò en
tot aquest camí, ni amb clau ni sense. La canonada no s'ha tornat a executar
contra el CSV real amb cap classificador connectat.
