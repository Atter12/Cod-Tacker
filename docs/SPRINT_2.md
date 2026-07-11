# Sprint 2 — Mock integrations center & operations health

Completed scope:

- Additive migration `sync_runs`, `sync_run_items`, `integration_health_checks` with RLS.
- Temporary TypeScript fallbacks in `types/database.generated.ts` until `supabase gen types`.
- Expanded `services/integrations.service.ts` (list/connect/disconnect/reconnect/test/sync/backfill/history/health) via the server-only registry.
- Server actions + audit events for integration lifecycle.
- Store UI: Integraciones (DB-backed + catalog), detalle por proveedor, Operaciones, detalle de sync run.
- Nav item **Operaciones**; Spanish copy; `DemoModeBadge` on mock surfaces.
- Unit coverage for sync/health result shapes (`lib/integrations/sync-flow.test.ts`).

**Not in Sprint 2:** live provider adapters, general workers / dead-letter (Sprint 3), external API calls, service-role UI paths.
