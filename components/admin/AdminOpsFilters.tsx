"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EVENT_STATUS_VALUES, JOB_STATUS_VALUES, labelEventStatus, labelJobStatus } from "@/lib/logistics/labels";

function useFilterNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const next = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      const v = String(value).trim();
      if (v) next.set(key, v);
    }
    next.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  }

  function clear() {
    startTransition(() => {
      router.push(pathname);
    });
  }

  return { pending, submit, clear, searchParams };
}

export function AdminJobsFiltersForm({
  initial,
}: {
  initial: { status?: string; queue?: string; jobType?: string; q?: string };
}) {
  const { pending, submit, clear } = useFilterNav();
  return (
    <form action={submit} className="grid gap-3 rounded-lg border border-border bg-surface-elevated p-4 sm:grid-cols-2 lg:grid-cols-5">
      <FormField label="Buscar" htmlFor="jobs-q">
        <Input id="jobs-q" name="q" defaultValue={initial.q ?? ""} placeholder="tipo, correlación…" />
      </FormField>
      <FormField label="Estado" htmlFor="jobs-status">
        <Select id="jobs-status" name="status" defaultValue={initial.status ?? ""}>
          <option value="">Todos</option>
          {JOB_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {labelJobStatus(s)}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Cola" htmlFor="jobs-queue">
        <Input id="jobs-queue" name="queue" defaultValue={initial.queue ?? ""} placeholder="default" />
      </FormField>
      <FormField label="Tipo" htmlFor="jobs-type">
        <Input id="jobs-type" name="job_type" defaultValue={initial.jobType ?? ""} placeholder="shopify.order…" />
      </FormField>
      <div className="flex items-end gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          Filtrar
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={clear}>
          Limpiar
        </Button>
      </div>
    </form>
  );
}

export function AdminWebhooksFiltersForm({
  initial,
}: {
  initial: { status?: string; provider?: string; eventType?: string; q?: string };
}) {
  const { pending, submit, clear } = useFilterNav();
  return (
    <form action={submit} className="grid gap-3 rounded-lg border border-border bg-surface-elevated p-4 sm:grid-cols-2 lg:grid-cols-5">
      <FormField label="Buscar" htmlFor="wh-q">
        <Input id="wh-q" name="q" defaultValue={initial.q ?? ""} placeholder="tipo, id externo…" />
      </FormField>
      <FormField label="Estado" htmlFor="wh-status">
        <Select id="wh-status" name="status" defaultValue={initial.status ?? ""}>
          <option value="">Todos</option>
          {EVENT_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {labelEventStatus(s)}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Proveedor" htmlFor="wh-provider">
        <Input id="wh-provider" name="provider" defaultValue={initial.provider ?? ""} placeholder="shopify" />
      </FormField>
      <FormField label="Tipo de evento" htmlFor="wh-event-type">
        <Input id="wh-event-type" name="event_type" defaultValue={initial.eventType ?? ""} placeholder="orders/create" />
      </FormField>
      <div className="flex items-end gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          Filtrar
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={clear}>
          Limpiar
        </Button>
      </div>
    </form>
  );
}

export function AdminDeadLetterFiltersForm({ initial }: { initial: { kind?: string } }) {
  const { pending, submit, clear } = useFilterNav();
  return (
    <form action={submit} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface-elevated p-4">
      <FormField label="Tipo" htmlFor="dl-kind">
        <Select id="dl-kind" name="kind" defaultValue={initial.kind ?? "all"}>
          <option value="all">Todos</option>
          <option value="job">Trabajos</option>
          <option value="event">Eventos</option>
        </Select>
      </FormField>
      <Button type="submit" size="sm" disabled={pending}>
        Filtrar
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={clear}>
        Limpiar
      </Button>
    </form>
  );
}
