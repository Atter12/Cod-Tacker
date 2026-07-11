import { throwQueryError, type DatabaseClient } from "./_shared";
import type { WhiteLabelSettingsRow } from "@/types/database";

export async function getWhiteLabelSettings(
  client: DatabaseClient,
  agencyId: string,
): Promise<WhiteLabelSettingsRow | null> {
  const { data, error } = await client
    .from("white_label_settings")
    .select("*")
    .eq("agency_id", agencyId)
    .maybeSingle();
  throwQueryError(error);
  return data;
}

export async function getAgencyBrandingFlags(
  client: DatabaseClient,
  agencyId: string,
): Promise<{ is_white_label_enabled: boolean; logo_url: string | null } | null> {
  const { data, error } = await client
    .from("agencies")
    .select("is_white_label_enabled, logo_url")
    .eq("id", agencyId)
    .maybeSingle();
  throwQueryError(error);
  return data;
}
