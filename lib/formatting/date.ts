import type { Json } from "@/types/database.generated";

const DEFAULT_LOCALE = "es-PE";
const DEFAULT_TIMEZONE = "America/Lima";

function parseDate(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function zonedParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((entry) => entry.type === type);
    return part ? Number(part.value) : 0;
  };

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

function capitalizeEs(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Relative date for UI copy (es-PE). Returns null for invalid input.
 * Examples: "Hace 5 minutos", "Ayer", "Hace 4 días", "8 Jul".
 */
export function formatRelativeDate(
  value: Date | string | number,
  options?: {
    now?: Date;
    timeZone?: string;
    locale?: string;
  },
): string | null {
  const date = parseDate(value);
  if (!date) return null;

  const now = options?.now ?? new Date();
  const timeZone = options?.timeZone ?? DEFAULT_TIMEZONE;
  const locale = options?.locale ?? DEFAULT_LOCALE;

  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return null;

  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (diffMinutes < 1) {
    return capitalizeEs(rtf.format(0, "minute"));
  }
  if (diffMinutes < 60) {
    return capitalizeEs(rtf.format(-diffMinutes, "minute"));
  }
  if (diffHours < 24) {
    return capitalizeEs(rtf.format(-diffHours, "hour"));
  }

  const todayParts = zonedParts(now, timeZone);
  const dateParts = zonedParts(date, timeZone);
  const todayUtc = Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day);
  const dateUtc = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day);
  const dayDiff = Math.round((todayUtc - dateUtc) / 86_400_000);

  if (dayDiff === 1) {
    return "Ayer";
  }
  if (dayDiff > 1 && dayDiff < 7) {
    return capitalizeEs(rtf.format(-dayDiff, "day"));
  }

  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "numeric",
    month: "short",
  })
    .format(date)
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatDate(
  value: Date | string | number,
  locale = DEFAULT_LOCALE,
  timeZone = DEFAULT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(new Date(value));
}

export function formatDateTime(
  value: Date | string | number,
  locale = DEFAULT_LOCALE,
  timeZone = DEFAULT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

/** Safe JSON object walk — never throws on primitives/arrays/null. */
export function readJsonStringField(value: Json | null | undefined, key: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value[key];
  return typeof raw === "string" ? raw : null;
}
