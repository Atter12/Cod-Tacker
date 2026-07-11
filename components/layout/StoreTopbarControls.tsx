"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, CalendarDays, ChevronDown } from "lucide-react";
import { dateRangeLabels, parseDateRangePreset, type DateRangePreset } from "@/lib/formatting/date-range";
import { routes } from "@/config/routes";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { cn } from "@/lib/utils/cn";

const presets = Object.keys(dateRangeLabels) as DateRangePreset[];

function isDateRangeRoute(pathname: string): boolean {
  return (
    pathname.endsWith("/dashboard") ||
    pathname.endsWith("/orders") ||
    pathname.endsWith("/integrations")
  );
}

export function TopbarDateRange() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  if (!isDateRangeRoute(pathname)) return null;

  const hasCustomDates = Boolean(searchParams.get("from") || searchParams.get("to"));
  const value = parseDateRangePreset(searchParams.get("range"));
  const label = hasCustomDates ? "Rango personalizado" : dateRangeLabels[value];

  function setRange(next: DateRangePreset) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", next);
    params.delete("from");
    params.delete("to");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Dropdown
      className="min-w-44"
      trigger={
        <span className="inline-flex h-[38px] items-center gap-2 rounded-[9px] border border-border bg-surface-elevated px-3 text-[12.5px] font-medium text-text-primary transition-colors hover:bg-muted">
          <CalendarDays className="size-4 text-text-secondary" aria-hidden />
          <span className="hidden sm:inline">{label}</span>
          <span className="sr-only sm:hidden">Rango de fechas</span>
          <ChevronDown className="size-3.5 text-text-secondary" aria-hidden />
        </span>
      }
    >
      {presets.map((preset) => (
        <DropdownItem key={preset} onClick={() => setRange(preset)}>
          <span
            className={cn(
              !hasCustomDates && preset === value && "font-semibold text-brand-primary",
            )}
          >
            {dateRangeLabels[preset]}
          </span>
        </DropdownItem>
      ))}
    </Dropdown>
  );
}

export function TopbarAlertsBell({
  agencySlug,
  storeSlug,
  activeAlertCount = 0,
}: {
  agencySlug?: string;
  storeSlug?: string;
  activeAlertCount?: number;
}) {
  if (!agencySlug || !storeSlug) return null;
  const href = routes.store.alerts(agencySlug, storeSlug);

  return (
    <Link
      href={href}
      aria-label={
        activeAlertCount > 0
          ? `${activeAlertCount} alertas activas`
          : "Alertas"
      }
      className="relative grid size-[38px] place-items-center rounded-[9px] border border-border bg-surface-elevated text-text-secondary transition-colors hover:bg-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Bell className="size-4" aria-hidden />
      {activeAlertCount > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-[16px] text-white">
          {activeAlertCount > 99 ? "99+" : activeAlertCount}
        </span>
      ) : null}
    </Link>
  );
}
