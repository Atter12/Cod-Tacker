import { Skeleton } from "@/components/ui/Skeleton";

export default function AlertsLoading() {
  return (
    <section className="space-y-5" aria-busy="true" aria-label="Cargando alertas">
      <div className="space-y-1">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="w-full max-w-[430px] space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-[84px] rounded-[10px]" />
        ))}
        <Skeleton className="mt-2 h-9 w-40 rounded-md" />
      </div>
    </section>
  );
}
