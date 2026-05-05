import type { ReactNode } from "react";

/**
 * A horizontal bar of filter controls.
 *
 * Renders search + select + toggle filters in a consistent layout.
 * Any filter component can be passed as children.
 *
 * @example
 * ```tsx
 * <FilterBar
 *   search={<SearchInput value={q} onChange={setQ} />}
 *   filters={[
 *     <Select label="Status" items={statusOptions} />,
 *     <Select label="Tone" items={toneOptions} />,
 *   ]}
 * />
 * ```
 */
export function FilterBar({
  search,
  filters,
  actions,
}: {
  /** Search input rendered first. */
  search?: ReactNode;
  /** Filter controls rendered after search. */
  filters?: ReactNode[];
  /** Additional action buttons rendered at the right. */
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {search ? <div className="min-w-[200px] flex-1 max-w-sm">{search}</div> : null}
      {filters && filters.length > 0
        ? filters.map((filter, index) => (
            <div key={index} className="min-w-[140px]">
              {filter}
            </div>
          ))
        : null}
      {actions ? (
        <div className="flex items-center gap-2 ml-auto">{actions}</div>
      ) : null}
    </div>
  );
}
