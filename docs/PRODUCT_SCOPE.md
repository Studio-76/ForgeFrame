# ForgeGate – Zielbild Endausbau

## 1. Zweck des Dokuments

Dieses Dokument beschreibt das **vollständige Zielbild für den finalen Endausbau von ForgeGate** als **fertiges, verkaufsfähiges Produkt**.

Es ist bewusst nicht als Sprint- oder Phasenbeschreibung geschrieben, sondern als **Produktzielbild** für den Zustand, in dem ForgeGate:

- technisch belastbar,
- operativ beherrschbar,
- funktional breit einsetzbar,
- für Kunden verständlich positionierbar,
- und kommerziell sauber verkaufbar

ist.

---

## 2. Produktdefinition

ForgeGate ist eine **docker-first Smart AI Gateway-, Harness- und Control-Plane-Plattform**, die AI-Provider, OAuth-/Account-Dienste, lokale Modelle und OpenAI-kompatible Clients in einer einheitlichen Produktoberfläche und Runtime zusammenführt.

ForgeGate ist nicht nur ein Proxy und nicht nur ein Adapter.
ForgeGate ist die **zentrale Produkt- und Betriebsschicht** zwischen:

- Cloud-AI-Providern
- OAuth-/Account-basierten AI-Diensten
- lokalen Modellruntimes
- OpenAI-kompatiblen Tools und Clients
- Administratoren, Betreibern und Integratoren

Ziel ist, dass neue Provider, Modelle und Integrationen **ohne zusätzliche Zwischentools** angebunden, betrieben, getestet, überwacht und wirtschaftlich bewertet werden können.

---

## 3. Produktrollen im Endausbau

ForgeGate erfüllt im Endausbau gleichzeitig diese Rollen:

### 3.1 Smart AI Gateway
Ein einheitlicher, produktionsfähiger Zugriffspunkt für AI-Modelle und Provider mit möglichst hoher OpenAI-Kompatibilität.

### 3.2 Provider Harness
Ein generischer Integrationskern, mit dem einfache, exotische, teilweise kompatible oder OAuth-/Bridge-basierte Anbieter angebunden, geprüft, getestet und produktiv nutzbar gemacht werden können.

### 3.3 UI-first Control Plane
Eine vollständige Arbeitsoberfläche für Betrieb, Diagnose, Governance, Qualität, Kosten, Health, Discovery, Sync und Operator-Entscheidungen.

### 3.4 Betriebs- und Observability-Plattform
Eine zentrale Stelle für:
- Fehleranalyse
- Laufhistorie
- Health-Überwachung
- Kosten- und Nutzungsanalyse
- Client-/Consumer-/Integrationssicht
- Alerting und Needs-Attention-Signale

---

## 4. Harte Produktprinzipien

### 4.1 Docker-first
ForgeGate wird im Zielzustand standardmäßig als **docker-first Produkt** betrieben.

### 4.2 Einfache Standard-Topologie
Das Standard-Zielbild ist:
- **1 ForgeGate-Container**
- **1 PostgreSQL-Container**

Das Frontend wird im ForgeGate-Container mitgebaut und von dort ausgeliefert.

### 4.3 UI-first statt Shell-first
Nahezu alle produktiven Operator-Aktionen sollen im finalen Zielbild über das UI bedienbar sein.
Shell und manuelle Dateibearbeitung sind nur noch für Sonderfälle, Entwicklung oder Recovery gedacht.

### 4.4 From scratch, keine versteckte Altcode-Portierung
`reference/` bleibt reines Referenzmaterial. Produktive Semantik entsteht kontrolliert in ForgeGate selbst.

### 4.5 Ehrliche Produktsemantik
Keine als „fertig“ wirkenden Produktachsen, wenn die operative Tiefe tatsächlich noch fehlt.
Control Plane, Snapshot, Matrix und Runtime-Wahrheit sollen konsistent sein.

### 4.6 Maximale Produktsubstanz vor künstlicher Verhärtung
ForgeGate soll im Endausbau **maximale Features und Nutzbarkeit** liefern.
Enterprise-Tauglichkeit darf Features nicht künstlich verarmen lassen.

