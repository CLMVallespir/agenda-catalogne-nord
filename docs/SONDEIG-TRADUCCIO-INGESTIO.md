# Sondeig: la traducció a la ingestió de l'ADT66

*Mesures i disseny, del 4 de setembre de 2026. Quan es va escriure, **no s'havia
tocat cap fitxer del pipeline i no s'havia fet cap crida a Gemini**: era el
sondeig, i la implementació era una altra tasca. **Aquella tasca ja s'ha fet el
mateix dia** —vegeu la correcció d'aquí sota—, o sigui que aquest document és
ara el raonament de com hi hem arribat, no l'estat del codi. Res no s'ha escrit
mai ni a `pendents.json` ni a `events.json` des d'aquí.*

**Punt de partida, ja decidit pel propietari i no es rediscuteix aquí:** el camí
programat (l'Action) **podrà cridar Gemini**. La fila de l'ADT66 arriba en
francès cru i publicar-la així contradiu la raó de ser del projecte. El cost de
duplicar el secret és menor que el cost d'una agenda en francès.

---

> **CORRECCIÓ DEL 4 DE SETEMBRE DE 2026, AL VESPRE — I EL SONDEIG JA ESTÀ
> IMPLEMENTAT.** El pas 7 bis existeix a `eines/sincronitza-programada.js`. El
> propietari va acceptar el disseny amb **tres correccions i un forat a tapar**,
> i el que s'ha construït és el disseny corregit, no el d'aquestes pàgines. Les
> quatre coses, perquè no calgui buscar-les:
>
> 1. **Les xifres de quota són conegudes i mesurades**, i no s'han de tornar a
>    buscar: **15 RPM · 250 000 TPM · 500 RPD** per al pla gratuït de
>    `gemini-3.5-flash-lite`, per projecte. El §1 les demanava; ja hi són.
> 2. **El pressupost és 300 crides per passada, no 500**, i viu a la seva
>    constant, `PRESSUPOST_CRIDES_GEMINI`. Els altres 200, marge inclòs, són
>    per al camí de correu del Worker, que comparteix la quota del projecte.
>    **`LIMIT_FILES_PRIMERA_EXECUCIO` s'ha esborrat**: el §3.4 proposava
>    reaprofitar-la com a pressupost i és una fusió que no s'ha fet, perquè un
>    límit de files i un pressupost de crides no són el mateix concepte.
> 3. **La cadència NO passa a diària.** Vegeu el §3.6, ja corregit.
> 4. **El forat: el §3.3 tractava igual «no s'ha cridat» i «la crida ha
>    fallat».** Ara són dos casos separats de debò: pressupost exhaurit → la
>    fila **no** s'escriu; crida fallida —**429 inclòs**— → la fila **s'escriu**
>    amb els camps crus i un avís. Una fila que petés sempre, si no, no entraria
>    mai a la cua.
>
> I dues coses menors que la implementació ha decidit i el sondeig no deia:
> **un ritme** de 4 500 ms entre crides (`PAUSA_ENTRE_CRIDES_MS`), d'on surt el
> `timeout-minutes: 40` del workflow; i **tres avisos excloents** en comptes de
> dos, perquè la correcció 2 del propietari sobre les 8 files sense
> `descripcio_fr` crea un tercer estat —«només el títol»— que necessitava text
> propi.

## 1. La quota — el que diu la documentació vigent, i el que ja no diu

Comprovat el 4 de setembre de 2026 sobre
[ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits)
(i sobre la versió en text pla, `rate-limits.md.txt`, per llegir-ne les taules
senceres).

**La primera cosa a saber: Google ja no publica les xifres del pla gratuït.** No
hi ha cap taula de RPM/TPM/RPD per model. La frase que ocupa el lloc on hi era
és, literalment:

> «Rate limits depend on a variety of factors (such as your usage tier) and can
> be viewed in Google AI Studio.»

I més avall:

> «Each model variation has an associated rate limit (requests per minute, RPM).
> For details on those rate limits, see the AI Studio Rate Limit page.»

**Conseqüència directa: les xifres exactes eren una dada que només el
propietari podia donar** —cal obrir <https://aistudio.google.com/rate-limit> amb
el compte del projecte on viu `GEMINI_API_KEY`— i **ja les ha donades, el 4 de
setembre de 2026 al vespre**:

> **15 RPM · 250 000 TPM · 500 RPD**, per projecte, per al pla gratuït de
> `gemini-3.5-flash-lite`.

Són mesurades i **no s'han de tornar a buscar**. D'aquestes tres xifres surten
les dues constants del pas 7 bis: el **RPM** fixa la pausa entre crides (4 500
ms, uns 10 per minut de debò), i el **RPD** fixa el pressupost —300 i no 500,
perquè el Worker comparteix la quota del projecte. El TPM no talla mai (§2).

**El que sí que diu la documentació, i que és el que importa per al disseny:**

| Fet | Cita | Conseqüència aquí |
|---|---|---|
| Els límits són **per projecte, no per clau** | «Rate limits are applied per project, not per API key.» | Si la clau de l'Action surt del **mateix projecte de Google Cloud** que la del Worker, **comparteixen quota**. Una passada de l'Action pot deixar el camí del correu sense quota. |
| El RPD es reinicia a mitjanit hora del Pacífic | «Requests per day (RPD) quotas reset at midnight Pacific time.» | Dues passades el mateix dia comparteixen el sostre diari; dues passades en dies diferents, no. Repartir en dies és la manera barata de multiplicar la quota. |
| S'avalua contra els tres eixos alhora | «exceeding any of them will trigger a rate limit error» | El que talla primer és el RPM o el RPD, mai el TPM (vegeu el càlcul del §2). |
| L'error és `429 RESOURCE_EXHAUSTED` | (secció dels límits per despesa) | ~~És el senyal que ha de fer aturar la fase de traducció, no reintentar.~~ **Corregit pel propietari (§3.3): un 429 és una crida fallida com qualsevol altra. La fila s'encua en francès amb l'avís i la passada continua.** |
| El pla gratuït no té límit per despesa | «Free: N/A» | Cap risc de cobrament: no hi ha targeta. |
| **La Batch API comença al Tier 1** | Les tres taules de «Batch enqueued tokens» són Tier 1, 2 i 3; **no hi ha fila «Free»** | **No dissenyis amb la Batch API.** Seria la solució òbvia per a 712 files i no la tenim. |
| El model és vigent | La pàgina de preus llista «Gemini 3.5 Flash-Lite: Free of charge» | `GEMINI_MODEL` no s'ha de tocar. |

**Xifres de context, NO documentació** (fòrum de desenvolupadors, per calibrar
l'ordre de magnitud, no per confiar-hi): fins al juliol de 2025 el pla gratuït de
Flash-Lite donava **15 RPM i 1 000 RPD**, i des del desembre de 2025 hi ha
informes de retallades fortes en altres models de la gamma (Flash, de 250 a 20
RPD). O sigui: **l'ordre de magnitud pot ser de desenes de peticions al dia, no
de milers.** El disseny ho ha d'aguantar.

**Amb 500 RPD, la taula de contingències d'aquesta secció ha deixat de fer
falta.** Deia que amb ≥ 500 RPD la cadència setmanal ja hi cabia, i és el cas:
**300 crides per passada i una passada setmanal absorbeixen de sobres les
135–165 files noves per setmana del règim de creuer** (§2). No cal ni pujar la
freqüència ni agrupar files.

I un límit que no ve de Google: **el `timeout-minutes` del workflow**. Amb 300
crides i una pausa de 4,5 s el run ronda els 25–30 minuts, i el `.yml` ha passat
de 20 a **40** per tenir marge. Amb la passada sense traducció mesurada a **1,5
segons** (§2), tot el pressupost de temps és per a les crides.

---

## 2. El volum real, mesurat

Passada en sec del camí sencer, avui, sense límit
(`sincronitzaProgramada({ enSec: true, limit: 0 })`, cap escriptura):

```
ofertes del flux                      1 513
visites comentades descartades (R4)     230
duplicats fusionats dins del lot         19
classificació contra els dos fitxers  1 264, totes «nova»
descartades pel filtre previ            552, «fora de finestra» (30 dies)
FILES QUE S'ESCRIURIEN                  712
passada sencera                         1,5 segons
```

De les 712: **704 porten `descripcio_fr`, 8 la porten buida, i cap no porta
`descripcio_ca`.** Cap fila de la cua d'avui ve de l'ADT66 (`pendents.json` són
84 files, totes `pendent`, cap amb el tag `[ADT66 id: …]`), i per això la
classificació no en reconeix cap: **712 és la feina de la primera passada, no el
règim de creuer.**

Mida del text que aniria al model, en caràcters:

| | mín | mediana | mitjana | p90 | màx | total |
|---|---|---|---|---|---|---|
| `descripcio_fr` (n=704) | 7 | 379 | 523 | 1 139 | 4 264 | 367 955 |
| `titol` (n=712) | 4 | 31 | 35 | 62 | 133 | 24 769 |

**El règim de creuer.** Les 712 files repartides per setmanes vista dins la
finestra de 30 dies: setmana 0 → 238, setmana 1 → 130, setmana 2 → 194,
setmana 3 → 111, setmana 4 → 24, sense data → 15. Cada setmana que passa entra a
la finestra la llesca de la punta: **entre 135 i 165 files noves per setmana**,
és a dir **unes 20–25 al dia**. Aquest és el número que ha d'absorbir el disseny
un cop passat el sotrac inicial; les 712 només es paguen un cop.

**Tokens per crida** (el prompt del §4 fa 3 253 caràcters ≈ 900 tokens fixos):

- mediana: 900 + ~115 = **~1 015 tokens d'entrada**; p90 ~1 235; màxim ~2 125.
- sortida: tres camps curts, **~200 tokens**.
- primera passada sencera: **~753 000 tokens d'entrada** i ~135 000 de sortida.

A 15 RPM això són **~15 750 tokens per minut**: molt per sota de qualsevol TPM
que hagi tingut mai la gamma Flash-Lite. **El TPM no és el problema; el RPD sí.**

---

## 3. El disseny

### 3.1 On va, exactament

Al pas **7 bis** de `sincronitzaProgramada()`: **després d'`aplicaLimit()` i just
abans de la poda i de l'escriptura.** És l'últim lloc on encara no s'ha escrit
res, que és el que demanes: la fila ha d'arribar al curador ja en català.

I no pot anar més amunt, per una raó concreta: la classificació del pas 5 compara
títols, i el descriptor `FONT_ADT66` declara `llengua: 'fr'`. Si es traduís
abans, el lot passaria a ser català amb una etiqueta que diu francès i la
comparació de títols deixaria de voler dir res. **Traduir després de deduplicar
no toca cap llindar ni cap regla de dedup** — que és el que has demanat de no
tocar.

> **AVÍS RESOLT.** Tres bàners deien que aquest camí no cridava cap model: el de
> `.github/workflows/sincronitza-adt66.yml` («CAP CLAU DE MODEL»), el
> d'`eines/sincronitza-programada.js` («CAP CRIDA A CAP MODEL») i la fila «Crida
> models? **no**» de la taula del §7 bis de `CLAUDE.md`. **Els tres s'han
> reescrit el mateix dia de la implementació**, el 4 de setembre de 2026. Si mai
> en trobes cap que encara ho digui, és un document que se n'ha quedat fora.

### 3.2 Una crida per fila

**Una crida per fila, no per lot.** Els motius, per ordre:

1. **Un lot convida el model a barrejar files.** Amb 5 o 10 fitxes al mateix
   missatge, la descripció d'una es contamina de la del costat, i el risc número
   u d'aquesta feina és justament la invenció. Una fila sola no té amb què
   contaminar-se.
2. **Un error d'alineació és mut.** Si el model torna nou objectes quan n'hi
   havia deu, cal saber quin falta; i qualsevol mecanisme que ho resolgui
   (referències, comprovació de correspondència) és codi que el propietari haurà
   d'entendre d'aquí a sis mesos per arreglar una fitxa mal traduïda.
3. **El que estalvia el lot és RPD, i el RPD es pot comprar amb cadència.**
   Agrupar de deu en deu divideix les peticions per deu; passar de setmanal a
   diari les divideix per set amb una línia de cron i cap codi nou. La segona
   solució és més barata i no posa cap fitxa en risc.

**Si el RPD fos molt petit, la resposta seria córrer més sovint, no agrupar.**
Amb 500 RPD, però, no cal ni l'una ni l'altra: 300 crides setmanals ja passen de
llarg les 165 del règim de creuer. Vegeu el §3.6.

### 3.3 Què passa si una crida falla

> **CORREGIT PEL PROPIETARI.** Aquesta secció proposava **tres** casos i el
> tercer era un error: tractava el 429 com el pressupost exhaurit, i deixava la
> porta oberta a què una fila que petés **sempre** no entrés **mai** a la cua.
> El que s'ha implementat són **dos** casos i prou, i el 429 és del segon.

| Cas | Què es fa |
|---|---|
| **Pressupost de la passada exhaurit** — la crida no s'ha arribat a fer | La fila **NO s'escriu i torna sola a la propera passada**. No és cap descart: el flux la tornarà a oferir, la classificació la tornarà a dir `nova` i entrarà a la cua de la vegada següent. Cap tercer fitxer d'estat, cap marca. |
| **Crida fallida** — xarxa, 5xx, **429**, JSON il·legible, model que torna buit | La fila **S'ESCRIU igualment**, amb el títol i el text francesos tal com arriben del flux, i amb un avís enganxat a `nota_curador` darrere del tag. És la regla mestra del projecte: ENCUA. |

**Per què el 429 és una crida fallida i no un cas a part.** El sondeig deia que
un 429 «és un fet sobre la quota, no sobre la fila», i és veritat; però la
conseqüència que en treia —descartar la fila i totes les següents— fa
indistingible una fila sense quota d'una fila que peta sempre, i la segona no
tornaria mai. El cost acceptat: si la quota del dia és morta, la passada encua
el lot sencer en francès amb l'avís posat. És incòmode, es veu de seguida al
registre del run i és la direcció bona de l'error.

**UN reintent per fila, i cap més.** El sondeig deia «cap reintent»; la
correcció n'hi posa un, perquè un tall de xarxa o una resposta mal formada són
prou barats de tornar a provar. Ni pausa exponencial ni tercer intent: el que
peta dues vegades s'encua i la passada segueix. **Cada intent gasta
pressupost**, també el reintent —el pressupost compta crides a Gemini, no
files.

### 3.4 El pressupost per passada, i com es reprèn

> **CORREGIT PEL PROPIETARI.** Aquesta secció proposava reaprofitar
> `LIMIT_FILES_PRIMERA_EXECUCIO` com a pressupost. **No s'ha fet**: un límit de
> files candidates i un pressupost de crides a un servei amb quota compartida
> són **dos conceptes**, i fondre'ls en un sol nombre hauria amagat que el segon
> protegeix el camí de correu del Worker i el primer no protegeix res. Al codi
> hi ha, doncs, **dues coses separades**: la constant
> `PRESSUPOST_CRIDES_GEMINI = 300`, que és el sostre de debò d'una passada, i
> l'interruptor de mà `--limit=N`, sense cap constant al darrere (per omissió no
> retalla res). La constant temporal s'ha **esborrat**, com deia el seu propi
> comentari.

La resta del raonament d'aquesta secció es manté sencer:

- **El pressupost mana el nombre de files escrites**, perquè cada fila que
  s'escriu ha passat pel model.
- **L'ordre és per imminència.** Ho fa `tradueixLot()` mateix, que ordena el lot
  abans de gastar el pressupost —no `aplicaLimit()`, que per omissió ja no
  ordena res perquè no retalla res. Les que es queden fora són sempre les més
  llunyanes, que la propera passada continuaran dins la finestra de 30 dies.
  **Cap fila no es fa vella esperant torn** mentre el pressupost setmanal
  (pressupost × passades per setmana) sigui ≥ 165. Amb 300 × 1, hi ha el doble
  del que cal.
- **La represa no necessita memòria.** Una fila que no s'ha escrit no és enlloc:
  el flux la torna a oferir, la classificació la torna a dir `nova` i entra a la
  cua de la propera passada. **Cap tercer fitxer d'estat, cap marca, res a
  recordar.** (Ho deies al «fora d'abast»: si el disseny en demanés un, calia
  aturar-se. No en demana cap.)
- **I no es retradueix mai res**, perquè una fila traduïda ja és a
  `pendents.json` i la capa 1 de la deduplicació la reconeix pel tag
  `[ADT66 id: …]` i la classifica `ja_a_la_cua`: el model no la torna a veure.

**Per què NO l'altra opció.** L'alternativa era escriure-ho tot de seguida i que
una segona passada anés omplint la `descripcio_ca` buida de les files que ja són
a la cua. Té una virtut real —cap acte no espera torn per arribar al curador— i
dos defectes que la maten:

1. **`curador.html` identifica la fila per igualtat literal de tot l'objecte.**
   `trobaIndex()` compara `JSON.stringify(fila)`. Si l'Action reescriu el títol i
   les descripcions d'una fila que el curador té oberta al navegador, el seu
   «rebutja» peta amb «La fila ja no era a la cua». Falla net, no corromp res,
   però és una molèstia nova i real per a l'única persona que fa servir l'eina.
2. **Trencaria una regla escrita.** El bàner d'`eines/sincronitza-programada.js`
   diu que les files que ja hi són **no es toquen mai**, amb una sola excepció
   comptada (la poda). Aquesta seria la segona.

Amb el pressupost com a límit, cap de les dues coses no passa: **l'Action només
afegeix files noves, mai no en modifica cap.**

### 3.5 Dues coses petites que el disseny decideix

- **L'`id` no es reconstrueix.** El títol canvia de francès a català després que
  `mapejaOfertaADT66()` ja hagi fet l'`id`, o sigui que la fila entra a la cua
  amb un tros de títol francès al `slug`. **No importa i no s'ha d'arreglar:**
  `recullFitxa()` de `curador.html` reconstrueix l'`id` amb el títol editat en
  publicar. Reconstruir-lo a l'Action voldria dir una quinzena còpia literal de
  `creaId()` —no s'exporta enlloc— per no guanyar res.
- **Les 8 files sense `descripcio_fr` també es criden.** Tenen títol, i el títol
  també s'ha de passar al català i a caixa normal. El prompt ja diu què fer quan
  no hi ha matèria: tornar les descripcions buides.

### 3.6 On viu el secret i què has de fer tu a mà

El `CLAUDE.md` ja ho tenia previst al §7 bis: *«Si algú hi afegeix mai una crida
de model, el secret anirà a Settings → Secrets and variables → Actions del
repositori, que és un magatzem diferent del de Cloudflare i s'ha d'omplir a
part.»* Doncs és exactament això:

1. **A Google AI Studio, crea un projecte NOU** i, dins seu, una clau nova per a
   l'Action. **No reutilitzis la del Worker.** El motiu és la cita del §1: la
   quota és per projecte. Amb projectes separats, una passada de 150 crides de
   l'Action **no pot** deixar sense quota el correu que arribi aquella tarda. És
   la protecció més barata que hi ha i no costa res.
2. **Mira i apunta les xifres** de `gemini-3.5-flash-lite` a
   <https://aistudio.google.com/rate-limit> per a aquell projecte nou. És la dada
   que falta del §1.
3. **GitHub → Settings → Secrets and variables → Actions → New repository
   secret**, nom `GEMINI_API_KEY`, valor la clau nova. **No** als Secrets de
   Cloudflare, que són un altre magatzem.
4. Al `.yml`, afegir-la a l'`env:` del pas de sincronització, al costat del
   `GITHUB_TOKEN` efímer.

**El que NO cal:** cap `CLOUDINARY_*` (aquest camí continua sense pujar cap
cartell), cap canvi al Worker, cap canvi a Cloudflare.

> **RECOMANACIÓ RETIRADA PEL PROPIETARI.** Aquesta secció recomanava passar el
> cron a **diari**. **No.** La cadència es queda **setmanal**, el cron es queda
> **comentat**, i la periodicitat no es toca. Els números ho aguanten:
>
> - **L'endarreriment de la primera vegada** —712 files contra un pressupost de
>   300— es drena amb **tres execucions manuals** per `workflow_dispatch`. És un
>   sotrac que es paga un sol cop, a mà, mirant el registre de cada run.
> - **El règim de creuer són 135–165 files noves per setmana** (§2), i **300
>   crides hi caben de sobres**: el doble del que cal, amb marge per a una
>   setmana punta i per als reintents.
> - Una passada diària voldria dir **set arrencades de runner i set descàrregues
>   senceres del flux** per fer la feina que una en fa, i set ocasions de mirar
>   un registre en comptes d'una.
>
> La recomanació original no era falsa —amb un RPD petit, córrer més sovint és
> la resposta bona—; és que amb 500 RPD la premissa no s'aplica.

---

## 4. Esborrany del prompt

**Aquest text és l'esborrany, i el que corre és una versió amb una regla més.**
El prompt viu ara a la constant `PROMPT_TRADUCCIO` d'`eines/sincronitza-programada.js`
—no en cap fitxer de `prompts/`, que és del prompt d'extracció i és una altra
feina— i s'hi ha afegit, per correcció del propietari, la regla que falta aquí:

> **SI EL CAMP TEXT ARRIBA BUIT**, no hi ha matèria de cap mena: torna
> `descripcio_ca` i `descripcio_fr` totes dues buides i limita't a escriure el
> `titol`. Demanar 2–4 frases sobre un títol sol és demanar-li que se les
> invento.

I el codi no se'n refia: **si la fila arriba sense `descripcio_fr`, les
descripcions que torni el model es llencen igualment**, perquè només poden ser
inventades. Són 8 files de 712 (§2). La resta del text de sota és literal.

En comptes de `{{TITOL}}` i `{{TEXT}}`, la fitxa s'enganxa darrere de la línia
`FITXA:`, com el prompt d'extracció fa amb `CORREU:`.

Notes de disseny del prompt, abans del text:

- **No li passo el municipi ni la categoria a posta.** Si els veu, se'ls enganxa
  al títol o a la descripció, i tots dos ja tenen camp propi.
- **Les 3 claus i prou**, com demanaves: dates, hores, lloc, municipi, categoria
  i organitzador no li passen ni pel davant.
- L'ordre de les regles no és casual: **la regla de no inventar va l'última**,
  que és la posició que els models retenen millor, i porta títol propi.

```
Ets el redactor en català de l'agenda cultural «Què fas?» de la Catalunya Nord.
Reps la fitxa d'un acte tal com arriba del flux de l'agència de turisme dels Pirineus Orientals: el títol en francès i sovint tot en majúscules, i un text descriptiu en francès, cru, que pot portar preus, horaris, adreces i línies enganxades. La teva feina és escriure el títol i la descripció en català, i després la versió francesa d'aquesta descripció catalana. Res més.

FORMAT DE RESPOSTA — REGLES ABSOLUTES
1. Respon NOMÉS amb un objecte JSON vàlid. Cap text abans ni després. Cap explicació. Cap bloc de codi markdown (res de ```).
2. L'objecte conté exactament aquestes 3 claus, totes presents sempre, en aquest ordre: titol, descripcio_ca, descripcio_fr.
3. Tots els valors són cadenes de text (strings). Cap altra clau, mai.
4. No et demano cap altre camp. La data, l'hora, el lloc, el municipi, la categoria i l'organitzador ja són decidits i no els has de tocar ni esmentar.

