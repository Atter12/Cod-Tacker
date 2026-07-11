-- Sprint 5: reconciliation CSV matching fields on settlement_items / settlement_batches
-- Additive only. Does not recreate base settlement tables.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.settlement_match_status as enum (
    'matched',
    'unmatched',
    'difference',
    'duplicate',
    'disputed',
    'resolved'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.settlement_match_method as enum (
    'tracking',
    'external_shipment_id',
    'external_order_id',
    'order_number',
    'amount_time_suggestion',
    'manual'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- settlement_batches: approval / processing metadata columns
-- ---------------------------------------------------------------------------
alter table public.settlement_batches
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users (id) on delete set null,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_finished_at timestamptz,
  add column if not exists import_row_count integer,
  add column if not exists import_error_count integer;

comment on column public.settlement_batches.source_file_path is
  'Optional Storage object path when upload storage is configured; never stores full CSV body.';

-- ---------------------------------------------------------------------------
-- settlement_items: CSV row + matching fields
-- ---------------------------------------------------------------------------
alter table public.settlement_items
  add column if not exists source_row_number integer,
  add column if not exists raw_row jsonb not null default '{}'::jsonb,
  add column if not exists match_method public.settlement_match_method,
  add column if not exists match_confidence numeric(5,4),
  add column if not exists match_status public.settlement_match_status not null default 'unmatched',
  add column if not exists resolution_status public.settlement_match_status,
  add column if not exists resolved_by uuid references auth.users (id) on delete set null,
  add column if not exists resolved_at timestamptz,
  add column if not exists discrepancy_reason text,
  add column if not exists order_number text,
  add column if not exists external_order_id text,
  add column if not exists external_shipment_id text,
  add column if not exists currency_code text,
  add column if not exists row_occurred_at timestamptz,
  add column if not exists collected_applied_at timestamptz,
  add column if not exists settled_applied_at timestamptz;

create index if not exists settlement_items_batch_match_status_idx
  on public.settlement_items (batch_id, match_status);

create index if not exists settlement_items_store_match_status_idx
  on public.settlement_items (store_id, match_status);

create index if not exists settlement_items_tracking_idx
  on public.settlement_items (store_id, tracking_number)
  where tracking_number is not null;

create index if not exists settlement_items_order_number_idx
  on public.settlement_items (store_id, order_number)
  where order_number is not null;

create unique index if not exists settlement_items_batch_source_row_uidx
  on public.settlement_items (batch_id, source_row_number)
  where source_row_number is not null;

-- ---------------------------------------------------------------------------
-- RLS notes: existing settlement_* policies remain authoritative for tenant
-- SELECT/UPDATE. Worker writes use service role. No new tables → no new
-- policy blocks required beyond ensuring authenticated can update items in scope.
-- ---------------------------------------------------------------------------

-- Allow store managers to update settlement items/batches in their store
-- (approve, resolve, manual match). Platform admins already covered if present.
drop policy if exists settlement_batches_tenant_update on public.settlement_batches;
create policy settlement_batches_tenant_update
  on public.settlement_batches for update to authenticated
  using (
    public.is_platform_admin()
    or public.has_store_access(store_id)
    or public.has_agency_access(agency_id)
  )
  with check (
    public.is_platform_admin()
    or public.has_store_access(store_id)
    or public.has_agency_access(agency_id)
  );

drop policy if exists settlement_items_tenant_update on public.settlement_items;
create policy settlement_items_tenant_update
  on public.settlement_items for update to authenticated
  using (
    public.is_platform_admin()
    or public.has_store_access(store_id)
    or public.has_agency_access(agency_id)
  )
  with check (
    public.is_platform_admin()
    or public.has_store_access(store_id)
    or public.has_agency_access(agency_id)
  );

-- Inserts for CSV import go through service-role job worker; optional policy for
-- platform admin insert (not required for tenant UI which enqueues jobs).
drop policy if exists settlement_batches_platform_insert on public.settlement_batches;
create policy settlement_batches_platform_insert
  on public.settlement_batches for insert to authenticated
  with check (public.is_platform_admin());

drop policy if exists settlement_items_platform_insert on public.settlement_items;
create policy settlement_items_platform_insert
  on public.settlement_items for insert to authenticated
  with check (public.is_platform_admin());
