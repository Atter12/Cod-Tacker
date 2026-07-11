export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#050B16] text-[#F8FAFC]">
      <div className="h-16 border-b border-[rgba(76,139,170,0.2)] bg-[#0A1729]/90" />
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-10 sm:px-8 lg:grid-cols-[1fr_240px] lg:px-10">
        <div className="space-y-6">
          <div className="h-10 w-2/3 max-w-md animate-pulse rounded-lg bg-[#0D1B30]" />
          <div className="h-4 w-full max-w-lg animate-pulse rounded bg-[#0D1B30]" />
          <div className="h-11 max-w-[440px] animate-pulse rounded-[11px] bg-[#0D1B30]" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((key) => (
              <div key={key} className="h-[112px] animate-pulse rounded-[16px] bg-[#0A1729]" />
            ))}
          </div>
        </div>
        <div className="h-80 animate-pulse rounded-[20px] bg-[#09162A]" />
      </div>
    </div>
  );
}
