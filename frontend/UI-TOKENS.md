# ForgeFrame Design Tokens & UI Guide

## Overview

ForgeFrame uses a **dark-first, light-capable** design system centered on CSS custom properties. Tailwind CSS v4 is configured to consume the same token values so utility classes produce correct ForgeFrame visuals.

### Core principles

- **Dark control-plane aesthetic** — deep navy canvas (`#0b101b`), subtle glow effects, thin borders
- **No external UI library** — no MUI, Chakra, shadcn/ui, or Radix
- **Token-driven** — every color, spacing, radius, and font comes from shared variables
- **Two CSS systems coexist** — legacy `fg-*` / `ff-*` classes AND Tailwind utilities

---

## Token reference

Tokens live in two places that must be kept in sync:

| File | Purpose |
|------|---------|
| `src/theme/tokens.css` | CSS custom properties consumed by legacy classes |
| `src/theme/tailwind.css` | `@theme` block consumed by Tailwind utilities |

### Background / surface levels

| Token | Value (dark) | Value (light) | Tailwind utility |
|-------|-------------|---------------|------------------|
| `canvas` | `#0b101b` | `#f5f7fb` | `bg-canvas` |
| `surface` | `#111827` | `#ffffff` | `bg-surface` |
| `surface-strong` | `#0f172a` | `#f8fafc` | `bg-surface-strong` |
| `surface-subtle` | `#1f2937` | `#f1f5f9` | `bg-surface-subtle` |
| `surface-field` | `#111827` | `#ffffff` | `bg-surface-field` |
| `surface-code` | `#020617` | `#eef2ff` | `bg-surface-code` |

### Text

| Token | Value (dark) | Value (light) | Tailwind utility |
|-------|-------------|---------------|------------------|
| `primary` | `#f8fafc` | `#0f172a` | `text-primary` |
| `muted` | `#94a3b8` | `#667085` | `text-muted` |

### Border

| Token | Value (dark) | Value (light) | Tailwind utility |
|-------|-------------|---------------|------------------|
| `border` | `rgba(148, 163, 184, 0.18)` | `rgba(15, 23, 42, 0.12)` | `border-border` |

### Accent (primary action)

| Token | Value | Tailwind utility |
|-------|-------|------------------|
| `accent` | `#465fff` | `bg-accent`, `text-accent`, `border-accent` |
| `accent-soft` | `rgba(70, 95, 255, 0.14)` | `bg-accent-soft` |

### Status colors

| Token | Value (dark) | Value (light) | Tailwind utility |
|-------|-------------|---------------|------------------|
| `success` | `#32d583` | `#027a48` | `text-success`, `bg-success` |
| `warning` | `#fdb022` | `#b54708` | `text-warning`, `bg-warning` |
| `danger` | `#f97066` | `#b42318` | `text-danger`, `bg-danger` |
| `info` | `#53b1fd` | `#026aa2` | `text-info`, `bg-info` |

Each status also has `*-soft` and `*-border` variants for backgrounds and border treatments.

### Focus ring

| Token | Value | Tailwind utility |
|-------|-------|------------------|
| `focus-ring` | `#84caff` | `ring-focus-ring` (via `ring` utility) |

### Spacing scale

| Token | rem | px | Tailwind utility |
|-------|-----|----|------------------|
| `--fg-space-1` | 0.25 | 4 | `p-1`, `m-1`, `gap-1` |
| `--fg-space-2` | 0.50 | 8 | `p-2`, `m-2`, `gap-2` |
| `--fg-space-3` | 0.75 | 12 | `p-3`, `m-3`, `gap-3` |
| `--fg-space-4` | 1.00 | 16 | `p-4`, `m-4`, `gap-4` |
| `--fg-space-5` | 1.50 | 24 | `p-5`, `m-5`, `gap-5` |
| `--fg-space-6` | 2.00 | 32 | `p-6`, `m-6`, `gap-6` |
| `--fg-space-7` | 2.50 | 40 | `p-7`, `m-7`, `gap-7` |

### Border radius

| Token | Value | Tailwind utility |
|-------|-------|------------------|
| `--radius-sm` | 0.25rem (4px) | `rounded-sm` |
| `--radius-md` | 0.375rem (6px) | `rounded-md` |
| `--radius-lg` | 0.5rem (8px) | `rounded-lg` |
| `--radius-pill` | 999px | `rounded-pill` |

### Typography

| Token | Value | Tailwind utility |
|-------|-------|------------------|
| `--font-sans` | Inter, system-ui, ... | `font-sans` |
| `--font-mono` | ui-monospace, SF Mono, ... | `font-mono` |
| `--fg-type-size-body` | 0.9375rem | `text-body` |
| `--fg-type-size-meta` | 0.8125rem | `text-meta` |
| `--fg-type-size-title` | 2rem | `text-title` |
| `--fg-type-size-section` | 1.5rem | `text-section` |
| `--fg-type-size-card` | 1.125rem | `text-card` |

