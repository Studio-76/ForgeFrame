# ForgeFrame

**Die Linux-first Control Plane und Runtime-Plattform für autonome AI-Instanzen.**

ForgeFrame vereint Smart AI Gateway, Smart Execution Routing, generischen Harness, Governance, Observability, Queueing, Work Interaction und optionale persönliche Assistenzmodi in einem einzigen, ehrlichen Produkt.

Es ist nicht nur ein Modell-Proxy.
Es ist nicht nur ein Chat-Frontend.
Es ist nicht nur ein Workflow-Builder.

**ForgeFrame ist der Betriebsrahmen, in dem AI-Instanzen sicher, nachvollziehbar, steuerbar, priorisierbar und produktiv betrieben werden.**

---

## Warum ForgeFrame

Die meisten AI-Lösungen scheitern an genau den Stellen, die in echten Umgebungen entscheidend sind:

- zu viele Provider, zu viele Sonderfälle, zu wenig Ordnung
- teure Modelle werden mit trivialen Aufgaben verstopft
- Routing ist intransparent oder kosmetisch
- Queueing ist nicht belastbar
- Health und Readiness sind geschönt statt ehrlich
- UIs sehen gut aus, aber tragen keine Runtime-Wahrheit
- Governance, Budgets und Freigaben werden erst nachträglich angeklebt
- Conversations, Tasks, Notifications und Außenaktionen leben in separaten Insellösungen

ForgeFrame wurde gebaut, um genau diese Brüche zu beseitigen.

Es schafft eine einheitliche Produktfläche für AI-Betrieb, AI-Steuerung und AI-gestützte Arbeit — mit echter technischer und operatorischer Wahrheit.

---

## Was ForgeFrame ist

ForgeFrame ist eine **Control-Plane- und Runtime-Plattform für autonome AI-Instanzen**.

Eine ForgeFrame-Instanz bündelt unter anderem:

- Provider und Modelle
- Accounts, OAuth-Bindings und API-Keys
- Routing-Policies und Provider-Targets
- Budgets, Limits und Cost-Safety-Regeln
- Queue-Klassen, Worker und Dispatch-Regeln
- Health-, Readiness- und Bootstrap-Wahrheit
- Artefakte, Workspaces und Handoffs
- Conversations, Inbox, Tasks und Notifications
- Kontakte, Quellen, Kontext- und Memory-Schichten
- Freigaben, Preview-Flows und Governance-Regeln
- optionale persönliche Assistenzlogik auf derselben Produktbasis

ForgeFrame ist damit der gemeinsame Rahmen für:

- operatorische AI-Arbeitssysteme
- teambezogene AI-Instanzen
- kundenspezifische AI-Betriebsräume
- persönliche Assistenzmodi auf gemeinsamer Governance- und Runtime-Wahrheit

---

## Die Produktsäulen

## Smart AI Gateway

ForgeFrame stellt eine belastbare, produktive Runtime-Schicht für AI-Clients bereit.

Dazu gehören insbesondere:

- `/health`
- `/v1/models`
- `/v1/chat/completions`
- `/v1/responses`

Dabei geht es nicht nur um Kompatibilität auf dem Papier, sondern um echte Produktsemantik:

- konsistente Fehlerabbildung
- saubere Streaming-Fidelity
- belastbare Tool-Fidelity
- klare Unsupported-/Partial-Semantik
- nachvollziehbare Modell- und Providerwahl
- sichtbare Runtime- und Betriebswahrheit

---

## Smart Execution Routing

ForgeFrame besitzt eine echte Smart-Execution-Schicht.

Sie entscheidet kontrolliert und erklärbar:

- welche Anfragen **simple** sind
- welche Anfragen **non-simple** sind
- welche Targets für eine Instanz überhaupt zulässig sind
- wann lokale oder günstige Pfade ausreichen
- wann auf stärkere oder teurere Targets eskaliert werden muss
- wann Arbeit synchron ausgeführt wird
- wann Queueing, Dispatch, Retry, Pause, Resume oder Circuit Breaker greifen

Das Ziel ist klar:

**teure Premium-Provider nicht mit einfacher Arbeit verstopfen, ohne dabei fachliche Qualität, Policy oder Verfügbarkeit zu verletzen.**

ForgeFrame routet deshalb nicht primär billig, sondern primär korrekt:

1. Capability
2. Policy und Rechte
3. Health und Verfügbarkeit
4. Wirtschaftlichkeit
5. Budget- und Limit-Konformität

---

## Provider Targets statt bloßer Modellnamen

