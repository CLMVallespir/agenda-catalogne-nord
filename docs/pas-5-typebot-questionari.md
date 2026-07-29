# Pas 5 — Qüestionari Typebot (formulari d'esdeveniments)

Aquest document descriu **el formulari** que les associacions ompliran per enviar un esdeveniment: l'ordre dels passos, el text bilingüe exacte i el nom de la variable que cada pregunta ha de desar. La part tècnica que **connecta** aquest formulari amb el full de càlcul (desplegar l'Apps Script, agafar l'URL, configurar el bloc *Webhook* de Typebot) està documentada a part, a `docs/pas-5-typebot-connexio.md`.

Regla de llengua del projecte: **català primer, francès a sota**, més petit i en cursiva. Cada bombolla de text de Typebot ha de portar les dues llengües, amb el català a dalt.

Les variables que recull aquest formulari són exactament les que espera la funció `processBotSubmission()` (`apps-script/processBotSubmission.gs`). Si canvies un nom de variable aquí, l'has de canviar també allà.

---

## Resum de variables

| Variable Typebot | Camp de l'esquema | Tipus de pas | Obligatori |
|---|---|---|---|
| `titol` | `titol` | Text | Sí |
| `data_inici` | `data_inici` | Data | Sí |
| `es_un_sol_dia` | (control intern) | Botons Sí/No | Sí |
| `data_fi` | `data_fi` | Data | Només si dura més d'un dia |
| `hora` | `hora` | Text (HH:MM) + validació | Sí |
| `comarca` | `comarca` | Botons (5 opcions) | Sí |
| `municipi` | `municipi` | Text | Sí |
| `lloc` | `lloc` | Text | Sí |
| `categoria` | `categoria` | Botons (10 opcions) | Sí |
| `idioma_descripcio` | (control intern) | Botons CA/FR | Sí |
| `descripcio` | `descripcio_ca` **o** `descripcio_fr` | Text llarg | Sí |
| `associacio` | `associacio` | Text | Sí |
| `imatge_url` | `imatge_url` | Càrrega Cloudinary (botó) | No |

`es_un_sol_dia` i `idioma_descripcio` només serveixen per guiar el formulari; no s'escriuen al full. El que decideix on va la descripció és `idioma_descripcio`: si val `fr`, el text va a `descripcio_fr`; en qualsevol altre cas, a `descripcio_ca`. La traducció que falti l'omple el curador durant la revisió setmanal.

El camp `imatge_url` ara **sí** que es recull al formulari: la càrrega del cartell es fa directament del navegador a Cloudinary (vegeu el Pas 13 i `docs/pas-5-typebot-cartell-cloudinary.md`). Si l'usuari no carrega cap cartell, arriba com a cadena buida `""`.

Els camps `id`, `font_url`, `estat` i `data_entrada` **no** es demanen al formulari: els omple el sistema (vegeu `processBotSubmission.gs`).

---

## Pas 0 — Avís legal (porta d'entrada)

Aquest és el **primer missatge** del formulari. L'usuari l'ha d'aprovar abans de continuar.

### Bombolla de text (avís)

> **En enviar un esdeveniment a l'agenda cultural de Catalunya Nord, l'associació organitzadora:**
>
> 1. certifica que les informacions transmeses són exactes en la data de tramesa i es compromet a notificar CLM de qualsevol modificació posterior a: info@clm.cat;
> 2. declara tenir tots els drets necessaris sobre els visuals transmesos (fotografies, cartells) i atorga a CLM una autorització no exclusiva per reproduir-los en el marc de la promoció de l'esdeveniment;
> 3. reconeix que CLM publica les informacions rebudes de bona fe i no pot ser considerada responsable de la seva exactitud o actualització.
>
> ---
>
> *En soumettant un événement à l'agenda culturel de Catalogne Nord, l'association organisatrice :*
>
> *1. certifie que les informations transmises sont exactes à la date de soumission et s'engage à notifier CLM de toute modification ultérieure à : info@clm.cat ;*
> *2. déclare détenir tous les droits nécessaires sur les visuels transmis (photographies, affiches) et accorde à CLM une autorisation non exclusive de les reproduire dans le cadre de la promotion de l'événement ;*
> *3. reconnaît que CLM publie les informations reçues de bonne foi et ne peut être tenue responsable de leur exactitude ou de leur mise à jour.*

