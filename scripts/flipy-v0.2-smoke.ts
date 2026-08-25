/**
 * v0.2 cross-repo smoke — Flipy Partner API + COD-tracked webhooks.
 * Espejo: flipy/backend/scripts/flipy-v0.2-smoke.js
 *
 * Usage:
 *   FLIPY_PARTNER_API_KEY=... \
 *   FLIPY_API_BASE_URL=https://flipy-backend.vercel.app \
 *   STORE_ID=<codtracked-store-uuid> \
 *   CT_APP_URL=https://app.codtracked.com \
 *   AGENCY_SLUG=demo STORE_SLUG=tienda \
 *   FLIPY_WEBHOOK_SECRET=<hex> \
 *   npm run smoke:v02
 */
import {
  FLIPY_PARTNER_CONTRACT_VERSION,
  readFlipyCotizarEnvioResult,
  readFlipyCreateEnvioResult,
} from "../lib/integrations/flipy/partner-contract";
import { signFlipyWebhook } from "../lib/integrations/flipy/webhook-auth";

const partnerKey = process.env.FLIPY_PARTNER_API_KEY?.trim();
const flipyBase = (process.env.FLIPY_API_BASE_URL ?? "https://flipy-backend.vercel.app").replace(
  /\/$/,
  "",
);
const storeId = process.env.STORE_ID?.trim();
const partnerId = process.env.FLIPY_PARTNER_ID?.trim() ?? "codtracked";
const ctApp = (process.env.CT_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "")
  .trim()
  .replace(/\/$/, "");
const agencySlug = process.env.AGENCY_SLUG?.trim() ?? "demo";
const storeSlug = process.env.STORE_SLUG?.trim() ?? "tienda";
const webhookSecret = process.env.FLIPY_WEBHOOK_SECRET?.trim();
const orderBase = process.env.ORDER_EXTERNAL_ID?.trim() ?? `v02-${Date.now()}`;

const originLat = Number(process.env.ORIGIN_LAT ?? "-12.119");
const originLng = Number(process.env.ORIGIN_LNG ?? "-77.029");
const destLat = Number(process.env.DEST_LAT ?? "-12.096");
const destLng = Number(process.env.DEST_LNG ?? "-77.028");

type SmokeResult = { id: string; ok: boolean; detail: string };
const results: SmokeResult[] = [];

