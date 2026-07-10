import { type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils/cn";
const styles = { info: "border-brand-secondary/30 bg-brand-secondary/10 text-brand-secondary", success: "border-success/30 bg-success/10 text-success", warning: "border-warning/30 bg-warning/10 text-warning", danger: "border-danger/30 bg-danger/10 text-danger" };
const icons = { info: Info, success: CheckCircle2, warning: TriangleAlert, danger: AlertCircle };
export function Alert({ variant = "info", title, children }: { variant?: keyof typeof styles; title?: string; children: ReactNode }) { const Icon = icons[variant]; return <div role="alert" className={cn("flex gap-3 rounded-md border p-3 text-sm", styles[variant])}><Icon className="mt-0.5 size-4 shrink-0" /><div>{title && <p className="font-semibold">{title}</p>}<div className={title ? "mt-1" : ""}>{children}</div></div></div>; }
