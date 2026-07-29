# Pas 8 — Aplicació web (frontend)

Estat: **fet** (construït el 12-06-2026). No depèn de Google: funciona amb el dipòsit GitHub del Pas 6.

## Què s'ha construït

- `index.html` — estructura de la pàgina: capçalera, filtres, llista, peu.
- `style.css` — estil «sang i or» (vermell i groc de la senyera sobre fons crema), responsive.
- `app.js` — carrega `events.json`, amaga els esdeveniments passats, ordena cronològicament, agrupa per mes i aplica els filtres de comarca i categoria. Vanilla JS, sense dependències.
- `events-exemple.json` — dades fictícies per provar l'aspecte sense publicar res.

## Comportament

- **Llista cronològica** agrupada per mes (títol de mes bilingüe).
- **Filtres**: botons de comarca (Totes + les 5) i selector de categoria (bilingüe). Es poden combinar.
- **Bilingüe**: descripció catalana primer, francesa a sota en cursiva.
- **Esdeveniments passats**: s'amaguen automàticament (`data_fi` anterior a avui).
- **Esdeveniments de diversos dies**: mostren «Fins al … · Jusqu'au …».
- **Sense data d'inici vàlida**: l'esdeveniment no es mostra (no es pot situar a la llista).
- **Imatge**: només si `imatge_url` no és buida. **Enllaç al títol**: només si `font_url` no és buida.

## Com provar-ho

### Opció A — en línia (recomanada)

1. Pugeu els fitxers nous/actualitzats al dipòsit GitHub (web upload, com al Pas 6): `index.html`, `style.css`, `app.js`, `events-exemple.json`.
2. Obriu la vostra URL de GitHub Pages **amb `?prova=1` al final**, per exemple:
   `https://USUARI.github.io/DIPOSIT/?prova=1`
3. Amb `?prova=1` l'aplicació carrega `events-exemple.json` (dades fictícies). Sense el paràmetre, carrega `events.json` (ara buit: veureu el missatge «Encara no hi ha esdeveniments publicats»).

### Opció B — en local

Cal un petit servidor (el navegador no deixa llegir `events.json` obrint el fitxer directament). Si teniu Python:

```
cd carpeta-del-projecte
python -m http.server 8000
```

I obriu `http://localhost:8000/?prova=1`.

## Llista de comprovació

- [ ] Sense `?prova=1`: missatge «Encara no hi ha esdeveniments publicats».
- [ ] Amb `?prova=1`: 11 esdeveniments visibles (10 benignes + 2 hostils − 1 de passat), agrupats de juny a novembre del 2026.
- [ ] El «Concert de prova (passat)» del maig NO apareix.
- [ ] El botó «Vallespir» en deixa 2 (exposició de Ceret i ball de Prats) — més la prova hostil de data_fi, que és de Vallespir.
- [ ] El selector «Música» en deixa 1 (Festa de la Música).
- [ ] L'exposició de Ceret mostra la imatge i «Fins al 30 d'agost · Jusqu'au 30 août».
- [ ] El ball de Prats té el títol enllaçat (font_url d'exemple).
- [ ] En mòbil (o finestra estreta) tot es llegeix bé i els filtres queden enganxats a dalt.

### Ullada de 2 minuts als casos hostils (`?prova=1`)

`events-exemple.json` inclou 2 esdeveniments hostils (novembre 2026) per veure renderitzats els camins que l'auditoria §4.2 va revisar en codi. Comprova:

- [ ] **Es carrega** sense error (cap pàgina en blanc).
- [ ] La «Prova hostil: comarca i categoria fora d'enum» (comarca `Occitània`, categoria `Circ`) **només surt a «Totes»**: no apareix cap botó ni opció nova als filtres, i seleccionar qualsevol comarca/categoria coneguda l'amaga sense trencar res.
- [ ] Enlloc no es veu la paraula **«undefined»**.
- [ ] La «Prova hostil: data_fi malformada» (`2026-13-99`) **no** mostra cap «Fins al …» ni cap **separador « · » orfe** al final de la línia meta.
- [ ] Filtrant fins que no quedi cap resultat, surt el missatge «Cap esdeveniment no coincideix amb els filtres».

## Notes

- Les dades d'exemple són fictícies; la imatge de mostra ve de picsum.photos.
- El peu de pàgina té un `TODO` al codi per afegir-hi l'adreça de contacte quan el compte Workspace estigui llest (passos 4–5).
- `events-exemple.json` pot quedar-se al dipòsit: no afecta l'aplicació normal.
