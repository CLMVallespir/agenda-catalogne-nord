# Sondeig: pot `font_url` portar la identitat ADT66?

*3 de setembre de 2026. Sondeig de només lectura. **Cap fitxer del repositori no
s'ha tocat**: aquest document és l'única sortida de la sessió. Tot el que hi ha
aquí està comprovat contra el flux real i contra els llocs web reals, avui.*

**Resposta curta: NO.** Ni el flux de l'ADT66 no porta cap adreça de fitxa, ni se
n'hi pot construir cap de determinista. L'única cosa que sí que resol per
`SyndicObjectID` és el web d'una sola oficina de turisme comarcal, amb ~14 % de
cobertura màxima, i no és nostra. La via és tancada; vegeu el §6.

---

## 0. El context, i què hi ha de nou respecte del §2 ter del handoff

`docs/HANDOFF-ADT66.md` §2 ter ja va concloure, el 30 d'agost, que `font_url` és
`DETAILSITEWEB` —el web de l'organitzador— i que no hi ha cap fitxa de l'ADT66
construïble des del `SyndicObjectID`. **Aquest sondeig ho confirma sobre el flux
d'avui i hi afegeix tres coses que allà no hi eren:**

1. Un recompte camp a camp dels 35, no només dels dos que se sabien (§2).
2. La descoberta que **`www.tourisme-canigo.com` sí que resol per
   `SyndicObjectID`**, ignorant l'slug — cosa que el web departamental no fa
   (§3.4). És l'única escletxa real que hi havia, i el §5 diu per què no serveix.
3. La constatació que **sis files del repositori ja porten un `SyndicObjectID`
   recuperable dins de `font_url`**, sense que ningú no ho hagi buscat (§5.3).

---

## 1. Què hi escriu avui `eines/mapeja-adt66.js`

`font_url: adrecaDeEnllac(oferta.DETAILSITEWEB)` (línia 380). `adrecaDeEnllac()`
(línia 963) treu l'`href` del primer `<a>` del camp, amb un recanvi
(`adrecaNua()`) per si algun dia el flux deixés de posar-hi l'HTML. Si el camp és
`null` —i ho és sovint— torna `""`.

O sigui: **el web de l'organitzador quan n'hi ha, cadena buida quan no.** El
comentari de la funció ja ho declara com a decisió tancada.

### Què hi porten les files d'avui

| Origen | Files | Amb `font_url` |
|---|---|---|
| Importació de recerca (Manus) a `pendents.json` | **84** | **84/84** |
| ADT66 a `pendents.json` | **0** | — |
| `events.json` (publicats) | 8 | 1/8 |

**No hi ha ni una sola fila d'origen ADT66 al repositori**: cap `nota_curador` no
porta el tag `[ADT66 id: …]`. La canonada existeix però encara no ha escrit res.

I això importa per a la semàntica del camp: les 84 files de recerca porten, en 35
dominis diferents, **la pàgina d'on s'ha tret l'acte** —ajuntaments
(`www.ceret.fr`, `ville-elne.fr`), oficines de turisme
(`www.tourisme-canigo.com`, `www.vallespir-tourisme.fr`), agendes
(`www.lepetitagenda.com`, `66.agendaculturel.fr`), xarxes (`www.facebook.com`,
`www.instagram.com`)—. És un enllaç **per al lector**: «si en vols saber més,
això és d'on ho hem tret».

`mapeja-adt66.js` hi posa una cosa lleugerament diferent —el web de
l'organitzador, que sovint és la portada i no la pàgina de l'acte—, però encara
és de la mateixa família: **una adreça que un humà clica**. Cap de les dues
lectures no és «una clau tècnica». Aquesta és la semàntica que no podem trencar.

---

## 2. Què ofereix la font: els 35 camps, escombrats un per un

Flux baixat sencer avui:
`GET https://wcf.tourinsoft.com/Syndication/3.0/cdt66/{GUID}/Objects?$format=json`
→ **HTTP 200, 4 528 401 bytes, 1 463 ofertes, 35 camps** per registre.

*(La mida del flux baixa: 1 543 el 29 d'agost, 1 504 el 30, **1 463** avui. No és
cap error; és el flux que es purga sol.)*

Escombrats **tots els 35 camps de les 1 463 ofertes** buscant `https?://` o
`www.`. Només **cinc** camps contenen mai una adreça:

| Camp | Amb URL | Què és | Serveix d'identitat? |
|---|---|---|---|
| `LISTINGPHOTO` | **1 433/1 463** (97,9 %) | **imatge** | No |
| `DETAILSITEWEB` | **568/1 463** (38,8 %) | **web de l'organitzador** | No |
| `DETAILDESCRIPTIF` | 51/1 463 (3,5 %) | enllaç solt **dins la prosa** | No |
| `LISTINGACCROCHE` | 13/1 463 (0,9 %) | ídem | No |
| `ACCROCHE150` | 4/1 463 (0,3 %) | ídem | No |

Els altres 30 camps: **zero adreces, en cap oferta**.

*(Els tres darrers són enllaços que l'organitzador ha escrit dins del text
—«Prenez RDV sur https://efs.link/6XahN», la reserva d'una donació de sang—. No
identifiquen res: identifiquen un formulari extern.)*

### Les tres coses que no són el mateix

**a) URL de la fitxa de l'oferta al web turístic** — l'única que serviria
d'identitat. **No existeix. Cap dels 35 camps no en porta cap.**

**b) URL del web de l'organitzador** — `DETAILSITEWEB`, 568/1 463. Exemples reals:

```
<a href='https://www.lesoccasionsdumulticoque.com/' target=blank>…</a>
<a href='http://www.canet-tourisme.com' target=blank>…</a>
```

**151 dominis diferents.** Els més freqüents: `www.theatredelarchipel.org` (100),
`www.boitaclous.com` (37), `www.tourisme-pyrenees-mediterranee.com` (33),
`lessentiersdeclaire.addock.co` (27), `www.musee-rigaud.fr` (26).

Prova que **no** és identitat: catorze ofertes diferents —de dates i llocs
diferents— comparteixen exactament el mateix `DETAILSITEWEB`,
`https://www.tourisme-canigo.com/pays-dart-et-dhistoire-conflent-canigo/#rdv`.
Una clau que catorze files comparteixen no és cap clau.

**c) URL d'una imatge** — `LISTINGPHOTO`, sempre a `cdt66.media.tourinsoft.eu`:

```
<img src="http://cdt66.media.tourinsoft.eu/upload/nautipole-1.jpg?width=150&height=120" />
```

El nom del fitxer és un títol humanitzat (`Marche-du-Conflent.png`), **mai el
`SyndicObjectID`**. Els camps germans `DETAILPHOTO`, `DETAILPHOTO_DIAPO` i
`LISTINGPHOTO_DIAPO` porten només noms de fitxer sense domini (separats per
`||||##` als `_DIAPO`), o sigui que compten com la mateixa cosa: imatge, no
identitat.

---

## 3. Conté l'identificador? Comprovat amb GET reals

### 3.1 Dins del flux: no, zero vegades

Comparats, oferta per oferta, l'`href` de `DETAILSITEWEB` amb el
`SyndicObjectID` de la mateixa fila:

> **DETAILSITEWEB que contenen el `SyndicObjectID`: 0 de 568.**

### 3.2 El web departamental de l'ADT66: l'slug s'ignora, però la clau no és la nostra

`www.tourisme-pyreneesorientales.com` construeix les fitxes amb `-fr-{id_sheet}/`,
i **l'slug del davant és decoratiu**: el servidor el reescriu. Comprovat avui amb
un `id_sheet` real tret d'una fila del repositori:

| URL provat | Resultat |
|---|---|
| `…/agenda/troubadours-roussillonnais-belesta-fr-6274421/` | **200** (la fitxa) |
| `…/agenda/x-fr-6274421/` | **200 → redirigeix a l'URL canònic de dalt** |
| `…/agenda/x-fr-fmalar066v52yua3/` | **404** |
| `…/agenda/x-fmalar066v52yua3/` | **404** |
| `…/agenda/x-fr-PYRENEESORIENTALES-FMALAR066V52YUA3/` | **404** |
| `…/sit/PYRENEESORIENTALES-FMALAR066V52YUA3` | **404** |

Llegit al dret: el lloc **sí** que té adreces estables i robustes a un canvi de
títol, però **la clau és `id_sheet`, un número del seu CMS (Woody / Tourism
System) que no és enlloc del flux de sindicació**. El `SyndicObjectID` no hi
entra per cap porta. Confirma el §2 ter del handoff amb tres IDs nous.

### 3.3 El WCF per oferta: determinista, però és JSON cru

```
GET https://wcf.tourinsoft.com/Syndication/3.0/cdt66/{GUID}/Objects('{ID}')?$format=json
```

