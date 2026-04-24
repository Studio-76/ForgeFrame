# ForgeFrame Zielbild Endausbau – V9

**Dokumentstatus:** normative Endausbau-Fassung, bereinigt, geglättet und konsolidiert  
**Version:** V9  
**Zweck:** verbindliches Zielbild für Produkt, Architektur, Runtime, Governance, Persistenz, UI und Betriebswahrheit von ForgeFrame  
**Geltungsanspruch:** Dieses Dokument beschreibt den konsolidierten Sollzustand von ForgeFrame im Endausbau. Es ist kein Phasenplan und keine Priorisierungsliste, sondern die geschlossene Zieldefinition des Produkts.  
**Charakter:** Diese Fassung verriegelt zusätzlich die kritischen Vertrags-, Scope-, Rollen-, Kosten-, Recovery-, Backup- und Begriffsfragen des Endausbaus.

---

## 1. Zweck dieses Dokuments

Dieses Dokument beschreibt den konsolidierten Sollzustand von **ForgeFrame** als verkaufsfähige, ehrliche und operativ belastbare Plattform für autonome AI-Instanzen.

ForgeFrame ist der Nachfolger und die Weiterentwicklung der ForgeGate-Idee. Es übernimmt den starken Runtime-, Routing- und Provider-Kern aus ForgeGate, ergänzt ihn um die sinnvollen agentischen und arbeitsbezogenen Stärken, die in anderen Systemen sichtbar wurden, und führt diese in einer sauberen, verkaufsfähigen Plattformarchitektur zusammen.

Dieses Zielbild ist bewusst:

- produktorientiert
- architekturorientiert
- betriebsorientiert
- runtime- und releaseorientiert
- auf ehrliche Produktreife verpflichtet
- auf echte Operator- und Arbeitswahrheit ausgelegt

Dieses Dokument soll verhindern, dass ForgeFrame:

- nur als Gateway endet
- nur als Agenten-Demo endet
- nur als hübsche UI endet
- nur Routing-Marketing betreibt
- nur teure Provider umschichtet, ohne echte Dispatch- und Queue-Wahrheit
- nur Work-Interaction verspricht, ohne belastbare Außenaktions- und Zustelllogik
- nur von Learning, Memory und Skills spricht, ohne ein kontrolliertes Produktmodell dafür zu besitzen

Wenn sich Code, Runtime, UI, Persistenz, Health, Routing, Queueing, Tests, Release-Gates und dieses Dokument widersprechen, gilt immer die **Produktwahrheit aus realer Laufzeit und belastbarer Implementierung**.

---

## 2. Produktidentität

### 2.1 Was ForgeFrame ist

**ForgeFrame** ist eine **linux-first, system-nativ installierbare Control-Plane- und Runtime-Plattform für autonome AI-Instanzen**.

ForgeFrame vereint in einem Produkt:

- Smart AI Gateway
- Smart Execution Routing
- generischen Harness
- UI-first Control Plane
- Provider- und Client-Kompatibilität
- Governance- und Policy-Durchsetzung
- Health-, Observability- und Kostenkontrolle
- Queueing-, Dispatch- und Run-Orchestrierung
- Artefakt-, Workspace- und Handoff-Fähigkeiten
- Work Interaction Layer für Conversations, Inbox, Tasks, Notifications und Außenaktionen
- Learning-, Memory- und Skills-System als kontrollierte Produktfunktion
- optionale persönliche und teambezogene Assistenzmodi auf derselben Produktbasis

ForgeFrame ist damit nicht nur ein Proxy, nicht nur ein Agent und nicht nur ein Arbeitsfrontend, sondern der **Betriebsrahmen**, in dem AI-Instanzen sicher, nachvollziehbar, steuerbar, budgetierbar, priorisierbar und produktiv betrieben werden.

Der normative Produktpfad ist der direkte Linux-/Host-Betrieb. Optional darf der Installer oder Bootstrap-Pfad einen Parameter anbieten, die **PostgreSQL-Datenbank** statt nativ in einem **dedizierten Docker-Container** zu betreiben. Diese Option ändert nicht die Produktidentität von ForgeFrame selbst.

### 2.2 Was ForgeFrame nicht ist

ForgeFrame ist nicht:

- nur ein Modell-Proxy
- nur ein API-Gateway
- nur ein Chat-Frontend
- nur ein Workflow-Builder
- nur ein Taskboard
- nur ein CI-/PR-Werkzeug
- keine Demo-Konsole
- keine Matrix ohne Runtime-Bedeutung
- keine Plattform mit Fake-Vollintegration
- keine Blackbox, die Routing- und Queue-Entscheidungen versteckt
- keine künstliche Vorschaltbox, die Instanzwahrheit zerstört

ForgeFrame darf nie so wirken, als sei etwas fertig, wenn es:

- nur partial ist
- nur bridge-only ist
- nur onboarding-only ist
- nur probe-only ist
- nur modelliert ist
- nur heuristisch und nicht nachvollziehbar ist
- oder nur in UI, Snapshot oder Marketing besser aussieht als in Code und Laufzeitverhalten

### 2.3 Produktkern in einem Satz

ForgeFrame ist die Plattform, auf der **AI-Instanzen als steuerbare, nachvollziehbare, policy-gebundene und arbeitsfähige Systeme** betrieben werden.

---

## 3. Leitprinzipien

### 3.1 Produktwahrheit vor Präsentation

Die Wahrheit des Produkts liegt in:

- Code
- Runtime-Verhalten
- Persistenzmodell
- API-Verhalten
- Queue- und Dispatch-Wahrheit
- Policy-Durchsetzung
- Health- und Readiness-Prüfungen
- Tests
- Release-Gates

Nicht in:

- README-Marketing
- Matrixfarben
- Snapshot-Texten
- Screenshots
- hübscher UI allein
- formalen Reifegradetiketten ohne operative Deckung

### 3.2 Keine Fake-Vollintegration

Jede Integrationsachse darf nur einen ehrlichen Reifezustand behaupten:

- **runtime-ready**
- **partial runtime**
- **bridge-only / onboarding-only**
- **not-ready / unsupported**

Alles andere ist Beschönigung.

### 3.3 UI-first, aber nicht UI-fake

UI-first bedeutet:

- Operator-Arbeit soll primär über UI und Admin-API möglich sein
- Regelbetrieb soll nicht shell-first sein
- Zustände, Risiken, Aktionen und Entscheidungen sollen sichtbar und steuerbar sein

UI-first bedeutet ausdrücklich nicht:

- Runtime-Lücken visuell zu kaschieren
- Sicherheits- oder Reifegrade zu simulieren
- Routing- oder Queue-Magie vorzutäuschen
- Health-Wahrheit zu erfinden

### 3.4 Linux-first / system-nativ installierbarer Host-Betrieb als verbindlicher Produktpfad

ForgeFrame ist **linux-first** und **system-nativ installierbar**.

Verbindlich gilt:

- der **normative Produktpfad** ist der direkte Linux-/Host-Betrieb
- ForgeFrame selbst muss direkt auf Linux installierbar und betreibbar sein
- system-native Services und Host-Betrieb dürfen keine zweitklassige Sonderform sein
- UI, API, Worker, Scheduler und Hintergrundkomponenten müssen auf Host-Ebene sauber tragfähig sein
- die Produktlogik darf nicht davon abhängen, dass ForgeFrame selbst zwingend containerisiert ist
- der normative Linux-/Host-Betriebspfad muss real tragfähig und verbindlich sein

Zusätzlich gilt:

- der Installer oder Bootstrap-Pfad darf **optional** einen Parameter anbieten, die **PostgreSQL-Datenbank** in einem **dedizierten Docker-Container** zu betreiben
- diese Option betrifft nur PostgreSQL oder klar abgegrenzte optionale Infrastrukturkomponenten
- sie ändert nicht die Produktidentität und nicht die normative Betriebswahrheit von ForgeFrame selbst

Docker darf für reproduzierbare, segmentierte und operativ saubere Betriebsformen eine standardisierte Verpackungs- und Betriebsoption sein. Docker ist jedoch **nicht** die primäre Produktidentität von ForgeFrame.

### 3.5 PostgreSQL als produktiver Primärpfad

PostgreSQL ist der produktive Primärpfad für zentrale Zustände und Historien.

Dateibasierte oder JSONL-basierte Pfade sind nur zulässig als:

- Dev-Hilfe
- Recovery-Pfad
- Migrationsebene
- lokaler Notfallpfad

Nicht als Primärwahrheit.

Das gilt ausdrücklich auch für:

- Queue-Wahrheit
- Dispatch-Historie
- Worker-Leases
- Run-Zustände
- Routingentscheidungen
- Budget- und Circuit-Breaker-Ereignisse
- Learning-, Memory- und Skill-Metadaten

### 3.6 Klare Produktachsen statt Vermischung

ForgeFrame muss seine Produktachsen, Ebenen und Objekttypen sauber trennen.

Keine Oberfläche und kein Runtime-Verhalten darf folgende Dinge vermischen:

- Plattformebene und Instanzebene
- fachliche Routing-Klassen und operative Execution-Lanes
- Skill, Plugin, Harness und Provider Target
- Working Context und Durable Memory
- offene Runtime-API und native ForgeFrame-Produktpfade
- Empfehlung, Draft, Freigabe und echte Außenaktion

### 3.7 Capability-Gating vor Cost-Gating

ForgeFrame routet nicht primär billig, sondern primär fachlich korrekt.

Die Reihenfolge lautet immer:

1. fachlich geeignet
2. policy- und rechtekonform
3. gesund und verfügbar
4. wirtschaftlich sinnvoll
5. innerhalb von Limits und Budgets zulässig

Billigkeit darf niemals Capability-Mängel kaschieren.

### 3.8 Sync- und Async-Wahrheit dürfen nicht vermischt werden

ForgeFrame muss strikt unterscheiden zwischen:

- synchronen, latenzsensitiven Runtime-Anfragen
- nichttrivialen, aber noch interaktiven Anfragen
- agentischen oder langlaufenden Runs
- Hintergrundjobs für Probe, Sync, Verifikation, Learning oder Zustellung

Das System darf nicht blind alles in eine Queue kippen.

### 3.9 Routing muss erklärbar sein

Jede relevante Routing-, Dispatch-, Eskalations- oder Budgetentscheidung muss auf mehreren Ebenen lesbar sein:

1. kurze menschliche Zusammenfassung
2. strukturierte Entscheidungsfaktoren
3. technische Rohdetails

### 3.10 Teure Provider sind kein Abfalleimer

Premium- oder knappe Provider dürfen nicht mit trivialer Arbeit verstopft werden.

ForgeFrame muss aktiv helfen:

- lokale und günstige Ziele auszulasten
- Premium-Targets für qualitätskritische Arbeit freizuhalten
- Eskalation nur bei echter Notwendigkeit vorzunehmen

### 3.11 Learning, Memory und Skills sind echte Produktfunktionen

ForgeFrame darf Lernen nicht als Marketingbegriff benutzen.

Learning, Memory und Skills sind nur dann Produktbestandteil, wenn sie:

- kontrolliert
- auditierbar
- erklärbar
- governance-fähig
- begrenzt
- fehlerkorrigierbar
- und operativ sichtbar
sind.

### 3.12 Außenwirkungen brauchen harte Freigabelogik

Jede Außenwirkung muss als eigener Produkttyp behandelt werden.

Empfehlungen, Drafts, Simulationsläufe, Freigabeanforderungen und echte Außenaktionen sind verschiedene Dinge und dürfen nie still ineinander übergehen.

---

## 4. Globales Plattformmodell

ForgeFrame braucht eine saubere Ebenentrennung. Die Instanz ist die zentrale fachliche und betriebliche Einheit, aber nicht die einzige Produktebene.

### 4.1 Plattformebene

Die Plattformebene umfasst:

- Installation / Stack / Cluster
- globale Authentisierung und Admission
- globale Policies und Verbote
- globale Rate Limits und Schutzmechanismen
- systemweite Dienste und technische Abhängigkeiten
- Tenant- oder Organisationsverwaltung, wenn vorhanden
- globale Operator-Sichten

### 4.2 Tenant- oder Organisationsebene

Die Tenant- oder Organisationsebene ist die zwischen Plattform und Instanz liegende fachliche Mandantenschicht.

Es gilt verbindlich:

- im **Local-Solo-Betrieb** darf ForgeFrame tenantlos betrieben werden
- im **Shared-Private-Betrieb** darf ForgeFrame tenantlos oder tenantleicht betrieben werden, solange Zugehörigkeit, Audit und Rechte sauber bleiben
- im **Hosted-, Public- oder Managed-Betrieb** ist eine echte Tenant- oder Organisationsebene **verpflichtend**

Sie kapselt mindestens:

- Zugehörigkeit von Nutzern
- tenantbezogene Richtlinien
- tenantbezogene Budgets und Quoten
- tenantbezogene Connector- und Providerrechte
- tenantbezogene Audit- und Billing-Kontexte
- tenantbezogene Daten- und Sichtbarkeitsgrenzen

Tenant-Kontexte dürfen nie still mit Instanz- oder Plattformwahrheit vermischt werden.


### 4.2.1 Verbindliche Regel für Instanzen und Tenants

Es gilt normativ und ohne Ausnahme:

- **Instanzen** sind in **allen Betriebsmodi** der verpflichtende Produktkern von ForgeFrame
- eine ForgeFrame-Nutzung ohne Instanz ist nicht vorgesehen
- **Tenants** oder **Organisationsebenen** sind nur dann verpflichtend, wenn eine zusätzliche mandantische Trennung über der Instanz benötigt wird
- in einfachen Betriebsformen dürfen Tenants entfallen oder implizit behandelt werden
- in mandantenfähigen Betriebsformen sind Tenants oder Organisationsebenen verpflichtend und dürfen nicht still durch Instanzobjekte ersetzt werden

