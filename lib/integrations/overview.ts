import type { HealthCheckStatus } from "@/lib/integrations/catalog";
import { formatRelativeDate, readJsonStringField } from "@/lib/formatting/date";
import type { Enums, Json } from "@/types/database.generated";
import type {
  IntegrationOverviewItem,
  IntegrationOverviewStatus,
} from "@/types/integrations";

export const INTEGRATION_STALE_AFTER_HOURS = 24;
export const CREDENTIAL_EXPIRY_SOON_DAYS = 7;

const TECHNICAL_ERROR_PATTERN =
  /\b(stack|exception|postgres|supabase|sqlstate|ecode|traceback|at\s+\w+\.\w+)\b/i;

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function pickExpiryCandidate(source: Json | null | undefined): string | null {
  const keys = ["token_expires_at", "credential_expires_at", "expires_at"] as const;
  for (const key of keys) {
    const raw = readJsonStringField(source, key);
    if (!raw) continue;
    if (!parseIsoDate(raw)) continue;
    return raw;
  }
  return null;
}

/**
 * Returns the earliest valid credential expiry found in metadata or settings.
 */
export function getIntegrationCredentialExpiry(
  metadata: Json | null | undefined,
  settings: Json | null | undefined,
): string | null {
  const fromMetadata = pickExpiryCandidate(metadata);
  const fromSettings = pickExpiryCandidate(settings);
  if (!fromMetadata) return fromSettings;
  if (!fromSettings) return fromMetadata;
  const metaDate = parseIsoDate(fromMetadata);
  const settingsDate = parseIsoDate(fromSettings);
  if (!metaDate) return fromSettings;
  if (!settingsDate) return fromMetadata;
  return metaDate.getTime() <= settingsDate.getTime() ? fromMetadata : fromSettings;
}

export function isCredentialExpiringSoon(
  expiresAt: string | null,
  now: Date = new Date(),
  withinDays: number = CREDENTIAL_EXPIRY_SOON_DAYS,
): boolean {
  const date = parseIsoDate(expiresAt);
  if (!date) return false;
  const msLeft = date.getTime() - now.getTime();
  if (msLeft < 0) return true;
  return msLeft <= withinDays * 24 * 60 * 60 * 1000;
}

export function isSyncStale(
  lastSuccessAt: string | null,
  now: Date = new Date(),
  afterHours: number = INTEGRATION_STALE_AFTER_HOURS,
): boolean {
  const date = parseIsoDate(lastSuccessAt);
  if (!date) return false;
  return now.getTime() - date.getTime() >= afterHours * 60 * 60 * 1000;
}

function isHealthStatus(value: string): value is HealthCheckStatus {
  return value === "healthy" || value === "degraded" || value === "down";
}

export function normalizeHealthStatus(value: string | null | undefined): HealthCheckStatus | null {
  if (!value) return null;
  return isHealthStatus(value) ? value : null;
}

function safeOperationalError(message: string | null | undefined): string | null {
  if (!message) return null;
  const trimmed = message.trim();
  if (!trimmed) return null;
  if (trimmed.length > 120) return null;
  if (TECHNICAL_ERROR_PATTERN.test(trimmed)) return null;
  if (trimmed.includes("\n")) return null;
  return trimmed;
}

function errorIsAfterSuccess(
  lastErrorAt: string | null,
  lastSuccessAt: string | null,
): boolean {
  const errorAt = parseIsoDate(lastErrorAt);
  if (!errorAt) return false;
  const successAt = parseIsoDate(lastSuccessAt);
  if (!successAt) return true;
  return errorAt.getTime() > successAt.getTime();
}

