import { MetricCard } from "@/components/ui/MetricCard";
export interface Kpi { label: string; value: string; hint?: string; trend?: { value: string; direction: "up" | "down" }; }
export function KpiGrid({ items, loading }: { items: Kpi[]; loading?: boolean }) { return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.map((item) => <MetricCard key={item.label} {...item} loading={loading} />)}</div>; }
