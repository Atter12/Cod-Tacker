"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
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
  const [appOrigin, setAppOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setAppOrigin(window.location.origin);
  }, []);

  const scriptUrl = useMemo(
    () => (appOrigin ? `${appOrigin}/shopify/codtracked-attribution.js` : "/shopify/codtracked-attribution.js"),
    [appOrigin],
  );
  const themeSnippet = `<script src="${scriptUrl}" defer></script>`;

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

      {connected ? (
        <div className="space-y-2 border-t border-border pt-3">
          <h3 className="text-sm font-semibold">Atribución UTM en tienda</h3>
          <p className="text-[12.5px] text-text-secondary">
            Shopify a veces no llena el resumen de conversión en pedidos de prueba. Este script guarda
            UTMs/click IDs en atributos del carrito para que lleguen al pedido (note_attributes).
          </p>
          <ol className="list-decimal space-y-1 pl-4 text-[12.5px] text-text-secondary">
            <li>Shopify Admin → Tienda online → Temas → … → Editar código</li>
            <li>
              Abre <code className="text-text-primary">theme.liquid</code> y pega el snippet antes de{" "}
              <code className="text-text-primary">{`</head>`}</code>
            </li>
            <li>Guarda, prueba en incógnito con UTMs en la URL del producto y compra de nuevo</li>
          </ol>
          <pre className="overflow-x-auto rounded-md bg-muted p-2 text-[11px] text-text-primary">
            {themeSnippet}
          </pre>
          <Button
            size="sm"
            variant="outline"
            disabled={!appOrigin}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(themeSnippet);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              } catch {
                setError("No se pudo copiar el snippet. Cópialo manualmente del recuadro.");
              }
            }}
          >
            {copied ? "Copiado" : "Copiar snippet"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
