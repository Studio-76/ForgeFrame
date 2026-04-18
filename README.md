# ForgeGate — Smart AI Gateway

ForgeGate ist ein **neu aufgebautes Smart AI Gateway** mit klarer Trennung zwischen Runtime- und Admin-Plattform.

## Projektziel

Dieses Repository liefert ein architecture-first Fundament mit kontrolliertem Kernaufbau. In Phase 4 gibt es neben dem internen Baseline-Provider jetzt auch einen ersten echten externen Providerpfad über OpenAI API.

## Entwicklungsstatus

- Status: **Phase 4 core baseline**
- Backend:
  - `GET /health`
  - `GET /v1/models`
  - `POST /v1/chat/completions`
  - interner Success Path (`forgegate_baseline`)
  - externer Success Path (`openai_api`, key-basiert)
- Frontend: minimal startbar (Scaffold)
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
  backend/     # ForgeGate-Backend inkl. Phase-4-Core-Baseline
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
