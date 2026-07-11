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
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: StateAction;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mb-4 text-text-secondary">{icon}</div>
      <h3 className="font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-text-secondary">{description}</p>
      {action?.href ? (
        <Link
          href={action.href}
          className="mt-5 inline-flex h-9 items-center justify-center rounded-md bg-brand-primary px-4 text-sm font-medium text-white hover:bg-brand-primary/90"
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
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void } | StateAction;
}) {
  return (
    <StateShell
      icon={icon ?? <Inbox className="size-8" aria-hidden />}
      title={title}
      description={description}
      action={action}
    />
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
