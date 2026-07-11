# Sprint 8 — WhatsApp operativo (mock)

Completed scope:

- Migration `20260711190000_whatsapp_templates.sql`: templates + unread/preview on conversations + template_id on messages.
- Job `whatsapp.status.updated.mock` (delivered/read/failed retryable|permanent).
- Inbound handler applies confirmation inference + `order.confirmed` automation trigger (no payment/delivery changes).
- UI: inbox, conversation (+ actions), templates CRUD/duplicate/mock approve.
- Nav + permissions `whatsapp.view` / `whatsapp.manage`.
- Tests: `lib/whatsapp/whatsapp.test.ts`.

**Not in Sprint 8:** WhatsApp Cloud API / Meta template approval.

## Smoke

1. Apply migration.
2. Conectar WhatsApp mock en Integraciones.
3. WhatsApp → Plantillas → crear → aprobar mock.
4. Abrir conversación (seed/job) → Enviar mock → `jobs:process`.
5. Simular respuesta “Cliente confirma” → `jobs:process` → pedido `confirmation_status=confirmed`.

## Routes

| UI | Path |
| --- | --- |
| Inbox | `/whatsapp` |
| Conversation | `/whatsapp/conversations/[id]` |
| Templates | `/whatsapp/templates` |
