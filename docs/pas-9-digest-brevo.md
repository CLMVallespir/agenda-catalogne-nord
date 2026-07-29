# Pas 9 — Resum setmanal per comarca (Brevo)

Aquest pas envia cada dimarts a la tarda un correu de resum, **un per comarca**, amb els esdeveniments `publicat` que comencen durant els propers 7 dies. El correu surt cap a la llista de subscriptors de Brevo d'aquella comarca.

El codi és a `apps-script/sendWeeklyDigest.gs`. La funció principal es diu `sendWeeklyDigest()` i s'executa sola cada **dimarts a les 15:00** (a la tarda).

> **Estat: codi fet i provat, connexió pendent.** Tot el codi està escrit i comprovat amb un test automàtic (44 comprovacions: finestra de dates, agrupació per comarca, escapament d'HTML, format de l'assumpte, un destinatari per correu, etc.). El que falta no es pot fer fins que tinguis el compte de Google Workspace (perquè l'Apps Script viu dins del full) **i** el compte de Brevo amb les llistes creades. Al final hi ha la llista exacta del **que necessito de tu** per tancar el pas.

---

## Com encaixa amb la resta

`sendWeeklyDigest.gs` és **un fitxer més dins del mateix projecte d'Apps Script lligat al full** (el mateix on viuen `setupSheet.gs`, `processBotSubmission.gs` i `processNewEmails.gs`). Tots els fitxers `.gs` comparteixen el mateix espai global, i per això aquest fitxer **reutilitza** sense duplicar:

- `getSecret(nom)` → de `processNewEmails.gs` (llegeix una Script Property i peta amb un missatge clar si falta)
- `COMARCA_VALUES` → de `setupSheet.gs` (les cinc comarques, en ordre)

Aquest pas **només llegeix** el full: no modifica cap fila ni publica res. Els esdeveniments que envia ja els vas aprovar tu (`estat = publicat`), així que aquí no hi torna a haver cap revisió.

**Decisió d'enviament (la vas triar tu):** s'envia un correu **transaccional per cada subscriptor** (Brevo `POST /v3/smtp/email`), no una campanya. Té una conseqüència que has d'assumir: els correus transaccionals **no porten enllaç de baixa automàtic**. Per això el codi afegeix un peu bilingüe («respon amb baixa») i una capçalera `List-Unsubscribe`, i ets tu qui **treu la persona de la llista de Brevo a mà** quan ho demana. (Si algun dia les llistes creixen molt, l'alternativa neta és passar a *campanyes*, que ho gestionen soles.)

---

## Les llistes de Brevo (les crees tu, a mà)

Al tauler de Brevo, a **Contacts → Lists**, crea **cinc llistes**, una per comarca. Posa'ls el nom que vulguis (per exemple «Agenda — Rosselló»). El que importa és l'**id numèric** de cada llista (el veus a la mateixa pàgina de llistes, o a l'URL quan obres la llista). Aquests ids els posaràs a les Script Properties (taula de sota).

Quan algú es subscriu, l'afegeixes a la llista de la seva comarca (pots estar a més d'una). Les altes les gestiones tu pel tauler de Brevo; aquest pas no crea contactes, només els llegeix per enviar-los el resum.

---

## Configuració manual (quan tinguis els comptes)

1. **Obre l'editor d'Apps Script** del full (Extensions → Apps Script) i afegeix un fitxer nou anomenat `sendWeeklyDigest.gs`. Enganxa-hi el contingut de `apps-script/sendWeeklyDigest.gs`.

2. **Verifica el remitent a Brevo.** A **Senders, Domains & Dedicated IPs**, dona d'alta i verifica l'adreça des de la qual s'enviaran els correus (per exemple `agenda@elteudomini.cat`). Brevo no envia des d'una adreça no verificada.

