import type { ReactNode } from "react";

import { StatusBadge, type StatusTone } from "./StatusBadge";

type AdvancedDiagnosticsProps = {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  status?: ReactNode;
  statusTone?: StatusTone;
  statusKey?: string | null;
};

export function AdvancedDiagnostics({
  title,
  description,
  children,
  defaultOpen = false,
  status,
  statusTone,
  statusKey,
}: AdvancedDiagnosticsProps) {
  return (
    <details className="ff-advanced-diagnostics" open={defaultOpen}>
      <summary>
        <span className="ff-advanced-diagnostics-copy">
          <strong>{title}</strong>
          {description ? <small>{description}</small> : null}
        </span>
        {status ? (
          <StatusBadge tone={statusTone} status={statusKey}>
            {status}
          </StatusBadge>
        ) : null}
      </summary>
      <div className="ff-advanced-diagnostics-body">{children}</div>
    </details>
  );
}
