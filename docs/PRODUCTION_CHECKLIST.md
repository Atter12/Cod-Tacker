# Checklist de producción — CODTracked

Última actualización: 2026-07-24  
Criterio: verificado en código + cierre explícito de integraciones por producto.

**Estado global:** loop commerce / ads / courier (Envia) **cerrado**. WhatsApp Cloud API **cerrado en código** (connect, send, webhooks, UI live); falta smoke con Meta + Embedded Signup (fase 2). Infra prod (live mode, secrets, cron, health) **confirmada ops/envs**. Pendiente para 100%: billing, settlement smoke, hardening y cumplimiento.

---

## Integraciones cerradas

| Proveedor | Alcance cerrado | Evidencia principal |
| --- | --- | --- |
| **Shopify** | OAuth, webhooks HMAC, sync/backfill, customers/ítems/COD vs prepaid, disconnect | `lib/integrations/shopify/*`, `app/api/integrations/shopify/*` |
| **Envia.com** | Connect token, live carrier, webhooks (global + per-store), status → shipments | `lib/integrations/envia/*`, `app/api/webhooks/envia/*` |
| **Meta** | Ads spend live + CAPI Purchase terminal (dedupe / release sweep) | `lib/integrations/meta/*`, `lib/conversions/meta-capi.ts` |
| **TikTok** | Ads spend live + Events Purchase | `lib/integrations/tiktok/*`, `lib/conversions/tiktok-events.ts` |
| **WhatsApp** | Connect cifrado, Graph sendText/sendTemplate, webhooks, jobs live, UI sin demo en `INTEGRATION_MODE=live` | `lib/integrations/whatsapp/*`, `app/api/integrations/whatsapp/webhooks`, `app/actions/whatsapp.ts` |

### Smoke en producción (obligatorio al cutover, no reabre la integración)

- [ ] Shopify: connect OAuth → pedido webhook → pedido en UI → disconnect limpio
- [ ] Envia.com: token + webhook delivered COD → shipment + cash path
- [ ] Meta: spend sync + Purchase CAPI con `event_id` estable
- [ ] TikTok: spend sync + Events API Purchase con mismo dedupe
- [ ] WhatsApp: connect → plantilla → sent/delivered/read webhook → inbound → confirmación COD

### Residual opcional (no bloquea cierre)

- [ ] UNIQUE constraints post-auditoría Shopify (`scripts/audit-shopify-sprints-a-d-migrations.sql`)
- [ ] Hierarchy campaigns live (hoy puede existir seed mock para demos de Attribution/Campañas)
- [ ] Theme App Extension en lugar de ScriptTag (preferencia App Store)
- [ ] Enviame / `custom_carrier` live (solo si el cliente no usa Envia)

---

## P0 — Pendiente para producción cobrable / ops

- [x] `INTEGRATION_MODE=live` + `MOCK_INTEGRATIONS_ENABLED=false` en Vercel Prod *(confirmado ops/envs 2026-07-24)*
- [x] Secrets: `ENCRYPTION_KEY`, `CRON_SECRET`, `INTERNAL_JOB_SECRET`, providers *(confirmado ops/envs 2026-07-24)*
- [x] Cron jobs drenando (`/api/internal/jobs/process`) autenticado *(confirmado ops/envs 2026-07-24)*
- [x] Monitor externo de `/api/health` *(confirmado ops/envs 2026-07-24)*
- [x] **WhatsApp Cloud API** live en código (smoke Meta pendiente arriba)
- [ ] **Billing real** (Stripe vía `BILLING_PROVIDER=stripe`; Paddle/Culqi/MP adapters futuros) — demo sigue con `BILLING_PROVIDER=demo`
- [ ] Smoke Billing: seguir [BILLING_SMOKE.md](./BILLING_SMOKE.md) (Checkout → webhook → invoice; past_due grace; replay idempotente)
- [x] **Settlement / conciliación**: CSV live (`settlement.csv.imported`) + Ecart Pay sync (`settlement.ecart.synced`); sin liquidar ROAS solo por delivered
- [ ] Smoke Conciliación: CSV real courier **o** token Ecart Pay → lote matched → approve → settled
- [ ] Sincronizar `docs/ENVIRONMENT_VARIABLES.md` con `.env.example`

---

## P1 — Loop COD completo

- [ ] Quitar `DemoModeBadge` donde el path aún es mock (attribution hierarchy, reconciliation, automations, billing)
- [ ] Automatizaciones: acciones reales vs `simulate_*` / pause mock
- [ ] Usage counters de billing desde pedidos reales
- [ ] UI provisional vs confirmado (latencia carrier), si el ICP lo exige

---

## P2 — Cumplimiento

- [ ] Shopify GDPR webhooks: cumplir (no solo ack/log)
- [ ] Privacy export real + wipe al aprobar borrado
- [ ] App Store listing ES + privacy policy + onboarding &lt;10 min
- [ ] Webhooks / ScriptTag alcanzables sin Deployment Protection login

---

## P3 — Hardening

- [ ] Sentry (o OTel)
- [ ] Rate-limit distribuido (Redis) — hoy in-memory en cron
- [ ] CI: GitHub Actions con `npm run validate` (+ `test:rls` opcional)
- [ ] E2E firmado: Shopify → Envia → cash → Meta/TikTok CAPI/Events
- [ ] Actualizar docs stale (`ROADMAP.md`, `MOCK_INTEGRATIONS.md`, runbooks)
- [ ] Runbook de cutover live (orden connect + URLs)

---

## Ya OK (plataforma)

- [x] Auth / tenancy / roles / `can()`
- [x] Admin platform + dead-letter
- [x] Jobs claim / retry / DLQ
- [x] Plan limits de dominio (`lib/billing/limits.ts`) — cobro aún demo
- [x] Alertas ack / resolve / silence
- [x] Logger estructurado + `/api/health`
- [x] Shopify
- [x] Envia.com
- [x] Meta (Ads spend + CAPI)
- [x] TikTok (Ads spend + Events)
- [x] WhatsApp Cloud API (código; Embedded Signup pendiente)

---

## Criterio “100%”

1. Sin demo engañoso en módulos críticos con datos live  
2. Loop **Meta/TikTok → Shopify → (WA) → Envia → cash/settlement → CAPI/Events** sin depender de jobs `.mock`  
3. Facturación cobra de verdad (PE: Paddle / Culqi / MP)  
4. GDPR Shopify + wipe internos cumplen  
5. Sentry + rate-limit distribuido + CI en verde  

**Hoy:** cutover controlado **Shopify + Envia + Meta + TikTok + WhatsApp** es el camino; faltan billing, settlement y hardening para el 100%.

---

## Orden de cutover restante

1. ~~Infra (`live` + secrets + cron + health)~~ ✅ confirmado ops/envs  
2. Smoke de las 5 integraciones cerradas (incl. WhatsApp)  
3. Settlement (CSV limpio o live)  
4. Billing (Stripe / Paddle / Culqi / Mercado Pago)  
5. WhatsApp Embedded Signup (fase 2)  
6. GDPR + Sentry + Redis + CI + docs  

Ver también: [MOCK_INTEGRATIONS.md](./MOCK_INTEGRATIONS.md), [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md), [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md), [ROADMAP.md](./ROADMAP.md).
