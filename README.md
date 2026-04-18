# ForgeGate — Smart AI Gateway

ForgeGate ist ein **neu aufgebautes Smart AI Gateway** mit klarer Trennung zwischen Runtime- und Admin-Plattform.

## Projektziel

Dieses Repository liefert ein **architecture-first Fundament**. In Phase 2 ist das Projekt nun minimal startbar (Backend + Frontend), ohne produktive Core-Implementierung.

## Entwicklungsstatus

- Status: **Phase 2 scaffold, minimal runnable**
- Backend: **startbar (FastAPI placeholder endpoints)**
- Frontend: **startbar (React/Vite placeholder routing)**
- Core-Implementierung: **pending**

## Harte Leitlinien

- ForgeGate wird **from scratch** aufgebaut.
- `reference/` ist ausschließlich Referenzmaterial.
- Es gibt **keine produktiven Imports** aus `reference/`.
- Keine Business-Logik, keine Provider-/OAuth-/Streaming-/Tool-Calling-/Fallback-Implementierung in diesem Stand.

## Repository-Überblick

```text
forgegate/
  docs/        # Architektur-, Scope- und Migrationsdokumentation
  reference/   # Referenzmaterial (nicht produktiv)
  backend/     # Minimal startbares Backend-Scaffold
  frontend/    # Minimal startbares Frontend-Scaffold
  scripts/     # Dev-/Test-Skripte
  docker/      # Minimales Container-Scaffold
```

## Lokale Entwicklung

Backend (Port 8000):
```bash
./scripts/dev-backend.sh
```

Frontend (Port 5173):
```bash
./scripts/dev-frontend.sh
```

## Hinweis zu `reference/`

Der Ordner `reference/` dient ausschließlich Semantikvergleich, Randfallanalyse und Härtungshinweisen für spätere Neuimplementierungen.
