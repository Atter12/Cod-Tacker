# Post-deploy checklist (CODTracked)

Use this after every production deploy. Do not treat the product as beta-ready until every item passes.

## Platform

- [ ] Vercel deployment status is **Ready** (not Paused / Failed)
- [ ] Production build completed (`Installing dependencies` → `next build` → Deploy)
- [ ] If spend-management paused the project, click **Unpause** then Redeploy
- [ ] Domains resolve (`NEXT_PUBLIC_APP_URL`)

## Environment variables (Vercel + local)

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_APP_URL` | Yes | Canonical app URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key only |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server) | **Never** expose to client / `NEXT_PUBLIC_*` |
| `ADMIN_ALLOWED_EMAILS` | Optional | Comma-separated platform admin allowlist |
| `ALLOW_DEMO_SEED` | Seed only | Must be `true` to run `npm run seed:demo` |
| `DEMO_AGENCY_ID` | Seed only | Target agency UUID |
| `DEMO_STORE_ID` | Seed only | Target store UUID (must belong to agency) |

## Supabase Auth → URL Configuration

Site URL: same as `NEXT_PUBLIC_APP_URL`

Redirect URLs (add all that apply):

- `{APP_URL}/auth/callback`
- `{APP_URL}/verify-otp`
- `{APP_URL}/reset-password`
- `{APP_URL}/invites/accept`
- `{APP_URL}/**` (optional wildcard for previews)

## Auth smoke tests

- [ ] Register → OTP / email confirm → session
- [ ] Login with password
- [ ] Forgot password → email → `/auth/callback` → `/reset-password` → dashboard
- [ ] Logout from avatar menu → `/login`
- [ ] Authenticated user can open `/profile` and save name

## Tenancy smoke tests

- [ ] New user onboarding creates agency + first store → store dashboard
- [ ] Owner creates a second store from Agency → Tiendas
- [ ] Both stores appear in TenantSwitcher
- [ ] Entering each store works (no `/unauthorized`)
- [ ] Invite admin/analyst/viewer → accept at `/invites/accept?token=…`
- [ ] Analyst/viewer without `store_members` cannot see unassigned stores
- [ ] Owner/admin/manager see all active agency stores

## Isolation (tenant A / B)

- [ ] `npm run test:rls` with seeded User A / User B (see `docs/SEED_DATA.md` + `docs/RLS_TESTING.md`)
- [ ] User A cannot read Agency B / Store B by ID

## Types & quality

- [ ] Types regenerated after migrations: `npx supabase gen types typescript --project-id <id> --schema public > types/database.generated.ts`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] Browser console clean on store dashboard

## Demo data (optional)

- [ ] `ALLOW_DEMO_SEED=true DEMO_AGENCY_ID=… DEMO_STORE_ID=… npm run seed:demo`
- [ ] Dashboard KPIs non-zero for that store
- [ ] `npm run clear:demo` removes only `metadata.source = demo_seed` rows

## E2E matrix (Integration-Ready V1)

- [ ] Walk [E2E_MATRIX.md](./E2E_MATRIX.md) steps 1–16 in mock mode (no manual DB edits)
- [ ] `npm run e2e:matrix` (health + plans probe)
- [ ] `ALLOW_JOB_WORKER=true npm run jobs:process` drains queue after syncs
- [ ] Admin can retry a failed/dead-letter job
- [ ] Suspended agency/store is inaccessible to members
- [ ] `INTEGRATION_MODE=mock` (or unset outside prod) — no live provider calls

## Quality gate

- [ ] `npm run validate` (lint + typecheck + test:unit + build)
- [ ] Migrations applied through `20260711210000_sprint10_performance_indexes.sql`
