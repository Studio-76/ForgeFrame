## Ticket 1.5 - Statischen Settings-Modellkatalog als Produktwahrheit ablösen

Stand: 20.04.2026

### Ziel

Der bisherige Runtime-Katalog hing direkt an `Settings.model_catalog`. Das war fuer das Zielbild zu statisch: operatorische Aenderungen in der Control Plane und persistierte Provider-/Modelldaten mussten dieselbe Produktwahrheit wie die Runtime bilden.

### Umgesetzte Aenderungen

- `Settings.model_catalog` wurde durch `Settings.bootstrap_model_catalog` ersetzt.
- Der Settings-Katalog ist damit nur noch Seed-/Bootstrap-Quelle und nicht mehr die laufende Produktwahrheit.
- `ModelRegistry` liest jetzt primaer aus der persistenten Control-Plane-State-Repo.
- Falls dort noch kein Zustand existiert, seedet `ModelRegistry` einmalig aus `bootstrap_model_catalog` in die persistente Control-Plane-State-Achse.
- Persistierte `ManagedModelRecord`s tragen jetzt zusaetzliche Modellmetadaten:
  - `owned_by`
  - `display_name`
  - `category`
- Die Runtime baut ihre `RuntimeModel`s jetzt aus diesen persistierten Provider-/Modelldaten auf.
- Die Control Plane fuehrt diese Modellmetadaten beim Bootstrap und bei Syncs mit.

### Audit-/Reviewer-Pass

Direkt nachgezogen wurden zwei wichtige Konsistenzpunkte:

- Provider-Labels im Control-Plane-Bootstrap leiten sich jetzt aus `owned_by` statt nur aus dem technischen Providernamen ab.
- Zusaetzliche Registry-Tests decken jetzt ab:
  - Seed in persistenten Control-Plane-State bei leerem Zustand,
  - Vorrang persistierter Provider-/Modelldaten vor dem Bootstrap-Katalog,
  - Respektierung persistierter Provider-Deaktivierung in der Runtime-Wahrheit.

### Verifikation

Erfolgreich:

- Statischer Python-Check per `py_compile` fuer Settings, Control-Plane-Modelle, Registry-Service und die neuen Registry-Persistenztests.

Nicht moeglich auf dieser Workstation:

- Vollstaendige Testausfuehrung mangels installierter Backend-Abhaengigkeiten.
- Docker-/Live-Checks gemaess Vorgabe bewusst nicht ausgefuehrt.

### Ergebnis gegen Zielbild

ForgeGate hat jetzt keine dauerhafte Runtime-Wahrheit mehr im Settings-Katalog. Die Produktwahrheit fuer Provider und Modelle lebt jetzt persistiert in derselben Achse, aus der auch die Control Plane ihre Daten bezieht. Damit ist die Grundlage fuer die naechsten Migrations- und Architekturarbeiten gelegt.
