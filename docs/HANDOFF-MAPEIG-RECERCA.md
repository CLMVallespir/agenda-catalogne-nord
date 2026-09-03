# HANDOFF-MAPEIG-RECERCA.md — de l'esquema de recerca als 16 camps de producció

*29 d'agost de 2026. La taula camp a camp que explica `eines/mapeja-recerca.js`:
què entra, què surt, i què es descarta pel camí. Font de veritat del mapeig.
La funció és codi pur, cap crida a Gemini, i **no està connectada a res**.*

---

## 0. Els dos esquemes, i el número exacte

- **Producció:** els **17** camps canònics del §4 de `CLAUDE.md` —els setze de
  sempre més `nota_curador` (§4 d'aquest document). Aquesta peça hi aboca; no
  els redefineix.
- **Recerca:** els **31** camps de la capçalera de
  `docs/arxiu-google/esdeveniments-importacio.csv`, l'exportació de la recerca
  externa que va sembrar la cua (103 files).

**Una correcció d'entrada:** l'esquema de recerca té **31 camps, no 30**.
Comptats sobre la capçalera real del CSV. I dels 31, **18 no tenen cap
contrapartida a producció**, no 14. El recompte exacte:

| | Quants | Quins |
|---|---|---|
| Porten contingut a producció | **13** | `nom_original`, `nom_altra_llengua`, `data_inici`, `data_fi`, `hora_inici`, `lloc`, `municipi`, `comarca`, `categoria`, `descripcio_original`, `url_cartell`, `organitzador`, `url_font` |
| No en porten | **18** | els de la taula del §2 |
| **Total** | **31** | |

I al revés: **3 camps de producció no tenen cap origen a la recerca** —`estat`
(sempre `"pendent"`), `data_entrada` (l'hora del mapeig) i `nota_curador` (el
que aquest mapeig mateix ha trobat)—, i **`id` existeix als dos esquemes però
no es transporta mai**: es descarta i es reconstrueix.

---

## 1. Els 13 camps que arriben a producció

| Recerca | Producció | Què hi passa pel camí |
|---|---|---|
| `nom_original` | `titol` | Només si `llengua_nom_original` és `ca`. Si no, s'usa `nom_altra_llengua`; i si tampoc n'hi ha, passa el francès tal qual **amb avís**. |
| `nom_altra_llengua` | `titol` | La versió catalana quan l'original és francès. Buit a 95 de 103 files. |
| `data_inici` | `data_inici` | Tal qual. |
| `data_fi` | `data_fi` | Tal qual. |
| `hora_inici` | `hora` | Tal qual. Producció té **una** hora; `hora_fi` es descarta. |
| `lloc` | `lloc` | Tal qual. **`adreca` NO s'hi fusiona** (vegeu §2). |
| `municipi` | `municipi` | Es resol a la forma catalana amb la taula `MUNICIPIS_EQUIVALENTS`. La recerca el dona bilingüe («Prades / Prada»), en francès sol o en català sol, **i l'ordre de les dues bandes no és constant**. |
| `comarca` | `comarca` | Per `valorPermes` contra les cinc. «Alta Cerdanya» → `""` amb avís. |
| `categoria` | `categoria` | Es tradueix de l'anglès amb `CATEGORIES_RECERCA` i el resultat passa igualment per `valorPermes`. Sense equivalent → `""` amb avís. |
| `descripcio_original` | `descripcio_ca` **o** `descripcio_fr` | A la banda que digui `llengua_descripcio`; l'altra queda buida perquè la completi el curador. És la mateixa regla del Typebot (§7 de `CLAUDE.md`). |
| `url_cartell` | `imatge_url` | Tal qual. **No es puja res a Cloudinary aquí**: això és una altra tasca. |
| `organitzador` | `associacio` | Tal qual. |
| `url_font` | `font_url` | Tal qual. |

---

## 2. Els 18 camps que NO arriben a producció

Cap es perd en silenci: o bé és un senyal que es consumeix, o bé va a
`metadadades`.

| Recerca | Destí | Per què |
|---|---|---|
| `id` | **descartat** → `metadadades.descartats.id_original` | Regla del §4 de `CLAUDE.md`: l'id es reconstrueix sempre amb `creaId()`, mai s'hereta. La recerca en porta un de fet i amb una altra convenció. |
| `llengua_nom_original` | **senyal consumit** → `metadadades.llengua.titol` | Decideix d'on surt `titol`. No es transporta, però es conserva: explica per què el títol ha anat on ha anat. |
| `llengua_descripcio` | **senyal consumit** → `metadadades.llengua.descripcio` | Decideix a quina banda va la descripció. |
| `llengua_esdeveniment` | **provenença** → `metadadades.llengua.esdeveniment` | En quina llengua es fa l'acte. Buit a 86 de 103; producció no té camp per a això. |
| `dia_setmana_inici` | **descartat** | És derivable de `data_inici`. Guardar un valor derivat és guardar una cosa que es pot desincronitzar amb la real. |
| `hora_fi` | **descartat** → `metadadades.descartats.hora_fi` | Producció té un sol camp `hora`, i és l'hora de començar. |
| `adreca` | **descartat** → `metadadades.descartats.adreca` | **No es fusiona dins de `lloc`**: el §4 diu que `lloc` és el *nom del local*, i una adreça postal no ho és. Fusionar-les faria un camp que no és cap de les dues coses i que el frontend pinta com si fos un nom. |
| `zona_cerca` | **descartat** → `metadadades.descartats.zona_cerca` | És un artefacte de com es va organitzar la recerca, no una dada de l'acte. Sovint no coincideix amb `comarca` (hi ha «Alta Cerdanya» i «Fenolleda»). |
| `preu` | **descartat** → `metadadades.descartats.preu` | Producció no té camp de preu i el §8 no en demana cap. Es conserva perquè és informació real que algun dia pot fer falta. |
| `url_reserva` | **descartat** → `metadadades.descartats.url_reserva` | Ídem. **No** es fa servir com a recanvi de `font_url`: són dues coses diferents i barrejar-les enganyaria el lector. |
| `data_publicacio_font` | **provenença** → `metadadades.font.data_publicacio` | |
| `data_acces` | **provenença** → `metadadades.font.data_acces` | |
| `citacio_literal` | **provenença** → `metadadades.font.citacio_literal` | La prova textual que l'acte existeix i quan. |
| `confirmacio_2026` | **provenença** → `metadadades.confianca.confirmacio` | |
| `estat_vitalitat` | **provenença** → `metadadades.confianca.vitalitat` | |
| `nivell_confianca` | **provenença** → `metadadades.confianca.nivell` | `A` (84) o `B` (19). |
| `clau_dedup` | **descartat** → `metadadades.descartats.clau_dedup` | La deduplicació d'aquest projecte té la seva pròpia clau, calculada per `eines/dedup-esdeveniments.js`. Fiar-se d'una clau que ve de fora seria fiar-se de com una altra eina ha normalitzat els noms. |
| `motiu_null` | **provenença** → `metadadades.confianca.motiu_null` | Per què la recerca ha deixat un camp buit. |

---

## 3. Tres coses que costen una tarda si no se saben

**Els buits de la recerca són la cadena literal `"null"`.** No és cap valor nul
de JSON: és el text de quatre lletres, i n'hi ha a onze dels trenta-un camps.
Sense tractar-ho, producció acabaria amb municipis que diuen «null» i cartells
amb l'URL `null` —que el frontend intentaria carregar. `valorRecerca()` tracta
igual el camp absent, el buit, el `"null"` i el `"n/a"`.

**L'ordre de les dues bandes del municipi no és constant.** «Perpinyà /
Perpignan» té el català davant i «Prades / Prada» el té darrere. Qualsevol
regla de posició encerta la meitat de les vegades. Per això la banda bona es
decideix amb la taula, no comptant.

**Una categoria que cau a `""` no és cap error.** «sports», «gastronomy»,
«nature & outdoors», «community» i «other» no són cap de les tretze del §4, i
inventar-los un calaix seria decidir política editorial des del codi. Sobre les
103 files de recerca, **38 (el 37 %) es queden sense categoria**. El curador
decideix, o l'acte no entra: això és el `docs/CRITERI-EDITORIAL.md`, no aquesta
funció.

---

## 4. On viuen els avisos: RESOLT amb `nota_curador`

*Aquest apartat plantejava tres sortides. La decisió ja estava presa en una
planificació anterior i s'ha aplicat el 29 d'agost de 2026: **`nota_curador`,
camp dissetè de l'esquema.***

`mapejaAProduccio()` torna `{ fila, metadadades }`, i el repartiment és aquest:

| Què | On va | Viatja a pendents.json? |
|---|---|---|
| Els **avisos** del mapeig (títol per traduir, categoria sense calaix, comarca fora de l'enum, municipi desconegut, id buit) | `fila.nota_curador` | **Sí** |
| La **provenença** (font, confiança, llengua original, valors descartats) | `metadadades` | **No** |

Els avisos hi van perquè el seu destinatari és el curador i **el curador
llegeix files**. La provenença no, perquè el seu destinatari no és ningú encara.

Les regles del camp són al §4 de `CLAUDE.md`: buit per defecte, l'escriuen
només els agents de darrere, el frontend públic l'ignora, i només es mostra a
`curador.html` —cosa que **encara no s'ha fet**: el camp hi arriba, però pintar-lo
és una tasca a part.

`metadadades.avisos` continua existint amb la mateixa llista, estructurada, per
a les eines que la volen comptar (l'informe sobre CSV d'aquest mateix fitxer ho
fa). És la mateixa informació en dues formes, no dues informacions.

**El que segueix sense decidir** és on va la resta de la `metadadades`. Les dues
sortides que queden:

1. **Enlloc:** s'ensenya en el moment de revisar i mor allà. És el més fidel al
   §3 («cap base de dades», l'estat viu en dos fitxers JSON) i el més barat.
2. **Un tercer fitxer.** Trenca el §3. Val la pena recordar la lliçó de
   `NOTES.md` sobre la guarda del digest: abans d'inventar un lloc on desar
   estat, mira si el servei que fa la feina ja el desa.

Fins que això es decideixi, qui cridi `mapejaAProduccio()` fa el que vulgui amb
el segon valor —ensenyar-lo, registrar-lo o llençar-lo—, però **no l'ha de
posar dins de la fila**.

---

## 5. Provat

`node eines/mapeja-recerca.js` → **15 casos, 0 fallades.** Cobreixen: els 31
camps plens, tot buit, un registre buit del tot, comarca fora de l'enum,
categoria sense equivalent, categoria traduïble, categoria ja en català, l'id
que ve fet, descripció francesa, descripció catalana, títol francès sense
versió catalana, sense data d'inici, la cadena `"null"`, una fila neta que ha de
deixar `nota_curador` buida, i una fila amb quatre problemes alhora que els ha
de portar tots quatre a `nota_curador`.

Cada cas comprova a més, per a tots: que hi ha els disset camps en ordre, que
tots són cadenes, que **cap no val el text `"null"` ni `"n/a"`**, que
`data_entrada` és una marca ISO i que l'id de la recerca no ha sobreviscut. Com
que `registreDeProva()` omple els trenta-un camps d'origen amb `"null"`, aquella
comprovació els cobreix tots trenta-un, no només els que un cas vigila.

`node eines/mapeja-recerca.js docs/arxiu-google/esdeveniments-importacio.csv`
passa les **103 files reals** pel mapeig. Resultat: cap fila perduda, **101 de
103 municipis** resolts a la forma catalana, i els buits que queden són els que
la recerca ja no portava —97 `descripcio_ca`, 76 `imatge_url`, 38 `categoria`,
24 `associacio`, 20 `hora`, 6 `lloc`.

Les **dues** files que no resolen el municipi porten
`«Palaldà / Palalda, Amélie-les-Bains-Palalda»`: tres noms en un sol camp,
perquè Palaldà és un poble agregat dins del terme d'Amèlia. No és un forat de
la taula i no s'arregla afegint-hi una línia — és una fila que la recerca va
escriure malament i que ha de mirar el curador. Passa tal qual, amb avís.

---

## 6. Fora d'abast en aquesta tasca

No s'ha fet, i **no s'ha de suposar fet**: la connexió amb
`sincronitzaADT66()`, la connexió amb `comparaEsdeveniments()`, la pujada de
cartells a Cloudinary, el filtre editorial, la traducció de les descripcions i
qualsevol escriptura a `pendents.json`. Cada una és una tasca pròpia.
