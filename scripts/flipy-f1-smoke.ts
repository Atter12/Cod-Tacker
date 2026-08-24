/**
 * F1 cross-repo smoke: Flipy Partner API + COD-tracked webhook ingress.
 *
 * Usage:
 *   FLIPY_PARTNER_API_KEY=... \
 *   FLIPY_API_BASE_URL=http://localhost:4000 \
 *   CT_APP_URL=http://localhost:3000 \
 *   AGENCY_SLUG=demo \
 *   STORE_SLUG=tienda \
 *   STORE_ID=<codtracked-store-uuid> \
 *   CONTACT_EMAIL=ops@test.pe \
 *   FLIPY_WEBHOOK_SECRET=<hex from integration settings> \
 *   ORDER_EXTERNAL_ID=7123456789 \
 *   npx tsx scripts/flipy-f1-smoke.ts
 *
 * After webhooks enqueue jobs, run: npm run jobs:process
 */
import { createHmac } from "node:crypto";
import {
  buildFlipyProvisionRequestBody,
  readFlipySaldoOperaciones,
} from "../lib/integrations/flipy/partner-contract";
import { signFlipyWebhook } from "../lib/integrations/flipy/webhook-auth";

const partnerKey = process.env.FLIPY_PARTNER_API_KEY?.trim();
const flipyBase = (process.env.FLIPY_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
const ctApp = (process.env.CT_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "")
  .trim()
  .replace(/\/$/, "");
const agencySlug = process.env.AGENCY_SLUG?.trim() ?? "demo";
const storeSlug = process.env.STORE_SLUG?.trim() ?? "tienda";
const storeId = process.env.STORE_ID?.trim();
const contactEmail = process.env.CONTACT_EMAIL?.trim() ?? "ops@codtracked.test";
const webhookSecret = process.env.FLIPY_WEBHOOK_SECRET?.trim();
const orderExternalId = process.env.ORDER_EXTERNAL_ID?.trim() ?? "999001";
const partnerId = process.env.FLIPY_PARTNER_ID?.trim() ?? "codtracked";

const originLat = Number(process.env.ORIGIN_LAT ?? "-12.119");
const originLng = Number(process.env.ORIGIN_LNG ?? "-77.029");
const destLat = Number(process.env.DEST_LAT ?? "-12.096");
const destLng = Number(process.env.DEST_LNG ?? "-77.028");

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

if (!partnerKey) fail("Missing FLIPY_PARTNER_API_KEY");
if (!ctApp) fail("Missing CT_APP_URL or NEXT_PUBLIC_APP_URL");
if (!storeId) fail("Missing STORE_ID (codtracked stores.id uuid)");

const webhookUrl = `${ctApp}/api/webhooks/flipy/${encodeURIComponent(agencySlug)}/${encodeURIComponent(storeSlug)}`;

async function partnerRequest(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    idempotencyKey?: string;
  } = {},
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
  console.log(JSON.stringify({ step: path, status: res.status, body: json }, null, 2));
  if (!res.ok) {
    fail(`Partner API ${path} failed with ${res.status}`);
  }
  return json;
}

async function fireWebhook(estado: string, envioId: string, trackingToken: string) {
  if (!webhookSecret) fail("Missing FLIPY_WEBHOOK_SECRET for webhook step");
  const secret = webhookSecret;

  const payload = {
    type: "shipment.status.updated",
    data: {
      envioId,
      externalOrderId: `shopify:${orderExternalId}`,
      estado,
      trackingToken,
      escenarioPago: "1E",
    },
  };
  const rawBody = JSON.stringify(payload);
  const eventId = `smoke-${estado}-${Date.now()}`;
  const signature = signFlipyWebhook(secret, rawBody);
  const url = webhookUrl;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Flipy-Signature": signature,
      "X-Flipy-Event-Id": eventId,
    },
    body: rawBody,
  });
  const text = await res.text();
  console.log(
    JSON.stringify({ step: "ct-webhook", estado, status: res.status, body: text }, null, 2),
  );
  if (!res.ok) fail(`CT webhook ${estado} failed`);
}

async function main() {
  console.log("=== F1 smoke: provision ===");
  const provisionBody = buildFlipyProvisionRequestBody({
    externalStoreId: storeId!,
    nombre: process.env.STORE_NAME?.trim() ?? "Smoke Tienda CT",
    contactEmail,
    telefono: process.env.CONTACT_PHONE?.trim() ?? "51999888777",
    originAddress: process.env.ORIGIN_ADDRESS?.trim() ?? "Av. Smoke 123, Lima",
    originLat,
    originLng,
    webhookUrl,
  });

  const provision = await partnerRequest("/api/partner/tiendas", {
    method: "POST",
    idempotencyKey: `codtracked:store:${storeId}`,
    body: provisionBody,
  }) as Record<string, unknown>;

  const tiendaId = String(provision.tiendaId ?? provision.tienda_id ?? provision.id ?? "");
  if (!tiendaId) fail("Provision did not return tiendaId");

  console.log("=== F1 smoke: saldo ===");
  const saldo = await partnerRequest(`/api/partner/tiendas/${encodeURIComponent(tiendaId)}/saldo`);
  const operaciones = readFlipySaldoOperaciones(saldo);
  console.log(`Parsed billeteraOperaciones: ${operaciones}`);

  console.log("=== F1 smoke: register webhook (optional if provision included url) ===");
  try {
    await partnerRequest(`/api/partner/tiendas/${encodeURIComponent(tiendaId)}/webhook`, {
      method: "PUT",
      body: { webhookUrl, webhookSecret: webhookSecret ?? "smoke-secret-replace-me" },
    });
  } catch {
    console.log("Webhook PUT skipped or failed — use FLIPY_WEBHOOK_SECRET from CT connect if needed");
  }

  console.log("=== F1 smoke: create envío 1E ===");
  const createBody = {
    externalStoreId: storeId,
    externalOrderId: `shopify:${orderExternalId}`,
    orderNumber: `#${orderExternalId}`,
    escenarioPago: "1E",
    codAmount: 89,
    price: 15,
    originAddress: provisionBody.originLocation.address,
    originLat: provisionBody.originLocation.lat,
    originLng: provisionBody.originLocation.lng,
    originContact: "Smoke Tienda",
    destinationAddress: "Jr. Destino 456, Lima",
    destinationLat: destLat,
    destinationLng: destLng,
    destinationContact: "Cliente Smoke",
    destinationPhone: "51988777666",
    shopifyPayment: {
      paymentKind: "cod",
      shopifySubtotal: 89,
      shopifyShippingAmount: 15,
    },
  };

  const created = await partnerRequest("/api/partner/envios", {
    method: "POST",
    idempotencyKey: `codtracked:order:smoke-${orderExternalId}`,
    body: createBody,
  }) as Record<string, unknown>;

  const envioId = String(created.envioId ?? created.envio_id ?? created.id ?? "");
  const trackingToken = String(
    created.trackingToken ?? created.tracking_token ?? `smoke-trk-${orderExternalId}`,
  );
  if (!envioId) fail("Create envío did not return envioId");

  console.log("=== F1 smoke: CT webhooks ===");
  await fireWebhook("EN_CURSO", envioId, trackingToken);
  await fireWebhook("ENTREGADO", envioId, trackingToken);

  console.log("OK — run: npm run jobs:process");
  console.log("Then verify shipments + order logistics in CT for order external id:", orderExternalId);
}

void main();
