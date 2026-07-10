import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export default function AdminWebhooksPage() {
  return <div className="space-y-6"><PageHeader title="Webhooks" description="Monitoreo de entregas de webhook." /><EmptyState title="Sin webhooks configurados" description="Aún no hay una fuente de eventos de webhook conectada a este panel." /></div>;
}
