-- Sprint 9: billing invoices/usage, API key rate limits, privacy requests
-- Additive only. Existing plans/subscriptions/api_keys/white_label_settings unchanged.

-- ---------------------------------------------------------------------------
-- Demo plans (idempotent). Canonical values live in 20260711220000_plans_catalog_source_of_truth.sql
-- ---------------------------------------------------------------------------
insert into public.plans (code, name, monthly_price, annual_price, currency_code, store_limit, order_limit, features, is_active, is_public)
select 'starter', 'Starter', 49, 470, 'USD', 1, 300,
  '{"api":false,"whatsapp":false,"automations":false,"white_label":false}'::jsonb,
  true, true
where not exists (select 1 from public.plans where code = 'starter');

insert into public.plans (code, name, monthly_price, annual_price, currency_code, store_limit, order_limit, features, is_active, is_public)
select 'growth', 'Growth', 79, 758, 'USD', 3, 1000,
  '{"api":false,"whatsapp":true,"automations":true,"white_label":false}'::jsonb,
  true, true
where not exists (select 1 from public.plans where code = 'growth');

insert into public.plans (code, name, monthly_price, annual_price, currency_code, store_limit, order_limit, features, is_active, is_public)
select 'scale', 'Scale', 189, 1814, 'USD', 5, 5000,
  '{"api":true,"whatsapp":true,"automations":true,"white_label":false}'::jsonb,
  true, true
where not exists (select 1 from public.plans where code = 'scale');

-- ---------------------------------------------------------------------------
-- Invoice records (mock billing — never store card data)
-- ---------------------------------------------------------------------------
create table if not exists public.invoice_records (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  invoice_number text not null,
  status text not null default 'paid',
  currency_code text not null default 'USD',
  amount_cents integer not null default 0,
  period_start timestamptz,
  period_end timestamptz,
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint invoice_records_status_check
    check (status in ('draft', 'open', 'paid', 'void', 'uncollectible')),
  constraint invoice_records_amount_nonneg check (amount_cents >= 0)
);

create unique index if not exists invoice_records_agency_number_uidx
  on public.invoice_records (agency_id, invoice_number);

create index if not exists invoice_records_agency_issued_idx
  on public.invoice_records (agency_id, issued_at desc);

alter table public.invoice_records enable row level security;

drop policy if exists invoice_records_select on public.invoice_records;
create policy invoice_records_select
  on public.invoice_records for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_agency_access(agency_id)
  );

drop policy if exists invoice_records_write on public.invoice_records;
create policy invoice_records_write
  on public.invoice_records for all to authenticated
  using (
    public.is_platform_admin()
    or public.has_agency_role(agency_id, array['owner','admin']::public.agency_role[])
  )
  with check (
    public.is_platform_admin()
    or public.has_agency_role(agency_id, array['owner','admin']::public.agency_role[])
  );

comment on table public.invoice_records is
  'Sprint 9 mock invoices. Demo billing only — no card/PAN storage.';

-- ---------------------------------------------------------------------------
-- Usage counters (orders/stores for plan enforcement)
-- ---------------------------------------------------------------------------
create table if not exists public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  store_id uuid references public.stores (id) on delete cascade,
  metric text not null,
  period_key text not null,
  quantity integer not null default 0,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint usage_counters_metric_check
    check (metric in ('orders', 'stores', 'csv_imports', 'api_requests')),
  constraint usage_counters_qty_nonneg check (quantity >= 0)
);

create unique index if not exists usage_counters_agency_metric_period_uidx
  on public.usage_counters (agency_id, metric, period_key)
  where store_id is null;

create unique index if not exists usage_counters_store_metric_period_uidx
  on public.usage_counters (agency_id, store_id, metric, period_key)
  where store_id is not null;

create index if not exists usage_counters_agency_idx
  on public.usage_counters (agency_id, updated_at desc);

alter table public.usage_counters enable row level security;

drop policy if exists usage_counters_select on public.usage_counters;
create policy usage_counters_select
  on public.usage_counters for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_agency_access(agency_id)
  );

drop policy if exists usage_counters_write on public.usage_counters;
create policy usage_counters_write
  on public.usage_counters for all to authenticated
  using (
    public.is_platform_admin()
    or public.has_agency_role(agency_id, array['owner','admin']::public.agency_role[])
  )
  with check (
    public.is_platform_admin()
    or public.has_agency_role(agency_id, array['owner','admin']::public.agency_role[])
  );

comment on table public.usage_counters is
  'Sprint 9 usage tallies for mock plan limits. period_key is YYYY-MM for monthly metrics.';

