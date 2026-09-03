# Fase 3a — El Worker: el gestor `fetch()` (formulari Typebot)

Com connectar el formulari Typebot al Worker i com verificar-ho. És el **mateix
Worker i el mateix fitxer** de la Fase 2 (`worker/worker.js`): no se'n crea cap
de nou, no hi ha cap URL nova per desplegar. Només s'hi afegeixen un gestor
(`fetch()`) i un Secret (`TYPEBOT_SECRET`).

Prerequisit: la **Fase 2** ha de ser desplegada i verificada (vegeu
`docs/pas-fase2-worker-email.md`).

Aquí no hi ha cap crida a Gemini, i és a posta: el formulari ja demana cada camp
per separat, i el cartell ja puja del navegador a Cloudinary dins el flux del
Typebot. Al Worker només hi arriba un JSON amb els camps fets, i el que fa és un
mapa determinista camp a camp cap a l'esquema de 16 cadenes.

## Per què hi ha un secret

**L'URL del Worker és pública.** Qui la trobi pot fer-li un POST des de
qualsevol lloc del món, i sense cap comprovació cada POST seria una fila nova a
la cua del curador. El secret compartit és l'única cosa que separa «una tramesa
del formulari» de «un POST de qualsevol».

El Worker el comprova **abans de mirar res més** — abans del mètode, abans de
llegir el cos. Qui no el porta rep un `403` pelat que no diu res: ni què hi ha
darrere, ni per què l'han rebutjat. El motiu real va al registre del Worker, que
és on el mires tu.

I si el Secret **no està configurat**, el Worker rebutja **tothom**. Sembla
exagerat i és el contrari: l'altra opció —acceptar-ho tot mentre falti el
secret— obriria la cua justament el dia que la configuració no és a lloc.

## 1. El secret

Tria un valor llarg i aleatori (30–40 caràcters, lletres i xifres). Pots
generar-ne un amb el PowerShell:

```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 36 | ForEach-Object { [char]$_ })
```

Copia'l: l'hauràs d'enganxar **dos cops** (al Cloudflare i al Typebot) i després
ja no el podràs tornar a llegir enlloc.

**Al Cloudflare:** Worker `agenda-catalogne-nord` → **Settings** → **Variables
and Secrets** → **Add** → tipus **Secret**:

| Nom | Valor |
|---|---|
| `TYPEBOT_SECRET` | El valor que acabes de generar |

Recorda el detall de la Fase 2: **un Secret nou no és viu fins que desplegues.**
La pantalla acaba amb un botó **Deploy**. Si el registre diu que falta el Secret
que jures haver posat, mira primer si aquella versió s'ha desplegat.

## 2. L'URL del Worker

Worker → **Settings** → **Domains & Routes**. És l'adreça `workers.dev`:

```
https://agenda-catalogne-nord.<el-teu-subdomini>.workers.dev/
```

Aquesta és la mateixa adreça per sempre: el gestor `email()` no la fa servir
(l'Email Routing crida el Worker pel nom), i el gestor `fetch()` no en necessita
cap altra. Cap ruta, cap camí: el Worker respon a l'arrel i prou.

## 3. El bloc webhook del Typebot

Al final del flux del formulari, el bloc **Webhook / HTTP request**:

1. **Mètode:** `POST`. (Qualsevol altre mètode rep `405`.)
2. **URL:** l'adreça `workers.dev` del punt 2.
3. **Headers / Capçaleres** — afegeix-ne dues:

| Clau | Valor |
|---|---|
| `Content-Type` | `application/json` |
| `X-Typebot-Secret` | el valor de `TYPEBOT_SECRET` |

4. **Body / Cos:** tipus **JSON**. Les claus de l'esquerra són fixes (les llegeix
   el Worker); els `{{...}}` de la dreta són les variables del formulari:

```json
{
  "titol": "{{titol}}",
  "data_inici": "{{data_inici}}",
  "data_fi": "{{data_fi}}",
  "hora": "{{hora}}",
  "lloc": "{{lloc}}",
  "municipi": "{{municipi}}",
  "comarca": "{{comarca}}",
  "categoria": "{{categoria}}",
  "idioma_descripcio": "{{idioma_descripcio}}",
  "descripcio": "{{descripcio}}",
  "associacio": "{{associacio}}",
  "imatge_url": "{{imatge_url}}"
}
```

És **exactament el mateix cos** que enviava a l'Apps Script: el Worker llegeix
les mateixes dotze claus. L'únic que canvia és l'URL i la capçalera del secret.

> **No treguis `idioma_descripcio` del cos.** És el que decideix si la descripció
> va a `descripcio_ca` o a `descripcio_fr`. Si falta, tot cau a `descripcio_ca`.

> `imatge_url` el desa el pas de càrrega del cartell
> (`docs/pas-5-typebot-cartell-cloudinary.md`): arriba com un URL de Cloudinary
> fet, o com a cadena buida. El Worker el desa tal qual.

