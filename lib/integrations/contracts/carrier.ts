import type { Enums } from "@/types/database.generated";

export type CarrierShipmentRequest = { reference: string; trackingNumber: string; destinationCountry?: string };
export type CarrierTrackingEvent = { externalId?: string; status: Enums<"shipment_status">; occurredAt: string; description?: string; location?: string; raw: unknown };
export type CarrierTrackingResult = { trackingNumber: string; trackingUrl?: string; status: Enums<"shipment_status">; events: CarrierTrackingEvent[] };

/** Contract only: carrier-specific adapters normalize remote tracking payloads into this shape. */
export interface CarrierAdapter {
  readonly carrierCode: string;
  validateCredentials(): Promise<void>;
  getTracking(shipment: CarrierShipmentRequest): Promise<CarrierTrackingResult>;
  listTrackingUpdates(since: string): Promise<CarrierTrackingResult[]>;
}
