"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function OrdersSearchBar({
  initialQuery = "",
  advancedOpen,
  onToggleAdvanced,
  advancedActive = false,
}: {
  initialQuery?: string;
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  advancedActive?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);

  function commit(nextQuery: string) {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = nextQuery.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    params.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1">
        <label htmlFor="orders-search" className="sr-only">
          Buscar pedidos
        </label>
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
          aria-hidden
        />
        <input
          id="orders-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(query);
            }
          }}
          onBlur={() => {
            if (query.trim() !== initialQuery.trim()) commit(query);
          }}
          placeholder="Buscar por pedido, cliente o fuente..."
          className={cn(
            "h-11 w-full rounded-[10px] border border-border bg-surface-elevated py-2 pl-10 pr-10 text-[13px] text-text-primary outline-none",
            "placeholder:text-text-secondary focus:border-brand-primary/50 focus:ring-2 focus:ring-ring/30",
          )}
          autoComplete="off"
          disabled={pending}
        />
        {query ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Limpiar búsqueda"
            onClick={() => {
              setQuery("");
              commit("");
            }}
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onToggleAdvanced}
        aria-expanded={advancedOpen}
        className={cn(
          "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] border px-3.5 text-[12.5px] font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          advancedOpen || advancedActive
            ? "border-brand-primary bg-brand-soft text-brand-primary"
            : "border-border bg-surface-elevated text-text-secondary hover:bg-muted hover:text-text-primary",
        )}
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        Filtros
      </button>
    </div>
  );
}
