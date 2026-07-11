import { formatCurrency } from "@/lib/formatting/currency";
import type { AccountSelectorSummary } from "@/services/store-selector.service";
import { cn } from "@/lib/utils/cn";

export function AccountSummary({
  summary,
  error,
  embedded = false,
}: {
  summary: AccountSelectorSummary | null;
  error: string | null;
  embedded?: boolean;
}) {
  const collectedLabel =
    summary?.hasMixedCurrencies || summary?.collectedLast30Days == null
      ? "Varias monedas"
      : formatCurrency(summary.collectedLast30Days, summary.currencyCode ?? "PEN");

  const metrics = [
    { label: "Tiendas disponibles", value: summary ? String(summary.stores) : "—" },
    { label: "Integraciones activas", value: summary ? String(summary.activeIntegrations) : "—" },
    {
      label: "Pedidos 30d",
      value: summary ? summary.ordersLast30Days.toLocaleString("es-PE") : "—",
    },
    { label: "Cobrado 30d", value: summary ? collectedLabel : "—" },
  ];

  return (
    <aside
      className={cn(
        !embedded &&
          "rounded-[18px] border border-[rgba(76,139,170,0.2)] bg-[#09162A] p-5 shadow-[0_16px_36px_rgba(0,0,0,0.25)]",
      )}
    >
      <h2 className="text-[15px] font-semibold text-[#F8FAFC]">Resumen de cuenta</h2>
      {error ? (
        <p className="mt-3 text-[12.5px] text-[#FCA5A5]" role="status">
          {error}
        </p>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-1 lg:gap-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-[12px] border border-[rgba(76,139,170,0.16)] bg-[#0D1B30] px-3 py-3"
          >
            <p className="text-[22px] font-semibold tracking-tight text-[#22D3EE] sm:text-[24px]">
              {metric.value}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-[#94A3B8]">{metric.label}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}
