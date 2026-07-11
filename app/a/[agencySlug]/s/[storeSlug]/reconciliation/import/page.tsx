import { ErrorState, SectionHeader } from "@/components/ui";
import { ImportWizard } from "@/components/reconciliation/ImportWizard";
import { can } from "@/lib/permissions/can";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";

export default async function ReconciliationImportPage({
  params,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string }>;
}) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "reconciliation.manage")) {
    return (
      <ErrorState
        title="Sin permiso"
        description="Necesitas permiso de gestión de conciliación para importar CSV."
      />
    );
  }

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Importar liquidación CSV"
        description="Wizard: subir → mapear → validar → encolar job → matching."
      />
      <ImportWizard agencySlug={p.agencySlug} storeSlug={p.storeSlug} />
    </section>
  );
}
