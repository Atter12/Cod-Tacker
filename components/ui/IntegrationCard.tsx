import Link from "next/link";
import { Plug } from "lucide-react";
import { Card, CardContent } from "./Card";
import { DemoModeBadge } from "./DemoModeBadge";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils/cn";

const actionClassName =
  "inline-flex h-8 items-center justify-center rounded-md border border-border bg-surface-elevated px-3 text-xs font-medium text-text-primary transition-colors hover:bg-muted";

export function IntegrationCard({
  name,
  description,
  status = "No conectado",
  statusLabel,
  href,
  actionLabel = "Revisar",
  demo = false,
}: {
  name: string;
  description: string;
  status?: string;
  statusLabel?: string;
  href?: string;
  actionLabel?: string;
  demo?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4">
        <div className="rounded-md bg-muted p-2">
          <Plug className="size-5 text-brand-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{name}</h3>
            <StatusBadge status={status} label={statusLabel ?? status} />
            {demo ? <DemoModeBadge /> : null}
          </div>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        </div>
        {href ? (
          <Link href={href} className={actionClassName}>
            {actionLabel}
          </Link>
        ) : (
          <span className={cn(actionClassName, "pointer-events-none opacity-50")}>{actionLabel}</span>
        )}
      </CardContent>
    </Card>
  );
}
