import { useRef } from "react";
import { useButton, useFocusRing, mergeProps } from "react-aria";
import type { AriaButtonProps } from "react-aria";

import type { Density, Size, UxMetadata } from "./types";
import { uxAttributes } from "./types";

/**
 * Variant of the ForgeFrame button.
 * - primary: Accent-filled call-to-action (max one per page).
 * - secondary: Outline button for supporting actions.
 * - tertiary: Ghost button for least emphasis.
 * - destructive: Red-toned for irreversible actions.
 * - navigation: Link-style for navigational (non-mutation) use.
 */
export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive" | "navigation";

export type ButtonProps = AriaButtonProps & {
  /** Visual variant. Defaults to "secondary". */
  variant?: ButtonVariant;
  /** Size preset. Defaults to "md". */
  size?: Size;
  /** Compact density reduces padding. */
  density?: Density;
  /** Additional CSS classes. */
  className?: string;
  /** Accessible label. */
  "aria-label"?: string;
  /** Native HTML title attribute (tooltip). */
  title?: string;
  /** Native HTML role attribute. */
  role?: string;
  /** Data attribute for tooltip system. */
  "data-tooltip"?: string;
  /** Optional UX metadata for review tooling. */
  ux?: UxMetadata;
};

/**
 * Maps variant + size to Tailwind utility classes.
 */
function variantClasses(variant: ButtonVariant, size: Size, density: Density): string {
  const base = "inline-flex items-center justify-center gap-1.5 font-medium leading-none transition-all duration-100 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-55 disabled:cursor-default select-none";

  const sizeMap: Record<Size, string> = {
    sm: density === "compact" ? "px-2 py-1 text-meta" : "px-2.5 py-1.5 text-meta",
    md: density === "compact" ? "px-3 py-1.5 text-body" : "px-3 py-2 text-body",
    lg: "px-4 py-2.5 text-body",
  };

  const variantMap: Record<ButtonVariant, string> = {
    primary:
      "bg-accent text-white font-semibold border border-accent hover:brightness-110 active:brightness-90",
    secondary:
      "bg-transparent text-muted border border-border hover:border-accent hover:text-primary active:bg-surface-subtle",
    tertiary:
      "bg-transparent text-muted border border-transparent hover:bg-surface-subtle hover:text-primary active:bg-surface-strong",
    destructive:
      "bg-transparent text-danger border border-danger-border hover:bg-danger-soft hover:text-danger active:bg-danger/20 font-semibold",
    navigation:
      "bg-transparent text-muted border border-transparent hover:text-accent active:text-accent font-medium",
  };

  return `${base} ${sizeMap[size]} ${variantMap[variant]}`;
}

/**
 * Accessible ForgeFrame button built on React Aria's useButton hook.
 *
 * Supports five visual variants, three sizes, compact density, and all
 * interactive states (hover, active, focus-visible, disabled).
 *
 * @example
 * ```tsx
 * <Button variant="primary" onPress={handleSave}>
 *   Save Changes
 * </Button>
 * ```
 */
export function Button({
  variant = "secondary",
  size = "md",
  density = "default",
  className = "",
  title,
  role,
  "data-tooltip": dataTooltip,
  ux,
  ...props
}: ButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton(props, ref);
  const { focusProps, isFocusVisible } = useFocusRing();

  return (
    <button
      {...mergeProps(buttonProps, focusProps)}
      ref={ref}
      title={title}
      role={role}
      data-tooltip={dataTooltip}
      className={`${variantClasses(variant, size, density)} ${className}${isFocusVisible ? " ff-focus-visible" : ""}`}
      {...(ux ? uxAttributes(ux) : {})}
    >
      {props.children}
    </button>
  );
}
