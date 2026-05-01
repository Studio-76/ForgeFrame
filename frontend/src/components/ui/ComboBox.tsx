import { useRef, type ReactNode } from "react";
import { useComboBox, useFilter, useButton, useOption } from "react-aria";
import { useComboBoxState, Item } from "react-stately";
import type { Key, ComboBoxStateOptions } from "react-stately";

/**
 * Describes a single combobox option item.
 */
export type ComboBoxItem = {
  /** Unique identifier for the option. */
  id: string;
  /** Display label rendered in the list. */
  label: string;
};

type ComboBoxBaseProps<T extends ComboBoxItem> = {
  label: string;
  /** Items to display in the list. */
  items: Iterable<T>;
  /** Placeholder text for the input field. */
  placeholder?: string;
  /** Description rendered below the input. */
  description?: string;
  /** CSS class applied to the outer wrapper. */
  wrapperClassName?: string;
  /** Called when the user selects an item. */
  onSelectionChange?: (key: Key | null) => void;
  /** Input value for controlled mode. */
  inputValue?: string;
  /** Default input value for uncontrolled mode. */
  defaultInputValue?: string;
  /** Called when the input value changes. */
  onInputChange?: (value: string) => void;
  /**
   * Child render function that maps items to <Item> elements.
   * Receives each item from the `items` iterable.
   */
  children: (item: T) => ReactNode;
};

/**
 * Accessible combobox / autocomplete built with React Aria hooks.
 * Provides keyboard navigation (arrow keys, Enter, Escape), text filtering,
 * and proper ARIA attributes for screen readers.
 *
 * @example
 * ```tsx
 * const items = [
 *   { id: "1", label: "Option A" },
 *   { id: "2", label: "Option B" },
 * ];
 *
 * <ComboBox
 *   label="Choose an option"
 *   items={items}
 *   onSelectionChange={(key) => console.log(key)}
 * >
 *   {(item) => <Item key={item.id}>{item.label}</Item>}
 * </ComboBox>
 * ```
 */
export function ComboBox<T extends ComboBoxItem>({
  label,
  placeholder,
  description,
  wrapperClassName = "",
  items,
  onSelectionChange,
  children,
  inputValue,
  defaultInputValue,
  onInputChange,
}: ComboBoxBaseProps<T>) {
  const { contains } = useFilter({ sensitivity: "base" });
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listBoxRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Cast children to satisfy CollectionChildren<T> — at runtime the
  // Item-based render function produces valid collection elements.
  const stateOptions: ComboBoxStateOptions<T> = {
    items,
    children: children as never,
    defaultFilter: contains,
    inputValue,
    defaultInputValue,
    onInputChange,
    onSelectionChange,
  };
  const state = useComboBoxState(stateOptions);

  const { inputProps, listBoxProps, labelProps } = useComboBox(
    {
      label,
      placeholder,
      inputRef,
      popoverRef,
      listBoxRef,
      buttonRef,
    },
    state,
  );

  const { buttonProps } = useButton(
    {
      onPress: () => state.open(),
    },
    buttonRef,
  );

  return (
    <div className={`ff-combobox ${wrapperClassName}`}>
      <label {...labelProps} className="ff-combobox-label">
        {label}
      </label>
      <div className="ff-combobox-input-row">
        <input
          {...inputProps}
          ref={inputRef}
          placeholder={placeholder}
          className="ff-combobox-input"
        />
        <button
          {...buttonProps}
          ref={buttonRef}
          className="ff-combobox-trigger"
          type="button"
          aria-label="Show options"
        >
          <span aria-hidden="true">▼</span>
        </button>
      </div>
      {description ? (
        <div className="ff-combobox-description">{description}</div>
      ) : null}
      {state.isOpen && state.collection.size > 0 ? (
        <ul
          {...(listBoxProps as React.HTMLAttributes<HTMLUListElement>)}
          ref={listBoxRef}
          className="ff-combobox-list"
        >
          {[...state.collection].map((item) => (
            <ComboBoxOption key={String(item.key)} item={item} state={state} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type ComboBoxOptionProps = {
  item: {
    key: Key;
    rendered: ReactNode;
    textValue: string;
  };
  state: ReturnType<typeof useComboBoxState>;
};

/**
 * Single option within a ComboBox list.
 * Provides focus and selection visual states.
 */
function ComboBoxOption({ item, state }: ComboBoxOptionProps) {
  const ref = useRef<HTMLLIElement>(null);
  const { optionProps, isSelected, isFocused } = useOption(
    { key: item.key, isDisabled: false },
    state,
    ref,
  );

  return (
    <li
      {...optionProps}
      ref={ref}
      className={`ff-combobox-option${isFocused ? " is-focused" : ""}${isSelected ? " is-selected" : ""}`}
    >
      {item.rendered}
    </li>
  );
}

export { Item };
