# NOTES.md — la història del projecte i les lliçons

*L'únic lloc on viu el passat de «Què fas?». `CLAUDE.md` diu com és el sistema
avui; aquest fitxer diu com s'hi ha arribat, quines decisions no s'han de
reobrir i quins errors no s'han de repetir. Abans de tocar una part, llegeix-ne
les entrades. Una lliçó per entrada, amb el perquè: una nota que no diu per què
no serveix de res d'aquí sis mesos. Les que resultin falses s'esborren. Dates
sempre absolutes.*

*Tot el que les etapes anteriors van deixar al repositori —el codi d'Apps
Script, els documents de coneixement antics, els handoffs, els sondeigs, les
auditories, la canonada de recerca, les eines d'un sol ús i el pla per fases—
es va esborrar el 23 d'octubre de 2026. Ho guarda l'historial de git:
`git log --diff-filter=D --name-only -- <ruta>` diu en quin commit va marxar un
fitxer, i `git show <commit>^:<ruta>` el torna a ensenyar.*

---

## 1. Cronologia

- **Juny de 2026.** Primera versió: un full de càlcul de Google, Apps Script
  que llegia el Gmail i cridava Gemini, i el web estàtic a GitHub Pages (12 de
  juny, disseny «sang i or»). Cloudinary amb preset *unsigned* el mateix dia.
- **Juliol.** Auditoria del codi i de la seguretat del sistema Apps Script. El
  que encara s'aplica al sistema d'avui és al §6.
- **20 d'agost.** `docs/CRITERI-EDITORIAL.md`, a partir de vuit casos que
  Miquel va decidir sobre la importació de tardor.
- **27 d'agost.** `CLAUDE.md` com a constitució i un pla per fases amb una
  porta per fase. Disseny blanc-i-negre i logotip «Què fas?». `postal-mime`
  3.0.0 vendoritzat.
- **29 d'agost.** En un sol dia: `curador.html`; el Worker amb `email()`,
  `fetch()` i `scheduled()`, desplegat a mà i amb el Git Build desconnectat; i
  el tall de cinta: Apps Script arxivat, full retirat, `pendents.json` sembrat
  des del CSV del full. Primeres peces del canal de l'ADT66. `nota_curador`
  entra a l'esquema.
- **30–31 d'agost.** Dates contínues i periòdiques, detecció de retirades,
  cartells forans a Cloudinary, comarca per poble, neteja del text de font.
- **3 de setembre.** Dedup contra els fitxers (capes 1 i 2). Rebutjar passa a
  marcar. L'enum de categoria resulta viure a catorze llocs: neix
  `verifica-enum.js`.
- **4 de setembre.** Segon context d'execució: l'Action de GitHub, amb el pas
  7 bis que tradueix cada fila al català. Finestra de 30 dies.
- **8–17 de setembre.** `periodicitat`, el camp 18è i públic. Neix
  `verifica-camps.js`.
- **22 de setembre.** La quota diària de Gemini s'acaba a mitja passada: 44 de
  les 46 últimes files entren en francès.
- **30 de setembre – 1 d'octubre.** La poda treu també les `pendent`
  caducades; publicar marca la fila en lloc de treure-la; la capa 1 llegeix
  tots els tags d'una nota; exclusions per criteri polític i tastos comercials.
  Quatre eines d'un sol ús repassen els fitxers d'aquells dies.
- **3–7 d'octubre.** Protocol Claude Chat ⇄ Claude Code
  (`docs/COORDINACIO.md`), encàrrecs ENC-000 a ENC-007 (§7), decisions D-01 a
  D-05 (§2), xarxa de proves de la passada de l'Action.
- **22 d'octubre.** Cua d'escriptura a `curador.html`; les peces d'estat
  passen a `curador-cua.js`.
- **23 d'octubre.** Gemini → Claude Haiku 5.5 al Worker i a l'Action. Neteja
  de les etapes anteriors (D-06). Miquel confirma que els activadors i el Web
  App d'Apps Script, i el full, ja no hi són.
- **27 d'octubre.** Els cartells d'octubre, a Cloudinary (151 pendents, 128
  publicats). El curador copia el cartell en publicar (D-07).
- **29 d'octubre.** Revisió de seguretat. `events.json` (718 KB, 451 de 584
  actes ja passats) anava cap al límit d'1 MB de l'API de continguts: el
  curador el poda a cada publicació (D-08). Neix `url-segura.js`: cap enllaç
  que no sigui http(s), ni a l'entrada de l'ADT66 ni al web ni al curador.
- **30 d'octubre.** `filaSegura()` a les tres portes, sostre d'entrada
  (D-09), CSP al curador i al web. Miquel enganxa el Worker: hi són vius
  Claude, ENC-007, `filaSegura()` i `admetEntrada()`.
- **31 d'octubre.** Cap fila en francès a la cua (D-10). Les 34 pendents sense
  versió catalana, rebutjades.

---

## 2. Decisions vigents

No es reobren sense una decisió nova de Miquel. Numerades com al registre del
protocol de coordinació.