Daraus folgt:

- **Single-User** oder einfache Solo-Nutzung: Instanz **ja**, Tenant **nein**
- **Single-Organization** oder interne Firmeninstallation: Instanz **ja**, Tenant **optional oder implizit**
- **Multi-Tenant-** bzw. kundenfähiger Fremdbetrieb: Instanz **ja**, Tenant **verpflichtend**

Diese Regel ist Modellwahrheit und darf in UI, Onboarding, API, Persistenz und Betriebslogik nicht verwässert werden.

### 4.3 Instanzebene

Die **Instanz** ist die oberste fachliche und betriebliche Einheit des eigentlichen Produkts.

Eine Instanz kapselt mindestens:

- Ziele und Betriebsmodus
- Rollen, Agentenstruktur und Profile
- einen automatisch erzeugten Coordinator- oder Lead-Agenten mit dem Default-Namen **`Operator`**, der pro Instanz verpflichtend vorhanden, aber umbenennbar sein muss
- Conversations, Threads und Sessions
- Inbox, Triage, Tasks, Follow-ups und Reminders
- Kontakte, Zustellungsregeln und Kanäle
- Provider-Rechte und Provider Targets
- Routing-Policies und Eskalationsregeln
- Queue-Klassen und Dispatch-Verhalten
- Budgets, Limits und Safety-Regeln
- Health-, Readiness- und Error-Zustände
- Artefakte, Workspaces und Handoffs
- Learning-, Memory- und Skill-Wahrheit innerhalb des Instanz-Scopes

### 4.3.1 Verbindlicher Coordinator- oder Lead-Agent

Jede Instanz muss beim Anlegen automatisch einen zentralen Coordinator- oder Lead-Agenten erzeugen.

Für diesen Agenten gilt verbindlich:

- der Default-Name ist **`Operator`**
- der Name muss pro Instanz umbenennbar sein
- der Agent ist keine bloße UI-Dekoration, sondern ein echtes Agentenobjekt der Instanz
- der Agent dient standardmäßig als zentrale Ansprech-, Koordinations- und Sammelstelle für allgemeine Arbeitsanweisungen, Rundfragen, Delegationen und Rückführungen in den Hauptthread
- der Agent darf spezialisierte Agenten nicht implizit ersetzen, sondern koordiniert, delegiert, sammelt und verdichtet deren Arbeit
- wenn eine Instanz zusätzliche Agenten enthält, bleibt der Coordinator-Agent standardmäßig der führende allgemeine Gesprächs- und Eintrittspunkt

### 4.4 Arbeits- und Laufobjekte unterhalb der Instanz

Unterhalb der Instanz existieren klar getrennte Objektklassen, mindestens:

- Workspace
- Conversation
- Thread
- Task
- Reminder
- Run
- Dispatch Job
- Approval
- Artefakt
- Skill
- Memory-Eintrag
- Channel Binding
- Connector Binding

### 4.5 Instanzgebundene Primärwahrheit

Die produktive Routing-, Dispatch-, Run-, Memory- und Approval-Wahrheit lebt primär in der Instanz.

Ein globaler Edge- oder Admission-Layer darf existieren, aber er darf nicht ersetzen:

- instanzspezifische Routing-Policies
- instanzspezifische Budgets
- instanzspezifische Provider-Target-Pools
- instanzspezifische Queue-Eskalationen
- instanzspezifische Explainability
- instanzspezifische Learning- und Memory-Wahrheit

---

## 5. Betriebsmodi

ForgeFrame muss mindestens folgende **technischen Betriebsmodi** sauber tragen können.

Diese Begriffe beschreiben die technische und betriebliche Ausprägung des Produkts. Sie sind **nicht** identisch mit der vereinfachten, nutzerfreundlichen Sprache des Onboardings. Die Onboarding-Auswahl in Kapitel 23 wird auf diese technischen Betriebsmodi und auf das Modell aus Kapitel 4 verbindlich abgebildet.

### 5.1 Local Solo

- technischer Betriebsmodus für Einzelperson oder sehr einfache Solonutzung
- lokale oder private Laufzeit
- einfacher Bootstrap
- ideal für Evaluation, Entwicklung und persönlichen Betrieb

### 5.2 Shared Private

- technischer Betriebsmodus für eine einzelne Organisation oder ein internes Team
- private Betriebsumgebung
- gemeinsame Instanznutzung
- kollaborative Operator- und Arbeitsflächen

### 5.3 Hosted / Public / Managed

- technischer Betriebsmodus für providerbetriebenen oder kundenfähigen Fremdbetrieb
- gehostete Mehrinstanzumgebung
- kontrollierte Exponierung
- tenantfähiger Betrieb
- zentrale Admission-, Billing- und Governance-Anforderungen

### 5.4 Remote Runtime Driver

ForgeFrame darf entfernte oder getrennte Runtime-Komponenten anbinden, solange:

- Governance erhalten bleibt
- Produktwahrheit konsistent bleibt
- Explainability nicht verloren geht
- Zustands- und Kostenwahrheit nachvollziehbar bleiben

### 5.5 Optionaler Edge Admission Layer

Ein vorgeschalteter Edge Admission Layer ist zulässig für:

- globale Authentisierung
- Burst-Schutz
- globale Rate Limits
- Instanzauflösung
- DDoS-Schutz
- kurzes Eingangsadmissioning
- Weiterleitung an die richtige ForgeFrame-Instanz

Er ist ausdrücklich **nicht** die primäre Smart-Execution- oder Instanzwahrheit.


### 5.6 Normativer Host-Betriebspfad

Der normative Produktpfad für ForgeFrame ist ausdrücklich der **direkte Linux-Host-Betrieb**.

Dazu gehören mindestens:

- direkte Installation von ForgeFrame auf einem Linux-System
- Betrieb zentraler Komponenten als system-native Services, z. B. per systemd
- Host-Installer- oder Bootstrap-Pfade als echte Produktpfade
- keine Pflicht-Containerisierung von ForgeFrame selbst, nur um die Grundfunktion des Produkts herzustellen
- optionaler Installer-Parameter, PostgreSQL statt nativ in einem dedizierten Docker-Container zu betreiben

Containerisierte Betriebsformen bleiben zulässig und wichtig, dürfen aber den Host-Betrieb nicht verdrängen.

### 5.7 Öffentliche Standard-Exponierung

Für öffentlich oder halböffentlich exponierte Betriebsformen gilt verbindlich:

- UI liegt unter `/`
- die öffentliche Hauptoberfläche läuft unter HTTPS auf **`0.0.0.0:443`**
- Runtime- und Admin-Pfade bleiben auf derselben Origin unter den vorgesehenen Unterpfaden erreichbar
- `0.0.0.0:443` ist Standardproduktpfad
- ForgeFrame darf seine Standard-Erreichbarkeit nicht nur durch externe Fremdkomponenten simulieren

### 5.8 Integriertes TLS-, FQDN- und Zertifikatsmanagement

ForgeFrame muss im Endausbau ein integriertes Produktmodell für:

- FQDN-Verwaltung
- DNS- und Erreichbarkeitsprüfung
- öffentlich gültige Zertifikatsausstellung
- Zertifikatsverlängerung
- sichere Zertifikats- und Private-Key-Ablage
- Listener-Reload
- Operator-Sicht auf Zertifikatsstatus und Fehler

tragen können.

Der bevorzugte Produktpfad ist automatisiertes ACME-/Let's-Encrypt-fähiges Zertifikatsmanagement, sofern die Betriebsform dies erlaubt.

Ein Hilfslistener auf Port `80` ist zulässig, soweit er für ACME-Challenges, minimale Redirect-Logik oder technische Erreichbarkeitsprüfung erforderlich ist. Er darf nicht zu einer zweiten vollwertigen Produktoberfläche werden.

### 5.9 Ausnahme- und Fallback-Modi

Wenn keine öffentlich auflösbare FQDN, keine Port-80/443-Erreichbarkeit oder kein automatisiertes Zertifikatsmanagement möglich ist, darf ForgeFrame in einem klar klassifizierten Ausnahme-, Evaluations- oder Spezialmodus laufen.

Dabei gilt verbindlich:

- dies ist nicht der normative verkaufsfähige Standardpfad
- Abweichungen müssen sichtbar klassifiziert werden
- Zertifikats-, FQDN- oder Exponierungsdefizite dürfen nie kosmetisch versteckt werden
- selbstsignierte oder manuell geladene Zertifikate sind bewusst als Ausnahmezustand zu behandeln

---

## 6. Produktachsen und Execution Fabric

ForgeFrame besitzt vier verbindliche Produktachsen sowie eine durchgehende **Execution Fabric**, die diese operativ zusammenführt.

### 6.1 Achse 1: OAuth- und Account-Provider

Das sind Provider, deren Nutzbarkeit wesentlich an:

- Benutzerkonten
- OAuth
- Session-, Grant- und Refresh-Logik
- accountgebundene Runtime
- Probe- und Readiness-Semantik
hängt.

Explizit relevant für den Endausbau sind mindestens:

- **OpenAI Codex**
- **GitHub Copilot**
- **Claude Code**
- **Antigravity**
- **optional Gemini**, sofern es dafür eine tragfähige OAuth-Implementierungsmöglichkeit gibt

### 6.1.1 Zielschärfe der OAuth-Premium-Achsen

Für diese Achse gilt verbindlich:

- OAuth- und Account-Provider dürfen nicht auf API-Key-Flachheit reduziert werden
- Session-, Grant-, Refresh-, Probe-, Readiness- und Runtime-Wahrheit müssen operatorisch sichtbar und belastbar sein
- accountgebundene Limits, Serialisierungserfordernisse und Session-Reuse-Strategien müssen Produktwahrheit sein

Für **OpenAI Codex** ist das Zielbild ausdrücklich eine tief produktisierte OAuth-Achse, in der **alle vom Provider angebotenen relevanten Features vollständig und ohne funktionale Lücken nutzbar** sind, einschließlich Runtime-, Probe-, Session-, Grant-, Refresh-, Streaming-, Tool- und Operator-Wahrheit.

Für **GitHub Copilot**, **Claude Code** und **Antigravity** gilt derselbe Grundsatz: nicht nur modellierte oder dekorative Achsen, sondern vollständige, ehrliche und betriebstaugliche Account- und Runtime-Integration mit **100 % Nutzbarkeit aller vom jeweiligen Provider angebotenen relevanten Features**.

**Gemini** ist in dieser Achse nur dann normativer Bestandteil, wenn es eine tragfähige OAuth-Implementierungsmöglichkeit gibt; andernfalls ist Gemini ehrlich enger zu klassifizieren und darf nicht künstlich auf dieselbe Reifestufe behauptet werden.

### 6.1.2 Premium-Achsen-Nutzung und Eskalationsrolle

Starke und knappe OAuth- oder Premium-Achsen sollen bewusst bevorzugt für:

- **non-simple** Arbeit
- qualitätskritische Aufgaben
- hochwertige Code-, Planungs- und Tool-Aufgaben
- agentische oder komplexe Ausführung
- Review-, Escalation- und Qualitätssicherungsfälle

eingesetzt werden.

Sie dürfen nicht der unkontrollierte Standardpfad für triviale oder lokal lösbare Arbeit sein.

### 6.2 Achse 2: OpenAI-kompatible Fremdprovider

ForgeFrame soll eine möglichst starke und praxisnahe OpenAI-kompatible Providerfläche anbieten.

Für diese Achse gilt ausdrücklich das Zielbild **maximal kompatibel**.

Dies bedeutet das höchstmögliche reale Maß an OpenAI-kompatiblem Verhalten. Abweichungen sind nur zulässig, wenn sie technisch unvermeidbar, explizit typisiert, dokumentiert, testbar und operatorisch sichtbar sind.

ForgeFrame soll insbesondere anbieten mit:

- request fidelity
- response fidelity
- error fidelity
- stream fidelity
- tool fidelity
- content-type handling
- robustness gegen malformed payloads
- timeout-, retry- und rate-limit-Semantik

### 6.3 Achse 3: Lokale Provider

Lokale Provider sind eine echte Produktachse, insbesondere:

- Ollama
- spätere weitere lokale Backends

Diese Achse muss operatorisch gleichwertig behandelt werden, nicht als Spielwiese.

### 6.4 Achse 4: OpenAI-kompatible Clients

ForgeFrame muss nach außen belastbar für OpenAI-kompatible Clients funktionieren.

Für diese Achse gilt ausdrücklich das Zielbild **maximal kompatibel**.

Dies bedeutet das höchstmögliche reale Maß an Client-Kompatibilität in Request-, Response-, Fehler-, Streaming- und Tool-Semantik. Abweichungen sind nur zulässig, wenn sie technisch unvermeidbar, explizit typisiert, dokumentiert, testbar und operatorisch sichtbar sind.

Insbesondere gilt dies für:

- `/v1/models`
- `/v1/chat/completions`
- `/v1/responses`

### 6.5 Durchgehende Execution Fabric

Die Execution Fabric ist keine fünfte Providerachse, sondern die operative Schicht, die bestimmt:

- wie Targets aus den vier Achsen ausgewählt werden
- welche Arbeit synchron läuft
- welche Arbeit in Queue- und Workerpfade übergeht
- wie Retry, Eskalation und Fallback funktionieren
- wie Policies, Capability, Health, Last und Kosten zusammenspielen

Sie besitzt zwei strikt getrennte Ebenen:

#### 6.5.1 Routing-Policy- und Klassifikationsebene

Diese Ebene beantwortet:

