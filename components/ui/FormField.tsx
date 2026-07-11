import { type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function FormField({
  label,
  htmlFor,
  children,
  hint,
  className,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label
      className={cn("block space-y-1.5 text-sm font-medium text-text-primary", className)}
      htmlFor={htmlFor}
    >
      {label}
      {children}
      {hint ? <span className="block text-xs font-normal text-text-secondary">{hint}</span> : null}
    </label>
  );
}
