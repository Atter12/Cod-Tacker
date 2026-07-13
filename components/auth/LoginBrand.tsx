import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type { AgencyBrandTheme } from "@/lib/branding/theme";
import { brandInitialLetter } from "@/lib/branding/theme";

export function LoginBrand({
  className,
  brand,
}: {
  className?: string;
  brand?: AgencyBrandTheme | null;
}) {
  const productName = brand?.productName?.trim() || "CODTracked";
  const tagline = brand
    ? "Acceso a tu consola operativa"
    : "Control operativo para ecommerce COD";

  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[rgba(34,211,238,0.55)]",
        className,
      )}
    >
      {brand?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.logoUrl}
          alt=""
          className="size-10 shrink-0 rounded-[10px] object-contain"
        />
      ) : brand ? (
        <span
          className="grid size-10 shrink-0 place-items-center rounded-[10px] text-[15px] font-bold text-white"
          style={{ backgroundColor: brand.primaryColor }}
          aria-hidden
        >
          {brandInitialLetter(productName)}
        </span>
      ) : (
        <span
          className="grid size-10 shrink-0 place-items-center rounded-[10px] border border-[rgba(34,211,238,0.28)] bg-[#0A1729] shadow-[inset_0_1px_0_rgba(34,211,238,0.12)]"
          aria-hidden
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M9 2.2 15.2 14.5H2.8L9 2.2Z"
              stroke="#22D3EE"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path d="M9 7.2v5.2" stroke="#19C7B5" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="9" cy="14.2" r="0.9" fill="#19C7B5" />
          </svg>
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[20px] font-bold leading-tight tracking-tight text-[#F8FAFC]">
          {productName}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-[#94A3B8]">{tagline}</span>
      </span>
    </Link>
  );
}
