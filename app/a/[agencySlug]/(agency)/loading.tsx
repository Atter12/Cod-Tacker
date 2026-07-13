export default function AgencyConsoleLoading() {
  return (
    <div className="min-w-0 space-y-6 animate-pulse" aria-busy="true" aria-label="Cargando">
      <div className="space-y-2">
        <div className="h-6 w-48 max-w-full rounded-md bg-muted" />
        <div className="h-4 w-72 max-w-full rounded-md bg-muted" />
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 rounded-[12px] border border-border bg-muted/60" />
        ))}
      </div>
      <div className="h-48 rounded-[12px] border border-border bg-muted/40" />
      <div className="h-64 rounded-[12px] border border-border bg-muted/40" />
    </div>
  );
}
