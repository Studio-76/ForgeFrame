import type { ReactNode } from "react";

export type ReleaseActionBarProps = {
  /** Primary release actions (e.g. refresh, record attestation) */
  primaryActions: ReactNode;
  /** Secondary navigation links visually separated from primary actions */
  navLinks?: ReactNode;
};

/**
 * Action bar that visually separates release/remediation actions
 * from navigation links. Navigation links are rendered below a divider
 * at a reduced visual weight.
 */
export function ReleaseActionBar({ primaryActions, navLinks }: ReleaseActionBarProps) {
  return (
    <section className="ff-release-action-bar">
      <div className="ff-action-controls">
        {primaryActions}
      </div>
      {navLinks ? (
        <div className="ff-nav-links">
          {navLinks}
        </div>
      ) : null}
    </section>
  );
}
