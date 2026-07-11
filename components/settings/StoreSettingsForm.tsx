"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateStoreSettings } from "@/app/actions/settings";
import { Button, Checkbox, FormField, Input, Select } from "@/components/ui";
import {
  ATTRIBUTION_MODELS,
  type StoreSettings,
  type AttributionModelValue,
} from "@/lib/settings/store-settings";

const MODEL_LABELS: Record<AttributionModelValue, string> = {
  utm_last_touch: "UTM último toque",
  last_click: "Último clic",
  first_click: "Primer clic",
  linear: "Lineal",
  position_based: "Basado en posición",
  time_decay: "Decaimiento temporal",
  manual: "Manual",
  unattributed: "Sin atribuir",
};

export function StoreSettingsForm({
  agencySlug,
  storeSlug,
  canEdit,
  initial,
}: {
  agencySlug: string;
  storeSlug: string;
  canEdit: boolean;
  initial: {
    name: string;
    countryCode: string;
    currencyCode: string;
    timezone: string;
    attributionModel: AttributionModelValue;
    attributionWindowDays: number;
    settings: StoreSettings;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [form, setForm] = useState(initial);

  function save() {
    if (!canEdit) return;
    setError(null);
    setOk(false);
    start(async () => {
      const r = await updateStoreSettings(agencySlug, storeSlug, form);
      if (r.error) setError(r.error);
      else {
        setOk(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-700">Configuración guardada.</p> : null}

      <fieldset disabled={!canEdit || pending} className="space-y-4">
        <h3 className="text-sm font-semibold">General</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nombre" htmlFor="store-name">
            <Input
              id="store-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </FormField>
          <FormField label="País (ISO)" htmlFor="country">
            <Input
              id="country"
              maxLength={2}
              value={form.countryCode}
              onChange={(e) => setForm((f) => ({ ...f, countryCode: e.target.value }))}
            />
          </FormField>
          <FormField label="Moneda" htmlFor="currency">
            <Input
              id="currency"
              maxLength={3}
              value={form.currencyCode}
              onChange={(e) => setForm((f) => ({ ...f, currencyCode: e.target.value }))}
            />
          </FormField>
          <FormField label="Zona horaria" htmlFor="tz">
            <Input
              id="tz"
              value={form.timezone}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
            />
          </FormField>
        </div>
      </fieldset>

      <fieldset disabled={!canEdit || pending} className="space-y-4">
        <h3 className="text-sm font-semibold">Atribución</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Modelo" htmlFor="attr-model">
            <Select
              id="attr-model"
              value={form.attributionModel}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  attributionModel: e.target.value as AttributionModelValue,
                }))
              }
            >
              {ATTRIBUTION_MODELS.map((m) => (
                <option key={m} value={m}>
                  {MODEL_LABELS[m]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Ventana (días)" htmlFor="attr-window">
            <Input
              id="attr-window"
              type="number"
              min={1}
              max={90}
              value={form.attributionWindowDays}
              onChange={(e) =>
                setForm((f) => ({ ...f, attributionWindowDays: Number(e.target.value) || 1 }))
              }
            />
          </FormField>
        </div>
      </fieldset>

      <fieldset disabled={!canEdit || pending} className="space-y-4">
        <h3 className="text-sm font-semibold">Umbrales RTO</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Alto riesgo %" htmlFor="rto-high">
            <Input
              id="rto-high"
              type="number"
              value={form.settings.rto.highRiskThresholdPct}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  settings: {
                    ...f.settings,
                    rto: { ...f.settings.rto, highRiskThresholdPct: Number(e.target.value) },
                  },
                }))
              }
            />
          </FormField>
          <FormField label="Crítico %" htmlFor="rto-crit">
            <Input
              id="rto-crit"
              type="number"
              value={form.settings.rto.criticalThresholdPct}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  settings: {
                    ...f.settings,
                    rto: { ...f.settings.rto, criticalThresholdPct: Number(e.target.value) },
                  },
                }))
              }
            />
          </FormField>
          <FormField label="Muestra mínima" htmlFor="rto-min">
            <Input
              id="rto-min"
              type="number"
              value={form.settings.rto.minSampleSize}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  settings: {
                    ...f.settings,
                    rto: { ...f.settings.rto, minSampleSize: Number(e.target.value) },
                  },
                }))
              }
            />
          </FormField>
        </div>
      </fieldset>

      <fieldset disabled={!canEdit || pending} className="space-y-4">
        <h3 className="text-sm font-semibold">Costos / COD por defecto</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Costo envío" htmlFor="cod-ship">
            <Input
              id="cod-ship"
              type="number"
              value={form.settings.cod.defaultShippingCost}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  settings: {
                    ...f.settings,
                    cod: { ...f.settings.cod, defaultShippingCost: Number(e.target.value) },
                  },
                }))
              }
            />
          </FormField>
          <FormField label="Fee COD %" htmlFor="cod-fee">
            <Input
              id="cod-fee"
              type="number"
              value={form.settings.cod.defaultCodFeePct}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  settings: {
                    ...f.settings,
                    cod: { ...f.settings.cod, defaultCodFeePct: Number(e.target.value) },
                  },
                }))
              }
            />
          </FormField>
          <FormField label="Costo devolución" htmlFor="cod-ret">
            <Input
              id="cod-ret"
              type="number"
              value={form.settings.cod.defaultReturnCost}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  settings: {
                    ...f.settings,
                    cod: { ...f.settings.cod, defaultReturnCost: Number(e.target.value) },
                  },
                }))
              }
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.settings.cod.assumeCashOnDelivery}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  settings: {
                    ...f.settings,
                    cod: { ...f.settings.cod, assumeCashOnDelivery: e.target.checked },
                  },
                }))
              }
            />
            Asumir contraentrega (COD)
          </label>
        </div>
      </fieldset>

      <fieldset disabled={!canEdit || pending} className="space-y-4">
        <h3 className="text-sm font-semibold">Preferencias de alertas</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.settings.alerts.emailDigest}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  settings: {
                    ...f.settings,
                    alerts: { ...f.settings.alerts, emailDigest: e.target.checked },
                  },
                }))
              }
            />
            Resumen por correo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.settings.alerts.criticalOnly}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  settings: {
                    ...f.settings,
                    alerts: { ...f.settings.alerts, criticalOnly: e.target.checked },
                  },
                }))
              }
            />
            Solo alertas críticas
          </label>
          <FormField label="Silencio por defecto (h)" htmlFor="silence">
            <Input
              id="silence"
              type="number"
              value={form.settings.alerts.silenceHoursDefault}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  settings: {
                    ...f.settings,
                    alerts: {
                      ...f.settings.alerts,
                      silenceHoursDefault: Number(e.target.value) || 1,
                    },
                  },
                }))
              }
            />
          </FormField>
        </div>
      </fieldset>

      <fieldset disabled={!canEdit || pending} className="space-y-4">
        <h3 className="text-sm font-semibold">Demostración</h3>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.settings.demo.enabled}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                settings: {
                  ...f.settings,
                  demo: { ...f.settings.demo, enabled: e.target.checked },
                },
              }))
            }
          />
          Marcar tienda en modo demostración
        </label>
      </fieldset>

      {canEdit ? (
        <Button disabled={pending} onClick={save}>
          {pending ? "Guardando…" : "Guardar configuración"}
        </Button>
      ) : (
        <p className="text-sm text-text-secondary">Solo lectura: no tienes permiso para editar.</p>
      )}
    </div>
  );
}
