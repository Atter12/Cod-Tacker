"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/config/routes";
import { actionOk, type ActionResult } from "@/lib/actions/action-result";
import { ValidationError } from "@/lib/errors";
import {
  flipyErrorUserHint,
  readFlipyErrorCode,
} from "@/lib/integrations/flipy/errors";
import { getIntegrationRuntimeMode } from "@/lib/integrations/registry";
import {
  getFlipyWalletSaldoForStore,
  normalizeFlipyTransferIdempotencyKey,
  transferFlipyGananciasToOperacionesForStore,
} from "@/lib/integrations/flipy/wallet-service";
import { can } from "@/lib/permissions/can";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { requireUser } from "@/lib/auth/require-user";
import { toUserMessage } from "@/lib/errors/to-user-message";

export type FlipyWalletSaldoActionResult = {
  billeteraOperaciones: number;
  billeteraReservado: number | null;
  billeteraGanancias: number | null;
  transferGananciasDisponible?: boolean | null;
  destinoRetiroConfigurado?: boolean | null;
  warningBajo: boolean;
};

export type TransferFlipyGananciasResult = {
  idempotent: boolean;
  transferId?: string | null;
  monto: number;
  billeteraOperaciones: number;
  billeteraGanancias: number | null;
  billeteraReservado: number | null;
  message?: string | null;
};

export async function fetchFlipyWalletSaldo(input: {
  agencySlug: string;
  storeSlug: string;
}): Promise<ActionResult<FlipyWalletSaldoActionResult> & { errorCode?: string }> {
  try {
    if (getIntegrationRuntimeMode() !== "live") {
      throw new ValidationError("Saldo Flipy requiere INTEGRATION_MODE=live.");
    }

    await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    if (!can(membership.roles, "integrations.view")) {
      throw new ValidationError("No tienes permiso para ver la billetera Flipy.");
    }
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const saldo = await getFlipyWalletSaldoForStore(membership.agencyId, membership.storeId);

    return actionOk({
      billeteraOperaciones: saldo.billeteraOperaciones,
      billeteraReservado: saldo.billeteraReservado,
      billeteraGanancias: saldo.billeteraGanancias,
      transferGananciasDisponible: saldo.transferGananciasDisponible,
      destinoRetiroConfigurado: saldo.destinoRetiroConfigurado,
      warningBajo: saldo.warningBajo,
    });
  } catch (error) {
    const errorCode = readFlipyErrorCode(error);
    return { error: toUserMessage(error), errorCode: errorCode ?? undefined };
  }
}

export async function transferFlipyGananciasToOperaciones(input: {
  agencySlug: string;
  storeSlug: string;
  monto: number;
  idempotencyKey?: string | null;
}): Promise<ActionResult<TransferFlipyGananciasResult> & { errorCode?: string }> {
  try {
    if (getIntegrationRuntimeMode() !== "live") {
      throw new ValidationError("Transferencia Flipy requiere INTEGRATION_MODE=live.");
    }

    await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    if (!can(membership.roles, "integrations.manage")) {
      throw new ValidationError("No tienes permiso para transferir saldo Flipy.");
    }
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const idempotencyKey = normalizeFlipyTransferIdempotencyKey(
      membership.storeId,
      input.idempotencyKey,
    );

    const result = await transferFlipyGananciasToOperacionesForStore({
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      monto: input.monto,
      idempotencyKey,
    });

    revalidatePath(routes.store.integrations(input.agencySlug, input.storeSlug));
    revalidatePath(routes.store.integrationDetail(input.agencySlug, input.storeSlug, "flipy"));

    return actionOk({
      idempotent: result.idempotent,
      transferId: result.transferId,
      monto: result.monto,
      billeteraOperaciones: result.billeteraOperaciones,
      billeteraGanancias: result.billeteraGanancias,
      billeteraReservado: result.billeteraReservado,
      message: result.message,
    });
  } catch (error) {
    const errorCode = readFlipyErrorCode(error);
    const hint = flipyErrorUserHint(errorCode);
    return { error: hint ?? toUserMessage(error), errorCode: errorCode ?? undefined };
  }
}
