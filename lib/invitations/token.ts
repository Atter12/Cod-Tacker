import { createHash } from "node:crypto";
import { routes } from "@/config/routes";
import { safeRedirectPath } from "@/lib/validation/redirect";

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteAcceptLoginPath(token: string): string {
  const next = safeRedirectPath(`/invites/accept?token=${encodeURIComponent(token)}`, "/dashboard");
  return `${routes.auth.login}?next=${encodeURIComponent(next)}`;
}
