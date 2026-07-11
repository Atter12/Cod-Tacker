-- Sprint 2: sync runs + integration health (additive). Apply after order_notes.
-- Do not edit prior migrations.

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  integration_id uuid not null references public.integrations (id) on delete cascade,
  provider text not null,
  sync_type text not null,
  trigger_source text not null,
  status text not null default 'queued',
  cursor_before text,
  cursor_after text,
  received_total integer not null default 0,
  created_total integer not null default 0,
  updated_total integer not null default 0,
  skipped_total integer not null default 0,
  failed_total integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint sync_runs_sync_type_check check (
    sync_type in ('incremental', 'backfill', 'manual_test')
  ),
  constraint sync_runs_trigger_source_check check (
    trigger_source in ('manual', 'scheduled', 'webhook', 'mock')
  ),
  constraint sync_runs_status_check check (
    status in ('queued', 'running', 'completed', 'partial', 'failed', 'cancelled')
  ),
  constraint sync_runs_totals_non_negative check (
    received_total >= 0
    and created_total >= 0
    and updated_total >= 0
    and skipped_total >= 0
    and failed_total >= 0
  )
);

create index if not exists sync_runs_store_id_created_at_idx
  on public.sync_runs (store_id, created_at desc);

create index if not exists sync_runs_integration_id_created_at_idx
  on public.sync_runs (integration_id, created_at desc);

create index if not exists sync_runs_agency_id_idx on public.sync_runs (agency_id);

create index if not exists sync_runs_status_idx on public.sync_runs (status);

comment on table public.sync_runs is
  'Integration sync execution history (mock or live). Tenant-scoped via store_id/agency_id.';

create table if not exists public.sync_run_items (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references public.sync_runs (id) on delete cascade,
  entity_type text not null,
  external_id text,
  status text not null,
  action text,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sync_run_items_sync_run_id_idx
  on public.sync_run_items (sync_run_id, created_at desc);

comment on table public.sync_run_items is
  'Per-entity outcomes for a sync run. Access via parent sync_runs RLS.';

create table if not exists public.integration_health_checks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  integration_id uuid not null references public.integrations (id) on delete cascade,
  status text not null,
  latency_ms integer,
  checked_at timestamptz not null default now(),
  safe_message text,
  details jsonb not null default '{}'::jsonb,
  constraint integration_health_checks_status_check check (
    status in ('healthy', 'degraded', 'down')
  ),
  constraint integration_health_checks_latency_non_negative check (
    latency_ms is null or latency_ms >= 0
  )
);

create index if not exists integration_health_checks_store_id_checked_at_idx
  on public.integration_health_checks (store_id, checked_at desc);

create index if not exists integration_health_checks_integration_id_checked_at_idx
  on public.integration_health_checks (integration_id, checked_at desc);

create index if not exists integration_health_checks_agency_id_idx
  on public.integration_health_checks (agency_id);

comment on table public.integration_health_checks is
  'Point-in-time health probes for store integrations. Safe messages only.';

-- ---------------------------------------------------------------------------
-- RLS: sync_runs
-- ---------------------------------------------------------------------------
alter table public.sync_runs enable row level security;

drop policy if exists sync_runs_select_store_access on public.sync_runs;
create policy sync_runs_select_store_access
  on public.sync_runs
  for select
  to authenticated
  using (public.has_store_access(store_id) or public.is_platform_admin());

drop policy if exists sync_runs_insert_managers on public.sync_runs;
create policy sync_runs_insert_managers
  on public.sync_runs
  for insert
  to authenticated
  with check (
    (public.has_store_access(store_id)
      and (
        public.has_store_role(
          array['owner', 'admin']::public.store_role[],
          store_id
        )
        or public.has_agency_role(
          agency_id,
          array['owner', 'admin']::public.agency_role[]
        )
      ))
    or public.is_platform_admin()
  );

drop policy if exists sync_runs_update_managers on public.sync_runs;
create policy sync_runs_update_managers
  on public.sync_runs
  for update
  to authenticated
  using (
    (public.has_store_access(store_id)
      and (
        public.has_store_role(
          array['owner', 'admin']::public.store_role[],
          store_id
        )
        or public.has_agency_role(
          agency_id,
          array['owner', 'admin']::public.agency_role[]
        )
      ))
    or public.is_platform_admin()
  )
  with check (
    (public.has_store_access(store_id)
      and (
        public.has_store_role(
          array['owner', 'admin']::public.store_role[],
          store_id
        )
        or public.has_agency_role(
          agency_id,
          array['owner', 'admin']::public.agency_role[]
        )
      ))
    or public.is_platform_admin()
  );

-- ---------------------------------------------------------------------------
-- RLS: sync_run_items (via parent sync_runs)
-- ---------------------------------------------------------------------------
alter table public.sync_run_items enable row level security;

drop policy if exists sync_run_items_select_store_access on public.sync_run_items;
create policy sync_run_items_select_store_access
  on public.sync_run_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sync_runs sr
      where sr.id = sync_run_id
        and (public.has_store_access(sr.store_id) or public.is_platform_admin())
    )
  );

drop policy if exists sync_run_items_insert_managers on public.sync_run_items;
create policy sync_run_items_insert_managers
  on public.sync_run_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.sync_runs sr
      where sr.id = sync_run_id
        and (
          (public.has_store_access(sr.store_id)
            and (
              public.has_store_role(
                array['owner', 'admin']::public.store_role[],
                sr.store_id
              )
              or public.has_agency_role(
                sr.agency_id,
                array['owner', 'admin']::public.agency_role[]
              )
            ))
          or public.is_platform_admin()
        )
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: integration_health_checks
-- ---------------------------------------------------------------------------
alter table public.integration_health_checks enable row level security;

drop policy if exists integration_health_checks_select_store_access on public.integration_health_checks;
create policy integration_health_checks_select_store_access
  on public.integration_health_checks
  for select
  to authenticated
  using (public.has_store_access(store_id) or public.is_platform_admin());

drop policy if exists integration_health_checks_insert_managers on public.integration_health_checks;
create policy integration_health_checks_insert_managers
  on public.integration_health_checks
  for insert
  to authenticated
  with check (
    (public.has_store_access(store_id)
      and (
        public.has_store_role(
          array['owner', 'admin']::public.store_role[],
          store_id
        )
        or public.has_agency_role(
          agency_id,
          array['owner', 'admin']::public.agency_role[]
        )
      ))
    or public.is_platform_admin()
  );
