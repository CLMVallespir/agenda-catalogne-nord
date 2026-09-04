# FASES.md — pla de construcció per fases

*Complementa `CLAUDE.md` (la constitució: restriccions, esquema, estil, serveis).
Última revisió: 27 d'agost de 2026.*

**Com llegir aquest pla.** Cada fase té un objectiu, uns límits i una **porta**: la
prova que cal demostrar, amb evidència real, abans de passar a la següent. Cada
fase és útil per ella mateixa encara que el pla s'aturi després. No hi ha pressa:
es construeix deliberadament, no en emergència. Dins de cada fase, el *com* és
teu — tria sempre la solució més simple que passi la porta.

---

## Fase 0 — Prerequisit humà: Email Routing viu (cap codi)

Feina del propietari, no de l'agent. L'agent només comprova que està fet abans de
la Fase 2.

Llista de control:

- [ ] Registres MX antics anotats en un fitxer de text (per poder revertir) i
      esborrats de la zona DNS a Cloudflare; cap TXT `v=spf1` heretat en conflicte.
- [ ] «Verify DNS records» completat: els tres MX de Cloudflare, el DKIM
      (`cf2024-1._domainkey`) i el seu SPF, tots afegits.
- [ ] Regles d'adreça creades i **destinacions verificades**: `agenda@`,
      `contacte@`, `tv@`, més l'antiga adreça de DinaHosting recreada com a regla.
- [ ] **Prova real de cada adreça** des d'un compte extern (una regla mal posada
      falla en silenci). Al Gmail, filtre per `to:agenda@clm.cat`.

**Porta:** un correu de prova enviat des de fora arriba al Gmail d'arxiu.

---

## Fase 1 — `curador.html`

**Objectiu.** Una segona pàgina estàtica al mateix repositori des d'on el curador
revisa la cua: veu cada fila pendent **amb el cartell al costat del text** (la
decisió és en bona part visual), pot **corregir qualsevol camp** abans d'aprovar
(sovint cal completar la traducció que el Typebot deixa buida), i valida amb dos
botons: **Publica** i **Rebutja**.

**Comportament.**

- Llegeix `pendents.json` i escriu via l'API de GitHub segons la mecànica del
  §7 de `CLAUDE.md` (API sempre, SHA, un reintent).
- **Publica:** posa `estat = "publicat"`, afegeix la fila a `events.json`, la treu
  de `pendents.json`.
- **Rebutja:** treu la fila de `pendents.json` i prou. No es guarda enlloc més: el
  correu original al Gmail d'arxiu és el registre permanent.
- **El token no viu mai al codi.** Un camp de contrasenya a dalt de la pàgina; el
  token de gra fi s'hi enganxa, viu en una variable de JavaScript durant la sessió
  i mor en tancar la pestanya. Cap emmagatzematge, cap sessió, cap login.
- Només en català. Mateixa família visual que el web públic (tipografies pròpies,
  sobrietat B&N); un sol tema és suficient. Funcional per damunt de bonic.
- Sense token enganxat, la pàgina és només de lectura i ho diu clarament.

**Consciència assumida:** `curador.html` i `pendents.json` són públics (GitHub
Pages). Els esdeveniments pendents són actes públics; que es puguin veure abans
d'hora és acceptable. Escriure-hi, en canvi, exigeix el token.

**Decisió presa el 29 d'agost de 2026 — `nota_curador` no arriba a
`events.json`.** El camp 17è es pinta a la fitxa com a avís groc, no editable, i
es queda a `pendents.json`: `recullFitxa()` segueix construint els 16 camps
canònics exactes i la nota s'hi perd a posta en publicar. `events.json` es
serveix sencer al públic i una nota de treball intern no hi pinta res; la traça
queda a l'historial de git de `pendents.json`. **Tancat: no s'ha de tornar a
obrir.**

