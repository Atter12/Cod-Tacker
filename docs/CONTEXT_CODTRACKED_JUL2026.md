# CODTracked — contexto del proyecto (julio 2026)

Documento de handoff técnico y de producto. Última actualización tras sprints Shopify **A → B → C → D** (código; migraciones de uniques pendientes de consulta a BD).

---

## 1. Qué es el producto

**CODTracked** es una app SaaS para tiendas **Shopify con contraentrega (COD) en LATAM**.

Propuesta de valor (vs trackers generales tipo WeTracked):

- No vende “más Purchases a Meta”.
- Vende **ROAS real sobre lo cobrado en puerta**, más **tasa de confirmación**, **RTO por campaña/producto/zona**.
- Tres fuentes de verdad:
  1. **Shopify** (pedidos, cliente, ítems, señal de pago COD vs prepaid)
  2. **Carriers** (Enviame / Envia.com — estados normalizados)
  3. **Meta CAPI + TikTok Events** (evento terminal: entregado + cobrado)

ICP: merchants Shopify COD (PE → CO/MX), agencias performance. Monetización: suscripción por volumen de pedidos + add-ons WhatsApp / alertas RTO.

**No competir como “WeTracked más barato”.** Competir como capa de verdad económica del COD.

---

## 2. Stack actual (repo)

| Capa | Tecnología |
|------|------------|
| App | Next.js (App Router; ver `node_modules/next/dist/docs` — APIs distintas al Next “clásico”) |
| Auth / DB | Supabase (Postgres + Auth + Realtime) |
| Jobs | `background_jobs` + handlers por tipo (`shopify.order.*`, carriers, WhatsApp, settlements…) |
| Integraciones | Shopify live OAuth + webhooks; otros providers con adapters mock/live |
| UI | Componentes propios + Tailwind; rutas tenant ` /a/[agencySlug]/s/[storeSlug]/… ` |

Schema de negocio ya modela: `orders`, `customers`, `order_items`, `products`, `product_variants`, atribución ads, carriers/shipments, WhatsApp, settlements, `conversion_events`, etc.

---

## 3. Estado Shopify live (antes → ahora)

### Antes de A–D
- OAuth + webhooks `orders/create|updated` + sync GraphQL creaban **solo cabecera** de `orders`.
- Sin `customer_id` → UI Cliente = “—”.
- Sin `order_items` → detalle “Sin ítems”.
- Todo pedido forzaba `payment_status = cash_expected` + `expected_cod_amount = total` (prepaid contaminaba métricas COD).
- Disconnect: solo status/token local; webhooks seguían vivos en Shopify; `shopify_shop_domain` no se limpiaba.
- “Reconectar” iba a **mock** y fallaba en modo live.

### Después de A–D (este commit)

| Sprint | Objetivo | Hecho en código |
|--------|----------|-----------------|
| **A Clientes** | Pedido con cliente usable | Mapper cliente/shipping compartido; upsert `customers`; liga `orders.customer_id` + `shipping_*`; UI muestra nombre/tel/email |
| **B Line items** | Pedido no es solo un total | Mapper `line_items`; upsert liviano products/variants; reconcile `order_items` en create/update; GraphQL sync trae `lineItems` |
| **C COD vs prepaid** | No tratar todo como COD | Detección por tags/gateway/financial; COD → `cash_expected` + monto; prepaid → `unpaid` + `expected_cod_amount = null`; update no pisa estados ya cobrados/liquidados |
| **D Higiene live** | Producción estable | Unregister webhooks al disconnect; limpia `shopify_shop_domain`; reconnect OAuth live; UI estado de webhooks registrados |

**Explicitamente fuera de este bloque (y del commit):**
- Migraciones UNIQUE de upsert (`customers`, products, variants, line items) — se harán tras consultar BD.
- Fulfillments Shopify → `shipments` (requiere `carrier_id`; no sustituye carriers).
- GDPR / App Store compliance topics.
- Carriers live, entregados/devueltos, efectivo cobrado, conciliación, inventario write-back, atribución UTM/CAPI (P0 producto, otros tracks).

---

## 4. Arquitectura del ingest Shopify

```
Shopify orders/create|updated (REST webhook, HMAC)
        │
        ▼
webhook-ingress → mapRestOrderTo*Payload → enqueue job
        │
GraphQL sync (7d / 90d) ──► mapGraphqlOrderToEnqueue ──┘
        │
        ▼
handlers:
  shopify.order.created  → upsert customer, insert order, sync items
  shopify.order.updated  → upsert customer, patch order (payment safe), sync items
```

### Archivos clave

| Área | Path |
|------|------|
| Mapper pedido | `lib/integrations/shopify/map-order.ts` |
| Cliente / shipping | `lib/integrations/shopify/map-customer.ts` |
| Line items | `lib/integrations/shopify/map-line-items.ts` |
| Pago COD/prepaid | `lib/integrations/shopify/map-payment.ts` |
| Sync pull | `lib/integrations/shopify/orders-sync.ts` |
| Webhooks register/unregister | `lib/integrations/shopify/webhooks-register.ts` |
| Meta UI webhooks | `lib/integrations/shopify/webhooks-meta.ts` |
| Payload zod compartido | `lib/jobs/handlers/shopify-order-payload.ts` |
| Upsert customer | `lib/jobs/handlers/shopify-upsert-customer.ts` |
| Sync order_items | `lib/jobs/handlers/shopify-sync-order-items.ts` |
| Create/update handlers | `lib/jobs/handlers/shopify-order-{created,updated}.ts` |
| Disconnect / reconnect | `services/integrations.service.ts` |
| OAuth complete | `services/shopify-oauth.service.ts` |
| UI integración | `app/a/.../integrations/[provider]/page.tsx` |
| Acciones / OAuth form | `components/integrations/IntegrationActions.tsx`, `ShopifyConnectForm.tsx` |

