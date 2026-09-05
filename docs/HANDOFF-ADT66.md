# HANDOFF-ADT66.md — la sincronització diferencial del flux de l'ADT66

*29 d'agost de 2026. Primera peça del canal d'ingestió de fonts externes:
**només** saber quines ofertes han canviat. Cap crida a Gemini, cap escriptura
a `pendents.json`, cap deduplicació, cap classificació. Font de veritat per a
la sessió següent.*

---

> **CORRECCIÓ DEL 29 D'AGOST DE 2026, AL VESPRE.** Aquest document va donar per
> bloquejat el canal, dient que el flux de l'ADT66 no porta dates d'acte i que
> calia demanar a l'ADT66 una sindicació més completa. **Era fals.** El flux les
> porta totes, i també descripcions, municipi, categoria i cartells: el que no
> les portava era l'endreça per on hi miràvem. **No cal escriure cap correu a
> l'ADT66 i no hi ha res bloquejat.** El §2 bis ho explica; els §1 i §2
> descriuen un camí que ja no fem servir i es conserven només com a rastre.

> **CORRECCIÓ DEL 30 D'AGOST DE 2026.** El §3 bis d'aquest document deia que
> «`font_url` apunta a la fitxa de l'ADT66, que porta el calendari sencer», i
> la taula del §2 bis deia que `font_url` és `DETAILSITEWEB`. **Manava la
> taula.** Comprovat amb `curl` sobre el flux sencer: `font_url` és el web de
> **l'organitzador**, 606 de 1 504 ofertes, i **no hi ha cap fitxa de l'ADT66
> enllaçable des del flux**. El **§2 ter** ho documenta i el §3 bis queda
> corregit. El **§2 quater** hi afegeix la frase que faltava: **l'esquema no
> creix, el `SyndicObjectID` no s'hi afegeix mai.**

> **CORRECCIÓ DEL 3 DE SETEMBRE DE 2026 — LES XIFRES I LA TAULA DE
> CATEGORIES.** Aquest document dona el nombre d'ofertes del flux com si fos
> una constant, i n'hi diu tres de diferents segons el paràgraf: **1 543**,
> **1 504** i **1 416 039 bytes**. El §5 bis explica què s'ha mesurat de debò
> el 3 de setembre de 2026, amb el flux sencer baixat: **1 463 ofertes**.
>
> **Cap de les xifres velles no era una mentida i cap no s'ha de «corregir»
> a l'alça o a la baixa: el flux és viu.** Els actes passats en cauen i n'hi
> entren de nous cada dia, o sigui que el recompte es mou tot sol. El defecte
> no és el número, és **escriure'l sense la data**. D'aquí endavant, cap
> xifra d'aquest document no va sense el dia que es va mesurar.
>
> El §5 bis també tanca el punt 3 del §«El que queda obert»: la taula
> `CATEGORIES_ADT66` **ja està mesurada** contra el flux real.

> **CORRECCIÓ DEL 4 DE SETEMBRE DE 2026 — `Structure.Name` NO EXISTEIX.** La
> taula del §2 bis deia que, quan `DETAILCONTACT` és buit, «`Structure.Name` és
> l'oficina». **És fals: el payload no porta cap camp `Structure`.** Comprovat
> sobre el flux sencer baixat el 4 de setembre de 2026 (1 513 ofertes): les 35
> claus de cada oferta són literalment
>
> ```
> SyndicObjectID · Published · Updated · SyndicObjectName · SyndicStructureId ·
> GmapLatitude · GmapLongitude · ObjectTypeFix · ObjectTypeName ·
> SyndicObjectOrder · DETAILPROGRAMME · COMMUNTHEME · DETAILADRESSE ·
> LISTINGACCROCHE · DETAILTELEPHONE · ACCROCHE150 · Commune · DETAILCONTACT ·
> COMMUNCATEGORIE · TRI · DETAILPHOTO · DETAILPHOTO_DIAPO · COMMUNDATE ·
> DETAILCOURRIEL · CHAMPSYSTEME · LISTINGPHOTO · LISTINGPHOTO_DIAPO ·
> DETAILDESCRIPTIF · DETAILCOMMUNE · COMMUNTYPE · COMMUNLIEU ·
> DETAILFETEPAYANTE · DETAILSITEWEB · RechercheTYPE · COMMUNNOM
> ```
>
> `Structure` no hi és enlloc. El que hi ha és **`SyndicStructureId`**, un GUID
> sense cap nom al costat: hi és a les 1 513 ofertes i té **29 valors
> distints** —les oficines de turisme que alimenten el flux—, però el flux no
> diu de cap manera com es diu cadascuna. Un identificador no és un nom.
>
> *De passada, això tanca la pregunta dels «dos camps que falten dels 35» que
> el bàner de `eines/mapeja-adt66.js` deixava oberta: són `ObjectTypeFix` i
> `SyndicObjectOrder`, tots dos interns i tots dos sense cap ús.*
>
> **LA CONSEQÜÈNCIA, I NO ÉS PETITA.** Sense `Structure.Name` no hi ha cap
> recanvi per a `associacio`: queda `DETAILCONTACT` sol, **buit a 1 213 de les
> 1 513 ofertes del 4 de setembre de 2026 — quatre de cada cinc**. O sigui que
> per a la gran majoria de les ofertes **el flux no diu qui organitza l'acte**.
>
> Tres regles de `docs/CRITERI-EDITORIAL.md` demanen justament això i, per
> tant, **no es poden mecanitzar des del flux**:
>
> - **R3** (fora el que és atracció turística, i el país hi fa de decorat) —
>   distingir el productor que ven al seu poble de l'oficina de turisme que ven
>   un tast demana saber qui ho organitza.
> - **R4** (una visita comentada és discurs, fora si no és en català) — el flux
>   no declara mai la llengua, i l'organitzador era l'altra via per deduir-la.
>   El que sí que es pot fer és el retall de `eines/sincronitza-programada.js`,
>   que treballa amb el senyal textual i amb l'excepció de «Portes ouvertes» i
>   no pregunta mai qui organitza.
> - **R7** (davant d'un dubte, investiga l'organitzador) — literalment
>   impossible: no hi ha organitzador a investigar. És feina del curador, una
>   fila cada vegada.
>
> La conclusió pràctica: aquestes tres regles es queden **al criteri del
> curador**, no al codi, i cap agent automàtic no les ha d'intentar. La
> `nota_curador` és el lloc on avisar-lo que la fila no en porta.

---

## 0. Què hi havia abans d'això

No hi havia cap fase a `FASES.md` ni cap `HANDOFF-*.md`. El que sí que hi havia,
i que aquest document continua:

