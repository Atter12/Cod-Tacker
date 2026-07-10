"use client";

import { useState, type FormEvent } from "react";
import {
  createAgencyInvitation,
  revokeAgencyInvitation,
  setAgencyMemberStatus,
  updateAgencyMemberRole,
} from "@/app/actions/invitations";
import { invitableAgencyRoles } from "@/config/permissions";
import { Alert, Button, FormField, Input, Select } from "@/components/ui";

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
    <div className="space-y-8">
      {canInvite ? (
        <form className="space-y-4 rounded-lg border border-border p-4" onSubmit={invite}>
          <h2 className="text-lg font-semibold">Invitar miembro</h2>
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
          <FormField label="Correo" htmlFor="email">
            <Input id="email" name="email" type="email" required />
          </FormField>
          <FormField label="Rol" htmlFor="role">
            <Select id="role" name="role" defaultValue="viewer">
              {invitableAgencyRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
          </FormField>
          <Button type="submit" disabled={pending}>
            {pending ? "Enviando…" : "Crear invitación"}
          </Button>
        </form>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Miembros</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-text-secondary">
              <tr>
                <th className="p-3">Nombre</th>
                <th className="p-3">Correo</th>
                <th className="p-3">Rol</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Desde</th>
                {canManage ? <th className="p-3">Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-t border-border">
                  <td className="p-3">{member.full_name ?? "—"}</td>
                  <td className="p-3">{member.email ?? member.user_id}</td>
                  <td className="p-3">{member.role}</td>
                  <td className="p-3">{member.status}</td>
                  <td className="p-3">
                    {member.joined_at ? new Date(member.joined_at).toLocaleDateString("es") : "—"}
                  </td>
                  {canManage ? (
                    <td className="space-x-2 p-3">
                      {member.role !== "owner" ? (
                        <>
                          <select
                            className="rounded border border-border bg-surface px-2 py-1"
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
                              className="text-danger"
                              onClick={() => void setAgencyMemberStatus(agencySlug, member.id, "suspended")}
                            >
                              Suspender
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="text-brand-primary"
                              onClick={() => void setAgencyMemberStatus(agencySlug, member.id, "active")}
                            >
                              Reactivar
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-text-secondary">Owner</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Invitaciones pendientes</h2>
        {invitations.length === 0 ? (
          <p className="text-sm text-text-secondary">No hay invitaciones pendientes.</p>
        ) : (
          <ul className="space-y-2">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span>
                  {invitation.email} · {invitation.role} · vence{" "}
                  {new Date(invitation.expires_at).toLocaleDateString("es")}
                </span>
                {canManage ? (
                  <button
                    type="button"
                    className="text-danger"
                    onClick={() => void revokeAgencyInvitation(agencySlug, invitation.id)}
                  >
                    Revocar
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
