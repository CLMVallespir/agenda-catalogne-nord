# NOTES.md — lliçons apreses

*Una lliçó per entrada, amb un resum d'una línia. El perquè hi és sempre: si
una nota no diu per què, d'aquí sis mesos no serveix de res. Les notes que
resultin errònies s'esborren, no es maten a comentaris.*

---

## La memòria de rebuig és posició al fitxer, no un tercer magatzem

**Resum:** rebutjar deixa la fila a `pendents.json` amb `estat = "rebutjat"`
perquè la sincronització automàtica no torni a oferir el que el curador ja ha
descartat, i el rastre ha de viure allà on ja hi ha estat.

Abans, rebutjar treia la fila de `pendents.json` i prou. Amb trameses humanes
n'hi havia de sobres: si una associació insistia, tornava a enviar el correu i
el curador tornava a decidir. Amb una sincronització automàtica de l'ADT66 la
mateixa oferta torna cada setmana sola, i una cua sense memòria vol dir tornar
a rebutjar-la cada setmana.

La temptació era un tercer fitxer (`rebutjats.json`). El §3 de `CLAUDE.md` diu
que l'estat viu en **dos** fitxers JSON, i el camp `estat` ja té el valor
`rebutjat` a l'esquema des del primer dia: el lloc on desar-ho ja existia. Per
això rebutjar és ara **una sola escriptura** que canvia un camp, i el que fa
desaparèixer la fila de la pantalla és el filtre de `carregaCua()`, no una
supressió.

La regla general: **abans d'afegir un magatzem, mira si l'estat que et falta ja
té un camp on cabre.**

---

## Publicar escriu `events.json` ABANS que `pendents.json`

**Resum:** l'ordre de les dues escriptures no és casual; capgirar-lo pot perdre
un acte.

Publicar un acte són dues crides separades a l'API de GitHub — afegir-lo a
`events.json` i treure'l de `pendents.json` — i no hi ha manera de fer-les
alhora. Sempre hi ha una finestra on la primera ha reeixit i la segona encara no.

Si es fes al revés (treure de la cua primer), una fallada enmig deixaria l'acte
fora de la cua i fora d'`events.json`: perdut, i sense cap rastre a la pantalla
que ho digués. Fent-ho en aquest ordre, la mateixa fallada deixa un **duplicat
visible** a la cua: l'acte ja és publicat i encara surt per revisar. És lleig,
però es veu i es pot arreglar rebutjant la fila.

La regla general que se'n treu: **quan dues escriptures no poden ser atòmiques,
ordena-les perquè la fallada intermèdia dupliqui, mai perquè esborri.**

`curador.html` ho fa així a `publica()`, amb dos `try` separats justament perquè
el segon pugui donar un missatge diferent: «Publicat a events.json, però no l'he
pogut treure de la cua».

---

## El gestor `email()` reenvia a l'arxiu ABANS de fer res més

**Resum:** l'arxiu es fa primer perquè és l'única còpia que no es pot refer.

La temptació natural és analitzar el correu, escriure la fila i reenviar
l'original al final, tot dins d'un `try/finally`. No serveix: hi ha maneres de
morir que un `finally` no arriba a executar — el límit de CPU del Worker, un
error dins del mateix `finally`, una excepció que es menja el reenviament a
mitges. I si el reenviament no es fa, el correu **desapareix**: Email Routing
l'ha entregat al Worker i ja no el torna a enviar. No hi ha segona oportunitat.

Fent-lo primer, l'única cosa fràgil del sistema queda protegida per l'ordre, no
per la gestió d'errors: quan comença la part que pot fallar (MIME, Gemini,
Cloudinary, GitHub), l'original ja és desat. `reenviaAArxiu()` tampoc no llança
mai: si el reenviament falla, ho registra i el gestor continua igualment.

La regla general que se'n treu: **el que no es pot refer, fes-ho primer.** Un
`finally` és per netejar, no per garantir.

Queda un sol cas en què no es pot arxivar res: que falti la variable
`ADRECA_ARXIU`, perquè sense adreça no hi ha on reenviar. Allà el gestor
**rebutja** el correu amb `message.setReject()` en comptes de continuar. Sembla
pitjor i és millor: processant-lo, el remitent creuria que ha arribat i
l'original no existiria enlloc; rebutjant-lo, rep un avís de no-entrega i el pot
tornar a enviar. És un rebuig permanent (5xx), o sigui que el seu servidor no ho
reintentarà sol: per això el text del rebuig és bilingüe i li diu què fer. I com
que rebutjar vol dir «no ho hem acceptat», el gestor no escriu cap fila en
aquell cas — si no, el reenviament de la persona en faria una segona.

El corol·lari, que val per a tot el projecte: **quan no puguis garantir una
cosa, digues-ho al de fora; no te la quedis en silenci.**

---

## Al camí de Git, les variables de text del tauler no sobreviuen

**Resum:** `wrangler deploy` esborra les variables de text posades al tauler
cada vegada que desplega; els Secrets no els toca mai.

Amb el Worker connectat al repositori, cada empenta executa `npx wrangler
deploy`, i per a wrangler la configuració manda: les variables de text (`vars`)
que hagis posat al tauler i no siguin a `wrangler.jsonc` desapareixen. Els
Secrets (variables xifrades) queden: només els esborra un `wrangler secret
delete` explícit.

La trampa és que no falla en desplegar, sinó dies després i de biaix. Una
variable esborrada no dona cap error de construcció: simplement, el dia que
arriba un correu amb cartell, la pujada a Cloudinary falla i la fila entra sense
imatge. Ningú no relaciona les dues coses.

