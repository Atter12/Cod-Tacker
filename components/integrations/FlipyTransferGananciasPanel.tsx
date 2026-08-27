"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { transferFlipyGananciasToOperaciones } from "@/app/actions/flipy-wallet";
import { buildFlipyAppFinanzasUrl } from "@/lib/integrations/flipy/embed-urls";
import { formatCurrency } from "@/lib/formatting/currency";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/forms/FormField";

type Props = {
  agencySlug: string;
  storeSlug: string;
  storeId: string;
  billeteraOperaciones: number;
  billeteraGanancias: number | null;
  billeteraReservado: number | null;
  transferGananciasDisponible?: boolean | null;
  destinoRetiroConfigurado?: boolean | null;
  appOrigin?: string | null;
};

export function FlipyTransferGananciasPanel({
  agencySlug,
  storeSlug,
  storeId,
  billeteraOperaciones: initialOperaciones,
  billeteraGanancias: initialGanancias,
  billeteraReservado: initialReservado,
  transferGananciasDisponible = false,
  destinoRetiroConfigurado = false,
  appOrigin = null,
}: Props) {
  const router = useRouter();
  const [operaciones, setOperaciones] = useState(initialOperaciones);
  const [ganancias, setGanancias] = useState(initialGanancias);
  const [reservado, setReservado] = useState(initialReservado);
  const [monto, setMonto] = useState("");
  const [showCustomMonto, setShowCustomMonto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const idempotencyKeyRef = useRef<string | null>(null);

  const gananciasDisponibles = ganancias ?? 0;
  const reserved = reservado ?? 0;
  const holdBase = operaciones + reserved;
  const holdPct = holdBase > 0 ? Math.min(100, Math.round((reserved / holdBase) * 100)) : 0;
  const canTransfer = Boolean(transferGananciasDisponible) && gananciasDisponibles > 0;

  function resetIdempotencyKey() {
    idempotencyKeyRef.current = null;
  }

  function applyTransferResult(result: {
    billeteraOperaciones: number;
    billeteraGanancias: number | null;
    billeteraReservado: number | null;
    message?: string | null;
  }) {
    setOperaciones(result.billeteraOperaciones);
    setGanancias(result.billeteraGanancias);
    setReservado(result.billeteraReservado);
    setSuccess(result.message ?? "Transferencia completada.");
    setMonto("");
    setShowCustomMonto(false);
    resetIdempotencyKey();
    router.refresh();
  }

  function ensureIdempotencyKey(): string {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = `codtracked:transfer:${storeId}:${crypto.randomUUID()}`;
    }
    return idempotencyKeyRef.current;
  }

  function submitTransfer(transferMonto: number) {
    setError(null);
    setSuccess(null);
    const idempotencyKey = ensureIdempotencyKey();
    start(async () => {
      const result = await transferFlipyGananciasToOperaciones({
        agencySlug,
        storeSlug,
        monto: transferMonto,
        idempotencyKey,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      applyTransferResult({
        billeteraOperaciones: result.billeteraOperaciones ?? operaciones,
        billeteraGanancias: result.billeteraGanancias ?? ganancias,
        billeteraReservado: result.billeteraReservado ?? reservado,
        message: result.message,
      });
    });
  }

  function handleTransferAll() {
    if (!canTransfer) return;
    submitTransfer(gananciasDisponibles);
  }

  function handleTransferCustom() {
    if (!canTransfer) return;
    const parsed = Number.parseFloat(monto.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Ingresa un monto válido mayor a cero.");
      return;
    }
    if (parsed > gananciasDisponibles) {
      setError("El monto supera tu saldo en Ganancias.");
      return;
    }
    submitTransfer(parsed);
  }

  const finanzasUrl =
    appOrigin && destinoRetiroConfigurado
      ? buildFlipyAppFinanzasUrl({ appOrigin })
      : null;

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-text-primary">Operaciones</p>
            <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
              Activo
            </span>
          </div>
          <p className="text-2xl font-semibold tracking-tight text-text-primary">
            {formatCurrency(operaciones, "PEN")}
          </p>
          <p className="text-[12px] text-text-secondary">Saldo para envíos y holds</p>
          {reserved > 0 ? (
            <div className="space-y-1.5 pt-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand-primary transition-[width]"
                  style={{ width: `${holdPct}%` }}
                />
              </div>
              <p className="text-[11px] text-text-secondary">
                Reservado en holds {formatCurrency(reserved, "PEN")}
                {holdBase > 0 ? ` · ${holdPct}%` : null}
              </p>
            </div>
          ) : null}
        </div>

        <div className="space-y-2 border-t border-border pt-4 sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-text-primary">Ganancias</p>
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-primary">
              COD
            </span>
          </div>
          <p className="text-2xl font-semibold tracking-tight text-text-primary">
            {formatCurrency(gananciasDisponibles, "PEN")}
          </p>
          <p className="text-[12px] text-text-secondary">COD producto acumulado</p>
          {gananciasDisponibles <= 0 ? (
            <p className="text-[11px] italic text-text-secondary">Aún no hay entregas confirmadas</p>
          ) : null}
        </div>
      </div>

      {error ? (
        <Alert variant="warning" title="Transferencia">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert variant="success" title="Billetera actualizada">
          {success}
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <a
          href="#flipy-recarga"
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-brand-primary px-4 text-sm font-medium text-white transition-colors hover:bg-brand-primary/90 sm:flex-none"
        >
          + Recargar operaciones
        </a>
        {canTransfer ? (
          <Button
            size="md"
            variant="outline"
            className="flex-1 border-brand-primary/30 text-brand-primary hover:bg-brand-soft sm:flex-none"
            disabled={pending}
            onClick={() => handleTransferAll()}
          >
            {pending ? "Transfiriendo…" : "→ Pasar ganancias a operaciones"}
          </Button>
        ) : null}
      </div>

      {canTransfer ? (
        <div className="space-y-2">
          <button
            type="button"
            className="text-[12px] font-medium text-text-secondary underline-offset-2 hover:text-text-primary hover:underline"
            onClick={() => setShowCustomMonto((v) => !v)}
          >
            {showCustomMonto ? "Ocultar monto personalizado" : "Pasar un monto parcial…"}
          </button>
          {showCustomMonto ? (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border bg-muted/40 p-3">
              <div className="min-w-[140px] flex-1">
                <FormField label="Monto a pasar" htmlFor="flipy-transfer-monto">
                  <input
                    id="flipy-transfer-monto"
                    type="text"
                    inputMode="decimal"
                    placeholder={gananciasDisponibles.toFixed(2)}
                    value={monto}
                    onChange={(event) => {
                      setMonto(event.target.value);
                      resetIdempotencyKey();
                    }}
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                    disabled={pending}
                  />
                </FormField>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={pending || !monto.trim()}
                onClick={() => handleTransferCustom()}
              >
                Pasar monto
              </Button>
            </div>
          ) : null}
        </div>
      ) : gananciasDisponibles > 0 && !transferGananciasDisponible ? (
        <p className="text-[12.5px] text-text-secondary">
          La transferencia Ganancias → Operaciones no está disponible en este momento.
        </p>
      ) : null}

      {finanzasUrl ? (
        <a
          href={finanzasUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-xs font-medium text-brand-primary hover:underline"
        >
          Configurar retiro en Flipy finanzas ↗
        </a>
      ) : null}
    </div>
  );
}
