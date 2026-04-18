# ForgeGate Phase 13 Turbo — Container-First Runtime

## Zielbild

ForgeGate läuft container-first mit zwei Services:

- `forgegate` (Backend + gebaute Frontend-Assets in einem Container)
- `postgres` (primärer Harness-Storage)

## Compose-Architektur

Datei: `docker/docker-compose.yml`

- PostgreSQL 16 mit Healthcheck, Volume und Standard-Dev-Credentials.
- ForgeGate baut über `docker/Dockerfile.backend` als Multi-Stage:
  - Node-Stage baut Frontend (`npm run build`)
  - Python-Stage installiert Backend
  - Finales Image liefert API + Frontend-Assets aus einem Container
- ForgeGate ist per `FORGEGATE_HARNESS_STORAGE_BACKEND=postgresql` auf PostgreSQL-Primärpfad gesetzt.

## Frontend-Integration im App-Container

- FastAPI mountet gebaute Assets über `/assets`.
- SPA-Einstiegspunkt wird unter `/app/*` ausgeliefert.
- Kein separater Frontend-Container für das Zielbild nötig.

## Reale lokale Validierung

Script: `scripts/compose-smoke.sh`

Ablauf:

1. `docker compose up -d --build`
2. Health-Check gegen laufendes ForgeGate
3. Harness-Profil anlegen
4. Sync triggern
5. Runs/Snapshot abrufen
6. Direkt in PostgreSQL prüfen, dass `harness_profiles` befüllt ist

Optionales Auto-Cleanup:

```bash
FORGEGATE_SMOKE_DOWN=down scripts/compose-smoke.sh
```

## Offene Punkte

- Optionales Hardening für Secrets/Prod-TLS außerhalb dieser Phase.
- Optionales Compose-Profiling (dev/prod) als nächste Iteration.
