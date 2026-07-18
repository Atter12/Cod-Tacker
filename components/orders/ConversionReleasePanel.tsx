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
import { formatDateTime } from "@/lib/formatting/date";
import { labelHoldReason } from "@/lib/conversions/release-policy";
import {
  parseConversionChannels,
  type ConversionChannelOutcome,
  type ConversionChannelSummary,
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

function eventNameLabel(eventName: string): string {
  return eventName === "Purchase" ? "Compra" : eventName;
}

function channelDisplayName(name: ConversionChannelSummary["name"]): string {
  return name === "meta" ? "Meta" : "TikTok";
}

function channelOutcomeLabel(outcome: ConversionChannelOutcome): string {
  switch (outcome) {
    case "live":
    case "sent":
      return "enviado";
    case "failed":
      return "falló";
    case "dry_run":
      return "prueba";
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
  return platform;
}

type CardState = {
  badgeLabel: string;
  badgeClass: string;
  explanation: string;
};

function cardState(event: ConversionReleaseItem): CardState {
  if (event.releaseStatus === "rejected") {
    return {
      badgeLabel: "Rechazada",
      badgeClass: "bg-red-100 text-red-700",
      explanation: "Rechazada: no se enviará a las plataformas de anuncios.",
    };
  }
  if (event.releaseStatus === "pending_review") {
    return {
      badgeLabel: "En revisión",
      badgeClass: "bg-amber-100 text-amber-800",
      explanation: "Retenida por el filtro de liberación; aún no se avisa a las plataformas.",
    };
  }
  switch (event.deliveryStatus) {
    case "sent":
    case "acknowledged":
      return {
        badgeLabel: "Enviado",
        badgeClass: "bg-emerald-100 text-emerald-800",
        explanation: "La plataforma de anuncios recibió el aviso de conversión.",
      };
    case "failed":
      return {
        badgeLabel: "Falló",
        badgeClass: "bg-red-100 text-red-700",
        explanation: "El último intento de aviso falló; se reintentará automáticamente.",
      };
    case "cancelled":
      return {
        badgeLabel: "Cancelada",
        badgeClass: "bg-slate-100 text-slate-700",
        explanation: "Cancelada: no se enviará a las plataformas de anuncios.",
      };
    default:
      return {
        badgeLabel: "En cola",
        badgeClass: "bg-slate-100 text-slate-700",
        explanation: "Liberada y en cola para el envío automático.",
      };
  }
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
      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-text-secondary">
        Aún no hay avisos de conversión para este pedido. Se generan al cobrar o entregar un
        pedido COD.
      </p>
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
          const channels = parseConversionChannels(event.customData);
          const state = cardState(event);
          const holdLabel = labelHoldReason(event.holdReason);
          const eventLabel = eventNameLabel(event.eventName);
          const channelNames = channels.map((c) => channelDisplayName(c.name));
          const title = channelNames.length
            ? `Último aviso a ${channelNames.join(" y ")} · ${eventLabel}`
            : `${eventLabel} sin aviso enviado todavía`;
          const lastAt = event.sentAt ?? event.releasedAt ?? event.eventTime;
          const attributed = event.attributedPlatform?.trim() || null;

          const canRelease =
            canManage && !event.sentAt && event.releaseStatus !== "released";
          const canRetry =
            canManage &&
            !event.sentAt &&
            event.releaseStatus === "released" &&
            (event.deliveryStatus === "failed" || event.deliveryStatus === "queued");
          const canReject =
            canManage && !event.sentAt && event.releaseStatus !== "rejected";

          return (
            <li key={event.id} className="rounded-md border border-border px-4 py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
                    Estado de conversión
                  </p>
                  <p className="font-medium">{title}</p>
                  <p className="text-xs text-text-secondary">
                    Última vez: {formatWhen(lastAt)}
                    {event.value != null
                      ? ` · ${event.value.toFixed(2)} ${event.currencyCode ?? ""}`.trimEnd()
                      : ""}
                  </p>
                </div>
                <Badge className={state.badgeClass}>{state.badgeLabel}</Badge>
              </div>

              <p className="mt-2 text-xs text-text-secondary">{state.explanation}</p>
              {holdLabel && event.releaseStatus === "pending_review" ? (
                <p className="mt-1 text-xs text-text-secondary">
                  Motivo: <span className="text-text-primary">{holdLabel}</span>
                </p>
              ) : null}
              {event.lastErrorMessage ? (
                <p className="mt-1 text-xs text-red-700">
                  Último error: {event.lastErrorMessage.slice(0, 160)}
                </p>
              ) : null}

              {channels.length > 0 || attributed ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {channels.map((channel) => (
                    <Badge key={channel.name} className={channelBadgeClass(channel.outcome)}>
                      {channelDisplayName(channel.name)} · {channelOutcomeLabel(channel.outcome)}
                    </Badge>
                  ))}
                  {attributed ? (
                    <Badge className="bg-sky-100 text-sky-800">
                      Atribuido: {labelAttributedPlatform(attributed)}
                    </Badge>
                  ) : null}
                </div>
              ) : null}

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
                      onClick={() =>
                        run(() => rejectConversionEvent(agencySlug, storeSlug, event.id))
                      }
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
