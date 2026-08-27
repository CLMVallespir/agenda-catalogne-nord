# NOTES.md — lliçons apreses

*Una lliçó per entrada, amb un resum d'una línia. El perquè hi és sempre: si
una nota no diu per què, d'aquí sis mesos no serveix de res. Les notes que
resultin errònies s'esborren, no es maten a comentaris.*

---

## Publicar escriu `events.json` ABANS que `pendents.json`

**Resum:** l'ordre de les dues escriptures no és casual; capgirar-lo pot perdre
un acte.

Publicar un acte són dues crides separades a l'API de GitHub — afegir-lo a
`events.json` i treure'l de `pendents.json` — i no hi ha manera de fer-les
alhora. Sempre hi ha una finestra on la primera ha reeixit i la segona encara no.

Si es fes al revés (treure de la cua primer), una fallada enmig deixaria l'acte
fora de la cua i fora d'`events.json`: perdut, i sense cap rastre a la pantalla
que ho digués. Fent-ho en aquest ordre, la mateixa fallada deixa un **duplicat
visible** a la cua: l'acte ja és publicat i encara surt per revisar. És lleig,
però es veu i es pot arreglar rebutjant la fila.

La regla general que se'n treu: **quan dues escriptures no poden ser atòmiques,
ordena-les perquè la fallada intermèdia dupliqui, mai perquè esborri.**

`curador.html` ho fa així a `publica()`, amb dos `try` separats justament perquè
el segon pugui donar un missatge diferent: «Publicat a events.json, però no l'he
pogut treure de la cua».
