import { Skeleton } from "@/components/ui";

function CardSkeleton() {
  return (
    <div className="flex min-h-[104px] items-start gap-3.5 rounded-[12px] border border-border bg-surface-elevated p-5 shadow-[var(--card-shadow)]">
      <Skeleton className="size-[38px] shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-40 max-w-full" />
        <Skeleton className="h-[21px] w-16 rounded-full" />
      </div>
    </div>
  );
}

export default function IntegrationsLoading() {
  return (
    <section className="space-y-8" aria-busy="true" aria-label="Cargando integraciones">
      <header>
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-2 h-3.5 w-80 max-w-full" />
      </header>

      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>

      <div className="space-y-4">
        <Skeleton className="h-4 w-36" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>

      <Skeleton className="h-10 w-[148px] rounded-[10px]" />
    </section>
  );
}
