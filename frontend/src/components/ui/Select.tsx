import { useRef, type Key, type ReactNode } from "react";
import { useSelect, useOption, useFocusRing, useButton, useListBox } from "react-aria";
import { useSelectState, Item } from "react-stately";

/**
 * A select option item.
 */
export type SelectItem = {
  id: string;
  label: string;
};

type SelectProps = {
  label: string;
  items: SelectItem[];
  placeholder?: string;
  description?: string;
  selectedKey?: string | null;
  defaultSelectedKey?: string;
  onSelectionChange?: (key: string | null) => void;
  isDisabled?: boolean;
  className?: string;
};

/**
 * Accessible select / dropdown built with React Aria's useSelect.
 *
 * Provides full keyboard navigation, ARIA listbox semantics,
 * and focus management. Renders a native-button-triggered popup
 * list for consistent cross-browser behavior.
 *
 * @example
 * ```tsx
 * <Select
 *   label="Provider"
 *   items={[
 *     { id: "openai", label: "OpenAI" },
 *     { id: "anthropic", label: "Anthropic" },
 *   ]}
 *   onSelectionChange={(key) => console.log(key)}
 * />
 * ```
 */
export function Select({
  label,
  items,
  placeholder = "Select...",
  description,
  selectedKey,
  defaultSelectedKey,
  onSelectionChange,
  isDisabled = false,
  className = "",
}: SelectProps) {
  // Build Item elements for the collection
  const children = items.map((item) => (
    <Item key={item.id}>{item.label}</Item>
  ));

  const state = useSelectState({
    children,
    selectedKey,
    defaultSelectedKey,
    onSelectionChange: (key) => {
      onSelectionChange?.(key === null ? null : String(key));
    },
    isDisabled,
    label,
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listBoxRef = useRef<HTMLUListElement>(null);

  const { labelProps, triggerProps, menuProps } = useSelect(
    { label, isDisabled },
    state,
    triggerRef,
  );

  const { buttonProps } = useButton(triggerProps, triggerRef);
  const { focusProps, isFocusVisible } = useFocusRing();

  const selectedItem = items.find((i) => i.id === state.selectedKey);
  const selectedLabel = selectedItem?.label ?? placeholder;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label {...labelProps} className="text-meta text-muted font-medium">
        {label}
      </label>
      <div className="relative">
        <button
          {...buttonProps}
          {...focusProps}
          ref={triggerRef}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-body rounded-md border
            bg-surface-field text-primary transition-colors duration-100
            ${isDisabled ? "opacity-55 cursor-default" : "cursor-pointer"}
            ${state.isOpen ? "border-accent" : "border-border hover:border-accent"}
            ${isFocusVisible ? "ring-2 ring-accent/30" : ""}
          `}
          style={{ outline: "none" }}
        >
          <span className={selectedItem ? "text-primary" : "text-muted/50"}>
            {selectedLabel}
          </span>
          <svg
            aria-hidden="true"
            className={`w-4 h-4 text-muted transition-transform duration-100 ${state.isOpen ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {state.isOpen ? (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-surface border border-border rounded-lg shadow-panel overflow-hidden">
            <ul
              role="listbox"
              ref={listBoxRef}
              className="m-0 p-1 list-none max-h-[240px] overflow-auto"
              style={{ outline: "none" }}
            >
              {items.map((item) => (
                <SelectOption
                  key={item.id}
                  id={item.id}
                  label={item.label}
                  state={state}
                />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {description ? (
        <div className="text-meta text-muted">{description}</div>
      ) : null}
    </div>
  );
}

type SelectOptionInnerProps = {
  id: string;
  label: string;
  state: ReturnType<typeof useSelectState>;
};

/** Single option in the select list. */
function SelectOption({ id, label, state }: SelectOptionInnerProps) {
  const ref = useRef<HTMLLIElement>(null);
  const isSelected = state.selectedKey === id;

  const { optionProps, isFocused, isDisabled } = useOption(
    { key: id, isDisabled: false },
    state,
    ref,
  );

  return (
    <li
      {...optionProps}
      ref={ref}
      className={`px-3 py-1.5 text-body rounded-sm cursor-pointer transition-colors duration-75
        ${isFocused ? "bg-accent-soft text-primary" : "text-muted"}
        ${isSelected ? "font-semibold text-primary" : ""}
        ${isDisabled ? "opacity-55 cursor-default" : ""}
      `}
      style={{ outline: "none" }}
    >
      {label}
    </li>
  );
}

export { Item };
