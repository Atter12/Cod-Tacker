"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  approveSettlementBatch,
  confirmCollectedMatch,
  exportBatchResultsCsv,
  manualMatchSettlementItem,
  reopenSettlementBatch,
  resolveSettlementDiscrepancy,
} from "@/app/actions/reconciliation";
import { Button, Dialog, Toast } from "@/components/ui";
import {
  gateConfirmCollectedRemesa,
  resolveShopifyExpectedAmount,
} from "@/lib/reconciliation/collected-gate";

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
  orderId = null,
  collectedAppliedAt = null,
  settledAmount = 0,
  feeAmount = 0,
  itemCurrency = null,
  linkedExpectedCodAmount = null,
  linkedTotalAmount = null,
  linkedCurrencyCode = null,
  linkedCollectedCodAmount = null,
}: {
  agencySlug: string;
  storeSlug: string;
  itemId: string;
  matchStatus: string;
  canManage: boolean;
  orderId?: string | null;
  collectedAppliedAt?: string | null;
  settledAmount?: number;
  feeAmount?: number;
  itemCurrency?: string | null;
  linkedExpectedCodAmount?: number | null;
  linkedTotalAmount?: number | null;
  linkedCurrencyCode?: string | null;
  linkedCollectedCodAmount?: number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "danger" | "info";
  } | null>(null);

  if (!canManage) return null;

  const alreadyCollected = Boolean(collectedAppliedAt);
  const hasLinkedOrder = Boolean(orderId);
  const canConfirmCollected =
    hasLinkedOrder &&
    (matchStatus === "matched" || matchStatus === "difference" || matchStatus === "resolved");

  const remesaAmount = Math.round((settledAmount + feeAmount) * 100) / 100;
  const amountGate = gateConfirmCollectedRemesa({
    remesaAmount,
    itemCurrency,
    order: {
      expectedCodAmount: linkedExpectedCodAmount,
      totalAmount: linkedTotalAmount,
      currencyCode: linkedCurrencyCode,
      collectedCodAmount: linkedCollectedCodAmount,
    },
  });
  const shopifyExpected = amountGate.ok
    ? amountGate.shopifyExpected
    : resolveShopifyExpectedAmount({
        expectedCodAmount: linkedExpectedCodAmount,
        totalAmount: linkedTotalAmount,
        currencyCode: linkedCurrencyCode,
      });

  const confirmLabel =
    alreadyCollected
      ? "Cobrado"
      : amountGate.ok && amountGate.mode === "partial"
        ? "Confirmar cobro parcial"
        : "Confirmar cobrado";

  return (
    <div className="flex flex-wrap gap-2">
      {canConfirmCollected && (
        <>
          <Button
            type="button"
            size="sm"
            variant={alreadyCollected ? "outline" : "primary"}
            disabled={pending || alreadyCollected}
            onClick={() => setConfirmOpen(true)}
          >
            {confirmLabel}
          </Button>
          <Dialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title={
              amountGate.ok && amountGate.mode === "partial"
                ? "Confirmar cobro parcial"
                : "Confirmar cobrado"
            }
          >
            <div className="space-y-3 text-sm text-text-secondary">
              <p>
                Aplica la remesa de esta fila al <strong className="text-text-primary">pedido</strong>.
                Si no cubre Shopify, queda cobro parcial y puedes anexar otra remesa después.
                No se aceptan montos por encima de Shopify.
              </p>
              <ul className="space-y-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                <li>
                  Remesa fila (neto+fee):{" "}
                  <strong className="text-text-primary">{remesaAmount}</strong>
                  {itemCurrency ? ` ${itemCurrency}` : ""}
                </li>
                <li>
                  Ya cobrado:{" "}
                  <strong className="text-text-primary">
                    {linkedCollectedCodAmount != null ? linkedCollectedCodAmount : 0}
                  </strong>
                </li>
                <li>
                  Shopify (COD/total):{" "}
                  <strong className="text-text-primary">
                    {shopifyExpected != null ? shopifyExpected : "—"}
                  </strong>
                  {linkedCurrencyCode ? ` ${linkedCurrencyCode}` : ""}
                </li>
                {amountGate.ok ? (
                  <>
                    <li>
                      Nuevo cobrado:{" "}
                      <strong className="text-text-primary">{amountGate.newCollected}</strong>
                    </li>
                    <li>
                      Saldo restante:{" "}
                      <strong className="text-text-primary">{amountGate.remainingAfter}</strong>
                      {amountGate.mode === "partial" ? " · parcial" : " · cierra cobro"}
                    </li>
                  </>
                ) : null}
              </ul>
              {!amountGate.ok ? (
                <p className="text-xs text-danger">{amountGate.error}</p>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => setConfirmOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pending || !amountGate.ok}
                onClick={() =>
                  start(async () => {
                    const r = await confirmCollectedMatch(agencySlug, storeSlug, itemId);
                    if (r.error) {
                      setConfirmOpen(false);
                      setToast({ message: r.error, variant: "danger" });
                      return;
                    }
                    setConfirmOpen(false);
                    setToast({
                      message:
                        amountGate.ok && amountGate.mode === "partial"
                          ? "Cobro parcial aplicado. Puedes anexar otra remesa al mismo pedido."
                          : "Cobro confirmado en el pedido. Revisa el detalle del pedido.",
                      variant: "success",
                    });
                    router.refresh();
                  })
                }
              >
                {amountGate.ok && amountGate.mode === "partial"
                  ? "Confirmar cobro parcial"
                  : "Confirmar cobrado"}
              </Button>
            </div>
          </Dialog>
        </>
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
              if (r.error) {
                setToast({ message: r.error, variant: "danger" });
                return;
              }
              setToast({ message: "Discrepancia resuelta.", variant: "success" });
              router.refresh();
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
              if (r.error) {
                setToast({ message: r.error, variant: "danger" });
                return;
              }
              setToast({ message: "Match manual aplicado.", variant: "success" });
              router.refresh();
            })
          }
        >
          Match manual
        </Button>
      )}
      {toast ? (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