- **D-01 · 6 d'octubre de 2026 · tancada el 23 d'octubre.** La canonada de
  recerca fora de línia (cinc mòduls que no carregava ni el Worker ni
  l'Action) es va deixar en espera. El 23 d'octubre Miquel la va fer esborrar:
  no formava part del sistema viu.
- **D-02 · 6 d'octubre.** La passada de l'Action es prova des de fora: el
  rellotge es congela amb els temporitzadors simulats de `node:test` i el flux
  se substitueix des de fora. La interfície de `sincronitzaProgramada()` no
  creix per a les proves. Es reobre si la simulació del rellotge es trenca amb
  una versió de Node.
- **D-03 · 6 d'octubre, ampliada el 23.** `CLAUDE.md` és l'única descripció
  del sistema, i `NOTES.md` l'única història. Una còpia per a una eina, un
  skill o un projecte de Claude es genera a partir d'ells quan cal i no es desa
  al repositori. Va néixer perquè cinc documents més descrivien el projecte, cap
  no s'havia tocat des de setembre i el 6 d'octubre tots contradeien el codi.
- **D-04 · 7 d'octubre.** Les portes manuals són permissives a posta: qui omple
  el formulari o escriu a `agenda@` s'ha pres la molèstia, i llevat de l'espam
  i d'un bon motiu, es publica. El correu només rebutja un text buit; el
  formulari, una tramesa sense títol ni data. Una admissió única per a les dues
  portes (ARQ-04) es va tancar sense fer-se: l'asimetria és petita i el Worker
  no té xarxa de proves.
- **D-05 · 7 d'octubre.** Una `data_fi` anterior a `data_inici` és un error. A
  l'ADT66 no es pot produir (les dates surten ordenades); a les portes manuals
  no es descarta: el Worker hi posa un avís a `nota_curador`.
- **D-06 · 23 d'octubre.** Neteja de les etapes anteriors. Fora del repositori:
  `docs/arxiu/`, `docs/arxiu-google/`, `FASES.md`, els handoffs, els sondeigs,
  les auditories, `docs/DECISIONS-ARQUITECTURA.md` (ara és aquest §2), la
  canonada de recerca, les eines d'un sol ús, `importa-csv.js` i el seu CSV,
  `wrangler.jsonc` i `.assetsignore`. La regla que en queda: **no es tornen a
  fer carpetes d'arxiu.** Una eina d'un sol ús s'esborra quan el seu resultat
  és commitat; un document de feina (handoff, sondeig, informe) s'esborra quan
  el que ensenya ha passat aquí o a `CLAUDE.md`.
- **D-07 · 27 d'octubre.** El cartell es copia a Cloudinary **en publicar**,
  des de `curador.html` (`copiaCartells()`), i no abans a mà. Va néixer perquè
  `cartells-a-cloudinary.js` no s'havia tornat a llançar des de l'1 d'octubre:
  el 27, 129 dels 146 actes vius del web mostraven la miniatura de 150 px de
  l'ADT66, il·legible al visor. Un pas manual que depèn de recordar-se'n
  s'oblida. Ara la pàgina prova l'original i després la miniatura
  (`variantsDeCartell()`), i si Cloudinary no en pot copiar cap **no publica**:
  el curador ho torna a provar o buida el camp. Mai no es publica un cartell
  d'un tercer. De retruc, una fila rebutjada ja no deixa cap còpia a
  Cloudinary. L'Action continua sense tocar Cloudinary.
- **D-08 · 29 d'octubre.** `events.json` només guarda actes que no han
  passat. Cada publicació del curador en treu, al mateix commit, els que
  tenen l'últim dia (`data_fi`, o `data_inici` si és buida) anterior a avui
  al rellotge del navegador (`podaEventsPassats()`), i el missatge del commit
  diu quants. Va néixer perquè res no el podava: el 29 d'octubre feia 718 KB i
  creixia uns 20 KB al dia, i l'API de continguts de GitHub —l'única via per
  on el llegeixen el curador, l'Action i el digest del Worker— deixa el camp
  `content` buit per damunt d'1 MB; hi hauria arribat cap al 12-14 de
  novembre. El web ja amagava els passats, el filtre de l'Action ja no els
  ofereix, i una fila treta queda a l'historial de git. La regla de «ja ha
  passat» és una de sola, `esCaducada()` a `curador-cua.js`, i la poda de
  `pendents.json` de l'Action la crida d'allà. Es reobre si mai es vol un
  arxiu públic d'actes passats: llavors, un fitxer apart.
- **D-09 · 30 d'octubre.** Un sostre numèric a tot el que entra, en un sol
  lloc per context. Al Worker, `admetEntrada()` (`eines/admet-entrada.js`, amb
  còpia literal): com a molt **20 files per dia** entre el correu i el
  formulari, comptades a `pendents.json` (data_entrada d'avui i cap tag de
  l'ADT66), i només els **20 000 primers caràcters** d'un correu van al model.
  El Worker llegeix la cua i decideix ABANS de cridar Claude: un correu no
  admès no costa res i és igualment a l'arxiu; el formulari respon 429. A
  l'Action, el sostre de files és el pressupost de crides (300; des de D-10,
  sense clau ja no s'encua res); la baixada del flux té un minut i 20 MB, i
  cada crida a Claude dos minuts. No és cap criteri editorial i no toca D-04: no mira qui envia ni què
  diu. Va néixer de la revisió de seguretat del 29 d'octubre (una riuada de
  correus gastava el crèdit i acostava `pendents.json` al límit d'1 MB). Ús real
  mesurat: 4 files per les portes manuals des del 28 d'agost, com a molt 3 en
  un dia. Es reobre si les associacions s'hi acosten: es canvia
  `MAX_FILES_PORTES_PER_DIA` i es copia al Worker.
- **D-10 · 31 d'octubre.** De l'ADT66, a la cua només hi arriba el que Claude
  ha escrit en català: títol, `descripcio_ca` i `descripcio_fr`. Dues portes.
  Abans de cap crida, `filtraCandidats()` descarta l'oferta sense títol o amb
  menys de 9 paraules de descripció (`MIN_PARAULES_DESCRIPCIO`). Després,
  `tradueixLot()` no torna ni les declinades ni les fallades: no s'escriuen,
  no es marquen, i el flux les torna a oferir. Sense clau no s'encua res, i si
  hi havia files a traduir i cap no ho ha estat, el run surt en vermell
  (`traduccioEnVerd()`). Va néixer de la cua: el 31 d'octubre 34 de les 70
  pendents eren en francès, i de les 110 files sense versió catalana que hi
  havien entrat mai, el curador no en va publicar cap (79 rebutjades, 31
  pendents) contra 220 publicades amb traducció. El 9 surt del flux real: cap
  publicada no en tenia menys (n'hi ha de publicades amb 9 i 10), i 30 de les
  110 declinades sí. Les 34 pendents en francès es van marcar `rebutjat` el
  mateix dia, per decisió de Miquel. La resta de camps buits (`categoria`,
  `lloc`, `hora`, `associacio`) no descarten res: també falten a files
  publicades. Les portes manuals no hi passen (D-04): qui vol que hi surti un
  acte que l'ADT66 dona mig buit, l'envia. Es reobre si el curador troba a
  faltar actes descartats: es baixa el llindar.

Decisions anteriors al registre, igual de tancades (el perquè és a la lliçó que
s'indica):

- `nota_curador` no arriba mai a `events.json` (29 d'agost) — §5.2.
- Rebutjar marca, no suprimeix: la memòria de rebuig (3 de setembre) — §5.4.
- Publicar marca la fila com a `publicat` (1 d'octubre) — §5.2.
- El llindar de la capa 2 és 0,75 i no el 0,55 del dedup (3 de setembre) —
  `CLAUDE.md` §4 ter.
- El Worker només es desplega a mà (29 d'agost) — §5.1.
- Tota la Fenolleda va a Rosselló (31 d'agost) — `docs/CRITERI-EDITORIAL.md`.
- El Cinema d'Elna s'exclou només per l'adreça, 13 boulevard Voltaire (6
  d'octubre): una exclusió silenciosa és pitjor que una fila de més.
- Haiku i prou, amb pensament (23 d'octubre) — §5.5.

---

## 3. Activitats permanents (`periodicitat`)

Decidit entre el 8 i el 17 de setembre de 2026. El codi cita aquestes regles
pel seu nom.

- **Regla 3.** `periodicitat = ""` vol dir «acte puntual», no «no ho sabem».
  Per això les files antigues sense el camp són correctes i no cal reomplir-les.
- **Text lliure en català**, sense gramàtica de calendari ni cap motor que
  generi les dates de cada repetició. La vigència d'una permanent és la seva
  `data_fi`, i caduca pels mateixos camins que tot: `preparaEsdeveniments()`
  d'`app.js`, `podaCaducades()` i el digest. El curador aprova la recurrència
  un sol cop; les repeticions no tornen a la cua.
- **Q1.** L'ADT66 omple `periodicitat` (amb «cada setmana») només quan
  `COMMUNTHEME` és **exactament** «Marché hebdomadaire»: igualtat, mai
  subcadena. Mai no s'infereix de `TRI`, de `COMMUNDATE` ni de la descripció.
  La ZUMBA de Santa Maria la Mar és setmanal i té 22 dates escampades amb un
  salt mitjà de 3 dies: una heurística de salts hi hauria escrit una
  periodicitat falsa, i el lector hauria anat on no hi ha ningú. Si el senyal
  pot mentir, el camp queda buit i l'omple el curador.
- **Q2.** El col·lapse de dates de l'ADT66 i `periodicitat` són capes
  diferents; la franja de llarga durada (`DIES_LLARGA_DURADA = 5`) no es toca.
  Al web, les permanents **no tenen secció pròpia**: `app.js` les posa a la
  mateixa franja de llarga durada (`esLlargaDurada(e) || e.periodicitat`).
- **Q3.** En una fusió, una `periodicitat` plena guanya una de buida. Si totes
  dues són plenes i diferents, guanya la de la font de més rang
  (`JERARQUIA_FONTS`) i s'afegeix un avís amb `ajuntaNotes()`.
- **Q4.** El bloc de permanents del digest porta les permanents vigents
  (`data_fi >= avui`), tinguin o no data aquella setmana; `DIES_FINESTRA = 7`
  només governa la llista per dies. Una sola lectura d'`events.json`, dues
  llistes. Va per comarca: una permanent sense comarca no surt a cap digest.
- **Q5, no implementada.** El pas de traducció de l'Action hauria de traduir
  `periodicitat` dins la mateixa crida. No ho fa; l'impacte és petit perquè
  l'ADT66 només produeix «cada setmana», que ja és català.

---

## 4. El flux de l'ADT66

Fets de la font que no es veuen llegint el codi. Mesurats entre el 29 d'agost
i el 4 de setembre de 2026 sobre el flux sencer (1 463–1 543 ofertes).

- **On és.** `api-v3.tourinsoft.com` respon 302 cap a `wcf.tourinsoft.com`, i
  és allà on s'ha de llegir: la metadata de l'`api-v3` declara 22 camps; la del
  destí, 35. El WCF accepta `$filter=Updated gt datetime'…'`, no pagina (cap
  `odata.nextLink`) i dona el flux sencer en una sola resposta: una
  sincronització és un sol GET.
- **Organitzador: no n'hi ha.** Cap camp no diu qui organitza l'acte.
  `SyndicStructureId` és un GUID sense nom i `DETAILCONTACT` és buit a 1 213 de
  1 513 ofertes. Per això les regles R3, R4 (per organitzador) i R7 del criteri
  editorial no es poden fer amb codi: són del curador.
- **`CHAMPSYSTEME`** («Offre modifiée le … par X») diu quina oficina edita
  l'oferta, amb 28 editors (Perpignan Tourisme, OTI Pyrénées Méditerranée i OTI
  Conflent Canigó en fan més de 200 cadascuna). És l'únic indici de procedència
  del flux, i el mapeig el descarta.
- **`font_url`** surt de `DETAILSITEWEB`, que és el web de l'**organitzador**
  (151 dominis, cap de l'ADT66) i només hi és a 606 de 1 504 ofertes. El flux
  no porta cap adreça de cap fitxa de l'ADT66: el web departamental construeix
  les fitxes amb un `id_sheet` del seu CMS (`…-fr-{id_sheet}/`) que no és al
  flux. `tourisme-canigo.com/agenda/x-{id}/` resol per `SyndicObjectID` però
  cobreix un 14 % com a màxim. `…/Objects('{ID}')?$format=json` del WCF dona
  200 o 404: serveix de sonda, no d'enllaç. Decisió tancada: `font_url` =
  `DETAILSITEWEB` o `""`.
- **Dates.** `TRI` porta totes les dates d'una oferta, n'hi ha amb 470. Un acte
  és continu si les dates van seguides (un dia de buit tolerat) **i** l'abast
  no passa d'un mes; si no, és periòdic i es publica la propera ocurrència. Els
  dies no publicats d'una oferta periòdica es perden, sense enllaç de consol.
  Afecta el 14,9 % del flux.
- **Categories.** `RechercheTYPE` diu la forma de l'acte; el públic és a
  `COMMUNTHEME` («Pour enfant», «Conte» → `Activitat infantil`, i la categoria
  desplaçada queda escrita a la nota). Vuit valors de `RechercheTYPE` van sempre
  a revisió manual (Salon, Portes ouvertes, Rassemblement/réunion, Repas
  spectacle, Pot d'accueil, Action citoyenne, Arts de la rue, Concours), i
  `Concentració` no es pot omplir mai des d'aquesta font. Hi ha valors amb una
  coma a dins (`Projection, cinéma`): avui les dues meitats van al mateix
  calaix.
- **`DETAILFETEPAYANTE`** és un booleà d'entrada gratuïta, no un preu. El flux
  no porta cap import; els que hi ha són dins la descripció.
- **Etiquetes de formulari.** Set etiquetes franceses encapçalen els camps
  («Descriptif de la manifestation :», «Lieu :»…). `netejaTextFont()` treu
  aquestes set, i només a principi de línia: «Tarif : 5 €» és contingut.
- **Cartells.** L'`src` porta `?width=150&height=120`, una miniatura;
  `variantsDeCartell()` prova l'original primer i la miniatura després, i
  només per al domini de l'ADT66. `curador.html` en fa el mateix en publicar
  (D-07).
- **Retirades.** `detectaRetirades()` sap dir quines ofertes han caigut del
  flux entre dos instantanis, però no és connectada a res i no s'ha decidit on
  es desaria l'instantani anterior. Una anul·lació no es caça.
- **La regla que l'Action no ha de trencar mai: no reescriure una fila que ja és
  a la cua.** `curador-cua.js` troba la fila comparant-la sencera amb
  `JSON.stringify`; si l'Action la canviés mentre el curador la té oberta, el
  «Rebutja» fallaria amb «ja no era a la cua».
- **El cron de l'Action és comentat** (`.github/workflows/sincronitza-adt66.yml`).
  Avui la passada es llança a mà.

---

## 5. Lliçons

### 5.1 El Worker i el desplegament

**El que no es pot refer, fes-ho primer.** *29 d'agost de 2026.* `email()`
reenvia l'original al Gmail d'arxiu abans de fer res més. Un `try/finally` no
basta: el límit de CPU o un error dins el mateix `finally` el poden saltar, i un
correu que el Worker no reenvia desapareix, perquè Email Routing ja no el torna
a enviar. Si falta `ADRECA_ARXIU`, el correu es **rebutja** amb un avís bilingüe
i no s'escriu cap fila: val més que el remitent sàpiga que no ha arribat. Un
`finally` és per netejar, no per garantir.

**Al camí del formulari no hi ha arxiu de recanvi.** *29 d'agost.* Un correu
que falla és al Gmail i es pot tornar a processar; una tramesa del Typebot que
falla en escriure no és enlloc. Per això `respostaDelFormulari()` torna un
`500` explícit i mai un `200` mentider. No es construeix cap segon magatzem: es
recorda l'asimetria.

**Quan falta la clau del pany, la porta es tanca.** *29 d'agost.* Sense
`TYPEBOT_SECRET` configurat, el Worker rebutja tothom. El secret es comprova
abans del mètode i abans de llegir el cos: a qui no el porta, un `403` pelat; a
qui el porta, la veritat (`405` si el mètode no és POST).

**Dues vies de desplegament alhora es trepitgen en silenci.** *Fase 3a, agost.*
Amb el Git Build connectat i pedaços fets al tauler, cada empenta substituïa el
codi bo i el símptoma era `Handler does not export a fetch() function`: semblava
un error de codi i era una carrera. El senyal: la pestanya Deployments alternava
«Wrangler» i «Quick Editor» cada pocs minuts sense que ningú toqués res. Es va
desconnectar el Git Build i el 23 d'octubre se'n van treure els fitxers. A més,
la vista Quick Edit no sap afegir un segon mòdul: d'aquí el fitxer concatenat.
Per què el disseny de dos fitxers no anava pel camí de Git no es va arribar a
saber; si mai s'hi torna, cal provar-ho aïllat abans de refiar-s'hi.

**La configuració viu allà on la llegeix la via de desplegament que fas servir
de debò.** *29 d'agost.* Amb `wrangler deploy`, les variables de text del tauler
s'esborraven a cada desplegament. Amb el desplegament manual passa al revés: el
que es declara en un fitxer no ho llegeix ningú, i `CLOUDINARY_CLOUD_NAME` i
l'activador cron s'han de posar al tauler. Un cron que no existeix no deixa cap
registre; una variable que falta fa entrar els cartells sense imatge dies
després, sense cap error que ho relacioni. I **un Secret canviat no és viu fins
que es desplega**: si el registre diu que falta una variable que jures haver
posat, mira primer Deployments, i mira l'hora de l'entrada (es guarden tres
dies).

**El fitxer que es desplega no és el que s'edita.** *29 d'agost.*
`worker/worker-concatenat.js` és generat. Es toca `worker.js`, es regenera el
concatenat i s'enganxa sencer; mai al revés. `eines/verifica-worker-concatenat.js`
comprova la convenció abans d'enganxar.

**El codi del Worker que canvia sense desplegar fa mentir els documents.** *7
d'octubre.* Des de l'ENC-007, `worker.js` escriu avisos a `nota_curador`, però
el Worker desplegat no; durant setmanes `CLAUDE.md` deia una cosa i el repositori
una altra. Un canvi al Worker no és fet fins que s'ha enganxat: mentrestant, els
documents han de dir que està pendent.

**postal-mime no converteix l'HTML a text.** *29 d'agost.* En un correu només
HTML, `email.text` és `undefined`. Molts correus d'associació són així: sense
`textDeHtml()`, el model rebria només l'assumpte. I la comprovació de «correu
buit» s'ha de fer sobre el contingut, no sobre la cadena muntada
(`'Assumpte: ' + ''` mai no és buida).

**El cron de Cloudflare és en UTC: dues hores i un porter.** *29 d'agost.* Les
15.00 de París són les 13.00 o les 14.00 UTC. Una sola expressió,
`*/10 13,14 * * 2`, desperta el Worker dotze cops i `horaDeParis()` deixa passar
les de l'hora bona. Dos activadors farien sortir el digest dues vegades mig any,
i gastarien dues de les **cinc places de cron per compte**. Fes servir
`hourCycle: 'h23'`, no `hour12: false`, que en alguns motors dona «24» a
mitjanit.

**El servei que fa la feina ja guarda el registre de la feina.** *29 d'agost.*
La guarda del digest és el registre d'enviaments de Brevo (etiqueta
`digest-AAAA-MM-DD-comarca` + adreça), no cap fitxer. És per persona, no per
dia, i això és el que fa possible el digest amb **50 subpeticions per
execució**: cada despertada continua on va quedar l'anterior. Si el registre no
es pot llegir, no s'envia res: millor un digest de menys que dos a tothom.

**L'HTML de correu no és HTML web.** *Juliol.* Taules, estils en línia, cap
tipografia externa (Georgia/Arial), i cada camp dinàmic per `escapaHtml`. Un
correu transaccional no porta baixa automàtica: la línia de baixa i
`List-Unsubscribe` hi són perquè Brevo no els afegeix, i les baixes es treuen a
mà de la llista.

**Arxivar el codi d'un sistema no l'atura.** *29 d'agost.* El repositori i el
compte de Google eren dos llocs: mentre els activadors d'Apps Script visquessin,
els subscriptors haurien rebut dos digests. Quan retiris una cosa que s'executa
sola en un lloc que no controles des del repositori, la feina és apagar el que
la desperta. (Fet: confirmat el 23 d'octubre de 2026.)

### 5.2 El curador

**Quan dues escriptures no poden ser atòmiques, que la fallada dupliqui, mai que
esborri.** *29 d'agost.* Publicar escriu `events.json` primer i marca
`pendents.json` després. Al revés, una fallada enmig deixaria l'acte marcat i
fora del web, sense rastre; així deixa un duplicat visible a la cua.

**Una operació no atòmica ha de reconèixer la seva pròpia feina.** *29
d'agost.* `publica()` s'empassava «la fila ja no hi és» i `events.json` no
mirava si l'`id` ja hi era: dos clics, o dos curadors, publicaven el mateix acte
dues vegades. Ara els botons es bloquegen amb la mateixa bandera que apaga la
fitxa, i `idJaPublicat()` va **dins** la transformació que rep el reintent, de
manera que el segon intent ho torna a mirar. Un `id` buit no identifica ningú:
`creaId()` torna `''` sense data d'inici.

**Els 409 eren les escriptures del mateix curador, que topaven.** *22
d'octubre.* «is at b8724b4 but expected 1702a55» eren dos commits del curador a
cinc segons l'un de l'altre: GitHub rebutja un commit sobre una branca que s'ha
mogut, i l'únic reintent immediat tornava a topar. A més, la lectura de l'API de
continguts porta `Cache-Control: max-age=60`. Ara les decisions passen per una
cua: les que s'acumulen surten en un sol commit per fitxer, cada escriptura
parteix del SHA que ha tornat el PUT anterior, i en conflicte rellegeix (amb un
paràmetre `t` contra la memòria cau) fins a tres cops, a 1, 2 i 4 s.

**Publicar marca, no treu.** *1 d'octubre.* `events.json` no conserva
`nota_curador`, on viu el tag `[ADT66 id: …]`: si publicar treia la fila, la
sincronització ja no reconeixia l'oferta i la tornava a encuar. Ara la fila
queda a la mateixa posició amb `estat = "publicat"`, i la poda la treu quan
l'acte ha passat.

**Un camp de servei no travessa la frontera del públic.** *29 d'agost.*
`nota_curador` s'ensenya al curador i s'atura: `events.json` es baixa sencer a
qualsevol navegador, i una nota interna no informa ningú. L'avís no porta
`data-camp`, de manera que `recullFitxa()` ni el veu. No es perd: l'historial de
`pendents.json` el guarda. Abans de propagar un camp a un fitxer nou, pregunta
qui llegirà aquell fitxer.

**Si una acció pot llençar feina de l'usuari, ha de preguntar o desar.** *29
d'agost.* Recarregar la cua o activar el testimoni repintava des del fitxer i
buidava les correccions sense desar. Ara surt un avís. El senyal és un atribut
`data-editada` a la mateixa fitxa: no cal reiniciar cap comptador, perquè
`fitxa.remove()` se l'emporta sol. Els desplegables disparen `change`, no
`input`. La guarda va a les portes (el botó, l'activació), no dins
`carregaCua()`. Tancar la pestanya, en canvi, no avisa: triat a posta.

**Un avís que es confon amb un èxit és pitjor que no dir res.** *29 d'agost.*
Els avisos neutres («ja estava publicat», «la cua ha canviat») són grisos; el
negre és de «Publicat».

**La fila es troba comparant-la sencera.** `trobaIndex()` de `curador-cua.js`
fa servir `JSON.stringify`: aguanta que les files canviïn d'ordre, però no que
canviïn de contingut. D'aquí la regla del §4 que l'Action no reescriu files de
la cua. Si dues files són idèntiques, `treuDeLaCua()` les treu totes dues de la
pantalla fins que es recarrega.

### 5.3 L'Action i les fonts externes

**Quan una API redirigeix, la metadata que val és la del destí.** *29
d'agost.* Vam donar el flux de l'ADT66 per inservible llegint la metadata del
porter, i la conclusió era que calia escriure a l'ADT66 per demanar una cosa que
ja teníem. El senyal hi era: una agenda sense dates d'acte no té sentit. Si a
una font li falta justament el camp que la justifica, sospita de tu abans que
d'ella.

**Un 200 no és un èxit: mira la forma i la mida del cos.** *29 d'agost.* Un POST
amb els identificadors mal embolcallats tornava 200 i el flux sencer, 560
vegades més gran. Un web de turisme torna 52 kB idèntics per a un identificador
inventat. Si una lectura «diferencial» ho torna tot, sospita de la petició.

**Quota exhaurida i fila que falla sempre són dos casos.** *4 de setembre.*
Tractar el 429 com a «fila descartada» feia que una fila que peta sempre no
entrés mai, i no se la distingia d'una que només s'havia quedat sense torn.
Abans de decidir si un error descarta o encua, pregunta't si depèn de la fila o
del servei. Avui: fins a dos intents per fila; quota o límit de despesa aturen
la passada (`esQuotaExhaurida()`).

**Un límit de files i un pressupost de crides no es fusionen.** *4 de
setembre.* Un protegeix un recurs compartit i l'altre no; ajuntar-los en un
número amaga per a què serveix cadascun.

**Una crida per fila.** *4 de setembre.* Diverses fitxes en un sol missatge fan
que el model barregi les files i n'inventi, amb errors d'alineació que no es
veuen. Si falta capacitat, més passades, no lots.

**No passis al model els camps que ja tenen lloc propi.** *4 de setembre.* El
prompt de traducció no rep ni el municipi ni la categoria: si els veu, els
enganxa al títol.

**Un workflow programat s'apaga sol als 60 dies, i s'emporta el botó manual.**
*Setembre.* GitHub desactiva el `schedule:` d'un repositori públic sense
activitat, i amb ell el `workflow_dispatch` del mateix fitxer. Una temporada sense
actes és justament quan passarà, i una cua que no creix sembla una cua al dia.
Un commit qualsevol reinicia el compte. Val el dia que s'activi el cron.

**Una font de tercers et pot tallar.** *3 de setembre.* `tourisme-canigo.com`
va deixar de respondre, també a `robots.txt`, després d'una vintena de
peticions seguides. No en facis dependre cap procés automàtic.

**No et fiïs del nom d'un camp de fora.** `DETAILFETEPAYANTE` no porta cap
preu; `aura` és el futur d'*avoir* («la fête aura lieu») i va marcar 27 ofertes
de 45 com a guia espiritual. Abans d'afegir un terme curt a una llista de
patrons, comprova que no sigui una paraula corrent de la llengua del text; i
deixa'l prou curt per aguantar errades de la font (`FORUM DES ASSOCATIONS`).

**Una font externa marca els buits de maneres diverses.** Absent, `""`,
`"null"` i `"n/a"` s'han de tractar igual. Un camp bilingüe «X / Y» no té ordre
fix entre llengües: es resol amb la taula d'equivalències, mai per posició.

**Una recerca externa no redacta, no posa topònims ni categoritza.** Ho va haver
de desfer més d'una importació. Qualsevol recerca que alimenti la cua porta les
dades de la font tal com són; el català i el calaix els posen el sistema i el
curador.

### 5.4 Dades, deduplicació i llindars

**La memòria de rebuig és un camp, no un magatzem.** *3 de setembre.* Amb una
font que torna cada setmana, rebutjar sense memòria vol dir rebutjar cada
setmana. La temptació era `rebutjats.json`; el camp `estat` ja tenia el valor
`rebutjat`. Abans d'afegir un magatzem, mira si l'estat que et falta ja té on
cabre.

**Una clau de comparació val el que valen les dades que hi entren.** *29
d'agost.* «Municipi + data» no lliga res entre fonts sense la taula de noms de
poble (Prats de Molló / PRATS-DE-MOLLO-LA-PRESTE). I els títols només es
comparen dins d'una llengua: entre llengües el veredicte és «dubtós», mai
«diferents». La taula viu un sol cop a `eines/pobles-alies.js` perquè creix:
**el que es copia ha de ser el que no creix.**

**Mesura d'on ve el volum abans d'escriure el filtre.** *4 de setembre.* El
dedup dins del lot treia 25 files de 1 373 (1,8 %). El volum era la finestra de
dates: 851 files començaven dins de 30 dies, i la finestra era de 12 mesos.

**La vora de sota d'una finestra és l'últim dia de l'acte.** *29 d'agost.* Amb
`data_inici`, el 19 % de les files reals —mercats d'un any, exposicions—
haurien sortit com a «passades» mentre eren obertes. Per sota mana `data_fi`;
per dalt, `data_inici`. Compta quantes files cauen a cada banda abans d'escriure
la comparació.

**Dibuixa la distribució abans de triar un llindar.** *30 d'agost.* El salt
entre dates semblava l'indicador de «periòdic»; un taller obert cada dia menys
diumenge té salt 2 i 223 dies d'abast. Feien falta dues condicions. Busca un
contraexemple on l'indicador i el problema convisquin.

**Un camp sempre buit pot venir d'un altre camp.** *31 d'agost.* La comarca no
és al flux, però el municipi la determina del tot: de 0 a 1 453 files amb
comarca. «La font no ho porta» i «la font no ho escriu però ho fixa» són dues
coses. I un avís que surt al 100 % de les files no és un avís, és un camp mal
omplert. Quan una decisió es dona amb exemples, escriu si són exemples o la
llista: «Sant Pau de Fenollet i Bellestar» eren els dos pobles a la vista, i la
regla era «la Fenolleda».

**Una fuita que fa aparèixer feina no és com una que fa desaparèixer
informació.** *4 de setembre.* Una fila fusionada dins el lot porta dos tags i
la capa 1 només en llegia un: la segona oferta tornava un cop com a `nova`. Es
va deixar així perquè empenyia cap a encuar. L'1 d'octubre es va tancar igual,
quan la capa 1 va passar a llegir tots els tags (`extreuIdentificadors()`) per
protegir les publicades. Compta les fuites segons cap a on empenyen.

**Quan un document es contradiu, mana la línia que es pot tornar a mesurar.**
*30 d'agost.* El handoff deia que `font_url` portava al calendari sencer, i ho
feia servir per justificar que es perdien dies; la taula de cobertura deia 606
de 1 504. La taula era la bona. Una frase que justifica una pèrdua amb una
compensació és on cal comprovar que la compensació existeix.

**Un URL de font pot ser una miniatura.** *31 d'agost.* Abans de normalitzar un
URL de tercers, mira què hi ha a les dues bandes: un paràmetre pot ser decoració,
la mida de la imatge o l'única cosa que la fa existir (`?itok=` de Drupal).

**«Camp ple» no vol dir «ja és nostre».** *31 d'agost.* La guarda de
`pujaCartell()` mira el domini, no si `imatge_url` és buit. Quan una guarda
sembla que buidi la peça de feina, pregunta quina propietat volies protegir.

**Una etiqueta de camp i una frase que hi sembla s'escriuen igual.** *31
d'agost.* El patró genèric «Paraula :» s'hauria menjat «Tarif : 5 €». El que
separa l'etiqueta de la frase és la posició i la llista tancada; comptar-les
(1 442 contra 3) va ser el que va tancar la llista.

**L'enum viu a molts llocs, i un recompte envelleix sol.** *3 de setembre.*
`CLAUDE.md` deia «quatre llocs» i en eren catorze. `Concentració` es va afegir a
dos, i una fila publicada va viure dies amb una categoria que `valorPermes()`
hauria buidat en desar-la. Quan una constant es copia a més de dos llocs, el
document porta la llista de llocs, no el número, i un guió la comprova
(`verifica-enum.js`, `verifica-camps.js`). Un camp que falta fa encara menys
soroll que una categoria dolenta: no deixa ni un buit.

**L'`id` no és únic.** *16 de setembre.* `creaId()` fa el slug amb les tres
primeres paraules, articles inclosos: «Fòrum de les associacions de…» de sis
pobles el mateix dia donaven el mateix `id`. Per identificar una fila, `id` tot
sol no val: `id` + `titol` + `municipi`.

**Una decisió evident amb dos elements pot ser insostenible amb cent.** *29
d'agost.* Comparar per parells i ajuntar-ho en un lot va fer sortir tres regles
noves: la fusió en cadena, les llistes exclusives i, sobretot, que una fila
sense clau forta feia parella «dubtosa» amb totes les altres i buidava el lot.
Abans de cridar en bucle una funció pensada per a un cas, mira què fa la seva
branca menys probable multiplicada per la mida del lot.

**Una funció que torna una còpia trenca els índexs per referència.** *29
d'agost.* Un `Map` indexat per l'objecte fila queda penjat de files mortes quan
una peça en torna una de nova; res no peta. La reindexació forma part de la
connexió.

**Una peça i el seu cablejat no tenen per què fer el mateix per defecte.** *29
d'agost.* Una peça que respon per la fila pot escriure «sense classificar»; el
cablejat que respon pel lot no l'ha de cridar si no hi ha res connectat, o un
lot de sempre sortiria canviat.

**Decideix si una peça informa o alerta.** *29 d'agost.* Una que informa parla
sempre; una que alerta calla quan no passa res, i llavors la feina és que tots
els fracassos parlin. El groc del curador ha de voler dir «atura't i mira».

**Una peça que no és idempotent obliga qui la crida a saber per on ha passat.**
Si afegeix una nota cada vegada, no es pot arreglar esborrant notes:
`nota_curador` no s'esborra mai. No es deriva cap valor que es pugui calcular
d'un altre (el dia de la setmana surt de la data), i el lloc no és l'adreça.

### 5.5 El model

**De Gemini a Claude Haiku 5.5: la quota, no la qualitat.** *23 d'octubre.* El
pla gratuït de Gemini donava 500 crides al dia **per projecte de Google**, i el
Worker i l'Action en compartien un: el 22 de setembre la passada es va menjar
la quota i 44 de 46 files van entrar en francès. L'organització té 40 $ al mes de
crèdit a Anthropic, que es renova sol, i Claude no té quota diària.

El compte, amb els preus d'Haiku 5.5 (0,10 $ / 0,50 $ el milió de tokens
d'entrada / sortida): una traducció al pitjor cas, 0,0047 $; una passada de
300 crides, 1,42 $; un mes de cinc dimarts, 7,12 $; un correu mesurat, uns
0,001 $. Sonnet costa vint vegades més i el pitjor mes no hi cabria: **Haiku i
prou.**

**Amb pensament, no sense.** *23 d'octubre.* Les mateixes 19 files de l'ADT66
revisades una per una: sense pensar, Haiku va trencar 12 regles dures del prompt
(dates o preus a la descripció, poble al títol, «jaguars» → «guepards»); amb
`thinking: adaptive` i `effort: high`, cap. El preu és que declina més: una fila
amb una sola frase de matèria va entrar en francès. D'aquí `max_tokens = 8192`
als dos contextos.

**Ha de fallar, no cobrar.** L'excepció del §3 de `CLAUDE.md` només val amb un
límit de despesa a la consola (Billing → Spend limits, o un workspace propi) no
més alt que el crèdit, i sense recàrrega automàtica. En arribar-hi, l'API torna
un 400 o un 429 i l'Action atura la passada; la resta torna la setmana
següent. Per jutjar el prompt sense escriure res:
`node eines/sincronitza-programada.js --en-sec --amb-claude --pressupost=20 --fitxes`.

### 5.6 Proves, eines i verificadors

**`eines/` no és una carpeta de proves.** *31 d'agost.* `for f in eines/*.js`
dispara `cartells-a-cloudinary.js`, que reescriu `pendents.json` si no se li
passa `--prova`. Les proves s'executen una per una. Un guió nou que escriu ho fa
només amb una bandera, mai per omissió.

**«En sec» no vol dir «sense xarxa».** `eines/proves-7bis.js` no crida el model
ni escriu res, però baixa el flux sencer (4,5 MB) a la memòria cau del sistema.

**Una mutació que no canvia res dona un fals verd.** *6 d'octubre.* `sed
'1500s/e/E/'` sobre una línia sense cap «e» va deixar el fitxer igual i la prova
en verd, amb raó. Abans de creure una prova sobre una mutació, comprova amb
`cmp` que el fitxer ha canviat, i fes sempre una passada de control sense canvi.

**Les dades personals d'un joc de proves no es buiden a cegues.** *6
d'octubre.* Dels camps que el codi llegeix, se substitueix només el tros (el
telèfon, el correu) i es comprova que cada oferta cau a la mateixa branca abans
i després. Una oferta sintètica pot caure en una altra regla: dues bases
triades per a «portes ouvertes» les excloïa «Tast comercial».

**El joc de dades de la xarxa de l'Action.** *6 d'octubre.*
`proves/dades/flux-adt66.json` són 42 ofertes de les 1 425 del flux d'aquell
dia, triades per branca de la passada (les tres primeres per `SyndicObjectID`),
amb els telèfons i correus substituïts. Dos escenaris: el 6 d'octubre i el 15
de novembre, perquè hi hagi poda. No cobreix el descart per paraula clau del
filtre previ ni el `ja_publicat` de la capa 2. L'esperat es regenera
(`node proves/regenera-esperat-passada.js`) només quan un canvi de comportament
és a posta, i el commit ho diu; mai en una refactorització. `recompte` es calcula
abans del filtre de finestra, i una oferta que canvia de branca mou també els
comptadors derivats.

**A Git Bash, `grep -c $'\r$'` menteix.** *6 d'octubre.* Amb
`core.autocrlf=true`, la font fiable dels finals de línia és
`git ls-files --eol`.

**Una condició de sortida ha de quadrar amb l'abast del verificador.** *16 de
setembre.* Una sessió deia «el verificador ha de tornar 0», però el verificador
mirava també la feina de la sessió següent.

**A `curador.html`, cap `<script>` escrit, ni dins d'un comentari.** *30
d'octubre.* `proves/curador-pagina.js` busca els scripts de la pàgina amb una
expressió regular, no amb un analitzador d'HTML: un comentari que deia «abans
de cap `<script>`» va fer caure les 36 proves alhora.

**Una CSP es prova en un navegador, no en Node.** *30 d'octubre.* Node no
l'aplica. Es va comprovar amb Edge sense finestra (`msedge --headless=new
--dump-dom`) i un servidor local: el codi en línia queda bloquejat, `index.html`
pinta les 199 targetes, el curador carrega la cua de GitHub, i dins d'un
`<iframe>` no arrenca.

### 5.7 Treballar amb agents i documents

**Una lectura ampla no la fa cap sub-agent: parteix-la abans.** *6 d'octubre.*
Un auditor va arribar a 450 000 tokens sense escriure res; en sis trossos, cada
un amb un sub-agent nou, va acabar. Màxim 150 000 per sub-agent.

**Els perfils de només lectura no poden escriure la seva sortida.** *6
d'octubre.* El coordinador desa el text que torna `agenda-lector` i fa ell les
comprovacions amb git.

**Un recompte d'una sessió anterior envelleix.** *6 d'octubre.* «6 962 línies»
eren 7 038; «una sola línia» eren tres. Als documents, la regla verificable, no
la xifra. Pel mateix motiu, a `CLAUDE.md` es cita pel nom del bloc o de la
funció, mai per `fitxer:línia`.

**Un rebase canvia el hash.** *6 d'octubre.* Per saber si un commit d'un informe
és a `main`, `git patch-id --stable`, no el hash.

**El que es crea fora d'un encàrrec es queda sense seguir.** *6 d'octubre.* Un
document nou no va entrar a cap commit fins que es va demanar a part, i en una
neteja de l'arrel 43 fitxers no seguits van desaparèixer sense cap rastre a git.
Tot fitxer nou que s'hagi de conservar es commita el mateix dia.

**La sessió no sempre corre amb el model que diu l'encàrrec.** *6–7
d'octubre.* I l'esforç d'un sub-agent el fixa el seu perfil, no la crida.

**Cinc descripcions del projecte acaben dient cinc coses.** *6 d'octubre.* El
dia que es van comparar amb el codi, cap no hi quadrava (D-03). Una descripció i
una història, i prou (D-06).

---

## 6. Deute conegut i pendents

Comprovat al codi el 23 d'octubre de 2026. Cada punt diu la funció o el fitxer,
no la línia.

**Seguretat i robustesa del Worker i del web**

- **El correu no va tancat ni declarat «només dades» dins el prompt** (el text
  va darrere de `CORREU:`). La protecció d'avui és que tota fila neix `pendent`.
  Si es corregeix, al prompt mestre i a la còpia del Worker alhora.
- **Qualsevol remitent d'`agenda@` gasta una crida**, fins al sostre del dia
  (D-09): una riuada ja no gasta el crèdit, però sí que tanca la porta a les
  associacions fins l'endemà. La confirmació del primer remitent és ajornada
  (`CLAUDE.md` §8).
- **Les hores de les portes manuals no es validen de format** (n'hi ha una
  «17:300» a la cua). Les dates sí, des de `filaSegura()`: una de malformada
  queda buida amb un avís.
- **`{{AVUI}}` es calcula en UTC** (`toISOString()`): de 00.00 a 02.00 de París
  dona el dia anterior. Només afecta la inferència de l'any.
- **El retorn de `reenviaAArxiu()` no es consulta.**
- **Cap porta del Worker no mira duplicats** abans d'escriure (D-04 ho
  accepta), i el Worker llegeix de GitHub sense `cache: 'no-store'` (el curador
  sí): primer sospitós si mai surt un 409 inexplicable al Worker.
- **El fracàs d'una comarca del digest només queda al registre**, que dura tres
  dies; el sostre de Brevo (`BREVO_MAX_DIARI`) també només avisa allà.
- **El digest no porta les exposicions llargues començades abans de la
  setmana**: tria per `data_inici`.

**Curador**

- El testimoni no es valida en activar-lo: un de caducat diu «Escriptura
  activada» i falla al primer PUT, amb un 401.
- `curador-cua.js` no comprova `Array.isArray` abans de transformar (el Worker
  sí): un JSON malformat dona un `TypeError` opac a mitja publicació.
- **`qui-som.html`, `mencions-legals.html` i `prova-local.html` no porten cap
  CSP**, i encara tenen el script del tema en línia (tres pàgines, quatre
  blocs). Són al mateix origen que el curador: el dia que es toquin, que
  carreguin `tema.js` i la mateixa `<meta>` que `index.html`.
- **El web públic es pot posar dins d'un marc**, a posta: no hi ha res a clicar
  que canviï res, i una associació podria voler-lo incrustar. El curador no.

**Action**

- El reintent 409/422 d'`escriuCua` torna a podar però no torna a classificar.
- El recompte «lot després de fusionar-los» no resta les excloses per criteri.
- `require('./deteccio-retirades.js')` es carrega a cada run des de la secció de
  proves d'`adt66-identificador.js`.
- La detecció de retirades no és connectada (§4), i on viu la `metadadades` del
  mapeig no és decidit (la recomanació és «enlloc»).
- Fusionar contra `events.json` (no només etiquetar) encara no es fa.
- Q5 de `periodicitat` (§3).
- El cron és comentat: activar-lo és decisió de Miquel.

**Codi**

- `creaId()` i les tres paraules (§5.4). Arreglar-ho vol dir tocar totes les
  còpies i reescriure ids ja publicats.
- `prova-local.html` encara afegeix el separador « · » abans de cridar
  `finsAl()`; `app.js` ja no.
- ARQ-02: quatre normalitzacions germanes de text (`normalitzaText` a
  `filtra-candidats.js` i `mapeja-adt66.js`, `normalitzaPerVisita`,
  `normalitzaPerExclusio`) sense cap verificador. Abans d'unificar-les cal
  decidir si «bd» → «boulevard» val només per a adreces.
- ARQ-05, a mitges: dues convencions de rellotge (UTC i París) conviuen; el
  comentari de `filtra-candidats.js` ho diu.
- `dedup-contra-fitxers.js` té un `filaDeProva()` escrit a mà quan el del veí
  es munta sobre `CAMPS`.

**Fora del repositori (Miquel)**

- Revocar la clau de Gemini i treure qualsevol `GEMINI_API_KEY` dels Secrets de
  Cloudflare i dels d'Actions.
- Al preset `agenda-posters` de Cloudinary: mida màxima (uns 10 MB), formats
  (`jpg,png,webp,gif,pdf`) i alerta d'ús. Si un PDF no es veu: Settings →
  Security → «Allow delivery of PDF and ZIP files».
- El token de GitHub de gra fi caduca: apunta la data de renovació. Quan caduca,
  el Worker i el curador fallen amb un 401.
- No consta per escrit cap observació del primer dimarts real del digest (la
  meitat de la porta de la Fase 3b que la prova manual no exercita).
- Una adreça personal va ser en un document arxivat d'aquest repositori públic.
  Esborrar el fitxer no la treu de l'historial de git; només ho faria reescriure
  l'historial, que el 23 d'octubre es va decidir no fer.
- Fonts noves en estudi: la clau de l'API d'IntraMuros i la font `.htm` de
  Ceret i el Voló (vegeu `SUIVI.md`).

---

## 7. Registre d'encàrrecs

ENC (Claude Chat → Claude Code) i el seu INF, segons `docs/COORDINACIO.md`. El
següent és l'ENC-008.

| ENC | Data | Tema | Resultat |
|---|---|---|---|
| 000 | 2026-10-03 | Posada en marxa del protocol | `.gitignore` i l'auditoria d'Apps Script a l'arxiu |
| 001 | 2026-10-03 | Auditoria d'arquitectura | set candidats, ARQ-01 a ARQ-07 |
| 002 | 2026-10-06 | Protocol v1.2 i verificador del Worker concatenat (ARQ-03) | primera prova amb `node:test` |
| 003 | 2026-10-06 | La xarxa de la passada de l'Action (ARQ-01, primera part) | 42 ofertes, les dues mutacions la posen en vermell |
| 004 | 2026-10-06 | `CLAUDE.md`, única descripció (D-03) | cinc documents arxivats, contradiccions de l'INF-001 corregides |
| 005 | 2026-10-06 | El Cinema d'Elna, exclòs només per l'adreça | dues ofertes sintètiques d'Elna a la xarxa |
| 006 | 2026-10-07 | El criteri editorial automàtic en un sol mòdul (ARQ-07) | `aplicaCriteriAutomatic()`, sense canvi de comportament |
| 007 | 2026-10-07 | Les portes manuals: imatge, dates invertides, D-04 i D-05 | fet; el Worker, enganxat el 30 d'octubre |

ARQ-04 es va tancar sense fer-se (D-04); ARQ-06 era la canonada de recerca
(D-01); ARQ-08, la cua del curador a `curador-cua.js`, es va fer el 22
d'octubre fora d'aquest registre.
