"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";
import type { IntegrationOverviewItem } from "@/types/integrations";
import { IntegrationProviderIcon } from "./IntegrationProviderIcon";

const triggerClassName =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-brand-primary bg-transparent px-3.5 text-[12.5px] font-medium text-brand-primary transition-colors hover:bg-brand-softer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

export function IntegrationCatalogDialog({
  availableProviders,
  agencySlug,
  storeSlug,
  demo = false,
  triggerLabel = "Agregar integración",
  triggerClassName: triggerClassNameProp,
  showPlusIcon = true,
}: {
  availableProviders: IntegrationOverviewItem[];
  agencySlug: string;
  storeSlug: string;
  demo?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
  showPlusIcon?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();

  return (
    <>
      <button
        type="button"
        className={cn(triggerClassName, triggerClassNameProp)}
        onClick={() => setOpen(true)}
      >
        {showPlusIcon ? <Plus className="size-3.5" aria-hidden /> : null}
        {triggerLabel}
      </button>

      <Dialog open={open} onOpenChange={setOpen} title="Agregar integración" className="max-w-md">
        <div className="space-y-4">
          <p id={descriptionId} className="text-[13px] text-text-secondary">
            Selecciona un proveedor disponible para esta tienda.
          </p>

          {demo ? (
            <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[12px] text-warning">
              Entorno de demostración. Las conexiones usan adaptadores mock.
            </p>
          ) : null}

          {availableProviders.length === 0 ? (
            <p className="text-[13px] text-text-secondary">
              No hay proveedores adicionales disponibles para configurar.
            </p>
          ) : (
            <ul className="max-h-[min(420px,60vh)] space-y-2 overflow-y-auto pr-1" aria-describedby={descriptionId}>
              {availableProviders.map((item) => (
                <li
                  key={item.provider}
                  className="flex items-start gap-3 rounded-[10px] border border-border bg-surface p-3"
                >
                  <IntegrationProviderIcon provider={item.provider} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-text-primary">{item.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-text-secondary">
                      {item.description}
                    </p>
                    <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                      Disponible
                    </p>
                  </div>
                  <Link
                    href={routes.store.integrationDetail(agencySlug, storeSlug, item.provider)}
                    className="inline-flex h-10 shrink-0 items-center rounded-[10px] border border-brand-primary px-3 text-[12.5px] font-medium text-brand-primary transition-colors hover:bg-brand-softer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setOpen(false)}
                  >
                    Conectar
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Dialog>
    </>
  );
}
