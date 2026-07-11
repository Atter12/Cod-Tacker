import { ErrorState, SectionHeader } from "@/components/ui";
import { AutomationRuleForm } from "@/components/automations/AutomationRuleForm";
import { can } from "@/lib/permissions/can";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";

export default async function NewAutomationPage({
  params,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string }>;
}) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "automations.manage")) {
    return <ErrorState title="Sin permiso" description="No puedes crear reglas." />;
  }
  return (
    <section className="space-y-5">
      <SectionHeader title="Nueva automatización" description="Formulario tipado con validación Zod en servidor." />
      <AutomationRuleForm agencySlug={p.agencySlug} storeSlug={p.storeSlug} />
    </section>
  );
}
