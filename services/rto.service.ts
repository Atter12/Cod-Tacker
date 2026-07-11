import { getRtoBreakdown, type RtoBreakdownRow } from "@/services/attribution.service";
import { listShipments } from "@/services/shipments.service";
import type { DatabaseClient } from "./_shared";

export type { RtoBreakdownRow };

export async function listRtoShipments(
  client: DatabaseClient,
  storeId: string,
  from: string,
  to: string,
) {
  return listShipments(client, {
    storeId,
    statuses: ["returned", "return_in_transit"],
    from,
    to,
  });
}

export async function listRtoByDimension(
  client: DatabaseClient,
  storeId: string,
  from: string,
  to: string,
  dimension: string,
) {
  return getRtoBreakdown(client, storeId, from, to, dimension);
}