| ID | Resposta |
|---|---|
| `FMALAR066FS0009D` | **200**, 3 520 B, `application/json` |
| `FMALAR066V52XIVJ` | **200**, 3 787 B, `application/json` |
| `FMALAR066V52YUA3` | **200**, 2 433 B, `application/json` |
| `FMALAR066ZZZZZZZ` (inventat) | **404**, 110 B |

Funciona, és estable, i el 404 és un senyal net de retirada. **Com a sonda va
bé** —és el que fa `eines/adt66-identificador.js`—, però com a `font_url` no:
enviaria el lector del web públic a un abocador d'etiquetes HTML escapades.
Ja decidit al §2 ter, i no ha canviat.

### 3.4 L'escletxa: `www.tourisme-canigo.com` SÍ que resol per `SyndicObjectID`

Això és nou i no és al handoff. El patró
`https://www.tourisme-canigo.com/agenda/{qualsevol-cosa}-{id-en-minúscules}/`
**resol per l'identificador i reescriu l'slug tot sol**:

| URL construït (slug fals: `x-`) | Resultat |
|---|---|
| `…/agenda/x-fmalar066v52xivj/` | **200** → `…/agenda/rando-accompagnee-de-baillestavy-a-valmanya-…-fmalar066v52xivj/` |
| `…/agenda/x-fmalar066v52yua3/` | **200** → `…/agenda/visite-du-fort-liberia-fmalar066v52yua3/` |
| `…/agenda/x-fmalar066v52kxza/` | **200** → `…/agenda/fete-de-lescalade-et-du-club-fmalar066v52kxza/` |
| `…/agenda/x-fmalar066fs0009d/` (Canet, fora de territori) | **404** |
| `…/agenda/fmalar066v52xivj/` (sense el guionet) | **404** |

O sigui: el patró existeix, és determinista, i **el guionet abans de l'ID és
obligatori** (cal un prefix, encara que sigui escombraries).

**El mateix patró provat en set llocs més del departament**, cadascun amb un ID
del seu propi territori:

| Lloc | Resultat |
|---|---|
| `www.tourisme-canigo.com` | **200 — fitxa de debò** |
| `www.pyrenees-cerdagne.com` | 200 **fals**: torna 52 010 B idèntics per a un ID inventat. És l'esquelet de l'aplicació, no cap fitxa. |
| `www.tourisme-pyrenees-mediterranee.com` | 200 **fals**: redirigeix a `/agenda-et-evenements/tout-lagenda/`, l'agenda genèrica |
| `www.perpignantourisme.com` | 404 |
| `www.vallespir-tourisme.fr` | 404 |
| `www.canet-tourisme.com` | 404 |
| `www.argeles-sur-mer.com` | 404 |
| `www.tourisme-roussillon-conflent.fr` | 404 |

**Un de vuit.** I els dos «200» que no ho són avisen d'una trampa que val la pena
escriure: en aquests llocs **el codi 200 no vol dir que la fitxa existeixi**.
Qui provi cap patró d'aquests ha de comparar el cos, no el codi.

---

## 4. Estabilitat: l'slug hi és, però no mana

Als dos llocs que construeixen fitxes (`tourisme-pyreneesorientales.com` i
`tourisme-canigo.com`), **l'URL porta el títol i sovint el municipi en forma
d'slug** — `grand-marche-de-prades-fmalar066v52utm8`,
`visite-du-fort-liberia-…`, `troubadours-roussillonnais-belesta-fr-6274421` —.

Ara bé: **tots dos ignoren l'slug i resolen per l'identificador final**, i
redirigeixen al canònic. Provat amb `x-` de slug: 200 als dos. **La conclusió és,
doncs, la contrària de la que es podia témer:** un URL guardat avui **no es trenca
si la font reanomena l'oferta** — el redirigeix ella mateixa. L'slug és
decoració; la cua és la clau.

*(Amb una molèstia menor: l'slug guardat queda desfasat i el que es veu a
`font_url` deixa de coincidir amb el títol de destinació. Cosmètic, no funcional.)*

**Però l'estabilitat no és el problema.** El problema és la cobertura, i és el §5.

---

## 5. Per què l'escletxa del Canigó no serveix

### 5.1 La cobertura és d'un 14 % com a màxim

`www.tourisme-canigo.com` és l'**OTI Conflent Canigó**: publica el seu territori,
no el departament. Mesurat de dues maneres:

