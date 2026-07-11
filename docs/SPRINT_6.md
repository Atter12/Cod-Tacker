# Sprint 6 — Atribución, campañas, ROAS y RTO analítico

Completed scope:

- Migration `20260711170000_attribution_analytics_rpcs.sql` with **SECURITY INVOKER** RPCs:
  - `rpc_store_order_funnel`
  - `rpc_store_campaign_performance`
  - `rpc_store_rto_breakdown`
  - `rpc_store_ads_daily_trend`
- Metrics module `lib/attribution/metrics.ts` (denominators / zero-division documented).
- Job `ads.hierarchy.seeded.mock` seeds accounts → campaigns → ad sets → ads → spend + touchpoints/attributions (skips existing primary attributions; does not overwrite touchpoints).
- Services: enriched attribution/campaigns + `rto.service.ts`.
- UI drill-down: attribution, accounts, campaigns, ad sets, ads, RTO (+ geography/products/campaigns).
- Permission `attribution.manage` for mock recalculate (audited).
- Tests: `lib/attribution/metrics.test.ts`.

**Not in Sprint 6:** live Meta/TikTok APIs, heavy map library (geography uses accessible table + bar chart), line-item product RTO RPC (ticket-bucket proxy).

## KPI definitions

| KPI | Formula | Zero divisor |
| --- | --- | --- |
| ROAS generado | attributed revenue ÷ spend | `null` |
| ROAS entregado | delivered order value (excl. returned) ÷ spend | `null` |
| ROAS cobrado | collected_cod ÷ spend | `null` |
| ROAS conciliado | settled_cod ÷ spend | `null` |
| RTO | returned/is_rto ÷ shipped (fallback generated) | `null` |
| Confirmación | confirmed ÷ orders | `null` |
| Entrega | delivered ÷ shipped | `null` |

## Smoke

1. Apply `20260711170000_attribution_analytics_rpcs.sql`.
2. Conectar Meta ads mock en Integraciones.
3. Atribución → Recalcular mock → `npm run jobs:process`.
4. Ver cuentas → campaña → ad set → ad; ROAS columns.
5. RTO → geografía / campañas; filtros de fecha.

## Key routes

| UI | Path |
| --- | --- |
| Atribución | `/a/{a}/s/{s}/attribution` |
| Cuenta | `.../attribution/accounts/[accountId]` |
| Campañas | `.../campaigns`, `.../campaigns/[id]`, `.../adsets/[id]` |
| Ad | `.../ads/[adId]` |
| RTO | `.../rto`, `.../rto/geography`, `.../rto/products`, `.../rto/campaigns` |

## Tests

```bash
npm run test:unit -- lib/attribution/metrics.test.ts
npm run typecheck
```
