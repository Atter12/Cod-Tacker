import "server-only";
import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import type { TenantMembership } from "@/lib/tenant/tenant-context";
export async function requireAgencyAccess(agencySlug: string): Promise<TenantMembership> { const membership = (await getCurrentTenant()).find((item) => item.agencySlug === agencySlug); if (!membership) redirect("/unauthorized"); return membership; }
