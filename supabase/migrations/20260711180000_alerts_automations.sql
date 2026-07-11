-- Sprint 7: alerts operational fields + alert_notes + automation rule/run extensions
-- Additive only.

-- ---------------------------------------------------------------------------
-- alerts extensions
-- ---------------------------------------------------------------------------
alter table public.alerts
  add column if not exists assigned_to uuid references auth.users (id) on delete set null,
  add column if not exists status text not null default 'open',
  add column if not exists silenced_until timestamptz,
  add column if not exists source_type text,
  add column if not exists source_id text,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.alerts
    add constraint alerts_status_check
    check (status in ('open', 'acknowledged', 'resolved', 'silenced', 'reopened'));
exception when duplicate_object then null;
end $$;

create index if not exists alerts_store_status_idx
  on public.alerts (store_id, status, created_at desc)
  where store_id is not null;

create index if not exists alerts_store_severity_idx
  on public.alerts (store_id, severity, created_at desc)
  where store_id is not null;

create index if not exists alerts_assigned_to_idx
  on public.alerts (assigned_to)
  where assigned_to is not null;

-- ---------------------------------------------------------------------------
-- alert_notes
-- ---------------------------------------------------------------------------
create table if not exists public.alert_notes (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  store_id uuid references public.stores (id) on delete cascade,
  alert_id uuid not null references public.alerts (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint alert_notes_body_len check (char_length(body) between 1 and 4000)
);

create index if not exists alert_notes_alert_id_idx
  on public.alert_notes (alert_id, created_at asc);

alter table public.alert_notes enable row level security;

drop policy if exists alert_notes_select on public.alert_notes;
create policy alert_notes_select
  on public.alert_notes for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_agency_access(agency_id)
    or (store_id is not null and public.has_store_access(store_id))
  );

drop policy if exists alert_notes_insert on public.alert_notes;
create policy alert_notes_insert
  on public.alert_notes for insert to authenticated
  with check (
    public.is_platform_admin()
    or public.has_agency_access(agency_id)
    or (store_id is not null and public.has_store_access(store_id))
  );

-- Ensure alerts can be updated by store members
drop policy if exists alerts_tenant_update on public.alerts;
create policy alerts_tenant_update
  on public.alerts for update to authenticated
  using (
    public.is_platform_admin()
    or public.has_agency_access(agency_id)
    or (store_id is not null and public.has_store_access(store_id))
  )
  with check (
    public.is_platform_admin()
    or public.has_agency_access(agency_id)
    or (store_id is not null and public.has_store_access(store_id))
  );

drop policy if exists alerts_tenant_insert on public.alerts;
create policy alerts_tenant_insert
  on public.alerts for insert to authenticated
  with check (
    public.is_platform_admin()
    or public.has_agency_access(agency_id)
    or (store_id is not null and public.has_store_access(store_id))
  );

-- ---------------------------------------------------------------------------
-- automation_rules extensions
-- ---------------------------------------------------------------------------
alter table public.automation_rules
  add column if not exists priority integer not null default 100,
  add column if not exists requires_manual_approval boolean not null default false,
  add column if not exists description text,
  add column if not exists last_triggered_at timestamptz;

create index if not exists automation_rules_store_trigger_idx
  on public.automation_rules (store_id, trigger_type, is_active)
  where store_id is not null;

drop policy if exists automation_rules_tenant_write on public.automation_rules;
create policy automation_rules_tenant_write
  on public.automation_rules for all to authenticated
  using (
    public.is_platform_admin()
    or public.has_agency_access(agency_id)
    or (store_id is not null and public.has_store_access(store_id))
  )
  with check (
    public.is_platform_admin()
    or public.has_agency_access(agency_id)
    or (store_id is not null and public.has_store_access(store_id))
  );

-- ---------------------------------------------------------------------------
-- automation_runs extensions (idempotency + approval)
-- ---------------------------------------------------------------------------
alter table public.automation_runs
  add column if not exists idempotency_key text,
  add column if not exists entity_type text,
  add column if not exists entity_id text,
  add column if not exists approval_status text,
  add column if not exists approved_by uuid references auth.users (id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists automation_runs_idempotency_uidx
  on public.automation_runs (agency_id, rule_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists automation_runs_rule_created_idx
  on public.automation_runs (rule_id, created_at desc);

drop policy if exists automation_runs_tenant_select on public.automation_runs;
create policy automation_runs_tenant_select
  on public.automation_runs for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_agency_access(agency_id)
    or (store_id is not null and public.has_store_access(store_id))
  );

drop policy if exists automation_runs_tenant_update on public.automation_runs;
create policy automation_runs_tenant_update
  on public.automation_runs for update to authenticated
  using (
    public.is_platform_admin()
    or public.has_agency_access(agency_id)
    or (store_id is not null and public.has_store_access(store_id))
  )
  with check (
    public.is_platform_admin()
    or public.has_agency_access(agency_id)
    or (store_id is not null and public.has_store_access(store_id))
  );

-- Inserts typically via service role / executor; allow tenant insert for simulate approval flows
drop policy if exists automation_runs_tenant_insert on public.automation_runs;
create policy automation_runs_tenant_insert
  on public.automation_runs for insert to authenticated
  with check (
    public.is_platform_admin()
    or public.has_agency_access(agency_id)
    or (store_id is not null and public.has_store_access(store_id))
  );
