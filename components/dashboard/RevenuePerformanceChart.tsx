"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Tooltip as UiTooltip } from "@/components/ui/Tooltip";
import { formatCurrency } from "@/lib/formatting/currency";
import {
  chartLineCursor,
  chartTooltipContentStyle,
  chartTooltipLabelStyle,
} from "@/lib/charts/recharts-tooltip";
import { cn } from "@/lib/utils/cn";
import type { DashboardTimeSeriesPoint } from "@/types/dashboard";

type Granularity = "daily" | "weekly" | "monthly";

const granularityLabels: Record<Granularity, string> = {
  daily: "Diario",
  weekly: "Semanal",
  monthly: "Mensual",
};

function startOfWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function aggregate(
  points: DashboardTimeSeriesPoint[],
  granularity: Granularity,
): Array<{ key: string; label: string; cashSettled: number; ordersGenerated: number }> {
  if (granularity === "daily") {
    return points.map((point) => ({
      key: point.date,
      label: formatShortDate(point.date),
      cashSettled: point.cashSettled,
      ordersGenerated: point.ordersGenerated,
    }));
  }

  const buckets = new Map<
    string,
    { key: string; label: string; cashSettled: number; ordersGenerated: number }
  >();

  for (const point of points) {
    const date = new Date(`${point.date}T00:00:00.000Z`);
    const key = granularity === "weekly" ? startOfWeek(date) : monthKey(point.date);
    const existing = buckets.get(key);
    if (existing) {
      existing.cashSettled += point.cashSettled;
      existing.ordersGenerated += point.ordersGenerated;
    } else {
      buckets.set(key, {
        key,
        label: granularity === "weekly" ? formatShortDate(key) : formatMonth(key),
        cashSettled: point.cashSettled,
        ordersGenerated: point.ordersGenerated,
      });
    }
  }

  return [...buckets.values()];
}

function formatShortDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function formatMonth(ym: string): string {
  const date = new Date(`${ym}-01T00:00:00.000Z`);
  return new Intl.DateTimeFormat("es-PE", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function formatFullDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function abbreviateCurrency(value: number, currencyCode: string): string {
  const prefix = currencyCode === "PEN" ? "S/" : currencyCode;
  if (Math.abs(value) >= 1000) return `${prefix} ${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `${prefix} ${Math.round(value)}`;
}

export function RevenuePerformanceChart({
  timeSeries,
  currencyCode,
}: {
  timeSeries: DashboardTimeSeriesPoint[];
  currencyCode: string;
}) {
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const data = useMemo(() => aggregate(timeSeries, granularity), [timeSeries, granularity]);
  const hasData = data.some((point) => point.cashSettled > 0 || point.ordersGenerated > 0);
  const currencyLabel = currencyCode === "PEN" ? "S/" : currencyCode;

  return (
    <article className="flex h-full min-h-[320px] flex-col rounded-[11px] border border-border bg-surface-elevated p-4 shadow-[var(--card-shadow)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-[13px] font-semibold text-text-primary">Ingresos y rendimiento</h2>
            <UiTooltip content="Efectivo liquidado (Conciliación) y pedidos generados en el período.">
              <Info className="size-3.5 text-text-secondary" aria-hidden />
            </UiTooltip>
          </div>
        </div>
        <div className="inline-flex rounded-md border border-border bg-surface p-0.5" role="tablist" aria-label="Granularidad">
          {(Object.keys(granularityLabels) as Granularity[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={granularity === key}
              className={cn(
                "rounded px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                granularity === key
                  ? "bg-surface-elevated text-brand-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary",
              )}
              onClick={() => setGranularity(key)}
            >
              {granularityLabels[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-3 min-h-0 flex-1" aria-label="Gráfico de ingresos y rendimiento">
        {!hasData ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <p className="rounded-md bg-surface-elevated/90 px-3 py-2 text-center text-[12px] text-text-secondary">
              No hay datos suficientes para este período.
            </p>
          </div>
        ) : null}
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              stroke="var(--text-secondary)"
              minTickGap={24}
            />
            <YAxis
              yAxisId="cash"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              stroke="var(--text-secondary)"
              tickFormatter={(value: number) => abbreviateCurrency(value, currencyCode)}
              width={52}
            />
            <YAxis
              yAxisId="orders"
              orientation="right"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              stroke="var(--text-secondary)"
              width={36}
            />
            <Tooltip
              cursor={chartLineCursor}
              contentStyle={chartTooltipContentStyle}
              labelStyle={chartTooltipLabelStyle}
              formatter={(value, name) => {
                const numeric = typeof value === "number" ? value : Number(value ?? 0);
                if (name === "cashSettled") {
                  return [formatCurrency(numeric, currencyCode), `Efectivo liquidado (${currencyLabel})`];
                }
                return [numeric.toLocaleString("es-PE"), "Pedidos generados"];
              }}
              labelFormatter={(label, payload) => {
                const key = payload?.[0]?.payload?.key as string | undefined;
                return key ? formatFullDate(key.length === 7 ? `${key}-01` : key) : String(label);
              }}
            />
            <Legend
              verticalAlign="top"
              align="left"
              height={28}
              iconType="plainline"
              formatter={(value) =>
                value === "cashSettled"
                  ? `Efectivo liquidado (${currencyLabel})`
                  : "Pedidos generados"
              }
              wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }}
            />
            <Area
              yAxisId="cash"
              type="monotone"
              dataKey="cashSettled"
              stroke="var(--brand-primary)"
              fill="var(--brand-soft)"
              strokeWidth={2}
              fillOpacity={0.45}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="orders"
              type="monotone"
              dataKey="ordersGenerated"
              stroke="var(--brand-secondary)"
              strokeWidth={1.8}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
