import type {
  HealthCheckStatus,
  IntegrationProviderKind,
  StoreIntegrationProvider,
} from "@/lib/integrations/catalog";
import type { Enums } from "@/types/database.generated";

export type IntegrationOverviewStatus =
  | "active"
  | "review"
  | "pending"
  | "disconnected"
  | "revoked";

export type IntegrationOverviewItem = {
  id: string | null;
  provider: StoreIntegrationProvider;
  name: string;
  kind: IntegrationProviderKind;
  description: string;
  connected: boolean;
  persistedStatus: Enums<"integration_status"> | null;
  overviewStatus: IntegrationOverviewStatus;
  operationalMessage: string;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  latestHealth: {
    status: HealthCheckStatus;
    checkedAt: string;
    latencyMs: number | null;
    safeMessage: string | null;
  } | null;
  credentialExpiresAt: string | null;
  demo: boolean;
};
