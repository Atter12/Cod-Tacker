import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getPlatformAuditLogs } from "@/services/admin.service";

export default async function AdminAuditPage() {
  const logs = await getPlatformAuditLogs(await createClient());
  return (
    <div className="space-y-6">
      <PageHeader title="Auditoría" description="Registros accesibles para el administrador de plataforma." />
      <Card>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <p className="p-4 text-sm text-text-secondary">No hay registros de auditoría accesibles.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-text-secondary">
                  <th className="px-4 py-2">Acción</th>
                  <th className="px-4 py-2">Entidad</th>
                  <th className="px-4 py-2">ID entidad</th>
                  <th className="px-4 py-2">Actor</th>
                  <th className="px-4 py-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{log.action}</td>
                    <td className="px-4 py-2">{log.entity_type}</td>
                    <td className="px-4 py-2 font-mono">{log.entity_id ?? "—"}</td>
                    <td className="px-4 py-2 font-mono">{log.actor_id ?? "—"}</td>
                    <td className="px-4 py-2">{new Date(log.created_at).toLocaleString("es")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
