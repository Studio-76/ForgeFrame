## Ticket 1.4 - Runtime-, Harness-, Provider- und UI-Wahrheit trennen

Stand: 20.04.2026

### Ziel

Das Zielbild verlangt ehrliche, getrennte Produktwahrheiten. Bisher wurde im Provider-Snapshot zu viel implizit zusammengefaltet: persistierte Providerdaten, Runtime-Readiness, Harness-Sicht und UI-Sicht wurden in einer gemischten Projektion vermengt.

### Umgesetzte Aenderungen

- In `backend/app/control_plane/models.py` wurden explizite Wahrheitsmodelle eingefuehrt:
  - `ManagedProviderTruthRecord`
  - `RuntimeProviderTruthRecord`
  - `HarnessProviderTruthRecord`
  - `ManagedModelUiRecord`
  - `ProviderUiTruthRecord`
  - `ProviderTruthAxesRecord`
- Neue Domaenenlogik in `backend/app/api/admin/control_plane_truth_domain.py` aufgebaut.
- Dort werden jetzt getrennt erzeugt:
  - Provider-Wahrheit aus der persistierten Control-Plane-Achse,
  - Runtime-Wahrheit aus `ProviderRegistry`,
  - Harness-Wahrheit aus Profilen und Runs,
  - UI-Wahrheit als explizite Komposition aus den drei unteren Achsen.
- `provider_control_snapshot()` liefert nun nur noch die UI-Wahrheit.
- Der Endpunkt `GET /admin/providers/` liefert zusaetzlich `truth_axes`, damit die getrennten Wahrheiten API-seitig sichtbar und konsumierbar sind.
- Das Response-Metadatum `truth_contract` dokumentiert den Vertrag explizit im Endpunkt selbst.

### Audit-/Reviewer-Pass

Wichtiger Auditor-Fund und direkter Fix:

- Die bisherige Snapshot-Logik war weiterhin der heimliche Mischpunkt aller Wahrheiten.
- Deshalb wurde die Truth-Axes-Komposition in ein eigenes Modul verschoben und der Snapshot auf eine reine UI-Projektion reduziert.
- Zusaetzlich wurde eine Test-Assertion fuer `truth_axes` im bestehenden Scaffold-Test ergaenzt, damit diese Trennung spaeter nicht unbemerkt wieder verloren geht.

### Verifikation

Erfolgreich:

- Statischer Python-Check per `py_compile` fuer die neuen Truth-Modelle, die neue Truth-Domaene, `providers.py` und den erweiterten Endpoint-Contract.

Nicht moeglich auf dieser Workstation:

- Vollstaendige API-/Unit-Test-Ausfuehrung mangels installierter Backend-Abhaengigkeiten.
- Docker-/Live-Checks gemaess Vorgabe bewusst nicht ausgefuehrt.

### Ergebnis gegen Zielbild

ForgeGate hat jetzt fuer die Provider-Control-Plane keinen impliziten Mischzustand mehr als Hauptmodell, sondern einen expliziten Wahrheitsvertrag:

- Provider-Wahrheit = persistierte Managementsicht
- Runtime-Wahrheit = echte Adapter-/Registry-Sicht
- Harness-Wahrheit = Profil-/Run-Sicht
- UI-Wahrheit = bewusst zusammengesetzte Operatoransicht

Das ist die technische Grundlage fuer die naechsten Tickets, insbesondere fuer die Ablosung der statischen Modellwahrheit und die spaetere saubere UI-First-Control-Plane.
