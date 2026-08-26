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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const idempotencyKeyRef = useRef<string | null>(null);

  const gananciasDisponibles = ganancias ?? 0;
  const canTransfer =
    Boolean(transferGananciasDisponible) && gananciasDisponibles > 0;

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
    <div className="mt-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Operaciones
          </p>
          <p className="mt-1 text-lg font-semibold">{formatCurrency(operaciones, "PEN")}</p>
          <p className="mt-0.5 text-[11px] text-text-secondary">Saldo para envíos y holds</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Ganancias
          </p>
          <p className="mt-1 text-lg font-semibold">
            {formatCurrency(gananciasDisponibles, "PEN")}
          </p>
          <p className="mt-0.5 text-[11px] text-text-secondary">COD producto acumulado</p>
        </div>
      </div>

      {reservado != null && reservado > 0 ? (
        <p className="text-xs text-text-secondary">
          Reservado (holds activos): {formatCurrency(reservado, "PEN")}
        </p>
      ) : null}

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

      {canTransfer ? (
        <div className="space-y-3">
          <p className="text-[12.5px] text-text-secondary">
            Si Operaciones es bajo, puedes mover Ganancias a Operaciones al instante (sin retiro a
            banco).
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[140px] flex-1">
              <FormField label="Monto (opcional)" htmlFor="flipy-transfer-monto">
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
            <Button size="sm" disabled={pending} onClick={() => handleTransferAll()}>
              {pending ? "Transfiriendo…" : "Pasar a Operaciones"}
            </Button>
          </div>
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
          className="inline-flex text-xs font-medium text-primary hover:underline"
        >
          Configurar retiro en Flipy finanzas
        </a>
      ) : null}
    </div>
  );
}
