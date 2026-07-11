# Performance notes (Sprint 10)

## Indexes added

Migration `20260711210000_sprint10_performance_indexes.sql`:

- `orders (store_id, created_at desc)` — primary list
- `orders (store_id, order_status, created_at desc)` — status filter
- `orders (store_id, payment_status, created_at desc)`
- `shipments (store_id, updated_at desc)`
- `shipment_events (shipment_id, occurred_at desc)`
- `alerts (store_id, status, created_at desc)`
- `background_jobs (status, run_at)` partial for active queue
- `audit_logs (agency_id|store_id, created_at desc)`
- `raw_events (store_id, received_at desc)`

## EXPLAIN guidance (run in SQL editor after migrate)

```sql
explain analyze
select id, order_number, order_status, created_at
from public.orders
where store_id = '<store-uuid>'
order by created_at desc
limit 25;
-- Expect: Index Scan using orders_store_created_idx
```

```sql
explain analyze
select id, job_type, status, run_at
from public.background_jobs
where status in ('queued', 'retry_scheduled')
order by run_at
limit 20;
-- Expect: Index Scan using background_jobs_status_run_at_idx
```

Campaign / attribution aggregates use RPCs from Sprint 6 (`rpc_store_campaign_performance`, etc.) to avoid N+1 in the UI.

## Client payload hygiene

- List pages paginate (orders, logistics, alerts, WhatsApp, jobs).
- Admin JSON uses `sanitizePayloadForDisplay` + collapse for large payloads.
- Charts (`SimpleBarChart`) receive aggregated series, not raw event dumps.
