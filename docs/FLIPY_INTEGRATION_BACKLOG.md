# Backlog — Integración Flipy × COD-tracked

> **Documento maestro (implementación articulada):** `FLIPY_CODTRACKED_INTEGRATION_MASTER.md`  
> **Gates por fase:** `FLIPY_INTEGRATION_GATES.md`  
> **Contrato API canónico (v0.1.1):** `PARTNER_CODTRACKED.md` — espejo en `flipy/docs/PARTNER_CODTRACKED.md`  
> Casos F0-1: `FLIPY_F0_SHOPIFY_PAYMENT_CASES.md`

Plan de implementación desglosado en **PRs atómicos**, alineado con el maestro y el anexo Partner API.

**Estimación total MVP usable (Fase 0–2):** ~8–10 semanas (1 dev full-stack o 2 en paralelo).

---

## Leyenda

| Campo | Significado |
| --- | --- |
| **Repo** | `flipy` \| `codtracked` \| `both` |
| **Dep** | PRs bloqueantes |
| **DoD** | Definition of done del PR |

---

## Fase 0 — Discovery (1–2 semanas)

| ID | PR / tarea | Repo | Dep | DoD |
| --- | --- | --- | --- | --- |
| F0-1 | Exportar 10 pedidos Shopify reales + clasificar escenario pago | codtracked | — | Sheet/casos en `docs/` o Notion |
| F0-2 | Matriz estados Flipy → normalizados CT | both | — | Tabla en PARTNER doc §5.3 validada |
| F0-3 | Spike iframe `postMessage` Leaflet ↔ página estática | flipy | — | Demo en branch spike |
| F0-4 | Aprobar contrato API v0.1 | both | F0-1 | Sign-off en PARTNER_CODTRACKED.md |

---

## Fase 1 — Flipy backend Partner API

### PR-F1-01 — Schema partner + external ids

**Repo:** flipy  
**Archivos:** `backend/prisma/schema.prisma`, migration

- Tablas `PartnerIntegration`, `PartnerStoreLink`
- Campos `partnerSource`, `externalStoreId`, `externalOrderId` en `Envio`/`Tienda`
- Índices unique

**DoD:** `prisma migrate` OK; seed dev opcional.

---

### PR-F1-02 — Partner auth middleware

**Repo:** flipy  
**Archivos:** `backend/src/middleware/partnerAuthMiddleware.js`, `server.js`

- Validar `X-Partner-Key`, `X-Partner-Id`
- Resolver tienda por `X-External-Store-Id`

**DoD:** Tests unitarios 401/403.

---

### PR-F1-03 — POST /api/partner/tiendas

**Repo:** flipy  
**Dep:** F1-01, F1-02

- Provision idempotente tienda + user TIENDA
- Response `tiendaId`, saldos iniciales

**DoD:** Postman/curl + test integración.

---

### PR-F1-04 — GET /api/partner/tiendas/:id/saldo

**Repo:** flipy  
**Dep:** F1-02

- Exponer billetera Operaciones, reservado, warnings

**DoD:** Test con tienda seed.

---

### PR-F1-05 — Refactor create envío → servicio

**Repo:** flipy  
**Dep:** F1-01

- Extraer lógica de `enviosController.createEnvio` a `envioCreateService.js`
- Sin cambio de comportamiento app-tienda

**DoD:** Tests existentes verdes.

---

### PR-F1-06 — POST /api/partner/envios

**Repo:** flipy  
**Dep:** F1-05, F1-02

- Crear envío desde payload partner
- Idempotency, validación escenario, liquidez

**DoD:** Casos 1A, 1E, saldo insuficiente, duplicado.

---

### PR-F1-07 — GET envío partner

**Repo:** flipy  
**Dep:** F1-06

- By id + by externalOrderId

**DoD:** Tests.

---

### PR-F1-08 — Webhook dispatcher

