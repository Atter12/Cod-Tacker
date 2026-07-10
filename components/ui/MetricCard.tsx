import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "./Card";
import { Skeleton } from "./Skeleton";

interface MetricCardProps { label: string; value: string; hint?: string; trend?: { value: string; direction: "up" | "down" }; loading?: boolean; }
export function MetricCard({ label, value, hint, trend, loading }: MetricCardProps) {
  if (loading) return <Card><CardContent className="space-y-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-32" /></CardContent></Card>;
  const TrendIcon = trend?.direction === "up" ? TrendingUp : TrendingDown;
  return <Card><CardContent><p className="text-sm text-text-secondary">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p><div className="mt-3 flex items-center gap-2 text-xs text-text-secondary">{trend && <span className={trend.direction === "up" ? "inline-flex items-center gap-1 text-success" : "inline-flex items-center gap-1 text-danger"}><TrendIcon className="size-3" />{trend.value}</span>}{hint && <span>{hint}</span>}</div></CardContent></Card>;
}
