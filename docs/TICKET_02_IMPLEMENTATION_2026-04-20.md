# Ticket 02 - Truth Axes und Routing Policies

Status: umgesetzt mit tieferer Statuswahrheit

- Provider-/Modellstatus wurden um `runtime_status`, `availability_status`, `status_reason`, `last_seen_at`, `last_probe_at` und `stale_since` erweitert.
- Routing kennt jetzt `routing_strategy`, `routing_require_healthy` und `routing_allow_degraded_fallback`.
- Control Plane, Runtime-Modelllisten und Frontend-Typen greifen auf dieselben vertieften Wahrheitsachsen zu.
- Routing-Entscheidungen dokumentieren Strategie- und Fallbackbasis.

Verifikation:

- `97` Backend-Tests gruen, inklusive aktualisierter Routing-Tests.
