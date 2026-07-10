import type { Role } from "@/config/permissions";
export type TenantContext = { userId: string; agencyId: string; agencySlug: string; storeId?: string; storeSlug?: string; roles: Role[] };
export type TenantMembership = { agencyId: string; agencySlug: string; storeId?: string; storeSlug?: string; roles: Role[] };
