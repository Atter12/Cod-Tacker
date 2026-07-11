"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils/cn";

export function MetricSparkline({
  data,
  className,
  width = 65,
  height = 26,
}: {
  data: number[];
  className?: string;
  width?: number;
  height?: number;
}) {
  const chartData = data.map((value, index) => ({ index, value }));
  const hasSignal = data.some((value) => value !== 0);

  return (
    <div
      className={cn("shrink-0", className)}
      style={{ width, height }}
      aria-hidden
    >
      {hasSignal ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--brand-primary)"
              strokeWidth={1.8}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center">
          <div className="h-px w-full bg-border" />
        </div>
      )}
    </div>
  );
}