- **Empíricament**: mostra estratificada de 60 ofertes de tot el flux. De les 39
  que van poder respondre abans que el lloc ens tallés les connexions (vegeu
  §5.4), **20 van tornar 404 i cap no va tornar 200**; els municipis d'aquestes
  39 eren Canet, Arles-sur-Tech, Perpinyà, Sant Genís, Palau del Vidre… — cap
  del Conflent. Coherent: fora del territori, no hi ha fitxa.
- **Pel sostre teòric**: comptats els editors de les 1 463 ofertes (camp
  `CHAMPSYSTEME`, «Offre modifiée le … par X»), **`OTI CONFLENT CANIGO` n'edita
  203, un 13,9 %**. Per damunt hi ha `PERPIGNAN TOURISME` (236) i
  `OTI PYRENEES MEDITERRANEE` (207), i n'hi ha 28 en total.

**Sostre: ~14 %.** Una clau d'identitat que falla en cinc de cada sis files no és
una clau d'identitat: la sincronització programada continuaria reoferint els
altres cinc sisos.

### 5.2 I encara que cobrís el 100 %, seria l'adreça equivocada

`font_url` és, a `pendents.json` i a `events.json`, **d'on ve l'acte**. La font
d'aquestes files és **el flux de l'ADT66**. Posar-hi la pàgina d'una oficina de
turisme comarcal és atribuir l'acte a un tercer que no ens l'ha donat, i deixar
per escrit, al fitxer públic, una dependència d'un lloc que no controlem i que
pot reorganitzar-se demà.

I hi ha el conflicte directe: per a les 568 ofertes que **sí** que porten
`DETAILSITEWEB`, quina de les dues hi va? Si mana la identitat, es perd el web de
l'organitzador —l'enllaç útil, el que el §1 diu que és la semàntica del camp—.
Si mana l'organitzador, la identitat no hi cap. **No hi caben totes dues, i la
que ha de guanyar és la que el lector clica.**

### 5.3 Nota lateral: sis files ja porten l'identificador sense buscar-lo

Cercat `fmal[a-z0-9]{10,14}` dins de `font_url` a tot el repositori:

- **`pendents.json`: 5 de 84.** Totes de `tourisme-canigo.com`, totes posades a
  mà per la recerca. Exemple:
  `…/agenda/fete-du-champignon-fmalar066v52tz1u/`
- **`events.json`: 1 de 8** —
  `…/agenda/grand-marche-de-prades-fmalar066v52utm8/`

**6 de 92 files (6,5 %).** Una d'elles fa servir `/sit/` en comptes de `/agenda/`,
o sigui que **ni tan sols el prefix del camí no és uniforme**.

Això és útil de saber-ho —el dia que es dedupliqui contra `events.json`, un regex
sobre `font_url` recupera l'ID de franc per a les poques files on hi és, sense
canviar res ni escriure enlloc—. **No és una via d'identitat**: és una engruna
oportunista del 6,5 %, i no depèn de nosaltres que hi sigui.

### 5.4 Avís operatiu per a qui repeteixi això

`www.tourisme-canigo.com` **ens va tallar les connexions** després d'unes vint
peticions seguides: `curl` va passar a codi `000` (cap resposta), i també per a
`/robots.txt` i `/sitemap.xml`. No és cap error nostre; és protecció seva. Qui hi
torni, que hi vagi a poc a poc — i que no en depengui cap procés automàtic, que
és una raó més per no posar-hi la identitat del projecte a sobre.

---

## 6. Recomanació

**`font_url` NO pot portar la identitat ADT66.** El flux no té cap adreça de
fitxa (0 dels 35 camps), el web departamental resol per `id_sheet` —un número
del seu CMS que no és al flux—, i l'única adreça determinista des del
`SyndicObjectID` (`…/Objects('{ID}')?$format=json`) és JSON cru, il·legible per
a un lector.

L'única escletxa és `www.tourisme-canigo.com/agenda/x-{id}/`, que sí que resol
per identificador i és robusta al canvi de títol, **però cobreix un 13,9 % del
flux com a màxim** (OTI Conflent Canigó), és d'un tercer, ens limita el ritme de
peticions, i xocaria amb el web de l'organitzador a les 568 files que ja en tenen.

**La via és tancada, i no se n'ha d'inventar cap.** L'ancoratge fila ↔ oferta
continua sent el problema obert del §2 ter i del §5 punt 6 del handoff, i
s'haurà de resoldre fora de `font_url` — o bé no descartant la `nota_curador` en
publicar, o bé amb la sonda `Objects('{ID}')` sobre el conjunt de files vives.
Aquest sondeig no proposa cap de les dues: només tanca la que se li ha demanat
de mirar.
