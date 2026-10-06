# COORDINACIO.md — Claude Chat ⇄ Claude Code

> Protocol de treball entre els dos cervells del projecte. Viu a `docs/` perquè el
> coordinador de Claude Code el llegeixi a cada sessió. Els intercanvis (encàrrecs i
> informes) **no** van al repositori: viuen a `coordinacio/`, ignorat per git.
> Versió 1.3 · 6 d'octubre de 2026 — el paràgraf 4 de la capçalera comença
> comprovant el model de la sessió.

---

## 1. Qui fa què

| Rol | Qui | Decideix | No fa mai |
|---|---|---|---|
| Autoritat | Miquel | prioritats, criteri editorial, què s'accepta, `git push`, desplegar el Worker | — |
| Cervell estratègic | Claude Chat (projecte claude.ai) | què s'audita, en quin ordre es refà, l'arbitratge entre criteris, la redacció dels encàrrecs | executar res al Quefas2 de Miquel; donar per bo un informe sense contrastar-lo amb el codi |
| Cervell local (mestre) | el coordinador de Claude Code (la sessió principal) | com s'executa l'encàrrec, quan s'atura, la síntesi dels resultats dels sub-agents | tornar a decidir el que l'encàrrec ja ha decidit; `git push` |
| Mans | sub-agents `agenda-lector`, `agenda-auditor`, `agenda-implementador` | res: executen una tasca tancada | git; escriure `pendents.json`/`events.json`; decidir davant d'una ambigüitat (s'aturen i informen) |

**Ordre d'autoritat quan dues fonts xoquen:** el codi del repositori > `CLAUDE.md` >
l'encàrrec > el judici d'un sub-agent. Si l'encàrrec contradiu el codi o el
`CLAUDE.md`, el coordinador **no tria**: ho escriu a «Contradiccions» de l'informe i,
si la contradicció bloqueja la feina, s'atura.

**Compromisos de Claude Chat:** cap encàrrec sobre un estat no verificat; abans
d'escriure'n un, clona el repositori públic i comprova el hash que diu l'últim
informe; cada encàrrec porta recomptes esperats perquè el coordinador el pugui
desmentir. El clon públic no veu els fitxers no seguits del Quefas2: Claude Chat
no prediu mai l'estat de l'arbre de treball, només el de `main`. Tota referència a
un document (secció, línia) es comprova al text del repositori, no a la còpia de
l'skill que Claude Chat té carregada: no sempre coincideixen.

---

## 2. El canal

```
coordinacio/                      ← ignorat per git, al Quefas2 de Miquel
  encarrecs/ENC-NNN-tema.md       Claude Chat  → Claude Code
  informes/INF-NNN-tema.md        Claude Code  → Claude Chat
  informes/INF-NNN-annex-*.md     sortides llargues dels sub-agents
```

1. Claude Chat redacta `ENC-NNN`. Miquel el desa a `coordinacio/encarrecs/`.
2. Miquel obre Claude Code amb el model que diu l'encàrrec i escriu només la línia
   d'invocació de l'encàrrec. Mai copiar-enganxar textos llargs: el terminal els
   talla.
3. El coordinador fa la feina, escriu `INF-NNN` amb la plantilla del §4 i fa només
   els commits que l'encàrrec autoritza, amb rutes explícites. No fa push.
4. Miquel fa push i puja `INF-NNN` a Claude Chat **com a fitxer**.
5. Claude Chat comprova que el hash de l'informe és el de `main`, contrasta les
   afirmacions amb el codi i redacta l'encàrrec següent.

Un encàrrec, un informe, el mateix número. Una feina que es reprèn porta número nou.

---

## 3. Plantilla d'encàrrec (ENC)

- Capçalera: identificador, data, model del coordinador (`/model`), línia
  d'invocació, prerequisits.
