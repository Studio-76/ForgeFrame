# ForgeFrame Frontend SPEC

**Project:** ForgeFrame
**Version:** v0.2.x
**Status:** Working Application — Iterative Development
**Date:** 2026-05-01

---

## 1) Product Identity

ForgeFrame Frontend is a **React 19 single-page application (SPA)** that serves as the control-plane UI for the ForgeFrame backend. It provides 44+ lazy-loaded pages covering provider management, runtime operations, governance, work interaction, skills/memory, observability, and system administration.

**Stack:** React 19 / TypeScript 5.9 / Vite 7 / TanStack Query 5 / React Router 7

### Design Choices
- **No external UI library** — custom `fg-*` CSS design system (~2232 lines)
- **No state management library** — TanStack Query for server state, React state for UI state
- **No CSS modules** — plain global CSS with BEM-like `fg-` prefixed class names
- **Named exports only** — no default exports anywhere in the codebase
- **Lazy-loaded pages** — every page is a separate chunk via `React.lazy()`
- **Route-scoped error boundaries** — each route has its own recovery boundary

---

## 2) Architecture Overview

```
index.html
  └── main.tsx (entry, 44+ lazy routes)
       ├── ThemeProvider (dark/light)
       ├── QueryProvider (TanStack Query)
       └── RouterProvider (React Router 7)
            ├── /login → PublicShell → LoginPage
            └── / (protected) → App (AdminShell)
                 ├── /dashboard → DashboardPage
                 ├── /providers → ProvidersPage
                 ├── /conversations → ConversationsPage
                 ├── /skills → SkillsPage
                 ├── ... 44+ lazy routes
                 └── RouteErrorBoundary (wraps each route)
```

### 2.1 Route Architecture
```
createBrowserRouter([
  { path: "/login", loader: loginRouteLoader, element: <PublicShell /> },
  { path: "/", loader: protectedRouteLoader, element: <App />,
    children: [
      { index: true, element: <Navigate to="/dashboard" /> },
      { path: "dashboard", element: lazyRoute(<DashboardPage />) },
      ... 44+ lazy-loaded routes
    ]
  }
])
```

### 2.2 Data Flow
```
Page Component
  ├── useAppSession() → session context from outlet
  ├── useQuery/useMutation (TanStack Query) → API call
  │    └── src/api/admin.ts (functions + types, ~6329 lines)
  │         └── fetch() → HTTP to /admin/* or /v1/*
  └── Feature Components (under src/features/)
       └── Local state via useState/useEffect
```

---

## 3) Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React | ^19.1.1 |
| Language | TypeScript | ^5.9.2 |
| Bundler | Vite | ^7.1.5 |
| Router | React Router | ^7.9.1 |
| Server State | TanStack Query | ^5.100.7 |
| Testing | Vitest + jsdom | ^3.2.4 |
| DOM | React DOM | ^19.1.1 |

### 3.1 Dependencies (from package.json)
```
react, react-dom, react-router-dom, @tanstack/react-query
```
Dev: `typescript, vite, @vitejs/plugin-react, vitest, jsdom, @types/react, @types/react-dom`

---

## 4) Module Structure

### 4.1 Entry Point (`main.tsx`)
- Imports all 44+ pages via `React.lazy()`
- Sets up router with `createBrowserRouter`
- Wraps app in `ThemeProvider` + `QueryProvider`
- Each route wrapped in `lazyRoute()` helper (error boundary + Suspense fallback)

### 4.2 App Shell (`src/app/`)

