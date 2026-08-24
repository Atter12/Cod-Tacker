import Link from "next/link";
import { routes } from "@/config/routes";
import { buildFlipyOperationWebUrl } from "@/lib/integrations/flipy/embed-urls";
import { labelShipmentStatus } from "@/lib/logistics/labels";
import { StatusBadge } from "@/components/ui";

type ShipmentRow = {
  id: string;
  tracking_number: string | null;
  tracking_url: string | null;
  status: string;
  external_shipment_id: string | null;
  is_terminal: boolean;
  is_rto: boolean;
};

type Props = {
  agencySlug: string;
  storeSlug: string;
  appOrigin: string;
  flipyEnvioId?: string | null;
  flipyTrackingUrl?: string | null;
  shipments: ShipmentRow[];
};

export function FlipyOrderLogisticsPanel({
  agencySlug,
  storeSlug,
  appOrigin,
  flipyEnvioId = null,
  flipyTrackingUrl = null,
  shipments,
}: Props) {
  const flipyShipments = flipyEnvioId
    ? shipments.filter((row) => row.external_shipment_id === flipyEnvioId)
    : [];
  const flipyLink = buildFlipyOperationWebUrl({
    appOrigin,
    envioId: flipyEnvioId,
  });

  if (!flipyEnvioId && flipyShipments.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-4 text-sm">
      <h3 className="font-semibold">Flipy</h3>
      {flipyEnvioId ? (
        <p className="mt-1 text-[12.5px] text-text-secondary">
          Envío partner: <span className="font-mono">{flipyEnvioId}</span>
        </p>
      ) : null}
      {flipyTrackingUrl ? (
        <p className="mt-2 break-all text-[12px]">
          <a href={flipyTrackingUrl} target="_blank" rel="noreferrer" className="text-brand-primary underline">
            Rastreo cliente: {flipyTrackingUrl}
          </a>
        </p>
      ) : null}
      {flipyLink ? (
        <p className="mt-2">
          <a href={flipyLink} target="_blank" rel="noreferrer" className="text-brand-primary underline">
            Abrir en Flipy (pujas / operación)
          </a>
        </p>
      ) : null}
      {flipyShipments.length ? (
        <ul className="mt-3 space-y-2">
          {flipyShipments.map((row) => (
            <li key={row.id} className="rounded-md border border-border/80 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[12px]">{row.tracking_number ?? row.id.slice(0, 8)}</span>
                <StatusBadge status={row.status} label={labelShipmentStatus(row.status)} />
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
                <Link
                  href={routes.store.shipmentDetail(agencySlug, storeSlug, row.id)}
                  className="text-brand-primary underline"
                >
                  Ver en logística CT
                </Link>
                {row.tracking_url ? (
                  <a href={row.tracking_url} target="_blank" rel="noreferrer" className="text-brand-primary underline">
                    Tracking carrier
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