- ist eine Anfrage fachlich **simple** oder **non-simple**
- welche Targets sind zulässig
- welche Capability wird benötigt
- welche Budgets oder Policies greifen
- ob Eskalation prinzipiell erlaubt ist

#### 6.5.2 Scheduling-, Queueing- und Dispatch-Ebene

Diese Ebene beantwortet:

- läuft die Arbeit synchron oder asynchron
- welche Execution-Lane gilt
- ob Admission, Queueing oder Direktdispatch greift
- welcher Worker oder welches Lease-Modell zuständig ist
- wie Retry, Pause, Resume oder Quarantäne funktionieren

Diese beiden Ebenen dürfen nie vermischt werden.

---

## 7. Kernmodule von ForgeFrame

### 7.1 Smart AI Gateway

Der Gateway-Kern ist zuständig für:

- Entgegennahme von Clientanfragen
- Authentisierungs- und Policy-Prüfung
- Modell- und Targetauflösung
- Routing
- Fehlerabbildung
- Streaming
- Tool-Fidelity
- Erzeugung von Observability-Ereignissen

Der Gateway-Kern darf nie nur Proxy sein.

### 7.2 Smart Execution Router

Der Smart Execution Router ist zuständig für:

- Provider-Target-Selektion
- simple-/non-simple-Klassifikation
- Capability-Gating
- Rechte- und Binding-Filterung
- Budget- und Cost-Prüfung
- Latenz- und Queue-Entscheidung
- Eskalation von günstigen oder lokalen Pfaden auf stärkere Targets
- Fallback-Ketten
- Entscheidung zwischen Direktdispatch und Queueing
- strukturierte Begründung der Entscheidung

### 7.3 Provider-Target-Schicht

ForgeFrame braucht ein explizites Provider-Target-Modell.

Ein Target ist mindestens die Kombination aus:

- Provider
- Modell
- Integrationsklasse
- Auth- oder Credential-Typ
- Instanzzulässigkeit
- Capability-Profil
- Kostenklasse
- Gesundheitszustand
- Priorität
- Queue-Eignung
- Latenzprofil
- Fallback-Zulässigkeit
- Eskalationszulässigkeit
- Serialized- oder Parallelitätsanforderung

### 7.4 Queueing- und Run-Orchestrierung

ForgeFrame braucht eine echte Queueing- und Run-Orchestrierungs-Schicht für:

- persistente Jobs
- Queue-Klassen
- Worker-Leases
- Retry-Strategien
- Priorisierung
- Backpressure
- Pause, Resume und Interrupt
- Dead-Letter und Quarantäne
- Wiederaufnahme
- agentische, langlaufende und nichttriviale Arbeit

### 7.5 Generischer Harness

Der Harness ist nicht bloß Konfigurationshilfe, sondern Produktkern.

Er muss mindestens beherrschen:

- Profile
- Templates
- Preview
- Verify
- Dry Run
- Probe
- Execute
- Inventory und Discovery
- Sync
- Snapshot
- Import und Export
- Rollback
- persistente Runs
- Tool-Unterstützung in generischen Pfaden

### 7.6 UI-first Control Plane

Die Control Plane ist die zentrale Arbeitsoberfläche für Betreiber und Teams.

Sie muss echte Arbeit ermöglichen, insbesondere:

- Provider und Targets verwalten
- Modelle und Capabilities verstehen
- Health konfigurieren
- Harness-Profile und Integrationen verwalten
- Routing-Policies steuern
- Queue- und Dispatch-Zustände verstehen und beeinflussen
- Work Interaction, Approvals und Außenaktionen betreiben
- Learning-, Memory- und Skills-Zustände sehen und prüfen

### 7.7 Governance- und Policy-Kern

ForgeFrame muss Governance nicht nur anzeigen, sondern durchsetzen.

Dazu gehören mindestens:

- Accounts
- API-Keys
- Provider-Bindings
- Rollen und Scopes
- Instanzzuordnungen
- Budget- und Cost-Grenzen
- Sicherheitsrichtlinien
- Target-Zulässigkeit
- Routing-Regelwerke
- Queue- und Worker-Rechte
- Außenaktionsrechte
- Learning-, Memory- und Skill-Rechte

### 7.8 Health-, Observability- und Cost-Schicht

ForgeFrame muss echte betriebliche Transparenz liefern über:

- Usage
- Errors
- Health
- OAuth-Operations
- Alerts
- Needs-Attention
- Kostenachsen
- Performance-Signale
- Integrationszustand
- Bootstrap- und Readiness-Zustände
- Dispatch-Entscheidungen
- Queue-Längen und Wartezeiten
- Worker-Auslastung
- Eskalationsraten
- Premium-vs.-Low-Cost-Auslastung

### 7.9 Explainability Layer

ForgeFrame muss Entscheidungen, Runs und Zustände auf drei Ebenen lesbar machen:

1. kurze Management- oder Operator-Zusammenfassung
2. strukturierte Betriebsdetails
3. technische Rohdetails

Dies gilt ausdrücklich auch für:

- Routingentscheidungen
- Queueentscheidungen
- Eskalationen
- Fallbacks
- Budgetstopps
- Learning Persistence
- Memory- und Skill-Verwendung
- Außenaktionen

### 7.10 Artefakt-System

ForgeFrame braucht ein zentrales Artefaktmodell für:

- Reports
- Spezifikationen
- Downloads
- Preview-Dateien
- Logs
- JSON, CSV, PDF
- Screenshots
- Build-Artefakte
- PR- und Handoff-bezogene Dateien

Artefakte müssen an Issues, Conversations, Runs, Entscheidungen, Skills, Approvals und Instanzen hängbar sein.

### 7.11 Workspace- und Handoff-Schicht

ForgeFrame soll den Pfad unterstützen:

**Auftrag / Issue / Conversation → Workspace → Preview → Review → Handoff / PR / Außenaktion**

Nicht als GitHub-Ersatz, sondern als Betriebs- und Übergabeschicht.

### 7.12 Work Interaction Layer

ForgeFrame braucht eine allgemeine Work Interaction Layer oberhalb von Runtime, Routing und Governance.

Sie ist zuständig für:

- Conversations, Threads und Sessions
- Inbox und Triage
- Aufgaben, Follow-ups und Wiedervorlagen
- Reminder- und Triggerlogik
- Outbox und Zustellung
- Preview und Confirmation-Flows
- Kontext- und Memory-Pflege
- Verknüpfung von Interaktionen mit Artefakten, Runs und Entscheidungen

### 7.13 Learning-, Memory- und Skills-System

ForgeFrame braucht ein explizites Learning-, Memory- und Skills-System als Produktkern.

Dieses System besteht mindestens aus:

- **Boot Memory**
- **Working Context**
- **Durable Memory**
- **Recall- und Search-Layer**
- **Skill-Registry**
- **Skill-Versionierung und Skill-Scopes**
- **Learning Persistence Loop**
- **Memory- und Skill-Explainability**

### 7.14 Plugin-System

ForgeFrame braucht ein Plugin-System als Escape Hatch für:

- spezielle Integrationen
- spezialisierte UI-Module
- optionale Betriebsflächen
- kundenspezifische Erweiterungen
- domänenspezifische Policies oder Auswertungen

Der Kern bleibt schlank, die Erweiterbarkeit hoch.

---

## 8. Identity, Authentisierung, Autorisierung und Credential-Taxonomie

ForgeFrame braucht ein explizites Identitäts- und Berechtigungsmodell.

### 8.1 Identitätstypen

Mindestens zu unterscheiden sind:

- Plattform-Operator-Identität
- Tenant- oder Organisationsidentität, sofern vorhanden
- Instanznutzer-Identität
- API-Client-Identität
- Agent- oder Run-Identität
- Connector- oder Provider-gebundene Credential-Identität
- Acting-on-behalf-of- oder Delegationskontexte

### 8.2 Credential-Arten

Mindestens zu unterscheiden sind:

- Nutzer-Login-Credentials
- Maschinen- oder Service-Credentials
- API-Keys
- OAuth-Grants und Refresh-Tokens
- Connector-Secrets
- Provider-spezifische Session- oder Bridge-Credentials
- delegierte oder temporäre Session-Credentials

### 8.3 Authentisierungsebenen

ForgeFrame braucht Authentisierung auf mindestens folgenden Ebenen:

- Plattform- und Adminzugang
- Instanzzugang
- Runtime-API
- native ForgeFrame-APIs
- Connector- und Provider-Bindings
- Außenaktions- und Kanalzugänge

### 8.4 Autorisierungsebenen

Autorisierung muss mindestens berücksichtigen:

- Plattformscope
- Tenant- oder Organisationsscope
- Instanzscope
- Objekt- oder Ressourcen-Scope
- Aktions-Scope
- Target- und Provider-Scope
- Lern-, Memory-, Skill- und Außenaktionsrechte

### 8.5 Minimales Rollenmodell

ForgeFrame braucht ein verbindliches Basisrollenmodell. Mindestens zu unterscheiden sind:

- **Platform Owner**
- **Tenant Admin**
- **Instance Admin**
- **Operator**
- **Approver**
- **Viewer**
- **Auditor**, soweit erforderlich

Zusätzlich können, soweit der Betriebsmodus oder die Organisationsgröße dies sinnvoll macht, explizite Spezialrollen vorgesehen werden, insbesondere:

- **Release Manager**
- **Security Officer**
- **Instance Maintainer**
- **Routing Maintainer**
- **Queue Maintainer**

Diese Rollen sind nicht bloß UI-Etiketten, sondern müssen Scope, erlaubte Aktionen, Freigaberechte und Audit-Verantwortung real tragen.

### 8.6 Delegation und Acting-on-behalf-of


ForgeFrame muss explizit modellieren, wann ein System im Namen eines Nutzers oder eines anderen Objekts handelt.

Solche Kontexte müssen:

- sichtbar
- auditierbar
- widerrufbar
- zeitlich begrenzbar
- policy-prüfbar
sein.

### 8.7 Secret-Handling

Secrets und Tokens müssen:

- getrennt von normaler Geschäftsdatenhaltung behandelt
- rotierbar
- widerrufbar
- auditiert
- exportarm
- und im Zugriff streng begrenzt
sein.

---

## 9. Policy-Hierarchie

ForgeFrame braucht eine explizite Prioritätsregel für Policies.

Wenn mehrere Regeln kollidieren, gilt folgende Reihenfolge:

1. globale Sicherheits- und Plattformverbote
2. Tenant- oder Organisationsregeln
3. Instanzregeln
4. Agent-, Profil- oder Rollenregeln
5. Run-, Task- oder Conversation-Kontextregeln
6. Nutzerpräferenzen, soweit zulässig

Spezielle Regeln für:

- Außenaktionen
- Premium-Targets
- Serialized-Lanes
- Memory- und Skill-Promotion
- Datenlöschung
- persönliche Assistenz
- adressierte Agentenansprache, Teilnahmemodi und Agent-zu-Agent-Handoffs
müssen diese Hierarchie respektieren.

Zusätzlich gelten verbindlich folgende Konfliktregeln:

- **deny** schlägt **allow**
- niedrigere Ebenen dürfen globale oder tenantweite Verbote nie aufheben
- tiefere Ebenen dürfen Regeln weiter einschränken, aber nicht still erweitern
- explizite Ausnahmen müssen zeitlich begrenzt, auditierbar und widerrufbar sein
- Konflikte auf derselben Ebene müssen deterministisch aufgelöst werden, nicht durch zufällige Reihenfolge

---

## 10. Capability-, Execution-, Policy- und Profilmodell

ForgeFrame braucht ein normiertes Modell, das **Capabilities**, **Execution Traits**, **Policy-/Safety-Flags** sowie **Economic-/Quality-Profile** klar trennt.

### 10.1 Technische Capabilities

Technische Capabilities beschreiben, was ein Provider oder Target fachlich und technisch kann.

Mindestens zu modellieren sind:

- streaming
- tool_calling
- structured_output
- multimodal_input
- multimodal_output, soweit relevant
- long_context
- reasoning
- code_execution
- browser_or_web_interaction

### 10.2 Execution Traits

Execution Traits beschreiben operative Eignungen und Laufzeitcharakteristika.

Mindestens zu modellieren sind:

- background_run_fit
- low_latency_fit
- oauth_serialized

### 10.3 Policy- und Safety-Flags

Policy- und Safety-Flags beschreiben Einschränkungen, zusätzliche Anforderungen oder Schutzbedingungen.

Mindestens zu modellieren sind:

- approval_required
- local_only_fit, soweit dies wirklich eine Policy-Einschränkung und keine Capability-Aussage ist
- safety_restrictions

### 10.4 Economic- und Quality-Profile

Economic- und Quality-Profile beschreiben wirtschaftliche oder qualitative Einordnung, nicht technische Capability.

Mindestens zu modellieren sind:

- quality_tier
- cost_class

### 10.5 Bedeutung des Modells

Dieses Modell ist die gemeinsame Wahrheit für:

- Routing
- Target-Zulässigkeit
- Explainability
- UI-Darstellung
- Policy-Prüfung
- Fallback- und Eskalationslogik
- Release- und Readiness-Aussagen

Ohne diese Trennung bleiben „fachlich geeignet“, „operativ geeignet“, „policy-zulässig“ und „wirtschaftlich sinnvoll“ zu weich.

### 10.6 Datentyp, Herkunft und Vertrauensmodell

Für alle Capability-, Execution-, Policy- und Profilfelder muss zusätzlich festgelegt sein:

- ob das Feld boolean, enum, tier, Score oder klassifizierte Stufe ist
- ob die Angabe **provider_declared**, **forgeframe_observed**, **test_verified** oder **policy_masked** ist
- welche Vertrauensstufe die jeweilige Quelle besitzt
- wie Divergenzen zwischen Deklaration, Beobachtung und Policy angezeigt werden

