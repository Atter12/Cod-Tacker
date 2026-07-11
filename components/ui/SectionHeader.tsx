import { type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function SectionHeader({
  title,
  description,
  action,
  className,
  as: Tag = "h2",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <Tag className="text-[15px] font-semibold tracking-tight text-text-primary">{title}</Tag>
        {description ? (
          <p className="mt-1 text-[13px] text-text-secondary">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
