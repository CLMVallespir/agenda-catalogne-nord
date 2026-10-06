# DECISIONS-ARQUITECTURA.md — registre de decisions

> Registre d'ADR del projecte, segons `docs/COORDINACIO.md` §7: decisions
> d'arquitectura acceptades i candidats rebutjats amb una raó que caldrà
> recordar. Una entrada per decisió, numerada `D-NN`.

---

## D-01 · 2026-10-06 · La canonada de recerca es queda, en espera

Mòduls d'eines/: pipeline-offline, processa-lot, mapeja-recerca,
classifica-editorial i verifica-esdeveniment. No els carrega ni el Worker
ni l'Action.

Decisió (Miquel): es queden al seu lloc per al projecte de tri.
Mentrestant, no s'auditen, no es refan i no es connecten sense una
decisió nova. Els verificadors els continuen cobrint, i cada canvi
d'esquema els actualitza.

Revisió: el 31 de desembre de 2026, o abans si acaba la prova de
Jev o Clef (pas 5 de l'episodi 3). Si la prova no compleix els criteris
del pas 4, s'arxiven tots cinc. Si els compleix, es mira quins fa servir
la integració, i la resta s'arxiva.

---

## D-02 · 2026-10-06 · La passada de l'Action es prova des de fora, sense costura nova

ARQ-01 proposava dues parts: una prova de caracterització i, després, obrir la
interfície de `sincronitzaProgramada()` perquè hi entressin el flux, la lectura dels
fitxers i el rellotge. Només es fa la primera. La prova congela el rellotge amb els
temporitzadors simulats de `node:test` i substitueix el flux des de fora: la
interfície no creix (criteri C3 de `docs/COORDINACIO.md`) i el codi de producció no
canvia.

Es reobre si la simulació del rellotge deixa de funcionar en una versió de Node o si
una refactorització la torna trencadissa.

## D-03 · 2026-10-06 · `CLAUDE.md`, única descripció del projecte

El projecte es descrivia en cinc llocs més: `PROJECT-KNOWLEDGE.md`,
`TECH-KNOWLEDGE-BASE.md`, `PROJECT-KNOWLEDGE-CHAT.md`, `PROJECT-INSTRUCTIONS.md` i
una còpia de l'skill a `skill/`. Cap no s'havia tocat des de setembre, i el 6
d'octubre contradeien el codi. Decisió (Miquel): s'arxiven a `docs/arxiu/` i no es
corregeixen. La descripció vigent és només `CLAUDE.md`; Claude Chat la llegeix
directament del repositori públic.

Una còpia nova de la descripció (per a una eina, un skill o un projecte de Claude)
es genera a partir de `CLAUDE.md` quan cal, i no es desa al repositori.
