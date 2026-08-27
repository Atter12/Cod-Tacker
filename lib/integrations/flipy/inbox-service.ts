import "server-only";

import { ValidationError } from "@/lib/errors";
import { getFlipyClientForStore } from "@/lib/integrations/flipy/cotizar-flete-service";
import type {
  FlipyEnviosInboxScope,
  FlipyEnvioListItem,
  FlipyListEnviosResult,
} from "@/lib/integrations/flipy/partner-contract";
import { getIntegrationRuntimeMode } from "@/lib/integrations/registry";
import type { JobsAdminClient } from "@/lib/jobs/types";

export type FlipyInboxOrderLink = {
  orderId: string;
  orderNumber: string | null;
  externalOrderId: string;
};

export type FlipyInboxRow = FlipyEnvioListItem & {
  orderLink: FlipyInboxOrderLink | null;
};

export type FlipyInboxResult = {
  scope: FlipyEnviosInboxScope;
  page: number;
  pageSize: number;
  total: number;
  rows: FlipyInboxRow[];
};

function normalizeExternalOrderId(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const value = raw.trim();
  if (value.toLowerCase().startsWith("shopify:")) {
    return value.slice("shopify:".length).trim() || null;
  }
  return value;
}

async function linkOrdersToEnvios(
  admin: JobsAdminClient,
  storeId: string,
  items: FlipyEnvioListItem[],
): Promise<Map<string, FlipyInboxOrderLink>> {
  const externalIds = Array.from(
    new Set(
      items
        .map((item) => normalizeExternalOrderId(item.externalOrderId))
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const map = new Map<string, FlipyInboxOrderLink>();
  if (!externalIds.length) return map;

  const { data, error } = await admin
    .from("orders")
    .select("id, order_number, external_order_id")
    .eq("store_id", storeId)
    .in("external_order_id", externalIds);
  if (error) throw error;

  for (const row of data ?? []) {
    const external = typeof row.external_order_id === "string" ? row.external_order_id : null;
    if (!external) continue;
    map.set(external, {
      orderId: row.id,
      orderNumber: row.order_number,
      externalOrderId: external,
    });
  }
  return map;
}

export async function listFlipyInboxForStore(input: {
  admin: JobsAdminClient;
  agencyId: string;
  storeId: string;
  scope?: FlipyEnviosInboxScope;
  estado?: string | null;
  q?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<FlipyInboxResult> {
  if (getIntegrationRuntimeMode() !== "live") {
    throw new ValidationError("El inbox Flipy requiere INTEGRATION_MODE=live.");
  }

  const client = await getFlipyClientForStore(input.agencyId, input.storeId);
  const listed: FlipyListEnviosResult = await client.listEnvios({
    scope: input.scope ?? "atencion",
    estado: input.estado,
    q: input.q,
    page: input.page ?? 1,
    pageSize: input.pageSize ?? 25,
  });

  const links = await linkOrdersToEnvios(input.admin, input.storeId, listed.items);
  const rows: FlipyInboxRow[] = listed.items.map((item) => {
    const external = normalizeExternalOrderId(item.externalOrderId);
    return {
      ...item,
      orderLink: external ? links.get(external) ?? null : null,
    };
  });

  return {
    scope: listed.scope,
    page: listed.page,
    pageSize: listed.pageSize,
    total: listed.total,
    rows,
  };
}
