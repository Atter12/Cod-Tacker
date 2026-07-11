import { z } from "zod";

/** Versioned store settings JSON (stores.settings). */
export const STORE_SETTINGS_SCHEMA_VERSION = 1 as const;

const rtoSchema = z.object({
  highRiskThresholdPct: z.number().min(0).max(100).default(35),
  criticalThresholdPct: z.number().min(0).max(100).default(50),
  minSampleSize: z.number().int().min(1).max(10_000).default(20),
});

const codSchema = z.object({
  defaultShippingCost: z.number().min(0).default(0),
  defaultCodFeePct: z.number().min(0).max(100).default(0),
  defaultReturnCost: z.number().min(0).default(0),
  assumeCashOnDelivery: z.boolean().default(true),
});

const alertsSchema = z.object({
  emailDigest: z.boolean().default(true),
  criticalOnly: z.boolean().default(false),
  silenceHoursDefault: z.number().int().min(1).max(168).default(24),
});

const demoSchema = z.object({
  enabled: z.boolean().default(false),
  seedTag: z.string().max(64).optional(),
});

export const storeSettingsSchema = z.object({
  schema_version: z.literal(STORE_SETTINGS_SCHEMA_VERSION).default(STORE_SETTINGS_SCHEMA_VERSION),
  rto: rtoSchema.default({
    highRiskThresholdPct: 35,
    criticalThresholdPct: 50,
    minSampleSize: 20,
  }),
  cod: codSchema.default({
    defaultShippingCost: 0,
    defaultCodFeePct: 0,
    defaultReturnCost: 0,
    assumeCashOnDelivery: true,
  }),
  alerts: alertsSchema.default({
    emailDigest: true,
    criticalOnly: false,
    silenceHoursDefault: 24,
  }),
  demo: demoSchema.default({ enabled: false }),
});

export type StoreSettings = z.infer<typeof storeSettingsSchema>;

export const ATTRIBUTION_MODELS = [
  "utm_last_touch",
  "last_click",
  "first_click",
  "linear",
  "position_based",
  "time_decay",
  "manual",
  "unattributed",
] as const;

export type AttributionModelValue = (typeof ATTRIBUTION_MODELS)[number];

export const storeSettingsUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  countryCode: z.string().trim().length(2).transform((v) => v.toUpperCase()),
  currencyCode: z.string().trim().min(3).max(3).transform((v) => v.toUpperCase()),
  timezone: z.string().trim().min(1).max(64),
  attributionModel: z.enum(ATTRIBUTION_MODELS),
  attributionWindowDays: z.number().int().min(1).max(90),
  settings: storeSettingsSchema,
});

export type StoreSettingsUpdateInput = z.infer<typeof storeSettingsUpdateSchema>;

export function parseStoreSettings(raw: unknown): StoreSettings {
  const base =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const withVersion = {
    schema_version: STORE_SETTINGS_SCHEMA_VERSION,
    ...base,
    ...(typeof base.schema_version === "number" ? {} : { schema_version: STORE_SETTINGS_SCHEMA_VERSION }),
  };
  return storeSettingsSchema.parse(withVersion);
}

export function storeSettingsToJson(settings: StoreSettings): Record<string, unknown> {
  return storeSettingsSchema.parse(settings);
}
