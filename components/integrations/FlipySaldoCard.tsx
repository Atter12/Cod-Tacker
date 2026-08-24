import "server-only";

import { StatusBadge } from "@/components/ui";
import { createFlipyPartnerClient } from "@/lib/integrations/flipy/client";
import {
  readFlipyTiendaId,
  resolveFlipyPartnerKeyFromIntegration,
} from "@/lib/integrations/flipy/credentials";
import { getFlipyEnv } from "@/lib/integrations/flipy/env";
import { formatCurrency } from "@/lib/formatting/currency";
import type { IntegrationRow } from "@/types/database";

type Props = {
  integration: IntegrationRow;
  storeId: string;
};

export async function FlipySaldoCard({ integration, storeId }: Props) {
  const flipyTiendaId = readFlipyTiendaId(integration.settings) ?? integration.external_account_id;
  const partnerKey = resolveFlipyPartnerKeyFromIntegration(integration);
  if (!flipyTiendaId || !partnerKey) {
    return (
      <div className="rounded-lg border border-border bg-surface-elevated p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Saldo Flipy</p>
        <p className="mt-2 text-sm text-text-secondary">Reconecta Flipy para ver saldo operaciones.</p>
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
        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Saldo Flipy</p>
        <p className="mt-2 text-lg font-semibold">
          {formatCurrency(saldo.saldoOperaciones, "PEN")}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge
            status={saldo.warningBajo ? "degraded" : "healthy"}
            label={saldo.warningBajo ? "Saldo bajo" : "OK"}
          />
          {saldo.saldoReservado != null ? (
            <span className="text-xs text-text-secondary">
              Reservado: {formatCurrency(saldo.saldoReservado, "PEN")}
            </span>
          ) : null}
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="rounded-lg border border-border bg-surface-elevated p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Saldo Flipy</p>
        <p className="mt-2 text-sm text-text-secondary">
          {error instanceof Error ? error.message : "No se pudo consultar saldo."}
        </p>
      </div>
    );
  }
}
