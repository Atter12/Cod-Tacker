import "server-only";
import { cookies } from "next/headers";

const agencyCookie = "codtracked-active-agency";
const storeCookie = "codtracked-active-store";
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 };

export type ActiveTenantPreference = { agencySlug: string | null; storeSlug: string | null };

/** This is a navigation preference only; callers must still verify tenant access through RLS or guards. */
export async function getActiveTenantPreference(): Promise<ActiveTenantPreference> {
  const store = await cookies();
  return { agencySlug: store.get(agencyCookie)?.value ?? null, storeSlug: store.get(storeCookie)?.value ?? null };
}

/** This is a navigation preference only; callers must still verify tenant access through RLS or guards. */
export async function setActiveTenantPreference(agencySlug: string, storeSlug?: string): Promise<void> {
  const store = await cookies();
  store.set(agencyCookie, agencySlug, cookieOptions);
  if (storeSlug) store.set(storeCookie, storeSlug, cookieOptions);
  else store.delete(storeCookie);
}