ELS TRES CAMPS
- titol: el títol de l'acte en català, en caixa normal —majúscula inicial i prou, mai tot en majúscules. Conserva tal com són els noms propis (grups, obres, festivals, entitats, topònims) i no els tradueixis. Si el títol original és només un nom propi, deixa'l igual i arregla'n només la caixa. Sense preus, sense hores, sense dates.
- descripcio_ca: de 2 a 4 frases en català natural i correcte. Digues de què va l'acte, per a qui és i què s'hi farà, amb la informació del text original i res més. Redacta-la directament en català; no facis una traducció literal del francès. To informatiu i acollidor, sense exclamacions publicitàries ni crides a l'acció. No hi posis preus, ni horaris, ni dates, ni adreces, ni telèfons, ni webs: o tenen el seu camp o no van enlloc.
- descripcio_fr: traducció francesa fidel de la descripcio_ca que acabes d'escriure —de la teva, no del text original—, també de 2 a 4 frases. La mateixa informació, ni més ni menys.

QUAN NO HI HA PROU MATÈRIA — LA REGLA MÉS IMPORTANT
No inventis mai res. No completis amb el que sol passar als actes d'aquesta mena, ni amb el que sàpigues del poble, de l'entitat o del festival. Si el text original no dona prou informació per escriure dues frases honestes, torna descripcio_ca i descripcio_fr com a cadenes buides "". Val més una fitxa sense descripció que una descripció inventada: la fitxa la revisarà una persona, i un camp buit es veu de seguida mentre que una invenció ben escrita no.
Si el títol tampoc no es pot escriure —no n'hi ha cap, o és il·legible—, torna també titol com a cadena buida "".

