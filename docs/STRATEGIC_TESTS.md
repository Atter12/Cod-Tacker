# Tests estratégicos — CODTracked

Última actualización: 2026-10-09

Los tests unitarios siguen al lado de cada módulo (`npm run test:unit`). El test estratégico no se escribe por archivo ni como un solo flujo de punta a punta. Se agrupa por la costura de negocio donde un módulo entrega el pedido al siguiente.

Un Shopify que guarda el pedido y un Flipy que crea el envío pueden estar verdes por separado y tener roto el salto entre ambos. Un único escenario de todo el loop hace que un fallo de WhatsApp tape si facturación sigue bien.

---

## Grupos

| Grupo | Módulos | Qué tiene que seguir siendo cierto |
| --- | --- | --- |
| Acceso | Auth, tenant, permisos, host `app.` / `cod.` | Una agencia no ve la tienda de otra. El embed no cae en Facturación. |
| Entrada | Shopify (OAuth, webhooks, pedidos) | Un pedido COD entra, queda ligado a la tienda y encola el job correcto. |
| Confirmación | WhatsApp | Solo un COD dispara la plantilla. El inbound confirma o rechaza el pedido. |
| Entrega | Flipy, Envia, envíos | El pedido confirmado sale a carrier. El estado del carrier vuelve al pedido sin pisar un estado terminal. |
| Dinero | Conciliación, billing (App Pricing y Stripe legado) | El cobrado no se liquida dos veces. El plan Shopify no pisa una suscripción Stripe. |
| Medición | Meta, TikTok, atribución, conversiones | El gasto cuadra con la campaña. El Purchase sale una vez, con el mismo `event_id`. |
| Plataforma | Jobs, alertas, automatizaciones | Reintento, dead-letter y una regla no se ejecutan dos veces. |

Dentro de cada grupo se mantienen los unitarios actuales. El test estratégico es uno por grupo.

Acceso y Dinero se prueban al lado del loop, no dentro de él. Un fallo de plan no invalida el test de envíos, y un fallo de Flipy no oculta si el cargo de la app sigue sincronizando.

---

## Cruces entre grupos

Cuatro escenarios, además del test de cada grupo:

1. **Entrada → Plataforma.** Shopify → job → pedido visible en la tienda. **Fase 8 — hecha.** `lib/strategic/entrada-plataforma.test.ts`.
2. **Entrada → Confirmación.** Pedido COD → WhatsApp → confirmación o rechazo. Un prepaid no encola la plantilla. **Fase 9 — hecha.** `lib/strategic/entrada-confirmacion.test.ts`.
3. **Confirmación → Entrega.** Pedido confirmado → Flipy o Envia → estado de envío. Un evento viejo no pisa un estado terminal. **Fase 10 — hecha.** `lib/strategic/confirmacion-entrega.test.ts`.
4. **Entrega → Dinero → Medición.** Envío cobrado → conciliación → conversión Meta/TikTok, sin un segundo Purchase. **Fase 11 — hecha.** `lib/strategic/entrega-dinero-medicion.test.ts`.

Eso son once escenarios estratégicos: siete de grupo y cuatro de cruce.

---

## Qué cubre cada grupo

### Acceso

- Sesión de una agencia no resuelve tiendas de otra.
- Rol sin permiso no ejecuta la acción (crear tienda, conectar integración, facturación).
- `application_url` del embed es `/embed`. El retorno de OAuth no es `/billing`.
- La URL de plan del embed es Admin Shopify (`pricing_plans`), no Checkout de otro host.
- Rutas que no son de la app embebida en `app.codtracked.com` salen hacia `PRODUCT_APP_URL`.

**Fase 1 — hecha.** Escenario de grupo: `lib/strategic/acceso.test.ts`. Los unitarios de apoyo siguen en `lib/hosts/host-gate.test.ts`, `lib/billing/app-store-gates.test.ts`, `lib/billing/shopify-surface-stripe.test.ts` y `lib/security/sprint10.test.ts`.

### Entrada

- Webhook de pedido con HMAC válido crea o actualiza el pedido de esa tienda.
- Pedido COD queda distinguido de prepaid.
- El alta encola `shopify.order.created` (o el equivalente live), no un job de otro proveedor.
- Install sin tenant abre `/embed`.

**Fase 2 — hecha.** Escenario de grupo: `lib/strategic/entrada.test.ts`. Los unitarios de apoyo siguen en `lib/integrations/shopify/shopify.test.ts`, `lib/orders/shopify-contact.test.ts` y `lib/jobs/handlers/validation.test.ts`.

### Confirmación

