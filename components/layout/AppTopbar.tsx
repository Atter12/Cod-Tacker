import Link from "next/link";
import { type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { UserMenu } from "./UserMenu";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function AppTopbar({
  title,
  breadcrumbs = [],
  storeReturn,
  agencyConsole,
  tenantSwitcher,
  user,
}: {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  storeReturn?: ReactNode;
  agencyConsole?: ReactNode;
  tenantSwitcher?: ReactNode;
  user?: { name?: string; email?: string };
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface-elevated px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {storeReturn}
        <div className="min-w-0">
          {breadcrumbs.length > 0 ? (
            <nav aria-label="Miga de pan" className="mb-0.5 flex items-center gap-1 text-xs text-text-secondary">
              {breadcrumbs.map((breadcrumb, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <span key={`${breadcrumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
                    {breadcrumb.href && !isLast ? (
                      <Link
                        href={breadcrumb.href}
                        className="truncate transition-colors hover:text-text-primary hover:underline"
                      >
                        {breadcrumb.label}
                      </Link>
                    ) : (
                      <span className="truncate">{breadcrumb.label}</span>
                    )}
                    {!isLast ? <ChevronRight className="size-3 shrink-0" aria-hidden /> : null}
                  </span>
                );
              })}
            </nav>
          ) : null}
          <h1 className="truncate text-sm font-semibold">{title}</h1>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {agencyConsole}
        {tenantSwitcher}
        <UserMenu {...user} />
      </div>
    </header>
  );
}
