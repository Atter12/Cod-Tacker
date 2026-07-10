import { type ReactNode } from "react";
import { Button } from "./Button";
export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description: string; action?: { label: string; onClick: () => void } }) {
  return <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-14 text-center">{icon && <div className="mb-4 text-text-secondary">{icon}</div>}<h3 className="font-semibold">{title}</h3><p className="mt-1 max-w-sm text-sm text-text-secondary">{description}</p>{action && <Button className="mt-5" onClick={action.onClick}>{action.label}</Button>}</div>;
}
