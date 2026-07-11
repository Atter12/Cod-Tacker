"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addOrderNote,
  cancelOrRejectOrder,
  confirmOrder,
  createOrderAlert,
  markOrderForReview,
  updateOrderPaymentStatus,
} from "@/app/actions/orders";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { PAYMENT_STATUS_OPTIONS } from "@/lib/orders/labels";
import type { PaymentStatus } from "@/types/orders";

export function OrderActionsPanel({
  agencySlug,
  storeSlug,
  orderId,
  canManage,
}: {
  agencySlug: string;
  storeSlug: string;
  orderId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [alertTitle, setAlertTitle] = useState("");
  const [payment, setPayment] = useState<PaymentStatus | "">("");

  if (!canManage) {
    return (
      <Alert variant="info" title="Solo lectura">
        Tu rol puede ver el pedido, pero no ejecutar acciones operativas.
      </Alert>
    );
  }

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(() => {
      void (async () => {
        const result = await action();
        if (result.error) {
          setError(result.error);
          return;
        }
        router.refresh();
      })();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface-elevated p-4">
      <h2 className="text-sm font-semibold">Acciones</h2>
      {error ? (
        <Alert variant="danger" title="No se pudo completar">
          {error}
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => confirmOrder(agencySlug, storeSlug, orderId))}
        >
          Confirmar
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => markOrderForReview(agencySlug, storeSlug, orderId))}
        >
          Marcar revisión
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={pending}
          onClick={() =>
            run(() => cancelOrRejectOrder(agencySlug, storeSlug, orderId, "cancelled", "Cancelación manual"))
          }
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={pending}
          onClick={() =>
            run(() => cancelOrRejectOrder(agencySlug, storeSlug, orderId, "rejected", "Rechazo manual"))
          }
        >
          Rechazar
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <FormField label="Cambiar pago" htmlFor="pay-status">
          <Select
            id="pay-status"
            value={payment}
            onChange={(e) => setPayment(e.target.value as PaymentStatus | "")}
          >
            <option value="">Seleccionar…</option>
            {PAYMENT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="flex items-end">
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || !payment}
            onClick={() =>
              payment
                ? run(() => updateOrderPaymentStatus(agencySlug, storeSlug, orderId, payment))
                : undefined
            }
          >
            Actualizar pago
          </Button>
        </div>
      </div>

      <FormField label="Nota interna" htmlFor="order-note">
        <Textarea id="order-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      </FormField>
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !note.trim()}
        onClick={() =>
          run(async () => {
            const result = await addOrderNote(agencySlug, storeSlug, orderId, note);
            if (!result.error) setNote("");
            return result;
          })
        }
      >
        Guardar nota
      </Button>

      <FormField label="Alerta manual" htmlFor="alert-title">
        <Input
          id="alert-title"
          value={alertTitle}
          onChange={(e) => setAlertTitle(e.target.value)}
          placeholder="Título de la alerta"
        />
      </FormField>
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !alertTitle.trim()}
        onClick={() =>
          run(async () => {
            const result = await createOrderAlert(agencySlug, storeSlug, orderId, {
              title: alertTitle,
              severity: "warning",
            });
            if (!result.error) setAlertTitle("");
            return result;
          })
        }
      >
        Crear alerta
      </Button>
    </div>
  );
}
