-- Sprint 10: performance indexes for common list filters (additive only).

-- Orders list filters
create index if not exists orders_store_created_idx
  on public.orders (store_id, created_at desc);

create index if not exists orders_store_status_created_idx
  on public.orders (store_id, order_status, created_at desc);

create index if not exists orders_store_payment_created_idx
  on public.orders (store_id, payment_status, created_at desc);

-- Shipments / logistics
create index if not exists shipments_store_updated_idx
  on public.shipments (store_id, updated_at desc);

create index if not exists shipment_events_shipment_occurred_idx
  on public.shipment_events (shipment_id, occurred_at desc);

-- Alerts
create index if not exists alerts_store_status_created_idx
  on public.alerts (store_id, status, created_at desc);

-- Background jobs ops
create index if not exists background_jobs_status_run_at_idx
  on public.background_jobs (status, run_at)
  where status in ('queued', 'retry_scheduled', 'processing');

create index if not exists background_jobs_agency_created_idx
  on public.background_jobs (agency_id, created_at desc);

-- Audit
create index if not exists audit_logs_agency_created_idx
  on public.audit_logs (agency_id, created_at desc);

create index if not exists audit_logs_store_created_idx
  on public.audit_logs (store_id, created_at desc)
  where store_id is not null;

-- Raw events idempotency lookups already covered; add store timeline
create index if not exists raw_events_store_received_idx
  on public.raw_events (store_id, received_at desc nulls last)
  where store_id is not null;

comment on index public.orders_store_created_idx is
  'Sprint 10: primary orders list sort. EXPLAIN: Index Scan on orders_store_created_idx for store_id = $1 ORDER BY created_at DESC LIMIT n';
