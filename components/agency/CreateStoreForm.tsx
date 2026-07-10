"use client";

import { useState, type FormEvent } from "react";
import { createStore } from "@/app/actions/stores";
import { Alert, Button, FormField, Input, Select } from "@/components/ui";

export function CreateStoreForm({ agencySlug }: { agencySlug: string }) {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    const data = new FormData(event.currentTarget);
    const result = await createStore(agencySlug, {
      name: String(data.get("name") ?? ""),
      slug: String(data.get("slug") ?? ""),
      countryCode: String(data.get("countryCode") ?? "PE"),
      currencyCode: String(data.get("currencyCode") ?? "PEN"),
      timezone: String(data.get("timezone") ?? "America/Lima"),
    });
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <form className="space-y-4 rounded-lg border border-border p-4" onSubmit={submit}>
      <h2 className="text-lg font-semibold">Crear tienda</h2>
      {error ? (
        <Alert variant="danger" title="No se pudo crear">
          {error}
        </Alert>
      ) : null}
      <FormField label="Nombre" htmlFor="name">
        <Input id="name" name="name" required />
      </FormField>
      <FormField label="Slug" htmlFor="slug" hint="Solo minúsculas, números y guiones.">
        <Input id="slug" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="País" htmlFor="countryCode">
          <Input id="countryCode" name="countryCode" defaultValue="PE" />
        </FormField>
        <FormField label="Moneda" htmlFor="currencyCode">
          <Input id="currencyCode" name="currencyCode" defaultValue="PEN" />
        </FormField>
        <FormField label="Timezone" htmlFor="timezone">
          <Select id="timezone" name="timezone" defaultValue="America/Lima">
            <option value="America/Lima">America/Lima</option>
            <option value="America/Bogota">America/Bogota</option>
            <option value="America/Mexico_City">America/Mexico_City</option>
          </Select>
        </FormField>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creando…" : "Crear tienda"}
      </Button>
    </form>
  );
}
