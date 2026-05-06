# ForgeFrame Frontend Performance & Bundle-Size Budgets

## Hard-Optimize II Baseline (2026-05-06)

Measured from `npm run build` before implementation changes for task
`7a285cf9-70f8-465d-a6ae-e897bd0d698e`.

| Metric | Baseline |
|--------|----------|
| Build time | 4.39s wall time (`vite build`: 3.93s) |
| Transformed modules | 1601 |
| Total JS | 1,969.63 kB raw / 540.57 kB gzip / 472.71 kB brotli |
| Initial JS payload | 502.76 kB raw / 157.38 kB gzip / 137.48 kB brotli |
| CSS payload | 263.19 kB raw / 32.47 kB gzip / 26.89 kB brotli |
| Image assets | 31.82 kB raw |
| Eagerly loaded route modules | 0 application pages; app shell only |

Initial JS baseline includes `index`, `vendor-react`, `vendor-libs`, and
`vendor-aria`. Route modules are loaded through `React.lazy()`.

### Largest baseline JS chunks

| Chunk | Raw | Gzip | Brotli |
|-------|-----|------|--------|
| `vendor-react` | 192.92 kB | 60.33 kB | 52.08 kB |
| `vendor-libs` | 178.77 kB | 54.72 kB | 48.71 kB |
| `index` | 77.53 kB | 24.20 kB | 20.54 kB |
| `SecurityPage` | 72.83 kB | 16.31 kB | 14.08 kB |
| `vendor-aria` | 53.55 kB | 18.14 kB | 16.15 kB |
| `MemoryPage` | 52.38 kB | 11.65 kB | 9.96 kB |
| `ExecutionPage` | 49.01 kB | 11.65 kB | 10.15 kB |
| `LogsPage` | 48.35 kB | 11.60 kB | 10.24 kB |

### Baseline runtime observations

- The app shell imported the domain API barrel through `App.tsx` and
  `adminQueries.ts`, so non-route API modules could be considered by the
  initial chunk graph.
- `AdvancedDiagnostics` kept diagnostic children mounted while collapsed;
  `RawJson`, `PayloadViewer`, and `RawLog` could still perform formatting work
  before the operator expanded the panel.
- `DataTable` paginated rows but still performed per-cell column lookups during
  render and relied on callers to keep column definitions stable.
- Zustand stores were present and limited to UI/client state; table expansion
  used `Set` values, which were less selector-friendly than plain records.
- The opt-in analyzer command failed at baseline because Vite's ESM config used
  a dynamic `require()` for `vite-bundle-analyzer`.

## Budgets

| Metric | Budget | Enforcement |
|--------|--------|-------------|
| Initial JS payload | ≤ 510 kB raw / ≤ 160 kB gzip | `npm run size:check` |
| App shell chunk | ≤ 85 kB raw / ≤ 27 kB gzip | `npm run size:check` |
| Largest single JS chunk | ≤ 205 kB raw / ≤ 65 kB gzip | `npm run size:check` |
| Route chunk size | ≤ 100 kB raw / ≤ 25 kB gzip | `npm run size:check` |
| CSS payload | ≤ 300 kB raw / ≤ 40 kB gzip | `npm run size:check` |
| Eagerly loaded route modules | 0 page modules in app shell | PR checklist |
| Heavy table render | ≤ 100 visible rows per page without virtualization | PR checklist |

## Bundle Analysis

Generate a static analyzer report when changing dependencies, routes, page
templates, table primitives, or diagnostics rendering:

```bash
npm run analyze
```

The analyzer report is written to `dist/stats.html` and is not committed.

## PR Performance Checklist

- [ ] Production build passes and `npm run size:check` stays within budget.
- [ ] New pages use route-level `React.lazy()` and do not enter the app shell.
- [ ] Raw JSON, evidence, logs, and diagnostics render only after expansion.
- [ ] TanStack Query hooks use stable keys, `enabled` for deferred data, and
      realistic `staleTime`/`gcTime` settings.
- [ ] Zustand subscriptions use selectors and do not duplicate server cache.
- [ ] Table columns are stable; expensive cell formatting is memoized or
      deferred.

## Final Report

Measured from final `npm run build` after implementation.

| Metric | Baseline | Final | Delta |
|--------|----------|-------|-------|
| Vite build time | 3.93s | 3.78s | -0.15s |
| Transformed modules | 1601 | 1602 | +1 |
| Total JS | 1,969.63 kB raw / 540.57 kB gzip | 1,966.44 kB raw / 541.17 kB gzip | -3.19 kB raw / +0.60 kB gzip |
| Initial JS payload | 502.76 kB raw / 157.38 kB gzip | 487.26 kB raw / 152.41 kB gzip | -15.50 kB raw / -4.97 kB gzip |
| App shell chunk | 77.53 kB raw / 24.20 kB gzip | 62.02 kB raw / 19.23 kB gzip | -15.51 kB raw / -4.97 kB gzip |
| Largest route chunk | `SecurityPage`, 72.83 kB raw / 16.31 kB gzip | `SecurityPage`, 72.93 kB raw / 16.36 kB gzip | +0.10 kB raw / +0.05 kB gzip |
| CSS payload | 263.19 kB raw / 32.47 kB gzip | 263.19 kB raw / 32.47 kB gzip | unchanged |

### Implemented changes

- Moved admin query keys into `src/api/adminKeys.ts` so the app shell can use
  session query keys without importing `adminQueries` and the domain API graph.
- Switched `App.tsx` to direct auth-domain imports and lazy-loaded `LoginPage`.
- Split UX Review Mode behind a development-only dynamic import, keeping review
  tooling out of the production initial route load.
- Fixed opt-in bundle analysis by using an ESM-safe `vite-bundle-analyzer`
  import and added `npm run analyze`.
- Added `npm run size:check` with raw/gzip guards for initial JS, app shell,
  largest JS, route chunks, and CSS.
- Deferred `AdvancedDiagnostics` and nested `DiagnosticSection` children until
  expansion; `RawJson`, `PayloadViewer`, and `RawLog` now memoize formatting.
- Added `enabled` gates for audit history/detail queries and memoized log audit
  filters to avoid avoidable hidden-section fetch churn.
- Converted table expanded-row Zustand state from `Set` values to plain records
  and kept tests aligned with the selector-friendly store shape.
- Reduced DataTable per-cell work by memoizing visible column IDs and column
  class lookup maps instead of scanning column definitions for each cell.

### Bundle analyzer

`npm run analyze` now succeeds and writes the static report to
`dist/stats.html`. Normal production builds do not generate or open the report.

### Intentional tradeoffs

- Table virtualization was not added: the shared DataTable paginates to at most
  100 visible rows and the measured DataTable chunk remains ~12.35 kB raw.
- Vendor chunks were kept stable because React, TanStack, Zustand, and React Aria
  cache as long-lived dependencies; the improvement target was the app shell.
- CSS was left unchanged because the minified output stayed within budget and no
  duplicate rule cluster exceeded the current size guard.