| File | Purpose |
|---|---|
| `App.tsx` | Protected admin layout with sidebar, header, main content area |
| `PublicShell.tsx` | Unauthenticated layout (login page) |
| `navigation.ts` | Route definitions, sidebar items (~482 lines) — single source of route paths |
| `authRouting.ts` | Route loaders: `loginRouteLoader`, `protectedRouteLoader` |
| `session.ts` | `useAppSession()` hook — session from outlet context |
| `adminAccess.ts` | Permission checks for route/section visibility |
| `tenantScope.ts` | Tenant/instance scope utilities |
| `queryClient.ts` | TanStack Query client config |
| `QueryProvider.tsx` | Query context provider |
| `RouteErrorBoundary.tsx` | Per-route error boundary with retry + dashboard recovery |
| `workInteractionRoutes.ts` | Work interaction sub-routing |
| `executionReview.ts` | Execution review page utilities |
| `auditHistory.ts` | Audit history helpers |
| `useInstanceCatalog.ts` | Instance catalog hook |

### 4.3 API Layer (`src/api/`)

| File | Lines | Purpose |
|---|---|---|
| `admin.ts` | 6329 | All admin API functions + TypeScript types (canonical source) |
| `adminQueries.ts` | 1065 | TanStack Query hooks for admin endpoints |
| `runtime.ts` | — | Runtime API client (OpenAI-compatible endpoints) |
| `domain/` | 6 files | Domain barrel exports: conversations, instances, providers, routing, security |

**API Pattern:**
```typescript
// admin.ts: pure fetch functions + types
export async function getProviders(): Promise<ProviderControlItem[]> {
  const res = await fetch("/admin/providers");
  if (!res.ok) throw new ApiError(res);
  return res.json();
}

// adminQueries.ts: TanStack Query hooks
export function useProviders() {
  return useQuery({ queryKey: ["providers"], queryFn: getProviders });
}
```

### 4.4 Pages (`src/pages/` — 44 files)

Every page is a thin component that delegates to feature modules:

| Page | Feature Module | Purpose |
|---|---|---|
| `DashboardPage.tsx` | — | Health overview, system status |
| `ProvidersPage.tsx` | `features/providers/` | Provider management |
| `ConversationsPage.tsx` | `features/conversations/` | Conversation UI |
| `SkillsPage.tsx` | `features/skills/` | Skill lifecycle |
| `SecurityPage.tsx` | `features/security/` | Security settings |
| `ExecutionPage.tsx` | `features/execution/` | Run management |
| `LogsPage.tsx` | `features/logs/` | Audit log viewer |
| `UsagePage.tsx` | `features/usage/` | Usage/cost analytics |
| `OnboardingPage.tsx` | `features/onboarding/` | First-run wizard |
| `ApprovalsPage.tsx` | `features/approvals/` | Approval workflow |
| Others | inline or minimal | Models, OAuth, Ingress, Recovery, etc. |

**Full page list:** Accounts, Agents, ApiKeys, Approvals, Artifacts, AssistantProfiles, Automations, Channels, Contacts, Conversations, Costs, Dashboard, Dispatch, Errors, Execution, Harness, Health, Inbox, IngressTls, Instances, KnowledgeSources, Learning, Login, Logs, Memory, Models, Notifications, OAuthTargets, Onboarding, PasswordRotation, Plugins, Providers, ProviderTargets, Queues, Recovery, ReleaseValidation, Reminders, Routing, Security, Settings, Skills, Tasks, Usage, Workspaces

### 4.5 Feature Modules (`src/features/`)

Decomposed feature modules (pages delegate heavy logic here):

| Module | Files | Purpose |
|---|---|---|
| `providers/` | 10+ files, ~5k lines | Provider control, health, catalog, OAuth, harness |
| `conversations/` | 10 files | Conversations, messages, threads, context panels |
| `skills/` | 6 files | Skill CRUD, activation, versions, usage telemetry |
| `security/` | 3 files | Security settings, admin reset |
| `execution/` | 3 files | Run management, fabric view |
| `approvals/` | 3 files | Approval workflow |
| `logs/` | 1 file | Log viewer |
| `usage/` | 1 file | Usage and cost |
| `onboarding/` | 3 files | First-run wizard |
| `auth/` | — | Authentication helpers |

### 4.6 UI Components (`src/components/`)

