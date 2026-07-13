"use client";

import { Check } from "lucide-react";
import {
  BRAND_COLOR_PALETTES,
  findMatchingPalette,
  isValidBrandHex,
} from "@/lib/branding/theme";
import { cn } from "@/lib/utils/cn";

export function BrandColorPicker({
  primaryColor,
  secondaryColor,
  disabled = false,
  onChange,
}: {
  primaryColor: string;
  secondaryColor: string;
  disabled?: boolean;
  onChange: (next: { primaryColor: string; secondaryColor: string }) => void;
}) {
  const matched = findMatchingPalette(primaryColor, secondaryColor);
  const customPrimary = isValidBrandHex(primaryColor) ? primaryColor : "#F47A32";
  const customSecondary = isValidBrandHex(secondaryColor) ? secondaryColor : "#F5661F";

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] font-medium text-text-primary">Paleta de color</p>
        <p className="mt-0.5 text-[12px] text-text-secondary">
          Elige una combinación. Se aplica al menú, botones y acentos de la agencia.
        </p>
      </div>

      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5"
        role="listbox"
        aria-label="Paletas de color"
      >
        {BRAND_COLOR_PALETTES.map((palette) => {
          const selected = matched?.id === palette.id;
          return (
            <button
              key={palette.id}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={disabled}
              onClick={() =>
                onChange({
                  primaryColor: palette.primary,
                  secondaryColor: palette.secondary,
                })
              }
              className={cn(
                "group relative flex flex-col items-start gap-2 rounded-[10px] border bg-surface-elevated p-2.5 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-brand-primary shadow-[0_0_0_1px_var(--brand-primary)]"
                  : "border-border hover:border-brand-primary/35 hover:bg-brand-softer/50",
                disabled && "pointer-events-none opacity-60",
              )}
            >
              <span className="flex w-full overflow-hidden rounded-md">
                <span className="h-8 flex-1" style={{ backgroundColor: palette.primary }} />
                <span className="h-8 w-1/3" style={{ backgroundColor: palette.secondary }} />
              </span>
              <span className="flex w-full items-center justify-between gap-1">
                <span className="truncate text-[11px] font-medium text-text-primary">
                  {palette.label}
                </span>
                {selected ? (
                  <Check className="size-3.5 shrink-0 text-brand-primary" aria-hidden />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-[10px] border border-border bg-muted/40 p-3">
        <p className="text-[12px] font-medium text-text-primary">Personalizado</p>
        <p className="mt-0.5 text-[11.5px] text-text-secondary">
          Usa el selector nativo si ninguna paleta encaja. No hace falta escribir el código.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-elevated px-2.5 py-2">
            <input
              type="color"
              aria-label="Color primario"
              disabled={disabled}
              value={customPrimary}
              onChange={(e) =>
                onChange({
                  primaryColor: e.target.value.toUpperCase(),
                  secondaryColor: customSecondary,
                })
              }
              className="size-9 cursor-pointer rounded-md border-0 bg-transparent p-0"
            />
            <span className="min-w-0">
              <span className="block text-[11px] font-medium text-text-primary">Primario</span>
              <span className="block truncate font-mono text-[10px] text-text-secondary">
                {customPrimary}
              </span>
            </span>
          </label>
          <label className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-elevated px-2.5 py-2">
            <input
              type="color"
              aria-label="Color secundario"
              disabled={disabled}
              value={customSecondary}
              onChange={(e) =>
                onChange({
                  primaryColor: customPrimary,
                  secondaryColor: e.target.value.toUpperCase(),
                })
              }
              className="size-9 cursor-pointer rounded-md border-0 bg-transparent p-0"
            />
            <span className="min-w-0">
              <span className="block text-[11px] font-medium text-text-primary">Secundario</span>
              <span className="block truncate font-mono text-[10px] text-text-secondary">
                {customSecondary}
              </span>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
