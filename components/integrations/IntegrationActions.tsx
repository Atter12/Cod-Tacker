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

  const isShopify = provider === "shopify";
  const isAds = provider === "meta" || provider === "tiktok";
  const syncLabel = isShopify
    ? "Actualizar pedidos (7 días)"
    : isAds
      ? "Actualizar gasto reciente"
      : "Actualizar ahora";
  const backfillLabel = isShopify
    ? "Importar historial (90 días)"
    : isAds
      ? "Importar historial de gasto"
      : "Importar historial";
  const syncHelp = isShopify
    ? "Los webhooks traen pedidos en tiempo real y cada ~8 h se actualizan solos. Usa estas acciones solo si falta un pedido o al conectar la tienda."
    : isAds
      ? "El gasto también se sincroniza solo cada día. Usa actualizar si necesitas ver cambios ya, o importar historial al conectar la cuenta."
      : "La sincronización automática cubre el día a día; estas acciones son para forzar una actualización o recuperar historial.";
  const syncSuccess = isShopify
    ? "Actualización iniciada: pedidos modificados en los últimos 7 días."
    : "Actualización reciente iniciada.";
  const backfillSuccess = isShopify
    ? "Importación iniciada: pedidos de los últimos ~90 días."
    : "Importación de historial iniciada.";
  const backfillConfirm = liveProvider && isShopify
    ? "¿Importar el historial de pedidos desde Shopify?\n\nSe traerán pedidos actualizados en los últimos ~90 días (hasta ~250). Los que ya existan se actualizarán, no se duplican."
    : liveProvider && isAds
      ? "¿Importar el historial de gasto publicitario?\n\nSe usará para completar datos al conectar o recuperar días faltantes."
      : liveProvider
        ? "¿Importar el historial de esta integración?"
        : "¿Importar historial de demostración? Puede generar más registros mock.";

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
      {connected ? (
        <p className="text-[12.5px] leading-relaxed text-text-secondary">{syncHelp}</p>
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
              title={
                isShopify
                  ? "Trae de Shopify los pedidos actualizados en los últimos 7 días"
                  : "Fuerza una sincronización reciente ahora"
              }
              onClick={() =>
                run(
                  () => syncIntegrationAction(agencySlug, storeSlug, provider),
                  syncSuccess,
                )
              }
            >
              {syncLabel}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              title={
                isShopify
                  ? "Importa pedidos de los últimos ~90 días (útil al conectar o recuperar historial)"
                  : "Importa historial más amplio"
              }
              onClick={() => {
                if (!window.confirm(backfillConfirm)) {
                  return;
                }
                run(
                  () => backfillIntegrationAction(agencySlug, storeSlug, provider),
                  backfillSuccess,
                );
              }}
            >
              {backfillLabel}
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
