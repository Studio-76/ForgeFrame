import { EntityTable, type EntityTableColumn } from "./EntityTable";

type DataTableProps<T> = {
  title?: string;
  description?: string;
  columns: EntityTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  actions?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
};

export type DataTableColumn<T> = EntityTableColumn<T>;

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
    <EntityTable
      title={title}
      description={description}
      columns={columns}
      rows={rows}
      rowKey={rowKey}
      actions={actions}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
    />
  );
}
