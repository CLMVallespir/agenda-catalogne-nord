# Pas 6 — Dipòsit GitHub i GitHub Pages

GitHub allotjarà el codi de l'aplicació web i el fitxer `events.json` (la font de veritat dels esdeveniments publicats). GitHub Pages servirà el web estàtic gratuïtament. Aquest pas es fa tot al navegador, sense instal·lar res. Temps estimat: 10 minuts.

Aquest pas no depèn de Google: el compte GitHub pot ser personal i no caldrà canviar-lo quan arribi el Workspace.

## 1. Crear el compte (si no en tens)

1. Ves a <https://github.com> i clica **Sign up**.
2. Fes servir un correu estable del projecte. Anota el nom d'usuari: apareixerà a l'URL del web (`https://NOM-USUARI.github.io/agenda-catalogne-nord/`).

## 2. Crear el dipòsit

1. Ves a <https://github.com/new>.
2. Configura:
   - **Repository name:** `agenda-catalogne-nord` (exactament així)
   - **Visibility:** **Public** (obligatori perquè GitHub Pages sigui gratuït)
   - **No** marquis «Add a README file» (ja en tenim un; el dipòsit ha de quedar buit)
3. Clica **Create repository**.

## 3. Pujar els fitxers del projecte

1. A la pàgina del dipòsit nou que diu «Quick setup», clica l'enllaç **uploading an existing file**.
2. Obre la carpeta del projecte al teu ordinador (`agenda-catalogne-nord`) i arrossega-hi **tot el contingut**: `index.html`, `style.css`, `app.js`, `events.json`, `README.md` i les carpetes `prompts/`, `apps-script/`, `docs/`.
   - Si el navegador no accepta carpetes arrossegades, puja primer els 5 fitxers solts i després entra a cada carpeta i repeteix l'operació (botó **Add file → Upload files**, i escriu el nom de la carpeta seguit de `/` davant del nom del fitxer per crear-la).
3. A baix, al camp del missatge de commit, escriu: `Pas 6: estructura inicial del dipòsit`.
4. Clica **Commit changes**.

Comprova que a la pàgina principal del dipòsit es veuen els 5 fitxers i les 3 carpetes.

## 4. Activar GitHub Pages

1. Al dipòsit, ves a **Settings** → **Pages** (menú lateral esquerre).
2. A **Build and deployment**:
   - **Source:** Deploy from a branch
   - **Branch:** `main` — carpeta `/ (root)`
3. Clica **Save**.
4. Espera 1–2 minuts i recarrega la pàgina: apareixerà l'URL del web, del tipus `https://NOM-USUARI.github.io/agenda-catalogne-nord/`.

## 5. Verificació (llista del Pas 6)

- [ ] `https://NOM-USUARI.github.io/agenda-catalogne-nord/` carrega (pàgina en blanc: és correcte en aquesta fase).
- [ ] `https://NOM-USUARI.github.io/agenda-catalogne-nord/events.json` mostra `[]`.
- [ ] El dipòsit és **Public**.

## 6. Token per al Pas 7 (es pot fer ara o més endavant)

La publicació del Pas 7 (menú «Agenda → Publica els esdeveniments aprovats») necessitarà un *personal access token* per escriure `events.json` des d'Apps Script. Per crear-lo:

1. GitHub → la teva foto (a dalt a la dreta) → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Configura:
   - **Token name:** `agenda-publier`
   - **Expiration:** 1 any (caldrà renovar-lo; GitHub avisa per correu abans)
   - **Repository access:** Only select repositories → `agenda-catalogne-nord`
   - **Permissions** → Repository permissions → **Contents: Read and write**. Res més.
3. Clica **Generate token** i **copia'l immediatament** (no es torna a mostrar). Guarda'l al gestor de contrasenyes, mai al dipòsit.

Quan el Workspace estigui llest, aquest token s'introduirà com a Script Property a l'Apps Script (Pas 7).
