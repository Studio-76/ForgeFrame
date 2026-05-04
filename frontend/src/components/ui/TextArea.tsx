import { useRef } from "react";
import { useTextField, useFocusRing, mergeProps } from "react-aria";
import type { AriaTextFieldOptions } from "react-aria";

/**
 * Accessible multi-line text input built with React Aria's useTextField.
 *
 * @example
 * ```tsx
 * <TextArea
 *   label="Description"
 *   placeholder="Enter a description..."
 *   value={desc}
 *   onChange={setDesc}
 *   rows={4}
 * />
 * ```
 */
export function TextArea(
  props: AriaTextFieldOptions<"textarea"> & {
    placeholder?: string;
    /** Number of visible text rows. Defaults to 3. */
    rows?: number;
    errorMessage?: string;
    className?: string;
  },
) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const {
    labelProps,
    inputProps,
    descriptionProps,
    errorMessageProps,
    isInvalid,
    validationErrors,
  } = useTextField(
    { ...props, inputElementType: "textarea" },
    ref,
  );
  const { focusProps, isFocusVisible } = useFocusRing();

  const error = props.errorMessage ?? (isInvalid ? validationErrors.join(", ") : undefined);
  const hasError = !!error;
  const borderClass = hasError
    ? "border-danger focus:border-danger focus:ring-danger/30"
    : "border-border focus:border-accent focus:ring-accent/30";

  return (
    <div className={`flex flex-col gap-1.5 ${props.className ?? ""}`}>
      {props.label ? (
        <label {...labelProps} className="text-meta text-muted font-medium">
          {props.label}
        </label>
      ) : null}
      <textarea
        {...mergeProps(inputProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>, focusProps)}
        ref={ref}
        rows={props.rows ?? 3}
        placeholder={props.placeholder}
        className={`w-full px-3 py-2 text-body rounded-md border bg-surface-field text-primary placeholder-muted/50
          transition-colors duration-100 outline-none resize-y min-h-[60px]
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
