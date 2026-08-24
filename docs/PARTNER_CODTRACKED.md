# Partner API — Flipy × COD-tracked

**Versión contrato:** 0.1.1 (freeze F1)  
**Copia canónica:** `COD-tracked/docs/PARTNER_CODTRACKED.md`  
**Espejo en Flipy:** `flipy/docs/PARTNER_CODTRACKED.md` (mantener sincronizado)

Maestro de integración: `FLIPY_CODTRACKED_INTEGRATION_MASTER.md`  
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

**CT envía (v0.1.1):**

```json
{
  "externalStoreId": "uuid-store-ct",
  "nombre": "Mi Tienda",
  "contactEmail": "ops@tienda.pe",
  "telefono": "51999888777",
  "contactPhone": "51999888777",
  "ruc": "20123456789",
  "direccion": "Av. Larco 123, Miraflores",
  "originLocation": {
    "address": "Av. Larco 123, Miraflores",
    "lat": -12.119,
    "lng": -77.029
  },
  "webhookUrl": "https://app.codtracked.com/api/webhooks/flipy/{agency}/{store}"
}
```

| Campo | Requerido | Notas |
| --- | --- | --- |
| `externalStoreId` | sí | UUID tienda CT |
| `nombre` | sí | Display tienda |
| `contactEmail` | sí | **422 si falta** |
| `originLocation` | sí | `{ address, lat, lng }` |
| `direccion` | recomendado | Alias texto; CT = `originLocation.address` |
| `telefono` / `contactPhone` | opcional | CT duplica en ambos |
| `ruc` | opcional | |
| `webhookUrl` | opcional | CT también registra vía PUT webhook |

**Respuesta mínima:**

```json
{
  "tiendaId": "clxx...",
  "saldo": { "billeteraOperaciones": 0, "billeteraReservado": 0 }
}
```

**Aliases saldo aceptados por CT:** `billeteraOperaciones` (canónico Flipy), `saldoOperaciones`, `operaciones`.

---

## GET /api/partner/tiendas/:id/saldo

**Respuesta Flipy (canónico):**

```json
{
  "billeteraOperaciones": 150.0,
  "billeteraReservado": 12.0,
  "warningBajo": false
}
```

CT parsea `billeteraOperaciones` / `billeteraReservado` y aliases legacy.

---

## PUT /api/partner/tiendas/:id/webhook

```json
{
  "webhookUrl": "https://app.codtracked.com/api/webhooks/flipy/agency/store",
  "webhookSecret": "<hex-64>"
}
```

---

## POST /api/partner/envios

Ver maestro §9.2. CT envía `externalStoreId`, `externalOrderId` (`shopify:<id>`), `escenarioPago`, coords origen/destino, `shopifyPayment` audit.

---

## Webhook Flipy → COD-tracked

**URL:** `POST /api/webhooks/flipy/{agencySlug}/{storeSlug}`

**Headers:**

```http
X-Flipy-Signature: sha256=<hmac-sha256-hex-body>
X-Flipy-Event-Id: <unique>
```

**Payload ejemplo:**

```json
{
  "type": "shipment.status.updated",
  "data": {
    "envioId": "clenv...",
    "externalOrderId": "shopify:7123456789",
    "estado": "EN_CURSO",
    "trackingToken": "cltk...",
    "trackingUrl": "https://app.flipy.pe/rastreo/cltk...",
    "escenarioPago": "1E"
  }
}
```

CT normaliza `externalOrderId` → dígitos Shopify para link `orders.external_order_id`.

---

## Smoke F1 (local)

Script: `scripts/flipy-f1-smoke.ts`

```bash
FLIPY_PARTNER_API_KEY=... \
FLIPY_API_BASE_URL=http://localhost:4000 \
CT_APP_URL=http://localhost:3000 \
AGENCY_SLUG=demo \
STORE_SLUG=tienda \
STORE_ID=<uuid> \
CONTACT_EMAIL=ops@test.pe \
FLIPY_WEBHOOK_SECRET=<from integration settings after connect> \
npx tsx scripts/flipy-f1-smoke.ts
```

Pasos: provision → saldo → create envío 1E → webhook EN_CURSO + ENTREGADO → `npm run jobs:process`.

---

## Smoke F3/F4 (prod)

Script: `scripts/flipy-f3-f4-smoke.ts` (espejo de `flipy/backend/scripts/flipy-f3-f4-smoke.js`)

```bash
FLIPY_PARTNER_API_KEY=... \
FLIPY_API_BASE_URL=https://flipy-backend.vercel.app \
STORE_ID=60db8866-b5ff-4ca9-84c7-eacddaa72bd2 \
TIENDA_ID=cmt7pgzdl0003bgtxm020y9nx \
ORDER_EXTERNAL_ID=f3f4-smoke-001 \
npm run smoke:f3f4
```

Cubre: widget recarga + embed wallet saldo, ubicación, saldo health, deep links, `noteAttributes` → `1C`, panel pujas + embed API, conciliación `csv`/`json`/`settlement`.

**Prod (2026-08-24):** 17/17 PASS desde Flipy repo. CT espejo valida los mismos endpoints Partner API (sin top-up Prisma — asegurar saldo operaciones ≥ S/50 en tienda gate).

---

## Changelog contrato

| Versión | Cambio |
| --- | --- |
| 0.1.0 | Draft inicial |
| 0.1.1 | Freeze F1: `contactEmail` + `originLocation`; saldo `billeteraOperaciones` |
