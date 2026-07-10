import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export default function AdminJobsPage() {
  return <div className="space-y-6"><PageHeader title="Tareas" description="Estado de workers y tareas en segundo plano." /><EmptyState title="Sin workers configurados" description="La infraestructura de workers todavía no está conectada a este panel." /></div>;
}
