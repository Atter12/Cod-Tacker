import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn("flex h-9 w-full rounded-md border border-border bg-surface-elevated px-3 text-sm text-text-primary outline-none placeholder:text-text-secondary focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />,
);
Input.displayName = "Input";