function record(id: string, ok: boolean, detail: string) {
  results.push({ id, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${id} — ${detail}`);
}

function fail(msg: string): never {
  console.error(`\nABORT: ${msg}`);
  printSummary();
  process.exit(1);
}

function printSummary() {
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n=== v0.2 smoke: ${passed}/${results.length} PASS ===`);
}

if (!partnerKey) fail("Missing FLIPY_PARTNER_API_KEY");
if (!storeId) fail("Missing STORE_ID");

const webhookUrl = ctApp
  ? `${ctApp}/api/webhooks/flipy/${encodeURIComponent(agencySlug)}/${encodeURIComponent(storeSlug)}`
  : null;

async function partnerRequest(
  path: string,
  options: { method?: string; body?: unknown; idempotencyKey?: string } = {},
) {
  const url = `${flipyBase}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Partner-Key": partnerKey!,
    "X-Partner-Id": partnerId,
    "X-External-Store-Id": storeId!,
  };
  if (options.idempotencyKey) headers["X-Idempotency-Key"] = options.idempotencyKey;

  const res = await fetch(url, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  if (text.trim()) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = { raw: text };
    }
  }
  return { status: res.status, json, ok: res.ok };
}

function shopifyPayment(partial: {
  productPaidAtCheckout: boolean;
  shippingPaidAtCheckout: boolean;
  shopifySubtotal: number;
  shopifyShippingAmount: number;
  expectedCodProduct: number;
  expectedCodShipping: number;
  paymentKind: "cod" | "prepaid";
  confirmedEscenario: string;
}) {
  return { ...partial, noteAttributes: [] };
}

async function cotizar(): Promise<{ recommendedFare: number } | null> {
  const res = await partnerRequest("/api/partner/envios/cotizar", {
    method: "POST",
    body: {
      originLat,
      originLng,
      destinationLat: destLat,
      destinationLng: destLng,
      packageSize: "mediano",
      typeMode: "express",
    },
  });
  const parsed = readFlipyCotizarEnvioResult(res.json);
  if (!res.ok || !parsed?.fleteQuote) {
    record("cotizar", false, `HTTP ${res.status}`);
    return null;
  }
  record("cotizar", true, `fare=${parsed.fleteQuote.recommendedFare}`);
  return parsed.fleteQuote;
}

async function createCase(input: {
  id: string;
  orderSuffix: string;
  escenario: string;
  fulfillmentMode: "smart" | "bid";
  smart: boolean;
  codAmount: number | null;
  price: number;
  shopifyPayment: ReturnType<typeof shopifyPayment>;
  fleteQuote?: { recommendedFare: number } | null;
}): Promise<{ envioId: string; trackingToken: string; estado: string } | null> {
  const externalOrderId = `shopify:${orderBase}-${input.orderSuffix}`;
  const body: Record<string, unknown> = {
    externalStoreId: storeId,
    externalOrderId,
    orderNumber: `#${orderBase}-${input.orderSuffix}`,
    title: `#${orderBase}-${input.orderSuffix}`,
    escenarioPago: input.escenario,
    fulfillmentMode: input.fulfillmentMode,
    priceLocked: input.smart,
    codAmount: input.codAmount,
    price: input.price,
    packageSize: "mediano",
    typeMode: "express",
    originAddress: "Av. Larco 123, Miraflores",
    originLat,
    originLng,
    originContact: "Smoke Tienda",
    originPhone: "51987654321",
    destinationAddress: "Calle Destino 456, Surco",
    destinationLat: destLat,
    destinationLng: destLng,
    destinationContact: "Cliente Smoke",
    destinationPhone: "51999888777",
    destinationEmail: "cliente@smoke.test",
    shopifyPayment: input.shopifyPayment,
  };
  if (input.fleteQuote) body.fleteQuote = input.fleteQuote;

  const res = await partnerRequest("/api/partner/envios", {
    method: "POST",
    idempotencyKey: `codtracked:order:smoke-${orderBase}-${input.orderSuffix}`,
    body,
  });
  const parsed = readFlipyCreateEnvioResult(res.json);
  if (!res.ok || !parsed) {
    record(input.id, false, `HTTP ${res.status} ${JSON.stringify(res.json)}`);
    return null;
  }

  const smartOk = input.smart
    ? parsed.fulfillmentMode === "smart" || parsed.estado === "ASIGNADO" || parsed.estado === "ASIGNANDO_SMART"
    : parsed.fulfillmentMode === "bid" || parsed.estado === "PENDIENTE_PUJAS";

  record(
    input.id,
    smartOk,
    `estado=${parsed.estado} mode=${parsed.fulfillmentMode ?? "?"}`,
  );

  return {
    envioId: parsed.envioId,
    trackingToken: parsed.trackingToken ?? `trk-${input.orderSuffix}`,
    estado: parsed.estado,
  };
}

async function fireLifecycleWebhook(input: {
  type: string;
  envioId: string;
  externalOrderId: string;
  estado: string;
  trackingToken: string;
  fulfillmentMode?: "smart" | "bid";
  assignedMotorizado?: { id: string; displayName: string };
}) {
  if (!webhookUrl || !webhookSecret) {
    record(`wh-${input.type}`, false, "skip — missing CT_APP_URL or FLIPY_WEBHOOK_SECRET");
    return;
  }

  const payload = {
    type: input.type,
    data: {
      envioId: input.envioId,
      externalOrderId: input.externalOrderId,
      estado: input.estado,
      trackingToken: input.trackingToken,
      fulfillmentMode: input.fulfillmentMode,
      assignedMotorizado: input.assignedMotorizado,
    },
  };
  const rawBody = JSON.stringify(payload);
  const eventId = `v02-smoke-${input.type}-${Date.now()}`;
  const signature = signFlipyWebhook(webhookSecret, rawBody);

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Flipy-Signature": signature,
      "X-Flipy-Event-Id": eventId,
    },
    body: rawBody,
  });
  const text = await res.text();
  record(`wh-${input.type}`, res.ok, `HTTP ${res.status} ${text.slice(0, 120)}`);
}

