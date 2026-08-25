# Gates — Integración Flipy × COD-tracked

> **Documentos relacionados:**  
> - Maestro: `FLIPY_CODTRACKED_INTEGRATION_MASTER.md`  
> - **Contrato API canónico:** `PARTNER_CODTRACKED.md` (v0.1.1 freeze)  
> - Backlog PRs: `FLIPY_INTEGRATION_BACKLOG.md`  
> - Casos F0-1: `FLIPY_F0_SHOPIFY_PAYMENT_CASES.md`  
> - Smoke F1: `scripts/flipy-f1-smoke.ts`
> - Smoke F3/F4: `scripts/flipy-f3-f4-smoke.ts` (espejo Flipy `backend/scripts/flipy-f3-f4-smoke.js`)

Criterios de salida por fase. No avanzar a Fase 2 UI hasta **F1 gate ✅** en ambos repos.

---

## Fase 0 — Discovery

| ID | Tarea | Repo | Estado |
| --- | --- | --- | --- |
| F0-1 | 10 pedidos Shopify clasificados | codtracked | ✅ |
| F0-2 | Matriz estados Flipy → CT | both | ✅ |
| F0-3 | Spike iframe `postMessage` mapa | flipy | ✅ (spike en Flipy; prod en F2) |
| F0-4 | Contrato API v0.1 | both | ✅ → **v0.1.1 freeze F1** |

### Gate F0 — checklist COD-tracked

- [x] Casos F0-1, resolve-payment, map-status, matriz F0-2
- [x] `docs/PARTNER_CODTRACKED.md` canónico en CT (espejo flipy)

---

## Fase 1 — Backend gate (conjunto CT + Flipy)

| Criterio | CT | Flipy Partner API | E2E smoke |
| --- | --- | --- | --- |
| Provision connect | ✅ payload v0.1.1 | requiere `contactEmail` + `originLocation` | `flipy-f1-smoke` step 1 |
| Saldo health | ✅ lee `billeteraOperaciones` | expone `billeteraOperaciones` | smoke step 2 |
| Create envío 1E | ✅ `createFlipyShipmentFromOrder` | `POST /envios` | smoke step 3 / action |
| Webhook EN_CURSO | ✅ ingress + handler | dispatcher F1-08 | smoke step 4a |
| Webhook ENTREGADO | ✅ → `delivered` + CAPI path | dispatcher F1-08 | smoke step 4b |

### Desalineaciones cerradas (v0.1.1)

| # | Issue | Fix |
| --- | --- | --- |
| 1 | CT mandaba `email` / `originAddress` plano | CT → `contactEmail` + `originLocation` (`partner-contract.ts`) |
| 2 | Saldo 0 en health | CT parsea `billeteraOperaciones` + aliases |
| 3 | Sin smoke cruzado | `scripts/flipy-f1-smoke.ts` |
| 4 | PARTNER doc disperso | `docs/PARTNER_CODTRACKED.md` canónico |

### Gate F1 — checklist ✅ (2026-08-24, prod)

| # | Criterio | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | `flipy-f1-smoke` → provision + saldo + create **200** | ✅ | Flipy prod API |
| 2 | CT webhooks EN_CURSO + ENTREGADO **200** | ✅ | `holistic-ecommerce/flipy` — gate script |
| 3 | `npm run jobs:process` → `in_transit` → `delivered` | ✅ | Shipment `pno6ljnbz4tilj6rbkbnvdw7` → `delivered` |
| 4 | Connect UI → `connected` + `flipy_tienda_id` | ✅ | `flipy_tienda_id=cmt7pgzdl0003bgtxm020y9nx` |
| 5 | Flipy gates doc espejo | ✅ | Ambos repos 2026-08-24 |

**Tienda gate:** agenteP **Flipy** — `holistic-ecommerce/flipy`

**F2 desbloqueado** — wizard modal, botón pedido, tab logística.

### COD-tracked F1 código (2026-08-24)

| PR | Estado |
| --- | --- |
| CT1-01 … CT1-07 | ✅ |
| Contrato v0.1.1 + client alignment | ✅ |
| Smoke script | ✅ |
| Gate close script + prod E2E | ✅ |

**F2 desbloqueado** — ver checklist Fase 2 abajo.

---

## Fase 2 — UI gate (código ✅ 2026-08-24, E2E manual pendiente)

| # | Criterio | Código | E2E |
| --- | --- | --- | --- |
| 1 | Modal mapa confirma pin distinto a geocode Shopify | ✅ `FlipyCreateShipmentModal` + iframe `/partner/ubicacion` | ⏳ probar en pedido Flipy |
| 2 | Escenario 1A desde pedido prepago + shipping | ✅ `FlipyPaymentStep` + `resolveFlipyPaymentForOrder` | ⏳ |
| 3 | Recojo no muestra botón crear | ✅ `pickupOrder` / `fulfillmentMode=pickup` | ⏳ |
| 4 | Post-create CTA Flipy visible | ✅ success step + `FlipyOrderLogisticsPanel` | ⏳ |
| 5 | Saldo integración | ✅ `FlipySaldoCard` en `/integrations/flipy` | ⏳ |

**Probar:** pedido en `holistic-ecommerce/flipy` → Crear envío Flipy → mapa → confirmar → tab Logística.

---

## Fase 3 — Polish gate (código ✅ 2026-08-24, E2E manual pendiente)

