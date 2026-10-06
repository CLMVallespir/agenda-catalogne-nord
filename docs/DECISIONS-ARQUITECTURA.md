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
