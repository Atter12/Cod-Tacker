-- Allow agency owners/admins to read/write their white_label_settings row.
-- Branding uploads were failing because Storage succeeded but the follow-up
-- UPDATE/INSERT on this table was blocked (no write policies in repo).

alter table public.white_label_settings enable row level security;

drop policy if exists white_label_settings_select on public.white_label_settings;
create policy white_label_settings_select
  on public.white_label_settings for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_agency_access(agency_id)
  );

drop policy if exists white_label_settings_write on public.white_label_settings;
create policy white_label_settings_write
  on public.white_label_settings for all to authenticated
  using (
    public.is_platform_admin()
    or public.has_agency_role(agency_id, array['owner','admin']::public.agency_role[])
  )
  with check (
    public.is_platform_admin()
    or public.has_agency_role(agency_id, array['owner','admin']::public.agency_role[])
  );

comment on table public.white_label_settings is
  'Agency white-label branding. Writable by agency owner/admin (and platform admins).';
