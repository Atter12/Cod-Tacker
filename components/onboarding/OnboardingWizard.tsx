"use client";

import { useMemo, useState, type FormEvent } from "react";
import { completeOnboarding } from "@/app/actions/onboarding";
import { Alert, Button, FormField, Input, Select } from "@/components/ui";

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function OnboardingWizard() {
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [agencyName, setAgencyName] = useState("");
  const [agencySlug, setAgencySlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [storeSlugTouched, setStoreSlugTouched] = useState(false);
  const [countryCode, setCountryCode] = useState("PE");
  const [currencyCode, setCurrencyCode] = useState("PEN");
  const [timezone, setTimezone] = useState("America/Lima");

  const previewAgencySlug = useMemo(() => (slugTouched ? agencySlug : toSlug(agencyName)), [agencyName, agencySlug, slugTouched]);
  const previewStoreSlug = useMemo(() => (storeSlugTouched ? storeSlug : toSlug(storeName)), [storeName, storeSlug, storeSlugTouched]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    if (step === 1) {
      if (!agencyName.trim() || !previewAgencySlug) {
        setError("Completa el nombre y el slug de la agencia.");
        return;
      }
      setStep(2);
      if (!storeName) setStoreName(agencyName.trim());
      return;
    }

    setPending(true);
    const result = await completeOnboarding({
      agencyName,
      agencySlug: previewAgencySlug,
      storeName,
      storeSlug: previewStoreSlug,
      countryCode,
      currencyCode,
      timezone,
    });
    setPending(false);
    if (result.error) setError(result.error);
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Paso {step} de 2</p>
        <h1 className="text-2xl font-semibold text-text-primary">
          {step === 1 ? "Configura tu agencia" : "Crea tu primera tienda"}
        </h1>
        <p className="text-sm text-text-secondary">
          {step === 1
            ? "Estos datos identifican tu espacio de trabajo en CODTracked."
            : "La tienda es el contexto operativo de pedidos, ads y logística."}
        </p>
      </div>

      <div className="flex gap-2">
        <div className={`h-1 flex-1 rounded-full ${step >= 1 ? "bg-brand-primary" : "bg-border"}`} />
        <div className={`h-1 flex-1 rounded-full ${step >= 2 ? "bg-brand-primary" : "bg-border"}`} />
      </div>

      {error ? (
        <Alert variant="danger" title="No fue posible continuar">
          {error}
        </Alert>
      ) : null}

      {step === 1 ? (
        <>
          <FormField label="Nombre de la agencia" htmlFor="agencyName">
            <Input
              id="agencyName"
              name="agencyName"
              value={agencyName}
              onChange={(event) => setAgencyName(event.target.value)}
              placeholder="Ej. Holistic Commerce"
              required
              autoFocus
            />
          </FormField>
          <FormField label="Slug de la agencia" htmlFor="agencySlug" hint="Solo minúsculas, números y guiones. Se usa en la URL.">
            <Input
              id="agencySlug"
              name="agencySlug"
              value={previewAgencySlug}
              onChange={(event) => {
                setSlugTouched(true);
                setAgencySlug(toSlug(event.target.value));
              }}
              placeholder="holistic"
              required
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="País" htmlFor="countryCode">
              <Select id="countryCode" name="countryCode" value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                <option value="PE">Perú</option>
                <option value="MX">México</option>
                <option value="CO">Colombia</option>
                <option value="CL">Chile</option>
                <option value="EC">Ecuador</option>
              </Select>
            </FormField>
            <FormField label="Moneda" htmlFor="currencyCode">
              <Select id="currencyCode" name="currencyCode" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}>
                <option value="PEN">PEN</option>
                <option value="USD">USD</option>
                <option value="MXN">MXN</option>
                <option value="COP">COP</option>
                <option value="CLP">CLP</option>
              </Select>
            </FormField>
            <FormField label="Zona horaria" htmlFor="timezone">
              <Select id="timezone" name="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                <option value="America/Lima">America/Lima</option>
                <option value="America/Mexico_City">America/Mexico_City</option>
                <option value="America/Bogota">America/Bogota</option>
                <option value="America/Santiago">America/Santiago</option>
              </Select>
            </FormField>
          </div>
        </>
      ) : (
        <>
          <FormField label="Nombre de la tienda" htmlFor="storeName">
            <Input
              id="storeName"
              name="storeName"
              value={storeName}
              onChange={(event) => setStoreName(event.target.value)}
              placeholder="Ej. Flipy Store"
              required
              autoFocus
            />
          </FormField>
          <FormField label="Slug de la tienda" htmlFor="storeSlug" hint={`URL: /a/${previewAgencySlug}/s/${previewStoreSlug || "…"}/dashboard`}>
            <Input
              id="storeSlug"
              name="storeSlug"
              value={previewStoreSlug}
              onChange={(event) => {
                setStoreSlugTouched(true);
                setStoreSlug(toSlug(event.target.value));
              }}
              placeholder="flipy"
              required
            />
          </FormField>
        </>
      )}

      <div className="flex gap-3">
        {step === 2 ? (
          <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)} disabled={pending}>
            Atrás
          </Button>
        ) : null}
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? "Creando…" : step === 1 ? "Continuar" : "Ir al dashboard"}
        </Button>
      </div>
    </form>
  );
}