-- ---------------------------------------------------------------------------
-- API key rate limiting (persistent, basic)
-- ---------------------------------------------------------------------------
create table if not exists public.api_key_rate_limits (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references public.api_keys (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  window_start timestamptz not null,
  window_seconds integer not null default 60,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint api_key_rate_limits_count_nonneg check (request_count >= 0),
  constraint api_key_rate_limits_window_pos check (window_seconds > 0)
);

create unique index if not exists api_key_rate_limits_key_window_uidx
  on public.api_key_rate_limits (api_key_id, window_start);

create index if not exists api_key_rate_limits_agency_idx
  on public.api_key_rate_limits (agency_id, updated_at desc);

alter table public.api_key_rate_limits enable row level security;

drop policy if exists api_key_rate_limits_select on public.api_key_rate_limits;
create policy api_key_rate_limits_select
  on public.api_key_rate_limits for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_agency_role(agency_id, array['owner','admin']::public.agency_role[])
  );

-- Writes via service role / validated helper only (no broad authenticated write).
drop policy if exists api_key_rate_limits_admin_write on public.api_key_rate_limits;
create policy api_key_rate_limits_admin_write
  on public.api_key_rate_limits for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

comment on table public.api_key_rate_limits is
  'Sprint 9 basic persistent rate-limit windows per API key. Never expose key_hash.';

-- ---------------------------------------------------------------------------
-- Privacy: data export requests (job-backed)
-- ---------------------------------------------------------------------------
create table if not exists public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  store_id uuid references public.stores (id) on delete set null,
  requested_by uuid references auth.users (id) on delete set null,
  scope text not null default 'store',
  status text not null default 'pending',
  job_id uuid references public.background_jobs (id) on delete set null,
  artifact_summary jsonb not null default '{}'::jsonb,
  error_message text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_export_requests_scope_check
    check (scope in ('store', 'agency')),
  constraint data_export_requests_status_check
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled'))
);

create index if not exists data_export_requests_agency_idx
  on public.data_export_requests (agency_id, created_at desc);

alter table public.data_export_requests enable row level security;

drop policy if exists data_export_requests_select on public.data_export_requests;
create policy data_export_requests_select
  on public.data_export_requests for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_agency_access(agency_id)
  );

drop policy if exists data_export_requests_write on public.data_export_requests;
create policy data_export_requests_write
  on public.data_export_requests for all to authenticated
  using (
    public.is_platform_admin()
    or public.has_agency_role(agency_id, array['owner','admin']::public.agency_role[])
  )
  with check (
    public.is_platform_admin()
    or public.has_agency_role(agency_id, array['owner','admin']::public.agency_role[])
  );

comment on table public.data_export_requests is
  'Sprint 9 privacy export requests. Artifact is a summary snapshot — not a download CDN.';

-- ---------------------------------------------------------------------------
-- Privacy: deletion / anonymization requests (approval workflow, no instant wipe)
-- ---------------------------------------------------------------------------
create table if not exists public.data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  store_id uuid references public.stores (id) on delete set null,
  requested_by uuid references auth.users (id) on delete set null,
  scope text not null default 'store',
  reason text,
  status text not null default 'pending_approval',
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_deletion_requests_scope_check
    check (scope in ('store', 'agency')),
  constraint data_deletion_requests_status_check
    check (status in (
      'pending_approval',
      'approved_awaiting_execution',
      'rejected',
      'cancelled',
      'executed_mock'
    ))
);

create index if not exists data_deletion_requests_agency_idx
  on public.data_deletion_requests (agency_id, created_at desc);

alter table public.data_deletion_requests enable row level security;

drop policy if exists data_deletion_requests_select on public.data_deletion_requests;
create policy data_deletion_requests_select
  on public.data_deletion_requests for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_agency_access(agency_id)
  );

drop policy if exists data_deletion_requests_write on public.data_deletion_requests;
create policy data_deletion_requests_write
  on public.data_deletion_requests for all to authenticated
  using (
    public.is_platform_admin()
    or public.has_agency_role(agency_id, array['owner','admin']::public.agency_role[])
  )
  with check (
    public.is_platform_admin()
    or public.has_agency_role(agency_id, array['owner','admin']::public.agency_role[])
  );

comment on table public.data_deletion_requests is
  'Sprint 9 deletion/anonymization workflow. Destructive wipe is never immediate; executed_mock is demo-only.';

-- Document store.settings schema version expectation
comment on column public.stores.settings is
  'JSON settings. Sprint 9 schema_version=1: rto, cod, alerts, demo keys. Validate via lib/settings/store-settings.ts';
