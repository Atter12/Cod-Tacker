import "server-only";

import { StatusBadge } from "@/components/ui";
import { FlipyTransferGananciasPanel } from "@/components/integrations/FlipyTransferGananciasPanel";
import { createFlipyPartnerClient } from "@/lib/integrations/flipy/client";
import {
  readFlipyTiendaId,
  resolveFlipyPartnerKeyFromIntegration,
} from "@/lib/integrations/flipy/credentials";
import { getFlipyEnv } from "@/lib/integrations/flipy/env";
import type { IntegrationRow } from "@/types/database";

type Props = {
  integration: IntegrationRow;
  storeId: string;
  agencySlug: string;
  storeSlug: string;
  appOrigin?: string | null;
  embedOrigin?: string | null;
  canManage?: boolean;
};

export async function FlipySaldoCard({
  integration,
  storeId,
  agencySlug,
  storeSlug,
  appOrigin = null,
  embedOrigin = null,
  canManage = false,
}: Props) {
  const flipyTiendaId = readFlipyTiendaId(integration.settings) ?? integration.external_account_id;
  const partnerKey = resolveFlipyPartnerKeyFromIntegration(integration);
  const env = getFlipyEnv();
  const resolvedEmbedOrigin = (embedOrigin ?? env.embedOrigin).replace(/\/$/, "");
  if (!flipyTiendaId || !partnerKey) {
    return (
      <section className="space-y-3">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
              Billetera Flipy
            </p>
            <h2 className="text-base font-semibold text-text-primary">Panel de operaciones</h2>
          </div>
        </header>
        <div className="rounded-[11px] border border-border bg-surface-elevated p-4 shadow-[var(--card-shadow)]">
          <p className="text-sm text-text-secondary">Reconecta Flipy para ver saldos.</p>
        </div>
      </section>
    );
  }

  const client = createFlipyPartnerClient({
    baseUrl: env.apiBaseUrl,
    partnerKey,
    partnerId: env.partnerId,
    externalStoreId: storeId,
  });

  try {
    const saldo = await client.getSaldo(flipyTiendaId);
    return (
      <section className="space-y-3">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
              Billetera Flipy
            </p>
            <h2 className="text-base font-semibold text-text-primary">Panel de operaciones</h2>
          </div>
          <StatusBadge
            status={saldo.warningBajo ? "degraded" : "healthy"}
            label={saldo.warningBajo ? "Operaciones bajo" : "OK"}
          />
        </header>
        <div className="rounded-[11px] border border-border bg-surface-elevated p-4 shadow-[var(--card-shadow)] sm:p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
            Saldos actuales
          </p>
          <FlipyTransferGananciasPanel
            agencySlug={agencySlug}
            storeSlug={storeSlug}
            storeId={storeId}
            billeteraOperaciones={saldo.billeteraOperaciones}
            billeteraGanancias={saldo.billeteraGanancias}
            billeteraReservado={saldo.billeteraReservado}
            transferGananciasDisponible={
              canManage ? saldo.transferGananciasDisponible : false
            }
            destinoRetiroConfigurado={saldo.destinoRetiroConfigurado}
            appOrigin={appOrigin}
            embedOrigin={resolvedEmbedOrigin}
          />
        </div>
      </section>
    );
  } catch (error) {
    return (
      <section className="space-y-3">
        <header>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
            Billetera Flipy
          </p>
          <h2 className="text-base font-semibold text-text-primary">Panel de operaciones</h2>
        </header>
        <div className="rounded-[11px] border border-border bg-surface-elevated p-4 shadow-[var(--card-shadow)]">
          <p className="text-sm text-text-secondary">
            {error instanceof Error ? error.message : "No se pudo consultar saldo."}
          </p>
        </div>
      </section>
    );
  }
}
