"use client";

import { useState, type FormEvent } from "react";
import { updateProfile } from "@/app/actions/profile";
import { Alert, Button, FormField, Input } from "@/components/ui";

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSuccess(undefined);
    setPending(true);
    const data = new FormData(event.currentTarget);
    const result = await updateProfile({ fullName: String(data.get("fullName") ?? "") });
    setPending(false);
    if (result.error) setError(result.error);
    else setSuccess("Perfil actualizado.");
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      {error ? (
        <Alert variant="danger" title="No fue posible guardar">
          {error}
        </Alert>
      ) : null}
      {success ? <Alert variant="success">{success}</Alert> : null}
      <FormField label="Correo electrónico" htmlFor="email">
        <Input id="email" name="email" type="email" value={email} disabled readOnly />
      </FormField>
      <FormField label="Nombre completo" htmlFor="fullName">
        <Input id="fullName" name="fullName" autoComplete="name" required defaultValue={fullName} />
      </FormField>
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
