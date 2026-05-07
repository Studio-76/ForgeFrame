# ForgeFrame Frontend Performance & Bundle-Size Budgets

## Hard-Optimize II Continuation Baseline (2026-05-06)

Measured from a clean `npm run build` before the continuation changes for task
`7a285cf9-70f8-465d-a6ae-e897bd0d698e`.

| Metric | Baseline |
|--------|----------|
| Build time | 4.68s wall time (`vite build`: 3.92s) |
| Transformed modules | 1602 |
| Total JS | 1,966.44 kB raw / 542.25 kB gzip |
| Initial JS payload | 487.26 kB raw / 152.69 kB gzip |
| App shell chunk | 62.02 kB raw / 19.26 kB gzip |
| CSS payload | 263.19 kB raw / 32.47 kB gzip |
| Image assets | 31.82 kB raw |
| Eagerly loaded route modules | 0 application pages; app shell only |

Initial JS baseline includes `index`, `vendor-react`, `vendor-libs`, and
`vendor-aria` because those chunks were referenced by `dist/index.html`.

### Largest baseline JS chunks

| Chunk | Raw | Gzip |
|-------|-----|------|
| `vendor-react` | 192.92 kB | 60.47 kB |
| `vendor-libs` | 178.77 kB | 54.81 kB |
| `SecurityPage` | 72.93 kB | 16.41 kB |
| `index` | 62.02 kB | 19.26 kB |
| `vendor-aria` | 53.55 kB | 18.16 kB |
| `MemoryPage` | 52.46 kB | 11.73 kB |
| `ExecutionPage` | 49.12 kB | 11.74 kB |
| `LogsPage` | 48.46 kB | 11.70 kB |

### Baseline runtime observations

- `vendor-libs` mixed app-shell dependencies (React Router, TanStack Query,
  Zustand) with route-only TanStack Table code, so table bytes were preloaded
  before any table route was visited.
- Security posture disclosures mounted key/value detail bodies while collapsed.
- Security remediation split active/passed checks with repeated array filters,
  and the posture overview filtered requests, sessions, and users repeatedly.
- Route-level `React.lazy()` and the opt-in analyzer were already present; the
  continuation pass focused on chunk residency and collapsed-render cost.

## Budgets

| Metric | Budget | Enforcement |
|--------|--------|-------------|
| Initial JS payload | ≤ 510 kB raw / ≤ 160 kB gzip | `npm run size:check` |
| App shell chunk | ≤ 85 kB raw / ≤ 27 kB gzip | `npm run size:check` |
| Largest single JS chunk | ≤ 205 kB raw / ≤ 65 kB gzip | `npm run size:check` |
| Largest non-initial chunk | ≤ 100 kB raw / ≤ 25 kB gzip | `npm run size:check` |
| CSS payload | ≤ 300 kB raw / ≤ 40 kB gzip | `npm run size:check` |
| Eagerly loaded route modules | 0 page modules in app shell | PR checklist |
| Heavy table render | ≤ 100 visible rows per page without virtualization | PR checklist |

`npm run size:check` reads `dist/index.html` and only counts the JavaScript
entry plus modulepreload links as initial JS. Route-only vendor chunks, such as
`vendor-table`, are checked as non-initial chunks instead of being treated as
app-shell bytes. The command prints the largest non-initial chunk and fails if
any non-initial chunk exceeds the raw or gzip budget.

## Bundle Analysis

Generate a static analyzer report when changing dependencies, routes, page
templates, table primitives, or diagnostics rendering:

```bash
npm run analyze
```

The analyzer report is written to `dist/stats.html` and is not committed. The
final analyzer run for this pass completed successfully with the split vendor
chunks visible in the report.

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
| Vite build time | 3.92s | 3.87s | -0.05s |
| Transformed modules | 1602 | 1602 | unchanged |
| Total JS | 1,966.44 kB raw / 542.25 kB gzip | 1,970.89 kB raw / 543.76 kB gzip | +4.45 kB raw / +1.51 kB gzip |
| Initial JS payload | 487.26 kB raw / 152.69 kB gzip | 434.46 kB raw / 139.38 kB gzip | -52.80 kB raw / -13.31 kB gzip |
| App shell chunk | 62.02 kB raw / 19.26 kB gzip | 62.49 kB raw / 19.30 kB gzip | +0.47 kB raw / +0.04 kB gzip |
| Largest route chunk | `SecurityPage`, 72.93 kB raw / 16.41 kB gzip | `SecurityPage`, 73.32 kB raw / 16.64 kB gzip | +0.39 kB raw / +0.23 kB gzip |
| CSS payload | 263.19 kB raw / 32.47 kB gzip | 263.19 kB raw / 32.47 kB gzip | unchanged |

### Implemented changes

- Split the old `vendor-libs` chunk into `vendor-router`, `vendor-query`,
  `vendor-state`, and route-loaded `vendor-table` chunks. TanStack Table is no
  longer preloaded by the HTML entry.
- Updated the bundle budget guard to parse `dist/index.html`, so initial JS is
  measured from actual Vite entry/preload output instead of every `vendor-*`
  asset.
- Deferred Security page collapsed detail bodies until first expansion,
  including bootstrap, privileged identity pressure, credential policy details,
  and passed remediation checks.
- Memoized Security page remediation grouping and combined posture counts into
  one pass over requests, sessions, and users.

### Intentional tradeoffs

- Total JS increased slightly because finer vendor splitting adds small chunk
  wrappers; the app shell still loads 52.80 kB less raw JavaScript.
- `vendor-aria` remains in the app shell because navigation and UI primitives
  use React Aria/Stately in shell chrome.
- Table virtualization was not added: the shared DataTable still paginates to at
  most 100 visible rows, and the route-loaded `vendor-table` chunk is within the
  non-initial chunk budget.
- Security page remains the largest route chunk; this pass reduced initial
  payload and collapsed-render work without moving security tab modules or
  changing visible behavior.
