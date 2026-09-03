# Pas 7 — Botó «Publica» (Sheets → GitHub)

El fitxer `apps-script/publishToGitHub.gs` afegeix un menú **Agenda** al full de
càlcul amb un sol element: **Publica els esdeveniments aprovats**. En clicar-lo,
totes les files amb `estat = publicat` es converteixen en JSON i substitueixen
`events.json` al repositori de GitHub. El web públic es refresca sol al cap
d'uns segons.

Decisions preses:

- L'etiqueta del menú és **només en català** (decisió de Miquel, 03-07-2026):
  el full és una eina interna per a un sol curador catalanoparlant.
- El nom d'usuari de GitHub **no és al codi**: es guarda com a propietat
  `GITHUB_OWNER`, igual que el token. El codi no s'ha d'editar mai per
  canviar de compte.
- Si no hi ha cap fila `publicat`, el botó **demana confirmació** abans de
  publicar una llista buida (que deixaria el web sense esdeveniments).
- S'exporten els **16 camps de l'esquema**, mapats per **nom de columna**
  (el codi sobreviu si mai es reordenen les columnes).

## 1. Crear el token de GitHub (una sola vegada)

1. Ves a <https://github.com/settings/personal-access-tokens/new> (has d'estar
   connectat amb el compte propietari del repositori).
2. **Token name**: `agenda-publica-sheets`.
3. **Expiration**: tria 1 any (apunta't la data: caldrà renovar-lo).
4. **Repository access**: *Only select repositories* → `agenda-catalogne-nord`.
5. **Permissions** → *Repository permissions* → **Contents: Read and write**.
   Res més.
6. Clica **Generate token** i copia'l de seguida (només es mostra un cop).

## 2. Configurar l'Apps Script

1. Obre el full de càlcul → **Extensions → Apps Script**.
2. Crea un fitxer nou (`+` → *Script*), anomena'l `publishToGitHub` i
   enganxa-hi el contingut de `apps-script/publishToGitHub.gs`.
   (Cal que `processNewEmails.gs` i `sendWeeklyDigest.gs` també hi siguin:
   aquest fitxer en reutilitza `getSecret` i `indexDeColumna`.)
3. **Configuració del projecte (⚙) → Propietats de l'script** → afegeix:
   - `GITHUB_OWNER` = el teu nom d'usuari de GitHub
   - `GITHUB_TOKEN` = el token del pas 1
4. Desa i **recarrega el full de càlcul** al navegador: al cap d'uns segons
   apareixerà el menú **Agenda** a la barra de menús.
   (El primer cop que cliquis l'element, Google demanarà autorització.)

## 3. Verificació

- [ ] Posa una fila de prova amb `estat = publicat` al full.
- [ ] Clica **Agenda → Publica els esdeveniments aprovats**.
- [ ] Apareix el missatge «Publicació completada. 1 esdeveniments publicats.»
- [ ] `events.json` al repositori de GitHub conté l'esdeveniment (mira
  l'historial de commits: «Publica 1 esdeveniments des del full de càlcul»).
- [ ] `https://NOM-USUARI.github.io/agenda-catalogne-nord/events.json` serveix
  el mateix contingut (pot trigar 1–2 minuts).
- [ ] El web mostra l'esdeveniment (si la data no és passada).

## Si alguna cosa falla

Tots els errors surten en una finestra emergent al full mateix:

- **«Falta la Script Property …»** → revisa el pas 2.3.
- **Codi 401** → el token és incorrecte o ha caducat: torna al pas 1.
- **Codi 404** → `GITHUB_OWNER` no és el propietari del repositori, o el
  repositori no es diu `agenda-catalogne-nord`, o el token no té accés a
  aquest repositori.
- **Codi 409** → conflicte de versions: torna a clicar el botó (el codi
  rellegeix el SHA a cada publicació).