---

## 5. Die vier Produktachsen

ForgeGate trennt dauerhaft vier Produktachsen. Diese Trennung ist ein Kernbestandteil des Zielbilds.

### 5.1 OAuth-/Account-Provider
Diese Achse betrifft Provider, deren Wert nicht nur in einem API-Key liegt, sondern in:
- Account-Zugängen
- OAuth-/Session-Modellen
- Bridging
- Verify-/Probe-/Readiness-Logik
- operatorischer Sichtbarkeit

Im Zielbild gehören dazu mindestens:
- OpenAI Codex
- Gemini
- Antigravity
- GitHub Copilot
- Claude Code

#### Zielzustand dieser Achse
- saubere Auth-/Credential-/Session-Semantik
- klare Readiness-/Health-/Verify-/Probe-Semantik
- sichtbarer OAuth-Modus im UI
- belastbare Runtime oder ehrlich deklarierte Bridge-/Partial-Semantik
- Observability über Probe, Bridge, Failures, letzte Aktionen, failure_rate, ops-Historie
- keine Vermischung mit normalen API-Key-Providern

### 5.2 OpenAI-kompatible Provider
Diese Achse betrifft sonstige Cloud-Provider und OpenAI-ähnliche Dienste, die über eine **möglichst weitgehende OpenAI-kompatible Schnittstelle** angebunden werden sollen.

#### Zielzustand dieser Achse
- praktisch maximale Kompatibilität für:
  - request shapes
  - response shapes
  - errors
  - streaming
  - tool calling
  - model listing
  - unsupported / partial behavior
- generische Harness-/Template-/Profile-Kopplung
- keine zusätzliche Proxy-Landschaft notwendig
- neue Provider sollen über ForgeGate angebunden und produktiv gemacht werden können

Aktuelle Beta-Wahrheit im Repo:
- Mindestens ein harness-gestütztes OpenAI-kompatibles Profil ist jetzt end-to-end über `preview`, `verify`, `probe`, Runtime-`chat`, Runtime-`responses`, Streaming und Fehlernormalisierung nachgewiesen.
- Die Achse bleibt trotzdem bewusst `partial`: Der Proof gilt für bekannte generische Harness-Profile und ist kein pauschaler Claim, dass jeder OpenAI-kompatible Provider bereits produktiv gleich tief unterstützt wird.
- Ein nativer Anthropic-`/messages`-Pfad gehört aktuell **nicht** zu dieser Achse. Solange ForgeGate bei vier shipped Produktachsen bleibt und keine ehrliche Anthropic-Taxonomie besitzt, bleibt Anthropic explizit außerhalb der Beta-Target-Matrix und darf nicht als OpenAI-kompatible Provider-Wahrheit erscheinen.

### 5.3 Lokale Provider
Diese Achse betrifft lokale Modellruntimes.

Im Zielbild ist mindestens enthalten:
- dedizierte Ollama-Anbindung

#### Zielzustand dieser Achse
- robuste lokale Runtime
- Streaming
- Tool-Calling-Semantik soweit sinnvoll
- lokale Health-/Readiness-Prüfung
- lokale Fehlersemantik
- Integration in Kosten-, Usage- und Health-Sicht

### 5.4 OpenAI-kompatible Clients
ForgeGate soll im Zielbild für Clients, Tools, SDKs und Integrationen **möglichst weitgehend wie ein OpenAI-kompatibles Produkt** wirken.

Im Zielzustand müssen mindestens belastbar sein:
- `/v1/models`
- `/v1/chat/completions`
- `/v1/responses`

#### Zielzustand dieser Achse
- möglichst hohe Formatreue für Inputs und Outputs
- OpenAI-nahe Tool-Calling-Semantik
- OpenAI-nahe Fehlerformen
- robuste Streaming-Semantik
- konsistente Response-Fidelity
- saubere Behandlung von unsupported/partial Fällen
- möglichst geringe Anpassungsnotwendigkeit für Clients

---

## 6. Runtime-Zielbild

### 6.1 Kernendpunkte
ForgeGate stellt im Endausbau mindestens diese produktiven Kernendpunkte bereit:

