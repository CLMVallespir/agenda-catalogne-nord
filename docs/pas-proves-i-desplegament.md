# Proves i desplegament

Com verificar canvis sense tocar les dades de producció, i en quin ordre aplicar-los. Neix de l'auditoria de qualitat del codi (§4, §5, §7).

---

## 1. El runner de tests (`tests.gs`)

Hi ha un runner de tests dins del mateix projecte d'Apps Script. No cal cap eina externa (ni Node, ni npm): s'executa a l'entorn real de Google.

**Com executar-lo:** obre el full de càlcul → menú **Agenda → Executa els tests**. (També funciona des de l'editor cridant `executaTotsElsTests()`; sense interfície, el resum va al registre.)

**Què comprova:** només **lògica pura** (cap servei de Google, cap crida de xarxa), que és el que un retoc de prompt, un canvi de model o un refactor descuidat poden trencar en silenci:

- `analitzaJsonResposta` — JSON net, amb *fences*/preàmbul, sense objecte (llança), truncat (llança).
- `extreuTextResposta` — resposta normal, sense candidats (llança), `MAX_TOKENS` (llança), sense parts (llança).
- `valorPermes` — valors dins i fora d'enum.
- `creaId` — accents i apòstrofs, títol només puntuació, sense data, retall a 3 paraules.
- `construeixFila` — **el contracte de la fila**: una extracció maliciosa amb `estat:"publicat"` i valors fora d'enum acaba igualment en una fila de 16 posicions, amb `estat = pendent`, els enums forasters buidats i l'`id` reconstruït (mai el del model).
- Els bessons del digest (`digestHtml.gs`): `finsAl`, `objecteDataDe`, `dataLlegibleCatala`, `escapaHtml`, `comencaAmbVocal`, `majuscula`.

**Regla:** executa el runner **abans de promocionar cap versió**. No versionis mai amb tests en vermell.

El runner no escriu cap fila ni publica res: és segur d'executar sempre, fins i tot contra producció, perquè no toca el full, Gmail, Cloudinary, GitHub ni Brevo.

---

## 2. El banc de proves (còpia del full)

Per als canvis que **sí** toquen serveis (publicació, digest, ingestió), no els provis contra el full de producció. Fes-te un banc de proves:

1. **Duplica el full de càlcul** (Fitxer → Fes-ne una còpia). L'Apps Script lligat es copia amb el full; les **Script Properties i els activadors NO es copien** — cosa que aquí és un avantatge.
2. A la còpia, posa a mà unes **Script Properties de prova** que apuntin a recursos de prova, no de producció:
   - un **dipòsit de GitHub de proves** (`GITHUB_OWNER` / `GITHUB_TOKEN` cap a un repo buit teu),
   - **llistes de Brevo fictícies** (`BREVO_LIST_*` amb un parell d'adreces teves),
   - la resta de claus (`GEMINI_API_KEY`, `CLOUDINARY_CLOUD_NAME`, `BREVO_*`) poden ser les mateixes o de prova.
3. **No instal·lis cap activador** a la còpia: executa les funcions a mà des de l'editor.
4. Omple 3–4 files fictícies representatives (una `publicat`, una `pendent`, una amb comarca buida…).

Els tests d'integració es corren aquí:

- **Camí del bot:** crida `processBotSubmission({...})` amb un cos fals → l'última fila queda `pendent` i els enums forasters buidats. Esborra la fila en acabar.
- **Comportament del lock:** força un error dins del `try` de `processNewEmails` i comprova que el `finally` allibera el lock (el run següent no queda bloquejat).
- **Publicació:** `publishToGitHub()` contra el repo de proves; comprova que llegeix el SHA just abans del PUT i que un conflicte (409) surt com a `ui.alert`, no en silenci.
- **Idempotència del digest:** executa `sendWeeklyDigest()` dues vegades el mateix dia → la segona surt sense reenviar (guarda `DIGEST_DARRER_ENVIAMENT`).

Cap test toca mai el full de producció.

---

## 3. Seqüència d'aplicació dels canvis pendents

Els fixos de l'auditoria (vegeu `docs/auditoria/08-taula-consolidada-codi.md`) s'apliquen en ordre de **dependència**, no de severitat, perquè cap refactor gros es faci sense xarxa de seguretat:

1. **`tests.gs`** amb els asserts purs — no depèn de res.
2. **Fix d'enums al camí del bot** amb el seu test primer en vermell (el cicle test-first en miniatura).
3. **Banc de proves** (aquesta secció 2) → hi corren els tests d'integració.
4. **Fixos del digest** (lock + idempotència + avís al curador), cadascun amb el seu test d'acceptació.
5. **Refactors estructurals** (`utils.gs`, partició del digest en `digestHtml.gs`) amb la suite com a xarxa — «suite verda primer, refactor després».
6. **Alineació de documentació** — passada d'edició independent, sense tocar codi.
7. **Poliments** (consistència, bessons, cadenes màgiques) quan es toqui cada fitxer.

> Estat: els passos 1, 2, 4, 5 i el gruix del 6–7 ja estan aplicats al codi del dipòsit i verificats (sintaxi + 42 asserts en verd). El pas 3 (banc de proves) és una acció manual a Google que descriu aquest document; els tests d'integració es corren allà quan el banc existeixi.

---

## 4. El manifest `appsscript.json`

El dipòsit inclou `apps-script/appsscript.json` amb el fus horari (`Europe/Paris`, càrrega activa: finestra del digest, `{{AVUI}}`, dimarts 15:00), el runtime (V8) i el registre d'excepcions. **No hi ha `oauthScopes`**: així Apps Script els dedueix automàticament del codi (el comportament actual), i no es corre el risc de restringir un permís que el codi necessita.

Quan vulguis que el manifest reflecteixi **exactament** els permisos concedits, exporta'l de l'editor (Configuració del projecte → «Mostra el fitxer de manifest appsscript.json») i reemplaça'n la còpia del dipòsit — és l'única font que llista els `oauthScopes` reals. Recorda la política: el dipòsit és el mestre; si toques el manifest a l'editor, replica'l al dipòsit el mateix dia.

