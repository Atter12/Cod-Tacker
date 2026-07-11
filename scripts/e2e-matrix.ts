/**
 * E2E matrix checklist for Integration-Ready V1 (mock mode).
 *
 * Usage:
 *   npm run e2e:matrix
 *   E2E_STRICT=1 npm run e2e:matrix   # exit 1 if any step marked fail in env overrides
 *
 * This script documents and prints the reproducible 16-step flow.
 * Steps that require a live browser/session are marked as MANUAL.
 * Automated probes verify env + health when credentials exist.
 */
import { createClient } from "@supabase/supabase-js";

type StepStatus = "pass" | "fail" | "skip" | "manual";

type Step = {
  id: number;
  title: string;
  how: string;
  status: StepStatus;
  detail?: string;
};

const steps: Step[] = [
  {
    id: 1,
    title: "Registrar usuario",
    how: "UI /register → OTP → sesión",
    status: "manual",
  },
  {
    id: 2,
    title: "Onboarding agencia/tienda",
    how: "/onboarding → crea agency + store + trial Starter",
    status: "manual",
  },
  {
    id: 3,
    title: "Crear segunda tienda",
    how: "Agencia → Tiendas → crear (respeta store_limit del plan)",
    status: "manual",
  },
  {
    id: 4,
    title: "Invitar y aceptar usuario",
    how: "Equipo → invitar → /invites/accept?token=…",
    status: "manual",
  },
  {
    id: 5,
    title: "Conectar Shopify demo",
    how: "Integraciones → Shopify → conectar mock → sync",
    status: "manual",
  },
  {
    id: 6,
    title: "Generar/importar pedidos (raw_events/jobs)",
    how: "ALLOW_DEMO_SEED=true npm run seed:demo  OR sync mock + npm run jobs:process",
    status: "manual",
  },
  {
    id: 7,
    title: "Sincronizar Meta/TikTok mock",
    how: "Integraciones → Meta/TikTok → sync / seed jerarquía ads",
    status: "manual",
  },
  {
    id: 8,
    title: "Crear shipment + carrier events",
    how: "Logística → mock event → jobs:process",
    status: "manual",
  },
  {
    id: 9,
    title: "Confirmar/rechazar desde WhatsApp mock",
    how: "WhatsApp → conversación → simular respuesta → jobs:process",
    status: "manual",
  },
  {
    id: 10,
    title: "Entregar/retornar",
    how: "Carrier mock delivered/returned → pedido/shipment actualizados",
    status: "manual",
  },
  {
    id: 11,
    title: "Importar conciliación CSV",
    how: "Conciliación → Importar → preview → confirmar",
    status: "manual",
  },
  {
    id: 12,
    title: "Conciliar",
    how: "Batch → match / aprobar / resolver discrepancias",
    status: "manual",
  },
  {
    id: 13,
    title: "Ejecutar automatización",
    how: "Automatizaciones → crear regla → disparar / simular",
    status: "manual",
  },
  {
    id: 14,
    title: "Investigar y reprocesar job fallido",
    how: "Admin → Tareas / Dead-letter → retry / process",
    status: "manual",
  },
  {
    id: 15,
    title: "Verificar ROAS/RTO/margen",
    how: "Atribución + RTO + dashboard con datos persistidos",
    status: "manual",
  },
  {
    id: 16,
    title: "Revisar auditoría",
    how: "Admin → Auditoría / audit_logs de acciones sensibles",
    status: "manual",
  },
];

async function probeAutomated(): Promise<Step[]> {
  const extra: Step[] = [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (appUrl) {
    try {
      const res = await fetch(`${appUrl}/api/health`, { cache: "no-store" });
      const body = (await res.json()) as { status?: string };
      extra.push({
        id: 100,
        title: "Health endpoint",
        how: "GET /api/health",
        status: res.ok && body.status !== "down" ? "pass" : "fail",
        detail: `HTTP ${res.status} status=${body.status ?? "?"}`,
      });
    } catch (err) {
      extra.push({
        id: 100,
        title: "Health endpoint",
        how: "GET /api/health",
        status: "skip",
        detail: err instanceof Error ? err.message : "unreachable (start npm run dev)",
      });
    }
  } else {
    extra.push({
      id: 100,
      title: "Health endpoint",
      how: "GET /api/health",
      status: "skip",
      detail: "NEXT_PUBLIC_APP_URL unset",
    });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.ANON_KEY;
  if (url && key) {
    try {
      const sb = createClient(url, key, { auth: { persistSession: false } });
      const { error } = await sb.from("plans").select("code").limit(3);
      extra.push({
        id: 101,
        title: "Supabase plans readable",
        how: "anon select plans",
        status: error ? "fail" : "pass",
        detail: error?.message ?? "ok",
      });
    } catch (err) {
      extra.push({
        id: 101,
        title: "Supabase plans readable",
        how: "anon select plans",
        status: "fail",
        detail: err instanceof Error ? err.message : "error",
      });
    }
  } else {
    extra.push({
      id: 101,
      title: "Supabase plans readable",
      how: "anon select plans",
      status: "skip",
      detail: "Supabase URL/anon key unset",
    });
  }

  const mode = process.env.INTEGRATION_MODE ?? "(default mock outside prod)";
  extra.push({
    id: 102,
    title: "Integration mode is mock for V1 demo",
    how: "INTEGRATION_MODE / MOCK_INTEGRATIONS_ENABLED",
    status: process.env.INTEGRATION_MODE === "live" ? "fail" : "pass",
    detail: `INTEGRATION_MODE=${mode}`,
  });

  return extra;
}

async function main() {
  console.log("\n=== CODTracked E2E Matrix — Integration-Ready V1 ===\n");
  console.log("Manual steps (1–16) must be walked in the UI with mock integrations.\n");

  for (const step of steps) {
    console.log(
      `[${step.status.toUpperCase().padEnd(6)}] ${String(step.id).padStart(2)}. ${step.title}`,
    );
    console.log(`         → ${step.how}`);
  }

  console.log("\n--- Automated probes ---\n");
  const probes = await probeAutomated();
  for (const step of probes) {
    console.log(
      `[${step.status.toUpperCase().padEnd(6)}] ${step.id}. ${step.title}${step.detail ? ` (${step.detail})` : ""}`,
    );
  }

  const failed = probes.filter((s) => s.status === "fail");
  console.log("\nSee docs/E2E_MATRIX.md and docs/OPERATIONS_RUNBOOK.md for full operator steps.\n");

  if (process.env.E2E_STRICT === "1" && failed.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
