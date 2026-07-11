-- Sprint 4: carrier mapping version history + unmapped carrier statuses inbox
-- Additive only.

-- ---------------------------------------------------------------------------
-- carrier_status_mapping_versions (audit / restore snapshots)
-- ---------------------------------------------------------------------------
create table if not exists public.carrier_status_mapping_versions (
  id uuid primary key default gen_random_uuid(),
  mapping_id uuid not null references public.carrier_status_mappings (id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  changed_by uuid references auth.users (id) on delete set null,
  change_reason text,
  created_at timestamptz not null default now()
);

create index if not exists carrier_status_mapping_versions_mapping_id_idx
  on public.carrier_status_mapping_versions (mapping_id, created_at desc);

-- ---------------------------------------------------------------------------
-- unmapped_carrier_statuses
-- ---------------------------------------------------------------------------
create table if not exists public.unmapped_carrier_statuses (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies (id) on delete set null,
  carrier_id uuid not null references public.carriers (id) on delete cascade,
  external_status_code text not null,
  external_status_label text,
  sample_payload jsonb not null default '{}'::jsonb,
  occurrence_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint unmapped_carrier_statuses_occurrence_positive check (occurrence_count > 0),
  constraint unmapped_carrier_statuses_unique unique (carrier_id, external_status_code)
);

create index if not exists unmapped_carrier_statuses_carrier_id_idx
  on public.unmapped_carrier_statuses (carrier_id, last_seen_at desc);

create index if not exists unmapped_carrier_statuses_agency_id_idx
  on public.unmapped_carrier_statuses (agency_id)
  where agency_id is not null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.carrier_status_mapping_versions enable row level security;
alter table public.unmapped_carrier_statuses enable row level security;

-- Platform admins manage mapping versions; authenticated may read (catalog audit).
drop policy if exists carrier_status_mapping_versions_select on public.carrier_status_mapping_versions;
create policy carrier_status_mapping_versions_select
  on public.carrier_status_mapping_versions for select to authenticated
  using (true);

drop policy if exists carrier_status_mapping_versions_manage on public.carrier_status_mapping_versions;
create policy carrier_status_mapping_versions_manage
  on public.carrier_status_mapping_versions for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Unmapped: platform admin full manage; agency/store members can read rows for their scope
-- (agency_id match or any connection to the carrier in their stores).
drop policy if exists unmapped_carrier_statuses_select on public.unmapped_carrier_statuses;
create policy unmapped_carrier_statuses_select
  on public.unmapped_carrier_statuses for select to authenticated
  using (
    public.is_platform_admin()
    or (agency_id is not null and public.has_agency_access(agency_id))
    or exists (
      select 1
      from public.carrier_connections cc
      where cc.carrier_id = unmapped_carrier_statuses.carrier_id
        and (
          (cc.store_id is not null and public.has_store_access(cc.store_id))
          or public.has_agency_access(cc.agency_id)
        )
    )
  );

drop policy if exists unmapped_carrier_statuses_manage on public.unmapped_carrier_statuses;
create policy unmapped_carrier_statuses_manage
  on public.unmapped_carrier_statuses for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Ensure platform admins can manage carrier_status_mappings (CRUD from admin UI).
drop policy if exists carrier_status_mappings_platform_manage on public.carrier_status_mappings;
create policy carrier_status_mappings_platform_manage
  on public.carrier_status_mappings for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists carrier_status_mappings_select_authenticated on public.carrier_status_mappings;
create policy carrier_status_mappings_select_authenticated
  on public.carrier_status_mappings for select to authenticated
  using (true);