**Repo:** flipy  
**Dep:** F1-01, F1-06

- Hook en cambio `Envio.estado`
- POST a URL registrada + firma HMAC
- `PUT /api/partner/tiendas/:id/webhook`

**DoD:** Webhook de prueba recibido en RequestBin/local CT.

---

### PR-F1-09 — Partner maps proxy

**Repo:** flipy  
**Dep:** F1-02

- `/api/partner/maps/autocomplete|place-details|reverse-geocode`

**DoD:** Paridad con rutas tienda existentes.

---

## Fase 1 — COD-tracked backend

### PR-CT1-01 — Enum + migración `flipy` provider

**Repo:** codtracked  
**Archivos:** `supabase/migrations/*`, `types/database.generated.ts`

- `integration_provider` += `flipy`
- Seed carrier `flipy` en `carriers`

**DoD:** Migration aplicada local.

---

### PR-CT1-02 — Catálogo + registry flipy

**Repo:** codtracked  
**Dep:** CT1-01

- `lib/integrations/catalog.ts`
- `lib/integrations/contracts/carrier-provider.ts` (id flipy)
- Stub `lib/integrations/flipy/live-carrier.ts`

**DoD:** Overview integraciones muestra Flipy.

---

### PR-CT1-03 — `resolveShopifyFlipyPayment`

**Repo:** codtracked  
**Archivos:** `lib/integrations/flipy/resolve-payment.ts`, tests

- Matriz Shopify → escenario sugerido
- Detección recojo básica (`shipping_lines`)

**DoD:** ≥15 tests unitarios.

---

### PR-CT1-04 — Connect Flipy service + secrets

**Repo:** codtracked  
**Dep:** CT1-02, F1-03

- `connectFlipyLive()` → POST partner/tiendas
- Cifrado credenciales `integrations`
- `app/actions/integrations.ts`

**DoD:** Integración row `connected` tras connect.

---

### PR-CT1-05 — Webhook ingress Flipy

**Repo:** codtracked  
**Dep:** CT1-01, F1-08

- `app/api/webhooks/flipy/[agencySlug]/[storeSlug]/route.ts`
- Verificar firma, enqueue job

**DoD:** Raw event + job en cola.

---

### PR-CT1-06 — Handler carrier flipy + mappings

**Repo:** codtracked  
**Dep:** CT1-05

- Extender `carrier-shipment-updated.ts` → `flipy`
- Seed `carrier_status_mappings` (PENDIENTE_PUJAS, ASIGNADO, EN_CURSO, ENTREGADO, CANCELADO)
- `lib/integrations/flipy/map-status.ts`

**DoD:** Webhook simulado upsert shipment + evento.

---

### PR-CT1-07 — Server action crear envío (sin UI mapa)

**Repo:** codtracked  
**Dep:** CT1-04, CT1-03, F1-06

- `app/actions/flipy-shipments.ts`
- Geocode server-side temporal destino Shopify
- POST partner/envios + persist metadata en order

**DoD:** Action invocable desde dev; envío en Flipy DB.

---

## Fase 2 — UI embebida + flujo tienda

### PR-F2-01 — Widget JWT + POST /partner/widgets/token

**Repo:** flipy  
**Dep:** F1-02

**DoD:** Token TTL 15m; scope validation.

---

### PR-F2-02 — Página `/partner/ubicacion`

**Repo:** flipy (web-app)  
**Dep:** F2-01, F1-09

- iframe Leaflet/LocationPicker
- postMessage confirmación
- CORS / frame-ancestors COD-tracked

**DoD:** Spike F0-3 reemplazado por ruta prod.

---

### PR-F2-03 — FlipyConnectForm

**Repo:** codtracked  
**Dep:** CT1-04

- Form provision (nombre, dirección origen, RUC)
- Página `[provider]/page.tsx` wiring

**DoD:** Connect E2E manual.

---