### Botó (pas de tria)

Una sola opció:

- **Accepto les condicions · J'accepte les conditions** → continua cap al Pas 1.

---

## Pas 1 — Títol

Bombolla: pregunta el títol de l'esdeveniment.

> Com es diu l'esdeveniment? Escriu el títol tal com vols que aparegui.
>
> *Quel est le nom de l'événement ? Écrivez le titre tel que vous souhaitez qu'il apparaisse.*

Pas d'entrada: **Text** → desa a `titol`.

---

## Pas 2 — Data d'inici

> Quin dia comença? (dia/mes/any)
>
> *Quel jour commence-t-il ? (jour/mois/année)*

Pas d'entrada: **Data** → desa a `data_inici`.

> **Nota tècnica:** el bloc de data de Typebot ha de produir el format `AAAA-MM-DD` (per exemple `2026-09-14`). A la configuració del bloc de data, fixa el format de sortida a `yyyy-MM-dd`. Així el valor entra net al full, sense que Google el reinterpreti.

---

## Pas 3 — Un sol dia o diversos?

> L'esdeveniment dura un sol dia?
>
> *L'événement dure-t-il une seule journée ?*

Pas de tria (botons) → desa a `es_un_sol_dia`:

- **Sí, un sol dia · Oui, une seule journée** → salta al Pas 5 (hora). Deixa `data_fi` buit; el sistema hi posarà la mateixa data d'inici.
- **No, dura més dies · Non, plusieurs jours** → continua al Pas 4.

---

## Pas 4 — Data de fi (només si dura més d'un dia)

> I quin dia s'acaba?
>
> *Et quel jour se termine-t-il ?*

Pas d'entrada: **Data** (format `yyyy-MM-dd`) → desa a `data_fi`.

---

## Pas 5 — Hora

> A quina hora comença?
>
> *À quelle heure commence-t-il ?*

Aquest pas és **obligatori** i valida el format `HH:MM` (24 h). Si l'usuari escriu un format incorrecte, torna a la mateixa pregunta fins que el corregeixi.

**Bloc "Input" (Text):**

- Pregunta: «A quina hora comença? · *À quelle heure commence-t-il ?*»
- Configura'l com a **Required** (obligatori).
- Desa a la variable `hora`.

**Bloc "Condition":**

- Connecta el bloc d'Input directament a aquest bloc de Condition.
- Regla:
  - Variable: `hora`
  - Condició: **Does not match regex**
  - Valor: `^([01]\d|2[0-3]):([0-5]\d)$`

**Salt (Jump):**

- Si la condició es compleix (la regla *Does not match* és certa), vol dir que el format és incorrecte: connecta la sortida d'aquest *Match* de tornada al bloc de la pregunta **Hora**, per obligar l'usuari a corregir-ho.
- Si no es compleix (el format és vàlid), continua cap al Pas 6.

---

## Pas 6 — Comarca

> A quina comarca?
>
> *Dans quelle comarque ?*

Pas de tria (botons) → desa a `comarca`. Les cinc opcions, escrites **exactament** així (han de coincidir amb el desplegable del full):

- `Rosselló`
- `Conflent`
- `Vallespir`
- `Capcir`
- `Cerdanya`

> **Important:** el text del botó ha de ser exactament el valor de dalt (sense afegir-hi res), perquè el full només accepta aquests cinc valors. Si vols, pots afegir el nom francès com a etiqueta visible, però el **valor desat** a la variable ha de ser el català exacte.

---

## Pas 7 — Municipi

> A quin poble o ciutat?
>
> *Dans quel village ou ville ?*

Pas d'entrada: **Text** → desa a `municipi`.

---

## Pas 8 — Lloc

