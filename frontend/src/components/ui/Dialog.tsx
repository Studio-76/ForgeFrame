import { useRef } from "react";
import {
  useDialog,
  useModalOverlay,
  FocusScope,
  mergeProps,
} from "react-aria";
import type { AriaDialogProps } from "react-aria";
import type { OverlayTriggerState } from "react-stately";
import { useOverlayTriggerState } from "react-stately";

/**
 * Describes the shape of an accessible modal overlay.
 */
export type DialogOverlayProps = {
  /** Controlled open/closed state. */
  isOpen?: boolean;
  /** Handler fired when the overlay requests closure. */
  onClose?: () => void;
  /** Visible heading rendered inside the dialog. */
  title: string;
  /** Dialog body content. */
  children: React.ReactNode;
};

type InnerDialogProps = {
  state: OverlayTriggerState;
  title: string;
  children: React.ReactNode;
};

/**
 * Internal dialog shell wired to useDialog and useModalOverlay.
 * Wraps content in FocusScope for automatic focus trapping.
 */
function DialogContent({ state, title, children }: InnerDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { modalProps, underlayProps } = useModalOverlay(
    { isDismissable: true },
    state,
    ref,
  );
  const dialogProps: AriaDialogProps = { "aria-label": title };
  const { dialogProps: ariaDialogProps, titleProps } = useDialog(
    dialogProps,
    ref,
  );

  return (
    <div
      {...underlayProps}
      className="ff-dialog-underlay"
    >
      <FocusScope contain restoreFocus autoFocus>
        <div
          {...mergeProps(modalProps, ariaDialogProps)}
          ref={ref}
          className="ff-dialog-panel"
        >
          <h2 {...titleProps} className="ff-dialog-title">
            {title}
          </h2>
          {children}
        </div>
      </FocusScope>
    </div>
  );
}

/**
 * Accessible modal dialog built with React Aria's useDialog,
 * useModalOverlay, and FocusScope. Provides automatic focus trapping,
 * dismiss on Escape / scrim click, and proper ARIA attributes.
 *
 * @example
 * ```tsx
 * <DialogOverlay isOpen={open} onClose={() => setOpen(false)} title="Confirm">
 *   <p>Are you sure?</p>
 *   <button onClick={handleConfirm}>Yes</button>
 * </DialogOverlay>
 * ```
 */
export function DialogOverlay({
  isOpen,
  onClose,
  title,
  children,
}: DialogOverlayProps) {
  const state = useOverlayTriggerState({
    isOpen,
    onOpenChange: (open) => {
      if (!open && onClose) onClose();
    },
  });

  if (!state.isOpen) {
    return null;
  }

  return (
    <DialogContent state={state} title={title}>
      {children}
    </DialogContent>
  );
}
