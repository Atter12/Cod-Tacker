import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export function StoreSelectorHeader({
  userName,
  email,
  avatarUrl,
}: {
  userName: string;
  email: string | null;
  avatarUrl: string | null;
}) {
  const initial = (userName || email || "U").slice(0, 1).toUpperCase();

  return (
    <header className="border-b border-[rgba(76,139,170,0.2)] bg-[#0A1729]">
      <div className="mx-auto flex h-16 w-full max-w-[1520px] items-center justify-between gap-3 px-5 sm:h-[68px] sm:px-8 xl:px-10">
        <Link
          href="/dashboard"
          className="inline-flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[rgba(34,211,238,0.55)] sm:gap-3"
        >
          <span
            className="grid size-[34px] shrink-0 place-items-center rounded-[10px] border border-[rgba(34,211,238,0.28)] bg-[#071426] sm:size-9"
            aria-hidden
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path
                d="M9 2.2 15.2 14.5H2.8L9 2.2Z"
                stroke="#22D3EE"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path d="M9 7.2v5.2" stroke="#19C7B5" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="9" cy="14.2" r="0.9" fill="#19C7B5" />
            </svg>
          </span>
          <span className="truncate text-[17px] font-bold tracking-tight text-[#F8FAFC] sm:text-[18px]">
            CODTracked
          </span>
        </Link>

        <div className="flex min-w-0 items-center gap-3">
          <p className="hidden max-w-[200px] truncate text-[12px] text-[#94A3B8] sm:block">
            {userName}
          </p>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="size-[30px] rounded-full object-cover ring-1 ring-[rgba(76,139,170,0.35)] sm:size-8"
            />
          ) : (
            <span
              className={cn(
                "grid size-[30px] place-items-center rounded-full bg-[#19C7B5] text-xs font-semibold text-[#042F2E] sm:size-8",
              )}
              aria-hidden
            >
              {initial}
            </span>
          )}
          <span className="sr-only">Sesión de {userName}</span>
        </div>
      </div>
    </header>
  );
}
