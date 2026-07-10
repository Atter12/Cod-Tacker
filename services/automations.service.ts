import type { AutomationRuleRow } from "@/types/database";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

/** Services receive the request-scoped typed client so RLS remains enforced and callers can test queries. */
export async function listAutomationRules(client: DatabaseClient, storeId: string): Promise<AutomationRuleRow[]> {
  const result = await client.from("automation_rules").select().eq("store_id", requireValue(storeId, "Tienda inválida.")).order("created_at", { ascending: false });
  throwQueryError(result.error);
  return result.data ?? [];
}
