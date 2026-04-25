# ForgeFrame

**Linux-first control plane and runtime platform for autonomous AI instances.**

ForgeFrame is the successor to the ForgeGate idea: a product-oriented runtime and control-plane stack for operating AI instances with real routing, governance, observability, queueing, work interaction, memory and operational truth.

It is not just a model proxy.  
It is not just a chat frontend.  
It is not just a workflow builder.  
It is not a marketing shell around hidden runtime gaps.

ForgeFrame is intended to be the operating frame in which AI instances can be run safely, transparently, controllably, budgetably and productively.

---

## Status

ForgeFrame is currently an active implementation of the **V9 target-state**.

The V9 target-state is normative: it defines the intended end-state for product identity, architecture, runtime contracts, governance, persistence, UI, installation, TLS, recovery, backup and release readiness. The current codebase must be read against that target-state and against the actual runtime behavior.

Important rule:

> Product truth beats presentation. ForgeFrame may only claim what is actually supported by code, runtime behavior, persistence, health/readiness, routing, dispatch, UI, tests and release gates.

This README therefore separates:

- **target-state direction**: what ForgeFrame is designed to become
- **current implementation**: what the repository currently carries
- **operator path**: how to install, run and validate the system today

---

## What ForgeFrame is

ForgeFrame is a **Linux-first, system-natively installable control-plane and runtime platform for autonomous AI instances**.

A ForgeFrame instance is the central product unit. It can contain and govern:

- providers, models and provider targets
- API keys, accounts, OAuth/session bindings and runtime identities
- routing policies, request paths and execution lanes
- budgets, limits, circuit breakers and cost-safety rules
- queue classes, dispatch jobs, workers and run orchestration
- conversations, threads, inbox, tasks, reminders and notifications
- approvals, decisions, action drafts, previews and external actions
- workspaces, artifacts, handoffs and reports
- memory, learning events, skills and recall/search surfaces
- health, readiness, bootstrap and release-validation truth

The platform can be used for:

- local solo operation
- shared private team/company operation
- hosted, public or managed multi-tenant operation
- hybrid operation with local, external and account-bound AI providers

---

## What ForgeFrame is not

ForgeFrame is deliberately not:

- only a model proxy
- only an API gateway
- only a chat frontend
- only a workflow builder
- only a task board
- only a CI/PR tool
- a demo console
- a decorative matrix without runtime meaning
- a fake full-integration platform
- a black box that hides routing, cost, queue or provider decisions

If something is only partial, bridge-only, onboarding-only, probe-only, modeled or unsupported, it must be exposed as such.

---

## Core product pillars

### Smart AI Gateway

ForgeFrame exposes OpenAI-compatible runtime contracts where supported, especially:

- `/health`
- `/v1/models`
- `/v1/chat/completions`
- `/v1/responses`
- `/v1/embeddings`
- `/v1/files`

The runtime layer is designed around:

- request and response fidelity
- streaming behavior
- tool fidelity where supported
- explicit unsupported/partial semantics
- structured error mapping
- request, correlation, causation and trace metadata
- routing-decision headers
- usage and error recording

### Smart Execution Routing

ForgeFrame routes by correctness first, not by cheapness first.

The intended decision order is:

1. capability fit
2. policy and rights
3. health and availability
4. economic fit
5. budget and limit compliance

The routing model distinguishes visible request classes such as **simple** and **non-simple**, and operational execution lanes such as:

- Interactive Low Latency
- Interactive Heavy
- Background Agentic
- OAuth Serialized

These concepts must not be mixed: routing class describes what a request is allowed to do; execution lane describes how it is operated.

### Provider Targets

ForgeFrame treats a runtime target as more than a model string.

A provider target is the operational representation of a usable destination, including:

- provider
- model
- integration class
- auth or credential type
- capability profile
- execution traits
- policy flags
- cost and quality class
- health/readiness state
- priority
- queue suitability
- fallback and escalation eligibility
- instance-bound rights and bindings

### Queueing, Dispatch and Runs

Non-trivial, long-running, agentic or serialized work must use explicit queue, dispatch and run semantics.

The V9 target-state requires persistent truth for:

- dispatch jobs
- dispatch decisions
- dispatch attempts
- worker leases
- retries and backoff
- pause, resume, interrupt and cancel
- dead-letter or quarantine states
- queue metrics and explainability

The current codebase contains execution and dispatch modules plus admin APIs for execution visibility and control. Queue and run claims must still be validated against the actual implementation and release gates.

