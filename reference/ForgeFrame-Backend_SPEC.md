# ForgeFrame Backend SPEC

**Project:** ForgeFrame
**Version:** v0.6.x
**Status:** Working Application — Iterative Development
**Date:** 2026-05-01

---

## 1) Product Identity

ForgeFrame is a **Linux-first control-plane and runtime platform** for autonomous AI instances. It combines a Smart AI Gateway, execution routing, governance, observability, queueing, provider harness, and work interaction in a single backend.

**Stack:** Python 3.11+ / FastAPI / SQLAlchemy / PostgreSQL / Pydantic

### What It Is Not
- Not just an API proxy/gateway
- Not just a chat backend
- No fake integration claims — each provider has an honest `contract_classification`
- No hidden sync-to-async conversion of interactive requests

---

## 2) Architecture Overview

```
                                 HTTP Request
                                      │
                              ┌───────▼────────┐
                              │  StartupGate    │──→ 503 if startup checks fail
                              │  Middleware      │
                              └───────┬────────┘
                                      │
                              ┌───────▼────────┐
                              │  Request Env.   │──→ request_id, correlation_id,
                              │  Middleware      │    causation_id, trace_id
                              └───────┬────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
             ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
             │ Runtime API  │  │  Admin API   │  │  Frontend   │
             │ /v1/*        │  │  /admin/*    │  │  / (SPA)    │
             └──────┬──────┘  └──────┬──────┘  └─────────────┘
                    │                │
             ┌──────▼──────┐  ┌──────▼──────────────────┐
             │ Provider     │  │ Admin Services:          │
             │ Registry     │  │ instances, providers,    │
             │ + Adapters   │  │ routing, governance,     │
             └──────┬──────┘  │ approvals, conversations,│
                    │          │ skills, memory, plugins, │
             ┌──────▼──────┐  │ workspaces, artifacts,   │
             │ Execution   │  │ security, settings,       │
             │ Engine      │  │ recovery, ingress, logs   │
             │ + Harness   │  └──────────────────────────┘
             └──────┬──────┘
                    │
             ┌──────▼────────────────────────────────────┐
             │  Storage Layer (SQLAlchemy → PostgreSQL)   │
             │  + idempotency + migrations + retention    │
             └───────────────────────────────────────────┘
```

### 2.1 Request Lifecycle
1. Startup validation gate → fails fast until DB + config + admin credentials are valid
2. Request envelope middleware → generates trace/correlation/causation IDs, validates idempotency keys
3. Auth gate → session check for admin routes, API key check for runtime routes
4. Route handler → calls service layer → storage layer → returns response
5. Response headers include request/correlation/trace IDs

### 2.2 Two API Surfaces
- **Runtime API** (`/v1/*`): OpenAI-compatible endpoints — `/health`, `/v1/models`, `/v1/chat/completions`, `/v1/responses`, `/v1/embeddings`, `/v1/files`
- **Admin API** (`/admin/*`): Control-plane operations — providers, instances, routing, governance, conversations, approvals, skills, memory, recovery, settings, logs, security

---

## 3) Technology Stack (Backend)

| Layer | Technology | Version |
|---|---|---|
| Runtime | Python 3.11+ | >=3.11 |
| Web Framework | FastAPI | >=0.116 |
| ASGI Server | Uvicorn | >=0.35 |
| Data Validation | Pydantic / Pydantic-Settings | >=2.11 |
| ORM | SQLAlchemy | >=2.0 |
| Database | PostgreSQL (psycopg binary) | >=3.2 |
| HTTP Client | httpx | >=0.28 |
| Testing | pytest | >=8.3 |
| Linting | ruff | >=0.9 |
| Type Checking | mypy | >=1.15 |

### 3.1 Dependencies (Core, from pyproject.toml)
```
fastapi, uvicorn, pydantic, pydantic-settings, httpx, sqlalchemy, psycopg[binary]
```
No heavy frameworks. No Django. No Celery (background work uses simple patterns).

