import { type ReactNode } from "react";
export function Tooltip({ content, children, className }: { content: string; children: ReactNode; className?: string }) {
  return <span title={content} className={className ?? "inline-flex"}>{children}</span>;
}
