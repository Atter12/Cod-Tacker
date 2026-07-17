import { EmptyState, StatusBadge } from "@/components/ui";
import {
  conversionLastAttemptAt,
  conversionOutcome,
  conversionOutcomeHint,
  friendlyConversionError,
  labelConversionEventName,
  labelConversionOutcome,
  labelConversionPlatform,
  type ConversionEventRow,
  type ConversionOutcome,
} from "@/lib/conversions/labels";

const OUTCOME_BADGE_STATUS: Record<ConversionOutcome, string> = {
  sent: "sent",
  failed: "failed",
  dry_run: "partial",
  pending: "queued",
  cancelled: "cancelled",
};

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ConversionEventsPanel({ events }: { events: ConversionEventRow[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="Aún no hay conversiones"
        description="Cuando se avise a Meta o TikTok de una compra (por ejemplo al cobrar o entregar), verás aquí si se envió, falló o quedó en prueba."
      />
    );
  }

  const sorted = [...events].sort(
    (a, b) =>
      Date.parse(conversionLastAttemptAt(b)) - Date.parse(conversionLastAttemptAt(a)),
  );
  const latest = sorted[0]!;
  const latestOutcome = conversionOutcome(latest);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface-elevated p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
              Estado de conversión
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Último aviso a {labelConversionPlatform(latest.platform)} ·{" "}
              {labelConversionEventName(latest.event_name)}
            </p>
          </div>
          <StatusBadge
            status={OUTCOME_BADGE_STATUS[latestOutcome]}
            label={labelConversionOutcome(latestOutcome)}
          />
        </div>
        <p className="mt-2 text-xs text-text-secondary">
          Última vez: {formatWhen(conversionLastAttemptAt(latest))}
        </p>
        <p className="mt-1 text-[12.5px] text-text-secondary">{conversionOutcomeHint(latestOutcome)}</p>
      </div>

      <ul className="space-y-3">
        {sorted.map((event) => {
          const outcome = conversionOutcome(event);
          const error = outcome === "failed" ? friendlyConversionError(event.last_error_message) : null;
          return (
            <li
              key={event.id}
              className="rounded-md border border-border px-3 py-2.5 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {labelConversionPlatform(event.platform)} ·{" "}
                  {labelConversionEventName(event.event_name)}
                </span>
                <StatusBadge
                  status={OUTCOME_BADGE_STATUS[outcome]}
                  label={labelConversionOutcome(outcome)}
                />
              </div>
              <p className="mt-1 text-xs text-text-secondary">
                Última vez: {formatWhen(conversionLastAttemptAt(event))}
                {event.attempts > 1 ? ` · ${event.attempts} intentos` : ""}
              </p>
              {error ? <p className="mt-1.5 text-[12.5px] text-danger">{error}</p> : null}
              {outcome === "dry_run" ? (
                <p className="mt-1.5 text-[12.5px] text-text-secondary">
                  {conversionOutcomeHint("dry_run")}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
