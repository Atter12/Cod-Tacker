# Roadmap — Integration-Ready V1 → Producción

**Estado actual:** integraciones **Shopify, Envia.com, Meta, TikTok y WhatsApp Cloud API** cerradas en código (live). Settlement y billing siguen demo/parcial. Checklist vivo: [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md).

## Completado (Sprints 0–10 + live cutovers)

| Área | Modo |
| --- | --- |
| Auth, tenancy, invitaciones, roles | Real (Supabase Auth + RLS) |
| Pedidos / logística / RTO | Persistido |
| **Shopify** | **Live** (OAuth, webhooks, sync) |
| **Envia.com** | **Live** (API + webhooks) |
| **Meta** | **Live** (Ads spend + CAPI Purchase) |
| **TikTok** | **Live** (Ads spend + Events Purchase) |
| **WhatsApp** | **Live** (Cloud API send + webhooks; Embedded Signup pendiente) |
| Settlement | Mock o parcial |
| Jobs, retries, dead-letter | Operable |
| Alertas / automatizaciones | Parcial (algunas acciones mock) |
| Settings / branding / API keys / billing | Operativo (billing **demo**) |
| Admin platform | Operativo |
| Hardening / docs / E2E matrix | Sprint 10 |

## Siguiente — para producción 100%

1. Billing real (Paddle / Culqi / Mercado Pago) — sin romper límites de dominio.
2. Settlement live o CSV-prod sin jobs mock.
3. WhatsApp Embedded Signup (onboarding multiempresa) + sync plantillas Meta Graph.
4. Rate limiting distribuido (Redis) y observabilidad externa (Sentry/OTel).
5. GDPR Shopify fulfillment + privacy wipe; CI; docs sync.

Cada fase: credenciales least-privilege, idempotencia, RLS, auditoría y runbook antes de quitar “Modo demostración” en UI.

Ver: [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md), [MOCK_INTEGRATIONS.md](./MOCK_INTEGRATIONS.md), [INTEGRATION_ADAPTER_GUIDE.md](./INTEGRATION_ADAPTER_GUIDE.md), [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md).
