/**
 * Fire a signed Shopify GDPR compliance webhook against a deployed (or local) app.
 *
 * Usage:
 *   SHOPIFY_CLIENT_SECRET=... \
 *   SHOPIFY_APP_URL=https://your-preview.vercel.app \
 *   npx tsx scripts/test-shopify-privacy-webhook.ts [topic]
 *
 * topic default: customers/data_request
 * Then in Vercel → Logs search: shopify.webhook.privacy
 */
import { createHmac } from "node:crypto";

const topic = (process.argv[2] ?? "customers/data_request").toLowerCase();
const secret = process.env.SHOPIFY_CLIENT_SECRET?.trim();
const appUrl = (process.env.SHOPIFY_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "")
  .trim()
  .replace(/\/$/, "");
const shop = (process.env.SHOPIFY_TEST_SHOP ?? "codtracked-api-test.myshopify.com").trim();

if (!secret) {
  console.error("Missing SHOPIFY_CLIENT_SECRET");
  process.exit(1);
}
if (!appUrl) {
  console.error("Missing SHOPIFY_APP_URL or NEXT_PUBLIC_APP_URL");
  process.exit(1);
}

const allowed = new Set(["customers/data_request", "customers/redact", "shop/redact"]);
if (!allowed.has(topic)) {
  console.error(`Unsupported topic: ${topic}`);
  process.exit(1);
}

const payload =
  topic === "shop/redact"
    ? { shop_id: 999001, shop_domain: shop }
    : {
        shop_id: 999001,
        shop_domain: shop,
        customer: { id: 555001, email: "redacted@example.com", phone: "+10000000000" },
        orders_to_redact: topic === "customers/redact" ? [1001, 1002] : undefined,
        data_request: topic === "customers/data_request" ? { id: 777001 } : undefined,
      };

const rawBody = JSON.stringify(payload);
const hmac = createHmac("sha256", secret).update(rawBody).digest("base64");
const url = `${appUrl}/api/integrations/shopify/webhooks`;

async function main() {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Topic": topic,
      "X-Shopify-Hmac-Sha256": hmac,
      "X-Shopify-Shop-Domain": shop,
      "X-Shopify-Webhook-Id": `test-privacy-${Date.now()}`,
    },
    body: rawBody,
  });

  const text = await res.text();
  console.log(JSON.stringify({ url, topic, status: res.status, body: text }, null, 2));
  if (res.status !== 200) process.exit(1);
  console.log("OK — busca en Vercel Logs: shopify.webhook.privacy");
}

void main();
