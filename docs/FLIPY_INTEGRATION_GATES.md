# Gates — Integración Flipy × COD-tracked

> **Documentos relacionados:**  
> - Maestro: `FLIPY_CODTRACKED_INTEGRATION_MASTER.md`  
> - **Contrato API canónico:** `PARTNER_CODTRACKED.md` (v0.1.1 freeze)  
> - Backlog PRs: `FLIPY_INTEGRATION_BACKLOG.md`  
> - Casos F0-1: `FLIPY_F0_SHOPIFY_PAYMENT_CASES.md`  
> - Smoke F1: `scripts/flipy-f1-smoke.ts`

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

### Gate F1 — checklist (marcar ✅ tras smoke local exitoso)

- [ ] `npx tsx scripts/flipy-f1-smoke.ts` → provision + saldo + create + webhooks 200
- [ ] `npm run jobs:process` → shipment `in_transit` → `delivered`
- [ ] Connect UI CT → integración `connected` con `flipy_tienda_id`
- [ ] Flipy repo: gates doc actualizado a F1 ✅ (espejo)

### COD-tracked F1 código (2026-08-24)

| PR | Estado |
| --- | --- |
| CT1-01 … CT1-07 | ✅ |
| Contrato v0.1.1 + client alignment | ✅ |
| Smoke script | ✅ |

**No iniciar F2** hasta cerrar checklist gate F1 arriba.

---

## Fase 2 — UI gate

- [ ] Modal mapa confirma pin distinto a geocode Shopify
- [ ] Escenario 1A desde pedido prepago + shipping
- [ ] Recojo no muestra botón crear
- [ ] Post-create CTA Flipy visible

---

## Definition of Done — integración v1

1. Tienda conecta Flipy en COD-tracked.
2. Crea envío desde pedido con escenario + mapa embed.
3. Ve shipment en Logística CT vía webhooks.
4. Opera pujas/rastreo en Flipy (link claro).
5. Recarga en Flipy (MVP) o embed (F3).
6. Maestro + PARTNER + backlog + gates sincronizados en ambos repos.
