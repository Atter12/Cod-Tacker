"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField, Input } from "@/components/ui";

export function ShopifyConnectForm({
  agencySlug,
  storeSlug,
  disabled = false,
  defaultShop = "",
  connected = false,
}: {
  agencySlug: string;
  storeSlug: string;
  disabled?: boolean;
  defaultShop?: string;
  connected?: boolean;
}) {
  const router = useRouter();
  const [shop, setShop] = useState(defaultShop);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function connect() {
    setError(null);
    setSuccess(null);
    const trimmed = shop.trim();
    if (!trimmed) {
      setError("Ingresa el dominio de tu tienda Shopify.");
      return;
    }
    const url = new URL("/api/integrations/shopify/connect", window.location.origin);
    url.searchParams.set("agencySlug", agencySlug);
    url.searchParams.set("storeSlug", storeSlug);
    url.searchParams.set("shop", trimmed);
    start(() => {
      window.location.href = url.toString();
    });
  }

  function testLive() {
    setError(null);
    setSuccess(null);
    start(async () => {
      const res = await fetch("/api/integrations/shopify/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencySlug, storeSlug }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        detail?: string;
        error?: string;
        shopName?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.detail || data.error || "La prueba GraphQL falló.");
        return;
      }
      setSuccess(data.detail || `Conectado a ${data.shopName ?? "Shopify"}.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4">
      <h2 className="text-sm font-semibold">
        {connected ? "Reautorizar Shopify (OAuth)" : "Conectar Shopify (OAuth)"}
      </h2>
      <p className="text-[12.5px] text-text-secondary">
        {connected
          ? "Vuelve a autorizar la tienda para renovar el token y re-registrar webhooks en live."
          : "Autoriza CODTracked en tu tienda. Se guardará un access token cifrado por esta tienda."}
      </p>
      {error ? (
        <Alert variant="danger" title="Shopify">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert variant="success" title="GraphQL OK">
          {success}
        </Alert>
      ) : null}
      <FormField label="Dominio de la tienda" htmlFor="shopify-shop">
        <Input
          id="shopify-shop"
          placeholder="mi-tienda.myshopify.com"
          value={shop}
          disabled={disabled || pending}
          onChange={(e) => setShop(e.target.value)}
        />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={disabled || pending} onClick={connect}>
          {pending ? "Redirigiendo…" : connected ? "Reautorizar Shopify" : "Conectar Shopify"}
        </Button>
        <Button size="sm" variant="outline" disabled={disabled || pending} onClick={testLive}>
          {pending ? "Probando…" : "Probar GraphQL"}
        </Button>
      </div>
    </div>
  );
}
