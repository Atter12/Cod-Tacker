import { routes } from "@/config/routes";
import type { TenantMembership } from "@/lib/tenant/tenant-context";
export function resolveTenantRedirect(memberships: TenantMembership[]): string { const stores = memberships.filter((membership): membership is TenantMembership & { storeId: string; storeSlug: string } => Boolean(membership.storeId && membership.storeSlug)); const store = stores[0]; if (!store) return "/pending"; if (stores.length === 1) return routes.store.dashboard(store.agencySlug, store.storeSlug); return routes.app.selectTenant; }
