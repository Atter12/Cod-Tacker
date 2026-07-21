"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  backfillIntegrationAction,
  connectIntegrationAction,
  disconnectIntegrationAction,
  reconnectIntegrationAction,
  syncIntegrationAction,
  testIntegrationAction,
} from "@/app/actions/integrations";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

type Props = {
  agencySlug: string;
  storeSlug: string;
  provider: string;
  canManage: boolean;
  connected: boolean;
  /** When true, hide mock-only connect (live Shopify OAuth UI is separate). */
  hideMockConnect?: boolean;
  /** When true, sync/backfill hit live Shopify (not mock fixtures). */
  liveProvider?: boolean;
  /** Shop domain for live OAuth reconnect redirect. */
  liveReconnectShop?: string;
};

export function IntegrationActions({
  agencySlug,
  storeSlug,
  provider,
  canManage,
  connected,
  hideMockConnect = false,
  liveProvider = false,
  liveReconnectShop = "",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!canManage) {
    return (
      <Alert variant="info" title="Solo lectura">
        Tu rol puede ver la integración, pero no ejecutar acciones de conexión o sincronización.
      </Alert>
    );
  }

  function run(action: () => Promise<{ error?: string; runId?: string }>, successMessage: string) {
    setError(null);
    setMessage(null);
    startTransition(() => {
      void (async () => {
        const result = await action();
        if (result.error) {
          setError(result.error);
          return;
        }
        setMessage(successMessage);
        router.refresh();
      })();
    });
  }

  function startLiveOauthReconnect() {
    setError(null);
    setMessage(null);
    const shop = liveReconnectShop.trim();
    if (!shop) {
      setError("Falta el dominio de la tienda. Usa el formulario OAuth para reconectar.");
      return;
    }
    const url = new URL("/api/integrations/shopify/connect", window.location.origin);
    url.searchParams.set("agencySlug", agencySlug);
    url.searchParams.set("storeSlug", storeSlug);
    url.searchParams.set("shop", shop);
    startTransition(() => {
      window.location.href = url.toString();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4">
      <h2 className="text-sm font-semibold">Acciones</h2>
      {error ? (
        <Alert variant="danger" title="No se pudo completar">
          {error}
        </Alert>
      ) : null}
      {message ? (
        <Alert variant="success" title="Listo">
          {message}
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {!connected ? (
          hideMockConnect ? null : (
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () => connectIntegrationAction(agencySlug, storeSlug, provider),
                  liveProvider
                    ? provider === "meta"
                      ? "Meta Ads conectado (live)."
                      : provider === "tiktok"
                        ? "TikTok Ads conectado (live)."
                        : provider === "whatsapp"
                          ? "WhatsApp conectado (live)."
                          : "Integración conectada."
                    : "Integración conectada (mock).",
                )
              }
            >
              {liveProvider
                ? provider === "meta"
                  ? "Conectar Meta Ads"
                  : provider === "tiktok"
                    ? "Conectar TikTok Ads"
                    : provider === "whatsapp"
                      ? "Conectar WhatsApp"
                      : "Conectar"
                : "Conectar mock"}
            </Button>
          )
        ) : (
          <>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () => testIntegrationAction(agencySlug, storeSlug, provider),
                  "Prueba de conexión registrada.",
                )
              }
            >
              Probar conexión
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(
                  () => syncIntegrationAction(agencySlug, storeSlug, provider),
                  "Sincronización incremental iniciada.",
                )
              }
            >
              Sincronizar ahora
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                const confirmMsg =
                  liveProvider && provider === "shopify"
                    ? "¿Ejecutar backfill histórico desde Shopify? Se importarán pedidos reales (últimos ~90 días)."
                    : liveProvider
                      ? "¿Ejecutar backfill para esta integración live?"
                      : "¿Ejecutar backfill histórico mock? Puede generar más registros de demostración.";
                if (!window.confirm(confirmMsg)) {
                  return;
                }
                run(
                  () => backfillIntegrationAction(agencySlug, storeSlug, provider),
                  "Backfill histórico iniciado.",
                );
              }}
            >
              Backfill
            </Button>
            {liveProvider && provider === "shopify" ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={startLiveOauthReconnect}>
                {pending ? "Redirigiendo…" : "Reconectar (OAuth)"}
              </Button>
            ) : liveProvider && (provider === "envia_com" || provider === "whatsapp") ? null : (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () => reconnectIntegrationAction(agencySlug, storeSlug, provider),
                    liveProvider
                      ? provider === "meta"
                        ? "Meta Ads reconectado (live)."
                        : provider === "tiktok"
                          ? "TikTok Ads reconectado (live)."
                          : "Integración reconectada."
                      : "Integración reconectada (mock).",
                  )
                }
              >
                Reconectar
              </Button>
            )}
            <Button
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("¿Desconectar esta integración?")) return;
                run(
                  () => disconnectIntegrationAction(agencySlug, storeSlug, provider),
                  "Integración desconectada.",
                );
              }}
            >
              Desconectar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
