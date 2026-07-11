import Link from "next/link";
import { routes } from "@/config/routes";

export function EmptyStoresState({ canCreate, createHref }: { canCreate: boolean; createHref: string | null }) {
  return (
    <div className="rounded-[16px] border border-[rgba(76,139,170,0.22)] bg-[#0A1729] px-6 py-10 text-center">
      <h2 className="text-lg font-semibold text-[#F8FAFC]">No tienes tiendas disponibles</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#94A3B8]">
        Crea tu primera tienda o solicita acceso a una agencia para comenzar.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        {canCreate && createHref ? (
          <Link
            href={createHref}
            className="inline-flex h-10 items-center rounded-[10px] bg-[#19C7B5] px-4 text-sm font-semibold text-[#042F2E] hover:bg-[#14B8A6]"
          >
            Crear tienda
          </Link>
        ) : null}
        <Link
          href={routes.app.onboarding}
          className="inline-flex h-10 items-center rounded-[10px] border border-[rgba(76,139,170,0.35)] px-4 text-sm text-[#E2E8F0] hover:border-[rgba(34,211,238,0.45)]"
        >
          Ir al onboarding
        </Link>
      </div>
    </div>
  );
}
