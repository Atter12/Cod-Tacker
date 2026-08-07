"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
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

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-b border-border pb-6 last:border-b-0 last:pb-0">
      <h3 className="text-[14px] font-semibold text-text-primary">{title}</h3>
      {children}
    </section>
  );
}

export function StoreSettingsForm({
  agencySlug,
  storeSlug,
  canEdit,
  initial,
  campaignOptions = [],
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
  campaignOptions?: Array<{ id: string; name: string; platform: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [form, setForm] = useState(initial);
  const [aliasDraft, setAliasDraft] = useState({ utm: "", campaignId: "" });

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

  const disabled = !canEdit || pending;
  const controlClass = "h-10";

  return (
    <div className="space-y-0">
      {error ? (
        <p
          className="mb-5 rounded-[10px] border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {ok ? (
        <p
          className="mb-5 rounded-[10px] border border-success/30 bg-success-soft px-3 py-2 text-sm text-success"
          role="status"
        >
          Configuración guardada.
        </p>
      ) : null}

      <fieldset disabled={disabled} className="space-y-6">
        <SettingsSection title="General">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nombre" htmlFor="store-name">
              <Input
                id="store-name"
                className={controlClass}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </FormField>
            <FormField label="País (ISO)" htmlFor="country">
              <Input
                id="country"
                className={controlClass}
                maxLength={2}
                value={form.countryCode}
                onChange={(e) => setForm((f) => ({ ...f, countryCode: e.target.value }))}
              />
            </FormField>
            <FormField label="Moneda" htmlFor="currency">
              <Input
                id="currency"
                className={controlClass}
                maxLength={3}
                value={form.currencyCode}
                onChange={(e) => setForm((f) => ({ ...f, currencyCode: e.target.value }))}
              />
            </FormField>
            <FormField label="Zona horaria" htmlFor="tz">
              <Input
                id="tz"
                className={controlClass}
                value={form.timezone}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              />
            </FormField>
          </div>
        </SettingsSection>

        <SettingsSection title="Atribución">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Modelo" htmlFor="attr-model">
              <Select
                id="attr-model"
                className={controlClass}
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
                className={controlClass}
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

          <div className="space-y-3 rounded-[10px] border border-border p-4">
            <div>
              <p className="text-sm font-medium text-text-primary">Aliases UTM → campaña</p>
              <p className="mt-1 text-xs text-text-secondary">
                Cuando el utm_campaign del pedido no coincide con el nombre/id de Meta o TikTok,
                mapea el texto UTM a una campaña real. Se aplica a pedidos pendientes al guardar.
              </p>
            </div>

            {campaignOptions.length === 0 ? (
              <p className="text-xs text-text-secondary">
                Aún no hay campañas sincronizadas. Haz Sync de Meta/TikTok Ads primero.
              </p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <FormField label="utm_campaign" htmlFor="utm-alias-key">
                    <Input
                      id="utm-alias-key"
                      className={controlClass}
                      placeholder="promo_julio"
                      value={aliasDraft.utm}
                      onChange={(e) => setAliasDraft((d) => ({ ...d, utm: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Campaña" htmlFor="utm-alias-campaign">
                    <Select
                      id="utm-alias-campaign"
                      className={controlClass}
                      value={aliasDraft.campaignId}
                      onChange={(e) => setAliasDraft((d) => ({ ...d, campaignId: e.target.value }))}
                    >
                      <option value="">Selecciona…</option>
                      {campaignOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.platform})
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={disabled || !aliasDraft.utm.trim() || !aliasDraft.campaignId}
                      onClick={() => {
                        const utm = aliasDraft.utm.trim();
                        const campaignId = aliasDraft.campaignId;
                        if (!utm || !campaignId) return;
                        setForm((f) => {
                          const rest = f.settings.attribution.utmCampaignAliases.filter(
                            (a) => a.utm.trim().toLowerCase() !== utm.toLowerCase(),
                          );
                          return {
                            ...f,
                            settings: {
                              ...f.settings,
                              attribution: {
                                ...f.settings.attribution,
                                utmCampaignAliases: [...rest, { utm, campaignId }],
                              },
                            },
                          };
                        });
                        setAliasDraft({ utm: "", campaignId: "" });
                      }}
                    >
                      Añadir
                    </Button>
                  </div>
                </div>

                {form.settings.attribution.utmCampaignAliases.length > 0 ? (
                  <ul className="space-y-2">
                    {form.settings.attribution.utmCampaignAliases.map((alias) => {
                      const campaign = campaignOptions.find((c) => c.id === alias.campaignId);
                      return (
                        <li
                          key={`${alias.utm}:${alias.campaignId}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm"
                        >
                          <span>
                            <span className="font-medium">{alias.utm}</span>
                            <span className="text-text-secondary"> → </span>
                            <span>{campaign?.name ?? alias.campaignId.slice(0, 8)}</span>
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={disabled}
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                settings: {
                                  ...f.settings,
                                  attribution: {
                                    ...f.settings.attribution,
                                    utmCampaignAliases:
                                      f.settings.attribution.utmCampaignAliases.filter(
                                        (a) =>
                                          !(
                                            a.utm === alias.utm &&
                                            a.campaignId === alias.campaignId
                                          ),
                                      ),
                                  },
                                },
                              }))
                            }
                          >
                            Quitar
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-text-secondary">Sin aliases todavía.</p>
                )}
              </>
            )}
          </div>
        </SettingsSection>

        <SettingsSection title="Umbrales RTO">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Alto riesgo %" htmlFor="rto-high">
              <Input
                id="rto-high"
                className={controlClass}
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
                className={controlClass}
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
                className={controlClass}
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
        </SettingsSection>

        <SettingsSection title="Costos / COD por defecto">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Costo envío" htmlFor="cod-ship">
              <Input
                id="cod-ship"
                className={controlClass}
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
                className={controlClass}
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
                className={controlClass}
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
          </div>
        </SettingsSection>

        <SettingsSection title="Preferencias">
          <div className="space-y-3">
            <label className="flex min-h-10 items-center gap-2.5 text-sm text-text-primary">
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
            <label className="flex min-h-10 items-center gap-2.5 text-sm text-text-primary">
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
            <label className="flex min-h-10 items-center gap-2.5 text-sm text-text-primary">
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
            <label className="flex min-h-10 items-center gap-2.5 text-sm text-text-primary">
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
            <FormField label="Silencio por defecto (h)" htmlFor="silence" className="max-w-xs pt-1">
              <Input
                id="silence"
                className={controlClass}
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
        </SettingsSection>
      </fieldset>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        {canEdit ? (
          <Button
            className="h-10 min-w-[180px] rounded-[10px]"
            disabled={pending}
            onClick={save}
            aria-busy={pending}
          >
            {pending ? "Guardando…" : "Guardar configuración"}
          </Button>
        ) : (
          <p className="text-sm text-text-secondary">Solo lectura: no tienes permiso para editar.</p>
        )}
      </div>
    </div>
  );
}
