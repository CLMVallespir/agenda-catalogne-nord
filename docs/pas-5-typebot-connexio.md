# Pas 5 (connexió) — Enllaçar Typebot amb el full de càlcul

> **Estat: EN ESPERA del compte Google Workspace.** Aquesta part no es pot fer fins que l'Apps Script visqui al compte definitiu (el mateix que el full i la safata Gmail). El **qüestionari** (`docs/pas-5-typebot-questionari.md`) i el **codi** (`apps-script/processBotSubmission.gs`) ja es poden preparar ara; només falta el cablejat d'aquesta pàgina.

Aquest document és **només la connexió tècnica** entre el formulari Typebot i el full. El contingut del formulari (preguntes, avís legal, variables) és a `docs/pas-5-typebot-questionari.md`. Es mantenen separats a propòsit: aquí pots tornar quan el Workspace estigui llest, sense haver de tocar el formulari.

La idea, en una frase: l'Apps Script es **publica com a aplicació web** i dona una URL; el bloc *Webhook* de Typebot envia les respostes a aquesta URL en format JSON; la funció `doPost()` les rep i la funció `processBotSubmission()` escriu una fila al full.

---

## 1. Posar el codi a l'Apps Script

1. Obre el full **Esdeveniments** (el del compte Workspace definitiu).
2. Menú **Extensions → Apps Script**.
3. Comprova que el fitxer `processBotSubmission.gs` hi és (amb les funcions `doPost`, `processBotSubmission`, `readField` i `creaId`). Si no, copia-hi el contingut d'`apps-script/processBotSubmission.gs`.
4. Desa el projecte (icona del disquet).

---

## 2. Publicar com a aplicació web

1. A l'editor d'Apps Script, a dalt a la dreta: **Desplegar → Nou desplegament**.
2. A l'engranatge **Tipus de desplegament**, tria **Aplicació web**.
3. Configura:
   - **Descripció:** `Webhook Typebot` (per recordar-ho).
   - **Executar com a:** *Jo* (el compte del projecte).
   - **Qui hi pot accedir:** **Qualsevol** (*Anyone*). Cal perquè Typebot, que és un servei extern, hi pugui enviar dades sense identificar-se.
4. Clica **Desplegar**. La primera vegada et demanarà **autoritzar** els permisos: accepta'ls (és el teu propi compte).
5. Copia l'**URL de l'aplicació web**. Acaba en `/exec`. Aquesta és la URL del webhook.

> Cada cop que canviïs el codi, has de fer **Desplegar → Gestionar desplegaments → editar (llapis) → Versió: Nova → Desplegar** perquè l'URL serveixi la versió nova. L'URL `/exec` es manté igual.

---

## 3. Configurar el bloc Webhook a Typebot

Al final del flux del formulari (Pas 13 del qüestionari), afegeix un bloc **Webhook / HTTP request**:

1. **Mètode:** `POST`.
2. **URL:** enganxa l'URL `/exec` del pas anterior.
3. **Body / Cos:** tipus **JSON**. Construeix l'objecte amb les variables del formulari. Els noms de les claus han de coincidir **exactament** amb els que llegeix `processBotSubmission()`:

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

Les claus de l'esquerra són fixes (les espera el codi). Els `{{...}}` de la dreta són les variables que Typebot ha anat desant al llarg del formulari.

> **No treguis `idioma_descripcio` del cos.** És el que el codi llegeix per decidir si la descripció va a `descripcio_ca` o a `descripcio_fr`. Si falta, totes les descripcions cauen a `descripcio_ca`. (Algunes guies genèriques d'integració l'ometen: aquí cal mantenir-lo.)

> `imatge_url` el desa el pas de càrrega del cartell (vegeu `docs/pas-5-typebot-cartell-cloudinary.md`): arriba com un URL de Cloudinary o com a cadena buida.

> No cal enviar `es_un_sol_dia`: només serveix per ramificar el formulari. Si l'esdeveniment és d'un sol dia, `data_fi` arribarà buit i el codi hi posarà la data d'inici.

> No cal enviar `font_url`: el formulari no demana cap enllaç d'origen i el codi sempre el deixa buit.

4. (Opcional) Activa **"Test the request"** a Typebot per provar la crida mentre configures.

---

## 4. Verificació (quan tot estigui connectat)

1. Obre el formulari Typebot pel seu enllaç públic.
2. Accepta l'avís legal i omple un esdeveniment de prova de principi a fi.
3. Obre el full **Esdeveniments**.
4. Comprova que **apareix una fila nova** amb:
   - `estat` = `pendent`;
   - `data_entrada` amb la data i hora actuals;
   - `imatge_url` amb l'URL de Cloudinary si has carregat un cartell, o buit si no; `font_url` sempre buit;
   - `data_fi` igual a `data_inici` si era d'un sol dia;
   - la descripció a `descripcio_ca` **o** `descripcio_fr` segons la llengua triada (l'altra columna buida);
   - `id` amb el format `AAAA-MM-DD-slug`;
   - la resta de camps al lloc correcte.
5. Si no apareix res: a l'editor d'Apps Script, **Execucions** (rellotge a l'esquerra) mostra les crides a `doPost` i qualsevol error registrat amb `Logger.log`.

---

## 5. Resolució de problemes ràpida

- **No arriba cap fila:** revisa que l'URL del webhook acabi en `/exec` i que el desplegament sigui *Qualsevol* pot accedir. Mira **Execucions** a l'Apps Script.
- **Arriba la fila però amb camps a la columna equivocada:** una clau JSON del cos no coincideix amb el nom que espera el codi. Compara amb la llista del Pas 3.
- **La descripció va sempre a `descripcio_ca`:** `idioma_descripcio` no està arribant com a `fr`. Comprova que el botó de llengua desa exactament `ca` o `fr`.
- **La comarca o la categoria queden buides al web:** el valor enviat no és un dels valors exactes de l'esquema. Revisa els botons del formulari (Passos 6 i 9 del qüestionari).
- **El cartell no apareix (`imatge_url` buit tot i haver carregat):** comprova que la clau `imatge_url` és al cos del webhook i que el bloc de càrrega desa a la variable `imatge_url` (vegeu `docs/pas-5-typebot-cartell-cloudinary.md`).
- **Has canviat el codi i no es nota:** has de crear una **versió nova** del desplegament (vegeu la nota del Pas 2).