### PR-F2-04 — FlipyCreateShipmentModal (wizard)

**Repo:** codtracked  
**Dep:** CT1-03, CT1-07, F2-02

- Paso 1: escenario pago (sugerido + override)
- Paso 2: iframe ubicación
- Paso 3: resumen + submit

**DoD:** Crear envío desde pedido UI.

---

### PR-F2-05 — Botón en detalle pedido + permisos

**Repo:** codtracked  
**Dep:** F2-04

- `OrderActionsPanel` o panel Flipy
- Ocultar si recojo detectado

**DoD:** RBAC `orders.manage`.

---

### PR-F2-06 — Tab Logística pedido + post-create

**Repo:** codtracked  
**Dep:** CT1-06, F2-04

- Mostrar shipment Flipy linkado
- Pantalla éxito: tracking URL, CTA "Abrir Flipy"

**DoD:** Estado sync tras webhook manual.

---

### PR-F2-07 — Integration health Flipy

**Repo:** codtracked  
**Dep:** F1-04, CT1-04

- Health check saldo en overview card
- Badge degradado si saldo bajo

**DoD:** Visible en `/integrations/flipy`.

---

## Fase 3 — Polish (opcional v1.5)

| ID | PR | Repo | DoD |
| --- | --- | --- | --- |
| F3-01 | `/partner/recarga` embed | flipy | postMessage recarga OK |
| F3-02 | Saldo + recarga CTA en modal error | codtracked | UX saldo insuficiente |
| F3-03 | Deep link / SSO abrir app Flipy | both | Un tap desde post-create |
| F3-04 | Settings reglas recojo Shopify | codtracked | Override por tienda |
| F3-05 | `note_attributes` escenario override | both | Checkout custom |
| F3-06 | Alerta envío sin puja 24h | codtracked | Automation rule |

---

## Fase 4 — Automatización (futuro)

| ID | PR | Repo |
| --- | --- | --- |
| F4-01 | Job auto-create envío reglas | codtracked |
| F4-02 | Conciliación export Flipy CSV | both |
| F4-03 | Embed panel pujas (evaluación) | flipy + codtracked |

---

## Orden de merge recomendado (crítico)

```
F0 → F1-01..F1-09 (flipy backend)
   → CT1-01..CT1-07 (codtracked backend)
   → F2-01..F2-02 (widget flipy)
   → F2-03..F2-07 (UI codtracked)
   → F3+
```

**Paralelo posible:**

- Dev A: F1-* (flipy)
- Dev B: CT1-01..03, CT1-05..06 mientras F1-05..06 avanza

---

## Testing por fase

### Fase 1 gate

- [ ] Provision tienda idempotente
- [ ] Crear envío 1E desde action CT
- [ ] Webhook EN_CURSO → shipment CT
- [ ] Webhook ENTREGADO → delivered + CAPI path

### Fase 2 gate

- [ ] Modal mapa confirma pin distinto a geocode Shopify
- [ ] Escenario 1A desde pedido prepago+shipping
- [ ] Recojo no muestra botón crear
- [ ] Post-create CTA Flipy visible

---

## Definition of Done — integración v1

1. Tienda conecta Flipy en COD-tracked.
2. Crea envío desde pedido con escenario + mapa embed.
3. Ve shipment en Logística CT vía webhooks.
4. Opera pujas/rastreo en Flipy (link claro).
5. Recarga en Flipy (MVP) o embed (F3).
6. Documentación PARTNER + backlog actualizados.

---

## Referencias

- Flipy: `docs/PARTNER_CODTRACKED.md` (canónico CT; espejo en flipy)
- COD-tracked: `docs/INTEGRATION_ADAPTER_GUIDE.md`, `docs/PRODUCT_OVERVIEW.md`
- Flipy escenarios: `backend/src/constants/escenarioPago.js`
- COD-tracked Shopify payment: `lib/integrations/shopify/map-payment.ts`
