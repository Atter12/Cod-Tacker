import type { AutomationRuleRow, AutomationRunRow } from "@/types/database";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

export async function listAutomationRules(
  client: DatabaseClient,
  storeId: string,
): Promise<AutomationRuleRow[]> {
  const result = await client
    .from("automation_rules")
    .select()
    .eq("store_id", requireValue(storeId, "Tienda inválida."))
    .order("priority", { ascending: true });
  throwQueryError(result.error);
  return result.data ?? [];
}

export async function getAutomationRuleById(
  client: DatabaseClient,
  storeId: string,
  ruleId: string,
): Promise<AutomationRuleRow | null> {
  const result = await client
    .from("automation_rules")
    .select()
    .eq("store_id", storeId)
    .eq("id", ruleId)
    .maybeSingle();
  throwQueryError(result.error);
  return result.data;
}

export async function listAutomationRuns(
  client: DatabaseClient,
  storeId: string,
  ruleId: string,
  options?: { page?: number; pageSize?: number },
): Promise<{ rows: AutomationRunRow[]; total: number }> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const result = await client
    .from("automation_runs")
    .select("*", { count: "exact" })
    .eq("store_id", storeId)
    .eq("rule_id", ruleId)
    .order("created_at", { ascending: false })
    .range(from, to);
  throwQueryError(result.error);
  return { rows: result.data ?? [], total: result.count ?? 0 };
}

export async function getAutomationRunById(
  client: DatabaseClient,
  storeId: string,
  runId: string,
): Promise<AutomationRunRow | null> {
  const result = await client
    .from("automation_runs")
    .select()
    .eq("store_id", storeId)
    .eq("id", runId)
    .maybeSingle();
  throwQueryError(result.error);
  return result.data;
}
