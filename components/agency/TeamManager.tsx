"use client";

import { useState, type FormEvent } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  createAgencyInvitation,
  revokeAgencyInvitation,
  setAgencyMemberStatus,
  updateAgencyMemberRole,
} from "@/app/actions/invitations";
import { AgencyStatusPill } from "@/components/agency/AgencyStatusPill";
import { Alert, Button, Card, CardContent, FormField, Input, Select } from "@/components/ui";
import { invitableAgencyRoles } from "@/config/permissions";
import { cn } from "@/lib/utils/cn";

type MemberRow = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: string | null;
  email: string | null;
  full_name: string | null;
};

type InvitationRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
};

const ROLE_COPY: Array<{ role: string; description: string }> = [
  { role: "Owner", description: "Acceso total a la agencia y facturación." },
  { role: "Admin", description: "Gestiona tiendas, equipo y facturación." },
  { role: "Viewer", description: "Solo lectura en tiendas y reportes." },
];

const PERMISSION_MATRIX: Array<{
  label: string;
  owner: boolean;
  admin: boolean;
  viewer: boolean;
}> = [
  { label: "Gestionar tiendas", owner: true, admin: true, viewer: false },
  { label: "Invitar / gestionar miembros", owner: true, admin: true, viewer: false },
  { label: "Ver facturación", owner: true, admin: true, viewer: true },
  { label: "Gestionar facturación", owner: true, admin: false, viewer: false },
  { label: "Claves API", owner: true, admin: true, viewer: false },
];

function RoleDot({ on, tone }: { on: boolean; tone: "owner" | "admin" | "viewer" }) {
  return (
    <span
      className={cn(
        "inline-block size-[18px] rounded-full",
        !on && "bg-muted",
        on && tone === "owner" && "bg-success",
        on && tone === "admin" && "bg-sky-500",
        on && tone === "viewer" && "bg-sky-500",
      )}
      aria-label={on ? "Permitido" : "No permitido"}
    />
  );
}

function relativeAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.max(0, Math.floor(ms / 86_400_000));
  if (days <= 0) return "hoy";
  if (days === 1) return "hace 1 día";
  return `hace ${days} días`;
}

