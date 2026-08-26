import "server-only";

import { randomUUID } from "node:crypto";

import { ValidationError } from "@/lib/errors";
import type { FlipyTransferGananciasSuccessResult, FlipyWalletSaldoResult } from "@/lib/integrations/flipy/partner-contract";
import { getFlipyClientForStore } from "@/lib/integrations/flipy/cotizar-flete-service";
import {
  readFlipyTiendaId,
  resolveFlipyPartnerKeyFromIntegration,
} from "@/lib/integrations/flipy/credentials";
import { resolveFlipyIntegrationForStore } from "@/lib/integrations/flipy/webhook-ingress";
import { createAdminClient } from "@/lib/supabase/admin";

export function buildFlipyTransferIdempotencyKey(storeId: string): string {
  return `codtracked:transfer:${storeId}:${randomUUID()}`;
}

export function normalizeFlipyTransferIdempotencyKey(
  storeId: string,
  key?: string | null,
): string {
  const trimmed = key?.trim();
  if (!trimmed) return buildFlipyTransferIdempotencyKey(storeId);
  const prefix = `codtracked:transfer:${storeId}:`;
  if (trimmed.startsWith(prefix)) return trimmed;
  return `${prefix}${trimmed}`;
}

async function resolveFlipyTiendaIdForStore(agencyId: string, storeId: string): Promise<string> {
  const admin = createAdminClient();
  const integration = await resolveFlipyIntegrationForStore(admin, agencyId, storeId);
  if (!integration || integration.status === "disconnected") {
    throw new ValidationError("Conecta Flipy en Integraciones antes de operar la billetera.");
  }

  const partnerKey = resolveFlipyPartnerKeyFromIntegration(integration);
  if (!partnerKey) {
    throw new ValidationError("FLIPY_PARTNER_API_KEY no configurada.");
  }

  const flipyTiendaId = readFlipyTiendaId(integration.settings) ?? integration.external_account_id;
  if (!flipyTiendaId) {
    throw new ValidationError("Integración Flipy sin tiendaId. Reconecta Flipy.");
  }

  return flipyTiendaId;
}

export async function getFlipyWalletSaldoForStore(
  agencyId: string,
  storeId: string,
): Promise<FlipyWalletSaldoResult> {
  const flipyTiendaId = await resolveFlipyTiendaIdForStore(agencyId, storeId);
  const client = await getFlipyClientForStore(agencyId, storeId);
  return client.getSaldo(flipyTiendaId);
}

export type FlipyTransferGananciasResult = {
  success: true;
  idempotent: boolean;
  transferId?: string | null;
  monto: number;
  billeteraOperaciones: number;
  billeteraGanancias: number | null;
  billeteraReservado: number | null;
  message?: string | null;
};

export async function transferFlipyGananciasToOperacionesForStore(input: {
  agencyId: string;
  storeId: string;
  monto: number;
  idempotencyKey: string;
}): Promise<FlipyTransferGananciasResult> {
  if (!Number.isFinite(input.monto) || input.monto <= 0) {
    throw new ValidationError("El monto debe ser mayor a cero.");
  }

  await resolveFlipyTiendaIdForStore(input.agencyId, input.storeId);
  const client = await getFlipyClientForStore(input.agencyId, input.storeId);

  const result: FlipyTransferGananciasSuccessResult = await client.transferirGananciasAOperaciones(
    { monto: input.monto },
    input.idempotencyKey,
  );

  return {
    success: true,
    idempotent: result.idempotent,
    transferId: result.transferId,
    monto: result.monto,
    billeteraOperaciones: result.billeteraOperaciones,
    billeteraGanancias: result.billeteraGanancias,
    billeteraReservado: result.billeteraReservado,
    message: result.message,
  };
}

export { revalidateFlipyWalletIntegrationPages } from "@/lib/integrations/flipy/revalidate-wallet-pages";
