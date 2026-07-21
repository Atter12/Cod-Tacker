"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  closeWhatsappConversation,
  sendWhatsappMessage,
  setWhatsappConfirmation,
  simulateWhatsappReply,
} from "@/app/actions/whatsapp";
import { Button, Select, Textarea } from "@/components/ui";
import { WHATSAPP_REPLY_SCENARIOS } from "@/lib/whatsapp/templates";

export function ConversationActionsPanel({
  agencySlug,
  storeSlug,
  conversationId,
  canManage,
  templates,
  liveMode = false,
}: {
  agencySlug: string;
  storeSlug: string;
  conversationId: string;
  canManage: boolean;
  templates: Array<{ id: string; name: string }>;
  liveMode?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState("Hola, ¿confirmas tu pedido COD?");
  const [templateId, setTemplateId] = useState("");
  const [scenario, setScenario] = useState("confirm");
  const [delivery, setDelivery] = useState("delivered_read");
  const [error, setError] = useState<string | null>(null);

  if (!canManage) {
    return <p className="text-sm text-text-secondary">Solo lectura (viewer).</p>;
  }

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold">{liveMode ? "Enviar mensaje" : "Acciones mock"}</h3>
      {liveMode ? (
        <p className="text-xs text-text-secondary">
          Cloud API: texto libre (ventana 24h) o plantilla cuyo <strong>nombre</strong> coincida con
          Meta. Estados delivered/read llegan por webhook.
        </p>
      ) : null}
      {error && <p className="text-sm text-danger">{error}</p>}
      <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
        <option value="">Sin plantilla (texto)</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>
      {!liveMode ? (
        <Select value={delivery} onChange={(e) => setDelivery(e.target.value)}>
          <option value="delivered_read">Entrega → leído</option>
          <option value="failed_retryable">Fallo reintentable</option>
          <option value="failed_permanent">Fallo permanente</option>
        </Select>
      ) : null}
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          run(() =>
            sendWhatsappMessage(agencySlug, storeSlug, conversationId, {
              body,
              templateId: templateId || undefined,
              deliveryScenario: liveMode ? undefined : delivery,
            }),
          )
        }
      >
        {liveMode ? "Enviar" : "Enviar mock"}
      </Button>
      {!liveMode ? (
        <div className="border-t border-border pt-3 space-y-2">
          <Select value={scenario} onChange={(e) => setScenario(e.target.value)}>
            {WHATSAPP_REPLY_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run(() => simulateWhatsappReply(agencySlug, storeSlug, conversationId, scenario))
            }
          >
            Simular respuesta (job)
          </Button>
          <p className="text-xs text-text-secondary">
            Tras simular, ejecuta <code>npm run jobs:process</code>.
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() => setWhatsappConfirmation(agencySlug, storeSlug, conversationId, "confirmed"))
          }
        >
          Confirmar pedido
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={pending}
          onClick={() =>
            run(() => setWhatsappConfirmation(agencySlug, storeSlug, conversationId, "rejected"))
          }
        >
          Rechazar
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(() => closeWhatsappConversation(agencySlug, storeSlug, conversationId))
          }
        >
          Cerrar
        </Button>
      </div>
    </div>
  );
}
