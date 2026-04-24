import { EmptyState } from "./StateBlocks";

export type DataTableColumn<T> = {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  title?: string;
  description?: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  actions?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function DataTable<T>({
  title,
  description,
  columns,
  rows,
  rowKey,
  actions,
  emptyTitle = "No records",
  emptyDescription = "There is no matching ForgeFrame data for this view.",
}: DataTableProps<T>) {
  return (
    <section className="ff-table-card">
      {title || description || actions ? (
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
          <table className="ff-data-table">
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
                <tr key={rowKey(row)}>
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
    </section>
  );
}
