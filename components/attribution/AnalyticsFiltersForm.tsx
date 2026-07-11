"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Select } from "@/components/ui";

export function AnalyticsFiltersForm({
  showPlatform = true,
  showDimension = false,
}: {
  showPlatform?: boolean;
  showDimension?: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const next = new URLSearchParams();
        for (const key of ["from", "to", "platform", "dimension"]) {
          const v = String(fd.get(key) ?? "").trim();
          if (v) next.set(key, v);
        }
        router.push(`?${next.toString()}`);
      }}
    >
      <label className="text-sm space-y-1">
        <span>Desde</span>
        <Input type="date" name="from" defaultValue={sp.get("from") ?? ""} />
      </label>
      <label className="text-sm space-y-1">
        <span>Hasta</span>
        <Input type="date" name="to" defaultValue={sp.get("to") ?? ""} />
      </label>
      {showPlatform && (
        <label className="text-sm space-y-1">
          <span>Plataforma</span>
          <Select name="platform" defaultValue={sp.get("platform") ?? ""}>
            <option value="">Todas</option>
            <option value="meta">Meta</option>
            <option value="tiktok">TikTok</option>
            <option value="other">Other / unattributed</option>
          </Select>
        </label>
      )}
      {showDimension && (
        <label className="text-sm space-y-1">
          <span>Dimensión</span>
          <Select name="dimension" defaultValue={sp.get("dimension") ?? "city"}>
            <option value="city">Ciudad</option>
            <option value="district">Distrito</option>
            <option value="carrier">Carrier</option>
            <option value="campaign">Campaña</option>
            <option value="ticket">Ticket</option>
            <option value="rejection_reason">Motivo</option>
          </Select>
        </label>
      )}
      <Button type="submit" variant="secondary">
        Aplicar
      </Button>
    </form>
  );
}
