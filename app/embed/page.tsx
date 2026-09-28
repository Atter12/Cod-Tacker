import { ShopifyEmbeddedApp } from "@/components/shopify/ShopifyEmbeddedApp";

export const dynamic = "force-dynamic";

export default function ShopifyEmbedPage() {
  const apiKey = process.env.SHOPIFY_CLIENT_ID?.trim() ?? "";
  if (!apiKey) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6 text-sm text-text-secondary">
        Falta SHOPIFY_CLIENT_ID en el servidor. La app embebida no puede identificarse ante Shopify.
      </main>
    );
  }
  return <ShopifyEmbeddedApp apiKey={apiKey} />;
}
