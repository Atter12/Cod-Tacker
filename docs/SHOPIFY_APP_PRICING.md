# Shopify App Pricing · fases 0–5

Cobro de la app por **Shopify App Pricing** (cargo en la factura Shopify del merchant). No es Shopify Payments de la tienda.

**Estado:** fases 0–5 en código. Ops Partner + smoke manual pendientes de ejecutar en prod/review.

---

## Modelo de producto

| Adquisición | Proveedor | Dónde elige plan |
| --- | --- | --- |
| App Store / install embebido | `shopify` | Página hospedada de Shopify Admin |
| Agencia ya en Stripe / fuera de Shopify | `stripe` | Facturación en `cod.codtracked.com` |
| Local / demo | `demo` | Facturación aplica plan sin cargo |

- Embed (`app.codtracked.com/embed`): nunca Stripe Checkout.
- Consola: si `subscriptions.billing_provider = shopify`, “Elegir plan” / portal redirigen a App Pricing.
- Sync nunca sobrescribe una suscripción `stripe` activa.

---

## Fases (código)

| Fase | Entrega |
| --- | --- |
| 0 | Partner checklist, mapeo `plan_handle`, migración `provider=shopify` |
| 1 | Adapter `createShopifyBillingProvider` + router por agencia |
| 2 | Partner API `activeSubscription` → `subscriptions` + cron |
| 3 | CTA plan en `/embed` (`open … _top`) + welcome `plan_handle` |
| 4 | Facturación dual (Shopify solo lectura / Stripe intacto) |
| 5 | Gates App Store, smoke script, docs de reenvío |

Detalle operativo de Partner: [APP_STORE_BILLING_EXTERNAL.md](./APP_STORE_BILLING_EXTERNAL.md).

---

## Fase 5 — Smoke + reenvío (hecho en repo)

### Gates en código

- `lib/billing/app-store-gates.ts` — OAuth ≠ `/billing`; plan embed = Admin Shopify.
- `/api/integrations/shopify/install` sin tenant → redirect a `/embed` (nunca login→Facturación).
- `SHOPIFY_APP_REVIEW_MODE` oculta Flipy wallet top-up (Stripe logística ≠ suscripción app).
- Host split: `/api/internal/*` no rebota fuera de `app.*` (crons).

### Comando

```bash
npm run smoke:app-pricing
npx tsx --test lib/billing/app-store-gates.test.ts lib/billing/embed-plan-state.test.ts lib/billing/console-billing-mode.test.ts lib/shopify/app-store-review.test.ts lib/hosts/host-gate.test.ts
```

### Checklist manual (Partner / prod)

1. [ ] App Pricing activo; welcome → `/embed`.
2. [ ] Install → embed con pedidos; CTA plan → Admin; sin Stripe Checkout.
3. [ ] Decline → re-approve → sync (`subscriptions.billing_provider=shopify`).
4. [ ] Upgrade/downgrade → Facturación consola → **Sincronizar estado**.
5. [ ] Uninstall + reinstall.
6. [ ] Review deploy: `SHOPIFY_APP_REVIEW_MODE=true`.
7. [ ] `PRODUCT_APP_URL=https://cod.codtracked.com` + Stripe webhooks en host producto.
8. [ ] Theme app embed onboarding en notas de revisión.
9. [ ] Reenviar en Partner Dashboard.

### Env mínimo prod

| Variable | Uso |
| --- | --- |
| `SHOPIFY_APP_HANDLE` / `SHOPIFY_APP_GID` | Planes + Partner |
| `SHOPIFY_PARTNER_ORG_ID` / `SHOPIFY_PARTNER_API_TOKEN` | Sync |
| `BILLING_PROVIDER` | Preferir `shopify` para nuevas agencias App Store |
| `PRODUCT_APP_URL` | Consola / Stripe legado |
| `SHOPIFY_APP_REVIEW_MODE` | Review |
