# Pas 4 — Ingestió de correus (Apps Script)

Aquest pas llegeix els correus que envien les associacions, en treu les dades amb l'API de Gemini (Google AI Studio, capa gratuïta), puja el cartell (si n'hi ha) a Cloudinary i escriu **una fila per correu** al full `Esdeveniments` amb `estat = pendent`, a punt per a la revisió setmanal.

El codi és a `apps-script/processNewEmails.gs`. La funció principal es diu `processNewEmails()` i s'executa sola cada hora.

> **Estat: codi fet; falta la connexió.** El codi està escrit i verificat. La resta és configuració que ja pots fer, tota al compte **admin@clm.cat** (el que ha creat el full i on corre el script): crear el filtre de Gmail, posar les Script Properties, instal·lar el trigger i fer una prova. Al final hi ha la llista de connexió.

---

## Com encaixa amb la resta

`processNewEmails.gs` és **un fitxer més dins del mateix projecte d'Apps Script lligat al full** (el mateix on viuen `setupSheet.gs` i `processBotSubmission.gs`). No és un projecte a part. Tots els fitxers `.gs` comparteixen el mateix espai global, i per això aquest fitxer **reutilitza** sense duplicar:

- `creaId(data_inici, titol)` i `readField(objecte, clau)` → de `processBotSubmission.gs`
- `COMARCA_VALUES` i `CATEGORIA_VALUES` → de `setupSheet.gs`

Així el `id` i la neteja de camps surten idèntics tant si l'esdeveniment ve per correu com pel formulari. (Hi ha un comentari recordatori a dalt del fitxer per si mai esborres aquells fitxers.)

---

## Les etiquetes de Gmail (l'estat viu a les etiquetes)

| Etiqueta | Qui la posa | Què vol dir |
|---|---|---|
| `agenda-entrant` | un filtre de Gmail (a admin@clm.cat) | correu nou, a punt per processar |
| `agenda-traitat` | el script | fet: s'ha escrit una fila |
| `agenda-error` | el script | alguna cosa ha fallat; mira'l tu |

El script crea `agenda-traitat` i `agenda-error` ell sol si no existeixen. L'única que has de crear tu és **`agenda-entrant`**.

La cerca que fa el script és: `label:agenda-entrant is:unread -label:agenda-traitat -label:agenda-error`. Per tant, un correu ja processat (llegit + etiquetat) no es torna a agafar mai.

---

## Configuració manual (quan tinguis el compte de Google)

1. **Obre l'editor d'Apps Script** del full (Extensions → Apps Script) i afegeix un fitxer nou anomenat `processNewEmails.gs`. Enganxa-hi el contingut de `apps-script/processNewEmails.gs`.