ForgeFrame behandelt ein Ziel nicht als bloßen Modellstring.

Ein Provider-Target bildet die operative Wahrheit über ein tatsächlich nutzbares Ziel ab, einschließlich:

- Provider
- Modell
- Auth- oder Account-Typ
- Capability-Profil
- Kostenklasse
- Health- und Readiness-Status
- Priorität
- Queue-Eignung
- Stream-Fähigkeit
- Tool-Fähigkeit
- Fallback- und Eskalationszulässigkeit
- Instanzgebundene Rechte und Bindings

Erst dadurch werden Routing, Explainability und Governance wirklich belastbar.

---

## Queueing, Dispatch und Run-Orchestrierung

ForgeFrame trennt sauber zwischen:

- synchronen, latenzsensitiven Runtime-Anfragen
- schwereren interaktiven Anfragen
- agentischer, mehrstufiger oder langlaufender Arbeit
- serialisierten OAuth- oder accountgebundenen Ausführungspfaden

Dafür unterstützt ForgeFrame operative Execution-Lanes wie:

- Interactive Low Latency
- Interactive Heavy
- Background Agentic
- OAuth Serialized

Queueing ist dabei keine Deko, sondern Produktkern:

- persistente Jobs
- Worker-Leases
- Retry mit Backoff
- Pause / Resume / Interrupt
- Dead-Letter- und Quarantine-Semantik
- Queue-Explainability
- Dispatch-Historie
- laststabile Abarbeitung nichttrivialer Arbeit

---

## Generischer Harness

ForgeFrame besitzt einen generischen Harness, damit neue oder fremde Provider produktiv angeschlossen werden können, ohne jedes Mal einen vollständigen nativen Spezialadapter bauen zu müssen.

Zum Harness gehören unter anderem:

- Profile
- Templates
- Preview
- Verify
- Dry Run
- Probe
- Execute
- Inventory
- Discovery
- Sync
- Snapshot
- Import / Export
- Rollback
- persistente Runs
- Tool-Calling-Fähigkeit in generischen Pfaden

Damit wird ForgeFrame zur Integrationsplattform, nicht nur zum Endpunkt.

---

## UI-first Control Plane

ForgeFrame ist UI-first, aber nicht UI-fake.

Die Control Plane ist die zentrale Arbeitsoberfläche für Betreiber, Operatoren und Teams.
Sie ist dafür gedacht, echte Arbeit zu ermöglichen, nicht nur Zustände anzusehen.

Zu den zentralen Modulen gehören unter anderem:

- Dashboard
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
- Decisions / Approvals
- Workspaces
- Artifacts
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
- Assistant Profiles

Die Oberfläche soll modern, hochwertig, klar und vertrauenswürdig wirken — ohne jemals technische Lücken zu kaschieren.

---

## Work Interaction Layer

ForgeFrame ist nicht nur Infrastruktur, sondern auch Arbeitsoberfläche.

Die Work Interaction Layer verbindet Runtime, Routing und Governance mit echter Arbeit im Alltag.

Dazu gehören mindestens:

- Conversations / Threads / Sessions
- Inbox / Triage
- Tasks / Follow-ups / Reminders
- Notifications / Outbox / Delivery
- Action-Preview und Freigaben vor Außenaktionen
- Kontext- und Memory-Pflege
- Knowledge- und Connector-Eingänge
- Verknüpfung von Interaktionen mit Artefakten, Runs und Entscheidungen

So wird ForgeFrame nicht nur zur AI-Steuerung, sondern zur Plattform für arbeitsfähige AI-Instanzen.

---

## Personal Assistant Mode

ForgeFrame kann optional auch als persönlicher Assistenzmodus betrieben werden.

Dieser Modus ist keine separate Nebenwelt, sondern eine Spezialisierung auf Basis derselben Produktwahrheit.

Das bedeutet:

- dieselben Governance-Regeln
- dieselben Explainability-Prinzipien
- dieselben Routing- und Queue-Wahrheiten
- dieselben Freigabe- und Sicherheitsmechanismen

Hinzu kommen persönliche Erweiterungen wie:

- persönliches Profil
- Präferenzen
- Kommunikationsregeln
- Kontakte
- Kalender-, Mail- und Aufgabenbezüge
- Quiet Hours
- persönliche Zustellungslogik
- persönliche Assistenzregeln für Vorschlag, Rückfrage und Direktaktion

---

## Linux-first Deployment

ForgeFrame ist im Zielbild **linux-first und system-nativ installierbar**.

Das bedeutet:

