import type { CSSProperties, ReactNode } from "react";

export type DocumentTableColumn<T extends object> = {
  key: keyof T & string;
  label: string;
  group?: string;
  width?: string;
  align?: "left" | "center" | "right";
  wrap?: "wrap" | "nowrap" | "clamp";
  clampLines?: number;
  render?: (row: T) => ReactNode;
};

type DocumentDataTableProps<T extends object> = {
  columns: Array<DocumentTableColumn<T>>;
  rows: T[];
  emptyMessage?: string;
  getRowKey?: (row: T, index: number) => string;
  className?: string;
};

export function DocumentDataTable<T extends object>({
  columns,
  rows,
  emptyMessage = "Ingen rader.",
  getRowKey,
  className,
}: DocumentDataTableProps<T>) {
  const tableClassName = ["doc-data-table", className].filter(Boolean).join(" ");
  const hasHeaderGroups = columns.some((column) => Boolean(column.group));
  const headerGroups = hasHeaderGroups
    ? columns.reduce<Array<{ label: string; span: number }>>((groups, column) => {
        const label = column.group ?? "";
        const current = groups[groups.length - 1];

        if (current && current.label === label) {
          current.span += 1;
          return groups;
        }

        groups.push({ label, span: 1 });
        return groups;
      }, [])
    : [];

  return (
    <div className="doc-table-wrap">
      <table className={tableClassName}>
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} data-column={column.key} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          {hasHeaderGroups ? (
            <tr className="doc-data-table-group-row">
              {headerGroups.map((group, index) => (
                <th key={`${group.label}-${index}`} scope="colgroup" colSpan={group.span}>
                  {group.label}
                </th>
              ))}
            </tr>
          ) : null}
          <tr className="doc-data-table-field-row">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                data-column={column.key}
                data-wrap={column.wrap ?? "wrap"}
                style={{ width: column.width, textAlign: column.align ?? "left" }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={getRowKey ? getRowKey(row, index) : String(index)}>
                {columns.map((column) => {
                  const cellStyle =
                    column.wrap === "clamp"
                      ? ({ "--doc-cell-line-clamp": String(column.clampLines ?? 2) } as CSSProperties)
                      : undefined;

                  return (
                    <td
                      key={column.key}
                      data-column={column.key}
                      data-wrap={column.wrap ?? "wrap"}
                      style={{ textAlign: column.align ?? "left" }}
                    >
                      <div className="doc-data-table-cell" style={cellStyle}>
                        {column.render ? column.render(row) : (row[column.key as keyof T] as ReactNode)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
