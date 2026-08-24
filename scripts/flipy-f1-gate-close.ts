/**
 * F1 gate closure — smoke prod + jobs + verify integration/shipment.
 *
 *   npx vercel env run -- npx tsx scripts/flipy-f1-gate-close.ts
 *
 * Optional:
 *   AGENCY_SLUG=demo STORE_SLUG=mi-tienda ORDER_EXTERNAL_ID=71234999001
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import type { Database } from "../types/database.generated";

const flipyBase = (process.env.FLIPY_API_BASE_URL ?? "https://flipy-backend.vercel.app").replace(
  /\/$/,
  "",
);
const ctApp = (process.env.CT_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://app.codtracked.com")
  .trim()
  .replace(/\/$/, "");
const partnerKey = process.env.FLIPY_PARTNER_API_KEY?.trim();
const partnerId = process.env.FLIPY_PARTNER_ID?.trim() ?? "codtracked";

type StepResult = { step: string; ok: boolean; status?: number; detail?: string };

const results: StepResult[] = [];

function pass(step: string, detail?: string) {
  results.push({ step, ok: true, detail });
  console.log(`✅ ${step}${detail ? ` — ${detail}` : ""}`);
}

function fail(step: string, detail?: string): never {
  results.push({ step, ok: false, detail });
  console.error(`❌ ${step}${detail ? ` — ${detail}` : ""}`);
  process.exit(1);
}

function resolveKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");
  try {
    const asB64 = Buffer.from(trimmed, "base64");
    if (asB64.length === 32) return asB64;
  } catch {
    /* ignore */
  }
  return createHash("sha256").update(trimmed, "utf8").digest();
}

function decryptSecret(secretReference: string): string {
  const encKey = process.env.ENCRYPTION_KEY?.trim();
  if (!encKey) throw new Error("ENCRYPTION_KEY required to decrypt webhook secret");
  const PREFIX = "enc:v1:";
  if (!secretReference.startsWith(PREFIX)) return secretReference;
  const key = resolveKey(encKey);
  const packed = Buffer.from(secretReference.slice(PREFIX.length), "base64");
  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function encryptSecret(plaintext: string): string {
  const encKey = process.env.ENCRYPTION_KEY?.trim();
  if (!encKey) throw new Error("ENCRYPTION_KEY required");
  const key = resolveKey(encKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${Buffer.concat([iv, tag, ciphertext]).toString("base64")}`;
}

function signFlipyWebhook(secret: string, rawBody: string): string {
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return `sha256=${digest}`;
}

async function partnerRequest(
  externalStoreId: string,
  path: string,
  options: { method?: string; body?: unknown; idempotencyKey?: string } = {},
) {
  const url = `${flipyBase}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Partner-Key": partnerKey!,
    "X-Partner-Id": partnerId,
    "X-External-Store-Id": externalStoreId,
  };
  if (options.idempotencyKey) headers["X-Idempotency-Key"] = options.idempotencyKey;
  const res = await fetch(url, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  if (text.trim()) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = { raw: text };
    }
  }
  return { status: res.status, json };
}

