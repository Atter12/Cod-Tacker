"use client";

import { useState } from "react";
import { Select } from "./Select";
export type DateRangePreset = "today" | "7d" | "30d" | "month" | "custom";
const labels: Record<DateRangePreset, string> = { today: "Hoy", "7d": "Últimos 7 días", "30d": "Últimos 30 días", month: "Este mes", custom: "Personalizado" };
export function DateRangePicker({ value = "30d", onChange }: { value?: DateRangePreset; onChange?: (value: DateRangePreset) => void }) {
  const [selected, setSelected] = useState(value);
  return <Select aria-label="Rango de fechas" value={selected} onChange={(event) => { const next = event.target.value as DateRangePreset; setSelected(next); onChange?.(next); }}>{(Object.keys(labels) as DateRangePreset[]).map((preset) => <option key={preset} value={preset}>{labels[preset]}</option>)}</Select>;
}
