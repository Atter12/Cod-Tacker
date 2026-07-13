"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { MoreHorizontal, Search, Store } from "lucide-react";
import { createStore } from "@/app/actions/stores";
import { AgencyStatusPill } from "@/components/agency/AgencyStatusPill";
import { UsageBar } from "@/components/agency/UsageBar";
import {
  Alert,
  Button,
  Card,
  CardContent,
  FormField,
  Input,
  Select,
} from "@/components/ui";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";

export type AgencyStoreRow = {
  id: string;
  name: string;
  slug: string;
  country_code: string | null;
  currency_code: string;
  timezone?: string | null;
  is_active: boolean;
  orderCount?: number;
  orderLimit?: number;
};

export function AgencyStoresPanel({
  agencySlug,
  stores,
  canCreate,
  orderLimit,
}: {
  agencySlug: string;
  stores: AgencyStoreRow[];
  canCreate: boolean;
  orderLimit: number;
}) {
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stores.filter((store) => {
      if (statusFilter === "active" && !store.is_active) return false;
      if (statusFilter === "inactive" && store.is_active) return false;
      if (!q) return true;
      return (
        store.name.toLowerCase().includes(q) ||
        store.slug.toLowerCase().includes(q) ||
        (store.country_code ?? "").toLowerCase().includes(q)
      );
    });
  }, [stores, query, statusFilter]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setFieldErrors({});
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const slug = String(data.get("slug") ?? "").trim();
    const nextErrors: Record<string, string> = {};
    if (!name) nextErrors.name = "El nombre es obligatorio.";
    if (!slug) nextErrors.slug = "El slug es obligatorio.";
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      nextErrors.slug = "Usa solo minúsculas, números y guiones.";
    }
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      return;
    }
    setPending(true);
    const result = await createStore(agencySlug, {
      name,
      slug,
      countryCode: String(data.get("countryCode") ?? "PE"),
      currencyCode: String(data.get("currencyCode") ?? "PEN"),
      timezone: String(data.get("timezone") ?? "America/Lima"),
    });
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="space-y-6">
      {canCreate ? (
        <Card>
          <CardContent className="space-y-4 p-4 sm:p-5">
            <h2 className="text-[16px] font-semibold text-text-primary">Crear tienda</h2>
            <form className="space-y-4" onSubmit={submit} noValidate>
              {error ? (
                <Alert variant="danger" title="No se pudo crear">
                  {error}
                </Alert>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Nombre de la tienda" htmlFor="name">
                  <Input
                    id="name"
                    name="name"
                    placeholder="Ej. Holistic Shop"
                    aria-invalid={Boolean(fieldErrors.name)}
                    className="h-11"
                  />
                  {fieldErrors.name ? (
                    <p className="mt-1 text-[12px] text-danger">{fieldErrors.name}</p>
                  ) : null}
                </FormField>
                <FormField label="Slug" htmlFor="slug" hint="Solo minúsculas, números y guiones.">
                  <Input
                    id="slug"
                    name="slug"
                    placeholder="holistic-shop"
                    aria-invalid={Boolean(fieldErrors.slug)}
                    className="h-11"
                  />
                  {fieldErrors.slug ? (
                    <p className="mt-1 text-[12px] text-danger">{fieldErrors.slug}</p>
                  ) : null}
                </FormField>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <FormField label="País" htmlFor="countryCode">
                  <Input id="countryCode" name="countryCode" defaultValue="PE" className="h-11" />
                </FormField>
                <FormField label="Moneda" htmlFor="currencyCode">
                  <Input id="currencyCode" name="currencyCode" defaultValue="PEN" className="h-11" />
                </FormField>
                <FormField label="Timezone" htmlFor="timezone">
                  <Select id="timezone" name="timezone" defaultValue="America/Lima" className="h-11">
                    <option value="America/Lima">America/Lima</option>
                    <option value="America/Bogota">America/Bogota</option>
                    <option value="America/Mexico_City">America/Mexico_City</option>
                  </Select>
                </FormField>
              </div>
              <Button type="submit" disabled={pending} className="h-11 w-full">
                {pending ? "Creando…" : "Crear tienda"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <label className="relative min-w-[220px] flex-1">
            <span className="sr-only">Buscar tiendas</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-secondary"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar tiendas..."
              className="h-10 pl-9"
            />
          </label>
          <Select
            aria-label="Filtrar por estado"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="h-10 w-auto min-w-[160px]"
          >
            <option value="all">Estado: Todos</option>
            <option value="active">Estado: Activas</option>
            <option value="inactive">Estado: Inactivas</option>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-semibold sm:px-5">Tienda</th>
                <th className="px-3 py-3 font-semibold">País</th>
                <th className="px-3 py-3 font-semibold">Moneda</th>
                <th className="px-3 py-3 font-semibold">Pedidos (mes)</th>
                <th className="px-3 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold sm:px-5">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-text-secondary">
                    No hay tiendas que coincidan con el filtro.
                  </td>
                </tr>
              ) : (
                filtered.map((store) => {
                  const used = store.orderCount ?? 0;
                  const limit = store.orderLimit ?? orderLimit;
                  return (
                    <tr key={store.id} className="border-t border-border">
                      <td className="px-4 py-3.5 sm:px-5">
                        <Link
                          href={routes.store.dashboard(agencySlug, store.slug)}
                          className="inline-flex items-center gap-2.5 font-semibold text-text-primary hover:text-brand-primary"
                        >
                          <span className="grid size-7 place-items-center rounded-lg bg-brand-soft text-brand-primary">
                            <Store className="size-3.5" aria-hidden />
                          </span>
                          {store.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3.5 text-text-primary">{store.country_code ?? "—"}</td>
                      <td className="px-3 py-3.5 text-text-primary">{store.currency_code}</td>
                      <td className="px-3 py-3.5">
                        <div className="max-w-[180px] space-y-1">
                          <p className="text-[12.5px] font-medium text-text-primary">
                            {used.toLocaleString("es")} / {limit.toLocaleString("es")}
                          </p>
                          <UsageBar valueLabel="" ratio={limit > 0 ? used / limit : 0} />
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <AgencyStatusPill
                          label={store.is_active ? "Activa" : "Inactiva"}
                          tone={store.is_active ? "success" : "neutral"}
                        />
                      </td>
                      <td className="px-4 py-3.5 sm:px-5">
                        <Link
                          href={routes.store.dashboard(agencySlug, store.slug)}
                          className={cn(
                            "inline-flex size-8 items-center justify-center rounded-md text-text-secondary",
                            "hover:bg-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          )}
                          aria-label={`Abrir ${store.name}`}
                        >
                          <MoreHorizontal className="size-4" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-[12.5px] text-text-secondary sm:px-5">
          <span>
            {filtered.length === 0
              ? "0 resultados"
              : `1–${filtered.length} de ${filtered.length}`}
          </span>
        </div>
      </Card>
    </div>
  );
}