- **`docs/FONTS-I-FLUXOS-CATALUNYA-NORD.md`** (28–29 d'agost) — el sondeig de
  quatre fonts. Hi dona Tourinsoft/ADT66 per **CONFIRMADA** i tanca en negatiu
  la via WordPress REST; IntraMuros necessita clau, demanada per correu; el CMS
  de rutes `.htm` queda inconclús.
- **`eines/sondes-fonts.js`** — el guió de sondeig, amb el bloc `sondaTourinsoft`
  que va trobar el GUID i la forma de l'URL.
- **`PROJECT-KNOWLEDGE-CHAT.md`** — una línia que diu que la ingestió externa
  està «investigada però no construïda» i que no és feina planificada.

**Una correcció respecte d'aquell sondeig.** Anotava «flux diferencial des de
2026-08-28 — 200 application/atom+xml (1 416 039 bytes)». No és un 200: és un
**302**, i el que el sondeig va mesurar és el contingut del destí, perquè el
`fetch` de Node segueix les redireccions tot sol. La distinció importa, perquè
el codi de resposta d'aquest GET **és** el mecanisme diferencial.

---

## 1. El comportament real de l'API v3, confirmat amb curl

Tot verificat el 29 d'agost de 2026 contra
`https://api-v3.tourinsoft.com/api/syndications/cdt66.tourinsoft.com/60a37063-5667-45f8-82e1-a1db2d8375b9`.
Les v1 i v2 estan obsoletes.

### 1.1 El client

| Client a la ruta | Resposta a `/metadata` |
|---|---|
| `cdt66.tourinsoft.com` | **200**, JSON de 1 744 bytes |
| `cdt66` | 500, 40 bytes |

Cal el nom llarg. El GUID és el mateix de sempre; no calia cap sindicació v3
nova.

### 1.2 El GET amb data: el codi de resposta ÉS el mecanisme

`GET …/{GUID}/{AAAA-MM-DD}`, **sense seguir la redirecció**:

| Data demanada | Codi | Què vol dir |
|---|---|---|
| `2025-01-01` … `2026-08-29` | **302** | hi pot haver canvis; el `Location` diu on és la llista |
| `2024-01-01`, `2000-01-01` | **401** `WWW-Authenticate: Bearer` | fora de la finestra diferencial → importació completa |
| `2027-01-01` (futur) | **404** | res tocat des d'aleshores |
| `xxxx`, `2026-08-28T12:00:00` | **400** | la ruta només accepta `AAAA-MM-DD`, **cap hora** |
| (sense data) i `POST` a l'arrel | **429** `Retry-After: 300` | el servidor està refent la memòria cau |

La finestra diferencial és d'**uns dos anys**: `2025-01-01` encara dona 302 i
`2024-01-01` ja dona 401. No s'ha afinat més perquè no cal.

### 1.3 La troballa que canvia el disseny

**El `Location` del 302 és sempre exactament el mateix, sigui quina sigui la
data demanada:**

```
http://wcf.tourinsoft.com/Syndication/3.0/cdt66/{GUID}/Objects?$select=SyndicObjectID,Updated&$format=
```

Comprovat amb sis dates diferents (2025-01-01, 2025-09-25, 2026-01-01,
2026-06-01, 2026-08-25, 2026-08-29): capçalera idèntica caràcter a caràcter.

O sigui que **l'API no filtra res per data**. La data de la ruta només serveix
perquè el servidor decideixi entre 302, 401 i 404. El que torna sempre és la
llista **sencera** d'identificadors amb la seva data de modificació, i **la
comparació l'hem de fer nosaltres**. Això confirma el que ja se sabia: no és
una consulta filtrada per data.

Dos retocs obligatoris sobre aquest `Location`:

- Arriba en **`http://`**. Cal reescriure'l a `https://`.
- Porta **`$format=`** buit, que per defecte dona `application/atom+xml`:
  **1 418 844 bytes**. Amb `$format=json` la mateixa llista fa **109 846
  bytes** i es llegeix amb `JSON.parse`. Tretze vegades menys, i sense haver
  d'analitzar XML enlloc — que en aquest projecte voldria dir escriure un
  analitzador a mà.

### 1.4 La llista d'ofertes

`GET …/Objects?$select=SyndicObjectID,Updated&$format=json` →

```json
{"odata.metadata":"…","value":[
  {"SyndicObjectID":"FMALAR066FS0009D","Updated":"2026-06-26T16:14:18"},
  {"SyndicObjectID":"FMALAR066V50MJYW","Updated":"2026-08-14T10:21:37"}
]}
```

- **1 543 ofertes**, tots els identificadors únics, tots de **16 caràcters**.
- **Cap `odata.nextLink`**: ve sencera, no hi ha paginació a gestionar.
- `Updated` va del `2025-09-26T13:54:11` al `2026-08-28T18:19:15.24`.
- **Quatre formes de `Updated`**, totes amb el mateix tronc
  `AAAA-MM-DDTHH:MM:SS` i una cua opcional de fracció de segon:
  sense fracció (1 290), `.9999999` (184), `.99` (61), `.9` (8).
  **Cap no porta zona horària.**

### 1.5 Llegir una oferta sencera

`GET …/Objects('FMALAR066V50MJYW')?$format=json` → **200**, 2 992 bytes, el
registre complet: `SyndicObjectName`, `GmapLatitude`/`GmapLongitude`,
`ObjectTypeName` («Fêtes et manifestations»), `Published`, `Updated`, etc.

Val la pena saber-ho perquè vol dir que **hi ha un camí per identificador que
no és el POST**, i que és un GET normal.

---

## 2. El POST amb identificadors d'oferta

Aquest és l'únic tros que **no ha quedat confirmat** en aquesta sessió.

El `POST` a l'arrel de la sindicació
(`…/api/syndications/cdt66.tourinsoft.com/{GUID}`) va tornar **429 «Caching in
progress», `Retry-After: 300`**, amb el cos buit, tant amb `["ID","ID"]` com
amb `{"ids":["ID","ID"]}`. El mateix 429 el dona el `GET` nu a la mateixa
adreça, o sigui que el 429 **no diu res sobre la forma del cos**: diu que el
servidor estava construint la memòria cau del flux complet en aquell moment.

**ESTAT: CONFIRMAT** el 29 d'agost de 2026, un cop refredada la memòria cau.
`POST …/api/syndications/cdt66.tourinsoft.com/{GUID}`, `Content-Type:
application/json`:

| Cos enviat | Resposta | Què torna |
|---|---|---|
| `["ID1","ID2"]` (llista nua) | 200, 2 123 bytes | **exactament les 2 ofertes demanades** |
| `{"ids":["ID1","ID2"]}` | 200, **1 191 085 bytes** | **les 1 543 ofertes**, el flux sencer |
| els **1 543** identificadors de cop | 200, 1 578 394 bytes | les 1 543 ofertes, en **una sola petició** |
| `POST` sobre la ruta amb data | **405** `Allow: GET` | el POST només va a l'arrel, sense data |

Dues coses que val la pena no haver de descobrir dues vegades:

- **El cos ha de ser una llista nua.** Amb `{"ids": […]}` el servidor no es
  queixa: torna **200 i el flux sencer**. Un embolcall mal posat no falla, es
  disfressa d'èxit i multiplica per 560 el que baixes. Si algun dia una
  importació «diferencial» torna 1 543 registres, mira primer la forma del cos.
- **1 543 identificadors caben en una sola petició** (29 318 bytes de cos). O
  sigui que una importació completa són **dues subpeticions** —el GET de la
  llista i el POST dels objectes—, no 1 543. El sostre de 50 subpeticions del
  pla gratuït de Cloudflare no és cap problema per a aquest pas.

El `GET` nu a la mateixa adreça, un cop calenta la cau, torna el flux complet en
**atom (5 053 216 bytes)**. El POST amb tots els identificadors dona el mateix
contingut en JSON i ocupa un terç: no hi ha cap motiu per fer servir el GET nu.

El camí per identificador del §1.5 queda com a recanvi per a un cas solt.

---

## 2 bis. RESOLT: el flux sí que porta les dates, i tot el que falta

**Aquest apartat deia el contrari fins al 29 d'agost de 2026 al vespre. Deia que
el flux no portava ni dates d'acte, ni descripcions, ni municipi, i que calia
demanar a l'ADT66 una sindicació més completa. Era fals, i val la pena entendre
per què, perquè l'error és fàcil de repetir.**

### L'error: confondre el porter amb el flux

`api-v3.tourinsoft.com` **no és la sindicació**. És un porter que respon 302 i
et diu, a la capçalera `Location`, on és el flux de debò. El que serveix ell
mateix —pel `POST` del §2, i pel `GET` amb `$select=SyndicObjectID,Updated` del
§1.4— és una vista aprimada de deu camps més els dotze de l'estructura. La seva
`/metadata` declara aquests vint-i-dos i prou, i per això semblava un sostre.

No ho és. La `/metadata` de l'api-v3 descriu **el que l'api-v3 exposa**, no el
que la sindicació conté. El destí de la redirecció —el WCF, `wcf.tourinsoft.com`,
la mateixa sindicació, el mateix GUID— en serveix **trenta-cinc**:

```
GET https://wcf.tourinsoft.com/Syndication/3.0/cdt66/{GUID}/$metadata
```

Els deu de sempre, més: `DETAILPROGRAMME`, `COMMUNTHEME`, `DETAILADRESSE`,
`LISTINGACCROCHE`, `DETAILTELEPHONE`, `ACCROCHE150`, `Commune`, `DETAILCONTACT`,
`COMMUNCATEGORIE`, `TRI`, `DETAILPHOTO`, `DETAILPHOTO_DIAPO`, `COMMUNDATE`,
`DETAILCOURRIEL`, `CHAMPSYSTEME`, `LISTINGPHOTO`, `LISTINGPHOTO_DIAPO`,
`DETAILDESCRIPTIF`, `DETAILCOMMUNE`, `COMMUNTYPE`, `COMMUNLIEU`,
`DETAILFETEPAYANTE`, `DETAILSITEWEB`, `RechercheTYPE`, `COMMUNNOM`.

**La lliçó, per no repetir-la:** quan una API et redirigeix, la metadata que
val és la del destí, no la del porter. I una `/metadata` que declara vint-i-dos
camps genèrics per a un objecte «Fêtes et manifestations» —sense cap data
d'acte— hauria d'haver fet sospitar de seguida: cap oficina de turisme no
publica una agenda sense dates. El senyal hi era.

### El que hi ha, comprovat sobre les 1 543 ofertes

| Ens cal | D'on surt | Cobertura |
|---|---|---|
| `titol` | `SyndicObjectName` (majúscules, francès) | 1 543/1 543 |
| `data_inici`, `data_fi` | **`TRI`** — totes les dates de l'acte en DD/MM/AAAA separades per espais | **1 543/1 543** |
| `hora` | `COMMUNDATE`, el primer «De HH:MM» | 900/1 543 |
| `lloc` | `COMMUNLIEU`, i `DETAILADRESSE` per al carrer | 1 527/1 543 |
| `municipi` | `Commune` (i `DETAILCOMMUNE` amb codi postal) | 1 543/1 543 |
| `comarca` | del municipi, no de les coordenades | — |
| `categoria` | `RechercheTYPE` («Concert», «Théâtre», «Exposition»…), **i `COMMUNTHEME` per damunt** quan el tema és «Pour enfant» o «Conte» (§5 bis.3, correcció del 4 de setembre) | 1 412/1 543 |
| `descripcio_fr` | `DETAILDESCRIPTIF`; `ACCROCHE150` com a resum curt | 1 543/1 543 |
| `descripcio_ca` | traducció — feina de Gemini, com sempre | — |
| `imatge_url` | `LISTINGPHOTO` porta l'`<img src>` sencer a `cdt66.media.tourinsoft.eu` | 1 514/1 543 |
| `font_url` | `DETAILSITEWEB` — **el web de l'organitzador**, no cap fitxa de l'ADT66 (§2 ter) | 623/1 543 el 29 d'agost; **606/1 504** el 30 |
| `associacio` | **`DETAILCONTACT` i prou.** No hi ha cap recanvi: `Structure.Name` **no existeix** al payload (vegeu la correcció del 4 de setembre, aquí sota) | 294/1 543 el 29 d'agost; **300/1 513** el 4 de setembre |

Un registre sencer, retallat:

```json
{ "SyndicObjectID": "FMALAR066FS0009D",
  "SyndicObjectName": "LES OCCASIONS DU MULTICOQUE & DU REFIT",
  "TRI": "16/10/2026 17/10/2026 18/10/2026",
  "COMMUNDATE": "<strong>Le 16/10/2026 De 10:00 &agrave; 19:00</strong><br />…",
  "Commune": "CANET-EN-ROUSSILLON",
  "COMMUNLIEU": "<strong>Lieu :</strong> au Port",
  "DETAILDESCRIPTIF": "<strong>Descriptif de la manifestation :</strong> Canet-en-Roussillon devient…",
  "LISTINGPHOTO": "<img src=\"http://cdt66.media.tourinsoft.eu/upload/nautipole-1.jpg?width=150&height=120\" />",
  "DETAILSITEWEB": "<a href='https://www.lesoccasionsdumulticoque.com/' …>",
  "RechercheTYPE": "Exposition,Foire" }
```

**Els camps venen amb HTML a dins** —etiquetes, entitats `&agrave;`, i sovint
una etiqueta en francès enganxada al davant («**Descriptif de la manifestation :**»,
«**Lieu :**»)—. Netejar-los és feina del mapatge, que és una altra tasca.

### El segon regal: el WCF filtra per data de debò

El §1.3 diu que «l'API no filtra res per data». És cert de l'api-v3, i és fals
del WCF, que és OData 3 sencer i accepta `$filter`:

```
GET …/Objects?$format=json&$filter=Updated%20gt%20datetime'2026-08-01T00:00:00'
```

| Marca | Ofertes retornades |
|---|---|
| (sense `$filter`) | 1 543 |
| `2026-08-01T00:00:00` | **801** |
| `2026-08-25T00:00:00` | 315 |
| `2026-08-28T18:19:15.24` (la més alta) | 0 |
| `2027-01-01T00:00:00` | 0 |
| `2024-01-01T00:00:00` | 1 543 |

Les 801 són **exactament** les que la comparació local del disseny anterior
donava per a la mateixa marca: el filtre del servidor i el nostre coincideixen.

Tres conseqüències:

- El literal `datetime'…'` **accepta la fracció de segon** de les marques de
  l'ADT66 tal com venen. No cal retallar-les.
- **No hi ha finestra de dos anys.** El 401 era una invenció de l'api-v3;
  `2024-01-01` al WCF torna les 1 543 sense queixar-se.
- Tampoc no hi ha paginació: cap `odata.nextLink` en cap de les proves, ni
  demanant-ho tot.

O sigui que una sincronització és **una sola petició GET**, amb tots els camps
i ja filtrada. No calen ni el 302, ni el `POST`, ni la comparació local, ni el
sostre de subpeticions de Cloudflare.

**Els §1 i §2 queden com a documentació d'un camí que ja no fem servir.** Es
conserven perquè expliquen d'on surt l'adreça del WCF i perquè el 401/404/429
de l'api-v3 no torni a costar una tarda si algú hi ensopega.


## 2 ter. RESOLT: què és `font_url`, i per què no pot ser la fitxa de l'ADT66

*30 d'agost de 2026, comprovat amb `curl` contra el flux real.*

Aquest document es contradeia. El §3 bis deia «**`font_url` apunta a la fitxa
de l'ADT66, que porta el calendari sencer**»; la taula del §2 bis deia que
`font_url` surt de `DETAILSITEWEB`. **La bona és la segona, i la primera era
falsa.** Corregida.

### Què diu el flux, camp a camp

Baixat el flux sencer (`…/Objects?$format=json`, **1 504 ofertes** el 30
d'agost; n'eren 1 543 el 29) i mirats **tots** els camps de **totes** les
ofertes buscant qualsevol adreça:

- Els **únics** camps que porten cap URL són **`LISTINGPHOTO`** (la foto, a
  `cdt66.media.tourinsoft.eu`) i **`DETAILSITEWEB`**.
- `DETAILSITEWEB` porta un `<a href='…'>` amb el web de **l'organitzador**:
  `www.theatredelarchipel.org` (100), `www.boitaclous.com` (37),
  `www.musee-rigaud.fr` (30), `www.ledepartement66.fr` (21)… **151 dominis
  diferents**, cap dels quals és de l'ADT66.
- Cobertura real: **606 de 1 504**. Les altres 898 el porten a **`null`**, no a
  cadena buida — qui el mapegi ha de coercir-lo, que l'esquema vol `""`.
- Cap camp del flux no porta cap adreça d'una fitxa de l'ADT66. Cap dels 35.

**Conseqüència directa:** `font_url` **no porta el calendari sencer** de
l'oferta. Per a 606 files porta al web de l'organitzador —que pot dir-hi els
dies o no—, i per a 898 no hi ha res i queda `""`. L'argument del §3 bis
(«qui vulgui saber tots els dies té l'enllaç a un clic») **no s'aguanta**, i
allà queda corregit.

### I la fitxa pública de l'ADT66? No és construïble des del `SyndicObjectID`

El web públic de l'ADT66 és `www.tourisme-pyreneesorientales.com`, i les seves
fitxes tenen aquesta forma:

```
https://www.tourisme-pyreneesorientales.com/agenda/monsieur-arthur-saint-cyprien-fr-6593139/
```

Aquesta pàgina **sí que sap** el `SyndicObjectID` —el porta a dins, al JSON
del CMS: `"id_sheet":"6593139","id_sit":"PYRENEESORIENTALES-FMALAR066V52X1AO"`—,
però **l'URL es construeix amb `id_sheet`, un número del seu CMS (Tourism
System / Woody) que NO és al flux de sindicació.** Del `SyndicObjectID` sol no
se'n pot deduir.

Provades i descartades les tres dreceres òbvies:

| Provat | Resultat |
|---|---|
| `…/sit/PYRENEESORIENTALES-{ID}` | **404** |
| `…/fiche/PYRENEESORIENTALES-{ID}` | **404** |
| `…/agenda/?id_sit=PYRENEESORIENTALES-{ID}` | 200, però és **l'agenda genèrica**: la fitxa no hi surt |
| `…/?s={ID}` | 200 amb **cos buit**: la cerca no indexa l'identificador |

**Sí que hi ha una adreça estable per `SyndicObjectID`, però no serveix de
`font_url`:**

```
GET https://wcf.tourinsoft.com/Syndication/3.0/cdt66/{GUID}/Objects('FMALAR066V52X1AO')?$format=json
    -> 200, 2 729 bytes, application/json
GET …/Objects('FMALAR066XXXXXXX')?$format=json
    -> 404
```

És pública, és estable, i el **404 diu que l'oferta ja no hi és**: com a
*sonda* per a una oferta solta va bé. Però serveix **JSON cru**, i `font_url`
és l'enllaç que un lector del web públic clica. Posar-l'hi seria enviar la
ciutadania a un bolic de claus i etiquetes HTML. **No.**

### El que això deixa obert

L'**ancoratge fila ↔ oferta continua sense resoldre.** El §5 punt 6 esperava
matar dos ocells: un `font_url` ple 1 543/1 543 *i* el `SyndicObjectID` dins
de la fila. **Cap dels dos.** Els camps de l'esquema no es toquen (§2 bis de
sota), o sigui que avui una fila de `pendents.json` nascuda d'una oferta de
l'ADT66 **no porta cap manera de tornar a l'oferta**. Vegeu el §6 per què vol
dir això per a la detecció de retirades.

