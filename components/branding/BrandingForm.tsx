"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ImageIcon, Mail, MessageCircle, Monitor, Smartphone, Tablet } from "lucide-react";
import { restoreBrandingDefaults, updateAgencyBranding } from "@/app/actions/branding";
import { BrandAssetDropzone } from "@/components/branding/BrandAssetDropzone";
import { BrandColorPicker } from "@/components/branding/BrandColorPicker";
import { Button, Checkbox, FormField, Input } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

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
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState(initial);
  const [previewWidth, setPreviewWidth] = useState<"mobile" | "tablet" | "desktop">("desktop");

  function save() {
    setError(null);
    setSuccess(null);
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
      if (r.error) {
        setError(r.error);
        return;
      }
      setSuccess("Marca guardada. Se aplica en la consola y las tiendas de esta agencia.");
      router.refresh();
    });
  }

  function restore() {
    if (!confirm("¿Restaurar valores por defecto de marca?")) return;
    setError(null);
    setSuccess(null);
    start(async () => {
      const r = await restoreBrandingDefaults(agencySlug);
      if (r.error) {
        setError(r.error);
        return;
      }
      setSuccess("Se restauró la marca por defecto.");
      router.refresh();
    });
  }

  const previewMax =
    previewWidth === "mobile"
      ? "max-w-[320px]"
      : previewWidth === "tablet"
        ? "max-w-[520px]"
        : "max-w-full";

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
      <div className="space-y-6">
        {error ? (
          <p className="rounded-[10px] border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="rounded-[10px] border border-success/30 bg-success/10 px-3 py-2 text-[13px] text-success">
            {success}
          </p>
        ) : null}

        <fieldset disabled={!canEdit || pending} className="space-y-6">
          <section className="space-y-3 rounded-[12px] border border-border bg-surface-elevated p-4 shadow-[var(--card-shadow)]">
            <div>
              <h2 className="text-[14px] font-semibold text-text-primary">Identidad</h2>
              <p className="mt-0.5 text-[12.5px] text-text-secondary">
                Nombre y logo que verá tu equipo en el menú lateral.
              </p>
            </div>
            <FormField label="Nombre del producto" htmlFor="product">
              <Input
                id="product"
                value={form.productName}
                placeholder="Ej. Flipy Ops"
                onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <BrandAssetDropzone
                agencySlug={agencySlug}
                kind="logo"
                label="Logo"
                hint="PNG, JPEG, WebP o SVG · se sube a Storage"
                value={form.logoUrl}
                disabled={!canEdit || pending}
                onUploaded={(url) => {
                  setForm((f) => ({ ...f, logoUrl: url }));
                  setSuccess("Logo subido. Ya se aplica en la consola.");
                }}
                onCleared={() => setForm((f) => ({ ...f, logoUrl: "" }))}
              />
              <BrandAssetDropzone
                agencySlug={agencySlug}
                kind="favicon"
                label="Favicon"
                hint="ICO o PNG cuadrado"
                value={form.faviconUrl}
                disabled={!canEdit || pending}
                onUploaded={(url) => {
                  setForm((f) => ({ ...f, faviconUrl: url }));
                  setSuccess("Favicon subido.");
                }}
                onCleared={() => setForm((f) => ({ ...f, faviconUrl: "" }))}
              />
            </div>
            <details className="rounded-lg border border-border bg-muted/20 px-3 py-2">
              <summary className="cursor-pointer text-[12px] font-medium text-text-secondary">
                Usar URL manual (opcional)
              </summary>
              <div className="mt-3 space-y-3">
                <FormField label="Logo (URL)" htmlFor="logo" hint="Si ya tienes una URL pública">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted">
                      {form.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={form.logoUrl} alt="" className="max-h-9 max-w-9 object-contain" />
                      ) : (
                        <ImageIcon className="size-4 text-text-secondary" aria-hidden />
                      )}
                    </span>
                    <Input
                      id="logo"
                      value={form.logoUrl}
                      placeholder="https://…"
                      onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                    />
                  </div>
                </FormField>
                <FormField label="Favicon (URL)" htmlFor="favicon">
                  <Input
                    id="favicon"
                    value={form.faviconUrl}
                    placeholder="https://…"
                    onChange={(e) => setForm((f) => ({ ...f, faviconUrl: e.target.value }))}
                  />
                </FormField>
              </div>
            </details>
          </section>

          <section className="space-y-3 rounded-[12px] border border-border bg-surface-elevated p-4 shadow-[var(--card-shadow)]">
            <BrandColorPicker
              primaryColor={form.primaryColor}
              secondaryColor={form.secondaryColor}
              disabled={!canEdit || pending}
              onChange={({ primaryColor, secondaryColor }) =>
                setForm((f) => ({ ...f, primaryColor, secondaryColor }))
              }
            />
          </section>

          <section className="space-y-3 rounded-[12px] border border-border bg-surface-elevated p-4 shadow-[var(--card-shadow)]">
            <div>
              <h2 className="text-[14px] font-semibold text-text-primary">Acceso y soporte</h2>
              <p className="mt-0.5 text-[12.5px] text-text-secondary">
                Opcional. Fondo de login y canales de ayuda para tu marca.
              </p>
            </div>
            <BrandAssetDropzone
              agencySlug={agencySlug}
              kind="login_background"
              label="Fondo de login"
              hint="Imagen ancha · se sube a Storage"
              value={form.loginBackgroundUrl}
              disabled={!canEdit || pending}
              onUploaded={(url) => {
                setForm((f) => ({ ...f, loginBackgroundUrl: url }));
                setSuccess("Fondo de login subido.");
              }}
              onCleared={() => setForm((f) => ({ ...f, loginBackgroundUrl: "" }))}
            />
            <details className="rounded-lg border border-border bg-muted/20 px-3 py-2">
              <summary className="cursor-pointer text-[12px] font-medium text-text-secondary">
                URL manual de fondo (opcional)
              </summary>
              <div className="mt-3">
                <FormField label="Fondo de login (URL)" htmlFor="login-bg">
                  <Input
                    id="login-bg"
                    value={form.loginBackgroundUrl}
                    placeholder="https://…"
                    onChange={(e) => setForm((f) => ({ ...f, loginBackgroundUrl: e.target.value }))}
                  />
                </FormField>
              </div>
            </details>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Email de soporte" htmlFor="support-email">
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-secondary"
                    aria-hidden
                  />
                  <Input
                    id="support-email"
                    type="email"
                    className="pl-9"
                    value={form.supportEmail}
                    onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))}
                  />
                </div>
              </FormField>
              <FormField label="WhatsApp de soporte" htmlFor="support-wa">
                <div className="relative">
                  <MessageCircle
                    className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-secondary"
                    aria-hidden
                  />
                  <Input
                    id="support-wa"
                    className="pl-9"
                    value={form.supportWhatsapp}
                    placeholder="+51…"
                    onChange={(e) => setForm((f) => ({ ...f, supportWhatsapp: e.target.value }))}
                  />
                </div>
              </FormField>
            </div>
          </section>

          <section className="space-y-3 rounded-[12px] border border-border bg-surface-elevated p-4 shadow-[var(--card-shadow)]">
            <div>
              <h2 className="text-[14px] font-semibold text-text-primary">White-label</h2>
              <p className="mt-0.5 text-[12.5px] text-text-secondary">
                Ocultar la marca CODTracked requiere plan Growth o Scale.
              </p>
            </div>
            <label className="flex items-start gap-2.5 text-[13px] text-text-primary">
              <Checkbox
                className="mt-0.5"
                checked={form.isWhiteLabelEnabled}
                disabled={!whiteLabelAllowed}
                onChange={(e) => setForm((f) => ({ ...f, isWhiteLabelEnabled: e.target.checked }))}
              />
              <span>
                Activar white-label
                {!whiteLabelAllowed ? (
                  <span className="mt-0.5 block text-[12px] text-text-secondary">
                    Disponible desde Growth+
                  </span>
                ) : (
                  <span className="mt-0.5 block text-[12px] text-text-secondary">
                    Presenta la plataforma con tu marca de producto.
                  </span>
                )}
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-[13px] text-text-primary">
              <Checkbox
                className="mt-0.5"
                checked={form.hideCodtrackedBranding}
                disabled={!whiteLabelAllowed}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hideCodtrackedBranding: e.target.checked }))
                }
              />
              <span>
                Ocultar “Powered by CODTracked”
                {!whiteLabelAllowed ? (
                  <span className="mt-0.5 block text-[12px] text-text-secondary">
                    Requiere plan con white-label
                  </span>
                ) : null}
              </span>
            </label>
          </section>
        </fieldset>

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={save}>
              {pending ? "Guardando…" : "Guardar marca"}
            </Button>
            <Button variant="outline" disabled={pending} onClick={restore}>
              Restaurar defaults
            </Button>
          </div>
        ) : null}
      </div>

      <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
        <div className="flex gap-1.5 rounded-[10px] border border-border bg-surface-elevated p-1">
          {(
            [
              { id: "mobile", label: "Móvil", Icon: Smartphone },
              { id: "tablet", label: "Tablet", Icon: Tablet },
              { id: "desktop", label: "Escritorio", Icon: Monitor },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPreviewWidth(id)}
              className={cn(
                "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-[11.5px] font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                previewWidth === id
                  ? "bg-brand-soft text-brand-primary"
                  : "text-text-secondary hover:bg-muted hover:text-text-primary",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        <div
          className={cn(
            "mx-auto overflow-hidden rounded-[12px] border border-border shadow-[var(--card-shadow)]",
            previewMax,
          )}
          style={{
            background: form.loginBackgroundUrl
              ? `center/cover url(${form.loginBackgroundUrl})`
              : `linear-gradient(145deg, ${form.primaryColor || "#F47A32"}, ${form.secondaryColor || "#F5661F"})`,
          }}
        >
          <div className="flex items-center gap-2 border-b border-black/10 bg-surface-elevated/90 px-3 py-2 backdrop-blur-sm">
            <div className="flex gap-1" aria-hidden>
              <span className="size-2 rounded-full bg-black/15" />
              <span className="size-2 rounded-full bg-black/15" />
              <span className="size-2 rounded-full bg-black/15" />
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-muted/80 px-2 py-1">
              {form.faviconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.faviconUrl} alt="" className="size-3.5 shrink-0 object-contain" />
              ) : (
                <span
                  className="grid size-3.5 shrink-0 place-items-center rounded-[3px] text-[8px] font-bold text-white"
                  style={{ backgroundColor: form.primaryColor || "#F47A32" }}
                  aria-hidden
                >
                  {(form.productName || "C").charAt(0).toUpperCase()}
                </span>
              )}
              <span className="truncate text-[11px] text-text-secondary">
                {form.productName || "CODTracked"}
              </span>
            </div>
          </div>
          <div className="m-5 rounded-[10px] bg-surface-elevated/95 p-5 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3">
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoUrl} alt="" className="h-9 max-w-[120px] object-contain" />
              ) : (
                <span
                  className="grid size-9 place-items-center rounded-lg text-[14px] font-bold text-white"
                  style={{ backgroundColor: form.primaryColor || "#F47A32" }}
                  aria-hidden
                >
                  {(form.productName || "C").charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p
                  className="truncate text-[15px] font-semibold"
                  style={{ color: form.primaryColor || undefined }}
                >
                  {form.productName || "CODTracked"}
                </p>
                <p className="text-[12px] text-text-secondary">Vista previa de marca</p>
              </div>
            </div>
            <div
              className="mt-5 h-10 rounded-lg"
              style={{ backgroundColor: form.primaryColor || "#F47A32" }}
            />
            <div className="mt-2 h-8 rounded-lg bg-muted" />
            {!form.hideCodtrackedBranding ? (
              <p className="mt-4 text-[11px] text-text-secondary">Powered by CODTracked</p>
            ) : null}
            {(form.supportEmail || form.supportWhatsapp) && (
              <p className="mt-2 text-[11px] text-text-secondary">
                Soporte: {form.supportEmail || "—"}
                {form.supportWhatsapp ? ` · WA ${form.supportWhatsapp}` : null}
              </p>
            )}
          </div>
        </div>
        <p className="text-[11.5px] leading-relaxed text-text-secondary">
          Al guardar, colores y logo se aplican de inmediato en la consola. El favicon aparece en la
          pestaña del navegador (puede hacer falta un refresco duro si el navegador lo cachea).
        </p>
      </aside>
    </div>
  );
}