### Generic Harness

ForgeFrame includes a generic harness model for provider and integration work:

- profiles
- templates
- preview
- verify
- dry run
- probe
- execute
- inventory/discovery
- sync
- snapshot
- import/export
- rollback
- persistent runs

The harness is a product path, not a mere configuration helper.

### UI-first Control Plane

ForgeFrame is UI-first, but not UI-fake.

The control plane is intended to be the main operator surface for:

- dashboard and platform state
- instances and agents
- providers, models and provider targets
- routing and execution
- queues, runs and dispatch
- health, readiness, logs and usage
- security, accounts, API keys and scopes
- ingress, exposure, TLS and certificates
- approvals, decisions and external actions
- conversations, inbox, tasks and notifications
- workspaces and artifacts
- memory, learning and skills
- plugins and settings

The frontend is a React/Vite application. The backend mounts the built frontend at `/` and serves runtime/admin APIs on the same origin.

### Work Interaction Layer

ForgeFrame is also a work surface.

The Work Interaction Layer covers:

- conversations, threads and sessions
- inbox and triage
- tasks, follow-ups and reminders
- notifications, outbox and delivery status
- contacts and channels
- action drafts and previews
- approval flows before external effects
- linking interactions to runs, artifacts, decisions and handoffs

V9 also requires structured agent presence: each instance must have a coordinator/lead agent named `Operator` by default, with support for agent mentions, participation modes, handoffs and multi-agent review loops.

### Learning, Memory and Skills

ForgeFrame treats learning, memory and skills as governed product functions, not as uncontrolled prompt accumulation.

The intended architecture separates:

- Boot Memory
- Working Context
- Durable Memory
- Recall and Search
- Skill Registry
- Skill versioning and scopes
- Learning Persistence Loop
- Memory and Skill Explainability

Memory and skill promotion must be scoped, reviewable, auditable and correctable.

---

## Current implementation overview

The repository currently contains these major parts:

```text
backend/                  FastAPI backend, runtime API, admin API, governance, storage, routing, execution
frontend/                 React/Vite control-plane frontend
scripts/                  host installer, bootstrap, service start, smoke, migration, worker, backup/restore helpers
deploy/env/               host-native environment examples
deploy/systemd/           systemd service and timer templates
docker/                   optional container/compose packaging path
reference/                target-state and provider/API reference material
docs/                     implementation notes, maps and audit documents
CODEX_INSTALL_AUDIT.md    current install audit and real-host debugging log
```

### Backend

The backend is a FastAPI application with:

- runtime routers under `/v1`
- a `/health` endpoint
- admin routers under `/admin`
- startup/readiness validation
- request envelope and idempotency handling
- structured error mapping
- routing/dispatch integration for chat completions
- protected admin modules for instances, agents, models, providers, provider targets, routing, approvals, tasks, conversations, inbox, memory, learning, skills, workspaces, artifacts, usage, logs, settings and security

Python requirement: **Python 3.11+**.

### Frontend

The frontend is a private React/Vite package with:

- React 19
- React Router 7
- TypeScript
- Vite
- Vitest

Build command:

```bash
cd frontend
npm ci
npm run build
```

### Runtime APIs

Currently visible runtime API surface includes:

- `/health`
- `/v1/models`
- `/v1/chat/completions`
- `/v1/responses`
- `/v1/embeddings`
- `/v1/files`

`/v1/chat/completions` includes request validation, runtime authorization, routing, dispatch, streaming/non-streaming paths, usage/error recording and structured provider/runtime error mapping.

### Admin APIs

The admin API is mounted under `/admin` and includes modules for:

- authentication
- dashboard
- instances
- agents
- models
- provider targets
- routing
- approvals
- tasks and reminders
- channels and notifications
- automations
- assistant profiles
- contacts and knowledge sources
- memory, learning and skills
- conversations and inbox
- execution
- ingress
- recovery
- providers and plugins
- accounts and API keys
- workspaces and artifacts
- usage and logs
- settings and security administration

Most admin modules require an authenticated admin session.

---

## Installation model

The normative product path is **direct Linux host operation**.

ForgeFrame itself is not intended to require containerization for the standard product path. PostgreSQL may run:

- natively on the host
- as a dedicated Docker container
- as an existing external PostgreSQL service

A file/SQLite mode exists only as an explicit limited exception for development, recovery or constrained test environments. It is not the production truth.

### Normative public surface

The intended public product surface is:

```text
https://<fqdn>/
```

