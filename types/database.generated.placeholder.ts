/**
 * Compatibility shim.
 * Prefer importing from `@/types/database` for Row aliases.
 * Regenerate the source of truth with:
 *
 *   npx supabase gen types typescript --project-id PROJECT_ID --schema public > types/database.generated.ts
 */
export type {
  CompositeTypes,
  Database,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "./database.generated";
export * from "./database";