| # | Criterio | Código CT | Código Flipy | E2E |
| --- | --- | --- | --- | --- |
| 1 | Embed recarga `/partner/recarga` + `flipy-wallet-topped-up` | ✅ `FlipyWalletEmbed` + widget `wallet_topup` | ✅ `/partner/recarga` + embed API | ⏳ |
| 2 | Error `SALDO_INSUFICIENTE_HOLD` → CTA recarga | ✅ modal + `FlipyWalletRecargaPanel` | ✅ Partner API 400 + code | ⏳ |
| 3 | Deep link operación post-create (pujas / envío) | ✅ `FLIPY_APP_ORIGIN` + `appWebUrl` API | ✅ `appDeepLink` / `appWebUrl` en create | ⏳ |
| 4 | Settings reglas recojo por tienda | ✅ `FlipyPickupSettings` | — | ⏳ |
| 5 | `note_attributes` escenario override | ✅ `resolve-payment` + `noteAttributes` en API | ✅ `resolveEscenarioPago` | ⏳ |
| 6 | Alerta envío sin puja 24h | ✅ `flipy.bid_stale.check` + automation | — | ⏳ |

### Alineación F3 cerrada (2026-08-24)

| Tema | Contrato |
| --- | --- |
| Embed host | `FLIPY_EMBED_ORIGIN` → `https://flipy-panel.vercel.app` (`/partner/ubicacion`, `/partner/recarga`, `/partner/pujas`) |
| App tienda (pujas) | `FLIPY_APP_ORIGIN` → `https://tienda.flipyexpress.com` (o Expo web) |
| API base | `FLIPY_API_BASE_URL` → `https://flipy-backend.vercel.app` |
| postMessage recarga | `flipy-wallet-topped-up` `{ newBalance }` · error `flipy-wallet-error` |
| postMessage pujas | `flipy-bids-updated` · `flipy-bid-accepted` · `flipy-bids-error` |
| Create envío | CT envía `noteAttributes`, origin/destination contacts; Flipy devuelve `appWebUrl`, `appDeepLink`, `pujasWebUrl` |
| Destino texto↔pin | Umbral ~200 m + país; reverse-geocode o edición manual si inconsistente |
| Flete UI | 1A/1C/1E/1D: oferta requerida (> 0); label “Oferta de flete (S/)” — nunca “opcional” genérico |

**Probar E2E F3** (tienda `holistic-ecommerce/flipy`):

1. Saldo bajo → crear envío → CTA recarga → iframe Stripe test → postMessage saldo → reintentar create **200**.
2. Post-create → “Abrir en Flipy (pujas)” abre `{FLIPY_APP_ORIGIN}/envios/{envioId}` (no link rastreo cliente).
3. Pedido con `note_attributes` `flipy_escenario=1A` → escenario 1A en modal y en Partner API.

**Smoke API F3 (2026-08-24):** `npm run smoke:f3f4` → 17/17 PASS (Flipy prod; espejo CT valida mismos endpoints).

---

## Fase 4 — Automatización gate (código ✅ 2026-08-24, E2E manual pendiente)

| # | Criterio | COD-tracked | Flipy | E2E |
| --- | --- | --- | --- | --- |
| 1 | Job auto-create envío con reglas tienda | ✅ `flipy.auto_create.shipment` + settings | — | ⏳ |
| 2 | Conciliación export CSV settlement | ✅ preset `flipy_cod` + import wizard | ✅ `GET .../conciliacion/export?format=settlement` | ⏳ |
| 3 | Embed panel pujas (evaluación) | ✅ `FlipyBidsEmbed` + scope `bids_panel` | ✅ `/partner/pujas` + embed API | ⏳ |

**Probar E2E F4** (tienda `holistic-ecommerce/flipy`):

1. Integraciones → activar auto-create (confianza alta) → pedido Shopify elegible → job crea envío sin modal.
2. Export Flipy `format=settlement` → importar en Conciliación con preset Flipy → match pedidos entregados.
3. Activar embed pujas → pedido con envío → iframe resumen pujas + CTA abrir app Flipy.

**Smoke API F4 (2026-08-24):** incluido en `smoke:f3f4` — conciliación csv/json/settlement + embed pujas.

---

## Definition of Done — integración v1

1. Tienda conecta Flipy en COD-tracked.
2. Crea envío desde pedido con escenario + mapa embed.
3. Ve shipment en Logística CT vía webhooks.
4. Opera pujas/rastreo en Flipy (link claro).
5. Recarga en Flipy (MVP) o embed (F3).
6. Maestro + PARTNER + backlog + gates sincronizados en ambos repos.

---

## Changelog

| Versión | Fecha | Cambios |
| --- | --- | --- |
| 1.0 | 2026-08-24 | Gates iniciales F0 |
| 1.1 | 2026-08-24 | Sync CT: v0.1.1, F1 código ✅, gate checklist smoke |
| 1.2 | 2026-08-24 | **F1 gate ✅** — tienda `holistic-ecommerce/flipy` |
| 1.3 | 2026-08-24 | F2/F3 código CT; F3 alineado con Flipy (`FLIPY_APP_ORIGIN`, `noteAttributes`, deep links) |
| 1.4 | 2026-08-24 | **F4 código** — auto-create, conciliación CSV, embed pujas evaluación |
| 1.5 | 2026-08-24 | Smoke F3/F4 API `scripts/flipy-f3-f4-smoke.ts` |