Routing und Reifeaussagen dürfen sich nie allein auf ungeprüfte Selbstauskünfte eines Providers verlassen.

## 11. Routing-Modell

### 11.1 Modellregister

Das Modellregister muss produktive Wahrheit bilden über:

- bekannte Modelle
- aktive Modelle
- deaktivierte Modelle
- stale oder entfernte Modelle
- Health- und Availability-Zustände
- Ownership
- Capability-Felder
- Routing-Keys
- Profil- und Target-Zuordnungen

### 11.2 Discovery und Sync

ForgeFrame muss Discovery und Sync aktiv beherrschen für:

- Modelle
- Harness-Inventory
- Providerprofile
- Target-Verfügbarkeit
- Capability-Änderungen

### 11.3 Routing berücksichtigt mindestens

- requested model
- default model
- Ownership
- Capability
- Health
- Availability
- Binding und Policy
- Provider allow/deny
- Fallback
- Priorität
- Instanzpolicy
- Client-Semantik
- Latenzklasse
- Queue-Eignung
- Budgetzustand
- Eskalationspfade

### 11.4 Provider Targets

Zusätzlich zum Modellregister braucht ForgeFrame ein produktives Provider-Target-Register, das die operative Wahrheit über tatsächlich nutzbare Ziele bildet.

### 11.5 Fachliche Routing-Klassen

ForgeFrame muss mindestens zwei sichtbare fachliche Routing-Klassen unterstützen:

- **simple**
- **non-simple**

Diese beantworten die Frage, **was fachlich und policy-seitig mit einer Anfrage passieren darf**.

### 11.6 Interne Erweiterbarkeit

Intern darf das Modell offen sein für weitere Klassen wie:

- advanced
- premium
- restricted
- local-only
- batch
- background

Aber das sichtbare Endprodukt muss die fachliche Trennung klar und verständlich halten.

### 11.7 Deterministische Klassifikation

Anfragen sollen primär deterministisch und regelbasiert klassifiziert werden anhand von Signalen wie:

- Tools vorhanden
- große Kontexte
- multimodale Inputs
- Attachments oder Artefakte
- strukturierte Ausgabe
- Agentenmodus
- Workspace- oder Approval-Kontext
- erwartete Laufzeit
- benötigte Capability

Zusätzliche LLM-Klassifikation darf optional sein, nicht Pflicht.

Bei gemischten oder unsicheren Fällen gilt verbindlich:

- die sichtbaren Klassen **simple** und **non-simple** bleiben erhalten
- intern dürfen feinere Subklassen genutzt werden
- bei Unsicherheit gilt eine definierte konservative Fallback-Klassifikation
- Governance-, Approval- oder Außenwirkungsrisiko dürfen die Routing-Klasse nicht verwischen, wohl aber den operativen Pfad verschärfen

### 11.8 Capability-first Escalation

Ein lokaler oder günstiger Pfad darf nur genutzt werden, wenn die fachlich nötige Capability erfüllt ist.

Eskalation auf stärkere Ziele soll ausgelöst werden, wenn:

- Capability fehlt
- Ziel nicht gesund ist
- Policy oder Budget es verlangt
- Qualitätsanforderung es verlangt
- Latenz- oder Queue-Lage es sinnvoll macht

---

## 12. Execution-Lanes, Queueing und Dispatch

### 12.1 Operative Execution-Lanes

ForgeFrame unterscheidet mindestens folgende operative Abarbeitungsklassen:

- **Interactive Low Latency**
- **Interactive Heavy**
- **Background Agentic**
- **OAuth Serialized**

Diese Lanes sind operative Klassen und ersetzen niemals die fachlichen Routing-Klassen.

### 12.2 Keine blinde Vollqueue für Sync-Traffic

Normale synchrone Runtime-Anfragen dürfen nicht blind in lange Warteschlangen gedrückt werden.

Zulässig sind:

- kurze Admission-Queues
- kurze Burst-Queues
- kontrollierte Blockierungs- oder Budgetfehler

Unzulässig ist eine intransparente Langläufer-Queue hinter offenen Standardpfaden.

### 12.3 Queue-Pflicht für agentische und orchestrierte Arbeit

Agentische, langlaufende oder nichttriviale Arbeit soll sauber in persistente Queue- und Workerpfade überführt werden.

### 12.4 Persistenzmodell

Die Queue-Wahrheit lebt primär in PostgreSQL.

Mindestens erforderlich sind persistente Strukturen für:

- dispatch_jobs
- dispatch_decisions
- dispatch_attempts
- worker_leases
- dead_letters oder quarantined_jobs
- queue_metrics

### 12.5 Zustände

Queue- und Dispatch-Systeme müssen mindestens folgende Zustände tragen können:

- queued
- admitted
- leased
- running
- waiting_external
- waiting_approval
- blocked
- paused
- interrupted
- retry_scheduled
- failed
- completed
- cancelled
- quarantined


### 12.5.1 Operator-Aktionen und Laufzeitsteuerung

ForgeFrame muss Runtime nicht nur starten können, sondern auch sauber steuern.

Mindestens erforderlich sind folgende explizite Operator-Aktionen für Run-, Queue- und Execution-Steuerung:

- start
- stop
- pause
- resume
- interrupt
- retry
- restart from scratch
- escalate
- cancel

Approval-Entscheidungen wie **approve** und **reject** gehören fachlich in die Approval- und Freigabelogik und dürfen nicht mit reiner Run- oder Queue-Steuerung vermischt werden.

Diese Operator-Aktionen müssen im Backend real, auditierbar und für Operatoren sichtbar sein.

Zusätzlich gilt:
- **resumed** ist kein stabiler Dauerzustand, sondern eine Laufzeit-Transition bzw. ein Ereignis zwischen `paused` und erneuter aktiver Ausführung
- entsprechende Transitionen oder Ereignisse wie `resumed`, `retried`, `escalated` oder `interrupted` müssen in Explainability, Audit und Verlauf sichtbar sein


### 12.5.2 Geltungsbereich der Run- und Steuerungslogik

Die Run-, Queue- und Steuerungslogik gilt nicht nur für klassische agentische Workflows, sondern ausdrücklich auch für:

- Queue-Jobs
- orchestrierte Runs
- Harness-Ausführungen
- eskalierte Routingpfade
- hintergründige Responses- und Execution-Aufträge

### 12.6 Worker-Modell

Worker müssen mindestens beherrschen:

- Lease-Vergabe und Lease-Renewal
- Timeout
- Abbruch oder Rückgabe
- Retry mit Backoff
- Idempotenzschutz
- Concurrency-Limits
- provider- oder target-spezifische Parallelitätsgrenzen

### 12.7 Queue-Explainability

Zu jedem relevanten Queue- oder Dispatch-Vorgang müssen sichtbar sein:

- warum gequeued wurde
- welche Lane gewählt wurde
- welches Target gewählt wurde
- ob Fallback oder Eskalation aktiv war
- warum gewartet wird
- welche nächste Aktion sinnvoll ist

### 12.8 Capacity Governance und Fair Scheduling

ForgeFrame braucht zusätzlich eine explizite Kapazitäts- und Fairnesslogik.

Mindestens erforderlich sind:

- Fairness zwischen Instanzen
- Quoten zwischen Tenants oder Organisationen, wenn vorhanden
- Schutz knapper Premium-Targets
- Serialized-Lane-Schutz für OAuth-gebundene Provider
- Starvation Prevention
- Schutz vor Prioritätsinversion
- admission-seitige Drosselung bei knappen Ressourcen

---

## 13. Native APIs und offene Runtime-Verträge

### 13.1 Offene OpenAI-kompatible Runtime-API

Verpflichtend belastbar sind:

- `/health`
- `/v1/models`
- `/v1/chat/completions`
- `/v1/responses`

### 13.2 Standardvertrag der offenen Runtime-API

Die offenen OpenAI-kompatiblen Pfade bleiben im Standardfall **synchrone, latenzsensitive Runtime-Verträge**.

Das bedeutet insbesondere:

- `/v1/chat/completions` darf nicht still in einen Langläufer-Jobvertrag umgedeutet werden
- `/v1/responses` darf intern orchestration-fähig sein, muss aber im offenen Standardpfad semantisch ehrlich bleiben
- lange Queue-Semantik darf nicht hinter unveränderten Standardpfaden versteckt werden

### 13.3 Explizite native ForgeFrame-Produktpfade

ForgeFrame braucht zusätzlich native Produktpfade mit eigener Semantik für:

- **Runs**
- **Jobs / Dispatch**
- **Conversations / Threads / Sessions**
- **Tasks / Follow-ups / Reminders**
- **Approvals / Decisions**
- **Actions / Action Drafts / Action Previews**
- **Notifications / Outbox / Delivery Status**
- **Artefakte / Workspaces / Handoffs**
- **Memory / Skills / Learning**

Diese Pfade sind nicht bloß Hilfs-APIs, sondern Teil des Produkts.

Mindestens explizit modellierbar sein müssen Produktpfade der Form:

- `/runs`
- `/jobs` oder äquivalente Dispatch-Pfade
- `/conversations`, `/threads`, `/sessions`
- `/participants`, `/mentions` oder äquivalente Konversations- und Teilnehmerpfade
- `/tasks`, `/reminders`
- `/approvals`, `/decisions`
- `/actions`, `/action-drafts`, `/action-previews`
- `/notifications`, `/outbox`, `/deliveries`
- `/artifacts`, `/workspaces`, `/handoffs`
- `/memory`, `/skills`, `/learning-events`

### 13.4 Vertragsregeln für native Produktpfade

Für native Produktpfade muss verbindlich festgelegt sein:

- welche Pfade synchron und welche asynchron sind
- welches Referenzobjekt unmittelbar zurückgegeben wird
- wie Statuspolling, Resume, Cancel, Retry und Escalate funktionieren
- welche Objekt-ID oder Correlation-ID führend ist
- welche Idempotenzregeln für wiederholte Requests gelten
- wie OpenAI-kompatible Eingänge kontrolliert in native ForgeFrame-Objekte überführt werden dürfen
- wie adressierte Agentenansprache, Teilnehmerzustände, Handoffs und Mehragenten-Abstimmungen als native Produktobjekte oder Ereignisse modelliert werden

Verbindlich gilt zusätzlich:

- offene OpenAI-kompatible Runtime-Pfade behalten ihren Außenvertrag
- ein Eingang über `/v1/chat/completions` oder `/v1/responses` darf intern auf native ForgeFrame-Objekte gemappt werden, **ohne** dass der Außenvertrag stillschweigend in einen anderen Produkttyp umgedeutet wird
- wenn aus einem offenen Runtime-Eingang intern ein Run, Task, Approval, Handoff, Artefakt oder anderes natives ForgeFrame-Objekt entsteht, muss dieser Übergang typisiert, nachvollziehbar und operatorisch sichtbar sein
- ein solcher Übergang darf nur erfolgen, wenn Pfadsemantik, Instanzpolicy, API-Key-Berechtigung und Zielklasse dies zulassen
- die Zuordnung zur Instanz erfolgt verbindlich über einen gültigen Bearer-API-Key; Requests ohne gültigen Bearer werden nicht akzeptiert
- in der Instanz muss festgelegt sein, ob ein Request auf den **Smart Routing Pfad** darf, auf einen **direkt gepinnten Target-Pfad**, auf einen **restriktiven Local-only-Pfad**, auf einen **dedizierten Queue-/Background-Pfad** oder auf einen **explizit geblockten bzw. reviewpflichtigen Pfad**
- Learnings, Memory- und Skill-Funktionen dürfen durch solche internen Übergänge nicht in versteckte Nebenpfade geraten; auch diese Übergänge müssen am gleichen Objekt- und Explainability-Modell hängen

Native Produktpfade sind keine implizite Restkategorie, sondern ein eigener Vertragsraum des Produkts.


### 13.5 `/v1/responses`-Zielbild

ForgeFrame darf `/v1/responses` nicht nur als Chat-Umschichtung behandeln.

Ziel ist eine echte native Responses-Achse mit:

- eigener Request-Semantik
- eigener Output-Item-Semantik
- Tool-Output-Fidelity
- Fehler-Fidelity
- Streaming-Semantik
- klarer Unsupported- oder Partial-Semantik

Wenn queue-gestützte oder agentische Ausführung nötig ist, muss dies:

- explizit typisiert
- dokumentiert
- zustandsseitig nachvollziehbar
- und für Client und Operator klar erkennbar
sein.

### 13.6 Admin- und Control-Plane-API

Die Admin-API muss mindestens belastbar sein für:

- Providerverwaltung
- Snapshot- und Ops-Endpunkte
- Harness-Endpunkte
- Usage, Error, Health und OAuth-Operationen
- Bootstrap- und Readiness-Endpunkte
- Accounts, Keys und Security
- Routing-Policies
- Provider Targets
- Queue und Dispatch
- Runs
- Work Interaction
- Ingress, Exposure, TLS und Zertifikate
- Learning, Memory und Skills

### 13.7 Fehlersemantik

ForgeFrame muss präzise und operatorisch nützliche Fehler liefern, mindestens für:

- 400
- 401
- 403
- 404
- 408
- 409
- 410
- 413
- 415
- 422
- 429
- 5xx
- provider_not_ready
- unsupported_feature
- malformed_response
- protocol_error
- timeout
- model_not_found
- invalid_tool_definition
- missing_runtime_scope
- provider_not_allowed
- dispatch_blocked
- queue_timeout
- budget_exceeded
- circuit_open

---

## 14. Action-Klassen, Preview und Approval

ForgeFrame braucht eine explizite Klassifikation von Aktionen.

### 14.1 Aktionstypen

