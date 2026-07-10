import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => <select ref={ref} className={cn("h-9 w-full rounded-md border border-border bg-surface-elevated px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className)} {...props}>{children}</select>,
);
Select.displayName = "Select";
