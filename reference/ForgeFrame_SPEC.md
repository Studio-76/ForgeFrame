# ForgeFrame SPEC (Distilled)
**Projekt:** ForgeFrame  
**Version:** SPEC v1.0 (distilled aus Zielbild V9)  
**Status:** Normativer Zielzustand  
**Datum:** 2026-05-01

---

## 1) Zweck und Produktidentität

ForgeFrame ist eine **linux-first, system-nativ betreibbare Control-Plane- und Runtime-Plattform** für autonome AI-Instanzen.

ForgeFrame vereint in einem Produkt:
- Smart AI Gateway
- Smart Execution Routing
- Queueing/Dispatch/Run-Orchestrierung
- UI-first Control Plane
- Governance, Policy, Security
- Health/Observability/Cost Safety
- Work Interaction (Conversations, Tasks, Inbox, Notifications)
- Learning/Memory/Skills als kontrollierte Produktfunktion

Nicht zulässig als Produktbild:
- nur Gateway/Proxy
- nur Chat-UI
- nur Demo-/Marketing-Oberfläche
- behauptete Reife ohne Runtime-, Persistenz- und Testdeckung

**Produktwahrheit** gilt nur, was real in Code, Runtime, Persistenz, API, Tests und Release-Gates getragen wird.

---

## 2) Leitprinzipien

1. **Wahrheit vor Darstellung:** UI darf nie Runtime-Lücken kaschieren.
2. **Keine Fake-Vollintegration:** Reife nur als `runtime-ready`, `partial runtime`, `bridge/onboarding-only`, `not-ready`.
3. **UI-first, nicht UI-fake:** Regelbetrieb primär via UI/API, ohne Simulationszustände.
4. **Linux-first Host-Pfad ist normativ:** ForgeFrame läuft nativ auf Linux; Containerisierung ist optional.
5. **PostgreSQL ist Primärwahrheit:** JSONL/dateibasiert nur Dev/Recovery/Migration/Notfall.
6. **Klare Modelltrennung:** Plattform, Tenant, Instanz, Run, Queue, Skill, Memory etc. nicht vermischen.
7. **Capability-first Routing:** fachliche Eignung vor Kosten.
8. **Sync/Async sauber trennen:** kein blindes Vollqueueing interaktiver Requests.
9. **Explainability verpflichtend:** Entscheidung in Kurztext + strukturierte Faktoren + Rohdetails.
10. **Learning/Memory/Skills sind kontrolliert:** auditierbar, begrenzt, korrigierbar.
11. **Außenwirkungen nur mit klarer Freigabelogik:** Draft ≠ Execute.

---

## 3) Globales Plattformmodell

### 3.1 Ebenen
- **Plattformebene:** globale Auth, Admission, Schutzmechanismen, globale Policies.
- **Tenant-/Organisationsebene:** verpflichtend in hosted/public/managed; optional in solo/private.
- **Instanzebene:** verpflichtender Produktkern in allen Modi.

### 3.2 Instanzregel (normativ)
- Nutzung ohne Instanz ist nicht vorgesehen.
- Tenant ist optional in einfachen Modi, verpflichtend bei Multi-Tenant-Betrieb.

### 3.3 Coordinator-Agent
Jede Instanz erzeugt automatisch einen Lead-Agent mit Default-Name **`Operator`** (umbenennbar), als zentraler Koordinator für Delegation, Sammlung und Rückführung.

### 3.4 Primäre Instanzobjekte
Workspace, Conversation, Thread, Task, Reminder, Run, Dispatch Job, Approval, Artefakt, Skill, Memory-Eintrag, Channel/Connector Binding.

---

## 4) Betriebsmodi und Exponierung

### 4.1 Technische Betriebsmodi
- Local Solo
- Shared Private
- Hosted/Public/Managed

### 4.2 Normativer Betriebsweg
- Primär: Linux-Host-Betrieb (system-native Services)
- Optional: dedizierter Docker-Container für PostgreSQL

