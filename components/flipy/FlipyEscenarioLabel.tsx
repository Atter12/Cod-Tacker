"use client";

import type { ReactNode } from "react";
import type { FlipyEscenarioPago } from "@/lib/integrations/flipy/resolve-payment";
import { labelFlipyCodChannel } from "@/lib/integrations/flipy/labels";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils/cn";

function flipyEscenarioCode(value: FlipyEscenarioPago): string | null {
  if (value === "GRATIS") return null;
  if (value === "1A" || value === "1C" || value === "1E" || value === "1D") return value;
  return value;
}

function defaultEscenarioLabel(value: FlipyEscenarioPago): string {
  const channel = labelFlipyCodChannel(value);
  if (channel) return channel;
  if (value === "1A") return "Prepago";
  if (value === "GRATIS") return "Gratis";
  return value;
}

type Props = {
  escenario: FlipyEscenarioPago;
  children?: ReactNode;
  className?: string;
  /** Show native title tooltip with Flipy code (default: true). */
  showCodeTooltip?: boolean;
};

export function FlipyEscenarioLabel({
  escenario,
  children,
  className,
  showCodeTooltip = true,
}: Props) {
  const label = children ?? defaultEscenarioLabel(escenario);
  const code = flipyEscenarioCode(escenario);

  if (!showCodeTooltip || !code) {
    return <span className={className}>{label}</span>;
  }

  return (
    <Tooltip content={`Código Flipy: ${code}`} className={cn("cursor-help", className)}>
      {label}
    </Tooltip>
  );
}
