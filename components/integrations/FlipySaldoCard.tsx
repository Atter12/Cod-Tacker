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
  canManage?: boolean;
};

export async function FlipySaldoCard({
  integration,
  storeId,
  agencySlug,
  storeSlug,
  appOrigin = null,
  canManage = false,
}: Props) {
  const flipyTiendaId = readFlipyTiendaId(integration.settings) ?? integration.external_account_id;
  const partnerKey = resolveFlipyPartnerKeyFromIntegration(integration);
  if (!flipyTiendaId || !partnerKey) {
    return (
      <div className="rounded-lg border border-border bg-surface-elevated p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Billetera Flipy</p>
        <p className="mt-2 text-sm text-text-secondary">Reconecta Flipy para ver saldos.</p>
      </div>
    );
  }

  const env = getFlipyEnv();
  const client = createFlipyPartnerClient({
    baseUrl: env.apiBaseUrl,
    partnerKey,
    partnerId: env.partnerId,
    externalStoreId: storeId,
  });

  try {
    const saldo = await client.getSaldo(flipyTiendaId);
    return (
      <div className="rounded-lg border border-border bg-surface-elevated p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Billetera Flipy
          </p>
          <StatusBadge
            status={saldo.warningBajo ? "degraded" : "healthy"}
            label={saldo.warningBajo ? "Operaciones bajo" : "OK"}
          />
        </div>
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
        />
      </div>
    );
  } catch (error) {
    return (
      <div className="rounded-lg border border-border bg-surface-elevated p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Billetera Flipy</p>
        <p className="mt-2 text-sm text-text-secondary">
          {error instanceof Error ? error.message : "No se pudo consultar saldo."}
        </p>
      </div>
    );
  }
}
