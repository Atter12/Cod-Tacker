"use client";

import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";

type AdminRow = { id: string | number };

export function AdminTable<T extends AdminRow>({
  columns,
  rows,
  emptyMessage = "No hay registros para mostrar.",
}: {
  columns: Array<{ key: keyof T; label: string }>;
  rows: T[];
  emptyMessage?: string;
}) {
  const tableColumns: DataTableColumn<T>[] = columns.map(({ key, label }) => ({
    id: String(key),
    header: label,
    cell: (row) => formatValue(row[key]),
    sortValue: (row) => String(row[key] ?? ""),
  }));

  return <DataTable columns={tableColumns} data={rows} getRowId={(row) => String(row.id)} emptyMessage={emptyMessage} />;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  }
  return String(value);
}
