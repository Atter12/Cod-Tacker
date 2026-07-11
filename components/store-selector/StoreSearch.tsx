"use client";

import { Search, X } from "lucide-react";

export function StoreSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative w-full">
      <label htmlFor="store-search" className="sr-only">
        Buscar por nombre de tienda
      </label>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#64748B]"
        aria-hidden
      />
      <input
        id="store-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar por nombre de tienda…"
        className="h-[42px] w-full rounded-[11px] border border-[rgba(76,139,170,0.28)] bg-[#0B1A2C] py-2 pl-10 pr-10 text-sm text-[#F8FAFC] outline-none placeholder:text-[#64748B] focus:border-[rgba(34,211,238,0.55)] focus:ring-2 focus:ring-[rgba(34,211,238,0.3)] sm:h-11"
        autoComplete="off"
      />
      {value ? (
        <button
          type="button"
          className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-[#94A3B8] hover:text-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(34,211,238,0.45)]"
          aria-label="Limpiar búsqueda"
          onClick={() => onChange("")}
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
