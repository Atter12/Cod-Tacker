import { AuthForm } from "@/components/AuthForm";
import { LoginBrand } from "@/components/auth/LoginBrand";
import { LoginShowcase } from "@/components/auth/LoginShowcase";

export function LoginExperience({ next }: { next?: string }) {
  return (
    <main className="login-experience relative min-h-screen overflow-x-hidden bg-[#050B16] text-[#F8FAFC]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="login-experience-grid absolute inset-0 opacity-[0.035]" />
        <div className="absolute -right-24 top-[-8%] size-[420px] rounded-full bg-[#164E63]/35 blur-3xl" />
        <div className="absolute -left-28 bottom-[-10%] size-[380px] rounded-full bg-[#19C7B5]/18 blur-3xl" />
        <div className="absolute bottom-[8%] left-1/2 size-[280px] -translate-x-1/2 rounded-full bg-[#EA580C]/10 blur-3xl" />
        <div className="absolute right-[8%] top-1/2 size-[360px] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.12),transparent_70%)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1320px] flex-col px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
        <header className="mb-8 flex items-start justify-between gap-4 lg:mb-10">
          <LoginBrand />
          <p className="hidden items-center gap-2 rounded-full border border-[rgba(76,139,170,0.25)] bg-[#0A1729]/80 px-3 py-1.5 text-[11px] text-[#94A3B8] sm:inline-flex">
            <span className="size-1.5 rounded-full bg-[#22C55E]" aria-hidden />
            Plataforma multi-tienda
          </p>
        </header>

        <div className="grid flex-1 items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-20 xl:gap-24">
          <div className="hidden min-h-[520px] lg:flex">
            <LoginShowcase />
          </div>

          <div className="mx-auto w-full max-w-[440px] lg:mx-0 lg:justify-self-end">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[rgba(76,139,170,0.25)] bg-[#0A1729]/80 px-3 py-1.5 text-[11px] text-[#94A3B8] sm:hidden">
              <span className="size-1.5 rounded-full bg-[#22C55E]" aria-hidden />
              Plataforma multi-tienda
            </p>

            <section className="login-form-card relative overflow-hidden rounded-[24px] border border-[rgba(76,139,170,0.22)] bg-[#0D1B30] p-8 shadow-[0_28px_60px_rgba(0,0,0,0.4)] motion-safe:animate-[login-card-in_300ms_ease-out]">
              <div
                className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#22D3EE] via-[#19C7B5] to-[#14B8A6]"
                aria-hidden
              />
              <AuthForm kind="login" next={next} appearance="login" />
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