**Llavor de dades (fet).** El `pendents.json` inicial va sortir de l'exportació
en CSV del full de càlcul antic, passada per `importa-csv.js` —una eina d'un sol
ús—, de manera que la pàgina va néixer amb contingut real. El CSV d'origen es
conserva a `docs/arxiu-google/esdeveniments-importacio.csv`. L'eina segueix a
l'arrel del repositori: **no la tornis a executar**, sobreescriuria la cua
sencera.

**Porta:** amb el `pendents.json` real carregat — (1) aprovar un esdeveniment i
veure'l aparèixer a `events.json` al GitHub i al web públic; (2) rebutjar-ne un i
veure'l desaparèixer de la cua; (3) editar un camp abans d'aprovar i comprovar que
el canvi és al fitxer publicat.

---

## Fase 2 — El Worker: `email()`

**Objectiu.** El gestor `email()` de l'únic Worker converteix cada correu rebut a
`agenda@clm.cat` en una fila pendent, i **passi el que passi reenvia l'original**
al Gmail d'arxiu.

**Comportament.**

- Parseja el MIME cru amb el `postal-mime` vendoritzat (vegeu `CLAUDE.md` §3 per
  les condicions de la vendorització i del desplegament sense eines).
- Cos de text → Gemini amb el prompt mestre (mecànica exacta al §7 de `CLAUDE.md`).
- Primer adjunt d'imatge o PDF → Cloudinary (pujada *unsigned*; el PDF es
  transforma sol). L'URL retornat va a `imatge_url`.
- Construeix la fila: 16 cadenes, `estat = "pendent"`, `data_entrada` = ara,
  `id` reconstruït amb `creaId`, enums coercits amb `valorPermes`.
- Afegeix la fila a `pendents.json` (API GitHub, SHA, un reintent).
- **`message.forward()` cap al Gmail d'arxiu sempre, també quan alguna cosa
  falla.** Un correu que no s'ha pogut analitzar no es perd mai: queda a l'arxiu i
  l'error queda registrat (sense claus als registres). Cap excepció no ha de fer
  caure el gestor abans del reenviament.

**Porta:** (1) un correu real amb cartell adjunt, enviat des d'un compte extern,
produeix una fila a `pendents.json` amb l'URL de Cloudinary omplert **i**
l'original arxivat al Gmail; (2) un correu escombraria o buit es reenvia igualment
i no fa caure res; (3) la fila apareix a `curador.html` i es pot publicar
end-to-end fins al web públic.

---

## Fase 3a — El Worker: `fetch()` (Typebot)

**Objectiu.** El webhook del Typebot apunta al Worker. Els camps del formulari ja
són estructurats: **cap crida a Gemini** — mapa determinista camp a camp cap a
l'esquema, amb la regla `descripcio` + `idioma_descripcio` i l'`imatge_url` tal
com arriba (§7 de `CLAUDE.md`).

**Límits.**

- Només `POST`. Cap `GET` ni cap altra ruta.
- **Secret compartit obligatori:** el Worker rebutja amb `403` tota petició sense
  la capçalera correcta (`TYPEBOT_SECRET` als Secrets, configurat també al pas
  webhook del Typebot). L'URL del Worker és públic; sense això, qualsevol podria
  injectar files a la cua.

**Porta:** (1) un `POST` de prova amb el secret produeix una fila correcta a
`pendents.json`; (2) el mateix `POST` sense secret rep `403` i no escriu res;
(3) una tramesa real des del formulari Typebot publicat arriba a la cua.

**Estat: desplegada** al tauler de Cloudflare, per paste manual, el **29 d'agost
de 2026**. Les portes (1) i (3) van passar abans d'aquest desplegament: una
tramesa real del Typebot va tornar `200` amb un `id` vàlid i la fila va sortir a
`pendents.json`.

La porta (2) **va passar el 29 d'agost de 2026**, reconfirmada sobre el
desplegament nou. Un `POST` a l'arrel del Worker sense la capçalera
`X-Typebot-Secret` va tornar:

