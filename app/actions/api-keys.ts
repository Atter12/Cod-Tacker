"use server";

import { revalidatePath } from "next/cache";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requireUser } from "@/lib/auth/require-user";
import { routes } from "@/config/routes";
import { ValidationError } from "@/lib/errors";
import type { Role } from "@/config/permissions";
import { can } from "@/lib/permissions/can";
import {
  API_KEY_SCOPES,
  generateApiKey,
  isAllowedScope,
  type ApiKeyScope,
} from "@/lib/api-keys/crypto";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";

export type ApiKeyActionResult = ActionResult<{
  plaintext?: string;
  keyId?: string;
  keyPrefix?: string;
}>;

function assertApiKeysManage(roles: readonly Role[]) {
  if (!can(roles, "api_keys.manage")) {
    throw new ValidationError("No tienes permiso para gestionar claves API.");
  }
}

function parseScopes(scopes: string[]): ApiKeyScope[] {
  const unique = [...new Set(scopes.map((s) => s.trim()).filter(Boolean))];
  if (!unique.length) throw new ValidationError("Selecciona al menos un alcance.");
  for (const s of unique) {
    if (!isAllowedScope(s)) throw new ValidationError(`Alcance no permitido: ${s}`);
  }
  return unique as ApiKeyScope[];
}

export async function createApiKey(
  agencySlug: string,
  input: {
    name: string;
    scopes: string[];
    expiresAt?: string | null;
    storeId?: string | null;
    confirm: boolean;
  },
): Promise<ApiKeyActionResult> {
  try {
    if (!input.confirm) {
      throw new ValidationError("Confirma que guardarás la clave; solo se mostrará una vez.");
    }
    const name = input.name.trim();
    if (!name || name.length > 80) throw new ValidationError("Nombre de clave inválido.");
    const scopes = parseScopes(input.scopes);

    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    assertApiKeysManage(membership.roles);

    const generated = generateApiKey();
    const client = await createClient();

    const { data, error } = await client
      .from("api_keys")
      .insert({
        agency_id: membership.agencyId,
        store_id: input.storeId ?? null,
        name,
        key_hash: generated.keyHash,
        key_prefix: generated.keyPrefix,
        scopes,
        status: "active",
        expires_at: input.expiresAt || null,
        created_by: user.id,
      })
      .select("id, key_prefix")
      .single();

    if (error) throw error;

    await writeAuditLog({
      action: "api_key_created",
      entityType: "api_key",
      entityId: data.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: input.storeId ?? null,
      newData: { name, keyPrefix: data.key_prefix, scopes },
    });

    revalidatePath(routes.agency.apiKeys(agencySlug));
    return actionOk({
      plaintext: generated.plaintext,
      keyId: data.id,
      keyPrefix: data.key_prefix,
    });
  } catch (error) {
    return actionFail(error);
  }
}

export async function rotateApiKey(
  agencySlug: string,
  keyId: string,
  confirm: boolean,
): Promise<ApiKeyActionResult> {
  try {
    if (!confirm) throw new ValidationError("Confirma la rotación de la clave.");
    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    assertApiKeysManage(membership.roles);

    const client = await createClient();
    const { data: existing } = await client
      .from("api_keys")
      .select("id, name, scopes, status")
      .eq("id", keyId)
      .eq("agency_id", membership.agencyId)
      .maybeSingle();
    if (!existing) throw new ValidationError("Clave no encontrada.");
    if (existing.status === "revoked") throw new ValidationError("No se puede rotar una clave revocada.");

    const generated = generateApiKey();
    const { error } = await client
      .from("api_keys")
      .update({
        key_hash: generated.keyHash,
        key_prefix: generated.keyPrefix,
        status: "active",
        revoked_at: null,
      })
      .eq("id", keyId)
      .eq("agency_id", membership.agencyId);
    if (error) throw error;

    await writeAuditLog({
      action: "api_key_rotated",
      entityType: "api_key",
      entityId: keyId,
      actorId: user.id,
      agencyId: membership.agencyId,
      newData: { keyPrefix: generated.keyPrefix },
    });

    revalidatePath(routes.agency.apiKeys(agencySlug));
    return actionOk({
      plaintext: generated.plaintext,
      keyId,
      keyPrefix: generated.keyPrefix,
    });
  } catch (error) {
    return actionFail(error);
  }
}

export async function revokeApiKey(
  agencySlug: string,
  keyId: string,
  confirm: boolean,
): Promise<ApiKeyActionResult> {
  try {
    if (!confirm) throw new ValidationError("Confirma la revocación de la clave.");
    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    assertApiKeysManage(membership.roles);

    const client = await createClient();
    const now = new Date().toISOString();
    const { error } = await client
      .from("api_keys")
      .update({ status: "revoked", revoked_at: now })
      .eq("id", keyId)
      .eq("agency_id", membership.agencyId);
    if (error) throw error;

    await writeAuditLog({
      action: "api_key_revoked",
      entityType: "api_key",
      entityId: keyId,
      actorId: user.id,
      agencyId: membership.agencyId,
    });

    revalidatePath(routes.agency.apiKeys(agencySlug));
    return actionOk({ keyId });
  } catch (error) {
    return actionFail(error);
  }
}

export async function listAllowedApiKeyScopes(): Promise<readonly string[]> {
  return API_KEY_SCOPES;
}
