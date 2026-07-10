import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn("flex min-h-24 w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />,
);
Textarea.displayName = "Textarea";