### 4.3 Öffentlicher Standardpfad
- UI unter `/`
- HTTPS auf `0.0.0.0:443` als Standardproduktpfad
- Runtime/Admin auf derselben Origin unter ihren Unterpfaden

### 4.4 TLS/FQDN
Integriertes Modell für FQDN, DNS-Checks, Zertifikatsausstellung/-verlängerung, sichere Key-Ablage, Listener-Reload und Operator-Status.

Ausnahme-/Fallback-Modi sind erlaubt, aber sichtbar als Ausnahme zu klassifizieren.

---

## 5) Produktachsen und Execution Fabric

### 5.1 Vier Produktachsen
1. OAuth-/Account-Provider (u. a. OpenAI Codex, GitHub Copilot, Claude Code, Antigravity; Gemini nur bei tragfähiger OAuth-Basis)
2. OpenAI-kompatible Fremdprovider
3. Lokale Provider (z. B. Ollama)
4. OpenAI-kompatible Clients

### 5.2 Kompatibilitätsanspruch
Für Achse 2 und 4 gilt **maximale reale Kompatibilität** (Request/Response/Error/Streaming/Tools). Abweichungen nur wenn unvermeidbar, typisiert, dokumentiert, testbar und sichtbar.

### 5.3 Execution Fabric (getrennte Ebenen)
- **Routing-/Klassifikationsebene:** fachliche Klasse, Zulässigkeit, Capability, Policy, Budget.
- **Scheduling-/Dispatch-Ebene:** Sync vs Async, Lane, Queueing, Worker/Lease, Retry/Fallback/Eskalation.

Die Ebenen dürfen nicht vermischt werden.

---

## 6) Kernmodule

ForgeFrame umfasst verpflichtend:
- Smart AI Gateway
- Smart Execution Router
- Provider-Target-Modell
- Queueing und Run-Orchestrierung
- Generischer Harness (Preview/Verify/Execute/Sync etc.)
- UI-first Control Plane
- Governance-/Policy-Kern
- Health/Observability/Cost
- Explainability Layer
- Artefakt-System
- Workspace/Handoff-Schicht
- Work Interaction Layer
- Learning/Memory/Skills-System
- Plugin-System (Erweiterbarkeit, nicht Kernersatz)

---

## 7) Identity, Security und Policy

### 7.1 Identitäts-/Credential-Modell
Explizite Typen für Plattformnutzer, Instanznutzer, API-Clients, Agent-/Run-Identitäten, Provider-/Connector-Credentials.

### 7.2 Rollenminimum
Mindestens: Platform Owner, Tenant Admin, Instance Admin, Operator, Approver, Viewer (ggf. Auditor).

### 7.3 Policy-Hierarchie
Priorität bei Konflikten:
1) globale Sicherheitsverbote  
2) Tenant-Regeln  
3) Instanzregeln  
4) Agent/Profil/Rolle  
5) Run/Task/Conversation-Kontext  
6) Nutzerpräferenz

Regeln:
- `deny` schlägt `allow`
- tiefere Ebenen dürfen nur einschränken, nicht still erweitern
- Ausnahmen sind zeitlich begrenzt, auditierbar, widerrufbar

---

## 8) Capability- und Routing-Modell

### 8.1 Trennscharfes Zielmodell
- **Capabilities:** z. B. streaming, tool_calling, structured_output
- **Execution Traits:** z. B. low_latency_fit, background_run_fit, oauth_serialized
- **Policy/Safety Flags:** z. B. approval_required
- **Economic/Quality:** z. B. cost_class, quality_tier

Zusätzlich pro Feld: Datentyp, Herkunft (`provider_declared`, `observed`, `test_verified`, `policy_masked`) und Vertrauensgrad.

### 8.2 Routing-Grundregeln
- Sichtbare fachliche Klassen: **simple**, **non-simple**
- Deterministische Klassifikation bevorzugt
- Capability-first Escalation
- Premium-Targets nur bei fachlicher Notwendigkeit

---

