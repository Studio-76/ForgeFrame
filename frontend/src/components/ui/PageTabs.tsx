import { useRef, type Key, type ReactNode } from "react";
import { useTab, useTabList, useTabPanel, useFocusRing } from "react-aria";
import { useTabListState, Item } from "react-stately";
import type { TabListState, Node } from "react-stately";

/**
 * Tab configuration for PageTabs.
 */
export type PageTab = {
  /** Unique key. */
  id: string;
  /** Display label. */
  label: string;
  /** Content rendered when this tab is active. */
  content: ReactNode;
  /** Optional badge count. */
  count?: number;
  /** Disable this tab. */
  isDisabled?: boolean;
};

type PageTabsProps = {
  /** Tabs to render. */
  tabs: PageTab[];
  /** Currently selected key (controlled). */
  selectedKey?: string | null;
  /** Default selected key (uncontrolled). */
  defaultSelectedKey?: string;
  /** Called when selection changes. */
  onSelectionChange?: (key: string) => void;
};

/**
 * Accessible tab panel built with React Aria's useTabList / useTab / useTabPanel.
 *
 * Provides full keyboard navigation (arrow keys, Home/End), ARIA
 * tab semantics, and focus management.
 *
 * @example
 * ```tsx
 * <PageTabs
 *   tabs={[
 *     { id: "overview", label: "Overview", content: <Overview /> },
 *     { id: "logs", label: "Logs", content: <Logs />, count: 3 },
 *   ]}
 * />
 * ```
 */
export function PageTabs({
  tabs,
  selectedKey,
  defaultSelectedKey,
  onSelectionChange,
}: PageTabsProps) {
  const tabListRef = useRef<HTMLDivElement>(null);

  const state = useTabListState({
    children: tabs.map((t) => (
      <Item key={t.id} title={t.label}>
        {t.content}
      </Item>
    )),
    selectedKey: selectedKey ?? undefined,
    defaultSelectedKey,
    onSelectionChange: onSelectionChange as ((key: Key) => void) | undefined,
  });

  return (
    <div className="flex flex-col">
      <TabRow tabListRef={tabListRef} state={state} tabs={tabs} />
      <TabContentPanel state={state} tabs={tabs} />
    </div>
  );
}

type TabRowProps = {
  tabListRef: React.RefObject<HTMLDivElement | null>;
  state: TabListState<object>;
  tabs: PageTab[];
};

/** The horizontal tab bar row. */
function TabRow({ tabListRef, state, tabs }: TabRowProps) {
  const { tabListProps } = useTabList(
    {},
    state,
    tabListRef,
  );

  return (
    <div
      {...tabListProps}
      ref={tabListRef}
      className="flex gap-0 border-b border-border"
    >
      {[...state.collection].map((item) => {
        const tab = tabs.find((t) => t.id === item.key);
        return (
          <TabItem
            key={item.key}
            item={item}
            state={state}
            count={tab?.count}
          />
        );
      })}
    </div>
  );
}

type TabItemProps = {
  item: Node<object>;
  state: TabListState<object>;
  count?: number;
};

/** Individual tab trigger. */
function TabItem({ item, state, count }: TabItemProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const { tabProps, isSelected, isDisabled } = useTab({ key: item.key }, state, ref);
  const { focusProps, isFocusVisible } = useFocusRing();

  return (
    <button
      {...tabProps}
      {...focusProps}
      ref={ref}
      className={`relative flex items-center gap-2 px-4 py-2.5 text-body font-medium transition-colors duration-100
        ${isSelected ? "text-primary" : "text-muted hover:text-primary"}
        ${isDisabled ? "opacity-55 cursor-default" : "cursor-pointer"}
        focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus-ring
      `}
    >
      {item.rendered as ReactNode}
      {count != null ? (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-pill bg-surface-subtle text-meta text-muted font-mono font-semibold leading-none">
          {count}
        </span>
      ) : null}
      {isSelected ? (
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
        />
      ) : null}
    </button>
  );
}

type TabContentPanelProps = {
  state: TabListState<object>;
  tabs: PageTab[];
};

/** Active tab content panel. */
function TabContentPanel({ state, tabs }: TabContentPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { tabPanelProps } = useTabPanel({}, state, ref);
  const activeTab = tabs.find((t) => t.id === state.selectedKey);

  return (
    <div
      {...tabPanelProps}
      ref={ref}
      className="pt-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
    >
      {activeTab?.content}
    </div>
  );
}

export { Item };
