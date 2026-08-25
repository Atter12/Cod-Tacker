# Alineación COD-tracked ↔ Flipy v0.2 — Implementación

**Versión:** 0.2.0 (draft implementación)  
**Estado:** listo para iniciar desarrollo  
**Repos:** `COD-tracked` + `flipy`  
**Copias canónicas (mantener sincronizadas):**  
`COD-tracked/docs/FLIPY_CODTRACKED_ALIGNMENT_V0.2.md` · `flipy/docs/FLIPY_CODTRACKED_ALIGNMENT_V0.2.md`

**Documentos relacionados:**

| Documento | Rol |
| --- | --- |
| `PARTNER_CODTRACKED.md` | Detalle API (actualizar a v0.2 al cerrar Fase A) |
| `FLIPY_CODTRACKED_INTEGRATION_MASTER.md` | Maestro v1.0 (contexto general) |
| `FLIPY_INTEGRATION_BACKLOG.md` | PRs atómicos |
| `FLIPY_INTEGRATION_GATES.md` | Criterios de salida por fase |

---

## Decisiones de producto cerradas

| ID | Decisión |
| --- | --- |
| **D1** | Smart sin motorizado: **cola + reintentos + fallback a bid** con alerta CT (`shipment.smart_fallback_to_bid`). Incluir en cierre v0.2. |
| **D3** | Shopify puede pagar **solo producto** o **solo flete** en checkout. **Flipy adapta** cobro parcial (PIN, hold, settlement); CT solo mapea y envía `shopifyPayment`. |
| **D4** | **Smart / `1A` operativo solo si `shippingPaidAtCheckout === true`**. Producto pagado sin flete prepagado → bid, no smart. |

### Bifurcación operativa v0.2

| Rama | Condición | Comportamiento |
| --- | --- | --- |
| **SMART** | Flete pagado en checkout (`shippingPaidAtCheckout`) | Flete fijo (= cotización Flipy), sin puja, asignación directa al motorizado más cercano |
| **BID** | Flete no pagado en checkout | Puja normal; tienda oferta flete; motorizados compiten |

---

## 1. Matriz de alineación campo por campo

Leyenda: ✅ OK v0.1.1 · ⚠️ parcial · ❌ falta · 🔒 nuevo v0.2

