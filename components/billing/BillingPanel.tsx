"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  openBillingPortal,
  reactivateSubscription,
  scheduleCancelAtPeriodEnd,
  selectPlan,
} from "@/app/actions/billing";
import { requestDataDeletion, requestDataExport } from "@/app/actions/privacy";
import { evaluateSubscriptionAccess } from "@/lib/billing/access-policy";
import { AgencyStatusPill } from "@/components/agency/AgencyStatusPill";
import { UsageBar } from "@/components/agency/UsageBar";
import { Button, Card, CardContent, DemoModeBadge } from "@/components/ui";
import { routes } from "@/config/routes";
import {
  STARTER_DEFAULT_ORDER_LIMIT,
  STARTER_DEFAULT_STORE_LIMIT,
} from "@/lib/billing/limits";
import {
  isSelfServePlanCode,
  type BillingInterval,
} from "@/lib/integrations/contracts/billing";
import { cn } from "@/lib/utils/cn";
import type { BillingOverview, BillingPlanCard } from "@/services/billing.service";

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function planDisplayPrice(
  plan: BillingPlanCard,
  interval: BillingInterval,
): { primary: string; secondary: string | null; annualTotal: number | null } {
  const monthly = Number(plan.monthly_price);
  const annual = plan.annual_price != null ? Number(plan.annual_price) : null;

  if (interval === "year" && annual != null && annual > 0) {
    const perMonth = annual / 12;
    return {
      primary: `${formatUsd(perMonth)} /mes`,
      secondary: `${formatUsd(annual)} facturados al año`,
      annualTotal: annual,
    };
  }

  if (monthly <= 0) {
    return { primary: "A medida", secondary: null, annualTotal: null };
  }

  return {
    primary: `${formatUsd(monthly)} /mes`,
    secondary: annual != null && annual > 0 ? `o ${formatUsd(annual)} /año` : null,
    annualTotal: annual,
  };
}

function annualSavingsPercent(plan: BillingPlanCard): number | null {
  const monthly = Number(plan.monthly_price);
  const annual = plan.annual_price != null ? Number(plan.annual_price) : null;
  if (!monthly || !annual || annual <= 0) return null;
  const fullYear = monthly * 12;
  if (fullYear <= annual) return null;
  return Math.round(((fullYear - annual) / fullYear) * 100);
}

