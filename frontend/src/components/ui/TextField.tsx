import { useRef } from "react";
import { useTextField, useFocusRing, mergeProps } from "react-aria";
import type { AriaTextFieldOptions } from "react-aria";

/**
 * Accessible text input built with React Aria's useTextField.
 *
 * Supports label, description, error messaging, and all interactive
 * states including focus-visible and disabled.
 *
 * @example
 * ```tsx
 * <TextField
 *   label="Instance name"
 *   placeholder="my-instance"
 *   value={name}
 *   onChange={setName}
 *   isRequired
 * />
 * ```
 */
export function TextField(
  props: AriaTextFieldOptions<"input"> & {
    /** Placeholder text. */
    placeholder?: string;
    /** Input type (defaults to "text"). */
    type?: "text" | "email" | "url" | "password" | "search";
    /** Error message shown below the input. */
    errorMessage?: string;
    /** Success state styling. */
    isSuccess?: boolean;
    className?: string;
  },
) {
  const ref = useRef<HTMLInputElement>(null);
  const {
    labelProps,
    inputProps,
    descriptionProps,
    errorMessageProps,
    isInvalid,
    validationErrors,
  } = useTextField(props, ref);
  const { focusProps, isFocusVisible } = useFocusRing();

  const error = props.errorMessage ?? (isInvalid ? validationErrors.join(", ") : undefined);
  const hasError = !!error;
  const borderClass = hasError
    ? "border-danger focus:border-danger focus:ring-danger/30"
    : props.isSuccess
      ? "border-success focus:border-success focus:ring-success/30"
      : "border-border focus:border-accent focus:ring-accent/30";

  return (
    <div className={`flex flex-col gap-1.5 ${props.className ?? ""}`}>
      {props.label ? (
        <label {...labelProps} className="text-meta text-muted font-medium">
          {props.label}
          {props.isRequired ? (
            <span aria-hidden="true" className="text-danger ml-0.5">*</span>
          ) : null}
        </label>
      ) : null}
      <input
        {...mergeProps(inputProps, focusProps)}
        ref={ref}
        type={props.type ?? "text"}
        placeholder={props.placeholder}
        className={`w-full px-3 py-2 text-body rounded-md border bg-surface-field text-primary placeholder-muted/50
          transition-colors duration-100 outline-none
          ${borderClass}
          ${isFocusVisible ? "ring-2" : ""}
          disabled:opacity-55 disabled:cursor-default`}
      />
      {props.description && !hasError ? (
        <div {...descriptionProps} className="text-meta text-muted">
          {props.description}
        </div>
      ) : null}
      {hasError ? (
        <div {...errorMessageProps} className="text-meta text-danger flex items-center gap-1">
          <span aria-hidden="true">▲</span>
          {error}
        </div>
      ) : null}
    </div>
  );
}
