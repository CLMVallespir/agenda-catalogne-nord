# Auditoria de seguretat — Secció 3: Neteja de dades a la vista pública (frontend)

> Àmbit: només codi del repositori `agenda-catalogne-nord`. Revisió defensiva del propi projecte.
> **Cap correcció s'ha aplicat**: aquest document només llista les troballes; en Miquel decideix l'ordre.
> Referència: secció 3 del checklist `docs/auditoria/auditoria-seguretat-agenda-nord.md`.
> Data: 2026-07-04.

**Context que acota la secció:** tot el que pinta `app.js` surt de `events.json`, que només
escriu `publishToGitHub()` a partir de files revisades pel curador. El text lliure de les
associacions passa doncs per un ull humà abans d'arribar aquí — però la defensa del frontend
no ha de dependre d'això, i el veredicte és que **gairebé no en depèn**: la construcció del DOM
és sistemàticament amb `createElement` + `textContent`.

**Fitxers duplicats (nota B de l'inventari):** la lògica de pintat existeix a **tres llocs** —
`app.js` (producció), `prova-local.html` (arrel, còpia inline) i `docs/prova-local.html` (còpia
més antiga). Tota correcció d'aquesta secció s'ha de replicar a les tres còpies, o assumir
explícitament que les dues previsualitzacions queden sense endurir.

---

## Check 1 · Camps de text al DOM: `textContent` pertot — **CORRECTE, cap mancança**

Localitzada la inserció de **tots** els camps de dades a `app.js`; cap no passa per `innerHTML`
ni per concatenació d'HTML:

| Camp | Fitxer:línia | Mecanisme |
|---|---|---|
| `titol` (amb enllaç) | `app.js:312` | `enllac.textContent` |
| `titol` (sense enllaç) | `app.js:315` | `titol.textContent` |
| `titol` dins l'`alt` del cartell | `app.js:270` | assignació de propietat `imatge.alt` (no interpreta HTML) |
| `comarca` | `app.js:322` | `textContent` |
| `categoria` (banderola) | `app.js:293` | `textContent` |
| `hora` | `app.js:392` | `textContent` |
| `lloc` + `municipi` | `app.js:407` (via `textLloc()`, `425-436`) | `textContent` |
| `descripcio_ca` | `app.js:348` | `textContent` |
| `descripcio_fr` | `app.js:355` | `textContent` |
| `associacio` | `app.js:361` | `textContent` |
| missatges d'estat | `app.js:467` | `textContent` |
| separadors ` · ` | `app.js:399,413` | `createTextNode` |

## Check 2 · Usos d'`innerHTML` — **CORRECTE amb un matís (3-C)**

Quatre usos, tots amb **constants del fitxer**, mai amb dades: `app.js:404` (`ICONA_PIN`),
`app.js:506,509` (icones de tema) i `app.js:278` — aquest últim amb el matís 3-C de sota.
No cal cap `escapaHtml()` perquè **no existeix cap `innerHTML` interpolat amb dades**.

## Check 4 · Mode `?prova=1` — **CORRECTE, cap mancança**

`fitxerDeDades()` (`app.js:65-71`) fa la comparació estricta `params.get('prova') === '1'` i
només pot tornar **dos literals fixos** (`events-exemple.json` / `events.json`); el valor
s'usa únicament com a argument del `fetch` (`app.js:76`). Cap paràmetre d'URL no arriba mai
al DOM ni construeix cap ruta arbitrària.

---

## Troballes (check 3 i matisos)

### 3-A · `font_url` assignat a `href` sense validar l'esquema — **MITJANA**

- **Fitxer:línia:** `app.js:309-313` (assignació a la 311); rèpliques a `prova-local.html:908`
  i `docs/prova-local.html:492`
- **Mancança (1 frase):** el títol esdevé un enllaç amb `enllac.href = e.font_url` sense
  comprovar l'esquema, i un esquema no segur (tipus *script* en lloc de `http`/`https`)
  s'executaria en clicar — és l'únic camí del frontend on una cadena de dades pot esdevenir codi.
- **Mitigacions existents:** avui `font_url` és `''` codificat en dur a totes dues rutes
  d'entrada (§2.1-C), així que l'únic origen possible és el curador escrivint-lo a mà a la
  cel·la del full; els enllaços no porten `target="_blank"`, o sigui que tampoc hi ha risc de
  *reverse tabnabbing*.
- **Correcció concreta:** helper únic i ús a l'enllaç, amb replegament a text pla:

  ```js
  // Diu si un text és una URL web normal (http o https). Res més no és acceptable.
  function esUrlHttp(text) {
    return /^https?:\/\//i.test(text);
  }
  ```

  i a `creaCos()`: `if (e.font_url && esUrlHttp(e.font_url)) { … enllaç … } else { titol.textContent = e.titol; }`

### 3-B · `imatge_url` assignat a `src` sense validar esquema ni origen — **BAIXA**

- **Fitxer:línia:** `app.js:267-269`; rèpliques a `prova-local.html:866` i `docs/prova-local.html:542`
- **Mancança (1 frase):** `imatge.src = e.imatge_url` sense comprovació; els navegadors actuals
  no executen esquemes de script en un `src` d'imatge, així que el risc pràctic es limita a
  carregar una imatge externa no desitjada (contingut equivocat o píxel de seguiment).
- **Correcció concreta:** reutilitzar `esUrlHttp()` de 3-A com a mínim
  (`if (e.imatge_url && esUrlHttp(e.imatge_url))`), o millor el prefix estricte
  `https://res.cloudinary.com/` — coherent amb la troballa 1.1-B2, que proposa la mateixa
  validació aigües amunt, a l'entrada.

### 3-C · `iconaCategoria()`: clau de dades sobre un objecte que alimenta `innerHTML` — **BAIXA (robustesa)**

- **Fitxer:línia:** `app.js:298-300` (i l'ús a la 278)
- **Mancança (1 frase):** `CATEGORIA_ICONES[categoria]` és una cerca de propietat amb una clau
  vinguda de dades, i una `categoria` que coincideixi amb una propietat heretada d'`Object.prototype`
  (p. ex. `"constructor"`) retorna un valor *truthy* que s'estringifica dins l'`innerHTML` — text
  inert, **no executable** (els valors venen del prototip, no de l'atacant), però pintat com a brossa.
- **Correcció concreta:** l'idioma segur de cerca:

  ```js
  function iconaCategoria(categoria) {
    if (Object.prototype.hasOwnProperty.call(CATEGORIA_ICONES, categoria)) {
      return CATEGORIA_ICONES[categoria];
    }
    return ICONA_DEFECTE;
  }
  ```

---

## Resum de la secció 3 (format §8)

| # | Fitxer:línia | Severitat | Mancança (1 frase) | Correcció proposada |
|---|---|---|---|---|
| 3-A | `app.js:311` (+ `prova-local.html:908`, `docs/prova-local.html:492`) | Mitjana | `font_url` va a `href` sense validar l'esquema: un esquema no segur s'executaria en clicar. | Helper `esUrlHttp()` (`/^https?:\/\//i`); si no passa, títol en text pla. |
| 3-B | `app.js:269` (+ `prova-local.html:866`, `docs/prova-local.html:542`) | Baixa | `imatge_url` va a `src` sense cap comprovació d'esquema ni d'origen. | `esUrlHttp()` o prefix estricte `https://res.cloudinary.com/` (coherent amb 1.1-B2). |
| 3-C | `app.js:298-300` | Baixa | Cerca de propietat amb clau de dades que alimenta `innerHTML` (propietats heretades → brossa inerta). | `hasOwnProperty.call()` abans de llegir la icona. |

**Checks sense mancança:** check 1 (tots els camps de dades amb `textContent`/`createTextNode` —
taula completa a dalt), check 2 (`innerHTML` només amb constants; cap interpolació de dades),
check 4 (`?prova=1` estricte, dos literals fixos, només per al `fetch`).

**Nota transversal:** qualsevol correcció s'ha d'aplicar també a les dues còpies de
`prova-local.html` (arrel i `docs/`), que dupliquen els mateixos punts d'inserció.

> **Recordatori del protocol:** cap d'aquestes correccions s'ha aplicat. Es revisaran totes
> juntes al final (secció 8) i en Miquel triarà l'ordre d'aplicació.
