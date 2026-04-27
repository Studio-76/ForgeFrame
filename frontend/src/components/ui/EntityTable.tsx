import type { ReactNode } from "react";

import { EmptyState } from "./StateBlocks";

export type EntityTableColumn<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
};

type EntityTableProps<T> = {
  title?: ReactNode;
  description?: ReactNode;
  columns: EntityTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  actions?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  tableLabel?: string;
  footer?: ReactNode;
  getRowClassName?: (row: T) => string | undefined;
};

export function EntityTable<T>({
  title,
  description,
  columns,
  rows,
  rowKey,
  actions,
  emptyTitle = "No records",
  emptyDescription = "There is no matching ForgeFrame data for this view.",
  tableLabel,
  footer,
  getRowClassName,
}: EntityTableProps<T>) {
  return (
    <section className="ff-table-card">
      {(title || description || actions) ? (
        <div className="ff-table-card-header">
          <div>
            {title ? <h3>{title}</h3> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="fg-actions">{actions}</div> : null}
        </div>
      ) : null}
      {rows.length > 0 ? (
        <div className="ff-table-scroll">
          <table className="ff-data-table" aria-label={typeof tableLabel === "string" ? tableLabel : undefined}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className={column.className}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowKey(row)} className={getRowClassName?.(row)}>
                  {columns.map((column) => (
                    <td key={column.key} className={column.className}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      )}
      {footer ? <div className="ff-table-card-footer">{footer}</div> : null}
    </section>
  );
}
