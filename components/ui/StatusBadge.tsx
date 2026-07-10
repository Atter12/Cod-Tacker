import { Badge } from "./Badge";
import { cn } from "@/lib/utils/cn";
const statusClasses: Record<string, string> = { connected: "bg-success/10 text-success", conectado: "bg-success/10 text-success", active: "bg-success/10 text-success", pendiente: "bg-warning/10 text-warning", pending: "bg-warning/10 text-warning", error: "bg-danger/10 text-danger", disconnected: "bg-muted text-text-secondary", "no conectado": "bg-muted text-text-secondary" };
export function StatusBadge({ status }: { status: string }) { return <Badge className={cn(statusClasses[status.toLowerCase()] ?? "bg-muted text-text-secondary")}>{status}</Badge>; }
