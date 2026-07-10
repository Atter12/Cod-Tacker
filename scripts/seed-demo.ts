/**
 * Demo seed for a single agency/store. Server-only; requires service role.
 *
 * ALLOW_DEMO_SEED=true DEMO_AGENCY_ID=… DEMO_STORE_ID=… npm run seed:demo
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import type { Database, Json } from "../types/database.generated";

const SEED_META = { source: "demo_seed", seed_version: "v1" } as const;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function admin() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Refusing to seed: set ALLOW_DEMO_SEED=true");
  }
  const agencyId = requireEnv("DEMO_AGENCY_ID");
  const storeId = requireEnv("DEMO_STORE_ID");
  const supabase = admin();

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, agency_id, currency_code, country_code")
    .eq("id", storeId)
    .maybeSingle();
  if (storeError) throw storeError;
  if (!store || store.agency_id !== agencyId) {
    throw new Error("DEMO_STORE_ID does not belong to DEMO_AGENCY_ID");
  }

  const { count: existing } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .contains("metadata", { source: "demo_seed" });
  if ((existing ?? 0) > 0) {
    console.log(`Seed already present (${existing} orders). Skipping insert.`);
    return;
  }

  let carrierId: string;
  const { data: carrier } = await supabase.from("carriers").select("id").eq("code", "demo-seed").maybeSingle();
  if (carrier) carrierId = carrier.id;
  else {
    const { data: created, error } = await supabase
      .from("carriers")
      .insert({
        code: "demo-seed",
        name: "Demo Carrier",
        country_codes: ["PE"],
        metadata: SEED_META as unknown as Json,
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    carrierId = created.id;
  }

  const statuses = [
    "created",
    "confirmed",
    "shipped",
    "delivered",
    "rejected",
    "returned",
  ] as const;

  const orderRows = Array.from({ length: 40 }, (_, index) => {
    const status = statuses[index % statuses.length]!;
    const created = daysAgo(index % 28);
    const amount = 50 + (index % 10) * 25;
    const external = `demo-${createHash("sha1").update(String(index)).digest("hex").slice(0, 10)}`;
    return {
      agency_id: agencyId,
      store_id: storeId,
      external_order_id: external,
      order_number: `D-${1000 + index}`,
      order_status: status,
      confirmation_status:
        status === "created" ? ("pending" as const) : status === "rejected" ? ("rejected" as const) : ("confirmed" as const),
      payment_status:
        status === "delivered"
          ? ("cash_collected" as const)
          : status === "returned" || status === "rejected"
            ? ("unpaid" as const)
            : ("cash_expected" as const),
      currency_code: store.currency_code,
      created_at_source: created.toISOString(),
      subtotal_amount: amount,
      shipping_amount: 10,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: amount + 10,
      expected_cod_amount: amount + 10,
      collected_cod_amount: status === "delivered" ? amount + 10 : null,
      cash_collected_at: status === "delivered" ? created.toISOString() : null,
      shipping_city: index % 2 === 0 ? "Lima" : "Arequipa",
      shipping_region: index % 2 === 0 ? "Lima" : "Arequipa",
      shipping_country_code: store.country_code ?? "PE",
      metadata: SEED_META as unknown as Json,
      tags: ["demo_seed"],
    };
  });

  const { data: insertedOrders, error: ordersError } = await supabase.from("orders").insert(orderRows).select("id, order_status, expected_cod_amount, total_amount");
  if (ordersError) throw ordersError;

  const shipmentRows = (insertedOrders ?? [])
    .filter((order) => ["shipped", "delivered", "returned"].includes(order.order_status))
    .map((order, index) => ({
      agency_id: agencyId,
      store_id: storeId,
      order_id: order.id,
      carrier_id: carrierId,
      tracking_number: `TRK-DEMO-${index}`,
      status:
        order.order_status === "delivered"
          ? ("delivered" as const)
          : order.order_status === "returned"
            ? ("returned" as const)
            : ("in_transit" as const),
      is_rto: order.order_status === "returned",
      is_terminal: order.order_status === "delivered" || order.order_status === "returned",
      cod_expected_amount: order.expected_cod_amount,
      cod_collected_amount: order.order_status === "delivered" ? order.expected_cod_amount : null,
      metadata: SEED_META as unknown as Json,
    }));

  if (shipmentRows.length) {
    const { error } = await supabase.from("shipments").insert(shipmentRows);
    if (error) throw error;
  }

  const { error: alertsError } = await supabase.from("alerts").insert([
    {
      agency_id: agencyId,
      store_id: storeId,
      type: "demo_seed",
      title: "Alerta demo: RTO elevado",
      body: "Datos de demostración.",
      severity: "warning",
      data: SEED_META as unknown as Json,
    },
    {
      agency_id: agencyId,
      store_id: storeId,
      type: "demo_seed",
      title: "Alerta demo: conciliación pendiente",
      body: "Datos de demostración.",
      severity: "info",
      data: SEED_META as unknown as Json,
    },
  ]);
  if (alertsError) throw alertsError;

  const delivered = (insertedOrders ?? []).filter((order) => order.order_status === "delivered");
  const gross = delivered.reduce((sum, order) => sum + Number(order.expected_cod_amount ?? 0), 0);
  const { data: batch, error: batchError } = await supabase
    .from("settlement_batches")
    .insert({
      agency_id: agencyId,
      store_id: storeId,
      carrier_id: carrierId,
      currency_code: store.currency_code,
      status: "matched",
      gross_amount: gross,
      fees_amount: gross * 0.05,
      adjustments_amount: 0,
      net_amount: gross * 0.95,
      reference: `demo-batch-${randomUUID().slice(0, 8)}`,
      metadata: SEED_META as unknown as Json,
    })
    .select("id")
    .single();
  if (batchError) throw batchError;

  if (delivered.length) {
    const { error } = await supabase.from("settlement_items").insert(
      delivered.slice(0, 10).map((order) => ({
        agency_id: agencyId,
        store_id: storeId,
        batch_id: batch.id,
        order_id: order.id,
        expected_amount: Number(order.expected_cod_amount ?? 0),
        settled_amount: Number(order.expected_cod_amount ?? 0),
        metadata: SEED_META as unknown as Json,
      })),
    );
    if (error) throw error;
  }

  // Soft ROAS: attributions without full ads graph (dashboard spend may stay 0).
  if (insertedOrders?.length) {
    const { error } = await supabase.from("order_attributions").insert(
      insertedOrders.slice(0, 15).map((order) => ({
        agency_id: agencyId,
        store_id: storeId,
        order_id: order.id,
        model: "manual" as const,
        platform: "other" as const,
        attributed_value: Number(order.total_amount),
        credit: 1,
        is_primary: true,
        attribution_reason: "demo_seed",
        calculated_at: new Date().toISOString(),
        metadata: SEED_META as unknown as Json,
      })),
    );
    // Ignore if schema requires more FKs
    if (error) console.warn("order_attributions skipped:", error.message);
  }

  await supabase.from("audit_logs").insert({
    action: "demo_seed_created",
    entity_type: "store",
    entity_id: storeId,
    agency_id: agencyId,
    store_id: storeId,
    new_data: SEED_META as unknown as Json,
  });

  console.log(`Seeded demo data for store ${storeId}: ${insertedOrders?.length ?? 0} orders.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
