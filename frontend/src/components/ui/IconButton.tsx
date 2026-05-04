import { useRef } from "react";
import { useButton, useFocusRing, mergeProps } from "react-aria";
import type { AriaButtonProps } from "react-aria";

/**
 * A round icon-only action button with accessible label.
 *
 * Always requires an `aria-label` for screen readers.
 *
 * @example
 * ```tsx
 * <IconButton aria-label="Delete item" onPress={handleDelete}>
 *   <TrashIcon />
 * </IconButton>
 * ```
 */
export function IconButton(props: AriaButtonProps & { className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton(props, ref);
  const { focusProps, isFocusVisible } = useFocusRing();

  return (
    <button
      {...mergeProps(buttonProps, focusProps)}
      ref={ref}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-muted hover:text-primary hover:bg-surface-subtle active:bg-surface-strong border border-transparent transition-all duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-55 disabled:cursor-default${isFocusVisible ? " ff-focus-visible" : ""}${props.className ? ` ${props.className}` : ""}`}
    >
      {props.children}
    </button>
  );
}
