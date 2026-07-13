import type { CSSProperties } from "react";

/** Shared Recharts tooltip chrome — follows agency brand CSS vars on AppShell. */
export const chartTooltipContentStyle: CSSProperties = {
  background: "var(--surface-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  boxShadow: "var(--card-shadow)",
  fontSize: 12,
  color: "var(--text-primary)",
};

export const chartTooltipLabelStyle: CSSProperties = {
  color: "var(--text-secondary)",
  fontWeight: 600,
  marginBottom: 4,
};

export const chartTooltipItemStyle: CSSProperties = {
  color: "var(--brand-primary)",
};

/** Bar/area hover band. */
export const chartBarCursor = {
  fill: "var(--brand-soft)",
  opacity: 0.65,
};

/** Line/composed chart crosshair. */
export const chartLineCursor = {
  stroke: "var(--brand-primary)",
  strokeWidth: 1,
  strokeOpacity: 0.35,
};
