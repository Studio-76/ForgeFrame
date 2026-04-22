# Frontend Visual System Inventory

## Objective

Inventory the current theme tokens, CSS utilities, and reusable UI primitives in the ForgeGate control-plane frontend so the visual-system v0 can map directly onto existing implementation seams.

## FOR-75 Consolidation Update

- `frontend/src/main.tsx` now imports `frontend/src/theme/index.css` as the single theme entrypoint.
- `frontend/src/theme/tokens.css` is the transition-layer source of truth for semantic theme tokens and legacy aliases.
- `frontend/src/styles/theme.css` now consumes that token layer for shared surfaces, controls, spacing, focus treatment, warning badges, and reduced-motion handling instead of carrying raw color literals.
- First-pass style scatter reduction landed in the shared shell plus `DashboardPage`, `UsagePage`, `LogsPage`, `ProvidersPage`, and `ProvidersSections`.
- Remaining high-churn styling areas that should stay out of the first rollout slice: `LoginPage.tsx`, `AccountsPage.tsx`, `ApiKeysPage.tsx`, `SecurityPage.tsx`, `OnboardingPage.tsx`, and `SettingsPage.tsx`.

## Current Theme Contract

### Theme mode wiring

- `frontend/src/main.tsx` wraps the router in `ThemeProvider`.
- `frontend/src/theme/ThemeProvider.tsx` persists `dark` and `light` mode in `localStorage` and applies the active mode through `document.documentElement.dataset.theme`.
- `frontend/src/app/App.tsx` is the only consumer of `useTheme`; theme switching is exposed from the app shell, not from a reusable settings or shell primitive.

### CSS variable inventory

`frontend/src/styles/theme.css` defines a single global token layer with dark and light variants:

| Token | Intent today |
| --- | --- |
| `--bg` | page background |
| `--bg-surface` | top layer of card gradients |
| `--bg-panel` | lower layer of card gradients |
| `--text` | default foreground text |
| `--text-muted` | secondary text |
| `--border` | shared border color |
| `--accent` | links and active emphasis |
| `--accent-soft` | filled button/nav state background |
| `--danger` | error/destructive text |
| `--success` | positive status text |
| `--shadow` | card elevation |

### Token gaps

The current token layer does not define:

- spacing tokens
- radius tokens
- typography scale or font tokens beyond the body stack
- focus-ring, outline, or accessibility-state tokens
- warning/info state tokens
- motion, duration, or easing tokens
- layout/container breakpoints
- semantic elevation tiers beyond one shared shadow

Several component colors still bypass the token layer with hard-coded `rgba(...)` values in `theme.css` for subcards, KPI tiles, pills, inputs, and `pre` blocks. That means the color contract is only partially tokenized.

## Reusable Styling Primitives

### Global CSS utilities

The current reusable layer is CSS-first and lives entirely in `frontend/src/styles/theme.css`.

| Utility | Current role | Dependencies |
| --- | --- | --- |
| `.fg-shell` | app-width container | `max-width`, fixed page padding |
| `.fg-card` | primary panel surface | `--border`, `--bg-surface`, `--bg-panel`, `--shadow` |
| `.fg-subcard` | nested panel | `--border`, hard-coded translucent fill |
| `.fg-kpi` / `.fg-kpi-value` | metric tile treatment | `--border`, hard-coded translucent fill |
| `.fg-row` | flex row with wrap | fixed gap/alignment |
| `.fg-stack` | vertical grid stack | fixed gap |
| `.fg-grid` | responsive two-plus column grid | fixed `minmax(260px, 1fr)` |
| `.fg-grid-compact` | compact grid variant | fixed `minmax(180px, 1fr)` |
| `.fg-card-grid` | responsive card collection | fixed `minmax(280px, 1fr)` |
| `.fg-panel-heading` | header row for cards/sections | fixed spacing/alignment |
| `.fg-actions` | action row | fixed spacing/alignment |
| `.fg-pill` | status badge shell | `--border` plus hard-coded status backgrounds |
| `.fg-list` | dense list spacing | fixed padding/gap |
| `.fg-detail-grid` | stacked metadata rows | fixed gap |
| `.fg-inline-form` | inline form layout | fixed gap and control basis |
| `.fg-note` | accent callout | `--accent` |
| `.fg-muted` / `.fg-danger` | text tone utilities | `--text-muted`, `--danger` |

### React-level reusable primitives

Only the providers surface currently promotes page markup into reusable React primitives:

- `SectionCard`
- `MetricTile`
- `TonePill`
- `ReadinessAxisPills`
- `HarnessProfileCard`

These live inside `frontend/src/features/providers/ProvidersSections.tsx`. They are effective local primitives, but they are not exported from a shared `components/` or `ui/` layer, and their styling contract still depends on the global utility classes rather than a stronger component API.

### Application shell primitives

The application shell exists, but it is still monolithic:

- `frontend/src/app/App.tsx` owns header, session banner, theme toggle, logout action, and nav.
- `frontend/src/main.tsx` owns the route list and shell mounting.

There is no reusable shell decomposition yet for:

- header/banner
- nav section
- page header
- content section wrapper
- global empty/loading/error state

## Page-Level Composition Inventory

### Stable seams

These are the most implementation-ready seams for the visual-system rollout:

| Seam | Current files | Why it is stable enough to target first |
| --- | --- | --- |
| Theme mode contract | `frontend/src/theme/ThemeProvider.tsx`, `frontend/src/styles/theme.css` | Single source for dark/light mode switching today |
| App shell and nav | `frontend/src/app/App.tsx` | Every route inherits this shell |
| Providers page sections | `frontend/src/pages/ProvidersPage.tsx`, `frontend/src/features/providers/ProvidersSections.tsx` | Only surface already composed from section-level primitives |
| Global utility layer | `frontend/src/styles/theme.css` | All pages depend on it already |

### Repeated but not yet stabilized patterns

The following patterns recur across pages, but they are still page-local markup:

- page heading + muted intro copy
- top-of-page error message
- one-off action/form card
- repeated card grids for lists and metrics
- raw `<ul>` / `<li>` data dumps for key-value operational data
- inline action buttons embedded inside list rows

Representative page-local implementations:

- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/pages/UsagePage.tsx`
- `frontend/src/pages/SecurityPage.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/AccountsPage.tsx`
- `frontend/src/pages/ApiKeysPage.tsx`
- `frontend/src/pages/OnboardingPage.tsx`
- `frontend/src/pages/SettingsPage.tsx`

## High-Churn And Inconsistent Areas

### 1. Inline spacing and sizing are still dominant

The frontend currently contains 58 inline style blocks:

| File | Inline style count |
| --- | ---: |
| `frontend/src/features/providers/ProvidersSections.tsx` | 19 |
| `frontend/src/pages/UsagePage.tsx` | 17 |
| `frontend/src/pages/SecurityPage.tsx` | 6 |
| `frontend/src/app/App.tsx` | 4 |
| `frontend/src/pages/DashboardPage.tsx` | 3 |
| `frontend/src/pages/OnboardingPage.tsx` | 2 |
| `frontend/src/pages/LoginPage.tsx` | 2 |
| `frontend/src/pages/ApiKeysPage.tsx` | 2 |
| `frontend/src/pages/SettingsPage.tsx` | 1 |
| `frontend/src/pages/LogsPage.tsx` | 1 |
| `frontend/src/pages/AccountsPage.tsx` | 1 |

This is the clearest signal that spacing and layout are not yet codified as tokens or components.

### 2. Providers is ahead of the rest of the app

The providers surface has section-level composition and domain-specific presentation primitives, while the rest of the app is still direct page markup on top of `.fg-card`, `.fg-grid`, and `.fg-row`. That split makes providers the best prototype surface for shared primitives, but it also means rollout decisions cannot assume the same maturity everywhere else.

### 3. Status semantics are inconsistent

- Providers uses `TonePill` plus explicit tone mapping.
- Other pages mostly render status as plain text inside paragraphs and lists.
- Error handling is visible but inconsistent: pages generally render `fg-danger` text, while success/info states have no shared banner component.

### 4. Cards are overloaded

`.fg-card` is used for:

- full page sections
- metric tiles
- forms
- login panel
- navigation-adjacent actions in the app shell

The theme toggle and logout button in `App.tsx` even apply `.fg-card` directly to `<button>` elements, which blurs the boundary between surface and control primitives.

### 5. Data-heavy pages still use raw lists

`UsagePage`, `DashboardPage`, and `SecurityPage` still present a large amount of operational data through unstructured `<ul>` / `<li>` output. That is functional, but it is the area most likely to churn when the visual system introduces table, description-list, empty-state, and alert patterns.

## Recommended Stabilization Order For Visual-System v0

### 1. Stabilize the token contract first

Expand the global token layer before styling component migrations:

- semantic surface tokens for shell, card, subcard, and field backgrounds
- spacing scale
- radius scale
- typography roles for page title, section title, body, label, and metric values
- state tokens for success, danger, warning, info, focus, and disabled
- elevation tokens beyond a single shared shadow

This should happen in `frontend/src/styles/theme.css` without changing route behavior.

### 2. Extract cross-page shell and section primitives

Promote the shell pieces currently buried in `App.tsx` into reusable primitives:

- `AppShell`
- `AppHeader`
- `PrimaryNav`
- `PageHeader`
- `PageSection`

Those seams will let design decisions land once and propagate across every route.

### 3. Formalize the first shared UI primitive set

Use the providers surface as the starting point, but move the abstractions into shared frontend infrastructure:

- `Card`
- `Subcard`
- `MetricTile`
- `StatusBadge`
- `ActionRow`
- `Stack`
- `ResponsiveGrid`
- `InlineForm`
- `MessageBanner`
- `KeyValueList` or `DefinitionList`

### 4. Migrate the highest-churn pages next

Recommended rollout order after primitives exist:

1. `frontend/src/features/providers/ProvidersSections.tsx`
2. `frontend/src/pages/UsagePage.tsx`
3. `frontend/src/pages/DashboardPage.tsx`
4. `frontend/src/pages/SecurityPage.tsx`
5. `frontend/src/pages/LoginPage.tsx`

Rationale:

- providers already has section abstractions and will validate the shared component API quickly
- usage has the most inline layout churn outside providers
- dashboard and security are high-visibility operator surfaces with repeated metric/list patterns
- login should inherit the same card/form/banner system once it exists

## Implementation Handoff Notes For FOR-13

- Treat `frontend/src/styles/theme.css` as the current source of truth for token entry points, but not as a complete design-token system.
- Treat `frontend/src/features/providers/ProvidersSections.tsx` as the best seedbed for shared primitives because it already has local abstractions.
- Do not design against a nonexistent component library; most routes still need first-generation primitive extraction.
- Expect list-heavy operational surfaces to require new components, not only repainting existing markup.
- Plan the v0 rollout so token stabilization lands before broad page rewrites. Otherwise, the same pages will churn twice.