### Reglas de pago (Sprint C)

1. Señal COD (tag/gateway: cod, contraentrega, Cash on Delivery…) **gana** aunque financial = paid.  
2. Prepaid: gateway online (Mercado Pago, Shopify Payments, etc.) o financial paid **sin** COD.  
3. Ambigüo: **COD-first** (ICP).  
4. Update **no** sobrescribe `payment_status` / COD si ya está en `cash_collected | partially_collected | settlement_pending | settled | disputed | refunded | written_off`.  
5. `order_status` confirmed por PAID sigue siendo señal logística/ops, independiente del shape COD.

### Reglas de clientes (Sprint A)

Upsert por: `external_customer_id` → email → phone.  
Sin identidad (solo nombre): no crea customer.  
Guest: phone/email de shipping/order.

### Reglas de ítems (Sprint B)

- Create/update con `line_items` presente → reconcile por `external_line_item_id`.  
- Sin `line_items` en payload (mocks viejos) → no toca ítems.  
- Custom lines sin product/variant: solo `order_items` con título/precios.

### Disconnect (Sprint D)

1. Con token + shop: `unregisterShopifyOrderWebhooks` (best-effort).  
2. `stores.shopify_shop_domain = null`.  
3. Limpia `settings.shop_domain`; deja rastro en `metadata.webhooks`.  
4. `secret_reference = null`, status `disconnected`.  
Reconnect live = OAuth (botón “Reconectar (OAuth)” / “Reautorizar Shopify”), no `connectMock`.

---

## 5. BD — qué usa el código vs migraciones pendientes

El schema ya tiene las tablas/columnas. **No se añadieron migraciones en A–D** a pedido (consultar BD al final).

Pendiente recomendado al alinear con BD live:

- Unique parcial `customers (store_id, external_customer_id) WHERE … IS NOT NULL`
- Unique `products (store_id, external_product_id)`
- Unique `product_variants (store_id, external_variant_id)`
- Unique `order_items (order_id, external_line_item_id)` (o store+external)

Hoy el upsert es seek-then-insert/update (rápido bajo volumen; frágil a carreras sin unique).

Enums de pago usados: `unpaid | cash_expected | …` (no existe `paid`/prepaid como enum; prepaid = `unpaid` + `expected_cod_amount` null).

---

## 6. Cómo verificar end-to-end

1. **Conectar** Shopify live (OAuth) → ver webhooks OK en UI.  
2. Crear pedido COD en la tienda → worker → lista Cliente ≠ “—”; detalle con ítems; `payment_status = cash_expected`.  
3. Crear pedido prepaid (Mercado Pago / paid sin tag COD) → `unpaid`, `expected_cod_amount` null; puede quedar `order_status = confirmed` si financial paid.  
4. **Desconectar** → dejar de recibir spam de webhooks; dominio limpio.  
5. **Reconectar OAuth** → token + webhooks de nuevo.  
6. Pedidos históricos: sync incremental / backfill (o `orders/updated`) rellena cliente/ítems/pago si el mapper los trae.

Tests unitarios: `npx tsx --test lib/integrations/shopify/shopify.test.ts lib/jobs/handlers/validation.test.ts`

---

## 7. Roadmap producto (prioridad desde BP / informe vs WeTracked)

### P0 — categoría (aún no cerrado por A–D)
- Atribución UTM + fingerprint → campaign/adset  
- Enviame (o agregador) + normalización de estados  
- Dashboard ROAS COD / confirmación / RTO  
- Meta CAPI + TikTok con evento terminal + dedupe  
- UI provisional vs confirmado (latencia carrier)

### P1 — cierre de venta
- WhatsApp confirmación (add-on; ya hay tablas/UI parcial)  
- Alertas RTO  
- Mapa por zona  
- Listing App Store ES + onboarding &lt;10 min  

### Paralelo / después (explícitamente fuera de A–D)
- Entregados / Devueltos vía carrier  
- Efectivo cobrado + conciliación  
- Inventario write-back  
- Uniques DB + GDPR si app pública  

---

## 8. Convenciones para agentes / contributors

- Leer `AGENTS.md` / guía Next en `node_modules/next/dist/docs` antes de inventar APIs.  
- No commitear `.env`, `COD-tracked.zip`, secretos.  
- No inventar tablas si el schema ya las tiene — llenar y ligar.  
- Preferir mapper **único** webhook + GraphQL → mismo job payload.  
- En live Shopify, no usar reconnect mock.  
- Commits: mensajes imperativos enfocados en el *por qué* (estilo del repo).

---

## 9. Índice rápido de sprints Shopify (orden aplicado)

```
A Clientes  → desbloquea WhatsApp/ops y Cliente en UI
B Ítems     → operación real + futuro RTO por producto
C Pago      → limpia métricas COD vs prepaid
D Higiene   → disconnect/reconnect/webhooks production-safe
```

Estado: **implementados en código y versionados en el commit asociado a este documento.** Migraciones de constraints: siguiente paso tras auditoría BD.
