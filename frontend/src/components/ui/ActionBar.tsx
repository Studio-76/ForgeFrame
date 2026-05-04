import type { ReactNode } from "react";

/**
 * An action bar with grouped controls, typically rendered at the top
 * of a section or detail panel.
 *
 * Provides consistent header+actions layout. Max one primary action
 * in the `actions` slot.
 *
 * @example
 * ```tsx
 * <ActionBar title="Targets" actions={<Button variant="primary">Create</Button>}>
 *   <EntityTable ... />
 * </ActionBar>
 * ```
 */
export function ActionBar({
  title,
  description,
  actions,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="ff-action-bar">
      {title || description || actions ? (
        <div className="ff-action-bar-header">
          <div className="ff-action-bar-copy">
            {title ? (
              typeof title === "string" ? (
                <h2 className="text-section text-primary font-bold">{title}</h2>
              ) : (
                title
              )
            ) : null}
            {description ? (
              typeof description === "string" ? (
                <p className="text-meta text-muted">{description}</p>
              ) : (
                description
              )
            ) : null}
          </div>
          {actions ? (
            <div className="ff-action-bar-actions flex items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
      {children ? <div className="ff-action-bar-body">{children}</div> : null}
    </section>
  );
}
