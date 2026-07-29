# Tipografies autoallotjades

El web fa servir dues famílies de lletra, allotjades aquí mateix (cap
dependència externa en temps d'execució, cap crida a Google Fonts).

| Rol | Família | Llengua |
|---|---|---|
| Títols, capçalera, mes, número de dia | **Fraunces** | català |
| Etiquetes, filtres, lloc/hora, dia de la setmana, descripció catalana | **Montserrat** | català / UI |
| Descripció francesa, subtítol francès, mes en francès | **Georgia** (cursiva, font del sistema) | francès |

Georgia ja ve amb el sistema, no cal descarregar-la.

## Quins fitxers cal posar en aquesta carpeta

Calen **4 fitxers .woff2** amb aquests noms exactes (els noms han de coincidir
amb els `@font-face` de `style.css`):

```
fonts/fraunces-700.woff2
fonts/fraunces-900.woff2
fonts/montserrat-400.woff2
fonts/montserrat-600.woff2
```

## Com obtenir-los (gratuït, llicència SIL Open Font License)

1. Obre **google-webfonts-helper**: https://gwfh.mranftl.com/fonts
2. Busca **Fraunces**.
   - Charset / subset: deixa només **latin** (ja cobreix els accents
     francesos i catalans i el punt volat «l·l»).
   - Estils (weights): marca **700** i **900**.
   - Baixa, descomprimeix i reanomena els dos `.woff2` a
     `fraunces-700.woff2` i `fraunces-900.woff2`.
3. Repeteix amb **Montserrat**: subset **latin**, estils **400** i **600**;
   reanomena a `montserrat-400.woff2` i `montserrat-600.woff2`.
4. Posa els 4 fitxers en aquesta carpeta `fonts/` i fes el commit al repositori.

Mentre els fitxers no hi siguin, el web no es trenca: mostra Georgia per als
títols i la sans del sistema per al cos, i canvia automàticament a les lletres
bones quan els fitxers existeixen (`font-display: swap`).

> Nota: si vols el màxim de personalitat als títols, Fraunces també existeix com
> a font variable (un sol fitxer amb tots els pesos i la mida òptica). No cal,
> però; els pesos estàtics 700/900 ja queden molt bé.
