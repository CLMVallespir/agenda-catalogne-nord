# DIFF-CURADOR-PEDACOS.md — els pedaços de `curador.html`

*29 d'agost de 2026. Tres pedaços petits contra els forats 1, 2, 3 i 4 de
`docs/AUDITORIA-CURADOR.md`. Un sol fitxer tocat: **`curador.html`**
(+140 −7 en total). Cap canvi a l'esquema, al disseny, ni al patró SHA/reintent
contra l'API de GitHub. No cal desplegar res: `curador.html` es publica sol per
GitHub Pages.*

*Els pedaços 1 i 2 (duplicació d'actes) són a les seccions 1–3; el pedaç 3
(edicions perdudes en repintar) és a la secció 5.*

---

## 1. Resum dels canvis

### Pedaç 1 — els botons de la fila es bloquegen al primer clic

| Peça | Línies | Què fa |
|---|---|---|
| `bloquejaAccions(fitxa, bloquejada)` — **nova** | +12 | posa `disabled` als dos botons **d'aquella fitxa** (`fitxa.querySelectorAll('.accions .boto')`), mai als de la resta |
| `avisaFitxa()` | +1 línia de codi, +3 de comentari | crida `bloquejaAccions(fitxa, ocupada === true)` just després del `classList.toggle('ocupada', …)` |

El bloqueig penja de l'estat `ocupada` que ja existia, i per això no calen crides
noves ni a `publica()` ni a `rebutja()`: totes dues ja marquen la fitxa com a
ocupada abans del primer `await` i la desmarquen a cada `catch`. Lligar les dues
coses a la mateixa bandera és deliberat — **una fitxa apagada que encara es pugui
clicar no pot tornar a existir per descuit**.

`rebutja()` no s'ha tocat gens: hereta el bloqueig sencer.

### Pedaç 2 — no es publica un `id` que ja hi és

| Peça | Línies | Què fa |
|---|---|---|
| `JA_PUBLICAT` — **constant nova** | +4 | `'Aquest acte ja estava publicat, no s’ha duplicat.'`, el començament del text de l'error; l'`id` s'hi enganxa al final |
| `idJaPublicat(events, id)` — **nova** | +15 | recorre la llista d'actes publicats; un `id` buit (acte sense data) torna `false`, perquè no identifica ningú |
| Transformació d'`events.json` dins `publica()` | +5 | si l'`id` ja hi és, **llança abans del `PUT`**; si no, `concat` com sempre |
| `catch` de la primera escriptura | +8 | distingeix «l'id ja hi era» (avís neutre, la fila es queda a la cua) de «l'escriptura ha fallat» (avís vermell, com abans) |
| Branca `JA_NO_HI_ES` de la segona escriptura | +9 | ja no s'empassa en silenci: activa `laCuaHaCanviat` i el missatge final ho diu amb l'`id` exacte |

**On va la comprovació, i per què.** Dins de la funció de transformació que rep
`desaAmbReintent`, no abans de cridar-la. Dues raons: la comprovació es fa sobre
la llista *acabada de llegir* —la mateixa que s'escriurà— i el **reintent la torna
a fer**, o sigui que si un altre escriptor publica l'acte enmig del conflicte de
SHA, el segon intent el detecta i no escriu res. Llançar des de la transformació
surt del bucle de `desaAmbReintent` sense fer cap `PUT`: és el mateix mecanisme
que ja feia servir `treuDeLaCua()`.

**Què veu el curador en cada cas:**

| Cas | Escriptura | Fitxa | Avís |
|---|---|---|---|
| Camí normal | 2 `PUT` | desapareix | `Publicat: <títol>` (negre) |
| L'`id` ja és a `events.json` | **cap `PUT`** | **es queda a la cua**, botons reactivats | `Aquest acte ja estava publicat, no s’ha duplicat. Identificador: <id>. Rebutja la fila si sobra.` (neutre) |
| La fila ja no és a la cua | 1 `PUT` (l'acte es publica) | desapareix | `Publicat: <títol> (<id>). La fila ja no era a la cua: algú altre l’ha tret mentre es publicava. Torna a carregar la cua.` (neutre) |
| GitHub rebutja l'escriptura | cap `PUT` reeixit | es queda, botons reactivats | `No s’ha publicat. …` (vermell) — sense canvis |
| Publicat a mitges | 1 `PUT` | es queda | `Publicat a events.json, però no l’he pogut treure de la cua…` (vermell) — sense canvis |

El to dels dos avisos nous és neutre (`mena` buida, la caixa grisa), no negre:
el negre és el de `Publicat: …` i confondre'ls seria pitjor que no dir res.

**El que el pedaç 2 NO pot atrapar:** dos curadors que editin la data o el títol
de maneres diferents generen dos `id` diferents, i llavors són dos actes
diferents als ulls del codi. Contra això no hi ha comprovació possible sense
inventar una identitat que l'esquema no té.

---

## 2. Proves executades

Banc de proves fora del repositori (al directori temporal de la sessió): el bloc
`<script>` de `curador.html` extret tal qual, amb un `document`, una `fitxa` i una
API de GitHub falsos. Cap crida de xarxa real, cap escriptura al repositori.

```
node --check <script de curador.html>   →  SINTAXI OK

A — l’id no és a events.json (camí normal)
  OK     dos PUT (events + pendents)
  OK     la fitxa s’ha esborrat
  OK     avís global «Publicat: …»

B — l’id ja és a events.json (pedaç 2)
  OK     cap PUT
  OK     la fitxa es queda a la cua
  OK     l’avís diu que ja estava publicat
  OK     l’avís porta l’id exacte (2026-09-14-ball-de-prats)
  OK     els botons tornen a estar actius

C — la fila ja no és a pendents.json (JA_NO_HI_ES)
  OK     només el PUT d’events.json
  OK     l’avís no és mut i ho diu
  OK     l’avís porta l’id exacte

D — els botons es bloquegen abans del primer await (pedaç 1)
  OK     tots dos botons desactivats a l’instant, sense esperar res
  OK     un sol PUT a events.json

E — GitHub rebutja l’escriptura: els botons es reactiven
  OK     els botons tornen a estar actius per reintentar
  OK     la fitxa es queda a la cua
```

15 comprovacions, 15 correctes. **Cap prova contra el GitHub real:** això queda
per a la propera sessió de curació de debò, que és quan es veurà si el text dels
avisos s'entén sense haver llegit aquest document.

---

## 3. El diff

```diff
diff --git a/curador.html b/curador.html
@@ -782,6 +782,29 @@ function trobaIndex(cua, original) {
 // literalment a publica(), que és l'únic cas on això no és greu.
 var JA_NO_HI_ES = 'La fila ja no era a la cua.';
 
+// El començament del text de l'error quan l'id que es vol publicar ja
+// és a events.json. Porta l'id enganxat al final, i publica() el
+// reconeix per aquest començament.
+var JA_PUBLICAT = 'Aquest acte ja estava publicat, no s’ha duplicat.';
+
+// ------------------------------------------------------------
+// Diu si un identificador ja és a la llista d'actes publicats. Un id
+// buit (un acte sense data d'inici) no compta: no identifica ningú, i
+// tots els actes sense data el compartirien.
+// ------------------------------------------------------------
+function idJaPublicat(events, id) {
+  if (id === '') {
+    return false;
+  }
+
+  for (var i = 0; i < events.length; i++) {
+    if (events[i].id === id) {
+      return true;
+    }
+  }
+  return false;
+}
+
 // ------------------------------------------------------------
 // Torna una transformació que treu una fila de la cua. Si la fila ja
 // no hi és, peta: val més aturar-se que dir que s'ha fet una cosa que
@@ -799,7 +822,9 @@ function treuDeLaCua(original) {
 
 // ------------------------------------------------------------
 // Escriu un missatge dins d'una fitxa concreta i, si cal, la deixa
-// mig apagada mentre s'hi treballa.
+// mig apagada i amb els botons bloquejats mentre s'hi treballa. Les
+// dues coses van sempre juntes a posta: una fitxa apagada que encara
+// es pogués clicar és exactament el forat que això tanca.
 // ------------------------------------------------------------
 function avisaFitxa(fitxa, text, mena, ocupada) {
   var avis = fitxa.querySelector('[data-avis-fitxa]');
@@ -810,6 +835,22 @@ function avisaFitxa(fitxa, text, mena, ocupada) {
     avis.classList.add(mena);
   }
   fitxa.classList.toggle('ocupada', ocupada === true);
+  bloquejaAccions(fitxa, ocupada === true);
+}
+
+// ------------------------------------------------------------
+// Bloqueja (o desbloqueja) els dos botons d'una fitxa. Es crida abans
+// de qualsevol await, perquè un segon clic no pugui engegar una
+// segona escriptura mentre la primera encara vola.
+//
+// Desbloquejar sempre és segur: aquí només s'hi arriba des de
+// publica() i rebutja(), que surten abans si no hi ha testimoni.
+// ------------------------------------------------------------
+function bloquejaAccions(fitxa, bloquejada) {
+  var botons = fitxa.querySelectorAll('.accions .boto');
+  for (var i = 0; i < botons.length; i++) {
+    botons[i].disabled = bloquejada;
+  }
 }
 
 // ------------------------------------------------------------
@@ -820,6 +861,10 @@ function avisaFitxa(fitxa, text, mena, ocupada) {
 // manera de fer-les alhora: si primer s'esborrés de la cua i després
 // fallés events.json, l'acte es perdria. Fent-ho al revés, una
 // fallada deixa un duplicat visible a la cua, que és recuperable.
+//
+// Cap de les dues escriptures no és cega: la primera no afegeix un id
+// que ja hi sigui, i la segona diu en veu alta si la fila ja no era a
+// la cua. Publicar dues vegades el mateix acte ha de deixar rastre.
 // ------------------------------------------------------------
 async function publica(fitxa, original) {
   if (!potEscriure()) {
@@ -833,10 +878,25 @@ async function publica(fitxa, original) {
 
   try {
     await desaAmbReintent(FITXER_EVENTS, function (events) {
+      // La comprovació va aquí dins, sobre la llista acabada de llegir:
+      // així el reintent la torna a fer sobre el fitxer fresc, i no
+      // s'escriu res si algú altre l'ha publicat mentrestant.
+      if (idJaPublicat(events, editat.id)) {
+        throw new Error(JA_PUBLICAT + ' Identificador: ' + editat.id + '.');
+      }
       return events.concat([editat]);
     }, 'Publica ' + editat.titol);
   } catch (error) {
-    // Encara no s'ha tocat la cua: l'acte segueix pendent i es pot reintentar.
+    // No s'ha escrit res i la fila segueix a la cua, tant si l'id ja hi
+    // era com si l'escriptura ha fallat. El que canvia és què cal fer-hi.
+    if (error.message.indexOf(JA_PUBLICAT) === 0) {
+      // La fila es queda a la cua perquè el curador decideixi: rebutjar-la,
+      // o canviar-li la data o el títol si de debò és un acte diferent que
+      // ha topat amb el mateix id.
+      avisaFitxa(fitxa, error.message + ' Rebutja la fila si sobra.', '', false);
+      mostraAvis(error.message, '');
+      return;
+    }
     avisaFitxa(fitxa, 'No s’ha publicat. ' + error.message, 'error', false);
     mostraAvis('La publicació ha fallat. L’acte segueix a la cua.', 'error');
     return;
@@ -844,6 +904,8 @@ async function publica(fitxa, original) {
 
   // A partir d'aquí l'acte JA és a events.json. Si el que ve falla, el
   // que queda és un duplicat a la cua, i cal dir-ho tal com és.
+  var laCuaHaCanviat = false;
+
   try {
     await desaAmbReintent(FITXER_PENDENTS, treuDeLaCua(original),
       'Treu de la cua ' + editat.titol);
@@ -854,7 +916,10 @@ async function publica(fitxa, original) {
       mostraAvis('Publicat a mitges: mira el missatge de la fitxa.', 'error');
       return;
     }
-    // Algú altre ja l'havia tret de la cua. Publicat igualment.
+    // Algú altre l'ha tret de la cua mentre es publicava. L'acte s'ha
+    // publicat igualment, però això no es pot dir en silenci: la cua ha
+    // canviat sota els peus i val més que el curador ho sàpiga.
+    laCuaHaCanviat = true;
   }
 
   fitxa.remove();
@@ -862,6 +927,13 @@ async function publica(fitxa, original) {
     return JSON.stringify(fila) !== JSON.stringify(original);
   });
   actualitzaRecompte();
+
+  if (laCuaHaCanviat) {
+    mostraAvis('Publicat: ' + editat.titol + ' (' + editat.id + '). La fila ja no era ' +
+      'a la cua: algú altre l’ha tret mentre es publicava. Torna a carregar la cua.', '');
+    return;
+  }
+
   mostraAvis('Publicat: ' + editat.titol, 'fet');
 }
```

---

## 4. Estat dels forats de l'auditoria després dels pedaços

| # | Forat | Estat |
|---|---|---|
| 1 | `JA_NO_HI_ES` empassat a `publica()` | **resolt** — avís explícit amb l'`id` |
| 2 | Els botons no es desactiven mentre l'escriptura vola | **resolt** — pedaç 1 |
| 3 | `events.concat` no mira si l'`id` ja hi és | **resolt** — pedaç 2 |
| 4 | Recarregar i activar el testimoni esborren les edicions | **resolt** — pedaç 3, §5 |
| 5 | El testimoni no es valida en enganxar-lo | pendent |
| 6 | Sense `Array.isArray` abans de transformar | pendent |
| 7 | `importa-csv.js` pot sobreescriure `pendents.json` | pendent (Fase 4) |
| 8 | El filtre de `CUA` treu totes les files idèntiques | pendent (cosmètic) |
| 9 | `cache: 'no-store'` al curador i no a la Worker | pendent (sense efecte observat) |

---

## 5. Pedaç 3 — avís abans de perdre edicions no desades

*Afegit el mateix 29 d'agost de 2026, contra el forat 4. **Avís de confirmació,
no conservació d'estat**: és la sortida més barata que dona la mateixa protecció
pràctica. `curador.html` +65 −4.*

### 5.1 On viu el senyal

**Enlloc nou.** La marca és un atribut al mateix element de la fitxa,
`data-editada`, i el comptador és una consulta al DOM:

```js
function comptaEdicionsPendents() {
  return document.querySelectorAll('[data-editada]').length;
}
```

Per què així i no amb una bandera o un comptador a part: quan una fitxa es
publica o es rebutja amb èxit, `publica()` i `rebutja()` ja fan `fitxa.remove()`
— i la marca se'n va amb l'element. **El «reinicia per aquella fila» surt de franc
i no es pot desincronitzar**, perquè no hi ha dues còpies de la veritat. És la
mateixa regla que `NOTES.md` ja aplica a la guarda del digest: abans d'inventar
un lloc on desar estat, mira si el que fa la feina ja el desa.

`carregaCua()` fa `llista.innerHTML = ''`, o sigui que després d'un repintat el
comptador torna a zero tot sol.

### 5.2 Les peces

| Peça | Línies | Què fa |
|---|---|---|
| `marcaEditada(fitxa)` — **nova** | +7 | posa `data-editada` a la fitxa; idempotent |
| `comptaEdicionsPendents()` — **nova** | +6 | quantes fitxes duen la marca |
| `potLlencarEdicions()` — **nova** | +21 | sense edicions torna `true` sense preguntar res; amb edicions, un `window.confirm()` en català amb el recompte, i torna el que digui el curador |
| `recarregaLaCua()` — **nova** | +10 | el que ara escolta el botó «Torna a carregar la cua»: guarda + `carregaCua()` |
| Escoltador de `creaFitxa()` | +6 −4 | l'anònim de l'`input` passa a ser `apuntaEdicio()`, que marca la fitxa abans de refer l'identificador, i es registra per **`input` i `change`** |
| Guarda de `activaTestimoni()` | +5 | surt abans de tocar `TESTIMONI` i abans de buidar el camp |
| `inicia()` | +1 −1 | el botó de recarregar apunta a `recarregaLaCua`, no a `carregaCua` |

**Dos esdeveniments i no un.** Els camps de text disparen `input`; els
desplegables de comarca i categoria disparen `change` i, segons el navegador, no
sempre `input`. Escoltar-los tots dos costa una línia i evita el cas que més
enganya: canviar només la comarca, recarregar, i que la pàgina no digui res.

**On NO va la guarda:** dins de `carregaCua()`. Aquella funció també la crida
`inicia()` en obrir la pàgina —quan no hi ha res a perdre— i `activaTestimoni()`
—que ja pregunta pel seu compte. Posar-la a dins hauria fet preguntar dues
vegades i, pitjor, hauria preguntat en arrencar.

### 5.3 El text de l'avís

```
Atenció: 1 fitxa té canvis sense desar.

La cua es tornarà a carregar i els perdrà. Les correccions només es desen
en publicar l’acte.

Vols continuar igualment?
```

Amb dues fitxes o més: `2 fitxes tenen canvis sense desar.` (singular i plural
amb `if`, com a `actualitzaRecompte()`, no amb un ternari). El text serveix per
als dos camins perquè activar el testimoni també acaba repintant la cua.

**El que segueix igual:** en mode de només lectura els camps són `disabled`, no
hi pot haver cap `input`, i per tant activar el testimoni per primera vegada
—el cas normal— no pregunta absolutament res. La pregunta només surt quan hi ha
feina de debò a perdre.

### 5.4 Proves executades

Mateix banc que als pedaços 1 i 2 (DOM fals, `window.confirm` fals, cap
escriptura real). `carregaCua()` se substitueix per un comptador: el que es prova
és **si es crida o no**, no què fa.

```
node --check <script de curador.html>   →  SINTAXI OK

F — marcaEditada() marca la fitxa i prou
  OK     abans no hi ha marca
  OK     després hi ha data-editada
  OK     marcar dos cops no fa cap mal

G — recarregar sense edicions pendents: directe
  OK     cap pregunta
  OK     la cua s’ha recarregat

H — recarregar amb 1 edició pendent i cancel·lar
  OK     surt la pregunta
  OK     diu quantes fitxes («1 fitxa té»)
  OK     diu que es perdran
  OK     diu com es desen
  OK     NO s’ha recarregat res

I — recarregar amb 2 edicions pendents i acceptar
  OK     surt la pregunta
  OK     el plural és correcte («2 fitxes tenen»)
  OK     la cua s’ha recarregat

J — activar el testimoni amb edicions pendents i cancel·lar
  OK     surt la pregunta
  OK     el testimoni NO ha canviat
  OK     el camp NO s’ha buidat
  OK     NO s’ha recarregat res

K — activar el testimoni sense edicions pendents
  OK     cap pregunta
  OK     el testimoni s’ha activat
  OK     el camp s’ha buidat
  OK     la cua s’ha recarregat
```

17 comprovacions noves, 17 correctes. Les 15 dels pedaços 1 i 2 s'han tornat a
passar senceres al mateix banc i segueixen correctes: **32 de 32**.

### 5.5 El diff

```diff
@@ -720,12 +720,18 @@ function creaFitxa(esdeveniment) {
   cos.appendChild(accions);
   fitxa.appendChild(cos);
 
-  // L'identificador es refà tot sol quan es toca la data o el títol.
-  fitxa.addEventListener('input', function () {
+  // Cada tecla o cada tria refà l'identificador i marca la fitxa com a
+  // editada. S'escolten els dos esdeveniments a posta: els camps de text
+  // van per 'input' i els desplegables per 'change'.
+  function apuntaEdicio() {
+    marcaEditada(fitxa);
     var editat = recullFitxa(fitxa, esdeveniment);
     identificador.textContent = 'Identificador en publicar: ' +
       creaId(editat.data_inici, editat.titol);
-  });
+  }
+
+  fitxa.addEventListener('input', apuntaEdicio);
+  fitxa.addEventListener('change', apuntaEdicio);
 
   return fitxa;
 }
@@ -853,6 +859,43 @@ function bloquejaAccions(fitxa, bloquejada) {
   }
 }
 
+// ------------------------------------------------------------
+// Marca una fitxa com a editada. La marca viu al mateix element: quan
+// la fitxa es publica o es rebutja, fitxa.remove() se l'emporta, i per
+// això no hi ha cap comptador a part que es pugui desincronitzar.
+// ------------------------------------------------------------
+function marcaEditada(fitxa) {
+  fitxa.setAttribute('data-editada', '');
+}
+
+// ------------------------------------------------------------
+// Compta les fitxes amb edicions que encara no s'han desat.
+// ------------------------------------------------------------
+function comptaEdicionsPendents() {
+  return document.querySelectorAll('[data-editada]').length;
+}
+
+// ------------------------------------------------------------
+// Demana permís abans de repintar la cua, perquè repintar-la llença
+// les edicions que no s'hagin publicat. Torna cert si es pot
+// continuar; sense edicions pendents no pregunta res.
+// ------------------------------------------------------------
+function potLlencarEdicions() {
+  var quantes = comptaEdicionsPendents();
+  if (quantes === 0) {
+    return true;
+  }
+
+  var quines = quantes + ' fitxes tenen';
+  if (quantes === 1) {
+    quines = '1 fitxa té';
+  }
+
+  return window.confirm('Atenció: ' + quines + ' canvis sense desar.\n\n' +
+    'La cua es tornarà a carregar i els perdrà. Les correccions només es ' +
+    'desen en publicar l’acte.\n\nVols continuar igualment?');
+}
+
 // ------------------------------------------------------------
 // Publica un acte: l'afegeix a events.json amb estat "publicat" i
 // després el treu de pendents.json.
@@ -1023,12 +1066,30 @@ async function carregaCua() {
   }
 }
 
+// ------------------------------------------------------------
+// Torna a carregar la cua a petició del curador, però pregunta abans
+// si hi ha edicions sense desar: el repintat se les emporta.
+// ------------------------------------------------------------
+function recarregaLaCua() {
+  if (!potLlencarEdicions()) {
+    return;
+  }
+
+  carregaCua();
+}
+
 // ------------------------------------------------------------
 // Guarda el testimoni en memòria i repinta la cua perquè els camps
 // i els botons quedin actius. No el desa enlloc: en tancar la
 // pestanya, desapareix.
 // ------------------------------------------------------------
 function activaTestimoni() {
+  // Activar o canviar el testimoni repinta la cua, i repintar llença les
+  // edicions: es demana permís abans de tocar res, també el testimoni.
+  if (!potLlencarEdicions()) {
+    return;
+  }
+
   var camp = document.getElementById('camp-testimoni');
   var valor = camp.value.trim();
 
@@ -1055,7 +1116,7 @@ function inicia() {
   mostraAvis('Només lectura: sense testimoni no es pot publicar ni rebutjar res.', '');
 
   document.getElementById('boto-testimoni').addEventListener('click', activaTestimoni);
-  document.getElementById('boto-recarrega').addEventListener('click', carregaCua);
+  document.getElementById('boto-recarrega').addEventListener('click', recarregaLaCua);
   document.getElementById('camp-testimoni').addEventListener('keydown', function (event) {
     if (event.key === 'Enter') {
       activaTestimoni();
```

### 5.6 El que el pedaç 3 no fa

No conserva res. Si el curador diu que sí, les edicions es perden igual que
abans — l'única diferència és que ho ha decidit ell. Conservar-les de debò voldria
dir tornar a omplir cada camp després del repintat, i això és estat nou a la
pàgina: més codi, més coses que es poden desincronitzar amb el fitxer, i
justament el tipus de complexitat que el §2 de `CLAUDE.md` demana no afegir
mentre no calgui.

Tampoc no avisa si es tanca la pestanya amb edicions a mitges
(`beforeunload`). És el mateix forat per una altra porta, però la porta és molt
menys freqüent i el navegador ja hi posa fricció pròpia.
