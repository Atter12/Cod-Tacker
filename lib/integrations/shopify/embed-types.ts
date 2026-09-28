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
};
