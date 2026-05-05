import { useRef } from "react";
import { useFocusRing, mergeProps } from "react-aria";
import { useToggleState } from "react-stately";
import type { ToggleStateOptions } from "react-stately";

/**
 * A styled toggle/switch control built with React Stately's useToggleState.
 *
 * Supports controlled/uncontrolled modes, disabled state, and
 * accessible focus-visible styling.
 *
 * @example
 * ```tsx
 * <Toggle
 *   label="Enable auto-approve"
 *   isSelected={enabled}
 *   onChange={setEnabled}
 * />
 * ```
 */
export function Toggle({
  label,
  isSelected,
  defaultSelected,
  onChange,
  isDisabled = false,
  size = "md",
}: {
  label: string;
  isSelected?: boolean;
  defaultSelected?: boolean;
  onChange?: (isSelected: boolean) => void;
  isDisabled?: boolean;
  size?: "sm" | "md";
}) {
  const state = useToggleState({
    isSelected,
    defaultSelected,
    onChange,
    isDisabled,
  } satisfies ToggleStateOptions);

  const ref = useRef<HTMLDivElement>(null);
  const { focusProps, isFocusVisible } = useFocusRing();

  const sizeClass = size === "sm" ? "w-8 h-4" : "w-10 h-5";
  const thumbSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const translateX = size === "sm" ? "translate-x-4" : "translate-x-5";

  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <div
        ref={ref}
        role="switch"
        aria-checked={state.isSelected}
        aria-label={label}
        tabIndex={isDisabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            state.toggle();
          }
        }}
        onClick={() => state.toggle()}
        className={`relative ${sizeClass} rounded-pill transition-colors duration-150
          ${state.isSelected ? "bg-accent" : "bg-surface-subtle border border-border"}
          ${isDisabled ? "opacity-55 cursor-default" : "cursor-pointer"}
          ${isFocusVisible ? "ring-2 ring-accent/30 ring-offset-2 ring-offset-surface" : ""}
        `}
        {...mergeProps(focusProps, {})}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 left-0.5 ${thumbSize} bg-white rounded-full shadow-sm transition-transform duration-150
            ${state.isSelected ? translateX : "translate-x-0"}
          `}
        />
      </div>
      <span
        className={`text-body font-medium ${isDisabled ? "text-muted" : "text-primary"}`}
      >
        {label}
      </span>
    </label>
  );
}
