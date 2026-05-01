# AGENTS.md

This file contains the minimum information needed for an agent to resume useful work on this project.

## Project Overview

**Project Name**: ForgeFrame
**Description**: Linux-first control plane and runtime platform for autonomous AI instances — combines Smart AI Gateway, execution routing, harness, governance, observability, queueing, work interaction, and personal assistant modes.
**Repository**: /opt/ai-projects/ForgeFrame
**Primary Language/Stack**: Python 3 (FastAPI backend) + TypeScript/React 19 (Vite frontend)

## Project Structure

```text
/opt/ai-projects/ForgeFrame/
├── backend/                        # FastAPI backend (Python)
│   ├── app/                        # Application code
│   ├── tests/                      # Backend tests (pytest)
│   └── pyproject.toml              # Python project config
├── frontend/                       # React 19 SPA (TypeScript)
│   ├── src/
│   │   ├── api/                    # API client + TanStack Query hooks
│   │   ├── app/                    # App shell, routing, session, auth
│   │   ├── components/             # Shared UI components + layout
│   │   ├── features/               # Feature modules (approvals, skills, etc.)
│   │   ├── pages/                  # Page-level components (lazy loaded)
│   │   ├── styles/                 # Global CSS (theme.css, ~2232 lines)
│   │   └── main.tsx                # Entry point with 44+ routes
│   ├── tests/                      # Frontend tests (Vitest + jsdom)
│   └── package.json                # Node deps (React 19, Vite 7, TS 5.9)
├── deploy/                          # Deployment configs + env templates
├── docker/                          # Docker Compose files
├── docs/                            # Documentation
├── scripts/                         # Utility scripts
└── AGENTS.md                        # Agent resume context
```

## Architecture

```text
Browser (React 19 SPA)
    ↓ HTTP/API calls
FastAPI Backend (Python)
    ↓ 
Core Domain (instances, routing, governance, skills, agents, etc.)
    ↓
PostgreSQL + Redis
```

The frontend is a single-page app with 44+ lazy-loaded pages. No external UI or state management libraries — custom CSS (`fg-*` classes) and React's built-in `useState`/`useEffect`, with TanStack Query for server state. The backend is a FastAPI Python application with a modular feature architecture.

## Core Concepts

* **Instances**: The top-level tenant unit. Every API call is scoped to an instance. Frontend reads `instanceId` from URL search params.
* **Skills**: Versioned registry entries with provenance, activation, scope (instance/agent), and usage telemetry. Recently decomposed from a 1271-line monolithic page into `features/skills/`.
* **LoadState**: Union type `"idle" | "loading" | "success" | "error"` used across all pages for data-fetching state.
* **fg-* CSS classes**: Custom design system with cards (`fg-card`), pills (`fg-pill`), grids (`fg-grid`, `fg-grid-compact`), tables (`fg-table`), and form layouts (`fg-inline-form`, `fg-stack`).
* **Access control**: Session-based via `useAppSession()`, checked with `getWorkInteractionAccess()` returning `{ canRead, canMutate }`.

## Important Files

* `frontend/src/api/admin.ts`: Canonical source for ALL API functions and types (6329 lines). Every page imports from here.
* `frontend/src/api/adminQueries.ts`: TanStack Query hooks (1065 lines) — note that some pages like SkillsPage use manual fetching instead.
* `frontend/src/app/navigation.ts`: `CONTROL_PLANE_ROUTES` constant — the single source of route paths.
* `frontend/src/pages/workInteractionPageSupport.ts`: Shared utilities (`LoadState`, `parseJsonObject`, `normalizeOptional`, `getWorkInteractionAccess`).
* `frontend/src/styles/theme.css`: All CSS (2232 lines). No CSS modules — plain BEM-like class naming.
* `frontend/src/main.tsx`: Route definitions for all 44+ pages.
* `backend/app/`: Backend application code (modular feature structure).
* `frontend/package.json`: Dependencies — React 19.1.1, Vite 7.1.5, TypeScript 5.9.2, TanStack Query 5, React Router 7, Vitest 3.

## Runtime Data / Persistence

* `backend/.forgegate/`: Backend runtime data (local dev)
* `frontend/dist/`: Build output (gitignored)
* `.env` / `.env.example`: Environment configuration

## Development Commands

```bash
# Frontend development
cd frontend
npm install              # Install dependencies
npm run dev              # Start Vite dev server
npm run typecheck        # TypeScript check (tsc --noEmit)
npm test                 # Run all tests (vitest run)
npx vitest run tests/skills-page.test.tsx  # Run specific test file
npm run build            # Production build (tsc + vite build)

# Backend development
cd backend
pip install -e ".[dev]"  # Install backend + dev deps
pytest                   # Run backend tests
```

## Verification Expectations

A change is not done until:
* TypeScript typecheck passes (`npm run typecheck` or `npx tsc --noEmit`)
* All frontend tests pass (`npm test` in frontend/)
* Build succeeds (`npm run build` in frontend/)
* Relevant regression impact is checked (run full test suite, not just targeted tests)

## Agent Working Rules

* Keep responses and updates short, useful, and specific.
* Prefer direct fixes over broad rewrites.
* Do not add task logs, progress reports, or historical notes to this file.
* Update this file only with durable project facts.
* Keep examples minimal and executable.

## Current Project Notes

* SkillsPage was recently decomposed: `features/skills/` now contains `useSkills.ts` (hook), `SkillList.tsx`, `SkillDetail.tsx`, `SkillForm.tsx`, `utils.ts`, `types.ts`, `index.ts`. The page is now 149 lines.
* The frontend uses NO external UI library — all UI is custom CSS. Do not introduce MUI, Chakra, shadcn, etc.
* Use named exports exclusively. No default exports.
* All exported symbols require TSDoc docstrings per coding standards.
* The `features/` directory pattern is preferred for new feature modules (pages delegate to feature components).

## Known Constraints

* No external state management (no Redux, Zustand). React Query + useState only.
* No CSS modules — plain CSS with `fg-` prefixed class names.
* No component library. Custom `fg-*` design system only.
* React 19 strict mode enabled.
* TypeScript strict mode enabled — no `any` types.
* All pages are lazy-loaded via `React.lazy()`.
* Frontend tests use real DOM rendering (not React Testing Library) via `createRoot`.
* Backend is Python with FastAPI — do not mix frontend/backend concerns.

## Testing Focus Areas

* `frontend/tests/skills-page.test.tsx`: Skills CRUD, activation, archive, usage recording — verifies API payload structure
* `frontend/tests/`: Page-level tests for all 44+ routes — each test file mocks API functions via `vi.mock()`
* `backend/tests/`: Backend pytest suite

## Do Not Commit / Do Not Modify

* `.env`, `.env.*`: Secrets and local environment config
* `backend/.forgegate/`: Runtime data
* `frontend/dist/`: Build artifacts
* `*.tsbuildinfo`: TypeScript incremental build cache