async function main() {
  console.log(`=== v0.2 smoke (contract ${FLIPY_PARTNER_CONTRACT_VERSION}) ===\n`);

  const quote = await cotizar();
  if (!quote) fail("Cotizar failed — required for v0.2");

  const fare = quote.recommendedFare;

  // D3 matrix — 4 payment partial cases
  const case1 = await createCase({
    id: "d3-1-smart-pf",
    orderSuffix: "pf",
    escenario: "1A",
    fulfillmentMode: "smart",
    smart: true,
    codAmount: 0,
    price: fare,
    fleteQuote: quote,
    shopifyPayment: shopifyPayment({
      productPaidAtCheckout: true,
      shippingPaidAtCheckout: true,
      shopifySubtotal: 70.85,
      shopifyShippingAmount: 15,
      expectedCodProduct: 0,
      expectedCodShipping: 0,
      paymentKind: "prepaid",
      confirmedEscenario: "1A",
    }),
  });

  const case2 = await createCase({
    id: "d3-2-bid-p-cod",
    orderSuffix: "pcod",
    escenario: "1E",
    fulfillmentMode: "bid",
    smart: false,
    codAmount: 70.85,
    price: 16,
    fleteQuote: quote,
    shopifyPayment: shopifyPayment({
      productPaidAtCheckout: true,
      shippingPaidAtCheckout: false,
      shopifySubtotal: 70.85,
      shopifyShippingAmount: 15,
      expectedCodProduct: 0,
      expectedCodShipping: 15,
      paymentKind: "prepaid",
      confirmedEscenario: "1E",
    }),
  });

  const case3 = await createCase({
    id: "d3-3-bid-f-prep",
    orderSuffix: "fcod",
    escenario: "1E",
    fulfillmentMode: "bid",
    smart: false,
    codAmount: 70.85,
    price: 15,
    fleteQuote: quote,
    shopifyPayment: shopifyPayment({
      productPaidAtCheckout: false,
      shippingPaidAtCheckout: true,
      shopifySubtotal: 70.85,
      shopifyShippingAmount: 15,
      expectedCodProduct: 70.85,
      expectedCodShipping: 0,
      paymentKind: "cod",
      confirmedEscenario: "1E",
    }),
  });

  const case4 = await createCase({
    id: "d3-4-bid-full-cod",
    orderSuffix: "full",
    escenario: "1E",
    fulfillmentMode: "bid",
    smart: false,
    codAmount: 70.85,
    price: 16,
    fleteQuote: quote,
    shopifyPayment: shopifyPayment({
      productPaidAtCheckout: false,
      shippingPaidAtCheckout: false,
      shopifySubtotal: 70.85,
      shopifyShippingAmount: 15,
      expectedCodProduct: 70.85,
      expectedCodShipping: 15,
      paymentKind: "cod",
      confirmedEscenario: "1E",
    }),
  });

  if (case1) {
    await fireLifecycleWebhook({
      type: "shipment.created",
      envioId: case1.envioId,
      externalOrderId: `shopify:${orderBase}-pf`,
      estado: case1.estado,
      trackingToken: case1.trackingToken,
      fulfillmentMode: "smart",
    });
    await fireLifecycleWebhook({
      type: "shipment.assigned",
      envioId: case1.envioId,
      externalOrderId: `shopify:${orderBase}-pf`,
      estado: "ASIGNADO",
      trackingToken: case1.trackingToken,
      fulfillmentMode: "smart",
      assignedMotorizado: { id: "smoke-moto", displayName: "Smoke Rider" },
    });
  }

  if (case4) {
    await fireLifecycleWebhook({
      type: "shipment.smart_fallback_to_bid",
      envioId: case4.envioId,
      externalOrderId: `shopify:${orderBase}-full`,
      estado: "PENDIENTE_PUJAS",
      trackingToken: case4.trackingToken,
      fulfillmentMode: "bid",
    });
  }

  printSummary();
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    process.exit(1);
  }
  console.log("\nOK — run: npm run jobs:process (if CT webhooks enqueued)");
  console.log("Manual: npm run e2e:v02 for D3 wizard checklist");
}

void main();
