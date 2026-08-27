# FASES.md — pla de construcció per fases

*Complementa `CLAUDE.md` (la constitució: restriccions, esquema, estil, serveis).
Última revisió: 27 d'agost de 2026.*

**Com llegir aquest pla.** Cada fase té un objectiu, uns límits i una **porta**: la
prova que cal demostrar, amb evidència real, abans de passar a la següent. Cada
fase és útil per ella mateixa encara que el pla s'aturi després. No hi ha pressa:
es construeix deliberadament, no en emergència. Dins de cada fase, el *com* és
teu — tria sempre la solució més simple que passi la porta.

---

## Fase 0 — Prerequisit humà: Email Routing viu (cap codi)

Feina del propietari, no de l'agent. L'agent només comprova que està fet abans de
la Fase 2.

Llista de control:

- [ ] Registres MX antics anotats en un fitxer de text (per poder revertir) i
      esborrats de la zona DNS a Cloudflare; cap TXT `v=spf1` heretat en conflicte.
- [ ] «Verify DNS records» completat: els tres MX de Cloudflare, el DKIM
      (`cf2024-1._domainkey`) i el seu SPF, tots afegits.
- [ ] Regles d'adreça creades i **destinacions verificades**: `agenda@`,
      `contacte@`, `tv@`, més l'antiga adreça de DinaHosting recreada com a regla.
- [ ] **Prova real de cada adreça** des d'un compte extern (una regla mal posada
      falla en silenci). Al Gmail, filtre per `to:agenda@clm.cat`.

**Porta:** un correu de prova enviat des de fora arriba al Gmail d'arxiu.

---

## Fase 1 — `curador.html`

**Objectiu.** Una segona pàgina estàtica al mateix repositori des d'on el curador
revisa la cua: veu cada fila pendent **amb el cartell al costat del text** (la
decisió és en bona part visual), pot **corregir qualsevol camp** abans d'aprovar
(sovint cal completar la traducció que el Typebot deixa buida), i valida amb dos
botons: **Publica** i **Rebutja**.

**Comportament.**

- Llegeix `pendents.json` i escriu via l'API de GitHub segons la mecànica del
  §7 de `CLAUDE.md` (API sempre, SHA, un reintent).
- **Publica:** posa `estat = "publicat"`, afegeix la fila a `events.json`, la treu
  de `pendents.json`.
- **Rebutja:** treu la fila de `pendents.json` i prou. No es guarda enlloc més: el
  correu original al Gmail d'arxiu és el registre permanent.
- **El token no viu mai al codi.** Un camp de contrasenya a dalt de la pàgina; el
  token de gra fi s'hi enganxa, viu en una variable de JavaScript durant la sessió
  i mor en tancar la pestanya. Cap emmagatzematge, cap sessió, cap login.
- Només en català. Mateixa família visual que el web públic (tipografies pròpies,
  sobrietat B&N); un sol tema és suficient. Funcional per damunt de bonic.
- Sense token enganxat, la pàgina és només de lectura i ho diu clarament.

**Consciència assumida:** `curador.html` i `pendents.json` són públics (GitHub
Pages). Els esdeveniments pendents són actes públics; que es puguin veure abans
d'hora és acceptable. Escriure-hi, en canvi, exigeix el token.

**Llavor de dades:** el full de càlcul actual conté files reals amb
`estat = pendent` (importació de tardor 2026). El propietari les exporta en CSV;
una funció d'un sol ús (o un pas manual documentat) les converteix en el
`pendents.json` inicial. Així la pàgina neix amb contingut real i esdevé útil des
del primer dia.

**Porta:** amb el `pendents.json` real carregat — (1) aprovar un esdeveniment i
veure'l aparèixer a `events.json` al GitHub i al web públic; (2) rebutjar-ne un i
veure'l desaparèixer de la cua; (3) editar un camp abans d'aprovar i comprovar que
el canvi és al fitxer publicat.

---

## Fase 2 — El Worker: `email()`

**Objectiu.** El gestor `email()` de l'únic Worker converteix cada correu rebut a
`agenda@clm.cat` en una fila pendent, i **passi el que passi reenvia l'original**
al Gmail d'arxiu.

**Comportament.**

- Parseja el MIME cru amb el `postal-mime` vendoritzat (vegeu `CLAUDE.md` §3 per
  les condicions de la vendorització i del desplegament sense eines).
- Cos de text → Gemini amb el prompt mestre (mecànica exacta al §7 de `CLAUDE.md`).
- Primer adjunt d'imatge o PDF → Cloudinary (pujada *unsigned*; el PDF es
  transforma sol). L'URL retornat va a `imatge_url`.
- Construeix la fila: 16 cadenes, `estat = "pendent"`, `data_entrada` = ara,
  `id` reconstruït amb `creaId`, enums coercits amb `valorPermes`.