```
HTTP/1.1 403 Forbidden
Content-Type: application/json; charset=utf-8

{"ok":false,"error":"no autoritzat"}
```

Cap escriptura a `pendents.json`. **Les tres portes de la Fase 3a han passat.**

---

## Fase 3b — El Worker: `scheduled()` (digest Brevo)

**Objectiu.** Un activador cron de Cloudflare al mateix Worker envia el digest
setmanal: **dimarts a les 15.00, hora de París**, un correu transaccional per
subscriptor i per comarca, amb els esdeveniments dels propers dies de la seva
comarca, capçaleres de dia en el format del web, i línia de baixa bilingüe.

**Límits.**

- El cron de Cloudflare és en UTC i no sap res de l'horari d'estiu: resol-ho de la
  manera més simple que garanteixi les 15.00 locals tot l'any, i documenta-la en
  un comentari.
- Llegeix `events.json` via l'API (no de Pages); només esdeveniments futurs.
- Cap enviament en bloc: la mecànica Brevo del §7 de `CLAUDE.md`.

**Porta:** una execució de prova (activador manual o data forçada) envia el digest
d'una comarca a l'adreça del propietari, amb format i llengües correctes, i no
envia res cap dia que no toqui.

**Estat: desplegada** al tauler de Cloudflare, per paste manual, el **29 d'agost
de 2026**. **La porta encara NO ha passat:** no s'ha fet cap execució de prova.
El 29 d'agost no es podia fer de manera útil, perquè `events.json` no tenia cap
acte publicat dins la finestra de set dies —el més proper és el 12 de setembre—
i la prova hauria tornat `enviats: 0` sense exercitar ni l'HTML ni Brevo. Serà
possible a partir del **5 de setembre**, quan aquell acte entri a la finestra.

Recorda, a més, que amb el Git Build desconnectat l'activador cron s'ha d'afegir
**a mà** al tauler (Worker → Settings → Trigger Events → Cron Triggers), amb la
mateixa expressió `*/10 13,14 * * 2`: l'expressió de `wrangler.jsonc` no la
llegeix ningú mentre el desplegament sigui manual.

### La prova de fums, a punt per al 5 de setembre de 2026

*Preparada el 29 d'agost de 2026 perquè el dia 5 no calgui recordar-ne cap
detall. **No executada**: la data encara no ha arribat.*

**Per què el 5 de setembre, i no abans.** Comprovat sobre l'`events.json`
d'avui (8 actes publicats): **un sol acte** cau dins la finestra —«Concert de
Goulamas'k», `2026-09-12`, **Vallespir**—, i els altres set queden fora (cinc ja
passats, dos a l'octubre). La finestra del Worker és **tancada pels dos
extrems**: `llegeixEsdevenimentsDeLaSetmana()` descarta l'acte si
`data_inici < avui` o si `data_inici > final`, amb `final = avui + DIES_FINESTRA`
i `DIES_FINESTRA = 7`. El 5 de setembre la finestra és
`2026-09-05 … 2026-09-12` i el dia 12 hi entra just al límit, inclòs. O sigui
que **la prova és útil qualsevol dia del 5 al 12 de setembre**, i abans del 5
tornaria `enviats: 0` sense exercitar res.

**Abans de llançar-la, comprova-ho tu al tauler** (jo no hi tinc accés: aquesta
màquina no té cap credencial de Cloudflare ni `wrangler` instal·lat, i no ho puc
verificar per codi):

- [ ] Worker → Settings → **Trigger Events → Cron Triggers**: hi ha l'entrada
      `*/10 13,14 * * 2`, i **una de sola**.
- [ ] Worker → Settings → **Variables**: `CLOUDINARY_CLOUD_NAME` com a variable
      de text, i els Secrets `GEMINI_API_KEY`, `GITHUB_TOKEN`, `BREVO_API_KEY`,
      `TYPEBOT_SECRET`, `ADRECA_ARXIU` i els cinc `BREVO_LIST_*`.
