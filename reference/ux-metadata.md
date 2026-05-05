# UX Metadata Reference

ForgeFrame's dev-only UX Review Mode uses stable `data-ux-*` attributes on shared UI
primitives so reviewers can click elements, annotate layout/presentation issues, and
give agents precise code-locatable feedback.

## Quick Start

```tsx
import { PageHeader, Button } from "../components/ui";

<PageHeader
  title="Provider Targets"
  ux={{ uxId: "providers-page-header", uxComponent: "PageHeader", uxPage: "providers" }}
  actions={
    <Button variant="primary" ux={{ uxId: "providers-add-target", uxActionKind: "create" }}>
      Add target
    </Button>
  }
/>
```

This renders:

```html
<header class="ff-page-header-panel" data-ux-id="providers-page-header" data-ux-component="PageHeader" data-ux-page="providers">
  ...
  <button data-ux-id="providers-add-target" data-ux-action-kind="create">Add target</button>
</header>
```

## Available Attributes

| Prop           | Attribute               | Purpose                                          |
|----------------|-------------------------|--------------------------------------------------|
| `uxId`         | `data-ux-id`            | Stable, human-readable element identifier        |
| `uxComponent`  | `data-ux-component`     | Component type label (PageHeader, DataTable, …)   |
| `uxRole`       | `data-ux-role`          | Semantic role within the page layout             |
| `uxPage`       | `data-ux-page`          | Page or feature identifier                       |
| `uxAttention`  | `data-ux-attention`     | Attention level for review prioritisation        |
| `uxActionKind` | `data-ux-action-kind`   | Action category (create, delete, navigate, …)    |
| `uxDensity`    | `data-ux-density`       | Display density hint                             |
| `uxSource`     | `data-ux-source`        | Source file or area reference for traceability   |

All fields are optional. Only non-`undefined` values are rendered as attributes —
no empty attributes are emitted.

## Naming Rules

### `uxId`

- **Must be stable and human-readable.**
- Include page or feature context.
- Avoid generated random IDs.

**Good:**
- `providers-related-pages`
- `queues-primary-summary`
- `ingress-tls-diagnostics`
- `skills-create-button`
- `memory-lifecycle-table`

**Bad:**
- `btn-1` (no context)
- `a3f7c2b1` (random)
- `thing` (too vague)

### `uxComponent`

Use the canonical component name (e.g., `PageHeader`, `DataTable`, `Button`,
`Section`, `DetailPanel`). Prefer setting this on the component itself or
omitting it (the attribute is visible in the DOM tree anyway).

### `uxRole`

Describe what the element does in the layout: `hero`, `action-bar`, `summary`,
`detail`, `navigation`, `filter`, `diagnostics`, `checklist`.

### `uxPage`

Use the feature slug: `providers`, `skills`, `learning`, `memory`,
`ingress-tls`, `execution`, `dispatch`, `recovery`.

### `uxActionKind`

Describe the action category: `create`, `delete`, `edit`, `archive`, `restore`,
`navigate`, `export`, `sync`, `reconcile`.

### `uxAttention`

Use for review prioritisation: `blocker`, `high`, `medium`, `low`.

### `uxDensity`

`default` or `compact` — should match the component's visual density.

### `uxSource`

File path or area reference, e.g. `features/providers/ProviderTargetsPage.tsx`.
Useful for agents to locate the source quickly.

## Supported Components

All core UI primitives at `frontend/src/components/ui/` accept an optional `ux` prop:

| Component          | Root element                |
|--------------------|-----------------------------|
| PageHeader         | `<header>`                  |
| SummaryStrip       | `<section>`                 |
| Section            | `<section>`                 |
| Button             | `<button>`                  |
| ActionBar          | `<section>`                 |
| ContextNavStrip    | `<nav>`                     |
| DataTable          | `<section>`                 |
| DetailPanel        | `<aside>`                   |
| DetailDrawer       | `<aside>`                   |
| EmptyState         | `<div>`                     |
| AdvancedDiagnostics| `<details>`                 |
| StatusBadge        | `<span>`                    |
| RemediationChecklist| `<div>`                    |
| HealthState        | `<div>`                     |
| ErrorState         | `<div>`                     |
| LoadingState       | `<div>`                     |
| BlockedState       | `<div>`                     |
| PermissionState    | `<div>`                     |

## Safety Constraints

**Do NOT expose in UX metadata:**

- Secrets, tokens, API keys
- Raw payloads or request/response bodies
- Customer data (PII, email, usernames)
- Log content, evidence blobs, stack traces
- Sensitive backend values (certificate data, internal URLs)
- Instance-specific internal IDs

UX metadata must remain **dev- and review-safe**. The review tooling must NOT be
activatable in production — metadata may remain in production only if it is
generic and safe.

## How to Add UX Metadata to a Component

1. Import the `UxMetadata` type from the UI barrel:
   ```tsx
   import type { UxMetadata } from "../components/ui";
   ```

2. Add an optional `ux` prop to your component:
   ```tsx
   { ux, ... }: MyComponentProps & { ux?: UxMetadata }
   ```

3. Spread `uxAttributes(ux)` on the root element:
   ```tsx
   import { uxAttributes } from "../components/ui";
   // ...
   <div {...(ux ? uxAttributes(ux) : {})}>
   ```

4. When using the component, provide a contextual `uxId`:
   ```tsx
   <Section ux={{ uxId: "providers-targets-section", uxPage: "providers" }}>
   ```