- ForgeFrame wird standardmäßig direkt auf dem Linux-System installiert und betrieben
- ForgeFrame selbst ist im Standardpfad **nicht** an einen Docker-Container gebunden
- PostgreSQL kann nativ betrieben oder optional als dedizierter Docker-Container bereitgestellt werden
- ForgeFrame-Dienste sind system-nativ betreibbar und für reproduzierbaren Regelbetrieb ausgelegt

Die Benutzeroberfläche läuft auf:

- `0.0.0.0:443` unter `/`

Die API läuft auf derselben Origin unter den üblichen Unterpfaden.

Damit ist ForgeFrame nicht nur funktional konsolidiert, sondern auch nach außen klar und produktfähig exponiert.

---

## Integriertes TLS- und Zertifikatsmanagement

ForgeFrame trägt die Verantwortung für seine öffentliche Produktoberfläche selbst.

Dazu gehört ein integriertes automatisiertes Let's-Encrypt-Zertifikatsmanagement auf Basis der konfigurierten FQDN.

ForgeFrame unterstützt damit:

- automatische Zertifikatsausstellung
- automatische Verlängerung
- gültige öffentliche TLS-Absicherung auf Port 443
- operatorisch sichtbare Zertifikats-, Renewal- und Failure-Zustände
- kontrollierte Fehler- und Readiness-Semantik bei TLS-Problemen

Ein Hilfslistener auf Port 80 kann dabei ausschließlich für ACME- und Zertifikatszwecke vorgesehen sein und dient nicht als zweite Produktoberfläche.

---

## Governance, Sicherheit und Cost Safety

ForgeFrame macht Governance nicht dekorativ sichtbar, sondern setzt sie durch.

Dazu gehören:

- Runtime-Auth
- Scope-Prüfung
- Provider-Binding-Prüfung
- Instanzbindung
- Rollen und Zuständigkeiten
- Routing- und Queue-Berechtigungen
- Target-Allow-/Deny-Regeln
- Freigabe- und Approval-Flows
- Budgetgrenzen
- Circuit Breaker
- Anomalieerkennung
- Premium-Target-Kontrolle
- Schutz vor ausuferndem Verbrauch

Cost Safety ist dabei P0.
ForgeFrame soll Kosten nicht nur anzeigen, sondern Ausreißer aktiv verhindern.

---

## Explainability und Operator-Wahrheit

ForgeFrame soll AI-Betrieb lesbar machen.

Wichtige Entscheidungen und Zustände werden auf mehreren Ebenen sichtbar:

1. kurze menschliche Einordnung
2. strukturierte Entscheidungs- und Betriebsdaten
3. technische Rohdetails und Artefakte

Das gilt insbesondere für:

- Routingentscheidungen
- Queue-Entscheidungen
- Eskalationen
- Fallbacks
- Circuit Breaker
- Budgetstopps
- blockierte oder pausierte Runs
- Health- und Readiness-Probleme
- Zustell- und Freigabefehler

---

## Für wen ForgeFrame gebaut ist

ForgeFrame ist für Organisationen und Teams gedacht, die AI nicht nur konsumieren, sondern verantwortlich betreiben wollen.

Besonders geeignet ist es für:

- Platform-Teams
- AI-Ops-Teams
- Produktteams mit kontrollierter AI-Integration
- Self-Hosting-Umgebungen
- Multi-Provider-Setups
- lokale und hybride Modelllandschaften
- Umgebungen mit hohen Anforderungen an Governance, Transparenz und Produktreife

---

## Was ForgeFrame nicht ist

ForgeFrame ist bewusst **nicht**:

- nur ein Modell-Proxy
- nur ein API-Gateway
- nur ein Chat-Frontend
- nur ein Workflow-Builder
- nur ein Taskboard
- nur ein CI- oder PR-Werkzeug
- keine Demo-Konsole
- keine Doku-Kulisse
- keine hübsche Matrix ohne Runtime-Wahrheit
- keine Plattform mit Fake-Vollintegration
- keine Blackbox, die Routing- oder Queue-Entscheidungen versteckt

ForgeFrame soll nur das behaupten, was es in Runtime, Persistenz, UI, Health, Readiness, Routing, Dispatch, Tests und Release-Gates wirklich tragen kann.

---

## Kurz gesagt

**ForgeFrame ist die Linux-first Control Plane und Runtime-Plattform für autonome AI-Instanzen, die Smart AI Gateway, Smart Execution Routing, generischen Harness, Governance, Health, Costs, Explainability, Queueing, Work Interaction und optionale persönliche Assistenzmodi in einem ehrlichen, produktionsfähigen System vereint.**

