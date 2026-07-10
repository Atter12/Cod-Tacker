import { SectionHeader, Card, CardContent } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";

export default async function AgencyBillingPage({ params }: { params: Promise<{ agencySlug: string }> }) {
  const p = await params;
  const membership = await requireAgencyAccess(p.agencySlug);
  const { data: subscription } = await (await createClient())
    .from("subscriptions")
    .select("id, status, billing_provider, current_period_start, current_period_end, cancel_at_period_end, trial_ends_at")
    .eq("agency_id", membership.agencyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (
    <section className="space-y-6">
      <SectionHeader title="Facturación" description="Estado de la suscripción activa." />
      <Card>
        <CardContent>
          {subscription ? (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-text-secondary">Estado</dt>
                <dd className="font-medium">{subscription.status}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Proveedor</dt>
                <dd>{subscription.billing_provider ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Período actual</dt>
                <dd>
                  {subscription.current_period_start
                    ? new Date(subscription.current_period_start).toLocaleDateString("es")
                    : "—"}
                  {" — "}
                  {subscription.current_period_end
                    ? new Date(subscription.current_period_end).toLocaleDateString("es")
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Cancelación al vencer</dt>
                <dd>{subscription.cancel_at_period_end ? "Sí" : "No"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-text-secondary">No hay suscripción activa para esta agencia.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
