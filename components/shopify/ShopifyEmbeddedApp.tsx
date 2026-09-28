"use client";

import { useCallback, useEffect, useState } from "react";
import type { ShopifyEmbedHome, ShopifyEmbedOrder } from "@/lib/integrations/shopify/embed-types";

type EmbedResponse = ShopifyEmbedHome & { ok: true; shop: string };

type Phase =
  | { kind: "loading" }
  | { kind: "outside" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: EmbedResponse };

declare global {
  interface Window {
    shopify?: {
      idToken: () => Promise<string>;
    };
  }
}

const APP_BRIDGE_SRC = "https://cdn.shopify.com/shopifycloud/app-bridge.js";

function waitForAppBridge(timeoutMs = 8000): Promise<Window["shopify"] | null> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (window.shopify?.idToken) {
        resolve(window.shopify);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        resolve(null);
        return;
      }
      window.setTimeout(tick, 50);
    };
    tick();
  });
}

function ensureAppBridge(apiKey: string) {
  if (!document.querySelector('meta[name="shopify-api-key"]')) {
    const meta = document.createElement("meta");
    meta.name = "shopify-api-key";
    meta.content = apiKey;
    document.head.prepend(meta);
  }
  if (!document.querySelector(`script[src="${APP_BRIDGE_SRC}"]`)) {
    const script = document.createElement("script");
    script.src = APP_BRIDGE_SRC;
    document.head.appendChild(script);
  }
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function formatWhen(iso: string | null) {
  if (!iso) return "aún no";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "aún no";
  return date.toLocaleString("es");
}

function OrderRow({ order }: { order: ShopifyEmbedOrder }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-text-primary">{order.orderNumber}</p>
        <p className="text-[12px] text-text-secondary">
          {order.statusLabel} · {formatWhen(order.createdAt)}
        </p>
      </div>
      <p className="shrink-0 text-sm text-text-primary">
        {formatMoney(order.totalAmount, order.currencyCode)}
      </p>
    </li>
  );
}

export function ShopifyEmbeddedApp({ apiKey }: { apiKey: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  const openShop = useCallback(async () => {
    setPhase({ kind: "loading" });
    ensureAppBridge(apiKey);
    const bridge = await waitForAppBridge();
    if (!bridge?.idToken) {
      setPhase({ kind: "outside" });
      return;
    }
    try {
      const token = await bridge.idToken();
      const res = await fetch("/api/integrations/shopify/embed/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as EmbedResponse | { error?: string };
      if (!res.ok || !("ok" in body)) {
        setPhase({
          kind: "error",
          message: "error" in body && body.error ? body.error : "No se pudo abrir la app.",
        });
        return;
      }
      setPhase({ kind: "ready", data: body });
    } catch {
      setPhase({ kind: "error", message: "No se pudo abrir la app." });
    }
  }, [apiKey]);

  useEffect(() => {
    void openShop();
  }, [openShop]);

  const ready = phase.kind === "ready" ? phase.data : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-primary">
            CODTracked
          </p>
          <h1 className="mt-1 text-lg font-semibold text-text-primary">Pedidos de la tienda</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
            Sincroniza los pedidos de esta tienda dentro del Admin. La conexión está incluida.
          </p>
        </div>
        {ready ? (
          <button
            type="button"
            className="shrink-0 rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-text-primary hover:bg-muted"
            onClick={() => void openShop()}
          >
            Actualizar
          </button>
        ) : null}
      </div>

      {phase.kind === "loading" ? (
        <p className="mt-6 text-sm text-text-secondary">Abriendo la tienda…</p>
      ) : null}

      {phase.kind === "outside" ? (
        <p className="mt-6 text-sm text-text-secondary">
          Abre CODTracked desde Apps en el Admin de Shopify. Esta pantalla funciona dentro de la
          tienda.
        </p>
      ) : null}

      {phase.kind === "error" ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-danger">{phase.message}</p>
          <button
            type="button"
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-text-primary hover:bg-muted"
            onClick={() => void openShop()}
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {ready && !ready.linked ? (
        <div className="mt-6 rounded-lg border border-border bg-surface-elevated p-4 text-sm text-text-secondary">
          <p className="font-medium text-text-primary">{ready.shop}</p>
          <p className="mt-2">
            Shopify todavía no entregó el acceso. Cierra la app y ábrela otra vez desde el Admin.
          </p>
        </div>
      ) : null}

      {ready && ready.linked ? (
        <section className="mt-6 rounded-lg border border-border bg-surface-elevated p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-text-primary">{ready.storeName}</p>
              <p className="text-[12px] text-text-secondary">{ready.shop}</p>
            </div>
            <p className="rounded-full bg-brand-softer px-2.5 py-1 text-[11px] font-medium text-brand-primary">
              Conectado
            </p>
          </div>
          <p className="mt-3 text-[12px] text-text-secondary">
            Última sincronización: {formatWhen(ready.lastSyncedAt)}
          </p>
          {ready.orders.length === 0 ? (
            <p className="mt-4 text-sm text-text-secondary">
              Cuando entren pedidos en Shopify, aparecerán aquí.
            </p>
          ) : (
            <ul className="mt-2">
              {ready.orders.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </main>
  );
}
