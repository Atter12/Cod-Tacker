import Link from "next/link";
import { redirect } from "next/navigation";
import { StoreSelectorExperience } from "@/components/store-selector/StoreSelectorExperience";
import { requireUser } from "@/lib/auth/require-user";
import { getAccessState } from "@/lib/tenant/get-access-state";
import { getStoreSelectorPageData } from "@/services/store-selector.service";
import { routes } from "@/config/routes";

export default async function DashboardResolver() {
  await requireUser();
  const access = await getAccessState();

  if (access.kind === "onboarding") {
    redirect(routes.app.onboarding);
  }

  if (access.kind === "pending_invite") {
    return (
      <main className="store-selector-experience flex min-h-screen flex-col items-center justify-center gap-4 bg-[#050B16] px-4 text-center text-[#F8FAFC]">
        <h1 className="text-2xl font-semibold">Tienes una invitación pendiente</h1>
        <p className="max-w-md text-sm text-[#94A3B8]">
          Usa el enlace que te compartió el administrador de la agencia. Si no lo tienes, pídeselo de
          nuevo.
        </p>
        <Link href={routes.app.invitesAccept} className="text-sm text-[#22D3EE]">
          Abrir página de aceptación
        </Link>
      </main>
    );
  }

  const data = await getStoreSelectorPageData();
  return <StoreSelectorExperience data={data} />;
}
