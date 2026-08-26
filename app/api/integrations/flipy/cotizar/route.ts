import { getUser } from "@/lib/auth/get-session";
import { IntegrationError, ValidationError } from "@/lib/errors";
import { cotizarFlipyFleteForStore } from "@/lib/integrations/flipy/cotizar-flete-service";
import {
  flipyErrorUserHint,
  readFlipyErrorCode,
} from "@/lib/integrations/flipy/errors";
import type { FlipyPackageSize } from "@/lib/integrations/flipy/map-package-size";
import { getIntegrationRuntimeMode } from "@/lib/integrations/registry";
import { assertCanManageOrders } from "@/lib/orders/transitions";
import { can } from "@/lib/permissions/can";
import { getAccessibleStores } from "@/lib/tenant/get-accessible-stores";
import { toUserMessage } from "@/lib/errors/to-user-message";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CotizarBody = {
  agencySlug?: string;
  storeSlug?: string;
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  packageSize?: FlipyPackageSize;
  typeMode?: "express" | "programado" | "recurrente";
};

/** POST — cotizar flete Flipy (lighter than Server Action for wizard UI). */
export async function POST(request: Request) {
  try {
    if (getIntegrationRuntimeMode() !== "live") {
      return Response.json(
        { error: "Cotizar flete Flipy requiere INTEGRATION_MODE=live." },
        { status: 400 },
      );
    }

    const user = await getUser();
    if (!user) {
      return Response.json({ error: "No autenticado." }, { status: 401 });
    }

    const body = (await request.json()) as CotizarBody;
    const agencySlug = body.agencySlug?.trim() ?? "";
    const storeSlug = body.storeSlug?.trim() ?? "";
    if (!agencySlug || !storeSlug) {
      return Response.json({ error: "Faltan agencySlug o storeSlug." }, { status: 400 });
    }

    const stores = await getAccessibleStores();
    const match = stores.find((s) => s.agencySlug === agencySlug && s.storeSlug === storeSlug);
    if (!match?.storeId) {
      return Response.json({ error: "Sin acceso a la tienda." }, { status: 403 });
    }
    assertCanManageOrders(can([match.effectiveRole], "orders.manage"));

    const fleteQuote = await cotizarFlipyFleteForStore({
      agencyId: match.agencyId,
      storeId: match.storeId,
      originLat: body.originLat!,
      originLng: body.originLng!,
      destinationLat: body.destinationLat!,
      destinationLng: body.destinationLng!,
      packageSize: body.packageSize,
      typeMode: body.typeMode,
    });

    return Response.json({ fleteQuote });
  } catch (error) {
    const errorCode = readFlipyErrorCode(error);
    const hint = flipyErrorUserHint(errorCode);
    const message = hint ?? toUserMessage(error);
    const status =
      error instanceof ValidationError
        ? 400
        : error instanceof IntegrationError
          ? 502
          : 500;
    return Response.json({ error: message, errorCode }, { status });
  }
}