> No cal enviar `id`, `estat`, `data_entrada` ni `font_url`: els omple sempre el
> Worker. Si els envies, els ignora — l'`id` el reconstrueix ell mateix i
> l'`estat` és sempre `pendent`.

## 4. Verificar la Fase 3a (la porta)

Els dos primers punts es fan des del PowerShell, abans de tocar el Typebot.
Substitueix l'URL i el secret pels teus.

**(1) Sense secret → ha de dir `403`, i la cua no ha de canviar.** Fes-ho
primer: és la prova que importa.

```powershell
curl.exe -i -X POST "https://agenda-catalogne-nord.XXX.workers.dev/" -H "Content-Type: application/json" --data '{"titol":"Prova sense secret","data_inici":"2026-12-01"}'
```

Esperat: `HTTP/2 403` i el cos `{"ok":false,"error":"no autoritzat"}`. Obre el
repositori al GitHub i comprova que **`pendents.json` no té cap commit nou**: el
Worker rebutja abans de llegir el cos, o sigui que no escriu res.

**(2) Amb el secret → ha de dir `200` i deixar la fila a la cua.**

```powershell
curl.exe -i -X POST "https://agenda-catalogne-nord.XXX.workers.dev/" -H "Content-Type: application/json" -H "X-Typebot-Secret: EL-TEU-SECRET" --data '{"titol":"Prova amb secret","data_inici":"2026-12-01","comarca":"Vallespir","categoria":"Musica","idioma_descripcio":"ca","descripcio":"Una prova."}'
```

Esperat: `HTTP/2 200` i el cos `{"ok":true,"id":"2026-12-01-prova-amb-secret"}`.
Al GitHub hi ha d'haver un commit nou, **«Fila nova a la cua (formulari): Prova
amb secret»**, i la fila ha de ser **al davant** de `pendents.json`, amb
`estat: "pendent"`, `data_entrada` d'ara i `categoria: ""` (perquè «Musica»
sense accent no és a la llista permesa: el Worker no s'inventa el valor).

Obre `curador.html`, comprova que la fila hi surt, i rebutja-la per netejar la
cua.

**(3) Una tramesa real del formulari publicat.** Obre el Typebot pel seu enllaç
públic, omple un esdeveniment de principi a fi amb cartell, i comprova que arriba
a la cua amb l'`imatge_url` de Cloudinary omplert. (El botó **Test the request**
del Typebot serveix mentre configures, però la prova de la porta és aquesta.)

## Què respon el Worker

| Codi | Quan | Escriu a la cua? |
|---|---|---|
| `200` | Tot bé | Sí, una fila |
| `403` | Falta el secret, no coincideix, o el Worker no té `TYPEBOT_SECRET` configurat | No |
| `405` | El secret és bo però el mètode no és POST | No |
| `400` | El cos no és un objecte JSON, o la tramesa no porta ni títol ni data | No |
| `500` | No s'ha pogut escriure a `pendents.json` (token, xarxa, GitHub) | No |

Un `500` vol dir que la tramesa **s'ha perdut**: aquí no hi ha cap arxiu de
recanvi com el Gmail del camí del correu. Si passa, el registre del Worker en
té el detall i la persona hauria de tornar a omplir el formulari. És la raó per
la qual el camí del correu, que no es pot refer, arxiva primer.

## Si alguna cosa falla

**Tot rep `403`, també amb el secret bo.** Mira el registre del Worker (Worker →
**Logs**). Si diu *«falta el Secret TYPEBOT_SECRET»*, el Secret no és a la versió
desplegada: torna al punt 1 i desplega. Si diu *«no coincideix»*, hi ha una
diferència de valor — sovint un espai enganxat al final en copiar.

**El Typebot rep `403` però amb el `curl` funciona.** El nom de la capçalera al
bloc webhook s'ha escrit malament. Ha de ser `X-Typebot-Secret` (les majúscules
no importen, el nom sí).

**Rep `400` amb «cal com a mínim un títol o una data».** El cos ha arribat amb
les variables buides: al Typebot, el bloc webhook s'executa abans que el
formulari les hagi desat, o els noms dels `{{...}}` no coincideixen amb les
variables reals.

**Rep `500`.** El registre du el codi de GitHub. Si és `401` o `404`, el
`GITHUB_TOKEN` ha caducat o li falta el permís `Contents: Read and write`
(és el mateix Secret que fa servir el camí del correu: si un falla, l'altre
també).

## El que aquesta fase NO fa

- **Cap límit de repetició.** Amb el secret a la mà (o amb un bucle de reintents
  del Typebot), N POST són N files. Encara no cal: el secret és la porta i el
  curador veu tot el que entra. Si algun dia inunda, el lloc de posar-hi el fre
  és `respostaDelFormulari()`.
- **Cap comprovació que `imatge_url` sigui de Cloudinary.** Arriba d'un pas del
  Typebot que ja només pot tornar això, i l'esquema diu de desar-lo tal qual
  (`CLAUDE.md` §7). El curador veu la imatge abans de publicar.
- **Cap deduplicació.** Dues trameses del mateix acte són dues files, i les
  fusiona el curador.
