# Documento maestro — Integración COD-tracked ↔ Flipy

**Versión:** 1.0  
**Estado:** listo para implementación  
**Repos:** `COD-tracked` + `flipy`  
**Copias canónicas (mantener sincronizadas):**  
`COD-tracked/docs/FLIPY_CODTRACKED_INTEGRATION_MASTER.md` · `flipy/docs/FLIPY_CODTRACKED_INTEGRATION_MASTER.md`

Este es el **único documento de referencia** para ejecutar la integración de forma articulada entre ambos equipos. Los anexos `PARTNER_CODTRACKED.md` (detalle API) y `FLIPY_INTEGRATION_BACKLOG.md` (PRs) complementan este maestro.

---

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Contexto de cada sistema](#2-contexto-de-cada-sistema)
3. [Principios y alcance](#3-principios-y-alcance)
4. [Arquitectura](#4-arquitectura)
5. [Flujos de usuario](#5-flujos-de-usuario)
6. [Reglas Shopify → escenario Flipy](#6-reglas-shopify--escenario-flipy)
7. [Implementación Flipy](#7-implementación-flipy)
8. [Implementación COD-tracked](#8-implementación-cod-tracked)
9. [Contrato de integración (API + webhooks + embed)](#9-contrato-de-integración-api--webhooks--embed)
10. [Modelo de datos](#10-modelo-de-datos)
11. [UI embebida](#11-ui-embebida)
12. [Seguridad](#12-seguridad)
13. [Plan de entrega por fases](#13-plan-de-entrega-por-fases)
14. [Testing y criterios de aceptación](#14-testing-y-criterios-de-aceptación)
15. [Variables de entorno](#15-variables-de-entorno)
16. [Índice de archivos](#16-índice-de-archivos)
17. [Anexos](#17-anexos)

---

## 1. Resumen ejecutivo

### Problema

Hoy el ciclo COD está partido:

- **COD-tracked** recibe pedidos Shopify y cierra ROAS/conciliación/CAPI, pero **no crea envíos** hacia couriers.
- **Flipy** ejecuta última milla (pujas, motorizado, billetera, PIN), pero **no tiene API partner** ni vínculo con pedidos Shopify.

### Solución

Integración articulada donde:

| Sistema | Rol |
| --- | --- |
| **COD-tracked** | Cockpit: conectar Flipy, interpretar pago Shopify, UI mapa embebida, crear envío vía API, recibir webhooks, Logística/RTO/ROAS |
| **Flipy** | Motor: billetera, holds, envíos, pujas, rastreo, PIN; expone Partner API + widgets embed |

### Principio rector

> **COD-tracked orquesta; Flipy ejecuta.**  
> Las mejoras de UX embeben **componentes críticos hospedados en Flipy** (mapa, recarga) para minimizar salidas de COD-tracked, **sin duplicar** ledger ni pagos.

### Resultado v1

La tienda puede, desde COD-tracked:

1. Conectar Flipy (provision tienda).
2. Crear envío desde pedido Shopify (escenario pago + mapa).
3. Ver estados en Logística vía webhooks.
4. Completar operación en Flipy (pujas, rastreo al cliente, recargas).

---

## 2. Contexto de cada sistema

### 2.1 COD-tracked

| Aspecto | Detalle |
| --- | --- |
| Stack | Next.js App Router, Supabase, jobs async |
| Pedidos | Shopify webhooks → `orders`, `order_items` |
| Couriers hoy | Envia, Enviame: **solo inbound** webhooks → `shipments` |
| Patrón integración | Contract → registry → `enqueueRawEventAndJob` → handler → DB |
| Guía | `docs/INTEGRATION_ADAPTER_GUIDE.md` |
| Gap | **No existe** outbound create shipment ni provider `flipy` |

**Campos Shopify relevantes en `orders`:**

- `subtotal_amount`, `shipping_amount`, `total_amount`
- `payment_kind` (`cod` \| `prepaid`) — `lib/integrations/shopify/map-payment.ts`
- `expected_cod_amount`
- `shipping_*` (texto, sin lat/lng)
- `metadata` JSON

### 2.2 Flipy

| Aspecto | Detalle |
| --- | --- |
| Stack | Node/Express, Prisma/PostgreSQL, app-tienda (RN), web-app (Next) |
| Envíos | Requieren `originLat/Lng`, `destinationLat/Lng` |
| Pago | Escenarios `1A`, `1C`, `1E`, `1D`, `GRATIS` — `backend/src/constants/escenarioPago.js` |
| Billetera | Holds al crear envío — `backend/src/utils/envioPagoFlow.js` |
| UI mapa | `app-tienda/src/components/ui/LocationPicker.tsx` |
| Gap | **No existe** Partner API ni `externalOrderId` en schema |

**Estados envío Flipy:**

`BORRADOR` → `PENDIENTE_PUJAS` → `ASIGNADO` → `EN_CURSO` → `ENTREGADO` \| `CANCELADO`

---

## 3. Principios y alcance

### 3.1 Objetivos (in scope)

| ID | Objetivo |
| --- | --- |
| O1 | Provision/vincular tienda Flipy desde COD-tracked |
| O2 | Crear envío Flipy desde pedido Shopify |
| O3 | Mapear escenario pago Shopify → Flipy con confirmación UI |
| O4 | Widget mapa Flipy embebido para destino (lat/lng) |
| O5 | Webhooks estado → Logística/RTO/CAPI en COD-tracked |
| O6 | Post-creación: CTA Flipy (pujas, rastreo) |

### 3.2 Fuera de alcance v1

| ID | Exclusión |
| --- | --- |
| N1 | Reimplementar billetera/Culqi/Stripe en COD-tracked |
| N2 | Reemplazar app Flipy tienda/motorizado |
| N3 | Embeber pujas/chat/devoluciones (fase 3+) |
| N4 | Auto-crear envío sin confirmación humana |
| N5 | Conciliación cash Flipy ↔ CSV (fase 4) |

### 3.3 Evolución UX (roadmap producto)

| Versión | Experiencia tienda |
| --- | --- |
| MVP | Crear en CT + mapa embed; recarga en app Flipy |
| v1.5 | Saldo visible + recarga embed Flipy |
| v2 | SSO + embed pujas (evaluar) |

---

## 4. Arquitectura

### 4.1 Diagrama lógico

```mermaid
flowchart TB
  subgraph CT [COD-tracked]
    SH[Shopify webhooks]
    ORD[orders]
    MOD[Modal Flipy wizard]
    IFR[iframe widget Flipy]
    ACT[Server actions / jobs]
    SHP[shipments + logistics]
    SH --> ORD
    ORD --> MOD
    MOD --> IFR
    MOD --> ACT
    ACT --> SHP
  end

  subgraph FP [Flipy]
    PAPI[Partner API /api/partner/*]
    ENV[Envio + holds + billetera]
    WH[Webhook dispatcher]
    EMB[/partner/ubicacion]
    APP[app-tienda pujas/rastreo]
    PAPI --> ENV
    ENV --> WH
    EMB -.-> MOD
    ENV --> APP
  end

  ACT -->|POST crear envío| PAPI
  WH -->|POST firmado| ACT
  IFR -->|postMessage lat/lng| MOD
```

### 4.2 Canales de comunicación

| Dirección | Mecanismo | Uso |
| --- | --- | --- |
| CT → Flipy | Partner API HTTPS | Provision, saldo, crear envío |
| CT → Flipy | iframe + `postMessage` | Confirmar ubicación destino |
| Flipy → CT | Webhook HMAC | Estados envío, entrega, RTO |
| CT → Flipy app | Deep link (v1.5 SSO) | Pujas, rastreo compartido |

### 4.3 Idempotencia

| Operación | Key |
| --- | --- |
| Provision tienda | `codtracked:store:{storeId}` |
| Crear envío | `codtracked:order:{orderId}` |
| Webhook evento | `X-Flipy-Event-Id` (dedup en raw_events) |

---

## 5. Flujos de usuario

### 5.1 Setup (una vez por tienda COD-tracked)

```
1. Usuario tiene tienda en COD-tracked (+ Shopify conectado)
2. Integraciones → Flipy → Conectar
3. Formulario: nombre, dirección origen, RUC, email, teléfono
4. COD-tracked POST /api/partner/tiendas (server-side)
5. Flipy crea/vincula User TIENDA + Tienda; devuelve flipyTiendaId
6. COD-tracked guarda integrations row (provider=flipy, secrets cifrados)
7. Usuario recarga billetera Operaciones en Flipy (MVP: app Flipy)
8. Health integración: saldo OK / warning bajo
```

**Origen recurrente:** dirección/lat-lng origen se guarda en `integrations.settings` y se reutiliza en cada envío (editable en settings Flipy/CT v2).

### 5.2 Por pedido Shopify

```
1. Pedido llega (webhook Shopify)
2. Detalle pedido → botón "Enviar con Flipy" (si integración connected y no recojo)
3. Modal paso 1: escenario pago (sugerido + override)
4. Modal paso 2: iframe /partner/ubicacion (destino con pin)
5. Modal paso 3: resumen P, F, escenario → Confirmar
6. Server action POST /api/partner/envios
7. Pantalla éxito: envioId, trackingUrl (si disponible), "Abrir Flipy → elegir motorizado"
8. Usuario en Flipy: acepta puja → comparte rastreo al cliente
9. Cliente: link rastreo + PIN según escenario
10. Webhooks Flipy → COD-tracked actualiza Logística; ENTREGADO → CAPI terminal
```

### 5.3 Recojo / pickup

Si Shopify indica recojo en tienda:

- **No** llamar crear envío Flipy
- COD-tracked marca fulfillment local (`orders.metadata.fulfillment_mode = pickup`)
- Botón Flipy oculto o deshabilitado con explicación

### 5.4 Qué permanece en Flipy (siempre)

| Acción | Por qué |
| --- | --- |
| Recarga billetera Operaciones | Culqi/Stripe, ledger Flipy |
| Aceptar ofertas motorizados | Marketplace realtime |
| Compartir link rastreo + PIN | Flujo operativo nativo |
| Chat, devoluciones, evidencias | Apps tienda/motorizado |

---

## 6. Reglas Shopify → escenario Flipy

### 6.1 Implementar en COD-tracked

**Módulo:** `lib/integrations/flipy/resolve-payment.ts`

**Función:** `resolveShopifyFlipyPayment(order) → FlipyPaymentResolution`

```typescript
type FlipyPaymentResolution = {
  fulfillmentMode: "delivery" | "pickup" | "unknown";
  productPaidAtCheckout: boolean;
  shippingPaidAtCheckout: boolean;
  suggestedEscenario: "1A" | "1C" | "1E" | "1D" | "GRATIS" | null;
  codAmount: number | null;      // P — subtotal producto
  suggestedFlete: number | null; // F — shipping_amount o null → cotizar
  confidence: "high" | "medium" | "low";
  requiresUserConfirmation: boolean;
  reasons: string[];
};
```

### 6.2 Algoritmo (orden de evaluación)

1. **Detectar recojo**  
   - `shipping_lines` title/code contiene: `pickup`, `recojo`, `retiro`, `local pickup`  
   - → `fulfillmentMode: pickup`, sin escenario

2. **Derivar payment_kind** (ya existe `mapShopifyPayment`)

3. **Comparar montos** (tolerancia ±0.05 PEN):

   ```
   subtotal = order.subtotal_amount ?? 0
   shipping = order.shipping_amount ?? 0
   total    = order.total_amount ?? 0
   expected = order.expected_cod_amount ?? total
   ```

4. **Matriz de decisión**

   | Condición | suggestedEscenario | codAmount | Flete |
   | --- | --- | --- | --- |
   | `payment_kind=prepaid` AND shipping>0 AND pagado | **1A** | null | shipping |
   | `payment_kind=prepaid` AND shipping=0 | **1A** + confirm | null | cotizar |
   | `payment_kind=cod` AND expected ≈ subtotal+shipping | **1E** default* | subtotal | shipping |
   | `payment_kind=cod` AND expected ≈ subtotal | **1E** default* | subtotal | cotizar |
   | Ambiguo / descuentos | **1E** + confirm obligatorio | calcular | cotizar |

   \* Usuario elige método cliente → 1C (Yape), 1D (digital), 1E (efectivo)

5. **Validaciones Flipy post-selección**

   | Regla | Acción UI |
   | --- | --- |
   | 1C + codAmount > 300 | Sugerir 1D (`PRODUCTO_EXCEDE_TOPE_YAPE`) |
   | 1A + codAmount > 0 | Bloquear |
   | COD + codAmount null/0 | Bloquear |

6. **Persistir** en `orders.metadata.shopify_flipy_payment` tras confirmación usuario.

### 6.3 Escenarios Flipy (referencia monetización)

| Escenario | Producto | Hold tienda (Operaciones) | Cobro al cliente |
| --- | --- | --- | --- |
| **1A** | Prepago online | Flete + 8% comisión | Ya pagó |
| **1C** | COD | Solo comisión | P+F vía Yape al moto |
| **1E** | COD | Solo comisión | P+F efectivo |
| **1D** | COD | Solo comisión | P+F digital (Culqi/Stripe rastreo) |
| **GRATIS** | — | 0 | — |

Fuente: `flipy/backend/src/constants/escenarioPago.js`, `envioPagoFlow.js`.

---

## 7. Implementación Flipy

### 7.1 Fase 1 — Backend Partner API

#### 7.1.1 Schema Prisma (PR-F1-01)

**Archivo:** `backend/prisma/schema.prisma`

**Nuevas tablas:**

```prisma
model PartnerIntegration {
  id            String   @id @default(cuid())
  partnerId     String   @unique  // "codtracked"
  apiKeyHash    String
  webhookSecret String?
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
}

model PartnerStoreLink {
  id               String   @id @default(cuid())
  tiendaId         String   @unique
  partnerId        String   @default("codtracked")
  externalStoreId  String   @unique
  webhookUrl       String?
  webhookSecret    String?
  metadata         Json?
  createdAt        DateTime @default(now())
  tienda           Tienda   @relation(fields: [tiendaId], references: [id])
}
```

**Campos nuevos:**

- `Tienda.partnerSource`, `Tienda.externalStoreId`, `Tienda.originLocation` (Json)
- `Envio.partnerSource`, `Envio.externalOrderId`, `Envio.externalStoreId`

#### 7.1.2 Middleware auth (PR-F1-02)

**Archivo:** `backend/src/middleware/partnerAuthMiddleware.js`

- Validar `X-Partner-Key` contra hash en `PartnerIntegration`
- Resolver `tiendaId` desde `X-External-Store-Id` vía `PartnerStoreLink`
- Adjuntar `req.partner`, `req.partnerTienda`

**Montaje:** `backend/server.js` → `/api/partner`

#### 7.1.3 Rutas Partner (PR-F1-03 … F1-09)

**Archivo:** `backend/src/routes/partner.js`

| Método | Ruta | Handler |
| --- | --- | --- |
| POST | `/tiendas` | `partnerController.provisionTienda` |
| GET | `/tiendas/:id/saldo` | `partnerController.getSaldo` |
| PUT | `/tiendas/:id/webhook` | `partnerController.registerWebhook` |
| POST | `/widgets/token` | `partnerController.issueWidgetToken` |
| GET | `/maps/autocomplete` | `mapsController.getPlacesAutocomplete` |
| GET | `/maps/place-details` | `mapsController.getPlaceDetails` |
| GET | `/maps/reverse-geocode` | `mapsController.getReverseGeocode` |
| POST | `/envios/cotizar` | `partnerController.cotizarEnvio` |
| POST | `/envios` | `partnerController.createEnvio` |
| GET | `/envios/:id` | `partnerController.getEnvio` |
| GET | `/envios/by-external-order` | `partnerController.getEnvioByExternalOrder` |

#### 7.1.4 Refactor create envío (PR-F1-05)

**Extraer de** `backend/src/controllers/enviosController.js` **a** `backend/src/services/envioCreateService.js`:

- Validación coordenadas Perú
- `resolveEscenarioPago`, `evaluarLiquidezTiendaCrearEnvio`
- `authorizeHold` transaccional
- Generación `trackingToken`, `orderCode` en detalles

Tanto JWT tienda como Partner API llaman al mismo servicio.

#### 7.1.5 Webhook dispatcher (PR-F1-08)

**Archivo:** `backend/src/services/partnerWebhookService.js`

Disparar en cambios `Envio.estado` (hook Prisma middleware o en controllers existentes):

```javascript
await dispatchPartnerWebhook({
  tiendaId,
  type: 'shipment.status.updated',
  data: { envioId, externalOrderId, estado, ... }
});
```

- POST a `PartnerStoreLink.webhookUrl`
- Header `X-Flipy-Signature: sha256=...`
- Retry con backoff (cola jobs o cron)

### 7.2 Fase 2 — Widget embed (web-app)

#### 7.2.1 Token widget (PR-F2-01)

**Endpoint:** `POST /api/partner/widgets/token`

JWT claims: `partnerId`, `externalStoreId`, `flipyTiendaId`, `orderId`, `scope[]`, `exp`

#### 7.2.2 Página ubicación (PR-F2-02)

**Ruta:** `web-app/app/partner/ubicacion/page.tsx`

- Validar JWT query param
- Reutilizar lógica `LocationPicker` / `getMapPickerLeafletHTML` con `postTarget: 'parent'`
- Prefill desde query: `prefillAddress`, `lat`, `lng`
- `Content-Security-Policy: frame-ancestors` → dominios COD-tracked
- Confirmar → `window.parent.postMessage({ type: 'flipy-location-confirmed', ... })`

#### 7.2.3 Recarga embed (v1.5 — PR-F3-01)

**Ruta:** `web-app/app/partner/recarga/page.tsx`

- Checkout Culqi/Stripe existente de billetera tienda
- postMessage `flipy-wallet-topped-up` al completar

### 7.3 Flipy — checklist DoD backend

- [ ] Migraciones aplicadas
- [ ] Partner auth 401/403 testeado
- [ ] Provision idempotente por externalStoreId
- [ ] Create envío 1A y 1E con idempotency
- [ ] SALDO_INSUFICIENTE_HOLD retorna 400 con code
- [ ] Webhook recibido en endpoint CT de prueba
- [ ] Maps proxy funcional con partner key

---

## 8. Implementación COD-tracked

### 8.1 Patrón existente a seguir

Ver `docs/INTEGRATION_ADAPTER_GUIDE.md`:

```
Contract → Registry → enqueueRawEventAndJob → Handler → DB
```

Flipy es **carrier + outbound create** (capacidad nueva respecto a Envia/Enviame).

### 8.2 Fase 1 — Backend e integración

#### 8.2.1 Migración Supabase (PR-CT1-01)

**Archivo:** `supabase/migrations/YYYYMMDDHHMMSS_add_flipy_integration.sql`

- Enum `integration_provider` += `'flipy'`
- Insert seed `carriers` row: `code='flipy'`, `name='Flipy'`

Regenerar `types/database.generated.ts`.

#### 8.2.2 Catálogo y contrato (PR-CT1-02)

| Archivo | Cambio |
| --- | --- |
| `lib/integrations/catalog.ts` | Entry provider `flipy`, kind `carrier` |
| `lib/integrations/contracts/carrier-provider.ts` | `CarrierProviderId` += `flipy` |
| `lib/integrations/flipy/live-carrier.ts` | Stub health/getTracking |
| `lib/integrations/registry.ts` | `getCarrierProvider('flipy')` |
| `services/integrations.service.ts` | `connectFlipyLive`, health |

#### 8.2.3 Resolver pago Shopify (PR-CT1-03)

**Archivos:**

- `lib/integrations/flipy/resolve-payment.ts`
- `lib/integrations/flipy/resolve-payment.test.ts`

≥15 casos unitarios cubriendo matriz §6.2.

#### 8.2.4 Connect flow (PR-CT1-04)

**Archivos:**

- `lib/integrations/flipy/client.ts` — HTTP client Partner API
- `lib/integrations/flipy/credentials.ts` — encrypt partner key + flipyTiendaId
- `services/integrations.service.ts` — `connectFlipyLive()`
- `app/actions/integrations.ts` — `connectFlipyLiveAction`
- `components/integrations/FlipyConnectForm.tsx`
- `app/a/.../integrations/[provider]/page.tsx` — wire `flipy`

**Connect payload:** datos tienda + origen → POST `/api/partner/tiendas`

**Persistencia `integrations`:**

```json
{
  "provider": "flipy",
  "external_account_id": "clxx_tienda_id",
  "settings": {
    "origin_address": "...",
    "origin_lat": -12.119,
    "origin_lng": -77.029,
    "webhook_url": "https://app.codtracked.com/api/webhooks/flipy/{agency}/{store}",
    "webhook_secret_ref": "encrypted"
  }
}
```

#### 8.2.5 Webhook ingress (PR-CT1-05)

**Ruta:** `app/api/webhooks/flipy/[agencySlug]/[storeSlug]/route.ts`

1. Verificar `X-Flipy-Signature`
2. Resolver tienda por slug + integration row
3. `enqueueRawEventAndJob` → job type `carrier.shipment.updated`

**Archivo ingress:** `lib/integrations/flipy/webhook-ingress.ts`  
**Mapper:** `lib/integrations/flipy/map-webhook.ts`

#### 8.2.6 Handler carrier (PR-CT1-06)

**Extender:** `lib/jobs/handlers/carrier-shipment-updated.ts`

- Aceptar `carrier_code: 'flipy'`
- Upsert `carriers` code flipy
- Link order: `order_external_id` desde `shopify:xxx` → digits
- Status map vía `carrier_status_mappings`

**Seed mappings:**

| external_status_code | normalized_status |
| --- | --- |
| PENDIENTE_PUJAS | pending |
| ASIGNADO | assigned |
| EN_CURSO | in_transit |
| ENTREGADO | delivered |
| CANCELADO | failed |

**Archivo:** `lib/integrations/flipy/map-status.ts`

#### 8.2.7 Server action crear envío (PR-CT1-07)

**Archivo:** `app/actions/flipy-shipments.ts`

```typescript
export async function createFlipyShipmentFromOrder(input: {
  agencySlug: string;
  storeSlug: string;
  orderId: string;
  escenarioPago: EscenarioPago;
  destination: { address: string; lat: number; lng: number };
  fletePrice?: number;
}): Promise<ActionResult<{ envioId: string; trackingUrl?: string }>>
```

Flujo:

1. `requireStoreAccess`, permiso `orders.manage`
2. Load order + integration credentials
3. `resolveShopifyFlipyPayment` validate coherencia
4. POST Flipy `/api/partner/envios` con idempotency
5. Patch `orders.metadata.flipy_envio_id`, `flipy_tracking_url`
6. Revalidate logistics + order detail

### 8.3 Fase 2 — UI

#### 8.3.1 Modal wizard (PR-CT2-04)

**Archivo:** `components/flipy/FlipyCreateShipmentModal.tsx`

| Paso | Componente | Datos |
| --- | --- | --- |
| 1 | `FlipyPaymentStep` | Sugerencia + selector 1A/1C/1E/1D |
| 2 | `FlipyLocationEmbed` | iframe src from widget token API |
| 3 | `FlipyConfirmStep` | Resumen + submit action |

**Listener postMessage:**

```typescript
window.addEventListener("message", (e) => {
  if (e.data?.type === "flipy-location-confirmed") {
    setDestination({ address: e.data.address, lat: e.data.lat, lng: e.data.lng });
  }
});
```

Validar `e.origin` contra allowlist Flipy.

#### 8.3.2 Entrada en pedido (PR-CT2-05)

**Archivo:** `components/orders/FlipyShipmentPanel.tsx` o extender `OrderActionsPanel`

- Visible si `integrations.status === connected` && !pickup
- Botón abre modal
- Disabled si ya existe `metadata.flipy_envio_id`

#### 8.3.3 Post-create + logística (PR-CT2-06)

- Pantalla/modal éxito con `trackingUrl`, copy link, CTA deep link Flipy
- Tab Logística pedido muestra shipment linkado (ya existe bundle en `getOrderDetail`)

#### 8.3.4 Health (PR-CT2-07)

- `IntegrationOverviewCard` muestra saldo Flipy (GET saldo)
- Badge `degraded` si saldo bajo

### 8.4 COD-tracked — checklist DoD

- [ ] Provider flipy en catálogo UI
- [ ] Connect provisiona tienda Flipy
- [ ] Modal crea envío end-to-end con iframe mapa
- [ ] Webhook actualiza shipment + timeline
- [ ] ENTREGADO dispara path CAPI existente (`lib/conversions/delivered-purchase.ts`)
- [ ] Error SALDO_INSUFICIENTE → CTA Flipy recarga

---

## 9. Contrato de integración (API + webhooks + embed)

> Detalle exhaustivo de payloads: `docs/PARTNER_CODTRACKED.md` (v0.1.1)

### 9.1 Autenticación Partner

```http
X-Partner-Key: <secret>
X-Partner-Id: codtracked
X-External-Store-Id: <codtracked_store_uuid>
X-Idempotency-Key: codtracked:order:<orderId>
```

### 9.2 Crear envío (request mínimo)

```json
{
  "externalStoreId": "uuid",
  "externalOrderId": "shopify:7123456789",
  "orderNumber": "#1042",
  "escenarioPago": "1E",
  "codAmount": 89.0,
  "price": 15.0,
  "originAddress": "...",
  "originLat": -12.119,
  "originLng": -77.029,
  "originContact": "Mi Tienda",
  "originPhone": "51987654321",
  "destinationAddress": "...",
  "destinationLat": -12.096,
  "destinationLng": -77.028,
  "destinationContact": "Juan Pérez",
  "destinationPhone": "51999888777",
  "shopifyPayment": {
    "productPaidAtCheckout": false,
    "shippingPaidAtCheckout": false,
    "shopifyShippingAmount": 12.0,
    "shopifySubtotal": 89.0,
    "expectedCodProduct": 89.0,
    "paymentKind": "cod"
  }
}
```

### 9.3 Respuesta crear envío

```json
{
  "success": true,
  "envioId": "clenv...",
  "estado": "PENDIENTE_PUJAS",
  "trackingToken": "cltk...",
  "trackingUrl": "https://app.flipy.pe/rastreo/cltk...",
  "escenarioPago": "1E"
}
```

### 9.4 Webhook Flipy → COD-tracked

**URL registrada:**

```
https://{codtracked_host}/api/webhooks/flipy/{agencySlug}/{storeSlug}
```

**Payload normalizado interno CT (job):**

```json
{
  "tracking_number": "cltk...",
  "external_shipment_id": "clenv...",
  "order_external_id": "7123456789",
  "external_status_code": "ENTREGADO",
  "occurred_at": "2026-08-24T16:00:00Z",
  "carrier_code": "flipy",
  "metadata": {
    "tracking_url": "...",
    "escenario_pago": "1E",
    "collected_cod_amount": 104.0
  }
}
```

### 9.5 Errores críticos UX

| code Flipy | Acción COD-tracked |
| --- | --- |
| `SALDO_INSUFICIENTE_HOLD` | Modal error + "Recargar en Flipy" |
| `OUT_OF_PERU` | Reabrir paso mapa |
| `PRODUCTO_EXCEDE_TOPE_YAPE` | Sugerir escenario 1D |
| `TIENDA_NOT_LINKED` | Reconectar integración |

---

## 10. Modelo de datos

### 10.1 COD-tracked

**`integrations`** (existente)

| Campo | Valor Flipy |
| --- | --- |
| provider | `flipy` |
| external_account_id | flipyTiendaId |
| secret_reference | partner credentials cifrados |
| settings | origin, webhook, flipy ids |

**`orders.metadata`**

```json
{
  "shopify_flipy_payment": {
    "suggestedEscenario": "1E",
    "confirmedEscenario": "1E",
    "codAmount": 89,
    "fletePrice": 15,
    "confirmedAt": "2026-08-24T..."
  },
  "flipy_envio_id": "clenv...",
  "flipy_tracking_url": "https://...",
  "fulfillment_mode": "delivery"
}
```

**`shipments`** (vía handler existente)

| Campo | Fuente |
| --- | --- |
| carrier_id | carriers.code=flipy |
| external_shipment_id | envioId |
| tracking_number | trackingToken |
| order_id | FK order |
| metadata | tracking_url, escenario |

### 10.2 Flipy

Ver §7.1.1 + campos existentes `Envio`:

- `precio` = flete F
- `precioProducto` / detalles.codAmount = P
- `escenarioPago`, `trackingToken`, `codigoVerificacion`

---

## 11. UI embebida

### 11.1 Qué embeber vs qué link

| Superficie | Estrategia | Fase |
| --- | --- | --- |
| Escenario pago | UI nativa COD-tracked | 1 |
| Mapa destino | iframe Flipy `/partner/ubicacion` | 1 |
| Saldo billetera | Read API en card integración | 1.5 |
| Recarga | iframe `/partner/recarga` | 1.5 |
| Pujas | Deep link / iframe evaluar | 2+ |
| Rastreo cliente | Copy link desde CT post-webhook | 1 |

### 11.2 Secuencia modal COD-tracked

```
┌─────────────────────────────────────────┐
│ Enviar pedido #1042 con Flipy           │
├─────────────────────────────────────────┤
│ [1] Pago    [2] Ubicación    [3] Enviar │
│                                         │
│ (contenido paso activo)                 │
└─────────────────────────────────────────┘
```

### 11.3 postMessage contract

| type | direction | payload |
| --- | --- | --- |
| `flipy-location-confirmed` | Flipy → CT | `{ address, lat, lng }` |
| `flipy-location-error` | Flipy → CT | `{ code, message }` |
| `flipy-wallet-topped-up` | Flipy → CT | `{ newBalance }` (v1.5) |

---

## 12. Seguridad

| Tema | Implementación |
| --- | --- |
| Partner key | Solo server; env `FLIPY_PARTNER_API_KEY` en CT |
| Secrets at rest | `encryptSecret()` COD-tracked; hash en Flipy |
| Webhook | HMAC SHA256 body; reject replay via event id |
| iframe JWT | TTL 15 min; scope limitado; bound to store+order |
| postMessage | Validar `event.origin` allowlist |
| RLS | CT: store_id en todas las queries |
| PII | Teléfono/dirección solo server→server a Flipy |

---

## 13. Plan de entrega por fases

### Resumen

| Fase | Duración | Entregable |
| --- | --- | --- |
| **0** Discovery | 1–2 sem | Casos Shopify validados, API firmada |
| **1** Backend both | 3–4 sem | Partner API + webhook + action crear envío |
| **2** UI embed | 2–3 sem | Modal wizard + connect form + logística |
| **3** Polish | 2–3 sem | Saldo, recarga embed, SSO |
| **4** Auto/conciliación | futuro | Reglas auto, CSV cash |

### Orden de merge crítico

```
F0 → Flipy F1-01..09 → CT CT1-01..07 → Flipy F2-01..02 → CT F2-03..07 → F3+
```

### Paralelización equipos

| Dev A (Flipy) | Dev B (COD-tracked) |
| --- | --- |
| Schema + partner auth | Migración enum + catálogo |
| envioCreateService refactor | resolve-payment + tests |
| partner/envios + webhooks | webhook ingress + handler |
| /partner/ubicacion | Connect form + modal (mock mapa primero) |

**Backlog PR detallado:** `docs/FLIPY_INTEGRATION_BACKLOG.md`

---

## 14. Testing y criterios de aceptación

### 14.1 Unitarios

| Suite | Repo | Casos |
| --- | --- | --- |
| resolveShopifyFlipyPayment | CT | ≥15 |
| map-status flipy | CT | todos estados |
| escenario validation | Flipy | 1A/1C/1E/1D edge |
| partner auth | Flipy | 401/403 |
| idempotency create | Flipy | duplicate key |

### 14.2 Integración E2E manual

| # | Escenario | Resultado esperado |
| --- | --- | --- |
| T1 | Connect Flipy | integration connected + tienda Flipy |
| T2 | COD solo producto → 1E + mapa | envío PENDIENTE_PUJAS |
| T3 | Prepago + shipping → 1A | codAmount null, hold prepago_flete |
| T4 | Saldo insuficiente | error + CTA recarga |
| T5 | Webhook EN_CURSO → ENTREGADO | shipment CT actualizado |
| T6 | ENTREGADO COD | CAPI terminal path |
| T7 | Recojo Shopify | no botón crear |
| T8 | Idempotency doble click | un solo envío Flipy |

### 14.3 Definition of Done — integración v1

- [ ] Tienda conecta Flipy desde COD-tracked
- [ ] Crea envío con escenario + mapa embed sin copiar dirección manual
- [ ] Ve shipment y estados en Logística CT
- [ ] Opera pujas/rastreo en Flipy con CTA claro
- [ ] Recarga en Flipy (embed opcional v1.5)
- [ ] Documentación maestro + PARTNER + backlog sincronizados

---

## 15. Variables de entorno

### Flipy

```env
PARTNER_CODTRACKED_API_KEY=
PARTNER_WIDGET_JWT_SECRET=
PARTNER_ALLOWED_ORIGINS=https://app.codtracked.com,http://localhost:3000
GOOGLE_MAPS_API_KEY=          # maps proxy (existente)
```

### COD-tracked

```env
FLIPY_PARTNER_API_KEY=        # mismo secret que Flipy valida
FLIPY_API_BASE_URL=https://api.flipy.pe
FLIPY_EMBED_ORIGIN=https://flipy-panel.vercel.app
FLIPY_APP_ORIGIN=https://tienda.flipyexpress.com
FLIPY_API_BASE_URL=https://flipy-backend.vercel.app
INTEGRATION_MODE=live         # cuando flipy live adapter activo
```

---

## 16. Índice de archivos

### Flipy (nuevos/modificados)

| Archivo | Acción |
| --- | --- |
| `backend/prisma/schema.prisma` | Modify |
| `backend/src/middleware/partnerAuthMiddleware.js` | Create |
| `backend/src/routes/partner.js` | Create |
| `backend/src/controllers/partnerController.js` | Create |
| `backend/src/services/envioCreateService.js` | Create (refactor) |
| `backend/src/services/partnerWebhookService.js` | Create |
| `web-app/app/partner/ubicacion/page.tsx` | Create |
| `web-app/app/partner/recarga/page.tsx` | Create (v1.5) |
| `docs/PARTNER_CODTRACKED.md` | Anexo API |

### COD-tracked (nuevos/modificados)

| Archivo | Acción |
| --- | --- |
| `supabase/migrations/*_add_flipy_integration.sql` | Create |
| `lib/integrations/catalog.ts` | Modify |
| `lib/integrations/flipy/*` | Create |
| `lib/jobs/handlers/carrier-shipment-updated.ts` | Modify |
| `app/api/webhooks/flipy/[agencySlug]/[storeSlug]/route.ts` | Create |
| `app/actions/flipy-shipments.ts` | Create |
| `components/flipy/FlipyCreateShipmentModal.tsx` | Create |
| `components/integrations/FlipyConnectForm.tsx` | Create |
| `docs/FLIPY_INTEGRATION_BACKLOG.md` | Anexo PRs |

---

## 17. Anexos

### Anexo A — Mapeo estados completo

| Flipy estado | CT normalized | Terminal | CAPI |
| --- | --- | --- | --- |
| PENDIENTE_PUJAS | pending | no | no |
| ASIGNADO | assigned | no | no |
| EN_CURSO | in_transit | no | no |
| ENTREGADO | delivered | sí | sí (COD) |
| CANCELADO | failed | sí | no |
| Devolución confirmada | rto | sí | no |

### Anexo B — Documentos relacionados

| Documento | Ubicación | Uso |
| --- | --- | --- |
| **Este maestro** | `docs/FLIPY_CODTRACKED_INTEGRATION_MASTER.md` | Implementación articulada |
| Partner API detalle | `flipy/docs/PARTNER_CODTRACKED.md` | Payloads exhaustivos |
| Backlog PRs | `docs/FLIPY_INTEGRATION_BACKLOG.md` | Sprint planning |
| Adapter guide | `docs/INTEGRATION_ADAPTER_GUIDE.md` | Patrón CT |
| Escenarios pago Flipy | `flipy/backend/src/constants/escenarioPago.js` | Reglas negocio |
| Monetización Flipy | `flipy/docs/FLIPY_PRODUCTO_ALINEADO_MONETIZACION.md` | Holds/comisiones |

### Anexo C — Changelog

| Versión | Fecha | Cambios |
| --- | --- | --- |
| 1.0 | 2026-08-24 | Documento maestro inicial |

---

**Fin del documento maestro.** Para iniciar implementación: Fase 0 tarea F0-1 (validar pedidos Shopify reales) → PR-F1-01 + PR-CT1-01 en paralelo.
