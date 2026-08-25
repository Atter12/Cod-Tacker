import "server-only";

/** Per-store Flipy integration settings (F3-04 pickup, F4 automation). */

export type FlipyAutoCreateMinConfidence = "high" | "medium";

export type FlipyIntegrationSettings = {
  pickupKeywords: string[];
  autoCreateEnabled: boolean;
  autoCreateMinConfidence: FlipyAutoCreateMinConfidence;
  /** F4-03 — embed panel pujas (evaluación, opt-in). */
  embedBidsEvalEnabled: boolean;
  /** v0.2 Partner API rollout per store (§ Fase B B4). */
  v02Enabled: boolean;
};

const DEFAULT_PICKUP_KEYWORDS: string[] = [];
const DEFAULT_AUTO_CREATE_MIN_CONFIDENCE: FlipyAutoCreateMinConfidence = "high";

function readSettingsBag(settings: unknown): Record<string, unknown> {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return {};
  return settings as Record<string, unknown>;
}

export function readFlipyPickupKeywords(settings: unknown): string[] {
  const bag = readSettingsBag(settings);
  const raw = bag.pickup_keywords ?? bag.pickupKeywords;
  if (!Array.isArray(raw)) return DEFAULT_PICKUP_KEYWORDS;
  return raw
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

export function readFlipyAutoCreateEnabled(settings: unknown): boolean {
  const bag = readSettingsBag(settings);
  return Boolean(bag.auto_create_enabled ?? bag.autoCreateEnabled);
}

export function readFlipyAutoCreateMinConfidence(settings: unknown): FlipyAutoCreateMinConfidence {
  const bag = readSettingsBag(settings);
  const raw = bag.auto_create_min_confidence ?? bag.autoCreateMinConfidence;
  if (raw === "medium") return "medium";
  return DEFAULT_AUTO_CREATE_MIN_CONFIDENCE;
}

export function readFlipyEmbedBidsEvalEnabled(settings: unknown): boolean {
  const bag = readSettingsBag(settings);
  return Boolean(bag.embed_bids_eval_enabled ?? bag.embedBidsEvalEnabled);
}

/** Per-store v0.2 rollout; env FLIPY_V02_ENABLED=true enables globally as default-on. */
export function readFlipyV02Enabled(settings: unknown): boolean {
  const envDefault = process.env.FLIPY_V02_ENABLED === "true";
  const bag = readSettingsBag(settings);
  const raw = bag.flipy_v02 ?? bag.flipyV02 ?? bag.v02_enabled ?? bag.v02Enabled;
  if (typeof raw === "boolean") return raw;
  return envDefault;
}

export function normalizePickupKeywordInput(input: string): string[] {
  return input
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 40);
}

export function mergeFlipyPickupKeywords(settings: unknown, keywords: string[]): Record<string, unknown> {
  const base = readSettingsBag(settings);
  return {
    ...base,
    pickup_keywords: keywords,
  };
}

export function mergeFlipyAutoCreateSettings(
  settings: unknown,
  input: {
    enabled: boolean;
    minConfidence: FlipyAutoCreateMinConfidence;
  },
): Record<string, unknown> {
  const base = readSettingsBag(settings);
  return {
    ...base,
    auto_create_enabled: input.enabled,
    auto_create_min_confidence: input.minConfidence,
  };
}

export function mergeFlipyEmbedBidsEvalSettings(
  settings: unknown,
  enabled: boolean,
): Record<string, unknown> {
  const base = readSettingsBag(settings);
  return {
    ...base,
    embed_bids_eval_enabled: enabled,
  };
}

export function mergeFlipyV02Settings(settings: unknown, enabled: boolean): Record<string, unknown> {
  const base = readSettingsBag(settings);
  return {
    ...base,
    flipy_v02: enabled,
  };
}