- La capçalera estàndard, sempre (si Miquel en té una versió literal anterior dels
  paràgrafs 1–3, aquella mana; el 4 i el 5 són nous):
  1. Ets el coordinador. Executes aquest encàrrec llançant sub-agents un darrere
     l'altre, cadascun amb una tasca tancada, i en reculls els resultats. El judici
     —síntesi, priorització, quan aturar-se— és teu, no dels sub-agents.
  2. Només tu fas operacions git i només tu escrius `pendents.json` i
     `events.json`. Els sub-agents corren en seqüència, mai en paral·lel. Si una
     verificació falla o un recompte no coincideix amb l'esperat, atures la cadena
     i ho escrius a l'informe.
  3. Cada pas diu quin perfil de sub-agent el fa, amb quin model i quin esforç; no
     en facis servir cap altre.
  4. Primer de tot, el model: si el d'aquesta sessió no és el que diu l'encàrrec,
     atura't i digues-ho. Punt de partida:
     `git status --short --untracked-files=no` ha de ser buit; si no, atura't.
     Després, `git pull --rebase`: el curador i l'Action fan commits a `main` cada
     dia. Els fitxers no seguits no t'aturen i no els llegeixes: els llistes a
     l'informe. Tots els commits es fan amb rutes explícites, mai amb `git add -A`
     ni `git add .`.
  5. Pressupost: cap sub-agent no passa de 150.000 tokens de context. Una tasca de
     lectura que no hi cap es parteix en tasques tancades per grups de fitxers,
     una darrere l'altra, cadascuna amb un sub-agent nou. Les verificacions que
     fan servir git les fa el coordinador, i el text que torna `agenda-lector`
     (que no té l'eina d'escriure) el desa el coordinador.
- Objectiu en dues frases, amb el perquè.
- Què cal llegir (rutes i seccions) i què **no** cal llegir.
- Passos: per a cadascun, qui el fa, la tasca, el fitxer de sortida, la verificació
  amb recompte esperat i la condició d'aturada.
- FORA D'ABAST.
- Criteri de fi.

---

## 4. Plantilla d'informe (INF)

```
# INF-NNN — <tema>
Encàrrec: ENC-NNN · Data · HEAD: <hash> · Coordinador: <model>
Sub-agents: <perfil, model, esforç> per pas

## 1. Estat            fet | parcial | aturat — motiu en una frase
## 2. Evidències       ordres executades; recompte esperat vs obtingut
## 3. Troballes        amb identificador estable (ARQ-01, ARQ-02…)
## 4. Contradiccions   encàrrec ↔ codi ↔ documents (el codi mana)
## 5. Desviacions      què s'ha fet diferent de l'encàrrec, i per què
## 6. Preguntes        per a Claude Chat, numerades, cadascuna amb la
                       resposta que recomana el coordinador
## 7. Fitxers i commits — llista amb hash, o «cap»
```

Cap afirmació sense evidència d'aquesta sessió (`fitxer:línia` o sortida d'una
ordre). Les sortides llargues van als annexos.

---

## 5. Criteris de qualitat — i qui guanya quan xoquen

Tres fonts: les regles del projecte, *Clean Code* (Robert C. Martin) i la idea de
**mòduls profunds** de John Ousterhout, que és la base de l'skill
`improve-codebase-architecture`. No sempre diuen el mateix. Aquest ordre decideix.

