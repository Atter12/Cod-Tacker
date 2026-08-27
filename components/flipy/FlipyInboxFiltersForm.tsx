"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { FlipyEnviosInboxScope } from "@/lib/integrations/flipy/partner-contract";

const SCOPE_OPTIONS: Array<{ value: FlipyEnviosInboxScope; label: string }> = [
  { value: "atencion", label: "Atención" },
  { value: "activos", label: "Activos" },
  { value: "historial", label: "Historial" },
  { value: "all", label: "Todos" },
];

export function FlipyInboxFiltersForm({
  scope,
  q,
  estado,
}: {
  scope: FlipyEnviosInboxScope;
  q: string;
  estado: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const next = new URLSearchParams(searchParams.toString());
    const nextScope = String(formData.get("scope") ?? "atencion");
    const nextQ = String(formData.get("q") ?? "").trim();
    const nextEstado = String(formData.get("estado") ?? "").trim();

    next.set("scope", nextScope);
    if (nextQ) next.set("q", nextQ);
    else next.delete("q");
    if (nextEstado) next.set("estado", nextEstado);
    else next.delete("estado");
    next.delete("page");

    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  }

  return (
    <form
      action={submit}
      className="grid gap-3 rounded-[10px] border border-border bg-surface-elevated p-4 shadow-[var(--card-shadow)] sm:grid-cols-2 lg:grid-cols-4"
    >
      <FormField label="Bandeja" htmlFor="flipy-scope">
        <Select id="flipy-scope" name="scope" defaultValue={scope} disabled={pending}>
          {SCOPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Estado Flipy" htmlFor="flipy-estado">
        <Input
          id="flipy-estado"
          name="estado"
          defaultValue={estado}
          placeholder="PENDIENTE_PUJAS, ASIGNADO…"
          disabled={pending}
        />
      </FormField>
      <FormField label="Buscar" htmlFor="flipy-q">
        <Input
          id="flipy-q"
          name="q"
          defaultValue={q}
          placeholder="Pedido, dirección, envío…"
          disabled={pending}
        />
      </FormField>
      <div className="flex items-end">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Filtrando…" : "Aplicar"}
        </Button>
      </div>
    </form>
  );
}
