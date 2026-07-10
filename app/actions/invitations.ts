"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { getPublicEnv } from "@/config/env";
import { invitableAgencyRoles, type InvitableAgencyRole } from "@/config/permissions";
import { routes } from "@/config/routes";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requireUser } from "@/lib/auth/require-user";
import { ValidationError } from "@/lib/errors";
import { toUserMessage } from "@/lib/errors/to-user-message";
import { hashInviteToken } from "@/lib/invitations/token";
import { requirePermission } from "@/lib/permissions/require-permission";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";

export type InvitationActionResult = { error?: string; inviteUrl?: string; invitationId?: string };

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertInvitableRole(role: string): InvitableAgencyRole {
  if (!(invitableAgencyRoles as readonly string[]).includes(role)) {
    throw new ValidationError("Solo puedes invitar roles admin, analyst o viewer.");
  }
  return role as InvitableAgencyRole;
}

export async function createAgencyInvitation(
  agencySlug: string,
  input: { email: string; role: string },
): Promise<InvitationActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    requirePermission(membership.roles, "agency.team.invite");

    const email = normalizeEmail(input.email);
    if (!emailPattern.test(email)) throw new ValidationError("Ingresa un correo válido.");
    const role = assertInvitableRole(input.role);

    const supabase = await createClient();
    const { data: activeMembers } = await supabase
      .from("agency_members")
      .select("user_id")
      .eq("agency_id", membership.agencyId)
      .eq("status", "active");
    const memberIds = (activeMembers ?? []).map((row) => row.user_id);
    if (memberIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", memberIds);
      if ((profiles ?? []).some((profile) => profile.email?.toLowerCase() === email)) {
        throw new ValidationError("Ese correo ya es miembro activo de la agencia.");
      }
    }

    const { data: pending } = await supabase
      .from("agency_invitations")
      .select("id")
      .eq("agency_id", membership.agencyId)
      .eq("email", email)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (pending) throw new ValidationError("Ya existe una invitación pendiente para ese correo.");

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashInviteToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

    const { data: invitation, error } = await supabase
      .from("agency_invitations")
      .insert({
        agency_id: membership.agencyId,
        email,
        role,
        token_hash: tokenHash,
        status: "pending",
        expires_at: expiresAt,
        invited_by: user.id,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };

    await writeAuditLog({
      action: "invitation_created",
      entityType: "agency_invitation",
      entityId: invitation.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      newData: { email, role },
    });

    revalidatePath(routes.agency.team(agencySlug));
    const inviteUrl = `${getPublicEnv().NEXT_PUBLIC_APP_URL}/invites/accept?token=${encodeURIComponent(token)}`;
    return { inviteUrl, invitationId: invitation.id };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}

export async function revokeAgencyInvitation(
  agencySlug: string,
  invitationId: string,
): Promise<InvitationActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    requirePermission(membership.roles, "agency.team.manage");
    const supabase = await createClient();
    const { error } = await supabase
      .from("agency_invitations")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", invitationId)
      .eq("agency_id", membership.agencyId)
      .eq("status", "pending");
    if (error) return { error: error.message };
    await writeAuditLog({
      action: "invitation_revoked",
      entityType: "agency_invitation",
      entityId: invitationId,
      actorId: user.id,
      agencyId: membership.agencyId,
    });
    revalidatePath(routes.agency.team(agencySlug));
    return {};
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}

export async function acceptAgencyInvitation(token: string): Promise<InvitationActionResult> {
  try {
    const user = await requireUser();
    if (!token.trim()) throw new ValidationError("Token de invitación inválido.");
    const supabase = await createClient();
    const tokenHash = hashInviteToken(token.trim());
    const { data: agencyId, error } = await supabase.rpc("accept_agency_invitation", {
      p_token_hash: tokenHash,
    });
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("invitation_not_found")) throw new ValidationError("La invitación no es válida.");
      if (message.includes("invitation_expired")) throw new ValidationError("La invitación expiró.");
      if (message.includes("invitation_revoked")) throw new ValidationError("La invitación fue revocada.");
      if (message.includes("invitation_already_used")) throw new ValidationError("La invitación ya fue usada.");
      if (message.includes("invitation_email_mismatch")) {
        throw new ValidationError("Debes iniciar sesión con el correo al que se envió la invitación.");
      }
      return { error: error.message };
    }

    await writeAuditLog({
      action: "invitation_accepted",
      entityType: "agency_invitation",
      actorId: user.id,
      agencyId: typeof agencyId === "string" ? agencyId : null,
      newData: { agency_id: agencyId },
    });
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  redirect(routes.app.dashboard);
}

export async function updateAgencyMemberRole(
  agencySlug: string,
  memberId: string,
  role: string,
): Promise<InvitationActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    requirePermission(membership.roles, "agency.team.manage");
    const nextRole = assertInvitableRole(role);
    const supabase = await createClient();

    const { data: target, error: targetError } = await supabase
      .from("agency_members")
      .select("id, user_id, role, status")
      .eq("id", memberId)
      .eq("agency_id", membership.agencyId)
      .maybeSingle();
    if (targetError) return { error: targetError.message };
    if (!target) throw new ValidationError("Miembro no encontrado.");
    if (target.role === "owner") throw new ValidationError("No puedes cambiar el rol del owner.");
    if (target.user_id === user.id) throw new ValidationError("No puedes cambiar tu propio rol aquí.");

    const { error } = await supabase.from("agency_members").update({ role: nextRole }).eq("id", target.id);
    if (error) return { error: error.message };

    await writeAuditLog({
      action: "member_role_changed",
      entityType: "agency_member",
      entityId: target.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      oldData: { role: target.role },
      newData: { role: nextRole },
    });
    revalidatePath(routes.agency.team(agencySlug));
    return {};
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}

export async function setAgencyMemberStatus(
  agencySlug: string,
  memberId: string,
  status: "active" | "suspended",
): Promise<InvitationActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    requirePermission(membership.roles, "agency.team.manage");
    const supabase = await createClient();

    const { data: target, error: targetError } = await supabase
      .from("agency_members")
      .select("id, user_id, role, status")
      .eq("id", memberId)
      .eq("agency_id", membership.agencyId)
      .maybeSingle();
    if (targetError) return { error: targetError.message };
    if (!target) throw new ValidationError("Miembro no encontrado.");
    if (target.role === "owner") throw new ValidationError("No puedes suspender al owner.");
    if (target.user_id === user.id) throw new ValidationError("No puedes suspenderte a ti mismo.");

    const { error } = await supabase.from("agency_members").update({ status }).eq("id", target.id);
    if (error) return { error: error.message };

    await writeAuditLog({
      action: status === "suspended" ? "member_suspended" : "member_reactivated",
      entityType: "agency_member",
      entityId: target.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      newData: { status },
    });
    revalidatePath(routes.agency.team(agencySlug));
    return {};
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}
