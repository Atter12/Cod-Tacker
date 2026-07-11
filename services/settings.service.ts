import { throwQueryError, type DatabaseClient } from "./_shared";
import { parseStoreSettings, type StoreSettings } from "@/lib/settings/store-settings";
import type { StoreRow } from "@/types/database";

export type StoreSettingsView = {
  store: Pick<
    StoreRow,
    | "id"
    | "name"
    | "slug"
    | "country_code"
    | "currency_code"
    | "timezone"
    | "default_attribution_model"
    | "attribution_window_days"
    | "is_active"
    | "settings"
  >;
  settings: StoreSettings;
};

export async function getStoreSettingsView(
  client: DatabaseClient,
  storeId: string,
): Promise<StoreSettingsView | null> {
  const { data, error } = await client
    .from("stores")
    .select(
      "id, name, slug, country_code, currency_code, timezone, default_attribution_model, attribution_window_days, is_active, settings",
    )
    .eq("id", storeId)
    .maybeSingle();
  throwQueryError(error);
  if (!data) return null;
  return {
    store: data,
    settings: parseStoreSettings(data.settings),
  };
}