async function main() {
  if (!partnerKey) fail("env", "FLIPY_PARTNER_API_KEY missing");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    fail(
      "env",
      "Supabase env missing. `vercel env pull` redacta [SENSITIVE]; exporta NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y ENCRYPTION_KEY desde Vercel dashboard antes de ejecutar.",
    );
  }

  const admin = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let agencySlug = process.env.AGENCY_SLUG?.trim();
  let storeSlug = process.env.STORE_SLUG?.trim();
  let storeId = process.env.STORE_ID?.trim();
  let agencyId: string | undefined;

  if (agencySlug && storeSlug) {
    const agency = await admin.from("agencies").select("id").eq("slug", agencySlug).maybeSingle();
    if (!agency.data) fail("resolve-store", `agency slug not found: ${agencySlug}`);
    agencyId = agency.data.id;
    const store = await admin
      .from("stores")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("slug", storeSlug)
      .maybeSingle();
    if (!store.data) fail("resolve-store", `store slug not found: ${storeSlug}`);
    storeId = store.data.id;
  } else if (storeId) {
    const store = await admin.from("stores").select("id, agency_id, slug").eq("id", storeId).maybeSingle();
    if (!store.data) fail("resolve-store", `store id not found: ${storeId}`);
    agencyId = store.data.agency_id;
    const agency = await admin.from("agencies").select("slug").eq("id", agencyId).maybeSingle();
    agencySlug = agency.data?.slug ?? "unknown";
    storeSlug = store.data.slug;
  } else {
    const store = await admin
      .from("stores")
      .select("id, agency_id, slug, agencies!inner(slug)")
      .limit(1)
      .maybeSingle();
    if (!store.data) fail("resolve-store", "no stores in database");
    storeId = store.data.id;
    agencyId = store.data.agency_id;
    storeSlug = store.data.slug;
    const ag = store.data.agencies as { slug?: string } | null;
    agencySlug = ag?.slug ?? "unknown";
  }

  pass("resolve-store", `${agencySlug}/${storeSlug} (${storeId})`);

  const orderExternalId = process.env.ORDER_EXTERNAL_ID?.trim() ?? `7123${Date.now().toString().slice(-7)}`;
  const webhookUrl = `${ctApp}/api/webhooks/flipy/${encodeURIComponent(agencySlug!)}/${encodeURIComponent(storeSlug!)}`;

  // Connect / ensure integration
  let integration = (
    await admin
      .from("integrations")
      .select("*")
      .eq("store_id", storeId!)
      .eq("provider", "flipy")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ).data;

  let webhookSecret = process.env.FLIPY_WEBHOOK_SECRET?.trim() ?? "";
  let flipyTiendaId: string | null = null;

  const settings =
    integration?.settings && typeof integration.settings === "object" && !Array.isArray(integration.settings)
      ? (integration.settings as Record<string, unknown>)
      : {};

  if (settings.flipy_tienda_id && typeof settings.flipy_tienda_id === "string") {
    flipyTiendaId = settings.flipy_tienda_id;
  }

  if (!flipyTiendaId || integration?.status !== "connected") {
    webhookSecret = webhookSecret || randomBytes(32).toString("hex");
    const contactEmail = process.env.CONTACT_EMAIL?.trim() ?? `ops+f1gate@${agencySlug}.test`;
    const provisionBody = {
      externalStoreId: storeId,
      nombre: process.env.STORE_NAME?.trim() ?? `F1 Gate ${storeSlug}`,
      contactEmail,
      telefono: "51999888777",
      originLocation: {
        address: process.env.ORIGIN_ADDRESS?.trim() ?? "Av. Gate 123, Lima",
        lat: Number(process.env.ORIGIN_LAT ?? "-12.119"),
        lng: Number(process.env.ORIGIN_LNG ?? "-77.029"),
      },
      direccion: process.env.ORIGIN_ADDRESS?.trim() ?? "Av. Gate 123, Lima",
      webhookUrl,
    };

    const prov = await partnerRequest(storeId!, "/api/partner/tiendas", {
      method: "POST",
      idempotencyKey: `codtracked:store:${storeId}`,
      body: provisionBody,
    });
    if (prov.status !== 200 && prov.status !== 201) {
      fail("provision", `status ${prov.status} ${JSON.stringify(prov.json)}`);
    }
    flipyTiendaId = String(prov.json.tiendaId ?? "");
    if (!flipyTiendaId) fail("provision", "no tiendaId");

    const wh = await partnerRequest(storeId!, `/api/partner/tiendas/${flipyTiendaId}/webhook`, {
      method: "PUT",
      body: { webhookUrl, webhookSecret },
    });
    if (wh.status !== 200) fail("register-webhook", `status ${wh.status}`);

    const webhookSecretRef = encryptSecret(webhookSecret);
    const now = new Date().toISOString();
    const newSettings = {
      ...settings,
      flipy_tienda_id: flipyTiendaId,
      webhook_url: webhookUrl,
      webhook_secret_ref: webhookSecretRef,
      origin_address: provisionBody.originLocation.address,
      origin_lat: provisionBody.originLocation.lat,
      origin_lng: provisionBody.originLocation.lng,
      email: contactEmail,
    };

    if (integration?.id) {
      await admin
        .from("integrations")
        .update({
          status: "connected",
          external_account_id: flipyTiendaId,
          settings: newSettings,
          updated_at: now,
        })
        .eq("id", integration.id);
    } else {
      const inserted = await admin
        .from("integrations")
        .insert({
          agency_id: agencyId!,
          store_id: storeId!,
          provider: "flipy",
          status: "connected",
          external_account_id: flipyTiendaId,
          settings: newSettings,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();
      integration = inserted.data;
    }
    pass("connect-ui", `flipy_tienda_id=${flipyTiendaId}`);
  } else {
    pass("connect-ui", `already connected flipy_tienda_id=${flipyTiendaId}`);
    const ref =
      typeof settings.webhook_secret_ref === "string" ? settings.webhook_secret_ref : null;
    if (!webhookSecret && ref) {
      try {
        webhookSecret = decryptSecret(ref);
      } catch (e) {
        fail("webhook-secret", e instanceof Error ? e.message : "decrypt failed");
      }
    }
  }

  if (!webhookSecret) fail("webhook-secret", "missing FLIPY_WEBHOOK_SECRET and no ref");

  const saldo = await partnerRequest(storeId!, `/api/partner/tiendas/${flipyTiendaId}/saldo`);
  if (saldo.status !== 200) fail("saldo", `status ${saldo.status}`);
  pass("saldo", `billeteraOperaciones=${saldo.json.billeteraOperaciones ?? "?"}`);

  // Ensure order exists for live carrier handler
  const normalizedOrderId = orderExternalId.replace(/^shopify:/i, "").replace(/\D/g, "") || orderExternalId;
  let order = await admin
    .from("orders")
    .select("id")
    .eq("store_id", storeId!)
    .eq("external_order_id", normalizedOrderId)
    .maybeSingle();
  if (!order.data) {
    const ins = await admin
      .from("orders")
      .insert({
        agency_id: agencyId!,
        store_id: storeId!,
        external_order_id: normalizedOrderId,
        order_number: `#${normalizedOrderId}`,
        created_at_source: new Date().toISOString(),
        currency_code: "PEN",
        subtotal_amount: 89,
        total_amount: 104,
        shipping_amount: 15,
        payment_status: "cash_expected",
        order_status: "confirmed",
        confirmation_status: "confirmed",
        metadata: { shopify_payment_kind: "cod", f1_gate: true },
      })
      .select("id")
      .single();
    order = ins;
  }
  if (!order.data) fail("order-seed", "could not create order");
  pass("order-seed", normalizedOrderId);

  const createBody = {
    externalStoreId: storeId,
    externalOrderId: `shopify:${normalizedOrderId}`,
    orderNumber: `#${normalizedOrderId}`,
    escenarioPago: "1E",
    codAmount: 89,
    price: 15,
    originAddress: String(settings.origin_address ?? "Av. Gate 123, Lima"),
    originLat: Number(settings.origin_lat ?? -12.119),
    originLng: Number(settings.origin_lng ?? -77.029),
    originContact: "F1 Gate",
    destinationAddress: "Jr. Destino 456, Lima",
    destinationLat: -12.096,
    destinationLng: -77.028,
    destinationContact: "Cliente Gate",
    destinationPhone: "51988777666",
    shopifyPayment: { paymentKind: "cod", shopifySubtotal: 89, shopifyShippingAmount: 15 },
  };

  const created = await partnerRequest(storeId!, "/api/partner/envios", {
    method: "POST",
    idempotencyKey: `codtracked:order:f1gate-${normalizedOrderId}`,
    body: createBody,
  });
  if (created.status !== 200 && created.status !== 201) {
    fail("create-envio", `status ${created.status} ${JSON.stringify(created.json)}`);
  }
  const envioId = String(created.json.envioId ?? "");
  const trackingToken = String(created.json.trackingToken ?? `gate-${normalizedOrderId}`);
  pass("create-envio", envioId);

  async function fireWebhook(estado: string) {
    const payload = {
      type: "shipment.status.updated",
      data: {
        envioId,
        externalOrderId: `shopify:${normalizedOrderId}`,
        estado,
        trackingToken,
        escenarioPago: "1E",
      },
    };
    const rawBody = JSON.stringify(payload);
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Flipy-Signature": signFlipyWebhook(webhookSecret, rawBody),
        "X-Flipy-Event-Id": `f1gate-${estado}-${Date.now()}`,
      },
      body: rawBody,
    });
    const text = await res.text();
    if (!res.ok) fail(`webhook-${estado}`, `status ${res.status} ${text.slice(0, 200)}`);
    pass(`webhook-${estado}`, `status ${res.status}`);
  }

  await fireWebhook("EN_CURSO");
  await fireWebhook("ENTREGADO");

  process.env.ALLOW_JOB_WORKER = "true";
  execSync("npm run jobs:process -- --limit=20", {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });
  pass("jobs-process", "completed");

  const shipment = await admin
    .from("shipments")
    .select("id, status, tracking_number")
    .eq("store_id", storeId!)
    .eq("tracking_number", trackingToken)
    .maybeSingle();
  if (!shipment.data) fail("verify-shipment", "shipment not found");
  if (shipment.data.status !== "delivered") {
    fail("verify-shipment", `expected delivered, got ${shipment.data.status}`);
  }
  pass("verify-shipment", `delivered tracking=${trackingToken}`);

  console.log("\n=== F1 GATE ✅ ===");
  console.log(JSON.stringify({ results, flipyTiendaId, orderExternalId: normalizedOrderId, envioId }, null, 2));
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
