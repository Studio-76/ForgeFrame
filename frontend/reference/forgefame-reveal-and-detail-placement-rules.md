# ForgeFrame Reveal and Detail Placement Rules

## 1. Global Reveal Model

Every page must use exactly **one** of these allowed patterns for revealing selected-item detail:

| Pattern | Description | Best for |
|---------|-------------|----------|
| **Inline expansion** | Detail renders directly below the selected row | Tables with compact row-level detail |
| **Right-side detail panel** | Detail renders in a sticky sidebar (`ff-operator-sidebar`) adjacent to the table/list | Browse-detail workflows with rich detail |
| **Drawer** | Detail slides in as an overlay (`DetailDrawer`) | Deep editing, creation forms, or diagnostics |
| **Tab/section switch** | Detail replaces the current content area within a tab group | Multi-section pages (e.g., RecoveryPage tabs) |

### Forbidden patterns
- Detail appearing far below the trigger with no visual continuity.
- A third implicit content column unless the page is explicitly designed as 3-pane.
- Updating a distant panel with no visual relationship to the trigger.
- Detail expanding outside the current viewport without scroll/focus guidance.

## 2. Placement Rules

1. **One detail destination per list/table.** If a user selects a row, the result appears either inline under that row, or in a dedicated adjacent panel. Never both.

2. **No mixing of inline expansion and distant detail** for the same interaction. If a side detail panel exists, it is the only selected-item detail destination.

3. **Stable two-pane relationship.** When using a side panel:
   - Left/main pane = list or table
   - Right pane = selected item detail
   - The relationship must not change when switching items.

4. **No hidden third pane.** Do not create a third column through stacked sub-panels or bottom expansion when a side panel already exists.

## 3. Layout Rules

1. **Default to 1-pane on compact screens (<1024px), 2-pane on large screens.** Use responsive CSS (`ff-operator-layout` grid collapses to `grid-template-columns: 1fr` below 1024px).

2. **Use `TwoPaneOperationalLayout` component** for consistent two-pane layout:
   ```tsx
   <TwoPaneOperationalLayout
     main={<DataTable ... />}
     sidebar={<DetailPanel title={selected.label} sticky>{detail}</DetailPanel>}
     stickySidebar
   />
   ```

3. **Use template `useTwoPaneLayout` prop** when using IncidentResponsePage or RegistryManagementPage templates. This automatically wraps children and selectedItemContent in a two-pane layout:
   ```tsx
   <IncidentResponsePage
     useTwoPaneLayout
     selectedItemContent={<DetailPanel ...>{detail}</DetailPanel>}
     hasSelection={selected !== null}
   >
     <DataTable ... />
   </IncidentResponsePage>
   ```

4. **3-pane layouts only for deliberate high-density workflows.** Document the purpose of each pane. If a page cannot justify 3 panes, collapse to 2 or use a drawer.

## 4. Action Placement Rules

1. **Row actions must not create tall, wrapped button stacks.** In table cells, use `flex-wrap: nowrap` on `.fg-actions` to keep actions in one line.

2. **If there are more than 1–2 visible row actions,** move extras into an overflow menu or the detail panel.

3. **Navigation links must not occupy narrow vertical columns.** Use compact action rows, `fg-nav-link` pills, or overflow menus.

4. **Avoid full-width buttons in dense detail panels** unless the action is truly primary.

## 5. Detail Panel Rules

1. Selected-item detail panels must be **visually tied** to the currently selected item.
2. The selected row/card must remain **clearly highlighted** (use `is-selected` or `is-current` CSS class, or `ff-data-table` built-in selection).
3. Detail panels should have **stable position** (use `sticky` or `ff-operator-sidebar-sticky`).
4. Large technical sections inside detail panels must be **collapsed by default** (use `AdvancedDiagnostics`).
5. Detail panels should prioritize in this order:
   - Current state
   - Blocker/reason
   - Next action
   - Key facts
   - Advanced/technical detail (collapsed)

## 6. Focus and Viewport Rules

1. After selection, the user must not need to **hunt** for where the detail appeared.
2. If a detail panel opens outside the current view, it must appear adjacent to the trigger or `ff-operator-sidebar-sticky` keeps it visible.
3. When using `useTwoPaneLayout` on templates, the sidebar auto-positions beside the table/list, keeping spatial continuity.
4. Avoid interactions where the user clicks near the top but the result appears far below.

## 7. Implementation Guide

### Adding two-pane layout to a new page

```tsx
// Option A: Using a template
<IncidentResponsePage
  useTwoPaneLayout
  selectedItemContent={
    <DetailPanel title={selected.label} sticky>
      {/* detail content */}
    </DetailPanel>
  }
  hasSelection={selected !== null}
>
  <DataTable ... />  {/* renders in left pane */}
</IncidentResponsePage>

// Option B: Standalone
<TwoPaneOperationalLayout
  main={<DataTable ... />}
  sidebar={<DetailPanel title={selected.label} sticky>{/* detail */}</DetailPanel>}
  stickySidebar
/>
```

### Adding to an existing page

1. Identify if the page uses `IncidentResponsePage` or `RegistryManagementPage` template.
2. If yes and `selectedItemContent` is used below the content:
   - Add `useTwoPaneLayout` prop.
   - Ensure `selectedItemContent` is wrapped in a `DetailPanel` if not already.
   - Remove any manual `ff-operator-layout` from inside `children` (template handles it).
3. If using an independent layout:
   - Replace manual `ff-operator-layout` with `TwoPaneOperationalLayout` component.

### CSS

The layout is already defined in `frontend/src/theme/pages/runtime.css`:
```css
.ff-operator-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(300px, var(--fg-layout-detail-width));
  gap: var(--fg-space-4);
  align-items: start;
}

/* Collapses to single-column below 1024px */
@media (max-width: 1023px) {
  .ff-operator-layout {
    grid-template-columns: 1fr;
  }
}
```

No additional CSS is needed when using `TwoPaneOperationalLayout` or `useTwoPaneLayout`.

### Avoiding nested sticky

When using `useTwoPaneLayout`, the outer sidebar (`ff-operator-sidebar-sticky`) provides sticky positioning. Inner components must **not** also apply `position: sticky`:

```tsx
// ✅ Correct — outer two-pane handles sticky
<IncidentResponsePage useTwoPaneLayout selectedItemContent={
  <DetailPanel title={selected.label}>
    {/* No sticky prop — outer sidebar handles it */}
  </DetailPanel>
}>

// ✅ Correct — pass sticky={false} for components that default to sticky
<IncidentDetailContent sticky={false} />
```

## 8. Pages Audit

| Page | Template | Layout | Detail reveal | Status |
|------|----------|--------|---------------|--------|
| ErrorsPage | IncidentResponsePage | Two-pane via `useTwoPaneLayout` | Right sidebar | ✅ Fixed |
| HealthPage | IncidentResponsePage | Two-pane via `useTwoPaneLayout` | Right sidebar | ✅ Fixed |
| RecoveryPage | IncidentResponsePage | Tab sections with `ff-operator-layout` per section | Sidebar per tab | ✅ Correct |
| RoutingPage | RegistryManagementPage | Accordion/collapsible sections | Inline expansion | ✅ Correct |
| InboxPage | IncidentResponsePage | Below content (default) | Below | ⏳ Not migrated |
| NotificationsPage | IncidentResponsePage | Below content (default) | Below | ⏳ Not migrated |
| ReleaseValidationPage | RegistryManagementPage | Below content (default) | Below | ⏳ Not migrated |
| All other `RegistryManagementPage` pages | RegistryManagementPage | Below content (default) | Below | ⏳ Not migrated |
