"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Button, Input, Select } from "@/components/ui";
import { BATCH_STATUS_OPTIONS, MATCH_STATUS_OPTIONS } from "@/lib/reconciliation/labels";

export function ReconciliationFiltersForm({
  mode = "batches",
}: {
  mode?: "batches" | "items";
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const next = new URLSearchParams();
      for (const key of ["status", "matchStatus", "from", "to", "q"]) {
        const v = String(fd.get(key) ?? "").trim();
        if (v) next.set(key, v);
      }
      next.set("page", "1");
      router.push(`?${next.toString()}`);
    },
    [router],
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      {mode === "batches" ? (
        <label className="text-sm space-y-1">
          <span>Estado lote</span>
          <Select name="status" defaultValue={sp.get("status") ?? ""}>
            <option value="">Todos</option>
            {BATCH_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
      ) : (
        <label className="text-sm space-y-1">
          <span>Estado match</span>
          <Select name="matchStatus" defaultValue={sp.get("matchStatus") ?? ""}>
            <option value="">Todos</option>
            {MATCH_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
      )}
      <label className="text-sm space-y-1">
        <span>Desde</span>
        <Input type="date" name="from" defaultValue={sp.get("from") ?? ""} />
      </label>
      <label className="text-sm space-y-1">
        <span>Hasta</span>
        <Input type="date" name="to" defaultValue={sp.get("to") ?? ""} />
      </label>
      <Button type="submit" variant="secondary">
        Filtrar
      </Button>
    </form>
  );
}
