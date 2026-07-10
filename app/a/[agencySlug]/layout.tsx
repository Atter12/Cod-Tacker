import { requireUser } from "@/lib/auth/require-user";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";

/** Auth/tenant guard only — AppShell lives in (agency) or store layouts to avoid nesting. */
export default async function AgencyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ agencySlug: string }>;
}) {
  const { agencySlug } = await params;
  await Promise.all([requireUser(), requireAgencyAccess(agencySlug)]);
  return children;
}
