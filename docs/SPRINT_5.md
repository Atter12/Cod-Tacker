# Sprint 5 — Conciliación CSV y discrepancias

Completed scope:

- Additive migration `20260711160000_reconciliation_csv_matching.sql`:
  - enums `settlement_match_status`, `settlement_match_method`
  - `settlement_items`: source_row_number, raw_row, match_*, resolution_*, discrepancy_reason, external ids, currency, applied timestamps
  - `settlement_batches`: approved_at/by, processing_*, import_* counts
  - RLS update policies for tenant managers; inserts via job worker (service role)
- Temporary TypeScript fallbacks in `types/database.generated.ts`.
- Domain: CSV parser (no deps), presets, validation, deterministic matching, collected vs settled effects.
- Job `settlement.csv.imported.mock` → batch + items + auto-match.
- UI: list, import wizard, batch detail, discrepancies; approve/reopen/manual match/resolve/export.
- Tests: `lib/reconciliation/reconciliation.test.ts`.

**Not in Sprint 5:** live bank/carrier settlement APIs, Supabase Storage upload implementation (path recorded when `SETTLEMENT_CSV_BUCKET` is set; without it, server-side rows-only processing).

## Delivered vs collected vs settled

| Concept | Field / action |
| --- | --- |
| Entregado | Logistics `order_status=delivered` (Sprint 4) — never set by reconciliation |
| Cobrado | `confirmCollectedMatch` → `collected_cod_amount` + `payment_status=cash_collected` |
| Liquidado | `approveSettlementBatch` → `settled_cod_amount` + `payment_status=settled` |

## Matching priority

1. tracking exact (confidence 1)
2. external shipment id (0.98)
3. external order id (0.95)
4. order_number (0.9)
5. amount + time window → **suggestion only** (`unmatched`, confidence ≤ 0.4, never auto high-confidence)

## Storage limitation

Full CSV bodies are **not** stored in Postgres. Only sanitized `raw_row` per item and optional `source_file_path`. If `SETTLEMENT_CSV_BUCKET` is unset, import still works via job payload rows.

## Smoke

1. Apply migration `20260711160000_reconciliation_csv_matching.sql`.
2. Conciliación → Importar CSV → “Cargar CSV de ejemplo” → validar → confirmar.
3. `npm run jobs:process` → lote con ítems matched/unmatched/difference/duplicate.
4. Confirmar cobrado en ítem matched → pedido `cash_collected` sin `settled`.
5. Aprobar lote → pedidos matched/resolved quedan `settled`.
6. Reabrir lote → limpia settled, conserva collected.
7. Exportar CSV (formula-safe).

## Key routes

| UI | Path |
| --- | --- |
| List | `/a/{agency}/s/{store}/reconciliation` |
| Import | `.../reconciliation/import` |
| Batch | `.../reconciliation/[batchId]` |
| Discrepancies | `.../reconciliation/discrepancies` |

## Tests

```bash
npm run test:unit -- lib/reconciliation/reconciliation.test.ts
npm run typecheck
```
