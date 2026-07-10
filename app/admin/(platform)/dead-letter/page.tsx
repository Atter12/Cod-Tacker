import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export default function AdminDeadLetterPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Cola de errores" description="Eventos que no pudieron procesarse." />
      <EmptyState title="Sin eventos de cola de errores" description="El contrato actual de raw_events no expone un campo status=dead_letter; esta vista se activará cuando exista." />
    </div>
  );
}
