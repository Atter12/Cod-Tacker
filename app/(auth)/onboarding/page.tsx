import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { requireUser } from "@/lib/auth/require-user";
import { getAccessState } from "@/lib/tenant/get-access-state";
import { routes } from "@/config/routes";

export default async function OnboardingPage() {
  await requireUser();
  const access = await getAccessState();

  if (access.kind === "ready") {
    const first = access.stores[0];
    if (first) redirect(routes.store.dashboard(first.agencySlug, first.storeSlug));
  }
  if (access.kind === "pending_invite") {
    redirect(routes.app.dashboard);
  }

  return <OnboardingWizard />;
}