| Component | Purpose |
|---|---|
| `layout/` | Sidebar, Header, Layout shell |
| `ui/` | Shared UI primitives |
| `PageIntro.tsx` | Page introduction header |
| `InstanceScopeCard.tsx` | Instance scope selector card |
| `TenantScopeCard.tsx` | Tenant scope selector card |

### 4.7 Styles (`src/styles/`)

- `theme.css` — all CSS (~2232 lines)
- Custom `fg-*` design system (no Tailwind, no CSS-in-JS)
- Dark/light theme via CSS custom properties in `ThemeProvider`

**Key CSS classes:**
```
fg-card, fg-pill, fg-grid, fg-grid-compact, fg-table,
fg-inline-form, fg-stack, fg-page, fg-muted, fg-badge,
fg-tabs, fg-modal, fg-button, fg-input, fg-select
```

### 4.8 Hooks (`src/hooks/`)

Custom hooks directory (supplements inline hooks in feature modules).

### 4.9 Store (`src/store/`)

Legacy — new code should use TanStack Query + React state only.

### 4.10 Theme (`src/theme/`)

`ThemeProvider` — dark/light mode context, persisted in localStorage.

---

## 5) Page Map (44 Routes)

| Route | Page | Feature Area |
|---|---|---|
| `/login` | LoginPage | Auth |
| `/rotate-password` | PasswordRotationPage | Security |
| `/dashboard` | DashboardPage | Dashboard |
| `/onboarding` | OnboardingPage | Setup |
| `/instances` | InstancesPage | Admin |
| `/harness` | HarnessPage | Providers |
| `/providers` | ProvidersPage | Providers |
| `/oauth-targets` | OAuthTargetsPage | Providers |
| `/models` | ModelsPage | Providers |
| `/provider-targets` | ProviderTargetsPage | Providers |
| `/routing` | RoutingPage | Routing |
| `/plugins` | PluginsPage | Extensions |
| `/ingress-tls` | IngressTlsPage | Network |
| `/release-validation` | ReleaseValidationPage | Operations |
| `/recovery` | RecoveryPage | Operations |
| `/accounts` | AccountsPage | Admin |
| `/api-keys` | ApiKeysPage | Security |
| `/approvals` | ApprovalsPage | Governance |
| `/execution` | ExecutionPage | Runtime |
| `/queues` | QueuesPage | Runtime |
| `/dispatch` | DispatchPage | Runtime |
| `/conversations` | ConversationsPage | Work Interaction |
| `/inbox` | InboxPage | Work Interaction |
| `/tasks` | TasksPage | Work Interaction |
| `/reminders` | RemindersPage | Work Interaction |
| `/automations` | AutomationsPage | Work Interaction |
| `/notifications` | NotificationsPage | Work Interaction |
| `/agents` | AgentsPage | Work Interaction |
| `/channels` | ChannelsPage | Work Interaction |
| `/contacts` | ContactsPage | Work Interaction |
| `/knowledge-sources` | KnowledgeSourcesPage | Knowledge |
| `/memory` | MemoryPage | Knowledge |
| `/learning` | LearningPage | Knowledge |
| `/skills` | SkillsPage | Knowledge |
| `/assistant-profiles` | AssistantProfilesPage | Configuration |
| `/workspaces` | WorkspacesPage | Collaboration |
| `/artifacts` | ArtifactsPage | Collaboration |
| `/security` | SecurityPage | Admin |
| `/health-status` | HealthPage | Observability |
| `/usage` | UsagePage | Observability |
| `/costs` | CostsPage | Observability |
| `/errors` | ErrorsPage | Observability |
| `/logs` | LogsPage | Observability |
| `/settings` | SettingsPage | Admin |

---

## 6) API Integration Patterns

### 6.1 API Function Pattern (in `admin.ts`)
```typescript
export async function getThings(thingId: string): Promise<Thing> {
  const res = await fetch(`/admin/things/${thingId}`);
  if (!res.ok) throw new ApiError(res);
  return res.json();
}
```

