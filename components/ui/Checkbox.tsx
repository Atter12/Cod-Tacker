import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export const Checkbox = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(
  ({ className, ...props }, ref) => <input ref={ref} type="checkbox" className={cn("size-4 rounded border-border accent-brand-primary focus:ring-2 focus:ring-ring", className)} {...props} />,
);
Checkbox.displayName = "Checkbox";
