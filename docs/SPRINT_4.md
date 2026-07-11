# Sprint 4 — Logistics + carrier status normalization

Completed scope:

- Sprint 3 admin UI finished: `/admin/jobs`, `/admin/webhooks`, `/admin/dead-letter` (+ detail routes) with Spanish filters, sanitized/collapsible payloads, retry/cancel/ignore/process-batch actions.
- Additive migration `20260711150000_logistics_unmapped_and_mapping_versions.sql`:
  - `carrier_status_mapping_versions` (snapshot audit / restore)
  - `unmapped_carrier_statuses` unique on `(carrier_id, external_status_code)`
  - RLS: platform admin manage; authenticated read where scoped
- Temporary TypeScript fallbacks in `types/database.generated.ts`.
- Domain: `lib/logistics/normalize.ts` (+ tests), `apply-shipment-event.ts`, `mock-scenarios.ts`.
- Handler `carrier.shipment.updated.mock` uses mappings + unmapped upsert + terminal out-of-order protection.
- Tenant logistics list/detail with simulate/review/alert actions (`app/actions/shipments.ts`).
- Admin carriers detail + mappings CRUD (`app/actions/carriers.ts`) with audit log + version snapshots.

**Not in Sprint 4:** live carrier webhooks/adapters, reconciliation (Sprint 5+), attribution, automations.

## Normalize rules

| Rule | Behavior |
| --- | --- |
| Unknown external code | → `unknown` (never `delivered`); row upserted in `unmapped_carrier_statuses` |
| Terminal + older event | Keep current status; append `metadata.status_conflicts` |
| `delivery_failed` | Increment `delivery_attempts` |
| `delivered` | Set shipment `delivered_at`; order `order_status=delivered` + `delivered_at`; **never** payment settled |
| `returned` | Set `is_rto`, shipment `returned_at`; order `order_status=returned` |

## Mock simulation

Tenant action `simulateShipmentMockEvent` enqueues `raw_event` + `background_jobs` (`carrier.shipment.updated.mock`) via service-role `enqueueRawEventAndJob`. Process with Sprint 3 worker (`npm run jobs:process` or admin “Procesar lote”).

Scenarios: `delivered`, `rto`, `out_of_order` in `lib/logistics/mock-scenarios.ts`.

## Key routes

| UI | Path |
| --- | --- |
| Admin jobs | `/admin/jobs`, `/admin/jobs/[jobId]` |
| Admin webhooks | `/admin/webhooks`, `/admin/webhooks/[eventId]` |
| Admin dead letter | `/admin/dead-letter`, `/admin/dead-letter/[id]?kind=` |
| Admin carriers | `/admin/carriers`, `/admin/carriers/[carrierId]`, `.../mappings` |
| Tenant logistics | `/a/{agency}/s/{store}/logistics`, `.../logistics/[shipmentId]` |

## Tests

```bash
npm run test:unit -- lib/logistics/normalize.test.ts
npm run typecheck
```
