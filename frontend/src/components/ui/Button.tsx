import { useRef } from "react";
import { useButton, useFocusRing, mergeProps } from "react-aria";
import type { AriaButtonProps } from "react-aria";

type ButtonProps = AriaButtonProps & {
  className?: string;
  role?: string;
  title?: string;
  "data-tooltip"?: string;
};

/**
 * Accessible button wrapper powered by React Aria's useButton hook.
 * Provides proper keyboard interaction (Enter/Space), press handling,
 * and ARIA attributes for all interactive button elements.
 *
 * Accepts a className prop to apply existing project CSS classes
 * (e.g. "ff-icon-button", "fg-button") for drop-in migration.
 * Whitelisted DOM props pass through to the underlying `<button>`.
 * @param props - React Aria button props and project styling hooks.
 * @returns Accessible button element with project focus styling.
 */
export function Button(props: ButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton(props, ref);
  const { focusProps, isFocusVisible } = useFocusRing();

  return (
    <button
      {...mergeProps(buttonProps, focusProps)}
      ref={ref}
      title={props.title}
      className={`${props.className ?? ""}${isFocusVisible ? " ff-focus-visible" : ""}`}
    >
      {props.children}
    </button>
  );
}
