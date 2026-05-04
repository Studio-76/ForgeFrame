import { useRef } from "react";
import { useSearchField, useFocusRing, mergeProps } from "react-aria";
import { useSearchFieldState } from "react-stately";

/**
 * Accessible search input with clear button, built with React Aria's
 * useSearchField.
 *
 * Provides proper ARIA search role, clear button, and keyboard
 * navigation (Escape to clear).
 *
 * @example
 * ```tsx
 * <SearchInput
 *   label="Search targets"
 *   value={query}
 *   onChange={setQuery}
 *   onSubmit={handleSearch}
 * />
 * ```
 */
export function SearchInput({
  label = "Search",
  placeholder = "Search...",
  value,
  defaultValue,
  onChange,
  onSubmit,
  className = "",
}: {
  label?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const state = useSearchFieldState({
    value,
    defaultValue,
    onChange,
    onSubmit,
  });
  const { inputProps, clearButtonProps, labelProps, descriptionProps } =
    useSearchField(
      { label, placeholder },
      state,
      ref,
    );
  const { focusProps, isFocusVisible } = useFocusRing();

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label {...labelProps} className="sr-only">
        {label}
      </label>
      <div
        className={`flex items-center gap-1 px-3 py-1.5 rounded-md border bg-surface-field
          transition-colors duration-100
          ${isFocusVisible ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-accent"}
        `}
      >
        <svg
          aria-hidden="true"
          className="w-4 h-4 text-muted flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.8-3.8" />
        </svg>
        <input
          {...mergeProps(inputProps, focusProps)}
          ref={ref}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-body text-primary placeholder-muted/50 outline-none border-none min-w-0"
        />
        {state.value !== "" ? (
          <button
            {...clearButtonProps}
            className="flex-shrink-0 text-muted hover:text-primary transition-colors p-0.5"
            aria-label="Clear search"
          >
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}
