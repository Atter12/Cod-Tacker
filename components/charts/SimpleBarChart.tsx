"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  chartBarCursor,
  chartTooltipContentStyle,
  chartTooltipItemStyle,
  chartTooltipLabelStyle,
} from "@/lib/charts/recharts-tooltip";

export function SimpleBarChart({
  data,
  xKey,
  yKey,
  height = 280,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="var(--text-secondary)"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="var(--text-secondary)"
        />
        <Tooltip
          cursor={chartBarCursor}
          contentStyle={chartTooltipContentStyle}
          labelStyle={chartTooltipLabelStyle}
          itemStyle={chartTooltipItemStyle}
        />
        <Bar dataKey={yKey} fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
