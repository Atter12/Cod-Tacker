import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./Table";

export interface DataTableColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  emptyMessage?: string;
}

/**
 * Server-compatible table. Cell/getRowId callbacks run where DataTable is rendered
 * (Server Component pages or Client parents like AdminTable) — never serialized across the RSC boundary.
 */
export function DataTable<T>({ columns, data, getRowId, emptyMessage = "No hay resultados." }: DataTableProps<T>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.id}>{column.header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length ? (
          data.map((row) => (
            <TableRow key={getRowId(row)}>
              {columns.map((column) => (
                <TableCell key={column.id}>{column.cell(row)}</TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className="py-10 text-center text-text-secondary">
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