---

## 4) Module Map (Backend `/backend/app/`)

### 4.1 Core Infrastructure

| Module | Responsibility | Lines |
|---|---|---|
| `main.py` | App bootstrap, middleware stack, lifespan, frontend mount | 252 |
| `public_surface.py` | Constants for FQDN, ACME, normatives | 77 |
| `readiness.py` | Startup validation gate, health check builder | — |
| `request_metadata.py` | Request envelope metadata generation | — |
| `product_taxonomy.py` | Product classification helpers | — |
| `tenancy.py` | Tenant/instance scope resolution | — |

### 4.2 Runtime API (`api/runtime/` — 5 routes, ~3113 lines)

| Route | Handler | Function |
|---|---|---|
| `GET /health` | `health.py` | Provider health, readiness state (booting/degraded/ready) |
| `GET /v1/models` | `models.py` | Public model inventory (sanitized) |
| `POST /v1/chat/completions` | `chat.py` | Non-stream + SSE streaming, tool calling |
| `POST /v1/responses` | `responses.py` | Runtime responses endpoint (~1163 lines) |
| `POST /v1/embeddings` | `embeddings.py` | Embedding generation |
| `POST /v1/files` | `files.py` | File upload/handling |
| `api/runtime/schemas.py` | Shared request/response schemas (227 lines) |
| `api/runtime/dependencies.py` | Runtime dependencies and auth |

### 4.3 Admin API (`api/admin/` — 50+ route modules, ~16k lines)

The admin API provides CRUD + control operations for:
- **Auth** (`auth.py`): Session login, logout, refresh
- **Dashboard** (`dashboard.py`): Dashboard aggregation, health overview (884 lines)
- **Instances** (`instances.py`): Instance CRUD, operator agent setup, bootstrap (556 lines)
- **Providers** (`providers.py`): Provider catalog, control, targets, health (889 lines)
- **Models** (`models.py`): Model management
- **Routing** (`routing.py`): Routing rules and policies (94 lines, plus domain module 331 lines)
- **Approvals** (`approvals.py`): Approval workflow (290 lines)
- **Execution** (`execution.py`): Run management, transitions (451 lines)
- **Conversations** (`conversations.py`): Conversation CRUD + messages (124 lines)
- **Inbox** (`inbox.py`): Inbox management (94 lines)
- **Skills** (`skills.py`): Skills CRUD, activation, versioning, usage telemetry (148 lines)
- **Learning** (`learning.py`): Learning events (95 lines)
- **Memory** (`memory.py`): Memory entries (162 lines)
- **Knowledge Sources** (`knowledge_sources.py`): Knowledge base connections (93 lines)
- **Agents** (`agents.py`): Agent management (114 lines)
- **Channels** (`channels.py`): Notification channels (87 lines)
- **Notifications** (`notifications.py`): Outbox, alerts (152 lines)
- **Security** (`security.py`, `security_admin.py`): Password rotation, admin gate, audit (685 lines)
- **Keys** (`keys.py`): API key management (366 lines)
- **Accounts** (`accounts.py`): Account management (106 lines)
- **Settings** (`settings.py`): Global settings (156 lines)
- **Workspaces** (`workspaces.py`): Workspace CRUD (95 lines)
- **Artifacts** (`artifacts.py`): Artifact management (97 lines)
- **Plugins** (`plugins.py`): Plugin registry (117 lines)
- **Recovery** (`recovery.py`): Backup/restore, upgrade reports (127 lines)
- **Ingress** (`ingress.py`): TLS/ACME configuration
- **Usage** (`usage.py`): Usage analytics, cost tracking (644 lines)
- **Logs** (`logs.py`): Audit log querying, export (1812 lines)
- **Assistant Profiles** (`assistant_profiles.py`): Profile management (117 lines)
- **Tasks/Reminders/Automations** (`tasks.py`, `reminders.py`, `automations.py`): Work interaction (86-102 lines each)
- **Contacts** (`contacts.py`): Contact management (86 lines)
- **Security Admin** (`security_admin.py`): Password rotation policy, rotation gates (543 lines)

