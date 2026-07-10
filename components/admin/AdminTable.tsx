"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";

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
  const [sort, setSort] = useState<{ key: keyof T; direction: "asc" | "desc" }>();

  const sorted = !sort
    ? rows
    : [...rows].sort((a, b) => {
        const x = String(a[sort.key] ?? "");
        const y = String(b[sort.key] ?? "");
        return (x > y ? 1 : x < y ? -1 : 0) * (sort.direction === "asc" ? 1 : -1);
      });

  function toggle(key: keyof T) {
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map(({ key, label }) => (
            <TableHead key={String(key)}>
              <button className="inline-flex items-center gap-1" onClick={() => toggle(key)} type="button">
                {label}
                {sort?.key === key ? (
                  sort.direction === "asc" ? (
                    <ChevronUp className="size-3" />
                  ) : (
                    <ChevronDown className="size-3" />
                  )
                ) : null}
              </button>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.length ? (
          sorted.map((row) => (
            <TableRow key={String(row.id)}>
              {columns.map(({ key }) => (
                <TableCell key={String(key)}>{formatValue(row[key])}</TableCell>
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

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  }
  return String(value);
}
