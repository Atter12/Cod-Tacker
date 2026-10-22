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

## Qué desbloquea cada plan

Handles en Partner Dashboard: `conector` (Free), `starter`, `growth`, `scale`. Código: [`lib/billing/entitlements.ts`](../lib/billing/entitlements.ts).

| Plan | Precio (mes / año) | Incluye |
| --- | --- | --- |
| Free (`conector`, o sin plan / plan bloqueado) | $0 | Embed, pedidos, resumen, integraciones, Flipy, operaciones, configuración. 1 tienda. |
| Starter | $9 / $90 | + Atribución, campañas, RTO, conciliación, logística, alertas. 1 tienda, 300 pedidos/mes. |
| Growth | $19 / $190 | + WhatsApp y automatizaciones (`plans.features`). 3 tiendas, 1,000 pedidos/mes. |
| Scale | $99 / $990 | + Claves API. 5 tiendas, 5,000 pedidos/mes. |

Precios: `public.plans` (migración `20261022120000_plans_prices_9_19_99.sql`). Los planes de Partner Dashboard y los Price IDs de Stripe se cambian a mano y deben coincidir.

- Secciones de pago: `PlanGate` en el `layout.tsx` de cada sección muestra “Ver planes”; el menú las marca con candado.
- Server actions de esas secciones llaman `assertPlanSection`.
- Jobs: sin `automations` solo corren reglas de sistema (Flipy sin puja 24h); sin `whatsapp` no se encola la confirmación COD.
- Límite de pedidos: cuenta también los pedidos de Shopify del mes; al superarlo se muestra un aviso, la sincronización no se corta.
- Mensajes de pago vencido / cancelado apuntan al Admin de Shopify cuando `billing_provider = shopify`.

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
- Agencias que vienen de Shopify (embed o tienda conectada) siempre usan App Pricing; solo una suscripción Stripe ya guardada se mantiene (`decideAgencyBillingProvider`).
- La recarga Flipy (saldo del courier, no cobro de la app) se muestra igual en review: nunca se oculta a App Review.
- Host split: `/api/internal/*` no rebota fuera de `app.*` (crons).

### Comando

```bash
npm run smoke:app-pricing
npx tsx --test lib/billing/app-store-gates.test.ts lib/billing/embed-plan-state.test.ts lib/billing/console-billing-mode.test.ts lib/billing/provider.test.ts lib/strategic/flipy-recarga.test.ts lib/hosts/host-gate.test.ts
```

### Checklist manual (Partner / prod)

1. [ ] App Pricing activo con plan Free declarado; welcome → `/embed`.
2. [ ] Install → embed con pedidos; CTA plan → Admin; sin Stripe Checkout.
3. [ ] Decline → re-approve → sync (`subscriptions.billing_provider=shopify`).
4. [ ] Upgrade/downgrade → Facturación consola → **Sincronizar estado**.
5. [ ] Uninstall + reinstall.
6. [ ] Notas de revisión pegadas desde [SHOPIFY_REVIEW_NOTES.md](./SHOPIFY_REVIEW_NOTES.md).
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
