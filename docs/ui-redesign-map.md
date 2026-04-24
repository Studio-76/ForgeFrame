# ForgeFrame UI Redesign Map

## Productive Frontend

- Frontend root: `frontend/`
- Package manager: npm
- App entry: `frontend/src/main.tsx`
- Build script: `npm run build` (`tsc -b && vite build`)
- Framework: React 19, React Router, TypeScript, Vite
- Styling: productive CSS tokens in `frontend/src/theme/tokens.css` and shared UI styles in `frontend/src/styles/theme.css`
- Dark-mode logic: `frontend/src/theme/ThemeProvider.tsx`, dark by default with `data-theme` and `dark` class on `documentElement`

## Routes And Pages

The productive route tree remains defined in `frontend/src/main.tsx`.

- Public: `/login`
- Session gate: `/rotate-password`
- Home: `/dashboard`
- Setup: `/onboarding`, `/instances`, `/harness`, `/providers`, `/oauth-targets`, `/models`, `/provider-targets`, `/routing`, `/plugins`, `/ingress-tls`, `/release-validation`, `/recovery`
- Governance: `/accounts`, `/api-keys`, `/approvals`, `/security`, `/logs#audit-history`, `/logs#audit-export`
- Operations: `/execution`, `/queues`, `/dispatch`, `/providers#provider-health-runs`, `/health-status`, `/usage`, `/costs`, `/errors`, `/logs`
- Work Interaction: `/conversations`, `/inbox`, `/tasks`, `/reminders`, `/automations`, `/notifications`, `/agents`, `/channels`, `/contacts`, `/knowledge-sources`, `/memory`, `/learning`, `/skills`, `/assistant-profiles`, `/workspaces`, `/artifacts`
- Settings: `/settings`

## Previous Layout Structure

- `frontend/src/app/App.tsx` previously rendered a wide header and card-grid route navigation above every protected page.
- `frontend/src/app/PublicShell.tsx` rendered the signed-out shell with the same generic card/navigation styling.
- Pages use reusable ForgeFrame classes such as `fg-page`, `fg-card`, `fg-table`, `fg-pill`, `fg-grid`, `PageIntro`, `InstanceScopeCard`, and feature-specific sections.

## Target Layout Mapping

- Protected routes now run inside `frontend/src/components/layout/AppShell.tsx`.
- Sidebar navigation is grouped from the existing ForgeFrame navigation model in `frontend/src/app/navigation.ts`.
- Header search uses real ForgeFrame route metadata, not TailAdmin demo data.
- Existing page bodies keep their API calls, route loaders, outlet context, forms, tables, and business logic.
- Shared `fg-*` page classes are restyled centrally to align existing pages with the TailAdmin dark admin surface.
- Signed-out `/login` uses `PublicShell` with the same dark control-panel visual language.

## TailAdmin Donor Files Reviewed

- `reference/design/dashboard/src/App.tsx`
- `reference/design/dashboard/src/main.tsx`
- `reference/design/dashboard/src/index.css`
- `reference/design/dashboard/src/layout/AppLayout.tsx`
- `reference/design/dashboard/src/layout/AppSidebar.tsx`
- `reference/design/dashboard/src/layout/AppHeader.tsx`
- `reference/design/dashboard/src/context/SidebarContext.tsx`
- `reference/design/dashboard/src/context/ThemeContext.tsx`
- `reference/design/dashboard/src/components/header/`
- `reference/design/dashboard/src/components/common/`
- `reference/design/dashboard/src/pages/Dashboard/`
- `reference/design/dashboard/src/pages/Tables/`

## Productive Files Created Or Adapted

- `frontend/src/components/layout/AppShell.tsx`: productive TailAdmin-style protected shell.
- `frontend/src/components/layout/AppSidebar.tsx`: ForgeFrame navigation in a fixed TailAdmin-style sidebar.
- `frontend/src/components/layout/AppHeader.tsx`: command search, notification route menu, theme toggle, user menu.
- `frontend/src/components/layout/SidebarContext.tsx`: productive sidebar state, adapted from TailAdmin behavior.
- `frontend/src/components/layout/icons.tsx`: productive local icons to avoid TailAdmin SVG import issues.
- `frontend/src/components/ui/StatusBadge.tsx`: reusable TailAdmin-style status badge.
- `frontend/src/components/ui/StateBlocks.tsx`: empty, loading, error, and skeleton states.
- `frontend/src/components/ui/DataTable.tsx`: reusable data-table card component.
- `frontend/src/components/ui/DetailDrawer.tsx`: reusable right-side detail drawer.
- `frontend/src/theme/tokens.css`: TailAdmin-like dark token palette and compact radii.
- `frontend/src/styles/theme.css`: productive shell, topbar, sidebar, cards, tables, badges, dropdowns, drawer, public shell, and responsive behavior.
- `frontend/src/app/App.tsx`: protected ForgeFrame routes now render through `AppShell`.
- `frontend/src/app/PublicShell.tsx`: signed-out shell restyled into the same design system.

## Reference Dependency Rule

`reference/design/dashboard/` is donor-only. Productive code must not import from `reference/`, must not reference donor CSS at runtime, and must still build if `reference/` is removed.

Documentation may mention `reference/` for traceability. Runtime files may not.

## Risks And Follow-Ups

- The migration deliberately preserves existing page internals and uses central restyling for the first pass. Deep per-page table/action-menu rewrites can follow route by route without changing API contracts.
- The project has no dedicated `lint` script in `frontend/package.json`; build currently covers TypeScript through `tsc -b`.
- The productive frontend does not use Tailwind, so TailAdmin visual patterns were adapted to CSS tokens/classes rather than adding Tailwind v4 as a new build dependency.
