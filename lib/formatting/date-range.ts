export type DateRangePreset = "today" | "7d" | "30d" | "month";

export const dateRangeLabels: Record<DateRangePreset, string> = {
  today: "Hoy",
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  month: "Este mes",
};

const DEFAULT_STORE_TIMEZONE = "America/Lima";

export function parseDateRangePreset(value: string | null | undefined): DateRangePreset {
  if (value === "today" || value === "7d" || value === "30d" || value === "month") return value;
  return "30d";
}

function zonedYmd(date: Date, timeZone: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((entry) => entry.type === type);
    return part ? Number(part.value) : 0;
  };
  return { y: read("year"), m: read("month"), d: read("day") };
}

function zonedHms(
  date: Date,
  timeZone: string,
): { hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((entry) => entry.type === type);
    return part ? Number(part.value) : 0;
  };
  return { hour: read("hour"), minute: read("minute"), second: read("second") };
}

/**
 * UTC instant for a wall-clock date/time in `timeZone` (handles DST via iteration).
 */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  let utcMillis = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 4; i += 1) {
    const instant = new Date(utcMillis);
    const ymd = zonedYmd(instant, timeZone);
    const hms = zonedHms(instant, timeZone);
    const asZonedUtc = Date.UTC(
      ymd.y,
      ymd.m - 1,
      ymd.d,
      hms.hour,
      hms.minute,
      hms.second,
    );
    const desired = Date.UTC(year, month - 1, day, hour, minute, second);
    const delta = desired - asZonedUtc;
    if (delta === 0) break;
    utcMillis += delta;
  }
  return new Date(utcMillis);
}

/** Start of the calendar day containing `now` in `timeZone`. */
export function startOfZonedDay(now: Date, timeZone: string): Date {
  const tz = timeZone.trim() || DEFAULT_STORE_TIMEZONE;
  const { y, m, d } = zonedYmd(now, tz);
  return zonedWallTimeToUtc(y, m, d, 0, 0, 0, tz);
}

/**
 * Preset range bounds in the store timezone (not host/UTC midnight).
 * `to` is always `now`; `from` is the start of the preset window in `timeZone`.
 */
export function dateRangeToBounds(
  preset: DateRangePreset,
  now = new Date(),
  timeZone: string = DEFAULT_STORE_TIMEZONE,
): { from: Date; to: Date } {
  const tz = timeZone.trim() || DEFAULT_STORE_TIMEZONE;
  const to = new Date(now);
  const startToday = startOfZonedDay(now, tz);
  const { y, m } = zonedYmd(now, tz);

  switch (preset) {
    case "today":
      return { from: startToday, to };
    case "7d": {
      // Inclusive: today + previous 6 calendar days in store TZ.
      const probe = new Date(startToday.getTime() - 6 * 24 * 60 * 60 * 1000);
      const p = zonedYmd(probe, tz);
      return { from: zonedWallTimeToUtc(p.y, p.m, p.d, 0, 0, 0, tz), to };
    }
    case "month":
      return { from: zonedWallTimeToUtc(y, m, 1, 0, 0, 0, tz), to };
    case "30d":
    default: {
      const probe = new Date(startToday.getTime() - 29 * 24 * 60 * 60 * 1000);
      const p = zonedYmd(probe, tz);
      return { from: zonedWallTimeToUtc(p.y, p.m, p.d, 0, 0, 0, tz), to };
    }
  }
}
