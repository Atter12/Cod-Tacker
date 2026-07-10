import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary: "bg-brand-primary text-white hover:bg-brand-primary/90",
  secondary: "bg-brand-secondary text-white hover:bg-brand-secondary/90",
  ghost: "hover:bg-muted text-text-secondary hover:text-text-primary",
  danger: "bg-danger text-white hover:bg-danger/90",
  outline: "border border-border bg-surface-elevated text-text-primary hover:bg-muted",
};
const sizes: Record<Size, string> = { sm: "h-8 px-3 text-xs", md: "h-9 px-4 text-sm", lg: "h-11 px-5 text-sm" };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn("inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50", variants[variant], sizes[size], className)} {...props} />
  ),
);
Button.displayName = "Button";