Additional domain modules in `api/admin/`:
- `control_plane_provider_domain.py` (561 lines): Provider control-plane state
- `control_plane_provider_catalog_domain.py` (724 lines): Provider catalog
- `control_plane_targets_domain.py` (563 lines): Target management
- `control_plane_routing_domain.py` (331 lines): Routing domain logic
- `control_plane_oauth_targets_domain.py` (1153 lines): OAuth target ops
- `control_plane_oauth_operations_domain.py` (299 lines): OAuth operation history
- `control_plane_truth_domain.py` (676 lines): Provider truth/readiness
- `control_plane_axis_contracts_domain.py` (506 lines): Axis contract assertions
- `control_plane_openai_compat_domain.py` (505 lines): OpenAI compat tests
- `control_plane_models.py` (348 lines): Model catalog
- `control_plane_bootstrap_domain.py` (234 lines): Bootstrap flow
- `control_plane_harness_domain.py` (204 lines): Harness control
- `control_plane_health_domain.py` (131 lines): Health management
- `control_plane_beta_domain.py` (293 lines): Beta feature gating
- `control_plane.py` (157 lines): Central control-plane state
- `instance_scope.py` (64 lines): Instance scope resolution
- `control_plane_snapshot_domain.py` (18 lines): Snapshot management

### 4.4 Provider Layer (`providers/`)

| Provider | Adapter | Status |
|---|---|---|
| `forgeframe_baseline` | Built-in echo/baseline provider | Ready |
| `openai_api` | OpenAI API compatible | Ready |
| `openai_codex` | OpenAI Codex (OAuth) | Partial Runtime |
| `anthropic` | Anthropic API | Ready |
| `gemini` | Google Gemini | Ready |
| `bedrock` | AWS Bedrock | Ready |
| `ollama` | Local Ollama | Ready |
| `generic_harness` | Generic Harness bridge | Ready |

Each adapter implements `ProviderAdapter` base class with:
- `is_ready()`, `readiness_reason()`
- `chat()` (non-stream + stream via SSE)
- `count_tokens()`
- Error normalization (typed error hierarchy)

**Error type hierarchy:**
```
ProviderError
├── ProviderConfigurationError
├── ProviderAuthenticationError
├── ProviderBadRequestError
├── ProviderRateLimitError
├── ProviderRequestTimeoutError
├── ProviderTimeoutError
├── ProviderResourceGoneError
├── ProviderPayloadTooLargeError
├── ProviderUnsupportedMediaTypeError
├── ProviderUnavailableError
├── ProviderProtocolError
├── ProviderUpstreamError
├── ProviderNotImplementedError
├── ProviderModelNotFoundError
├── ProviderUnsupportedFeatureError
├── ProviderNotReadyError
├── ProviderStreamInterruptedError
├── ProviderConflictError
└── ProviderValidationError
```

### 4.5 Execution Layer (`execution/`)

The execution engine manages run state machines:
- `execution/engine.py` — run orchestration, state transitions
- `execution/models.py` — run state models, transitions
- `execution/service.py` — execution service layer
- Background worker support
- Worker lease/renewal, retry
- Integration with approvals, secrets, external calls

### 4.6 Harness (`harness/`)

Generic execution harness for providers with limited native API support:
- `harness/service.py` — harness orchestration
- `harness/models.py` — harness profile, run models
- `harness/store.py` — harness state persistence
- `harness/templates.py` — request templates
- `harness/redaction.py` — secret redaction
- `harness/openai_provider_presets.py` — provider presets

### 4.7 Governance (`governance/`)

