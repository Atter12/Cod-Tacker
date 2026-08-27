import type { FlipyPackageCareId } from "@/lib/integrations/flipy/map-package-care";
import type { FlipyPackageSize } from "@/lib/integrations/flipy/map-package-size";
import type {
  FlipyFleteQuote,
  FlipyOperationalFulfillmentMode,
} from "@/lib/integrations/flipy/partner-contract";

/** v0.2 create-body extensions. `v02Enabled` kept for call-site clarity; product path is always on. */
export function buildFlipyV02CreateExtensions(input: {
  v02Enabled: boolean;
  smartEligible: boolean;
  operationalMode: FlipyOperationalFulfillmentMode;
  packageSize: FlipyPackageSize;
  packageCare?: FlipyPackageCareId[];
  packageCareNote?: string;
  fleteQuote?: FlipyFleteQuote | null;
}):
  | {
      fulfillmentMode: FlipyOperationalFulfillmentMode;
      priceLocked: boolean;
      packageSize: FlipyPackageSize;
      packageCare?: FlipyPackageCareId[];
      packageCareNote?: string;
      typeMode: "express";
      fleteQuote?: FlipyFleteQuote;
    }
  | undefined {
  if (!input.v02Enabled) return undefined;

  return {
    fulfillmentMode: input.operationalMode,
    priceLocked: input.smartEligible,
    packageSize: input.packageSize,
    packageCare: input.packageCare?.length ? input.packageCare : undefined,
    packageCareNote: input.packageCareNote,
    typeMode: "express",
    fleteQuote: input.fleteQuote ?? undefined,
  };
}
