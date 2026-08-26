import type { JobsAdminClient } from "@/lib/jobs/types";

/** Invalidates integration pages so FlipySaldoCard refetches after wallet events. */
export async function revalidateFlipyWalletIntegrationPages(
  admin: JobsAdminClient,
  agencyId: string,
  storeId: string,
): Promise<void> {
  try {
    const [agencyRes, storeRes] = await Promise.all([
      admin.from("agencies").select("slug").eq("id", agencyId).maybeSingle(),
      admin.from("stores").select("slug").eq("id", storeId).maybeSingle(),
    ]);
    const agencySlug = agencyRes.data?.slug;
    const storeSlug = storeRes.data?.slug;
    if (!agencySlug || !storeSlug) return;

    const { revalidatePath } = await import("next/cache");
    const { routes } = await import("@/config/routes");
    revalidatePath(routes.store.integrations(agencySlug, storeSlug));
    revalidatePath(routes.store.integrationDetail(agencySlug, storeSlug, "flipy"));
  } catch {
    // Non-blocking cache bust for wallet saldo.
  }
}