2. **Crea el filtre de Gmail** (al compte admin@clm.cat) que etiqueti automàticament els correus de les associacions. El públic escriu a **info@clm.cat**, que reenvia tot a **admin@clm.cat** (on hi ha el full i corre el script). Per capturar només aquests correus:
   - Gmail (admin@clm.cat) → engranatge → *Veure tota la configuració* → **Filtres i adreces bloquejades** → **Crea un filtre**.
   - Al camp **Per a (To)** posa `info@clm.cat` → **Crea un filtre amb aquesta cerca**.
   - Marca **Aplica l'etiqueta** → *Tria una etiqueta…* → **Nova etiqueta…** → `agenda-entrant` (aquí es crea l'etiqueta).
   - **NO** marquis «Marca com a llegit»: el script només agafa els correus **no llegits**. (Pots marcar «No l'enviïs mai a Spam».)
   - **Crea el filtre.**

3. **Afegeix les Script Properties** a Configuració del projecte (icona d'engranatge) → *Propietats de l'script*:

   | Propietat | La fa servir el Pas 4? | Valor |
   |---|---|---|
   | `GEMINI_API_KEY` | **sí** | la teva clau de Gemini (aistudio.google.com → Get API key; capa gratuïta) |
   | `CLOUDINARY_CLOUD_NAME` | **sí** | el cloud name de Cloudinary (Pas 3) |
   | `CLOUDINARY_API_KEY` | no (admin) | per esborrar imatges per API més endavant |
   | `CLOUDINARY_API_SECRET` | no (admin) | íd. |
   | `GITHUB_TOKEN` | no (és el Pas 7) | el posaràs quan fem la publicació (menú «Agenda → Publica els esdeveniments aprovats») |

   El preset de Cloudinary és **unsigned**, així que pujar només necessita el cloud name: cap signatura, cap secret a la crida.

4. **Instal·la el trigger horari**: a l'editor, tria la funció `installHourlyTrigger` i executa-la **una vegada**. Et demanarà autoritzar els permisos (Gmail, full, crides externes); accepta. Això programa `processNewEmails()` cada hora. És segur tornar-la a executar: esborra el trigger anterior abans de crear-ne un de nou, així no se'n dupliquen.

---

## Verificació

1. Envia un correu de prova a **info@clm.cat** amb un cartell adjunt (imatge o PDF).
2. Comprova que el filtre li ha posat `agenda-entrant` (o posa-la a mà si proves abans de crear el filtre).
3. A l'editor, executa `processNewEmails` manualment.
4. Comprova:

- [ ] Apareix **una fila nova** a `Esdeveniments` amb `estat = pendent`.
- [ ] Els camps de l'esdeveniment estan ben omplerts (títol, dates, descripcions CA/FR, etc.).
- [ ] A Cloudinary, a la carpeta `clm-agenda/posters`, hi ha la imatge pujada i ja redimensionada (WebP, màx. 800 px).
- [ ] El fil del correu té ara l'etiqueta `agenda-traitat` i està llegit.
- [ ] Si executes la funció dues vegades alhora (per exemple, mentre la primera encara corre), al registre (Ver → Registres d'execució) hi surt el missatge del *lock*: «another execution is already running».
- [ ] Si un correu falla (per exemple, sense connexió a Gemini), el fil queda amb `agenda-error` i la resta de correus es processen igualment.

---

## Decisions que he pres (canvia-les si vols)

Totes són d'una línia al codi, fàcils de canviar:

- **L'assumpte del correu s'envia a Gemini** junt amb el cos (sovint el títol o la data hi són). Es marca amb una línia `Assumpte:` abans del cos. *(funció `extreuTextCorreu`)*
- **Només s'agafa el primer adjunt de debò**; les imatges *incrustades* (logos de signatura, icones de xarxes) s'ignoren per no confondre-les amb el cartell. Si moltes associacions enganxen el cartell dins del cos en lloc d'adjuntar-lo, canvia `includeInlineImages` a `true`. *(funció `primerCartellAdjunt`)*
- **Cartells en PDF: acceptats.** S'agafa la primera imatge O el primer PDF adjunt; Cloudinary converteix el PDF a WebP (primera pàgina) amb la transformació `f_webp` del preset. *(funció `primerCartellAdjunt`)* Si mai un PDF falla en mostrar-se, activa a Cloudinary **Settings → Security** l'opció «Allow delivery of PDF and ZIP files».
- **El `id` es recalcula** amb `creaId`, ignorant el que proposa el model, perquè surti idèntic al del formulari. *(funció `construeixFila`)*
- **`comarca` i `categoria` es validen** contra les llistes permeses; si el model en torna una de rara, es desa buida (la revisió la pot completar). *(funció `valorPermes`)*
- **Màxim 10 correus per execució** per no superar el límit de 6 minuts d'Apps Script; la resta esperen a l'hora següent. *(constant `MAX_THREADS_PER_RUN`)*
- **Els correus que fallen van a `agenda-error` i es marquen llegits**, per no reintentar-los en bucle ni crear files duplicades. *(funció `processNewEmails`, bloc `catch`)*
- **El «thinking» de Gemini està desactivat** (`thinkingConfig.thinkingBudget: 0`) i el límit de sortida és 2048 tokens. Gemini 2.5 Flash raona per defecte i aquests tokens es menjaven el pressupost de sortida, tallant el JSON a mig fer; per a una extracció no cal cap raonament. *(funció `demanaExtraccioGemini`)*

---

## Seguretat (per a la teva tranquil·litat)

- **Cap secret al codi.** La clau de Gemini i el cloud name són Script Properties; mai s'escriuen al registre.
- **El text del correu el controla qui l'envia**, així que un correu maliciós podria intentar «enganyar» el model (injecció de prompt). La protecció principal és que **res no es publica sol**: tota fila neix `pendent` i tu la revises abans de publicar. A més, el límit de sortida (`maxOutputTokens`) és 2048 (cap camp pot ser enorme) i `comarca`/`categoria` es validen.
- **El front-end ja és segur** davant d'aquest contingut: `app.js` pinta tots els camps amb `textContent` (mai `innerHTML`), així que cap text d'un correu pot injectar HTML ni scripts a la web. La imatge ve sempre de Cloudinary i `font_url` sempre queda buida des del correu.
  - *Nota per al futur:* si algun dia deixes que `font_url` s'ompli amb dades no fiables, valida que comenci per `http://` o `https://` abans de fer-la servir com a enllaç.

---

## Què queda per fer (tot al compte admin@clm.cat)

Les decisions ja estan preses; aquesta és la llista de connexió:

1. **Clau de Gemini** → a `GEMINI_API_KEY`. Ves a <https://aistudio.google.com> amb admin@clm.cat → **Get API key** → crea la clau (capa gratuïta, sense targeta). Model: `gemini-2.5-flash`, de sobres per al volum d'aquest projecte.
2. **Cloud name de Cloudinary** → a `CLOUDINARY_CLOUD_NAME`. És el mateix valor que ja fas servir al bloc de pujada del formulari Typebot (el que substitueix `YOUR_CLOUD_NAME`); també és al tauler de Cloudinary → *Product Environment Credentials* → *Cloud name*.
3. **Filtre de Gmail** cap a `agenda-entrant` (punt 2 de «Configuració manual»).
4. **Trigger horari** amb `installHourlyTrigger` (punt 4 de «Configuració manual»).

Fet això, fes la prova de verificació. Temps estimat: 15–20 minuts. El Pas 5 (webhook de Typebot) també es pot connectar ara: el codi és a `apps-script/processBotSubmission.gs`.
