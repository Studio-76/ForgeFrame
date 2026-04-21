# Ticket 01 - PostgreSQL Primaerspeicher und Bootstrap

Status: weitgehend umgesetzt

- Governance-, Control-Plane-, Harness- und Observability-Storage sind im Produktpfad auf PostgreSQL ausgerichtet.
- `backend/app/settings/config.py` nutzt PostgreSQL nun auch fuer Governance standardmaessig.
- `docker/docker-compose.yml`, `docker/.env.compose.example`, `docker/Dockerfile.backend` und `scripts/bootstrap-forgegate.sh` wurden auf einen deterministischen Docker-First-Postgres-Pfad erweitert.
- `scripts/apply-storage-migrations.py` wird im Bootstrap-Lauf aktiv ausgefuehrt.

Verifikation:

- `bash scripts/bootstrap-forgegate.sh`
- Compose-Smoke erfolgreich inklusive Postgres-Start, Migrationen, App-Start und DB-Nachweis.
