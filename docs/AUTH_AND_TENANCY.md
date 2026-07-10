# Authentication and tenancy

Supabase Auth owns identity. The database trigger creates the matching `profiles` record when an Auth user is created; application code must not insert profiles directly.

## User flow

1. A user signs in through `/login`.
2. The normal login action redirects to `/dashboard` (or a validated `next` path).
3. Tenant access is determined through `agency_members` and `store_members`, enforced by RLS.

## Platform administrators

All admin routes except `/admin/login` are inside `app/admin/(platform)/layout.tsx`, which calls `requirePlatformAdmin()` on the server. This guard accepts a profile with `platform_admin` (or the legacy `platform_owner` check) or a user email listed in `ADMIN_ALLOWED_EMAILS`; otherwise it redirects to `/unauthorized`.

The admin login signs in, checks the profile role/email allow-list server-side, then redirects to `/admin` only for a platform administrator.

## Roles

- Platform: `platform_admin`, `platform_member`.
- Agency: `owner`, `admin`, `member`, `viewer`.
- Store: `admin`, `manager`, `analyst`, `viewer`.

Roles are not a substitute for RLS tests. Test every tenant boundary using ordinary anon-key authenticated clients.
