# Sprint 7 — Alertas y automatizaciones

Completed scope:

- Migration `20260711180000_alerts_automations.sql`:
  - alerts: assigned_to, status, silenced_until, source_*, updated_at
  - `alert_notes` + RLS
  - automation_rules: priority, requires_manual_approval, description, last_triggered_at
  - automation_runs: idempotency_key, entity_*, approval_*, updated_at
- Domain: Zod schemas, AND/OR evaluator, mock action executor, runner (cooldown, loop protection, idempotency, dry-run, approval).
- UI: alerts list/detail + actions; automations CRUD, simulate, fire trigger, runs detail.
- Tests: `lib/automations/automations.test.ts`.

**Not in Sprint 7:** real outbound webhooks/WhatsApp/Meta pause APIs (all mock).

## Triggers

`order.created`, `order.confirmed`, `shipment.status_changed`, `shipment.rto`, `campaign.rto_threshold_exceeded`, `settlement.discrepancy`, `integration.health_degraded`.

## Mock actions

create_alert · change_order_status · enqueue_job · simulate_whatsapp_message · simulate_outbound_webhook · request_campaign_pause · mark_for_review

## Smoke

1. Apply migration.
2. Automatizaciones → Nueva regla → activar → Simular → Disparar trigger mock.
3. Alertas → abrir → reconocer / asignar / nota / resolver.

## Routes

| UI | Path |
| --- | --- |
| Alerts | `/alerts`, `/alerts/[alertId]` |
| Automations | `/automations`, `/new`, `/[ruleId]`, `/edit`, `/runs`, `/runs/[runId]` |