on:

```text
0.0.0.0:443
```

with:

- UI at `/`
- runtime API under `/v1/...`
- admin API under `/admin/...`
- optional port `80` helper only for ACME/redirect/checking purposes
- integrated ACME/Let's Encrypt certificate handling where the deployment mode permits it

Missing FQDN, DNS, ACME email, port reachability or certificates must be surfaced as blockers or limited exceptions, not hidden.

---

## Host-native quick start

### 1. Clone

```bash
git clone git@github.com:Studio-76/ForgeFrame.git
cd ForgeFrame
```

or with a dedicated SSH alias:

```bash
git clone git@github-forgeframe:Studio-76/ForgeFrame.git
cd ForgeFrame
```

### 2. Run the guided host bootstrap

For a real host installation with systemd, ports 80/443, frontend build, backend venv, PostgreSQL provisioning and host smoke validation:

```bash
sudo scripts/bootstrap-forgeframe.sh --guided
```

The guided path asks for the login-critical host values, including public FQDN, ACME email, admin credentials and PostgreSQL mode.

### 3. Useful install flags

```bash
scripts/bootstrap-forgeframe.sh --dry-run
```

```bash
sudo scripts/bootstrap-forgeframe.sh --guided --skip-systemctl
```

```bash
sudo scripts/install-forgeframe.sh --guided --skip-frontend-build
```

```bash
sudo scripts/install-forgeframe.sh --guided --skip-python-env
```

### 4. PostgreSQL modes

The installer supports PostgreSQL mode selection through guided input and environment variables.

Important modes:

```text
native    PostgreSQL installed/provisioned on the host
existing  use an existing PostgreSQL service
docker    use a dedicated PostgreSQL Docker container
file      limited exception only; requires --allow-file-storage
```

The production target-state is PostgreSQL as primary truth. File/SQLite storage is only an explicit limited exception.

### 5. Limited exception local bootstrap

For constrained development or sandbox hosts where systemd, `/etc`, `/var`, apt, PostgreSQL packages or public TLS are unavailable:

```bash
FORGEFRAME_BOOTSTRAP_ALLOW_LIMITED_EXCEPTION=1 \
FORGEFRAME_INSTALL_SKIP_SYSTEM_DEPS=1 \
scripts/bootstrap-forgeframe.sh \
  --config-dir .install/etc \
  --state-dir .install/lib \
  --log-dir .install/log \
  --unit-dir .install/systemd \
  --env-file .install/etc/forgeframe.env \
  --skip-systemctl \
  --skip-system-user \
  --allow-file-storage
```

This is intentionally not the normative production path. It is useful for installer debugging, local smoke checks and constrained Codex/CI-style environments.

### 6. Validate

```bash
scripts/host-smoke.sh
```

Typical service checks on a real systemd host:

```bash
systemctl status forgeframe-api.service
systemctl status forgeframe-worker.service
systemctl status forgeframe-public.service
systemctl status forgeframe-http-helper.service
systemctl status forgeframe-retention.timer
systemctl status forgeframe-acme.timer
```

Logs:

```bash
journalctl -u forgeframe-api.service --no-pager -n 120
journalctl -u forgeframe-worker.service --no-pager -n 120
journalctl -u forgeframe-public.service --no-pager -n 120
```

---

## Current installer and audit notes

The host installer and bootstrap path have recently been hardened for real Ubuntu/Codex-style installation testing.

Current notable behavior:

- executable host scripts are intended to be directly callable by operators and systemd
- installer/bootstrap scripts include a `/dev/null` fallback path for restricted execution environments
- apt calls use `APT::Sandbox::User=root` to avoid misleading `_apt` sandbox failures in constrained hosts
- apt preflight now fails explicitly when package indexes or DNS/network access are unavailable
- PostgreSQL provisioning supports native/existing/docker/file modes
- PostgreSQL role creation avoids broken psql interpolation inside quoted PL/pgSQL blocks
- `--skip-system-user` exists for restricted environments where `groupadd`/`useradd` cannot access Linux audit interfaces
- `--allow-file-storage` gates the limited file/SQLite exception path
- `--skip-systemctl` allows local non-systemd API smoke validation

The install audit is tracked in `CODEX_INSTALL_AUDIT.md` and should be treated as the current operational debugging log, not as marketing documentation.

---

## Development

### Backend

```bash
cd backend
python3.11 -m venv .venv
. .venv/bin/activate
pip install -e '.[dev]'
pytest
```

