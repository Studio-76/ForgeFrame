# ForgeGate — Smart AI Gateway

ForgeGate ist ein **neu aufgebautes Smart AI Gateway** mit klarer Trennung zwischen Runtime- und Admin-Plattform.

## Projektziel

Dieses Repository liefert ein architecture-first Fundament mit kontrolliertem Kernaufbau. Nach dem Phase-3-Fixlauf besitzt der Backend-Core einen echten durchlaufenden Runtime-Pfad für Chat sowie klar getrennte Fehlerpfade für noch nicht implementierte externe Provider.

## Entwicklungsstatus

- Status: **Phase 3 core baseline (fixlauf abgeschlossen)**
- Backend:
  - `GET /health`
  - `GET /v1/models`
  - `POST /v1/chat/completions` mit funktionierendem Baseline-Success-Path
  - strukturierte 501-Semantik für externe Provider ohne Umsetzung
- Frontend: minimal startbar (Phase-2-Basis)
- Erweiterte Core-Features (OAuth/Streaming/Tool/Fallback): pending

## Harte Leitlinien

- ForgeGate wird **from scratch** aufgebaut.
- `reference/` ist ausschließlich Referenzmaterial.
- Es gibt **keine produktiven Imports** aus `reference/`.
- Semantik aus Referenz wird neu umgesetzt, nicht 1:1 portiert.

## Repository-Überblick

```text
forgegate/
  docs/        # Architektur-, Scope- und Migrationsdokumentation
  reference/   # Referenzmaterial (nicht produktiv)
  backend/     # ForgeGate-Backend inkl. Phase-3-Core-Baseline
  frontend/    # Minimal startbares Frontend-Scaffold
  scripts/     # Dev-/Test-Skripte
  docker/      # Container-Scaffold
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