3. **Afegeix les Script Properties** a Configuració del projecte (icona d'engranatge) → *Propietats de l'script*:

   | Propietat | Valor |
   |---|---|
   | `BREVO_API_KEY` | la teva clau d'API de Brevo (Brevo → SMTP & API → API Keys) |
   | `BREVO_SENDER_EMAIL` | l'adreça **verificada** des d'on s'envia |
   | `BREVO_SENDER_NAME` | el nom que es veu com a remitent (p. ex. «Agenda cultural de la Catalunya Nord») |
   | `BREVO_LIST_ROSSELLO` | l'id numèric de la llista del Rosselló |
   | `BREVO_LIST_CONFLENT` | l'id numèric de la llista del Conflent |
   | `BREVO_LIST_VALLESPIR` | l'id numèric de la llista del Vallespir |
   | `BREVO_LIST_CAPCIR` | l'id numèric de la llista del Capcir |
   | `BREVO_LIST_CERDANYA` | l'id numèric de la llista de la Cerdanya |

   Els noms de les propietats de les llistes són **sense accents i en majúscules** (`BREVO_LIST_ROSSELLO`), tot i que la comarca es diu «Rosselló». El codi fa aquesta correspondència explícitament, comarca per comarca.

4. **Instal·la el trigger setmanal**: a l'editor, tria la funció `installWeeklyTrigger` i executa-la **una vegada**. Et demanarà autoritzar permisos (full, crides externes); accepta. Això programa `sendWeeklyDigest()` cada **dimarts a les 15:00**. És segur tornar-la a executar: esborra el trigger anterior abans de crear-ne un de nou, així no se'n dupliquen. Si vols una altra hora, canvia la constant `HORA_ENVIAMENT` (i el dia, a `installWeeklyTrigger`).

5. **Comprova el fus horari del projecte.** L'hora del trigger (15:00) és en el fus del projecte d'Apps Script. A Configuració del projecte, posa el fus a **Europe/Paris** perquè «15:00» siguin les tres de la tarda d'aquí.

---

## Verificació

1. A Brevo, crea **una llista de prova** (o fes servir la del Rosselló) i afegeix-hi **la teva pròpia adreça** com a únic contacte. Posa el seu id a la Script Property corresponent.
2. Al full `Esdeveniments`, afegeix **2 esdeveniments de prova** per als propers dies, tots dos amb `estat = publicat` i amb la comarca d'aquella llista.
3. A l'editor, executa `sendWeeklyDigest` manualment.
4. Comprova:

- [ ] Reps **un correu** amb l'assumpte `Agenda cultural — [Comarca] — setmana del [data]`.
- [ ] Hi surten els dos esdeveniments amb títol, data, hora, lloc, municipi, descripció catalana i, a sota i en cursiva, la francesa.
- [ ] Al registre (Ver → Registres d'execució) hi surt el resum: «Comarques amb digest: …. Destinataris: …. Correus enviats: …».
- [ ] Les comarques **sense** esdeveniments aquesta setmana **no envien res** (no reps cap altre correu).
- [ ] Si esborres els dos esdeveniments de prova (o els poses `rebutjat`) i tornes a executar, al registre hi surt «No s'envia res».

---

## Decisions que he pres (canvia-les si vols)

Totes són d'una línia al codi, fàcils de canviar:

- **Finestra de 7 dies, amb avui inclòs.** S'agafen els esdeveniments amb `data_inici` entre avui i d'aquí a 7 dies (tots dos extrems inclosos). *(constant `DIES_FINESTRA`)*
- **El filtre mira `data_inici`**, tal com demanava l'encàrrec. Conseqüència: una exposició que ja hagi començat abans d'aquesta setmana però que encara duri **no** hi surt. Si la vols incloure, caldria mirar també `data_fi`. *(funció `llegeixEsdevenimentsPublicatsAquestaSetmana`)*
- **Un correu per persona**, no un sol correu amb moltes adreces, perquè ningú vegi l'adreça dels altres. *(funció `enviaDigestComarca`)*
- **Es respecten les baixes i els rebots**: els contactes que Brevo té com a `emailBlacklisted` no reben res. *(funció `obteContactesDeLlista`)*
- **Pausa de 150 ms entre correus** per no saturar l'API. *(constant `PAUSA_ENTRE_CORREUS_MS`)*
- **Esdeveniments ordenats per data i hora** dins de cada correu. *(funció `comparaPerDataIHora`)*
- **Esdeveniments sense comarca (o amb una comarca rara) no s'envien**: no es poden col·locar en cap llista. *(funció `agrupaPerComarca`)*
- **L'assumpte fa servir la data del dimarts** (el dia que s'executa), en català: «setmana del 30 de juny de 2026». *(funció `construeixAssumpte`)*
- **El disseny segueix el web actual** (`prova-local.html`), no la versió antiga: fons blanc i tinta, **sense banda vermella ni senyera**; els esdeveniments s'agrupen **per dia** sota una capçalera amb un punt daurat («30 Juny, Dimarts · 30 Juin, Mardi»); el vermell només marca l'hora («18:30 h») i el «Fins al… · Jusqu'au…»; la categoria és una **etiqueta negra**. Tipografies Georgia/Arial (sense fonts externes) i sense imatges, perquè es vegi bé a tots els clients de correu. *(funcions `construeixHtmlDigest`, `construeixCapcaleraDia`, `construeixBlocEsdeveniment`)*
- **Enllaç opcional al web**: si poses la constant `AGENDA_URL` (a dalt del fitxer), el peu mostra «Veure tota l'agenda · Voir tout l'agenda»; si la deixes buida, no surt. *(funció `construeixPeuBaixa`)*

---

## Seguretat (per a la teva tranquil·litat)

- **Cap secret al codi.** La clau de Brevo, el remitent i els ids de llista són Script Properties; la clau només viatja a la capçalera `api-key` i mai s'escriu al registre.
- **El text dels esdeveniments ve de fora** (correus d'associacions) i podria contenir HTML maliciós. El correu **escapa tots els camps dinàmics** (`<`, `>`, `&`, cometes) abans de posar-los a l'HTML, així cap títol ni descripció pot injectar marcatge ni scripts. *(funció `escapaHtml`)*
- **L'id de llista es valida** que sigui un nombre abans de fer servir-lo a l'URL de Brevo; si la propietat està mal posada, peta amb un missatge clar en comptes de fer una crida estranya. *(funció `idDeLlistaPerComarca`)*
- **Una comarca que falla no atura les altres**, i un destinatari que falla no atura la resta de la llista: tot va embolcallat amb `try/catch` i es registra l'error.
- **Compliment legal (la teva part).** Com que has triat enviament transaccional, l'enllaç de baixa no és automàtic. El correu porta un peu de baixa bilingüe i la capçalera `List-Unsubscribe`, però **ets tu qui ha de treure de la llista** qui demani la baixa. Assegura't també que tens el consentiment de les persones de les llistes.

---

## Què necessito de tu per tancar el Pas 9

Quan tornis amb els comptes a punt, dona'm o confirma:

1. Que el **compte de Google Workspace** ja existeix i que el full `Esdeveniments` s'hi ha recreat amb `setupSheet()` (és la dependència compartida amb els passos 1, 4, 5 i 7).
2. Un **compte de Brevo** creat, amb el **remitent verificat** i la **clau d'API** a mà.
3. Les **cinc llistes** creades a Brevo i els seus **ids numèrics** (per posar a les Script Properties).
4. L'**adreça de remitent** i el **nom** que vols que vegin els subscriptors.

Amb això, els passos de «Configuració manual» es fan en uns 15–20 minuts i el Pas 9 queda tancat. Si vols, et puc preparar també un text breu de subscripció (com s'apunta la gent a una comarca) per posar al web o al formulari.