- [ ] Worker → **Deployments**: la darrera versió desplegada és la del 29
      d'agost. Recorda que **un Secret canviat no és viu fins que es desplega**.

**La comanda** (el `?digest=prova` ja és al Worker, `fetch()` → `worker.js`
línia ~338 → `respostaDigestDeProva()`). Mateix secret i mateix `POST` que el
formulari; només canvia la marca a l'URL:

```bash
curl -i -X POST "https://agenda-catalogne-nord.cloudflare-curvy928.workers.dev/?digest=prova" \
  -H "X-Typebot-Secret: EL_VALOR_DEL_TYPEBOT_SECRET" \
  -H "Content-Type: application/json" \
  --data '{"comarca":"Vallespir"}'
```

El cos és opcional: sense `comarca`, envia una mostra de **cada** comarca que
tingui actes (el 5 de setembre, això és el mateix: només Vallespir en té).

**Què ha de tornar:**

```
HTTP/1.1 200 OK
{"ok":true,"finestra":"2026-09-05 … 2026-09-12","actes":1,"enviats":1,"comarques":["Vallespir"]}
```

**Què ha d'arribar:** un sol correu a `ADRECA_ARXIU` (el Gmail d'arxiu, **no**
cap subscriptor), amb l'assumpte
`[PROVA] Agenda cultural — Vallespir — setmana del 5 de setembre de 2026`.
Cal mirar-hi:
capçalera de dia en el format del web, català a dalt i francès a sota, i la
línia de baixa bilingüe.

**Si torna `enviats: 0`:** mira `finestra` i `actes` a la resposta abans de
sospitar de Brevo. `actes: 0` vol dir que la finestra no atrapa res —data
equivocada o `events.json` canviat—, no que l'enviament hagi fallat.

**El que aquesta prova NO exercita**, i que per tant **no tanca la porta
sencera**:

- El camí `scheduled()` i el porter `horaDeParis()` — la meitat de la porta que
  diu «no envia res cap dia que no toqui». Això només es veu el primer dimarts
  real, o mirant el registre del Worker un dimarts a la tarda.
- Els IDs de llista `BREVO_LIST_*` i l'enviament a subscriptors de debò: la
  prova envia només a l'adreça d'arxiu i no consulta cap llista.
- La guarda d'idempotència (`adrecesJaEnviadesAvui`): la prova s'etiqueta
  `digest-prova-AAAA-MM-DD`, a posta, per no consultar-la ni embrutar-la.

Per tancar la porta del tot caldrà, doncs, la prova de fums **més** una
observació del primer dimarts.

---

## Fase 4 — Tall de cinta (majoritàriament operacional)

Quan les portes 1–3 han passat i el sistema nou ha rodat en paral·lel unes
setmanes:

- [x] Arxivar el codi `.gs` i l'exportació del full a `docs/arxiu-google/`
      (registre històric, no codi viu). **Fet el 29 d'agost de 2026:** els nou
      fitxers d'`apps-script/` i les cinc guies del sistema antic són a
      `docs/arxiu-google/`, amb un `README.md` que explica què feia cadascun i
      qui ho fa ara. La carpeta `apps-script/` ja no existeix.
- [x] Retirar el full de càlcul de l'ús diari. **Fet:** cap peça del sistema
      viu no el llegeix ni l'escriu. Vegeu la nota corresponent a `NOTES.md`.
- [x] Publicar `agenda@clm.cat` com a única adreça de tramesa (web, peu de
      pàgina, materials). **Fet:** el peu d'`index.html` i la pàgina
      `qui-som.html` ja diuen les dues vies —correu a `agenda@clm.cat` i
      formulari Typebot— i cap altra.
- [x] Comprovar que l'URL del formulari de subscripció de Brevo ja no és el
      marcador de posició a `index.html`. **Comprovat: ja era l'URL real**
      (`sibforms.com`), tant a `index.html` com a `prova-local.html`. No calia
      cap canvi.
