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
  return (
    <section className="mt-8" aria-labelledby="recent-activity-heading">
      <h2 id="recent-activity-heading" className="text-[15px] font-semibold text-[#F8FAFC]">
        Actividad reciente de la cuenta
      </h2>
      {events.length === 0 ? (
        <p className="mt-3 text-[13px] text-[#64748B]">Todavía no hay actividad reciente.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-start gap-3 rounded-xl border border-[rgba(76,139,170,0.14)] bg-[#0A1729]/70 px-3.5 py-3"
            >
              <span
                className={cn("mt-1.5 size-2 shrink-0 rounded-full", toneDot[event.tone])}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-[#E2E8F0]">{event.text}</p>
                <p className="mt-0.5 text-[11px] text-[#64748B]">
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
