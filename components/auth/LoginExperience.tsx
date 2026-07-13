import type { CSSProperties } from "react";
import { AuthForm } from "@/components/AuthForm";
import { LoginBrand } from "@/components/auth/LoginBrand";
import { LoginShowcase } from "@/components/auth/LoginShowcase";
import { BrandFavicon } from "@/components/branding/BrandFavicon";
import {
  agencyBrandCssVars,
  softTintFromPrimary,
  type AgencyBrandTheme,
} from "@/lib/branding/theme";

export function LoginExperience({
  next,
  brand,
}: {
  next?: string;
  brand?: AgencyBrandTheme | null;
}) {
  const branded = Boolean(brand);
  const primary = brand?.primaryColor || "#22D3EE";
  const secondary = brand?.secondaryColor || "#19C7B5";
  const brandStyle = brand ? (agencyBrandCssVars(brand) as CSSProperties) : undefined;

  const backgroundStyle: CSSProperties | undefined = brand?.loginBackgroundUrl
    ? {
        backgroundImage: `linear-gradient(145deg, rgba(5,11,22,0.72), rgba(5,11,22,0.88)), url(${brand.loginBackgroundUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : brand
      ? {
          background: `radial-gradient(1200px 600px at 80% -10%, ${softTintFromPrimary(primary, 0.82)}22, transparent 60%), #050B16`,
        }
      : undefined;

  const supportBits = [
    brand?.supportEmail ? brand.supportEmail : null,
    brand?.supportWhatsapp ? `WA ${brand.supportWhatsapp}` : null,
  ].filter(Boolean);

  return (
    <main
      className="login-experience relative min-h-screen overflow-x-hidden bg-[#050B16] text-[#F8FAFC]"
      style={{ ...brandStyle, ...backgroundStyle }}
    >
      <BrandFavicon href={brand?.faviconUrl} />

      {!brand?.loginBackgroundUrl ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="login-experience-grid absolute inset-0 opacity-[0.035]" />
          <div
            className="absolute -right-24 top-[-8%] size-[420px] rounded-full blur-3xl"
            style={{ backgroundColor: branded ? `${primary}59` : "rgba(22,78,99,0.35)" }}
          />
          <div
            className="absolute -left-28 bottom-[-10%] size-[380px] rounded-full blur-3xl"
            style={{ backgroundColor: branded ? `${secondary}2E` : "rgba(25,199,181,0.18)" }}
          />
          <div className="absolute bottom-[8%] left-1/2 size-[280px] -translate-x-1/2 rounded-full bg-[#EA580C]/10 blur-3xl" />
          <div className="absolute right-[8%] top-1/2 size-[360px] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.12),transparent_70%)]" />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[#050B16]/25" aria-hidden />
      )}

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1320px] flex-col px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
        <header className="mb-8 flex items-start justify-between gap-4 lg:mb-10">
          <LoginBrand brand={brand} />
          <p className="hidden items-center gap-2 rounded-full border border-[rgba(76,139,170,0.25)] bg-[#0A1729]/80 px-3 py-1.5 text-[11px] text-[#94A3B8] sm:inline-flex">
            <span className="size-1.5 rounded-full bg-[#22C55E]" aria-hidden />
            Plataforma multi-tienda
          </p>
        </header>

        <div className="grid flex-1 items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-20 xl:gap-24">
          <div className="hidden min-h-[520px] lg:flex">
            <LoginShowcase brand={brand} />
          </div>

          <div className="mx-auto w-full max-w-[440px] lg:mx-0 lg:justify-self-end">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[rgba(76,139,170,0.25)] bg-[#0A1729]/80 px-3 py-1.5 text-[11px] text-[#94A3B8] sm:hidden">
              <span className="size-1.5 rounded-full bg-[#22C55E]" aria-hidden />
              Plataforma multi-tienda
            </p>

            <section className="login-form-card relative overflow-hidden rounded-[24px] border border-[rgba(76,139,170,0.22)] bg-[#0D1B30]/95 p-8 shadow-[0_28px_60px_rgba(0,0,0,0.4)] backdrop-blur-sm motion-safe:animate-[login-card-in_300ms_ease-out]">
              <div
                className="absolute inset-x-0 top-0 h-[3px]"
                style={{
                  background: `linear-gradient(to right, ${primary}, ${secondary})`,
                }}
                aria-hidden
              />
              <AuthForm
                kind="login"
                next={next}
                appearance="login"
                productName={brand?.productName}
              />
              {supportBits.length ? (
                <p className="mt-5 text-center text-[11.5px] text-[#94A3B8]">
                  Soporte: {supportBits.join(" · ")}
                </p>
              ) : null}
              {brand && !brand.hideCodtrackedBranding ? (
                <p className="mt-3 text-center text-[11px] text-[#64748B]">Powered by CODTracked</p>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
