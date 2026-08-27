/**
 * E2E staging checklist — Flipy v0.2 D3 payment matrix (COD-tracked part).
 *
 * Usage:
 *   npm run e2e:v02
 *   E2E_STRICT=1 npm run e2e:v02
 *
 * API smoke (Partner + webhooks): npm run smoke:v02
 * Requires Flipy A4 green on staging before doc freeze.
 */

type StepStatus = "pass" | "fail" | "skip" | "manual";

type Step = {
  id: string;
  title: string;
  how: string;
  metadataKeys: string[];
  status: StepStatus;
};

const steps: Step[] = [
  {
    id: "d3-1",
    title: "P+F prepagados → smart (1A)",
    how:
      "Pedido Shopify paid + shipping paid → wizard skip modalidad → flete bloqueado → create → success SIN FlipyBidsEmbed → metadata smartEligible=true fulfillmentMode=smart",
    metadataKeys: [
      "shopify_flipy_payment.smartEligible",
      "shopify_flipy_payment.fulfillmentMode",
      "shopify_flipy_payment.fleteQuote",
      "flipy_envio_id",
    ],
    status: "manual",
  },
  {
    id: "d3-2",
    title: "P prepago + F COD → bid",
    how:
      "Producto paid, shipping unpaid → modalidad 1E → flete editable → create bid → FlipyBidsEmbed en success → codAmount=0 en API",
    metadataKeys: [
      "shopify_flipy_payment.expectedCodShipping",
      "shopify_flipy_payment.fulfillmentMode=bid",
    ],
    status: "manual",
  },
  {
    id: "d3-3",
    title: "F prepago + P COD → bid",
    how:
      "Shipping paid, product COD → smartEligible pero bid (D4 solo smart si F prepago + P prepago) → flete fijo = shipping → cod P",
    metadataKeys: [
      "shopify_flipy_payment.expectedCodProduct",
      "shopify_flipy_payment.fulfillmentMode",
    ],
    status: "manual",
  },
  {
    id: "d3-4",
    title: "P+F COD → bid full",
    how:
      "COD típico → 1E/1C/1D → flete editable + pujas → metadata bid",
    metadataKeys: [
      "shopify_flipy_payment.confirmedEscenario",
      "shopify_flipy_payment.fletePrice",
    ],
    status: "manual",
  },
  {
    id: "wh-created",
    title: "Webhook shipment.created",
    how:
      "Post-create Flipy → CT webhook 200 → job flipy.shipment.lifecycle → metadata flipy_tracking_* actualizada",
    metadataKeys: ["flipy_webhook.lastEventType", "shopify_flipy_payment.lastWebhookAt"],
    status: "manual",
  },
  {
    id: "wh-assigned",
    title: "Webhook shipment.assigned",
    how: "Smart assign → metadata flipy_assigned_motorizado + carrier sync ASIGNADO",
    metadataKeys: ["flipy_assigned_motorizado", "shopify_flipy_payment.assignedMotorizado"],
    status: "manual",
  },
  {
    id: "wh-fallback",
    title: "Webhook shipment.smart_fallback_to_bid (D1)",
    how:
      "Timeout smart → alerta warning + fulfillmentMode=bid + FlipyBidsEmbed en UI pedido",
    metadataKeys: ["shopify_flipy_payment.smartFallbackToBid"],
    status: "manual",
  },
  {
    id: "auto-create-v02",
    title: "Auto-create v0.2 smart",
    how:
      "auto_create ON → pedido P+F prepago → job cotiza server-side mediano → create smart 1A (v0.2 always on)",
    metadataKeys: ["flipy_auto_create.status=created", "shopify_flipy_payment.fleteQuote"],
    status: "manual",
  },
];

function main() {
  console.log("# Flipy v0.2 E2E matrix — COD-tracked (Fase C)\n");
  console.log("Coordinar con Flipy A4 (`flipy-v0.2-smoke.js`) antes del freeze doc.\n");
  console.log("| ID | Caso | Estado | Metadata a verificar |");
  console.log("| --- | --- | --- | --- |");
  for (const step of steps) {
    const keys = step.metadataKeys.length ? step.metadataKeys.join(", ") : "—";
    console.log(`| ${step.id} | ${step.title} | ${step.status.toUpperCase()} | ${keys} |`);
  }
  console.log("\n## Pasos detallados\n");
  for (const step of steps) {
    console.log(`### ${step.id} — ${step.title}`);
    console.log(step.how);
    if (step.metadataKeys.length) {
      console.log(`\nMetadata: \`${step.metadataKeys.join("`, `")}\`\n`);
    }
  }

  console.log("\n## Automatizado\n");
  console.log("- `npm run smoke:v02` — Partner API D3 + lifecycle webhooks CT");
  console.log("- `npm run jobs:process` — procesar jobs tras webhooks");
  console.log("- `npm run test:unit` — map lifecycle + v02 gate + flete-rules\n");

  const strict = process.env.E2E_STRICT === "1";
  if (strict) {
    const pending = steps.filter((s) => s.status === "manual");
    if (pending.length) {
      console.error(`E2E_STRICT=1: ${pending.length} pasos manuales pendientes`);
      process.exit(1);
    }
  }
}

main();