D'aquí la regla del projecte, que val també per a les claus de Brevo de la Fase
3b: **si és secret, als Secrets del tauler; si no és secret, a
`wrangler.jsonc`.** Res al mig. `CLOUDINARY_CLOUD_NAME` és a la configuració
(surt a l'URL de cada cartell públic, no té res a amagar) i les altres tres són
Secrets — `ADRECA_ARXIU` inclosa, que no és cap contrasenya però és una adreça
personal i el repositori és públic.

Detall que costa una tarda si no se sap: **un Secret canviat al tauler no és viu
fins que es desplega.** Els valors formen part de la versió del Worker, i la
pantalla del tauler acaba amb un botó **Deploy**. Si el registre diu que falta
una variable que jures haver posat, mira si aquella versió s'ha desplegat abans
de buscar res més — i mira l'hora de l'entrada, que se'n guarden tres dies.

---

## postal-mime NO converteix l'HTML a text pla

**Resum:** en un correu només HTML, `email.text` ve `undefined`, no buit ni
convertit.

El codi de postal-mime porta un `htmlToText`, i és fàcil suposar que omple
`text` quan el correu no porta cap part de text pla. No ho fa: aquella
conversió és per a submissatges. Provat amb la versió vendoritzada (3.0.0), tant
amb `Content-Type: text/html` sol com amb un `multipart/alternative` que només
porta la part HTML: `text` és `undefined` en tots dos casos.

Importa perquè **molts correus d'associació arriben només en HTML**. Sense
adonar-se'n, el Worker enviaria a Gemini només la línia d'assumpte i tornaria
files buides sense cap error. Per això `worker.js` té un `textDeHtml()` propi,
tosc a posta: fora `<script>` i `<style>`, salts de línia on l'HTML els marca,
fora la resta d'etiquetes, quatre entitats desxifrades. Prou per al model, i 20
línies que es poden llegir d'un cop d'ull.

L'altra cara: la comprovació de «correu sense text» ha d'anar sobre el
contingut, no sobre la cadena ja muntada. `'Assumpte: ' + '' + '\n\n' + ''` no
és mai buida, i un correu del tot buit passava el filtre i gastava una crida a
Gemini. `textDelCorreu()` torna `""` només si ni l'assumpte ni el cos no porten
res.

---

## La porta del formulari es tanca sola quan falta el secret

**Resum:** si el Worker no té `TYPEBOT_SECRET` configurat, rebutja tothom; i el
secret es comprova abans del mètode i abans de llegir el cos.

Un endpoint amb secret compartit té dues maneres òbvies de tractar el cas «el
secret encara no és a la configuració», i la intuïtiva és la dolenta. Deixar
passar les peticions mentre falta el secret sembla pràctic —així es pot provar
el formulari abans d'acabar de configurar— però obre la cua a qualsevol que
trobi l'URL justament el dia que la configuració no és a lloc, i sense fer cap
soroll. Rebutjar-ho tot, en canvi, falla d'una manera que es veu de seguida: el
formulari no funciona, mires el registre i diu què falta.

L'ordre de les tres comprovacions també és a posta. El secret va primer, abans
del mètode i abans de `request.json()`: qui no el porta rep un `403` pelat que
no li diu ni què hi ha darrere ni per què l'han rebutjat, i el Worker no ha
gastat res a llegir-li el cos. El motiu real va al registre. Un cop el secret
ja és correcte, en canvi, val més dir la veritat: un mètode que no és POST rep
un `405` i no un `403`, perquè qui té el secret és el propietari configurant
el Typebot i un codi honest li estalvia mitja tarda.

La regla general que se'n treu: **quan falta la clau del pany, la porta es
tanca, no s'obre.** I el corol·lari sobre què dir a fora: **calla amb el
desconegut, sigues clar amb el que ja s'ha identificat.**

---

## El camí del formulari no té cap arxiu de recanvi

**Resum:** un error d'escriptura al camí del correu és recuperable; al camí del
formulari, la tramesa es perd.

Les dues portes d'entrada acaben a la mateixa fila de `pendents.json`, i costa
poc suposar que tenen les mateixes garanties. No les tenen. Un correu que falla
a mig camí ja és al Gmail d'arxiu: es pot tornar a processar a mà, perquè
l'original existeix. Una tramesa del formulari que falla en escriure a GitHub
no és enlloc — el Typebot no la guarda, i el Worker no té on desar-la.

Per això `respostaDelFormulari()` torna un `500` explícit en comptes
d'empassar-se l'error amb un `200`: almenys el Typebot pot dir a la persona que
alguna cosa ha anat malament, i el registre del Worker en guarda el detall tres
dies. Un `200` mentider deixaria l'associació convençuda que ha enviat l'acte.

No es construeix cap arxiu de recanvi per a aquest camí: seria un segon lloc on
desar coses, i el projecte no en vol (`CLAUDE.md` §3). El que sí que cal és
recordar l'asimetria el dia que es dubti d'una tramesa perduda: al camí del
correu, busca-la al Gmail; al camí del formulari, no hi és i s'ha de tornar a
omplir el formulari.

---

## Dues vies de desplegament actives alhora es trepitgen en silenci

**Resum:** amb el Worker connectat a Git, qualsevol empenta a `main` que toqui
`worker/*` desplega sola i esborra sense avisar qualsevol pedaç fet a mà al
tauler; l'error que en resulta sembla un bug de codi i no ho és.

Durant la Fase 3a el Worker tenia dues vies de desplegament actives al mateix
temps: el Git Build connectat (que executa `npx wrangler deploy` als
servidors de Cloudflare a cada empenta a `main`) i l'edició manual al tauler
(«Quick Edit»), feta per provar pedaços de pressa. Cada vegada que s'enganxava
una versió bona a mà, la propera construcció automàtica la substituïa en
silenci per la del repositori — i el codi commitat, amb el disseny de dos
fitxers (`worker.js` important el `postal-mime.js` vendoritzat), va acabar
tornant repetidament, en diverses empentes, un Worker sense `fetch()`
exportat. El símptoma era sempre el mateix: `Handler does not export a
fetch() function`, un missatge que apunta a un bug al codi quan en realitat
era una carrera entre dues fonts de veritat que no se sabien l'una a l'altra.

El senyal que ho va destapar: la pestanya **Deployments** mostrava
desplegaments alterns amb origen «Wrangler» i «Quick Editor», tots dos al
100 %, amb l'id de versió canviant cada pocs minuts sense cap acció manual de
Miquel pel mig.

A part, i val la pena una línia pròpia: la vista «Quick Edit» del tauler no
té cap manera visible d'afegir un segon fitxer o mòdul, així que el disseny
de dos fitxers no hi funciona mai, independentment de la carrera anterior. El
recanvi ja previst a `CLAUDE.md` §3 — un sol fitxer amb el codi de
`postal-mime.js` concatenat a dins, sense les seves línies d'`import`/
`export` — és l'únic que funciona des d'aquesta vista.

Es va desconnectar el Git Build (Worker → Settings → Build → disconnect
repository), de manera que només la via manual del tauler pugui desplegar. Un
muntatge `wrangler dev` o d'entorn de proves es va proposar com a solució de
fons — un camí per assajar canvis sense tocar mai la URL en producció — però
es deixa deliberadament fora d'abast per ara: és infraestructura nova, no una
tasca demanada. Estat final confirmat: una tramesa real des del Typebot va
tornar un `200` amb un `id` vàlid, i la fila corresponent va aparèixer a
`pendents.json`.

La regla general que se'n treu: **un Worker no pot tenir dues fonts de
veritat de desplegament actives alhora; o es desconnecta el Git Build, o es
deixa de tocar el tauler a mà, mai totes dues coses.**

Queda per investigar, si mai es torna a connectar el Git Build: per què el
codi font commitat — el disseny de dos fitxers, que hauria de funcionar sol
perquè esbuild resol l'`import` als servidors de Cloudflare — va acabar
donant, en diverses empentes, un Worker sense `fetch()` exportat. Val la pena
provar-ho de nou en aïllament (un commit que només toqui `worker/*`, sense
cap altra cosa pel mig) abans de refiar-se'n una altra vegada.

---

## L'apunt d'«ja enviat» no necessita cap lloc nou: el servei ja el guarda

**Resum:** la guarda d'idempotència del digest no és cap fitxer ni cap base de
dades, és el registre d'enviaments del mateix Brevo — i surt millor que el que
substitueix.

L'Apps Script apuntava la data del darrer digest a la Script Property
`DIGEST_DARRER_ENVIAMENT`. En passar al Worker aquella propietat desapareix, i
la reacció natural és buscar-li un recanvi: un tercer fitxer JSON al
repositori, un KV de Cloudflare, una clau en algun lloc. Totes tres opcions
trenquen el §3 de `CLAUDE.md`, i totes tres afegeixen una cosa nova que es pot
desincronitzar amb la realitat.

No calia cap. **El servei que fa la feina ja porta el registre de la feina
feta.** Cada correu del digest surt etiquetat `digest-AAAA-MM-DD-comarca`, i
abans d'enviar res el Worker es llegeix els enviaments d'avui
(`GET /v3/smtp/emails`) i en fa un conjunt de parelles «etiqueta + adreça».

El que va fer decidir no va ser estalviar-se un fitxer, sinó que la guarda que
en surt és **millor**. La propietat antiga era per DIA: marcava «enviat» abans
del bucle d'enviament, i si l'execució es moria a mig camí, el reintent del
mateix dia no reprenia — uns quants subscriptors es quedaven sense digest
aquella setmana. Era un mal menor acceptat a posta, perquè l'alternativa era
enviar-ho tot dues vegades. La guarda de Brevo és per PERSONA: no cal marcar
res per endavant, perquè l'apunt el fa l'enviament mateix, i una execució morta
a mig camí es reprèn sense repetir ningú.

Això no és un detall d'elegància: és el que fa possible el digest sencer.
El pla gratuït de Cloudflare només deixa **50 subpeticions per execució**, i
cada correu n'és una — o sigui que una sola despertada no pot enviar més de
quaranta correus. Amb una guarda per dia, això seria un sostre dur. Amb una
guarda per persona, el cron pot despertar el Worker sis vegades dins l'hora i
cada despertada continua per on va quedar l'anterior. El límit deixa de ser un
sostre i passa a ser un ritme.

La contrapartida, i s'ha triat a posta: si el registre de Brevo **no es pot
llegir**, no s'envia res. Sense saber a qui s'ha enviat ja, val més un digest de
menys que dos digests a tothom.

La regla general que se'n treu: **abans d'inventar un lloc on desar estat,
mira si el servei que fa la feina ja el desa.** Un apunt derivat del fet real
no es pot desincronitzar del fet real.

---

## El cron de Cloudflare és en UTC: la solució és dues hores i un porter

**Resum:** per garantir les 15.00 de París tot l'any amb un cron que només sap
UTC, es desperta el Worker durant les dues hores candidates i es deixa que ell
miri el rellotge.

Les 15.00 de París són les 13.00 UTC a l'estiu i les 14.00 UTC a l'hivern, i no
hi ha cap expressió cron que digui això. Les dues sortides òbvies són dolentes:
acceptar que a l'hivern surti a les 14.00 locals trenca el que la Fase 3b
promet, i posar dos activadors (`0 13 * * 2` i `0 14 * * 2`) fa que la meitat
de l'any el digest surti **dues** vegades.

El que funciona és partir la decisió en dos: el cron fa d'alarma i el codi fa de
porter. Una sola expressió, `*/10 13,14 * * 2`, desperta el Worker dotze cops
cada dimarts; `horaDeParis()` mira quina hora és de debò a París
(`Intl.DateTimeFormat` amb `timeZone: 'Europe/Paris'` ho resol sol, canvis
d'horari inclosos) i les sis despertades de l'hora dolenta se'n tornen a dormir
sense fer cap crida.

Dos detalls que costen una tarda si no se saben:

- El pla gratuït deixa **5 activadors cron per COMPTE**, no per Worker. Per això
  n'hi ha d'haver un de sol: `*/10 13,14 * * 2` és una única entrada encara que
  dispari dotze vegades. Escriure-ho com a dos activadors gastaria dues de les
  cinc places per no res.
- `hour: '2-digit'` amb `hourCycle: 'h23'`, i no `hour12: false`: amb `hour12`
  hi ha motors que retornen «24» a mitjanit en comptes de «00», i la comparació
  amb el número de l'hora fallaria un cop al dia sense que ningú ho veiés.

La regla general que se'n treu: **quan el programador de tasques no sap prou,
no l'obliguis a saber-ho; desperta't més sovint i decideix tu.**

---

## El fitxer que es desplega no és el fitxer que s'edita

**Resum:** amb el desplegament manual, el que va al tauler és
`worker/worker-concatenat.js`, generat; la font de veritat continua sent
`worker/worker.js`, i `wrangler.jsonc` no el llegeix absolutament ningú.

Les fases 3a i 3b es van desplegar el **29 d'agost de 2026** enganxant el codi
al tauler de Cloudflare, que des de la desconnexió del Git Build és l'única via
(vegeu la nota de més amunt sobre les dues vies actives alhora). Això obliga a
un fitxer únic, perquè la vista Quick Edit no sap què fer amb dos mòduls:
`worker-concatenat.js` són les 4.950 primeres línies de `postal-mime.js` —fora
el seu `export default`— més `worker.js` sense la línia de l'`import`. 6.962
línies en total, i **cap `import`**; l'únic `export` que hi queda és el punt
d'entrada del Worker.

El parany no és muntar-lo, que és mecànic: és **recordar que és generat**. Un
pedaç fet directament al fitxer concatenat es perd la propera vegada que es
torni a generar, i no deixa cap rastre a `worker.js`. La regla, doncs: es toca
`worker.js`, es torna a generar el concatenat, i s'enganxa sencer. Mai al revés.

La segona meitat de la lliçó és més traïdora, perquè no falla en desplegar sinó
setmanes després. **`wrangler.jsonc` només el llegeix el camí «Connect to Git».**
Amb desplegament manual, tot el que hi ha declarat és decoració:

- `CLOUDINARY_CLOUD_NAME` s'ha de posar com a variable de text **al tauler**, o
  arriba `undefined` i el primer correu amb cartell entra sense imatge, sense
  cap error que ho relacioni.
- L'activador cron `*/10 13,14 * * 2` s'ha d'afegir **al tauler** (Settings →
  Trigger Events → Cron Triggers), o el digest de dimarts no es desperta mai i
  no hi ha res que ho digui: un cron que no existeix no deixa cap registre.

Fixa't que és exactament la trampa de la nota «al camí de Git, les variables de
text del tauler no sobreviuen», però girada del revés. Abans el perill era posar
la configuració al tauler; ara el perill és posar-la al fitxer. La constant que
no canvia: **la configuració ha de viure allà on la llegeix la via de
desplegament que fas servir de debò** — i quan la via canvia, la configuració
s'ha de moure amb ella.

---

## Publicar no sap distingir «ja no hi era» de «ja l'he publicat»

**Resum:** `publica()` s'empassava en silenci l'error de la fila que ja no és a
la cua, i `events.json` no mirava mai si l'`id` ja hi era: dues absències que se
sumaven i deixaven publicar el mateix acte dues vegades sense cap avís.

**Estat: resolt el 29 d'agost de 2026** (pedaços a
`docs/DIFF-CURADOR-PEDACOS.md`). La lliçó es guarda igualment, perquè el que la
va causar es pot repetir a qualsevol altra escriptura del projecte.