## 9) Execution-Lanes, Queueing und Dispatch

### 9.1 Operative Lanes
- Interactive Low Latency
- Interactive Heavy
- Background Agentic
- OAuth Serialized

### 9.2 Queue-Grundsätze
- Interaktive Standardpfade bleiben synchron und latenzsensitiv.
- Agentische/langlaufende Arbeit läuft über persistente Queue-/Worker-Pfade.
- Queue-Primärwahrheit in PostgreSQL.

### 9.3 Pflichtzustände
`queued`, `admitted`, `leased`, `running`, `waiting_external`, `waiting_approval`, `blocked`, `paused`, `interrupted`, `retry_scheduled`, `failed`, `completed`, `cancelled`, `quarantined`.

### 9.4 Operator-Steuerung
start, stop, pause, resume, interrupt, retry, restart-from-scratch, escalate, cancel (Approval-Aktionen getrennt behandeln).

### 9.5 Worker-Pflichten
Lease/Renewal, Timeout, Retry mit Backoff, Idempotenzschutz, Concurrency-Limits, target-spezifische Serialisierung.

---

## 10) API-Verträge

### 10.1 Offene Runtime-Pfade (verpflichtend)
`/health`, `/v1/models`, `/v1/chat/completions`, `/v1/responses`

### 10.2 Vertragsregel
OpenAI-kompatible Standardpfade bleiben semantisch ehrlich (kein stiller Wechsel auf Langläufer-Jobvertrag).

### 10.3 Native Produktpfade
Eigene Semantik für Runs, Jobs/Dispatch, Conversations/Threads/Sessions, Tasks/Reminders, Approvals, Actions, Notifications/Outbox, Artefakte/Workspaces/Handoffs, Memory/Skills/Learning.

### 10.4 Fehlersemantik
Präzise HTTP- und Domänenfehler (inkl. provider_not_ready, unsupported_feature, budget_exceeded, circuit_open etc.) mit operatorisch nutzbarer Diagnose.

---

## 11) Actions, Preview und Approval

### 11.1 Aktionstypen
`read_only`, `recommend`, `draft`, `simulate`, `request_approval`, `execute_low_risk`, `execute_high_risk`, `irreversible`

### 11.2 Sicherheitsregeln
- Empfehlung ≠ Draft
- Draft/Simulation erzeugen keine Außenwirkung
- Approval ≠ Execute
- High-Risk/Irreversible nie still auto-executed

### 11.3 Außenaktionspflichten
Identitäts- und scopegebunden, nachvollziehbar geloggt, Zustellstatus sichtbar, wo möglich widerruf-/kompensierbar.

---

## 12) Work Interaction

Pflichtobjekte: Conversations, Threads, Sessions, Inbox/Triage, Tasks/Follow-ups/Reminders, Notifications/Outbox, Action Preview, Contacts/Channels, Kontext-/Memory-Anbindung.

### 12.1 Zentrale Instanz-Conversation
Primärer menschlicher Einstieg je Instanz; Beiträge von Menschen, Agenten und Systemereignissen; objektverknüpft (Task/Run/Approval/Artefakt/Handoff).

### 12.2 Agentenadressierung und Teilnahme
- Strukturierte `@`-Adressierung auf echte Agentenidentität
- Teilnahmemodi: `silent`, `mentioned-only`, `subscribed`, `assigned/owner`, `broadcast participant`
- Keine implizite Vollüberwachung durch alle Agenten

### 12.3 Agent-zu-Agent und Koordination
Strukturierte Handoffs, Assignments, Review-Requests, Blocker-Events; Coordinator-Agent (`Operator`) führt zusammen und delegiert.

---

## 13) Learning, Memory und Skills

### 13.1 Schichten
- **Boot Memory:** klein, kuratiert, versionierbar
- **Working Context:** situativ, nicht automatisch Langzeitwahrheit
- **Durable Memory:** persistent, auditierbar, mit Quelle/Revision/Vertrauensklasse

