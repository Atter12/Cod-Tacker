import { requireUser } from "@/lib/auth/require-user";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";

export async function GET() {
  await requireUser();
  return Response.json({ tenants: await getCurrentTenant() });
}
