import Link from "next/link";
import {
  CreditCard,
  Palette,
  Plus,
  Store,
  Users,
} from "lucide-react";
import { UsageBar } from "@/components/agency/UsageBar";
import { AgencyStatusPill } from "@/components/agency/AgencyStatusPill";
import { Card, CardContent, SectionHeader } from "@/components/ui";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";

export type AgencyOverviewActivity = {
  id: string;
  title: string;
  detail: string;
  tone: "brand" | "info" | "success" | "violet";
};

const toneClass: Record<AgencyOverviewActivity["tone"], string> = {
  brand: "bg-brand-primary",
  info: "bg-sky-500",
  success: "bg-success",
  violet: "bg-violet-500",
};

export function AgencyOverview({
  agencySlug,
  agencyName,
  userName,
  storeCount,
  storeLimit,
  orderCount,
  orderLimit,
  memberCount,
  memberLimit = 5,
  planName,
  planActive,
  canCreateStore,
  canInvite,
  canManageBrand,
  canViewBilling,
  activity,
}: {
  agencySlug: string;
  agencyName: string;
  userName: string;
  storeCount: number;
  storeLimit: number;
  orderCount: number;
  orderLimit: number;
  memberCount: number;
  memberLimit?: number;
  planName: string;
  planActive: boolean;
  canCreateStore: boolean;
  canInvite: boolean;
  canManageBrand: boolean;
  canViewBilling: boolean;
  activity: AgencyOverviewActivity[];
}) {
  const orderRatio = orderLimit > 0 ? orderCount / orderLimit : 0;
  const orderPct = Math.round(orderRatio * 100);
  const storesOver = storeCount > storeLimit;

  const quickActions = [
    {
      href: routes.agency.stores(agencySlug),
      label: "Crear tienda",
      icon: Plus,
      show: canCreateStore,
    },
    {
      href: routes.agency.team(agencySlug),
      label: "Invitar miembro",
      icon: Users,
      show: canInvite,
    },
    {
      href: routes.agency.branding(agencySlug),
      label: "Configurar marca",
      icon: Palette,
      show: canManageBrand,
    },
    {
      href: routes.agency.billing(agencySlug),
      label: "Ver facturación",
      icon: CreditCard,
      show: canViewBilling,
    },
  ].filter((a) => a.show);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          title="Resumen de la agencia"
          description={`Bienvenido de vuelta, ${userName}`}
        />
        <div className="inline-flex items-center gap-2 rounded-[10px] border border-border bg-surface-elevated px-3 py-2 text-[12.5px] font-medium text-text-primary">
          <Store className="size-3.5 text-brand-primary" aria-hidden />
          <span className="max-w-[180px] truncate">{agencyName}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 p-4 sm:p-5">
            <p className="text-[12.5px] text-text-secondary">Tiendas activas</p>
            <p className="text-2xl font-semibold tracking-tight text-text-primary">
              {storeCount} de {Math.max(storeLimit, storeCount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4 sm:p-5">
            <p className="text-[12.5px] text-text-secondary">Pedidos (mes)</p>
            <p className="text-2xl font-semibold tracking-tight text-text-primary">
              {orderCount.toLocaleString("es")}
            </p>
            <p className="text-[12px] font-medium text-success">Uso del periodo actual</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4 sm:p-5">
            <p className="text-[12.5px] text-text-secondary">Miembros</p>
            <p className="text-2xl font-semibold tracking-tight text-text-primary">
              {memberCount} / {memberLimit}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <p className="text-[12.5px] text-text-secondary">Uso de pedidos</p>
            <p className="text-2xl font-semibold tracking-tight text-text-primary">
              {orderCount.toLocaleString("es")} / {orderLimit.toLocaleString("es")}
            </p>
            <p className="text-[12px] text-text-secondary">{orderPct}% del límite mensual</p>
            <UsageBar valueLabel="" ratio={orderRatio} />
          </CardContent>
        </Card>
      </div>

      {quickActions.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-[14px] font-semibold text-text-primary">Acciones rápidas</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map(({ href, label, icon: Icon }) => (
              <Link
                key={href + label}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-[12px] border border-border bg-surface-elevated px-4 py-3.5",
                  "text-[13px] font-semibold text-text-primary shadow-[var(--card-shadow)]",
                  "transition-colors hover:bg-brand-softer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <span className="grid size-9 place-items-center rounded-[10px] bg-brand-soft text-brand-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                {label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-4 sm:p-5">
            <h2 className="text-[15px] font-semibold text-text-primary">Actividad reciente</h2>
            <ul className="space-y-3">
              {activity.length === 0 ? (
                <li className="text-sm text-text-secondary">Sin actividad reciente.</li>
              ) : (
                activity.map((item) => (
                  <li key={item.id} className="flex items-start gap-3">
                    <span
                      className={cn("mt-0.5 size-9 shrink-0 rounded-full", toneClass[item.tone])}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-text-primary">{item.title}</span>
                      <span className="block text-[12px] text-text-secondary">{item.detail}</span>
                    </span>
                  </li>
                ))
              )}
            </ul>
            <Link
              href={routes.agency.stores(agencySlug)}
              className="inline-flex text-[12.5px] font-medium text-brand-primary hover:underline"
            >
              Ver toda la actividad →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold text-text-primary">Uso del plan (agencia)</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-medium text-text-primary">Plan {planName}</p>
              <AgencyStatusPill label={planActive ? "Activo" : "Inactivo"} tone={planActive ? "success" : "neutral"} />
            </div>
            <UsageBar
              valueLabel={`${orderCount.toLocaleString("es")} / ${orderLimit.toLocaleString("es")} pedidos · ${orderPct}%`}
              ratio={orderRatio}
            />
            <dl className="space-y-2 text-[12.5px]">
              {[
                ["Tiendas", `${storeCount} / ${storeLimit}`],
                ["Pedidos (mes)", `${orderCount.toLocaleString("es")} / ${orderLimit.toLocaleString("es")}`],
                ["Miembros", `${memberCount} / ${memberLimit}`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <dt className="text-text-secondary">{k}</dt>
                  <dd className={cn("font-semibold", k === "Tiendas" && storesOver && "text-danger")}>{v}</dd>
                </div>
              ))}
            </dl>
            {canViewBilling ? (
              <Link
                href={routes.agency.billing(agencySlug)}
                className={cn(
                  "inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-surface-elevated px-4 text-sm font-medium text-text-primary",
                  "transition-colors hover:bg-muted sm:w-auto",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                Ver detalles del plan
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
