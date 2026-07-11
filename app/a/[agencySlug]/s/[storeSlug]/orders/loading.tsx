import { Skeleton } from "@/components/ui/Skeleton";

export default function OrdersLoading() {
  return (
    <section className="space-y-4" aria-busy="true" aria-label="Cargando pedidos">
      <div className="space-y-1">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-[33px] w-[100px] shrink-0 rounded-[7px]" />
        ))}
      </div>
      <Skeleton className="h-11 w-full rounded-[10px]" />
      <Skeleton className="h-[420px] w-full rounded-[10px]" />
      <Skeleton className="h-9 w-40 rounded-md" />
    </section>
  );
}