Mindestens zu unterscheiden sind:

- **read_only**
- **recommend**
- **draft**
- **simulate**
- **request_approval**
- **execute_low_risk**
- **execute_high_risk**
- **irreversible**

### 14.2 Grundregeln

- Empfehlungen sind keine Drafts
- Drafts sind keine Aktionen
- Simulation ist keine Außenwirkung
- Approval ist kein Execute
- High-Risk- und irreversible Aktionen dürfen nie stillschweigend auto-executed werden

### 14.3 Approval-Logik

Für jede Aktionsklasse müssen festgelegt sein:

- Standardfreigabemodus
- wer freigeben darf
- welche Auditspur entsteht
- welche Vorschau oder Simulation nötig ist
- welche Kanäle Auto-Execute nie dürfen

### 14.4 Default-Sicherheitsmatrix

Ohne ausdrückliche, sicherere Spezialkonfiguration gelten mindestens folgende Defaults:

- **read_only** braucht kein Approval und erzeugt keine Außenwirkung
- **recommend** braucht kein Approval und erzeugt keine Außenwirkung
- **draft** erzeugt nie selbst Außenwirkung
- **simulate** darf nie senden oder irreversibel handeln
- **request_approval** darf nie ohne explizite Freigabe zu Execute werden
- **execute_low_risk** braucht mindestens identitäts- und scopegebundene Policy-Prüfung
- **execute_high_risk** braucht standardmäßig menschliche Freigabe und Auditspur
- **irreversible** braucht immer stärkste Freigabe, deutliche Vorschau und vollständige Auditierung

### 14.5 Außenaktionswahrheit

Jede Außenaktion muss:

- explizit klassifiziert
- an Identität und Scope gebunden
- nachvollziehbar geloggt
- im Delivery-Status sichtbar
- widerrufbar oder kompensierbar, soweit möglich
sein.

---

## 15. Work Interaction Layer

### 15.1 Allgemeiner Kern

Work Interaction ist keine Sonderwelt für persönliche Assistenz, sondern ein allgemeiner Plattformkern.

### 15.2 Pflichtbestandteile

Mindestens erforderlich sind:

- Conversations
- Thread-Historien
- Sessions
- Inbox-Ansichten
- Triage-Status
- Tasks
- Follow-ups und Wiedervorlagen
- Reminders
- Notifications
- Outbox
- Action-Preview
- Freigabe- und Bestätigungsflüsse
- Kontakte
- Channels
- Knowledge- und Connectorquellen
- Kontext- und Memory-Anbindung

### 15.3 Zentraler Konversationsbereich pro Instanz

Jede Instanz muss einen zentralen Konversations- oder Arbeitsbereich besitzen.

Dieser Bereich ist **nicht nur ein einfacher Chat**, sondern der primäre menschlich benutzbare Einstieg in die Work-Interaction-Schicht der Instanz.

Der zentrale Konversationsbereich muss mindestens tragen können:

- menschliche Beiträge
- Beiträge klar identifizierter Agenten
- systemische Status- oder Zustellungsereignisse
- Verknüpfungen zu Tasks, Runs, Approvals, Artefakte und Handoffs
- Threading oder Side-Threads für fokussierte Teilarbeit

Der zentrale Konversationsbereich darf nicht zur unstrukturierten Dauerkommunikation ohne Objektbezug verkommen. Wesentliche agentische Arbeit muss mit Tasks, Runs, Handoffs, Approvals oder anderen Produktobjekten verknüpfbar bleiben.

### 15.4 Agent Presence und adressierte Ansprache im Konversationsbereich

ForgeFrame muss im zentralen Konversationsbereich eine explizite, strukturierte Ansprache von Agenten unterstützen.

Dazu gehört mindestens:

- eine **`@`-Adressierung** von in der Instanz vorhandenen Agenten
- eine Auswahlliste oder Autocomplete-Funktion für verfügbare Agenten
- Auflösung auf eine echte Agentenidentität der Instanz, nicht nur auf freien Text
- Speicherung der Adressierung als strukturierte Referenz
- klare Sichtbarkeit, welcher Agent adressiert wurde

Nachrichten der Form **`@Agentenname ...`** müssen semantisch als adressierte Arbeitsanweisung, Rückfrage oder Delegation modelliert werden können.

Eine Mention darf nie nur ein kosmetischer Prompt-Zusatz sein. Sie muss intern auf ein echtes Agentenobjekt, einen Scope und gegebenenfalls auf Folgeobjekte wie Task, Run, Handoff oder Side-Thread auflösbar sein.

Verbindlich gilt zusätzlich:

- wer welchen Agenten adressieren darf, ist rollen-, scope- und policygebunden
- eine Mention ist zunächst nur eine **adressierte Konversationsinteraktion**
- aus einer Mention dürfen nicht automatisch Task, Run, Handoff, Außenaktion oder Skill-/Memory-Mutation entstehen, außer Instanzpolicy, Aktionsklasse und Agentenmodus erlauben dies ausdrücklich
- wenn aus einer Mention Folgeobjekte entstehen, muss dies explizit sichtbar und explainable sein, z. B. „aus Mention entstand Task“ oder „aus Mention entstand Run“


### 15.5 Teilnahmemodi von Agenten in Conversations und Threads

Agenten dürfen nicht standardmäßig alle Konversationen, Threads oder Beiträge permanent mitlesen. ForgeFrame braucht deshalb explizite Teilnahmemodi.

Mindestens erforderlich sind:

- **silent** – Agent liest nicht mit und reagiert nicht automatisch
- **mentioned-only** – Agent wird nur bei direkter Ansprache, expliziter Zuweisung oder strukturierter Delegation einbezogen
- **subscribed** – Agent verfolgt einen klar definierten Thread oder Themenkontext
- **assigned / owner** – Agent ist für einen Thread, Task, Run oder Arbeitsgegenstand primär verantwortlich
- **broadcast participant** – Agent wird bewusst in eine Rundfrage oder koordinierte Mehragenten-Abstimmung einbezogen

Der Standardfall für spezialisierte Agenten ist **nicht** permanentes Mitlesen, sondern mindestens **mentioned-only** oder ein anderer explizit definierter Modus.

Jede Sichtbarkeit und Beteiligung eines Agenten muss für Explainability, Audit und Kostenwahrheit nachvollziehbar bleiben.

### 15.6 Agent-zu-Agent-Kommunikation, Handoffs und Abstimmung

ForgeFrame muss strukturierte Agent-zu-Agent-Kommunikation unterstützen.

Diese Kommunikation dient nicht bloß freiem Agenten-Chat, sondern produktiver Zusammenarbeit. Mindestens erforderlich sind:

- Task-Zuweisungen zwischen Agenten
- Handoffs von Arbeitsständen, Runs oder Artefakte
- Rückfragen zwischen Agenten
- Blocker- oder Abhängigkeitsmeldungen
- Review- oder Freigabeanforderungen
- Statusrückmeldungen an einen koordinierenden Agenten oder an den Hauptthread

Agent-zu-Agent-Kommunikation soll nach Möglichkeit als strukturierte Ereignisse oder Produktobjekte modelliert werden, z. B. als Assignment, Handoff, Review-Request oder Blocker-Event.

Ein freier Gesprächsmodus zwischen Agenten ist zulässig, darf aber die produktive Wahrheit nicht verdecken. Relevante Ergebnisse müssen in nachvollziehbare Produktobjekte oder in den sichtbaren Hauptkontext zurückgeführt werden.

### 15.7 Rundfragen, Mehragenten-Abstimmung und Coordinator-Rolle

ForgeFrame muss bewusst ausgelöste Mehragenten-Abstimmungen unterstützen.

Dazu gehören mindestens:

- gezielte Rundfragen an mehrere spezialisierte Agenten
- Review- oder Bewertungsrunden zu Designs, Entscheidungen oder Risiken
- Sammeln von Stellungnahmen mehrerer Agenten
- verdichtete Rückführung der Ergebnisse in den Hauptthread, einen Task, einen Run oder eine Entscheidung

Solche Rundfragen dürfen nicht bedeuten, dass standardmäßig alle Agenten jede Diskussion kommentieren. Sie müssen bewusst ausgelöst, begrenzt und explainable sein.

Der pro Instanz verpflichtende Coordinator- oder Lead-Agent mit dem Default-Namen **`Operator`** ist standardmäßig der allgemeine Sammel- und Einstiegspunkt für:

- unspezifische Nutzeranweisungen
- Koordination zwischen spezialisierten Agenten
- Zusammenführung von Rückmeldungen
- Delegation in spezialisierte Threads, Tasks oder Runs
- Rückführung relevanter Ergebnisse in den Hauptkontext

Der Coordinator-Agent ist standardmäßig **subscribed** auf den zentralen Konversationsbereich der Instanz und muss bei allgemeinen, nicht spezifizierten Arbeitsanweisungen als erster koordinierender Gesprächspartner fungieren.

### 15.8 Konversationsfilter, Agentenansichten und Conversation Lenses

ForgeFrame muss im zentralen Konversationsbereich temporäre, reversible Anzeigefilter unterstützen, ohne die zugrunde liegende Konversationswahrheit zu verändern.

Solche Filter sind **View-Layer-Mechanismen** und keine alternative Datenwahrheit. Die vollständige Conversation, Auditierbarkeit und Explainability bleiben unverändert bestehen.

Mindestens erforderlich sind:

- ein temporärer Filter nach **beteiligtem Agenten**
- ein temporärer Filter nach **Nachrichten an einen Agenten**
- ein temporärer Filter nach **Nachrichten von einem Agenten**
- ein temporärer Filter nach **Agentenbeteiligungstyp**, z. B. Mention, Antwort, Handoff, Review-Anfrage, Blocker oder Rundfrage
- kombinierbare Filter mit Freitextsuche oder Thread-Bezug
- jederzeitige Rückkehr zur ungefilterten Gesamtansicht

ForgeFrame darf solche Filter nicht nur über Volltext auf frei vorkommende Agentennamen simulieren. Die Filter müssen soweit möglich auf strukturierten Agenten-, Thread-, Ereignis- und Beteiligungsreferenzen beruhen.

Agentenfilter und Conversation Lenses sind besonders wichtig, wenn eine Instanz mehrere spezialisierte Agenten enthält. Sie dienen der gezielten Analyse, Wiederauffindung und Fokussierung, dürfen aber nie zu verdeckter Teilwahrheit oder stiller Ausblendung relevanter Historie führen.

### 15.9 Triage-Zustände

Mindestens sinnvoll sind Status wie:

- neu
- relevant
- delegiert
- blockiert
- wartend
- erledigt
- archiviert

### 15.10 Persönliche und teambezogene Assistenzmodi

ForgeFrame kann auf derselben Plattformbasis verschiedene Modi tragen, z. B.:

- Personal Assistant Mode
- Team Assistant Mode
- Ops Assistant Mode
- kundenspezifische Arbeitsinstanzen

Diese Modi dürfen Governance, Explainability oder Approval nie aushebeln.

---

## 16. Learning-, Memory- und Skills-Architektur

### 16.1 Boot Memory

Boot Memory ist ein kleiner, kuratierter und stabiler Snapshot für Session- oder Run-Start.

Es ist zuständig für:

- kompakte Instanz- oder Profilidentität
- stabile Präferenzen oder Regeln
- dauerhaft wichtige Fakten mit hoher Vertrauenswürdigkeit
- knappe, kosteneffiziente Startwahrheit

Boot Memory muss:

- klein bleiben
- streng kuratiert sein
- versionierbar sein
- nicht ungefiltert wachsen

### 16.2 Working Context

Working Context ist der laufende Arbeitskontext einer konkreten Situation.

Er kann umfassen:

- Conversation- und Thread-Kontext
- Task- und Run-Kontext
- Workspace-Kontext
- offene Artefakte
- temporäre Annahmen
- aktuelle Zustands- oder Approval-Informationen

Working Context ist **nicht automatisch Langzeitwahrheit**.

### 16.3 Durable Memory

Durable Memory ist die strukturierte, persistente und auditierbare Langzeitwahrheit.

Es muss mindestens tragen können:

- Faktentyp
- Inhalt
- Quelle
- Vertrauensklasse
- Gültigkeit oder Ablauf
- Scope
- Eigentum oder Zugehörigkeit
- Revision
- Korrektur- oder Widerrufsstatus

### 16.4 Recall- und Search-Layer

Recall und Search sind nicht identisch mit Durable Memory.

Sie liefern gezielten Zugriff auf:

- vergangene Conversations und Sessions
- relevante Artefakte
- frühere Entscheidungen
- ähnliche Memory-Einträge
- Skills
- Wissens- und Connectorquellen

### 16.5 Skills

Skills sind versionierbare, aktivierbare und wiederverwendbare **prozedurale Bausteine**.

Ein Skill umfasst mindestens:

- Titel und Zweck
- Scope
- Version
- Status
- Quelle und Provenienz
- Freigabestatus
- Aktivierungsbedingungen
- Instruktions- oder Ablaufkern
- Auswertbarkeit und Telemetrie

### 16.6 Learning Persistence Loop

ForgeFrame braucht einen kontrollierten Learning Persistence Loop.

Trigger können sein:

- Run-Abschluss
- Session-Rotation
- wiederkehrende Muster
- erkannte Qualitäts- oder Nutzengewinne
- explizite Benutzer- oder Operator-Aktion

Der Loop entscheidet kontrolliert:

- was verworfen wird
- was nur Session-Historie bleibt
- was zu Boot Memory verdichtet wird
- was als Durable Memory persistiert wird
- was als Skill-Entwurf entsteht
- was nur als Vorschlag oder Review-Fall markiert wird

### 16.7 Memory Truth Maintenance

ForgeFrame braucht Regeln zur Wahrheits- und Konfliktpflege im Memory.

