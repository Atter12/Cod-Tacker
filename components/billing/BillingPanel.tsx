"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  changePlanMock,
  reactivateSubscriptionMock,
  scheduleCancelAtPeriodEnd,
} from "@/app/actions/billing";
import { requestDataDeletion, requestDataExport } from "@/app/actions/privacy";
import {
  STARTER_DEFAULT_ORDER_LIMIT,
  STARTER_DEFAULT_STORE_LIMIT,
} from "@/lib/billing/limits";
import { Button, DemoModeBadge, Card, CardContent } from "@/components/ui";
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

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <DemoModeBadge />
        <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
          Facturación de demostración
        </span>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Card>
        <CardContent className="space-y-3 p-4">
          <h3 className="text-sm font-semibold">Plan actual</h3>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-text-secondary">Plan</dt>
              <dd className="font-medium">{limits?.planName ?? "Sin suscripción (límites Starter)"}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Estado</dt>
              <dd>{limits?.subscriptionStatus ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Prueba hasta</dt>
              <dd>
                {limits?.trialEndsAt ? new Date(limits.trialEndsAt).toLocaleDateString("es") : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">Cancelar al vencer</dt>
              <dd>{limits?.cancelAtPeriodEnd ? "Sí" : "No"}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Grace period</dt>
              <dd>
                {limits?.gracePeriodEndsAt
                  ? new Date(limits.gracePeriodEndsAt).toLocaleDateString("es")
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">Uso tiendas</dt>
              <dd>
                {overview.storeCount} / {limits?.storeLimit ?? STARTER_DEFAULT_STORE_LIMIT}
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">Uso pedidos (mes)</dt>
              <dd>
                {overview.orderCountThisMonth} / {limits?.orderLimit ?? STARTER_DEFAULT_ORDER_LIMIT}
              </dd>
            </div>
          </dl>
          {canManage ? (
            <div className="flex flex-wrap gap-2 pt-2">
              {!limits?.cancelAtPeriodEnd ? (
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
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <h3 className="text-sm font-semibold">Cambiar plan (simulado)</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {overview.availablePlans.map((plan) => (
              <div key={plan.id} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">{plan.name}</p>
                <p className="text-text-secondary">${plan.monthly_price}/mes</p>
                <p className="mt-1 text-xs text-text-secondary">
                  {plan.store_limit ?? "∞"} tiendas · {plan.order_limit ?? "∞"} pedidos
                </p>
                {canManage ? (
                  <Button
                    className="mt-3 w-full"
                    size="sm"
                    disabled={pending || limits?.planCode === plan.code}
                    onClick={() => run(() => changePlanMock(agencySlug, plan.code))}
                  >
                    {limits?.planCode === plan.code ? "Plan actual" : "Seleccionar"}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          <p className="text-xs text-text-secondary">
            No se almacenan datos de tarjeta. Los límites se aplican al crear tiendas e importar CSV.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <h3 className="text-sm font-semibold">Facturas mock</h3>
          {overview.invoices.length === 0 ? (
            <p className="text-sm text-text-secondary">Sin facturas aún.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {overview.invoices.map((inv) => (
                <li key={inv.id} className="flex justify-between py-2">
                  <span>
                    {inv.invoice_number} · {inv.status}
                  </span>
                  <span>
                    {(inv.amount_cents / 100).toFixed(2)} {inv.currency_code}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-semibold">Privacidad</h3>
            <p className="text-xs text-text-secondary">
              Exportación vía job. Borrado/anominización requiere aprobación; nunca es inmediato.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <select
                className="h-9 rounded-md border border-border bg-surface-elevated px-2 text-sm"
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
                disabled={pending || !exportStoreId}
                onClick={() =>
                  run(() =>
                    requestDataExport(agencySlug, { scope: "store", storeId: exportStoreId }),
                  )
                }
              >
                Exportar tienda
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