| Campo | Fuente Shopify | Procesamiento CT | Flipy Partner API | Persistencia Flipy | Estado / efecto | Gap v0.2 |
| --- | --- | --- | --- | --- | --- | --- |
| `externalOrderId` | `order.id` | `shopify:{id}` | ✅ requerido | `envios.externalOrderId` | Idempotencia | ✅ |
| `orderNumber` | `order_number` | header wizard | ✅ | `detalles.partnerOrderNumber` | Referencia | ✅ |
| `title` | `#order_number` | implícito | ⚠️ default | `detalles.title` | Display | CT enviar explícito |
| `escenarioPago` | gateways, financial_status | `resolveShopifyFlipyPayment` + UI | ✅ | `envios.escenarioPago` | Rail de cobro (1A/1C/1E/1D) | ✅ |
| `productPaidAtCheckout` | `financial_status`, transactions | `resolveShopifyFlipyPayment` | 🔒 en `shopifyPayment` | `detalles.shopifyPayment` | PIN, cod P | 🔒 Flipy deriva cobro |
| `shippingPaidAtCheckout` | shipping line paid | resolución | 🔒 en `shopifyPayment` | idem | **Smart vs bid (D4)** | 🔒 |
| `expectedCodProduct` | subtotal si COD | mapper | 🔒 en `shopifyPayment` | `precioProducto` si >0 | Monto P a cobrar | 🔒 |
| `expectedCodShipping` | shipping si COD | mapper + cotizar | 🔒 en `shopifyPayment` | validación `price` | Monto F a cobrar | 🔒 |
| `codAmount` | resolución | UI / server | ✅ | `precioProducto` + `detalles` | P en destino | Permitir 0 si P pagado |
| `price` (flete) | `shipping_amount` fallback | UI o cotización | ✅ `price` | `envios.precio` | F publicado | Smart: fijo = quote |
| `fleteQuote` | — | `POST /cotizar` | ⚠️ opcional | `detalles.fleteQuote` | Auditoría | 🔒 obligatorio smart |
| `fulfillmentMode` | derivado D4 | mapper | 🔒 `smart` \| `bid` | lógica create | Bifurcación operativa | 🔒 |
| `priceLocked` | — | true si smart | 🔒 boolean | validación create | Rechaza price ≠ quote | 🔒 |
| `originAddress/lat/lng` | settings + mapa | embed + settings | ✅ | `envios.origen` JSON | Ruta | ✅ |
| `originContact/Phone` | store + form | validación PE | ✅ opcional | `origen` + `detalles` | Contacto recojo | CT siempre enviar |
| `destinationAddress/lat/lng` | shipping address | embed + geocode | ✅ | `envios.destino` JSON | Ruta | ✅ |
| `destinationContact/Phone` | customer + form | validación PE | ✅ opcional | `destino` + `detalles` | Contacto entrega | CT siempre enviar |
| `destinationEmail` | customer.email | form | ⚠️ CT no envía | soportado API | PIN email | CT ampliar client |
| `packageSize` | peso/dimensiones líneas | mapper | ⚠️ default mediano | `detalles.packageSize` | Cotización | 🔒 requerido v0.2 |
| `packageCare[]` | tags (`fragile`, etc.) | mapper tags | ❌ | solo app nativa hoy | Info moto | 🔒 ambos |
| `packageCareNote` | note attributes | notas motorizado | ❌ | solo app nativa | Info moto | 🔒 ambos |
| `typeMode` | — | default express | ⚠️ default | `detalles.typeMode` | Visibilidad marketplace | 🔒 CT default express |
| `scheduledDate/Window*` | — | — | ❌ | solo app nativa | Programado −2h | v0.2.1 |
| `notes` | — | paso flete | ✅ | `detalles.notes` | Notas | ✅ |
| `shopifyPayment` | order audit | blob resolución | ✅ | `detalles.shopifyPayment` | Fuente verdad parcial | 🔒 ampliar campos |
| `noteAttributes` | Shopify + CT | merge | ✅ | `resolveEscenarioPago` | Override escenario | ✅ |
| `estado` (response) | — | UI success | siempre `PENDIENTE_PUJAS` hoy | `envios.estado` | Post-create | 🔒 smart → `ASIGNADO` / `ASIGNANDO_SMART` |
| `assignedMotorizado` | — | — | ❌ | vía `Oferta` hoy | Asignación | 🔒 smart response |
| `pujasWebUrl` | — | siempre embed | siempre hoy | — | UI CT success | 🔒 null en smart |
| `flipy_envio_id` | — | `orders.metadata` | — | — | CT persistencia | ✅ |
| Webhook create | — | poll / status | ❌ | — | Sync CT | 🔒 `shipment.created` |

### Matriz pagos parciales Shopify → Flipy (D3)

Flipy deriva operación desde `shopifyPayment` (CT no decide PIN/hold):

| `productPaid` | `shippingPaid` | `fulfillmentMode` | `codAmount` | Flete | Cobro destino | PIN @ recojo |
| --- | --- | --- | --- | --- | --- | --- |
| ✅ | ✅ | **smart** | 0 | fijo (= cotización) | Ninguno | Libre |
| ✅ | ❌ | **bid** | 0 | editable (puja) | Solo F | Libre (P ya pagado) |
| ❌ | ✅ | **bid** | P (subtotal) | fijo (= shipping pagado) | Solo P | Bloqueado hasta cobro P |
| ❌ | ❌ | **bid** | P | editable | P + F | Bloqueado hasta cobro |

`escenarioPago` en casos parciales: rail de cobro (`1E` default, `1C` si Yape); solo fila 1 usa `1A`.

---

## 2. Matriz Smart vs Bid

### 2.1 Condiciones de entrada

| Dimensión | SMART | BID |
| --- | --- | --- |
| Trigger Shopify | `shippingPaidAtCheckout === true` (D4) | `shippingPaidAtCheckout === false` |
| `escenarioPago` típico | `1A` | `1C` / `1E` / `1D` |
| `fulfillmentMode` | `smart` | `bid` |
| Flete | = `fleteQuote.recommendedFare`, bloqueado | Oferta tienda (editable, ≥ minOffer) |
| Cotización pre-create | **Obligatoria** (`POST /cotizar`) | Recomendada |
| `packageSize` | Input cotización | Input cotización |
| Tamaño / cuidado | En create body | En create body |

### 2.2 Estados del envío

