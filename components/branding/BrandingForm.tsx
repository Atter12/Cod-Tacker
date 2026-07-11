"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { restoreBrandingDefaults, updateAgencyBranding } from "@/app/actions/branding";
import { Button, Checkbox, DemoModeBadge, FormField, Input } from "@/components/ui";

type BrandingState = {
  productName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  faviconUrl: string;
  loginBackgroundUrl: string;
  supportEmail: string;
  supportWhatsapp: string;
  hideCodtrackedBranding: boolean;
  isWhiteLabelEnabled: boolean;
};

export function BrandingForm({
  agencySlug,
  canEdit,
  whiteLabelAllowed,
  initial,
}: {
  agencySlug: string;
  canEdit: boolean;
  whiteLabelAllowed: boolean;
  initial: BrandingState;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(initial);
  const [previewWidth, setPreviewWidth] = useState<"mobile" | "tablet" | "desktop">("desktop");

  function save() {
    setError(null);
    start(async () => {
      const r = await updateAgencyBranding(agencySlug, {
        productName: form.productName || null,
        primaryColor: form.primaryColor || null,
        secondaryColor: form.secondaryColor || null,
        logoUrl: form.logoUrl || null,
        faviconUrl: form.faviconUrl || null,
        loginBackgroundUrl: form.loginBackgroundUrl || null,
        supportEmail: form.supportEmail || null,
        supportWhatsapp: form.supportWhatsapp || null,
        hideCodtrackedBranding: form.hideCodtrackedBranding,
        isWhiteLabelEnabled: form.isWhiteLabelEnabled,
      });
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  function restore() {
    if (!confirm("¿Restaurar valores por defecto de marca?")) return;
    setError(null);
    start(async () => {
      const r = await restoreBrandingDefaults(agencySlug);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  const previewMax =
    previewWidth === "mobile" ? "max-w-[320px]" : previewWidth === "tablet" ? "max-w-[640px]" : "max-w-full";

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-4">
        <DemoModeBadge />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <fieldset disabled={!canEdit || pending} className="space-y-3">
          <FormField label="Nombre del producto" htmlFor="product">
            <Input
              id="product"
              value={form.productName}
              onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Color primario" htmlFor="primary">
              <Input
                id="primary"
                value={form.primaryColor}
                onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
              />
            </FormField>
            <FormField label="Color secundario" htmlFor="secondary">
              <Input
                id="secondary"
                value={form.secondaryColor}
                onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value }))}
              />
            </FormField>
          </div>
          <FormField label="Logo (URL)" htmlFor="logo" hint="URL pública o de Supabase Storage">
            <Input
              id="logo"
              value={form.logoUrl}
              onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
            />
          </FormField>
          <FormField label="Favicon (URL)" htmlFor="favicon">
            <Input
              id="favicon"
              value={form.faviconUrl}
              onChange={(e) => setForm((f) => ({ ...f, faviconUrl: e.target.value }))}
            />
          </FormField>
          <FormField label="Fondo de login (URL)" htmlFor="login-bg">
            <Input
              id="login-bg"
              value={form.loginBackgroundUrl}
              onChange={(e) => setForm((f) => ({ ...f, loginBackgroundUrl: e.target.value }))}
            />
          </FormField>
          <FormField label="Email de soporte" htmlFor="support-email">
            <Input
              id="support-email"
              type="email"
              value={form.supportEmail}
              onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))}
            />
          </FormField>
          <FormField label="WhatsApp de soporte" htmlFor="support-wa">
            <Input
              id="support-wa"
              value={form.supportWhatsapp}
              onChange={(e) => setForm((f) => ({ ...f, supportWhatsapp: e.target.value }))}
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.isWhiteLabelEnabled}
              disabled={!whiteLabelAllowed}
              onChange={(e) => setForm((f) => ({ ...f, isWhiteLabelEnabled: e.target.checked }))}
            />
            Activar white-label
            {!whiteLabelAllowed ? (
              <span className="text-xs text-text-secondary">(requiere plan Growth+)</span>
            ) : null}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.hideCodtrackedBranding}
              disabled={!whiteLabelAllowed}
              onChange={(e) => setForm((f) => ({ ...f, hideCodtrackedBranding: e.target.checked }))}
            />
            Ocultar branding CODTracked
          </label>
        </fieldset>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={save}>
              Guardar marca
            </Button>
            <Button variant="outline" disabled={pending} onClick={restore}>
              Restaurar defaults
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          {(["mobile", "tablet", "desktop"] as const).map((w) => (
            <Button
              key={w}
              size="sm"
              variant={previewWidth === w ? "primary" : "outline"}
              onClick={() => setPreviewWidth(w)}
            >
              {w === "mobile" ? "Móvil" : w === "tablet" ? "Tablet" : "Escritorio"}
            </Button>
          ))}
        </div>
        <div
          className={`mx-auto overflow-hidden rounded-lg border border-border ${previewMax}`}
          style={{
            background: form.loginBackgroundUrl
              ? `center/cover url(${form.loginBackgroundUrl})`
              : `linear-gradient(135deg, ${form.primaryColor || "#0F766E"}, ${form.secondaryColor || "#134E4A"})`,
          }}
        >
          <div className="m-6 rounded-md bg-white/95 p-6 shadow-sm">
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logoUrl} alt="Logo" className="mb-3 h-8 object-contain" />
            ) : null}
            <p className="text-lg font-semibold" style={{ color: form.primaryColor || undefined }}>
              {form.productName || "CODTracked"}
            </p>
            <p className="mt-1 text-sm text-text-secondary">Vista previa de acceso</p>
            <div
              className="mt-4 h-9 rounded-md"
              style={{ backgroundColor: form.primaryColor || "#0F766E" }}
            />
            {!form.hideCodtrackedBranding ? (
              <p className="mt-4 text-xs text-text-secondary">Powered by CODTracked</p>
            ) : null}
            {(form.supportEmail || form.supportWhatsapp) && (
              <p className="mt-2 text-xs text-text-secondary">
                Soporte: {form.supportEmail || "—"} · WA {form.supportWhatsapp || "—"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
