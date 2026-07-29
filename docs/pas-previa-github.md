# Publicar la PREVISUALITZACIÓ per als col·laboradors (GitHub Pages)

Aquesta guia posa en línia **només** la carpeta `previa/` perquè els
col·laboradors puguin veure el disseny i donar la seva opinió. **No té cap
connexió amb la resta del projecte**: fa servir dades d'exemple incrustades, no
llegeix `events.json`, i els botons de subscripció (Brevo) i de proposta
(Typebot) es mostren però estan **desactivats** a propòsit.

> Es publica en un **repositori a part** (no el de l'agenda real). Així la
> previsualització i l'agenda de veritat mai es barregen.

## Què conté `previa/`

```
previa/
  index.html            ← la previsualització (botons desactivats)
  mencions-legals.html
  fonts/                ← Fraunces + Montserrat (woff2)
  img/logo/             ← els dos logos «Què fas?»
```

## Passos (tot des del web de GitHub, sense Git al portàtil)

1. Entra a github.com i clica **New repository** (botó verd, dalt a la dreta).
2. Nom del repositori: `que-fas-previa` (o el que vulguis). Marca'l **Public**.
   No cal afegir README. Clica **Create repository**.
3. A la pàgina nova del repositori, clica **uploading an existing file**
   (l'enllaç al mig de la pàgina).
4. Obre la carpeta `previa` al teu ordinador i **arrossega'n TOT el contingut**
   (el fitxer `index.html`, `mencions-legals.html` i les carpetes `fonts` i
   `img`) a la finestra de GitHub.
   - Important: arrossega **el que hi ha dins** de `previa/`, no la carpeta
     `previa` sencera, perquè `index.html` ha de quedar a l'arrel del repositori.
5. Baix de tot, clica **Commit changes**.
6. Vés a **Settings** (pestanya de dalt) → **Pages** (menú de l'esquerra).
7. A **Build and deployment → Source**, tria **Deploy from a branch**.
8. A **Branch**, tria `main` i carpeta `/ (root)`, i clica **Save**.
9. Espera 1–2 minuts i recarrega la pàgina. GitHub mostrarà l'adreça pública,
   del tipus:

   ```
   https://EL-TEU-USUARI.github.io/que-fas-previa/
   ```

   Aquesta és l'adreça que pots enviar als col·laboradors.

## Comprovacions ràpides

- La pàgina carrega amb el disseny blanc i negre i el logo «Què fas?».
- El botó **theme** (clar/fosc) funciona.
- Els filtres de comarca i de categoria funcionen.
- Els botons **«Subscriviu-vos»** i **«Proposeu una activitat»** es veuen amb
  contorn puntejat i la nota *Properament · bientôt*, i **no fan res** en clicar.
- L'enllaç **«Mencions legals»** del peu obre la pàgina legal.

## Quan vulguis retirar-la

Esborra el repositori `que-fas-previa` (Settings → General → baix de tot →
**Delete this repository**), o desactiva Pages a Settings → Pages. Com que és un
repositori a part, no afecta gens l'agenda real.

## Actualitzar la previsualització més endavant

Si canvies el disseny (`index.html` / `style.css` / `app.js` de l'arrel), torna a
generar `previa/` i torna a pujar `index.html` al repositori de la previa
(**Add file → Upload files**, arrossega el nou `index.html`, **Commit**). En 1–2
minuts la web es refresca sola.