| Evento | SMART (v0.2) | BID |
| --- | --- | --- |
| Post-create inmediato | `ASIGNANDO_SMART` o `ASIGNADO` | `PENDIENTE_PUJAS` |
| Moto encontrado | `ASIGNADO` + webhook `shipment.assigned` | — |
| Sin moto (D1) | Reintentos 30s / 60s / 120s | — |
| Timeout ~180s sin moto | Fallback → `PENDIENTE_PUJAS` + `shipment.smart_fallback_to_bid` | — |
| Puja / aceptación | N/A (salvo fallback) | Moto puja → tienda acepta → `ASIGNADO` |
| Hold tienda @ create | F + 8% si flete prepagado | 8% (`solo_comision`) o mixto según D3 |
| Webhook inicial | `shipment.created` + `shipment.assigned` | `shipment.created` |

Estados nuevos propuestos en enum (o metadata transitoria):

- `ASIGNANDO_SMART` — búsqueda motorizado en curso

### 2.3 UI COD-tracked

| Pantalla | SMART | BID |
| --- | --- | --- |
| Modalidad pago | Skip (auto 1A si flete prepagado) | Radios 1C / 1E / 1D |
| Wizard | **Paso 1 Ruta** unificado (recojo + entrega + tamaño + cuidado + flete) | Igual |
| Flete | Solo lectura (cotización Flipy) | Editable + rango mercado |
| Confirm | Badge "Asignación automática" | "Motorizados pujarán" |
| Success | Sin `FlipyBidsEmbed`; card moto / tracking | `FlipyBidsEmbed` + tracking |
| Fallback D1 | Banner + `FlipyBidsEmbed` | — |

### 2.4 API Flipy

| Capacidad | SMART | BID |
| --- | --- | --- |
| `POST /envios/cotizar` | Requerido antes de create | Recomendado |
| `POST /envios` | `fulfillmentMode: smart`, `priceLocked: true` | `fulfillmentMode: bid` |
| Response `estado` | `ASIGNADO` \| `ASIGNANDO_SMART` | `PENDIENTE_PUJAS` |
| `pujasWebUrl` | `null` | presente |
| `assignedMotorizado` | `{ id, displayName?, etaMinutes? }` | `null` |
| `paymentBreakdown` | desglose cobro parcial | desglose cobro parcial |
| Widget `bids_panel` | No solicitar | Sí en success |

### 2.5 Flujo D1 — Smart sin motorizado

```
POST /envios (fulfillmentMode: smart)
        │
        ▼
  Buscar moto online + GPS < 5 min, radio ~8 km
        │
   ┌────┴────┐
   │ OK      │──► ASIGNADO + shipment.assigned
   └────┬────┘
        │ no
        ▼
  ASIGNANDO_SMART + reintentos (30s, 60s, 120s)
        │
   ┌────┴────┐
   │ OK      │──► ASIGNADO
   └────┬────┘
        │ timeout ~180s
        ▼
  PENDIENTE_PUJAS + shipment.smart_fallback_to_bid
  CT: alerta + FlipyBidsEmbed
```

---

## 3. Contrato Partner API v0.2

**Versión:** `0.2.0`  
**Base:** retrocompatible con `0.1.1` (campos nuevos opcionales; defaults derivados)

### 3.1 Auth (sin cambio)

```http
X-Partner-Key: <secret>
X-Partner-Id: codtracked
X-External-Store-Id: <store_uuid>
X-Idempotency-Key: codtracked:order:<orderId>
```

### 3.2 `POST /api/partner/envios/cotizar`

**Request:**

```json
{
  "originLat": -12.119,
  "originLng": -77.029,
  "destinationLat": -12.096,
  "destinationLng": -77.028,
  "packageSize": "mediano",
  "typeMode": "express"
}
```

**Mejora v0.2:** usar Google Directions (paridad app nativa).

**Response:**

```json
{
  "success": true,
  "fleteQuote": {
    "version": 2,
    "recommendedFare": 14.5,
    "marketLow": 12.25,
    "marketHigh": 17.4,
    "minOffer": 10.15,
    "maxOffer": 43.5,
    "distanceKm": 3.2,
    "durationMinutes": 12,
    "packageSize": "mediano",
    "typeMode": "express",
    "source": "directions"
  }
}
```

### 3.3 `POST /api/partner/envios` — campos

#### Requeridos v0.2

