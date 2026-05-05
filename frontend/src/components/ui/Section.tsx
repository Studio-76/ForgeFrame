import type { ReactNode } from "react";

/**
 * A generic content section with optional title, description, and actions.
 *
 * The workhorse layout primitive for grouping related content on a page.
 * Renders as a card-style container with consistent spacing.
 *
 * @example
 * ```tsx
 * <Section title="Provider Targets" description="Active execution targets" actions={<Button>Add</Button>}>
 *   <EntityTable ... />
 * </Section>
 * ```
 */
export function Section({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  /** Action elements rendered in the header (usually buttons). */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`fg-card ff-table-card ${className}`}>
      {title || description || actions ? (
        <div className="ff-table-card-header">
          <div className="flex flex-col gap-0.5">
            {title ? (
              typeof title === "string" ? (
                <h3 className="text-card text-primary font-semibold">{title}</h3>
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
          {actions ? <div className="fg-actions flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children ? <div className="ff-table-card-body">{children}</div> : null}
    </section>
  );
}