Policy enforcement engine:
- `governance/service.py` — governance evaluation
- `governance/models.py` — policy models
- `governance/errors.py` — governance error types
- Integrated with authz layer for route-level policy checks

### 4.8 Security / Auth (`auth/`, `authz/`)

- **Auth:** Session-based admin authentication, login flow, password rotation enforcement
- **Authz:** Route-level authorization guards, permission catalog, evaluator
- `authz/catalog.py` — permission definitions
- `authz/evaluator.py` — policy evaluation
- `authz/route_guards.py` — FastAPI dependency guards

### 4.9 Storage Layer (`storage/` — ~8570 lines, ~40 repository modules)

SQLAlchemy-based persistence with PostgreSQL:

**Core entities (ORMs):**
- Instances, Agents, Provider Targets
- Conversations, Messages, Threads, Sessions, Participants
- Runs, RunAttempts, RunCommands, RunOutbox, RunApprovalLinks
- Skills, SkillVersions, SkillActivations, SkillUsageEvents
- Memory Entries, Knowledge Sources, Learning Events
- Approvals, Governance States
- Tasks, Reminders, Automations, Notifications, Delivery Channels
- Workspaces, Workspace Events, Artifacts, Artifact Attachments
- Plugins, Instance Plugin Bindings
- Recovery Backup/Restore/Upgrade Reports
- OAuth Operations
- Runtime Files, Runtime Responses
- Usage Events, Error Events, Health Events
- Contacts, Assistant Profiles
- Control Plane States
- Request Idempotency Records

**Infrastructure:**
- `storage/db.py` — database session, engine, connection management
- `storage/migrator.py` — schema migration runner
- `storage/models.py` — consolidated model exports
- `storage/retention_controls.py` — data retention policy enforcement (~329 lines)

### 4.10 Idempotency (`idempotency/`)

Request idempotency with key validation, envelope building, and persistence.

### 4.11 Telemetry (`telemetry/`)

- `telemetry/logging.py` — structured logging
- `telemetry/metrics.py` — metrics collection
- `telemetry/tracing.py` — distributed tracing
- `telemetry/context.py` — telemetry context management

### 4.12 Additional Modules

- **Agents** (`agents/`): Agent lifecycle, auto-creation
- **Knowledge** (`knowledge/`): Knowledge source integration
- **Skills** (`skills/`): Skill lifecycle, activation, versioning
- **Conversations** (`conversations/`): Conversation domain logic
- **Tasks** (`tasks/`): Task management
- **Settings** (`settings/config.py`): Application configuration with Pydantic-settings
- **Ingress** (`ingress/`): TLS/ACME certificate management
- **Recovery** (`recovery/`): Backup/restore coordination
- **Runtime Files** (`runtime_files/`): Uploaded file management
- **Responses** (`responses/`): Native runtime response handling
- **Plugins** (`plugins/`): Plugin system
- **Assistant Profiles** (`assistant_profiles/`): Agent profiles

---

## 5) Data Model (Key Entities)

### 5.1 Instance → Provider Target → Provider
```
Instance (id, name, status, settings)
  └── ProviderTarget (id, instance_id, enabled, config)
       └── ProviderAdapter (runtime adapter, capabilities, readiness)
```

### 5.2 Conversation Model
```
Conversation (id, instance_id, title, status)
  ├── Thread (id, conversation_id, subject)
  ├── Message (id, conversation_id, role, content, sources)
  ├── Participant (user/agent participation)
  ├── Session (tracking sessions)
  └── Event (conversation events, mentions)
```

### 5.3 Run Model
```
Run (id, instance_id, provider, model, status)
  ├── RunAttempt (attempt tracking with start/end times)
  ├── RunCommand (operator commands: start, stop, pause, resume, interrupt, retry)
  ├── RunExternalCall (tracked external API calls)
  ├── RunApprovalLink (approval binding)
  ├── RunOutbox (outbound notifications)
  └── RunSecretBinding (secret materialization)
```