Run locally:

```bash
cd ..
scripts/start-forgeframe.sh
```

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

Build:

```bash
npm run build
```

### Smoke and syntax checks

```bash
bash -n scripts/*.sh scripts/lib/*.sh
scripts/host-smoke.sh
```

---

## Runtime examples

Health:

```bash
curl -s http://127.0.0.1:8080/health | jq
```

Models:

```bash
curl -s http://127.0.0.1:8080/v1/models | jq
```

Chat completions:

```bash
curl -s http://127.0.0.1:8080/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <forgeframe-api-key>' \
  -d '{
    "model": "<model-id>",
    "messages": [{"role": "user", "content": "Hello ForgeFrame"}]
  }' | jq
```

Responses:

```bash
curl -s http://127.0.0.1:8080/v1/responses \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <forgeframe-api-key>' \
  -d '{
    "model": "<model-id>",
    "input": "Hello ForgeFrame"
  }' | jq
```

---

## Security and governance defaults

ForgeFrame is designed around secure-by-default operation:

- runtime authentication should be active by default
- API keys are scope- and instance-bound
- admin routes require authenticated sessions
- provider and target use is policy-bound
- expensive/premium paths are controlled
- external actions require explicit classification, preview and approval semantics
- secrets must be stored and backed up separately from normal product data
- TLS keys and certificates must be handled as sensitive operational material

The V9 policy hierarchy is:

1. global platform/security prohibitions
2. tenant or organization rules
3. instance rules
4. agent/profile/role rules
5. run/task/conversation context rules
6. user preferences where allowed

Deny beats allow.

---

## Data and persistence model

The target-state persistence model is PostgreSQL-first.

Relational PostgreSQL truth is intended for:

- instances
- users, roles and rights
- providers and targets
- routing policies
- queue jobs, dispatch decisions and worker leases
- runs and approvals
- tasks, conversations and contacts
- budgets and cost frames
- audit events
- memory and skill metadata

JSONB is acceptable for provider-specific payloads, flexible metadata, raw explainability details and connector extras, but not as the primary structure for core states, rights, budgets, queues or routing rules.

Full-text search and pgvector are intended as retrieval layers, not as replacements for structured product truth.

---

## Backup, restore, upgrade and rollback

The V9 target-state requires ForgeFrame to carry explicit operational contracts for:

- upgrade paths
- migration compatibility
- rollback strategy where technically possible
- partial-failure handling
- backup classes
- restore paths and restore tests
- separation between backup, archive, export and recovery
- special treatment of secrets and sensitive data

The repository contains host backup/restore helper scripts. Real release readiness still depends on repeatable validation and restore tests.

---

## Definition of done for product claims

A feature should only be called ready when it is true in:

- code
- runtime behavior
- persistence
- UI
- health/readiness
- routing and dispatch
- queue and worker behavior
- tests
- release gates

Especially non-negotiable:

- smart routing must be explainable
- queueing must have real states, not UI labels only
- simple/non-simple must affect runtime behavior
- OpenAI-compatible paths must not silently become hidden long-running job contracts
- premium providers must not become the careless default for trivial work
- TLS/FQDN/certificate readiness must be operationally visible
- learning, memory and skills must be governed and correctable
- external actions must never silently emerge from recommendations or drafts

---

## Kurz auf Deutsch

ForgeFrame ist eine **Linux-first Control Plane und Runtime-Plattform für autonome AI-Instanzen**.

Der verbindliche Zielzustand ist V9: Host-nativer Linux-Betrieb, PostgreSQL als Primärwahrheit, echte Runtime- und Admin-APIs, Smart Execution Routing, Queueing/Dispatch, Governance, Work Interaction, Memory/Learning/Skills, integriertes TLS/FQDN/Zertifikatsmodell sowie ehrliche Health-, Readiness- und Release-Wahrheit.

Der aktuelle Code enthält bereits FastAPI-Backend, React/Vite-Frontend, Runtime-API, geschützte Admin-Module, host-nativen Installer, systemd-Units, Smoke-Checks, optionale Docker-/Compose-Pfade und ein laufendes Installationsaudit.

Für eine echte Hostinstallation ist der wichtigste Einstieg:

```bash
sudo scripts/bootstrap-forgeframe.sh --guided
```

Für eingeschränkte Testumgebungen gibt es einen bewusst gekennzeichneten Limited-Exception-Pfad. Dieser ersetzt nicht den produktiven PostgreSQL-/Host-Nativ-Pfad.