Trobat auditant `curador.html` el 29 d'agost de 2026 (mapa complet a
`docs/AUDITORIA-CURADOR.md`). La nota de més amunt sobre l'ordre de les dues
escriptures diu que una fallada intermèdia ha de **duplicar visiblement**, no
esborrar. L'ordre és correcte, però la visibilitat s'ha perdut pel camí: quan la
segona escriptura falla perquè la fila ja no és a la cua, `publica()` ho tracta
com un èxit i escriu «Publicat: …». El comentari del codi explica per què —evitar
un fals error quan la fila ja no hi és— i té raó en un sol dels dos casos
possibles. «Ja no hi era» pot voler dir «l'he tret jo mateix al reintent», que és
benigne, o «algú altre l'ha publicada o rebutjada», que no ho és gens: el segon
curador afegeix **la seva versió** a `events.json` i se'n va convençut que tot ha
anat bé. Un acte que un curador havia rebutjat pot acabar publicat pel mateix
camí, i l'únic rastre és l'historial de commits.

El mateix forat no necessita cap segon curador per obrir-se. Mentre l'escriptura
vola, la fitxa s'apaga a mitja opacitat però els botons continuen actius: dos
clics a Publica amb una connexió lenta fan exactament el mateix, perquè
`events.concat([editat])` no comprova mai si aquell `id` ja hi és.

Val la pena veure que són tres absències petites i cap error: l'estat «ocupada»
no bloqueja, la comprovació de duplicats no existeix, i l'error que ho hauria
destapat s'empassa. Cadascuna sola seria innòcua.

La regla general que se'n treu: **una operació que no és atòmica ha de saber
reconèixer la seva pròpia feina.** Si no pot dir «això ja ho he fet jo» —per
`id`, per marca, pel que sigui—, el silenci davant d'un conflicte no és
tolerància, és pèrdua de dades disfressada d'èxit.

**Com s'ha tancat.** Dos pedaços petits, sense tocar l'esquema ni el patró
SHA/reintent. El primer lliga el bloqueig dels dos botons de la fitxa a la
mateixa bandera `ocupada` que ja l'apagava, dins d'`avisaFitxa()`: apagada i
bloquejada passen a ser la mateixa cosa, i cap acció futura no es pot descuidar
la meitat. El segon posa `idJaPublicat()` **dins de la funció de transformació**
que rep `desaAmbReintent`, no abans de cridar-la — així la comprovació es fa
sobre la llista que s'escriurà i, sobretot, **el reintent la torna a fer**: si
l'altre curador publica l'acte enmig del conflicte de SHA, el segon intent el
veu i no escriu res. Llançar des de la transformació surt del bucle sense fer
cap `PUT`, que és el mecanisme que `treuDeLaCua()` ja feia servir.

Un detall que no és evident i que val per a qualsevol comprovació d'identitat en
aquest projecte: **un `id` buit no identifica ningú.** `creaId()` torna `''` per
a qualsevol acte sense data d'inici, i n'hi ha a la cua; comparar per `id` sense
excloure la cadena buida hauria bloquejat el segon acte sense data que algú
volgués publicar, amb un missatge que hauria semblat un error del codi.

El que els pedaços **no** poden atrapar, i que val més saber que descobrir: dos
curadors que editin la data o el títol de maneres diferents generen dos `id`
diferents, i llavors són dos actes diferents als ulls del codi. Contra això no
hi ha comprovació possible sense inventar una identitat que l'esquema de 16
camps no té.

