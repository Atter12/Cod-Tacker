"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  approveSettlementBatch,
  confirmCollectedMatch,
  exportBatchResultsCsv,
  manualMatchSettlementItem,
  reopenSettlementBatch,
  resolveSettlementDiscrepancy,
} from "@/app/actions/reconciliation";
import { Button } from "@/components/ui";

export function BatchActionsPanel({
  agencySlug,
  storeSlug,
  batchId,
  approved,
  canManage,
}: {
  agencySlug: string;
  storeSlug: string;
  batchId: string;
  approved: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {canManage && !approved && (
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await approveSettlementBatch(agencySlug, storeSlug, batchId);
              if (r.error) alert(r.error);
              else router.refresh();
            })
          }
        >
          Aprobar / liquidar lote
        </Button>
      )}
      {canManage && approved && (
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await reopenSettlementBatch(agencySlug, storeSlug, batchId, false);
              if (r.error) alert(r.error);
              else router.refresh();
            })
          }
        >
          Reabrir lote
        </Button>
      )}
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await exportBatchResultsCsv(agencySlug, storeSlug, batchId);
            if (r.error || !r.csv) {
              alert(r.error ?? "Sin datos");
              return;
            }
            const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `settlement-${batchId}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          })
        }
      >
        Exportar CSV
      </Button>
    </div>
  );
}

export function ItemActionsPanel({
  agencySlug,
  storeSlug,
  itemId,
  matchStatus,
  canManage,
}: {
  agencySlug: string;
  storeSlug: string;
  itemId: string;
  matchStatus: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!canManage) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {(matchStatus === "matched" || matchStatus === "difference") && (
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await confirmCollectedMatch(agencySlug, storeSlug, itemId);
              if (r.error) alert(r.error);
              else router.refresh();
            })
          }
        >
          Confirmar cobrado
        </Button>
      )}
      {["unmatched", "difference", "duplicate", "disputed"].includes(matchStatus) && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const note = window.prompt("Nota de resolución (opcional)") ?? undefined;
              const r = await resolveSettlementDiscrepancy(agencySlug, storeSlug, itemId, {
                note,
                acceptDifference: true,
              });
              if (r.error) alert(r.error);
              else router.refresh();
            })
          }
        >
          Resolver
        </Button>
      )}
      {matchStatus === "unmatched" && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const orderId = window.prompt("UUID del pedido a emparejar manualmente");
              if (!orderId) return;
              const r = await manualMatchSettlementItem(
                agencySlug,
                storeSlug,
                itemId,
                orderId.trim(),
              );
              if (r.error) alert(r.error);
              else router.refresh();
            })
          }
        >
          Match manual
        </Button>
      )}
    </div>
  );
}
