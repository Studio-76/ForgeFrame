# Residual UX Anti-Pattern Catalog

Post-migration anti-patterns identified across ForgeFrame pages that still feel heavy,
awkward, or inefficient despite using the new shared component system.

---

## AP-1: Duplicate Summary Hero Stats

| Field | Value |
|---|---|
| **Anti-pattern** | A hero/status component at the top of the page shows the same metrics already rendered in the page template's SummaryStrip. |
| **Example pages** | ReleaseValidationPage (ReleaseStatusHero repeats total gates, blocked, manual-evidence counts), RoutingPage (RoutingStatusHero stats line overlaps with RoutingSummaryGrid) |
| **Why it harms usability** | Two sources of the same truth make the page feel redundant. The operator has to visually cross-check both to decide which to trust. It wastes vertical space with zero added signal. |
| **Recommended replacement** | The hero should show ONE thing: the overall status badge and a single-line blocker/readiness statement. All counts belong in the SummaryStrip only. |

## AP-2: Large Action Clusters with Related-Page Nav Links

| Field | Value |
|---|---|
| **Anti-pattern** | Action bars contain a "Related pages" section with 5+ navigation links, treating navigation as an action. |
| **Example pages** | RoutingPage (RoutingActionBar has 6 nav links under "Related pages"), ProviderTargetsPage (ContextNavStrip with 5 nav links in diagnostics) |
| **Why it harms usability** | Navigation links in action bars create visual noise and compete with primary actions. The global sidebar already provides navigation. Related-page links belong in diagnostics or should use the existing nav structure. |
| **Recommended replacement** | Remove related-page nav sections from action bars entirely, or move them to a collapsed diagnostics area. Keep only actionable controls (refresh, create, edit) in the action bar. |

## AP-3: Oversized Low-Information Scope Selection

| Field | Value |
|---|---|
| **Anti-pattern** | Scope selection surfaces use full cards with verbose descriptions, status pills, and redundant text for what is fundamentally a simple picker. |
| **Example pages** | DispatchPage (44-line scope card with description text, instance list, AND inline form) |
| **Why it harms usability** | The scope picker takes up a third of the page before the user has done anything. It delays the primary workflow. |
| **Recommended replacement** | Use a compact inline scope picker or a simple form without explanatory prose. The label "Scope" and the input are self-evident. |

## AP-4: Verbose Page Descriptions

| Field | Value |
|---|---|
| **Anti-pattern** | Page header descriptions are multi-line, run-on sentences that enumerate every section or gate on the page. |
| **Example pages** | ReleaseValidationPage ("Release claims stay blocked until bootstrap, runtime, provider, OAuth, routing, queue, security, TLS, and recovery gates all have real evidence."), ProviderTargetsPage ("Target readiness workflow for the selected instance: see which targets are dispatchable, why others are not, and what to fix next." — duplicated twice), RoutingPage ("Request classification, target selection stages, budget and circuit guardrails, and explainable decision history") |
| **Why it harms usability** | Operators scan page headers quickly. A wall of text that enumerates every subsection tells the user nothing they wouldn't learn by looking at the page itself. |
| **Recommended replacement** | One clear, short sentence (under 15 words) that tells the operator what the page is FOR, not what's on it. |

## AP-5: Full-Card Loading/Error States with Prose

| Field | Value |
|---|---|
| **Anti-pattern** | Loading and error states use full `<article className="fg-card">` wrappers with heading + prose paragraph instead of compact inline messages. |
| **Example pages** | DispatchPage (50-line loading card and error card with full paragraphs) |
| **Why it harms usability** | Empty-state scaffolding makes the page feel heavier than it should before any content loads. The cards take up space without providing useful information. |
| **Recommended replacement** | Use `<p className="fg-muted">` for loading status and `<p className="fg-danger">` for errors inside a minimal container. No full card wrapper needed unless content exists. |

## AP-6: Navigation Links in Diagnostics

| Field | Value |
|---|---|
| **Anti-pattern** | Diagnostics sections contain navigation links to related pages. Diagnostics should show raw data and technical detail, not serve as a secondary nav system. |
| **Example pages** | ProviderTargetsPage (ContextNavStrip with 5 navigation links in AdvancedDiagnostics) |
| **Why it harms usability** | Invites confusion about what diagnostics are for. Global nav and page-level buttons already provide navigation. |
| **Recommended replacement** | Remove navigation links from diagnostics entirely. If related-page links are essential, put them in a dedicated minimal section outside diagnostics. |

## AP-7: Verbose DataTable Descriptions

| Field | Value |
|---|---|
| **Anti-pattern** | DataTable `description` props use full sentences that explain what the table shows, rather than concise labels. |
| **Example pages** | RecoveryPage (6 DataTables with sentences like "The hardest gaps surface here first so unprotected or untested classes are impossible to miss.") |
| **Why it harms usability** | Table descriptions add vertical space and cognitive load without helping the operator scan or decide. |
| **Recommended replacement** | Short phrases (3-6 words) or no description when the table title is self-explanatory. |

## AP-8: Verbose Action Bar Headings

| Field | Value |
|---|---|
| **Anti-pattern** | Action bars include decorative headings and helper text that add visual noise without actionable value. |
| **Example pages** | RoutingPage ("Routing controls" heading + "Edit policy, simulate decisions, or navigate to related surfaces." paragraph), ProviderTargetsPage ("Target controls" heading) |
| **Why it harms usability** | The heading and helper text in an action bar pre-chew what the buttons already say. Adds unnecessary vertical space. |
| **Recommended replacement** | Remove action bar heading text entirely. Action buttons are self-documenting. If a section label is needed, use a compact badge or just the buttons directly. |
