import { ShopifyEmbeddedApp } from "@/components/shopify/ShopifyEmbeddedApp";

export const dynamic = "force-dynamic";

export default async function ShopifyEmbedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const apiKey = process.env.SHOPIFY_CLIENT_ID?.trim() ?? "";
  if (!apiKey) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6 text-sm text-text-secondary">
        Falta SHOPIFY_CLIENT_ID en el servidor. La app embebida no puede identificarse ante Shopify.
      </main>
    );
  }

  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0]) params.set(key, value[0]);
  }

  return <ShopifyEmbeddedApp apiKey={apiKey} initialSearch={params.toString()} />;
}
