import type { ReactNode } from "react";

import { AdvancedDiagnostics } from "../ui/AdvancedDiagnostics";
import { PrimaryBlockerCallout } from "../ui/PrimaryBlockerCallout";
import { Button } from "../ui/Button";
import type { AttentionPayload } from "../ui/models/attention";
import { groupAttentionItems, toneForLevel } from "../ui";

/**
 * Render blocker callouts from a grouped attention payload.
 * @param items - Attention items to extract blockers from.
 * @returns Array of blocker callout elements or null.
 */
export function renderBlockers(items: AttentionPayload[] | undefined): ReactNode {
  const { blockers } = groupAttentionItems(items);
  return blockers.length > 0 ? (
    <>
      {blockers.map((item) => (
        <div key={item.key} className="mb-3">
          <PrimaryBlockerCallout
            title={item.title}
            description={item.description}
            tone={item.tone ?? toneForLevel(item.level)}
            action={
              item.action ? (
                <Button
                  variant={item.action.kind ?? "primary"}
                  isDisabled={item.action.disabled}
                  onPress={item.action.onClick}
                >
                  {item.action.label}
                </Button>
              ) : undefined
            }
          />
        </div>
      ))}
    </>
  ) : null;
}

/**
 * Render visible (needs_action / warning) attention items as status badges.
 * @param items - Attention items to extract visible items from.
 * @returns Badge row element or null.
 */
export function renderVisibleAttention(items: AttentionPayload[] | undefined): ReactNode {
  const { visible } = groupAttentionItems(items);
  return visible.length > 0 ? (
    <div className="flex flex-wrap gap-2 mb-3">
      {visible.map((item) => (
        <span
          key={item.key}
          className="ff-status-badge"
          data-tone={item.tone ?? toneForLevel(item.level)}
        >
          {item.title}
        </span>
      ))}
    </div>
  ) : null;
}

/**
 * Render collapsed (informational / healthy) attention items under a details toggle.
 * @param items - Attention items to extract collapsed items from.
 * @returns Details/summary element or null.
 */
export function renderCollapsedAttention(items: AttentionPayload[] | undefined): ReactNode {
  const { collapsed } = groupAttentionItems(items);
  return collapsed.length > 0 ? (
    <details className="mt-3">
      <summary className="text-meta text-muted cursor-pointer font-medium">
        Status details ({collapsed.length})
      </summary>
      <div className="flex flex-wrap gap-2 mt-2">
        {collapsed.map((item) => (
          <span
            key={item.key}
            className="ff-status-badge"
            data-tone={item.tone ?? toneForLevel(item.level)}
          >
            {item.title}
          </span>
        ))}
      </div>
    </details>
  ) : null;
}

/**
 * Render diagnostic attention items inside an AdvancedDiagnostics wrapper.
 * @param items - Attention items to extract diagnostic items from.
 * @param title - Diagnostics section title.
 * @param children - Additional diagnostic content.
 * @returns AdvancedDiagnostics wrapper or null.
 */
export function renderDiagnosticAttention(
  items: AttentionPayload[] | undefined,
  title: string,
  children?: ReactNode,
): ReactNode {
  const { advanced } = groupAttentionItems(items);
  return (children || advanced.length > 0) ? (
    <AdvancedDiagnostics title={title}>
      {advanced.length > 0 ? (
        <div className="flex flex-col gap-2 mb-3">
          {advanced.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <span className="font-mono text-meta text-muted">{item.title}</span>
              {item.description ? (
                <span className="text-meta text-muted">{item.description}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {children}
    </AdvancedDiagnostics>
  ) : null;
}
