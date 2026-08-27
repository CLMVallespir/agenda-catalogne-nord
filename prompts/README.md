# Prompts

## extract-event.txt

Prompt enviat a l'API de Gemini (`gemini-2.5-flash`, Google AI Studio) pel script d'ingestió de correus (Pas 4). Converteix el cos d'un correu en un objecte JSON amb els 16 camps de l'esquema.

> **Còpia mestra:** la mestra és **aquest `extract-event.txt`**. La constant `EXTRACTION_PROMPT` de `worker/worker.js` n'és una còpia que ha de ser-hi idèntica, byte a byte (verificada el 27 d'agost de 2026: 3 773 bytes, iguals). Es compara **tal com Git els guarda**, amb salts LF: al disc, a Windows, aquest `.txt` es veu amb CRLF i fa 3 824 bytes, que és cosa de `core.autocrlf` i no cap diferència de text. Si en canvies una, canvia l'altra.
>
> Hi ha una tercera còpia, a `apps-script/processNewEmails.gs`: és el camí antic d'Apps Script, que la Fase 4 retirarà. Mentre les dues canonades roden en paral·lel, un canvi al prompt s'ha d'aplicar als tres llocs.

### Com funciona

- `{{AVUI}}` és un marcador que el script del Pas 4 substituirà per la data del dia (format AAAA-MM-DD). Serveix per deduir l'any quan el correu no l'indica.
- El cos del correu s'enganxa al final, després de la línia `CORREU:`.
- Els camps `id`, `imatge_url`, `font_url`, `estat` i `data_entrada` tornen sempre buits: els omple el sistema, no el model (l'`id` es reconstrueix amb `creaId`).

### Com provar-lo manualment (verificació del Pas 2)

1. Obre Google AI Studio (aistudio.google.com), tria el model `gemini-2.5-flash` i copia tot el contingut de `extract-event.txt`.
2. Substitueix `{{AVUI}}` per la data d'avui (per exemple `2026-06-12`).
3. Enganxa un dels correus de `exemples-test/` després de la línia `CORREU:`.
4. Envia i comprova el resultat amb la llista següent.

### Llista de verificació (per a cada un dels 3 correus)

- [ ] La resposta és només JSON: cap text al voltant, cap bloc ```.
- [ ] Hi ha exactament les 16 claus de l'esquema, totes presents.
- [ ] Els camps desconeguts són `""` (mai `null`, mai absents).
- [ ] `comarca` i `categoria` són exactament un dels valors permesos, o `""`.
- [ ] Dates en AAAA-MM-DD, hora en HH:MM.
- [ ] `descripcio_ca` té 2–4 frases en català natural; `descripcio_fr` n'és la traducció.
- [ ] `id`, `imatge_url`, `font_url`, `estat`, `data_entrada` són `""`.

### Resultats esperats dels correus de prova

| Correu | data_inici | hora | comarca | categoria |
|---|---|---|---|---|
| 1 estructurat (francès) | 2026-09-26 | 18:30 | Conflent | Música |
| 2 desordenat (català, sense any) | 2026-10-04 | 15:00 | Vallespir | Dansa i ball |
| 3 estil Facebook | 2026-10-10 | 21:00 | Cerdanya | Música |
