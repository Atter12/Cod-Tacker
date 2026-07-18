"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface Tab {
  value: string;
  label: string;
  content: ReactNode;
}

export function Tabs({
  tabs,
  defaultValue,
  className,
}: {
  tabs: Tab[];
  defaultValue?: string;
  className?: string;
}) {
  const [active, setActive] = useState(defaultValue ?? tabs[0]?.value ?? "");
  const activeTab = tabs.find((tab) => tab.value === active);

  return (
    <div className={cn("min-w-0 w-full", className)}>
      <div className="border-b border-border">
        <div
          role="tablist"
          className="flex gap-1 overflow-x-auto overscroll-x-contain pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active === tab.value}
              className={cn(
                "shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active === tab.value
                  ? "border-brand-primary text-brand-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary",
              )}
              onClick={() => setActive(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" className="min-w-0 overflow-x-auto pt-4">
        {activeTab?.content}
      </div>
    </div>
  );
}
