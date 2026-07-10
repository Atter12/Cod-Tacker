# Phases A/B — apply before using invites

1. Run SQL migration in Supabase SQL editor (or `supabase db push`):

`supabase/migrations/20260710220000_agency_invitations_and_tenancy_hardening.sql`

2. Regenerate types (optional if already patched in repo):

```bash
npx supabase gen types typescript --project-id <project-id> --schema public > types/database.generated.ts
```

3. Add redirect URL: `{APP_URL}/invites/accept`

4. Smoke: onboarding → create second store → invite → accept → switcher.

See also `docs/POST_DEPLOY_CHECKLIST.md`.
