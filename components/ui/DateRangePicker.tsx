"use client";

import { useRouter, usePathname } from "next/navigation";
import { Select } from "./Select";
import { dateRangeLabels, type DateRangePreset } from "@/lib/formatting/date-range";

const presets = Object.keys(dateRangeLabels) as DateRangePreset[];

export function DateRangePicker({ value = "30d" }: { value?: DateRangePreset }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Select
      aria-label="Rango de fechas"
      value={value}
      onChange={(event) => {
        const next = event.target.value as DateRangePreset;
        const params = new URLSearchParams({ range: next });
        router.push(`${pathname}?${params.toString()}`);
      }}
    >
      {presets.map((preset) => (
        <option key={preset} value={preset}>
          {dateRangeLabels[preset]}
        </option>
      ))}
    </Select>
  );
}
