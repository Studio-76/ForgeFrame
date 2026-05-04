import { useRef } from "react";
import { useButton, useFocusRing, mergeProps } from "react-aria";
import type { AriaButtonProps } from "react-aria";

/**
 * A navigation-style action that looks like a link but behaves as a button.
 *
 * Use for navigational actions within sections (e.g. "View details",
 * "Open in new tab") to visually distinguish them from mutation buttons.
 *
 * @example
 * ```tsx
 * <NavigationAction onPress={() => navigate("/details")}>
 *   View details
 * </NavigationAction>
 * ```
 */
export function NavigationAction(props: AriaButtonProps & { className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton(props, ref);
  const { focusProps, isFocusVisible } = useFocusRing();

  return (
    <button
      {...mergeProps(buttonProps, focusProps)}
      ref={ref}
      className={`ff-btn-nav inline-flex items-center gap-1 text-muted hover:text-accent transition-colors duration-100 text-meta font-medium border-none bg-transparent cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-55 disabled:cursor-default${isFocusVisible ? " ff-focus-visible" : ""}${props.className ? ` ${props.className}` : ""}`}
    >
      {props.children}
    </button>
  );
}
