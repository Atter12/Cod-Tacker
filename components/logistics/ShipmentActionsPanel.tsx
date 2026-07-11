"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createShipmentAlert,
  markShipmentForReview,
  simulateShipmentMockEvent,
} from "@/app/actions/shipments";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { MOCK_CARRIER_SCENARIOS } from "@/lib/logistics/mock-scenarios";

export function ShipmentActionsPanel({
  agencySlug,
  storeSlug,
  shipmentId,
  canManage,
}: {
  agencySlug: string;
  storeSlug: string;
  shipmentId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState("delivered");
  const [alertTitle, setAlertTitle] = useState("");
  const [reviewReason, setReviewReason] = useState("");

  if (!canManage) {
    return (
      <Alert variant="info" title="Solo lectura">
        Tu rol puede ver el envío, pero no ejecutar acciones operativas.
      </Alert>
    );
  }

  function run(action: () => Promise<{ error?: string; jobId?: string }>, ok?: string) {
    setError(null);
    setMessage(null);
    startTransition(() => {
      void (async () => {
        const result = await action();
        if (result.error) {
          setError(result.error);
          return;
        }
        setMessage(ok ?? (result.jobId ? `Trabajo encolado: ${result.jobId.slice(0, 8)}…` : "Listo."));
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
      {message ? (
        <Alert variant="success" title="Listo">
          {message}
        </Alert>
      ) : null}

      <div className="space-y-2">
        <FormField label="Escenario mock" htmlFor="scenario">
          <Select
            id="scenario"
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
          >
            {MOCK_CARRIER_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </FormField>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              () => simulateShipmentMockEvent(agencySlug, storeSlug, shipmentId, scenarioId),
              "Evento mock encolado (raw_event + job).",
            )
          }
        >
          Simular siguiente evento
        </Button>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <FormField label="Motivo de revisión" htmlFor="review-reason">
          <Input
            id="review-reason"
            value={reviewReason}
            onChange={(e) => setReviewReason(e.target.value)}
            placeholder="Revisar excepción de entrega"
          />
        </FormField>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(
              () => markShipmentForReview(agencySlug, storeSlug, shipmentId, reviewReason),
              "Marcado para revisión.",
            )
          }
        >
          Marcar para revisión
        </Button>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <FormField label="Título de alerta" htmlFor="alert-title">
          <Input
            id="alert-title"
            value={alertTitle}
            onChange={(e) => setAlertTitle(e.target.value)}
            placeholder="Retraso en entrega"
          />
        </FormField>
        <FormField label="Detalle" htmlFor="alert-body">
          <Textarea
            id="alert-body"
            rows={2}
            placeholder="Opcional"
            defaultValue=""
            onBlur={() => undefined}
          />
        </FormField>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending || !alertTitle.trim()}
          onClick={() =>
            run(
              () => createShipmentAlert(agencySlug, storeSlug, shipmentId, alertTitle),
              "Alerta creada.",
            )
          }
        >
          Crear alerta
        </Button>
      </div>
    </div>
  );
}
