"use client";

import { useState } from "react";
import { acceptAgencyInvitation } from "@/app/actions/invitations";
import { Alert, Button } from "@/components/ui";

export function AcceptInviteForm({ token }: { token: string }) {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function accept() {
    setError(undefined);
    setPending(true);
    const result = await acceptAgencyInvitation(token);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="space-y-3">
      {error ? (
        <Alert variant="danger" title="No se pudo aceptar">
          {error}
        </Alert>
      ) : null}
      <Button className="w-full" disabled={pending} onClick={() => void accept()}>
        {pending ? "Aceptando…" : "Aceptar invitación"}
      </Button>
    </div>
  );
}
