/**
 * F3 + F4 cross-repo smoke — Flipy Partner API (prod/staging).
 * Espejo: flipy/backend/scripts/flipy-f3-f4-smoke.js
 *
 * Usage:
 *   FLIPY_PARTNER_API_KEY=... \
 *   FLIPY_API_BASE_URL=https://flipy-backend.vercel.app \
 *   STORE_ID=60db8866-b5ff-4ca9-84c7-eacddaa72bd2 \
 *   TIENDA_ID=cmt7pgzdl0003bgtxm020y9nx \
 *   ORDER_EXTERNAL_ID=f3f4-smoke-001 \
 *   npx tsx scripts/flipy-f3-f4-smoke.ts
 */
import {
  buildFlipyProvisionRequestBody,
  readFlipySaldoOperaciones,
  readFlipySaldoWarningBajo,
} from "../lib/integrations/flipy/partner-contract";
import type { FlipyEscenarioPago } from "../lib/integrations/flipy/resolve-payment";

const partnerKey = process.env.FLIPY_PARTNER_API_KEY?.trim();
const flipyBase = (process.env.FLIPY_API_BASE_URL ?? "https://flipy-backend.vercel.app").replace(
  /\/$/,
  "",
);
const storeId = process.env.STORE_ID?.trim();
const tiendaIdEnv = process.env.TIENDA_ID?.trim();
const partnerId = process.env.FLIPY_PARTNER_ID?.trim() ?? "codtracked";
const orderExternalId = process.env.ORDER_EXTERNAL_ID?.trim() ?? `f3f4-${Date.now()}`;
const contactEmail =
  process.env.CONTACT_EMAIL?.trim()
  ?? `ops+${(storeId ?? "smoke").replace(/-/g, "").slice(0, 12)}@f3f4-smoke.test`;

const originLat = Number(process.env.ORIGIN_LAT ?? "-12.119");
const originLng = Number(process.env.ORIGIN_LNG ?? "-77.029");
const destLat = Number(process.env.DEST_LAT ?? "-12.096");
const destLng = Number(process.env.DEST_LNG ?? "-77.028");

const CSV_COLUMNS = [
  "envio_id",
  "external_order_id",
  "shopify_order_id",
  "estado",
  "escenario_pago",
  "flete_soles",
  "cod_producto_soles",
  "producto_cobrado",
  "flete_en_custodia",
  "flete_cobrado_efectivo",
  "hold_monto",
  "hold_estado",
  "hold_cargo_modo",
  "oferta_aceptada_soles",
  "fecha_entrega",
  "created_at",
  "updated_at",
  "tracking_token",
  "tracking_url",
] as const;

const NOTE_KEYS = [
  "flipy_escenario",
  "flipy_escenario_pago",
  "codtracked_flipy_escenario",
  "flipy_pago_escenario",
  "escenario_pago",
  "escenario",
] as const;

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
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===`);
  for (const row of results) {
    console.log(`  ${row.ok ? "✓" : "✗"} ${row.id}: ${row.detail}`);
  }
}

function parseNoteEscenario(
  noteAttributes: Array<{ name?: string; value?: string }>,
): FlipyEscenarioPago | null {
  for (const attr of noteAttributes) {
    const name = attr.name?.trim().toLowerCase();
    if (!name || !NOTE_KEYS.some((key) => key === name)) continue;
    const value = attr.value?.trim().toUpperCase();
    if (value === "1A" || value === "1C" || value === "1E" || value === "1D" || value === "GRATIS") {
      return value;
    }
  }
  return null;
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

async function partnerRequest(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    idempotencyKey?: string;
    accept?: string;
    raw?: boolean;
  } = {},
) {
  const url = `${flipyBase}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Accept: options.accept ?? "application/json",
    "Content-Type": "application/json",
    "X-Partner-Key": partnerKey!,
    "X-Partner-Id": partnerId,
    "X-External-Store-Id": storeId!,
  };
  if (options.idempotencyKey) headers["X-Idempotency-Key"] = options.idempotencyKey;

  const res = await fetch(url, {
    method: options.method ?? (options.body != null ? "POST" : "GET"),
    headers,
    body:
      options.body != null
        ? typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body)
        : undefined,
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  if (text.trim() && !options.raw) {
    try {
      json = asRecord(JSON.parse(text));
    } catch {
      json = { raw: text };
    }
  } else if (options.raw) {
    json = { raw: text };
  }
  return { res, json, text };
}

