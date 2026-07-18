"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  rejectConversionEvent,
  releaseAndSendConversionEvent,
} from "@/app/actions/conversions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/formatting/date";
import {
  labelHoldReason,
  labelReleaseStatus,
  type ConversionReleaseStatus,
} from "@/lib/conversions/release-policy";
import {
  parseConversionChannels,
  type ConversionChannelOutcome,
} from "@/lib/orders/timeline";
import type { Json } from "@/types/database.generated";

export type ConversionReleaseItem = {
  id: string;
  eventName: string;
  platform: string;
  value: number | null;
  currencyCode: string | null;
  eventTime: string;
  deliveryStatus: string;
  releaseStatus: string;
  holdReason: string | null;
  sentAt: string | null;
  releasedAt: string | null;
  lastErrorMessage: string | null;
  /** Per-channel Meta/TikTok outcomes stored on the single conversion row. */
  customData?: Json | null;
  /** Our internal primary attribution platform (utm/click), not ad-platform match. */
  attributedPlatform?: string | null;
};

function deliveryLabel(status: string): string {
  switch (status) {
    case "queued":
      return "En cola";
    case "sending":
      return "Enviando";
    case "sent":
      return "Enviada";
    case "failed":
      return "Falló el envío";
    case "cancelled":
      return "Cancelada";
    case "rejected":
      return "Rechazada por la plataforma";
    default:
      return status;
  }
}

function releaseBadgeClass(status: string): string {
  switch (status) {
    case "released":
      return "bg-emerald-100 text-emerald-800";
    case "pending_review":
      return "bg-amber-100 text-amber-800";
    case "rejected":
      return "bg-red-100 text-red-700";
    default:
      return "";
  }
}

function channelOutcomeLabel(outcome: ConversionChannelOutcome): string {
  switch (outcome) {
    case "live":
      return "enviado";
    case "failed":
      return "falló";
    case "dry_run":
      return "dry_run";
    case "sent":
      return "enviado";
  }
}

function channelBadgeClass(outcome: ConversionChannelOutcome): string {
  switch (outcome) {
    case "live":
    case "sent":
      return "bg-emerald-100 text-emerald-800";
    case "failed":
      return "bg-red-100 text-red-700";
    case "dry_run":
      return "bg-slate-100 text-slate-700";
  }
}

function labelAttributedPlatform(platform: string): string {
  const key = platform.trim().toLowerCase();
  if (key === "meta" || key === "facebook" || key === "fb") return "Meta";
  if (key === "tiktok" || key === "tt") return "TikTok";
  if (key === "google") return "Google";
  if (key === "organic" || key === "direct") return platform;
  return platform;
}

export function ConversionReleasePanel({
  agencySlug,
  storeSlug,
  events,
  canManage,
  timeZone,
}: {
  agencySlug: string;
  storeSlug: string;
  events: ConversionReleaseItem[];
  canManage: boolean;
  timeZone: string;
}) {
  const formatWhen = (iso: string) => formatDateTime(iso, "es-PE", timeZone);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!events.length) {
    return (
      <EmptyState
        title="Sin conversiones"
        description="Aún no hay candidatos de Purchase para este pedido. Se generan al cobrar o entregar un pedido COD."
      />
    );
  }

  function run(action: () => Promise<{ error?: string; deliveryStatus?: string }>) {
    setError(null);
    setNotice(null);
    startTransition(() => {
      void (async () => {
        const result = await action();
        if (result.error) {
          setError(result.error);
          return;
        }
        setNotice(
          result.deliveryStatus === "sent"
            ? "Conversión liberada y enviada a Meta/TikTok."
            : "Acción aplicada.",
        );
        router.refresh();
      })();
    });
  }

  return (
    <div className="space-y-3">
      {error ? (
        <Alert variant="danger" title="No se pudo completar">
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert variant="info" title="Listo">
          {notice}
        </Alert>
      ) : null}
      <ul className="space-y-3">
        {events.map((event) => {
          const holdLabel = labelHoldReason(event.holdReason);
          const channels = parseConversionChannels(event.customData);
          const canRelease =
            canManage && !event.sentAt && event.releaseStatus !== "released";
          const canRetry =
            canManage &&
            !event.sentAt &&
            event.releaseStatus === "released" &&
            (event.deliveryStatus === "failed" || event.deliveryStatus === "queued");
          const canReject = canManage && !event.sentAt && event.releaseStatus !== "rejected";
          const attributed = event.attributedPlatform?.trim() || null;

          return (
            <li key={event.id} className="rounded-md border border-border px-3 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{event.eventName}</span>
                  <Badge className={releaseBadgeClass(event.releaseStatus)}>
                    {labelReleaseStatus(event.releaseStatus as ConversionReleaseStatus)}
                  </Badge>
                  <Badge>{deliveryLabel(event.deliveryStatus)}</Badge>
                  {attributed ? (
                    <Badge className="bg-sky-100 text-sky-800">
                      Atribuido: {labelAttributedPlatform(attributed)}
                    </Badge>
                  ) : null}
                </div>
                <time className="text-xs text-text-secondary">{formatWhen(event.eventTime)}</time>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-text-secondary">Enviado a:</span>
                {channels.length > 0 ? (
                  channels.map((channel) => (
                    <Badge
                      key={channel.name}
                      className={channelBadgeClass(channel.outcome)}
                    >
                      {channel.name} · {channelOutcomeLabel(channel.outcome)}
                    </Badge>
                  ))
                ) : (
                  <Badge>{event.platform}</Badge>
                )}
              </div>

              <dl className="mt-2 grid gap-1 text-xs text-text-secondary sm:grid-cols-2">
                <div>
                  Valor:{" "}
                  <span className="text-text-primary">
                    {event.value != null
                      ? `${event.value.toFixed(2)} ${event.currencyCode ?? ""}`.trim()
                      : "—"}
                  </span>
                </div>
                <div>
                  Enviada:{" "}
                  <span className="text-text-primary">
                    {event.sentAt ? formatWhen(event.sentAt) : "—"}
                  </span>
                </div>
                {holdLabel && event.releaseStatus !== "released" ? (
                  <div className="sm:col-span-2">
                    Motivo: <span className="text-text-primary">{holdLabel}</span>
                  </div>
                ) : null}
                {event.lastErrorMessage ? (
                  <div className="sm:col-span-2 text-red-700">
                    Último error: {event.lastErrorMessage.slice(0, 160)}
                  </div>
                ) : null}
              </dl>

              {canRelease || canRetry || canReject ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {canRelease ? (
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() => releaseAndSendConversionEvent(agencySlug, storeSlug, event.id))
                      }
                    >
                      Liberar y enviar
                    </Button>
                  ) : null}
                  {canRetry ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        run(() => releaseAndSendConversionEvent(agencySlug, storeSlug, event.id))
                      }
                    >
                      Reintentar envío
                    </Button>
                  ) : null}
                  {canReject ? (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={pending}
                      onClick={() => run(() => rejectConversionEvent(agencySlug, storeSlug, event.id))}
                    >
                      Rechazar
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
