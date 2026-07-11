import { Skeleton } from "@/components/ui";

function CardSkeleton() {
  return (
    <div className="flex min-h-[95px] items-start gap-3.5 rounded-[10px] border border-border bg-surface-elevated p-4 shadow-[var(--card-shadow)]">
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
    <section className="space-y-5" aria-busy="true" aria-label="Cargando integraciones">
      <header>
        <Skeleton className="h-[30px] w-40" />
        <Skeleton className="mt-1.5 h-3.5 w-72 max-w-full" />
      </header>

      <div className="w-full max-w-[680px]">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-x-5 md:gap-y-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="mt-14">
          <Skeleton className="h-[34px] w-[140px] rounded-[7px]" />
        </div>
      </div>
    </section>
  );
}