---

## Button system

The global `<button>` tag is styled as a **neutral/default** button. Explicit classes create visual hierarchy:

| Class | Purpose | Visual |
|-------|---------|--------|
| `.ff-btn-primary` | Primary action | Accent fill, white text |
| `.ff-btn-secondary` | Secondary / cancel | Outline, muted text |
| `.ff-btn-tertiary` | Ghost / minimal | No border, transparent |
| `.ff-btn-destructive` | Destructive | Danger border + color |
| `.ff-btn-nav` | Navigation / link | Transparent, link-like |

### Size modifiers

| Modifier | Padding | Use case |
|----------|---------|----------|
| (none) | 0.4rem 0.75rem | Default compact |
| `.ff-btn-sm` | 0.3rem 0.55rem | Table rows, inline |
| `.ff-btn-lg` | 0.55rem 1rem | Hero / call-to-action |

### Rules

1. **Do not use pill buttons** (`border-radius: 999px`) for default actions — they lack visual weight hierarchy. Reserve `rounded-pill` only for badges and status indicators.
2. **Primary should be sparse** — at most one per page section. Use secondary or tertiary for secondary actions.
3. **Destructive always requires explicit intent** — never make dangerous actions look like primary actions.

---

## Density rules

| Element | Size |
|---------|------|
| Section padding | 1.5rem (`--fg-space-5`) |
| Card padding | 1rem (`--fg-space-4`) |
| Sub-card padding | 0.75rem |
| Table cell padding | 0.8rem 0.95rem |
| Default button | 0.4rem 0.75rem |
| Compact button | 0.3rem 0.55rem |
| Page max-width | 1600px |
| Shell max-width | 1440px |

---

## Status indicator patterns

Use these semantic classes for consistent status display:

| Pattern | When to use |
|---------|------------|
| `.fg-pill[data-tone]` | Inline badge, any context |
| `.ff-skills-pill[data-tone]` | Compact table cell badge |
| `.ff-skills-status-led[data-state]` | Status indicator with glowing dot |
| `.ff-session-banner[data-tone]` | Full-width alert / session notice |

Values for `data-tone` / `data-state`: `"success"`, `"warning"`, `"danger"`, `"info"`, `"neutral"` / `"idle"`.

---

## How to use Tailwind utilities

```tsx
// ❌ Before — ad-hoc value
<div style={{ padding: "1rem", background: "#111827" }} />

// ✅ After — token-derived utility via Tailwind
<div className="p-4 bg-surface">
```

```tsx
// ❌ Before — hardcoded color
<span style={{ color: "#32d583" }}>Active</span>

// ✅ After — token color
<span className="text-success font-semibold">Active</span>
```

```tsx
// ❌ Before — custom margins
<div style={{ marginTop: "0.75rem" }} />

// ✅ After — spacing token
<div className="mt-3" />
```

**Important:** Only use tokens defined in `@theme` (tailwind.css). If a value is not in the token set, either add it (with justification) or use inline `style`.

---

## Dark / light mode

- Mode state lives in `ThemeProvider.tsx` — sets `data-theme="dark|light"` on `<html>`
- Token values switch automatically — no manual dark: prefix needed in most cases
- Tailwind dark variant (`dark:`) is available for cases where you need explicit dark-only overrides
- Legacy `:root[data-theme="light"]` blocks in CSS continue to work

---

## Legacy CSS classes

These are the established production classes. Do not remove — migrate pages to Tailwind incrementally.

### Layout
- `.fg-shell`, `.fg-page`, `.fg-page-header`
- `.fg-row`, `.fg-row-spread`, `.fg-stack`
- `.ff-main`, `.ff-app`, `.ff-app-content`

### Cards
- `.fg-card`, `.fg-subcard`, `.fg-kpi`
- `.fg-grid`, `.fg-grid-compact`, `.fg-card-grid`
- `.fg-panel-heading`, `.fg-actions`, `.fg-action-group`

### Tables
- `.fg-table`, `.fg-table-wrap`
- `.ff-table-card`, `.ff-data-table`
- `.fg-detail-label`, `.fg-detail-rows`, `.fg-detail-key`

### Forms
- `.fg-inline-form`, `.fg-detail-grid`, `.fg-template-grid`

### Navigation
- `.ff-sidebar`, `.ff-sidebar-link`, `.ff-sidebar-section-trigger`
- `.ff-topbar`, `.ff-bottom-tab-bar`, `.ff-bottom-tab`

### Overlays
- `.ff-dropdown`, `.ff-command-menu`, `.ff-backdrop`

---

## Adding new tokens

1. Add the CSS custom property to `tokens.css` (both `:root` and `:root[data-theme="light"]`)
2. Add the matching `--color-*` (or `--spacing-*`, `--radius-*`, etc.) to the `@theme` block in `tailwind.css`
3. Document the token in this guide
4. Verify it works in both dark and light modes
