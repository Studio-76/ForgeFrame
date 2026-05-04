import { useRef, type ReactNode } from "react";
import { useMenu, useMenuItem, useMenuTrigger, useButton, useFocusRing } from "react-aria";
import { useMenuTriggerState, useTreeState, Item } from "react-stately";
import type { TreeState, Node } from "react-stately";

/**
 * A single action within an OverflowMenu.
 */
export type OverflowAction = {
  /** Unique key. */
  id: string;
  /** Display label. */
  label: string;
  /** Called when this action is selected. */
  onAction: () => void;
  /** Disable this action. */
  isDisabled?: boolean;
  /** Visually indicate this action is destructive. */
  isDestructive?: boolean;
};

type OverflowMenuProps = {
  /** Label for the trigger button (visible to screen readers). */
  label?: string;
  /** Menu items. */
  items: OverflowAction[];
  /** Optional icon override for the trigger. */
  triggerIcon?: ReactNode;
};

/**
 * An accessible overflow menu (vertical "kebab" menu) built with
 * React Aria useMenuTrigger + useMenu.
 *
 * Provides keyboard navigation, focus management, and proper ARIA
 * menu semantics out of the box.
 *
 * @example
 * ```tsx
 * <OverflowMenu
 *   items={[
 *     { id: "edit", label: "Edit", onAction: handleEdit },
 *     { id: "delete", label: "Delete", onAction: handleDelete, isDestructive: true },
 *   ]}
 * />
 * ```
 */
export function OverflowMenu({
  label = "More actions",
  items,
  triggerIcon,
}: OverflowMenuProps) {
  const state = useMenuTriggerState({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { menuTriggerProps } = useMenuTrigger(
    { type: "menu" },
    state,
    triggerRef,
  );

  const { buttonProps } = useButton(menuTriggerProps, triggerRef);
  const { focusProps, isFocusVisible } = useFocusRing();

  return (
    <div className="relative inline-flex">
      <button
        {...buttonProps}
        {...focusProps}
        ref={triggerRef}
        className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-muted hover:text-primary hover:bg-surface-subtle transition-all duration-100 disabled:opacity-55 disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring${isFocusVisible ? " ff-focus-visible" : ""}`}
        aria-label={label}
      >
        {triggerIcon ?? (
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        )}
      </button>
      {state.isOpen ? (
        <MenuPopup
          label={label}
          state={state}
          items={items}
        />
      ) : null}
    </div>
  );
}

type MenuPopupProps = {
  label: string;
  state: ReturnType<typeof useMenuTriggerState>;
  items: OverflowAction[];
};

/** Internal popup list for the overflow menu. */
function MenuPopup({ label, state, items }: MenuPopupProps) {
  // Collect disabled keys for the tree state
  const disabledKeys = items.filter((i) => i.isDisabled).map((i) => i.id);

  // Build tree state from Item elements (react-stately collection API)
  const treeState = useTreeState({
    children: items.map((item) => (
      <Item key={item.id}>{item.label}</Item>
    )),
    disabledKeys,
  });

  const menuRef = useRef<HTMLUListElement>(null);
  const { menuProps } = useMenu({ "aria-label": label }, treeState, menuRef);

  return (
    <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-surface border border-border rounded-lg shadow-panel py-1">
      <ul
        {...menuProps as React.HTMLAttributes<HTMLUListElement>}
        ref={menuRef}
        className="m-0 p-0 list-none"
        style={{ outline: "none" }}
      >
        {[...treeState.collection].map((node) => {
          const item = items.find((i) => i.id === node.key);
          return (
            <MenuItem
              key={node.key}
              node={node}
              state={treeState}
              onAction={() => {
                item?.onAction();
                state.close();
              }}
              isDestructive={item?.isDestructive}
            />
          );
        })}
      </ul>
    </div>
  );
}

type MenuItemProps = {
  node: Node<unknown>;
  state: TreeState<unknown>;
  onAction: () => void;
  isDestructive?: boolean;
};

/** Single item within the overflow menu popup. */
function MenuItem({ node, state, onAction, isDestructive }: MenuItemProps) {
  const ref = useRef<HTMLLIElement>(null);
  const { menuItemProps, isFocused, isDisabled } = useMenuItem(
    { key: node.key, isDisabled: node.props?.isDisabled ?? false, onAction },
    state,
    ref,
  );
  const { focusProps } = useFocusRing();

  return (
    <li
      {...menuItemProps}
      {...focusProps}
      ref={ref}
      className={`px-3 py-1.5 text-body cursor-pointer transition-colors duration-75
        ${isFocused ? (isDestructive ? "bg-danger-soft text-danger" : "bg-accent-soft text-primary") : "text-muted"}
        ${isDisabled ? "opacity-55 cursor-default" : ""}
        ${isDestructive ? "text-danger" : ""}`}
      style={{ outline: "none" }}
    >
      {node.rendered}
    </li>
  );
}

export { Item };