---

## Recarregar la cua esborra la feina que encara no s'ha desat

**Resum:** a `curador.html` l'única manera de desar una correcció és Publica; el
botó de recarregar i l'activació del testimoni repinten des del fitxer i buiden
en silenci tot el que hi hagués escrit.

**Estat: resolt el 29 d'agost de 2026**, amb un avís de confirmació (pedaç 3,
§5 de `docs/DIFF-CURADOR-PEDACOS.md`). De les dues sortides possibles —avisar
abans de destruir, o conservar les edicions a través del repintat— es va triar
la primera **a posta**: la segona hauria volgut dir tornar a omplir cada camp
després de repintar, o sigui estat nou a la pàgina, més coses que es poden
desincronitzar amb el fitxer, i justament la complexitat que el §2 de
`CLAUDE.md` demana no afegir mentre no calgui. Amb l'avís, la feina es perd
igual si el curador diu que sí; la diferència és que ho decideix ell.

També de l'auditoria del 29 d'agost de 2026. `carregaCua()` fa
`llista.innerHTML = ''` sense preguntar res, i `activaTestimoni()` la crida
—necessàriament, perquè és el que treu el `disabled` dels camps. La seqüència que
ho fa saltar és justament la natural: s'obre la pàgina, es llegeix la cua, es
comença a completar la traducció francesa que el Typebot ha deixat buida, i
llavors es va a buscar el testimoni. En enganxar-lo, tota la feina desapareix
sense un sol missatge.

És un forat d'interfície, no de dades, però costa el mateix temps real que un de
dades. I la causa de fons val per a qualsevol pàgina d'aquest projecte: **un
formulari sense botó de desar només té estat mentre ningú no el repinta**, i
qualsevol camí que repinti s'ha de tractar com una acció destructiva.

La regla general que se'n treu: **si una acció pot llençar feina de l'usuari, ha
de preguntar o ha de desar; no pot no fer cap de les dues coses.**

**Com s'ha tancat, i la lliçó que hi havia a sota.** El senyal de «hi ha feina
sense desar» **no viu enlloc nou**: és un atribut `data-editada` a la mateixa
fitxa, i el comptador és `document.querySelectorAll('[data-editada]').length`.
Això no és estalviar una variable per estalviar-la. Un comptador a part
s'hauria d'haver reiniciat a mà a cada camí de sortida —publicar, rebutjar,
recarregar, activar el testimoni— i el dia que se n'oblidés un, la pàgina
avisaria de feina que ja no existeix o, pitjor, callaria sobre feina que sí.
Amb la marca a l'element, `fitxa.remove()` i `llista.innerHTML = ''` se
l'emporten soles: **el reinici no s'ha d'escriure enlloc perquè ja és una
conseqüència del que la pàgina ja feia.** És la mateixa regla que la guarda del
digest de Brevo, vista des d'una altra banda.

Dos detalls que costen una tarda si no se saben:

- **Els desplegables no sempre disparen `input`.** Els camps de text sí, i
  l'escoltador que ja hi havia només escoltava això. Canviar només la comarca i
  recarregar hauria perdut el canvi sense dir res — exactament el forat, per una
  altra porta. Ara `apuntaEdicio()` es registra per `input` **i** per `change`.
- **La guarda no pot anar dins de `carregaCua()`.** Aquella funció també la
  criden `inicia()` en obrir la pàgina, quan no hi ha res a perdre, i
  `activaTestimoni()`, que ja pregunta pel seu compte. Posar-la a dins hauria
  fet preguntar dues vegades i, sobretot, hauria preguntat en arrencar. La
  guarda va a les **portes** —el botó de recarregar i l'activació del
  testimoni—, no al que hi ha darrere.

I un efecte que val la pena saber perquè evita creure que el pedaç no funciona:
en mode de només lectura els camps són `disabled`, no hi pot haver cap edició, i
per tant **activar el testimoni per primera vegada no pregunta mai res**. La
pregunta només surt quan hi ha feina de debò a perdre.

---

## La clau forta de la deduplicació no funciona sense la taula de noms de poble

**Resum:** «municipi + data_inici» sembla una clau que es compara sola, i no ho
és: sense una taula de municipis amb dos noms no lliga mai res entre fonts, i
els títols en llengües diferents no es poden comparar de cap manera.

