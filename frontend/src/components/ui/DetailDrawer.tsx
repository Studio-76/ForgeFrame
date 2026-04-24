import type { ReactNode } from "react";

import { CloseIcon } from "../layout/icons";
import { StatusBadge } from "./StatusBadge";

type DetailDrawerProperty = {
  label: string;
  value: ReactNode;
};

type DetailDrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  status?: ReactNode;
  statusTone?: "success" | "warning" | "danger" | "info" | "neutral";
  properties?: DetailDrawerProperty[];
  actions?: ReactNode;
  children?: ReactNode;
  onClose: () => void;
};

export function DetailDrawer({
  open,
  title,
  description,
  status,
  statusTone = "neutral",
  properties = [],
  actions,
  children,
  onClose,
}: DetailDrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="ff-drawer-layer" role="presentation">
      <button className="ff-drawer-scrim" type="button" aria-label="Close details" onClick={onClose} />
      <aside className="ff-detail-drawer" aria-label={title}>
        <div className="ff-drawer-header">
          <div>
            <div className="ff-drawer-title-row">
              <h2>{title}</h2>
              {status ? <StatusBadge tone={statusTone}>{status}</StatusBadge> : null}
            </div>
            {description ? <p>{description}</p> : null}
          </div>
          <button className="ff-icon-button" type="button" onClick={onClose} aria-label="Close details">
            <CloseIcon />
          </button>
        </div>

        {properties.length > 0 ? (
          <dl className="ff-property-list">
            {properties.map((property) => (
              <div key={property.label}>
                <dt>{property.label}</dt>
                <dd>{property.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {children ? <div className="ff-drawer-body">{children}</div> : null}
        {actions ? <div className="ff-drawer-actions">{actions}</div> : null}
      </aside>
    </div>
  );
}
