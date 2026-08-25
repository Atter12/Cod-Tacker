# Partner API — Flipy × COD-tracked

**Versión contrato:** 0.2.0 (freeze Fase C — coordinar Flipy A4)  
**Copia canónica:** `COD-tracked/docs/PARTNER_CODTRACKED.md`  
**Espejo en Flipy:** `flipy/docs/PARTNER_CODTRACKED.md` (mantener sincronizado)

Maestro de integración: `FLIPY_CODTRACKED_INTEGRATION_MASTER.md`  
Alineación v0.2: `FLIPY_CODTRACKED_ALIGNMENT_V0.2.md`  
Gates: `FLIPY_INTEGRATION_GATES.md`

---

## Auth (todas las rutas Partner)

```http
X-Partner-Key: <secret>
X-Partner-Id: codtracked
X-External-Store-Id: <codtracked_store_uuid>
X-Idempotency-Key: codtracked:store:<storeId> | codtracked:order:<orderId>
```

---

## POST /api/partner/tiendas — Provision

Sin cambios v0.1.1 — CT envía `contactEmail` + `originLocation`.

---

## GET /api/partner/tiendas/:id/saldo

Sin cambios v0.1.1 — CT parsea `billeteraOperaciones` / aliases.

---

## PUT /api/partner/tiendas/:id/webhook

Sin cambios v0.1.1.

---

## POST /api/partner/envios/cotizar (v0.2)

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

Obligatorio antes de create **smart** (D4). Recomendado en **bid**.

---

## POST /api/partner/envios (v0.2)

### Campos requeridos v0.2

| Campo | Tipo | Notas |
| --- | --- | --- |
| `externalOrderId` | string | `shopify:{id}` |
| `price` | number | Smart: = `fleteQuote.recommendedFare` |
| `destinationAddress` | string | |
| `originLat/Lng`, `destinationLat/Lng` | number | Perú |
| `packageSize` | enum | `pequeno` \| `mediano` \| `grande` |
| `shopifyPayment` | object | Ver abajo |
| `fleteQuote` | object | **Obligatorio si smart** |

### Campos nuevos v0.2

| Campo | Tipo | Default | Notas |
| --- | --- | --- | --- |
| `fulfillmentMode` | `smart` \| `bid` | derivado D4 | Bifurcación operativa |
| `priceLocked` | boolean | `true` si smart | |
| `packageCare` | string[] | `[]` | `fragil`, `vidrio`, … |
| `packageCareNote` | string | `""` | max 120 |
| `typeMode` | enum | `express` | |
| `destinationEmail` | string | — | |
| `title` | string | orderNumber | |

### `shopifyPayment` (obligatorio v0.2)

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

### Matriz D3 — casos parciales

| P pagado | F pagado | `fulfillmentMode` | `codAmount` | Flete |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | **smart** | 0 | fijo (= quote) |
| ✅ | ❌ | **bid** | 0 | editable |
| ❌ | ✅ | **bid** | P | fijo (= shipping) |
| ❌ | ❌ | **bid** | P | editable |

### Response create v0.2

```json
{
  "success": true,
  "contractVersion": "0.2.0",
  "envioId": "clenv...",
  "estado": "ASIGNADO",
  "fulfillmentMode": "smart",
  "assignedMotorizado": { "id": "...", "displayName": "Juan M.", "etaMinutes": 12 },
  "trackingUrl": "https://app.flipy.pe/rastreo/...",
  "pujasWebUrl": null,
  "fleteQuote": { "recommendedFare": 14.5 }
}
```

Bid: `estado: PENDIENTE_PUJAS`, `pujasWebUrl` presente, `assignedMotorizado: null`.

---

## Webhook Flipy → COD-tracked

**URL:** `POST /api/webhooks/flipy/{agencySlug}/{storeSlug}`

**Headers:**

```http
X-Flipy-Signature: sha256=<hmac-sha256-hex-body>
X-Flipy-Event-Id: <unique>
```

### Eventos v0.2

| Evento | Cuándo | Job CT |
| --- | --- | --- |
| `shipment.created` | Post-create | `flipy.shipment.lifecycle` |
| `shipment.assigned` | Smart auto-assign o bid accept | `flipy.shipment.lifecycle` + carrier sync |
| `shipment.smart_fallback_to_bid` | Timeout D1 sin motorizado | `flipy.shipment.lifecycle` + alerta CT |
| `shipment.status.updated` | Cambio estado (legacy) | `carrier.shipment.updated` |

**Payload lifecycle ejemplo (`shipment.assigned`):**

```json
{
  "type": "shipment.assigned",
  "data": {
    "envioId": "clenv...",
    "externalOrderId": "shopify:7123456789",
    "estado": "ASIGNADO",
    "trackingToken": "cltk...",
    "trackingUrl": "https://app.flipy.pe/rastreo/cltk...",
    "fulfillmentMode": "smart",
    "assignedMotorizado": {
      "id": "clmoto...",
      "displayName": "Juan M.",
      "etaMinutes": 12
    }
  }
}
```

CT actualiza `orders.metadata`: `flipy_envio_id`, `flipy_tracking_*`, `shopify_flipy_payment`, `flipy_assigned_motorizado`.

---

## Env COD-tracked

| Variable | Notas |
| --- | --- |
| `FLIPY_V02_ENABLED` | default global; override `settings.flipy_v02` por tienda |
| `FLIPY_PARTNER_API_KEY` | secret compartido |
| `FLIPY_API_BASE_URL` | Partner API |
| `FLIPY_EMBED_ORIGIN` | panel partner iframes |
| `FLIPY_APP_ORIGIN` | app tienda / deep links |

Sin `flipy_v02` → create body v0.1.1 (retrocompat).

---

## Smoke scripts

```bash
npm run smoke:v02    # espejo flipy-v0.2-smoke.js
npm run e2e:v02      # checklist manual D3 + metadata
npm run jobs:process # tras webhooks CT
```

---

## Changelog contrato

| Versión | Cambio |
| --- | --- |
| 0.1.0 | Draft inicial |
| 0.1.1 | Freeze F1 |
| 0.2.0 | Cotizar, smart/bid, shopifyPayment, lifecycle WH, packageSize/Care, flipy_v02 |