export function TeamManager({
  agencySlug,
  members,
  invitations,
  canInvite,
  canManage,
}: {
  agencySlug: string;
  members: MemberRow[];
  invitations: InvitationRow[];
  canInvite: boolean;
  canManage: boolean;
}) {
  const [error, setError] = useState<string>();
  const [inviteUrl, setInviteUrl] = useState<string>();
  const [pending, setPending] = useState(false);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setInviteUrl(undefined);
    setPending(true);
    const data = new FormData(event.currentTarget);
    const result = await createAgencyInvitation(agencySlug, {
      email: String(data.get("email") ?? ""),
      role: String(data.get("role") ?? "viewer"),
    });
    setPending(false);
    if (result.error) setError(result.error);
    else if (result.inviteUrl) {
      setInviteUrl(result.inviteUrl);
      event.currentTarget.reset();
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {canInvite ? (
          <Card>
            <CardContent className="space-y-4 p-4 sm:p-5">
              <h2 className="text-[15px] font-semibold text-text-primary">Invitar miembro</h2>
              <form className="space-y-4" onSubmit={invite}>
                {error ? (
                  <Alert variant="danger" title="No se pudo invitar">
                    {error}
                  </Alert>
                ) : null}
                {inviteUrl ? (
                  <Alert variant="success">
                    Invitación creada. Copia el enlace (válido 7 días):
                    <p className="mt-2 break-all text-xs">{inviteUrl}</p>
                  </Alert>
                ) : null}
                <FormField label="Correo electrónico" htmlFor="email">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="nombre@empresa.com"
                    className="h-11"
                  />
                </FormField>
                <FormField label="Rol" htmlFor="role">
                  <Select id="role" name="role" defaultValue="viewer" className="h-11">
                    {invitableAgencyRoles.map((role) => (
                      <option key={role} value={role}>
                        {role === "viewer"
                          ? "Viewer — Solo lectura"
                          : role === "admin"
                            ? "Admin — Gestión"
                            : role}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <Button type="submit" disabled={pending} className="h-11 w-full">
                  {pending ? "Enviando…" : "Enviar invitación"}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4 text-sm text-text-secondary sm:p-5">
              No tienes permiso para invitar miembros.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <h2 className="text-[15px] font-semibold text-text-primary">Roles disponibles</h2>
            <ul className="space-y-3">
              {ROLE_COPY.map((item) => (
                <li key={item.role}>
                  <p className="text-[13px] font-semibold text-text-primary">{item.role}</p>
                  <p className="text-[12.5px] text-text-secondary">{item.description}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <h2 className="text-[15px] font-semibold text-text-primary">Miembros del equipo</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-semibold sm:px-5">Nombre</th>
                <th className="px-3 py-3 font-semibold">Correo</th>
                <th className="px-3 py-3 font-semibold">Rol</th>
                <th className="px-3 py-3 font-semibold">Estado</th>
                <th className="px-3 py-3 font-semibold">Desde</th>
                {canManage ? <th className="px-4 py-3 font-semibold sm:px-5">Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="px-5 py-8 text-center text-text-secondary">
                    No hay miembros registrados.
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id} className="border-t border-border">
                    <td className="px-4 py-3.5 font-semibold text-text-primary sm:px-5">
                      {member.full_name ?? "—"}
                    </td>
                    <td className="px-3 py-3.5 text-text-primary">{member.email ?? member.user_id}</td>
                    <td className="px-3 py-3.5 capitalize text-text-primary">{member.role}</td>
                    <td className="px-3 py-3.5">
                      <AgencyStatusPill
                        label={member.status === "active" ? "Activo" : member.status}
                        tone={member.status === "active" ? "success" : "neutral"}
                      />
                    </td>
                    <td className="px-3 py-3.5 text-text-primary">
                      {member.joined_at ? new Date(member.joined_at).toLocaleDateString("es") : "—"}
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3.5 sm:px-5">
                        {member.role !== "owner" ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              className="h-8 rounded-md border border-border bg-surface-elevated px-2 text-xs"
                              aria-label={`Cambiar rol de ${member.full_name ?? member.email ?? "miembro"}`}
                              defaultValue={member.role}
                              onChange={(event) => {
                                void updateAgencyMemberRole(agencySlug, member.id, event.target.value);
                              }}
                            >
                              {invitableAgencyRoles.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                            {member.status === "active" ? (
                              <button
                                type="button"
                                className="text-xs font-medium text-danger hover:underline"
                                onClick={() => {
                                  if (!confirm("¿Suspender a este miembro?")) return;
                                  void setAgencyMemberStatus(agencySlug, member.id, "suspended");
                                }}
                              >
                                Suspender
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="text-xs font-medium text-brand-primary hover:underline"
                                onClick={() => void setAgencyMemberStatus(agencySlug, member.id, "active")}
                              >
                                Reactivar
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex size-8 items-center justify-center text-text-secondary" aria-hidden>
                            <MoreHorizontal className="size-4" />
                          </span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <h2 className="text-[14px] font-semibold text-text-primary">Invitaciones pendientes</h2>
          {invitations.length === 0 ? (
            <p className="text-sm text-text-secondary">No hay invitaciones pendientes.</p>
          ) : (
            <ul className="space-y-2">
              {invitations.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-border px-3 py-2.5"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-text-primary">{invitation.email}</p>
                    <p className="text-[12px] text-text-secondary">
                      {invitation.role} · Enviada {relativeAge(invitation.created_at)}
                    </p>
                  </div>
                  {canManage ? (
                    <Button
                      size="sm"
                      variant="danger"
                      className="bg-danger/10 text-danger hover:bg-danger/20"
                      onClick={() => {
                        if (!confirm(`¿Revocar la invitación a ${invitation.email}?`)) return;
                        void revokeAgencyInvitation(agencySlug, invitation.id);
                      }}
                    >
                      Revocar
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <h2 className="text-[15px] font-semibold text-text-primary">Matriz de permisos</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-[12px] font-semibold text-text-secondary">
                  <th className="py-2 pr-4 font-semibold" />
                  <th className="px-2 py-2 text-center font-semibold">Owner</th>
                  <th className="px-2 py-2 text-center font-semibold">Admin</th>
                  <th className="px-2 py-2 text-center font-semibold">Viewer</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSION_MATRIX.map((row) => (
                  <tr key={row.label} className="border-t border-border/70">
                    <td className="py-3 pr-4 text-[13px] text-text-primary">{row.label}</td>
                    <td className="px-2 py-3 text-center">
                      <RoleDot on={row.owner} tone="owner" />
                    </td>
                    <td className="px-2 py-3 text-center">
                      <RoleDot on={row.admin} tone="admin" />
                    </td>
                    <td className="px-2 py-3 text-center">
                      <RoleDot on={row.viewer} tone="viewer" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
