import type { ReactNode } from "react";

import { StatusBadge, type StatusTone } from "./StatusBadge";
import type { UxMetadata } from "./types";
import { uxAttributes } from "./types";

export type DetailPanelProps = {
  title: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  statusTone?: StatusTone;
  statusKey?: string | null;
  actions?: ReactNode;
  children?: ReactNode;
  sticky?: boolean;
  /** Optional UX metadata for review tooling. */
  ux?: UxMetadata;
};

export function DetailPanel({
  title,
  description,
  status,
  statusTone,
  statusKey,
  actions,
  children,
  sticky = false,
  ux,
}: DetailPanelProps) {
  return (
    <aside className={`ff-detail-panel${sticky ? " is-sticky" : ""}`} {...(ux ? uxAttributes(ux) : {})}>
      <div className="ff-detail-panel-header">
        <div className="ff-detail-panel-copy">
          <div className="ff-detail-panel-title-row">
            <h3>{title}</h3>
            {status ? (
              <StatusBadge tone={statusTone} status={statusKey}>
                {status}
              </StatusBadge>
            ) : null}
          </div>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="ff-detail-panel-actions">{actions}</div> : null}
      </div>
      {children ? <div className="ff-detail-panel-body">{children}</div> : null}
    </aside>
  );
}
