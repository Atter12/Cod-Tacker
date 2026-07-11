# RLS testing

`scripts/test-rls.mjs` signs in as two normal users using the Supabase anon key. It never uses a service-role key, so it validates user-facing RLS behavior.

## Prepare data

Follow [SEED_DATA.md](./SEED_DATA.md) to create User A/User B, separate agencies, separate stores, and only the matching active membership rows.

## Run

PowerShell example:

```powershell
$env:SUPABASE_URL="https://PROJECT.supabase.co"
$env:ANON_KEY="your-anon-key"
$env:USER_A_EMAIL="user-a@example.test" # Or USER_A_JWT
$env:USER_A_PASSWORD="password-for-a"
$env:USER_B_EMAIL="user-b@example.test" # Or USER_B_JWT
$env:USER_B_PASSWORD="password-for-b"
$env:AGENCY_A_ID="agency-a-uuid"
$env:STORE_A_ID="store-a-uuid"
$env:AGENCY_B_ID="agency-b-uuid"
$env:STORE_B_ID="store-b-uuid"
npm run test:rls
```

The script exits with code `1` for missing variables, failed authentication, query errors, or any failed assertion.

Provide either both user JWTs (`USER_A_JWT`, `USER_B_JWT`) or both email/password pairs. The JWTs must be current user access tokens; neither method uses the service role.

## Scenarios

- User A can read Agency A and Store A.
- User A cannot read Agency B or Store B.
- User B cannot read Agency A or Store A.
- User A cannot insert a store into Agency B (unauthorized write).
- User A cannot update Store B (unauthorized write).

## Role matrix (manual / future automation)

| Role | Expectation |
| --- | --- |
| agency owner/admin | All active stores in agency; billing/api_keys/branding manage |
| agency manager | Store access agency-wide; limited config |
| agency analyst/viewer | Only assigned `store_members` (or none) |
| store operator | orders/shipments manage; no billing |
| store analyst/viewer | read analytics/orders; no manage |
| platform_admin | `/admin` via `requirePlatformAdmin`; UI never uses service role |
| suspended agency/store (`is_active=false`) | Hidden from `getAccessibleStores` |

Permissions are re-checked in Server Actions (`can` / `requirePermission`); hiding UI is not authorization.

Add equivalent insert/update/delete tests when those policies are introduced or changed.
