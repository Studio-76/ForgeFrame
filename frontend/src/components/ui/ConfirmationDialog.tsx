import type { ReactNode } from "react";

import { Button } from "./Button";
import { DialogOverlay } from "./Dialog";

/**
 * A confirmation dialog with cancel + confirm actions.
 *
 * Wraps DialogOverlay to provide common confirmation UX.
 * Defaults to a destructive-style confirm button for unsafe
 * actions; set `confirmDangerous={false}` for safe confirms.
 *
 * @example
 * ```tsx
 * <ConfirmationDialog
 *   open={confirmOpen}
 *   title="Delete provider?"
 *   onClose={() => setConfirmOpen(false)}
 *   onConfirm={handleDelete}
 * >
 *   <p>This will permanently remove the provider. This action cannot be undone.</p>
 * </ConfirmationDialog>
 * ```
 */
export function ConfirmationDialog({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmDangerous = true,
  onClose,
  onConfirm,
  isConfirmDisabled = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive. Defaults to true. */
  confirmDangerous?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isConfirmDisabled?: boolean;
}) {
  return (
    <DialogOverlay isOpen={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4 p-4">
        <div className="text-meta text-muted leading-relaxed">{children}</div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onPress={onClose}>
            {cancelLabel}
          </Button>
          {confirmDangerous ? (
            <Button
              variant="destructive"
              isDisabled={isConfirmDisabled}
              onPress={() => {
                onConfirm();
                onClose();
              }}
            >
              {confirmLabel}
            </Button>
          ) : (
            <Button
              variant="primary"
              isDisabled={isConfirmDisabled}
              onPress={() => {
                onConfirm();
                onClose();
              }}
            >
              {confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </DialogOverlay>
  );
}