---

# English

# ForgeFrame

**The Linux-first control plane and runtime platform for autonomous AI instances.**

ForgeFrame brings together smart AI gateway capabilities, smart execution routing, a generic harness, governance, observability, queueing, work interaction and optional personal assistant modes in one coherent, honest product.

It is not just a model proxy.
It is not just a chat frontend.
It is not just a workflow builder.

**ForgeFrame is the operational framework in which AI instances can be run safely, transparently, controllably and productively.**

---

## Why ForgeFrame

Most AI solutions fail exactly where real environments start to matter:

- too many providers, too many edge cases, not enough structure
- expensive models get clogged with trivial work
- routing is opaque or merely cosmetic
- queueing is not operationally reliable
- health and readiness are polished instead of honest
- UIs look good but do not carry runtime truth
- governance, budgets and approvals are bolted on too late
- conversations, tasks, notifications and external actions live in disconnected islands

ForgeFrame was built to eliminate those fractures.

It creates a unified product surface for AI operations, AI control and AI-assisted work — backed by real technical and operational truth.

---

## What ForgeFrame is

ForgeFrame is a **control plane and runtime platform for autonomous AI instances**.

A ForgeFrame instance can unify, among other things:

- providers and models
- accounts, OAuth bindings and API keys
- routing policies and provider targets
- budgets, limits and cost-safety rules
- queue classes, workers and dispatch rules
- health, readiness and bootstrap truth
- artifacts, workspaces and handoffs
- conversations, inbox, tasks and notifications
- contacts, sources, context and memory layers
- approvals, preview flows and governance rules
- optional personal assistant logic built on the same product foundation

That makes ForgeFrame a shared framework for:

- operational AI work systems
- team-oriented AI instances
- customer-specific AI operating spaces
- personal assistant modes built on the same governance and runtime truth

---

## Product pillars

## Smart AI Gateway

ForgeFrame provides a production-grade runtime layer for AI clients.

This includes, in particular:

- `/health`
- `/v1/models`
- `/v1/chat/completions`
- `/v1/responses`

The goal is not paper compatibility, but real product semantics:

- consistent error mapping
- clean streaming fidelity
- robust tool fidelity
- explicit unsupported and partial semantics
- understandable model and provider selection
- visible runtime and operational truth

---

## Smart Execution Routing

ForgeFrame includes a real smart execution layer.

It makes controlled and explainable decisions about:

- which requests are **simple**
- which requests are **non-simple**
- which targets are even allowed for a given instance
- when local or lower-cost paths are sufficient
- when escalation to stronger or more expensive targets is required
- when work stays synchronous
- when queueing, dispatch, retry, pause, resume or circuit breakers apply

The goal is straightforward:

**keep expensive premium providers free for work that actually requires them, without sacrificing capability, policy or availability.**

ForgeFrame therefore does not optimize for cheapness first.
It optimizes for correctness first:

1. capability
2. policy and rights
3. health and availability
4. economics
5. budget and limit compliance

---

## Provider targets instead of mere model names

ForgeFrame does not treat a target as just a model string.

A provider target represents the operational truth of a usable destination, including:

- provider
- model
- auth or account type
- capability profile
- cost class
- health and readiness status
- priority
- queue suitability
- streaming capability
- tool capability
- fallback and escalation eligibility
- instance-bound permissions and bindings

That is what makes routing, explainability and governance truly dependable.

---

## Queueing, dispatch and run orchestration

ForgeFrame maintains a strict separation between:

- synchronous latency-sensitive runtime requests
- heavier interactive work
- agentic, multi-step or long-running execution
- serialized OAuth or account-bound execution paths

To support that, ForgeFrame uses operational execution lanes such as:

- Interactive Low Latency
- Interactive Heavy
- Background Agentic
- OAuth Serialized

Queueing is not decoration.
It is core product infrastructure:

- persistent jobs
- worker leases
- retry with backoff
- pause / resume / interrupt
- dead-letter and quarantine semantics
- queue explainability
- dispatch history
- stable execution of non-trivial work under load

---

## Generic harness

ForgeFrame includes a generic harness so new or external providers can be connected productively without requiring a fully custom native adapter every time.

The harness includes capabilities such as:

- profiles
- templates
- preview
- verify
- dry run
- probe
- execute
- inventory
- discovery
- sync
- snapshot
- import / export
- rollback
- persistent runs
- tool-calling support in generic paths

This makes ForgeFrame an integration platform, not merely an endpoint.

