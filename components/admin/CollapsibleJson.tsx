"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { payloadLooksLarge, sanitizePayloadForDisplay } from "@/lib/jobs/sanitize-payload";
import type { Json } from "@/types/database.generated";

export function CollapsibleJson({
  value,
  title = "Payload",
  defaultOpen,
}: {
  value: Json | null | undefined;
  title?: string;
  defaultOpen?: boolean;
}) {
  const sanitized = sanitizePayloadForDisplay(value ?? null);
  const large = payloadLooksLarge(sanitized);
  const [open, setOpen] = useState(defaultOpen ?? !large);
  const text = sanitized == null ? "null" : JSON.stringify(sanitized, null, 2);

  return (
    <div className="rounded-lg border border-border bg-surface-elevated">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-primary"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          {title}
          {large ? <span className="text-xs font-normal text-text-secondary">(grande)</span> : null}
        </button>
        <Button
          size="sm"
          variant="ghost"
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(text);
          }}
        >
          Copiar
        </Button>
      </div>
      {open ? (
        <pre className="max-h-[28rem] overflow-auto p-3 text-xs leading-relaxed text-text-secondary">
          {text}
        </pre>
      ) : (
        <p className="px-3 py-2 text-xs text-text-secondary">
          JSON oculto por tamaño. Expande para ver el contenido sanitizado (secretos redactados).
        </p>
      )}
    </div>
  );
}
