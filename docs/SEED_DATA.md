# Tenant seed data

Use two ordinary test users and two separate tenants to verify row-level security. The profiles row is created by the `handle_new_auth_user` database trigger; **never insert into `public.profiles` directly**.

## Create the users

Create User A and User B in Supabase Auth:

- Dashboard: Authentication → Users → Add user.
- Server-side automation: `supabase.auth.admin.createUser(...)` with a service-role client.

Set and retain email/password pairs for both users. Confirm each Auth user has a generated profile before inserting memberships.

## Create tenants and memberships

Use the SQL editor or a secure server-side migration to:

1. Insert Agency A and Agency B with unique names/slugs and their Auth user IDs as `owner_id`.
2. Insert active `agency_members` rows linking User A to Agency A and User B to Agency B.
3. Insert one store per agency.
4. Insert active `store_members` rows linking each user only to the store in their own agency.

Record the four UUIDs as `AGENCY_A_ID`, `STORE_A_ID`, `AGENCY_B_ID`, and `STORE_B_ID` for `npm run test:rls`.

Do not give either test account a platform-admin role or include it in `ADMIN_ALLOWED_EMAILS`; platform access intentionally bypasses tenant isolation.

## Demo seed (operational fixtures)

For a single agency/store already created via onboarding:

```bash
ALLOW_DEMO_SEED=true DEMO_AGENCY_ID=… DEMO_STORE_ID=… npm run seed:demo
npm run clear:demo
```

`seed:demo` tags rows with `metadata.source = demo_seed`. It does **not** replace the A/B RLS fixtures above.

## Optional automation

If extending seed scripts, they may use `SUPABASE_SERVICE_ROLE_KEY` only for `auth.admin.createUser`. Keep them server-side and use returned user IDs for membership inserts. RLS assertions themselves must use the anon key + user JWTs.
