import React from 'react';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  width?: string;
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  onRowClick?: (item: T) => void;
  striped?: boolean;
  responsive?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  striped = false,
  responsive = true,
  emptyMessage = 'No data available',
  className = '',
}: DataTableProps<T>) {
  const tableClass = [
    'ds-table',
    striped ? 'ds-table-striped' : '',
    responsive ? 'ds-table-responsive' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (data.length === 0) {
    return (
      <div className="ds-empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`ds-table-wrapper ${className}`.trim()}>
      <table className={tableClass}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                style={{ width: col.width }}
                className={col.hideOnMobile ? 'ds-hide-mobile' : ''}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map((col) => (
                <td
                  key={String(col.key)}
                  data-label={col.header}
                  className={col.hideOnMobile ? 'ds-hide-mobile' : ''}
                >
                  {col.render
                    ? col.render(item)
                    : String((item as Record<string, unknown>)[col.key as string] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
