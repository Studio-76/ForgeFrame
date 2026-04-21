## Ticket 1.3 - `control_plane.py` fachlich zerlegen

Stand: 20.04.2026

### Ziel

Die bisherige `backend/app/api/admin/control_plane.py` war als Sammeldatei zu breit: Provider-Management, OAuth-Ziele, Harness, Health, Bootstrap, Snapshot und Operatorik lagen in einer monolithischen Service-Datei. Das Zielbild verlangt hier klar getrennte Produktachsen und wartbare Backend-Domaenen.

### Umgesetzte Aenderungen

- Request-/Response-Modelle in `backend/app/api/admin/control_plane_models.py` ausgelagert.
- Provider- und Persistenzlogik in `backend/app/api/admin/control_plane_provider_domain.py` verschoben.
- Beta-Matrix in `backend/app/api/admin/control_plane_beta_domain.py` verschoben.
- OAuth-Zielstatus, Probe- und Bridge-Profil-Logik in `backend/app/api/admin/control_plane_oauth_targets_domain.py` verschoben.
- OAuth-Operations-Historie in `backend/app/api/admin/control_plane_oauth_operations_domain.py` verschoben.
- Harness-Logik in `backend/app/api/admin/control_plane_harness_domain.py` verschoben.
- Health-Logik in `backend/app/api/admin/control_plane_health_domain.py` verschoben.
- Bootstrap-Readiness in `backend/app/api/admin/control_plane_bootstrap_domain.py` verschoben.
- Provider-/UI-Snapshot in `backend/app/api/admin/control_plane_snapshot_domain.py` verschoben.
- `backend/app/api/admin/control_plane.py` auf eine schlanke Orchestrierungsdatei reduziert, die nur noch Service-Komposition, Konstruktion und Exporte bereitstellt.

### Strukturwirkung

- Vorher: `control_plane.py` hatte 963 Zeilen.
- Nachher: `control_plane.py` hat 101 Zeilen und die Fachlogik ist auf explizite Domaenenmodule verteilt.
- Dadurch ist jetzt direkt im Dateisystem sichtbar, welche Produktachse fuer welchen Teil der Control Plane zustaendig ist.

### Audit-/Reviewer-Pass

Im ersten Refaktorierungsschritt blieb der OAuth-Block noch zu breit. Das wurde direkt nachgezogen:

- Beta-Zielmatrix und OAuth-Operations wurden aus dem grossen OAuth-Modul herausgezogen.
- Uebrig blieb ein fokussierteres Modul fuer OAuth-Ziele, Probes und Bridge-Profile.
- Damit entspricht die Aufteilung jetzt deutlich besser dem Zielbild "Provider, OAuth-Ziele, Harness, Health, Bootstrap, Snapshot und Operatorik" als eigenstaendige Backend-Achsen.

### Verifikation

Erfolgreich:

- Statischer Python-Check per `py_compile` fuer alle neuen Control-Plane-Domaenenmodule sowie `providers.py`.

Nicht moeglich auf dieser Workstation:

- Vollstaendige API-/Unit-Test-Ausfuehrung, weil im verfuegbaren Python-Setup die benoetigten Backend-Abhaengigkeiten nicht installiert sind.
- Docker-/Live-Checks gemaess Vorgabe bewusst nicht ausgefuehrt.

### Ergebnis gegen Zielbild

Die Admin-Control-Plane ist jetzt backendseitig nicht mehr als monolithische Sammeldatei organisiert, sondern entlang klarer Fachachsen. Das reduziert Kopplung, verbessert Wartbarkeit und schafft eine bessere Grundlage fuer die naechsten Tickets zur Wahrheits- und Domaenentrennung.