Mindestens erforderlich sind:

- Vertrauensklassen je Quelle
- Konfliktbehandlung bei widersprüchlichen Erinnerungen
- superseded-, revoked- und corrected-Status
- Ablauf- oder Review-Pflichten
- Vorrang von menschlicher Korrektur gegenüber automatischer Ableitung
- klare Trennung zwischen instanzgebundener Wahrheit und fremdem oder externem Wissen

### 16.8 Promotion-Regeln

Memory- und Skill-Promotion dürfen nicht blind automatisch erfolgen.

Mindestens zu unterscheiden sind:

- auto_reject
- auto_draft
- auto_suggest
- review_required
- auto_promote in eng begrenzten, risikoarmen Fällen

### 16.9 Memory- und Skill-Explainability

Zu jeder relevanten Verwendung muss sichtbar sein:

- welches Memory verwendet wurde
- welcher Skill verwendet wurde
- warum dies geschah
- welche Quelle und Revision zugrunde lagen
- ob nur Recall oder echte Produktwahrheit benutzt wurde

### 16.10 Scope-Grenzen für Memory und Skills

Für Memory und Skills müssen Scope-Grenzen explizit gelten für:

- Plattform
- Tenant oder Organisation
- Instanz
- Profil oder persönliche Assistenz
- Conversation-, Run- oder Task-lokalen Kontext

Verbindlich gilt:

- instanzfremdes Wissen darf nie still in Instanzwahrheit promoted werden
- persönliches Assistenzwissen darf nie still in Team- oder Tenant-Wahrheit übergehen
- Recall über Scope-Grenzen ist nur zulässig, wenn dies explizit erlaubt, nachvollziehbar und policy-konform ist
- Skill-Promotion über Instanzgrenzen hinweg braucht explizite Freigabe, Provenienz und Zielscope

### 16.11 Abgrenzung: Skill vs Plugin vs Harness vs Target

- **Skill** erweitert Verhalten und prozedurales Wissen
- **Plugin** erweitert Produktfläche oder Systemfunktionalität
- **Harness** verbindet Integrationen, Runtime-Mappings und generische Ausführung
- **Target** repräsentiert ein konkretes ausführbares Ziel für Routing und Dispatch

Diese Begriffe dürfen im Produkt nicht verwischen.

---

## 17. Datenarchitektur

### 17.1 Grundsatz

ForgeFrame nutzt PostgreSQL als produktive Primärwahrheit. Nicht jede Funktion braucht jedoch denselben Datenmodelltyp.

### 17.2 Relationale Primärwahrheit

Kernobjekte müssen klassisch relational modelliert werden, insbesondere:

- Instanzen
- Nutzer, Rollen und Rechte
- Provider und Targets
- Routing-Policies
- Queue-Jobs, Dispatch-Entscheidungen und Worker-Leases
- Runs und Approvals
- Tasks, Conversations und Kontakte
- Budgets und Kostenrahmen
- Audit-Ereignisse
- Memory- und Skill-Metadaten

ForgeFrame darf nicht jsonb-first werden.

### 17.3 JSONB als Ergänzung

`JSONB` ist sinnvoll für:

- Provider-spezifische Rohpayloads
- Harness-Mappings
- flexible Capability-Zusatzdaten
- Explainability-Rohdetails
- bewegliche Connector-Metadaten
- optionale Zusatzattribute von Memory-, Skill- oder Artefaktobjekten

`JSONB` ist nicht der richtige Ort für Kernzustände, Rechte, Budgets, Queue-Wahrheit oder Routingregeln.

### 17.4 Full Text Search als primäre lexikalische Suche

Full Text Search ist die primäre lexikalische Suchschicht für:

- Conversations und Threads
- Tasks und Decisions
- Notifications und Outbox
- Artefakte mit Textinhalt
- Skill-Beschreibungen
- kuratierte Memory-Einträge
- Explainability-Zusammenfassungen
- Fehler- und Run-Beschreibungen

### 17.5 pgvector für semantisches Retrieval

`pgvector` ist sinnvoll für:

- semantisches Recall über Conversations, Knowledge und Memory
- thematisch ähnliche Sessions
- Skill-Empfehlungen
- semantische Kontextsuche
- Artefakt- oder Dokumentähnlichkeit

`pgvector` ist kein Ersatz für deterministische Policies, Statusabfragen oder Governance.

### 17.6 Hybrides Retrieval

ForgeFrame darf Full Text Search und semantisches Retrieval kombinieren.

Semantische Suche darf unterstützen, aber nicht die Primärwahrheit ersetzen.

Für widersprüchliche Ergebnisse gilt folgende Priorität:

1. strukturierte Produktwahrheit
2. explizit menschlich bestätigte Memory-Wahrheit
3. kontrolliertes Durable Memory
4. Recall- und Search-Hinweise
5. semantische Näherung

### 17.7 Generated Columns, Projektionen und materialisierte Sichten

Sinnvoll sind:

- abgeleitete Suchspalten
- normalisierte Sortier- oder Anzeigeparameter
- projektionale Operator-Sichten
- materialisierte Sichten für dichte Dashboards und Auswertungen

### 17.8 Partitionierung

Partitionierung ist sinnvoll für große zeitachsenlastige Tabellen wie:

- Audit- und Observability-Ereignisse
- Usage- und Kostenhistorien
- Dispatch-Attempts
- Message- und Health-Historien

Sie soll gezielt eingesetzt werden, nicht flächendeckend.

### 17.9 Artefakt- und Blob-Strategie

PostgreSQL speichert primär:

- Metadaten
- Beziehungen
- Rechte
- Checksums
- Zustände
- Versionen
- Such- und Anzeigeinformationen

Große Binärartefakte sollen in kontrolliertem Object Storage oder Dateispeicher liegen.

ForgeFrame soll niemals wahllos große Binärdateien als Primärstrategie in PostgreSQL kippen.

### 17.10 Datenlebenszyklus

ForgeFrame braucht explizite Regeln für:

- Retention
- Archivierung
- Löschung
- Korrektur
- Wiederherstellung
- Legal Hold, soweit relevant
- Export und Audit

Diese Regeln müssen je Datenklasse definierbar sein, mindestens für:

- Conversations
- Notifications
- persönliche Präferenzen
- Memory
- Connectordaten
- Audit- und Cost-Historien
- Skills und Skill-Revisionen

---

## 18. Objektlebenszyklen

ForgeFrame braucht klare Lifecycle-Modelle für zentrale Objektklassen.

### 18.1 Beispiele für Pflichtobjekte

Mindestens sinnvoll sind explizite Zustandsmodelle für:

- Instanz
- Provider
- Provider Target
- Connector Binding
- Conversation
- Task
- Run
- Dispatch Job
- Approval
- Artefakt
- Skill
- Memory-Eintrag
- Channel Binding

### 18.2 Grundmuster

Nicht jedes Objekt braucht dieselben Zustände, aber typische Zustände sind:

- draft
- configured
- ready
- runtime_ready
- degraded
- blocked
- paused
- revoked
- archived
- deleted

### 18.3 Bedeutung

Lifecycle-Zustände sind nicht nur UI-Dekoration, sondern müssen:

- im Backend real existieren
- auditierbar sein
- Explainability speisen
- Rechte und Aktionen steuern
- Release- und Health-Aussagen tragen

### 18.4 Normative Minimal-State-Machines

Mindestens für folgende Objektklassen sind verbindliche Minimalzustände vorzusehen:

- **Run:** queued → running → waiting / blocked / paused → completed / failed / cancelled
- **Dispatch Job:** queued → admitted → leased → running → retry_scheduled / quarantined / completed / failed
- **Approval:** draft → pending → approved / rejected / expired / revoked
- **Skill:** draft → review_required → approved / rejected → active / archived / revoked
- **Memory-Eintrag:** draft → suggested → confirmed / corrected / superseded / revoked / expired
- **Provider Target:** configured → ready / degraded / blocked / revoked

Diese Zustandsmaschinen dürfen erweitert werden, aber nicht in ihrer Grundsemantik verwischt werden.

---

## 19. Health, Readiness und Bootstrap-Wahrheit

### 19.1 Health

Health muss echte technische Checks prüfen, z. B.:

- Datenbank erreichbar
- Migrationen aktuell
- Frontend vorhanden
- wichtige Services erreichbar
- zentrale Routen auflösbar
- Provider- und Probe-Basiszustand
- Persistenzpfade funktional
- Queue-Store funktional
- Worker-Lease-Mechanik funktionsfähig
- Host- oder Container-Bindings im vorgesehenen Modus funktionsfähig
- Listener-, FQDN- und Zertifikatsmanager-Basiszustand technisch nachvollziehbar

### 19.2 Readiness

Readiness ist mehr als Health. Sie bewertet, ob die Instanz oder der Stack wirklich einsatzbereit ist.

Dazu gehört im Endausbau ausdrücklich auch, ob:

- die vorgesehene FQDN sauber auflösbar ist
- die Hauptoberfläche unter HTTPS auf dem vorgesehenen Standardpfad erreichbar ist
- Zertifikatslage, Aussteller, Laufzeit und Verlängerungsfenster korrekt und operatorisch nachvollziehbar sind
- ein Port-80-Helfer nur die vorgesehenen ACME- oder Redirect-Funktionen erfüllt

### 19.3 Bootstrap-Wahrheit

Bootstrap bedeutet nicht nur „Konfiguration vorhanden“, sondern mindestens:

- Startpfad funktioniert
- Adminzugang funktioniert
- Instanz kann erzeugt werden
- Providersicht ist konsistent
- zentrale Runtime-Endpunkte funktionieren
- Negativfälle verhalten sich korrekt
- Routingdefaults sind plausibel
- Queue- und Worker-Grundfunktionen sind einsatzbereit
- Work-Interaction-Grundpfade sind nutzbar
- Learning-, Memory- und Skill-Grundpfade sind kontrolliert vorhanden
- Host-Installer-, Bootstrap- oder Container-Startpfad liefern eine belastbare Grundinstallation
- FQDN-, TLS- und Zertifikatslogik führen zu einem realen Erstzustand oder zu sauber typisierten Blockern

---

## 20. Kostenmodell und Cost Safety

### 20.1 Harte Schutzmechanismen

ForgeFrame braucht mindestens:

- Budgetgrenzen pro Instanz
- Budgetgrenzen pro Zeitraum
- harte und weiche Limits
- Anomalieerkennung
- Circuit Breaker
- deterministic wake gating
- no-spurious-wake idle behavior
- Session-Reuse statt sinnloser Resets

### 20.2 Cost-aware Routing

ForgeFrame muss Cost Safety direkt im Routing wirksam machen.

Dazu gehören:

- günstige Standardziele für simple Arbeit
- Premiumziele für non-simple Arbeit
- Eskalation nur bei fachlicher Notwendigkeit
- Blockieren teurer Pfade bei Budgetverletzung
- Nutzung lokaler Provider, wenn fachlich ausreichend

### 20.3 Kostenachsen

Mindestens getrennt zu führen sind:

- `actual`
- `hypothetical`
- `avoided`

### 20.4 Kostensemantik

Zusätzlich braucht ForgeFrame eine klare Unterscheidung zwischen:

- **measured**
- **provider_reported**
- **estimated**
- **modeled**
- **avoided_estimated**

Ohne diese Trennung wird Kostenwahrheit unsauber.

### 20.5 Autoritative Kostenquelle

ForgeFrame muss je Einsatzzweck eine führende Kostenwahrheit benennen:

- für Billing und Finance ist die definierte autoritative Quelle maßgeblich, bevorzugt **provider_reported** oder vertraglich festgelegte Messbasis
- für Runtime-Governance und Budgetschutz darf **measured** oder konservativ **estimated** führend sein
- für UI-Transparenz dürfen Schätz- und Modellwerte gezeigt werden, müssen aber als solche kenntlich sein
- **avoided** ist grundsätzlich eine modellierte Vergleichsgröße und nie als harte Abrechnungswahrheit zu behandeln

Zusätzlich gilt für Konfliktfälle:

- wenn **provider_reported** und **measured** auseinanderlaufen, ist für Billing die definierte autoritative Billing-Quelle maßgeblich
- für Runtime-Governance und Budgetschutz darf im Zweifel der konservativere Wert führen
- wenn die autoritative Quelle ausfällt, muss eine definierte Ersatzquelle oder definierte Schutzsemantik greifen
- wenn **estimated** einen harten Schutzpfad auslöst, obwohl spätere reale Kosten niedriger ausfallen, muss die Korrektur nachvollziehbar dokumentiert werden

---

## 21. Sicherheitszielbild

ForgeFrame braucht eine harte Sicherheits- und Governance-Basis.

### 21.1 Mindestanforderungen

- Runtime-Auth standardmäßig aktiv
- klare Policy-Durchsetzung
- Scope-Prüfung
- Provider-Binding-Prüfung
- Instanzbindung
- sichere Default-Haltung
- keine gefährlichen Demo-Passwörter
- sichere Operator-Flows
- Auditierbarkeit sicherheitsrelevanter Aktionen
- sichere Zertifikats- und Private-Key-Ablage
- klare Absicherung der Ports `80` und `443`
- kein ungeschützter HTTP-Fallback als stiller Produktdefault
- kein unnötig offener Port-80-Hilfsserver außerhalb seiner vorgesehenen Challenge- oder Redirect-Funktion

### 21.2 Routing- und Queue-Sicherheit

ForgeFrame muss absichern:

- wer Routing-Policies ändern darf
- wer Targets anlegen oder priorisieren darf
- wer Queue-Jobs pausieren, abbrechen oder eskalieren darf
- wer Premium-Targets freischalten darf
- welche Instanzen local-only oder restricted-only laufen müssen

