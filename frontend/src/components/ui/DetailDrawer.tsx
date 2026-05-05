import { useRef, type ReactNode } from "react";
import { FocusScope, useDialog } from "react-aria";
import type { AriaDialogProps } from "react-aria";

import { Button } from "./Button";
import { StatusBadge } from "./StatusBadge";
import { CloseIcon } from "../layout/icons";

export type DetailDrawerProperty = {
  label: string;
  value: ReactNode;
};

export type DetailDrawerProps = {
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

/**
 * Slide-out detail drawer with accessible focus management and ARIA dialog
 * semantics. Uses FocusScope to trap focus within the drawer while open and
 * restore focus to the trigger element on close.
 */
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
    <DrawerContent
      title={title}
      description={description}
      status={status}
      statusTone={statusTone}
      properties={properties}
      actions={actions}
      onClose={onClose}
    >
      {children}
    </DrawerContent>
  );
}

type DrawerContentProps = {
  title: string;
  description?: string;
  status?: ReactNode;
  statusTone: "success" | "warning" | "danger" | "info" | "neutral";
  properties: DetailDrawerProperty[];
  actions?: ReactNode;
  children?: ReactNode;
  onClose: () => void;
};

/**
 * Inner drawer content wrapped in FocusScope for focus trapping.
 * Uses useDialog for proper ARIA dialog semantics.
 */
function DrawerContent({
  title,
  description,
  status,
  statusTone,
  properties,
  actions,
  children,
  onClose,
}: DrawerContentProps) {
  const ref = useRef<HTMLDivElement>(null);
  const dialogProps: AriaDialogProps = { "aria-label": title };
  const { dialogProps: ariaDialogProps, titleProps } = useDialog(
    dialogProps,
    ref,
  );

  return (
    <div className="ff-drawer-layer" role="presentation">
      <Button
        className="ff-drawer-scrim"
        aria-label="Close details"
        onPress={onClose}
      />
      <FocusScope contain restoreFocus autoFocus>
        <aside
          {...ariaDialogProps}
          ref={ref}
          className="ff-detail-drawer"
          aria-label={title}
        >
          <div className="ff-drawer-header">
            <div>
              <div className="ff-drawer-title-row">
                <h2 {...titleProps}>{title}</h2>
                {status ? <StatusBadge tone={statusTone}>{status}</StatusBadge> : null}
              </div>
              {description ? <p>{description}</p> : null}
            </div>
            <Button
              className="ff-icon-button"
              aria-label="Close details"
              onPress={onClose}
            >
              <CloseIcon />
            </Button>
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
      </FocusScope>
    </div>
  );
}
