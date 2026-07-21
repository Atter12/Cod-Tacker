"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createWhatsappTemplate,
  duplicateWhatsappTemplate,
  updateWhatsappTemplate,
} from "@/app/actions/whatsapp";
import { Button, Input, Textarea } from "@/components/ui";
import { extractTemplateVariables, renderTemplate } from "@/lib/whatsapp/templates";

export function TemplatesManager({
  agencySlug,
  storeSlug,
  templates,
  canManage,
  liveMode = false,
}: {
  agencySlug: string;
  storeSlug: string;
  templates: Array<{
    id: string;
    name: string;
    body: string;
    status: string;
    is_active: boolean;
    language: string;
  }>;
  canManage: boolean;
  liveMode?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("confirmacion_cod");
  const [body, setBody] = useState(
    "Hola {{phone}}, confirma tu pedido {{order}} respondiendo SI.",
  );
  const [error, setError] = useState<string | null>(null);
  const vars = extractTemplateVariables(body);
  const preview = renderTemplate(body, { phone: "+51999…", order: "ORD-1" });

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="space-y-3 max-w-xl rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">
            {liveMode ? "Nueva plantilla (catálogo local)" : "Nueva plantilla (mock)"}
          </h3>
          {liveMode ? (
            <p className="text-xs text-text-secondary">
              El <strong>nombre</strong> debe coincidir exactamente con la plantilla aprobada en Meta
              Business Manager. Aquí solo guardamos el catálogo local para envío.
            </p>
          ) : null}
          {error && <p className="text-sm text-danger">{error}</p>}
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" />
          <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          <p className="text-xs text-text-secondary">
            Variables: {vars.length ? vars.join(", ") : "ninguna"} · Preview: {preview.text}
          </p>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await createWhatsappTemplate(agencySlug, storeSlug, { name, body });
                if (r.error) setError(r.error);
                else router.refresh();
              })
            }
          >
            Crear draft
          </Button>
        </div>
      )}

      <ul className="space-y-3">
        {templates.map((t) => (
          <li key={t.id} className="rounded-lg border border-border p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div>
                <p className="font-medium text-sm">{t.name}</p>
                <p className="text-xs text-text-secondary">
                  {t.language} · {t.status} · {t.is_active ? "activa" : "inactiva"}
                  {liveMode ? " · nombre = Meta template" : " · mock Meta"}
                </p>
              </div>
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await updateWhatsappTemplate(agencySlug, storeSlug, t.id, {
                          status: "approved",
                          isActive: true,
                        });
                        router.refresh();
                      })
                    }
                  >
                    {liveMode ? "Marcar lista" : "Aprobar mock"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await duplicateWhatsappTemplate(agencySlug, storeSlug, t.id);
                        router.refresh();
                      })
                    }
                  >
                    Duplicar
                  </Button>
                </div>
              )}
            </div>
            <pre className="text-xs whitespace-pre-wrap bg-muted/30 p-2 rounded">{t.body}</pre>
          </li>
        ))}
      </ul>
      {!templates.length && (
        <p className="text-sm text-text-secondary">Aún no hay plantillas.</p>
      )}
    </div>
  );
}
