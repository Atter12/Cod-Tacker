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
| `SHOPIFY_CLIENT_ID` | Server only | Shopify app Client ID (global). |
| `SHOPIFY_CLIENT_SECRET` | Server only | Shopify app Client Secret (global). Never `NEXT_PUBLIC_*`. |
| `SHOPIFY_APP_URL` | Server only | Public app base URL (defaults to `NEXT_PUBLIC_APP_URL`). |
| `SHOPIFY_REDIRECT_URI` | Server only | OAuth callback URL (defaults to `{APP_URL}/api/integrations/shopify/callback`). |
| `SHOPIFY_API_VERSION` | Server only | Admin API version, e.g. `2026-07`. |
| `SHOPIFY_SCOPES` | Server only | Comma-separated OAuth scopes. Include `write_script_tags` to auto-install storefront UTM ScriptTag on connect. |
| `SHOPIFY_APP_URL` webhook path | — | Live order webhooks POST to `{SHOPIFY_APP_URL}/api/integrations/shopify/webhooks`. |
| `SHOPIFY_APP_URL` attribution script | — | ScriptTag src `{SHOPIFY_APP_URL}/shopify/codtracked-attribution.js` must be publicly reachable (no Vercel Deployment Protection login). |
| `ALLOW_JOB_WORKER` | Server / CLI only | Must be `true` to run `scripts/process-jobs.ts`. Cron endpoint uses secrets below instead. |
| `SETTLEMENT_CSV_BUCKET` | Server only | Optional Supabase Storage bucket for CSV path metadata. If unset, Sprint 5 import processes rows server-side without storing the file body. |
| `ALLOW_DEMO_SEED` | Seed CLI only | Must be `true` to run `npm run seed:demo`. |
| `DEMO_AGENCY_ID` | Seed CLI only | Target agency UUID for demo seed. |
| `DEMO_STORE_ID` | Seed CLI only | Target store UUID (must belong to agency). |
| `BILLING_PROVIDER` | Server only | `demo` (default) or `stripe`. Independent of `INTEGRATION_MODE`. |
| `STRIPE_SECRET_KEY` | Server only | Stripe secret key (`sk_test_…` / `sk_live_…`). Required when `BILLING_PROVIDER=stripe`. |
| `STRIPE_WEBHOOK_SECRET` | Server only | Stripe webhook signing secret (`whsec_…`). Required to accept `/api/billing/webhooks/stripe`. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public | Optional until client-side Stripe Elements are used. |
| `STRIPE_API_VERSION` | Server only | Optional; defaults to SDK pin (`2026-06-24.dahlia`). |
| `STRIPE_PRICE_STARTER_MONTH` / `_YEAR` | Server only | Fallback Stripe Price IDs when `plan_provider_prices` has no row. Same for `GROWTH` and `SCALE`. |

Webhook URL (Stripe Dashboard): `{NEXT_PUBLIC_APP_URL}/api/billing/webhooks/stripe`.

`scripts/test-rls.mjs` uses separate `SUPABASE_URL` and `ANON_KEY` variables so its purpose is explicit. See [RLS_TESTING.md](./RLS_TESTING.md).

Never expose `SUPABASE_SERVICE_ROLE_KEY`, job secrets, or provider credentials to Client Components.
