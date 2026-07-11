import { type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-text-primary sm:text-[28px] sm:font-bold">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-text-secondary sm:text-sm">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1">{actions}</div>
      ) : null}
    </header>
  );
}
