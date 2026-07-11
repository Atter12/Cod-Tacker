# Operations runbook

## Health

```bash
curl -s "$NEXT_PUBLIC_APP_URL/api/health" | jq
```

- `ok` — Supabase reachable; queue probe ok
- `degraded` — Supabase ok, queue probe failed (often RLS/anon)
- `down` — Supabase unreachable (HTTP 503)

## Process jobs

**CLI (local):**

```bash
ALLOW_JOB_WORKER=true npm run jobs:process
```

**HTTP cron:**

```bash
curl -X POST "$APP_URL/api/internal/jobs/process" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit":20,"recover":true}'
```

Rate limit: 30 req/min (in-memory per instance). Multi-instance → use external limiter.

## Recover stuck jobs

Pass `"recover": true` to the process endpoint, or rely on admin UI retry.

## Dead-letter

1. Admin → Cola de errores
2. Inspect payload (sanitized in UI)
3. Fix root cause / mapping
4. Retry or cancel

## Sync / integrations

1. Store → Integraciones → provider detail
2. Connect (mock) → Sync / Backfill
3. Operaciones → sync runs
4. `jobs:process` until queue drains

## Demo seed

```bash
ALLOW_DEMO_SEED=true DEMO_AGENCY_ID=… DEMO_STORE_ID=… npm run seed:demo
npm run clear:demo   # only metadata.source=demo_seed
```

## Suspension policy

- `agencies.is_active=false` / `stores.is_active=false` → hidden from `getAccessibleStores`
- Cancelled subscription outside grace → blocked on store create / CSV import

## Alerts of degradation (mock)

Use Automations + Alerts modules; health `degraded`/`down` should be monitored externally in live ops.
