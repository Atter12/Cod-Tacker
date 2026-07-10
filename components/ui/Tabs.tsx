"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
export interface Tab { value: string; label: string; content: React.ReactNode; }
export function Tabs({ tabs, defaultValue, className }: { tabs: Tab[]; defaultValue?: string; className?: string }) {
  const [active, setActive] = useState(defaultValue ?? tabs[0]?.value ?? "");
  const activeTab = tabs.find((tab) => tab.value === active);
  return <div className={className}><div role="tablist" className="flex gap-1 border-b border-border">{tabs.map((tab) => <button key={tab.value} role="tab" aria-selected={active === tab.value} className={cn("border-b-2 px-3 py-2 text-sm font-medium", active === tab.value ? "border-brand-primary text-brand-primary" : "border-transparent text-text-secondary hover:text-text-primary")} onClick={() => setActive(tab.value)}>{tab.label}</button>)}</div><div role="tabpanel" className="pt-4">{activeTab?.content}</div></div>;
}
