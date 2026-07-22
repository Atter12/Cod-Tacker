"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  confirmSettlementCsvImport,
  previewSettlementCsv,
} from "@/app/actions/reconciliation";
import { Button, Input, Select } from "@/components/ui";
import { routes } from "@/config/routes";
import { CARRIER_CSV_PRESETS } from "@/lib/reconciliation/presets";
import type { ValidatedSettlementRow } from "@/lib/reconciliation/validate-rows";
import { generateMockSettlementCsv } from "@/lib/reconciliation/mock-csv";

type Step = "upload" | "preview" | "done";

export function ImportWizard({
  agencySlug,
  storeSlug,
}: {
  agencySlug: string;
  storeSlug: string;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [presetId, setPresetId] = useState(CARRIER_CSV_PRESETS[0]!.id);
  const [fileName, setFileName] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ValidatedSettlementRow[]>([]);
  const [errors, setErrors] = useState<{ sourceRowNumber: number; code: string; message: string }[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const hardErrors = errors.filter((e) => e.code !== "DUPLICATE_IN_FILE");
  const errorCount = hardErrors.length;
  const validCount = rows.length;
  const softDupes = errors.filter((e) => e.code === "DUPLICATE_IN_FILE").length;
  const canConfirm = validCount > 0 && errorCount === 0;
  const summary = { validCount, errorCount, softDupes, canConfirm };

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-3 text-sm text-text-secondary">
        <li className={step === "upload" ? "text-text-primary font-medium" : ""}>1. Subir CSV</li>
        <li className={step === "preview" ? "text-text-primary font-medium" : ""}>2. Preview / validar</li>
        <li className={step === "done" ? "text-text-primary font-medium" : ""}>3. Confirmar</li>
      </ol>

      {step === "upload" && (
        <div className="space-y-4 max-w-xl">
          <label className="block space-y-1 text-sm">
            <span>Preset de carrier</span>
            <Select
              value={presetId}
              onChange={(e) => setPresetId(e.target.value)}
            >
              {CARRIER_CSV_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>Archivo CSV (máx. 2 MiB)</span>
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                setFileName(f?.name ?? "");
              }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!file || pending}
              onClick={() =>
                start(async () => {
                  if (!file) return;
                  setMessage(null);
                  const fd = new FormData();
                  fd.set("file", file);
                  fd.set("presetId", presetId);
                  const r = await previewSettlementCsv(agencySlug, storeSlug, fd);
                  if (r.error || !r.preview) {
                    setMessage(r.error ?? "Sin preview");
                    return;
                  }
                  setRows(r.preview.rows);
                  setErrors(r.preview.errors);
                  setStep("preview");
                })
              }
            >
              Validar y previsualizar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const csv = generateMockSettlementCsv();
                const blob = new Blob([csv], { type: "text/csv" });
                const f = new File([blob], "sample-settlement.csv", { type: "text/csv" });
                setFile(f);
                setFileName(f.name);
                setPresetId("generic_cod");
              }}
            >
              Cargar CSV de muestra (pruebas)
            </Button>
          </div>
          {message && <p className="text-sm text-danger">{message}</p>}
          <p className="text-xs text-text-secondary">
            Sube el export de liquidación de tu courier. CODTracked no se conecta al portal del
            courier: el CSV lo exportas tú. Alternativa auto: Ecart Pay en Conciliación (solo COD
            Envia).
          </p>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <p className="text-sm">
            Archivo: <strong>{fileName || "—"}</strong> · Filas válidas: {summary.validCount} ·
            Errores: {summary.errorCount}
            {summary.softDupes > 0 ? ` · Duplicados en archivo: ${summary.softDupes}` : ""}
          </p>
          {hardErrors.length > 0 && (
            <ul className="text-sm text-danger space-y-1 max-h-40 overflow-auto border border-border rounded-md p-3">
              {hardErrors.slice(0, 50).map((e, i) => (
                <li key={`${e.sourceRowNumber}-${i}`}>
                  Fila {e.sourceRowNumber}: [{e.code}] {e.message}
                </li>
              ))}
            </ul>
          )}
          <div className="overflow-auto border border-border rounded-md max-h-80">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-2 py-1 text-left">#</th>
                  <th className="px-2 py-1 text-left">Tracking</th>
                  <th className="px-2 py-1 text-left">Pedido</th>
                  <th className="px-2 py-1 text-right">Bruto</th>
                  <th className="px-2 py-1 text-right">Fee</th>
                  <th className="px-2 py-1 text-left">Moneda</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((r) => (
                  <tr key={r.sourceRowNumber} className="border-t border-border">
                    <td className="px-2 py-1">{r.sourceRowNumber}</td>
                    <td className="px-2 py-1">{r.trackingNumber ?? "—"}</td>
                    <td className="px-2 py-1">{r.orderNumber ?? "—"}</td>
                    <td className="px-2 py-1 text-right">{r.grossAmount}</td>
                    <td className="px-2 py-1 text-right">{r.feeAmount}</td>
                    <td className="px-2 py-1">{r.currencyCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep("upload")}>
              Volver
            </Button>
            <Button
              type="button"
              disabled={!summary.canConfirm || pending}
              onClick={() =>
                start(async () => {
                  setMessage(null);
                  const r = await confirmSettlementCsvImport(agencySlug, storeSlug, {
                    rows,
                    presetId,
                    sourceFileName: fileName,
                    reference: fileName,
                  });
                  if (r.error) {
                    setMessage(r.error);
                    return;
                  }
                  setJobId(r.jobId ?? null);
                  setStep("done");
                })
              }
            >
              Confirmar importación
            </Button>
          </div>
          {!summary.canConfirm && (
            <p className="text-sm text-warning">
              Corrige los errores de validación antes de confirmar (o elimina filas inválidas del CSV).
            </p>
          )}
          {message && <p className="text-sm text-danger">{message}</p>}
        </div>
      )}

      {step === "done" && (
        <div className="space-y-3">
          <p className="text-sm">
            Importación encolada. Job: <code>{jobId ?? "—"}</code>
          </p>
          <p className="text-sm text-text-secondary">
            El worker se dispara al confirmar. Si el lote no aparece, revisa jobs en admin o{" "}
            <code>npm run jobs:process</code>.
          </p>
          <Link
            className="text-sm text-brand-primary underline"
            href={routes.store.reconciliation(agencySlug, storeSlug)}
          >
            Volver a conciliación
          </Link>
        </div>
      )}
    </div>
  );
}
