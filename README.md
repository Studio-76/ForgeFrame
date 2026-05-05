# ForgeFrame

<p align="center">
  <img src="docs/assets/forgeframe-logo.png" alt="ForgeFrame logo" width="360">
</p>

Linux-first runtime and control plane for operating autonomous AI instances.

## Overview

ForgeFrame provides the infrastructure layer for running AI instances under operator control. It integrates API gateway behaviour, execution routing, queueing, work interaction flows, and operational visibility into a single platform.

The project is under active development.

## Capabilities

- Runtime control plane for autonomous AI instances
- API gateway and execution routing
- Queue-based workload distribution
- PostgreSQL-backed state persistence
- React-based operator interface
- Linux-first deployment model
- Observability foundation and operational controls

## Tech Stack

| Component | Technology |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLAlchemy, Psycopg |
| Frontend | React 19, TypeScript 5, Vite 7, TanStack Query |
| Database | PostgreSQL 14+ |
| Platform | Linux |

## Requirements

- Linux (primary target)
- Python 3.11+
- Node.js 20+
- PostgreSQL 14+

## Installation

### Clone

```bash
git clone <your-repo-url>
cd ForgeFrame
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### Frontend

```bash
cd ../frontend
npm install
```

### Environment

```bash
cd ..
cp .env.example .env
```

Edit `.env` with your PostgreSQL connection and runtime configuration.

## Quick Start

Run the backend and frontend in separate terminals.

**Backend:**

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

**Frontend:**

```bash
cd frontend
npm run dev
```

Open the URL shown by Vite (typically `http://localhost:5173`).

## Production

Build the frontend bundle, then serve both the API and static assets:

```bash
cd frontend && npm run build
cd ..
./scripts/start-forgeframe.sh
```

Listens on `127.0.0.1:8080` by default. Override with `FORGEFRAME_HOST` and `FORGEFRAME_PORT`.

## Project Structure

```text
backend/     FastAPI services and domain logic
frontend/    React 19 SPA — operator interface
docs/        Technical and operations documentation
deploy/      Deployment configuration templates
docker/      Container-related assets
scripts/     Utility scripts
reference/   Architecture and design references
```

## Development

```bash
# Frontend
npm run dev         # Start Vite dev server
npm run typecheck   # TypeScript check
npm test            # Run frontend test suite
npm run build       # Production bundle

# Backend
pytest              # Run backend test suite
```

Run frontend commands from `frontend/` and backend commands from `backend/`.

## Documentation

Additional technical and operator documentation is maintained in `docs/`.

An earlier project overview is kept at [`reference/README_OLD.md`](reference/README_OLD.md).