### 21.3 Work-Interaction- und Assistenzsicherheit

ForgeFrame muss absichern:

- wer Kommunikationskanäle anbinden darf
- wer externe Nachrichten oder E-Mails versenden darf
- welche Aktionen Draft, Preview oder harte Freigabe brauchen
- welche Kontakte, Quellen oder Kalenderbezüge sensibel sind
- wie Memory- und Kontextdaten gelöscht, korrigiert oder begrenzt werden
- wie persönliche Assistenzregeln auditiert und widerrufen werden können

---

## 22. UI-Zielbild

### 22.1 Grundprinzip

ForgeFrame muss sich wie ein hochwertiges, modernes, professionelles Produkt anfühlen.

Es darf nicht:

- billig wirken
- chaotisch wirken
- wie eine überladene Entwicklerkonsole wirken
- Produktwahrheit dekorativ verstecken

Gleichzeitig darf es Schönheit nie über Klarheit oder Bedienbarkeit stellen.

### 22.1.1 Frontend-Exzellenz als Produktanspruch

Das Frontend ist nicht nur funktionale Hülle, sondern ein echter Produktanspruch. ForgeFrame soll visuell:

- hochwertig
- modern
- markentauglich
- klar
- begehrenswert
- und in Screenshots wie in Live-Nutzung überzeugend

wirken.

ForgeFrame soll sich wie eine **B2B-Control-Plane mit Produktcharakter** anfühlen, nicht wie ein zusammengewürfeltes internes Admin-Tool.

### 22.1.2 Designprinzipien

Für das Frontend gelten zusätzlich:

- **Schönheit ist Pflicht, nicht Bonus**
- Premium-Wirkung ohne Spielerei
- Klarheit vor Lautstärke
- Dichte ja, Überforderung nein
- visuelle Ehrlichkeit bei degraded, blocked, partial oder unsupported Zuständen
- dezente, hochwertige Microinteractions nur dort, wo sie Orientierung oder Qualität verbessern
- Dark- und Light-Fähigkeit als echter Qualitätsanspruch, nicht bloße Pflichtübung

### 22.1.3 Informationsarchitektur für komplexe Operator-Flächen

Komplexe Flächen wie Routing, Dispatch, Queueing, Health und Kosten sollen idealerweise dem Muster folgen:

1. **Überblick**
2. **Einordnung**
3. **Detail**
4. **Aktion**

Wichtige Dinge müssen schnell erkennbar sein, ohne dass technische Tiefe verloren geht.

### 22.2 Pflichtmodule

Mindestens erforderlich sind echte Arbeitsmodule für:

- Dashboard
- Platform
- Tenants / Organizations, verpflichtend in hosted/public/managed und optional in solo- oder private-Deployments
- Instances
- Providers
- Models
- Provider Targets
- Routing
- Dispatch
- Queues
- Harness
- Usage
- Costs
- Errors
- Health
- Bootstrap / Readiness
- Security
- Accounts
- API Keys
- OAuth Targets
- Ingress / Exposure
- Ingress / TLS / Certificates
- Decisions / Approvals
- Workspaces
- Artefakte
- Release / Validation
- Plugins
- Settings
- Conversations
- Inbox
- Tasks
- Reminders
- Notifications / Outbox
- Channels
- Contacts
- Knowledge Sources
- Memory / Context
- Skills
- Assistant Profiles

### 22.3 Dreistufige Lesbarkeit

Wichtige Bereiche sollen idealerweise immer in drei Ebenen lesbar sein:

1. kurze Einordnung
2. strukturierte Details
3. technische Rohdetails

### 22.4 Zustandsdesign

Jede relevante Oberfläche braucht bewusst gestaltete Zustände für mindestens:

- not configured
- loading
- empty
- ready
- runtime-ready
- partially configured
- degraded
- blocked
- paused
- failed
- retrying
- unsupported
- bridge-only
- onboarding-only
- permission denied
- destructive action pending
- success
- warning
- needs attention
- queued
- budget blocked
- circuit open
- waiting for approval
- waiting for external dependency

### 22.5 Routing-, Queue- und Memory-Transparenz

Die UI muss klar zeigen:

- warum ein Target gewählt wurde
- welche Lane gilt
- warum gequeued wurde
- ob Budget oder Health begrenzend war
- welches Memory oder welcher Skill verwendet wurde
- welche Aktion jetzt sinnvoll oder zulässig ist

---

## 23. Onboarding und Erstnutzung

ForgeFrame darf nicht als leere technische Hülle starten.

### 23.1 Guided Onboarding

Das Onboarding muss:

- zentrale Begriffe erklären
- sinnvolle Defaults setzen
- Deployment-Modus erfassen
- erste Instanz anlegen
- erste Provider- und Target-Wahl ermöglichen
- erste Routing-Policy erzeugen
- ersten Arbeits- oder Assistenzmodus wählen lassen
- erste Work-Interaction-Fläche aktivieren
- FQDN-, DNS- und Exponierungsvoraussetzungen erfassen, soweit öffentlich oder halböffentlich betrieben wird
- Port-80/443-Annahmen und Zertifikatsmodus erklären und vorbereiten
- Host-Installer-, Bootstrap- und Containerpfad als echte Produktpfade darstellen


### 23.1.1 Auswahl des Plattform-Betriebsmodus im Onboarding

Bereits im Guided Onboarding muss ForgeFrame eine verständliche Auswahl der grundlegenden Betriebsform anbieten.

Diese Auswahl ist ausdrücklich **UI- und Nutzer-Sprache**. Sie darf technisch komplexe Betriebsmodi verbergen, muss aber intern deterministisch und nachvollziehbar auf das Plattformmodell aus Kapitel 4 und auf die technischen Betriebsmodi aus Kapitel 5 abgebildet werden.

Diese Auswahl darf **nicht** als technischer Moduswahlschalter mit internen Fachbegriffen wie `tenantlos`, `tenantleicht`, `hosted`, `public` oder `managed` auf den Nutzer abgewälzt werden.
Stattdessen muss das Onboarding mindestens verständliche Betriebsarten anbieten wie:

- **Nur ich**
- **Mein Team / meine Firma**
- **Mehrere Kunden / Organisationen**

Aus dieser Auswahl leitet ForgeFrame intern verbindlich ab:

- ob eine Tenant- oder Organisationsebene nötig ist
- welches Rollen- und Rechtegrundmodell vorbereitet wird
- welche Defaults für Isolation, Audit, Billing und Sichtbarkeit gelten
- welche Instanz- und Arbeitsmodi zuerst angeboten werden

Dabei gilt:

- bei **Nur ich** wird standardmäßig tenantlos gearbeitet und mindestens eine erste Instanz angelegt
- bei **Mein Team / meine Firma** wird mindestens eine organisationsbezogene Instanz angelegt; eine Tenant-Ebene kann implizit oder explizit vorbereitet werden
- bei **Mehrere Kunden / Organisationen** wird die Tenant- oder Organisationsebene verpflichtend aktiviert und die Plattform auf mandantenfähigen Betrieb vorbereitet

Die Wahl des Plattform-Betriebsmodus erfolgt beim Setup der ForgeFrame-Installation.
Die Wahl des **Instanztyps** oder **Arbeitsmodus der Instanz** erfolgt davon getrennt beim Anlegen oder Konfigurieren der konkreten Instanz.

### 23.2 First Success

ForgeFrame muss schnell einen ersten spürbaren Nutzen liefern, z. B.:

- erste Instanz läuft
- erster Provider erreichbar
- erste Runtime-Anfrage erfolgreich
- erste Work-Interaction sichtbar
- erstes Artefakt erzeugt
- erste Operator-Sicht befüllt
- erste belastbare Exponierungs- und Zertifikatslage hergestellt oder sauber als Blocker klassifiziert

### 23.3 Erste Routing- und Work-Interaction-Konfiguration

Bereits beim Onboarding sollen sinnvoll erfassbar sein:

- lokale Provider vorhanden oder nicht
- günstige Fremdprovider zulässig oder nicht
- Premium-Targets zulässig oder nicht
- simple- und non-simple-Trennung
- erste Inbox- und Notification-Präferenz
- erste Datenquellen oder Kommunikationskanäle, soweit gewünscht
- bevorzugte Premium-Achsen für non-simple oder qualitätskritische Arbeit, insbesondere OpenAI Codex sowie weitere OAuth-Achsen, soweit verfügbar

---

## 24. Performance-Zielbild

ForgeFrame muss effizient und betriebstauglich sein.

Fokusbereiche sind:

- Heartbeat-Effizienz
- Session-Reuse
- Delta-Laden statt Full Reload
- begrenzte Prompt- und Skill-Oberflächen
- Caches als Beschleuniger, nicht als Primärwahrheit
- Query- und Dashboard-Effizienz
- UI-Performance bei dichten Operator-Flächen
- Queue- und Worker-Effizienz
- Admission- und Burst-Verhalten
- Premium-Provider-Freihaltung
- keine unnötigen Vorab-LLM-Klassifikationen

---

## 25. Cleanup und Entschlackung

ForgeFrame darf im Endzustand nicht schwerer und unklarer werden, nur weil mehr Funktionen vorhanden sind.

Verpflichtend ist:

- tote Flags entfernen
- tote Settings entfernen
- doppelte Pfade entfernen
- verwaiste Assets entfernen
- Altlogik entfernen
- klare Modulgrenzen ziehen
- unnötige Komplexität reduzieren
- keine Debugpfade, die Produktwahrheit verfälschen

Dies gilt ausdrücklich auch für:

- alte Routing-Sonderfälle
- implizite Default-Pfade
- intransparente Queue-Abkürzungen
- versteckte Model-Fallbacks
- experimentelle Learning-Abkürzungen ohne Governance

---

## 25.1 Recovery-, Upgrade- und Rollback-Wahrheit

ForgeFrame braucht einen expliziten Produktvertrag für Recovery, Upgrade und Rollback.

Mindestens erforderlich sind:

- dokumentierte Upgrade-Pfade
- migrationskompatible Versionswechsel
- definierte Rollback-Strategien, soweit technisch zulässig
- klare Behandlung partiell gescheiterter Upgrades
- Wiederanlaufpfade nach fehlgeschlagenem Bootstrap, Deploy oder Migration
- Schutz vor Daten-, Queue-, Memory-, Skill- und Approval-Verlusten bei Updates
- das Ziel, dass Updates jederzeit ohne jegliche Verluste durchführbar sind; wo technisch absolut unvermeidbare Grenzen bestehen, müssen diese vorab explizit klassifiziert, minimiert und nachweisbar abgesichert sein

## 25.2 Backup- und Restore-Strategie

ForgeFrame braucht eine explizite Backup- und Restore-Strategie.

Mindestens erforderlich sind:

- definierte Backup-Klassen für Plattformdaten, Tenant- oder Instanzdaten, Datenbankzustände, Artefakt-Metadaten, Blob-/Object-Storage-Daten und relevante Konfigurationsstände
- definierte Restore-Pfade und Restore-Tests
- klare Trennung zwischen Backup, Archivierung, Export und Wiederherstellung
- Sicherungsziele nicht nur lokal, sondern mindestens optional auch auf getrennte lokale Datenträger, zweite Hosts, NAS- oder Offsite-Ziele sowie kompatible Object-Storage-Ziele
- Secrets und hochsensible Daten nur in einer dafür vorgesehenen, gesondert abgesicherten Backup-Strategie
- regelmäßige Nachweise, dass Restore real funktioniert

## 26. Definition von Betriebsreife und Verkaufsfähigkeit

### 26.1 Zusätzliche Release-, Build- und Installationswahrheit

Zusätzlich zur allgemeinen Betriebsreife gelten folgende konkrete Anforderungen:

- sauberer Release-Snapshot
- reproduzierbare Builds
- reproduzierbare Tests
- belastbare lokale Release-Prüfung
- Host-Installer-, Bootstrap- und Smoke-Reife
- klare Trennung zwischen internen Produktlücken und externen Blockern
- explizite Release- und Validierungssicht in der Control Plane
- Nachweis, dass Host- und Containerpfade nicht nur behauptet, sondern real getestet sind


ForgeFrame ist erst dann verkaufsfähig, wenn mindestens gilt:

- Produktwahrheit ist konsistent
- Security und Policy werden real durchgesetzt
- offene Runtime-Verträge bleiben ehrlich
- native ForgeFrame-Produktpfade sind klar definiert
- OpenAI-kompatible Provider und Clients sind maximal kompatibel im Sinne dieses Dokuments
- OpenAI Codex ist als OAuth-Achse vollständig nutzbar mit allen vom Provider angebotenen relevanten Features
- GitHub Copilot, Claude Code und Antigravity sind als OAuth- oder Account-Achsen vollständig nutzbar mit allen vom jeweiligen Provider angebotenen relevanten Features, soweit dieselbe Reifestufe beansprucht wird
- Gemini ist nur dann auf derselben Reifestufe versprochen, wenn eine tragfähige OAuth-Implementierungsmöglichkeit existiert und dieselbe Vollständigkeitsanforderung real erfüllt wird; andernfalls ist die Reife ehrlich enger klassifiziert
- Routingentscheidungen sind nachvollziehbar
- simple- und non-simple-Policies sind produktiv wirksam
- Queue- und Dispatch-Wahrheit ist persistent und operatorisch belastbar
- Premium-Targets werden nicht planlos als Standard missbraucht
- lokale und günstige Pfade sind sinnvoll integrierbar
- Sync- und Async-Ausführung sind sauber getrennt
- Work Interaction ist ein echter Produktpfad, keine Dekoration
- Außenaktionen haben belastbare Preview- und Approval-Flows
- Kontext- und Memory-Schichten sind kontrollierbar und nachvollziehbar
- Learning Persistence, Durable Memory und Skills sind echte Produktpfade und keine Agentenmagie
- PostgreSQL ist produktiver Primärpfad
- der normative Linux-/Host-Betriebspfad ist real tragfähig und verbindlich
- öffentliche Exponierung, FQDN, TLS und Zertifikatsmanagement sind als echte Produktpfade belastbar
- Artefakt- und Blob-Strategie ist sauber geregelt
- Retention, Löschung und Archivierung sind definiert
- Release-Gates sind reproduzierbar grün
- keine groben Fake-Claims bleiben

