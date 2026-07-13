import type { AgencyBrandTheme } from "@/lib/branding/theme";

const stores = [
  { name: "Holistic", initial: "H", color: "#19C7B5", selected: true },
  { name: "Flippy", initial: "F", color: "#38BDF8", selected: false },
  { name: "Nueva", initial: "N", color: "#FB923C", selected: false },
] as const;

const metrics = [
  { label: "Pedidos", value: "1,248", hint: "↗ activo", tone: "up" as const },
  { label: "Entregados", value: "942", hint: "↗ activo", tone: "up" as const },
  { label: "RTO", value: "4.2 %", hint: "↘ controlado", tone: "down" as const },
];

export function LoginShowcase({ brand }: { brand?: AgencyBrandTheme | null }) {
  const productName = brand?.productName?.trim() || "CODTracked";
  const accent = brand?.primaryColor || "#22D3EE";
  const secondary = brand?.secondaryColor || "#19C7B5";

  return (
    <section
      className="login-showcase relative flex min-h-0 flex-1 flex-col rounded-[26px] border border-[rgba(76,139,170,0.22)] bg-[#0A1729]/80 p-9 shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
      aria-hidden="true"
    >
      <h2 className="max-w-[20ch] text-[42px] font-bold leading-[1.08] tracking-tight text-[#F8FAFC]">
        Gestiona tus tiendas COD
        <br />
        desde un solo lugar
      </h2>
      <p className="mt-5 max-w-[560px] text-[15px] leading-relaxed text-[#94A3B8]">
        {brand
          ? `${productName} centraliza pedidos, confirmaciones, entregas, RTO, devoluciones e integraciones para todas tus tiendas.`
          : "CODTracked centraliza pedidos, confirmaciones, entregas, RTO, devoluciones e integraciones para todas tus tiendas."}
      </p>

      <div className="mt-8 grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-[rgba(76,139,170,0.18)] bg-[#071426]/90 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[13px] font-medium text-[#F8FAFC]">Resumen operativo</p>
            <p className="text-[12px] font-medium" style={{ color: accent }}>
              {productName}
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl border border-[rgba(76,139,170,0.16)] bg-[#0D1B30] px-3.5 py-3"
              >
                <p className="text-[11px] text-[#94A3B8]">{metric.label}</p>
                <p className="mt-1 text-[24px] font-semibold tracking-tight text-[#F8FAFC]">
                  {metric.value}
                </p>
                <p
                  className={
                    metric.tone === "up"
                      ? "mt-1 text-[11px] text-[#22C55E]"
                      : "mt-1 text-[11px] text-[#94A3B8]"
                  }
                >
                  {metric.hint}
                </p>
              </div>
            ))}
          </div>

          <svg
            className="mt-5 h-24 w-full"
            viewBox="0 0 420 96"
            fill="none"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="loginChartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity="0.22" />
                <stop offset="100%" stopColor={accent} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 68 C40 62 70 48 110 52 C150 56 170 72 210 58 C250 44 280 28 320 34 C360 40 390 48 420 30 L420 96 L0 96 Z"
              fill="url(#loginChartFill)"
            />
            <path
              d="M0 68 C40 62 70 48 110 52 C150 56 170 72 210 58 C250 44 280 28 320 34 C360 40 390 48 420 30"
              stroke={accent}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="hidden w-[148px] shrink-0 flex-col gap-2.5 xl:flex">
          {stores.map((store, index) => (
            <div
              key={store.name}
              className={
                store.selected
                  ? "flex items-center gap-2.5 rounded-xl border bg-[#0D1B30] px-3 py-2.5"
                  : "flex items-center gap-2.5 rounded-xl border border-[rgba(76,139,170,0.16)] bg-[#0D1B30]/70 px-3 py-2.5"
              }
              style={
                store.selected
                  ? { borderColor: `${secondary}8C` }
                  : undefined
              }
            >
              <span
                className="grid size-8 place-items-center rounded-full text-xs font-semibold text-[#050B16]"
                style={{
                  backgroundColor: index === 0 && brand ? accent : store.color,
                }}
              >
                {store.initial}
              </span>
              <span className="text-[13px] font-medium text-[#F8FAFC]">{store.name}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-6 text-[12px] text-[#64748B]">
        Diseñado para entrar, elegir tienda y operar rápido.
      </p>
    </section>
  );
}
