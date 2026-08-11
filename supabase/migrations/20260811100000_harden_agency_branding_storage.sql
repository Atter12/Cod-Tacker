-- Harden agency-branding Storage: remove open authenticated write.
-- Uploads already go through server actions with service role (app/actions/branding.ts),
-- so client-side insert/update/delete policies are unnecessary and allow any
-- logged-in user to overwrite any object in the bucket.
-- Public read stays (logos/favicons are meant to be publicly fetchable).

drop policy if exists "agency_branding_insert" on storage.objects;
drop policy if exists "agency_branding_update" on storage.objects;
drop policy if exists "agency_branding_delete" on storage.objects;

-- Keep public read for CDN/public URLs.
-- Recreate only if missing (idempotent with prior migration).
drop policy if exists "agency_branding_public_read" on storage.objects;
create policy "agency_branding_public_read"
on storage.objects
for select
to public
using (bucket_id = 'agency-branding');