export function BillingPanel({
  agencySlug,
  canManage,
  overview,
  stores,
  billingMode = "demo",
  checkoutStatus = null,
}: {
  agencySlug: string;
  canManage: boolean;
  overview: BillingOverview;
  stores: Array<{ id: string; name: string }>;
  /** From server: BILLING_PROVIDER */
  billingMode?: "demo" | "stripe";
  /** From ?checkout=success|cancel */
  checkoutStatus?: "success" | "cancel" | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exportStoreId, setExportStoreId] = useState(stores[0]?.id ?? "");
  const [interval, setInterval] = useState<BillingInterval>(
    overview.billingInterval ?? "month",
  );

  const limits = overview.limits;
  const storeLimit = limits?.storeLimit ?? STARTER_DEFAULT_STORE_LIMIT;
  const orderLimit = limits?.orderLimit ?? STARTER_DEFAULT_ORDER_LIMIT;
  const planName = limits?.planName ?? "Starter";
  const planCode = limits?.planCode ?? "starter";
  const status = limits?.subscriptionStatus ?? "active";
  const isActive = ["active", "trialing"].includes(status);
  const renewalLabel = limits?.currentPeriodEnd
    ? new Date(limits.currentPeriodEnd).toLocaleDateString("es")
    : limits?.trialEndsAt
      ? new Date(limits.trialEndsAt).toLocaleDateString("es")
      : "—";

  const currentPlan =
    overview.availablePlans.find((p) => p.code === planCode) ??
    overview.availablePlans.find((p) => p.name === planName);
  const currentInterval = overview.billingInterval ?? "month";
  const currentPrice = currentPlan
    ? planDisplayPrice(currentPlan, currentInterval)
    : null;

  useEffect(() => {
    if (checkoutStatus === "success") {
      setNotice(
        billingMode === "stripe"
          ? "Pago recibido. La suscripción se actualizará en unos segundos."
          : "Plan actualizado.",
      );
      router.replace(routes.agency.billing(agencySlug), { scroll: false });
    } else if (checkoutStatus === "cancel") {
      setNotice("Checkout cancelado. No se realizó ningún cobro.");
      router.replace(routes.agency.billing(agencySlug), { scroll: false });
    }
  }, [checkoutStatus, billingMode, agencySlug, router]);

  function run(fn: () => Promise<{ error?: string; url?: string }>) {
    setError(null);
    setNotice(null);
    start(async () => {
      const r = await fn();
      if (r.error) {
        setError(r.error);
        return;
      }
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      setNotice("Cambios guardados.");
      router.refresh();
    });
  }

  const storesOver = overview.storeCount > storeLimit;
  const orderRatio = orderLimit > 0 ? overview.orderCountThisMonth / orderLimit : 0;
  const isDemo = billingMode === "demo";
  const access = evaluateSubscriptionAccess(limits);
  const savingsSample = overview.availablePlans
    .map(annualSavingsPercent)
    .find((n): n is number => n != null && n > 0);

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {isDemo ? <DemoModeBadge /> : null}
        <AgencyStatusPill
          label={isDemo ? "Facturación de demostración" : "Stripe"}
          tone={isDemo ? "brand" : "success"}
        />
      </div>
      {access.code === "past_due_grace" || access.code === "past_due_blocked" ? (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            access.code === "past_due_blocked"
              ? "border-danger/40 bg-danger/10 text-danger"
              : "border-border bg-muted/40 text-text-primary",
          )}
          role="status"
        >
          <p>{access.message}</p>
          {canManage && !isDemo ? (
            <Button
              className="mt-2"
              size="sm"
              variant={access.code === "past_due_blocked" ? "primary" : "outline"}
              disabled={pending}
              onClick={() => run(() => openBillingPortal(agencySlug))}
            >
              Actualizar método de pago
            </Button>
          ) : null}
        </div>
      ) : null}
      {access.code === "cancelled_grace" && access.message ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-text-primary">
          {access.message}
        </p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {notice ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-text-primary">
          {notice}
        </p>
      ) : null}

      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4 sm:p-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[16px] font-semibold text-text-primary">
                Plan actual · {planName}
              </h3>
              <AgencyStatusPill
                label={isActive ? "Activo" : status}
                tone={isActive ? "success" : "neutral"}
              />
              {currentInterval === "year" ? (
                <AgencyStatusPill label="Anual" tone="brand" />
              ) : null}
              {limits?.cancelAtPeriodEnd ? (
                <AgencyStatusPill label="Cancela al fin del período" tone="neutral" />
              ) : null}
            </div>
            <p className="text-[13px] text-text-secondary">
              Renovación: {renewalLabel} · Tiendas: {overview.storeCount} / {storeLimit}
            </p>
          </div>
          <div className="space-y-2 text-right">
            <p className="text-2xl font-semibold tracking-tight text-text-primary">
              {currentPrice?.primary ?? "—"}
            </p>
            {currentPrice?.secondary ? (
              <p className="text-[12px] text-text-secondary">{currentPrice.secondary}</p>
            ) : null}
            {canManage ? (
              <div className="flex flex-wrap justify-end gap-2">
                {!isDemo ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => run(() => openBillingPortal(agencySlug))}
                  >
                    Portal de facturación
                  </Button>
                ) : null}
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
                    onClick={() => run(() => reactivateSubscription(agencySlug))}
                  >
                    Reactivar suscripción
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-text-primary">Comparar planes</h3>
            <p className="text-[12px] text-text-secondary">Planes que crecen contigo</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {savingsSample != null ? (
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-primary">
                Ahorra {savingsSample}%
              </span>
            ) : null}
            <div
              className="inline-flex rounded-md border border-border bg-surface p-0.5"
              role="tablist"
              aria-label="Periodicidad de facturación"
            >
              {(
                [
                  { value: "month", label: "Mensual" },
                  { value: "year", label: "Anual" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="tab"
                  aria-selected={interval === opt.value}
                  className={cn(
                    "rounded px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    interval === opt.value
                      ? "bg-surface-elevated text-brand-primary shadow-sm"
                      : "text-text-secondary hover:text-text-primary",
                  )}
                  onClick={() => setInterval(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="-mx-1 flex min-w-0 gap-3 overflow-x-auto px-1 pb-2 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 sm:snap-none xl:grid-cols-3 2xl:grid-cols-5">
          {overview.availablePlans.map((plan) => {
            const current = limits?.planCode === plan.code;
            const selfServe = isSelfServePlanCode(plan.code);
            const display = planDisplayPrice(plan, interval);
            const savePct = annualSavingsPercent(plan);
            const features = Array.isArray(plan.features)
              ? (plan.features as unknown[])
                  .filter((f): f is string => typeof f === "string")
                  .slice(0, 3)
              : [
                  `${plan.store_limit ?? "∞"} tiendas`,
                  `${plan.order_limit ?? "∞"} pedidos/mes`,
                ];

            const ctaLabel = current
              ? "Plan actual"
              : !selfServe
                ? "Hablar con ventas"
                : isDemo
                  ? "Seleccionar"
                  : "Comenzar ahora";

            return (
              <Card
                key={plan.id}
                className={cn(
                  "min-w-[260px] shrink-0 snap-start sm:min-w-0 sm:shrink",
                  current && "border-brand-primary shadow-[0_0_0_1px_var(--brand-primary)]",
                )}
              >
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-semibold text-text-primary">
                        {plan.name}
                        {current ? " (Actual)" : ""}
                      </p>
                      {interval === "year" && savePct != null ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-primary">
                          −{savePct}%
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xl font-semibold text-text-primary">{display.primary}</p>
                    {display.secondary ? (
                      <p className="mt-0.5 text-[11px] text-text-secondary">{display.secondary}</p>
                    ) : null}
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
                      disabled={pending || current || !selfServe}
                      onClick={() =>
                        run(() => selectPlan(agencySlug, plan.code, interval))
                      }
                    >
                      {ctaLabel}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-xs text-text-secondary">
          No se almacenan datos de tarjeta
          {isDemo
            ? ". Modo demo aplica el plan al instante."
            : ". Stripe Checkout / Portal gestionan el cobro."}{" "}
          Los límites se aplican al crear tiendas e importar CSV.
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

      <Card className="min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <h3 className="text-[15px] font-semibold text-text-primary">Historial de facturación</h3>
        </div>
        {overview.invoices.length === 0 ? (
          <p className="px-5 py-8 text-sm text-text-secondary">Sin facturas aún.</p>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto">
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
                      {inv.issued_at
                        ? new Date(inv.issued_at).toLocaleDateString("es")
                        : inv.invoice_number}
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      ${(inv.amount_cents / 100).toFixed(2)} {inv.currency_code}
                    </td>
                    <td className="px-4 py-3 sm:px-5">
                      <AgencyStatusPill
                        label={
                          inv.status === "paid" || inv.status === "Pagado" ? "Pagado" : inv.status
                        }
                        tone={
                          inv.status === "paid" || inv.status === "Pagado" ? "success" : "neutral"
                        }
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
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <select
                className="h-9 w-full min-w-0 rounded-md border border-border bg-surface-elevated px-2 text-sm sm:w-auto sm:min-w-[160px]"
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
                className="w-full sm:w-auto"
                disabled={pending || !exportStoreId}
                onClick={() =>
                  run(() =>
                    requestDataExport(agencySlug, { scope: "store", storeId: exportStoreId }),
                  )
                }
              >
                Exportar tiendas
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={pending}
                onClick={() => run(() => requestDataExport(agencySlug, { scope: "agency" }))}
              >
                Exportar agencia
              </Button>
              <Button
                size="sm"
                variant="danger"
                className="w-full bg-danger/10 text-danger hover:bg-danger/20 sm:w-auto"
                disabled={pending || !exportStoreId}
                onClick={() => {
                  if (!confirm("¿Solicitar borrado/anominización? Requiere aprobación admin.")) {
                    return;
                  }
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
