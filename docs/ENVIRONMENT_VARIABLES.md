# Environment variables

Copy `.env.example` to `.env.local` for local development. Do not commit real credentials.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Yes | Public application URL. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser/request Supabase key. |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | Yes | Default locale, normally `es-PE`. |
| `NEXT_PUBLIC_DEFAULT_TIMEZONE` | Yes | Default timezone, normally `America/Lima`. |
| `ADMIN_ALLOWED_EMAILS` | No | Comma-separated emergency allow-list for platform admin access. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Privileged backend operations (onboarding membership bootstrap, admin jobs); never expose to clients. |
| `ENCRYPTION_KEY` | Server only | Encryption material for sensitive server-side data. |
| `INTERNAL_JOB_SECRET` | Server only | Authenticates internal jobs. |
| `CRON_SECRET` | Server only | Authenticates scheduled requests. |
| `WEBHOOK_GLOBAL_SECRET` | Server only | Validates webhook sources. |
| `INTEGRATION_MODE` | Server only | `mock` or `live`. Defaults to `mock` outside production; **required** when resolving providers in production. |
| `MOCK_INTEGRATIONS_ENABLED` | Server only | `true`/`false`. When unset, follows `INTEGRATION_MODE===mock`. |
| `ALLOW_JOB_WORKER` | Server / CLI only | Must be `true` to run `scripts/process-jobs.ts`. Cron endpoint uses secrets below instead. |
| `SETTLEMENT_CSV_BUCKET` | Server only | Optional Supabase Storage bucket for CSV path metadata. If unset, Sprint 5 import processes rows server-side without storing the file body. |
| `ALLOW_DEMO_SEED` | Seed CLI only | Must be `true` to run `npm run seed:demo`. |
| `DEMO_AGENCY_ID` | Seed CLI only | Target agency UUID for demo seed. |
| `DEMO_STORE_ID` | Seed CLI only | Target store UUID (must belong to agency). |

`scripts/test-rls.mjs` uses separate `SUPABASE_URL` and `ANON_KEY` variables so its purpose is explicit. See [RLS_TESTING.md](./RLS_TESTING.md).

Never expose `SUPABASE_SERVICE_ROLE_KEY`, job secrets, or provider credentials to Client Components.
