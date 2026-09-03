# Pas 3 — Configuració de Cloudinary

Cloudinary allotjarà els cartells dels esdeveniments (no es guarden mai al Git). Aquest pas es fa tot al navegador. Temps estimat: 15 minuts.

Decisió presa el 2026-06-12: el preset és **unsigned**. Conseqüència: el Worker només necessita `CLOUDINARY_CLOUD_NAME` per pujar imatges (cap signatura, cap secret a la crida de pujada).

## 1. Crear el compte

1. Ves a <https://cloudinary.com> i clica **Sign up for free**.
2. Registra't amb el correu del projecte (el mateix que farà servir el Workspace, si ja el tens; si no, qualsevol correu — el compte Cloudinary no depèn de Google).
3. Si et demana quin producte t'interessa, tria **Programmable Media** (API per a desenvolupadors), no el DAM.
4. **Important — el cloud name:** durant el registre (o just després, a Settings → Product environments) pots personalitzar el *cloud name*. Apareixerà a totes les URL d'imatges per sempre (`https://res.cloudinary.com/EL-TEU-CLOUD-NAME/...`). Tria'n un d'estable i llegible, per exemple `agenda-nord` o `clm-agenda`. No es pot canviar fàcilment després.

El pla gratuït (25 crèdits/mes) és molt més que suficient per a aquest projecte.

## 2. Anotar les credencials

1. A la consola, ves a **Settings** (icona d'engranatge) → **API Keys**. El *cloud name* també surt al Dashboard principal.
2. Anota en un lloc segur (gestor de contrasenyes, mai al repositori):
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

Amb el preset unsigned, el Worker només fa servir el cloud name. La key i el secret guarda'ls igualment: caldran si mai vols esborrar imatges per API o fer operacions d'administració.

## 3. Crear l'upload preset

1. **Settings** → **Upload** → pestanya **Upload presets** → **Add upload preset**.
2. Configura:

   | Camp | Valor |
   |---|---|
   | Upload preset name | `agenda-posters` (substitueix el nom generat automàticament) |
   | Signing mode | **Unsigned** |
   | Folder (o "Asset folder") | `clm-agenda/posters` |

3. Pestanya (o secció) **Transform** → **Incoming transformation** → edita i posa exactament:

   ```
   w_800,c_limit,q_80,f_webp
   ```

   Què fa: limita l'amplada a 800 px (`c_limit` no amplia mai imatges més petites), qualitat 80, converteix a WebP abans de guardar. Així l'original ja es guarda lleuger.

4. **Save**.

## 4. Verificació

### Opció A — des del tauler (la del pla original)

1. **Settings** → **Upload** → busca l'opció de preset per defecte del Media Library i posa-hi temporalment `agenda-posters`.
2. Ves al **Media Library** i puja una imatge de prova gran (un cartell qualsevol > 800 px d'amplada).
3. Obre la imatge pujada i copia la seva URL.
4. Torna a deixar el preset per defecte del Media Library com estava.

### Opció B — prova real de l'API (idèntica al que fa el Worker)

Dona'm el cloud name i faig jo la pujada de prova des d'aquí amb una crida POST a
`https://api.cloudinary.com/v1_1/CLOUD_NAME/image/upload` amb `upload_preset=agenda-posters`.
No cal cap credencial secreta: és exactament la crida que fa el Worker.

### Llista de verificació

- [ ] El compte existeix i les 3 credencials estan anotades en lloc segur.
- [ ] El preset `agenda-posters` existeix, mode **Unsigned**.
- [ ] La imatge de prova apareix a la carpeta `clm-agenda/posters`.
- [ ] La URL resultant es veu públicament en una finestra d'incògnit.
- [ ] La imatge servida és WebP i fa com a màxim 800 px d'amplada (la URL o la pestanya de detalls ho indiquen; també es pot comprovar amb clic dret → inspecciona).
- [ ] Una imatge més petita de 800 px no s'amplia (opcional, segona prova).

Quan tot estigui marcat, el Pas 3 queda tancat. El següent pas que no depèn de Google és el Pas 6 (repositori GitHub).