**Decisió, doncs, per al mapeig d'ADT66 quan s'escrigui:** `font_url` =
l'`href` de `DETAILSITEWEB` quan n'hi hagi, `""` quan no. I prou.


## 2 quater. L'esquema no creix: cap camp nou per a l'ADT66

*Escrit expressament perquè no s'hagi de tornar a preguntar.*

**El `SyndicObjectID` NO s'afegeix mai com a camp de l'esquema.** Ni ara ni
més endavant. Si algun dia ha de viatjar amb la fila, ha de ser dins d'un camp
que ja existeix —i el §2 ter acaba de demostrar que `font_url` no el pot
portar de manera útil—, mai com a camp divuitè.

L'esquema és, exactament, el que diu el **§4 de `CLAUDE.md`** i res més:

- **16 camps canònics** — els que van a `events.json` i al web públic.
- **+ `nota_curador`**, el 17è, que viu només a `pendents.json` i a
  `curador.html` i es descarta en publicar (decidit el 29 d'agost de 2026).

O sigui: **16 camps públics, 17 al total de la cua.** Les dues xifres són
correctes i no es contradiuen; el que seria fals és una divuitena. Si en
algun informe d'aquest canal es llegeix «disset camps», parla del `nota_curador`
del §4 de `CLAUDE.md`, **mai** d'un camp afegit per l'ADT66.


## 3. Què s'ha escrit

**`eines/adt66-sincronitza.js`** — una funció, `sincronitzaADT66(darreraMarca)`,
més les seves peces i un petit ús des del terminal. Cap dependència. Node 18 o
superior; el cos de la funció només fa servir `fetch` i `Intl` i, per tant,
també funcionaria dins d'un Worker.

```
node eines/adt66-sincronitza.js                       -> importació completa
node eines/adt66-sincronitza.js 2026-08-01T00:00:00   -> diferencial
```

Torna sempre el mateix objecte de quatre camps:

| Camp | Què és |
|---|---|
| `estat` | `complet` · `diferencial` · `sense-canvis` |
| `ofertes` | les ofertes **senceres**, els 35 camps, tal com venen |
| `marca` | la marca de temps a desar per a la propera vegada |
| `disperses` | quantes d'aquestes ofertes tenen dates periòdiques (§3 bis) |

Més les funcions que treuen les dates de l'acte del format de l'ADT66:
`datesDeLoferta(oferta)` (totes les dates en AAAA-MM-DD, ordenades),
`horaDeLoferta(oferta)`, **`classificaDates(dates)`** (§3 bis) i
`extreuDates(oferta)`, que torna directament `{ data_inici, data_fi, hora }`
amb la forma que vol el §4 de `CLAUDE.md`.

### Les quatre decisions de disseny, i per què

1. **El filtratge el fa el servidor.** `$filter=Updated gt datetime'…'` sobre el
   WCF. Abans la comparació era local perquè es creia que l'API no filtrava
   (§1.3): això valia per a l'api-v3, no per al WCF.

2. **L'adreça del WCF va escrita al codi.** És el destí del 302, comprovat
   idèntic caràcter a caràcter amb sis dates diferents: no és una adreça que
   canviï, és una constant. Descobrir-la a cada execució costava una petició de
   més i arrossegava el 429, el 401 i el 404 de l'api-v3 cap a dins de la
   funció. El comentari del fitxer diu com tornar-la a treure si mai calgués.

3. **L'estat és UNA marca de temps, no un mapa d'identificadors.** Amb un mapa
   `{id: Updated}` es podria distingir «nou» de «canviat» i detectar
   supressions, però són 110 kB d'estat nou, i el §3 de `CLAUDE.md` diu que
   l'estat viu en dos fitxers JSON i prou. **Conseqüència acceptada:** no sabem
   si una oferta és nova o modificada, i **no detectem les que desapareixen del
   flux.**

4. **La marca nova és el `Updated` més alt vist, no l'hora d'ara.** Si fos
   l'hora d'ara i el rellotge de l'ADT66 anés uns segons per darrere del
   nostre, cada sincronització es menjaria en silenci les ofertes tocades dins
   d'aquella escletxa. Amb el màxim observat, la marca surt sempre de les
   mateixes dades que es comparen. Es comparen com a text: totes tenen el mateix
   tronc encoixinat de zeros, cap no porta zona horària, i passar-les per
   `new Date()` seria inventar-se'n una.

**Ja no hi ha estat `cau-en-preparacio`.** El 429 «Caching in progress» era de
l'api-v3; el WCF no en dona. Si algun dia el flux respon una cosa que no toca,
la funció llança amb el codi a dins.

### Provat contra l'API real, el 29 d'agost de 2026

| Entrada | `estat` | ofertes |
|---|---|---|
| (cap marca) | `complet` | 1 543 |
| `2026-08-01T00:00:00` | `diferencial` | 801 |
| `2026-08-28T18:19:15.24` (la més alta) | `sense-canvis` | 0 |
| `2027-01-01T00:00:00` (futur) | `sense-canvis` | 0 |
| `2024-01-01T00:00:00` | `diferencial` | 1 543 |

I l'extracció de dates, passada per les 1 543 ofertes del flux sencer:

| Comprovació | Resultat |
|---|---|
| ofertes amb `data_inici` | 1 543 / 1 543 abans de la regla del §3 bis; **1 529** després (14 periòdiques ja acabades el 29 d'agost de 2026 — vegeu la nota sobre aquest número al §3 bis) |
| ofertes amb `hora` | 900 / 1 543 |
| dates mal formades | **0** |
| `data_inici` posterior a `data_fi` | **0** |
| `data_fi` a més d'un mes de `data_inici` | **0** |

Les 643 sense hora no són cap fallada de l'anàlisi: el `COMMUNDATE` d'aquelles
ofertes diu només «Le 06/09/2026», sense cap hora. L'esquema hi vol `""`.

---

## 3 bis. Les dates disperses: la regla, i com s'ha triat

El camp `TRI` dona **totes** les dates en què es fa una oferta, i n'hi ha que en
tenen moltes: una amb 470. Amb el primer i l'últim dia com a `data_inici` i
`data_fi`, un mercat setmanal es publica com «del 25 de febrer de 2025 al 29 de
desembre de 2026»: un acte continu de dos anys que no existeix.

### La mesura, abans de decidir res

Sobre les 1 543 ofertes: **1 261 tenen una sola data** i no hi ha res a decidir.
Les altres **282** es reparteixen així, segons el salt màxim entre dues dates
consecutives:

```
salt  1 :  49  █████████████     dies seguits de debò
salt  2 :   4  █
salt  3 :  17  █████             ┐
salt  4 :  11  ███               │ 45 ofertes: patrons periòdics regulars
salt  5 :   8  ██                │ (3,4,3,4 = dos cops per setmana;
salt  6 :   5  ██                ┘  1,1,1,1,3 = feiners, tancat el cap de setmana)
salt  7 :  89  ███████████████████████   setmanal
salt 14 :  14  ████
salt15+ :  81  █████████████████████
```

### Per què el salt màxim sol no serveix

Era la primera idea i és insuficient. **Un buit petit és compatible amb un
abast enorme:**

| Oferta | dates | abast | salt màx | min/max diria |
|---|---|---|---|---|
| `ATELIER DE MODELAGE EN INDIVIDUEL` | 192 | **223 dies** | **2** | «del 4 de maig al 12 de desembre» |
| `LE PATRIMOINE D'ARGELÈS-SUR-MER` | 215 | **301 dies** | **3** | «del 6 de març al 31 de desembre» |

Són tallers i visites oberts cada dia menys un: cap salt sospitós, i tot i així
min/max menteix set mesos. Per això la regla té **dues** condicions, no una.

### La regla

```
contigu  =  salt màxim ≤ LLINDAR_BUIT_DIES + 1  I  abast ≤ ABAST_MAXIM_DIES
```

amb `LLINDAR_BUIT_DIES = 1` i `ABAST_MAXIM_DIES = 31`, tots dos constants amb
nom dins de `eines/adt66-sincronitza.js`.

- **Contigu** → `data_inici` = primera data, `data_fi` = última. Com sempre.
- **Dispers** → `data_inici` = `data_fi` = **la propera ocurrència a partir
  d'avui**, hora de París. Si totes són passades, l'oferta **no genera cap
  fila**.

*Per què un dia de buit i no cap:* una fira amb un dia de descans encara és una
fira. *Per què no dos:* amb dos dies, dues projeccions de cinema separades per
tres dies passarien per «una cosa de quatre dies», que és la mentida que volem
treure.

*Per què el límit d'abast no és delicat:* al grup de buit petit, els abasts van
d'1 a 27 dies i després salten a 223. **Qualsevol valor entre 28 i 222 dona
exactament el mateix resultat.** Un mes és rodó i s'explica sol.

*Per què París i no UTC:* a l'estiu França va dues hores per davant. Un Worker
que s'executi a les 00:30 de París encara és ahir en UTC, i «la propera
ocurrència» sortiria un dia enrere. `dataDavuiAParis()` ho fixa amb `Intl`.

### Què fa, sobre el flux sencer

| | ofertes |
|---|---|
| contigües (min/max, com abans) | 1 313 |
| **periòdiques** | **230** = 14,9 % del flux |
| → amb ocurrència futura | 216 |
| → totes passades, cap fila | 14 |

**Les dues últimes xifres es mouen soles i és normal.** Són del 29 d'agost de
2026, i el repartiment entre elles depèn del dia que executis la funció: cada
sèrie periòdica que s'acaba passa d'una banda a l'altra. L'endemà mateix ja eren
209 i 21. Les tres primeres, en canvi, no depenen del calendari. Si algun dia
tornes a mesurar i el 230 s'ha mogut molt, això sí que vol dir que el flux ha
canviat de forma i que val la pena tornar a mirar el llindar.

De les 282 que tenen més d'una data: **52 contigües, 230 periòdiques.**
`LES OCCASIONS DU MULTICOQUE` (16–18 d'octubre) continua sent contigua; els dos
casos de la taula de dalt passen a periòdics, i el d'Argelès, que va acabar el
2025, ja no genera fila.

### El que això costa, dit clar

Una exposició llarga de debò —oberta cada dia durant tres mesos— també cau al
costat periòdic i es publica com un sol dia: el d'avui. **És una pèrdua real i
és deliberada.** L'alternativa era afegir un camp a l'esquema o escriure la
periodicitat dins de `descripcio_ca`, i totes dues coses toquen els setze camps
canònics, que no es toquen.

> **CORRECCIÓ DEL 30 D'AGOST DE 2026.** Aquí hi deia: «`font_url` apunta a la
> fitxa de l'ADT66, que porta el calendari sencer: qui vulgui saber tots els
> dies té l'enllaç a un clic». **Era fals.** `font_url` surt de
> `DETAILSITEWEB`, que és el web de **l'organitzador** i només hi és a **606
> de 1 504** ofertes; no hi ha cap fitxa de l'ADT66 enllaçable des del flux
> (§2 ter). O sigui que **el consol no existeix**: per a una oferta periòdica,
> els dies que no es publiquen es perden i prou. La pèrdua continua sent
> deliberada —l'alternativa segueix sent tocar l'esquema—, però ara sense
> excusa: qui la vulgui compensar algun dia haurà de fer-ho amb el text de la
> descripció, no amb un enllaç.

### Una asimetria que és a posta

Una oferta **periòdica** tota passada no genera fila; una oferta **d'una sola
data** passada sí que en genera. No és cap descuit: treure els actes passats és
feina del **filtre previ** (§5), que els ha de treure tots amb el mateix criteri
i encara no està escrit. Aquí només s'ha resolt el que la regla de dates
obligava a resoldre.


## 4. Fora d'abast en aquesta tasca

**FET el 3 de setembre de 2026 — la deduplicació contra els dos fitxers.**
`eines/dedup-contra-fitxers.js`, amb `classificaContraFitxers()`. Dues capes:
la 1 exacta pel tag `[ADT66 id: …]` contra `pendents.json` (els tres estats,
sense filtrar-ne cap abans de comparar), la 2 difusa contra `events.json`
reutilitzant `comparaEsdeveniments()` amb un llindar propi de **0,75**. Torna
una etiqueta per oferta —`ja_publicat` · `ja_a_la_cua` · `ja_rebutjat` ·
`nova`— i **no escriu res**; `events.json` només es llegeix. El biaix és
sempre cap a `nova`: si dubta, encua. El detall del llindar i d'on surt és al
§4 ter de `CLAUDE.md` i al bàner del fitxer.

Passat pel flux del 3 de setembre de 2026 (1 463 ofertes → 1 445 amb data)
contra `pendents.json` (84 files) i `events.json` (8 files): **1 445 `nova`,
0 a la resta**. Els dos zeros són reals i tenen causa: cap fila de
`pendents.json` no porta encara el tag —cap oferta d'ADT66 no s'hi ha escrit
mai—, i cap fila d'`events.json` no ve d'ADT66. A més, els títols del flux
arriben en francès i els publicats són en català, o sigui que
`titolsComparables()` refusa la comparació i la capa 2 no s'activarà per a
aquesta font fins que la traducció s'apliqui abans. Comprovat també amb els
títols declarats en català: només **4 ofertes** de 1 445 arriben a tenir clau
dura igual amb una fila publicada, i la similitud més alta és **0**.

Encara no fet, i **no s'ha de suposar fet**: filtre previ, classificació
editorial, traducció i qualsevol escriptura a `pendents.json`. Cada una és una
tasca pròpia.

## 5. Preguntes obertes per a la sessió següent

*La que hi havia de primera i bloquejant —d'on surten les dates i les
descripcions— ha deixat de ser pregunta: del `TRI` i del `DETAILDESCRIPTIF`,
§2 bis. **No cal escriure cap correu a l'ADT66.** Tampoc no cal cap sindicació
nova: és la mateixa, llegida per l'altra porta.*

*I la segona, què fer amb les ofertes de moltes dates disperses, tampoc no hi
és: està decidida, mesurada i implementada al **§3 bis**. Els setze camps no
s'han tocat.*

1. **On viu la marca de temps.** Un tercer fitxer JSON trencaria el §3 de
   `CLAUDE.md`. Val la pena mirar primer si es pot derivar del que ja tenim
   —com la guarda del digest, que surt del registre de Brevo (vegeu
   `NOTES.md`)— abans d'inventar un lloc nou.
2. **El filtre previ, que ara és la feina grossa.** Les 1 543 ofertes són de
   **tot** el departament i de tot: 293 visites guiades, 82 caminades, 70
   pràctiques esportives, 25 rifles. Amb `Commune` a cada fila, la tria
   geogràfica de les cinc comarques és una llista de pobles, no un càlcul de
   coordenades — i `eines/pobles-alies.js` ja existeix. La tria editorial és
   `docs/CRITERI-EDITORIAL.md`, i la farà `RechercheTYPE` més el criteri.
3. **Quantes n'hi ha de vives.** 1 342 de les 1 543 tenen l'última data del 29
   d'agost de 2026 en endavant; les altres 201 són passades i no han d'entrar
   mai a `pendents.json`. La regla del §3 bis ja en descarta unes quantes pel
   seu compte —les periòdiques que s'han acabat: 14 aquell dia—, però la resta
   encara surten amb data, i treure-les és feina del filtre previ (punt 2), no
   de la sincronització.
4. **La neteja de l'HTML dels camps.** Venen amb etiquetes, amb entitats
   (`&agrave;`, `&eacute;`) i amb una etiqueta francesa al davant
   («Descriptif de la manifestation : », «Lieu : »). Cal treure-la abans de
   passar el text a Gemini, o el model se la traduirà.
5. **Les imatges. RESOLTA el 31 d'agost de 2026.** `LISTINGPHOTO` porta
   l'`<img>` sencer amb `?width=150&height=120` enganxat, i 150 px no serveix
   per a un cartell. **Sí: l'adreça sense paràmetres dona l'original.**
   Comprovat amb `curl` sobre les 17 adreces d'ADT66 que hi ha a la cua —4 kB
   de retall contra 756 kB d'original, i en un cas 16 MB.

   Es va resoldre on aquest document deia que s'havia de resoldre: a
   `variantsDeCartell()`, dins d'`eines/puja-cartell.js`, i **no al mapeig**,
   que continua copiant l'`src` tal com ve.

   Dos detalls que el `curl` va ensenyar i que manen sobre la implementació:
   **una de les 17 dona 404 sense paràmetres i 200 amb ells** (l'original s'ha
   esborrat i el retall sobreviu), o sigui que es proven les dues adreces,
   l'original primer, i mai se substitueix l'una per l'altra; i la neteja
   s'aplica **només** al domini `media.tourinsoft.eu`, perquè hi ha fonts on el
   paràmetre és imprescindible (`?itok=…` de Drupal a la mairie de Perpinyà).
6. **Què fa el curador amb una fila pendent que ja no és al flux.** *Porta
   oberta: s'ha de decidir ABANS de connectar aquesta sincronització a
   `pendents.json`, no com a pedaç posterior.* El §3 punt 3 accepta no
   detectar les baixes mentre el sync visqui aïllat, i entre dues lectures del
   29 d'agost de 2026 el flux va passar de **1 543 a 1 504** ofertes. Mentre
   això no escriu enlloc, no passa res; el dia que generi files, una fila
   pendent pot descriure un acte que la font ja ha retirat.

   **El camí de «que el curador ho vegi sol pel `font_url` trencat» no
   serveix**, i el número ho diu: `font_url` surt de `DETAILSITEWEB` i només hi
   és a **623 de 1 543** ofertes; és el web de l'organitzador, que no es trenca
   quan l'ADT66 retira la seva fitxa. Per a 920 files no hi hauria ni enllaç
   per trencar-se.

   **Recomanació: marcar-ho amb `nota_curador`, mai esborrar la fila.** Treure
   una fila pendent en silenci és decidir per ell; el §4 de `CLAUDE.md` diu que
   el camp existeix justament per dir-li què ha d'anar a mirar. Dues condicions
   que no són negociables:
   - **Només en una passada completa.** Una lectura diferencial no pot
     distingir «ha desaparegut» de «no s'ha tocat»: l'absència del `$filter`
     vol dir totes dues coses alhora.
   - **Cal un ancoratge de l'identificador a la fila.** La comparació és entre
     el conjunt de `SyndicObjectID` del flux i el de les files amb
     `estat === 'pendent'`, i avui la fila no en porta cap.

   **ESTAT, 30 D'AGOST DE 2026: mig resolt.** La comparació dels dos conjunts
   ja està escrita —`eines/deteccio-retirades.js`, §6—, i és pura: rep dos
   instantanis i diu què ha desaparegut. **L'ancoratge, en canvi, NO s'ha
   pogut resoldre**, i el §2 ter diu per què: no hi ha cap adreça pública i
   llegible de la fitxa de l'ADT66 construïda des del `SyndicObjectID`, o
   sigui que `font_url` no el pot portar. L'única adreça estable per
   identificador és el `Objects('{ID}')` del WCF, que serveix JSON cru i no
   pot anar a `font_url`.

   Amb això, i mentre l'ancoratge no es resolgui, la funció serveix per **mirar
   què ha caigut del flux**, no per **assenyalar la fila** que en depenia: qui
   la cridi ha de saber pel seu compte quina fila ve de quina oferta i
   passar-l'hi. La qüestió és, doncs, **oberta i és teva**: o s'accepta guardar
   la correspondència `SyndicObjectID → id` en algun lloc (i llavors torna la
   discussió del §3 de `CLAUDE.md` sobre l'estat), o s'accepta que la nota de
   retirada es faci a mà a partir de la llista que dona la funció.

   *Contradicció resolta:* el §3 bis deia «`font_url` apunta a la fitxa de
   l'ADT66» i la taula del §2 bis deia `DETAILSITEWEB`. **Mana la taula**; el
   §3 bis queda corregit. `font_url` = `DETAILSITEWEB` (el web de
   l'organitzador), 606/1 504.

   **L'exposició real és petita, i és justament la que importa.** El filtre
   previ (punt 2) ja ha de treure els actes passats, i bona part de les baixes
   del flux són això. El cas que queda és una oferta futura retirada abans de
   la seva data —una anul·lació—, que és exactament el que una nota ha de
   caçar.


---

## 5 bis. MESURAT: el flux sencer, i la distribució de `RechercheTYPE`

*3 de setembre de 2026. Tot el que hi ha en aquest apartat surt d'una sola
descàrrega del flux, no de cap estimació.*

### 5 bis.1 La descàrrega

```
GET https://wcf.tourinsoft.com/Syndication/3.0/cdt66/
    60a37063-5667-45f8-82e1-a1db2d8375b9/Objects?$format=json
-> 200, 4 528 401 bytes, JSON amb una sola clau `value`
```

| Què | Quant |
|---|---|
| Ofertes a `value` | **1 463** |
| Camps per oferta | **35**, els del §2 bis |
| Ofertes **sense** cap `RechercheTYPE` | **140** (9,6 %) |
| Valors distints de `RechercheTYPE` | **41** |
| Cadenes crues distintes de `RechercheTYPE` | 143 |

**LA COMA FA DUES FEINES I NO ES DISTINGEIXEN.** Separa valors
(`Spectacle,Théâtre`) però també viu DINS de dos valors: `Projection, cinéma`
i `Randonnée, balade`. Partir per comes els trenca per la meitat. **No passa
res i és a posta:** les dues meitats de cada un porten a la mateixa categoria
(`projection` i `cinema` totes dues a Cinema; `randonnee` i `balade` totes
dues a Esports), o sigui que el resultat surt igual es parteixi com es
parteixi. `eines/mapeja-adt66.js` porta les dues formes a la taula.

### 5 bis.2 Els 41 valors, amb el seu recompte i el seu calaix

| Ofertes | `RechercheTYPE` | Va a |
|---:|---|---|
| 277 | Visite guidée | Patrimoni i tradicions |
| 172 | Exposition | Exposició |
| 167 | Spectacle | *co-etiqueta* |
| 161 | Stage / Atelier | Taller |
| 131 | Concert | Música |
| 77 | Randonnée | Esports |
| 77 | balade | Esports |
| 71 | Théâtre | Teatre |
| 68 | Débat / Conférence | Conferència |
| 64 | Marché | Mercat |
| 58 | Projection | Cinema |
| 58 | cinéma | Cinema |
| 48 | Pratique sportive encadrée | Esports |
| 47 | Portes ouvertes | **cap — revisió manual** |
| 45 | Jeux | *segons el títol* |
| 34 | Rassemblement / réunion | **cap — revisió manual** |
| 33 | Manifestation sportive | Esports |
| 28 | Festival | *co-etiqueta* |
| 26 | Rifles | Vida associativa |
| 23 | Vide-grenier | Mercat |
| 20 | Salon | **cap — revisió manual** |
| 15 | Foire | Mercat |
| 13 | Compétition | Esports |
| 12 | Repas spectacle | **cap — revisió manual** |
| 10 | Bal | Dansa i ball |
| 10 | Action citoyenne | **cap — revisió manual** |
| 9 | Thé dansants | Vida associativa |
| 8 | Brocante | Mercat |
| 7 | Pot d'accueil | **cap — revisió manual** |
| 7 | Défilé Cortège Parade | Patrimoni i tradicions |
| 6 | Braderie | Mercat |
| 4 | Festa Major | Patrimoni i tradicions |
| 4 | Arts de la rue | **cap — revisió manual** |
| 4 | Concours | **cap — revisió manual** |
| 2 | Feux d'artifice | Patrimoni i tradicions |
| 2 | Aplec | Patrimoni i tradicions |
| 2 | Son et Lumière | Patrimoni i tradicions |
| 2 | Trail | Esports |
| 2 | Excursion | Esports |
| 2 | Rallye | Esports |
| 1 | Commémoration | Patrimoni i tradicions |

**Els 41 hi són tots.** Cap valor del flux no queda sense decidir per descuit:
o té calaix, o és una co-etiqueta, o el decideix el títol, o és un dels vuit
que van a revisió manual a posta.

**`Rassemblement / réunion` NO va a `Concentració`**, tot i ser-ne la traducció
literal. Amb aquesta etiqueta hi surten un forum d'associacions, una assemblea
general i una manifestació, i el codi no les pot distingir: va a revisió.

### 5 bis.3 La distribució de `categoria` un cop aplicat tot el mapeig

Passant les 1 463 ofertes per `mapejaOfertaADT66()`:

| Ofertes | `categoria` |
|---:|---|
| 243 | Patrimoni i tradicions |
| **193** | **`""` — buida, amb nota** |
| 162 | Teatre |
| 160 | Exposició |
| 139 | Taller |
| 128 | Música |
| 120 | Esports |
| 99 | Mercat |
| 94 | Vida associativa |
| 65 | Conferència |
| 50 | Cinema |
| 10 | Dansa i ball |
| 0 | Activitat infantil |
| 0 | Concentració |
| **1 463** | **total** |

**Les 193 buides, per què ho són:**

| Ofertes | Motiu |
|---:|---|
| 129 | **cap `RechercheTYPE`** i cap regla de títol que hi valgui |
| 49 | un dels **vuit valors de revisió manual** (Salon 12, Portes ouvertes 11, Rassemblement / réunion 9, Repas spectacle 9, Pot d'accueil 3, Action citoyenne 2, Arts de la rue 2, Concours 1) |
| 15 | **`Jeux`** sense cap patró de joc de club al títol |

*Les 140 ofertes sense `RechercheTYPE` no acaben totes buides: 11 les recupera
la regla del títol del forum d'associacions.*

**`Activitat infantil` i `Concentració` es queden a zero, i no és cap error.**
El flux de l'ADT66 no porta cap valor que hi porti: no hi ha ni «Jeune public»
ni res que ho digui, i `Rassemblement / réunion` va a revisió per la raó del
§5 bis.2. Les dues categories les omplen les altres vies d'entrada —el correu,
el Typebot, el curador a mà— no aquesta.

> **CORRECCIÓ DEL 4 DE SETEMBRE DE 2026: `Activitat infantil` ja no és zero.**
> El paràgraf de dalt tenia raó a mitges. És cert que `RechercheTYPE` no diu
> mai res del públic —els seus 41 valors diuen la FORMA de l'acte—, però el
> senyal sí que hi és al flux, en un altre camp: **`COMMUNTHEME`**, que aquest
> apartat no havia mirat perquè el mapeig el deixava anar a
> `metadadades.descartats.tema`.
>
> Dels 33 temes distints del flux, **«Pour enfant» surt a 70 ofertes i «Conte»
> a 10**. Des del 4 de setembre de 2026, `categoriaPerTemaInfantil()`
> (`eines/mapeja-adt66.js`) fa que qualsevol dels dos posi la categoria a
> `Activitat infantil` **per damunt** del que hagués donat `RechercheTYPE`:
> és la decisió editorial del propietari —el públic manda sobre la forma—, i
> és reversible perquè, quan desplaça una categoria que deia alguna cosa, ho
> escriu a `nota_curador` amb el valor desplaçat («Categoria per tema
> infantil; RechercheTYPE deia: Taller»).
>
> «Cirque» (6 ofertes) i «Bande dessinée» (3) **NO** hi entren: són gèneres,
> no públics.
>
> Sobre una descàrrega sencera del 4 de setembre de 2026 —**1 513 ofertes**, o
> sigui que aquesta xifra no es compara amb la taula de dalt, que és de
> 1 463—, la regla deixa **73 ofertes** a `Activitat infantil`: 66 desplacen
> una categoria que `RechercheTYPE` havia donat (21 Taller, 12 Teatre,
> 10 Esports, 6 Patrimoni i tradicions, 5 Vida associativa, 4 Exposició,
> 3 Música, 3 Mercat, 1 Dansa i ball, 1 Conferència) i 7 omplen un buit.
>
> **`Concentració` continua a zero**, i per aquell apartat sí que val el
> paràgraf de dalt sencer: cap camp del flux no la diu.

### 5 bis.4 El que el flux NO porta: cap preu

**`DETAILFETEPAYANTE` no és un camp de preu, tot i el nom.** És un booleà, en
HTML:

```
<strong><br />Entr&eacute;e gratuite :</strong> oui   (637 ofertes)
<strong><br />Entr&eacute;e gratuite :</strong> non   (634 ofertes)
                                                      (192 sense la dada)
```

No hi ha cap import en tot el flux. L'únic que hi ha és el que algú hagi
escrit dins de la descripció, en text corrent («Inscription 40 euros»), i és
d'allà que el senyal de preu de `mapeja-adt66.js` el treu. Amb un llindar de
25 € —un número **triat**, no mesurat—, el senyal salta a **3 ofertes** de les
1 463: una balada en caiac de 60 € i la Ronde Céretana de 28 €, que hi surt
dues vegades.

### 5 bis.5 Dues trampes que van costar una passada

**1. `aura` no es pot posar en cap llista de paraules franceses.** És el futur
d'`avoir` —«la fête *aura* lieu»— i surt a mig flux. Posada a la llista de
vocabulari de nova era, marcava **27 ofertes de 45**, gairebé totes falses:
concerts de jazz, vernissatges i vide-greniers. Fora de la llista, el senyal
baixa a 13 ofertes i totes tenen sentit. La comprovació de paraula sencera no
salva d'això: cal saber que la paraula també és francesa corrent.

**2. L'origen escriu amb errades i el codi ho ha d'aguantar.** Una de les 40
ofertes de forum d'associacions ve escrita `FORUM DES ASSOCATIONS`, sense la
i. El patró era `associa` i se la deixava. Escurçat a `assoc`, hi entra; i amb
`forum` demanat també al mateix títol, `assoc` no pot agafar res que no sigui
això.

---

## 6. La detecció de retirades — `eines/deteccio-retirades.js`

*30 d'agost de 2026. Segona peça d'aquest canal.*

```
detectaRetirades(fluxAnterior, fluxActual, filesAncorades, dataComparacio)
node eines/deteccio-retirades.js    -> passa la bateria de proves
```

Una sola feina: dir quines ofertes hi havia a una lectura anterior del flux
complet i ja no hi són a la d'ara. Torna una llista de:

| Camp | Què és |
|---|---|
| `syndicObjectID` | l'identificador de l'oferta que ha desaparegut |
| `fila_afectada` | una **còpia** de la fila amb la nota ja afegida, o `null` si no se n'hi ha passat cap |
| `dataDeteccio` | `AAAA-MM-DD` de la comparació — **no** de l'esdeveniment |
| `nota` | el text exacte de la nota, perquè qui la cridi la pugui aplicar ell mateix |

La nota segueix el patró de les altres peces
(`[Suggeriment editorial: …]`, `[Verificació: …]`, `[Cartell: …]`):

```
[ADT66: retirat — ja no apareix al flux complet de 30/08/2026]
```

S'ajunta amb `ajuntaNotes()` de `dedup-esdeveniments.js` —la mateixa regla que
tothom, mai copiada—, o sigui que **cap nota anterior no s'esborra**.

### Les quatre coses que aquesta peça no fa, a posta

1. **No esborra res, i no toca `estat`.** Només marca. Retirar un acte del
   públic és sempre decisió del curador; una fila que desapareix sola és una
   decisió presa per ell sense dir-l'hi. Ho diu la capçalera del fitxer en
   majúscules perquè no s'hi torni.
2. **No toca la xarxa.** Rep dos instantanis ja parsejats. Qui vulgui la
   comparació real ha de cridar el flux ell (`sincronitzaADT66()` sense marca)
   i guardar l'instantani anterior; **on es guarda encara no està decidit** i
   xoca amb el §3 de `CLAUDE.md` (l'estat viu en dos fitxers JSON i prou).
3. **No està cablejada a res.** Ni a `processa-lot.js`, ni a
   `pipeline-offline.js`, ni a cap cron. Cada quan es fa una passada completa
   del flux és decisió del propietari.
4. **No resol l'ancoratge fila ↔ oferta** (§2 ter i §5 punt 6). Per això
   `filesAncorades` és un argument que li has de donar: la funció no pot
   endevinar quina fila ve de quina oferta perquè **la fila no en guarda cap
   rastre**. Sense ancoratges, `fila_afectada` surt `null` i queda la llista
   d'identificadors més la nota, que ja serveix per mirar-s'ho a mà.

### Per què només entre dues passades completes

Un instantani diferencial no distingeix «ha desaparegut» de «no s'ha tocat»:
totes dues coses són absència del resultat. Passar-hi el retorn d'un
`sincronitzaADT66('2026-08-01T00:00:00')` donaria **centenars** de retirades
falses. La capçalera del fitxer ho diu; val més llegir-ho que descobrir-ho.

### Proves

Deu casos dins del mateix fitxer, cap amb xarxa, tots amb instantanis fets a
mà i la data de comparació fixada a `2026-08-30` perquè el resultat no depengui
del dia que s'executin. **Els deu passen** (`node eines/deteccio-retirades.js`,
sortida `BÉ   les 10 proves passen.`).

| Cas | Comprova |
|---|---|
| els mateixos identificadors als dos costats | llista buida |
| una retirada simple | l'identificador, la data, el text de la nota i `fila_afectada: null` |
| present als dos costats amb `SyndicObjectName`, `TRI` i `Updated` canviats | **no** compta com a retirada: només l'absència compta |
| la fila ancorada ja porta la nota d'un altre agent | les dues notes hi són, en aquest ordre |
| la fila ancorada no porta cap nota | hi queda només la de la retirada |
| la fila original | no es toca: la nota va a una còpia |
| el mateix identificador repetit a l'instantani vell | una retirada, no dues |
| una oferta sense `SyndicObjectID` | s'ignora: no es pot seguir |
| instantani vell buit | cap retirada |
| instantani nou buit | tot el que hi havia surt retirat |


---

## 7. El mapatge oferta → fila — `eines/mapeja-adt66.js`

*30 d'agost de 2026. Tercera peça d'aquest canal. **Tancada.***

```
mapejaOfertaADT66(ofertaWCF)  ->  { fila, metadadades }
node eines/mapeja-adt66.js    -> passa la bateria de proves (20 casos, 0 fallades)
```

Una sola feina: convertir una oferta del flux WCF en una fila de l'esquema del
§4 de `CLAUDE.md`. Cap crida a la xarxa, cap escriptura, i **no està cablejada
a res** —ni a `processa-lot.js`, ni a `pipeline-offline.js`.

Torna la **mateixa forma** que `mapejaAProduccio()` de `eines/mapeja-recerca.js`
(`{ fila, metadadades }`): és a posta, perquè les dues fonts entren pel mateix
canal i la tercera que vingui hi ha d'entrar igual. La taula camp a camp dels
35 —quins onze noms alimenten els deu camps de la fila i on va tot el que no
hi entra— és a la **capçalera del mateix fitxer**, no aquí, perquè qui el toqui
la tingui davant.

**L'ancoratge del §5 punt 6 queda resolt per a les files noves d'aquesta font:**
`nota_curador` comença sempre pel tag `[ADT66 id: …]` de
`eines/adt66-identificador.js`, tal com demana el seu contracte. Les files que
ja són a la cua d'abans d'això continuen sense tag; no n'hi ha cap avui perquè
res d'aquest canal no ha escrit mai a `pendents.json`.

**Adoptat també d'aquí:** `eines/adt66-sincronitza.js` ara exporta
`sincronitzaADT66`, `datesDeLoferta`, `horaDeLoferta` i `classificaDates`. No
tenia `module.exports`, i sense això la regla de dates del §3 bis s'hauria
hagut de copiar en un segon fitxer — que és exactament el que no ha de passar.

### Els tres forats coneguts que queden oberts

*No són descuits: cadascun s'ha deixat obert amb un motiu, i cap no és feina
d'aquesta peça. S'apunten aquí perquè no es perdin entre sessions.*

**1. `comarca` surt SEMPRE buida a les files d'ADT66.** Cap dels 35 camps del
flux no la porta, i al projecte **no hi ha cap taula municipi → comarca**:
`eines/pobles-alies.js` aparella el nom català i el francès de cada poble,
però no li assigna comarca. *Conseqüència real, i és la que importa:* una fila
sense comarca **no surt al filtre per comarca del web públic**. El mapeig ho
diu a `nota_curador` de totes les files d'aquesta font perquè el curador ho
arregli fila a fila. **Peça futura i separada** —la taula, o el que es decideixi
en lloc seu—, no d'aquesta sessió.

**2. `imatge_url` porta l'URL bruta de l'ADT66, no una de Cloudinary.** Surt
l'`src` de `LISTINGPHOTO` tal com ve, amb el `?width=150&height=120` inclòs
(vegeu la pregunta oberta 5 del §5, ja resolta: qui desfà el retall és
`eines/puja-cartell.js`, no el mapeig). Es
resoldrà quan es cablegi `eines/cloudinary-adapter.js` sobre aquesta font, amb
**el mateix mecanisme que ja existeix per a les altres fonts** — no cal
inventar-ne cap de nou aquí.

**3. La taula `CATEGORIES_ADT66` JA ESTÀ MESURADA.** ~~No s'ha mesurat contra
el flux real.~~ Es va mesurar el **3 de setembre de 2026** i la taula es va
reescriure sencera amb el que va sortir. Vegeu el **§5 bis**, que és ara la
font de veritat d'aquest punt. Els «Festival» i «Spectacle» que la versió
vella es negava a traduir —i feia bé, amb la informació que tenia— ja tenen
una regla pròpia que mira els altres valors de la mateixa oferta.
