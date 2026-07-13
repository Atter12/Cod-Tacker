"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  changePlanMock,
  reactivateSubscriptionMock,
  scheduleCancelAtPeriodEnd,
} from "@/app/actions/billing";
import { requestDataDeletion, requestDataExport } from "@/app/actions/privacy";
import { AgencyStatusPill } from "@/components/agency/AgencyStatusPill";
import { UsageBar } from "@/components/agency/UsageBar";
import { Button, Card, CardContent, DemoModeBadge } from "@/components/ui";
import {
  STARTER_DEFAULT_ORDER_LIMIT,
  STARTER_DEFAULT_STORE_LIMIT,
} from "@/lib/billing/limits";
import { cn } from "@/lib/utils/cn";
import type { BillingOverview } from "@/services/billing.service";

export function BillingPanel({
  agencySlug,
  canManage,
  overview,
  stores,
}: {
  agencySlug: string;
  canManage: boolean;
  overview: BillingOverview;
  stores: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [exportStoreId, setExportStoreId] = useState(stores[0]?.id ?? "");

  const limits = overview.limits;
  const storeLimit = limits?.storeLimit ?? STARTER_DEFAULT_STORE_LIMIT;
  const orderLimit = limits?.orderLimit ?? STARTER_DEFAULT_ORDER_LIMIT;
  const planName = limits?.planName ?? "Starter";
  const planCode = limits?.planCode ?? "starter";
  const status = limits?.subscriptionStatus ?? "active";
  const isActive = ["active", "trialing"].includes(status);
  const renewalLabel = limits?.trialEndsAt
    ? new Date(limits.trialEndsAt).toLocaleDateString("es")
    : "—";
  const price =
    overview.availablePlans.find((p) => p.code === planCode)?.monthly_price ??
    overview.availablePlans.find((p) => p.name === planName)?.monthly_price;

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  const storesOver = overview.storeCount > storeLimit;
  const orderRatio = orderLimit > 0 ? overview.orderCountThisMonth / orderLimit : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <DemoModeBadge />
        <AgencyStatusPill label="Facturación de demostración" tone="brand" />
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4 sm:p-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[16px] font-semibold text-text-primary">
                Plan actual · {planName}
              </h3>
              <AgencyStatusPill label={isActive ? "Activo" : status} tone={isActive ? "success" : "neutral"} />
            </div>
            <p className="text-[13px] text-text-secondary">
              Renovación: {renewalLabel} · Tiendas: {overview.storeCount} / {storeLimit}
            </p>
          </div>
          <div className="space-y-2 text-right">
            <p className="text-2xl font-semibold tracking-tight text-text-primary">
              {price != null ? `$${price} / mes` : "—"}
            </p>
            {canManage ? (
              !limits?.cancelAtPeriodEnd ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => scheduleCancelAtPeriodEnd(agencySlug))}
                >
                  Programar cancelación
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => run(() => reactivateSubscriptionMock(agencySlug))}
                >
                  Reactivar suscripción
                </Button>
              )
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-[15px] font-semibold text-text-primary">Comparar planes</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {overview.availablePlans.map((plan) => {
            const current = limits?.planCode === plan.code;
            const features = Array.isArray(plan.features)
              ? (plan.features as unknown[]).filter((f): f is string => typeof f === "string").slice(0, 3)
              : [
                  `${plan.store_limit ?? "∞"} tiendas`,
                  `${plan.order_limit ?? "∞"} pedidos/mes`,
                ];
            return (
              <Card
                key={plan.id}
                className={cn(current && "border-brand-primary shadow-[0_0_0_1px_var(--brand-primary)]")}
              >
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div>
                    <p className="text-[13px] font-semibold text-text-primary">
                      {plan.name}
                      {current ? " (Actual)" : ""}
                    </p>
                    <p className="mt-1 text-xl font-semibold text-text-primary">${plan.monthly_price} /mes</p>
                  </div>
                  <ul className="flex-1 space-y-1 text-[12px] text-text-secondary">
                    {features.map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                    {!features.includes(`${plan.store_limit ?? "∞"} tiendas`) ? (
                      <li>
                        • {plan.store_limit ?? "∞"} tiendas · {plan.order_limit ?? "∞"} pedidos
                      </li>
                    ) : null}
                  </ul>
                  {canManage ? (
                    <Button
                      className="w-full"
                      size="sm"
                      variant={current ? "primary" : "outline"}
                      disabled={pending || current}
                      onClick={() => run(() => changePlanMock(agencySlug, plan.code))}
                    >
                      {current ? "Plan actual" : "Seleccionar"}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-xs text-text-secondary">
          No se almacenan datos de tarjeta. Los límites se aplican al crear tiendas e importar CSV.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <h3 className="text-[15px] font-semibold text-text-primary">Uso actual</h3>
          <UsageBar
            label="Pedidos este mes"
            valueLabel={`${overview.orderCountThisMonth.toLocaleString("es")} / ${orderLimit.toLocaleString("es")}`}
            ratio={orderRatio}
          />
          <UsageBar
            label="Tiendas activas"
            valueLabel={`${overview.storeCount} / ${storeLimit}`}
            ratio={storeLimit > 0 ? overview.storeCount / storeLimit : 0}
            overLimit={storesOver}
          />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <h3 className="text-[15px] font-semibold text-text-primary">Historial de facturación</h3>
        </div>
        {overview.invoices.length === 0 ? (
          <p className="px-5 py-8 text-sm text-text-secondary">Sin facturas aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-semibold sm:px-5">Fecha</th>
                  <th className="px-3 py-3 font-semibold">Monto</th>
                  <th className="px-4 py-3 font-semibold sm:px-5">Estado</th>
                </tr>
              </thead>
              <tbody>
                {overview.invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-border">
                    <td className="px-4 py-3 sm:px-5">
                      {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString("es") : inv.invoice_number}
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      ${(inv.amount_cents / 100).toFixed(2)} {inv.currency_code}
                    </td>
                    <td className="px-4 py-3 sm:px-5">
                      <AgencyStatusPill
                        label={inv.status === "paid" || inv.status === "Pagado" ? "Pagado" : inv.status}
                        tone={inv.status === "paid" || inv.status === "Pagado" ? "success" : "neutral"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {canManage ? (
        <Card>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <h3 className="text-[15px] font-semibold text-text-primary">Privacidad y datos</h3>
            <p className="text-xs text-text-secondary">
              Exportación vía job. El borrado/anominización requiere aprobación y nunca es inmediato.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <select
                className="h-9 rounded-md border border-border bg-surface-elevated px-2 text-sm"
                aria-label="Tienda a exportar"
                value={exportStoreId}
                onChange={(e) => setExportStoreId(e.target.value)}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                disabled={pending || !exportStoreId}
                onClick={() =>
                  run(() => requestDataExport(agencySlug, { scope: "store", storeId: exportStoreId }))
                }
              >
                Exportar tiendas
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => requestDataExport(agencySlug, { scope: "agency" }))}
              >
                Exportar agencia
              </Button>
              <Button
                size="sm"
                variant="danger"
                className="bg-danger/10 text-danger hover:bg-danger/20"
                disabled={pending || !exportStoreId}
                onClick={() => {
                  if (!confirm("¿Solicitar borrado/anominización? Requiere aprobación admin.")) return;
                  run(() =>
                    requestDataDeletion(agencySlug, {
                      scope: "store",
                      storeId: exportStoreId,
                      reason: "Solicitud desde facturación/privacidad",
                    }),
                  );
                }}
              >
                Solicitar borrado
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