export function deriveIntegrationOverviewStatus(input: {
  persistedStatus: Enums<"integration_status"> | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  latestHealthStatus: HealthCheckStatus | null;
}): IntegrationOverviewStatus {
  const { persistedStatus, lastSuccessAt, lastErrorAt, latestHealthStatus } = input;

  if (!persistedStatus || persistedStatus === "disconnected") {
    return "disconnected";
  }
  if (persistedStatus === "revoked") {
    return "revoked";
  }
  if (persistedStatus === "pending") {
    return "pending";
  }

  const healthBad = latestHealthStatus === "degraded" || latestHealthStatus === "down";
  const hasLaterError = errorIsAfterSuccess(lastErrorAt, lastSuccessAt);

  if (
    persistedStatus === "degraded" ||
    persistedStatus === "error" ||
    healthBad ||
    hasLaterError
  ) {
    return "review";
  }

  if (persistedStatus === "connected") {
    if (!lastSuccessAt && latestHealthStatus !== "healthy") {
      // Connected without success yet is still active if not errored;
      // health healthy without sync stays active with a softer message.
      return "active";
    }
    return "active";
  }

  return "disconnected";
}

export function labelOverviewStatus(status: IntegrationOverviewStatus): string {
  switch (status) {
    case "active":
      return "Activa";
    case "review":
      return "Requiere revisión";
    case "pending":
      return "Pendiente";
    case "disconnected":
      return "No conectada";
    case "revoked":
      return "Acceso revocado";
  }
}

type OperationalMessageInput = Pick<
  IntegrationOverviewItem,
  | "overviewStatus"
  | "lastSuccessAt"
  | "lastErrorMessage"
  | "latestHealth"
  | "credentialExpiresAt"
  | "persistedStatus"
> & {
  timeZone?: string;
};

export function getIntegrationOperationalMessage(
  item: OperationalMessageInput,
  now: Date = new Date(),
): string {
  const timeZone = item.timeZone ?? "America/Lima";

  if (item.overviewStatus === "revoked") {
    return "El acceso fue revocado";
  }
  if (item.overviewStatus === "disconnected") {
    return "Disponible para conectar";
  }
  if (item.overviewStatus === "pending") {
    return "Conexión pendiente de completar";
  }

  if (
    item.overviewStatus === "active" &&
    isCredentialExpiringSoon(item.credentialExpiresAt, now)
  ) {
    return "Token vence pronto";
  }

  if (item.overviewStatus === "review") {
    const fromHealth = safeOperationalError(item.latestHealth?.safeMessage);
    if (fromHealth) return fromHealth;
    const fromError = safeOperationalError(item.lastErrorMessage);
    if (fromError) return fromError;
    if (item.latestHealth?.status === "down" || item.persistedStatus === "error") {
      return "No se pudo sincronizar correctamente";
    }
    return "La conexión presenta intermitencias";
  }

  const relativeSuccess = item.lastSuccessAt
    ? formatRelativeDate(item.lastSuccessAt, { now, timeZone })
    : null;

  if (relativeSuccess) {
    const lower = relativeSuccess.toLowerCase();
    if (lower.startsWith("hace ") || lower === "ayer") {
      return `Sincronizada ${lower}`;
    }
    return `Última sincronización: ${relativeSuccess}`;
  }

  if (item.latestHealth?.status === "healthy") {
    const healthRelative = formatRelativeDate(item.latestHealth.checkedAt, { now, timeZone });
    if (healthRelative) {
      return "Conexión verificada recientemente";
    }
  }

  return "Conectada, aún sin sincronización";
}

const OVERVIEW_STATUS_ORDER: Record<IntegrationOverviewStatus, number> = {
  review: 0,
  pending: 1,
  active: 2,
  disconnected: 3,
  revoked: 4,
};

export function compareOverviewItems(
  a: IntegrationOverviewItem,
  b: IntegrationOverviewItem,
  catalogOrder: readonly string[],
): number {
  const statusDiff =
    OVERVIEW_STATUS_ORDER[a.overviewStatus] - OVERVIEW_STATUS_ORDER[b.overviewStatus];
  if (statusDiff !== 0) return statusDiff;
  const aIndex = catalogOrder.indexOf(a.provider);
  const bIndex = catalogOrder.indexOf(b.provider);
  return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
}

export function isConfiguredOverviewItem(item: IntegrationOverviewItem): boolean {
  if (!item.id || !item.persistedStatus) return false;
  return item.persistedStatus !== "disconnected";
}

export function isAvailableCatalogItem(item: IntegrationOverviewItem): boolean {
  return !item.id || item.persistedStatus === "disconnected";
}
