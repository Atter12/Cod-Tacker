"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, Copy, Gauge, Trash2 } from "lucide-react";
import { createApiKey, revokeApiKey, rotateApiKey } from "@/app/actions/api-keys";
import { AgencyStatusPill } from "@/components/agency/AgencyStatusPill";
import { Button, Card, CardContent, Checkbox, DemoModeBadge, FormField, Input } from "@/components/ui";
import { API_KEY_SCOPES } from "@/lib/api-keys/crypto";
import type { ApiKeyListItem } from "@/services/api-keys.service";

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "Hace minutos";
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} d`;
}

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

  const canCreate = Boolean(name.trim() && scopes.length > 0 && confirmOnce && !pending);

  function toggleScope(scope: string) {
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  function create() {
    if (!canCreate) return;
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

  async function copyPrefix(prefix: string) {
    try {
      await navigator.clipboard.writeText(prefix);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-6">
      <DemoModeBadge />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {plaintext ? (
        <div className="rounded-[12px] border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-text-primary">Copia la clave ahora — no se volverá a mostrar.</p>
          <code className="mt-2 block break-all rounded-md bg-white p-2 font-mono text-xs">{plaintext}</code>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => setPlaintext(null)}>
            Ya la guardé
          </Button>
        </div>
      ) : null}

      {canManage ? (
        <Card>
          <CardContent className="space-y-4 p-4 sm:p-5">
            <h3 className="text-[16px] font-semibold text-text-primary">Crear clave</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Nombre" htmlFor="key-name">
                <Input
                  id="key-name"
                  value={name}
                  placeholder="Ej. Integración CRM"
                  className="h-11"
                  onChange={(e) => setName(e.target.value)}
                />
              </FormField>
              <FormField label="Expiración (opcional)" htmlFor="key-exp">
                <Input
                  id="key-exp"
                  type="datetime-local"
                  value={expiresAt}
                  className="h-11"
                  onChange={(e) =>
                    setExpiresAt(e.target.value ? new Date(e.target.value).toISOString().slice(0, 16) : "")
                  }
                />
              </FormField>
            </div>
            <div className="space-y-2">
              <p className="text-[12.5px] font-medium text-text-secondary">Alcances (scopes)</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {API_KEY_SCOPES.map((scope) => (
                  <label key={scope} className="flex items-center gap-2 text-sm text-text-primary">
                    <Checkbox checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} />
                    <span className="font-mono text-[12.5px]">{scope}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm text-text-secondary">
              <Checkbox
                className="mt-0.5"
                checked={confirmOnce}
                onChange={(e) => setConfirmOnce(e.target.checked)}
              />
              Confirmo que guardaré la clave en un lugar seguro. Solo se mostrará una vez.
            </label>
            <Button className="h-11 w-full" disabled={!canCreate} onClick={create}>
              {pending ? "Creando…" : "Crear clave"}
            </Button>
            <div className="flex items-start gap-2 rounded-[12px] border border-brand-primary/25 bg-brand-soft/60 px-3 py-2.5 text-[12.5px] text-brand-primary">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>Guarda la clave completa al crearla. Por seguridad no volverá a mostrarse.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <h3 className="text-[15px] font-semibold text-text-primary">Tus claves API</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-semibold sm:px-5">Nombre</th>
                <th className="px-3 py-3 font-semibold">Prefijo</th>
                <th className="px-3 py-3 font-semibold">Estado</th>
                <th className="px-3 py-3 font-semibold">Último uso</th>
                <th className="px-3 py-3 font-semibold">Vence</th>
                {canManage ? <th className="px-4 py-3 font-semibold sm:px-5">Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-text-secondary">
                    No hay API keys para esta agencia.
                  </td>
                </tr>
              ) : (
                keys.map((key) => {
                  const active = key.status === "active";
                  return (
                    <tr key={key.id} className="border-t border-border">
                      <td className="px-4 py-3.5 font-semibold text-text-primary sm:px-5">{key.name}</td>
                      <td className="px-3 py-3.5 font-mono text-xs text-text-primary">
                        {key.key_prefix}
                        {key.key_prefix && !key.key_prefix.includes("…") ? "…" : null}
                      </td>
                      <td className="px-3 py-3.5">
                        <AgencyStatusPill
                          label={active ? "Activo" : key.status === "revoked" ? "Revocado" : key.status}
                          tone={active ? "success" : "danger"}
                          dot
                        />
                      </td>
                      <td className="px-3 py-3.5 text-text-primary">{relativeTime(key.last_used_at)}</td>
                      <td className="px-3 py-3.5 text-text-primary">
                        {key.expires_at ? new Date(key.expires_at).toLocaleDateString("es") : "Nunca"}
                      </td>
                      {canManage ? (
                        <td className="px-4 py-3.5 sm:px-5">
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label="Copiar prefijo"
                              onClick={() => void copyPrefix(key.key_prefix)}
                            >
                              <Copy className="size-3.5" aria-hidden />
                            </Button>
                            {active ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={pending}
                                  onClick={() => rotate(key.id)}
                                >
                                  Rotar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-danger"
                                  aria-label="Revocar clave"
                                  disabled={pending}
                                  onClick={() => revoke(key.id)}
                                >
                                  <Trash2 className="size-3.5" aria-hidden />
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-4 sm:p-5">
          <div>
            <h3 className="text-[14px] font-semibold text-text-primary">Límite de tasa</h3>
            <p className="mt-1 text-[12.5px] text-text-secondary">
              60 req/min por clave · validación en lib/api-keys/validate.ts
            </p>
          </div>
          <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand-primary" aria-hidden>
            <Gauge className="size-5" />
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