| Campo | Tipo | Notas |
| --- | --- | --- |
| `externalOrderId` | string | `shopify:{id}` |
| `price` | number | Flete; smart: debe = `fleteQuote.recommendedFare` |
| `destinationAddress` | string | |
| `originLat/Lng`, `destinationLat/Lng` | number | Perú |
| `packageSize` | enum | `pequeno` \| `mediano` \| `grande` |
| `shopifyPayment` | object | Ver §3.4 |
| `fleteQuote` | object | **Obligatorio si smart** |

#### Nuevos / ampliados v0.2

| Campo | Tipo | Default | Notas |
| --- | --- | --- | --- |
| `fulfillmentMode` | `smart` \| `bid` | derivado D4 | Canónico bifurcación |
| `priceLocked` | boolean | `true` si smart | |
| `packageCare` | string[] | `[]` | `fragil`, `vidrio`, `liquido`, `alimentos`, `liviano`, `vertical` |
| `packageCareNote` | string | `""` | max 120 |
| `typeMode` | enum | `express` | `programado` / `recurrente` en v0.2.1 |
| `destinationEmail` | string | — | |
| `title` | string | orderNumber | |

#### `shopifyPayment` — campos obligatorios v0.2

```json
{
  "productPaidAtCheckout": false,
  "shippingPaidAtCheckout": false,
  "shopifySubtotal": 70.85,
  "shopifyShippingAmount": 15.0,
  "expectedCodProduct": 70.85,
  "expectedCodShipping": 15.0,
  "paymentKind": "cod",
  "confirmedEscenario": "1E",
  "noteAttributes": []
}
```

### 3.4 Comportamiento servidor por caso

| Caso | `fulfillmentMode` | `escenarioPago` | `price` | `codAmount` | `estado` | Puja |
| --- | --- | --- | --- | --- | --- | --- |
| P+F prepagados | `smart` | `1A` | = quote, locked | 0 / null | `ASIGNADO`* | No |
| P prepago, F COD | `bid` | `1E`/`1C` | editable | 0 | `PENDIENTE_PUJAS` | Sí |
| F prepago, P COD | `bid` | `1E`/`1C` | = shipping, locked | P | `PENDIENTE_PUJAS` | Sí |
| P+F COD | `bid` | `1E`/`1C` | editable | P | `PENDIENTE_PUJAS` | Sí |

\*O `ASIGNANDO_SMART` si asignación async (D1).

**Validaciones Flipy:**

- `smart` + `shippingPaidAtCheckout !== true` → `422 FULFILLMENT_MODE_CONFLICT`
- `smart` sin `fleteQuote` → `422 FLETE_QUOTE_REQUIRED`
- `smart` + `price !== recommendedFare` → `422 FLETE_PRICE_LOCKED`
- COD + `expectedCodProduct === 0` → permitir `codAmount: 0` (solo flete por cobrar)
- `1C` + `codAmount > 300` → `PRODUCTO_EXCEDE_TOPE_YAPE`

### 3.5 Response create v0.2

```json
{
  "success": true,
  "contractVersion": "0.2.0",
  "envioId": "clenv...",
  "estado": "ASIGNADO",
  "fulfillmentMode": "smart",
  "escenarioPago": "1A",
  "price": 14.5,
  "fleteQuote": { "recommendedFare": 14.5, "distanceKm": 3.2 },
  "paymentBreakdown": {
    "productPaidAtCheckout": true,
    "shippingPaidAtCheckout": true,
    "collectAtDelivery": { "product": 0, "shipping": 0 }
  },
  "assignedMotorizado": {
    "id": "clmoto...",
    "displayName": "Juan M.",
    "etaMinutes": 12
  },
  "trackingUrl": "https://app.flipy.pe/rastreo/...",
  "pujasWebUrl": null,
  "holdOperaciones": { "modo": "prepago_flete", "monto": 15.66 }
}
```

Bid:

```json
{
  "estado": "PENDIENTE_PUJAS",
  "fulfillmentMode": "bid",
  "assignedMotorizado": null,
  "pujasWebUrl": "https://panel.flipy.pe/partner/pujas?token=..."
}
```

### 3.6 Webhooks v0.2

| Evento | Cuándo |
| --- | --- |
| `shipment.created` | Siempre post-create |
| `shipment.assigned` | Smart auto-assign o bid accept |
| `shipment.smart_fallback_to_bid` | Timeout D1 sin motorizado |
| `shipment.status.updated` | Cambio estado |
| `shipment.delivered` | `ENTREGADO` |

