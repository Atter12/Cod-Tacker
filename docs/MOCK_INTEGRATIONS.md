# Mock integrations

CODTracked Integration-Ready V1 runs **all external providers in mock mode** by default.

## Mode resolution

- `INTEGRATION_MODE=mock|live` (server-only)
- `MOCK_INTEGRATIONS_ENABLED=true|false`
- Outside production, unset mode defaults to **mock**
- Production requires explicit `INTEGRATION_MODE`

Registry: `lib/integrations/registry.ts`  
Contracts: `lib/integrations/contracts/*`  
Mocks: `lib/integrations/mock/*`

## Providers (mock)

| Provider | Contract | Mock behavior |
| --- | --- | --- |
| Shopify | commerce | Order create/update → raw_events + jobs |
| Meta / TikTok | ads | Hierarchy seed + spend sync |
| WhatsApp | messaging | Send/status/inbound; templates demo-approved |
| Carriers | carrier-provider | Shipment events + mapping |
| Settlement | settlement-provider | CSV / batch received |

## UI signaling

Surfaces that use mock data show **Modo demostración** (`DemoModeBadge`). Never present mock as a live connection.

## Honest “still mock” list

- No real Shopify/Meta/TikTok/WhatsApp/carrier HTTP calls
- Billing invoices and plan changes are demo-only (no card storage)
- WhatsApp template “approved” ≠ Meta approval
- Privacy export is a summary artifact, not a CDN dump
- Deletion requests require approval and do **not** auto-wipe

## Job types (mock suffix)

See `lib/jobs/handlers/registry.ts` — all `*.mock` types share the same claim/retry/dead-letter pipeline as future live jobs.