### 6.2 Query Hook Pattern (in `adminQueries.ts` or feature)
```typescript
export function useThings() {
  return useQuery({
    queryKey: ["things"],
    queryFn: getThings,
  });
}
```

### 6.3 Mutation Pattern
```typescript
export function useCreateThing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createThing,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["things"] }),
  });
}
```

### 6.4 Manual Fetch Pattern (for complex pages)
Some pages (e.g., SkillsPage) use manual `useState` + `useEffect` fetching instead of TanStack Query where the data flow is more custom.

---

## 7) State Management

| Concern | Mechanism |
|---|---|
| Server data | TanStack Query (cache + invalidation) |
| Auth session | `useAppSession()` via outlet context |
| UI state | `useState`, `useReducer` |
| Form state | Local `useState` per form |
| Theme | `ThemeProvider` context + localStorage |
| URL state | React Router params + search params |

**Rule:** No Redux, no Zustand, no external state libraries.

---

## 8) CSS / Theming

### 8.1 Design System
- All CSS in `/src/styles/theme.css` (~2232 lines)
- Custom `fg-` prefixed classes
- No CSS-in-JS, no CSS modules, no Tailwind
- Dark mode default, toggle via ThemeProvider

### 8.2 Key Class Names
```
Layout:     fg-page, fg-app, fg-sidebar, fg-header
Cards:      fg-card, fg-card-header, fg-card-body
Grids:      fg-grid, fg-grid-compact, fg-grid-3, fg-grid-4
Tables:     fg-table, fg-table-header, fg-table-row
Forms:      fg-inline-form, fg-stack, fg-field, fg-input, fg-select
Buttons:    fg-button, fg-button-primary, fg-button-danger
Pills:      fg-pill, fg-pill-success, fg-pill-warning, fg-pill-error
Badges:     fg-badge, fg-tag
Modals:     fg-modal, fg-modal-backdrop
Tabs:       fg-tabs, fg-tab, fg-tab-active
Muted:      fg-muted
```

---

## 9) Testing Strategy

**Frontend tests:** `frontend/tests/` — 51 test files, ~22k lines

Tests use `createRoot` (real DOM rendering), NOT React Testing Library:

```typescript
import { createRoot } from "react-dom/client";

it("renders without crashing", () => {
  const div = document.createElement("div");
  const root = createRoot(div);
  root.render(<Component />);
  root.unmount();
});
```

**API mocking pattern:** `vi.mock("../../api/admin")` at module level.

**Test coverage by page area:**
- Auth: login-page, password-rotation (3 files)
- Dashboard: dashboard-page, navigation, sidebar (3 files)
- Providers: providers-page, provider-targets, oauth-targets (4 files)
- Runtime: execution-page, dispatch-page, queues-page (3 files)
- Observability: costs, errors, logs, usage (4 files)
- Work interaction: conversations, inbox, tasks (2 files)
- Knowledge: skills, learning, knowledge-memory (3 files)
- Admin: instances (2 files), accounts, api-keys, settings, approvals (5 files)
- Infrastructure: navigation, header, auth-routing, route-error-boundary (5 files)
- Security: security, password-rotation-gate, admin-reset (4 files)
- Onboarding, ingress, harness, plugins, recovery, release-validation (6 files)
- Governance (2 files)

**Run tests:** `npm test` from `frontend/` directory.

---

## 10) Development Commands

```bash
cd frontend
npm install              # Install dependencies
npm run dev              # Start Vite dev server
npm run typecheck        # TypeScript check (tsc --noEmit)
npm test                 # Run all tests (vitest run)
npm run build            # Production build (tsc + vite build)
npx vitest run tests/skills-page.test.tsx  # Single test file
```

---

## 11) Key Implementation Patterns

