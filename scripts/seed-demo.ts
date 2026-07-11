/**
 * Demo seed for a single agency/store. Server-only; requires service role.
 *
 * ALLOW_DEMO_SEED=true DEMO_AGENCY_ID=… DEMO_STORE_ID=… npm run seed:demo
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import type { Database, Json } from "../types/database.generated";

const SEED_META = { source: "demo_seed", seed_version: "v2" } as const;

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

type Scenario = {
  order_status: Database["public"]["Enums"]["order_status"];
  confirmation_status: Database["public"]["Enums"]["confirmation_status"];
  payment_status: Database["public"]["Enums"]["payment_status"];
  withAttribution: boolean;
  withShipment: boolean;
  settled: boolean;
  incompleteEvents: boolean;
};

const SCENARIOS: Scenario[] = [
  {
    order_status: "created",
    confirmation_status: "pending",
    payment_status: "cash_expected",
    withAttribution: false,
    withShipment: false,
    settled: false,
    incompleteEvents: true,
  },
  {
    order_status: "pending_confirmation",
    confirmation_status: "pending",
    payment_status: "cash_expected",
    withAttribution: true,
    withShipment: false,
    settled: false,
    incompleteEvents: false,
  },
  {
    order_status: "confirmed",
    confirmation_status: "confirmed",
    payment_status: "cash_expected",
    withAttribution: true,
    withShipment: false,
    settled: false,
    incompleteEvents: false,
  },
  {
    order_status: "cancelled",
    confirmation_status: "rejected",
    payment_status: "unpaid",
    withAttribution: false,
    withShipment: false,
    settled: false,
    incompleteEvents: false,
  },
  {
    order_status: "rejected",
    confirmation_status: "rejected",
    payment_status: "unpaid",
    withAttribution: false,
    withShipment: false,
    settled: false,
    incompleteEvents: false,
  },
  {
    order_status: "shipped",
    confirmation_status: "confirmed",
    payment_status: "cash_expected",
    withAttribution: true,
    withShipment: true,
    settled: false,
    incompleteEvents: false,
  },
  {
    order_status: "delivered",
    confirmation_status: "confirmed",
    payment_status: "cash_collected",
    withAttribution: true,
    withShipment: true,
    settled: false,
    incompleteEvents: false,
  },
  {
    order_status: "delivered",
    confirmation_status: "confirmed",
    payment_status: "settled",
    withAttribution: true,
    withShipment: true,
    settled: true,
    incompleteEvents: false,
  },
  {
    order_status: "returned",
    confirmation_status: "confirmed",
    payment_status: "unpaid",
    withAttribution: false,
    withShipment: true,
    settled: false,
    incompleteEvents: true,
  },
  {
    order_status: "return_in_transit",
    confirmation_status: "confirmed",
    payment_status: "cash_expected",
    withAttribution: true,
    withShipment: true,
    settled: false,
    incompleteEvents: false,
  },
];

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

  const customerRows = Array.from({ length: 8 }, (_, index) => {
    const hash = createHash("sha1").update(`customer-${index}`).digest("hex").slice(0, 8);
    return {
      store_id: storeId,
      external_customer_id: `demo-cust-${hash}`,
      first_name: ["Ana", "Luis", "María", "José", "Diana", "Pedro", "Lucía", "Carlos"][index]!,
      last_name: ["Pérez", "García", "Lopez", "Ruiz", "Torres", "Díaz", "Vega", "Ramos"][index]!,
      email: `demo.customer.${index}@example.test`,
      phone: `+51900${String(100000 + index).slice(0, 6)}`,
      city: index % 2 === 0 ? "Lima" : "Arequipa",
      region: index % 2 === 0 ? "Lima" : "Arequipa",
      country_code: store.country_code ?? "PE",
      total_orders: 1 + (index % 3),
      delivered_orders: index % 2,
      returned_orders: index % 5 === 0 ? 1 : 0,
      metadata: SEED_META as unknown as Json,
    };
  });
  const { data: customers, error: customersError } = await supabase.from("customers").insert(customerRows).select("id");
  if (customersError) throw customersError;

  const orderRows = Array.from({ length: 40 }, (_, index) => {
    const scenario = SCENARIOS[index % SCENARIOS.length]!;
    const created = daysAgo(index % 28);
    const amount = 50 + (index % 10) * 25;
    const external = `demo-${createHash("sha1").update(String(index)).digest("hex").slice(0, 10)}`;
    const customer = customers?.[index % (customers?.length || 1)];
    return {
      agency_id: agencyId,
      store_id: storeId,
      customer_id: customer?.id ?? null,
      external_order_id: external,
      order_number: `D-${1000 + index}`,
      order_status: scenario.order_status,
      confirmation_status: scenario.confirmation_status,
      payment_status: scenario.payment_status,
      currency_code: store.currency_code,
      created_at_source: created.toISOString(),
      confirmed_at: scenario.confirmation_status === "confirmed" ? created.toISOString() : null,
      cancelled_at:
        scenario.order_status === "cancelled" || scenario.order_status === "rejected"
          ? created.toISOString()
          : null,
      delivered_at: scenario.order_status === "delivered" ? created.toISOString() : null,
      returned_at: scenario.order_status === "returned" ? created.toISOString() : null,
      subtotal_amount: amount,
      shipping_amount: 10,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: amount + 10,
      expected_cod_amount: amount + 10,
      collected_cod_amount:
        scenario.payment_status === "cash_collected" || scenario.payment_status === "settled"
          ? amount + 10
          : null,
      settled_cod_amount: scenario.settled ? amount + 10 : null,
      cash_collected_at:
        scenario.payment_status === "cash_collected" || scenario.payment_status === "settled"
          ? created.toISOString()
          : null,
      settled_at: scenario.settled ? created.toISOString() : null,
      shipping_city: index % 2 === 0 ? "Lima" : "Arequipa",
      shipping_district: index % 2 === 0 ? "Miraflores" : "Cercado",
      shipping_region: index % 2 === 0 ? "Lima" : "Arequipa",
      shipping_country_code: store.country_code ?? "PE",
      source_name: "demo_seed",
      metadata: { ...SEED_META, scenario_index: index % SCENARIOS.length, incomplete: scenario.incompleteEvents },
      tags: ["demo_seed", scenario.order_status],
    };
  });

  const { data: insertedOrders, error: ordersError } = await supabase
    .from("orders")
    .insert(orderRows)
    .select("id, order_status, expected_cod_amount, total_amount, payment_status, metadata");
  if (ordersError) throw ordersError;

  if (insertedOrders?.length) {
    const itemRows = insertedOrders.flatMap((order, index) => [
      {
        store_id: storeId,
        order_id: order.id,
        external_line_item_id: `demo-line-${index}-a`,
        sku: `SKU-DEMO-${(index % 5) + 1}`,
        title: `Producto demo ${(index % 5) + 1}`,
        quantity: 1 + (index % 2),
        unit_price: Number(order.total_amount) - 10,
        total_discount: 0,
        total_price: Number(order.total_amount) - 10,
        metadata: SEED_META as unknown as Json,
      },
    ]);
    const { error } = await supabase.from("order_items").insert(itemRows);
    if (error) console.warn("order_items skipped:", error.message);

    const historyRows = insertedOrders.map((order) => ({
      store_id: storeId,
      order_id: order.id,
      previous_status: null,
      new_status: order.order_status,
      occurred_at: new Date().toISOString(),
      reason_code: "demo_seed",
      reason_detail: "Estado inicial seed",
      metadata: SEED_META as unknown as Json,
    }));
    const { error: historyError } = await supabase.from("order_status_history").insert(historyRows);
    if (historyError) console.warn("order_status_history skipped:", historyError.message);
  }

  const shipmentRows = (insertedOrders ?? [])
    .filter((order) => {
      const meta = order.metadata as { scenario_index?: number } | null;
      const scenario = SCENARIOS[(meta?.scenario_index ?? 0) % SCENARIOS.length]!;
      return scenario.withShipment;
    })
    .map((order, index) => ({
      agency_id: agencyId,
      store_id: storeId,
      order_id: order.id,
      carrier_id: carrierId,
      tracking_number: `TRK-DEMO-${index}`,
      status:
        order.order_status === "delivered"
          ? ("delivered" as const)
          : order.order_status === "returned" || order.order_status === "return_in_transit"
            ? ("returned" as const)
            : ("in_transit" as const),
      is_rto: order.order_status === "returned" || order.order_status === "return_in_transit",
      is_terminal: order.order_status === "delivered" || order.order_status === "returned",
      cod_expected_amount: order.expected_cod_amount,
      cod_collected_amount: order.payment_status === "cash_collected" || order.payment_status === "settled"
        ? order.expected_cod_amount
        : null,
      metadata: SEED_META as unknown as Json,
    }));

  if (shipmentRows.length) {
    const { data: shipments, error } = await supabase.from("shipments").insert(shipmentRows).select("id, status");
    if (error) throw error;
    if (shipments?.length) {
      const events = shipments.map((shipment, index) => ({
        agency_id: agencyId,
        store_id: storeId,
        shipment_id: shipment.id,
        carrier_id: carrierId,
        external_event_id: `demo-evt-${index}`,
        external_status_label: shipment.status,
        normalized_status: shipment.status,
        occurred_at: daysAgo(index % 7).toISOString(),
        received_at: new Date().toISOString(),
        payload: SEED_META as unknown as Json,
      }));
      const { error: eventsError } = await supabase.from("shipment_events").insert(events);
      if (eventsError) console.warn("shipment_events skipped:", eventsError.message);
    }
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

  const settledOrders = (insertedOrders ?? []).filter((order) => order.payment_status === "settled");
  if (settledOrders.length) {
    const { error } = await supabase.from("settlement_items").insert(
      settledOrders.slice(0, 10).map((order) => ({
        agency_id: agencyId,
        store_id: storeId,
        batch_id: batch.id,
        order_id: order.id,
        expected_amount: Number(order.expected_cod_amount ?? 0),
        settled_amount: Number(order.expected_cod_amount ?? 0),
        status: "matched" as const,
        metadata: SEED_META as unknown as Json,
      })),
    );
    if (error) throw error;
  }

  if (insertedOrders?.length) {
    const attributed = insertedOrders.filter((order) => {
      const meta = order.metadata as { scenario_index?: number } | null;
      return SCENARIOS[(meta?.scenario_index ?? 0) % SCENARIOS.length]!.withAttribution;
    });
    const { error } = await supabase.from("order_attributions").insert(
      attributed.map((order) => ({
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

  console.log(`Seeded demo data for store ${storeId}: ${insertedOrders?.length ?? 0} orders (v2 scenarios).`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
