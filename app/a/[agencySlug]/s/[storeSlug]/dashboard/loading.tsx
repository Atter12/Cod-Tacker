import { Skeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <section className="space-y-3" aria-busy="true" aria-label="Cargando resumen operativo">
      <div className="space-y-2 pb-1">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={`kpi-${index}`} className="h-[96px] rounded-[11px]" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,0.37fr)_minmax(0,0.63fr)]">
        <Skeleton className="min-h-[320px] rounded-[11px]" />
        <Skeleton className="min-h-[320px] rounded-[11px]" />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Skeleton className="h-[115px] rounded-[11px] md:col-span-2 xl:col-span-2" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={`sec-${index}`} className="h-[115px] rounded-[11px]" />
        ))}
      </div>

      <Skeleton className="h-64 rounded-[11px]" />
    </section>
  );
}
