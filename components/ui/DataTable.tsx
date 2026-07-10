"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./Table";

export interface DataTableColumn<T> { id: string; header: string; cell: (row: T) => React.ReactNode; sortValue?: (row: T) => string | number; }
interface DataTableProps<T> { columns: DataTableColumn<T>[]; data: T[]; getRowId: (row: T) => string; emptyMessage?: string; }
export function DataTable<T>({ columns, data, getRowId, emptyMessage = "No hay resultados." }: DataTableProps<T>) {
  const [sort, setSort] = useState<{ id: string; direction: "asc" | "desc" }>();
  const rows = [...data].sort((a, b) => { const column = columns.find((item) => item.id === sort?.id); if (!column?.sortValue || !sort) return 0; const x = column.sortValue(a); const y = column.sortValue(b); return (x > y ? 1 : x < y ? -1 : 0) * (sort.direction === "asc" ? 1 : -1); });
  function toggle(id: string) { setSort((current) => current?.id === id ? { id, direction: current.direction === "asc" ? "desc" : "asc" } : { id, direction: "asc" }); }
  return <Table><TableHeader><TableRow>{columns.map((column) => <TableHead key={column.id}>{column.sortValue ? <button className="inline-flex items-center gap-1" onClick={() => toggle(column.id)}>{column.header}{sort?.id === column.id && (sort.direction === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}</button> : column.header}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.length ? rows.map((row) => <TableRow key={getRowId(row)}>{columns.map((column) => <TableCell key={column.id}>{column.cell(row)}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={columns.length} className="py-10 text-center text-text-secondary">{emptyMessage}</TableCell></TableRow>}</TableBody></Table>;
}
