import Link from "next/link";
import { type ReactNode } from "react";
import { AlertCircle, Inbox, ShieldOff } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils/cn";

type StateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

function StateShell({
  icon,
  title,
  description,
  action,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: StateAction;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center rounded-[12px] border border-dashed border-border bg-surface-elevated px-6 py-16 text-center shadow-[var(--card-shadow)]",
        className,
      )}
    >
      <div className="mb-4 text-text-secondary">{icon}</div>
      <h3 className="text-[15px] font-semibold text-text-primary">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-text-secondary">{description}</p>
      {children}
      {action?.href ? (
        <Link
          href={action.href}
          className="mt-5 inline-flex h-10 items-center justify-center rounded-[10px] bg-brand-primary px-4 text-sm font-medium text-white hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {action.label}
        </Link>
      ) : action?.onClick ? (
        <Button className="mt-5" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  children,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void } | StateAction;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <StateShell
      icon={icon ?? <Inbox className="size-8" aria-hidden />}
      title={title}
      description={description}
      action={action}
      className={className}
    >
      {children}
    </StateShell>
  );
}

export function ErrorState({
  title = "No se pudo cargar la información",
  description = "Ocurrió un error inesperado. Inténtalo de nuevo en unos momentos.",
  action,
}: {
  title?: string;
  description?: string;
  action?: StateAction;
}) {
  return (
    <StateShell
      icon={<AlertCircle className="size-8 text-danger" aria-hidden />}
      title={title}
      description={description}
      action={action}
      className="border-danger/30"
    />
  );
}

export function ForbiddenState({
  title = "Acceso restringido",
  description = "No tienes permisos para realizar esta acción en este espacio.",
  action,
}: {
  title?: string;
  description?: string;
  action?: StateAction;
}) {
  return (
    <StateShell
      icon={<ShieldOff className="size-8 text-warning" aria-hidden />}
      title={title}
      description={description}
      action={action}
    />
  );
}