EXEMPLE DE RESPOSTA (només per il·lustrar el format; no copiïs aquestes dades)
{
  "titol": "Festa de la carbassa",
  "descripcio_ca": "El comitè de festes organitza una diada al voltant de la carbassa a la plaça del poble. Hi haurà parades de productors, tallers de cuina i jocs per a la mainada. L'activitat s'adreça a tothom.",
  "descripcio_fr": "Le comité des fêtes organise une journée autour de la courge sur la place du village. Il y aura des stands de producteurs, des ateliers de cuisine et des jeux pour les enfants. L'activité s'adresse à tous."
}

FITXA:
TÍTOL: {{TITOL}}
TEXT: {{TEXT}}
```

**Configuració de la crida**, tal com s'ha implementat (la mecànica del §7 de
`CLAUDE.md`, sense inventar-ne cap): clau a la capçalera `x-goog-api-key`,
`responseMimeType: 'application/json'`,
`thinkingConfig: { thinkingLevel: 'minimal' }` —això és redacció, no una decisió
com la del classificador editorial, que demana `low`—, **cap `temperature`**,
**cap `thinkingBudget`**, i `maxOutputTokens: 1024` (tres camps curts: 512
podrien quedar justos amb una descripció llarga i les dues llengües).

**Una fila que torni `titol` buit i `descripcio_ca` buida no és cap error**: vol
dir que el model ha fet cas de l'última regla. La fila entra amb el títol cru i
un avís, com el cas de la crida fallada.

---

## 5. La traçabilitat — la teva recomanació, confirmada i ampliada

**Confirmo la recomanació, i la faig una mica més gran.** L'avís a
`nota_curador`, darrere del tag `[ADT66 id: …]` i enganxat amb `ajuntaNotes()`
—la regla compartida, no una concatenació a mà—, és correcte per tres motius:

1. **És l'única traça possible.** El §4 de `CLAUDE.md` diu que `nota_curador` es
   descarta en publicar i que la traça permanent és l'historial de git de
   `pendents.json`. Ara bé: un camp que ha escrit un model i que una persona
   valida **ha de dir-ho a qui el valida**, i aquest és l'únic canal que hi ha.
2. **Encaixa amb el que ja fa el camp.** `nota_curador` no descriu l'acte,
   descriu la fila; «aquests tres camps els ha escrit un model» és exactament
   aquesta mena de cosa, com ja ho és l'avís de rescat de la visita comentada.
3. **No embruta res públic.** No arriba mai a `events.json`.

**L'ampliació:** l'avís ha de dir **els tres camps, no només `descripcio_ca`**.
El model reescriu també el `titol` —és el canvi més visible de tots, perquè la
fila deixa de tenir el títol oficial en francès— i la `descripcio_fr`, que passa
de ser el text de l'ADT66 a ser una traducció de la nostra descripció catalana.
Si l'avís només parlés de la descripció catalana, el curador es podria pensar que
el títol i el francès són els originals, i no ho són.

Proposta de text, per esmenar:

> `Títol i descripcions escrits per un model a partir del text francès de
> l'ADT66. Comprova'ls abans de publicar.`

I el text de l'altre cas, quan la crida no ha anat bé:

> `No s'ha pogut escriure la versió catalana: la fila entra amb el títol i el
> text en francès tal com els dona l'ADT66.`

