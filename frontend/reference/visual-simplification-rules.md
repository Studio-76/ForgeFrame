# Visual Simplification Rules

A reference for keeping ForgeFrame UI calm, clear, and intentional.

## Principle

Every element on a page should earn its visual weight. If it does not carry information the operator needs at that moment, reduce or remove it.

## Rules

### 1. Page Descriptions: ≤ 15 words

A page description states what the page is for. One sentence. No marketing, no explanation of architecture.

**Bad:** "Plugins are ForgeFrame's extension registry: catalog, manifest contract, per-instance activation, config contract, extension slots, audit posture, and security review."

**Good:** "Extension registry: catalog, manifest, per-instance activation."

### 2. Section Headings: One Line Only

A section heading has a title (≤ 5 words) and an optional subtitle (≤ 10 words). No long paragraphs.

**Bad:** `<p className="fg-muted">Each axis carries severity, incident count, first/last seen, current effect, next step, and direct route handoff. Unsupported axes stay explicit instead of pretending to be green.</p>`

**Good:** No subtitle, or: `<p className="fg-muted">Incident axes sorted by severity.</p>`

### 3. State Blocks: Two Lines Max

Loading and error states should be a single strong message and one brief context line. Delete the third sentence.

**Bad:**
```
<strong>Checking cost-safety access</strong>
<p>ForgeFrame is confirming whether this session can read usage analytics, routing budget posture, or both.</p>
```

**Good:**
```
<strong>Checking cost-safety access</strong>
<p>Confirming read permissions for usage or routing data.</p>
```

### 4. Summary Strip: Trim Meta Text

Meta text on summary items should be a single phrase. No full sentences explaining what the metric means.

### 5. Actions: Short Labels

Action labels should be 1-3 words. Remove "Review", "View", "Inspect" prefixes where context is clear.

**Bad:** "Review logs evidence", "Review runtime health", "Review routing policy"

**Good:** "Logs evidence", "Runtime health", "Routing policy"

### 6. No Redundant Wrapping

If a section has only one child element and the wrapper adds no semantic or layout value, remove the wrapper.

### 7. No Card-in-Card

A `fg-card` should not contain another `fg-card` or `article.fg-card`. Use flat `div` elements inside cards.

### 8. Compact Empty States

Empty states should be a single line or a small inline block. No large illustrations or multi-sentence explanations.

### 9. Limit Panel Heading Verbosity

The `<p className="fg-muted">` inside `fg-panel-heading` should be at most 10-12 words. Delete it if the heading is self-explanatory.

### 10. No Duplicate Status Summaries

When a summary strip already shows posture counts, do not repeat the same information in a card below it.

### 11. Collapse Diagnostics by Default

All diagnostics/advanced sections must start collapsed. Never auto-expand.

### 12. Single Action Bar Per Page

Do not have multiple action bars or repeating button groups. One compact row of actions at the top of the content area.
