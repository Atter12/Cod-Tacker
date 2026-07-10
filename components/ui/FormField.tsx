import { type ReactNode } from "react";

export function FormField({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: string }) {
  return <label className="block space-y-1.5 text-sm font-medium text-text-primary" htmlFor={htmlFor}>{label}{children}{hint ? <span className="block text-xs font-normal text-text-secondary">{hint}</span> : null}</label>;
}
