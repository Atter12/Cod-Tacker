"use client";

type Props = {
  apiBaseUrl: string;
  flipyTiendaId?: string | null;
};

export function FlipyConciliacionExportPanel({ apiBaseUrl, flipyTiendaId = null }: Props) {
  const tiendaId = flipyTiendaId?.trim();
  if (!tiendaId) return null;

  const exportUrl = `${apiBaseUrl.replace(/\/$/, "")}/api/partner/tiendas/${encodeURIComponent(tiendaId)}/conciliacion/export?format=settlement`;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface-elevated p-4">
      <h2 className="text-sm font-semibold">Conciliación CSV (F4)</h2>
      <p className="text-[12.5px] text-text-secondary">
        Exporta entregas Flipy en formato compatible con Conciliación COD-tracked (preset{" "}
        <span className="font-mono">flipy_cod</span>). Descarga con partner key server-side.
      </p>
      <p className="break-all font-mono text-[11px] text-text-secondary">{exportUrl}</p>
      <p className="text-[11px] text-text-secondary">
        Query opcional: <span className="font-mono">from=2026-07-01&amp;to=2026-07-31</span>
      </p>
    </div>
  );
}