Betriebsreife muss zusätzlich durch belastbare Nachweise belegbar sein, mindestens durch:

- reproduzierbare Testläufe
- Routing- und Policy-Simulationen
- Queue-, Retry-, Lease- und Recovery-Tests
- Negativfall- und Fehlersemantik-Tests
- Sicherheits- und Auditnachweise
- Last- oder Stresstests für kritische Lanes und Targets
- Nachweise für Approval-, Außenaktions- und Zustellpfade
- Nachweise für Host-Installer-, Bootstrap-, Smoke- und Exponierungspfad
- Nachweise für Zertifikatsausstellung, Verlängerung, Fehlerzustände und Operator-Sicht

---

## 27. Nicht verhandelbare Abschlussregeln

ForgeFrame darf nur behaupten, was es in:

- Code
- Runtime
- UI
- Persistenz
- Health und Readiness
- Routing und Dispatch
- Queue- und Worker-Ausführung
- Tests
- Release-Gates

wirklich tragen kann.

Zusätzlich gilt:

- Routing darf nie smart heißen, wenn es nicht erklärbar ist
- Queueing darf nie produktreif heißen, wenn Zustände nur kosmetisch sind
- simple und non-simple dürfen nie nur UI-Schalter ohne Laufzeitwirkung sein
- Execution-Lanes dürfen nie fachliche Routing-Klassen ersetzen
- offene Runtime-Standardpfade dürfen nie heimlich zu Langläufer-Jobverträgen werden
- Premium-Provider dürfen nie aus Bequemlichkeit globaler Standardpfad werden
- OpenAI Codex, GitHub Copilot, Claude Code und Antigravity dürfen nie als tief produktisierte OAuth-Achsen behauptet werden, wenn nicht alle vom jeweiligen Provider angebotenen relevanten Features real vollständig nutzbar sind und Session-, Probe-, Runtime-, Streaming-, Tool- und Operator-Wahrheit dafür nicht real vorhanden sind
- Gemini darf nie auf dieselbe OAuth-Reifestufe behauptet werden, wenn keine tragfähige OAuth-Implementierungsmöglichkeit existiert oder dieselbe Vollständigkeitsanforderung nicht real erfüllt wird
- Edge- oder Admission-Layer dürfen nie die Instanzwahrheit zerstören
- ForgeFrame darf seine Standard-Erreichbarkeit unter `https://<fqdn>/` auf dem vorgesehenen Produktpfad nicht nur durch externe Fremdkomponenten simulieren
- automatisiertes Zertifikatsmanagement darf nie behauptet werden, wenn Ausstellung, Verlängerung, Fehlerzustände und Operator-Sicht nicht real vorhanden sind
- Learning darf nie unkontrolliertes Ansammeln sein
- Memory darf nie undifferenzierte Sammelhalde sein
- Skills dürfen nie bloße Prompt-Schnipsel ohne Governance und Provenienz sein
- Außenaktionen dürfen nie still aus Empfehlungen oder Drafts entstehen
---

## 28. Normatives Glossar

Dieses Glossar definiert zentrale Begriffe dieses Dokuments verbindlich. Wo andere Kapitel kürzer oder alltagssprachlicher formulieren, gilt im Zweifel dieses Glossar.

### 28.1 Plattform
Die Plattform ist die gesamte ForgeFrame-Installation bzw. der gesamte ForgeFrame-Betriebsstack oberhalb einzelner Tenants oder Instanzen.

### 28.2 Tenant / Organisation
Ein Tenant bzw. eine Organisation ist die Mandantenschicht zwischen Plattform und Instanz. Sie kapselt Zugehörigkeit, Richtlinien, Budgets, Sichtbarkeit und gegebenenfalls Billing-Kontexte.

### 28.3 Instanz
Die Instanz ist die zentrale fachliche und betriebliche Einheit des Produkts. In ihr leben Ziele, Agenten, Routing-Policies, Budgets, Conversations, Runs, Work Interaction sowie Memory- und Skill-Wahrheit.

### 28.4 Provider
Ein Provider ist die externe oder lokale Quelle eines Modells oder einer Runtime-Fähigkeit, z. B. OpenAI Codex, GitHub Copilot, Claude Code, Antigravity, Gemini oder Ollama.

### 28.5 Target
Ein Target ist ein konkret routing- und dispatchbares Ausführungsziel innerhalb eines Providers, einschließlich Modell, Integrationsklasse, Auth-Typ, Capability-Profil, Kostenklasse und operativer Eigenschaften.

### 28.6 Capability
Eine Capability ist eine technische Fähigkeit eines Providers oder Targets, z. B. Streaming, Tool-Calling, strukturierte Ausgabe oder Code Execution.

### 28.7 Execution Trait
Ein Execution Trait beschreibt operative Eignungen oder Laufzeitcharakteristika, z. B. `oauth_serialized`, `low_latency_fit` oder `background_run_fit`.

### 28.8 Policy Flag
Ein Policy Flag beschreibt eine regulatorische, sicherheitsbezogene oder governance-seitige Einschränkung oder Zusatzanforderung, z. B. `approval_required`.

### 28.9 Economic / Quality Profile
Economic- bzw. Quality-Profile sind wirtschaftliche oder qualitative Einordnungen wie `cost_class` oder `quality_tier`. Sie sind keine technischen Capabilities.

### 28.10 Harness
Der Harness ist der generische Integrations- und Ausführungsrahmen für Profile, Templates, Discovery, Preview, Verify, Execute, Sync und ähnliche generische Produktpfade.

### 28.11 Plugin
Ein Plugin erweitert ForgeFrame um zusätzliche Produktfunktionalität, Integrationen, UI-Module oder domänenspezifische Erweiterungen. Ein Plugin ist nicht dasselbe wie ein Skill.

### 28.12 Skill
Ein Skill ist ein versionierbarer, aktivierbarer und governance-fähiger prozeduraler Baustein. Er beschreibt wiederverwendbares Vorgehenswissen und ist nicht bloß ein loses Prompt-Snippet.

### 28.13 Learning Event
Ein Learning Event ist ein Ereignis innerhalb des Learning Persistence Loop, z. B. ein vorgeschlagener, bestätigter, verworfener oder reviewpflichtiger Persistenzvorgang. Ein Learning Event ist nicht automatisch Durable Memory.

### 28.14 Boot Memory
Boot Memory ist ein kleiner, kuratierter und kosteneffizienter Start-Snapshot für Runs oder Sessions.

### 28.15 Working Context
Working Context ist der laufende, situationsbezogene Arbeitskontext eines konkreten Threads, Tasks, Runs oder Workspaces. Er ist nicht automatisch Langzeitwahrheit.

### 28.16 Durable Memory
Durable Memory ist die strukturierte, persistente und auditierbare Langzeitwahrheit mit Quelle, Scope, Vertrauensklasse, Revision und Korrekturstatus.

### 28.17 Recall
Recall ist der gezielte Rückgriff auf vergangene Conversations, Artefakte, Entscheidungen, Skills oder Memory-Einträge. Recall ist nicht identisch mit bestätigter Produktwahrheit.

### 28.18 Conversation
Eine Conversation ist ein erstklassiges Arbeitsobjekt der Work-Interaction-Schicht. Sie bildet den übergeordneten Gesprächs- und Arbeitskontext.

### 28.19 Thread
Ein Thread ist eine fokussierte Untereinheit einer Conversation zur geordneten Teilarbeit.

### 28.20 Session
Eine Session ist ein konkreter Lauf- oder Interaktionsabschnitt innerhalb einer Conversation oder eines technischen Kontextes.

### 28.21 Mention
Eine Mention ist eine strukturierte Agenten- oder Teilnehmeradressierung, z. B. `@Agentenname`, mit echter Referenz auf ein Instanzobjekt. Sie ist nicht bloß freier Text.

### 28.22 Participant
Ein Participant ist ein explizit modellierter Teilnehmer einer Conversation oder eines Threads, z. B. Mensch, Agent oder Systemrolle.

### 28.23 Task
Ein Task ist ein expliziter Arbeitsgegenstand mit Zuständigkeit, Status, Kontext und möglicher Verknüpfung zu Runs, Approvals, Handoffs oder Artefakten.

### 28.24 Run
Ein Run ist eine konkrete Ausführungseinheit für nichttriviale, agentische oder orchestrierte Arbeit. Ein Run ist nicht dasselbe wie ein Queue-Job.

### 28.25 Dispatch Job
Ein Dispatch Job ist die persistente Scheduling- und Abarbeitungseinheit der Dispatch- und Queue-Schicht. Ein Run kann einen oder mehrere Dispatch Jobs umfassen.

### 28.26 Approval
Ein Approval ist ein expliziter Freigabevorgang. Approval-Aktionen wie `approve` oder `reject` sind fachliche Freigabeentscheidungen und nicht bloß Run-Steueraktionen.

### 28.27 Action
Eine Action ist eine potenzielle oder reale Außenwirkung bzw. ein steuernder Produktvorgang, der als `read_only`, `recommend`, `draft`, `simulate`, `request_approval`, `execute_low_risk`, `execute_high_risk` oder `irreversible` klassifiziert sein kann.

### 28.28 Action Draft
Ein Action Draft ist eine vorbereitete, aber noch nicht ausgeführte Aktion ohne Außenwirkung.

### 28.29 Action Preview
Ein Action Preview ist die Vorschau oder Simulation einer potenziellen Aktion vor Freigabe oder Ausführung.

### 28.30 Artefakt
Ein Artefakt bzw. Artefakt ist ein versionierbares Ergebnis- oder Hilfsobjekt wie Datei, Preview-Datei, Log, Report, Screenshot oder Übergabedokument. Im Dokument gilt die Bezeichnung **Artefakt** als bevorzugte deutsche Form; die englische Form **Artefakt** ist nur als Produkt- oder API-Nähe zulässig.

### 28.31 Handoff
Ein Handoff ist die strukturierte Übergabe von Arbeitsstand, Verantwortung, Kontext oder Artefakten zwischen Menschen, Agenten oder Produktobjekten.

### 28.32 Coordinator / Operator
Der Coordinator bzw. Operator ist der pro Instanz verpflichtende zentrale Lead-Agent mit Default-Namen `Operator`, der allgemeine Anweisungen entgegennimmt, koordiniert, delegiert und Ergebnisse verdichtet zurückführt.



### 28.39 Technischer Betriebsmodus
Ein technischer Betriebsmodus beschreibt die betriebliche und infrastrukturelle Ausprägung von ForgeFrame, z. B. `Local Solo`, `Shared Private` oder `Hosted / Public / Managed`. Technische Betriebsmodi sind nicht identisch mit der vereinfachten Onboarding-Sprache.

### 28.40 Onboarding-Betriebsart
Eine Onboarding-Betriebsart ist die verständliche UI-Auswahl beim Setup, z. B. `Nur ich`, `Mein Team / meine Firma` oder `Mehrere Kunden / Organisationen`. Sie muss deterministisch auf Plattformmodell und technischen Betriebsmodus abgebildet werden.

### 28.41 API-Key
Ein API-Key ist ein scope- und instanzgebundenes Zugangsartefakt für Requests gegen ForgeFrame. Ein gültiger Bearer-API-Key entscheidet mindestens über Authentisierung, Instanzzuordnung und zulässige Request-Pfade.

### 28.42 Smart Routing Pfad
Der Smart Routing Pfad ist der instanzgebundene, policy-, capability-, execution- und kostenbasierte Standardpfad, auf dem ForgeFrame das geeignete Target und die geeignete Execution-Lane auswählt.

### 28.43 Direkt gepinnter Target-Pfad
Ein direkt gepinnter Target-Pfad ist ein bewusst konfigurierter Pfad, bei dem Requests ohne Smart-Router-Auswahl auf ein festgelegtes Target geleitet werden, soweit Policy und Scope dies erlauben.

### 28.44 Local-only-Pfad
Ein Local-only-Pfad ist ein restriktiver Pfad, der nur lokale oder ausdrücklich dafür freigegebene interne Targets zulässt.

### 28.45 Queue-/Background-Pfad
Ein Queue-/Background-Pfad ist ein explizit festgelegter Pfad, auf dem Requests nicht direkt interaktiv, sondern über persistente Queue-, Run- oder Workermechanik verarbeitet werden.

### 28.46 Reviewpflichtiger Pfad
Ein reviewpflichtiger Pfad ist ein Pfad, bei dem vor weiterer Ausführung eine explizite menschliche oder regelbasierte Freigabe erforderlich ist.

### 28.37 Produktwahrheit
Produktwahrheit ist die in Code, Runtime, Persistenz, Health/Readiness, API-Verhalten, Queue-/Dispatch-Logik, Tests und Release-Gates tatsächlich getragene Wahrheit des Produkts.

### 28.38 Maximale Kompatibilität
Maximale Kompatibilität bedeutet im Dokument das höchstmögliche reale Maß an OpenAI-kompatiblem Verhalten in Request-, Response-, Fehler-, Streaming- und Tool-Semantik. Abweichungen sind nur zulässig, wenn sie technisch unvermeidbar, explizit typisiert, dokumentiert und operatorisch sichtbar sind.