- [x] Actualitzar `NOTES.md` i el bloc d'estat vigent de la documentació del
      projecte perquè descriguin només l'arquitectura nova. **Fet:** `README.md`
      reescrit, `CLAUDE.md` i `FASES.md` al dia, i els fitxers de coneixement
      grans marcats com a anteriors al tall.

**Encara per fer, i només es pot fer a mà** (fora del repositori):

- [ ] **Desactivar els activadors d'Apps Script** dins l'editor de Google
      (`processNewEmails` cada hora i `sendWeeklyDigest` els dimarts). Mentre
      visquin, el sistema antic continua escrivint al full i **enviant el digest
      en paral·lel** amb el Worker: els subscriptors en rebrien dos.
- [ ] **Retirar el desplegament del Web App** d'Apps Script (el `doPost` del
      Typebot), un cop confirmat que el formulari apunta al Worker.

**Porta:** una setmana sencera de funcionament real — trameses per correu i per
formulari, curació, publicació i digest — sense tocar res de Google llevat de la
clau de Gemini i el Gmail d'arxiu.

**Estat:** la part de repositori del tall és feta (29 d'agost de 2026). La porta
**no** es pot declarar passada fins que els activadors de Google siguin
desactivats i hagi passat la setmana de funcionament real.

---

## Fonts externes (ADT66) — començat, encara no és una fase

No és cap de les fases d'aquest pla i no en té porta: és un canal a part, que
s'anirà fent peça a peça. **La font de veritat és
`docs/HANDOFF-ADT66.md`** — llegeix-lo abans de tocar-hi res.

Fet el **29 d'agost de 2026**, primera peça: `eines/adt66-sincronitza.js`, amb
la funció `sincronitzaADT66()`, que baixa senceres les ofertes del flux de
l'ADT66 que han canviat des de l'última vegada. Codi pur, provat contra l'API
real, **sense cap crida a Gemini i sense escriure enlloc**.

Dues troballes que manen sobre tot el que vingui després:

1. **El flux porta tot el que cal per fer una agenda**: `TRI` dona les dates de
   l'acte a **les 1 543 ofertes**, i també hi ha descripció, municipi,
   categoria i cartell. Trenta-cinc camps, no vint-i-dos. Cal llegir-lo per
   `wcf.tourinsoft.com`, que és on l'`api-v3` redirigeix: l'`api-v3` només
   n'exposa una vista aprimada, i confondre-la amb el flux va fer donar el
   canal per bloquejat durant una tarda.
2. **El WCF filtra per data al servidor** (`$filter=Updated gt datetime'…'`),
   sense paginació i sense finestra de dos anys. Una sincronització és **una
   sola petició GET**. El `POST`, el 302 i la comparació local del disseny
   anterior ja no fan falta.

**No hi ha res bloquejat i no cal demanar res a l'ADT66.** El detall és al §2
bis del handoff.

Afegit el **30 d'agost de 2026**: `classificaDates()`, que distingeix un acte
continu d'un de periòdic. El `TRI` dona **totes** les dates d'una oferta i n'hi
ha amb 470, o sigui que el primer i l'últim dia convertien un mercat setmanal
en un acte de dos anys. Un acte és continu si les dates són seguides (amb un
dia de buit tolerat) **i** l'abast no passa d'un mes —fan falta les dues
condicions, perquè hi ha tallers oberts cada dia menys diumenge que duren set
mesos—; si és periòdic, es publica **la propera ocurrència** i prou, i si totes
són passades no genera fila. Afecta **230 ofertes, el 14,9 % del flux**. **Cap
canvi a l'esquema.** El §3 bis del handoff ho documenta amb els números.

> **CORRECCIÓ DEL 30 D'AGOST DE 2026.** Aquí hi deia, i el §3 bis del handoff
> també: «`font_url` ja porta al calendari sencer». **Era fals.** `font_url`
> surt de `DETAILSITEWEB`, que és el **web de l'organitzador** i només hi és a
> **606 de 1 504** ofertes; el flux no porta cap adreça de cap fitxa de
> l'ADT66, i el web públic de l'ADT66 construeix les seves fitxes amb un
> número del seu CMS que no és al flux. Els dies que no es publiquen d'una
> oferta periòdica **es perden**, sense enllaç de consol. Comprovat amb `curl`;
> el detall és al **§2 ter** del handoff.

Afegit el **30 d'agost de 2026**, quarta peça: `eines/deteccio-retirades.js`,
amb la funció `detectaRetirades()`, que donats **dos instantanis del flux
complet** diu quines ofertes hi havia abans i ja no hi són, i en prepara la
`nota_curador` (`[ADT66: retirat — ja no apareix al flux complet de
DD/MM/AAAA]`). Codi pur, **sense xarxa**: no crida el flux ella mateixa. **Només
marca: mai esborra cap fila i mai toca `estat`** — retirar un acte del públic
és sempre decisió del curador. **Sense connectar a res**, ni a cap cron: cada
quan es fa una passada completa del flux és decisió del propietari. Deu casos
de prova (`node eines/deteccio-retirades.js`), tots passats. El §6 del handoff
ho documenta.

**Continua obert l'ancoratge fila ↔ oferta.** Cap fila no guarda el
`SyndicObjectID` i, pel §2 ter, `font_url` no el pot portar: la funció, doncs,
diu **què** ha caigut del flux, però no **quina fila** en depenia si no li ho
diu qui la crida. Decisió pendent del propietari (§5 punt 6 del handoff).

El que ve ara és el filtre previ —les 1 543 són de tot el departament i de tot
tipus— i el mapatge cap als disset camps.

Fet també el **29 d'agost de 2026**, segona peça: `eines/dedup-esdeveniments.js`,
amb la funció `comparaEsdeveniments()`, que donades dues files candidates diu si
són el mateix acte, si són actes diferents, o si el cas és dubtós i l'ha de mirar
el curador. Codi pur, cap crida a Gemini, **sense connectar a res**: no llegeix
`pendents.json` ni hi escriu. No depèn de cap detall de l'ADT66 i serveix per a
qualsevol font. Vuit casos de prova dins del mateix fitxer (`node
eines/dedup-esdeveniments.js`), tots passats.

Fet també el **29 d'agost de 2026**, tercera peça: `eines/mapeja-recerca.js`,
amb la funció `mapejaAProduccio()`, que converteix un registre de l'esquema de
recerca (**31** camps, amb procedència) en una fila neta dels camps canònics, i
torna la procedència a part: `{ fila, metadadades }`. Codi pur, **sense
connectar a res**. La taula camp a camp és a `docs/HANDOFF-MAPEIG-RECERCA.md`.
Quinze casos de prova (`node eines/mapeja-recerca.js`), tots passats, i les 103
files reals del CSV de recerca passades pel mapeig sense perdre'n cap.

**L'esquema passa a disset camps.** El dissetè és `nota_curador`: els avisos que
genera aquest mapeig —títol per traduir, categoria sense calaix, comarca fora de
l'enum— viatgen dins de la fila fins a `pendents.json`, perquè el seu
destinatari és el curador. Les regles del camp són al §4 de `CLAUDE.md`; el
repartiment entre `fila` i `metadadades`, al §4 del handoff. **Encara no es
pinta a `curador.html`:** el camp hi arriba, però mostrar-lo és una tasca a
part. La resta de la `metadadades` (font, confiança, llengua original) segueix
sense lloc definitiu, a posta.

Fet també el **29 d'agost de 2026**, quarta peça: `eines/processa-lot.js`, amb la
funció `processaLot()`, que uneix les dues anteriors: passa cada candidat pel
mapeig i compara entre elles les files que en surten, per trobar els duplicats
**dins del mateix lot** (encara no contra `pendents.json`: això és una altra
tasca). Torna tres llistes que no comparteixen cap fila —`llestos`, `dubtosos` i
`metadadades`, aquesta última indexada per la fila mateixa, mai a dins dels
disset camps. Codi pur, **sense connectar a res**. Set casos de prova en un lot
fet a mà (`node eines/processa-lot.js`), tots passats.

Tres regles que cap de les dues peces no cobria van haver de decidir-se —la
fusió en cadena, el solapament entre llistes i què fer amb una fila sense clau
forta— i són a `NOTES.md`, amb el perquè. Per poder-les cridar totes dues des
d'un sol fitxer, `mapeja-recerca.js` i `dedup-esdeveniments.js` ara exporten la
seva funció amb `module.exports`; res més d'aquells dos fitxers no ha canviat.

Fet també el **29 d'agost de 2026**, cinquena peça: `eines/filtra-candidats.js`,
amb la funció `filtraCandidats()`, el **filtre previ**: s'aplica sobre els
candidats en brut, abans del mapeig i de `processaLot()`, i redueix el soroll
obvi perquè no gasti ni crides a Gemini ni temps del curador. Només dos criteris,
tots dos mecànics: la **finestra de dates** (`MESOS_DE_FINESTRA`, ara 12) i una
**llista negra** de paraules de soroll al títol o a l'organitzador —agències
immobiliàries, ofertes de feina, lloguer vacacional. Torna `passen` i
`descartats`, cada descart amb el motiu concret: **res no es descarta en
silenci**. Codi pur, **sense connectar a res**. Vuit casos de prova (`node
eines/filtra-candidats.js`), tots passats, i les 103 files reals del CSV de
recerca hi passen senceres sense cap descart.

**No és la classificació editorial** i no l'ha de fer mai: les regles de discurs
i de nucli/perifèria són d'un classificador que encara no existeix, i el que en
surti serà un suggeriment per al curador, no una decisió. La vora entre les dues
coses, i per què la vora de sota de la finestra mira `data_fi` i no `data_inici`,
són a `NOTES.md`.

Fet també el **29 d'agost de 2026**, sisena peça: `eines/pipeline-offline.js`,
amb la funció `pipelineOffline()`, que encadena les dues anteriors —filtre previ
primer, mapeig i deduplicació de lot després— i torna
`{ llestos, dubtosos, descartats, metadadades }`. És una **simulació de cap a
cap**: respon «què passaria si aquest lot entrés» i **no escriu absolutament
res**, ni a `pendents.json` ni enlloc. La comparació contra la cua que ja
existeix segueix sense fer-se.

Passat pel CSV real sencer (`node eines/pipeline-offline.js
docs/arxiu-google/esdeveniments-importacio.csv 2026-08-29`): **103 candidats →
0 descartats, 99 llestos, 3 parelles dubtoses** (les mateixes 3 files, totes a
Prada el 18 d'agost) i **1 fusió** de dos candidats en una fila (el taller de
vaixells de Paulilles, per les Jornades del Patrimoni). Cap candidat perdut: 103
darrere de 102 files.

I una neteja del mateix dia: la taula de noms de poble en les dues llengües,
que era copiada als dos fitxers, ara viu un sol cop a **`eines/pobles-alies.js`**
i la importen tots dos amb `require()`. Vegeu `NOTES.md`.

Fet el **31 d'agost de 2026**: **els cartells forans ja són a Cloudinary.**
`eines/cartells-a-cloudinary.js` passa cada fila de `pendents.json` per
`pujaCartell()` amb l'adaptador de debò i reescriu el fitxer. És la primera peça
d'aquest canal que **escriu**, i es llança **a mà**: mai un pas automàtic, perquè
cada pujada deixa una còpia permanent a un compte gratuït. Primera passada: **54
cartells forans → 51 a Cloudinary i 3 amb nota** (dos 404 a la font, un fitxer de
16 MB que passa del límit). De les 17 files d'ADT66, 16 pujades. **Cap fila no es
queda amb un URL forà**: o és de Cloudinary o és `""` amb el motiu escrit.

És **incremental sense cap comptador**: `pujaCartell()` calla davant d'un
`imatge_url` que ja apunta a `cloudinary.com`. Comprovat: dues passades seguides
deixen `pendents.json` amb el mateix md5 i no gasten ni una petició. La
incrementalitat de no tornar a mapejar les 1 453 ofertes ja la fa
`sincronitzaADT66()`.

Amb això queda **resolta la pregunta oberta 5** del §5 del handoff: l'adreça
d'ADT66 sense `?width=150&height=120` dona l'original, i qui la desfà és
`variantsDeCartell()` a `eines/puja-cartell.js` —no el mapeig. Els detalls i les
dues trampes que hi havia (una imatge que només existeix retallada; el `?itok=`
de Drupal, que no es pot tocar) són a `NOTES.md`.

Fet el **3 de setembre de 2026**: **la deduplicació contra els fitxers que ja
tenim.** `eines/dedup-contra-fitxers.js`, amb `classificaContraFitxers()`, que
compara cada oferta entrant amb el que ja hi ha i en torna una etiqueta
—`ja_publicat` · `ja_a_la_cua` · `ja_rebutjat` · `nova`—. **No escriu res, no
esborra res i no canvia cap estat**, i `events.json` **només es llegeix**. Dues
capes de força diferent: la **1 exacta**, pel tag `[ADT66 id: …]` contra
`pendents.json`, que mira els tres estats sense filtrar-ne cap (una oferta ja
rebutjada no torna a entrar); i la **2 difusa** contra `events.json`, que
reutilitza `comparaEsdeveniments()` sencer i hi posa un llindar propi de **0,75**
en comptes del 0,55 del mòdul de dedup. El biaix és, a tot arreu, cap a `nova`:
un duplicat a la cua es resol en un clic, un acte perdut no el veu mai ningú. El
llindar i les mesures d'on surt són al §4 ter de `CLAUDE.md`.

Passat pel flux real del mateix dia (**1 463 ofertes → 1 445 amb data**) contra
`pendents.json` (84 files) i `events.json` (8 files): **1 445 `nova`, 0 a la
resta**, i els dos zeros tenen causa coneguda —cap fila de la cua no porta
encara el tag, i cap fila publicada no ve d'ADT66. Amb els títols declarats en
català, només **4 ofertes de 1 445** arriben a tenir clau dura igual amb una
fila publicada i la similitud més alta és **0**: mentre els títols del flux
arribin en francès, la capa 2 no s'activarà per a aquesta font. La bateria del
fitxer són **20 casos** (`node eines/dedup-contra-fitxers.js`), tots passats,
inclosa una prova que comprova que cap de les dues llistes d'entrada no es
modifica.

Encara **no fet**, i cada cosa serà la seva pròpia tasca —i cap no es comença
fins que el punt 2 estigui resolt: el **cablejat** del mapeig i d'aquesta
classificació a la cua real, el filtre previ, la classificació editorial, i
qualsevol altra escriptura a `pendents.json`.

---

## Ajornats — camí acordat, no per construir ara

- **Tokens de curació per comarca.** Quan una associació vulgui curar la seva
  comarca: un token de gra fi propi + `curador.html?comarca=Vallespir` que filtra
  la cua. Cap taula d'usuaris; l'historial de commits diu qui ha aprovat què. Es
  farà només després d'una temporada d'ús en solitari.
- **Confirmació del primer remitent.** El disseny antic (etiquetes de Gmail +
  propietats de script) va morir amb l'Apps Script, ara arxivat a
  `docs/arxiu-google/`. Quan calgui, l'equivalent natural és una llista
  `remitents.json` al repositori gestionada pel Worker. No dissenyar-ho fins que
  faci falta.
- **Respondre des de `agenda@clm.cat`** («send mail as» amb relay SMTP): feina
  separada, només quan la recepció porti temps rodant.
- **Adreça atrapa-ho-tot `*@clm.cat`:** xarxa de seguretat contra errates, a canvi
  de brossa. Decisió del propietari, cap codi.