`eines/dedup-esdeveniments.js` (29 d'agost de 2026) parteix de la clau forta
«municipi normalitzat + data d'inici». La normalització òbvia —minúscules, fora
accents, fora guions i espais— resol la meitat dels casos sola: «Céret» i
«Ceret» hi cauen igual. Però no en resol cap dels que importen de debò. Una
associació escriu «Prats de Molló» i un flux d'oficina de turisme escriu
«PRATS-DE-MOLLO-LA-PRESTE»: mateix poble, i cap comparació de text no ho
endevina. Igual amb Perpinyà/Perpignan, Illa/Ille-sur-Têt, Prada/Prades. Sense
la taula de parells, la clau forta és una ficció que sempre diu «actes
diferents» i deixa passar tots els duplicats justament entre fonts distintes,
que és l'únic lloc on n'hi ha.

La segona meitat és més subtil i va a l'inrevés. Els títols només es comparen
**dins d'una sola llengua**. «Fira del bestiar» i «Foire au bétail» no
comparteixen ni una paraula: el Jaccard diria 0 i el codi separaria dues files
que són el mateix acte. I a l'inrevés, dos títols en llengües diferents que
comparteixin un nom propi donarien una similitud que és sort, no prova. Per
això, quan les llengües no coincideixen —o quan la font no diu en quina llengua
escriu—, la decisió no és «diferents» sinó **dubtós**: cap al curador amb les
dues files visibles.

D'aquí surt la forma de l'entrada de la funció, que si no semblaria estranya:
no rep dues files de setze camps, rep dues **candidates**
`{ fila, font: { tipus, llengua } }`. Ni la procedència ni la llengua del títol
són camps de l'esquema, i no s'hi han d'afegir: són informació sobre **d'on ve**
la fila, no sobre l'acte. Qui la crida ja les sap totes dues.

La regla general que se'n treu: **una clau de comparació no val el que diu la
seva definició, val el que diuen les dades reals que hi entren.** Abans de
confiar en una clau, mira com escriu la mateixa cosa cada font que la
alimentarà.

**Cua d'aquesta nota, del mateix dia:** la taula va arribar a existir **dues
vegades** —a `dedup-esdeveniments.js` i a `mapeja-recerca.js`— perquè el
projecte no té cap sistema de mòduls i tot es copia, com `creaId` i
`valorPermes`. Ha durat una tarda: ara viu un sol cop a
**`eines/pobles-alies.js`** i els dos fitxers la importen amb `require()`.

Val la pena saber per què aquí sí que s'ha unificat i amb `creaId` no. `creaId`
són vuit línies que no canvien mai; la taula de pobles és una llista que
**creix cada vegada que una font nova escriu un poble d'una manera nova**, i
per tant és exactament el que no pot viure copiat: el dia que se n'afegís un a
un fitxer i no a l'altre, els dos dirien coses diferents del mateix municipi
sense que res fallés. **El que es copia ha de ser el que no creix.**

La taula unificada té TOTS els parells, també els que només canvien d'accent
(Ceret/Céret), que al dedup no li calen —cauen igual en normalitzar i es mapegen
a ells mateixos, sense fer nosa. Un sol origen de veritat val més que cada
fitxer tingui només el que fa servir.

El preu, que s'ha pagat a posta: `require()` és Node pur i no demana cap eina
(§3), però el tauler de Cloudflare no sap què fer amb dos mòduls. El dia que
alguna d'aquestes peces hagi d'anar dins del Worker, la taula s'hi haurà
d'enganxar a dins, com ja es fa amb `postal-mime`. L'avís és a la capçalera de
`pobles-alies.js`.

---

## El full de càlcul ja no és enlloc del sistema viu

**Resum:** des del 29 d'agost de 2026, cap peça del sistema no llegeix ni escriu
el full de Google; però el codi que sí que ho feia encara pot estar despertant-se
sol dins del compte de Google, i això no es veu des del repositori.

El tall de cinta (Fase 4) va treure el full del camí. Val la pena escriure
exactament què vol dir això, perquè «ja no s'usa» és massa vague per confiar-hi
d'aquí a sis mesos:

- **Cap lectura.** El digest llegeix `events.json` per l'API de GitHub; el
  curador llegeix `pendents.json` pel mateix camí. Cap dels dos sap què és un
  full de càlcul.
- **Cap escriptura.** Les dues portes d'entrada —`email()` i `fetch()`— escriuen
  a `pendents.json` i prou.
- **Cap activador.** No hi ha res al repositori que executi res a Google. La
  clau de Gemini i el Gmail d'arxiu són l'única cosa de Google que queda al camí
  viu, i cap de les dues és el full.
- **El codi que el manejava és a `docs/arxiu-google/`**, mort, amb un README que
  diu què feia cada fitxer i qui ho fa ara.

**El que això NO vol dir, i és la part que enganya:** que el sistema antic estigui
aturat. El repositori i el compte de Google són dos llocs diferents, i arxivar el
codi aquí **no toca els activadors d'allà**. Mentre `sendWeeklyDigest` continuï
instal·lat al projecte d'Apps Script, cada dimarts sortiran **dos** digests: el
del Worker i el seu. I `processNewEmails` continuarà escrivint files a un full
que ja no mira ningú, consumint quota de Gemini per no res.

Desactivar-los és feina manual dins l'editor de Google i **no es pot fer ni
comprovar des del repositori** — per això és a la Fase 4 de `FASES.md` com a
pendent explícit, no com a cosa feta.

La regla general que se'n treu: **arxivar el codi d'un sistema no l'atura.**
Quan retiris alguna cosa que s'executa sola en un lloc que no controles des del
repositori, la feina no és treure el codi: és apagar el que el desperta — i fins
que no ho hagis fet, el sistema vell segueix viu encara que el repositori digui
que no.

---

## Una funció de parells no fa una funció de lot

**Resum:** ajuntar `mapejaAProduccio()` i `comparaEsdeveniments()` en un sol lot
no va ser cablejar-les: van sortir tres decisions que cap de les dues no podia
prendre, i dues es veien només amb el lot davant.

`eines/processa-lot.js` (29 d'agost de 2026) no afegeix cap llindar ni cap
comparació nova: crida les dues peces que ja hi havia. Tot i així, tres coses no
tenien resposta enlloc, i totes tres les va decidir el propietari:

- **La cadena.** A i B són el mateix acte, i la fila fusionada AB encara ho és
  amb C, però A i C tots sols no lliguen. Comprovat amb el lot de prova: 1↔2 =
  0,67 «mateix», 2↔3 = 0,60 «mateix», 1↔3 = 0,40 «dubtós». La sortida triada és
  la **fusió acumulativa**: es fusiona la primera parella, la fila resultant es
  queda el descriptor de font de la guanyadora i es torna a comparar amb la
  resta. Els tres candidats acaben en una sola fila; sense això en farien dues.
- **El solapament.** Les tres llistes són exclusives: una fila que surti en una
  parella dubtosa no va mai a `llestos`, ni que vingui d'una fusió ferma.
- **La clau incompleta.** I aquesta és la que costaria una tarda de trobar:
  `comparaEsdeveniments()` torna «dubtós» sempre que falta la data d'inici o el
  municipi, cosa que entre dues files és correcta i **dins d'un lot és una
  bomba** — una sola fila sense data faria parella dubtosa amb totes les altres
  (amb cent files, noranta-nou) i, amb llistes exclusives, deixaria `llestos`
  buida. Per això una fila sense clau forta no es compara amb ningú: va directa
  a `llestos` amb l'avís que el mapeig ja li ha posat a `nota_curador`.

Hi ha una quarta cosa que sí que es podia deduir i que val la pena saber perquè
sembla un detall: **la llengua del títol de la fila no és `llengua_nom_original`**.
Quan l'original és francès i la recerca porta `nom_altra_llengua`, el que es
publica és la versió catalana. Passar la llengua d'origen al dedup faria comparar
un títol català dient que és francès —i el dedup, que no compara mai entre
llengües, separaria files que són la mateixa. `llenguaDelTitol()` refà la tria del
mapeig en el mateix ordre, i quan no ho pot saber torna `''`, que el dedup ja
tracta com a «no comparable».

I un preu pagat a posta: perquè un fitxer en pugui cridar dos, `mapeja-recerca.js`
i `dedup-esdeveniments.js` ara tenen un `module.exports` al final. És `require()`
de Node pur, sense cap eina (§3), com `pobles-alies.js`; el dia que alguna
d'aquestes peces hagi d'anar dins del Worker, s'hi enganxarà a dins igualment.

La regla general que se'n treu: **una decisió que és evident amb dos elements
davant pot ser insostenible amb cent.** Abans de cridar en bucle una funció
pensada per a un cas, mira què fa la seva branca menys probable multiplicada per
la mida del lot.

---

## La vora de sota d'una finestra de dates no és la data d'inici

**Resum:** «descarta el que ja ha passat» sembla que vulgui dir «`data_inici` és
anterior a avui», i sobre les dades reals això llençaria una de cada cinc files
mentre encara són obertes.

El filtre previ (`eines/filtra-candidats.js`, 29 d'agost de 2026) havia de
descartar el que cau fora d'una finestra de dotze mesos. Abans d'escriure la
comparació es va comptar sobre les **103 files reals** del CSV de recerca, amb
l'avui del 29 d'agost: **20 (el 19 %) tenen `data_inici` passada i `data_fi`
futura.** Són el mercat setmanal de Prada (2026-01-01 → 2026-12-31), les
exposicions de museu de mig any, els festivals llargs. Amb la vora de sota
mirant `data_inici`, cap d'aquelles vint no arribaria mai a la cua —i el motiu
del descart diria «fora de finestra», que sona correcte i és fals.

Per això les dues vores miren dates diferents, i no és cap asimetria gratuïta:

- **per sota**, l'últim dia de l'acte (`data_fi` si en porta, si no
  `data_inici`): un acte és passat només quan s'ha acabat;
- **per dalt**, `data_inici`: el que decideix si és massa lluny és quan comença.

Passat pel CSV sencer, el filtre deixa passar les 103 files i no en descarta
cap: era material ja triat a mà, i és el resultat que hi ha de sortir.

La regla general que se'n treu: **abans d'escriure una comparació de dates,
compta quantes files reals hi cauen a cada banda.** Una vora mal posada no dona
cap error: dona un recompte més petit, que sembla que el filtre treballi bé.

Una nota de límit, del mateix dia: **la llista negra d'aquell filtre no és
criteri editorial.** Hi entren agències immobiliàries, ofertes de feina i
lloguer vacacional —coses que no són cap acte—, i no hi entra res que demani
judici (un tren turístic, una visita de pagament, una assemblea d'associació):
això és del curador, o del classificador que encara no existeix, i allà la
resposta serà sempre un suggeriment. El dubte mateix és el senyal: **si t'has de
pensar si una paraula hi va, no hi va.**

---

## `nota_curador` s'atura a la cua: no arriba mai a `events.json`

**Resum:** el camp 17è es mostra al curador i es perd en publicar, i això està
decidit — qui vegi que `recullFitxa()` en torna només 16 no ha trobat cap error.

**Decidit el 29 d'agost de 2026**, el mateix dia que l'avís es va començar a
pintar a `curador.html`. `nota_curador` viu a `pendents.json`, surt a la fitxa
com una franja groga no editable, i s'acaba allà: `recullFitxa()` construeix els
16 camps canònics exactes i la nota no hi entra.

El perquè és d'on va a parar cada fitxer, no de l'esquema. `pendents.json` és
una cua de treball; `events.json` és l'arxiu **públic**, i el web el descarrega
sencer al navegador de qualsevol. Una nota que diu «el municipi no consta a la
taula» o «el títol està per traduir» és una instrucció interna per a qui revisa,
i publicada no informa ningú: només ensenya les costures. Perdre-la no costa res
perquè no es perd de debò — cada versió de `pendents.json` és un commit, i
l'historial de git guarda la nota de qualsevol fila que hagi passat per la cua.

La forma que pren al codi és igual d'important: l'avís **no porta `data-camp`**.
No és que es filtri després, és que `recullFitxa()` no el pot veure, perquè
recull per aquell atribut. Un camp que no s'ha d'editar i que no ha de viatjar
no ha d'existir com a entrada.

La regla general que se'n treu: **un camp de servei no travessa la frontera del
públic només perquè és a l'esquema.** Abans de propagar un camp a un fitxer nou,
pregunta qui llegirà aquell fitxer, no quins camps hi ha al costat.

---

## Quan una API redirigeix, la metadata que val és la del destí

**Resum:** vam donar el flux de l'ADT66 per inservible perquè vam llegir la
metadata del porter en comptes de la del flux; hi faltaven tretze camps, entre
ells la data de l'acte.

L'`api-v3.tourinsoft.com` respon 302 i diu, a la capçalera `Location`, on és la
sindicació de debò (`wcf.tourinsoft.com`). La seva `/metadata` declara
vint-i-dos camps i la vam llegir com si fos el sostre del que la font conté. No
ho era: descrivia **el que aquell endreç exposa**. La mateixa sindicació, el
mateix GUID, llegida pel destí de la redirecció, en dona **trenta-cinc**, amb
les dates de l'acte, la descripció, el municipi, la categoria i el cartell.

La comprovació que ho hauria estalviat tot dura un minut:

```
GET https://wcf.tourinsoft.com/Syndication/3.0/{client}/{GUID}/$metadata
```

El cost de l'error no va ser el temps perdut, sinó la conclusió: el handoff
deia que calia escriure a l'ADT66 per demanar una sindicació més completa. Una
petició per correu a un tercer, amb l'espera que porta, per una cosa que ja
teníem.

I el senyal hi era, en el contingut mateix: una sindicació d'objectes «Fêtes et
manifestations» **sense cap data d'acte** no té sentit. Cap oficina de turisme
no publica una agenda sense dates. Quan una font no porta el camp que és la
raó de ser d'aquella font, la hipòtesi primera no és que la font sigui pobra:
és que no la mirem per on toca.

La regla general que se'n treu: **abans de concloure que a una font li falta
una dada, comprova que estàs mirant la font i no un intermediari.** Segueix les
redireccions fins al final i demana la metadata d'allà. I si el que falta és
justament el camp sense el qual la font no tindria sentit, sospita de tu abans
que de la font.

De propina, el destí també acceptava `$filter` d'OData, que el porter no
oferia: una sincronització que eren tres peticions i una comparació local ara
és **un sol GET** ja filtrat.

---

## Mesura la distribució abans de triar el llindar, i desconfia d'un sol indicador

**Resum:** per distingir un acte continu d'un de periòdic, el salt entre dates
semblava l'indicador evident; hi ha tallers amb salts d'un i dos dies que duren
set mesos, o sigui que l'indicador era compatible amb allò mateix que havia de
detectar.

El camp `TRI` de l'ADT66 dona totes les dates d'una oferta. Amb la primera i
l'última com a `data_inici` i `data_fi`, un mercat setmanal es publica com un
acte continu de dos anys. La primera idea per arreglar-ho va ser un llindar
sobre el salt màxim entre dates consecutives: si les dates van seguides, és
continu; si hi ha forats grans, és periòdic.

La mesura sobre les 1 543 ofertes va ensenyar dues coses que la idea no
preveia. La primera és que la distribució té una vall poblada —45 ofertes amb
salts de 3 a 6 dies— i que aquella vall no és soroll sinó **patrons regulars**:
`3,4,3,4` és dos cops per setmana, `1,1,1,1,3` és de dilluns a divendres. No hi
ha cap valor del llindar que les parteixi bé.

La segona és pitjor i és la que compta: `ATELIER DE MODELAGE EN INDIVIDUEL` té
192 dates, **salt màxim 2** i **223 dies d'abast**. Obert cada dia menys
diumenge, de maig a desembre. Cap salt sospitós i set mesos de mentida. El
llindar del salt, a qualsevol valor, el deixa passar.

La regla bona en necessita dues, de condicions: salt petit **i** abast curt. I
un cop mesurat, es va veure que el segon límit no és delicat —els abasts del
grup de salt petit van d'1 a 27 dies i després salten a 223, o sigui que
qualsevol xifra entre 28 i 222 dona el mateix—, cosa que només se sap havent
mirat la distribució.

La regla general que se'n treu: **abans de fixar un llindar, dibuixa la
distribució i busca un contraexemple on l'indicador i el problema convisquin.**
Si l'indicador pot ser baix mentre el problema és gros, no és l'indicador: en
falta un altre al costat. I un llindar triat sobre dades mesurades ve amb una
propina —saber si és sensible o no— que un llindar triat a ull no té.

---

## Una funció que torna una còpia trenca tot índex que vagi per referència

**Resum:** `classificaEditorial()` torna una fila NOVA, i el `Map` de
metadadades de `processaLot()` va per referència d'objecte: qui fa el canvi ha
de reindexar-lo o la procedència es queda penjada de la fila vella.

`processaLot()` guarda la procedència de cada fila en un `Map` amb **la fila
mateixa com a clau** —l'objecte, no cap còpia ni cap `id`— i és a posta: així no
hi ha manera que la metadada acabi dins dels disset camps. La contrapartida no
es veu fins que algú substitueix una fila.

`classificaEditorial()` no toca mai la fila que li donen; en torna una de nova
amb la nota afegida, cosa que també és a posta. Encadenar les dues coses sense
pensar-hi deixa el `Map` indexat per files que ja no surten enlloc: cada fila
del resultat sense metadada, i cada metadada penjada d'una fila morta. Res no
peta —un `Map` no es queixa— i el rastre de «cap candidat perdut pel camí» falla
molt més avall, on ja no s'entén.

La solució és de tres línies (`get`, `delete`, `set` a cada substitució), però
només se't fa evident si te'n recordes. La regla general: **quan connectis una
funció que torna còpies a una estructura indexada per referència, la
reindexació forma part de la connexió**, no és un extra. I val la pena que la
bateria ho comprovi explícitament, perquè és exactament la mena d'error que no
llança res.

---

## Sense classificador connectat, no es classifica: no és el mateix que classificar sense classificador

**Resum:** `processaLot()` sense `cridaGemini` no crida `classificaEditorial()`
en absolut, perquè cridar-la sense funció escriuria una nota a cada fila.

`classificaEditorial()` està feta perquè el silenci no enganyi: si no hi ha
classificador, escriu «Sense classificar: no hi ha cap classificador connectat»
a `nota_curador`. Vist des de la peça sola, és correcte —una fila sense línia de
classificació sembla una fila que ha passat el criteri.

Vist des del cablejat, no ho és. Un lot processat sense connectar-hi res ha de
sortir **idèntic** al que sortia abans que el pas existís, nota per nota: si no,
qualsevol codi vell que cridi `processaLot()` es troba amb files que diuen una
cosa que ningú no ha demanat. Per això la guarda («si no hi ha funció, torna
sense fer res») és al cablejat i no dins de la peça: la peça respon per la fila
que li donen, el cablejat respon pel lot sencer.

La regla general: **una peça i el seu cablejat no tenen per què tenir el mateix
comportament per defecte.** Si te'ls trobes en desacord, mira quin dels dos té
raó per al seu abast abans de canviar-ne cap.

---

## Un avís que surt sempre no és un avís: la verificació calla quan tot va bé

**Resum:** `verificaEsdeveniment()` no escriu res quan el veredicte és `ok`,
mentre que `classificaEditorial()` escriu sempre; les dues tenen raó.

La classificació respon «a quin calaix va això?»: tota fila en té resposta, i el
silenci hi és ambigu —una fila sense línia de classificació tant pot ser NUCLI
com una fila que ningú no ha mirat. Per això allà fins i tot el fracàs escriu.

La verificació respon «hi ha res que no quadri?»: és un detector d'excepcions.
Si escrivís a cada fila, `curador.html` pintaria el requadre groc a totes les
fitxes, i un avís que hi surt sempre és un avís que ningú no llegeix. El groc ha
de voler dir «atura't i mira això».

El perill del silenci —no distingir «verificat i net» de «no verificat mai»— es
limita fent que el silenci sigui **només** per a `ok`: el dubte, el sospitós, el
verificador que peta, el que no hi és, la resposta que no s'entén i el candidat
sense referència a l'origen escriuen tots nota. Així l'única fila muda que la
peça produeix és una fila contrastada i neta.

La regla general: **decideix si una peça informa o alerta abans d'escriure-la.**
Una peça que informa ha de parlar sempre; una que alerta ha de callar quan no
passa res, i llavors la feina és garantir que tots els fracassos parlin.

---

## El camp ple que sí que s'ha de tocar: «ja hi ha imatge» no vol dir «ja és nostra»

**Resum:** `pujaCartell()` no decideix per si `imatge_url` és buit, sinó per on
apunta, perquè el cartell de recerca arriba justament dins d'aquell camp.

L'encàrrec deia «si `fila.imatge_url` ja té contingut, no facis res» —pensant en
el Typebot, que puja el cartell des del navegador del remitent i porta l'URL
fet. Però `mapejaAProduccio()` aboca `url_cartell` del CSV de recerca a
`imatge_url` tal qual, i no el deixa enlloc més. Aplicada a la lletra, la regla
hauria fet una peça que no s'activa mai.

La distinció de debò no és «ple o buit», és **de qui és la imatge**: un URL de
`cloudinary.com` ja és una còpia nostra (Typebot, Worker o una passada
anterior); qualsevol altre domini és un cartell de tercers que no es pot
enllaçar des de GitHub Pages ni tenim llicència per reutilitzar. Mirant el
domini, el cas del Typebot queda protegit igual, i per la raó de fons.

La regla general: **quan una guarda et sembli que buida la peça de feina,
pregunta't quina propietat volies protegir de debò.** «Camp ple» era un
substitut de «la imatge ja és nostra», i el substitut no valia per a la meitat
dels casos.

---

## Quan un document es contradiu sobre una font, mana la línia que porta un número

**Resum:** el handoff de l'ADT66 deia dues coses incompatibles sobre `font_url`;
la certa era la de la taula de cobertura, i el senyal per saber-ho era que
aquella portava un recompte al costat i l'altra era una frase de prosa.

Un apartat deia «`font_url` apunta a la fitxa de l'ADT66, que porta el calendari
sencer» i el feia servir per justificar una pèrdua de dades: les ofertes
periòdiques es publiquen amb un sol dia, i tant se val perquè el lector té
l'enllaç al calendari complet. Un altre apartat, la taula de cobertura, deia
`font_url` ← `DETAILSITEWEB`, 623/1 543.

La segona era la bona. `DETAILSITEWEB` és el **web de l'organitzador** —151
dominis diferents al flux, cap de l'ADT66— i hi és a **606 de 1 504** ofertes;
les altres 898 el porten a `null`. O sigui que el consol que justificava la
pèrdua no existia: per a 898 files no hi ha ni enllaç, i per a les 606 que en
tenen l'enllaç va a un web que pot dir els dies o no.

La diferència entre les dues línies no era d'autoritat sinó de **procedència**:
la de la taula venia de comptar camps sobre el flux sencer, la de la prosa venia
de raonar sobre com hauria d'anar. Cap de les dues ho deia de si mateixa, però
el recompte al costat ho delata.

De propina, la comprovació va tancar una segona pregunta que s'arrossegava: el
web públic de l'ADT66 construeix les seves fitxes amb un número del seu CMS
(`id_sheet`) que **no és al flux**, o sigui que del `SyndicObjectID` no se'n pot
deduir cap adreça llegible. Existeix, això sí, `…/Objects('{ID}')?$format=json`
al WCF, que dona 200 si l'oferta hi és i 404 si s'ha retirat: com a sonda va bé,
com a `font_url` per a un lector no, perquè serveix JSON cru.

La regla general: **quan dues línies del mateix document es contradiuen, no
triïs per to ni per quina és més recent — mira quina es pot tornar a mesurar i
mesura-la.** I una frase que justifica una pèrdua de dades amb una compensació
és exactament on val la pena comprovar que la compensació existeix.

---

## Un camp que sempre queda buit no és una limitació de la font: mira si algun altre camp el determina

*31 d'agost de 2026.*

`eines/mapeja-adt66.js` deixava `comarca` a `""` a **totes** les files del canal
de l'ADT66 i hi afegia un avís al curador a cada una. El comentari de la funció
ho explicava bé i el raonament semblava tancat: cap dels 35 camps del flux no
porta la comarca, perquè no és una divisió que l'administració francesa faci
servir; inventar-la seria fer política editorial des del codi; queda buida i el
curador la posa a mà.

Tot això era cert menys la conclusió. El flux **sí** que porta el municipi
(`Commune`, ple a totes les ofertes), i **el municipi determina la comarca del
tot**: no és cap suposició ni cap heurística, és una correspondència tancada de
226 pobles. El camp que faltava no era irrecuperable, només era indirecte.

La confusió, quan es mira de prop, és entre dues coses molt diferents:

- **una dada que la font no té** — l'hora d'un acte que no la diu, el web d'un
  organitzador que no en té: aquí no hi ha res a fer i `""` és la resposta bona;
- **una dada que la font no escriu però que un altre camp seu fixa** — aquí `""`
  no és honestedat, és feina no feta.

El cost de confondre-les no era petit: `comarca` és el camp amb què filtra el
web públic i amb què el digest tria la llista de Brevo. 1 453 files sense
comarca són 1 453 files que no surten a cap filtre i que no entren a cap digest,
i 1 453 avisos idèntics al curador —que és la manera més segura que un avís
deixi de llegir-se.

Amb `eines/comarca-per-poble.js` fet, el mateix flux va passar de **0 a 1 443
files amb comarca de 1 453**. Les 10 que quedaven eren els 6 pobles de la
Fenolleda sobre els quals el criteri editorial encara no s'havia pronunciat; el
mateix 31 d'agost s'hi va pronunciar —tota la Fenolleda va a Rosselló, §«La
Fenolleda» de `docs/CRITERI-EDITORIAL.md`— i ara són **1 453 de 1 453**.

De propina, allò va ensenyar una segona cosa: **quan una decisió es dona amb
exemples, val més escriure si són exemples o si són la llista.** «Sant Pau de
Fenollet i Bellestar van a Rosselló» es va aplicar com si fossin els dos únics
pobles afectats, i eren només els dos que hi havia a la vista aquell dia; la
regla era «la Fenolleda». Sis pobles van esperar una decisió que de fet ja
estava presa. Ara el §«La Fenolleda» ho diu amb aquestes paraules, per no
tornar-hi.

La regla general: **davant d'un camp que surt sempre buit, no et quedis amb «la
font no el porta» — pregunta si algun camp que la font sí que porta el
determina.** I si un avís al curador surt al 100 % de les files, no és un avís:
és un camp mal omplert que s'ha disfressat d'advertència.

---

## Un URL de font no és un URL: pot ser una miniatura que s'ha de desfer abans de copiar-la

*31 d'agost de 2026 — `eines/puja-cartell.js`, `eines/cartells-a-cloudinary.js`.*

El flux de l'ADT66 serveix el cartell dins d'un `<img src="…?width=150&height=120">`.
`mapejaOfertaADT66()` copia l'`src` tal com ve, i fa bé: el mapeig no ha de
decidir res sobre imatges. Però això vol dir que l'URL que arriba al pujador
**no apunta al cartell, apunta a un retall de 150 px**, i pujar-lo a Cloudinary
hauria deixat una còpia permanent de 4 kB d'una cosa que en fa 756. Comprovat
amb `curl` sobre les 17 adreces d'ADT66 de la cua: sense paràmetres surt
l'original, sempre molt més gros; en un cas, 16 MB.

La correcció viu a `variantsDeCartell()`, a `eines/puja-cartell.js` —que és on
la pregunta oberta 5 del §5 de `docs/HANDOFF-ADT66.md` ja deia que s'havia de
resoldre, i no al mapeig.

Dues coses que aquell mateix `curl` va ensenyar i que no s'haurien endevinat:

- **Una de les 17 dona 404 sense paràmetres i 200 amb ells.** L'original s'ha
  esborrat i el retall sobreviu a la memòria cau. Per això no es *substitueix*
  l'URL: es proven les dues, l'original primer. Val més una imatge petita que
  cap.
- **Retallar els paràmetres a cegues hauria estat pitjor que no fer res.** Els
  cartells de la mairie de Perpinyà porten `?itok=…` de Drupal i sense ell
  tornen 404. Per això la neteja es fa **només** per al domini de l'ADT66,
  comprovat amb `dominiCoincideix()`, i mai per heurística sobre el text.

La regla general: **abans de normalitzar un URL de tercers, comprova què hi ha
a les dues bandes de la normalització.** Un paràmetre a la query pot ser
decoració, pot ser el que fa petita la imatge, o pot ser l'única cosa que la fa
existir — i les tres coses conviuen dins d'una mateixa cua.

I una segona, sobre la incrementalitat: **no calia cap comptador.**
`pujaCartell()` ja calla davant d'un `imatge_url` que apunta a `cloudinary.com`,
o sigui que la segona passada sobre `pendents.json` no gasta ni una petició.
Comprovat: dues passades seguides deixen el fitxer amb el mateix md5. La
incrementalitat de debò —no tornar a mapejar les 1 453 ofertes— ja la fa
`sincronitzaADT66()`, que només baixa les que han canviat. Són dues xarxes
diferents i totes dues fan falta: la guarda no protegeix una fila que s'acabi
de tornar a mapejar de zero, perquè aquella torna a portar l'URL en brut.

## Una etiqueta de camp i una frase que hi sembla s'escriuen igual: la diferència és on són

*31 d'agost de 2026. En crear `eines/neteja-text.js`.*

El flux de l'ADT66 enganxa una etiqueta de formulari francesa al davant de cada
camp —«Descriptif de la manifestation :», «Lieu :», «Type :», «Catégorie :»,
«Thème :», «Entrée gratuite :» i «Contacter»—, i la temptació és treure-les amb
un patró genèric: una paraula en majúscula, dos punts, fora. **Aquest patró
destrueix contingut.** Al mateix flux hi ha descripcions escrites per
organitzadors que diuen, dins del text, «Tarif : 5€ les 2 m», «Plein tarif :
5,00€», «Horaires : de 9h à 18h». Són exactament la mateixa forma i són
informació que el curador vol.

El que separa les dues coses no és la forma, és **la posició i la llista**: una
etiqueta de camp la posa la font sempre al començament del camp, i és sempre
una de set. Per això `netejaTextFont()` només en treu les set, i només a
principi de línia. Comptar-les abans va ser el que va permetre tancar la
llista: 1 442, 1 396, 1 326, 1 262, 817, 287 i 229 aparicions sobre 1 453
ofertes. El que surt tres cops no és una etiqueta, és una frase.

I una segona, sobre l'estat del sistema quan es va escriure: la neteja **ja
existia** per al camí de l'ADT66 (`textDeCamp()` i `textDeHtml()` a
`eines/mapeja-adt66.js`) i per al camí de correu (`textDeHtml()` al Worker). El
forat era l'altre: `eines/mapeja-recerca.js` no neteja res, i és **aquest** el
mapeig que fa servir `processaLot()`, que és qui crida la classificació i la
verificació. Per això `netejaTextFont()` es crida des dels **constructors de
prompt** i no des d'un mapeig: així queda net el que entra al model vingui la
fila d'on vingui, sense dependre de per quin mapeig hi ha passat.

---

## L'enum de categoria viu a CATORZE llocs, no a quatre

**Resum:** afegir un valor a l'enum sense tocar-los tots no dona cap error:
`valorPermes()` el buida en silenci.

`CLAUDE.md` va dir durant mesos «no en canviïs mai cap sense tocar els quatre
llocs alhora». La xifra era falsa i va costar un defecte de debò. Quan es va
afegir `Concentració`, es va posar només al filtre i a les icones d'`app.js` —
dos llocs — i durant dies va quedar **una fila publicada a `events.json` amb
una categoria que `curador.html` i `worker/worker.js` no reconeixien**. Si
algú hagués obert aquella fila al curador i l'hagués desada, `recullFitxa()`
la passa per `valorPermes(editat.categoria, CATEGORIA_VALUES)` i la categoria
se n'hauria anat a `""`. Sense missatge, sense registre, sense res.

**Per què és tan fàcil que passi:** el projecte no té cap sistema de mòduls, o
sigui que cada punt d'entrada porta la seva còpia de la llista, i n'hi ha
catorze en nou fitxers (la llista completa és al §4 bis de `CLAUDE.md`). El
compilador no en pot comparar cap parell, perquè no hi ha compilador.

La regla que se'n treu: **quan una constant es copia a mà a més de dos llocs,
el document que la defineix ha de portar la llista dels llocs, no el
recompte.** Un número envelleix sol i ningú no se n'adona; una llista de
camins es pot comprovar amb un `grep` en deu segons.

---

## `aura` no es pot posar en cap llista de paraules clau franceses

**Resum:** és el futur del verb `avoir`, i surt a mig flux de l'ADT66.

El senyal de nova era de `eines/mapeja-adt66.js` mira si el títol o la
descripció porten vocabulari de guia espiritual. `aura` semblava una entrada
òbvia de la llista forta —l'aura, el camp energètic— i marcava **27 ofertes de
45**: un cicle de jazz, quatre vernissatges, un vide-grenier, un ball folk.
Tot fals. La raó és que en francès «la fête **aura** lieu» és la manera normal
de dir que una festa se farà.

**La comprovació de paraula sencera no en salva.** `teParaulaSencera()` ja
mira que no hi hagi cap lletra enganxada —justament perquè `aura` no salti dins
de «restaurant»— i tot i així el senyal era fals, perquè la paraula hi era de
debò, com a verb. El filtre resol l'homografia parcial; no pot resoldre
l'homografia sencera.

La regla: **abans d'afegir un terme curt a una llista de patrons, comprova que
no sigui també una paraula corrent de la llengua del text.** Amb la llista
sense `aura`, el senyal baixa a 13 ofertes i totes tenen sentit.

---

## `DETAILFETEPAYANTE` no és un camp de preu, tot i el nom

**Resum:** és un booleà «entrada gratuïta sí/no»; el flux de l'ADT66 no porta
cap import enlloc.

El nom promet un preu i no n'hi ha cap. El que porta és
`<strong><br />Entrée gratuite :</strong> oui` o `non` — 637 i 634 ofertes de
les 1 463, i 192 sense la dada. Res més. Cap dels 35 camps del flux no diu
quant costa res.

Té conseqüència pràctica: el senyal «activitat esportiva de pagament elevat»
no es pot construir sobre aquest camp. `eines/mapeja-adt66.js` el treu de
l'únic lloc on hi ha imports de debò, que és **el text de la descripció**
(«Inscription 40 euros»), amb un llindar de 25 € que és un número triat i no
mesurat. Amb això, salta a 3 ofertes de les 1 463.

La regla: **no et fiïs del nom d'un camp d'una font externa; mira'n els valors
abans de construir-hi res a sobre.**

---

## `eines/` no és una carpeta de proves: hi ha guions que escriuen

**Resum:** `for f in eines/*.js; do node "$f"; done` reescriu `pendents.json`.

Gairebé tots els fitxers d'`eines/` porten una bateria d'autoproves al final i
no toquen res quan se'ls executa. **`eines/cartells-a-cloudinary.js` no:** sense
`--prova`, llegeix la cua, la passa pel pujador de debò i **torna a escriure
`pendents.json`**. Executar la carpeta sencera per veure si les proves passen
li dispara una passada de producció.

Aquell dia no va fer cap mal —les 84 files ja tenien el cartell a Cloudinary,
o sigui que la reescriptura va sortir byte a byte idèntica i el recompte de
«cartells forans» era 0—, però la sort no és cap garantia.

La regla: **per exercitar les proves, executa els fitxers un per un, o passa
`--prova` a qualsevol guió que sàpiga escriure.** I si algun dia es vol
executar la carpeta sencera de cop, el que cal canviar és el guió: que no
escrigui res si no li ho demanes amb una bandera, en lloc d'escriure si no li
demanes que no ho faci.
