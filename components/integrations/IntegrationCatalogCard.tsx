import Link from "next/link";
import { routes } from "@/config/routes";
import { DemoModeBadge } from "@/components/ui/DemoModeBadge";
import { cn } from "@/lib/utils/cn";
import type { IntegrationOverviewItem } from "@/types/integrations";
import { IntegrationProviderIcon } from "./IntegrationProviderIcon";

const connectClassName =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-[10px] border border-brand-primary bg-transparent px-3.5 text-[12.5px] font-medium text-brand-primary transition-colors hover:bg-brand-softer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function IntegrationCatalogCard({
  item,
  agencySlug,
  storeSlug,
  canManage,
  demo = false,
}: {
  item: IntegrationOverviewItem;
  agencySlug: string;
  storeSlug: string;
  canManage: boolean;
  demo?: boolean;
}) {
  const href = routes.store.integrationDetail(agencySlug, storeSlug, item.provider);
  const showDemo = demo || item.demo;

  return (
    <article className="flex h-full flex-col gap-4 rounded-[12px] border border-border bg-surface-elevated p-5 shadow-[var(--card-shadow)] sm:flex-row sm:items-start sm:gap-4">
      <IntegrationProviderIcon provider={item.provider} className="size-11" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[14px] font-semibold text-text-primary">{item.name}</h3>
          {showDemo ? <DemoModeBadge compact /> : null}
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-text-secondary">{item.description}</p>
        <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-text-secondary">
          No conectado
        </p>
      </div>
      {canManage ? (
        <Link
          href={href}
          className={cn(connectClassName, "self-stretch sm:self-center")}
          aria-label={`Conectar ${item.name}`}
        >
          Conectar
        </Link>
      ) : (
        <span
          className={cn(connectClassName, "cursor-not-allowed self-stretch opacity-50 sm:self-center")}
          aria-disabled
          title="Sin permiso para conectar"
        >
          Conectar
        </span>
      )}
    </article>
  );
}
