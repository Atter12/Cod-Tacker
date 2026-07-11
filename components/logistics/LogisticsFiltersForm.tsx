"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SHIPMENT_STATUS_OPTIONS } from "@/lib/logistics/labels";

export function LogisticsFiltersForm({
  initial,
}: {
  initial: {
    q?: string;
    status?: string;
    carrierId?: string;
    rto?: string;
    terminal?: string;
    from?: string;
    to?: string;
  };
  carriers?: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const next = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      const v = String(value).trim();
      if (v) next.set(key, v);
    }
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  }

  return (
    <form
      action={submit}
      className="grid gap-3 rounded-lg border border-border bg-surface-elevated p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <FormField label="Buscar" htmlFor="log-q">
        <Input id="log-q" name="q" defaultValue={initial.q ?? ""} placeholder="Guía / tracking…" />
      </FormField>
      <FormField label="Estado" htmlFor="log-status">
        <Select id="log-status" name="status" defaultValue={initial.status ?? ""}>
          <option value="">Todos</option>
          {SHIPMENT_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="RTO" htmlFor="log-rto">
        <Select id="log-rto" name="rto" defaultValue={initial.rto ?? ""}>
          <option value="">Todos</option>
          <option value="1">Sí</option>
          <option value="0">No</option>
        </Select>
      </FormField>
      <FormField label="Terminal" htmlFor="log-terminal">
        <Select id="log-terminal" name="terminal" defaultValue={initial.terminal ?? ""}>
          <option value="">Todos</option>
          <option value="1">Sí</option>
          <option value="0">No</option>
        </Select>
      </FormField>
      <FormField label="Desde" htmlFor="log-from">
        <Input id="log-from" name="from" type="date" defaultValue={initial.from ?? ""} />
      </FormField>
      <FormField label="Hasta" htmlFor="log-to">
        <Input id="log-to" name="to" type="date" defaultValue={initial.to ?? ""} />
      </FormField>
      <div className="flex items-end gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          Filtrar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => startTransition(() => router.push(pathname))}
        >
          Limpiar
        </Button>
      </div>
    </form>
  );
}
