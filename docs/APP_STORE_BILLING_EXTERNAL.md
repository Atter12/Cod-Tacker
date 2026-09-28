# App Store · billing externalizado (política 1.2.1)

**Objetivo:** listing Shopify = **conector Free** (OAuth + sync). Cobro del SaaS = **Facturación de agencia** (Stripe), fuera del cargo de la app Shopify.

Ver plan de implementación en el repo (fases 0–5).

---

## Fase 0 — Partner Dashboard (ops, manual)

Checklist antes de reenviar revisión:

- [ ] **Pricing de la app = Free** (sin planes Managed / App Pricing de pago en la listing).
- [ ] Descripción ES: conectar tienda, sincronizar pedidos/clientes/fulfillments; **no** vender el plan COD-tracked como cargo de la app Shopify.
- [ ] Notas para reviewers: conector Free; plan de plataforma en `https://app.codtracked.com` → Facturación de agencia; cuenta demo con trial activo.
- [ ] URLs alineadas con [`shopify.app.toml`](../shopify.app.toml): `application_url` = `https://app.codtracked.com/embed`, OAuth callback, compliance webhooks, `embedded = true`.
- [ ] Scopes Partner = toml + `SHOPIFY_SCOPES` (incl. `write_script_tags` si usan ScriptTag).

Copy sugerido (listing):

> CODTracked conecta tu tienda Shopify para sincronizar pedidos y datos operativos COD. La gestión del plan de la plataforma COD-tracked (límites de agencia) se realiza en la consola web de la agencia, no como un cargo de esta app de Shopify.

---

## Fase 3 — Cuenta App Review

- [ ] Agencia + tienda dedicadas (o trial largo) con suscripción `trialing` / `active`.
- [ ] Credenciales en notas de revisión (email / password o magic link).
- [ ] Script mínimo para el reviewer:

  1. Instalar la app y abrirla en el Admin (carga `/embed`, sin salir de Shopify)
  2. Ver la tienda ya vinculada y pedidos sincronizados, sin una pantalla de pago
  3. Opcional: en `https://app.codtracked.com` la misma tienda está en Integraciones → Shopify

- [ ] En el deploy de review (o prod durante revisión):  
  `SHOPIFY_APP_REVIEW_MODE=true` **o**  
  `SHOPIFY_APP_REVIEW_STORE_IDS=<uuid-tienda-review>`  
  → oculta recargas Stripe de billetera Flipy (logística ≠ suscripción app).

OAuth **no** debe redirigir a `/billing` (garantizado en código).

---

## Puerta embebida (`/embed`)

El Admin de Shopify carga `https://app.codtracked.com/embed` en un iframe (`embedded = true`).

1. App Bridge (`cdn.shopify.com/shopifycloud/app-bridge.js` en el `<head>`) entrega un session token.
2. `POST /api/integrations/shopify/embed/session` verifica la firma y, si la tienda es nueva, cambia ese token por el access token offline, crea la tienda y sincroniza pedidos. El merchant no sale del Admin y no pasa por Stripe.
3. La pantalla muestra pedidos. No hay checkout ni enlace a Facturación.

Esa puerta es el conector incluido: no consulta el plan de Stripe para sincronizar ni mostrar pedidos. La agencia queda marcada `shopify_connector: free`. Crear otra tienda en la consola es un extra y sí usa el límite del plan.

**Antes de `shopify app deploy`:** publica primero el web en Vercel para que `/embed` exista. Si el App URL cambia y la ruta aún no está en producción, el Admin abre un 404.

Checklist Partner (después del deploy del web y de `shopify app deploy`):

- [ ] App URL = `https://app.codtracked.com/embed`
- [ ] Embebida = sí
- [ ] Pricing = Free (un plan, sin cargos)
- [ ] Redirect URL de OAuth sin cambios: `https://app.codtracked.com/api/integrations/shopify/callback`

---

## Theme app extension · onboarding (App Store)

La extensión `extensions/codtracked-attribution` es un **App Embed** (UTM / click IDs).

**En producto:** Integraciones → Shopify muestra pasos de onboarding (`ShopifyAttributionOnboarding`):

1. Tienda online → Temas → Personalizar  
2. Configuración del tema → Incrustaciones de apps (App embeds)  
3. Activar **Captura de atribución** (`codtracked-attribution`)  
4. Guardar el tema  
5. Probar UTMs → `/cart.js` → compra de prueba  

ScriptTag al conectar OAuth queda como respaldo; el App Embed es el camino preferido.

**En instrucciones de prueba (Partner):** incluir los mismos pasos para que el checkbox de onboarding de theme extensions sea válido.

---

## Fase 5 — Smoke + reenvío

- [ ] Install URL / App URL → login si hace falta → OAuth → detalle Shopify **sin** pasar por Facturación ni Stripe Checkout.
- [ ] Nav **Facturación** solo a nivel agencia; copy habla de plan de plataforma / agencia.
- [ ] En cuenta review: sin iframe “Recarga segura · Stripe” de Flipy.
- [ ] Reenviar correcciones en Partner Dashboard citando: Free connector + SaaS billing externo (Stripe en consola de agencia).
- [ ] Adjuntar capturas: connect Shopify + pedidos; Facturación claramente “agencia / plataforma”.

---

## Variables

| Variable | Uso |
| --- | --- |
| `SHOPIFY_APP_REVIEW_MODE` | `true` deshabilita `wallet_topup` Flipy en todas las tiendas |
| `SHOPIFY_APP_REVIEW_STORE_IDS` | UUIDs de tienda (comma-separated) sin recarga Flipy |

`BILLING_PROVIDER=stripe` sigue siendo válido para el SaaS de agencia; no uses Shopify Billing para el plan de plataforma en este modelo.