Payload `data` ampliado: `fulfillmentMode`, `paymentBreakdown`, `assignedMotorizadoId`, `externalStoreId`, `flipyTiendaId`, `trackingUrl`, `collectedCodAmount`, `pinLiberado`.

### 3.7 Errores nuevos

| Code | Condición |
| --- | --- |
| `FLETE_QUOTE_REQUIRED` | smart sin `fleteQuote` |
| `FLETE_PRICE_LOCKED` | smart y `price ≠ recommended` |
| `FULFILLMENT_MODE_CONFLICT` | smart sin flete prepagado |
| `SMART_NO_DRIVER` | sin fallback habilitado (dev only) |

### 3.8 Retrocompatibilidad

- Cliente sin `fulfillmentMode` → Flipy deriva de `shippingPaidAtCheckout` / `escenarioPago`.
- Sin `packageSize` → default `mediano` (deprecar en v0.3).
- Response incluye `contractVersion`.

---

## 4. Plan de implementación por fases

### Vista general

```
Fase A (Flipy API) ──► Fase B (CT UI + mapper) ──► Fase C (E2E + freeze)
     A1 contrato/cotizar          B1 client + cotizar
     A2 smart + cobro parcial     B2 mappers Shopify
     A3 partner create v0.2       B3 UI Paso 1 Ruta
     A4 tests/smoke               B4 smart/bid success
                                  C1 E2E 4 casos pago
                                  C2 auto-create v0.2
                                  C3 doc freeze v0.2.0
```

---

### Fase A — Solo Flipy (API + core)

| ID | Entregable | Archivos clave | Depende |
| --- | --- | --- | --- |
| **A1** | Bump `FLIPY_PARTNER_CONTRACT_VERSION = '0.2.0'` | `backend/src/utils/partnerContract.js` | — |
| **A1** | Partner cotizar con Directions | `partnerController.js`, `drivingDistance.js` | — |
| **A1** | `packageCare` en partner create | `partnerController.js` `buildPartnerDetalles` | — |
| **A2a** | `resolveCobroParcial()` — D3 | `backend/src/utils/envioPagoFlow.js` | — |
| **A2a** | PIN / hold / settlement parcial | `envioPagoFlow.js`, `tiendaOperacionesHoldService.js` | A2a |
| **A2b** | `smartAssignmentService` + retry + fallback D1 | nuevo service, job/cola | producto D1 |
| **A2b** | Estado `ASIGNANDO_SMART` (enum o convención) | `schema.prisma`, `envioCreateService.js` | A2b |
| **A2c** | Create bifurcado smart → ASIGNADO sin puja manual | `envioCreateService.js` | A2b |
| **A2c** | Validación `priceLocked`, `fleteQuote` required, D4 | `envioCreateService.js` | A1 |
| **A2c** | `codAmount: 0` permitido partner si P pagado | `envioCreateService.js` | A2a |
| **A3** | Response `fulfillmentMode`, `paymentBreakdown`, `assignedMotorizado` | `partnerController.js` | A2c |
| **A3** | Webhooks `created`, `assigned`, `smart_fallback_to_bid` | `partnerWebhookService.js` | A2b |
| **A4** | Tests unit + `backend/scripts/flipy-v0.2-smoke.js` | `__tests__/`, scripts | A3 |

**Gate Fase A:**

- [ ] Smoke 1A (flete prepagado) → `ASIGNADO`, sin `pujasWebUrl`
- [ ] Smoke 1E → `PENDIENTE_PUJAS`
- [ ] Smoke producto prepago + flete COD → bid, `codAmount: 0`
- [ ] Smoke D1 fallback → `PENDIENTE_PUJAS` + webhook fallback
- [ ] `PARTNER_CODTRACKED.md` actualizado (draft v0.2)

---

### Fase B — Solo COD-tracked (UI + mapper)

