import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  agencyPathPlanSection,
  integrationProviderPlanSection,
  lockedNavHrefs,
  PLAN_SECTION_MIN_PLAN,
  resolvePlanEntitlements,
  type PlanSection,
} from "@/lib/billing/entitlements";
import {
  PLAN_COMPARISON_ROWS,
  PLAN_SECTION_COPY,
  planCardHighlights,
} from "@/lib/billing/plan-catalog";

// Mirrors supabase/migrations/20261022140000_plans_features_no_free.sql.
const STARTER = {
  reconciliation: false,
  whatsapp: false,
  automations: false,
  conversions: false,
  api: false,
  white_label: false,
};
const GROWTH = { ...STARTER, reconciliation: true, whatsapp: true, automations: true };
const SCALE = { ...GROWTH, conversions: true, api: true, white_label: true };

const PLANS = [
  { code: "starter", name: "Starter", store_limit: 1, order_limit: 300, features: STARTER },
  { code: "growth", name: "Growth", store_limit: 3, order_limit: 1000, features: GROWTH },
  { code: "scale", name: "Scale", store_limit: 5, order_limit: 5000, features: SCALE },
];

function row(label: string) {
  const found = PLAN_COMPARISON_ROWS.find((r) => r.label === label);
  assert.ok(found, label);
  return PLANS.map((plan) => found.value(plan));
}

describe("plan comparison in Facturación", () => {
  it("shows limits from the plan rows", () => {
    assert.deepEqual(row("Tiendas"), ["1", "3", "5"]);
    assert.deepEqual(row("Pedidos al mes"), [300, 1000, 5000].map((n) => n.toLocaleString("es")));
  });

  it("matches what each tier unlocks", () => {
    assert.deepEqual(row("Resumen con ROAS real y RTO"), [true, true, true]);
    assert.deepEqual(row("Flipy y couriers (Envia, Enviame)"), [true, true, true]);
    assert.deepEqual(row("Conciliación de cobros"), [false, true, true]);
    assert.deepEqual(row("Confirmación COD por WhatsApp"), [false, true, true]);
    assert.deepEqual(row("Automatizaciones"), [false, true, true]);
    assert.deepEqual(row("Conversiones a Meta y TikTok"), [false, false, true]);
    assert.deepEqual(row("Claves API"), [false, false, true]);
    assert.deepEqual(row("Marca blanca"), [false, false, true]);
  });

  it("agrees with the entitlements for every gated section", () => {
    const rowBySection: Record<Exclude<PlanSection, "console">, string> = {
      reconciliation: "Conciliación de cobros",
      whatsapp: "Confirmación COD por WhatsApp",
      automations: "Automatizaciones",
      conversions: "Conversiones a Meta y TikTok",
      api: "Claves API",
    };
    for (const [section, label] of Object.entries(rowBySection) as Array<
      [Exclude<PlanSection, "console">, string]
    >) {
      const unlocked = PLANS.map(
        (plan) =>
          resolvePlanEntitlements({
            planCode: plan.code,
            planName: plan.name,
            features: plan.features,
            accessAllowed: true,
          }).sections[section],
      );
      assert.deepEqual(row(label), unlocked, section);
      // The cheapest tier that unlocks it is the one named in upgrade messages.
      assert.equal(PLANS[unlocked.indexOf(true)]?.name, PLAN_SECTION_MIN_PLAN[section], section);
    }
  });

  it("cards list what each tier adds over the previous one", () => {
    assert.deepEqual(planCardHighlights(PLANS[0]!, null), [
      "Pedidos COD, ROAS real y RTO",
      "Flipy y couriers integrados",
      "Atribución de Meta y TikTok",
    ]);
    assert.deepEqual(planCardHighlights(PLANS[1]!, PLANS[0]!), [
      "Todo lo de Starter",
      "Conciliación de cobros",
      "Confirmación por WhatsApp",
      "Automatizaciones",
    ]);
    assert.deepEqual(planCardHighlights(PLANS[2]!, PLANS[1]!), [
      "Todo lo de Growth",
      "Conversiones a Meta y TikTok",
      "Claves API",
      "Marca blanca",
    ]);
  });
});

describe("public plans in Facturación", () => {
  it("hides Agency but keeps it active for agencies already on it", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20261023100000_hide_agency_plan.sql"),
      "utf8",
    );
    assert.match(sql, /set\s+is_public = false,[\s\S]*where code = 'agency';/);
    assert.doesNotMatch(sql, /is_active/);
  });

  it("only lists public plans in Facturación", () => {
    const source = readFileSync(resolve(process.cwd(), "services/billing.service.ts"), "utf8");
    const plansQueries = source.match(/\.from\("plans"\)[\s\S]*?\.order\("monthly_price"/g) ?? [];
    assert.equal(plansQueries.length, 2);
    for (const query of plansQueries) {
      assert.match(query, /\.eq\("is_public", true\)/);
    }
  });
});

describe("upgrade hints", () => {
  it("has friendly copy for every gated section", () => {
    for (const section of Object.keys(PLAN_SECTION_MIN_PLAN) as PlanSection[]) {
      const copy = PLAN_SECTION_COPY[section];
      assert.ok(copy.title.length > 0, section);
      assert.ok(copy.benefit.endsWith("."), section);
    }
  });

  it("locks API keys in the agency menu below Scale", () => {
    const starter = resolvePlanEntitlements({
      planCode: "starter",
      planName: "Starter",
      features: STARTER,
      accessAllowed: true,
    });
    assert.equal(agencyPathPlanSection("/api-keys"), "api");
    assert.deepEqual(lockedNavHrefs("agency", starter, ["/overview", "/billing", "/api-keys"]), [
      "/api-keys",
    ]);
  });

  it("keeps setup integrations open and gates Flipy and WhatsApp", () => {
    assert.equal(integrationProviderPlanSection("shopify"), null);
    assert.equal(integrationProviderPlanSection("meta"), null);
    assert.equal(integrationProviderPlanSection("flipy"), "console");
    assert.equal(integrationProviderPlanSection("whatsapp"), "whatsapp");
  });

  it("swaps higher-plan panels for an inline hint on the order page", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/a/[agencySlug]/s/[storeSlug]/orders/[orderId]/page.tsx"),
      "utf8",
    );
    for (const section of ["whatsapp", "reconciliation", "conversions"]) {
      assert.match(source, new RegExp(`plan\\.${section}`), section);
      assert.match(source, new RegExp(`<PlanUpsellInline[^>]*section="${section}"`), section);
    }
  });

  it("names Scale for white label everywhere", () => {
    for (const file of ["components/branding/BrandingForm.tsx", "app/actions/branding.ts"]) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      assert.match(source, /Scale/, file);
      assert.doesNotMatch(source, /Growth/, file);
    }
  });
});
