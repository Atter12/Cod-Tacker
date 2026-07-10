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

## Optional automation

If a seed script is added later, it may use `SUPABASE_SERVICE_ROLE_KEY` only to call `auth.admin.createUser`. Keep it server-side, outside the browser bundle, and use the returned user IDs for membership inserts. It must not bypass RLS for the test assertions themselves.
