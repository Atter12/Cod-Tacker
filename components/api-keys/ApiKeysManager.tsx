"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createApiKey, revokeApiKey, rotateApiKey } from "@/app/actions/api-keys";
import { API_KEY_SCOPES } from "@/lib/api-keys/crypto";
import { Button, Checkbox, DemoModeBadge, FormField, Input } from "@/components/ui";
import type { ApiKeyListItem } from "@/services/api-keys.service";

export function ApiKeysManager({
  agencySlug,
  canManage,
  keys,
}: {
  agencySlug: string;
  canManage: boolean;
  keys: ApiKeyListItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["orders.read"]);
  const [expiresAt, setExpiresAt] = useState("");
  const [confirmOnce, setConfirmOnce] = useState(false);

  function toggleScope(scope: string) {
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  function create() {
    setError(null);
    setPlaintext(null);
    start(async () => {
      const r = await createApiKey(agencySlug, {
        name,
        scopes,
        expiresAt: expiresAt || null,
        confirm: confirmOnce,
      });
      if (r.error) setError(r.error);
      else {
        setPlaintext(r.plaintext ?? null);
        setName("");
        setConfirmOnce(false);
        router.refresh();
      }
    });
  }

  function rotate(keyId: string) {
    if (!confirm("¿Rotar esta clave? La anterior dejará de funcionar.")) return;
    setError(null);
    setPlaintext(null);
    start(async () => {
      const r = await rotateApiKey(agencySlug, keyId, true);
      if (r.error) setError(r.error);
      else {
        setPlaintext(r.plaintext ?? null);
        router.refresh();
      }
    });
  }

  function revoke(keyId: string) {
    if (!confirm("¿Revocar esta clave de forma permanente?")) return;
    setError(null);
    start(async () => {
      const r = await revokeApiKey(agencySlug, keyId, true);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <DemoModeBadge />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {plaintext ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-semibold">Copia la clave ahora — no se volverá a mostrar.</p>
          <code className="mt-2 block break-all rounded bg-white p-2 font-mono text-xs">{plaintext}</code>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => setPlaintext(null)}>
            Ya la guardé
          </Button>
        </div>
      ) : null}

      {canManage ? (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">Crear clave</h3>
          <FormField label="Nombre" htmlFor="key-name">
            <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Expiración (opcional)" htmlFor="key-exp">
            <Input
              id="key-exp"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value ? new Date(e.target.value).toISOString().slice(0, 16) : "")}
            />
          </FormField>
          <div className="space-y-1">
            <p className="text-sm font-medium">Alcances</p>
            {API_KEY_SCOPES.map((scope) => (
              <label key={scope} className="flex items-center gap-2 text-sm">
                <Checkbox checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} />
                {scope}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={confirmOnce} onChange={(e) => setConfirmOnce(e.target.checked)} />
            Confirmo que guardaré la clave; solo se muestra una vez
          </label>
          <Button disabled={pending || !name.trim()} onClick={create}>
            Crear clave
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-text-secondary">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Prefijo</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Último uso</th>
              <th className="px-3 py-2">Vence</th>
              {canManage ? <th className="px-3 py-2">Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-text-secondary">
                  No hay API keys para esta agencia.
                </td>
              </tr>
            ) : (
              keys.map((key) => (
                <tr key={key.id} className="border-t border-border">
                  <td className="px-3 py-2">{key.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{key.key_prefix}</td>
                  <td className="px-3 py-2">{key.status}</td>
                  <td className="px-3 py-2">
                    {key.last_used_at ? new Date(key.last_used_at).toLocaleString("es") : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {key.expires_at ? new Date(key.expires_at).toLocaleDateString("es") : "Sin vencimiento"}
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        {key.status === "active" ? (
                          <>
                            <Button size="sm" variant="outline" disabled={pending} onClick={() => rotate(key.id)}>
                              Rotar
                            </Button>
                            <Button size="sm" variant="danger" disabled={pending} onClick={() => revoke(key.id)}>
                              Revocar
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-text-secondary">—</span>
                        )}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-secondary">
        El hash de la clave nunca se expone. Rate limit persistente: 60 req/min por clave
        (`api_key_rate_limits`). Validación: `lib/api-keys/validate.ts`.
      </p>
    </div>
  );
}
