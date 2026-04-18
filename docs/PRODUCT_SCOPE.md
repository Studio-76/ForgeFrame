# PRODUCT_SCOPE

## Was ForgeGate ist
ForgeGate ist ein Smart AI Gateway, das Runtime-Ausführung, Provider-Anbindung und administrative Steuerung in einer konsistenten Plattform zusammenführt.

## Harte Produktregel
- ForgeGate wird als **UI-first Control Plane** gebaut.
- Alles, was Admins im Regelbetrieb benötigen, soll perspektivisch im UI möglich sein.
- Shell ist für Dev/Infra/Recovery vorgesehen, nicht als regulärer Bedienweg.

## Produktachsen

### 1) AI Gateway
- Einheitlicher Entry Point für AI-Workloads.
- Routing- und Fallback-Strategien (iterativ ausgebaut).

### 2) Provider Hub
- Adapter pro Provider.
- Normierte Provider-Fähigkeiten, Readiness und Fehlerbilder.
- Discovery-/Sync-fähiger Modellkatalog (statisch + dynamisch).

### 3) Account Management
- Verwaltung von Konten und Berechtigungsbezügen.
- Trennung von Account-, Key- und Usage-Domänen.

### 4) Admin Platform (Control Plane)
- UI und Admin-API für Betrieb, Konfiguration und Einsicht.
- Provider anlegen/bearbeiten/aktivieren/deaktivieren.
- OAuth-/Key-Status verwalten.
- Modellsync auslösen, Sichtbarkeit pflegen, Standardmodelle setzen.

### 5) Runtime + Admin API
- Runtime API für Laufzeitaufrufe.
- Admin API für Betriebs- und Managementfunktionen.

### 6) Usage/Kostenanalyse
- Requests, Tokens, Latenzen, Fehler und Provider-/Modellnutzung auswerten.
- Kosten entlang zweier Achsen erfassen:
  - tatsächlich entstandene Kosten (actual)
  - hypothetische Kosten und vermiedene Kosten (hypothetical/avoided)

## Feature-Phasen

### Phase 5 (aktueller Ausbau)
- Streaming-Vertrag mit belastbarem Core-Pfad.
- Provider-Vertrag inkl. Readiness/Capabilities.
- OpenAI API non-stream + stream.
- Codex-/OAuth-/Discovery-Vorstufe ehrlich integriert.
- Erste UI-Control-Plane-Vorstufen für Provider-/Usage-Sicht.

### Nächste Stufen
- Erweiterte OAuth-Flows und Discovery-Sync-Orchestrierung.
- Vertiefte Usage-/Kostenanalytik und Preis-Kataloge.
- Ausgebautes Monitoring, Policies und Betriebsautomatisierung.


## UI-Bedienbarkeit
- Control-Plane-UI mit Theme-System (Dark Default, Light optional).
- Providerverwaltung und Sync-Aktionen werden schrittweise UI-gestützt ausgebaut.
