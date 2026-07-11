"use client";

import { useRouter } from "next/navigation";

export function IntegrationsLoadError() {
  const router = useRouter();

  return (
    <div className="rounded-[10px] border border-border bg-surface-elevated px-5 py-6 shadow-[var(--card-shadow)]">
      <h2 className="text-[14px] font-semibold text-text-primary">
        No se pudieron cargar las integraciones
      </h2>
      <p className="mt-1 text-[13px] text-text-secondary">
        Actualiza la página o inténtalo nuevamente en unos momentos.
      </p>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="mt-4 inline-flex h-[34px] items-center justify-center rounded-[7px] border border-brand-primary px-4 text-[12px] font-medium text-brand-primary transition-colors hover:bg-brand-softer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Reintentar
      </button>
    </div>
  );
}
