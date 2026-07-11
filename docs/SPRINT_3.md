# Sprint 3 — Background jobs processor core

Completed scope:

- Additive migration `raw_events` extensions + `background_jobs` + `job_attempts` + `claim_background_jobs` RPC (`20260711140000_background_jobs_pipeline.sql`).
- Temporary TypeScript fallbacks in `types/database.generated.ts` until `supabase gen types`.
- `lib/jobs/` core: deterministic backoff, retryable/permanent errors, idempotent enqueue, claim/process/recover/retry/cancel, mock handlers registry.
- `services/jobs.service.ts` request-scoped list/get helpers for admin UI (RLS).
- `runSync` enqueues raw_events + background_jobs after successful mock sync (keeps `sync_run_items` as telemetry).
- Execution: CLI `scripts/process-jobs.ts`, cron endpoint `POST /api/internal/jobs/process`, optional platform-admin actions.

**Not in Sprint 3:** logistics UI (Sprint 4), live provider adapters, dedicated long-running worker process, infinite retry loops.

## Service-role strategy

| Path | Client | Why |
| --- | --- | --- |
| Enqueue after sync | `createAdminClient()` (service role) | Inserts into `raw_events` / `background_jobs` (no insert policies for authenticated). |
| Claim + process | Service role via `claim_background_jobs` RPC + handler writes | RPC is `SECURITY DEFINER` and granted to `service_role`; domain writes bypass RLS intentionally on the worker path. |
| Admin UI reads | Request-scoped anon/user client | Select policies on jobs/attempts; RLS remains authoritative for listing. |
| Retry / cancel (admin) | Service role or authenticated platform-admin update policy | Platform admins may update jobs via RLS; actions also use admin client for processBatch. |

**Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. The processor must not be triggered from Client Components without going through the authenticated cron secret or platform-admin server action.

## How to run

### CLI (local / ops)

```bash
ALLOW_JOB_WORKER=true npx tsx scripts/process-jobs.ts --limit=10 --queue=default
ALLOW_JOB_WORKER=true npx tsx scripts/process-jobs.ts --recover --limit=20
```

Requires `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ALLOW_JOB_WORKER=true`. Without the flag the script exits immediately (safety guard).

Or: `npm run jobs:process`

### Cron / internal HTTP

`POST /api/internal/jobs/process`

Headers (either):

- `Authorization: Bearer <CRON_SECRET|INTERNAL_JOB_SECRET>`
- `x-cron-secret: <CRON_SECRET|INTERNAL_JOB_SECRET>`

Optional JSON body: `{ "limit": 10, "queue": "default", "recover": true }`

### Platform admin server actions

`app/actions/admin-jobs.ts`: `retryJobAction`, `cancelJobAction`, `processJobsBatchAction` — gated by `requirePlatformAdmin`.

## Handler event types

| Job type | Domain writes |
| --- | --- |
| `shopify.order.created.mock` | `orders` |
| `shopify.order.updated.mock` | `orders` (+ status history) |
| `ads.spend.synced.mock` | `ad_accounts`, `ad_spend_daily` |
| `carrier.shipment.updated.mock` | `carriers`, `shipments`, `shipment_events` |
| `whatsapp.message.received.mock` | `whatsapp_conversations`, `whatsapp_messages` |
| `settlement.batch.received.mock` | `settlement_batches` |

Handlers validate payloads, skip duplicates by external id / `metadata.demo_seed`, and return a sanitized result object for `job_attempts.result`.

## Failure model

- `RetryableJobError` → `retry_scheduled` with deterministic exponential backoff (`lib/jobs/backoff.ts`).
- `PermanentJobError` or attempts ≥ `max_attempts` → `dead_letter` (no infinite loops).
- `recoverStuckJobs` requeues `processing` rows whose lock is older than 15 minutes.

## Future dedicated worker

This sprint intentionally uses on-demand CLI / cron / admin batch processing. A later sprint can run a long-lived worker (same `processJobBatch` + `recoverStuckJobs` loop) as a separate process or container, still authenticated with the service role and still claiming exclusively via `claim_background_jobs` (`FOR UPDATE SKIP LOCKED`).
