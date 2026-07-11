-- Sprint 3: raw_events extensions + background_jobs + job_attempts + atomic claim RPC
-- Additive only. Processor writes use service role server-side (documented in docs/SPRINT_3.md).

-- ---------------------------------------------------------------------------
-- raw_events: add missing columns (keep attempts, next_retry_at, processed_at, last_error)
-- ---------------------------------------------------------------------------
alter table public.raw_events
  add column if not exists correlation_id uuid,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists dead_lettered_at timestamptz,
  add column if not exists max_attempts integer not null default 8,
  add column if not exists error_code text,
  add column if not exists payload_hash text;

create unique index if not exists raw_events_idempotency_unique
  on public.raw_events (agency_id, coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid), provider, idempotency_key);

create index if not exists raw_events_status_retry_idx
  on public.raw_events (status, next_retry_at)
  where status in ('received', 'retrying', 'failed');

create index if not exists raw_events_correlation_id_idx
  on public.raw_events (correlation_id)
  where correlation_id is not null;

-- ---------------------------------------------------------------------------
-- Enums for jobs (idempotent)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'background_job_status') then
    create type public.background_job_status as enum (
      'queued', 'processing', 'completed', 'retry_scheduled', 'failed', 'dead_letter', 'cancelled'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'job_attempt_status') then
    create type public.job_attempt_status as enum (
      'started', 'completed', 'failed', 'cancelled'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- background_jobs
-- ---------------------------------------------------------------------------
create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  store_id uuid references public.stores (id) on delete cascade,
  raw_event_id uuid references public.raw_events (id) on delete set null,
  integration_id uuid references public.integrations (id) on delete set null,
  queue text not null default 'default',
  job_type text not null,
  status public.background_job_status not null default 'queued',
  priority integer not null default 100,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  attempts integer not null default 0,
  max_attempts integer not null default 8,
  run_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  started_at timestamptz,
  finished_at timestamptz,
  last_error_code text,
  last_error_message text,
  correlation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint background_jobs_attempts_nonneg check (attempts >= 0),
  constraint background_jobs_max_attempts_positive check (max_attempts > 0)
);

create unique index if not exists background_jobs_idempotency_unique
  on public.background_jobs (agency_id, coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid), job_type, idempotency_key);

create index if not exists background_jobs_claim_idx
  on public.background_jobs (status, run_at, priority, created_at)
  where status in ('queued', 'retry_scheduled');

create index if not exists background_jobs_store_id_idx on public.background_jobs (store_id);
create index if not exists background_jobs_raw_event_id_idx on public.background_jobs (raw_event_id);
create index if not exists background_jobs_correlation_id_idx on public.background_jobs (correlation_id);

drop trigger if exists background_jobs_set_updated_at on public.background_jobs;
create trigger background_jobs_set_updated_at
  before update on public.background_jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- job_attempts
-- ---------------------------------------------------------------------------
create table if not exists public.job_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.background_jobs (id) on delete cascade,
  attempt_number integer not null,
  status public.job_attempt_status not null default 'started',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  error_code text,
  error_message text,
  result jsonb,
  created_at timestamptz not null default now(),
  constraint job_attempts_number_positive check (attempt_number > 0),
  constraint job_attempts_unique_number unique (job_id, attempt_number)
);

create index if not exists job_attempts_job_id_idx on public.job_attempts (job_id, attempt_number desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.background_jobs enable row level security;
alter table public.job_attempts enable row level security;

drop policy if exists background_jobs_select_access on public.background_jobs;
create policy background_jobs_select_access
  on public.background_jobs for select to authenticated
  using (
    public.is_platform_admin()
    or (store_id is not null and public.has_store_access(store_id))
    or public.has_agency_access(agency_id)
  );

drop policy if exists job_attempts_select_access on public.job_attempts;
create policy job_attempts_select_access
  on public.job_attempts for select to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.background_jobs j
      where j.id = job_id
        and (
          public.is_platform_admin()
          or (j.store_id is not null and public.has_store_access(j.store_id))
          or public.has_agency_access(j.agency_id)
        )
    )
  );

-- Platform admins may update jobs for retry/cancel from the admin console (authenticated client).
drop policy if exists background_jobs_update_platform on public.background_jobs;
create policy background_jobs_update_platform
  on public.background_jobs for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Atomic claim RPC (security definer, minimal grants)
-- Worker authenticates via service role; claim still goes through this function
-- to avoid lost updates under concurrency.
-- ---------------------------------------------------------------------------
create or replace function public.claim_background_jobs(
  p_worker_id text,
  p_limit integer default 10,
  p_queue text default 'default'
)
returns setof public.background_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_worker_id is null or length(trim(p_worker_id)) = 0 then
    raise exception 'worker_id_required';
  end if;

  return query
  with candidates as (
    select j.id
    from public.background_jobs j
    where j.queue = coalesce(nullif(trim(p_queue), ''), 'default')
      and j.status in ('queued', 'retry_scheduled')
      and j.run_at <= now()
    order by j.priority asc, j.run_at asc, j.created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ),
  updated as (
    update public.background_jobs j
    set
      status = 'processing',
      locked_at = now(),
      locked_by = p_worker_id,
      started_at = coalesce(j.started_at, now()),
      attempts = j.attempts + 1,
      updated_at = now()
    from candidates c
    where j.id = c.id
    returning j.*
  )
  select * from updated;
end;
$$;

revoke all on function public.claim_background_jobs(text, integer, text) from public;
revoke all on function public.claim_background_jobs(text, integer, text) from anon;
revoke all on function public.claim_background_jobs(text, integer, text) from authenticated;
-- Service role bypasses RLS; grant execute to service_role for clarity in Supabase.
grant execute on function public.claim_background_jobs(text, integer, text) to service_role;

comment on function public.claim_background_jobs is
  'Atomically claims queued jobs with FOR UPDATE SKIP LOCKED. Intended for server-only workers using the service role.';

comment on table public.background_jobs is
  'Async work units derived from raw_events / manual enqueue. Processed by internal worker scripts/endpoints.';