### 13.2 Learning Persistence Loop
Kontrollierte Entscheidung: verwerfen, nur Historie, Boot-Memory-Verdichtung, Durable Memory, Skill-Entwurf, Review-Fall.

### 13.3 Promotion und Scope
Promotion nicht blind automatisch; explizite Regeln (`auto_reject`, `auto_draft`, `auto_suggest`, `review_required`, begrenztes `auto_promote`).

Scope-Grenzen Plattform/Tenant/Instanz/Profil/Task-Context sind verbindlich.

### 13.4 Begriffsgrenzen
Skill ≠ Plugin ≠ Harness ≠ Target.

---

## 14) Datenarchitektur

### 14.1 Primärsatz
PostgreSQL ist produktive Primärwahrheit.

### 14.2 Relational first
Kernobjekte relational modellieren (Instanzen, Rechte, Targets, Routing, Queue/Dispatch, Runs, Approvals, Tasks, Audit, Memory-/Skill-Metadaten).

### 14.3 JSONB/FTS/pgvector
- JSONB nur ergänzend (Rohpayloads, flexible Metadaten)
- Full Text Search primär für lexikalische Suche
- pgvector für semantisches Retrieval
- Strukturierte Produktwahrheit hat Vorrang vor semantischer Näherung

### 14.4 Datenlebenszyklus
Retention, Archivierung, Löschung, Korrektur, Restore, Export/Audit pro Datenklasse definiert.

---

## 15) Lifecycle-, Health- und Betriebswahrheit

### 15.1 State-Machines
Verbindliche Minimalzustände für Run, Dispatch Job, Approval, Skill, Memory-Eintrag, Provider Target (erweiterbar, semantisch stabil).

### 15.2 Health vs Readiness
- Health: technische Grundchecks
- Readiness: reale Einsatzfähigkeit inkl. Exponierung/TLS/Zertifikatspfad

### 15.3 Bootstrap-Wahrheit
Setup gilt nur als erfolgreich, wenn Startpfad, Adminzugang, Instanz, Provider, Runtime, Queue/Worker, Work Interaction sowie Memory/Skills belastbar funktionieren.

---

## 16) Kosten- und Sicherheitssystem

### 16.1 Cost Safety
Budgets pro Instanz/Zeitraum, harte/weiche Limits, Anomalieerkennung, Circuit Breaker, deterministisches Wake-Gating, Session-Reuse.

### 16.2 Cost-aware Routing
Günstig/lokal für simple Arbeit; Premium für non-simple/qualitätskritisch; Eskalation nur bei fachlicher Notwendigkeit.

### 16.3 Kostenwahrheit
Trennung: `measured`, `provider_reported`, `estimated`, `modeled`, `avoided_estimated`; autoritative Quelle je Zweck (Billing vs Runtime-Governance) festlegen.

### 16.4 Sicherheitsminimum
Runtime-Auth aktiv, strikte Scope-/Policy-Prüfung, sichere Defaults, sichere Secret-/Key-Ablage, abgesicherte Exponierung auf 80/443, auditierbare sicherheitsrelevante Aktionen.

---

## 17) UI-Zielbild

ForgeFrame ist eine hochwertige, klare B2B-Control-Plane – kein chaotisches Admin-Werkzeug.

### 17.1 Prinzipien
- Klarheit vor Show
- hohe Dichte ohne Überforderung
- ehrliche Zustände (`degraded`, `blocked`, `partial`, `unsupported` etc.)
- dreistufige Lesbarkeit: Überblick → strukturierte Details → Rohdetails

### 17.2 Pflichtflächen
Dashboard, Plattform/Tenants/Instanzen, Providers/Models/Targets, Routing/Dispatch/Queues, Harness, Usage/Costs/Errors/Health, Security/Accounts/Keys, Ingress/TLS, Approvals, Workspaces/Artefakte, Work Interaction, Memory/Skills, Settings.

