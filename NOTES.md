# NOTES.md — lliçons apreses

*Una lliçó per entrada, amb un resum d'una línia. El perquè hi és sempre: si
una nota no diu per què, d'aquí sis mesos no serveix de res. Les notes que
resultin errònies s'esborren, no es maten a comentaris.*

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