- Afegeix la fila a `pendents.json` (API GitHub, SHA, un reintent).
- **`message.forward()` cap al Gmail d'arxiu sempre, també quan alguna cosa
  falla.** Un correu que no s'ha pogut analitzar no es perd mai: queda a l'arxiu i
  l'error queda registrat (sense claus als registres). Cap excepció no ha de fer
  caure el gestor abans del reenviament.

**Porta:** (1) un correu real amb cartell adjunt, enviat des d'un compte extern,
produeix una fila a `pendents.json` amb l'URL de Cloudinary omplert **i**
l'original arxivat al Gmail; (2) un correu escombraria o buit es reenvia igualment
i no fa caure res; (3) la fila apareix a `curador.html` i es pot publicar
end-to-end fins al web públic.

---

## Fase 3a — El Worker: `fetch()` (Typebot)

**Objectiu.** El webhook del Typebot apunta al Worker. Els camps del formulari ja
són estructurats: **cap crida a Gemini** — mapa determinista camp a camp cap a
l'esquema, amb la regla `descripcio` + `idioma_descripcio` i l'`imatge_url` tal
com arriba (§7 de `CLAUDE.md`).

**Límits.**

- Només `POST`. Cap `GET` ni cap altra ruta.
- **Secret compartit obligatori:** el Worker rebutja amb `403` tota petició sense
  la capçalera correcta (`TYPEBOT_SECRET` als Secrets, configurat també al pas
  webhook del Typebot). L'URL del Worker és públic; sense això, qualsevol podria
  injectar files a la cua.

**Porta:** (1) un `POST` de prova amb el secret produeix una fila correcta a
`pendents.json`; (2) el mateix `POST` sense secret rep `403` i no escriu res;
(3) una tramesa real des del formulari Typebot publicat arriba a la cua.

---

## Fase 3b — El Worker: `scheduled()` (digest Brevo)

**Objectiu.** Un activador cron de Cloudflare al mateix Worker envia el digest
setmanal: **dimarts a les 15.00, hora de París**, un correu transaccional per
subscriptor i per comarca, amb els esdeveniments dels propers dies de la seva
comarca, capçaleres de dia en el format del web, i línia de baixa bilingüe.

**Límits.**

- El cron de Cloudflare és en UTC i no sap res de l'horari d'estiu: resol-ho de la
  manera més simple que garanteixi les 15.00 locals tot l'any, i documenta-la en
  un comentari.
- Llegeix `events.json` via l'API (no de Pages); només esdeveniments futurs.
- Cap enviament en bloc: la mecànica Brevo del §7 de `CLAUDE.md`.

**Porta:** una execució de prova (activador manual o data forçada) envia el digest
d'una comarca a l'adreça del propietari, amb format i llengües correctes, i no
envia res cap dia que no toqui.

---

## Fase 4 — Tall de cinta (majoritàriament operacional)

Quan les portes 1–3 han passat i el sistema nou ha rodat en paral·lel unes
setmanes:

- [ ] Desactivar els activadors d'Apps Script i arxivar el codi `.gs` i
      l'exportació del full a `docs/arxiu-google/` (registre històric, no codi viu).
- [ ] Retirar el full de càlcul de l'ús diari.
- [ ] Publicar `agenda@clm.cat` com a única adreça de tramesa (web, peu de pàgina,
      materials); l'antic Gmail deixa de ser públic i queda només com a arxiu.
- [ ] Comprovar que l'URL del formulari de subscripció de Brevo ja no és el marcador
      de posició a `index.html`.
- [ ] Actualitzar `NOTES.md` i el bloc d'estat vigent de la documentació del
      projecte perquè descriguin només l'arquitectura nova.

**Porta:** una setmana sencera de funcionament real — trameses per correu i per
formulari, curació, publicació i digest — sense tocar res de Google llevat de la
clau de Gemini i el Gmail d'arxiu.

---

## Ajornats — camí acordat, no per construir ara

- **Tokens de curació per comarca.** Quan una associació vulgui curar la seva
  comarca: un token de gra fi propi + `curador.html?comarca=Vallespir` que filtra
  la cua. Cap taula d'usuaris; l'historial de commits diu qui ha aprovat què. Es
  farà només després d'una temporada d'ús en solitari.
- **Confirmació del primer remitent.** El disseny antic (etiquetes de Gmail +
  propietats de script) mor amb Apps Script. Quan calgui, l'equivalent natural és
  una llista `remitents.json` al repositori gestionada pel Worker. No dissenyar-ho
  fins que faci falta.
- **Respondre des de `agenda@clm.cat`** («send mail as» amb relay SMTP): feina
  separada, només quan la recepció porti temps rodant.
- **Adreça atrapa-ho-tot `*@clm.cat`:** xarxa de seguretat contra errates, a canvi
  de brossa. Decisió del propietari, cap codi.
