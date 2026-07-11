"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createMappingAction,
  deleteMappingAction,
  testNormalizeAction,
  updateMappingAction,
} from "@/app/actions/carriers";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SHIPMENT_STATUS_OPTIONS, labelShipmentStatus } from "@/lib/logistics/labels";
import type { CarrierStatusMappingRow } from "@/types/database";

export function CarrierMappingsPanel({
  carrierId,
  mappings,
  unmapped,
}: {
  carrierId: string;
  mappings: CarrierStatusMappingRow[];
  unmapped: Array<{
    id: string;
    external_status_code: string;
    external_status_label: string | null;
    occurrence_count: number;
    last_seen_at: string;
  }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [testCode, setTestCode] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [normalized, setNormalized] = useState("in_transit");
  const [isRto, setIsRto] = useState(false);
  const [isTerminal, setIsTerminal] = useState(false);
  const [priority, setPriority] = useState("0");

  function run(action: () => Promise<{ error?: string; id?: string; normalize?: { mapped: boolean; normalizedStatus: string; isRto: boolean; isTerminal: boolean } }>, ok?: string) {
    setError(null);
    setMessage(null);
    startTransition(() => {
      void (async () => {
        const result = await action();
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.normalize) {
          setTestResult(
            `${result.normalize.mapped ? "Mapeado" : "Sin mapeo"} → ${labelShipmentStatus(result.normalize.normalizedStatus)}` +
              `${result.normalize.isRto ? " · RTO" : ""}${result.normalize.isTerminal ? " · terminal" : ""}`,
          );
        } else if (ok) {
          setMessage(ok);
        }
        router.refresh();
      })();
    });
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="danger" title="Error">
          {error}
        </Alert>
      ) : null}
      {message ? (
        <Alert variant="success" title="Listo">
          {message}
        </Alert>
      ) : null}

      <section className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4">
        <h2 className="text-sm font-semibold">Nuevo mapeo</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Código externo" htmlFor="map-code">
            <Input id="map-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </FormField>
          <FormField label="Etiqueta" htmlFor="map-label">
            <Input id="map-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </FormField>
          <FormField label="Estado normalizado" htmlFor="map-norm">
            <Select id="map-norm" value={normalized} onChange={(e) => setNormalized(e.target.value)}>
              {SHIPMENT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Prioridad" htmlFor="map-prio">
            <Input
              id="map-prio"
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isRto} onChange={(e) => setIsRto(e.target.checked)} />
            Es RTO
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isTerminal}
              onChange={(e) => setIsTerminal(e.target.checked)}
            />
            Es terminal
          </label>
        </div>
        <Button
          size="sm"
          disabled={pending || !code.trim()}
          onClick={() =>
            run(
              () =>
                createMappingAction({
                  carrierId,
                  externalStatusCode: code,
                  externalStatusLabel: label || undefined,
                  normalizedStatus: normalized,
                  isRto,
                  isTerminal,
                  priority: Number(priority) || 0,
                }),
              "Mapeo creado.",
            )
          }
        >
          Crear mapeo
        </Button>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4">
        <h2 className="text-sm font-semibold">Probar normalización</h2>
        <div className="flex flex-wrap items-end gap-2">
          <FormField label="Código externo" htmlFor="test-code">
            <Input id="test-code" value={testCode} onChange={(e) => setTestCode(e.target.value)} />
          </FormField>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !testCode.trim()}
            onClick={() => run(() => testNormalizeAction(carrierId, testCode))}
          >
            Probar
          </Button>
        </div>
        {testResult ? <p className="text-sm text-text-secondary">{testResult}</p> : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Mapeos ({mappings.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-text-secondary">
              <tr>
                <th className="px-3 py-2 font-medium">Código</th>
                <th className="px-3 py-2 font-medium">Normalizado</th>
                <th className="px-3 py-2 font-medium">Flags</th>
                <th className="px-3 py-2 font-medium">Activo</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-text-secondary">
                    Sin mapeos configurados.
                  </td>
                </tr>
              ) : (
                mappings.map((m) => (
                  <tr key={m.id} className="border-b border-border">
                    <td className="px-3 py-2">
                      <div className="font-medium">{m.external_status_code}</div>
                      <div className="text-xs text-text-secondary">{m.external_status_label}</div>
                    </td>
                    <td className="px-3 py-2">{labelShipmentStatus(m.normalized_status)}</td>
                    <td className="px-3 py-2 text-xs">
                      prio {m.priority}
                      {m.is_rto ? " · RTO" : ""}
                      {m.is_terminal ? " · terminal" : ""}
                    </td>
                    <td className="px-3 py-2">{m.is_active ? "Sí" : "No"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () =>
                                updateMappingAction({
                                  carrierId,
                                  mappingId: m.id,
                                  isActive: !m.is_active,
                                  changeReason: m.is_active ? "deactivate" : "activate",
                                }),
                              m.is_active ? "Mapeo desactivado." : "Mapeo activado.",
                            )
                          }
                        >
                          {m.is_active ? "Desactivar" : "Activar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={pending}
                          onClick={() =>
                            run(() => deleteMappingAction(carrierId, m.id), "Mapeo eliminado.")
                          }
                        >
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Estados sin mapeo ({unmapped.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-text-secondary">
              <tr>
                <th className="px-3 py-2 font-medium">Código</th>
                <th className="px-3 py-2 font-medium">Etiqueta</th>
                <th className="px-3 py-2 font-medium">Ocurrencias</th>
                <th className="px-3 py-2 font-medium">Última vez</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {unmapped.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-text-secondary">
                    No hay códigos sin mapear.
                  </td>
                </tr>
              ) : (
                unmapped.map((u) => (
                  <tr key={u.id} className="border-b border-border">
                    <td className="px-3 py-2 font-mono text-xs">{u.external_status_code}</td>
                    <td className="px-3 py-2">{u.external_status_label ?? "—"}</td>
                    <td className="px-3 py-2">{u.occurrence_count}</td>
                    <td className="px-3 py-2">
                      {new Intl.DateTimeFormat("es-PE", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(u.last_seen_at))}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          setCode(u.external_status_code);
                          setLabel(u.external_status_label ?? "");
                        }}
                      >
                        Usar en formulario
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
