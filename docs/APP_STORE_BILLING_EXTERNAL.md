# App Store · billing (Shopify App Pricing + legado Stripe)

**Modelo vigente:** merchants del App Store pagan la app con **Shopify App Pricing** (factura Shopify). Stripe queda solo para agencias legado / adquiridas fuera de Shopify.

Implementación por fases: [SHOPIFY_APP_PRICING.md](./SHOPIFY_APP_PRICING.md).

---

## Partner Dashboard (antes de reenviar)

- [ ] Pricing method = **Shopify App Pricing** (planes `starter` / `growth` / `scale`).
- [ ] Welcome link = `https://app.codtracked.com/embed`.
- [ ] URLs: `application_url` = `https://app.codtracked.com/embed`, `embedded = true`, OAuth callback y compliance webhooks alineados con [`shopify.app.toml`](../shopify.app.toml).
- [ ] Scopes Partner = toml + `SHOPIFY_SCOPES`.
- [ ] Env prod: `SHOPIFY_APP_HANDLE`, `SHOPIFY_APP_GID`, `SHOPIFY_PARTNER_ORG_ID`, `SHOPIFY_PARTNER_API_TOKEN`.
- [ ] Host producto: `PRODUCT_APP_URL=https://cod.codtracked.com` (Facturación Stripe legado fuera de `app.*`).

Copy listing (ajuste):

> CODTracked conecta tu tienda Shopify para sincronizar pedidos COD. Los planes de la plataforma se eligen en Shopify (App Pricing) y se cobran en tu factura de Shopify. La consola web muestra el estado del plan y los extras operativos.

---

## Cuenta App Review

- [ ] Dev store + plan de prueba ($0 / trial) o plan marcado free-to-test.
- [ ] Credenciales en notas de revisión.
- [ ] Script mínimo:

  1. Instalar y abrir la app → `/embed` (pedidos, sin Stripe Checkout).
  2. Elegir plan en la página hospedada de Shopify (si aplica).
  3. Volver al embed; ver plan sincronizado.
  4. Opcional: consola `cod.codtracked.com` → Facturación → **Administrar en Shopify**.

- [ ] `SHOPIFY_APP_REVIEW_MODE=true` **o** `SHOPIFY_APP_REVIEW_STORE_IDS=<uuid>`  
  → oculta recargas Stripe de billetera Flipy (logística ≠ suscripción app).

OAuth / install **no** redirigen a `/billing` (gates en código + `npm run smoke:app-pricing`).

---

## Puerta embebida (`/embed`)

1. App Bridge session token → offline token → tienda + sync.
2. Pedidos visibles (conector).
3. CTA de plan → Admin Shopify `…/charges/{app}/pricing_plans` (`_top`).
4. Sin Checkout Stripe ni links a Facturación en `cod.*` dentro del iframe.

**Antes de `shopify app deploy`:** el web con `/embed` debe estar en Vercel.

---

## Theme app extension

Onboarding App Embed `codtracked-attribution` en Integraciones → Shopify e instrucciones Partner (Personalizar tema → App embeds → activar → guardar).

---

## Smoke + reenvío (fase 5)

```bash
npm run smoke:app-pricing
npx tsx --test lib/billing/app-store-gates.test.ts lib/billing/embed-plan-state.test.ts lib/billing/console-billing-mode.test.ts lib/shopify/app-store-review.test.ts
```

Manual:

- [ ] Install → embed sin Stripe.
- [ ] Decline charge → re-approve → sync.
- [ ] Upgrade/downgrade → **Sincronizar estado** en Facturación.
- [ ] Uninstall + reinstall.
- [ ] Review: sin iframe “Recarga segura · Stripe” de Flipy.
- [ ] Capturas: embed + plan Shopify; Facturación consola en modo App Pricing.

---

## Variables

| Variable | Uso |
| --- | --- |
| `SHOPIFY_APP_HANDLE` / `SHOPIFY_APP_GID` | Planes + Partner query |
| `SHOPIFY_PARTNER_ORG_ID` / `SHOPIFY_PARTNER_API_TOKEN` | Sync `activeSubscription` |
| `BILLING_PROVIDER` | `shopify` \| `stripe` \| `demo` |
| `PRODUCT_APP_URL` | Consola / Stripe legado |
| `SHOPIFY_APP_REVIEW_MODE` | Oculta Flipy wallet top-up |
| `SHOPIFY_APP_REVIEW_STORE_IDS` | Tiendas review sin top-up |
