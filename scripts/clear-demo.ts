/**
 * Clears only demo_seed rows for DEMO_AGENCY_ID / DEMO_STORE_ID.
 * ALLOW_DEMO_SEED=true DEMO_AGENCY_ID=… DEMO_STORE_ID=… npm run clear:demo
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.generated";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

async function main() {
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Refusing to clear: set ALLOW_DEMO_SEED=true");
  }
  const agencyId = requireEnv("DEMO_AGENCY_ID");
  const storeId = requireEnv("DEMO_STORE_ID");
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: store } = await supabase.from("stores").select("id, agency_id").eq("id", storeId).maybeSingle();
  if (!store || store.agency_id !== agencyId) throw new Error("Store/agency mismatch");

  // Delete dependent demo rows by metadata / tags
  const { data: orders } = await supabase
    .from("orders")
    .select("id")
    .eq("store_id", storeId)
    .contains("metadata", { source: "demo_seed" });
  const orderIds = (orders ?? []).map((order) => order.id);

  if (orderIds.length) {
    await supabase.from("settlement_items").delete().in("order_id", orderIds);
    await supabase.from("order_attributions").delete().in("order_id", orderIds);
    await supabase.from("shipments").delete().in("order_id", orderIds);
    await supabase.from("orders").delete().in("id", orderIds);
  }

  await supabase.from("settlement_batches").delete().eq("store_id", storeId).contains("metadata", { source: "demo_seed" });
  await supabase.from("alerts").delete().eq("store_id", storeId).eq("type", "demo_seed");

  await supabase.from("audit_logs").insert({
    action: "demo_seed_cleared",
    entity_type: "store",
    entity_id: storeId,
    agency_id: agencyId,
    store_id: storeId,
    new_data: { source: "demo_seed", seed_version: "v1" },
  });

  console.log(`Cleared demo_seed rows for store ${storeId} (${orderIds.length} orders).`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
