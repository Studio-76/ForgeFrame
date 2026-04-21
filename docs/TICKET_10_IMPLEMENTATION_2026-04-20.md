# Ticket 10 - Cloud-Verifikation, CI und Doku-Konsistenz

Status: technisch reproduzierbarer Pruefpfad eingerichtet

- `.github/workflows/ci.yml` fuehrt Backend-Tests, Frontend-Build und Docker-Bootstrap-Smoke aus.
- `scripts/test-backend.sh` und `scripts/test-frontend.sh` wurden auf reproduzierbare Validierung gehaertet.
- `scripts/bootstrap-forgegate.sh` und `scripts/compose-smoke.sh` validieren jetzt Auth, Migrationen, Harness und Postgres im Docker-Zielbild.

Verifikation:

- `bash scripts/test-backend.sh`
- `bash scripts/test-frontend.sh`
- `bash scripts/bootstrap-forgegate.sh`