### 5.4 Skill Model
```
Skill (id, name, scope, status)
  ├── SkillVersion (version_number, instruction_core, status)
  ├── SkillActivation (scope, agent binding, settings)
  └── SkillUsageEvent (agent, run, conversation, outcome)
```

### 5.5 Task Model
```
Task (id, instance_id, title, status, priority)
  ├── Reminder (due_at, repeat)
  ├── Automation (trigger, action)
  └── Notification (delivery_channel, status)
```

### 5.6 Observability Events
```
UsageEvent (instance, provider, model, tokens, cost, timestamp)
ErrorEvent (instance, provider, error_type, request_id, timestamp)
HealthEvent (instance, provider, status, duration, timestamp)
```

---

## 6) Configuration Model

All config via environment variables, managed by `pydantic-settings`:

```python
class Settings(BaseSettings):
    app_name: str = "ForgeFrame"
    app_version: str = "0.6.0"
    debug: bool = False
    api_base: str = "/v1"
    frontend_dist_path: str = "frontend/dist"
    database_url: str  # PostgreSQL DSN
    secret_key: str  # Session encryption key
    # Provider-specific URLs, keys, and feature flags
    is_provider_enabled(name: str) -> bool
```

**Required env vars for production:**
- `DATABASE_URL` — PostgreSQL connection string
- `SECRET_KEY` — session/crypto key
- Bootstrap admin credentials (first-run)

---

## 7) Testing Strategy

**Backend tests:** `backend/tests/` — 67 test files, ~30k lines

| Test File | What It Validates |
|---|---|
| `test_app_boot.py` | App creation, startup validation |
| `test_runtime_core.py` | Core runtime dispatch, streaming |
| `test_provider_execution_contract.py` | Provider adapter contract |
| `test_external_openai_path.py` | OpenAI compat runtime path |
| `test_native_responses_runtime_contract.py` | Responses endpoint contract |
| `test_provider_target_admin_api.py` | Target CRUD admin API |
| `test_routing_service.py` | Routing logic |
| `test_execution_transitions.py` | Run state machine transitions |
| `test_approvals_admin_api.py` | Approval workflow |
| `test_conversations_inbox_admin_api.py` | Conversations + inbox |
| `test_skills.py` | Skills CRUD, activation |
| `test_governance_modules.py` | Governance evaluation |
| `test_instances_admin_api.py` | Instance CRUD + bootstrap |
| `test_observability_persistence.py` | Events persistence |
| `test_control_plane_state_persistence.py` | Control plane state |
| `test_recovery_admin_api.py` | Backup/restore |
| `test_harness_*.py` | Harness lifecycle, storage (multiple files) |
| `test_oauth_ops_persistence.py` | OAuth operations |
| `test_request_idempotency_service.py` | Idempotency |
| `test_settings.py` | Config persistence |
| `test_host_public_https_contract.py` | HTTPS contract |
| `test_runtime_route_policies.py` | Route policy enforcement |

**Run tests:** `pytest` from `backend/` directory.

---

## 8) Current Development Status

### What Works (Production-Ready)
- ✅ Runtime API: `/health`, `/v1/models`, `/v1/chat/completions` (stream + non-stream)
- ✅ 8 provider adapters (forgeframe_baseline, openai_api, anthropic, gemini, bedrock, ollama, openai_codex, generic_harness)
- ✅ Provider registry with capability tracking
- ✅ Admin API: 50+ route modules covering all control-plane features
- ✅ PostgreSQL persistence with SQLAlchemy ORM (40+ entity types)
- ✅ Session-based authentication + authorization
- ✅ Idempotency support
- ✅ Request tracing (correlation/causation/trace IDs)
- ✅ Startup validation gate (fails fast on bad config)
- ✅ Frontend SPA serving from backend

