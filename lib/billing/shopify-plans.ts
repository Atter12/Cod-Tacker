import {
  BILLING_SELF_SERVE_PLAN_CODES,
  isSelfServePlanCode,
  type BillingSelfServePlanCode,
} from "@/lib/integrations/contracts/billing";

/**
 * Maps Partner Dashboard plan handles ↔ local `plans.code`.
 * Defaults keep handles equal to codes; override with SHOPIFY_PLAN_HANDLE_*.
 */

export type ShopifyPlanHandleMap = Record<BillingSelfServePlanCode, string>;

const DEFAULT_HANDLES: ShopifyPlanHandleMap = {
  starter: "starter",
  growth: "growth",
  scale: "scale",
};

/** Plan handles configured for Partner Dashboard (self-serve only). */
export function getShopifyPlanHandleMap(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): ShopifyPlanHandleMap {
  const map = { ...DEFAULT_HANDLES };
  for (const code of BILLING_SELF_SERVE_PLAN_CODES) {
    const key = `SHOPIFY_PLAN_HANDLE_${code.toUpperCase()}`;
    const raw = env[key]?.trim();
    if (raw) map[code] = raw;
  }
  return map;
}

export function planCodeToShopifyHandle(
  planCode: string,
  map: ShopifyPlanHandleMap = getShopifyPlanHandleMap(),
): string | null {
  if (!isSelfServePlanCode(planCode)) return null;
  return map[planCode] ?? null;
}

export function shopifyHandleToPlanCode(
  planHandle: string,
  map: ShopifyPlanHandleMap = getShopifyPlanHandleMap(),
): BillingSelfServePlanCode | null {
  const normalized = planHandle.trim().toLowerCase();
  if (!normalized) return null;
  for (const code of BILLING_SELF_SERVE_PLAN_CODES) {
    if (map[code].toLowerCase() === normalized) return code;
  }
  if (isSelfServePlanCode(normalized)) return normalized;
  return null;
}

/** True when every self-serve plan has a non-empty handle (always true with defaults). */
export function isShopifyPlanMapConfigured(
  map: ShopifyPlanHandleMap = getShopifyPlanHandleMap(),
): boolean {
  return BILLING_SELF_SERVE_PLAN_CODES.every((code) => Boolean(map[code]?.trim()));
}
