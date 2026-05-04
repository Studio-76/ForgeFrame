import { useRef } from "react";
import { useButton, useFocusRing, mergeProps } from "react-aria";
import type { AriaButtonProps } from "react-aria";

/**
 * A high-visibility destructive action for irreversible operations.
 *
 * Renders as a red-toned button. Use sparingly — at most one per view.
 * Typically wrapped in a ConfirmationDialog for safety.
 *
 * @example
 * ```tsx
 * <DestructiveAction onPress={() => setConfirmOpen(true)}>
 *   Delete instance
 * </DestructiveAction>
 * ```
 */
export function DestructiveAction(props: AriaButtonProps & { className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton(props, ref);
  const { focusProps, isFocusVisible } = useFocusRing();

  return (
    <button
      {...mergeProps(buttonProps, focusProps)}
      ref={ref}
      className={`ff-btn-destructive inline-flex items-center gap-1.5 px-3 py-2 rounded-md font-semibold text-body leading-none transition-all duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-55 disabled:cursor-default bg-transparent border border-danger-border text-danger hover:bg-danger-soft hover:text-danger active:bg-danger/20${isFocusVisible ? " ff-focus-visible" : ""}${props.className ? ` ${props.className}` : ""}`}
    >
      {props.children}
    </button>
  );
}