### What Needs Work
- 🔄 Execution engine: run state machine, background worker patterns
- 🔄 Queueing/dispatch (dedicated queue service, not yet production)
- 🔄 Cost tracking (usage data collected, cost-modeling partial)
- 🔄 OAuth deep integration (bridging, token refresh automation)
- 🔄 Harness: full lifecycle for non-native providers
- 🔄 Notification delivery (channels exist, delivery pipeline partial)
- 🔄 Learning/memory loop (data collected, promotion logic partial)
- 🔄 Recovery automation (backup/restore exists, full automation TBD)
- 🔄 Background workers (execution worker exists, supervision TBD)

### What Is Planned
- 📋 Full queue/dispatch with PostgreSQL-backed queues
- 📋 Cost-aware routing and budget enforcement
- 📋 OAuth token lifecycle automation
- 📋 Skills runtime (executing skills in conversation context)
- 📋 Memory retrieval for conversational context
- 📋 Real-time notifications/streaming to frontend

---

## 9) Key Implementation Patterns

### 9.1 Router Pattern
```python
router = APIRouter(prefix="/admin/things", tags=["admin-things"])

@router.get("/")
def list_things(request: Request) -> list[Thing]:
    ...

@router.post("/")
def create_thing(body: ThingCreate, request: Request) -> Thing:
    ...
```

### 9.2 Service Layer Pattern
```
API route → Service class → Repository class → Database
```
Services are plain Python classes, not tied to FastAPI. Repositories use SQLAlchemy.

### 9.3 Provider Adapter Pattern
```python
class MyProviderAdapter(ProviderAdapter):
    @property
    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(streaming=True, tool_calling=True)

    def chat(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        ...  # returns ChatDispatchResult with content + usage data

    def is_ready(self) -> bool:
        ...
```

### 9.4 Error Response Pattern
```json
{
  "error": {
    "type": "specific_error_type",
    "message": "Human-readable message",
    "details": {},
    "request_id": "uuid"
  }
}
```

---

## 10) Development Commands

```bash
cd backend
pip install -e ".[dev]"    # Install with dev dependencies
pytest                      # Run all tests
ruff check .                # Lint
mypy app/                   # Type check
```

---

## 11) Release Validation

5 automated validation scripts in `scripts/`:
1. `test-backend.sh` — pytest suite
2. `test-frontend.sh` — frontend build + tests
3. `compose-smoke.sh` — docker-compose boot + health check
4. `compose-client-compat-signoff.sh` — OpenAI compat signoff
5. `compose-backup-restore-smoke.sh` — backup/restore validation

Run all: `scripts/release-validate.sh`

---

## 12) Next Development Priorities

### P0 (Current Sprint)
1. **Queue/Dispatch Service** — PostgreSQL-backed queues with proper state machine
2. **Background Worker Supervision** — worker pool with lease/renewal/garbage collection
3. **Execution Engine Hardening** — run state transitions, error recovery, operator commands

### P1 (Next Sprint)
4. **Cost Tracking + Budget Enforcement** — cost-models, budgets, circuit breakers
5. **OAuth Token Automation** — token refresh, expiry monitoring, webhook reconciliation
6. **Notification Delivery Pipeline** — outbox → channel → delivery confirmation

### P2 (Near Future)
7. **Skills Runtime** — execute skills as part of conversation/routing
8. **Memory Retrieval** — durable memory queries for conversation context
9. **Real-time Events** — WebSocket/SSE push to frontend

---

## 13) Non-Goals (For Now)

- Multi-tenant isolation (single-tenant MVP)
- Horizontal scaling / clustering
- Full Celery/Redis task queue (keep it simple with PG-based queues)
- Custom plugin SDK (plugin API exists, SDK deferred)
- Federated identity (OpenID Connect deferred)
- Full-text search (basic search exists, pgvector deferred)
- Commercial licensing / billing

---

**Project:** ForgeFrame
**Version:** Backend SPEC v1.0
**Status:** Working Application — Iterative Development
**Date:** 2026-05-01
