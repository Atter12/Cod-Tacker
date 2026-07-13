-- Agency branding assets bucket (logos, favicons, login backgrounds).
-- Safe to re-run: upserts bucket + recreates policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agency-branding',
  'agency-branding',
  true,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "agency_branding_public_read" on storage.objects;
drop policy if exists "agency_branding_insert" on storage.objects;
drop policy if exists "agency_branding_update" on storage.objects;
drop policy if exists "agency_branding_delete" on storage.objects;

create policy "agency_branding_public_read"
on storage.objects
for select
to public
using (bucket_id = 'agency-branding');

create policy "agency_branding_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'agency-branding');

create policy "agency_branding_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'agency-branding')
with check (bucket_id = 'agency-branding');

create policy "agency_branding_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'agency-branding');
