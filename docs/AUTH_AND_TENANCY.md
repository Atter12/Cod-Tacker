# Authentication and tenancy

Supabase Auth owns identity. The database trigger creates the matching `profiles` record when an Auth user is created; application code must not insert profiles directly.

## User flow

1. A user signs in through `/login` with email and password.
2. New accounts created at `/register` receive a 6-digit email OTP and continue at `/verify-otp?email=...&purpose=signup`.
3. OTP is **only** used to confirm email ownership during signup (`supabase.auth.verifyOtp` with `type: "signup"`). It is not a login method.
4. Users can resend the signup code from `/verify-otp`.
5. Successful auth redirects to `/dashboard` (or a validated `next` path).
6. Tenant access is determined through `agency_members` and `store_members`, enforced by RLS.

### Supabase Auth settings for OTP

Enable email confirmation codes in the Supabase project and use a template that includes `{{ .Token }}` (6-digit code) for signup verification.

## Platform administrators

All admin routes except `/admin/login` are inside `app/admin/(platform)/layout.tsx`, which calls `requirePlatformAdmin()` on the server. This guard accepts a profile with `platform_admin` (or the legacy `platform_owner` check) or a user email listed in `ADMIN_ALLOWED_EMAILS`; otherwise it redirects to `/unauthorized`.

The admin login signs in, checks the profile role/email allow-list server-side, then redirects to `/admin` only for a platform administrator.

## Roles

- Platform: `platform_owner`, `platform_admin`, `support`, `analyst`, `user`.
- Agency: `owner`, `admin`, `manager`, `analyst`, `viewer`.
- Store: `owner`, `admin`, `operator`, `analyst`, `viewer`.

Roles are not a substitute for RLS tests. Test every tenant boundary using ordinary anon-key authenticated clients.
