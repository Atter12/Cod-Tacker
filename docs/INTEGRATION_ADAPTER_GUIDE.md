# Integration adapter guide

Goal: replace a mock provider with a real one **without** changing UI or domain services.

## Pattern

1. **Contract** in `lib/integrations/contracts/<domain>.ts` — stable types + methods.
2. **Mock adapter** in `lib/integrations/mock/` — implements contract.
3. **Registry** `lib/integrations/registry.ts` — returns mock or live by `resolveIntegrationMode()`.
4. **Enqueue** normalized events via `enqueueRawEventAndJob` (service role).
5. **Handler** in `lib/jobs/handlers/` — validates payload, upserts domain tables, audits.

UI and `services/*.service.ts` only read persisted rows — they must not call providers directly.

## Swap checklist (per provider)

### Shopify

1. Implement `CommerceProvider` live adapter (OAuth, webhooks HMAC).
2. Map webhook → same payload shape as `shopify.order.*.mock`.
3. Register in registry when `INTEGRATION_MODE=live`.
4. Keep idempotency keys = shop domain + external order id.

### Meta / TikTok

1. Implement ads provider: accounts, campaigns, spend daily.
2. Reuse `ads.spend.synced` / hierarchy job types (drop `.mock` suffix or dual-register).
3. Attribution RPCs already consume `ad_spend_daily` / attributions tables.

### WhatsApp

1. Cloud API send + webhook status/inbound.
2. Template approval becomes real; keep local `draft|approved|rejected` mapped from Meta.
3. Handlers `whatsapp.message.received` / `whatsapp.status.updated` stay the domain boundary.

### Carrier

1. Live tracking webhooks → `carrier.shipment.updated` payload.
2. Status mappings remain in `carrier_status_mappings` (admin UI already exists).

### Billing

1. Replace `changePlanMock` with Stripe/Paddle webhooks updating `subscriptions`.
2. Keep `assertCanCreateStore` / `assertCanImportCsvRows` — limits stay domain-owned.
3. Never store PAN/card data in CODTracked tables.

## Do not

- Call live APIs from Client Components
- Bypass jobs for writes that must be idempotent
- Expose `SUPABASE_SERVICE_ROLE_KEY` or provider secrets via `NEXT_PUBLIC_*`
- Remove `DemoModeBadge` until the store’s integration status is truly `connected` live