- Tag COD mapea a `cash_expected` y encola `whatsapp.confirmation.request`.
- Pago con tarjeta no encola esa confirmación.
- Inbound de la plantilla confirma o rechaza. Un payload inválido es error permanente del job.

**Fase 3 — hecha.** Escenario de grupo: `lib/strategic/confirmacion.test.ts`. Los unitarios de apoyo siguen en `lib/jobs/handlers/whatsapp-confirmation-request.test.ts`, `lib/whatsapp/whatsapp.test.ts` y `lib/integrations/whatsapp/whatsapp-live.test.ts`.

### Entrega

- Auto-create de Flipy no sale si el pedido es pickup, está desactivado o la dirección no tiene confianza suficiente.
- Create de envío arma el escenario de flete (producto pagado vs COD) según el pago del pedido.
- Webhook de carrier aplica el estado nuevo y conserva el terminal si el evento es más viejo.
- Envia y Flipy normalizan al mismo modelo de envío. No se marca delivered solo porque llegó un código desconocido.

**Fase 4 — hecha.** Escenario de grupo: `lib/strategic/entrega.test.ts`. Los unitarios de apoyo siguen en `lib/integrations/flipy/*.test.ts`, `lib/integrations/envia/envia.test.ts`, `lib/logistics/normalize.test.ts` y `lib/orders/status-precedence.test.ts`.

### Dinero

- Ítem de conciliación ya aplicado no vuelve a marcar cobrado.
- CSV o sync Ecart/Flipy que no matchea no liquida el pedido.
- `activeSubscription` de Shopify escribe `billing_provider=shopify` y el plan `starter` / `growth` / `scale`.
- Una suscripción `stripe` activa no la pisa el sync de Shopify.
- En consola, modo Shopify abre Admin (`Elegir en Shopify` / `Administrar en Shopify`) y no Checkout.

**Fase 5 — hecha.** Escenario de grupo: `lib/strategic/dinero.test.ts`. Los unitarios de apoyo siguen en `lib/reconciliation/reconciliation.test.ts`, `lib/billing/shopify-subscription-map.test.ts`, `lib/billing/console-billing-mode.test.ts`, `lib/billing/shopify-plans.test.ts` y `lib/integrations/stripe/billing.test.ts`.

### Medición

- Spend de Meta y TikTok cae en la campaña correcta.
- Purchase de CAPI/Events usa un `event_id` estable.
- Un segundo sweep no emite otro Purchase para el mismo pedido.
- El release no dispara Purchase solo por delivered si la política exige cobro.

**Fase 6 — hecha.** Escenario de grupo: `lib/strategic/medicion.test.ts`. Los unitarios de apoyo siguen en `lib/conversions/conversions.test.ts`, `lib/conversions/delivered-purchase.test.ts`, `lib/conversions/release-policy.test.ts`, `lib/integrations/meta/meta-ads.test.ts`, `lib/integrations/tiktok/tiktok-ads.test.ts` y `lib/attribution/match-campaign.test.ts`.

### Plataforma

- Payload inválido de un job es `PermanentJobError` (no reintento infinito).
- Backoff y tope de intentos dejan el job en dead-letter.
- Una regla de automatización no corre dos veces para el mismo evento.
- Alerta ack / silence no vuelve a notificar el mismo hecho.

**Fase 7 — hecha.** Escenario de grupo: `lib/strategic/plataforma.test.ts`. Los unitarios de apoyo siguen en `lib/jobs/handlers/validation.test.ts`, `lib/jobs/backoff.test.ts`, `lib/jobs/enqueue.test.ts` y `lib/automations/automations.test.ts`.

---

## Cómo correrlo

Hoy el gate automático es la suite unitaria, que ya contiene la evidencia de cada grupo:

```bash
npm run test:unit
npm run typecheck
npm run smoke:app-pricing
```

`smoke:app-pricing` cubre los gates de Acceso del embed. El checklist manual de Partner (install, aprobar plan, upgrade, uninstall) sigue fuera de esta suite. Ver [SHOPIFY_APP_PRICING.md](./SHOPIFY_APP_PRICING.md).

Cuando se añada un escenario de cruce, vive en un archivo por cruce (no dentro del test unitario del módulo de origen) y nombra los dos grupos que une. No hace falta un runner nuevo hasta que esos cuatro cruces existan como tests propios.

---

## Fuera de este plan

- Smoke live contra Shopify, Meta, WhatsApp, Envia o Flipy de producción. Eso es cutover, no esta suite. Ver [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md).
- Un test por cada archivo de `lib/integrations/flipy/` o por cada server action.
- Un solo escenario que recorra ads → Shopify → WhatsApp → carrier → conciliación → CAPI en una sola aserción.
