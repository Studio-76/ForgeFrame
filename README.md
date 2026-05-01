# ForgeFrame

Linux-first control plane and runtime platform for autonomous AI instances.

![Status](https://img.shields.io/badge/status-active-success)
![Platform](https://img.shields.io/badge/platform-linux-informational)
![Backend](https://img.shields.io/badge/backend-FastAPI-009688)
![Frontend](https://img.shields.io/badge/frontend-React%2019-61DAFB)
![License](https://img.shields.io/badge/license-private-lightgrey)

---

## Table of Contents

- [What is ForgeFrame?](#what-is-forgeframe)
- [Tech Stack](#tech-stack)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development Commands](#development-commands)
- [Documentation](#documentation)

---

## What is ForgeFrame?

ForgeFrame is a unified runtime and control plane for operating AI instances safely and predictably.
It combines API gateway behavior, execution routing, governance, queueing, work interaction flows, and observability in one platform.

---

## Tech Stack

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy, Psycopg (PostgreSQL)
- **Frontend:** React 19, TypeScript 5, Vite 7, TanStack Query
- **Infrastructure:** Linux-first deployment model, PostgreSQL persistence

---

## Requirements

- **OS:** Linux (primary target)
- **Python:** 3.11+
- **Node.js:** 20+
- **npm:** 10+
- **Database:** PostgreSQL 14+

---

## Installation

### 1) Clone the repository

```bash
git clone <your-repo-url>
cd ForgeFrame
```

### 2) Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### 3) Frontend setup

```bash
cd ../frontend
npm install
```

### 4) Environment

```bash
cd ..
cp .env.example .env
```

Update `.env` values for your local PostgreSQL and runtime configuration.

---

## Quick Start

Start backend and frontend in separate terminals.

### Terminal A — Backend

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

### Terminal B — Frontend

```bash
cd frontend
npm run dev
```

Then open the Vite URL printed in your terminal (typically `http://localhost:5173`).

---

## Project Structure

```text
ForgeFrame/
├── backend/      # FastAPI services and domain logic
├── frontend/     # React 19 control plane UI
├── docs/         # Documentation
├── deploy/       # Deployment config templates
├── docker/       # Container-related assets
└── scripts/      # Utility scripts
```

---

## Development Commands

### Frontend (`frontend/`)

```bash
npm run dev
npm run typecheck
npm test
npm run build
```

### Backend (`backend/`)

```bash
pytest
```

---

## Documentation

- Archived previous README: [`reference/README_OLD.md`](reference/README_OLD.md)
- Additional docs live under [`docs/`](docs/)

More specific technical and operator documentation will be added incrementally.
