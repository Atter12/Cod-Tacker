import { Badge } from "./Badge";
import { cn } from "@/lib/utils/cn";
import {
  labelConfirmationStatus,
  labelOrderStatus,
  labelPaymentStatus,
} from "@/lib/orders/labels";

const statusClasses: Record<string, string> = {
  connected: "bg-success/10 text-success",
  conectado: "bg-success/10 text-success",
  active: "bg-success/10 text-success",
  healthy: "bg-success/10 text-success",
  completed: "bg-success/10 text-success",
  ok: "bg-success/10 text-success",
  pendiente: "bg-warning/10 text-warning",
  pending: "bg-warning/10 text-warning",
  degraded: "bg-warning/10 text-warning",
  queued: "bg-warning/10 text-warning",
  running: "bg-brand-primary/10 text-brand-primary",
  partial: "bg-warning/10 text-warning",
  error: "bg-danger/10 text-danger",
  failed: "bg-danger/10 text-danger",
  down: "bg-danger/10 text-danger",
  cancelled: "bg-muted text-text-secondary",
  disconnected: "bg-muted text-text-secondary",
  "no conectado": "bg-muted text-text-secondary",
  confirmed: "bg-success/10 text-success",
  delivered: "bg-success/10 text-success",
  settled: "bg-success/10 text-success",
  cash_collected: "bg-success/10 text-success",
  rejected: "bg-danger/10 text-danger",
  returned: "bg-warning/10 text-warning",
  unpaid: "bg-warning/10 text-warning",
  created: "bg-muted text-text-secondary",
  shipped: "bg-brand-primary/10 text-brand-primary",
  in_transit: "bg-brand-primary/10 text-brand-primary",
  manual_review: "bg-warning/10 text-warning",
  skipped: "bg-muted text-text-secondary",
  processing: "bg-brand-primary/10 text-brand-primary",
  retry_scheduled: "bg-warning/10 text-warning",
  dead_letter: "bg-danger/10 text-danger",
  ignored: "bg-muted text-text-secondary",
  received: "bg-warning/10 text-warning",
  validated: "bg-brand-primary/10 text-brand-primary",
  processed: "bg-success/10 text-success",
  retrying: "bg-warning/10 text-warning",
  out_for_delivery: "bg-brand-primary/10 text-brand-primary",
  delivery_failed: "bg-danger/10 text-danger",
  return_in_transit: "bg-warning/10 text-warning",
  lost: "bg-danger/10 text-danger",
  unknown: "bg-muted text-text-secondary",
  picked_up: "bg-brand-primary/10 text-brand-primary",
  label_generated: "bg-muted text-text-secondary",
  started: "bg-brand-primary/10 text-brand-primary",
  open: "bg-warning/10 text-warning",
  partially_matched: "bg-warning/10 text-warning",
  matched: "bg-success/10 text-success",
  closed: "bg-success/10 text-success",
  unmatched: "bg-muted text-text-secondary",
  difference: "bg-warning/10 text-warning",
  duplicate: "bg-danger/10 text-danger",
  disputed: "bg-danger/10 text-danger",
  resolved: "bg-success/10 text-success",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <Badge className={cn(statusClasses[status.toLowerCase()] ?? "bg-muted text-text-secondary")}>
      {label ?? status}
    </Badge>
  );
}

export function OrderStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} label={labelOrderStatus(status)} />;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} label={labelPaymentStatus(status)} />;
}

export function ConfirmationStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} label={labelConfirmationStatus(status)} />;
}