**Avisos excloents**, mai dos a la mateixa fila. El curador ha de poder
distingir «hi ha text català i el va escriure una màquina» de «no hi ha text
català».

**I són TRES, no dos.** La correcció del propietari sobre les 8 files sense
`descripcio_fr` crea un tercer estat que abans no existia —títol escrit pel
model, descripcions buides a posta— i deixar-lo sense text propi hauria volgut
dir mentir al curador amb un dels altres dos. Els tres, tal com són al codi:

| Estat de la fila | Avís |
|---|---|
| traduïda | `Títol i descripcions escrits per un model a partir del text francès de l'ADT66. Comprova'ls abans de publicar.` |
| només el títol | `Títol escrit per un model a partir del francès de l'ADT66. L'oferta no porta cap text descriptiu i no se n'ha inventat cap: les dues descripcions queden buides.` |
| no traduïda | `No s'ha pogut escriure la versió catalana: la fila entra amb el títol i el text en francès tal com els dona l'ADT66.` |

---

## 6. Fonts

- [Rate limits · Gemini API](https://ai.google.dev/gemini-api/docs/rate-limits) — límits per projecte, reinici del RPD, `429 RESOURCE_EXHAUSTED`, taules de la Batch API sense fila «Free», i la remissió a AI Studio en comptes de xifres.
- [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing) — «Gemini 3.5 Flash-Lite: Free of charge».
- [AI Studio · Rate Limit](https://aistudio.google.com/rate-limit) — **on has de mirar tu** les xifres del teu projecte.
- [Limits of Free Tier (API vs AI Studio)](https://discuss.ai.google.dev/t/limits-of-free-tier-api-vs-ai-studio/94918) i [Do they really think we wouldn't notice a 92% free tier quota?](https://discuss.ai.google.dev/t/do-they-really-think-we-wouldnt-notice-a-92-free-tier-quota/111262) — fòrum, **no documentació**: l'ordre de magnitud històric (15 RPM / 1 000 RPD a Flash-Lite) i els informes de retallades del desembre de 2025.
