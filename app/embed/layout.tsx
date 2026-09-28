import { isShopifyConfigured } from "@/lib/integrations/shopify/env";

export const dynamic = "force-dynamic";

export default function ShopifyEmbedLayout({ children }: { children: React.ReactNode }) {
  if (!isShopifyConfigured()) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6 text-sm text-text-secondary">
        Falta la configuración de Shopify en el servidor.
      </main>
    );
  }
  return children;
}
