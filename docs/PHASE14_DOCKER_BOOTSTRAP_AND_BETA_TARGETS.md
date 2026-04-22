# ForgeGate Phase 14 — Docker-First Bootstrap & Beta Target Matrix

## 1) Docker-/Compose-Laufrealität vorbereiten

- Compose bleibt 2-Service-Zielbild: `forgegate` + `postgres`.
- `.env.compose` wird als zentrale Laufkonfiguration genutzt.
- `scripts/bootstrap-forgegate.sh` automatisiert:
  - Docker/Compose-Prüfung
  - `.env.compose`-Bootstrap aus `.env.compose.example`
  - Stack-Start inkl. Build
  - Warten auf Postgres-Health
  - Warten auf ForgeGate-Health
  - Ausführen des Smoke-Scripts

## 2) PostgreSQL als realer Primärpfad

- Compose setzt `FORGEGATE_HARNESS_STORAGE_BACKEND=postgresql`.
- `FORGEGATE_HARNESS_POSTGRES_URL` kommt aus `.env.compose`.
- Smoke-Script prüft Harness-Daten in der laufenden DB per `psql`.
- Compose-Smoke prueft zusaetzlich den Observability-Signalpfad:
  - Runtime-Request
  - absichtlicher Runtime-Fehler
  - Health-Run
  - Admin-Usage/Admin-Logs
  - Persistenz in `usage_events`, `error_events`, `health_events`

## 3) Integriertes Frontend im ForgeGate-Container

- Multi-Stage Dockerfile baut Frontend und legt Dist-Assets in den App-Container.
- FastAPI liefert Assets unter `/assets` und SPA unter `/app/*`.
- Kein separater Frontend-Runtime-Container nötig.

## 4) Beta-Zielbildmatrix für Provider-/Client-Achsen

Neue Control-Plane-Route:

- `GET /admin/providers/beta-targets`

Enthält explizit:

- OpenAI Codex
- Gemini
- Antigravity
- GitHub Copilot
- Claude Code
- OpenAI-compatible generic providers
- Ollama (dedizierte lokale Zielachse)
- OpenAI-client compatibility Achse

Für jeden Eintrag werden u. a. geführt:

- Auth-Modell
- Runtime-Pfad
- Readiness
- Health-Semantik
- Verify/Probe-Achse
- Observability-Achse
- UI-Achse
- Notizen (was schon da ist / was fehlt)

## 5) Was diese Phase bewusst nicht fertigstellt

- Kein vollständiger Prod-Ops-Ausbau (TLS/Reverse-Proxy/Secrets/K8s).
- Keine vollständige native Adapter-Implementierung für alle geplanten OAuth-Anbieter.
- Aber: Beta-Zielbild ist jetzt explizit und operativ im Control-Plane-Modell verankert.
