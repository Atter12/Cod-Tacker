import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveIntegrationOverviewStatus,
  getIntegrationCredentialExpiry,
  getIntegrationOperationalMessage,
  isAvailableCatalogItem,
  isConfiguredOverviewItem,
  isCredentialExpiringSoon,
} from "@/lib/integrations/overview";
import { formatRelativeDate } from "@/lib/formatting/date";
import type { IntegrationOverviewItem } from "@/types/integrations";

function baseItem(
  overrides: Partial<IntegrationOverviewItem> = {},
): IntegrationOverviewItem {
  return {
    id: "int-1",
    provider: "shopify",
    name: "Shopify",
    kind: "commerce",
    description: "Pedidos",
    connected: true,
    persistedStatus: "connected",
    overviewStatus: "active",
    operationalMessage: "",
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    latestHealth: null,
    credentialExpiresAt: null,
    demo: false,
    ...overrides,
  };
}

describe("deriveIntegrationOverviewStatus", () => {
  it("marks connected healthy integrations as active", () => {
    assert.equal(
      deriveIntegrationOverviewStatus({
        persistedStatus: "connected",
        lastSuccessAt: "2026-07-11T12:00:00.000Z",
        lastErrorAt: null,
        latestHealthStatus: "healthy",
      }),
      "active",
    );
  });

  it("marks degraded health as review", () => {
    assert.equal(
      deriveIntegrationOverviewStatus({
        persistedStatus: "connected",
        lastSuccessAt: "2026-07-11T12:00:00.000Z",
        lastErrorAt: null,
        latestHealthStatus: "degraded",
      }),
      "review",
    );
  });

  it("marks error after success as review", () => {
    assert.equal(
      deriveIntegrationOverviewStatus({
        persistedStatus: "connected",
        lastSuccessAt: "2026-07-10T12:00:00.000Z",
        lastErrorAt: "2026-07-11T12:00:00.000Z",
        latestHealthStatus: "healthy",
      }),
      "review",
    );
  });

  it("marks revoked and pending correctly", () => {
    assert.equal(
      deriveIntegrationOverviewStatus({
        persistedStatus: "revoked",
        lastSuccessAt: null,
        lastErrorAt: null,
        latestHealthStatus: null,
      }),
      "revoked",
    );
    assert.equal(
      deriveIntegrationOverviewStatus({
        persistedStatus: "pending",
        lastSuccessAt: null,
        lastErrorAt: null,
        latestHealthStatus: null,
      }),
      "pending",
    );
  });
});

describe("getIntegrationCredentialExpiry", () => {
  it("reads valid expiry from metadata", () => {
    assert.equal(
      getIntegrationCredentialExpiry(
        { token_expires_at: "2026-07-15T00:00:00.000Z" },
        {},
      ),
      "2026-07-15T00:00:00.000Z",
    );
  });

  it("ignores invalid dates and non-objects", () => {
    assert.equal(getIntegrationCredentialExpiry(null, ["x"]), null);
    assert.equal(
      getIntegrationCredentialExpiry({ token_expires_at: "not-a-date" }, null),
      null,
    );
  });
});

describe("getIntegrationOperationalMessage", () => {
  it("uses relative sync copy only with a real last_success_at", () => {
    const now = new Date("2026-07-11T12:05:00.000Z");
    const message = getIntegrationOperationalMessage(
      baseItem({
        overviewStatus: "active",
        lastSuccessAt: "2026-07-11T12:00:00.000Z",
      }),
      now,
    );
    assert.match(message, /Sincronizada hace/i);
  });

  it("shows token expiry only when a real date is near", () => {
    const now = new Date("2026-07-11T12:00:00.000Z");
    const soon = getIntegrationOperationalMessage(
      baseItem({
        overviewStatus: "active",
        credentialExpiresAt: "2026-07-14T12:00:00.000Z",
        lastSuccessAt: "2026-07-11T11:00:00.000Z",
      }),
      now,
    );
    assert.equal(soon, "Token vence pronto");
    assert.equal(isCredentialExpiringSoon("2026-07-14T12:00:00.000Z", now), true);
  });

  it("does not invent token expiry copy", () => {
    const message = getIntegrationOperationalMessage(
      baseItem({
        overviewStatus: "active",
        lastSuccessAt: null,
        credentialExpiresAt: null,
      }),
      new Date("2026-07-11T12:00:00.000Z"),
    );
    assert.equal(message, "Conectada, aún sin sincronización");
  });
});

describe("configured vs catalog split", () => {
  it("keeps disconnected rows out of the main grid", () => {
    const disconnected = baseItem({
      id: "int-2",
      persistedStatus: "disconnected",
      overviewStatus: "disconnected",
      connected: false,
    });
    assert.equal(isConfiguredOverviewItem(disconnected), false);
    assert.equal(isAvailableCatalogItem(disconnected), true);
  });
});

describe("formatRelativeDate", () => {
  it("returns null for invalid dates", () => {
    assert.equal(formatRelativeDate("nope"), null);
  });

  it("formats short ranges in Spanish", () => {
    const now = new Date("2026-07-11T12:10:00.000Z");
    const value = formatRelativeDate("2026-07-11T12:05:00.000Z", {
      now,
      timeZone: "America/Lima",
    });
    assert.match(value ?? "", /Hace 5 minutos/i);
  });
});
