# Pas 5 (cartell) — Càrrega del cartell a Cloudinary des de Typebot

Aquest document desa la configuració del **pas de càrrega del cartell** del formulari Typebot (Pas 13 del qüestionari). La imatge puja **directament del navegador de l'usuari a Cloudinary**, sense servidor ni credencials: només cal el *cloud name* (que és públic) i el preset **unsigned** `agenda-posters`. L'URL resultant viatja com una cadena de text normal dins del webhook, igual que la resta de camps.

Es guarda a part perquè és la peça més tècnica del formulari i la que costaria més de reconstruir si es perdés. Per al flux general, vegeu `docs/pas-5-typebot-questionari.md`; per a la configuració de Cloudinary, `docs/pas-3-cloudinary.md`.

> **En una frase:** un bloc *Set variable* de Typebot, amb «Execute on client» activat, carrega el widget de Cloudinary, l'obre amb el preset `agenda-posters`, i desa l'URL segur (o `""` si l'usuari ho omet) a la variable `imatge_url`.

---

## Requisits previs (Cloudinary)

Comprova al Cloudinary Console (Settings → Upload → Upload presets) que el preset `agenda-posters` té:

- **Signing mode:** `Unsigned` — és el que permet pujar des del navegador sense servidor.
- **Folder:** `clm-agenda/posters`.
- **Incoming transformation:** `w_800,c_limit,q_80,f_webp` — limita la mida i converteix a webp automàticament.

Apunta el teu **cloud name** (Dashboard, a dalt a l'esquerra, p. ex. `dxyz1234ab`). No cal cap API key ni secret.

---

## 1. Crear la variable `imatge_url`

Al panell **Variables** de Typebot (icona `{x}`), crea una variable anomenada exactament `imatge_url`, buida per defecte. Aquí es desarà l'URL de Cloudinary.

---

## 2. Posició dins del flux

El bloc de càrrega va **després de totes les preguntes de text** i **abans del webhook final**:

```
... Pas 12 (associació) ...
→ [Bombolla de text] "Podeu afegir el cartell de l'acte ara." (text bilingüe del Pas 13)
→ [Set variable: imatge_url, amb codi client]   ← el bloc d'aquest document
→ [Pas 14: Webhook + bombolla de comiat]
```

---

## 3. El bloc Set variable (càrrega al client)

1. Afegeix un bloc **Set variable**.
2. Variable a assignar: `imatge_url`.
3. Tipus de valor: **Custom** (l'opció de codi).
4. **Activa «Execute on client».** És imprescindible: sense això el codi s'executa al servidor de Typebot, que no té accés a `window` ni al widget de Cloudinary.
5. Enganxa el codi de sota i **substitueix `YOUR_CLOUD_NAME`** pel teu cloud name real.

```javascript
// Carrega el cartell directament del navegador a Cloudinary.
// Retorna l'URL públic de Cloudinary, o "" si l'usuari ho omet.
// Requereix tenir «Execute on client» activat.

function uploadPoster() {
  return new Promise(function(resolve) {

    // Carrega dinàmicament el script del widget de Cloudinary.
    var script = document.createElement('script');
    script.src = 'https://upload-widget.cloudinary.com/latest/global/all.js';
    script.onload = function() {

      // Obre el widget un cop el script s'ha carregat.
      // Substitueix YOUR_CLOUD_NAME pel teu cloud name real.
      cloudinary.openUploadWidget(
        {
          cloudName: 'YOUR_CLOUD_NAME',
          uploadPreset: 'agenda-posters',
          sources: ['local', 'camera'],
          multiple: false,
          maxFiles: 1,
          maxFileSize: 8000000,
          clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
          showAdvancedOptions: false,
          cropping: false,
          showSkipCropButton: false,
          language: 'fr',
          text: {
            fr: {
              or: 'ou',
              back: 'Retour',
              close: 'Fermer sans carregar',
              skip_crop_button: 'Ometre',
              upload_more: 'Afegir un altre',
              done: 'Fet',
              drop_title_single: 'Arrossegueu el vostre cartell aquí',
              local: { browse: 'Triar un fitxer', dd_title_single: 'Arrossegueu el cartell aquí' }
            }
          },
          styles: {
            palette: {
              window: '#ffffff',
              windowBorder: '#1a1a1a',
              tabIcon: '#1a1a1a',
              menuIcons: '#1a1a1a',
              textDark: '#1a1a1a',
              textLight: '#ffffff',
              link: '#b5121b',
              action: '#b5121b',
              inactiveTabIcon: '#6f6862',
              error: '#cc0000',
              inProgress: '#fcdd09',
              complete: '#b5121b',
              sourceBg: '#fbf7ef'
            },
            fonts: {
              default: null,
              "'Montserrat', sans-serif": { url: null, active: true }
            }
          }
        },
        function(error, result) {
          if (error) {
            // L'usuari ha tancat el widget o hi ha hagut un error: cap imatge.
            resolve('');
            return;
          }
          if (result && result.event === 'success') {
            // Càrrega correcta: retorna l'URL segur de Cloudinary.
            resolve(result.info.secure_url);
          }
          if (result && result.event === 'close') {
            // Tancat sense carregar: cap imatge.
            resolve('');
          }
        }
      );
    };

    // Si el script no es pot carregar, retorna cadena buida.
    script.onerror = function() {
      resolve('');
    };

    document.head.appendChild(script);
  });
}

return await uploadPoster();
```

---

## 4. Què fa el codi, en resum

- Injecta el script del widget de Cloudinary només quan s'arriba a aquest pas (cap dependència fins llavors).
- Obre el widget bloquejat al preset `agenda-posters`, amb `local` i `camera` com a úniques fonts (només cartells; res de xarxes socials ni URL).
- `multiple: false` + `maxFiles: 1` → un sol cartell.
- `maxFileSize: 8000000` → límit de 8 MB abans que la transformació d'entrada de Cloudinary el comprimeixi a webp.
- La paleta `styles` segueix el llenguatge visual del projecte (accent vermell `#b5121b`, fons crema `#fbf7ef`, tinta fosca).
- En èxit retorna `result.info.secure_url` (l'URL `https://res.cloudinary.com/...` complet).
- En error o tancament sense càrrega retorna `""` — important: l'esquema exigeix `imatge_url = ""` quan no hi ha imatge, mai `null`.

---

## 5. Cablejat amb el webhook

El webhook final ha d'incloure `imatge_url` al cos JSON, perquè arribi al Worker. El detall és a `docs/pas-fase3a-worker-formulari.md`. Com que `imatge_url` és sempre o bé un URL de Cloudinary o bé `""`, el Worker no necessita cap tractament especial: el llegeix com una cadena i el desa tal qual.

---

## 6. Verificació

1. **Publica** el Typebot i obre'l en un navegador real (no al panell de previsualització: el widget necessita un context de navegador real).
2. **Camí amb cartell:** carrega una imatge de prova; el widget es tanca, el flux continua i el webhook porta un URL `https://res.cloudinary.com/...` a `imatge_url`.
3. **Camí sense cartell:** tanca el widget sense carregar; el flux continua i `imatge_url` és `""`.
4. A **Cloudinary**, comprova que la imatge de prova ha anat a la carpeta `clm-agenda/posters` i s'ha convertit a webp.

---

## 7. Advertència coneguda (mòbil / iframe)

El widget de Cloudinary s'obre com una finestra modal **sobre** el xat de Typebot. Si tens Typebot incrustat en un `<iframe>` a la teva web, la modal pot quedar retallada per l'alçada de l'iframe. En aquest cas: configura l'incrustat a pantalla completa, o fes servir el mode *popup/bubble* de Typebot. Si fas servir l'URL allotjat de Typebot directament (p. ex. `typebot.io/el-teu-bot`), no hi ha aquest problema.
