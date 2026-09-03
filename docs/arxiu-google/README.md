# docs/arxiu-google — codi mort, conservat com a registre

**Res d'aquesta carpeta no s'executa.** És el sistema anterior de l'agenda, el
que vivia dins d'un full de càlcul de Google amb Apps Script. Va quedar
substituït pel Worker de Cloudflare durant les fases 1–3 i **retirat de l'ús
viu el 29 d'agost de 2026** (Fase 4, «tall de cinta»).

Es conserva, no s'esborra, per una raó pràctica: durant anys serà l'única
explicació de per què certes decisions del sistema nou són com són. Diverses
notes de `NOTES.md` es refereixen a com ho feia l'Apps Script per explicar per
què el Worker ho fa d'una altra manera.

---

## Què hi ha

### El codi `.gs`

| Fitxer | Què feia | Qui ho fa ara |
|---|---|---|
| `setupSheet.gs` | creava el full `Esdeveniments` amb les 16 columnes | ningú: no hi ha full, l'estat viu a `pendents.json` i `events.json` |
| `processNewEmails.gs` | llegia el Gmail cada hora, cridava Gemini, pujava a Cloudinary i escrivia una fila | el gestor `email()` del Worker |
| `processBotSubmission.gs` | rebia el webhook del Typebot via `doPost()` | el gestor `fetch()` del Worker |
| `publishToGitHub.gs` | el menú «Agenda → Publica els esdeveniments aprovats» | `curador.html` (botons Publica i Rebutja) |
| `sendWeeklyDigest.gs` | el digest setmanal per comarca via Brevo | el gestor `scheduled()` del Worker |
| `digestHtml.gs` | l'HTML del correu del digest | `construeixHtmlDigest()` dins `worker/worker.js` |
| `utils.gs` | `creaId`, `valorPermes` i les constants compartides | còpies literals a `worker/worker.js`, `curador.html` i `importa-csv.js` |
| `tests.gs` | el runner de tests del menú «Agenda» | cap: el Worker es prova amb peticions reals i el curador amb un banc fals |
| `appsscript.json` | el manifest del projecte d'Apps Script | — |

`utils.gs` és el fitxer que encara val la pena obrir: `creaId()` i
`valorPermes()` s'han copiat literalment a tres llocs del sistema nou, i aquest
n'és l'original.

### Les guies del sistema antic

| Fitxer | Substituïda per |
|---|---|
| `pas-4-ingestio-correu.md` | `docs/pas-fase2-worker-email.md` |
| `pas-5-typebot-connexio.md` | `docs/pas-fase3a-worker-formulari.md` |
| `pas-7-publicar.md` | la Fase 1 de `FASES.md` (`curador.html`) |
| `pas-9-digest-brevo.md` | `docs/pas-fase3b-worker-digest.md` |
| `pas-proves-i-desplegament.md` | ja no aplica: no hi ha `tests.gs` ni cap editor d'Apps Script |

### Les dades

`esdeveniments-importacio.csv` és l'exportació del full en el moment de la
migració. El `pendents.json` inicial en va sortir, passant per `importa-csv.js`.

---

## El que queda fora d'aquesta carpeta

El **full de càlcul** i el **projecte d'Apps Script** viuen al compte de Google,
no al repositori. Retirar-los de l'ús viu —desactivar-ne els activadors— és una
feina manual dins de l'editor de Google que no es pot fer des d'aquí; consulta
la Fase 4 de `FASES.md`.

El **Gmail d'arxiu** sí que continua viu, però amb un paper molt més petit: ja
no hi corre cap script, només hi arriba el correu que el Worker hi reenvia. És
el registre permanent de cada tramesa original.
