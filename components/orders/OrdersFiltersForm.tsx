"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  CONFIRMATION_STATUS_OPTIONS,
  ORDER_STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
} from "@/lib/orders/labels";

export function OrdersFiltersForm({
  initial,
}: {
  initial: {
    q?: string;
    status?: string;
    payment?: string;
    confirmation?: string;
    city?: string;
    district?: string;
    minAmount?: string;
    maxAmount?: string;
    from?: string;
    to?: string;
    sortBy?: string;
    sortDir?: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(initial.q ?? "");
  const [status, setStatus] = useState(initial.status ?? "");
  const [payment, setPayment] = useState(initial.payment ?? "");
  const [confirmation, setConfirmation] = useState(initial.confirmation ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [district, setDistrict] = useState(initial.district ?? "");
  const [minAmount, setMinAmount] = useState(initial.minAmount ?? "");
  const [maxAmount, setMaxAmount] = useState(initial.maxAmount ?? "");
  const [from, setFrom] = useState(initial.from ?? "");
  const [to, setTo] = useState(initial.to ?? "");
  const [sortBy, setSortBy] = useState(initial.sortBy ?? "created_at_source");
  const [sortDir, setSortDir] = useState(initial.sortDir ?? "desc");

  function apply() {
    const params = new URLSearchParams(searchParams.toString());
    const entries: Record<string, string> = {
      q,
      status,
      payment,
      confirmation,
      city,
      district,
      minAmount,
      maxAmount,
      from,
      to,
      sortBy,
      sortDir,
    };
    for (const [key, value] of Object.entries(entries)) {
      if (value.trim()) params.set(key, value.trim());
      else params.delete(key);
    }
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function clear() {
    startTransition(() => {
      router.push(pathname);
    });
  }

  return (
    <form
      className="grid gap-3 rounded-lg border border-border bg-surface-elevated p-4 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      <FormField label="Buscar" htmlFor="orders-q">
        <Input
          id="orders-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nº, externo, cliente…"
        />
      </FormField>
      <FormField label="Estado" htmlFor="orders-status">
        <Select id="orders-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos</option>
          {ORDER_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Pago" htmlFor="orders-payment">
        <Select id="orders-payment" value={payment} onChange={(e) => setPayment(e.target.value)}>
          <option value="">Todos</option>
          {PAYMENT_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Confirmación" htmlFor="orders-confirmation">
        <Select id="orders-confirmation" value={confirmation} onChange={(e) => setConfirmation(e.target.value)}>
          <option value="">Todas</option>
          {CONFIRMATION_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Desde" htmlFor="orders-from">
        <Input id="orders-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </FormField>
      <FormField label="Hasta" htmlFor="orders-to">
        <Input id="orders-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </FormField>
      <FormField label="Ciudad" htmlFor="orders-city">
        <Input id="orders-city" value={city} onChange={(e) => setCity(e.target.value)} />
      </FormField>
      <FormField label="Distrito" htmlFor="orders-district">
        <Input id="orders-district" value={district} onChange={(e) => setDistrict(e.target.value)} />
      </FormField>
      <FormField label="Monto mín." htmlFor="orders-min">
        <Input id="orders-min" inputMode="decimal" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
      </FormField>
      <FormField label="Monto máx." htmlFor="orders-max">
        <Input id="orders-max" inputMode="decimal" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
      </FormField>
      <FormField label="Ordenar por" htmlFor="orders-sort">
        <Select id="orders-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="created_at_source">Fecha</option>
          <option value="total_amount">Total</option>
          <option value="order_status">Estado</option>
        </Select>
      </FormField>
      <FormField label="Dirección" htmlFor="orders-dir">
        <Select id="orders-dir" value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
          <option value="desc">Descendente</option>
          <option value="asc">Ascendente</option>
        </Select>
      </FormField>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Aplicando…" : "Aplicar filtros"}
        </Button>
        <Button type="button" variant="outline" onClick={clear} disabled={pending}>
          Limpiar
        </Button>
      </div>
    </form>
  );
}
