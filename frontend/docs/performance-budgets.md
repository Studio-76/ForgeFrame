# ForgeFrame Frontend Performance & Bundle-Size Budgets

## Current Baseline (May 2026)

| Metric | Measured | Budget | Status |
|--------|----------|--------|--------|
| **Initial JS payload (gzipped)** | ~162 kB | ≤200 kB gz | ✅ |
| **App shell chunk (index.js)** | 77 kB raw / 24 kB gz | ≤100 kB / ≤35 kB gz | ✅ |
| **Vendor React chunk** | 193 kB raw / 60 kB gz | ≤200 kB / ≤65 kB gz | ✅ |
| **Vendor libs chunk** | 179 kB raw / 55 kB gz | ≤200 kB / ≤60 kB gz | ✅ |
| **Largest page chunk (SecurityPage)** | 73 kB raw / 16 kB gz | ≤100 kB / ≤25 kB gz | ✅ |
| **CSS output** | 263 kB / 33 kB gz | ≤300 kB / ≤40 kB gz | ✅ |
| **Total modules transformed** | 1601 | ≤2500 | ✅ |
| **Build time** | <4s | ≤10s | ✅ |
| **Eagerly loaded routes** | 0 (all 49 lazy) | ≥45 lazy | ✅ |
| **Heavy DataTable chunk** | 12 kB raw / 4 kB gz | ≤20 kB / ≤6 kB gz | ✅ |

## Key Constraints

### Initial Payload
- Total initial JS (all vendor chunks + app shell, gzipped) MUST stay ≤200 kB.
- No third-party library over 300 kB raw (unminified) may be added without team review.
- The app shell MUST NOT eagerly import any page-level or feature-level code.

### Route Chunks
- Every route MUST use `React.lazy()` — no eagerly loaded page modules.
- No route chunk should exceed 100 kB raw / 25 kB gzipped.
- If a page exceeds this, split it into sub-chunks using `lazy()` for heavy sub-components.

### Data Display
- `@tanstack/react-table` must remain in a shared vendor chunk (never duplicated per route).
- The DataTable wrapper component should stay ≤20 kB raw.
- Table row renderers must not perform heavy synchronous work (JSON.stringify, complex date formatting) on every render — memoize or defer.

### CSS
- CSS output (lightningcss minified) must stay ≤300 kB raw / ≤40 kB gzipped.
- Page-specific CSS files are acceptable but should not duplicate shared patterns.
- Tailwind content scanning scope must be restricted to `src/` to avoid purging false positives.

## Bundle Analysis

Run the bundle analyzer before any significant dependency change:

```bash
VISUALIZE=1 npm run build
open dist/stats.html
```

## CI Guard (Planned)

A future CI step should:
1. Parse production build output.
2. Compare each chunk against the budgets above.
3. Fail the build if any budget is exceeded.
4. Print a summary of each chunk's raw and gzipped size.

## Notes

- Initial JS payload increased from 135 kB to 162 kB gzipped when introducing explicit `manualChunks` for vendor splitting. This is a deliberate tradeoff: four separate vendor chunks with excellent cache residency vs. one monolithic chunk that invalidates on every code change.
- The app shell chunk dropped from 424 kB to 77 kB (82% reduction) — this means faster time-to-interactive for returning users whose browser has cached the vendor chunks.
- All 49 application routes are lazy-loaded. No route code is included in the initial bundle.
- Bundle analyzer is opt-in (`VISUALIZE=1`) and excluded from production dependencies.
