export type DateRangePreset = "today" | "7d" | "30d" | "month";

export const dateRangeLabels: Record<DateRangePreset, string> = {
  today: "Hoy",
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  month: "Este mes",
};

export function parseDateRangePreset(value: string | null | undefined): DateRangePreset {
  if (value === "today" || value === "7d" || value === "30d" || value === "month") return value;
  return "30d";
}

export function dateRangeToBounds(preset: DateRangePreset, now = new Date()): { from: Date; to: Date } {
  const to = new Date(now);
  const from = new Date(now);
  switch (preset) {
    case "today":
      from.setHours(0, 0, 0, 0);
      break;
    case "7d":
      from.setDate(from.getDate() - 7);
      break;
    case "month":
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      break;
    case "30d":
    default:
      from.setDate(from.getDate() - 30);
      break;
  }
  return { from, to };
}
