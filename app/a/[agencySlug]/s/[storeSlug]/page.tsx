import { redirect } from "next/navigation";
import { routes } from "@/config/routes";

/** Store root has no page; send users to the operational dashboard. */
export default async function StoreIndexPage({
  params,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string }>;
}) {
  const { agencySlug, storeSlug } = await params;
  redirect(routes.store.dashboard(agencySlug, storeSlug));
}