async function widgetRequest(path: string, token: string, options: { method?: string; body?: unknown } = {}) {
  const url = `${flipyBase}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });
  const json = asRecord(await res.json().catch(() => ({})));
  return { res, json };
}

async function checkEmbedPage(url: string, label: string) {
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    const ok = res.status >= 200 && res.status < 400;
    record(label, ok, `GET ${url} → ${res.status}`);
    return ok;
  } catch (err) {
    record(label, false, `${url} → ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function main() {
  if (!partnerKey) fail("Missing FLIPY_PARTNER_API_KEY");
  if (!storeId) fail("Missing STORE_ID");

  console.log(`=== F3/F4 smoke → ${flipyBase} (store ${storeId}) ===\n`);

  let tiendaId = tiendaIdEnv;
  if (!tiendaId) {
    const provisionBody = buildFlipyProvisionRequestBody({
      externalStoreId: storeId,
      nombre: process.env.STORE_NAME?.trim() ?? "Smoke Tienda CT F3/F4",
      contactEmail,
      telefono: process.env.CONTACT_PHONE?.trim() ?? "51999888777",
      originAddress: process.env.ORIGIN_ADDRESS?.trim() ?? "Av. Smoke 123, Lima",
      originLat,
      originLng,
    });
    const { res, json } = await partnerRequest("/api/partner/tiendas", {
      method: "POST",
      idempotencyKey: `codtracked:store:${storeId}`,
      body: provisionBody,
    });
    const resolvedTiendaId = String(json.tiendaId ?? "");
    const ok = res.ok && Boolean(resolvedTiendaId);
    record("F0-provision", ok, ok ? `tiendaId=${resolvedTiendaId}` : `status=${res.status}`);
    if (!ok) fail("Provision failed");
    tiendaId = resolvedTiendaId;
  } else {
    record("F0-provision", true, `TIENDA_ID env=${tiendaId}`);
  }

  const walletTokenRes = await partnerRequest("/api/partner/widgets/token", {
    method: "POST",
    body: { scope: ["wallet_topup"] },
  });
  const walletToken = String(walletTokenRes.json.token ?? "");
  const recargaEmbedUrl = String(walletTokenRes.json.recargaEmbedUrl ?? "");
  record(
    "F3-01-widget-recarga",
    walletTokenRes.res.ok && Boolean(walletToken) && Boolean(recargaEmbedUrl),
    `token=${Boolean(walletToken)} recargaEmbedUrl=${Boolean(recargaEmbedUrl)}`,
  );

  if (walletToken) {
    const saldoEmbed = await widgetRequest("/api/partner/embed/wallet/saldo", walletToken);
    const operaciones = saldoEmbed.json.billeteraOperaciones;
    record(
      "F3-01-embed-wallet-saldo",
      saldoEmbed.res.ok && operaciones != null,
      `status=${saldoEmbed.res.status} billeteraOperaciones=${String(operaciones)}`,
    );
    if (recargaEmbedUrl) await checkEmbedPage(recargaEmbedUrl, "F3-01-embed-recarga-page");
  }

  const ubicacionTokenRes = await partnerRequest("/api/partner/widgets/token", {
    method: "POST",
    body: { scope: ["location_picker"] },
  });
  const ubicacionEmbedUrl = String(ubicacionTokenRes.json.ubicacionEmbedUrl ?? "");
  record(
    "F3-embed-ubicacion",
    ubicacionTokenRes.res.ok && Boolean(ubicacionTokenRes.json.token) && Boolean(ubicacionEmbedUrl),
    `ubicacionEmbedUrl=${Boolean(ubicacionEmbedUrl)}`,
  );
  if (ubicacionEmbedUrl) await checkEmbedPage(ubicacionEmbedUrl, "F3-embed-ubicacion-page");

  const saldoRes = await partnerRequest(`/api/partner/tiendas/${encodeURIComponent(tiendaId)}/saldo`);
  const operaciones = readFlipySaldoOperaciones(saldoRes.json);
  const warningBajo = readFlipySaldoWarningBajo(saldoRes.json);
  record(
    "F3-02-saldo-health",
    saldoRes.res.ok,
    `operaciones=${operaciones} warningBajo=${warningBajo}`,
  );
  if (operaciones < Number(process.env.FLIPY_SMOKE_TOPUP_PEN ?? "50")) {
    record(
      "F3-02-smoke-topup",
      false,
      `saldo ${operaciones} bajo — recargar en Flipy o correr smoke desde flipy con DATABASE_URL`,
    );
  }

  const noteAttributes = [
    { name: "flipy_escenario_pago", value: "1C" },
    { name: "codtracked_flipy_escenario", value: "1C" },
  ];
  record(
    "F3-05-note-parse-local",
    parseNoteEscenario(noteAttributes) === "1C",
    `resolved=${parseNoteEscenario(noteAttributes)}`,
  );

  const createBody = {
    externalStoreId: storeId,
    externalOrderId: `shopify:${orderExternalId}`,
    orderNumber: `#${orderExternalId}`,
    escenarioPago: "1E",
    noteAttributes,
    codAmount: 50,
    price: 12,
    originAddress: process.env.ORIGIN_ADDRESS?.trim() ?? "Av. Smoke 123, Lima",
    originLat,
    originLng,
    originContact: "Smoke Tienda",
    destinationAddress: "Jr. Destino F3F4 456, Lima",
    destinationLat: destLat,
    destinationLng: destLng,
    destinationContact: "Cliente Smoke F3F4",
    destinationPhone: "51988777666",
    shopifyPayment: { paymentKind: "cod", shopifySubtotal: 50, noteAttributes },
  };

  const createdRes = await partnerRequest("/api/partner/envios", {
    method: "POST",
    idempotencyKey: `codtracked:order:${orderExternalId}`,
    body: createBody,
  });
  const created = createdRes.json;
  const envioId = String(created.envioId ?? "");
  const createOk = createdRes.res.ok && Boolean(envioId);
  record(
    "F3-create-envio",
    createOk,
    createOk
      ? `envioId=${envioId} origin=${createBody.originAddress} dest=${createBody.destinationAddress}`
      : `${String(created.code ?? createdRes.res.status)}: ${String(created.message ?? JSON.stringify(created).slice(0, 200))}`,
  );
  record(
    "F3-create-origin-destination",
    createOk
      && Boolean(createBody.originLat && createBody.originLng && createBody.destinationLat && createBody.destinationLng)
      && Boolean(createBody.originAddress)
      && Boolean(createBody.destinationAddress),
    `originContact=${createBody.originContact} destContact=${createBody.destinationContact}`,
  );
  record(
    "F3-03-deep-links",
    createOk
      && Boolean(created.appWebUrl)
      && Boolean(created.pujasWebUrl)
      && String(created.appWebUrl).includes(envioId),
    `appWebUrl=${String(created.appWebUrl ?? "missing")} pujasWebUrl=${String(created.pujasWebUrl ?? "missing")}`,
  );
  record(
    "F3-05-note-attributes-create",
    created.escenarioPago === "1C",
    `escenarioPago=${String(created.escenarioPago)} (expected 1C)`,
  );

  let bidsEnvioId = envioId;
  if (!bidsEnvioId) {
    const fallbackOrder = process.env.FALLBACK_ORDER_EXTERNAL_ID?.trim();
    if (fallbackOrder) {
      const fallbackRes = await partnerRequest(
        `/api/partner/envios/by-external-order?externalOrderId=${encodeURIComponent(fallbackOrder)}`,
      );
      bidsEnvioId = String(fallbackRes.json.envioId ?? "");
      record(
        "F4-fallback-envio",
        Boolean(bidsEnvioId),
        `${fallbackOrder}${bidsEnvioId ? ` → ${bidsEnvioId}` : " not found"}`,
      );
    }
  }

  if (!bidsEnvioId) {
    record("F4-03-widget-bids", false, "skipped — no envioId");
  } else {
    const bidsTokenRes = await partnerRequest("/api/partner/widgets/token", {
      method: "POST",
      body: {
        scope: ["bids_panel"],
        orderContext: { envioId: bidsEnvioId, externalOrderId: `shopify:${orderExternalId}` },
      },
    });
    const bidsToken = String(bidsTokenRes.json.token ?? "");
    const pujasEmbedUrl = String(bidsTokenRes.json.pujasEmbedUrl ?? "");
    const claims = decodeJwtPayload(bidsToken);
    const pujasHasEnvio =
      !pujasEmbedUrl || pujasEmbedUrl.includes(encodeURIComponent(bidsEnvioId)) || pujasEmbedUrl.includes(`envioId=${bidsEnvioId}`);
    record(
      "F4-03-widget-bids",
      bidsTokenRes.res.ok && Boolean(bidsToken) && Boolean(pujasEmbedUrl) && pujasHasEnvio,
      `pujasEmbedUrl=${Boolean(pujasEmbedUrl)} envioIdClaim=${String(claims?.envioId ?? "missing")} urlHasEnvio=${pujasHasEnvio}`,
    );
    if (bidsToken) {
      const bidsPanel = await widgetRequest(
        `/api/partner/embed/bids/envio?envioId=${encodeURIComponent(bidsEnvioId)}`,
        bidsToken,
      );
      const panelData = asRecord(bidsPanel.json.data);
      const panelEnvio = asRecord(panelData.envio);
      record(
        "F4-03-embed-bids-envio",
        bidsPanel.res.ok && panelEnvio.envioId === bidsEnvioId,
        `status=${bidsPanel.res.status} count=${String(panelData.count ?? "?")}`,
      );
      if (pujasEmbedUrl) await checkEmbedPage(pujasEmbedUrl, "F4-03-embed-pujas-page");
    }
  }

  const csvExport = await partnerRequest(
    `/api/partner/tiendas/${encodeURIComponent(tiendaId)}/conciliacion/export?format=csv`,
    { accept: "text/csv", raw: true },
  );
  const csvText = csvExport.text ?? "";
  const csvHeaderOk = csvText.split("\n")[0]?.includes("envio_id") ?? false;
  const csvColsOk = CSV_COLUMNS.every((col) => csvText.includes(col));
  record(
    "F4-02-conciliacion-csv",
    csvExport.res.ok && csvHeaderOk && csvColsOk,
    `status=${csvExport.res.status} bytes=${csvText.length}`,
  );

  const jsonExport = await partnerRequest(
    `/api/partner/tiendas/${encodeURIComponent(tiendaId)}/conciliacion/export?format=json`,
  );
  const rowCount = jsonExport.json.count;
  record(
    "F4-02-conciliacion-json",
    jsonExport.res.ok && typeof rowCount === "number" && rowCount >= 1,
    `status=${jsonExport.res.status} count=${String(rowCount)}`,
  );

  const settlementExport = await partnerRequest(
    `/api/partner/tiendas/${encodeURIComponent(tiendaId)}/conciliacion/export?format=settlement`,
    { accept: "text/csv", raw: true },
  );
  const settlementText = settlementExport.text ?? "";
  const settlementHeaderOk = settlementText.split("\n")[0]?.includes("tracking") ?? false;
  record(
    "F4-02-conciliacion-settlement",
    settlementExport.res.ok && settlementHeaderOk,
    `status=${settlementExport.res.status} bytes=${settlementText.length}`,
  );

  printSummary();
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) process.exit(1);

  console.log("\nOK — F3/F4 smoke passed.");
  if (envioId) console.log(`envioId=${envioId} orderExternalId=${orderExternalId}`);
  else if (bidsEnvioId) console.log(`fallback envioId=${bidsEnvioId}`);
}

void main().catch((err) => {
  console.error(err);
  printSummary();
  process.exit(1);
});
