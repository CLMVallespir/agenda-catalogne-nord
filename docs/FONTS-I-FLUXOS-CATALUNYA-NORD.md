# Fonts i fluxos — Catalunya Nord

*Sondejat el 29 d'agost de 2026, amb `eines/sondes-fonts.js` (guió escrit el
28 d'agost). Aquest document no existia al repositori abans d'ara — és la
primera versió, no una actualització.*

## Estat de les quatre fonts investigades

| Font | Estat | Motiu |
|---|---|---|
| Tourinsoft/ADT66 | **CONFIRMADA** | Metadata (200, JSON real) i flux diferencial (200, atom+xml, 1,4 MB) responen amb el GUID existent (`60a37063-5667-45f8-82e1-a1db2d8375b9`). Monitoratge per codi pur, sense LLM, viable ja. |
| WordPress REST | **TANCADA, negativa** | 14 de 19 dominis municipals són WordPress viu amb `/wp-json/wp/v2/types` accessible; cap declara un tipus d'esdeveniment reconegut. No és font de nivell 1 amb l'estat actual. No reobrir sense motiu concret per revisar un poble a mà. |
| CMS de rutes `.htm` (Ceret / el Voló) | **INCONCLUSIVA, aparcada** | La sonda talla la lectura a ~4.000 bytes i no hi ha trobat cap rastre RSS/ICS/XML dins d'aquesta finestra. No és prova que no n'hi hagi més avall de la pàgina — necessita una lectura més profunda si mai es prioritza aquesta font. |
| IntraMuros | **Dos punts finals diferents, cap dels dos operatiu encara** | Vegeu la secció dedicada. |

## IntraMuros — dos punts finals, no un

1. **`api.appli-intramuros.com/_public/events/`** — el que crida el widget
   des del navegador (trobat per DevTools de Miquel). Sense clau visible al
   tràfec del navegador. La sonda (`node`, sense capçaleres de navegador) hi
   rep un `403` de 38 bytes — molt probablement un WAF que distingeix client
   navegador de client script. **No confirmat com a accessible per codi.**
2. **`data.appli-intramuros.com/events/`** — el que mostra la pàgina de
   configuració del widget (`widget.intramuros.org`) com a via oficial,
   explícitament etiquetat «Clé d'API nécessaire. Pour obtenir votre clé,
   contactez votre commercial IntraMuros ou contact@intramuros.org».

Els dos apunten al mateix `city-id=5299&agglo-id=595` (Prats de Molló), però
són mecanismes diferents: un és el trànsit intern del widget (bloquejat per
WAF fora del navegador), l'altre és l'API de partner, documentada, amb clau.

**Acció en curs:** correu redactat a `contact@intramuros.org` demanant la
clau per a `data.appli-intramuros.com`, en qualitat d'associació cultural
sense ànim de lucre. Estat de l'enviament: **pendent de confirmar amb
Miquel** — data no registrada perquè no es coneix encara.

## Ordre de treball que en va sortir (28 d'agost)

1. Comprovar `cdt66.tourinsoft.com` a l'API v3 — fet, confirmat.
2. Detecció de WordPress REST sobre els dominis municipals — feta, negativa.
3. Mirar si IntraMuros té API — feta, dos punts finals, cap operatiu encara.
4. Identificar el proveïdor del CMS de rutes `.htm` — identificat com a
   producte francès d'abast nacional (compartit amb Meylan, Clichy); flux
   RSS/ICS/XML no confirmat.
5. Els dominis amb 403 i els calendaris dinàmics queden per a la recerca
   manual periòdica.

## Vocabulari d'events del CMS `.htm`, ja recollit (el Voló)

Per mapar una sola vegada cap al nostre enum de tretze categories, quan aquesta
font es prioritzi:

Action citoyenne · Débat/Conférence · Exposition · Foire · Jeux ·
Portes ouvertes · Projection, cinéma · Rassemblement/réunion · Sport ·
Stage/Atelier · Thé dansants · Visite guidée

## Notes de mètode, per a properes rondes

- No demanar mai a una recerca externa (Manus o similar) que redacti
  descripcions, proposi topònims catalans, o assigni categories lliurement:
  les tres coses s'han hagut de desfer en importacions anteriors.
- Les xarxes socials (p. ex. Facebook d'un ajuntament) poden ser més fiables
  que la pàgina web oficial per verificar una data puntual, però no s'han
  d'usar com a enllaç estable a l'agenda.
- Els dominis que bloquegen l'accés automàtic (403 o robots.txt) sovint són
  els que retenen més material propi (cartells inclosos) — no és mala sort,
  és protecció de contingut.