### 11.1 Page Component Pattern
```typescript
export function MyPage(): React.ReactElement {
  const { session } = useAppSession();
  const { data, isLoading, error } = useQuery(...);
  
  if (isLoading) return <LoadState>loading</LoadState>;
  if (error) return <LoadState>error</LoadState>;
  
  return <section className="fg-page">...</section>;
}
```

### 11.2 Feature Module Pattern
```
features/my-feature/
├── index.ts          # barrel exports
├── types.ts          # form types, constants
├── utils.ts          # formatting, label helpers
├── MyFeatureList.tsx  # list component
├── MyFeatureDetail.tsx # detail component
├── MyFeatureForm.tsx   # form component
└── useMyFeature.ts     # hook (queries + mutations)
```

### 11.3 Error Handling Pattern
```typescript
<RouteErrorBoundaryView>
  <Suspense fallback={<RouteModuleFallback />}>
    <MyPage />
  </Suspense>
</RouteErrorBoundaryView>
```

### 11.4 LoadState Pattern
```typescript
type LoadState = "idle" | "loading" | "success" | "error";
```

### 11.5 Access Control Pattern
```typescript
const { canRead, canMutate } = getWorkInteractionAccess(session);
```

---

## 12) Current Development Status

### What Works
- ✅ 44 routes all lazy-loaded with error boundaries
- ✅ Provider management (list, configure, health, catalog)
- ✅ Conversation UI (list, messages, threads, context)
- ✅ Skills CRUD with versions, activation, usage telemetry
- ✅ Admin pages (instances, accounts, API keys, settings)
- ✅ Security (login, password rotation, admin gates)
- ✅ Observability (logs, usage, costs, errors, health)
- ✅ Work interaction (inbox, tasks, reminders, notifications)
- ✅ Runtime monitoring (execution, queues, dispatch)
- ✅ Workspace and artifact management
- ✅ Knowledge (memory, learning, knowledge sources)
- ✅ Network (ingress/TLS, OAuth targets)
- ✅ Recovery, release validation, plugins
- ✅ Dashboard with aggregated health overview
- ✅ Dark/light theme
- ✅ 51 test files covering all page modules

### What Needs Work
- 🔄 Real-time updates (no WebSocket/SSE push to frontend yet)
- 🔄 Mobile/responsive layout (desktop-first currently)
- 🔄 Loading states refinement (some pages have basic loading skeletons)
- 🔄 Error states: consistent error recovery flows across all pages
- 🔄 Form validation: client-side validation could be stronger
- 🔄 Accessibility: keyboard navigation, screen reader support
- 🔄 Feature module decomposition: some pages still have heavy inline logic

### What Is Planned
- 📋 Real-time notification stream (WebSocket)
- 📋 Responsive/mobile layout support
- 📋 Advanced filtering and search on list pages
- 📋 Guided tours for new users
- 📋 Keyboard shortcut system
- 📋 Export/download for observability data

---

## 13) Non-Goals (For Now)

- SSR/SSG (SPA is sufficient for control-plane use case)
- PWA (no offline support needed)
- i18n (English-only MVP)
- Complex animations/transitions (keep it snappy, not fancy)
- Third-party component libraries (no MUI, Chakra, shadcn)
- Micro-frontends (single SPA deployment)

---

## 14) Next Development Priorities

### P0 (Current Sprint)
1. **Real-time notifications** — WebSocket connection for live updates
2. **Mobile/responsive** — ensure sidebar + tables work on smaller screens

### P1 (Next Sprint)
3. **Feature decomposition** — move remaining inline page logic into `features/`
4. **Loading/error state consistency** — unified patterns for all 44 pages
5. **Search/filter on list pages** — consistent search UX across providers, conversations, logs

### P2 (Near Future)
6. **Keyboard shortcuts** — global and page-level shortcuts
7. **Better form UX** — validation feedback, confirmation dialogs
8. **Data export** — CSV/JSON export for usage, logs, audit trails

---

**Project:** ForgeFrame
**Version:** Frontend SPEC v1.0
**Status:** Working Application — Iterative Development
**Date:** 2026-05-01
