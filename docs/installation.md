# ForgeFrame Installation Guide

This guide covers local development setup and supported deployment entry points.

## 1) Clone the repository

```bash
git clone <your-repo-url>
cd ForgeFrame
```

## 2) Requirements

- Linux (primary target)
- Python 3.11+
- Node.js 20+
- PostgreSQL 14+ (required for full runtime mode)

## 3) Local development setup (manual)

### Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### Frontend setup

```bash
cd ../frontend
npm install
```

### Environment files

From repository root:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Then update placeholder values, especially database URL and admin bootstrap credentials.

## 4) PostgreSQL expectations

ForgeFrame is designed for PostgreSQL-backed storage by default.

- Local host-native example in `.env.example` uses `127.0.0.1:5442`.
- Docker Compose example in `deploy/docker/.env.compose.example` uses `postgres:5432` from inside containers.

At minimum, PostgreSQL mode requires:

- `FORGEFRAME_HARNESS_POSTGRES_URL`
- `FORGEFRAME_CONTROL_PLANE_POSTGRES_URL`
- `FORGEFRAME_OBSERVABILITY_POSTGRES_URL`
- `FORGEFRAME_GOVERNANCE_POSTGRES_URL`
- `FORGEFRAME_INSTANCES_POSTGRES_URL`

## 5) Start local development services

Run in two terminals.

### Terminal A: backend

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Alternative helper script:

```bash
./deploy/scripts/dev-backend.sh
```

### Terminal B: frontend

```bash
cd frontend
npm run dev -- --host 0.0.0.0 --port 5173
```

Alternative helper script:

```bash
./deploy/scripts/dev-frontend.sh
```

## 6) Unified installer (recommended for deployment workflows)

```bash
./deploy/scripts/forgeframe-setup.sh
```

Supported setup modes:

- Docker Compose
- Host-native (systemd)
- Dev environment
- Limited exception (file/SQLite)

Non-interactive mode example:

```bash
./deploy/scripts/forgeframe-setup.sh --compose --non-interactive \
  --fqdn forgeframe.example.com \
  --acme-email admin@example.com \
  --pg-password "<generated-password>"
```

## 7) Build and startup

### Frontend production build

```bash
cd frontend
npm run build
```

### Backend startup script (root)

```bash
./deploy/scripts/start-forgeframe.sh
```

By default this runs the API on `FORGEFRAME_HOST`/`FORGEFRAME_PORT` (defaults `127.0.0.1:8080`) and applies storage migrations before startup.

## 8) Expected ports and services

### Local development

- Frontend (Vite): `5173`
- Backend (Uvicorn): `8000`

### Default host-native runtime

- Internal app listener: `127.0.0.1:8080`
- Optional public HTTPS: `0.0.0.0:443`
- Optional ACME HTTP helper: `0.0.0.0:80`

### Docker Compose defaults

- App: `${FORGEFRAME_APP_PORT:-8000}`
- PostgreSQL: `${FORGEFRAME_PG_PORT:-5432}`

## 9) Basic verification checklist

1. Backend process starts without `Settings()` validation errors.
2. Frontend dev server starts and prints a local URL.
3. Opening the frontend URL loads the shell UI.
4. Backend health/API routes respond on configured backend port.

## 10) Troubleshooting

### Backend fails on startup with settings errors

- Check `.env` values for missing required PostgreSQL URLs.
- Verify `FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD` is set when admin auth is enabled.

### Frontend cannot reach backend

- Confirm backend is running on expected host/port.
- Confirm frontend is using the intended API base path.

### PostgreSQL connection failures

- Confirm host, port, username, password, and database exist.
- Validate all `*_POSTGRES_URL` values use `postgresql+psycopg://` format.

### Port already in use

- Change port values in environment (`FORGEFRAME_PORT`, `FORGEFRAME_APP_PORT`, `FORGEFRAME_PG_PORT`) and restart.