| # | Criteri | Font |
|---|---|---|
| C0 | **Invariants** del `CLAUDE.md` §3–§5: contracte de 18 camps, estats, ordre de les escriptures, zero dependències, un sol Worker. Una proposta que en trenca un es descarta o es marca «cal decisió de Miquel». | Projecte |
| C1 | **Reparabilitat:** Miquel pot obrir el fitxer d'aquí a sis mesos i arreglar-hi un error tot sol. És l'àrbitre de qualsevol conflicte entre els criteris de sota. | Projecte |
| C2 | **Localitat:** un concepte (una regla editorial, un mapatge, l'enum) es llegeix i es canvia en un sol lloc. | Ousterhout |
| C3 | **Profunditat:** la interfície d'un mòdul és petita respecte del que fa; fora les funcions que només passen la pilota. Prova de l'esborrat: esborrar-lo concentra la complexitat o només la canvia de lloc? | Ousterhout |
| C4 | **Cap coneixement duplicat.** Quan un context d'execució obliga a duplicar (Worker enganxat, navegador sense mòduls, Node), una verificació detecta la deriva, com fa `verifica-enum.js`. | Clean Code |
| C5 | **Noms que diuen la intenció**; una funció, una feina, al nivell d'abstracció del mòdul. | Clean Code |
| C6 | **Fallades visibles:** cap error engolit; cada missatge diu què cal fer. | Clean Code + `CLAUDE.md` §5 |
| C7 | **Cada servei extern en un sol lloc:** Gemini, API de GitHub, Brevo, Cloudinary, Tourinsoft. | Clean Code |
| C8 | **Comprovable per la interfície** amb `node:test` i `node:assert`, que venen amb Node: zero dependències. | Clean Code + Ousterhout |

**Conflictes ja resolts** — no cal tornar-hi:

- **Comentaris.** *Clean Code* els considera un fracàs d'expressió; aquí el
  comentari d'una línia per funció és obligatori perquè el propietari no és
  programador. Guanya el projecte. Però el comentari diu què fa la funció i què
  retorna, o per què existeix; mai repeteix la línia de sota.
- **Mida de les funcions.** *Clean Code* parteix fins a funcions molt curtes;
  Ousterhout avisa que això produeix mòduls superficials. Una funció que es llegeix
  de dalt a baix no es parteix només per escurçar-la; es parteix quan el tros té
  nom propi al domini o es reutilitza.
- **«Deixa-ho més net del que t'ho has trobat».** Xoca amb «només toques els
  fitxers de l'encàrrec». Guanya l'encàrrec; el que es veu de passada va a
  l'informe.
- **Classes, polimorfisme, injecció de dependències, capes d'arquitectura.** No
  s'apliquen: funcions de JavaScript sense compilació.
- **Una costura amb un sol adaptador és hipotètica.** No es crea cap interfície
  «per si de cas». Un fals per a proves compta com a segon adaptador.

**Vocabulari d'arquitectura** (skill `codebase-design`): mòdul, interfície,
implementació, profunditat (profund / superficial), costura (*seam*), adaptador,
palanca (*leverage*), localitat. **Vocabulari de domini:** `CLAUDE.md` §4, §4 ter,
§5 i `docs/CRITERI-EDITORIAL.md`.

---

## 6. Regles per a qualsevol refactorització

1. **Primer la xarxa.** Cap mòdul es refà sense proves de caracterització que fixin
   el comportament d'ara (`node:test`), escrites i en verd **abans** del canvi, en
   un commit separat.
2. **Comportament idèntic, demostrat.** Una refactorització no canvia cap sortida:
   les mateixes proves en verd, `verifica-enum.js` i `verifica-camps.js` en verd i,
   si toca la ingestió ADT66, la passada en sec sobre un flux congelat amb una
   sortida idèntica a la d'abans.
3. **Un candidat per encàrrec.** Mai una refactorització barrejada amb un arranjament
   d'error o amb una funcionalitat.
4. **El Worker es desplega enganxant.** Tot canvi a `worker/worker.js` regenera
   `worker/worker-concatenat.js` al mateix commit. Desplegar és decisió de Miquel.
   Abans del commit i abans d'enganxar, `node eines/verifica-worker-concatenat.js`
   en verd.

---

## 7. On queden les decisions

- Decisió d'arquitectura acceptada, o candidat rebutjat amb una raó que caldrà
  recordar → una entrada a `docs/DECISIONS-ARQUITECTURA.md` (fa de registre
  d'ADR). No es crea `docs/adr/` ni `GLOSSARY.md`: el vocabulari ja és al
  `CLAUDE.md`.
- Lliçó puntual → `NOTES.md`, com sempre.

---

## 8. Registre

El coordinador actualitza la fila del seu encàrrec al final, dins el commit de
l'encàrrec.

| ENC | Data | Tema | Estat | Resultat |
|---|---|---|---|---|
| 000 | 2026-10-03 | Posada en marxa del protocol | fet | 3 edicions + `git mv` de l'auditoria de juliol; verifica-enum i verifica-camps en verd (INF-000) |
| 001 | 2026-10-03 | Auditoria d'arquitectura | fet | 7 candidats (ARQ-01–ARQ-07); recomanació principal ARQ-01, la passada en sec de l'Action reproduïble (INF-001) |
| 002 | 2026-10-06 | Protocol v1.2 i verificador del Worker enganxable (ARQ-03) | fet | protocol v1.2; `verifica-worker-concatenat.js` en verd (A 4950, bàner 25, B 2064) i primera prova `node:test`, 5/5 en verd (INF-002) |
| 003 | 2026-10-06 | La xarxa de la passada de l'Action (ARQ-01, primera part) | pendent | — |
