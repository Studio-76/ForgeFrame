import { Link } from "react-router-dom";

import { withInstanceScope } from "../../app/tenantScope";

/**
 * Props for the {@link SetupActionBar} component.
 */
export type SetupActionBarProps = {
  /** Label for the primary action button. */
  label: string;
  /** Route to navigate to when the action is taken. */
  to: string;
  /** Optional description of why this action is needed. */
  description?: string;
  /** Optional instance ID for scoping the route. */
  instanceId?: string | null;
};

/**
 * Single primary action bar for the setup flow.
 *
 * Renders a prominent, impossible-to-miss call-to-action button
 * with an optional description. The action is always the single
 * next thing the user should do.
 */
export function SetupActionBar({
  label,
  to,
  description,
  instanceId,
}: SetupActionBarProps) {
  return (
    <div className="ff-setup-primary-action-bar">
      <div className="ff-setup-primary-action-content">
        {description ? (
          <p className="ff-setup-primary-action-description">{description}</p>
        ) : null}
        <Link
          className="ff-setup-primary-action-button"
          to={withInstanceScope(to, instanceId)}
        >
          {label}
        </Link>
      </div>
    </div>
  );
}
