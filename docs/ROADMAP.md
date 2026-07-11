# Roadmap — Integration-Ready V1

**Estado actual:** CODTracked **Integration-Ready V1** (modo mock). El producto demuestra el flujo completo multi-tenant con contratos, jobs, RLS y UI operativos. **No** es “producción con integraciones reales”.

## Completado (Sprints 0–10)

| Área | Modo |
| --- | --- |
| Auth, tenancy, invitaciones, roles | Real (Supabase Auth + RLS) |
| Pedidos / logística / RTO | Persistido + mock carriers |
| Shopify / Meta / TikTok / WhatsApp / settlement | **Mock adapters** |
| Jobs, retries, dead-letter | Operable (mock payloads) |
| Alertas / automatizaciones | Mock actions |
| Settings / branding / API keys / billing | Operativo (billing **demo**) |
| Admin platform | Operativo |
| Hardening / docs / E2E matrix | Sprint 10 |

## Siguiente (post V1) — conectar proveedores reales

1. Shopify Admin API + webhooks firmados → mismo pipeline `raw_events` / jobs.
2. Meta Marketing API + spend sync.
3. TikTok Ads API.
4. WhatsApp Cloud API + template approval real.
5. Carrier APIs (Enviame / Envia.com / custom) + webhooks.
6. Billing real (Stripe/Paddle) — sin romper límites de dominio.
7. Rate limiting distribuido (Redis) y observabilidad externa (Sentry/OTel).

Cada fase: credenciales least-privilege, idempotencia, RLS, auditoría y runbook antes de marcar “live” en UI.

Ver: [MOCK_INTEGRATIONS.md](./MOCK_INTEGRATIONS.md), [INTEGRATION_ADAPTER_GUIDE.md](./INTEGRATION_ADAPTER_GUIDE.md), [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md).