### 17.3 Transparenzpflicht
UI zeigt nachvollziehbar: Targetwahl, Lane, Queue-Grund, Budget-/Health-Grenzen, verwendetes Memory/Skill und nächste sinnvolle Aktion.

---

## 18) Onboarding, Performance, Cleanup

### 18.1 Onboarding
Guided Onboarding setzt sinnvolle Defaults, legt erste Instanz an, initialisiert Provider/Targets, Routing und erste Arbeitsfläche.

Nutzernahe Betriebsartauswahl:
- Nur ich
- Mein Team / meine Firma
- Mehrere Kunden / Organisationen

Diese Auswahl wird deterministisch auf Plattformmodell und technischen Betriebsmodus gemappt.

### 18.2 Performance
Heartbeat-Effizienz, Session-Reuse, Delta-Laden, effiziente Operator-Views, robuste Queue/Worker-Performance, keine unnötige Vorab-LLM-Klassifikation.

### 18.3 Cleanup
Tote Flags/Settings/Pfade/Assets und Altlogik entfernen; Modulgrenzen schärfen; keine Debugpfade, die Produktwahrheit verfälschen.

---

## 19) Recovery, Backup, Release und Verkaufsfähigkeit

### 19.1 Recovery/Upgrade/Rollback
Dokumentierte Upgradepfade, migrationskompatible Versionen, definierte Rollback-/Wiederanlaufpfade, Schutz vor Daten- und Zustandsverlust.

### 19.2 Backup/Restore
Definierte Backupklassen, getestete Restorepfade, Trennung von Backup/Archiv/Export/Restore, abgesicherter Umgang mit Secrets.

### 19.3 Verkaufsfähigkeitskriterien
ForgeFrame ist erst verkaufsfähig, wenn nachweisbar:
- Security/Policy real durchgesetzt
- Runtime- und native Produktverträge ehrlich und belastbar
- Routing/Queue/Dispatch persistent, explainable, operatorisch steuerbar
- Work Interaction + Learning/Memory/Skills als echte Produktpfade
- Linux-Host-Pfad und Exponierung/TLS-Pfade real getestet
- reproduzierbare Builds/Tests/Release-Gates grün

---

## 20) Nicht verhandelbare Abschlussregeln

ForgeFrame darf nur behaupten, was es real tragen kann.

Insbesondere unzulässig:
- „smart routing“ ohne Explainability
- „produktreifes queueing“ ohne echte Zustands- und Persistenzwahrheit
- fachliche Klassen (`simple`/`non-simple`) nur als UI-Schalter
- versteckte Umdeutung offener Runtime-Pfade zu Langläuferverträgen
- Premium-Provider als unbegründeter Default
- OAuth-Vollintegrationsclaims ohne vollständige, nachweisbare Feature-Nutzbarkeit
- unkontrolliertes Learning, ungoverned Skills, stille Außenaktionen aus Drafts

---

## 21) Normative Begriffe (Kurzglossar)

- **Plattform:** gesamter Betriebsstack oberhalb einzelner Instanzen
- **Tenant/Organisation:** Mandantenschicht zwischen Plattform und Instanz
- **Instanz:** zentrale fachliche/betriebliche Einheit
- **Provider/Target:** Quelle und konkret dispatchbares Ausführungsziel
- **Capability/Execution Trait/Policy Flag/Economic-Quality-Profil:** strikt getrennte Modellkategorien
- **Harness:** generischer Integrations-/Ausführungsrahmen
- **Skill:** versionierbarer, governance-fähiger prozeduraler Baustein
- **Run/Dispatch Job:** Ausführungseinheit vs Scheduling-/Queue-Einheit
- **Approval/Action Draft/Action Preview:** getrennte Freigabe- und Außenwirkungsobjekte
- **Produktwahrheit:** real getragene Wahrheit über Code, Runtime, Persistenz, API, Tests, Release

---

**Projekt:** ForgeFrame  
**Version:** SPEC v1.0 (distilled aus Zielbild V9)  
**Status:** Normativer Zielzustand  
**Datum:** 2026-05-01