> On té lloc? (nom de l'espai: sala, església, plaça…)
>
> *Où a-t-il lieu ? (nom du lieu : salle, église, place…)*

Pas d'entrada: **Text** → desa a `lloc`.

---

## Pas 9 — Categoria

> De quin tipus d'activitat es tracta?
>
> *De quel type d'activité s'agit-il ?*

Pas de tria (botons) → desa a `categoria`. Les deu opcions, escrites **exactament** així:

- `Música`
- `Teatre`
- `Dansa i ball`
- `Conferència`
- `Exposició`
- `Mercat`
- `Cinema`
- `Taller`
- `Activitat infantil`
- `Patrimoni i tradicions`

Mateixa regla que la comarca: el valor desat ha de ser el català exacte.

---

## Pas 10 — Llengua de la descripció

> En quina llengua escriuràs la descripció? Pots fer servir la que et vagi millor; nosaltres ens encarregarem de l'altra.
>
> *Dans quelle langue allez-vous écrire la description ? Utilisez celle qui vous convient le mieux ; nous nous occuperons de l'autre.*

Pas de tria (botons) → desa a `idioma_descripcio`:

- **Català · Catalan** → desa el valor `ca`
- **Francès · Français** → desa el valor `fr`

> El valor desat ha de ser exactament `ca` o `fr` (en minúscules), perquè és el que llegeix `processBotSubmission()` per decidir on posa el text.

---

## Pas 11 — Descripció

> Explica'ns l'esdeveniment en 2–4 frases: de què va, qui hi participa, si l'entrada és lliure… Un to clar i acollidor, sense exclamacions publicitàries.
>
> *Décrivez l'événement en 2 à 4 phrases : de quoi il s'agit, qui y participe, si l'entrée est libre… Un ton clair et accueillant, sans exclamations publicitaires.*

Pas d'entrada: **Text llarg** → desa a `descripcio`.

---

## Pas 12 — Associació

> Quina entitat o associació organitza l'esdeveniment?
>
> *Quelle structure ou association organise l'événement ?*

Pas d'entrada: **Text** → desa a `associacio`.

---

## Pas 13 — Cartell de l'acte (opcional)

Aquest pas permet carregar el cartell directament del navegador a Cloudinary. El detall complet de configuració (bloc *Set variable* amb codi client, codi JavaScript del widget) està a part, a `docs/pas-5-typebot-cartell-cloudinary.md`. Aquí només la posició dins del flux i el text que veu l'usuari.

Bombolla de text **abans** del bloc de càrrega:

> Podeu afegir el cartell de l'acte a continuació. Premeu el botó per carregar una imatge (JPG, PNG o WebP, màxim 8 MB). Si no teniu cartell, tanqueu la finestra i la tramesa continuarà igualment.
>
> *Vous pouvez ajouter l'affiche de l'événement ci-dessous. Appuyez sur le bouton pour télécharger une image (JPG, PNG ou WebP, 8 Mo maximum). Si vous n'avez pas d'affiche, fermez la fenêtre et la soumission continuera quand même.*

A continuació, el bloc **Set variable** (amb «Execute on client» activat) obre el widget de Cloudinary i desa el resultat a `imatge_url`:

- Si la càrrega va bé → `imatge_url` rep l'URL `https://res.cloudinary.com/...`.
- Si l'usuari tanca sense carregar → `imatge_url` queda com a cadena buida `""`.

Tancar sense carregar és un camí vàlid, no un error: per això el pas és **opcional**.

---

## Pas 14 — Enviament i comiat

Aquí va el bloc **Webhook** que envia totes les variables a l'Apps Script. La configuració d'aquest bloc (URL, cos JSON) està a `docs/pas-5-typebot-connexio.md`.

Després del webhook, una bombolla final de confirmació:

> Gràcies! Hem rebut l'esdeveniment. El revisarem abans de publicar-lo a l'agenda. Si cal una correcció, escriu-nos a info@clm.cat.
>
> *Merci ! Nous avons bien reçu l'événement. Nous le vérifierons avant de le publier dans l'agenda. Pour toute correction, écrivez-nous à info@clm.cat.*

---

## Recordatori de l'esquema

El formulari recull **dades estructurades** ja separades per camps, de manera que en aquesta via **no hi ha cap pas d'IA** (a diferència del correu, que passa per Gemini al Pas 4). La descripció arriba en una sola llengua i el curador completa l'altra durant la revisió setmanal. El cartell, si n'hi ha, ja arriba allotjat a Cloudinary (mai al full ni al Git); si no, `imatge_url` és buit. Cada esdeveniment entra al full amb `estat = pendent`.