| ID | Entregable | Archivos clave | Depende |
| --- | --- | --- | --- |
| **B1** | Tipos `FlipyCreateEnvioInput` v0.2 | `lib/integrations/flipy/client.ts`, `partner-contract.ts` | A1 draft |
| **B1** | `cotizarFlipyFlete()` action | `app/actions/flipy-shipments.ts` o nuevo | A1 cotizar |
| **B2** | `resolveShopifyFlipyPayment` + D4 (`smartEligible`) | `resolve-payment.ts` | — |
| **B2** | `expectedCodProduct` / `expectedCodShipping` | `resolve-payment.ts`, create service | B2 |
| **B2** | Mapper `packageSize` desde líneas Shopify | nuevo `map-package-size.ts` | — |
| **B2** | Mapper `packageCare` desde tags | nuevo | — |
| **B2** | Enviar `destinationEmail`, `fulfillmentMode`, `fleteQuote` | `create-shipment-service.ts` | B1 |
| **B3** | Refactor wizard → Paso 1 Ruta unificado | `FlipyCreateShipmentModal.tsx` | B1 |
| **B3** | Cards tamaño + chips cuidado + recotizar al mover pin | mismo | B2 |
| **B3** | Flete readonly (smart) / editable (bid) | `flete-rules.ts` | D4 |
| **B4** | Success: ocultar bids si smart; fallback UI D1 | modal, `FlipyShipmentPanel.tsx` | A3 |
| **B4** | Metadata `shopify_flipy_payment` ampliada | create service | B2 |
| **B4** | Tests: `resolve-payment`, `flete-rules`, `client` | `*.test.ts` | B3 |

**Gate Fase B:**

- [ ] Wizard manual: prepago flete → sin paso flete editable
- [ ] Create body incluye `fulfillmentMode`, `packageSize`, `fleteQuote`, `shopifyPayment` completo
- [ ] Feature flag `flipy_v02` por tienda (rollout seguro)

---

### Fase C — Integración E2E + tests

| ID | Entregable | Depende | CT código |
| --- | --- | --- | --- |
| **C1** | E2E staging: 4 casos matriz pagos parciales (D3) | A4 + B4 | ⏳ `npm run e2e:v02` manual |
| **C1** | Webhook CT: `shipment.created`, `assigned`, `smart_fallback_to_bid` | A3 + CT handler | ✅ |
| **C1** | Regresión v0.1.1 (CT sin flag sigue funcionando) | A3 retrocompat | ✅ |
| **C2** | Auto-create v0.2: smart en prepago flete, defaults tamaño | B2 + A2 | ✅ |
| **C3** | Freeze `PARTNER_CODTRACKED.md` v0.2.0 ambos repos | C1 green | ✅ draft CT · ⏳ espejo Flipy |
| **C3** | Actualizar `FLIPY_INTEGRATION_GATES.md` | C3 | ✅ |

**Gate Fase C (DoD revelación v0.2):**

- [ ] Prepago flete (smart): sin pujas, moto asignado o asignando
- [ ] COD: pujas funcionales en embed
- [ ] UI Paso 1 Ruta paridad Flipy nativo (tamaño + cuidado + flete)
- [ ] 4 sub-casos pago parcial Shopify correctos en holds/settlement
- [ ] D1 fallback probado en staging
- [ ] Smoke scripts v0.2 en ambos repos

---

## Anexo — Secuencias E2E

### Smart (flete prepagado)

```
Shopify (shipping paid) → CT resolve (smartEligible)
  → CT cotizar → recommended 14.5
  → CT POST /envios { fulfillmentMode: smart, price: 14.5, fleteQuote, shopifyPayment }
  → Flipy assign moto → ASIGNADO
  → webhooks created + assigned → CT metadata
  → CT success sin FlipyBidsEmbed
```

### Bid (COD full)

```
Shopify COD → CT resolve → fulfillmentMode bid
  → CT cotizar → UI flete editable
  → CT POST /envios { fulfillmentMode: bid, price: 16, codAmount: 70.85 }
  → Flipy PENDIENTE_PUJAS
  → CT success con FlipyBidsEmbed
```

---

## Anexo — Variables de entorno nuevas (Flipy)

```env
SMART_ASSIGNMENT_ENABLED=true
SMART_ASSIGNMENT_RADIUS_KM=8
SMART_ASSIGNMENT_GPS_MAX_AGE_MIN=5
SMART_ASSIGNMENT_RETRY_MS=30000,60000,120000
SMART_ASSIGNMENT_FALLBACK_TIMEOUT_MS=180000
```

## Anexo — Feature flag (CT)

```env
FLIPY_V02_ENABLED=true   # por tienda en settings.integrations.flipy
```

---

*Última actualización: 2026-08-25 — decisiones D1, D3, D4 cerradas.*
