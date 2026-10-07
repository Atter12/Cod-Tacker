import type { EmbedPlanState } from "@/lib/billing/embed-plan-state";

export type ShopifyEmbedOrder = {
  id: string;
  orderNumber: string;
  totalAmount: number;
  currencyCode: string;
  statusLabel: string;
  createdAt: string;
};

export type ShopifyEmbedHome = {
  linked: boolean;
  storeName: string | null;
  lastSyncedAt: string | null;
  orders: ShopifyEmbedOrder[];
  /** App Pricing surface for the embed (never Stripe / never product host). */
  billing: EmbedPlanState;
};