- `GET /health`
- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/responses`

Optional und je nach Produktstand weiter ausbaubar:
- embeddings
- rerank
- vision
- administration-spezifische APIs
- provider-/health-/usage-spezifische Endpunkte

### 6.2 Runtime-Fähigkeiten
Im Endzustand soll die Runtime:
- Routing
- Dispatch
- Providerauflösung
- Modellauswahl
- Readiness-Prüfung
- Fehlernormalisierung
- Streaming
- Tool Calling
- Usage-Erfassung
- Kostenbewertung
- Health-/Ops-Kopplung

zentral und konsistent bereitstellen.

### 6.3 Routing-Zielbild
Routing darf im Endausbau nicht nur „requested model oder default model“ sein.
Es soll unterstützen:
- Modell-Ownership
- Provider-Ownership
- Capability-Matching
- Fallbacks
- Selection-Regeln
- Kompatibilitätslogik
- Health-/Readiness-basierte Entscheidung
- optional policies / Präferenzen / Kosten-/Qualitätskriterien

---

## 7. Tool-Calling-Zielbild

Tool Calling ist im Endausbau kein Nebenfeature, sondern Kernbestandteil der Kompatibilitäts- und Gateway-Semantik.

### 7.1 Zielzustand
- sauberes Tool-Schema
- tool_choice-Semantik
- Stream-/Non-Stream-Parität
- Output-Fidelity ohne Informationsverlust
- Provider-/Capability-Gating
- klare Partial-/Unsupported-Semantik
- Mapping in OpenAI-nahe Antwortformen
- Fehler bei inkonsistenten Tools oder ungültigen Kombinationen klar und differenziert

### 7.2 Ziel über alle Achsen
Tool Calling soll im Zielbild:
- für OpenAI-kompatible Provider möglichst weit funktionieren
- für OpenAI-kompatible Clients möglichst weit transparent sein
- für Codex-/OAuth-/Bridge-Pfade ehrlich und belastbar wirken
- bei nicht unterstützenden Providern sauber abgewehrt werden, statt diffuse Fehler zu erzeugen

---

## 8. Fehler- und Kompatibilitätszielbild

### 8.1 Fehlerbehandlung
ForgeGate soll im Endausbau eine tiefe, konsistente und operatorisch nutzbare Fehlersemantik haben.

Mindestens sauber abgedeckt:
- 400 / 401 / 403 / 404 / 408 / 409 / 410 / 413 / 415 / 422 / 429 / 5xx
- provider_not_ready
- provider_configuration_error
- provider_authentication_error
- provider_model_not_found
- provider_bad_request
- provider_timeout
- provider_rate_limited
- provider_upstream_error
- provider_protocol_error
- provider_stream_interrupted
- provider_unsupported_feature

### 8.2 Praktische Edgecases
Im Zielbild sollen realistische Kanten sauber behandelt werden:
- leere Bodies
- malformed JSON trotz 200
- falscher content-type trotz Payload
- richtiger content-type mit defekter Payload
- fehlender done marker
- früh abgebrochene Streams
- partielle Chunks
- Retry-After-Varianten
- Modell-nicht-gefunden vs. Provider-nicht-bereit vs. Konfigurationsfehler
- Tool-Calling + Streaming-Kombinationskanten
- Response-Shape-Mismatch

### 8.3 OpenAI-Nähe
Fehler sollen für OpenAI-kompatible Clients so nah wie sinnvoll an OpenAI liegen, ohne unehrlich zu werden.

---

## 9. Provider-Harness-Zielbild

Der Harness ist ein zentraler Wettbewerbsvorteil von ForgeGate.

### 9.1 Zielzustand
ForgeGate soll neue Provider und Integrationen über den Harness anbinden können mit:

- Templates
- Profile
- Request-/Response-/Error-/Stream-Mapping
- Preview
- Verify
- Dry-Run
- Probe
- Execute
- Discovery
- Sync
- Inventory
- Run-Historie
- Snapshot-Sichten
- Aktivierung/Deaktivierung
- Modellquellen
- tool_calls mapping
- backward-compatible Mapping für ältere Profile

### 9.2 Zielnutzen
Damit sollen auch einfache, exotische oder nur teilweise kompatible Anbieter ohne separates Tool produktiv gemacht werden können.

### 9.3 Persistenz
Harness-Zustände, Profile, Runs und Snapshots sollen dauerhaft in PostgreSQL liegen.
File-Fallback ist nur Not-/Dev-/Fallback-Pfad.

---

## 10. Modell-, Discovery- und Inventory-Zielbild

### 10.1 Modellkatalog
ForgeGate soll im Endzustand einen konsistenten, operatorisch nutzbaren Modellkatalog führen.

Er soll unterscheiden können zwischen:
- statischen Modellen
- discovered Modellen
- provider-seitigen Modellen
- harness-seitigen Modellen
- aktivierten vs. deaktivierten Modellen
- ready / partial / planned / failed / unavailable

### 10.2 Discovery & Sync
ForgeGate soll Discovery und Sync providerübergreifend unterstützen:
- Modellinventar aktualisieren
- Stale-Zustände markieren
- letzte erfolgreiche und fehlgeschlagene Syncs festhalten
- Discovery-/Sync-Probleme im UI sichtbar machen
- operatorische Actions erlauben

### 10.3 Ownership und Zuordnung
Modelle sollen sauber einem:
- Provider
- Profil
- Template
- Integrationspfad
- Status
- Capability-Set
zugeordnet werden können.

---

## 11. Health-Zielbild

### 11.1 Zielzustand
Health ist im Zielbild mehr als ein einfacher Ping.

ForgeGate soll unterscheiden können zwischen:
- Provider-Health
- Modell-Health
- Probe-Health
- Runtime-Health
- Operator-Health-Signal

### 11.2 UI-Steuerung
Health Checks sollen im UI:
- aktivierbar/deaktivierbar
- konfigurierbar
- manuell auslösbar
- historisch einsehbar

sein.

### 11.3 Kosten
Health-Check-Traffic und Health-Check-Kosten sollen separat erfasst und sichtbar gemacht werden, damit Admins Aufwand und Nutzen abwägen können.

---

## 12. Observability-, Usage- und Kostenzielbild

### 12.1 Usage
ForgeGate soll umfassend erfassen:
- Requests
- Streams
- Tokens
- Modellnutzung
- Providernutzung
- Client-/Consumer-Nutzung
- Health-Traffic
- Runtime-Traffic
- Tool-Calling-Nutzung

### 12.2 Fehlerachsen
Fehler sollen mindestens sichtbar sein nach:
- Provider
- Modell
- Profil
- Integration
- Client
- Consumer
- Traffic-Typ
- Error-Typ
- Statuscode
- Zeitfenster

### 12.3 Kostenachsen
ForgeGate soll im Zielbild Kosten in mindestens drei Achsen abbilden:
- **actual** — tatsächlich angefallene Kosten
- **hypothetical** — theoretisch angefallene Kosten
- **avoided** — vermiedene Kosten, z. B. bei OAuth-/Account-/Bridge-Nutzung

### 12.4 Historie
Alle relevanten Events sollen persistent historisiert werden:
- usage
- errors
- health
- oauth operations
- runs
- snapshots

### 12.5 Operator-Sicht
Im UI sollen daraus entstehen:
- Trends
- Zeitfenster
- failure_rate
- last_failed_operation
- needs_attention
- Alerts
- last_failed_run
- runs_by_provider
- profile_count
- profiles_needing_attention

---

## 13. UI- / Control-Plane-Zielbild

### 13.1 Grundsatz
Im Endausbau ist die UI nicht nur Beifang, sondern die primäre Arbeitsoberfläche.

### 13.2 Zielmodule
Die UI soll mindestens aus sauber trennbaren, wartbaren Produktmodulen bestehen für:

- Dashboard
- Provider
- OAuth-/Account-Ziele
- Harness-Profile
- Harness-Runs
- Discovery / Sync / Inventory
- Health
- Usage / Kosten / Trends
- Errors / Alerts
- Client-/Consumer-Ops
- Bootstrap-/Install-/Readiness-Sicht
- Produkt-/Kompatibilitätsmatrix
- Einstellungen / Konfiguration / Pfade / Defaults

### 13.3 Operator-Nutzen
Admins sollen im UI mindestens:
- Provider anlegen, ändern, aktivieren, deaktivieren
- Profile anlegen und pflegen
- Verify / Probe / Dry-Run / Sync ausführen
- Fehlerlagen erkennen
- Modell-/Providerzustand beurteilen
- Costs und Usage bewerten
- Health steuern
- problematische Clients erkennen
- OAuth-Ziele operatorisch steuern

können.

### 13.4 Theme
- Dark Mode und Light Mode
- Dark Mode als Standard
- keine Funktionsregression zwischen beiden Modi

---

## 14. Provider-spezifisches Zielbild

### 14.1 OpenAI Codex
Zielzustand:
- tiefste OAuth-/Bridge-/Runtime-/Operatorik-Achse unter den OAuth-Providern
- klare Auth-/Session-/Probe-/Readiness-Semantik
- maximale praktische Response-/Streaming-/Tool-/Compat-Tiefe
- operatorisch vollständig sichtbar

### 14.2 Gemini
Zielzustand:
- belastbare OAuth-/Probe-/Bridge-/Runtime-Semantik
- klare Fehler-/Protocol-/Streaming-/Timeout-/Retry-Semantik
- Tool- und Response-Fidelity soweit praktisch möglich

### 14.3 Antigravity
Zielzustand:
- produktive OAuth-/Account-Achse
- operatorisch sauber sichtbar
- ehrliche Bridge-/Verify-/Probe-/Runtime-Semantik
- keine bloße Deko-Achse

### 14.4 GitHub Copilot
Zielzustand:
- produktive OAuth-/Account-Achse
- operatorisch sauber sichtbar
- klare Runtime-/Bridge-/Probe-/Status-Semantik

### 14.5 Claude Code
Zielzustand:
- produktive OAuth-/Account-Achse
- operatorisch sauber sichtbar
- ehrliche Runtime-/Bridge-/Probe-/Status-Semantik

### 14.6 OpenAI-kompatible Provider allgemein
Zielzustand:
- möglichst hohes Maß an praktischer Kompatibilität
- möglichst wenig Sonderbehandlung durch den Nutzer
- neue Provider über Templates/Profiles schnell anschließbar

### 14.7 Ollama
Zielzustand:
- dedizierter, robuster Local-Provider-Pfad
- Streaming
- Health
- Fehlersemantik
- Integration in Kosten-/Usage-/Health-/Ops-Sichten

---

## 15. Deployment- und Installationszielbild

### 15.1 Standard-Betrieb
- Docker Compose als Standardpfad
- ForgeGate + PostgreSQL
- persistente Volumes
- Healthchecks
- Bootstrap-/Readiness-/Smoke-Pfade

### 15.2 Installer-/Bootstrap-Zielbild
Ein Anwender soll ForgeGate möglichst einfach produktiv starten können.

Zielzustand:
- Bootstrap-/Installationsroutine
- automatische Grundkonfiguration
- ENV-/Compose-Vorlagen
- Readiness-Checks
- Smoke-Checks
- verständliche Next-Steps
- Recovery-/Troubleshooting-Hinweise

### 15.3 Spätere Erweiterbarkeit
Später optional:
- Reverse Proxy / TLS / Domain-Integration
- Upgrades
- Backup-/Restore-Routinen
- Install-/Update-Assistent

---

## 16. Persistenz- und Datenzielbild

### 16.1 PostgreSQL als Primärpfad
Im Endausbau ist PostgreSQL der produktive Primärspeicher für:
- Harness-Profile
- Harness-Runs
- Harness-Snapshots
- operative Zustände
- spätere weitere persistente Control-Plane-Daten

### 16.2 JSONL-/File-Fallback
Dateibasierte Pfade bleiben nur:
- als Dev-Fallback
- für Notfälle
- für bestimmte Append-Log-Szenarien
- oder für Übergangslösungen

### 16.3 Keine unnötig flüchtige Operatorik
Wichtige operatorische Zustände sollen nicht mehr primär in-memory leben.

---

## 17. Qualität des fertigen verkaufsfähigen Produkts

Ein verkaufsfähiges ForgeGate-Endprodukt soll diese Eigenschaften erfüllen:

### 17.1 Für Käufer verständlich
- klares Produktprofil
- klare Abgrenzung zu bloßen Proxies
- klarer Nutzen: Gateway + Harness + Control Plane

### 17.2 Für Betrieb belastbar
- sinnvolle Persistenz
- brauchbare Operator-Sicht
- reproduzierbare Bootstrap-/Compose-Pfade
- klare Fehler- und Health-Semantik

### 17.3 Für Integratoren attraktiv
- OpenAI-kompatible Clients
- OpenAI-kompatible Provider
- OAuth-/Account-Bridges
- generischer Harness
- geringe zusätzliche Integrationslast

### 17.4 Für Admins benutzbar
- UI-first
- klare Operator-Wahrheit
- gute Alert-/Needs-Attention-Semantik
- echte Bedienbarkeit statt Doku oder versteckter Shell-Workflows

### 17.5 Für Vertrieb plausibel
ForgeGate soll als Produkt vermittelbar sein als:
- einheitliche AI-Zugangsschicht
- Betriebsplattform für AI-Zugänge
- Integrations- und Diagnoseplattform
- Selbsthosting-fähige AI-Control-Plane

---

## 18. Was im Endausbau ausdrücklich nicht akzeptabel ist

Im finalen Produktzustand sollen diese Zustände **nicht** mehr akzeptiert werden:

- Providerachsen, die „fertig wirken“, aber nur Fassade sind
- Modelle im Katalog, die praktisch noch irreführend sind
- stark flüchtige operatorische Zustände
- UI als große Sammelseite ohne modulare Produktlogik
- breite Shell-Pflicht für Standardaufgaben
- unklare Fehlerabbildung
- unscharfe Tool-Calling-Semantik
- breite Inkompatibilitäten zur OpenAI-Client-Welt
- Binär- oder Asset-Probleme als Teil normaler Produktflows
- Altbegriffe oder Altproduktreste außerhalb `reference/`

---

## 19. Fertig-Definition für den Endausbau

ForgeGate ist im Sinne dieses Zielbilds „fertig“, wenn mindestens gilt:

### 19.1 Runtime
- produktive Kernendpunkte belastbar
- OpenAI-kompatible Client-Semantik praktisch maximal
- OpenAI-kompatible Provider-Semantik praktisch maximal
- Codex OAuth praktisch maximal belastbar
- übrige OAuth-Achsen operativ belastbar und ehrlich eingeordnet

### 19.2 Harness
- neue Provider können ohne Extra-Tool angebunden, geprüft und produktiv betrieben werden
- Preview / Verify / Dry-Run / Probe / Sync / Inventory / Run-Historie sind echt produktiv nutzbar

### 19.3 Control Plane
- Standardoperatorik über UI möglich
- klare Wahrheit über Runtime, Health, Costs, Usage, Failures, OAuth-Ops, Harness-Ops und Needs-Attention

### 19.4 Betrieb
- docker-first Standardbetrieb sauber
- PostgreSQL als Primärpfad
- Bootstrap-/Smoke-/Readiness-Pfade brauchbar

### 19.5 Produktreife
- keine großen Scheinachsen
- keine gravierenden Runtime-Lücken
- keine gravierenden Kompatibilitätslücken in den Zielachsen
- keine groben operatorischen Blindstellen
- keine große Diskrepanz zwischen Produktbild und Realzustand

---

## 20. Zusammenfassung in einem Satz

ForgeGate soll im finalen Endausbau ein **verkaufsfähiges, selbst hostbares, docker-first Smart AI Gateway mit generischem Harness und UI-first Control Plane** sein, das **OAuth-/Account-Provider, OpenAI-kompatible Provider, lokale Modelle und OpenAI-kompatible Clients** in einer **operativ belastbaren, beobachtbaren, wirtschaftlich auswertbaren und produktiv benutzbaren Plattform** vereint.