---

## UI-first control plane

ForgeFrame is UI-first, but not UI-fake.

The control plane is the main working surface for operators, administrators and teams.
It is designed for real work, not just passive observation.

Core modules include, among others:

- Dashboard
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
- Decisions / Approvals
- Workspaces
- Artifacts
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
- Assistant Profiles

The interface is intended to feel modern, high-quality, clear and trustworthy — without ever hiding technical gaps.

---

## Work Interaction Layer

ForgeFrame is not just infrastructure.
It is also a work surface.

The work interaction layer connects runtime, routing and governance to actual day-to-day work.

This includes, at minimum:

- conversations / threads / sessions
- inbox / triage
- tasks / follow-ups / reminders
- notifications / outbox / delivery
- action preview and approval before external actions
- context and memory maintenance
- knowledge and connector inputs
- linking interactions to artifacts, runs and decisions

This turns ForgeFrame into more than AI control.
It becomes a platform for work-capable AI instances.

---

## Personal Assistant Mode

ForgeFrame can optionally run as a personal assistant mode.

This is not a separate side world.
It is a specialization built on the same product truth.

That means:

- the same governance rules
- the same explainability principles
- the same routing and queueing truths
- the same approval and safety mechanisms

It adds personal extensions such as:

- personal profile
- preferences
- communication rules
- contacts
- calendar, mail and task relations
- quiet hours
- personal delivery logic
- assistant rules for suggestion, clarification and direct action

---

## Linux-first deployment

ForgeFrame is designed as a **Linux-first, system-native product**.

That means:

- ForgeFrame is installed and operated directly on the Linux system by default
- ForgeFrame itself is **not** tied to a mandatory Docker container in the standard path
- PostgreSQL can run natively or optionally as a dedicated Docker container
- ForgeFrame services are designed for system-native operation and reproducible day-to-day deployment

The user interface is exposed on:

- `0.0.0.0:443` at `/`

The API is served on the same origin under the usual subpaths.

This gives ForgeFrame a clean, consolidated and product-grade external surface.

---

## Integrated TLS and certificate management

ForgeFrame is responsible for its own public product surface.

That includes integrated automated Let's Encrypt certificate management based on the configured FQDN.

ForgeFrame therefore supports:

- automatic certificate issuance
- automatic renewal
- valid public TLS on port 443
- operator-visible certificate, renewal and failure states
- controlled readiness and failure semantics for TLS issues

A helper listener on port 80 may exist solely for ACME and certificate purposes and is not intended to become a second product surface.

---

## Governance, security and cost safety

ForgeFrame does not merely display governance.
It enforces it.

That includes:

- runtime auth
- scope validation
- provider binding validation
- instance binding
- roles and responsibilities
- routing and queue permissions
- target allow and deny rules
- approval flows
- budget limits
- circuit breakers
- anomaly detection
- premium target control
- protection against runaway usage

Cost safety is P0.
ForgeFrame is designed not only to show costs, but to actively prevent consumption outliers.

---

## Explainability and operator truth

ForgeFrame is built to make AI operations readable.

Important decisions and states are visible on multiple levels:

1. short human-readable summary
2. structured decision and operational data
3. raw technical details and artifacts

This applies especially to:

- routing decisions
- queue decisions
- escalations
- fallbacks
- circuit breakers
- budget stops
- blocked or paused runs
- health and readiness issues
- delivery and approval failures

---

## Who ForgeFrame is for

ForgeFrame is built for organizations and teams that do not just want to consume AI, but operate it responsibly.

It is especially well suited for:

- platform teams
- AI operations teams
- product teams with controlled AI integration
- self-hosted environments
- multi-provider setups
- local and hybrid model landscapes
- environments with high demands on governance, transparency and product maturity

---

## What ForgeFrame is not

ForgeFrame is explicitly **not**:

- just a model proxy
- just an API gateway
- just a chat frontend
- just a workflow builder
- just a task board
- just a CI or PR utility
- not a demo console
- not a documentation facade
- not a pretty matrix without runtime truth
- not a fake full-integration platform
- not a black box that hides routing or queueing decisions

ForgeFrame is meant to claim only what it can truly carry in runtime, persistence, UI, health, readiness, routing, dispatch, tests and release gates.

---

## In one sentence

**ForgeFrame is the Linux-first control plane and runtime platform for autonomous AI instances, unifying smart AI gateway capabilities, smart execution routing, a generic harness, governance, health, costs, explainability, queueing, work interaction and optional personal assistant modes in one honest, production-capable system.**
