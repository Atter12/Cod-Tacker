import { type ReactNode } from "react";
export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) { return <div className="flex items-start justify-between gap-4"><div><h2 className="text-base font-semibold">{title}</h2>{description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}</div>{action}</div>; }
