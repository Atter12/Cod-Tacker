import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { RecentAccountEvent } from "@/services/store-selector.service";
import { cn } from "@/lib/utils/cn";

const toneDot: Record<RecentAccountEvent["tone"], string> = {
  success: "bg-[#22C55E]",
  warning: "bg-[#FB923C]",
  danger: "bg-[#F87171]",
  info: "bg-[#22D3EE]",
};

export function RecentAccountActivity({ events }: { events: RecentAccountEvent[] }) {
  const visible = events.slice(0, 3);

  return (
    <section
      className="rounded-[16px] border border-[rgba(76,139,170,0.16)] bg-[#0A1729]/80 px-[18px] py-4 sm:px-5 sm:py-[18px]"
      aria-labelledby="recent-activity-heading"
    >
      <h2
        id="recent-activity-heading"
        className="text-[13px] font-semibold text-[#F8FAFC] sm:text-[14px]"
      >
        Actividad reciente de la cuenta
      </h2>
      {visible.length === 0 ? (
        <p className="mt-2.5 text-[13px] leading-relaxed text-[#64748B]">
          Todavía no hay actividad reciente. Las sincronizaciones y alertas aparecerán aquí.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {visible.map((event) => (
            <li key={event.id} className="flex min-w-0 items-start gap-2.5">
              <span
                className={cn("mt-1.5 size-2 shrink-0 rounded-full", toneDot[event.tone])}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-[13px] leading-snug text-[#E2E8F0]">{event.text}</p>
                <p className="mt-0.5 text-[10px] text-[#64748B]">
                  {formatDistanceToNow(new Date(event.at), { addSuffix: true, locale: es })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
